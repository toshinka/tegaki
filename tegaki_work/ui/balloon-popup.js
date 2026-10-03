/**
 * ============================================================================
 * ファイル名: ui/balloon-popup.js
 * 責務: 吹き出し(漫画ツールのタブ)。形・しっぽ・縦書き/横書きの文字・フォント(端末/選定catalog/取り込み+フォルダ管理)を編集し、
 *       確定で通常Raster Layerを1件のHistoryで追加/更新する。
 * 依存: system/balloon-geometry.js, system/balloon-raster.js, system/lettering-raster.js, system/font-library.js,
 *   system/history.js, system/event-bus.js, ui/balloon-overlay.js, ui/manga-tabs.js, ui/numeric-field.js,
 *   ui/popup-drag-helper.js, ui/feedback-toast.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: BalloonPopup
 * イベント発火: popup:shown, popup:hidden, layer:content-changed
 * 保存: 編集中のparamsはlocalStorage(UI設定)。選定フォントのfavorite/Primary/短評/見本もlocalStorage(UI設定)。
 *   確定Layerは通常Raster Layerで、再編集用に layerData.balloon (optional・sanitize済み)を持つ。
 *   取り込みフォントの実体はIndexedDB(font-library)で、Projectには入れない。
 * 見た目: 部品のclassはコマ割りpopupと共通(styles/components/panel-layout-popup.css)。
 * 実装状態: ✅実装（WP-021）
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';
import {
    BALLOON_LIMITS,
    BALLOON_SHAPES,
    BALLOON_TAIL_STYLES,
    balloonHandles,
    balloonTextArea,
    defaultBalloonParams,
    normalizeBalloonParams,
    sanitizeBalloonData
} from '../system/balloon-geometry.js';
import { letteringPlacement, paintBalloon, rasterizeBalloon } from '../system/balloon-raster.js';
import { measureLettering, rasterizeLettering } from '../system/lettering-raster.js';
import { FONT_FILE_ACCEPT, FONT_SAMPLE_OPTIONS, fontLibrary, sortBundledFonts } from '../system/font-library.js';
import { BalloonOverlay } from './balloon-overlay.js';
import { mountMangaTabs, noteMangaTabShown } from './manga-tabs.js';
import { attachNumericField } from './numeric-field.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import { showFeedbackToast } from './feedback-toast.js';

const STORAGE_KEY = 'tegaki-balloon-v1';
const POPUP_ID = 'balloon-popup';
const PREVIEW_MAX = { width: 280, height: 280 };
const L = BALLOON_LIMITS;
const GENERIC_FONTS = Object.freeze([
    { value: 'sys:sans-serif', label: 'ゴシック（標準）' },
    { value: 'sys:serif', label: '明朝（標準）' }
]);
const BUNDLED_OPTION_PREFIX = 'bundle:';
const IMPORTED_OPTION_PREFIX = 'imp:';

// 数値欄: path は params 内の場所。unit/display は表示用、shape は表示する形(省略=常時)
const FIELDS = Object.freeze([
    { key: 'lineWidth', path: ['lineWidth'], label: '線の太さ', min: L.lineWidth.min, max: L.lineWidth.max, step: 0.5, unit: 'px' },
    { key: 'corner', path: ['corner'], label: '角の丸み', min: 0, max: 0.5, step: 0.01, unit: '%', toDisplay: v => Math.round(v * 200), fromDisplay: v => v / 200, wheelStep: 0.02, shape: 'roundrect' },
    { key: 'bumps', path: ['bumps'], label: 'ふくらみ数', min: L.bumps.min, max: L.bumps.max, step: 1, unit: '個', shape: 'cloud' },
    { key: 'spikes', path: ['spikes'], label: 'とげの数', min: L.spikes.min, max: L.spikes.max, step: 1, unit: '本', shape: 'burst' },
    { key: 'depth', path: ['depth'], label: 'とげの深さ', min: L.depth.min, max: L.depth.max, step: 0.01, unit: '%', toDisplay: v => Math.round(v * 100), fromDisplay: v => v / 100, wheelStep: 0.02, shape: 'burst' },
    { key: 'jitter', path: ['jitter'], label: 'ばらつき', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: v => Math.round(v * 100), fromDisplay: v => v / 100, wheelStep: 0.05, shape: 'burst' },
    { key: 'tailWidth', path: ['tail', 'width'], label: 'しっぽの幅', min: L.tailWidth.min, max: 200, step: 1, unit: 'px', tail: true },
    { key: 'tailCurve', path: ['tail', 'curve'], label: 'しっぽの曲がり', min: -1, max: 1, step: 0.01, unit: '%', toDisplay: v => Math.round(v * 100), fromDisplay: v => v / 100, wheelStep: 0.05, tail: true },
    { key: 'fontSize', path: ['text', 'fontSize'], label: '文字サイズ', min: L.fontSize.min, max: 200, step: 1, unit: 'px', text: true },
    { key: 'lineHeight', path: ['text', 'lineHeight'], label: '行間', min: L.lineHeight.min, max: 2.5, step: 0.05, unit: '倍', text: true },
    { key: 'letterSpacing', path: ['text', 'letterSpacing'], label: '字間', min: -0.1, max: 0.6, step: 0.01, unit: 'em', text: true },
    { key: 'outlineWidth', path: ['text', 'outlineWidth'], label: '文字の縁取り', min: 0, max: 16, step: 0.5, unit: 'px', text: true }
]);

function getPath(obj, path) {
    return path.reduce((o, k) => o?.[k], obj);
}

function setPath(obj, path, value) {
    const next = structuredClone(obj);
    let o = next;
    for (let i = 0; i < path.length - 1; i += 1) o = o[path[i]];
    o[path[path.length - 1]] = value;
    return next;
}

export class BalloonPopup {
    constructor(dependencies = {}) {
        this.layerSystem = dependencies.layerSystem || null;
        this.eventBus = dependencies.eventBus || TegakiEventBus;
        this.history = dependencies.history || historyManager;
        this.fonts = dependencies.fontLibrary || fontLibrary;
        this.popup = null;
        this.isVisible = false;
        this.popupDragCleanup = null;
        this.elements = {};
        this.params = defaultBalloonParams(this._canvasSize());
        this.showOverlay = true;
        this.editing = null; // { layerId }
        this.drag = null;
        this.lettering = null; // { width, height, pixels, request }
        this.textImage = null; // overlay用 { url, x, y, width, height }
        this._letteringToken = 0;
        this._letteringTimer = null;
        this._fontData = { folders: [], fonts: [], bundled: [] };
        this._fontPreviewToken = 0;
        this._fontRefreshToken = 0;
        this._fontCommentDraft = null;
        this._hasStoredParams = false;
        this._paramsTouched = false;
        this._primaryApplied = false;
        this.scale = 1;

        this.overlay = new BalloonOverlay({
            eventBus: this.eventBus,
            onPointerDown: (target, event) => this._beginDrag(target, event, (e) => this.overlay.clientToCanvas(e.clientX, e.clientY)),
            getState: () => this.isVisible ? { params: this.params, canvas: this._canvasSize(), textImage: this.textImage } : null
        });
        this._layerListener = () => this._syncControls();
        this.eventBus?.on?.('layer:activated', this._layerListener);
        this._offFonts = this.fonts.onChange(() => this._refreshFontData());

        this._restore();
        this._ensurePopupElement();
        this._refreshFontData();
    }

    // ------------------------------------------------------------ 永続(UI設定のみ)

    _restore() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (data?.params) {
                this.params = normalizeBalloonParams(data.params, this._canvasSize());
                this._hasStoredParams = true;
            }
            if (typeof data?.showOverlay === 'boolean') this.showOverlay = data.showOverlay;
        } catch (error) {
            // 壊れた設定は既定へ戻す(Projectには無関係)
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: this.params, showOverlay: this.showOverlay }));
        } catch (error) {
            // localStorage不可でも動作は続ける
        }
    }

    // ------------------------------------------------------------ DOM

    _canvasSize() {
        const c = this.layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        return { width: Math.max(1, Math.round(c.width || 800)), height: Math.max(1, Math.round(c.height || 800)) };
    }

    _ensurePopupElement() {
        let popup = document.getElementById(POPUP_ID);
        if (!popup) {
            popup = document.createElement('div');
            popup.id = POPUP_ID;
            popup.className = 'popup-panel popup-panel--translucent ui-scrollbar balloon-popup';
            popup.style.top = '60px';
            popup.style.left = '60px';
            (document.querySelector('.main-layout') || document.body).appendChild(popup);
        } else {
            mountPopupAtOverlayRoot(popup);
        }
        this.popup = popup;
        this._build();
        this.popupDragCleanup = attachPopupDrag(popup, {
            interactiveSelector: 'button, input, select, textarea, a, canvas, summary, .pl-value, .popup-close-btn, .ui-close-button'
        });
    }

    _build() {
        const closeBtn = window.DOMBuilder
            ? window.DOMBuilder.createCloseButton(POPUP_ID).outerHTML
            : `<button class="ui-close-button ui-close-button--medium popup-close-btn" data-action="close-popup" data-target="${POPUP_ID}" type="button">${window.UI_ICONS?.close || '×'}</button>`;
        const shapes = BALLOON_SHAPES.map(s => `<button type="button" class="pl-chip pl-chip--wide" data-shape="${s.id}">${s.label}</button>`).join('');
        const tails = BALLOON_TAIL_STYLES.map(s => `<button type="button" class="pl-chip pl-chip--wide" data-tail-style="${s.id}">${s.label}</button>`).join('');
        const row = (f) => `
            <label class="pl-row" data-row="${f.key}">
                <span class="pl-label">${f.label}</span>
                <input type="range" class="pl-range" data-field="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}">
                <span class="pl-value" data-value-for="${f.key}"></span>
            </label>`;
        const rows = (pred) => FIELDS.filter(pred).map(row).join('');

        this.popup.innerHTML = `
            ${closeBtn}
            <div class="manga-tabs-host" data-role="manga-tabs"></div>
            <div class="pl-title">吹き出し <span class="pl-edit-status" data-role="edit-status"></span></div>
            <div class="pl-presets" role="group" aria-label="形">${shapes}</div>
            <canvas class="pl-preview" width="${PREVIEW_MAX.width}" height="${PREVIEW_MAX.height}" aria-label="吹き出しプレビュー"></canvas>
            <div class="pl-hint">中心=移動 / 四隅=大きさ / 先端=しっぽの向き。キャンバス上でも同じ操作</div>
            <label class="pl-row pl-check">
                <input type="checkbox" data-role="overlay-toggle">
                <span>キャンバス上に重ねて表示・操作する</span>
            </label>

            <div class="pl-sep"></div>
            <div class="pl-row">
                <span class="pl-label">しっぽ</span>
                <span class="pl-chips">
                    <button type="button" class="pl-chip" data-role="tail-enabled" aria-pressed="true">あり</button>
                    ${tails}
                </span>
            </div>
            ${rows(f => f.tail)}
            ${rows(f => !f.tail && !f.text)}
            <div class="pl-actions" role="group" aria-label="形の乱数">
                <button type="button" class="pl-btn" data-action="reseed" data-role="reseed" title="ギザギザの配り方を引き直す">とげを引き直す</button>
            </div>
            <div class="pl-row">
                <span class="pl-label">線 / 塗り</span>
                <input type="color" class="pl-color" data-color="lineColor" title="線の色">
                <input type="color" class="pl-color" data-color="fillColor" title="塗りの色">
            </div>

            <div class="pl-sep"></div>
            <textarea class="pl-textarea" data-role="content" rows="3" placeholder="セリフ（改行で行を分けます）" aria-label="セリフ"></textarea>
            <div class="pl-row">
                <span class="pl-label">書き方</span>
                <span class="pl-chips">
                    <button type="button" class="pl-chip pl-chip--wide" data-vertical="true">縦書き</button>
                    <button type="button" class="pl-chip pl-chip--wide" data-vertical="false">横書き</button>
                    <button type="button" class="pl-chip" data-role="bold" aria-pressed="false" title="太字">B</button>
                </span>
            </div>
            <div class="pl-row">
                <span class="pl-label">フォント</span>
                <select class="pl-select" data-role="font-select" aria-label="フォント"></select>
            </div>
            <div class="pl-font-card" data-role="font-card" hidden>
                <div class="pl-font-card__heading">
                    <strong data-role="font-title"></strong>
                    <span data-role="font-category"></span>
                </div>
                <div class="pl-font-card__comment" data-role="font-catalog-comment"></div>
                <div class="pl-font-card__meta" data-role="font-meta"></div>
                <div class="pl-font-card__sample">
                    <label class="pl-label" for="balloon-font-sample">見本</label>
                    <select id="balloon-font-sample" class="pl-select pl-select--small" data-role="font-sample" aria-label="フォント見本"></select>
                    <span class="pl-font-load-status" data-role="font-load-status" aria-live="polite"></span>
                    <div class="pl-font-sample" data-role="font-sample-preview" aria-live="polite"></div>
                </div>
                <label class="pl-row pl-check pl-font-card__favorite">
                    <input type="checkbox" data-role="font-favorite">
                    <span>お気に入り</span>
                </label>
                <label class="pl-row pl-font-card__user-comment">
                    <span class="pl-label">自分用メモ</span>
                    <input type="text" class="pl-text" data-role="font-comment" maxlength="160" placeholder="短いメモ（任意）" aria-label="フォントの自分用メモ">
                </label>
                <button type="button" class="pl-btn pl-font-primary" data-action="font-primary">Primaryにする</button>
                <div class="pl-font-links" data-role="font-links"></div>
            </div>
            <label class="pl-row pl-check">
                <input type="checkbox" data-role="auto-fit">
                <span>吹き出しに合わせて文字サイズを自動調整</span>
            </label>
            ${rows(f => f.text)}
            <div class="pl-row">
                <span class="pl-label">文字色 / 縁</span>
                <input type="color" class="pl-color" data-color="textColor" title="文字の色">
                <input type="color" class="pl-color" data-color="outlineColor" title="縁取りの色">
            </div>

            <details class="pl-details" data-role="font-manager">
                <summary>フォント管理（取り込み・フォルダ）</summary>
                <div class="pl-fm">
                    <div class="pl-hint pl-hint--left">端末のフォントはそのまま使えます。ここでは .ttf / .otf / .woff2 を取り込み、フォルダで分けて管理できます（ファイルはこのブラウザ内にだけ保存。フォントのライセンスはご自身でご確認ください）。</div>
                    <div class="pl-row">
                        <span class="pl-label">フォルダ</span>
                        <select class="pl-select" data-role="folder-select" aria-label="フォルダ"></select>
                    </div>
                    <div class="pl-row">
                        <input type="text" class="pl-text" data-role="folder-name" placeholder="フォルダ名" maxlength="30" aria-label="フォルダ名">
                    </div>
                    <div class="pl-actions" role="group" aria-label="フォルダ操作">
                        <button type="button" class="pl-btn" data-action="folder-add">新規</button>
                        <button type="button" class="pl-btn" data-action="folder-rename">名前変更</button>
                        <button type="button" class="pl-btn" data-action="folder-delete">削除</button>
                    </div>
                    <label class="pl-btn pl-btn--file" title="選択中のフォルダへ取り込む">
                        フォントファイルを取り込む…
                        <input type="file" data-role="font-file" accept="${FONT_FILE_ACCEPT}" multiple hidden>
                    </label>
                    <div class="pl-fontlist ui-scrollbar" data-role="font-list"></div>
                </div>
            </details>

            <div class="pl-footer">
                <button type="button" class="pl-btn" data-action="reset">リセット</button>
                <button type="button" class="pl-btn" data-action="load-active" title="選択中の吹き出しLayerから読み込んで再編集">レイヤーから再編集</button>
            </div>
            <div class="pl-footer">
                <button type="button" class="pl-btn pl-btn--primary" data-action="update" data-role="update-btn" title="再編集中のLayerを置き換え（Undo 1回で戻る）" hidden>既存の吹き出しを更新</button>
                <button type="button" class="pl-btn pl-btn--primary" data-action="apply" title="新規Layerとして追加（Undo 1回で戻る）">新規レイヤーに適用</button>
            </div>
        `;
        const q = (sel) => this.popup.querySelector(sel);
        this.elements = {
            canvas: q('.pl-preview'),
            editStatus: q('[data-role="edit-status"]'),
            updateBtn: q('[data-role="update-btn"]'),
            loadBtn: q('[data-action="load-active"]'),
            overlayToggle: q('[data-role="overlay-toggle"]'),
            tailEnabled: q('[data-role="tail-enabled"]'),
            content: q('[data-role="content"]'),
            fontSelect: q('[data-role="font-select"]'),
            fontCard: q('[data-role="font-card"]'),
            fontTitle: q('[data-role="font-title"]'),
            fontCategory: q('[data-role="font-category"]'),
            fontCatalogComment: q('[data-role="font-catalog-comment"]'),
            fontMeta: q('[data-role="font-meta"]'),
            fontSample: q('[data-role="font-sample"]'),
            fontLoadStatus: q('[data-role="font-load-status"]'),
            fontSamplePreview: q('[data-role="font-sample-preview"]'),
            fontFavorite: q('[data-role="font-favorite"]'),
            fontComment: q('[data-role="font-comment"]'),
            fontPrimary: q('[data-action="font-primary"]'),
            fontLinks: q('[data-role="font-links"]'),
            autoFit: q('[data-role="auto-fit"]'),
            bold: q('[data-role="bold"]'),
            reseed: q('[data-role="reseed"]'),
            folderSelect: q('[data-role="folder-select"]'),
            folderName: q('[data-role="folder-name"]'),
            fontList: q('[data-role="font-list"]')
        };
        this._bind();
        this._renderFontOptions();
        this._renderFontManager();
        this._syncControls();
        this._redraw();
    }

    // ------------------------------------------------------------ 操作

    _bind() {
        const root = this.popup;
        root.querySelectorAll('[data-shape]').forEach(btn => btn.addEventListener('click', () => this._setParams({ ...this.params, shape: btn.dataset.shape })));
        root.querySelectorAll('[data-tail-style]').forEach(btn => btn.addEventListener('click', () => this._setParams(setPath(this.params, ['tail', 'style'], btn.dataset.tailStyle))));
        this.elements.tailEnabled.addEventListener('click', () => this._setParams(setPath(this.params, ['tail', 'enabled'], !this.params.tail.enabled)));
        root.querySelectorAll('input[data-field]').forEach(input => input.addEventListener('input', () => {
            const f = FIELDS.find(x => x.key === input.dataset.field);
            let next = setPath(this.params, f.path, Number(input.value));
            // 文字サイズを手で触ったら自動調整を切る(手動を優先)
            if (f.key === 'fontSize') next = setPath(next, ['text', 'autoFit'], false);
            this._setParams(next);
        }));
        for (const [attr, path] of [['lineColor', ['lineColor']], ['fillColor', ['fillColor']], ['textColor', ['text', 'color']], ['outlineColor', ['text', 'outlineColor']]]) {
            root.querySelector(`[data-color="${attr}"]`).addEventListener('input', (e) => this._setParams(setPath(this.params, path, e.target.value)));
        }
        this.elements.content.addEventListener('input', (e) => this._setParams(setPath(this.params, ['text', 'content'], e.target.value)));
        // textarea内のキーはキャンバスのショートカットへ漏らさない
        ['keydown', 'keyup'].forEach(type => this.elements.content.addEventListener(type, e => e.stopPropagation()));
        root.querySelectorAll('[data-vertical]').forEach(btn => btn.addEventListener('click', () => this._setParams(setPath(this.params, ['text', 'vertical'], btn.dataset.vertical === 'true'))));
        this.elements.bold.addEventListener('click', () => this._setParams(setPath(this.params, ['text', 'bold'], !this.params.text.bold)));
        this.elements.autoFit.addEventListener('change', (e) => this._setParams(setPath(this.params, ['text', 'autoFit'], e.target.checked)));
        this.elements.fontSelect.addEventListener('change', (e) => this._onFontSelected(e.target.value));
        this.elements.fontSample.addEventListener('change', (e) => {
            this.fonts.setSample?.(e.target.value);
            this._renderFontDetails();
        });
        this.elements.fontFavorite.addEventListener('change', async (e) => {
            const id = this._selectedFontId();
            if (!id) return;
            this._commitFontCommentDraft();
            await this.fonts.setFavorite?.(id, e.target.checked);
        });
        this.elements.fontComment.addEventListener('input', (e) => {
            const id = this._selectedFontId();
            if (id) this._fontCommentDraft = { id, value: e.target.value, dirty: true };
        });
        this.elements.fontComment.addEventListener('change', (e) => {
            const id = this._selectedFontId();
            if (id) {
                this._fontCommentDraft = { id, value: e.target.value, dirty: false };
                this.fonts.setUserComment?.(id, e.target.value);
            }
        });
        this.elements.fontPrimary.addEventListener('click', async () => {
            const id = this._selectedBundledFont()?.id;
            if (!id) return;
            this._commitFontCommentDraft();
            const preferences = this.fonts.getPreferences?.() || {};
            await this.fonts.setPrimary?.(preferences.primaryId === id ? null : id);
        });
        this.elements.overlayToggle.addEventListener('change', (e) => {
            this.showOverlay = e.target.checked;
            this._persist();
            this._syncOverlayVisibility();
        });
        root.querySelectorAll('[data-action]').forEach(btn => {
            if (btn.dataset.action === 'close-popup') return;
            btn.addEventListener('click', () => this._onAction(btn.dataset.action));
        });
        root.querySelector('[data-role="font-file"]').addEventListener('change', (e) => this._importFonts(e.target));
        ['keydown', 'keyup'].forEach(type => {
            this.elements.folderName.addEventListener(type, e => e.stopPropagation());
            this.elements.fontComment.addEventListener(type, e => e.stopPropagation());
        });

        this._fieldDetachers = FIELDS.map(f => attachNumericField({
            range: root.querySelector(`input[data-field="${f.key}"]`),
            valueEl: root.querySelector(`[data-value-for="${f.key}"]`),
            toDisplay: f.toDisplay,
            fromDisplay: f.fromDisplay,
            wheelStep: f.wheelStep ?? null
        }));

        const canvas = this.elements.canvas;
        canvas.addEventListener('pointerdown', (e) => this._onPreviewPointerDown(e));
        canvas.addEventListener('pointermove', (e) => {
            if (this.drag) return;
            canvas.style.cursor = this._hitHandle(this._toCanvasPoint(e)) ? 'move' : 'default';
        });
    }

    _onAction(action) {
        if (action === 'reset') {
            this.editing = null;
            this._setParams(defaultBalloonParams(this._canvasSize()));
        } else if (action === 'reseed') {
            this._setParams({ ...this.params, seed: Math.floor(Math.random() * 0x7fffffff) });
        } else if (action === 'apply') {
            this.apply();
        } else if (action === 'update') {
            this.update();
        } else if (action === 'load-active') {
            this.loadFromActiveLayer();
        } else if (action === 'folder-add') {
            this._folderAdd();
        } else if (action === 'folder-rename') {
            this._folderRename();
        } else if (action === 'folder-delete') {
            this._folderDelete();
        }
    }

    _setParams(next, options = {}) {
        this.params = normalizeBalloonParams(next, this._canvasSize());
        if (!options.fromCatalogPrimary) this._paramsTouched = true;
        this._persist();
        this._syncControls();
        this._redraw();
        if (!options.skipLettering) this._scheduleLettering();
    }

    _activeBalloon() {
        const data = this.layerSystem?.getActiveLayer?.()?.layerData?.balloon;
        return data ? sanitizeBalloonData(data, this._canvasSize()) : null;
    }

    _syncControls() {
        if (!this.popup || !this.elements.canvas) return;
        const p = this.params;
        for (const f of FIELDS) {
            const row = this.popup.querySelector(`[data-row="${f.key}"]`);
            if (row) row.hidden = (f.shape && f.shape !== p.shape) || (f.tail && !p.tail.enabled);
            const raw = getPath(p, f.path);
            const input = this.popup.querySelector(`input[data-field="${f.key}"]`);
            if (input && Number(input.value) !== raw) input.value = String(raw);
            const out = this.popup.querySelector(`[data-value-for="${f.key}"]`);
            if (out && !out.dataset.editing) {
                const auto = f.key === 'fontSize' && p.text.autoFit && this.lettering?.request?.fontSize;
                out.textContent = auto ? `自動 ${this.lettering.request.fontSize}px` : `${f.toDisplay ? f.toDisplay(raw) : raw}${f.unit}`;
            }
            if (input) {
                const min = Number(input.min);
                const max = Number(input.max);
                const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
                input.style.setProperty('--pl-fill', `${Math.max(0, Math.min(100, pct))}%`);
            }
        }
        this.popup.querySelectorAll('[data-shape]').forEach(btn => this._press(btn, btn.dataset.shape === p.shape));
        this.popup.querySelectorAll('[data-tail-style]').forEach(btn => {
            this._press(btn, btn.dataset.tailStyle === p.tail.style);
            btn.disabled = !p.tail.enabled;
        });
        this._press(this.elements.tailEnabled, p.tail.enabled);
        this.elements.tailEnabled.textContent = p.tail.enabled ? 'あり' : 'なし';
        this.popup.querySelectorAll('[data-vertical]').forEach(btn => this._press(btn, (btn.dataset.vertical === 'true') === p.text.vertical));
        this._press(this.elements.bold, p.text.bold);
        this.elements.reseed.hidden = p.shape !== 'burst';
        this.elements.autoFit.checked = p.text.autoFit;
        this.elements.overlayToggle.checked = this.showOverlay;
        if (this.elements.content.value !== p.text.content && document.activeElement !== this.elements.content) this.elements.content.value = p.text.content;
        for (const [attr, value] of [['lineColor', p.lineColor], ['fillColor', p.fillColor], ['textColor', p.text.color], ['outlineColor', p.text.outlineColor]]) {
            const input = this.popup.querySelector(`[data-color="${attr}"]`);
            if (input && input.value !== value) input.value = value;
        }
        const fontValue = this._fontOptionValue(p.text);
        if (this.elements.fontSelect.value !== fontValue && [...this.elements.fontSelect.options].some(o => o.value === fontValue)) this.elements.fontSelect.value = fontValue;
        this._renderFontDetails();
        this.elements.editStatus.textContent = this.editing ? '— 再編集中' : '';
        this.elements.updateBtn.hidden = !this.editing;
        this.elements.loadBtn.disabled = !this._activeBalloon();
    }

    _press(btn, on) {
        btn.setAttribute('aria-pressed', String(on));
        btn.classList.toggle('is-selected', on);
    }

    _syncOverlayVisibility() {
        this.overlay.setVisible(this.isVisible && this.showOverlay);
    }

    // ------------------------------------------------------------ フォント

    _fontOptionValue(text) {
        if (text.fontKind === 'imported') {
            const bundled = this._fontData.bundled.some(font => font.id === text.fontId);
            return `${bundled ? BUNDLED_OPTION_PREFIX : IMPORTED_OPTION_PREFIX}${text.fontId || ''}`;
        }
        return `sys:${text.fontFamily}`;
    }

    _selectedFontId() {
        const value = this.elements.fontSelect?.value || '';
        if (value.startsWith(BUNDLED_OPTION_PREFIX)) return value.slice(BUNDLED_OPTION_PREFIX.length);
        if (value.startsWith(IMPORTED_OPTION_PREFIX)) return value.slice(IMPORTED_OPTION_PREFIX.length);
        return '';
    }

    _selectedBundledFont() {
        const id = this._selectedFontId();
        return this._fontData.bundled.find(font => font.id === id) || null;
    }

    _safeLink(label, href) {
        const url = String(href || '');
        if (!/^(?:https?:\/\/|\/|\.\/)/i.test(url)) return '';
        const text = String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const attr = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<a href="${attr}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }

    _renderFontDetails() {
        const card = this.elements.fontCard;
        if (!card) return;
        const token = ++this._fontPreviewToken;
        const id = this._selectedFontId();
        const bundled = this._selectedBundledFont();
        const imported = this._fontData.fonts.find(font => font.id === id) || null;
        const selected = bundled || imported;
        card.hidden = !selected;
        if (!selected) return;
        const preferences = this.fonts.getPreferences?.() || {};
        const sampleId = preferences.sampleId || FONT_SAMPLE_OPTIONS[0].id;
        const sample = FONT_SAMPLE_OPTIONS.find(item => item.id === sampleId) || FONT_SAMPLE_OPTIONS[0];
        this.elements.fontTitle.textContent = selected.label || id;
        this.elements.fontCategory.textContent = bundled?.category || '取り込みフォント';
        this.elements.fontCatalogComment.textContent = bundled?.comment || (imported ? 'このブラウザに取り込んだフォントです。' : '');
        this.elements.fontMeta.textContent = bundled
            ? [bundled.coverage && `対応: ${bundled.coverage}`, bundled.dakuten !== '' && bundled.dakuten !== undefined ? `濁点: ${typeof bundled.dakuten === 'boolean' ? (bundled.dakuten ? '説明あり' : '未確認') : bundled.dakuten}` : ''].filter(Boolean).join('　')
            : '実体はIndexedDBに保存され、Projectには入りません。';
        this.elements.fontSample.innerHTML = FONT_SAMPLE_OPTIONS.map(item => `<option value="${item.id}">${item.label}</option>`).join('');
        this.elements.fontSample.value = sample.id;
        this.elements.fontFavorite.checked = preferences.favorites?.includes(id) === true;
        if (this._fontCommentDraft?.id !== id) this._fontCommentDraft = null;
        if (this._fontCommentDraft?.dirty) this.elements.fontComment.value = this._fontCommentDraft.value;
        else this.elements.fontComment.value = preferences.comments?.[id] || '';
        this.elements.fontPrimary.hidden = !bundled;
        this.elements.fontPrimary.textContent = preferences.primaryId === id ? 'Primaryを解除' : 'Primaryにする';
        const licenseFile = bundled ? this.fonts.getBundledAssetUrl?.(bundled, 'licenseFile') : '';
        this.elements.fontLinks.innerHTML = bundled
            ? [
                bundled.sourceUrl && this._safeLink(bundled.author ? `作者・公式: ${bundled.author}` : '作者・公式', bundled.sourceUrl),
                bundled.licenseUrl && this._safeLink('ライセンス', bundled.licenseUrl),
                licenseFile && this._safeLink('同梱LICENSE', licenseFile)
            ].filter(Boolean).join('　')
            : '';
        this.elements.fontLoadStatus.textContent = '見本を読み込み中…';
        this.elements.fontLoadStatus.dataset.state = 'loading';
        this.elements.fontSamplePreview.textContent = '読み込み中…';
        this.elements.fontSamplePreview.dataset.state = 'loading';
        this.elements.fontSamplePreview.style.fontFamily = 'sans-serif';
        let loadPromise;
        try {
            loadPromise = typeof this.fonts.ensureLoaded === 'function' ? this.fonts.ensureLoaded(id) : null;
        } catch (error) {
            loadPromise = Promise.reject(error);
        }
        Promise.resolve(loadPromise).then(entry => {
            if (token !== this._fontPreviewToken) return;
            if (!entry) {
                this.elements.fontLoadStatus.textContent = '見本を読み込めませんでした';
                this.elements.fontLoadStatus.dataset.state = 'error';
                this.elements.fontSamplePreview.textContent = '（フォント未適用）';
                this.elements.fontSamplePreview.dataset.state = 'error';
                this.elements.fontSamplePreview.style.fontFamily = '';
                return;
            }
            this.elements.fontLoadStatus.textContent = '見本を読み込みました';
            this.elements.fontLoadStatus.dataset.state = 'loaded';
            this.elements.fontSamplePreview.textContent = sample.text;
            this.elements.fontSamplePreview.dataset.state = 'loaded';
            this.elements.fontSamplePreview.style.fontFamily = `'${String(entry.family).replace(/["'\\]/g, '')}'`;
        }).catch(() => {
            if (token !== this._fontPreviewToken) return;
            this.elements.fontLoadStatus.textContent = '見本を読み込めませんでした';
            this.elements.fontLoadStatus.dataset.state = 'error';
            this.elements.fontSamplePreview.textContent = '（フォント未適用）';
            this.elements.fontSamplePreview.dataset.state = 'error';
            this.elements.fontSamplePreview.style.fontFamily = '';
        });
    }

    _applyCatalogPrimary() {
        if (this._hasStoredParams || this._paramsTouched || this._primaryApplied) return;
        const primaryId = this.fonts.getPreferences?.()?.primaryId || this._fontData.bundled.find(font => font.primary)?.id;
        if (!primaryId || !this._fontData.bundled.some(font => font.id === primaryId)) return;
        this._primaryApplied = true;
        this._setParams({
            ...this.params,
            text: { ...this.params.text, fontKind: 'imported', fontId: primaryId }
        }, { fromCatalogPrimary: true });
    }

    _commitFontCommentDraft() {
        const draft = this._fontCommentDraft;
        if (!draft?.dirty || !draft.id) return;
        this._fontCommentDraft = { ...draft, dirty: false };
        try {
            this.fonts.setUserComment?.(draft.id, draft.value, { silent: true });
        } catch (error) {
            this._fontCommentDraft = draft;
        }
    }

    _sortImportedFonts(fonts) {
        return sortBundledFonts(fonts, this.fonts.getPreferences?.() || {});
    }

    async _refreshFontData() {
        const refreshToken = ++this._fontRefreshToken;
        const previous = this._fontData || { folders: [], fonts: [], bundled: [] };
        const read = (fn, fallback) => {
            try { return Promise.resolve(fn()); } catch (error) { return Promise.reject(error); }
        };
        const [foldersResult, fontsResult, bundledResult] = await Promise.allSettled([
            read(() => this.fonts.listFolders(), previous.folders),
            read(() => this.fonts.listFonts(), previous.fonts),
            read(() => this.fonts.listBundledFonts?.() ?? previous.bundled, previous.bundled)
        ]);
        if (refreshToken !== this._fontRefreshToken) return;
        const valueOrPrevious = (result, fallback) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : fallback;
        this._fontData = {
            folders: valueOrPrevious(foldersResult, previous.folders),
            fonts: valueOrPrevious(fontsResult, previous.fonts),
            bundled: valueOrPrevious(bundledResult, previous.bundled)
        };
        this._applyCatalogPrimary();
        if (this.popup) {
            this._renderFontOptions();
            this._renderFontManager();
            this._syncControls();
        }
    }

    _renderFontOptions() {
        const select = this.elements.fontSelect;
        if (!select) return;
        const group = (label, items) => items.length
            ? `<optgroup label="${label}">${items.map(i => `<option value="${i.value}">${i.label}</option>`).join('')}</optgroup>`
            : '';
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const system = this.fonts.listSystemFonts().map(f => ({ value: `sys:${f}`, label: esc(f) }));
        const { folders, fonts, bundled } = this._fontData;
        const bundledItems = rows => rows.map(font => ({
            value: `${BUNDLED_OPTION_PREFIX}${font.id}`,
            label: `${font.primary ? '★ ' : ''}${font.category ? `［${esc(font.category)}］` : ''}${esc(font.label)}`
        }));
        const favoriteBundled = bundled.filter(font => font.favorite);
        const otherBundled = bundled.filter(font => !font.favorite);
        let html = group('標準', GENERIC_FONTS)
            + group('この端末のフォント', system)
            + group('選定フォント／お気に入り', bundledItems(favoriteBundled))
            + group('選定フォント', bundledItems(otherBundled));
        for (const folder of folders) {
            html += group(`取り込み／${esc(folder.name)}`, this._sortImportedFonts(fonts.filter(f => f.folderId === folder.id)).map(f => ({ value: `${IMPORTED_OPTION_PREFIX}${f.id}`, label: esc(f.label) })));
        }
        html += group('取り込み／未分類', this._sortImportedFonts(fonts.filter(f => !f.folderId || !folders.some(x => x.id === f.folderId))).map(f => ({ value: `${IMPORTED_OPTION_PREFIX}${f.id}`, label: esc(f.label) })));
        select.innerHTML = html;
    }

    _renderFontManager() {
        const { folders, fonts } = this._fontData;
        const sel = this.elements.folderSelect;
        if (!sel) return;
        const previous = sel.value;
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        sel.innerHTML = `<option value="">未分類</option>${folders.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}`;
        if ([...sel.options].some(o => o.value === previous)) sel.value = previous;
        const list = this.elements.fontList;
        if (!fonts.length) {
            list.innerHTML = '<div class="pl-hint">取り込んだフォントはまだありません</div>';
            return;
        }
        list.innerHTML = this._sortImportedFonts(fonts).map(font => `
            <div class="pl-fontrow" data-font-id="${font.id}">
                <span class="pl-fontname" title="${esc(font.label)}">${esc(font.label)}</span>
                <select class="pl-select pl-select--small" data-font-folder aria-label="フォルダ">
                    <option value="">未分類</option>
                    ${folders.map(f => `<option value="${f.id}"${f.id === font.folderId ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}
                </select>
                <button type="button" class="pl-btn pl-btn--small pl-btn--icon" data-font-delete title="このフォントを削除">削除</button>
            </div>`).join('');
        list.querySelectorAll('.pl-fontrow').forEach(row => {
            const id = row.dataset.fontId;
            row.querySelector('[data-font-folder]').addEventListener('change', (e) => this.fonts.moveFont(id, e.target.value || null));
            row.querySelector('[data-font-delete]').addEventListener('click', async () => {
                await this.fonts.deleteFont(id);
                if (this.params.text.fontKind === 'imported' && this.params.text.fontId === id) {
                    this._setParams({ ...this.params, text: { ...this.params.text, fontKind: 'system', fontId: null, fontFamily: 'sans-serif' } });
                    showFeedbackToast('使用中のフォントを削除したため、標準のゴシックへ戻しました');
                }
            });
        });
    }

    _onFontSelected(value) {
        this._commitFontCommentDraft();
        if (value.startsWith(BUNDLED_OPTION_PREFIX) || value.startsWith(IMPORTED_OPTION_PREFIX)) {
            const prefix = value.startsWith(BUNDLED_OPTION_PREFIX) ? BUNDLED_OPTION_PREFIX : IMPORTED_OPTION_PREFIX;
            this._setParams({ ...this.params, text: { ...this.params.text, fontKind: 'imported', fontId: value.slice(prefix.length) } });
        } else {
            this._setParams({ ...this.params, text: { ...this.params.text, fontKind: 'system', fontId: null, fontFamily: value.slice(4) } });
        }
    }

    async _importFonts(input) {
        const files = [...(input.files || [])];
        input.value = '';
        if (!files.length) return;
        const folderId = this.elements.folderSelect.value || null;
        let added = 0;
        for (const file of files) {
            const result = await this.fonts.addFontFile(file, folderId);
            if (result.ok) {
                added += 1;
                if (added === 1) this._onFontSelected(`${IMPORTED_OPTION_PREFIX}${result.font.id}`);
            } else {
                showFeedbackToast(`${file.name}: ${result.reason}`, { duration: 2600 });
            }
        }
        if (added) showFeedbackToast(`フォントを${added}件取り込みました`);
    }

    async _folderAdd() {
        const name = this.elements.folderName.value.trim();
        if (!name) return showFeedbackToast('フォルダ名を入力してください');
        const folder = await this.fonts.createFolder(name);
        this.elements.folderName.value = '';
        await this._refreshFontData();
        this.elements.folderSelect.value = folder.id;
    }

    async _folderRename() {
        const id = this.elements.folderSelect.value;
        const name = this.elements.folderName.value.trim();
        if (!id) return showFeedbackToast('名前を変えるフォルダを選んでください');
        if (!name) return showFeedbackToast('新しいフォルダ名を入力してください');
        await this.fonts.renameFolder(id, name);
        this.elements.folderName.value = '';
    }

    async _folderDelete() {
        const id = this.elements.folderSelect.value;
        if (!id) return showFeedbackToast('削除するフォルダを選んでください');
        await this.fonts.deleteFolder(id);
        showFeedbackToast('フォルダを削除しました（中のフォントは未分類へ移りました）');
    }

    // ------------------------------------------------------------ 文字の組版(プレビュー/確定共通)

    _scheduleLettering() {
        clearTimeout(this._letteringTimer);
        this._letteringTimer = setTimeout(() => this._refreshLettering(), 140);
    }

    /** 文字領域に収まる文字画像を作る(自動調整ONなら収まる最大サイズを探す)。 */
    async _refreshLettering() {
        const token = ++this._letteringToken;
        const p = this.params;
        const text = p.text;
        if (!text.content.trim()) {
            this.lettering = null;
            this.textImage = null;
            this._redraw();
            return null;
        }
        const area = balloonTextArea(p, this._canvasSize());
        let family = text.fontFamily;
        let embedCss = '';
        if (text.fontKind === 'imported' && text.fontId) {
            const entry = await this.fonts.ensureLoaded(text.fontId);
            if (entry) {
                family = entry.family;
                embedCss = await this.fonts.getEmbedCss(text.fontId);
            } else {
                family = 'sans-serif';
                if (!this._warnedMissingFont) {
                    this._warnedMissingFont = true;
                    showFeedbackToast('取り込みフォントが見つからないため、標準のゴシックで表示します');
                }
            }
        }
        const base = {
            text: text.content,
            vertical: text.vertical,
            fontFamily: family,
            embedCss,
            lineHeight: text.lineHeight,
            letterSpacing: text.letterSpacing,
            bold: text.bold,
            color: text.color,
            outlineWidth: text.outlineWidth,
            outlineColor: text.outlineColor,
            align: text.align,
            // 縦書きは高さ、横書きは幅で折り返す
            boxWidth: text.vertical ? 0 : Math.floor(area.w),
            boxHeight: text.vertical ? Math.floor(area.h) : 0
        };
        let size = text.fontSize;
        if (text.autoFit) {
            let lo = 8;
            let hi = 200;
            const fits = async (s) => {
                const m = await measureLettering({ ...base, fontSize: s, ...this._normalizedForMeasure(base, s) });
                return text.vertical ? m.width <= area.w : m.height <= area.h;
            };
            for (let i = 0; i < 8 && lo < hi; i += 1) {
                const mid = Math.ceil((lo + hi) / 2);
                if (await fits(mid)) lo = mid; else hi = mid - 1;
                if (token !== this._letteringToken) return null;
            }
            size = lo;
        }
        const result = await rasterizeLettering({ ...base, fontSize: size });
        if (token !== this._letteringToken) return null; // 新しい入力に追い越された
        if (!result.ok) {
            this.lettering = null;
            this.textImage = null;
            this._redraw();
            return null;
        }
        this.lettering = result;
        const at = letteringPlacement(p, this._canvasSize(), result);
        const c = document.createElement('canvas');
        c.width = result.width;
        c.height = result.height;
        c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(result.pixels), result.width, result.height), 0, 0);
        this.textImage = { url: c.toDataURL('image/png'), x: at.x, y: at.y, width: result.width, height: result.height };
        this._syncControls();
        this._redraw();
        return result;
    }

    /** 測定用に正規化済みのrequest(measureLetteringはnormalize済みを期待する)。 */
    _normalizedForMeasure(base, size) {
        return {
            vertical: base.vertical !== false,
            fontFamily: String(base.fontFamily),
            embedCss: '',
            fontSize: size,
            lineHeight: base.lineHeight,
            letterSpacing: base.letterSpacing,
            bold: base.bold === true,
            outlineWidth: base.outlineWidth,
            align: base.align,
            boxWidth: base.boxWidth,
            boxHeight: base.boxHeight
        };
    }

    // ------------------------------------------------------------ ドラッグ(プレビュー/キャンバス上)

    _beginDrag(target, event, toPoint) {
        this.endDrag();
        const start = toPoint(event);
        if (!start) return;
        const move = (e) => {
            if (!this.drag || e.pointerId !== this.drag.pointerId) return;
            const pt = toPoint(e);
            if (pt) this._applyDrag(pt);
        };
        const up = (e) => {
            if (!this.drag || e.pointerId !== this.drag.pointerId) return;
            this.endDrag();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        this.drag = {
            ...target,
            pointerId: event.pointerId,
            startPoint: start,
            startParams: structuredClone(this.params),
            cleanup: () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                window.removeEventListener('pointercancel', up);
            }
        };
    }

    endDrag() {
        if (!this.drag) return;
        this.drag.cleanup?.();
        this.drag = null;
    }

    _applyDrag(pt) {
        const drag = this.drag;
        if (!drag) return;
        const s = drag.startParams;
        let next = structuredClone(s);
        if (drag.type === 'center') {
            const dx = pt.x - drag.startPoint.x;
            const dy = pt.y - drag.startPoint.y;
            next.rect = { ...s.rect, x: s.rect.x + dx, y: s.rect.y + dy };
            next.tail = { ...s.tail, tip: { x: s.tail.tip.x + dx, y: s.tail.tip.y + dy } };
        } else if (drag.type === 'tip') {
            next.tail = { ...s.tail, tip: { x: pt.x, y: pt.y } };
        } else {
            const r = s.rect;
            const fixed = {
                tl: { x: r.x + r.w, y: r.y + r.h },
                tr: { x: r.x, y: r.y + r.h },
                br: { x: r.x, y: r.y },
                bl: { x: r.x + r.w, y: r.y }
            }[drag.type];
            if (!fixed) return;
            const x0 = Math.min(fixed.x, pt.x);
            const y0 = Math.min(fixed.y, pt.y);
            next.rect = { x: x0, y: y0, w: Math.max(L.size.min, Math.abs(pt.x - fixed.x)), h: Math.max(L.size.min, Math.abs(pt.y - fixed.y)) };
        }
        this._setParams(next);
    }

    _toCanvasPoint(e) {
        const rect = this.elements.canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (this.elements.canvas.width / rect.width);
        const py = (e.clientY - rect.top) * (this.elements.canvas.height / rect.height);
        return { x: px / this.scale, y: py / this.scale };
    }

    _hitHandle(pt) {
        const tol = 10 / this.scale;
        const h = balloonHandles(this.params, this._canvasSize());
        const candidates = [['tip', h.tip], ['tl', h.corners.tl], ['tr', h.corners.tr], ['br', h.corners.br], ['bl', h.corners.bl], ['center', h.center]];
        for (const [type, point] of candidates) {
            if (point && Math.hypot(pt.x - point.x, pt.y - point.y) <= tol) return type;
        }
        return null;
    }

    _onPreviewPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const type = this._hitHandle(this._toCanvasPoint(e));
        if (type) this._beginDrag({ type }, e, (ev) => this._toCanvasPoint(ev));
        e.preventDefault();
    }

    // ------------------------------------------------------------ プレビュー描画

    _redraw() {
        const el = this.elements.canvas;
        if (!el) return;
        const size = this._canvasSize();
        const bw = this.params.rect.x + this.params.rect.w;
        const view = { w: Math.max(size.width, bw), h: size.height };
        this.scale = Math.min(PREVIEW_MAX.width / size.width, PREVIEW_MAX.height / size.height);
        el.width = Math.max(1, Math.round(size.width * this.scale));
        el.height = Math.max(1, Math.round(size.height * this.scale));
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, el.width, el.height);
        ctx.fillStyle = '#f0e0d6'; // futaba-cream(キャンバス地の目安)
        ctx.fillRect(0, 0, el.width, el.height);
        ctx.save();
        ctx.scale(this.scale, this.scale);
        paintBalloon(ctx, this.params, size);
        if (this.lettering) {
            const at = letteringPlacement(this.params, size, this.lettering);
            const tmp = document.createElement('canvas');
            tmp.width = this.lettering.width;
            tmp.height = this.lettering.height;
            tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.lettering.pixels), this.lettering.width, this.lettering.height), 0, 0);
            ctx.drawImage(tmp, at.x, at.y);
        }
        ctx.restore();
        const h = balloonHandles(this.params, size);
        ctx.strokeStyle = '#ff8c42';
        ctx.fillStyle = '#ffffee';
        ctx.lineWidth = 1.5;
        const dot = (p, r) => { ctx.beginPath(); ctx.arc(p.x * this.scale, p.y * this.scale, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
        for (const c of Object.values(h.corners)) dot(c, 4);
        if (h.tip) { ctx.fillStyle = '#ff8c42'; dot(h.tip, 5); ctx.fillStyle = '#ffffee'; }
        dot(h.center, 6);
        void view;
        this.overlay.schedule();
    }

    // ------------------------------------------------------------ 確定

    _guard() {
        if (!this.layerSystem?.createRasterLayerFromSnapshot) {
            showFeedbackToast('Raster Layerを作成できません');
            return false;
        }
        if (this.layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer === true) {
            showFeedbackToast('吹き出しは通常CanvasのRaster Layer専用です');
            return false;
        }
        return true;
    }

    async _raster() {
        // 入力直後でも最新の組版で確定する
        clearTimeout(this._letteringTimer);
        const lettering = await this._refreshLettering();
        const size = this._canvasSize();
        return rasterizeBalloon(this.params, size, lettering || (this.params.text.content.trim() ? this.lettering : null));
    }

    _meta() {
        return sanitizeBalloonData({ params: this.params }, this._canvasSize());
    }

    async apply() {
        if (!this._guard()) return { ok: false };
        const raster = await this._raster();
        if (!raster.ok) {
            showFeedbackToast(raster.reason);
            return { ok: false };
        }
        let created = null;
        try {
            created = this.layerSystem.createRasterLayerFromSnapshot({
                width: raster.width,
                height: raster.height,
                pixels: raster.pixels,
                rasterBounds: raster.rasterBounds,
                paths: [],
                pathsData: []
            }, { name: '吹き出し', historyName: 'balloon-apply', source: 'balloon' });
        } catch (error) {
            created = null;
        }
        if (!created?.layer?.layerData) {
            showFeedbackToast('吹き出しレイヤーを作成できません');
            return { ok: false };
        }
        created.layer.layerData.balloon = this._meta();
        this.eventBus?.emit('layer:content-changed', { layerId: created.layer.layerData.id, source: 'balloon' });
        this.editing = { layerId: created.layer.layerData.id };
        this._syncControls();
        showFeedbackToast('吹き出しを追加しました');
        return { ok: true, layerId: created.layer.layerData.id };
    }

    async update() {
        if (!this.editing || !this._guard()) return { ok: false };
        const layer = this.layerSystem.getLayers().find(l => l.layerData?.id === this.editing.layerId);
        if (!layer) {
            showFeedbackToast('再編集中の吹き出しLayerが見つかりません');
            this.editing = null;
            this._syncControls();
            return { ok: false };
        }
        const raster = await this._raster();
        if (!raster.ok) {
            showFeedbackToast(raster.reason);
            return { ok: false };
        }
        const before = this.layerSystem.createLayerRasterSnapshot(layer);
        const after = { ...before, width: raster.width, height: raster.height, pixels: raster.pixels, rasterBounds: raster.rasterBounds, paths: [], pathsData: [] };
        const metaBefore = layer.layerData.balloon;
        const metaAfter = this._meta();
        const layerId = layer.layerData.id;
        const apply = (useAfter) => {
            this.layerSystem.restoreLayerRasterSnapshot(useAfter ? after : before);
            layer.layerData.balloon = useAfter ? metaAfter : metaBefore;
            this.eventBus?.emit('layer:content-changed', { layerId, source: 'balloon-update' });
        };
        apply(true);
        this.history.record({
            name: 'balloon-update',
            do: () => apply(true),
            undo: () => apply(false),
            byteSize: (before.pixels?.byteLength || 0) + (after.pixels?.byteLength || 0),
            meta: { type: 'balloon-update', layerId }
        });
        showFeedbackToast('吹き出しを更新しました');
        return { ok: true, layerId };
    }

    loadFromActiveLayer() {
        const data = this._activeBalloon();
        if (!data) {
            showFeedbackToast('選択中のレイヤーに吹き出しの情報がありません');
            return { ok: false };
        }
        this.editing = { layerId: this.layerSystem.getActiveLayer().layerData.id };
        this._warnedMissingFont = false;
        this._setParams(data.params);
        showFeedbackToast('吹き出しを読み込みました。編集して「更新」できます');
        return { ok: true };
    }

    // ------------------------------------------------------------ popup protocol

    show() {
        const wasVisible = this.isVisible === true;
        if (!this.popup) this._ensurePopupElement();
        if (!this.popup) return;
        this.popup.classList.add('show');
        this.isVisible = true;
        mountMangaTabs(this.popup.querySelector('[data-role="manga-tabs"]'), 'balloon');
        noteMangaTabShown('balloon');
        this._renderFontOptions();
        this._syncControls();
        this._redraw();
        this._refreshLettering();
        this._syncOverlayVisibility();
        if (!wasVisible) this.eventBus.emit('popup:shown', { name: 'balloon' });
    }

    hide() {
        if (!this.popup) return;
        const wasVisible = this.isVisible === true;
        this.popup.classList.remove('show');
        this.isVisible = false;
        this.endDrag();
        this._syncOverlayVisibility();
        if (wasVisible) this.eventBus.emit('popup:hidden', { name: 'balloon' });
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    isReady() {
        return !!this.popup;
    }

    destroy() {
        this.endDrag();
        clearTimeout(this._letteringTimer);
        this.popupDragCleanup?.();
        this.popupDragCleanup = null;
        this._fieldDetachers?.forEach(off => off());
        this._offFonts?.();
        this.eventBus?.off?.('layer:activated', this._layerListener);
        this.overlay.destroy();
    }
}

window.BalloonPopup = BalloonPopup;
