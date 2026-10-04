/**
 * ============================================================================
 * ファイル名: ui/font-comparison.js
 * 責務: 吹き出しの右側に開くフォント比較page。分類、DOM見本、hover/focusの
 *       一時表示、click/Enterによる選択固定、読み込み済みfontのwarmを扱う。
 *       params/Project/Historyは変更せず、選択確定だけを呼び出し元へ返す。
 *       WP030の共通書体窓はstandalone hostを使う。font保存・作品適用は所有しない。
 * 公開API: FontComparison
 * ============================================================================
 */

import { FontTree } from './font-tree.js';
import { mountPopupAtOverlayRoot } from './popup-drag-helper.js';

const WARM_COALESCE_MS = 32;
const WARM_VISIBLE_LIMIT = 6;
const PANEL_MARGIN = 8;

function asKey(value) {
    return String(value ?? '').trim();
}

function parentFolder(value) {
    const id = asKey(value);
    return id || null;
}

function nodeKey(value) {
    return asKey(value);
}

/**
 * 右側の比較page。見本は通常のDOM文字で、Canvas/組版の経路には入らない。
 */
export class FontComparison {
    constructor({ container, getLoadedFont, warmFonts, onCommit, onClose, onMove, standalone = false, title = 'フォント比較', informationLabel = '情報・整理' } = {}) {
        this.container = container || null;
        this.standalone = standalone === true;
        this.title = title;
        this.informationLabel = informationLabel;
        this.anchor = container?.closest?.('#balloon-popup') || null;
        this.getLoadedFont = typeof getLoadedFont === 'function' ? getLoadedFont : null;
        this.warmFonts = typeof warmFonts === 'function' ? warmFonts : null;
        this.onCommit = typeof onCommit === 'function' ? onCommit : () => {};
        this.onClose = typeof onClose === 'function' ? onClose : () => {};
        this.onMove = typeof onMove === 'function' ? onMove : () => {};
        this._folders = [];
        this._folderById = new Map();
        this._rows = [];
        this._rowByKey = new Map();
        this._placements = {};
        this._orders = {};
        this._favoriteFirst = false;
        this._folderFilter = null;
        this._committedKey = '';
        this._hoverKey = '';
        this._loaded = new Map();
        this._warmIds = new Set();
        this._warmTimer = null;
        this._warmToken = 0;
        this._open = false;
        this._mode = 'samples';
        this._informationElement = null;
        this._observer = null;
        this._boundResize = () => this.reposition();
        this.refs = {};
        this.tree = null;
        this._build();
        // backdrop-filter on the translucent popup establishes a containing
        // block for fixed children. Mount beside it to keep viewport coordinates.
        if (this.container) mountPopupAtOverlayRoot(this.container);
    }

