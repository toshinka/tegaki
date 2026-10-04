/**
 * ui/font-library-window.js — 共通書体窓（WP030）
 * 依存: FontComparison（見本/tree）、fontLibrary（唯一のfont/分類保存API）。
 * 接続: 独立窓の再利用部品として保持。製品は自動生成せず、比較情報tabを入口とする。
 * 保存: UI設定/importだけ。作品/Layer/History/rendererへ参照を持たない。
 * 検証: build/wp030-font-library-browser.html。後続の吹き出し形状とは独立。
 */
import { FontComparison } from './font-comparison.js';
import { fontLibrary, FONT_FILE_ACCEPT } from '../system/font-library.js';
import { UI_ICONS } from './ui-icons.js';

export class FontLibraryWindow {
    constructor({ library = fontLibrary, host = document.querySelector('.status-panel .status-group:last-child') } = {}) {
        this.library = library;
        this.rows = [];
        this.selectedId = '';
        this.folderId = '';
        this.organization = {};
        this._revision = 0;
        this._refreshTimer = null;
        this._importing = false;
        this.button = document.createElement('button');
        this.button.className = 'font-library-entry';
        this.button.type = 'button';
        this.button.title = '書体の見本比較・整理・取り込み';
        this.button.setAttribute('aria-label', '共通の書体管理を開く');
        this.button.setAttribute('aria-controls', 'font-library-window');
        this.button.setAttribute('aria-expanded', 'false');
        this.button.innerHTML = `<span aria-hidden="true">${UI_ICONS.swatchBook}</span><span>書体</span>`;
        host?.prepend(this.button);
        this.container = document.createElement('section');
        this.container.id = 'font-library-window';
        this.container.className = 'pl-font-comparison';
        this.container.hidden = true;
        this.container.setAttribute('role', 'dialog');
        this.container.setAttribute('aria-modal', 'false');
        this.comparison = new FontComparison({
            container: this.container, standalone: true, title: '書体ライブラリ', informationLabel: '整理・管理',
            getLoadedFont: id => this.library.getLoadedFont(id),
            warmFonts: (ids, options) => this.library.warmFonts(ids, options),
            onCommit: row => { this.selectedId = row.id; this._renderInformation(); },
            onMove: move => this.library.moveOrganizationNode(move.nodeKey, move.parentId, move.beforeKey),
            onClose: () => { ++this._revision; clearTimeout(this._refreshTimer); this._refreshTimer = null; this.button.setAttribute('aria-expanded', 'false'); this.button.focus(); }
        });
        this.comparison.setTargetLabel('管理用の選択（作品への適用なし）');
        this.comparison.refs.information.querySelector('strong').textContent = '選択書体・分類・取り込み';
        this._buildInformation();
        this.button.addEventListener('click', () => { void this.toggle(); });
        this._unsubscribe = this.library.onChange(() => {
            if (!this.comparison.isOpen()) return;
            clearTimeout(this._refreshTimer);
            this._refreshTimer = setTimeout(() => { this._refreshTimer = null; void this.refresh(); }, 32);
        });
    }

