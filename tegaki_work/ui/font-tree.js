/**
 * ============================================================================
 * ファイル名: ui/font-tree.js
 * 責務: 吹き出しのフォント選択用に、表示分類と手動順を一軸へ投影する。
 *       Project/Historyのデータは持たず、分類APIへの操作だけを呼び出し元へ返す。
 * 公開API: FontTree
 * ============================================================================
 */

const ROOT_KEY = 'root';

function asKey(value) {
    return String(value ?? '').trim();
}

function folderKey(id) {
    return 'folder:' + asKey(id);
}

function parentKey(parentId) {
    return parentId ? folderKey(parentId) : ROOT_KEY;
}

/**
 * 一軸の表示tree。DOMイベントをここへ閉じ込め、分類の保存は呼び出し元へ委譲する。
 */
export class FontTree {
    constructor({ container, onSelect, onFolderSelect, onEscape, onMove, getLoadedFont } = {}) {
        this.container = container || null;
        this.getLoadedFont = typeof getLoadedFont === 'function' ? getLoadedFont : () => null;
        this.onSelect = typeof onSelect === 'function' ? onSelect : () => {};
        this.onFolderSelect = typeof onFolderSelect === 'function' ? onFolderSelect : () => {};
        this.onEscape = typeof onEscape === 'function' ? onEscape : () => {};
        this.onMove = typeof onMove === 'function' ? onMove : () => {};
        this._folders = [];
        this._fonts = [];
        this._nodes = new Map();
        this._orders = {};
        this._placements = {};
        this._favoriteFirst = false;
        this._openFolders = new Set();
        this._initialized = false;
        this._selectedKey = '';
        this._dragKey = '';
        this._dropKey = '';
        this._boundKeyDown = (event) => this._handleKeyDown(event);
        this._boundClick = (event) => this._handleClick(event);
        this._boundDragOver = (event) => this._handleDragOver(event);
        this._boundDrop = (event) => this._handleDrop(event);
        this._boundDragEnd = () => this._clearDragState();
        this.container?.addEventListener('keydown', this._boundKeyDown);
        this.container?.addEventListener('click', this._boundClick);
        this.container?.addEventListener('dragover', this._boundDragOver);
        this.container?.addEventListener('drop', this._boundDrop);
        this.container?.addEventListener('dragend', this._boundDragEnd);
        this.container?.addEventListener('dragstart', event => this._handleDragStart(event));
    }

    setModel({ folders = [], fonts = [], placements = {}, orders = {}, favoriteFirst = false } = {}) {
        this._folders = Array.isArray(folders) ? folders.filter(folder => folder?.id) : [];
        this._fonts = Array.isArray(fonts) ? fonts.filter(font => font?.key || font?.id) : [];
        this._placements = placements && typeof placements === 'object' ? placements : {};
        this._orders = orders && typeof orders === 'object' ? orders : {};
        this._favoriteFirst = favoriteFirst === true;
        this._nodes = new Map();
        this._folders.forEach(folder => {
            const id = asKey(folder.id);
            this._nodes.set(folderKey(id), {
                key: folderKey(id),
                id,
                type: 'folder',
                label: String(folder.label ?? folder.name ?? id),
                parentId: folder.parentId || null,
                canMove: folder.canMove !== false
            });
        });
        this._fonts.forEach((font, index) => {
            const id = asKey(font.id);
            const key = asKey(font.key) || 'font:' + id;
            const placement = Object.prototype.hasOwnProperty.call(this._placements, id)
                ? this._placements[id]
                : (font.parentId || font.folderId || null);
            this._nodes.set(key, {
                ...font,
                id,
                key,
                type: 'font',
                label: String(font.label ?? font.family ?? id),
                parentId: placement || null,
                orderIndex: index,
                favorite: font.favorite === true,
                canMove: font.canMove !== false
            });
        });
        if (!this._initialized && this._folders.length > 0) {
            this._folders
                .filter(folder => !folder.parentId)
                .forEach(folder => this._openFolders.add(asKey(folder.id)));
            this._initialized = true;
        } else {
            const validFolders = new Set(this._folders.map(folder => asKey(folder.id)));
            for (const id of [...this._openFolders]) if (!validFolders.has(id)) this._openFolders.delete(id);
        }
        if (this._selectedKey && !this._nodes.has(this._selectedKey)) this._selectedKey = '';
        this.render();
    }