    _build() {
        if (!this.container) return;
        this.container.setAttribute('aria-label', 'フォント比較');
        this.container.innerHTML = `
            <div class="pl-font-comparison__header">
                <div>
                    <strong class="pl-font-comparison__title">フォント比較</strong>
                    <span class="pl-font-comparison__count" data-role="font-comparison-count"></span>
                    <span class="pl-font-comparison__target" data-role="font-comparison-target"></span>
                </div>
                <button type="button" class="pl-btn pl-btn--small pl-font-comparison__close" data-role="font-comparison-close" aria-label="フォント比較を閉じる">閉じる</button>
            </div>
            <div class="pl-font-comparison__tabs" role="tablist" aria-label="フォント比較の表示">
                <button type="button" class="pl-font-comparison__tab is-selected" data-mode="samples" role="tab" aria-selected="true">見本比較</button>
                <button type="button" class="pl-font-comparison__tab" data-mode="information" role="tab" aria-selected="false">情報・整理</button>
            </div>
            <div class="pl-font-comparison__hero" data-role="font-comparison-hero" aria-live="polite"></div>
            <div class="pl-font-comparison__body">
                <div class="pl-font-comparison__classification">
                    <button type="button" class="pl-font-comparison__root" data-role="font-comparison-root" aria-pressed="true">すべての書体</button>
                    <div class="pl-font-tree pl-font-comparison__tree ui-scrollbar" data-role="font-comparison-tree"></div>
                </div>
                <div class="pl-font-comparison__panels">
                    <div class="pl-font-comparison__cards ui-scrollbar" data-role="font-comparison-cards" role="list" data-mode-panel="samples"></div>
                    <section class="pl-font-comparison__information ui-scrollbar" data-role="font-comparison-information" data-mode-panel="information" role="tabpanel" aria-label="フォント情報・整理" hidden>
                        <div class="pl-font-comparison__information-heading">
                            <strong>フォント情報・整理</strong>
                        </div>
                        <div class="pl-font-comparison__information-host" data-role="font-comparison-information-host"></div>
                    </section>
                </div>
            </div>`;
        const q = (selector) => this.container.querySelector(selector);
        const prefix = this.container.id || 'font-comparison';
        for (const mode of ['samples', 'information']) {
            const tab = q(`[role="tab"][data-mode="${mode}"]`);
            const panel = q(`[data-mode-panel="${mode}"]`);
            tab.id = `${prefix}-${mode}-tab`;
            panel.id = `${prefix}-${mode}-panel`;
            tab.setAttribute('aria-controls', panel.id);
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', tab.id);
        }
        this.refs = {
            root: q('[data-role="font-comparison-root"]'),
            close: q('[data-role="font-comparison-close"]'),
            tree: q('[data-role="font-comparison-tree"]'),
            cards: q('[data-role="font-comparison-cards"]'),
            hero: q('[data-role="font-comparison-hero"]'),
            count: q('[data-role="font-comparison-count"]'),
            tabs: [...this.container.querySelectorAll('[data-mode]')],
            information: q('[data-role="font-comparison-information"]'),
            informationHost: q('[data-role="font-comparison-information-host"]'),
            target: q('[data-role="font-comparison-target"]')
        };
        this.container.setAttribute('aria-label', this.title);
        q('.pl-font-comparison__title').textContent = this.title;
        q('[data-mode="information"]').textContent = this.informationLabel;
        this.refs.close.setAttribute('aria-label', `${this.title}を閉じる`);
        this.container.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                this.setOpen(false);
            }
            event.stopPropagation();
        });
        this.container.addEventListener('keyup', event => event.stopPropagation());
        this.refs.root?.addEventListener('click', () => this._setFolderFilter(null));
        this.refs.close?.addEventListener('click', () => this.setOpen(false));
        this.refs.tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => this.setMode(tab.dataset.mode));
            tab.addEventListener('keydown', event => {
                let next;
                if (event.key === 'ArrowRight') next = (index + 1) % this.refs.tabs.length;
                else if (event.key === 'ArrowLeft') next = (index + this.refs.tabs.length - 1) % this.refs.tabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = this.refs.tabs.length - 1;
                else return;
                event.preventDefault();
                this.setMode(this.refs.tabs[next].dataset.mode);
                this.refs.tabs[next].focus();
            });
        });
        this.tree = new FontTree({
            container: this.refs.tree,
            onSelect: (node, options) => options?.previewOnly ? this._preview(node?.key) : this._commit(node),
            onFolderSelect: (node) => this._setFolderFilter(node?.id || null),
            onEscape: () => this.setOpen(false),
            onMove: (placement) => {
                if (this._mode === 'information') this.onMove(placement);
            }
        });
        this.refs.tree?.addEventListener('focusout', event => {
            if (!this.refs.tree.contains(event.relatedTarget)) this._clearPreview(this._hoverKey);
        });
        this.container.hidden = true;
        this._renderMode();
    }

    setData({ folders = [], rows = [], placements = {}, orders = {}, favoriteFirst = false } = {}) {
        this._folders = Array.isArray(folders)
            ? folders.filter(folder => folder?.id).map(folder => ({
                ...folder,
                id: asKey(folder.id),
                parentId: parentFolder(folder.parentId),
                label: String(folder.label ?? folder.name ?? folder.id)
            }))
            : [];
        this._folderById = new Map(this._folders.map(folder => [folder.id, folder]));
        this._rows = Array.isArray(rows)
            ? rows.filter(row => row?.key || row?.id).map((row, index) => ({
                ...row,
                id: asKey(row.id),
                key: nodeKey(row.key || ('font:' + row.id)),
                label: String(row.label ?? row.family ?? row.id),
                orderIndex: Number.isFinite(row.orderIndex) ? row.orderIndex : index,
                parentId: parentFolder(row.parentId || row.folderId),
                favorite: row.favorite === true,
                system: row.system === true,
                selectValue: String(row.selectValue || '')
            }))
            : [];
        this._rowByKey = new Map(this._rows.map(row => [row.key, row]));
        const ids = new Set(this._rows.map(row => row.id));
        for (const id of this._loaded.keys()) if (!ids.has(id)) this._loaded.delete(id);
        if (!this._rowByKey.has(this._hoverKey)) this._hoverKey = '';
        this._placements = placements && typeof placements === 'object' ? { ...placements } : {};
        this._orders = orders && typeof orders === 'object' ? { ...orders } : {};
        this._favoriteFirst = favoriteFirst === true;
        if (this._folderFilter && !this._folderById.has(this._folderFilter)) this._folderFilter = null;
        this._applyTreeModel();
        this.tree?.setSelected(this._committedKey);
        this._renderRootState();
        this._renderCards();
        this._renderHero();
        if (this._open && this._mode === 'samples') this._warmVisible();
    }

    /**
     * 情報・整理ではcallerが許可したnodeだけを動かせる。
     * 見本比較ではtreeを常に静的表示にして、hover/選択の副作用を抑える。
     */
    _applyTreeModel() {
        this.tree?.setModel({
            folders: this._folders.map(folder => ({
                ...folder,
                canMove: this._mode === 'information' && folder.canMove !== false
            })),
            fonts: this._rows.map(row => ({
                ...row,
                canMove: this._mode === 'information' && row.canMove !== false
            })),
            placements: this._placements,
            orders: this._orders,
            favoriteFirst: this._favoriteFirst
        });
    }

    /** 比較pageの見本/情報整理を切り替える。 */
    setMode(mode) {
        const next = mode === 'information' ? 'information' : 'samples';
        if (next === this._mode) {
            this._renderMode();
            return;
        }
        this._mode = next;
        this._hoverKey = '';
        this._applyTreeModel();
        this._renderMode();
        if (this._open && this._mode === 'samples') this._warmVisible();
    }

    getMode() {
        return this._mode;
    }

    /**
     * 呼び出し元が保持しているfontCardを右側情報欄へ移す。
     * element自身を移動するため、呼び出し元が登録したrefs/listenerは保持される。
     */
    attachInformation(element) {
        if (this._informationElement && this._informationElement !== element) {
            this._informationElement.removeAttribute('data-font-comparison-mounted');
        }
        this._informationElement = element || null;
        if (!element || !this.refs.informationHost) return;
        element.setAttribute('data-font-comparison-mounted', 'true');
        if (element.matches?.('details')) {
            element.open = true;
            element.dataset.fontComparisonMounted = 'true';
        }
        this.refs.informationHost.replaceChildren(element);
    }

    setTargetLabel(label) {
        if (!this.refs.target) return;
        const text = String(label || '').trim();
        this.refs.target.textContent = text ? `対象: ${text}` : '';
        this.refs.target.hidden = !text;
    }

    _renderMode() {
        const samples = this._mode === 'samples';
        this.refs.tabs?.forEach(tab => {
            const selected = tab.dataset.mode === this._mode;
            tab.classList.toggle('is-selected', selected);
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        });
        if (this.refs.hero) this.refs.hero.hidden = !samples;
        if (this.refs.cards) this.refs.cards.hidden = !samples;
        if (this.refs.information) this.refs.information.hidden = samples;
        if (!samples) this._renderHero();
    }

    setCommittedKey(key) {
        this._committedKey = nodeKey(key);
        this.tree?.setSelected(this._committedKey);
        this._renderCardsState();
        if (!this._hoverKey) this._renderHero();
    }

    setOpen(open) {
        const next = open === true;
        if (next === this._open) {
            if (next) this.reposition();
            return;
        }
        this._open = next;
        this._warmToken += 1;
        clearTimeout(this._warmTimer);
        this._warmTimer = null;
        this._observer?.disconnect?.();
        this._observer = null;
        this._hoverKey = '';
        if (this.container) {
            this.container.hidden = !next;
            this.container.dataset.open = String(next);
        }
        if (next) {
            this.reposition();
            if (typeof window !== 'undefined') window.addEventListener?.('resize', this._boundResize);
            this._renderCards();
            this._renderHero();
            if (this._mode === 'samples') this._warmVisible();
        } else {
            if (typeof window !== 'undefined') window.removeEventListener?.('resize', this._boundResize);
            if (this.container) {
                this.container.style.removeProperty('left');
                this.container.style.removeProperty('top');
                this.container.style.removeProperty('visibility');
                this.container.removeAttribute('data-placement');
            }
            this.onClose();
        }
    }

    isOpen() {
        return this._open;
    }

    reposition() {
        if (!this._open || !this.container || typeof window === 'undefined') return;
        if (this.standalone) {
            this.container.style.removeProperty('width');
            const rect = this.container.getBoundingClientRect();
            this.container.classList.toggle('is-compact', rect.width < 520);
            this.container.style.left = `${Math.max(PANEL_MARGIN, (window.innerWidth - rect.width) / 2)}px`;
            this.container.style.top = `${Math.max(PANEL_MARGIN, (window.innerHeight - rect.height) / 2)}px`;
            this.container.style.visibility = 'visible';
            this.container.dataset.placement = 'standalone';
            return;
        }
        const popup = this.anchor;
        if (!popup) return;
        this.container.style.visibility = 'hidden';
        const popupRect = popup.getBoundingClientRect();
        this.container.style.removeProperty('width');
        const beside = Math.max(window.innerWidth - popupRect.right - PANEL_MARGIN * 2, popupRect.left - PANEL_MARGIN * 2);
        if (beside >= 360 && beside < 640) this.container.style.width = `${Math.floor(beside)}px`;
        const panelRect = this.container.getBoundingClientRect();
        this.container.classList.toggle('is-compact', panelRect.width < 520);
        const width = panelRect.width || Math.min(640, Math.max(260, window.innerWidth - PANEL_MARGIN * 2));
        const height = panelRect.height || Math.min(720, Math.max(240, window.innerHeight - PANEL_MARGIN * 2));
        const rightX = popupRect.right + PANEL_MARGIN;
        const leftX = popupRect.left - width - PANEL_MARGIN;
        let left = rightX;
        let top = Math.max(PANEL_MARGIN, Math.min(popupRect.top, window.innerHeight - height - PANEL_MARGIN));
        let placement = 'right';
        if (rightX + width > window.innerWidth - PANEL_MARGIN && leftX >= PANEL_MARGIN) {
            left = leftX;
            placement = 'left';
        } else if (rightX + width > window.innerWidth - PANEL_MARGIN && leftX < PANEL_MARGIN) {
            left = Math.max(PANEL_MARGIN, Math.min(popupRect.left, window.innerWidth - width - PANEL_MARGIN));
            top = Math.max(PANEL_MARGIN, Math.min(popupRect.bottom + PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN));
            placement = 'below';
        }
        this.container.style.left = `${Math.round(left)}px`;
        this.container.style.top = `${Math.round(top)}px`;
        this.container.dataset.placement = placement;
        this.container.style.visibility = '';
    }

    destroy() {
        this.setOpen(false);
        clearTimeout(this._warmTimer);
        this._observer?.disconnect?.();
        this.tree = null;
    }

    _setFolderFilter(folderId) {
        this._folderFilter = folderId && this._folderById.has(folderId) ? folderId : null;
        if (!this._folderFilter) this.tree?.setSelected('');
        this._renderRootState();
        this._renderCards();
        this._renderHero();
        if (this._open) this._warmVisible();
    }

    _renderRootState() {
        if (!this.refs.root) return;
        this.refs.root.setAttribute('aria-pressed', String(!this._folderFilter));
        this.refs.root.classList.toggle('is-selected', !this._folderFilter);
    }

    _filteredRows() {
        const byKey = new Map(this._rows.map(row => [row.key, row]));
        const ordered = this.tree?.getOrderedFontNodes?.()
            ?.map(node => byKey.get(node.key))
            .filter(Boolean) || [...this._rows];
        if (!this._folderFilter) return ordered;
        return ordered.filter(row => this._isInFolder(row, this._folderFilter));
    }

    _isInFolder(row, folderId) {
        let current = parentFolder(this._placements[row.id] ?? row.parentId);
        const seen = new Set();
        while (current && !seen.has(current)) {
            if (current === folderId) return true;
            seen.add(current);
            current = parentFolder(this._folderById.get(current)?.parentId);
        }
        return false;
    }

    _renderCards() {
        const cards = this.refs.cards;
        if (!cards) return;
        this._observer?.disconnect?.();
        this._observer = null;
        const rows = this._filteredRows();
        cards.replaceChildren();
        if (this.refs.count) this.refs.count.textContent = `${rows.length}書体`;
        const fragment = document.createDocumentFragment();
        rows.forEach(row => fragment.append(this._createCard(row)));
        cards.append(fragment);
        this._renderCardsState();
        if (this._open) this._observeVisibleCards();
    }

    _createCard(row) {
        const card = document.createElement('article');
        card.className = 'pl-font-comparison__card';
        card.dataset.nodeKey = row.key;
        card.dataset.fontId = row.id;
        card.tabIndex = 0;
        card.setAttribute('role', 'listitem');
        card.setAttribute('aria-label', row.label);
        const heading = document.createElement('div');
        heading.className = 'pl-font-comparison__card-heading';
        const label = document.createElement('strong');
        label.className = 'pl-font-comparison__card-name';
        label.textContent = row.label.replace(/^[［\[][^］\]]+[］\]]\s*/, '');
        label.title = row.label;
        heading.append(label);
        if (row.favorite) {
            const star = document.createElement('span');
            star.className = 'pl-font-comparison__favorite';
            star.textContent = '★';
            star.setAttribute('aria-label', 'お気に入り');
            heading.append(star);
        }
        const category = document.createElement('span');
        category.className = 'pl-font-comparison__card-category';
        category.textContent = row.category || (row.system ? '端末' : '');
        heading.append(category);
        card.append(heading);
        const samples = document.createElement('div');
        samples.className = 'pl-font-comparison__card-samples';
        const headline = document.createElement('div');
        headline.className = 'pl-font-comparison__sample pl-font-comparison__sample--headline';
        headline.dataset.sample = 'headline';
        headline.textContent = 'Aあ1';
        const body = document.createElement('div');
        body.className = 'pl-font-comparison__sample pl-font-comparison__sample--body';
        body.dataset.sample = 'body';
        body.textContent = row.sampleText || 'あいうえお カキクケコ ABC123';
        samples.append(headline, body);
        card.append(samples);
        const status = document.createElement('span');
        status.className = 'pl-font-comparison__status';
        status.dataset.role = 'font-comparison-status';
        card.append(status);
        const comment = document.createElement('p');
        comment.className = 'pl-font-comparison__comment';
        comment.textContent = row.comment || row.userComment || row.coverage || '';
        card.append(comment);
        card.addEventListener('mouseenter', () => this._preview(row.key));
        card.addEventListener('mouseleave', () => this._clearPreview(row.key));
        card.addEventListener('focusin', () => this._preview(row.key));
        card.addEventListener('focusout', event => {
            if (!card.contains(event.relatedTarget)) this._clearPreview(row.key);
        });
        card.addEventListener('click', () => this._commit(row));
        card.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            this._commit(row);
        });
        return card;
    }

    _renderCardsState() {
        this.refs.cards?.querySelectorAll?.('[data-node-key]').forEach(card => {
            const key = card.dataset.nodeKey;
            const selected = key === this._committedKey;
            const preview = key === this._hoverKey;
            card.classList.toggle('is-selected', selected);
            card.classList.toggle('is-preview', preview);
            card.setAttribute('aria-current', selected ? 'true' : 'false');
            this._applyEntryToCard(card, this._rowByKey.get(key));
        });
    }

    _applyEntryToCard(card, row) {
        if (!card || !row) return;
        const entry = this._entryFor(row);
        const samples = card.querySelectorAll('.pl-font-comparison__sample');
        const status = card.querySelector('[data-role="font-comparison-status"]');
        if (entry?.family) {
            const family = String(entry.family).replace(/["'\\]/g, '');
            samples.forEach(sample => {
                sample.style.fontFamily = `'${family}'`;
                sample.dataset.state = 'loaded';
            });
            card.dataset.state = 'loaded';
            if (status) status.textContent = '読み込み済み';
        } else {
            samples.forEach(sample => {
                sample.style.removeProperty('font-family');
                sample.dataset.state = 'unloaded';
            });
            card.dataset.state = 'unloaded';
            if (status) status.textContent = '未読み込み';
        }
    }

    _entryFor(row) {
        if (!row) return null;
        if (row.system) return { family: row.family || row.id, system: true };
        if (this._loaded.has(row.id)) return this._loaded.get(row.id);
        if (this.getLoadedFont) {
            try {
                const entry = this.getLoadedFont(row.id);
                if (entry) {
                    this._loaded.set(row.id, entry);
                    return entry;
                }
            } catch (error) {
                // cache access is read-only; a missing optional API keeps the card unloaded.
            }
        }
        return null;
    }

    _commit(row) {
        if (!row?.selectValue) return;
        this._committedKey = row.key;
        this._hoverKey = '';
        this.tree?.setSelected(row.key);
        this._renderCardsState();
        this._renderHero();
        this._warmAround(row.key);
        this.onCommit(row);
    }

    _preview(key) {
        if (this._mode !== 'samples') return;
        const row = this._rowByKey.get(key);
        if (!row) return;
        this._hoverKey = key;
        this._renderCardsState();
        this._renderHero();
        if (!this._entryFor(row) && !row.system) this._queueWarm([row.id]);
    }

    _clearPreview(key) {
        if (this._hoverKey !== key) return;
        this._hoverKey = '';
        this._renderCardsState();
        this._renderHero();
    }

    _renderHero() {
        const hero = this.refs.hero;
        if (!hero) return;
        const key = this._hoverKey || this._committedKey;
        const row = this._rowByKey.get(key);
        hero.replaceChildren();
        if (!row) {
            hero.textContent = 'カードにカーソルを合わせると見本を表示します';
            return;
        }
        const name = document.createElement('strong');
        name.className = 'pl-font-comparison__hero-name';
        name.textContent = row.label;
        const state = document.createElement('span');
        state.className = 'pl-font-comparison__hero-state';
        state.textContent = this._hoverKey ? '一時表示' : '選択中';
        const sample = document.createElement('div');
        sample.className = 'pl-font-comparison__hero-sample';
        sample.textContent = 'Aあ1　あいうえお カキクケコ ABC123';
        const entry = this._entryFor(row);
        if (entry?.family) {
            const family = String(entry.family).replace(/["'\\]/g, '');
            sample.style.fontFamily = `'${family}'`;
            sample.dataset.state = 'loaded';
        } else {
            sample.dataset.state = 'unloaded';
            const hint = document.createElement('span');
            hint.className = 'pl-font-comparison__hero-hint';
            hint.textContent = '未読み込み';
            hero.append(name, state, hint, sample);
            if (!row.system) this._queueWarm([row.id]);
            return;
        }
        hero.append(name, state, sample);
    }

    _observeVisibleCards() {
        const cards = this.refs.cards;
        if (!cards) return;
        if (typeof IntersectionObserver !== 'function') {
            this._queueWarm(this._filteredRows().slice(0, WARM_VISIBLE_LIMIT).map(row => row.id));
            return;
        }
        this._observer = new IntersectionObserver(entries => {
            if (!this._open) return;
            const ids = entries
                .filter(entry => entry.isIntersecting)
                .map(entry => entry.target.dataset.fontId)
                .filter(Boolean);
            this._queueWarm(ids);
        }, { root: cards, threshold: 0.01 });
        cards.querySelectorAll('[data-font-id]').forEach(card => this._observer.observe(card));
    }

    _warmVisible() {
        if (!this._open) return;
        this._observeVisibleCards();
        this._warmAround(this._committedKey);
    }

    _warmAround(key) {
        const rows = this._filteredRows();
        const index = rows.findIndex(row => row.key === key);
        if (index < 0) return;
        this._queueWarm(rows.slice(Math.max(0, index - 2), index + 3).map(row => row.id));
    }

    _queueWarm(ids) {
        if (!this.warmFonts || !this._open) return;
        const known = new Set(this._rows.map(row => row.id));
        ids.filter(Boolean).forEach(id => {
            if (!known.has(id)) return;
            const row = this._rows.find(item => item.id === id);
            if (!row || row.system || this._entryFor(row)) return;
            this._warmIds.add(id);
        });
        if (!this._warmIds.size || this._warmTimer) return;
        const token = this._warmToken;
        this._warmTimer = setTimeout(() => {
            this._warmTimer = null;
            const queued = [...this._warmIds];
            this._warmIds.clear();
            if (!queued.length || !this._open || token !== this._warmToken) return;
            let request;
            try {
                request = this.warmFonts(queued, {
                    concurrency: 2,
                    shouldContinue: () => this._open && token === this._warmToken
                });
            } catch (error) {
                request = null;
            }
            Promise.resolve(request).then(result => {
                if (!this._open || token !== this._warmToken) return;
                if (Array.isArray(result)) {
                    result.forEach(item => {
                        if (item?.id && item.loaded && this.getLoadedFont) {
                            try {
                                const entry = this.getLoadedFont(item.id);
                                if (entry) this._loaded.set(item.id, entry);
                            } catch (error) { /* keep unloaded state */ }
                        }
                    });
                }
                this._renderCardsState();
                this._renderHero();
            }).catch(() => {});
        }, WARM_COALESCE_MS);
    }
}
