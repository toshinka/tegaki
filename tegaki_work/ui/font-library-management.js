/**
 * WP030: embedded classification/import controls for FontComparison information.
 * Uses fontLibrary as the only storage authority. No selection, artwork or History writes.
 * Host owns comparison data, selected font metadata and lifetime; destroy before host teardown.
 */
import { FONT_FILE_ACCEPT } from '../system/font-library.js';

export class FontLibraryManagement {
    constructor({ library, host }) {
        this.library = library;
        this.folderId = '';
        this._revision = 0;
        this._destroyed = false;
        this.element = document.createElement('details');
        this.element.open = true;
        this.element.className = 'pl-details font-library-settings';
        this.element.dataset.role = 'font-library-management';
        this.element.innerHTML = `<summary>表示分類・取り込み</summary>
            <div class="font-library-management-body">
                <p>分類は表示用です。元ファイルは移動しません。</p>
                <label class="font-library-line">対象・取り込み先<select data-role="folder" aria-label="表示分類・取り込み先"></select></label>
                <label class="font-library-line">名前<input data-role="name" type="text" maxlength="60" placeholder="分類名" aria-label="表示分類名"></label>
                <div class="font-library-line"><button type="button" class="pl-btn pl-btn--small" data-action="add">新規分類</button><button type="button" class="pl-btn pl-btn--small" data-action="rename">名前変更</button><button type="button" class="pl-btn pl-btn--small" data-action="remove" title="書体を親へ戻します。実体は削除しません">解除</button></div>
                <button type="button" class="pl-btn pl-btn--small" data-action="import">フォントを取り込む</button>
                <input type="file" data-role="files" multiple hidden>
                <p data-role="feedback" role="status" aria-live="polite"></p>
            </div>`;
        host.append(this.element);
        this.refs = Object.fromEntries([...this.element.querySelectorAll('[data-role]')].map(el => [el.dataset.role, el]));
        this.refs.files.accept = FONT_FILE_ACCEPT;
        this.refs.folder.addEventListener('change', () => {
            this.folderId = this.refs.folder.value;
            this.refs.name.value = this.organization?.folders.find(f => f.id === this.folderId)?.label || '';
            this._buttons();
        });
        this.element.addEventListener('click', event => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action) void this._action(action);
        });
        this.refs.files.addEventListener('change', () => { void this._importFiles(); });
        this._unsubscribe = library.onChange(() => { void this.refresh(); });
        void this.refresh();
    }

    async refresh() {
        const revision = ++this._revision;
        let bundled, imported;
        try { [bundled, imported] = await Promise.all([this.library.listBundledFonts(), this.library.listFonts()]); }
        catch (error) {
            if (!this._destroyed && revision === this._revision) this.refs.feedback.textContent = `分類を読み込めませんでした: ${error.message}`;
            return;
        }
        if (this._destroyed || revision !== this._revision) return;
        this.organization = this.library.getOrganization([...bundled, ...imported].map(f => f.id));
        this.refs.folder.replaceChildren(new Option('直下（ルート）', ''));
        for (const folder of this.organization.folders) {
            const names = [folder.label], seen = new Set([folder.id]);
            let parent = folder.parentId;
            while (parent && !seen.has(parent)) {
                seen.add(parent);
                const ancestor = this.organization.folders.find(f => f.id === parent);
                if (!ancestor) break;
                names.unshift(ancestor.label); parent = ancestor.parentId;
            }
            this.refs.folder.add(new Option(names.join(' / '), folder.id));
        }
        this.refs.folder.value = this.folderId;
        if (this.refs.folder.selectedIndex < 0) this.refs.folder.value = '';
        this.folderId = this.refs.folder.value;
        this._buttons();
    }

    _buttons() {
        for (const action of ['rename', 'remove']) this.element.querySelector(`[data-action="${action}"]`).disabled = !this.folderId;
    }

    async _action(action) {
        if (action === 'import') return this.refs.files.click();
        const name = this.refs.name.value.trim();
        if (action === 'add' || action === 'rename') {
            if (!name) { this.refs.feedback.textContent = '分類名を入力してください'; this.refs.name.focus(); return; }
            if (action === 'add') this.folderId = this.library.createOrganizationFolder(name, this.folderId || null)?.id || '';
            else this.library.renameOrganizationFolder(this.folderId, name);
        } else if (action === 'remove') {
            this.library.deleteOrganizationFolder(this.folderId); this.folderId = '';
            this.refs.feedback.textContent = '分類を解除し、中の書体を親へ戻しました。';
        }
        await this.refresh();
    }

    async _importFiles() {
        if (this._importing) return;
        const files = [...this.refs.files.files], destination = this.folderId || null;
        const button = this.element.querySelector('[data-action="import"]');
        this._importing = true; button.disabled = true;
        let count = 0; const failures = [];
        try {
            for (const file of files) {
                const result = await this.library.addFontFile(file);
                if (!result.ok) { failures.push(`${file.name}: ${result.reason}`); continue; }
                await this.library.initializeOrganization([result.font.id]);
                this.library.setFontFolder(result.font.id, destination); ++count;
            }
            this.refs.feedback.textContent = [`${count}書体を取り込みました`, ...failures].join(' / ');
        } catch (error) { this.refs.feedback.textContent = `取り込みに失敗: ${error.message}`; }
        finally { this.refs.files.value = ''; this._importing = false; button.disabled = false; await this.refresh(); }
    }

    destroy() { this._destroyed = true; ++this._revision; this._unsubscribe?.(); this.element.remove(); }
}