    setSelected(key, { focus = false } = {}) {
        this._selectedKey = asKey(key);
        if (!this.container) return;
        if (focus) {
            const selectedNode = this.getNode(this._selectedKey);
            let parentId = selectedNode?.parentId || null;
            const seenParents = new Set();
            let changed = false;
            while (parentId && !seenParents.has(parentId)) {
                seenParents.add(parentId);
                if (!this._openFolders.has(parentId)) {
                    this._openFolders.add(parentId);
                    changed = true;
                }
                parentId = this.getNode(folderKey(parentId))?.parentId || null;
            }
            if (changed) {
                this.render();
                return;
            }
        }
        this.container.querySelectorAll('[role="treeitem"]').forEach(item => {
            const selected = item.dataset.nodeKey === this._selectedKey;
            item.setAttribute('aria-selected', String(selected));
            item.classList.toggle('is-selected', selected);
            item.tabIndex = selected ? 0 : -1;
            if (focus && selected) item.focus();
        });
    }

    getSelectedKey() {
        return this._selectedKey;
    }

    getNode(key) {
        return this._nodes.get(asKey(key)) || null;
    }

    getVisibleFontKeys() {
        if (!this.container) return [];
        return [...this.container.querySelectorAll('[role="treeitem"][data-node-type="font"]')]
            .map(item => item.dataset.nodeKey)
            .filter(Boolean);
    }

    getFontNodes() {
        return [...this._nodes.values()].filter(node => node.type === 'font' && !node.disabled);
    }

    getOrderedFontNodes() {
        const result = [];
        const visit = (parentId) => {
            this._childrenFor(parentId).forEach(node => {
                if (node.type === 'font') result.push(node);
                else visit(node.id);
            });
        };
        visit(null);
        return result;
    }

    getChildren(parentId = null) {
        return this._childrenFor(parentId);
    }

    moveRelative(key, direction) {
        const node = this.getNode(key);
        if (!node || node.canMove === false) return null;
        const siblings = this._actualChildrenFor(node.parentId).filter(item => item.canMove !== false);
        const index = siblings.findIndex(item => item.key === node.key);
        if (index < 0) return null;
        if (direction < 0) {
            if (index === 0) return null;
            return { nodeKey: node.key, parentId: node.parentId || null, beforeKey: siblings[index - 1].key };
        }
        if (index >= siblings.length - 1) return null;
        const next = siblings[index + 1];
        const after = siblings[index + 2];
        return { nodeKey: node.key, parentId: node.parentId || null, beforeKey: after?.key || null, movedAfter: next.key };
    }

    toggleFolder(id, open = null, { focus = false } = {}) {
        const folderId = asKey(id);
        if (!this._nodes.has(folderKey(folderId))) return;
        const next = open === null ? !this._openFolders.has(folderId) : open === true;
        if (next) this._openFolders.add(folderId); else this._openFolders.delete(folderId);
        this.render();
        if (focus) this.setSelected(folderKey(folderId), { focus: true });
    }

    focusSelected() {
        if (!this.container) return;
        const selected = [...this.container.querySelectorAll('[role="treeitem"]')].find(item => item.dataset.nodeKey === this._selectedKey);
        (selected || this.container.querySelector('[role="treeitem"]'))?.focus();
    }

    render() {
        if (!this.container) return;
        this.container.replaceChildren();
        this.container.setAttribute('role', 'tree');
        this.container.tabIndex = 0;
        this.container.setAttribute('aria-label', 'フォントの表示分類');
        const fragment = document.createDocumentFragment();
        this._childrenFor(null).forEach(node => fragment.append(this._renderNode(node, 1)));
        this.container.append(fragment);
        this.setSelected(this._selectedKey);
        this.updateFontPreviews();
    }

    updateFontPreviews() {
        this.container?.querySelectorAll('.pl-font-tree__sample').forEach(sample => {
            const node = this._nodes.get(sample.closest('[data-node-key]')?.dataset.nodeKey);
            const entry = node?.system ? { family: node.family || node.id } : this.getLoadedFont(node?.id);
            sample.textContent = entry?.family ? 'Aあ1' : '…';
            sample.dataset.state = entry?.family ? 'loaded' : 'unloaded';
            sample.style.fontFamily = entry?.family ? `'${String(entry.family).replace(/["'\\]/g, '')}'` : '';
            sample.title = entry?.family ? '書体の見本' : '見本を準備中';
        });
    }

