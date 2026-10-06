/**
 * ============================================================================
 * ファイル名: ui/balloon-popup.js
 * 責務: 吹き出し(漫画ツールのタブ)。形・しっぽ・縦書き/横書きの文字・フォント(端末/選定catalog/取り込み+フォルダ管理)を編集し、
 *       確定で通常Raster Layerを1件のHistoryで追加/更新する。
 * 依存: system/balloon-geometry.js, system/balloon-text-layout.js, system/balloon-raster.js,
 *   system/lettering-paragraph.js, system/font-library.js, system/balloon-gestures.js,
 *   system/history.js, system/event-bus.js, ui/balloon-overlay.js, ui/manga-tabs.js, ui/numeric-field.js,
 *   ui/manga-canvas-navigation.js, ui/manga-input-focus.js, ui/popup-drag-helper.js, ui/feedback-toast.js, ui/manga-edit-actions.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: BalloonPopup
 * イベント発火: popup:shown, popup:hidden, layer:content-changed
 * 保存: 編集中のparamsはlocalStorage(UI設定)。選定フォントのfavorite/Primary/短評/見本もlocalStorage(UI設定)。
 *   確定Layerは通常Raster Layerで、再編集用に layerData.balloon (optional・sanitize済み)を持つ。
 *   取り込みフォントの実体はIndexedDB(font-library)で、Projectには入れない。
 * 見た目: 部品のclassはコマ割りpopupと共通(styles/components/panel-layout-popup.css)。
 * 編集: WP030 輪郭点/二連・独立本文領域・複数しっぽ。geometry/paragraph/PNGはsystemへ委譲。
 * 操作: Ctrl本体drag/wheelは全体移動/拡縮。手動font size/線幅は保持、Space/global Vへ譲る。
 * 検証: build/wp030-balloon-editor-browser.html、wp030-balloon-text-browser.html、wp030-manga-gestures-browser.html、wp030-manga-input-browser.html。
 * 実装状態: ✅実装（WP-021/030）
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { cafMangaTarget, appendMangaRaster, restoreMangaTargetControls, syncMangaTargetControls } from './caf-manga-target.js';
import { historyManager } from '../system/history.js';
import {
    BALLOON_LIMITS,
    BALLOON_SHAPES,
    BALLOON_TAIL_STYLES,
    balloonHandles,
    createBalloonContour,
    insertBalloonContourPoint,
    removeBalloonContourPoint,
    moveBalloonContourPoint,
    secondaryBalloonRect,
    defaultBalloonParams,
    normalizeBalloonParams,
    sanitizeBalloonData
} from '../system/balloon-geometry.js';
import { letteringPlacement, paintBalloon, rasterizeBalloon } from '../system/balloon-raster.js';
import { measureParagraph, rasterizeParagraph } from '../system/lettering-paragraph.js';
import { balloonTextFrame, balloonTextFrameHandles, setBalloonTextFrame, resetBalloonTextFrames, assessBalloonTextBounds } from '../system/balloon-text-layout.js';
import { FONT_FILE_ACCEPT, FONT_SAMPLE_OPTIONS, fontLibrary, sortBundledFonts } from '../system/font-library.js';
import { BalloonOverlay } from './balloon-overlay.js';
import { FontComparison } from './font-comparison.js';
import { FontTree } from './font-tree.js';
import { mountMangaTabs, noteMangaTabShown } from './manga-tabs.js';
import { mountMangaEditActions } from './manga-edit-actions.js';
import { ghostMangaPreviewSource, restoreLetteringPreviewSource } from '../system/lettering-preview-display.js';
import { MangaPanelTarget } from './manga-panel-target.js';
import { isMangaInputPrimary } from './manga-input-focus.js';
import { transformBalloon } from '../system/balloon-gestures.js';
import { attachNumericField } from './numeric-field.js';
import { attachMangaCanvasNavigation } from './manga-canvas-navigation.js';
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
const FONT_PREVIEW_DELAY_MS = 120;
const FONT_PREVIEW_COALESCE_MS = 32;

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
        this.context = 'body';
        this.selectedPoint = 0;
        this.editorGrid = false;
        this.editorSnap = false;
        this.editorGridSize = 16;
        this.fontDetailsOpen = true;
        this.previewOpen = false;
        this.editing = null; // { layerId }
        this.draftActive = true;
        this.previewSource = null;
        this.drag = null;
        this.lettering = null; // { width, height, pixels, request }
        this.textImage = null; // overlay用 { url, x, y, width, height }
        this._letteringToken = 0;
        this._letteringTimer = null;
        this._fontData = { folders: [], fonts: [], bundled: [], organization: { folders: [], placements: {}, orders: {}, favoriteFirst: false } };
        this._fontPreviewToken = 0;
        this._fontPreviewTimer = null;
        this._fontPreviewRenderedId = '';
        this._fontPreviewRenderedSampleId = '';
        this._fontLicenseToken = 0;
        this._fontRefreshToken = 0;
        this._fontCommentDraft = null;
        this._externalStatus = { connected: false, supported: false, name: '', permission: 'prompt' };
        this.fontTree = null;
        this.fontComparison = null;
        this._hasStoredParams = false;
        this._paramsTouched = false;
        this._primaryApplied = false;
        this.scale = 1;

        this.overlay = new BalloonOverlay({
            eventBus: this.eventBus,
            onPointerDown: (target, event) => this._beginDrag(target, event, (e) => this.overlay.clientToCanvas(e.clientX, e.clientY)),
            getState: () => this.isVisible ? { params: this.params, canvas: this._canvasSize(), textImage: this.textImage, draftActive: this.draftActive, editor: { context: this.context, selectedPoint: this.selectedPoint, textIndex: this.textIndex || 0, tailIndex: this.tailIndex || 0, grid: this.editorGrid, gridSize: this.editorGridSize } } : null
        });
        this._layerListener = () => this._syncControls();
        this.eventBus?.on?.('layer:activated', this._layerListener);
        this._sourceChanged = payload => {
            if (payload?.layerId === this.previewSource?.layerData?.id && !String(payload.source || '').startsWith('balloon')) {
                this._endPreview(); this.draftActive = false;
            }
        };
        this._sourceHistory = payload => { if (['undo', 'redo', 'clear'].includes(payload?.action)) { this._endPreview(); this.draftActive = false; } };
        this.eventBus?.on?.('layer:content-changed', this._sourceChanged);
        this.eventBus?.on?.('history:changed', this._sourceHistory);
        this._offFonts = this.fonts.onChange(() => this._refreshFontData());

        this._restore();
        this._ensurePopupElement();
        this._onViewportResize = () => { if (this.isVisible) this._fitViewport(); };
        window.addEventListener('resize', this._onViewportResize);
        this._spacePressed = false;
        this._navigation = attachMangaCanvasNavigation({
            isVisible: () => this.isVisible, getSvg: () => this.overlay.svg,
            onSpace: space => { this._spacePressed = space; this.endDrag(); },
            onObjectWheel: event => this._onObjectWheel(event)
        });
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
            // Canvas is the primary editor; legacy OFF must not hide its handles.
            this.previewOpen = typeof data?.previewOpen === 'boolean' ? data.previewOpen : false;
            if (typeof data?.fontDetailsOpen === 'boolean') this.fontDetailsOpen = data.fontDetailsOpen;
        } catch (error) {
            // 壊れた設定は既定へ戻す(Projectには無関係)
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: this.params, showOverlay: this.showOverlay, fontDetailsOpen: this.fontDetailsOpen, previewOpen: this.previewOpen }));
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
            interactiveSelector: 'button, input, select, textarea, a, canvas, summary, .pl-value, .pl-font-tree, .pl-font-comparison, .popup-close-btn, .ui-close-button',
            onDragEnd: () => this.fontComparison?.reposition?.()
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
            <div class="bl-text-targets" data-role="text-targets" hidden><span>本文</span><button type="button" class="pl-chip" data-text-index="0">①</button><button type="button" class="pl-chip" data-text-index="1">②</button><span class="pl-hint">書式は共通</span></div>
            <textarea class="pl-textarea" data-role="content" rows="2" placeholder="セリフ（改行で行を分けます）" aria-label="セリフ"></textarea>
            <textarea class="pl-textarea" data-role="content-secondary" rows="2" placeholder="二つ目のセリフ" aria-label="二つ目のセリフ" hidden></textarea>
            <div class="bl-common-fonts" data-role="common-fonts"></div>
            <div class="bl-context-tabs" role="tablist" aria-label="吹き出し編集">
                <button type="button" class="pl-chip" role="tab" data-context="body">本体</button>
                <button type="button" class="pl-chip" role="tab" data-context="tail">しっぽ</button>
                <button type="button" class="pl-chip" role="tab" data-context="text">文字</button>
            </div>
            <div class="bl-body-scroll ui-scrollbar">
            <section data-context-pane="body" role="tabpanel" aria-label="本体の設定">
            <div class="pl-presets" role="group" aria-label="形">${shapes}</div>
            <div data-role="contour-controls" hidden>
                <div class="pl-actions"><button type="button" class="pl-btn" data-action="point-add">点を追加</button><button type="button" class="pl-btn" data-action="point-remove">削除</button><button type="button" class="pl-btn" data-action="point-reset">輪郭を戻す</button></div>
                <div class="pl-hint" data-role="point-status"></div>
            </div>
            <div class="pl-hint" data-role="double-hint" hidden>二つ目の中心で配置、四隅でサイズ。重なりを保って動かせます。</div>
            <div class="bl-grid-row"><label><input type="checkbox" data-role="editor-grid"> grid</label><input type="number" data-role="editor-grid-size" value="16" min="4" max="128" step="4" aria-label="グリッド間隔"><span>px</span><label><input type="checkbox" data-role="editor-snap"> 吸着</label></div>
            ${rows(f => !f.tail && !f.text)}
            <div class="pl-actions" role="group" aria-label="形の乱数"><button type="button" class="pl-btn" data-action="reseed" data-role="reseed" title="ギザギザの配り方を引き直す">とげを引き直す</button></div>
            <div class="pl-row"><span class="pl-label">線 / 塗り</span><input type="color" class="pl-color" data-color="lineColor" title="線の色"><input type="color" class="pl-color" data-color="fillColor" title="塗りの色"></div>
            <details class="pl-details" data-role="preview-details">
                <summary>吹き出しプレビュー</summary>
                <div class="pl-fm">
                    <canvas class="pl-preview" width="${PREVIEW_MAX.width}" height="${PREVIEW_MAX.height}" aria-label="吹き出しプレビュー"></canvas>
                    <div class="pl-hint">中心=移動 / 四隅=大きさ / 先端=しっぽの向き。キャンバス上でも同じ操作</div>
                </div>
            </details>
            </section>
            <section data-context-pane="tail" role="tabpanel" aria-label="しっぽの設定" hidden>
            <div class="bl-tail-targets"><div class="pl-chips" data-role="tail-targets"></div><button type="button" class="pl-btn pl-btn--small" data-action="tail-add" title="しっぽを追加（最大4本）">＋</button><button type="button" class="pl-btn pl-btn--small" data-action="tail-remove" title="選択しっぽを削除。最初のしっぽはOFFで隠す">削除</button></div>
            <div class="pl-row">
                <span class="pl-label">しっぽ</span>
                <span class="pl-chips">
                    <button type="button" class="pl-chip" data-role="tail-enabled" aria-pressed="true" title="選択中のしっぽを表示">あり</button>
                    <button type="button" class="pl-chip" data-role="tail-disabled" aria-pressed="false" title="選択中のしっぽを隠す">なし</button>
                    ${tails}
                </span>
            </div>
            ${rows(f => f.tail)}
            <p class="pl-hint">キャンバスの橙色の先端を動かして、しっぽの向きを調整。</p>
            </section>
            <section data-context-pane="text" role="tabpanel" aria-label="文字の設定" hidden>
            <div class="pl-actions"><button type="button" class="pl-btn" data-action="text-fit" title="本文領域を本体内に配置し直す">領域を収め直す</button></div>
            <div class="pl-hint">本文の枠をドラッグで移動、四隅で折り返し領域を調整</div>
            <div class="bl-text-warning" data-role="text-warning" role="status" aria-live="polite"></div>
            <div class="pl-row">
                <span class="pl-label">書き方</span>
                <span class="pl-chips">
                    <button type="button" class="pl-chip pl-chip--wide" data-vertical="true">縦書き</button>
                    <button type="button" class="pl-chip pl-chip--wide" data-vertical="false">横書き</button>
                    <button type="button" class="pl-chip" data-role="bold" aria-pressed="false" title="太字">B</button>
                </span>
            </div>
            <div class="pl-row pl-font-picker-row">
                <span class="pl-label">フォント</span>
                <div class="pl-font-picker" data-role="font-picker">
                    <select class="pl-select pl-font-select-native" data-role="font-select" aria-label="フォント" tabindex="-1" aria-hidden="true"></select>
                    <button type="button" class="pl-select pl-font-trigger" data-role="font-trigger" aria-haspopup="tree" aria-expanded="false" aria-controls="balloon-font-tree">フォントを選ぶ</button>
                    <div class="pl-font-tree" id="balloon-font-tree" data-role="font-tree" hidden></div>
                </div>
                <button type="button" class="pl-btn pl-btn--small pl-font-compare-toggle" data-role="font-comparison-toggle" title="書体の比較・情報・整理を開く" aria-label="書体の比較・情報・整理を開く" aria-expanded="false" aria-controls="balloon-font-comparison">書体</button>
            </div>
            <section class="pl-font-comparison" id="balloon-font-comparison" data-role="font-comparison" hidden></section>
            <div class="pl-row pl-external" hidden>
                <button type="button" class="pl-btn" data-action="external-connect">外部フォルダを接続</button>
                <span class="pl-external-status" data-role="external-status" aria-live="polite"></span>
            </div>
            <details class="pl-details pl-font-card" data-role="font-card" hidden>
                <summary>フォント情報・整理</summary>
                <div class="pl-fm">
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
                <div class="pl-row pl-font-placement">
                    <span class="pl-label">収納先</span>
                    <select class="pl-select" data-role="font-storage" aria-label="表示分類の収納先"></select>
                    <button type="button" class="pl-btn pl-btn--small pl-btn--icon" data-action="font-order-up" title="同じ階層で上へ" aria-label="同じ階層で上へ">↑</button>
                    <button type="button" class="pl-btn pl-btn--small pl-btn--icon" data-action="font-order-down" title="同じ階層で下へ" aria-label="同じ階層で下へ">↓</button>
                </div>
                <label class="pl-row pl-check pl-font-favorite-first">
                    <input type="checkbox" data-role="font-favorite-first">
                    <span>お気に入りを上へ（表示だけ）</span>
                </label>
                <label class="pl-row pl-font-card__user-comment">
                    <span class="pl-label">自分用メモ</span>
                    <input type="text" class="pl-text" data-role="font-comment" maxlength="160" placeholder="短いメモ（任意）" aria-label="フォントの自分用メモ">
                </label>
                <button type="button" class="pl-btn pl-font-primary" data-action="font-primary">Primaryにする</button>
                <div class="pl-font-links" data-role="font-links"></div>
                <details class="pl-font-license" data-role="font-license" hidden>
                    <summary>作者資料・ライセンスを表示</summary>
                    <pre data-role="font-license-text"></pre>
                </details>
                </div>
            </details>
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

            <details class="pl-details" data-role="font-manager" open>
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
            <details class="pl-details" data-role="font-organization" open>
                <summary>表示分類の編集</summary>
                <div class="pl-fm">
                    <div class="pl-hint pl-hint--left">表示分類はアプリ内だけの整理です。フォントの元ファイルは移動しません。</div>
                    <div class="pl-row">
                        <input type="text" class="pl-text" data-role="organization-folder-name" placeholder="分類名" maxlength="40" aria-label="表示分類名">
                    </div>
                    <div class="pl-actions" role="group" aria-label="表示分類操作">
                        <button type="button" class="pl-btn" data-action="organization-folder-add">分類を新規作成</button>
                        <button type="button" class="pl-btn" data-action="organization-folder-rename">名前変更</button>
                        <button type="button" class="pl-btn" data-action="organization-folder-delete">削除</button>
                    </div>
                </div>
            </details>

            </section>
            </div>
            <div class="bl-fixed-footer">
            <div class="pl-hint bl-canvas-shortcuts" title="Ctrl操作は吹き出し全体。文字サイズ・線幅は保持します。">Ctrl+drag: 移動 / Ctrl+wheel: 拡縮 / Space: Canvas</div>
            <div class="pl-footer">
                <button type="button" class="pl-btn" data-action="reset">リセット</button>
                <button type="button" class="pl-btn" data-action="load-active" title="選択中の吹き出しLayerから読み込んで再編集">レイヤーから再編集</button>
            </div>
            <div class="pl-footer">
                <button type="button" class="pl-btn pl-btn--primary" data-action="update" data-role="update-btn" title="再編集中のLayerを置き換え（Undo 1回で戻る）" hidden>既存の吹き出しを更新</button>
                <button type="button" class="pl-btn pl-btn--primary" data-action="apply" title="新規Layerとして追加（Undo 1回で戻る）">新規レイヤーに適用</button>
            </div>
            </div>
        `;
        mountMangaEditActions(this.popup, { before: this.popup.querySelector('.pl-title') });
        this.panelTarget = new MangaPanelTarget({ root: this.popup, layerSystem: this.layerSystem, history: this.history });
        const q = (sel) => this.popup.querySelector(sel);
        this.elements = {
            canvas: q('.pl-preview'),
            previewDetails: q('[data-role="preview-details"]'),
            editStatus: q('[data-role="edit-status"]'),
            updateBtn: q('[data-role="update-btn"]'),
            loadBtn: q('[data-action="load-active"]'),
            tailEnabled: q('[data-role="tail-enabled"]'),
            tailDisabled: q('[data-role="tail-disabled"]'),
            content: q('[data-role="content"]'),
            fontSelect: q('[data-role="font-select"]'),
            fontTrigger: q('[data-role="font-trigger"]'),
            fontTree: q('[data-role="font-tree"]'),
            fontComparisonToggle: q('[data-role="font-comparison-toggle"]'),
            fontComparison: q('[data-role="font-comparison"]'),
            fontCard: q('[data-role="font-card"]'),
            fontTitle: q('[data-role="font-title"]'),
            fontCategory: q('[data-role="font-category"]'),
            fontCatalogComment: q('[data-role="font-catalog-comment"]'),
            fontMeta: q('[data-role="font-meta"]'),
            fontSample: q('[data-role="font-sample"]'),
            fontLoadStatus: q('[data-role="font-load-status"]'),
            fontSamplePreview: q('[data-role="font-sample-preview"]'),
            fontFavorite: q('[data-role="font-favorite"]'),
            fontStorage: q('[data-role="font-storage"]'),
            fontFavoriteFirst: q('[data-role="font-favorite-first"]'),
            fontComment: q('[data-role="font-comment"]'),
            fontPrimary: q('[data-action="font-primary"]'),
            fontLinks: q('[data-role="font-links"]'),
            fontLicense: q('[data-role="font-license"]'),
            fontLicenseText: q('[data-role="font-license-text"]'),
            autoFit: q('[data-role="auto-fit"]'),
            bold: q('[data-role="bold"]'),
            reseed: q('[data-role="reseed"]'),
            folderSelect: q('[data-role="folder-select"]'),
            folderName: q('[data-role="folder-name"]'),
            fontList: q('[data-role="font-list"]'),
            organizationFolderName: q('[data-role="organization-folder-name"]'),
            externalStatus: q('[data-role="external-status"]')
        };
        this.elements.fontCard.open = this.fontDetailsOpen;
        this.elements.previewDetails.open = this.previewOpen;
        this.fontTree = new FontTree({
            container: this.elements.fontTree,
            getLoadedFont: (id) => this._getLoadedFont(id),
            onSelect: (node, options) => this._onTreeFontSelected(node, options),
            onEscape: () => this._closeFontTree(),
            onMove: (placement) => this._moveOrganizationNode(placement)
        });
        this.fontComparison = new FontComparison({
            container: this.elements.fontComparison,
            getLoadedFont: (id) => this.fonts.getLoadedFont?.(id) || null,
            warmFonts: (ids, options) => this.fonts.warmFonts?.(ids, options),
            onCommit: (row) => this._onComparisonFontCommitted(row),
            onMove: (placement) => this._moveOrganizationNode(placement),
            onClose: () => {
                this.elements.fontComparisonToggle?.setAttribute('aria-expanded', 'false');
                this.elements.fontComparisonToggle?.setAttribute('aria-label', '書体の比較・情報・整理を開く');
                this.elements.fontComparisonToggle?.setAttribute('title', '書体の比較・情報・整理を開く');
                this.elements.fontComparisonToggle?.focus?.();
            }
        });
        this.fontComparison.attachInformation(this.elements.fontCard);
        this._bind();
        // Keep the original bound picker/numeric controls available in every context.
        const commonFonts = this.popup.querySelector('[data-role="common-fonts"]');
        commonFonts.append(this.elements.fontTrigger.closest('.pl-font-picker-row'), this.popup.querySelector('[data-row="fontSize"]'));
        // Move bound nodes, preserving their direct handlers and existing storage APIs.
        for (const role of ['font-manager', 'font-organization']) {
            this.fontComparison.refs.informationHost.append(this.popup.querySelector(`[data-role="${role}"]`));
        }
        this._renderFontOptions();
        this._renderFontManager();
        this._renderFontTree();
        this._syncControls();
        this._redraw();
    }

    // ------------------------------------------------------------ 操作

    _bind() {
        const root = this.popup;
        root.querySelectorAll('[data-context]').forEach(button => button.addEventListener('click', () => {
            this.context = button.dataset.context;
            this._syncControls(); this.overlay.schedule();
        }));
        root.querySelectorAll('[data-text-index]').forEach(button => button.addEventListener('click', () => {
            this.textIndex = Number(button.dataset.textIndex); this._syncControls(); this.overlay.schedule();
        }));
        root.querySelector('[data-role="content-secondary"]').addEventListener('input', event => this._setParams({ ...this.params, double: { ...this.params.double, content: event.target.value } }));
        for (const role of ['editor-grid', 'editor-snap', 'editor-grid-size']) root.querySelector(`[data-role="${role}"]`).addEventListener(role === 'editor-grid-size' ? 'input' : 'change', event => {
            if (role === 'editor-grid') this.editorGrid = event.target.checked;
            else if (role === 'editor-snap') this.editorSnap = event.target.checked;
            else this.editorGridSize = Math.max(4, Math.min(128, Number(event.target.value) || 16));
            this.overlay.schedule();
        });
        root.querySelectorAll('[data-shape]').forEach(btn => btn.addEventListener('click', () => {
            this._setParams(resetBalloonTextFrames({ ...this.params, shape: btn.dataset.shape }, this._canvasSize()));
        }));
        root.querySelector('[data-role="tail-targets"]').addEventListener('click', event => {
            const button = event.target.closest('[data-tail-index]');
            if (button) { this.tailIndex = Number(button.dataset.tailIndex); this._syncControls(); this.overlay.schedule(); }
        });
        root.querySelectorAll('[data-tail-style]').forEach(btn => btn.addEventListener('click', () => this._setParams(setPath(this.params, this._tailPath('style'), btn.dataset.tailStyle))));
        this.elements.tailEnabled.addEventListener('click', () => this._setParams(setPath(this.params, this._tailPath('enabled'), true)));
        this.elements.tailDisabled.addEventListener('click', () => this._setParams(setPath(this.params, this._tailPath('enabled'), false)));
        root.querySelectorAll('input[data-field]').forEach(input => input.addEventListener('input', () => {
            const f = FIELDS.find(x => x.key === input.dataset.field);
            let next = setPath(this.params, f.tail ? this._tailPath(f.path[1]) : f.path, Number(input.value));
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
        this.elements.fontTrigger.addEventListener('click', () => this._toggleFontTree());
        this.elements.fontTree.addEventListener('scroll', () => this._warmFontTreeVisible(), { passive: true });
        this.elements.fontTree.addEventListener('click', () => this._warmFontTreeVisible());
        this.elements.fontTrigger.addEventListener('wheel', (e) => this._onFontWheel(e), { passive: false });
        this.elements.fontComparisonToggle.addEventListener('click', () => this._toggleFontComparison());
        this.elements.fontStorage.addEventListener('change', (e) => this._setFontFolder(e.target.value || null));
        this.elements.fontFavoriteFirst.addEventListener('change', (e) => this._setFavoriteFirst(e.target.checked));
        this.elements.fontSample.addEventListener('change', (e) => {
            this.fonts.setSample?.(e.target.value);
            this._renderFontDetails();
        });
        this.elements.fontCard.addEventListener('toggle', (e) => {
            if (e.target !== this.elements.fontCard) return;
            this.fontDetailsOpen = this.elements.fontCard.open;
            this._persist();
        });
        // Native summary activation must not also start Canvas pan/shortcuts.
        [this.elements.fontCard, this.elements.previewDetails].forEach(details => {
            ['keydown', 'keyup'].forEach(type => details.querySelector(':scope > summary')
                .addEventListener(type, e => e.stopPropagation()));
        });
        this.elements.previewDetails.addEventListener('toggle', () => {
            this.previewOpen = this.elements.previewDetails.open;
            this._persist();
            if (this.previewOpen) this._redraw();
        });
        this.elements.fontLicense.addEventListener('toggle', () => {
            if (this.elements.fontLicense.open && this._fontLicensePath) {
                void this._loadExternalLicense(this._fontLicensePath, this._fontLicenseToken);
            }
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
        root.querySelectorAll('[data-action]').forEach(btn => {
            if (btn.dataset.action === 'close-popup') return;
            btn.addEventListener('click', () => this._onAction(btn.dataset.action));
        });
        root.querySelector('[data-role="font-file"]').addEventListener('change', (e) => this._importFonts(e.target));
        ['keydown', 'keyup'].forEach(type => {
            this.elements.folderName.addEventListener(type, e => e.stopPropagation());
            this.elements.fontComment.addEventListener(type, e => e.stopPropagation());
            this.elements.organizationFolderName.addEventListener(type, e => e.stopPropagation());
        });

        this._fieldDetachers = FIELDS.map(f => attachNumericField({
            range: root.querySelector(`input[data-field="${f.key}"]`),
            valueEl: root.querySelector(`[data-value-for="${f.key}"]`),
            toDisplay: f.toDisplay,
            fromDisplay: f.fromDisplay,
            wheelStep: f.wheelStep ?? null
        }));
        this._fieldDetachers.push(attachNumericField({ numberInput: root.querySelector('[data-role="editor-grid-size"]'), wheelStep: 4 }));

        const canvas = this.elements.canvas;
        canvas.addEventListener('pointerdown', (e) => this._onPreviewPointerDown(e));
        canvas.addEventListener('pointermove', (e) => {
            if (this.drag) return;
            canvas.style.cursor = this._hitHandle(this._toCanvasPoint(e)) ? 'move' : 'default';
        });
    }

    _onAction(action) {
        if (action === 'tail-add') {
            if ((this.params.extraTails?.length || 0) >= 3) return;
            const r = this.params.rect, offset = (this.params.extraTails?.length || 0) * .15;
            const tail = { ...this._selectedTail(), enabled: true, tip: { x: r.x + r.w * (1.25 + offset), y: r.y + r.h * (.5 + offset) } };
            this.tailIndex = (this.params.extraTails?.length || 0) + 1;
            this._setParams({ ...this.params, extraTails: [...(this.params.extraTails || []), tail] });
        } else if (action === 'tail-remove') {
            if (!this.tailIndex) return;
            const extras = (this.params.extraTails || []).filter((_, i) => i !== this.tailIndex - 1);
            this.tailIndex = Math.min(this.tailIndex, extras.length);
            this._setParams({ ...this.params, extraTails: extras });
        } else if (action === 'text-fit') {
            this._setParams(resetBalloonTextFrames(this.params, this._canvasSize()));
        } else if (action === 'point-add') {
            this._setParams(insertBalloonContourPoint(this.params, this.selectedPoint + 1, this._canvasSize()));
            this.selectedPoint = Math.min(this.selectedPoint + 1, this.params.contour.length - 1); this._syncControls(); this.overlay.schedule();
        } else if (action === 'point-remove') {
            this._setParams(removeBalloonContourPoint(this.params, this.selectedPoint, this._canvasSize()));
            this.selectedPoint = Math.min(this.selectedPoint, this.params.contour.length - 1); this._syncControls(); this.overlay.schedule();
        } else if (action === 'point-reset') {
            this.selectedPoint = 0; this._setParams({ ...this.params, contour: createBalloonContour() });
        } else if (action === 'reset') {
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
        } else if (action === 'font-order-up') {
            this._moveSelectedFontRelative(-1);
        } else if (action === 'font-order-down') {
            this._moveSelectedFontRelative(1);
        } else if (action === 'organization-folder-add') {
            this._organizationFolderAdd();
        } else if (action === 'organization-folder-rename') {
            this._organizationFolderRename();
        } else if (action === 'organization-folder-delete') {
            this._organizationFolderDelete();
        } else if (action === 'external-connect') {
            this._connectExternalDirectory();
        }
    }

    _setParams(next, options = {}) {
        this.draftActive = true;
        this.params = normalizeBalloonParams(next, this._canvasSize());
        if (!options.fromCatalogPrimary) this._paramsTouched = true;
        this._persist();
        this._syncControls();
        this._redraw();
        if (!options.skipLettering) this._scheduleLettering(options.letteringDelay);
    }

    _activeBalloon() {
        const data = this.layerSystem?.getActiveLayer?.()?.layerData?.balloon;
        return data ? sanitizeBalloonData(data, this._canvasSize()) : null;
    }

    _syncControls() {
        restoreMangaTargetControls(this.popup);
        if (!this.popup || !this.elements.canvas) return;
        const p = this.params;
        this.tailIndex = Math.min(this.tailIndex || 0, p.extraTails?.length || 0);
        const selectedTail = this._selectedTail();
        const tailTargets = this.popup.querySelector('[data-role="tail-targets"]');
        tailTargets.innerHTML = [p.tail, ...(p.extraTails || [])].map((tail, index) => `<button type="button" class="pl-chip${index === this.tailIndex ? ' is-selected' : ''}" data-tail-index="${index}" aria-pressed="${index === this.tailIndex}" title="しっぽ${index + 1}${tail.enabled ? '' : '（OFF）'}">${index + 1}</button>`).join('');
        this.popup.querySelector('[data-action="tail-add"]').disabled = (p.extraTails?.length || 0) >= 3;
        this.popup.querySelector('[data-action="tail-remove"]').disabled = !this.tailIndex;
        this.popup.querySelectorAll('[data-context-pane]').forEach(pane => { pane.hidden = pane.dataset.contextPane !== this.context; });
        this.popup.querySelectorAll('[data-context]').forEach(button => {
            this._press(button, button.dataset.context === this.context);
            button.setAttribute('aria-selected', String(button.dataset.context === this.context));
        });
        this.popup.querySelector('[data-role="contour-controls"]').hidden = p.shape !== 'custom';
        this.popup.querySelector('[data-role="double-hint"]').hidden = p.shape !== 'double';
        const secondaryContent = this.popup.querySelector('[data-role="content-secondary"]');
        this.textIndex = p.shape === 'double' ? this.textIndex || 0 : 0;
        this.popup.querySelector('[data-role="text-targets"]').hidden = p.shape !== 'double';
        this.popup.querySelectorAll('[data-text-index]').forEach(button => this._press(button, Number(button.dataset.textIndex) === this.textIndex));
        this.elements.content.hidden = this.textIndex === 1;
        secondaryContent.hidden = p.shape !== 'double' || this.textIndex !== 1;
        if (document.activeElement !== secondaryContent) secondaryContent.value = p.double?.content || '';
        if (p.shape === 'custom') {
            this.selectedPoint = Math.min(this.selectedPoint, p.contour.length - 1);
            this.popup.querySelector('[data-role="point-status"]').textContent = `選択: ${this.selectedPoint + 1} / ${p.contour.length}点　キャンバスで点を動かす`;
            this.popup.querySelector('[data-action="point-remove"]').disabled = p.contour.length <= 4;
            this.popup.querySelector('[data-action="point-add"]').disabled = p.contour.length >= 24;
        }
        for (const f of FIELDS) {
            const row = this.popup.querySelector(`[data-row="${f.key}"]`);
            if (row) row.hidden = (f.shape && f.shape !== p.shape) || (f.tail && !selectedTail.enabled);
            const raw = getPath(p, f.tail ? this._tailPath(f.path[1]) : f.path);
            const input = this.popup.querySelector(`input[data-field="${f.key}"]`);
            if (input && Number(input.value) !== raw) input.value = String(raw);
            const out = this.popup.querySelector(`[data-value-for="${f.key}"]`);
            if (out && !out.dataset.editing) {
                const firstLettering = Array.isArray(this.lettering) ? this.lettering[this.textIndex || 0] : this.lettering;
                const auto = f.key === 'fontSize' && p.text.autoFit && firstLettering?.request?.fontSize;
                out.textContent = auto ? `自動 ${firstLettering.request.fontSize}px` : `${f.toDisplay ? f.toDisplay(raw) : raw}${f.unit}`;
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
            this._press(btn, btn.dataset.tailStyle === selectedTail.style);
            btn.disabled = !selectedTail.enabled;
        });
        this._press(this.elements.tailEnabled, selectedTail.enabled);
        this._press(this.elements.tailDisabled, !selectedTail.enabled);
        this.popup.querySelectorAll('[data-vertical]').forEach(btn => this._press(btn, (btn.dataset.vertical === 'true') === p.text.vertical));
        this._press(this.elements.bold, p.text.bold);
        this.elements.reseed.hidden = p.shape !== 'burst';
        this.elements.autoFit.checked = p.text.autoFit;
        if (this.elements.content.value !== p.text.content && document.activeElement !== this.elements.content) this.elements.content.value = p.text.content;
        for (const [attr, value] of [['lineColor', p.lineColor], ['fillColor', p.fillColor], ['textColor', p.text.color], ['outlineColor', p.text.outlineColor]]) {
            const input = this.popup.querySelector(`[data-color="${attr}"]`);
            if (input && input.value !== value) input.value = value;
        }
        const fontValue = this._fontOptionValue(p.text);
        if (this.elements.fontSelect.value !== fontValue && [...this.elements.fontSelect.options].some(o => o.value === fontValue)) this.elements.fontSelect.value = fontValue;
        this._syncFontPicker();
        this.fontComparison?.setCommittedKey(this._selectedTreeKey());
        this._renderFontDetails();
        this.elements.editStatus.textContent = this.editing ? '— 再編集中' : '';
        this.elements.updateBtn.hidden = !this.editing;
        this.elements.loadBtn.disabled = !this._activeBalloon();
        syncMangaTargetControls(this.popup, this.layerSystem, 'balloon');
        this.panelTarget?.sync();
    }

    _press(btn, on) {
        btn.setAttribute('aria-pressed', String(on));
        btn.classList.toggle('is-selected', on);
    }

    _tailPath(key) { return this.tailIndex ? ['extraTails', this.tailIndex - 1, key] : ['tail', key]; }
    _selectedTail() { return this.params.extraTails?.[this.tailIndex - 1] || this.params.tail; }

    _syncOverlayVisibility() {
        this.overlay.setVisible(this.isVisible && this.showOverlay);
    }

    // ------------------------------------------------------------ フォント

    _fontRowsForTree() {
        const rows = [];
        const seen = new Set();
        const add = (row) => {
            if (!row || seen.has(row.selectValue)) return;
            seen.add(row.selectValue);
            rows.push(row);
        };
        GENERIC_FONTS.forEach(item => add({
            id: item.value.slice(4),
            key: 'system:' + item.value.slice(4),
            label: item.label,
            selectValue: item.value,
            parentId: null,
            canMove: false,
            system: true
        }));
        this.fonts.listSystemFonts().forEach(family => add({
            id: family,
            key: 'system:' + family,
            label: family,
            selectValue: 'sys:' + family,
            parentId: null,
            canMove: false,
            system: true
        }));
        this._fontData.bundled.forEach(font => add({
            ...font,
            id: font.id,
            key: 'font:' + font.id,
            label: (font.primary ? '★ ' : '') + (font.category ? '［' + font.category + '］' : '') + (font.label || font.id),
            selectValue: BUNDLED_OPTION_PREFIX + font.id
        }));
        this._fontData.fonts.forEach(font => add({
            ...font,
            id: font.id,
            key: 'font:' + font.id,
            label: font.label || font.id,
            selectValue: IMPORTED_OPTION_PREFIX + font.id
        }));
        return rows;
    }

    _selectedTreeKey() {
        const value = this.elements.fontSelect?.value || '';
        if (value.startsWith('sys:')) return 'system:' + value.slice(4);
        if (value.startsWith(BUNDLED_OPTION_PREFIX)) return 'font:' + value.slice(BUNDLED_OPTION_PREFIX.length);
        if (value.startsWith(IMPORTED_OPTION_PREFIX)) return 'font:' + value.slice(IMPORTED_OPTION_PREFIX.length);
        return '';
    }

    _syncFontPicker() {
        const trigger = this.elements.fontTrigger;
        if (!trigger) return;
        const value = this.elements.fontSelect?.value || '';
        const row = this._fontRowsForTree().find(item => item.selectValue === value);
        trigger.textContent = row?.label || value.replace(/^sys:/, '') || 'フォントを選ぶ';
        trigger.title = `${row?.label || trigger.textContent} — ホイールで前後の書体、クリックで分類ツリー`;
        trigger.setAttribute('aria-expanded', String(!this.elements.fontTree.hidden));
        const treeSelection = this.fontTree?.getSelectedKey?.();
        if (!treeSelection?.startsWith('folder:') || !this.fontTree?.getNode?.(treeSelection)) {
            this.fontTree?.setSelected(row?.key || this._selectedTreeKey());
        }
        this._renderOrganizationControls();
    }

    _toggleFontComparison(force = null) {
        const next = force === null ? !this.fontComparison?.isOpen?.() : force === true;
        this.fontComparison?.setOpen(next);
        this.elements.fontComparisonToggle?.setAttribute('aria-expanded', String(next));
        this.elements.fontComparisonToggle?.setAttribute('aria-label', next ? '書体の比較・情報・整理を閉じる' : '書体の比較・情報・整理を開く');
        this.elements.fontComparisonToggle?.setAttribute('title', next ? '書体の比較・情報・整理を閉じる' : '書体の比較・情報・整理を開く');
    }

    _onComparisonFontCommitted(row) {
        if (!row?.selectValue) return;
        this._onFontSelected(row.selectValue);
    }

    _renderFontComparison() {
        this.fontComparison?.setData({
            folders: this._fontData.organization?.folders || [],
            rows: this._fontRowsForTree(),
            placements: this._fontData.organization?.placements || {},
            orders: this._fontData.organization?.orders || {},
            favoriteFirst: this._fontData.organization?.favoriteFirst === true
        });
        this.fontComparison?.setCommittedKey(this._selectedTreeKey());
    }

    _fontIdFromSelectValue(value) {
        const text = String(value || '');
        if (text.startsWith(BUNDLED_OPTION_PREFIX)) return text.slice(BUNDLED_OPTION_PREFIX.length);
        if (text.startsWith(IMPORTED_OPTION_PREFIX)) return text.slice(IMPORTED_OPTION_PREFIX.length);
        return '';
    }

    _warmFontNeighbors(values, currentIndex) {
        if (typeof this.fonts.warmFonts !== 'function') return;
        const ids = values.slice(Math.max(0, currentIndex - 2), currentIndex + 3)
            .map(value => this._fontIdFromSelectValue(value))
            .filter(Boolean);
        if (!ids.length) return;
        try {
            void this.fonts.warmFonts([...new Set(ids)], { concurrency: 2, shouldContinue: () => true });
        } catch (error) {
            // warmは応答改善の補助で、選択操作を止めない。
        }
    }

    _toggleFontTree(force = null) {
        const tree = this.elements.fontTree;
        if (!tree) return;
        const open = force === null ? tree.hidden : force === true;
        tree.hidden = !open;
        this.elements.fontTrigger.setAttribute('aria-expanded', String(open));
        if (open) {
            this.fontTree?.setSelected(this._selectedTreeKey(), { focus: true });
            this._warmFontTreeVisible();
        } else {
            this._fontTreeWarmToken = (this._fontTreeWarmToken || 0) + 1;
            clearTimeout(this._fontTreeWarmTimer);
            this.elements.fontTrigger.focus();
        }
    }

    _warmFontTreeVisible() {
        clearTimeout(this._fontTreeWarmTimer);
        const token = this._fontTreeWarmToken = (this._fontTreeWarmToken || 0) + 1;
        if (this.elements.fontTree.hidden) return;
        this.fontTree?.updateFontPreviews();
        this._fontTreeWarmTimer = setTimeout(() => {
            const tree = this.elements.fontTree;
            if (tree.hidden || token !== this._fontTreeWarmToken || !this.fonts.warmFonts) return;
            const bounds = tree.getBoundingClientRect();
            const ids = [...tree.querySelectorAll('[data-node-type="font"]')].filter(row => {
                const rect = row.getBoundingClientRect();
                return rect.bottom > bounds.top && rect.top < bounds.bottom;
            }).map(row => this.fontTree.getNode(row.dataset.nodeKey)).filter(row => row && !row.system).map(row => row.id).slice(0, 8);
            void this.fonts.warmFonts(ids, { shouldContinue: () => !tree.hidden && token === this._fontTreeWarmToken })
                .then(() => { if (!tree.hidden && token === this._fontTreeWarmToken) this.fontTree.updateFontPreviews(); }).catch(() => {});
        }, 32);
    }

    _closeFontTree() {
        this._toggleFontTree(false);
    }

    _onFontWheel(event) {
        if (event.ctrlKey || !this.elements.fontTree.hidden) return;
        const delta = Number(event.deltaY);
        if (!Number.isFinite(delta) || delta === 0) return;
        const magnitude = Math.abs(delta);
        let steps = 0;
        if (magnitude >= 40) {
            this._fontWheelRemainder = 0;
            steps = 1;
        } else {
            this._fontWheelRemainder = (this._fontWheelRemainder || 0) + delta;
            if (Math.abs(this._fontWheelRemainder) >= 40) {
                steps = 1;
                this._fontWheelRemainder = 0;
            }
        }
        if (!steps) {
            event.preventDefault();
            return;
        }
        const rows = this.fontTree?.getOrderedFontNodes?.() || [];
        const values = rows.map(row => row.selectValue).filter(Boolean);
        const current = values.indexOf(this.elements.fontSelect.value);
        if (current < 0) return;
        this._warmFontNeighbors(values, current);
        const next = current + (delta > 0 ? steps : -steps);
        if (next < 0 || next >= values.length) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        this._onFontSelected(values[next], { letteringDelay: 240 });
    }

    _onTreeFontSelected(node, { previewOnly = false } = {}) {
        if (!node?.selectValue || previewOnly) return;
        this._onFontSelected(node.selectValue);
        this._closeFontTree();
    }

    _renderFontTree() {
        if (!this.fontTree) return;
        const org = this._fontData.organization || {};
        this.fontTree.setModel({
            folders: Array.isArray(org.folders) ? org.folders : [],
            fonts: this._fontRowsForTree().map(row => ({
                ...row,
                favorite: row.system ? false : row.favorite === true
            })),
            placements: org.placements || {},
            orders: org.orders || {},
            favoriteFirst: org.favoriteFirst === true
        });
        this._syncFontPicker();
    }

    _renderOrganizationControls() {
        const select = this.elements.fontStorage;
        if (!select) return;
        const id = this._selectedFontId();
        const org = this._fontData.organization || {};
        const current = Object.prototype.hasOwnProperty.call(org.placements || {}, id) ? org.placements[id] : null;
        const folders = Array.isArray(org.folders) ? org.folders : [];
        const options = ['<option value="">直下（ルート）</option>'];
        folders.forEach(folder => {
            options.push('<option value="' + this._escapeAttr(folder.id) + '">' + this._escapeText(folder.label || folder.name || folder.id) + '</option>');
        });
        select.innerHTML = options.join('');
        if (folders.some(folder => folder.id === current)) select.value = current;
        else select.value = '';
        this.elements.fontFavoriteFirst.checked = org.favoriteFirst === true;
    }

    _escapeText(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _escapeAttr(value) {
        return this._escapeText(value).replace(/'/g, '&#39;');
    }

    async _refreshExternalStatus() {
        if (typeof this.fonts.getExternalStatus !== 'function') {
            this._externalStatus = { connected: false, supported: false, name: '', permission: 'unsupported' };
        } else {
            try {
                const status = await this.fonts.getExternalStatus();
                if (status && typeof status === 'object') this._externalStatus = status;
            } catch (error) {
                this._externalStatus = { connected: false, supported: true, name: '', permission: 'error' };
            }
        }
        const status = this._externalStatus || {};
        if (this.elements.externalStatus) {
            if (status.automatic) this.elements.externalStatus.textContent = status.connected ? 'ローカルフォントを自動参照中' : 'ローカルフォントの保管先を確認してください';
            else if (!status.supported) this.elements.externalStatus.textContent = 'このブラウザでは外部フォルダを使えません。取り込みを利用してください';
            else if (!status.connected) this.elements.externalStatus.textContent = '未接続。E:\\Data\\TegakiFonts を選ぶと元ファイルを読みます';
            else if (status.permission && status.permission !== 'granted') this.elements.externalStatus.textContent = (status.name || '外部フォルダ') + '（権限を確認してください）';
            else this.elements.externalStatus.textContent = (status.name || '外部フォルダ') + 'に接続中';
        }
    }

    async _connectExternalDirectory() {
        if (typeof this.fonts.connectExternalDirectory !== 'function') {
            showFeedbackToast('外部フォルダ接続に対応していません');
            return;
        }
        try {
            const result = await this.fonts.connectExternalDirectory();
            if (result?.ok === false) showFeedbackToast(result.reason || '外部フォルダを接続できませんでした');
            await this._refreshExternalStatus();
            await this._refreshFontData();
        } catch (error) {
            showFeedbackToast('外部フォルダを接続できませんでした');
        }
    }

    async _setFontFolder(folderId) {
        const id = this._selectedFontId();
        if (!id || typeof this.fonts.setFontFolder !== 'function') return;
        try {
            await this.fonts.setFontFolder(id, folderId || null);
            await this._refreshFontData();
        } catch (error) {
            showFeedbackToast('表示分類を変更できませんでした');
        }
    }

    async _setFavoriteFirst(value) {
        if (typeof this.fonts.setFavoriteFirst !== 'function') return;
        try {
            await this.fonts.setFavoriteFirst(value === true);
            await this._refreshFontData();
        } catch (error) {
            showFeedbackToast('お気に入り表示を変更できませんでした');
        }
    }

    async _moveOrganizationNode(placement) {
        if (!placement || typeof this.fonts.moveOrganizationNode !== 'function') return;
        try {
            await this.fonts.moveOrganizationNode(placement.nodeKey, placement.parentId || null, placement.beforeKey || null);
            await this._refreshFontData();
        } catch (error) {
            showFeedbackToast('表示分類の順序を変更できませんでした');
        }
    }

    _moveSelectedFontRelative(direction) {
        const key = this.fontTree?.getSelectedKey?.() || this._selectedTreeKey();
        const placement = this.fontTree?.moveRelative?.(key, direction);
        if (placement) void this._moveOrganizationNode(placement);
    }

    _selectedOrganizationFolderId() {
        const key = this.fontTree?.getSelectedKey?.() || '';
        if (key.startsWith('folder:')) return key.slice('folder:'.length);
        const id = this._selectedFontId();
        return this._fontData.organization?.placements?.[id] || null;
    }

    async _organizationFolderAdd() {
        const label = this.elements.organizationFolderName.value.trim();
        if (!label || typeof this.fonts.createOrganizationFolder !== 'function') return;
        const parentId = this._selectedOrganizationFolderId();
        try {
            await this.fonts.createOrganizationFolder(label, parentId || null);
            this.elements.organizationFolderName.value = '';
            await this._refreshFontData();
        } catch (error) {
            showFeedbackToast('表示分類を作成できませんでした');
        }
    }

    async _organizationFolderRename() {
        const id = this._selectedOrganizationFolderId();
        const label = this.elements.organizationFolderName.value.trim();
        if (!id || !label || typeof this.fonts.renameOrganizationFolder !== 'function') return;
        try {
            await this.fonts.renameOrganizationFolder(id, label);
            this.elements.organizationFolderName.value = '';
            await this._refreshFontData();
        } catch (error) {
            showFeedbackToast('表示分類の名前を変更できませんでした');
        }
    }

    async _organizationFolderDelete() {
        const id = this._selectedOrganizationFolderId();
        if (!id || typeof this.fonts.deleteOrganizationFolder !== 'function') return;
        try {
            await this.fonts.deleteOrganizationFolder(id);
            await this._refreshFontData();
        } catch (error) {
            showFeedbackToast('表示分類を削除できませんでした');
        }
    }

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
        clearTimeout(this._fontPreviewTimer);
        this._fontPreviewTimer = null;
        this._fontLicenseToken = token;
        const id = this._selectedFontId();
        const bundled = this._selectedBundledFont();
        const imported = this._fontData.fonts.find(font => font.id === id) || null;
        const selected = bundled || imported;
        this.fontComparison?.setTargetLabel(selected?.label || '');
        card.hidden = !selected;
        if (!selected) {
            this.elements.fontLicense.hidden = true;
            this.elements.fontLicenseText.textContent = '';
            return;
        }
        const preferences = this.fonts.getPreferences?.() || {};
        const sampleId = preferences.sampleId || FONT_SAMPLE_OPTIONS[0].id;
        const sample = FONT_SAMPLE_OPTIONS.find(item => item.id === sampleId) || FONT_SAMPLE_OPTIONS[0];
        this.elements.fontTitle.textContent = selected.label || id;
        this.elements.fontCategory.textContent = bundled?.category || '取り込みフォント';
        this.elements.fontCatalogComment.textContent = bundled?.comment || (imported ? 'このブラウザに取り込んだフォントです。' : '');
        this.elements.fontMeta.textContent = bundled
            ? [
                bundled.coverage && '対応: ' + bundled.coverage,
                Array.isArray(bundled.tags) && bundled.tags.length ? '用途: ' + bundled.tags.slice(0, 4).join(' / ') : '',
                bundled.dakuten !== '' && bundled.dakuten !== undefined
                    ? '濁点: ' + (typeof bundled.dakuten === 'boolean' ? (bundled.dakuten ? '説明あり' : '未確認') : bundled.dakuten)
                    : ''
            ].filter(Boolean).join('　')
            : '実体はIndexedDBに保存され、Projectには入りません。';
        this.elements.fontSample.innerHTML = FONT_SAMPLE_OPTIONS.map(item => `<option value="${item.id}">${item.label}</option>`).join('');
        this.elements.fontSample.value = sample.id;
        this.elements.fontFavorite.checked = preferences.favorites?.includes(id) === true;
        if (this._fontCommentDraft?.id !== id) this._fontCommentDraft = null;
        if (this._fontCommentDraft?.dirty) this.elements.fontComment.value = this._fontCommentDraft.value;
        else this.elements.fontComment.value = preferences.comments?.[id] || '';
        this.elements.fontPrimary.hidden = !bundled;
        this.elements.fontPrimary.textContent = preferences.primaryId === id ? 'Primaryを解除' : 'Primaryにする';
        const licenseFile = bundled && !bundled.external ? this.fonts.getBundledAssetUrl?.(bundled, 'licenseFile') : '';
        this.elements.fontLinks.innerHTML = bundled
            ? [
                bundled.sourceUrl && this._safeLink(bundled.author ? '作者・公式: ' + bundled.author : '作者・公式', bundled.sourceUrl),
                bundled.licenseUrl && this._safeLink('ライセンス', bundled.licenseUrl),
                licenseFile && this._safeLink('同梱LICENSE', licenseFile)
            ].filter(Boolean).join('　')
            : '';
        this._fontLicensePath = '';
        this.elements.fontLicense.hidden = true;
        this.elements.fontLicenseText.textContent = '';
        if (bundled?.external && bundled.licenseFile && typeof this.fonts.readExternalFile === 'function') {
            this._fontLicensePath = bundled.licenseFile;
            this.elements.fontLicense.hidden = false;
            this.elements.fontLicenseText.textContent = this.elements.fontLicense.open ? '作者資料を読み込み中…' : '詳細を開くと作者資料を読み込みます';
            if (this.elements.fontLicense.open) void this._loadExternalLicense(this._fontLicensePath, token);
        }
        const loadedEntry = this._getLoadedFont(id);
        const stableSample = this._fontPreviewRenderedId === id
            && this._fontPreviewRenderedSampleId === sample.id
            && this.elements.fontSamplePreview.dataset.state === 'loaded';
        if (loadedEntry) {
            this._applyFontPreview(loadedEntry, sample, token);
        } else {
            if (!stableSample) {
                this.elements.fontLoadStatus.textContent = '見本を待機中…';
                this.elements.fontLoadStatus.dataset.state = 'loading';
                this.elements.fontSamplePreview.textContent = '選択を反映しています…';
                this.elements.fontSamplePreview.dataset.state = 'loading';
                this.elements.fontSamplePreview.style.fontFamily = 'sans-serif';
            }
            this._fontPreviewTimer = setTimeout(() => {
                this._loadFontPreview(id, sample, token, bundled?.external === true);
            }, typeof this.fonts.getLoadedFont === 'function' ? FONT_PREVIEW_COALESCE_MS : FONT_PREVIEW_DELAY_MS);
        }
    }

    _getLoadedFont(id) {
        if (typeof this.fonts.getLoadedFont !== 'function') return null;
        try { return this.fonts.getLoadedFont(id) || null; } catch (error) { return null; }
    }

    _applyFontPreview(entry, sample, token) {
        if (!entry || token !== this._fontPreviewToken) return;
        this.elements.fontLoadStatus.textContent = '見本を読み込みました';
        this.elements.fontLoadStatus.dataset.state = 'loaded';
        this.elements.fontSamplePreview.textContent = sample.text;
        this.elements.fontSamplePreview.dataset.state = 'loaded';
        this.elements.fontSamplePreview.style.fontFamily = "'" + String(entry.family).replaceAll('"', '').replaceAll("'", '').replaceAll(String.fromCharCode(92), '') + "'";
        this._fontPreviewRenderedId = this._selectedFontId();
        this._fontPreviewRenderedSampleId = sample.id;
    }

    async _loadFontPreview(id, sample, token, external = false) {
        if (token !== this._fontPreviewToken) return;
        let entry = this._getLoadedFont(id);
        try {
            if (!entry) entry = typeof this.fonts.ensureLoaded === 'function' ? await this.fonts.ensureLoaded(id) : null;
        } catch (error) {
            entry = null;
        }
        if (token !== this._fontPreviewToken) return;
        if (!entry) {
            this.elements.fontLoadStatus.textContent = external
                ? '外部フォントを読み込めません。保管先と元ファイルを確認してください'
                : '見本を読み込めませんでした';
            this.elements.fontLoadStatus.dataset.state = 'error';
            this.elements.fontSamplePreview.textContent = external ? '保管先と元ファイルを確認してください' : '（フォント未適用）';
            this.elements.fontSamplePreview.dataset.state = 'error';
            this.elements.fontSamplePreview.style.fontFamily = '';
            return;
        }
        this._applyFontPreview(entry, sample, token);
    }

    async _loadExternalLicense(path, token) {
        try {
            const file = await this.fonts.readExternalFile(path);
            if (!file || token !== this._fontLicenseToken) throw new Error('license unavailable');
            const blob = file instanceof Blob ? file : new Blob([file]);
            const text = await blob.text();
            if (token !== this._fontLicenseToken) return;
            this.elements.fontLicenseText.textContent = text || '作者資料は空です';
        } catch (error) {
            if (token !== this._fontLicenseToken) return;
            this.elements.fontLicenseText.textContent = '作者資料を読み込めませんでした。外部フォルダの接続と権限を確認してください';
        }
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
        const previous = this._fontData || { folders: [], fonts: [], bundled: [], organization: { folders: [], placements: {}, orders: {}, favoriteFirst: false } };
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
        const nextFontData = {
            folders: valueOrPrevious(foldersResult, previous.folders),
            fonts: valueOrPrevious(fontsResult, previous.fonts),
            bundled: valueOrPrevious(bundledResult, previous.bundled)
        };
        const fontIds = [...nextFontData.bundled, ...nextFontData.fonts].map(font => font.id).filter(Boolean);
        let organization = previous.organization;
        if (typeof this.fonts.getOrganization === 'function') {
            try {
                await this.fonts.initializeOrganization?.(fontIds);
                const result = await this.fonts.getOrganization(fontIds);
                if (result && typeof result === 'object') organization = result;
            } catch (error) {
                organization = previous.organization;
            }
        }
        if (refreshToken !== this._fontRefreshToken) return;
        this._fontData = { ...nextFontData, organization: this._normalizeOrganization(organization) };
        this._applyCatalogPrimary();
        if (this.popup) {
            this._renderFontOptions();
            this._renderFontManager();
            this._renderFontTree();
            this._renderFontComparison();
            this._syncControls();
        }
        void this._refreshExternalStatus();
    }

    _normalizeOrganization(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const folders = Array.isArray(src.folders)
            ? src.folders.filter(folder => folder?.id).map(folder => ({
                id: String(folder.id),
                label: String(folder.label ?? folder.name ?? folder.id),
                parentId: folder.parentId || null
            }))
            : [];
        const placements = src.placements && typeof src.placements === 'object' ? { ...src.placements } : {};
        const orders = src.orders && typeof src.orders === 'object' ? { ...src.orders } : {};
        return {
            folders,
            placements,
            orders,
            favoriteFirst: src.favoriteFirst === true
        };
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

    _onFontSelected(value, options = {}) {
        const selectedRow = this._fontRowsForTree().find(row => row.selectValue === value);
        if (selectedRow) this.fontTree?.setSelected(selectedRow.key);
        this._commitFontCommentDraft();
        if (value.startsWith(BUNDLED_OPTION_PREFIX) || value.startsWith(IMPORTED_OPTION_PREFIX)) {
            const prefix = value.startsWith(BUNDLED_OPTION_PREFIX) ? BUNDLED_OPTION_PREFIX : IMPORTED_OPTION_PREFIX;
            this._setParams({ ...this.params, text: { ...this.params.text, fontKind: 'imported', fontId: value.slice(prefix.length) } }, { letteringDelay: options.letteringDelay });
        } else {
            this._setParams({ ...this.params, text: { ...this.params.text, fontKind: 'system', fontId: null, fontFamily: value.slice(4) } }, { letteringDelay: options.letteringDelay });
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

    _scheduleLettering(delay = 140) {
        clearTimeout(this._letteringTimer);
        this._letteringToken += 1;
        const wait = Number.isFinite(Number(delay)) ? Math.max(0, Number(delay)) : 140;
        this._letteringTimer = setTimeout(() => this._refreshLettering(), wait);
    }

    /** 文字領域に収まる文字画像を作る(自動調整ONなら収まる最大サイズを探す)。 */
    async _refreshLettering() {
        const token = ++this._letteringToken;
        this.popup.querySelector('[data-role="text-warning"]').textContent = '';
        const p = this.params;
        const texts = p.shape === 'double' ? [p.text, { ...p.text, content: p.double.content }] : [p.text];
        const results = await Promise.all(texts.map((text, index) => this._composeBodyLettering(p, text, index, token)));
        if (token !== this._letteringToken) return null;
        if (texts.some((text, index) => text.content.trim() && !results[index])) {
            this.lettering = null; this.textImage = null; this._redraw(); return null;
        }
        const images = results.map((result, index) => {
            if (!result) return null;
            const at = letteringPlacement(p, this._canvasSize(), result, index);
            const c = document.createElement('canvas'); c.width = result.width; c.height = result.height;
            c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(result.pixels), result.width, result.height), 0, 0);
            return { url: c.toDataURL('image/png'), x: at.x, y: at.y, width: result.width, height: result.height };
        });
        this.lettering = p.shape === 'double' ? results : results[0];
        this.textImage = p.shape === 'double' ? images : images[0];
        const status = assessBalloonTextBounds(p, this._canvasSize(), images.map(image => image && ({ x: image.x, y: image.y, w: image.width, h: image.height })));
        const warnings = status.outside.map(index => `本文${index + 1}が本体からはみ出しています`);
        if (status.overlap) warnings.push('本文1と2が重なっています');
        results.forEach((result, index) => {
            const area = balloonTextFrame(p, this._canvasSize(), index);
            if (result && (result.width > area.w + 1 || result.height > area.h + 1)) warnings.push(`本文${index + 1}が文字領域に収まりません`);
        });
        this.popup.querySelector('[data-role="text-warning"]').textContent = warnings.join(' / ');
        this._syncControls(); this._redraw(); return this.lettering;
    }

    async _composeBodyLettering(p, text, index, token) {
        if (!text.content.trim()) return null;
        const area = balloonTextFrame(p, this._canvasSize(), index);
        let family = text.fontFamily;
        let embedCss = '';
        // New explicit frames describe the full image, including outline padding.
        // Legacy recipes retain their original content-box wrapping dimensions.
        const padding = (index === 1 ? p.double?.frame : p.text.frame) ? (Math.ceil(text.outlineWidth) + 2) * 2 : 0;
        if (text.fontKind === 'imported' && text.fontId) {
            const entry = await this.fonts.ensureLoaded(text.fontId);
            if (token !== this._letteringToken) return null;
            if (entry) {
                family = entry.family;
                embedCss = await this.fonts.getEmbedCss(text.fontId);
            } else {
                const external = this._fontData.bundled.find(font => font.id === text.fontId)?.external === true;
                if (external) {
                    showFeedbackToast('外部フォントを読み込めません。保管先と元ファイルを確認してください');
                    return null;
                }
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
            boxWidth: text.vertical ? 0 : Math.max(1, Math.floor(area.w - padding)),
            boxHeight: text.vertical ? Math.max(1, Math.floor(area.h - padding)) : 0
        };
        let size = text.fontSize;
        const paragraph = s => ({ text: base.text, vertical: base.vertical, fontFamily: base.fontFamily, fontSize: s,
            lineHeight: base.lineHeight, tracking: base.letterSpacing * s, bold: base.bold,
            color: base.color, strokeWidth: base.outlineWidth, strokeColor: base.outlineColor });
        const layout = { boxWidth: base.boxWidth, boxHeight: base.boxHeight, align: base.align, embedCss: base.embedCss };
        if (text.autoFit) {
            let lo = 8;
            let hi = 200;
            const fits = async (s) => {
                const m = await measureParagraph(paragraph(s), layout);
                return m.ok && (text.vertical ? m.width <= area.w : m.height <= area.h);
            };
            for (let i = 0; i < 8 && lo < hi; i += 1) {
                const mid = Math.ceil((lo + hi) / 2);
                if (await fits(mid)) lo = mid; else hi = mid - 1;
                if (token !== this._letteringToken) return null;
            }
            size = lo;
        }
        const result = await rasterizeParagraph(paragraph(size), layout);
        if (token !== this._letteringToken) return null; // 新しい入力に追い越された
        return result.ok ? result : null;
    }

    // ------------------------------------------------------------ ドラッグ(プレビュー/キャンバス上)

    _beginDrag(target, event, toPoint) {
        if (this._spacePressed) return;
        if (target.type === 'body-move') {
            if (!event.ctrlKey || event.altKey || event.metaKey) return;
            target = { type: 'center' };
        }
        this.endDrag();
        if (target.type === 'tip' || target.type.startsWith('tip:')) {
            this.tailIndex = target.type === 'tip' ? 0 : Number(target.type.slice(4));
            this.context = 'tail'; this._syncControls();
        }
        if (target.type.startsWith('text:')) {
            this.textIndex = Number(target.type.split(':')[1]);
            const area = balloonTextFrame(this.params, this._canvasSize(), this.textIndex);
            this._setParams(setBalloonTextFrame(this.params, this._canvasSize(), this.textIndex, area));
        } else if (target.type.startsWith('point:') && !this.params.text.frame) {
            this._setParams(resetBalloonTextFrames(this.params, this._canvasSize()));
        }
        const start = toPoint(event);
        if (!start) return;
        if (target.type.startsWith('point:')) {
            this.selectedPoint = Number(target.type.slice(6)); this._syncControls(); this.overlay.schedule();
        }
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
        if (this.editorSnap) pt = { x: Math.round(pt.x / this.editorGridSize) * this.editorGridSize, y: Math.round(pt.y / this.editorGridSize) * this.editorGridSize };
        if (drag.type.startsWith('text:')) {
            const [, index, part] = drag.type.split(':');
            const area = balloonTextFrame(s, this._canvasSize(), Number(index));
            let box;
            if (part === 'center') box = { ...area, x: area.x + pt.x - drag.startPoint.x, y: area.y + pt.y - drag.startPoint.y };
            else {
                const fixed = { tl: { x: area.x + area.w, y: area.y + area.h }, tr: { x: area.x, y: area.y + area.h }, br: { x: area.x, y: area.y }, bl: { x: area.x + area.w, y: area.y } }[part];
                if (!fixed) return;
                box = { x: Math.min(fixed.x, pt.x), y: Math.min(fixed.y, pt.y), w: Math.max(8, Math.abs(pt.x - fixed.x)), h: Math.max(8, Math.abs(pt.y - fixed.y)) };
            }
            next = setBalloonTextFrame(s, this._canvasSize(), Number(index), box);
        } else if (drag.type.startsWith('point:')) {
            next = moveBalloonContourPoint(s, Number(drag.type.slice(6)), pt, this._canvasSize());
        } else if (drag.type === 'secondary:center') {
            next.double.dx = s.double.dx + (pt.x - drag.startPoint.x) / s.rect.w;
            next.double.dy = s.double.dy + (pt.y - drag.startPoint.y) / s.rect.h;
        } else if (drag.type.startsWith('secondary:')) {
            const r = secondaryBalloonRect(s), c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
            next.double.scale = Math.max(Math.abs(pt.x - c.x) * 2 / s.rect.w, Math.abs(pt.y - c.y) * 2 / s.rect.h);
        } else if (drag.type === 'center') {
            const dx = pt.x - drag.startPoint.x;
            const dy = pt.y - drag.startPoint.y;
            next = transformBalloon(s, this._canvasSize(), { dx, dy });
        } else if (drag.type === 'tip' || drag.type.startsWith('tip:')) {
            const index = drag.type === 'tip' ? 0 : Number(drag.type.slice(4));
            if (index) next.extraTails[index - 1].tip = { x: pt.x, y: pt.y };
            else next.tail.tip = { x: pt.x, y: pt.y };
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

    _onObjectWheel(event) {
        if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey || this._spacePressed
            || window.coreEngine?.cameraSystem?.vKeyPressed || !Number.isFinite(event.deltaY) || !event.deltaY) return false;
        if (!event.target?.closest?.('.balloon-overlay') && !isMangaInputPrimary('balloon')) return false;
        this._setParams(transformBalloon(this.params, this._canvasSize(), { scale: event.deltaY < 0 ? 1.05 : 1 / 1.05 }));
        return true;
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
        const bodyEditing = this.context === 'body';
        const candidates = [
            ...(h.extraTips || []).map((point, index) => [`tip:${index + 1}`, point]),
            ...(this.context === 'text' ? balloonTextFrameHandles(this.params, this._canvasSize()).flatMap((frame, index) => [...Object.entries(frame.corners), ['center', frame.center]].map(([part, point]) => [`text:${index}:${part}`, point])) : []),
            ...(bodyEditing ? (h.contour || []).map((point, i) => [`point:${i}`, point]) : []),
            ...(bodyEditing && h.secondary ? Object.entries(h.secondary.corners).map(([key, point]) => [`secondary:${key}`, point]).concat([['secondary:center', h.secondary.center]]) : []),
            ['tip', h.tip], ['tl', h.corners.tl], ['tr', h.corners.tr], ['br', h.corners.br], ['bl', h.corners.bl], ['center', h.center]
        ];
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
        this._syncPreviewSource();
        const el = this.elements.canvas;
        if (!el) return;
        if (!this.elements.previewDetails.open) {
            this.overlay.schedule();
            return;
        }
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
        for (const [index, lettering] of (Array.isArray(this.lettering) ? this.lettering : [this.lettering]).entries()) {
        if (lettering) {
            const at = letteringPlacement(this.params, size, lettering, index);
            const tmp = document.createElement('canvas');
            tmp.width = lettering.width;
            tmp.height = lettering.height;
            tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(lettering.pixels), lettering.width, lettering.height), 0, 0);
            ctx.drawImage(tmp, at.x, at.y);
        }
        }
        ctx.restore();
        const h = balloonHandles(this.params, size);
        ctx.strokeStyle = '#ff8c42';
        ctx.fillStyle = '#ffffee';
        ctx.lineWidth = 1.5;
        const dot = (p, r) => { ctx.beginPath(); ctx.arc(p.x * this.scale, p.y * this.scale, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
        if (this.context === 'text') {
            for (const frame of balloonTextFrameHandles(this.params, size)) {
                const area = frame.corners;
                ctx.setLineDash([4, 3]); ctx.strokeRect(area.tl.x * this.scale, area.tl.y * this.scale, (area.br.x - area.tl.x) * this.scale, (area.br.y - area.tl.y) * this.scale); ctx.setLineDash([]);
                for (const point of Object.values(area)) dot(point, 4);
                dot(frame.center, 6);
            }
        } else for (const c of Object.values(h.corners)) dot(c, 4);
        if (this.context === 'body') {
            for (const [index, point] of (h.contour || []).entries()) { ctx.fillStyle = index === this.selectedPoint ? '#ff8c42' : '#ffffee'; dot(point, 4); }
            if (h.secondary) { ctx.fillStyle = '#ffffee'; for (const point of Object.values(h.secondary.corners)) dot(point, 4); dot(h.secondary.center, 6); }
        }
        if (this.context !== 'text') {
            if (h.tip) { ctx.fillStyle = '#ff8c42'; dot(h.tip, 5); ctx.fillStyle = '#ffffee'; }
            for (const point of h.extraTips || []) if (point) { ctx.fillStyle = '#ff8c42'; dot(point, 5); }
            dot(h.center, 6);
        }
        void view;
        this.overlay.schedule();
    }

    // ------------------------------------------------------------ 確定

    _endPreview() {
        if (this.previewSource) restoreLetteringPreviewSource(this.previewSource);
        this.previewSource = null;
    }

    _syncPreviewSource() {
        const layer = this.layerSystem?.getLayers?.().find(item => item.layerData?.id === this.editing?.layerId);
        if (!this.isVisible || !this.showOverlay || !this.draftActive || !layer) return this._endPreview();
        if (this.previewSource !== layer) this._endPreview();
        if (ghostMangaPreviewSource(layer, () => this.layerSystem._folderCompositor?.markDirty?.())) this.previewSource = layer;
    }

    _guard(allowCaf = false) {
        if (!this.layerSystem?.createRasterLayerFromSnapshot) {
            showFeedbackToast('Raster Layerを作成できません');
            return false;
        }
        if (this.layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer === true && !allowCaf) {
            showFeedbackToast('吹き出しは通常CanvasのRaster Layer専用です');
            return false;
        }
        return true;
    }

    async _raster() {
        // 入力直後でも最新の組版で確定する
        clearTimeout(this._letteringTimer);
        const lettering = await this._refreshLettering();
        const selectedExternal = this.params.text.fontKind === 'imported'
            && this._fontData.bundled.find(font => font.id === this.params.text.fontId)?.external === true;
        const hasContent = this.params.text.content.trim() || this.params.double?.content?.trim();
        if (selectedExternal && hasContent && !lettering) {
            return { ok: false, reason: '外部フォントを読み込めません。保管先と元ファイルを確認してください' };
        }
        const size = this._canvasSize();
        return rasterizeBalloon(this.params, size, lettering);
    }

    _meta() {
        return sanitizeBalloonData({ params: this.params }, this._canvasSize());
    }

    async apply() {
        if (this._applyBusy) return { ok: false, reason: '吹き出しを処理中です' };
        this._applyBusy = true;
        try { return await this._applyNewRaster(); }
        finally { this._applyBusy = false; this._syncControls(); }
    }

    async _applyNewRaster() {
        const caf = cafMangaTarget(this.layerSystem), frame = this.layerSystem.currentFrameContainer;
        const token = !caf ? this.panelTarget?.token() : null;
        if (!this._guard(!!caf)) return { ok: false };
        const raster = await this._raster();
        if (!raster.ok) {
            showFeedbackToast(raster.reason);
            return { ok: false };
        }
        if (caf) {
            const result = appendMangaRaster(this.layerSystem, raster, '吹き出し', 'balloon', caf);
            if (result.ok) { this.editing = null; this.hide(); }
            this._syncControls();
            showFeedbackToast(result.ok ? 'CAFへ吹き出しを追加しました' : result.reason);
            return result;
        }
        if (frame !== this.layerSystem.currentFrameContainer || !this._guard()) return { ok: false };
        let created = null;
        try {
            created = this.panelTarget.create({
                width: raster.width,
                height: raster.height,
                pixels: raster.pixels,
                rasterBounds: raster.rasterBounds,
                paths: [],
                pathsData: []
            }, { name: '吹き出し', historyName: 'balloon-apply', source: 'balloon' }, 'balloon', token);
        } catch (error) {
            created = null;
        }
        if (!created?.layer?.layerData) {
            showFeedbackToast(created?.reason || '吹き出しレイヤーを作成できません');
            return { ok: false };
        }
        created.layer.layerData.balloon = this._meta();
        this.eventBus?.emit('layer:content-changed', { layerId: created.layer.layerData.id, source: 'balloon' });
        this.editing = { layerId: created.layer.layerData.id };
        this._endPreview(); this.draftActive = false;
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
        this._endPreview();
        apply(true);
        this.history.record({
            name: 'balloon-update',
            do: () => apply(true),
            undo: () => apply(false),
            byteSize: (before.pixels?.byteLength || 0) + (after.pixels?.byteLength || 0),
            meta: { type: 'balloon-update', layerId }
        });
        this.draftActive = false;
        showFeedbackToast('吹き出しを更新しました');
        return { ok: true, layerId };
    }

    loadFromActiveLayer() {
        if (!this._guard()) return { ok: false };
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
        this._fitViewport();
        this._navigation.sync();
    }

    _fitViewport() {
        if (!this.popup) return;
        const rect = this.popup.getBoundingClientRect();
        const style = getComputedStyle(this.popup);
        const left = Number.parseFloat(style.left), top = Number.parseFloat(style.top);
        this.popup.style.left = `${Math.max(4, Math.min(Number.isFinite(left) ? left : rect.left, innerWidth - this.popup.offsetWidth - 4))}px`;
        this.popup.style.top = `${Math.max(4, Math.min(Number.isFinite(top) ? top : rect.top, innerHeight - this.popup.offsetHeight - 4))}px`;
    }

    hide() {
        this._endPreview();
        if (!this.popup) return;
        this._fontTreeWarmToken = (this._fontTreeWarmToken || 0) + 1;
        clearTimeout(this._fontTreeWarmTimer);
        const wasVisible = this.isVisible === true;
        if (this.fontComparison?.isOpen?.()) this._toggleFontComparison(false);
        this.popup.classList.remove('show');
        this.isVisible = false;
        this._navigation.clear();
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
        this._endPreview();
        this.eventBus?.off?.('layer:content-changed', this._sourceChanged);
        this.eventBus?.off?.('history:changed', this._sourceHistory);
        this.endDrag();
        this._navigation.destroy();
        window.removeEventListener('resize', this._onViewportResize);
        clearTimeout(this._letteringTimer);
        this.popupDragCleanup?.();
        this.popupDragCleanup = null;
        this._fieldDetachers?.forEach(off => off());
        this._offFonts?.();
        this.eventBus?.off?.('layer:activated', this._layerListener);
        this.fontComparison?.destroy?.();
        this.overlay.destroy();
    }
}

window.BalloonPopup = BalloonPopup;