    _buildInformation() {
        const card = document.createElement('div');
        card.className = 'font-library-settings';
        card.innerHTML = `
            <strong data-role="name"></strong><p data-role="comment"></p><p data-role="coverage"></p>
            <div class="font-library-line"><label><input type="checkbox" data-role="favorite"> お気に入り</label><button class="pl-btn pl-btn--small" data-action="primary">Primaryにする</button></div>
            <label class="font-library-line">メモ<input type="text" maxlength="160" data-role="note" placeholder="短い評価・使いどころ"></label>
            <div class="font-library-line"><label>収納先<select data-role="storage"></select></label><button class="pl-btn pl-btn--small" data-action="up" title="同じフォルダ内で上へ" aria-label="書体を上へ">↑</button><button class="pl-btn pl-btn--small" data-action="down" title="同じフォルダ内で下へ" aria-label="書体を下へ">↓</button></div>
            <label><input type="checkbox" data-role="favorite-first"> お気に入りを上へ（表示だけ）</label>
            <div class="font-library-links" data-role="links"></div>
            <fieldset><legend>フォルダ</legend>
                <label class="font-library-line">対象<select data-role="folder"></select></label>
                <label class="font-library-line">名前<input type="text" maxlength="60" data-role="folder-name" placeholder="新しいフォルダ名"></label>
                <div class="font-library-line"><button class="pl-btn pl-btn--small" data-action="add-folder">追加</button><button class="pl-btn pl-btn--small" data-action="rename-folder">名前変更</button><button class="pl-btn pl-btn--small" data-action="delete-folder" title="中の書体・フォルダを親へ戻す。実体は削除しません">解除</button></div>
            </fieldset>
            <div class="font-library-line"><button class="pl-btn pl-btn--small" data-action="import">フォントを取り込む</button><span>選択した収納先へ</span></div>
            <input type="file" data-role="files" multiple hidden>
            <p class="font-library-feedback" data-role="feedback" role="status" aria-live="polite"></p>`;
        this.comparison.attachInformation(card);
        this.refs = Object.fromEntries([...card.querySelectorAll('[data-role]')].map(el => [el.dataset.role, el]));
        this.refs.files.accept = FONT_FILE_ACCEPT;
        this.refs.favorite.addEventListener('change', () => this.library.setFavorite(this.selectedId, this.refs.favorite.checked));
        this.refs['favorite-first'].addEventListener('change', () => this.library.setFavoriteFirst(this.refs['favorite-first'].checked));
        this.refs.note.addEventListener('input', () => this.library.setUserComment(this.selectedId, this.refs.note.value));
        this.refs.storage.addEventListener('change', () => this.library.setFontFolder(this.selectedId, this.refs.storage.value || null));
        this.refs.folder.addEventListener('change', () => {
            this.folderId = this.refs.folder.value;
            this.refs['folder-name'].value = this.organization.folders?.find(f => f.id === this.folderId)?.label || '';
            this._updateFolderButtons();
        });
        card.addEventListener('click', event => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action) void this._action(action);
        });
        this.refs.files.addEventListener('change', () => { void this._importFiles(); });
    }

    async toggle(force) {
        const open = force ?? !this.comparison.isOpen();
        this.comparison.setOpen(open);
        this.button.setAttribute('aria-expanded', String(open));
        if (open) {
            this.comparison.refs.close.focus();
            await this.refresh();
        }
    }

    async refresh() {
        // A caller awaiting refresh must not be superseded by its own queued notification.
        clearTimeout(this._refreshTimer);
        this._refreshTimer = null;
        const revision = ++this._revision;
        try {
            const [bundled, imported] = await Promise.all([this.library.listBundledFonts(), this.library.listFonts()]);
            await this.library.initializeOrganization([...bundled, ...imported].map(font => font.id));
            if (revision !== this._revision || !this.comparison.isOpen()) return;
            const preferences = this.library.getPreferences();
            this.rows = [...bundled, ...imported].map(font => ({ ...font, key: `font:${font.id}`, selectValue: font.id,
                favorite: preferences.favorites.includes(font.id), primary: font.primary === true }));
            this.organization = this.library.getOrganization(this.rows.map(font => font.id));
            if (!this.rows.some(row => row.id === this.selectedId)) this.selectedId = this.rows.find(row => row.primary)?.id || this.rows[0]?.id || '';
            this.comparison.setData({ rows: this.rows, ...this.organization });
            this.comparison.setCommittedKey(`font:${this.selectedId}`);
            this._renderInformation();
        } catch (error) {
            if (revision === this._revision && this.comparison.isOpen()) this.refs.feedback.textContent = `一覧を読み込めませんでした: ${error.message}`;
        }
    }

    _folderOptions(select, firstLabel, selected) {
        select.replaceChildren(new Option(firstLabel, ''));
        for (const folder of this.organization.folders || []) {
            // Full ancestry disambiguates folders sharing a name without another directory model.
            const names = [folder.label || folder.id], seen = new Set([folder.id]);
            let parent = folder.parentId;
            while (parent && !seen.has(parent)) {
                seen.add(parent);
                const ancestor = this.organization.folders.find(f => f.id === parent);
                if (!ancestor) break;
                names.unshift(ancestor.label || ancestor.id); parent = ancestor.parentId;
            }
            select.add(new Option(names.join(' / '), folder.id));
        }
        select.value = selected;
        if (select.selectedIndex < 0) select.value = '';
    }

    _renderInformation() {
        const row = this.rows.find(item => item.id === this.selectedId);
        const p = this.library.getPreferences();
        this.refs.name.textContent = row?.label || '書体がありません';
        this.refs.comment.textContent = row?.comment || 'このブラウザへ取り込んだ書体です。';
        this.refs.coverage.textContent = [row?.coverage && `対応: ${row.coverage}`, row?.dakuten && `濁点: ${row.dakuten}`, row?.tags?.length && `用途: ${row.tags.join(' / ')}`].filter(Boolean).join('　');
        this.refs.favorite.checked = p.favorites.includes(this.selectedId);
        this.refs.favorite.disabled = !row;
        this.refs.note.disabled = !row;
        if (document.activeElement !== this.refs.note) this.refs.note.value = p.comments[this.selectedId] || '';
        this.refs['favorite-first'].checked = this.organization.favoriteFirst === true;
        this._folderOptions(this.refs.storage, '直下（ルート）', this.organization.placements?.[this.selectedId] || '');
        this.refs.storage.disabled = !row;
        this._folderOptions(this.refs.folder, '直下に作成', this.folderId);
        this.folderId = this.refs.folder.value;
        const primary = this.container.querySelector('[data-action="primary"]');
        primary.disabled = !row?.bundled;
        primary.textContent = row?.primary ? 'Primary' : 'Primaryにする';
        primary.setAttribute('aria-pressed', String(row?.primary === true));
        this.refs.links.replaceChildren();
        for (const [label, url] of [['作者・公式', row?.sourceUrl], ['ライセンス', row?.licenseUrl]]) {
            if (!url || !/^https?:\/\//i.test(url)) continue;
            const link = document.createElement('a'); link.href = url; link.textContent = label;
            link.target = '_blank'; link.rel = 'noopener noreferrer'; this.refs.links.append(link);
        }
        this._updateFolderButtons();
        const parent = this.organization.placements?.[this.selectedId];
        const order = this.organization.orders?.[parent ? `folder:${parent}` : 'root'] || [];
        const index = order.indexOf(`font:${this.selectedId}`);
        this.container.querySelector('[data-action="up"]').disabled = index <= 0;
        this.container.querySelector('[data-action="down"]').disabled = index < 0 || index >= order.length - 1;
    }

    _updateFolderButtons() {
        for (const action of ['rename-folder', 'delete-folder']) this.container.querySelector(`[data-action="${action}"]`).disabled = !this.folderId;
    }

    async _action(action) {
        const name = this.refs['folder-name'].value.trim();
        if (action === 'primary') return this.library.setPrimary(this.selectedId);
        if (action === 'import') return this.refs.files.click();
        if (action === 'add-folder' || action === 'rename-folder') {
            if (!name) { this.refs.feedback.textContent = 'フォルダ名を入力してください'; this.refs['folder-name'].focus(); return; }
            if (action === 'add-folder') {
                const folder = this.library.createOrganizationFolder(name, this.folderId || null);
                if (folder?.id) this.folderId = folder.id;
            } else this.library.renameOrganizationFolder(this.folderId, name);
        } else if (action === 'delete-folder') {
            this.library.deleteOrganizationFolder(this.folderId); this.folderId = '';
            this.refs.feedback.textContent = 'フォルダを解除しました。中の書体は親へ戻しました。';
        } else if (action === 'up' || action === 'down') {
            const parent = this.organization.placements?.[this.selectedId] || null;
            const order = this.organization.orders?.[parent ? `folder:${parent}` : 'root'] || [];
            const node = `font:${this.selectedId}`, index = order.indexOf(node);
            if (index < 0) return;
            const before = action === 'up' ? order[index - 1] : order[index + 2] || null;
            if (action === 'up' && !before) return;
            this.library.moveOrganizationNode(node, parent, before);
        }
        await this.refresh();
    }

    async _importFiles() {
        if (this._importing) return;
        const files = [...this.refs.files.files], destination = this.refs.storage.value || null;
        this._importing = true;
        const button = this.container.querySelector('[data-action="import"]'); button.disabled = true;
        let count = 0; const failures = [];
        try {
            for (const file of files) {
                const result = await this.library.addFontFile(file);
                if (!result.ok) { failures.push(`${file.name}: ${result.reason}`); continue; }
                await this.library.initializeOrganization([result.font.id]);
                this.library.setFontFolder(result.font.id, destination);
                this.selectedId = result.font.id; ++count;
            }
            this.refs.feedback.textContent = [`${count}書体を取り込みました`, ...failures].join(' / ');
        } catch (error) { this.refs.feedback.textContent = `取り込みに失敗: ${error.message}`; }
        finally { this.refs.files.value = ''; this._importing = false; button.disabled = false; await this.refresh(); }
    }

    destroy() {
        clearTimeout(this._refreshTimer);
        this._unsubscribe?.(); ++this._revision;
        this.comparison.destroy(); this.container.remove(); this.button.remove();
    }
}