    _renderNode(node, level) {
        const wrapper = document.createElement('div');
        const row = document.createElement('div');
        row.className = 'pl-font-tree__item';
        row.dataset.nodeKey = node.key;
        row.dataset.nodeType = node.type;
        row.title = node.label;
        row.setAttribute('role', 'treeitem');
        row.setAttribute('aria-level', String(level));
        row.setAttribute('aria-selected', String(node.key === this._selectedKey));
        row.tabIndex = node.key === this._selectedKey ? 0 : -1;
        row.draggable = node.canMove !== false;
        if (node.type === 'folder') {
            const open = this._openFolders.has(node.id);
            row.setAttribute('aria-expanded', String(open));
            row.classList.add('is-folder');
            const chevron = document.createElement('span');
            chevron.className = 'pl-font-tree__chevron';
            chevron.setAttribute('aria-hidden', 'true');
            chevron.textContent = open ? '▾' : '▸';
            row.append(chevron);
        } else {
            const marker = document.createElement('span');
            marker.className = 'pl-font-tree__marker';
            marker.setAttribute('aria-hidden', 'true');
            marker.textContent = node.favorite ? '★' : '';
            row.append(marker);
            const sample = document.createElement('span');
            sample.className = 'pl-font-tree__sample';
            sample.setAttribute('aria-hidden', 'true');
            row.append(sample);
        }
        const label = document.createElement('span');
        label.className = 'pl-font-tree__label';
        label.textContent = node.type === 'font' ? node.label.replace(/^[［\[][^］\]]+[］\]]\s*/, '') : node.label;
        row.append(label);
        if (node.external) {
            const badge = document.createElement('span');
            badge.className = 'pl-font-tree__badge';
            badge.textContent = '外部';
            row.append(badge);
        }
        if (node.disabled) row.classList.add('is-disabled');
        wrapper.append(row);
        if (node.type === 'folder' && this._openFolders.has(node.id)) {
            const group = document.createElement('div');
            group.className = 'pl-font-tree__group';
            group.setAttribute('role', 'group');
            this._childrenFor(node.id).forEach(child => group.append(this._renderNode(child, level + 1)));
            wrapper.append(group);
        }
        return wrapper;
    }

    _childrenFor(parentId) {
        const ordered = this._actualChildrenFor(parentId);
        if (!this._favoriteFirst) return ordered;
        if (parentId) return ordered.filter(node => !(node.type === 'font' && node.favorite));
        const allFavorites = [];
        const collect = parent => this._actualChildrenFor(parent).forEach(node => {
            if (node.type === 'folder') collect(node.id);
            else if (node.favorite) allFavorites.push(node);
        });
        collect(null);
        const favoriteKeys = new Set(allFavorites.map(node => node.key));
        return allFavorites.concat(ordered.filter(node => !favoriteKeys.has(node.key)));
    }

    _actualChildrenFor(parentId) {
        const expectedParent = parentId || null;
        const nodes = [...this._nodes.values()].filter(node => (node.parentId || null) === expectedParent);
        const byKey = new Map(nodes.map(node => [node.key, node]));
        const keys = Array.isArray(this._orders[parentKey(expectedParent)]) ? this._orders[parentKey(expectedParent)] : [];
        const ordered = [];
        for (const rawKey of keys) {
            const node = byKey.get(asKey(rawKey));
            if (node && !ordered.includes(node)) ordered.push(node);
        }
        nodes.forEach(node => { if (!ordered.includes(node)) ordered.push(node); });
        return ordered;
    }

    _handleClick(event) {
        const row = event.target.closest?.('[role="treeitem"]');
        if (!row || !this.container.contains(row)) return;
        const node = this.getNode(row.dataset.nodeKey);
        if (!node) return;
        this.setSelected(node.key);
        if (node.type === 'folder') {
            this.onFolderSelect(node);
            this.toggleFolder(node.id, null, { focus: true });
        } else if (!node.disabled) {
            this.onSelect(node);
        }
    }

    _handleKeyDown(event) {
        if (!this.container || event.defaultPrevented) return;
        event.stopPropagation(); // Tree navigation belongs to this widget, never Canvas shortcuts.
        const current = event.target.closest?.('[role="treeitem"]')
            || [...this.container.querySelectorAll('[role="treeitem"]')].find(item => item.dataset.nodeKey === this._selectedKey);
        if (event.key === 'Escape') {
            event.preventDefault();
            this.onEscape();
            return;
        }
        if (!current) return;
        const node = this.getNode(current.dataset.nodeKey);
        if (!node) return;
        const visible = [...this.container.querySelectorAll('[role="treeitem"]')];
        const index = visible.indexOf(current);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const next = visible[Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
            if (next) {
                this.setSelected(next.dataset.nodeKey, { focus: true });
                const nextNode = this.getNode(next.dataset.nodeKey);
                if (nextNode?.type === 'font' && !nextNode.disabled) this.onSelect(nextNode, { previewOnly: true });
            }
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const next = event.key === 'Home' ? visible[0] : visible[visible.length - 1];
            if (next) this.setSelected(next.dataset.nodeKey, { focus: true });
        } else if (event.key === 'ArrowRight' && node.type === 'folder') {
            event.preventDefault();
            if (!this._openFolders.has(node.id)) this.toggleFolder(node.id, true, { focus: true });
            else {
                const first = this._childrenFor(node.id)[0];
                if (first) this.setSelected(first.key, { focus: true });
            }
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (node.type === 'folder' && this._openFolders.has(node.id)) {
                this.toggleFolder(node.id, false, { focus: true });
            } else if (node.parentId) {
                this.setSelected(folderKey(node.parentId), { focus: true });
            }
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (node.type === 'folder') {
                this.onFolderSelect(node);
                this.toggleFolder(node.id, null, { focus: true });
            }
            else if (!node.disabled) this.onSelect(node);
        }
    }

    _handleDragStart(event) {
        const row = event.target.closest?.('[role="treeitem"]');
        if (!row || row.draggable === false) return;
        this._dragKey = row.dataset.nodeKey;
        row.setAttribute('aria-grabbed', 'true');
        try { event.dataTransfer?.setData('text/plain', this._dragKey); } catch (error) { /* native D&D only */ }
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    }

    _handleDragOver(event) {
        if (!this._dragKey) return;
        const target = event.target.closest?.('[role="treeitem"]');
        if (target && this._wouldCreateCycle(this._dragKey, target.dataset.nodeKey)) {
            this._clearDropIndicator();
            return;
        }
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        this._clearDropIndicator();
        if (target) {
            target.classList.add('is-drop-target');
            this._dropKey = target.dataset.nodeKey;
        } else {
            this.container.classList.add('is-drop-root');
        }
    }

    _handleDrop(event) {
        if (!this._dragKey) return;
        event.preventDefault();
        const dragKey = this._dragKey;
        const target = event.target.closest?.('[role="treeitem"]');
        let placement = null;
        if (!target) {
            placement = { nodeKey: dragKey, parentId: null, beforeKey: null };
        } else if (!this._wouldCreateCycle(dragKey, target.dataset.nodeKey)) {
            const targetNode = this.getNode(target.dataset.nodeKey);
            if (targetNode?.type === 'folder' && this._dropIntoFolder(event, target)) {
                placement = { nodeKey: dragKey, parentId: targetNode.id, beforeKey: null };
            } else if (targetNode) {
                const siblings = this._actualChildrenFor(targetNode.parentId);
                const index = siblings.findIndex(node => node.key === targetNode.key);
                const rect = target.getBoundingClientRect();
                const after = rect.height > 0 && event.clientY >= rect.top + rect.height / 2;
                const beforeNode = after ? siblings[index + 1] : targetNode;
                placement = { nodeKey: dragKey, parentId: targetNode.parentId || null, beforeKey: beforeNode?.key || null };
            }
        }
        this._clearDragState();
        if (placement) this.onMove(placement);
    }

    _dropIntoFolder(event, target) {
        const rect = target.getBoundingClientRect();
        if (!rect.height) return true;
        const ratio = (event.clientY - rect.top) / rect.height;
        return ratio > 0.24 && ratio < 0.76;
    }

    _wouldCreateCycle(dragKey, targetKey) {
        if (dragKey === targetKey) return true;
        const drag = this.getNode(dragKey);
        const target = this.getNode(targetKey);
        if (!drag || drag.type !== 'folder' || !target) return false;
        let parent = target.type === 'folder' ? target.id : target.parentId;
        const seenParents = new Set();
        while (parent && !seenParents.has(parent)) {
            seenParents.add(parent);
            if (parent === drag.id) return true;
            parent = this.getNode(folderKey(parent))?.parentId || null;
        }
        return false;
    }

    _clearDropIndicator() {
        this.container?.querySelectorAll('.is-drop-target').forEach(item => item.classList.remove('is-drop-target'));
        this.container?.classList.remove('is-drop-root');
        this._dropKey = '';
    }

    _clearDragState() {
        this._dragKey = '';
        this._clearDropIndicator();
        this.container?.querySelectorAll('[aria-grabbed="true"]').forEach(item => item.removeAttribute('aria-grabbed'));
    }
}

export { ROOT_KEY };
