/**
 * ============================================================================
 * ファイル名: ui/shortcut-help.js
 * 責務: 画面左上にひっそり置く「?」ショートカットヘルプ。TEGAKI_KEYMAPの全ショートカットを読み取り専用で一覧する
 * 依存: config.js(TEGAKI_KEYMAP), system/event-bus.js
 * 被依存: core-engine.js
 * 公開API: ShortcutHelp
 * 保存: 表示のON/OFFは設定 'shortcutHelpVisible'(既定ON)。ショートカットの実行権限は持たない(表示のみ)。
 * 実装状態: ✅実装
 * ============================================================================
 */

import { TEGAKI_KEYMAP } from '../config.js';
import { TegakiEventBus } from '../system/event-bus.js';

const ROOT_ID = 'global-shortcut-help';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export class ShortcutHelp {
    constructor({ settingsManager = null, eventBus = TegakiEventBus } = {}) {
        this.settingsManager = settingsManager;
        this.eventBus = eventBus;
        this.root = null;
        this.toggle = null;
        this.deck = null;
        this._build();
        this._settingsListener = () => this._syncVisibility();
        this.eventBus?.on?.('settings:shortcut-help-visible', this._settingsListener);
        this.eventBus?.on?.('settings:updated', this._settingsListener);
        this._syncVisibility();
    }

    _build() {
        document.getElementById(ROOT_ID)?.remove();
        const root = document.createElement('div');
        root.id = ROOT_ID;
        root.className = 'global-shortcut-help';
        root.innerHTML = `
            <button type="button" class="global-shortcut-help-toggle" aria-label="ショートカットヘルプ" title="ショートカットヘルプ"
                aria-expanded="false" aria-controls="global-shortcut-help-deck" aria-haspopup="dialog">?</button>
            <div class="global-shortcut-help-deck ui-scrollbar" id="global-shortcut-help-deck" role="dialog" aria-label="ショートカット一覧" hidden>
                <div class="global-shortcut-help-head"><span>SHORTCUTS</span><span class="global-shortcut-help-count"></span></div>
                <div class="global-shortcut-help-list" role="list"></div>
            </div>`;
        document.body.appendChild(root);
        this.root = root;
        this.toggle = root.querySelector('.global-shortcut-help-toggle');
        this.deck = root.querySelector('.global-shortcut-help-deck');

        this.toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.setOpen(this.toggle.getAttribute('aria-expanded') !== 'true');
            this.toggle.blur();
        });
        this._outside = (e) => {
            if (!this.deck.hidden && !this.root.contains(e.target)) this.setOpen(false);
        };
        this._escape = (e) => {
            if (e.key === 'Escape' && !this.deck.hidden) {
                e.stopPropagation();
                this.setOpen(false);
            }
        };
        document.addEventListener('pointerdown', this._outside, true);
        document.addEventListener('keydown', this._escape, true);
    }

    _renderList() {
        const list = TEGAKI_KEYMAP.getShortcutList?.() || [];
        this.deck.querySelector('.global-shortcut-help-count').textContent = String(list.length);
        this.deck.querySelector('.global-shortcut-help-list').innerHTML = list.map(item => `
            <div class="global-shortcut-help-row" role="listitem">
                <span class="global-shortcut-help-label">${escapeHtml(item.description)}</span>
                <span class="global-shortcut-help-key">${escapeHtml(item.keys.join(' / '))}</span>
            </div>`).join('');
    }

    setOpen(open) {
        if (open) this._renderList();
        this.deck.hidden = !open;
        this.toggle.classList.toggle('is-open', open);
        this.toggle.setAttribute('aria-expanded', String(open));
    }

    _syncVisibility() {
        const visible = this.settingsManager?.get?.('shortcutHelpVisible') !== false;
        this.root.hidden = !visible;
        if (!visible) this.setOpen(false);
    }

    destroy() {
        this.eventBus?.off?.('settings:shortcut-help-visible', this._settingsListener);
        this.eventBus?.off?.('settings:updated', this._settingsListener);
        document.removeEventListener('pointerdown', this._outside, true);
        document.removeEventListener('keydown', this._escape, true);
        this.root?.remove();
    }
}
