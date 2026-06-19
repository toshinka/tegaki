/**
 * ============================================================================
 * ファイル名: ui/settings-popup.js
 * 責務: アプリケーションのグローバル設定（筆圧補正、スムーズ度等）のUIを提供する
 * 依存: system/event-bus.js, system/settings-manager.js, ui/popup-drag-helper.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: SettingsPopup
 * イベント発火: settings:pressure-correction, settings:smoothing, settings:pressure-curve
 * イベント受信: ui:open-settings
 * グローバル登録: window.SettingsPopup
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';

export class SettingsPopup {
    constructor(dependencies = {}) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = TegakiEventBus;
        this.settingsManager = this._getSettingsManager();

        this.popup = null;
        this.isVisible = false;
        this.initialized = false;

        this.activeSliderPointerId = null;
        this.activeSliderType = null;
        this.popupDragCleanup = null;

        this.elements = {};

        this.currentPressure = 1.0;
        this.currentSmoothing = 0.5;
        this.currentAirbrushFlow = 0.08;
        this.currentAirbrushScatter = 0.0;
        this.currentAirbrushSoftness = 0.8;

        this.MIN_PRESSURE = 0.1;
        this.MAX_PRESSURE = 3.0;
        this.MIN_SMOOTHING = 0.0;
        this.MAX_SMOOTHING = 1.0;

        this.BUCKET_GAP_LEVELS = [
            { value: 0, label: 'OFF' },
            { value: 1, label: '弱' },
            { value: 2, label: '中' },
            { value: 3, label: '強' }
        ];
        this.BUCKET_UNDERPAINT_LEVELS = [
            { value: 0, label: 'OFF' },
            { value: 1, label: '弱' },
            { value: 2, label: '中' },
            { value: 3, label: '強' },
            { value: 4, label: '最大' }
        ];

        this._ensurePopupElement();
        this._setupEventListeners();
    }

    _setupEventListeners() {
        if (!this.eventBus) return;

        this.eventBus.on('ui:open-settings', () => {
            this.toggle();
        });
    }

    _getSettingsManager() {
        return window.TegakiSettingsManager;
    }

    _ensurePopupElement() {
        this.popup = document.getElementById('settings-popup');

        if (!this.popup) {
            this._createPopupElement();
        } else {
            mountPopupAtOverlayRoot(this.popup);
            this.popup.classList.remove('show');
            this.popup.style.display = '';

            if (!document.getElementById('status-panel-toggle')) {
                this._populateContent();
            }
        }

        if (this.popup) {
            this.popup.classList.add('popup-panel--translucent');
            this.popup.style.top = '60px';
            this.popup.style.left = '60px';
            this.popup.style.maxHeight = 'calc(100vh - 120px)';
            this.popup.style.overflowY = 'auto';
        }
    }

    _createPopupElement() {
        const container = document.querySelector('.main-layout') || document.body;
        if (!container) return;

        const popupDiv = document.createElement('div');
        popupDiv.id = 'settings-popup';
        popupDiv.className = 'popup-panel popup-panel--translucent';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';
        popupDiv.style.maxHeight = 'calc(100vh - 120px)';
        popupDiv.style.overflowY = 'auto';

        container.appendChild(popupDiv);
        this.popup = popupDiv;
        this._populateContent();
    }

    _populateContent() {
        if (!this.popup) return;

        const closeBtnHtml = window.DOMBuilder
            ? window.DOMBuilder.createCloseButton('settings-popup').outerHTML
            : `<button class="ui-close-button ui-close-button--medium popup-close-btn" data-action="close-popup" data-target="settings-popup">
                ${window.UI_ICONS?.close || '×'}
               </button>`;

        this.popup.innerHTML = `
            ${closeBtnHtml}
            <div class="popup-title">設定・ヘルプ</div>

            <div class="ui-tabs">
                <button class="ui-tab-btn active" data-tab="settings">設定</button>
                <button class="ui-tab-btn" data-tab="pen">ペン</button>
                <button class="ui-tab-btn" data-tab="spray">スプレー</button>
                <button class="ui-tab-btn" data-tab="bucket">バケツ</button>
                <button class="ui-tab-btn" data-tab="help">ショートカット</button>
            </div>

            <div id="tab-settings" class="ui-tab-content active">
                <div class="setting-group">
                    <div class="setting-label">ステータスパネル</div>
                    <div class="status-panel-controls">
                        <button id="status-panel-toggle">非表示</button>
                        <span id="status-panel-state">表示中</span>
                    </div>
                </div>
                <div class="setting-group">
                    <div class="setting-label">History</div>
                    <label class="history-setting-auto">
                        <input id="history-auto-adjust" type="checkbox" checked>
                        端末メモリに合わせて自動調整
                    </label>
                    <div class="history-setting-row">
                        <label>履歴回数
                            <select id="history-max-entries">
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="250">250</option>
                                <option value="500">500</option>
                            </select>
                        </label>
                        <label>メモリ上限
                            <select id="history-max-memory">
                                <option value="128">128 MB</option>
                                <option value="256">256 MB</option>
                                <option value="512">512 MB</option>
                                <option value="1024">1024 MB</option>
                            </select>
                        </label>
                    </div>
                    <div id="history-usage-display" class="setting-description">履歴: 0 / 250　使用量: 0 / 256 MB</div>
                </div>
            </div>

            <div id="tab-pen" class="ui-tab-content">
                <div class="setting-group">
                    <div class="setting-label">線補正（スムーズ度）</div>
                    <div class="slider-container">
                        <div class="slider" id="smoothing-slider">
                            <div class="slider-track" id="smoothing-track"></div>
                            <div class="slider-handle" id="smoothing-handle"></div>
                        </div>
                        <div class="slider-value" id="smoothing-value">0.5</div>
                    </div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">筆圧補正（感度）</div>
                    <div class="slider-container">
                        <div class="slider" id="pressure-correction-slider">
                            <div class="slider-track" id="pressure-track"></div>
                            <div class="slider-handle" id="pressure-handle"></div>
                        </div>
                        <div class="slider-value" id="pressure-value">1.0</div>
                    </div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">筆圧カーブ</div>
                    <div class="pressure-curve-selection">
                        <button class="pressure-curve-btn active" data-curve="linear">リニア</button>
                        <button class="pressure-curve-btn" data-curve="ease-in">軽め</button>
                        <button class="pressure-curve-btn" data-curve="ease-out">重め</button>
                    </div>
                </div>
            </div>

            <div id="tab-spray" class="ui-tab-content">
                <div class="setting-group">
                    <div class="setting-label">流量 (Flow)</div>
                    <div class="slider-container">
                        <div class="slider" id="airbrush-flow-slider">
                            <div class="slider-track" id="airbrush-flow-track"></div>
                            <div class="slider-handle" id="airbrush-flow-handle"></div>
                        </div>
                        <div class="slider-value" id="airbrush-flow-value">0.08</div>
                    </div>
                    <div class="setting-description">1回のスタンプあたりの濃度。低いほど重ね塗りでゆっくり色が乗ります。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">エッジの柔らかさ (Softness)</div>
                    <div class="slider-container">
                        <div class="slider" id="airbrush-softness-slider">
                            <div class="slider-track" id="airbrush-softness-track"></div>
                            <div class="slider-handle" id="airbrush-softness-handle"></div>
                        </div>
                        <div class="slider-value" id="airbrush-softness-value">0.80</div>
                    </div>
                    <div class="setting-description">高いほど周辺がなめらかにフェード。低いほど輪郭がはっきりした円形になります。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">揺らぎ (Scatter)</div>
                    <div class="slider-container">
                        <div class="slider" id="airbrush-scatter-slider">
                            <div class="slider-track" id="airbrush-scatter-track"></div>
                            <div class="slider-handle" id="airbrush-scatter-handle"></div>
                        </div>
                        <div class="slider-value" id="airbrush-scatter-value">0.00</div>
                    </div>
                    <div class="setting-description">各スタンプ位置にわずかなランダムオフセットを加えます。0でも十分滑らか。</div>
                </div>
            </div>

            <div id="tab-bucket" class="ui-tab-content">
                <div class="setting-group">
                    <div class="setting-label">隙間閉じ (Gap Close)</div>
                    <div class="pressure-curve-selection" id="bucket-gap-options">
                        <button class="pressure-curve-btn bucket-level-btn active" data-bucket-setting="gap" data-value="0">OFF</button>
                        <button class="pressure-curve-btn bucket-level-btn" data-bucket-setting="gap" data-value="1">弱</button>
                        <button class="pressure-curve-btn bucket-level-btn" data-bucket-setting="gap" data-value="2">中</button>
                        <button class="pressure-curve-btn bucket-level-btn" data-bucket-setting="gap" data-value="3">強</button>
                        <div class="slider-value" id="bucket-gap-value">0px</div>
                    </div>
                    <div class="setting-description">線にわずかな隙間があっても漏れないように補正します (0-3px)</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">潜り込ませ量 (Dilation)</div>
                    <div class="pressure-curve-selection" id="bucket-underpaint-options">
                        <button class="pressure-curve-btn bucket-level-btn" data-bucket-setting="underpaint" data-value="0">OFF</button>
                        <button class="pressure-curve-btn bucket-level-btn active" data-bucket-setting="underpaint" data-value="1">弱</button>
                        <button class="pressure-curve-btn bucket-level-btn" data-bucket-setting="underpaint" data-value="2">中</button>
                        <button class="pressure-curve-btn bucket-level-btn" data-bucket-setting="underpaint" data-value="3">強</button>
                        <button class="pressure-curve-btn bucket-level-btn" data-bucket-setting="underpaint" data-value="4">最大</button>
                        <div class="slider-value" id="bucket-underpaint-value">1px</div>
                    </div>
                    <div class="setting-description">塗りを線の下へ少し広げて塗り残しを防ぎます (0-4px)</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">表示中レイヤー参照</div>
                    <div class="status-panel-controls">
                        <button id="bucket-ref-all-toggle">有効</button>
                        <span id="bucket-ref-all-state">参照中</span>
                    </div>
                    <div class="setting-description">他のレイヤーの線も境界として扱います</div>
                </div>
            </div>

            <div id="tab-help" class="ui-tab-content ui-scrollbar" style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
                <div class="help-list">
                    <div style="font-size: 11px; font-weight: 700; color: var(--futaba-maroon); margin: 4px 0 8px 4px; border-left: 3px solid var(--futaba-maroon); padding-left: 8px;">ツール</div>
                    <div class="help-item"><span class="help-label">ペンツール</span><span class="help-key">B</span></div>
                    <div class="help-item"><span class="help-label">消しゴムツール</span><span class="help-key">E</span></div>
                    <div class="help-item"><span class="help-label">塗りつぶしツール</span><span class="help-key">G</span></div>
                    <div class="help-item"><span class="help-label">投げ縄塗りツール</span><span class="help-key">L</span></div>
                    <div class="help-item"><span class="help-label">変形モード（トグル）</span><span class="help-key">V</span></div>

                    <div style="font-size: 11px; font-weight: 700; color: var(--futaba-maroon); margin: 16px 0 8px 4px; border-left: 3px solid var(--futaba-maroon); padding-left: 8px;">編集・履歴</div>
                    <div class="help-item"><span class="help-label">元に戻す (Undo)</span><span class="help-key">Z / Ctrl+Z</span></div>
                    <div class="help-item"><span class="help-label">やり直し (Redo)</span><span class="help-key">Y / Ctrl+Y</span></div>
                    <div class="help-item"><span class="help-label">レイヤー描画消去</span><span class="help-key">Del / BackSpace</span></div>

                    <div style="font-size: 11px; font-weight: 700; color: var(--futaba-maroon); margin: 16px 0 8px 4px; border-left: 3px solid var(--futaba-maroon); padding-left: 8px;">表示・操作</div>
                    <div class="help-item"><span class="help-label">手のひら（画面移動）</span><span class="help-key">Space + ドラッグ</span></div>
                    <div class="help-item"><span class="help-label">ペン筆圧 ON/OFF</span><span class="help-key">Shift + P</span></div>
                    <div class="help-item"><span class="help-label">消しゴム筆圧 ON/OFF</span><span class="help-key">Shift + E</span></div>
                    <div class="help-item"><span class="help-label">アニメ再生/停止</span><span class="help-key">Ctrl + Space</span></div>
                    <div class="help-item"><span class="help-label">フォルダー開閉</span><span class="help-key">Enter</span></div>

                    <div style="font-size: 11px; font-weight: 700; color: var(--futaba-maroon); margin: 16px 0 8px 4px; border-left: 3px solid var(--futaba-maroon); padding-left: 8px;">パネル開閉</div>
                    <div class="help-item"><span class="help-label">設定・ヘルプ</span><span class="help-key">Ctrl + K</span></div>
                    <div class="help-item"><span class="help-label">画像・動画出力</span><span class="help-key">Ctrl + E</span></div>
                    <div class="help-item"><span class="help-label">クイックアクセス</span><span class="help-key">Q</span></div>
                </div>
            </div>
        `;

        const closeBtn = this.popup.querySelector('.ui-close-button');
        if (closeBtn) {
            closeBtn.onclick = () => this.hide();
        }

        this._setupTabs();
    }

    _setupTabs() {
        const tabBtns = this.popup.querySelectorAll('.ui-tab-btn');
        const contents = this.popup.querySelectorAll('.ui-tab-content');

        tabBtns.forEach(btn => {
            btn.onclick = () => {
                const targetTab = btn.dataset.tab;
                tabBtns.forEach(b => b.classList.toggle('active', b === btn));
                contents.forEach(c => {
                    const isActive = c.id === `tab-${targetTab}`;
                    c.classList.toggle('active', isActive);
                });
            };
        });
    }

    _cacheElements() {
        this.elements = {
            pressureSlider: document.getElementById('pressure-correction-slider'),
            pressureTrack: document.getElementById('pressure-track'),
            pressureHandle: document.getElementById('pressure-handle'),
            pressureValue: document.getElementById('pressure-value'),

            smoothingSlider: document.getElementById('smoothing-slider'),
            smoothingTrack: document.getElementById('smoothing-track'),
            smoothingHandle: document.getElementById('smoothing-handle'),
            smoothingValue: document.getElementById('smoothing-value'),

            airbrushFlowSlider: document.getElementById('airbrush-flow-slider'),
            airbrushFlowTrack: document.getElementById('airbrush-flow-track'),
            airbrushFlowHandle: document.getElementById('airbrush-flow-handle'),
            airbrushFlowValue: document.getElementById('airbrush-flow-value'),

            airbrushSoftnessSlider: document.getElementById('airbrush-softness-slider'),
            airbrushSoftnessTrack: document.getElementById('airbrush-softness-track'),
            airbrushSoftnessHandle: document.getElementById('airbrush-softness-handle'),
            airbrushSoftnessValue: document.getElementById('airbrush-softness-value'),

            airbrushScatterSlider: document.getElementById('airbrush-scatter-slider'),
            airbrushScatterTrack: document.getElementById('airbrush-scatter-track'),
            airbrushScatterHandle: document.getElementById('airbrush-scatter-handle'),
            airbrushScatterValue: document.getElementById('airbrush-scatter-value'),

            bucketGapButtons: Array.from(document.querySelectorAll('[data-bucket-setting="gap"]')),
            bucketGapValue: document.getElementById('bucket-gap-value'),

            bucketUnderpaintButtons: Array.from(document.querySelectorAll('[data-bucket-setting="underpaint"]')),
            bucketUnderpaintValue: document.getElementById('bucket-underpaint-value'),

            statusToggle: document.getElementById('status-panel-toggle'),
            statusState: document.getElementById('status-panel-state'),
            historyAutoAdjust: document.getElementById('history-auto-adjust'),
            historyMaxEntries: document.getElementById('history-max-entries'),
            historyMaxMemory: document.getElementById('history-max-memory'),
            historyUsage: document.getElementById('history-usage-display'),

            bucketRefToggle: document.getElementById('bucket-ref-all-toggle'),
            bucketRefState: document.getElementById('bucket-ref-all-state')
        };
    }

    initialize() {
        if (this.initialized) return;
        this._cacheElements();
        this._setupSliders();
        this._setupPopupDrag();
        this._setupButtons();
        this._loadSettings();
        this.eventBus?.on('history:changed', () => this._updateHistoryUsageDisplay());
        this.initialized = true;
    }

    _setupPopupDrag() {
        if (!this.popup) return;
        this.popupDragCleanup = attachPopupDrag(this.popup);
    }

    _setupSliders() {
        const globalMoveHandler = (e) => {
            if (this.activeSliderPointerId !== e.pointerId) return;
            if (!this.activeSliderType) return;

            e.preventDefault();
            e.stopPropagation();

            const sliderType = this.activeSliderType;
            const sliderElement = this.elements[`${sliderType}Slider`];
            if (!sliderElement) return;

            const rect = sliderElement.getBoundingClientRect();
            const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            
            let min = 0, max = 1.0;
            if (sliderType === 'pressure') { min = this.MIN_PRESSURE; max = this.MAX_PRESSURE; }
            else if (sliderType === 'smoothing') { min = this.MIN_SMOOTHING; max = this.MAX_SMOOTHING; }
            else if (sliderType === 'airbrushFlow') { min = 0.01; max = 1.0; }
            else if (sliderType === 'airbrushSoftness') { min = 0.0; max = 1.0; }
            else if (sliderType === 'airbrushScatter') { min = 0.0; max = 1.0; }

            const value = min + ((max - min) * percent / 100);
            this._updateGenericSlider(sliderType, value);
        };

        const globalUpHandler = (e) => {
            if (this.activeSliderPointerId !== e.pointerId) return;

            const type = this.activeSliderType;
            if (type) {
                const handle = this.elements[`${type}Handle`];
                if (handle?.releasePointerCapture) {
                    try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
                }
                
                let settingKey = type;
                if (type === 'pressure') settingKey = 'pressureCorrection';
                if (this.settingsManager) {
                    const val = this[`current${type.charAt(0).toUpperCase() + type.slice(1)}`];
                    this.settingsManager.set(settingKey, val);
                }
            }

            this.activeSliderType = null;
            this.activeSliderPointerId = null;
        };

        document.addEventListener('pointermove', globalMoveHandler, { passive: false, capture: true });
        document.addEventListener('pointerup', globalUpHandler, { capture: true });
        document.addEventListener('pointercancel', globalUpHandler, { capture: true });

        const setupSliderEvents = (type) => {
            const slider = this.elements[`${type}Slider`];
            const handle = this.elements[`${type}Handle`];
            if (!slider || !handle) return;

            handle.addEventListener('pointerdown', (e) => {
                this.activeSliderType = type;
                this.activeSliderPointerId = e.pointerId;
                if (handle.setPointerCapture) {
                    try { handle.setPointerCapture(e.pointerId); } catch (err) {}
                }
                e.preventDefault();
                e.stopPropagation();
            });

            slider.addEventListener('pointerdown', (e) => {
                if (e.target === handle) return;
                this.activeSliderType = type;
                this.activeSliderPointerId = e.pointerId;
                const rect = slider.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                
                let min = 0, max = 1.0;
                if (type === 'pressure') { min = this.MIN_PRESSURE; max = this.MAX_PRESSURE; }
                else if (type === 'smoothing') { min = this.MIN_SMOOTHING; max = this.MAX_SMOOTHING; }
                else if (type === 'airbrushFlow') { min = 0.01; max = 1.0; }
                else if (type === 'airbrushSoftness') { min = 0.0; max = 1.0; }
                else if (type === 'airbrushScatter') { min = 0.0; max = 1.0; }

                const value = min + ((max - min) * percent / 100);
                this._updateGenericSlider(type, value);
                
                let settingKey = type;
                if (type === 'pressure') settingKey = 'pressureCorrection';
                this.settingsManager?.set(settingKey, value);
            });
        };

        ['pressure', 'smoothing', 'airbrushFlow', 'airbrushSoftness', 'airbrushScatter'].forEach(setupSliderEvents);
    }

    _updateGenericSlider(type, value) {
        let min = 0, max = 1.0;
        if (type === 'pressure') { min = this.MIN_PRESSURE; max = this.MAX_PRESSURE; }
        else if (type === 'smoothing') { min = this.MIN_SMOOTHING; max = this.MAX_SMOOTHING; }
        else if (type === 'airbrushFlow') { min = 0.01; max = 1.0; }
        else if (type === 'airbrushSoftness') { min = 0.0; max = 1.0; }
        else if (type === 'airbrushScatter') { min = 0.0; max = 1.0; }

        const val = Math.max(min, Math.min(max, value));
        this[`current${type.charAt(0).toUpperCase() + type.slice(1)}`] = val;

        const percent = ((val - min) / (max - min)) * 100;
        const track = this.elements[`${type}Track`];
        const handle = this.elements[`${type}Handle`];
        const display = this.elements[`${type}Value`];

        if (track) track.style.width = percent + '%';
        if (handle) handle.style.left = percent + '%';
        if (display) display.textContent = val.toFixed(2);

        if (this.eventBus) {
            let eventName = `settings:${type.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}`;
            if (type === 'pressure') eventName = 'settings:pressure-correction';
            this.eventBus.emit(eventName, { value: val });
        }
    }

    _updateBucketGapSlider(value) {
        const rounded = Math.round(Math.max(0, Math.min(3, value)));
        this.currentBucketGap = rounded;
        this._syncBucketLevelButtons(this.elements.bucketGapButtons, rounded);
        if (this.elements.bucketGapValue) this.elements.bucketGapValue.textContent = rounded + 'px';
        if (this.eventBus) this.eventBus.emit('settings:bucket-gap-close', { value: rounded });
    }

    _updateBucketUnderpaintSlider(value) {
        const rounded = Math.round(Math.max(0, Math.min(4, value)));
        this.currentBucketUnderpaint = rounded;
        this._syncBucketLevelButtons(this.elements.bucketUnderpaintButtons, rounded);
        if (this.elements.bucketUnderpaintValue) this.elements.bucketUnderpaintValue.textContent = rounded + 'px';
        if (this.eventBus) this.eventBus.emit('settings:bucket-underpaint', { value: rounded });
    }

    _syncBucketLevelButtons(buttons, value) {
        buttons?.forEach((btn) => {
            const active = parseInt(btn.dataset.value, 10) === value;
            btn.classList.toggle('active', active);
        });
    }

    _setupButtons() {
        if (this.elements.statusToggle) {
            this.elements.statusToggle.addEventListener('pointerdown', (e) => {
                e.preventDefault(); e.stopPropagation();
                this._toggleStatusPanel();
            });
        }
        if (this.elements.bucketRefToggle) {
            this.elements.bucketRefToggle.addEventListener('pointerdown', (e) => {
                e.preventDefault(); e.stopPropagation();
                this._toggleBucketRef();
            });
        }
        this.elements.historyAutoAdjust?.addEventListener('change', () => {
            const enabled = this.elements.historyAutoAdjust.checked;
            this.settingsManager?.set('historyAutoAdjust', enabled);
            if (enabled) {
                const automatic = this.settingsManager?.getAutomaticHistoryDefaults?.();
                if (automatic) {
                    this.elements.historyMaxEntries.value = String(automatic.maxEntries);
                    this.elements.historyMaxMemory.value = String(automatic.maxMemoryMB);
                }
            }
            this._syncHistoryControlState();
            this._updateHistoryUsageDisplay();
        });
        this.elements.historyMaxEntries?.addEventListener('change', () => {
            this.settingsManager?.set('historyMaxEntries', Number(this.elements.historyMaxEntries.value));
            this._updateHistoryUsageDisplay();
        });
        this.elements.historyMaxMemory?.addEventListener('change', () => {
            this.settingsManager?.set('historyMaxMemoryMB', Number(this.elements.historyMaxMemory.value));
            this._updateHistoryUsageDisplay();
        });
        this.elements.bucketGapButtons?.forEach((btn) => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault(); e.stopPropagation();
                const value = parseInt(btn.dataset.value, 10);
                this._updateBucketGapSlider(value);
                this.settingsManager?.set('bucketGapClose', this.currentBucketGap);
            });
        });
        this.elements.bucketUnderpaintButtons?.forEach((btn) => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault(); e.stopPropagation();
                const value = parseInt(btn.dataset.value, 10);
                this._updateBucketUnderpaintSlider(value);
                this.settingsManager?.set('bucketUnderpaint', this.currentBucketUnderpaint);
            });
        });
        const curveBtns = document.querySelectorAll('.pressure-curve-btn[data-curve]');
        curveBtns.forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault(); e.stopPropagation();
                const curve = e.currentTarget.getAttribute('data-curve');
                if (!curve) return;
                this._applyPressureCurveUI(curve);
                this.settingsManager?.set('pressureCurve', curve);
                if (this.eventBus) this.eventBus.emit('settings:pressure-curve', { curve });
            });
        });
    }

    _getDefaults() {
        return {
            pressureCorrection: 1.0,
            smoothing: 0.5,
            pressureCurve: 'linear',
            airbrushFlow: 0.08,
            airbrushSoftness: 0.8,
            airbrushScatter: 0.0,
            statusPanelVisible: true,
            bucketGapClose: 0,
            bucketUnderpaint: 1,
            bucketReferenceAllLayers: true,
            historyAutoAdjust: true,
            historyMaxEntries: 250,
            historyMaxMemoryMB: 256
        };
    }

    _loadSettings() {
        const settings = this.settingsManager ? this.settingsManager.get() : this._getDefaults();
        this._applySettingsToUI(settings);
    }

    _applySettingsToUI(settings) {
        const defaults = this._getDefaults();
        this._updateGenericSlider('pressure', settings.pressureCorrection ?? defaults.pressureCorrection);
        this._updateGenericSlider('smoothing', settings.smoothing ?? defaults.smoothing);
        this._updateGenericSlider('airbrushFlow', settings.airbrushFlow ?? defaults.airbrushFlow);
        this._updateGenericSlider('airbrushSoftness', settings.airbrushSoftness ?? defaults.airbrushSoftness);
        this._updateGenericSlider('airbrushScatter', settings.airbrushScatter ?? defaults.airbrushScatter);
        this._updateBucketGapSlider(settings.bucketGapClose ?? defaults.bucketGapClose);
        this._updateBucketUnderpaintSlider(settings.bucketUnderpaint ?? defaults.bucketUnderpaint);
        this._setBucketRefVisibility(settings.bucketReferenceAllLayers ?? defaults.bucketReferenceAllLayers);
        this._applyPressureCurveUI(settings.pressureCurve ?? defaults.pressureCurve);
        this._setStatusPanelVisibility(settings.statusPanelVisible ?? defaults.statusPanelVisible);
        this._applyHistorySettingsUI(settings);
    }

    _applyHistorySettingsUI(settings) {
        const automatic = this.settingsManager?.getAutomaticHistoryDefaults?.()
            || { maxEntries: 250, maxMemoryMB: 256 };
        const autoAdjust = settings.historyAutoAdjust !== false;
        if (this.elements.historyAutoAdjust) {
            this.elements.historyAutoAdjust.checked = autoAdjust;
        }
        if (this.elements.historyMaxEntries) {
            this.elements.historyMaxEntries.value = String(
                autoAdjust ? automatic.maxEntries : (settings.historyMaxEntries || 250)
            );
        }
        if (this.elements.historyMaxMemory) {
            this.elements.historyMaxMemory.value = String(
                autoAdjust ? automatic.maxMemoryMB : (settings.historyMaxMemoryMB || 256)
            );
        }
        this._syncHistoryControlState();
        this._updateHistoryUsageDisplay();
    }

    _syncHistoryControlState() {
        const disabled = this.elements.historyAutoAdjust?.checked === true;
        if (this.elements.historyMaxEntries) this.elements.historyMaxEntries.disabled = disabled;
        if (this.elements.historyMaxMemory) this.elements.historyMaxMemory.disabled = disabled;
    }

    _updateHistoryUsageDisplay() {
        if (!this.elements.historyUsage) return;
        const usage = window.History?.getUsage?.();
        if (!usage) return;
        const usedMB = usage.bytes / (1024 * 1024);
        const maxMB = usage.maxBytes / (1024 * 1024);
        this.elements.historyUsage.textContent =
            `履歴: ${usage.entries} / ${usage.maxEntries}　使用量: ${usedMB.toFixed(1)} / ${Math.round(maxMB)} MB`;
    }

    _applyPressureCurveUI(curve) {
        const curveBtns = this.popup.querySelectorAll('.pressure-curve-btn[data-curve]');
        curveBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-curve') === curve);
        });
    }

    _toggleStatusPanel() {
        const statusPanel = document.querySelector('.status-panel');
        if (!statusPanel) return;
        const isVisible = statusPanel.style.display !== 'none';
        this._setStatusPanelVisibility(!isVisible);
        this.settingsManager?.set('statusPanelVisible', !isVisible);
    }

    _setStatusPanelVisibility(visible) {
        const statusPanel = document.querySelector('.status-panel');
        if (!statusPanel) return;
        statusPanel.style.display = visible ? 'flex' : 'none';
        if (this.elements.statusToggle) this.elements.statusToggle.textContent = visible ? '非表示' : '表示';
        if (this.elements.statusState) this.elements.statusState.textContent = visible ? '表示中' : '非表示中';
    }

    _toggleBucketRef() {
        const current = this.elements.bucketRefToggle.textContent === '有効';
        this._setBucketRefVisibility(!current);
        this.settingsManager?.set('bucketReferenceAllLayers', !current);
    }

    _setBucketRefVisibility(visible) {
        if (this.elements.bucketRefToggle) this.elements.bucketRefToggle.textContent = visible ? '有効' : '無効';
        if (this.elements.bucketRefState) this.elements.bucketRefState.textContent = visible ? '参照中' : '非参照';
    }

    show() {
        if (!this.popup) this._ensurePopupElement();
        if (!this.popup) return;
        if (!this.initialized) this.initialize();
        this.popup.classList.add('show');
        this.isVisible = true;
        this._loadSettings();
    }

    hide() {
        if (!this.popup) return;
        this.popup.classList.remove('show');
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) this.hide(); else this.show();
    }

    destroy() {
        if (this._globalMoveHandler) {
            document.removeEventListener('pointermove', this._globalMoveHandler, true);
            document.removeEventListener('pointerup', this._globalUpHandler, true);
            document.removeEventListener('pointercancel', this._globalUpHandler, true);
        }
        if (this.popupDragCleanup) this.popupDragCleanup();
        this.elements = {};
        this.initialized = false;
    }
}

window.SettingsPopup = SettingsPopup;
