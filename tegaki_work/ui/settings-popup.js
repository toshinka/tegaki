/**
 * ============================================================================
 * ファイル名: ui/settings-popup.js
 * 責務: アプリケーションのグローバル設定（筆圧補正、緊急復旧、History等）のUIを提供する
 * 依存: config.js, system/event-bus.js, system/settings-manager.js, ui/popup-drag-helper.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: SettingsPopup
 * イベント発火: settings:pressure-correction, settings:smoothing, settings:pressure-curve, popup:shown, popup:hidden
 * イベント受信: ui:open-settings, emergency-recovery:saved
 * グローバル登録: window.SettingsPopup
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { TEGAKI_KEYMAP } from '../config.js';
import { TegakiEventBus } from '../system/event-bus.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import {
    PRESSURE_CURVE_PRESETS,
    MAX_PRESSURE_CURVE_POINTS,
    normalizePressureCurvePoints,
    evaluatePressureCurve
} from '../system/drawing/pressure-curve.js';
import { computeDabFalloff } from '../system/drawing/airbrush-dab-renderer.js';
import {
    BRUSH_PRESET_KEYS,
    BUILTIN_BRUSH_PRESETS,
    MAX_USER_BRUSH_PRESETS,
    brushPresetMatches,
    captureBrushPresetValues,
    applyBrushPresetValues
} from '../system/drawing/brush-presets.js';

export class SettingsPopup {
    constructor(dependencies = {}) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = TegakiEventBus;
        this.settingsManager = this._getSettingsManager();
        this.emergencyRecoveryStore = dependencies.emergencyRecoveryStore || null;

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
            this.popup.classList.add('popup-panel--translucent', 'ui-scrollbar');
            this.popup.style.top = '60px';
            this.popup.style.left = '60px';
        }
    }

    _createPopupElement() {
        const container = document.querySelector('.main-layout') || document.body;
        if (!container) return;

        const popupDiv = document.createElement('div');
        popupDiv.id = 'settings-popup';
        popupDiv.className = 'popup-panel popup-panel--translucent ui-scrollbar';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';

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
        const shortcutHelpHtml = this._buildShortcutHelpHtml();

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
                    <div class="setting-label">ショートカットヘルプ</div>
                    <label class="history-setting-auto">
                        <input id="shortcut-help-visible" type="checkbox" checked>
                        画面左上に「?」を表示
                    </label>
                </div>
                <div class="setting-group">
                    <div class="setting-label">Animation Table</div>
                    <label class="history-setting-auto">
                        <input id="animation-auto-create-next" type="checkbox" checked>
                        右方向キーで空Frameへ進む時にCAFを自動作成
                    </label>
                    <div class="setting-description">OFFではFrameだけを移動し、既存CAFの編集に専念できます。</div>
                </div>
                <div class="setting-group">
                    <div class="setting-label">緊急復旧</div>
                    <label class="history-setting-auto">
                        <input id="emergency-recovery-enabled" type="checkbox" checked>
                        操作中に定期記録
                    </label>
                    <div class="history-setting-row">
                        <label>最短間隔
                            <select id="emergency-recovery-interval">
                                <option value="5">5秒（高負荷）</option>
                                <option value="10">10秒（高負荷）</option>
                                <option value="30">30秒（注意）</option>
                                <option value="60">1分（推奨）</option>
                                <option value="180">3分</option>
                                <option value="300">5分</option>
                            </select>
                        </label>
                    </div>
                    <label class="history-setting-auto">
                        <input id="emergency-recovery-on-hide" type="checkbox" checked>
                        タブ非表示・終了時にも記録
                    </label>
                    <div id="emergency-recovery-status" class="setting-description">最終記録: まだありません</div>
                    <div class="setting-description">Ctrl+SのProject保存とは別です。Project全体を記録するため、重い制作では1分以上を推奨します。</div>
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
                                <option value="1024">1 GB</option>
                                <option value="2048">2 GB</option>
                                <option value="4096">4 GB</option>
                                <option value="8192">8 GB</option>
                                <option value="12288">12 GB</option>
                                <option value="16384">16 GB</option>
                            </select>
                        </label>
                    </div>
                    <div id="history-usage-display" class="setting-description">履歴: 0 / 250　使用量: 0 / 512 MB</div>
                </div>
            </div>

            <div id="tab-pen" class="ui-tab-content">
                <div class="setting-group">
                    <div class="setting-label">ブラシプリセット</div>
                    <div class="pressure-curve-selection brush-preset-list" data-preset-tool="pen"></div>
                    <div class="pressure-curve-selection brush-preset-actions">
                        <button class="pressure-curve-btn" type="button" data-preset-action="save" data-preset-tool="pen">＋ 今の設定を保存</button>
                        <button class="pressure-curve-btn" type="button" data-preset-action="delete" data-preset-tool="pen">選択中を削除</button>
                    </div>
                    <div class="setting-description">筆圧カーブや速度・傾きなど「描き味」を名前付きで保存します。サイズ・不透明度はクイックパレットのスロットで管理します。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">線補正（スムーズ度）</div>
                    <div class="pressure-curve-selection stabilizer-mode-selection">
                        <button class="pressure-curve-btn active" type="button" data-stabilizer-mode="follow">追従</button>
                        <button class="pressure-curve-btn" type="button" data-stabilizer-mode="string">ひも</button>
                    </div>
                    <div class="slider-container">
                        <div class="slider" id="smoothing-slider">
                            <div class="slider-track" id="smoothing-track"></div>
                            <div class="slider-handle" id="smoothing-handle"></div>
                        </div>
                        <div class="slider-value" id="smoothing-value">0.5</div>
                    </div>
                    <div class="setting-description">追従: 線がペンを少し遅れて追いかけます。ひも: ペンが一定距離（0.5で画面16px）動くまで線が動かず、手ぶれを無視して長い線を滑らかにします。離した位置まで線はつながります。</div>
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
                        <button class="pressure-curve-btn" data-curve="custom">カスタム</button>
                    </div>
                    <canvas id="pressure-curve-editor" class="pressure-curve-editor" width="240" height="160"></canvas>
                    <div class="setting-description">横が入力筆圧、縦が実効筆圧。点をドラッグで調整、空いた所をクリックで点を追加、点をダブルクリックで削除。編集するとカスタムになります。</div>
                </div>

                <div class="setting-group">
                    <label class="history-setting-auto">
                        <input id="pressure-opacity-toggle" type="checkbox" checked>
                        筆圧で濃度を変える
                    </label>
                    <div class="setting-label">筆圧濃度</div>
                    <div class="slider-container">
                        <div class="slider" id="pressure-opacity-slider">
                            <div class="slider-track" id="pressure-opacity-track"></div>
                            <div class="slider-handle" id="pressure-opacity-handle"></div>
                        </div>
                        <div class="slider-value" id="pressure-opacity-value">0.65</div>
                    </div>
                    <div class="setting-description">弱い筆圧では線を薄くします。上限はOPACITYに従い、高いほど0から上限まで濃淡が強く出ます。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">筆圧の安定化 (Pressure smoothing)</div>
                    <div class="slider-container">
                        <div class="slider" id="pen-pressure-smoothing-slider">
                            <div class="slider-track" id="pen-pressure-smoothing-track"></div>
                            <div class="slider-handle" id="pen-pressure-smoothing-handle"></div>
                        </div>
                        <div class="slider-value" id="pen-pressure-smoothing-value">0.50</div>
                    </div>
                    <div class="setting-description">筆圧の細かな揺れで線幅が波打つのを抑えます。強弱の素早い変化は遅らせません。0でOFF。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">速度で細く (Velocity)</div>
                    <div class="slider-container">
                        <div class="slider" id="pen-velocity-thinning-slider">
                            <div class="slider-track" id="pen-velocity-thinning-track"></div>
                            <div class="slider-handle" id="pen-velocity-thinning-handle"></div>
                        </div>
                        <div class="slider-value" id="pen-velocity-thinning-value">0.30</div>
                    </div>
                    <div class="setting-description">速く引いた線ほど細く・薄くします（筆圧使用時）。0で無効。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">傾きで太く (Tilt)</div>
                    <div class="slider-container">
                        <div class="slider" id="pen-tilt-strength-slider">
                            <div class="slider-track" id="pen-tilt-strength-track"></div>
                            <div class="slider-handle" id="pen-tilt-strength-handle"></div>
                        </div>
                        <div class="slider-value" id="pen-tilt-strength-value">0.00</div>
                    </div>
                    <div class="setting-description">ペンを寝かせるほど線を太くします（傾き対応ペンのみ、dab描画時）。0で無効。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">入り (Taper in)</div>
                    <div class="slider-container">
                        <div class="slider" id="pen-taper-in-slider">
                            <div class="slider-track" id="pen-taper-in-track"></div>
                            <div class="slider-handle" id="pen-taper-in-handle"></div>
                        </div>
                        <div class="slider-value" id="pen-taper-in-value">OFF</div>
                    </div>
                    <div class="setting-description">描き始めを指定の長さ（画素）で細くします。筆圧なし・マウスでも効きます。0でOFF。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">抜き (Taper out)</div>
                    <div class="slider-container">
                        <div class="slider" id="pen-taper-out-slider">
                            <div class="slider-track" id="pen-taper-out-track"></div>
                            <div class="slider-handle" id="pen-taper-out-handle"></div>
                        </div>
                        <div class="slider-value" id="pen-taper-out-value">OFF</div>
                    </div>
                    <div class="setting-description">描き終わりを指定の長さ（画素）で細くします。ペンを離した時に付きます。0でOFF。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">縁の柔らかさ (Softness)</div>
                    <div class="slider-container">
                        <div class="slider" id="pen-dab-softness-slider">
                            <div class="slider-track" id="pen-dab-softness-track"></div>
                            <div class="slider-handle" id="pen-dab-softness-handle"></div>
                        </div>
                        <div class="slider-value" id="pen-dab-softness-value">0.00</div>
                    </div>
                    <div class="setting-description">線の縁をぼかします。0でくっきり、上げるほど柔らかい線になります。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">縁のアンチエイリアス (AA)</div>
                    <div class="slider-container">
                        <div class="slider" id="pen-edge-aa-slider">
                            <div class="slider-track" id="pen-edge-aa-track"></div>
                            <div class="slider-handle" id="pen-edge-aa-handle"></div>
                        </div>
                        <div class="slider-value" id="pen-edge-aa-value">0.0px</div>
                    </div>
                    <div class="setting-description">線の太さに関係なく縁を指定画素ぶん滑らかにし、入り抜きや筆圧変化の段差(ジャギー)を抑えます（書き出しにも反映）。既定1px。0で従来の硬い縁。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label setting-section-label">消しゴム</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">消しゴムのプリセット</div>
                    <div class="pressure-curve-selection brush-preset-list" data-preset-tool="eraser"></div>
                    <div class="setting-description">消しゴムの形（丸・角）。「QTPに出す」で二行目に並べるものを選びます。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">消しゴムの柔らかさ</div>
                    <div class="slider-container">
                        <div class="slider" id="eraser-dab-softness-slider">
                            <div class="slider-track" id="eraser-dab-softness-track"></div>
                            <div class="slider-handle" id="eraser-dab-softness-handle"></div>
                        </div>
                        <div class="slider-value" id="eraser-dab-softness-value">0.00</div>
                    </div>
                    <div class="setting-description">消しゴムの縁をぼかします。0でくっきり消します。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">筆圧で消す強さ</div>
                    <div class="slider-container">
                        <div class="slider" id="eraser-pressure-strength-slider">
                            <div class="slider-track" id="eraser-pressure-strength-track"></div>
                            <div class="slider-handle" id="eraser-pressure-strength-handle"></div>
                        </div>
                        <div class="slider-value" id="eraser-pressure-strength-value">0.00</div>
                    </div>
                    <div class="setting-description">弱い筆圧ほど薄く消します（消しゴムの筆圧が有効な時）。0で常に完全に消します。</div>
                </div>
            </div>

            <div id="tab-spray" class="ui-tab-content">
                <div class="setting-group">
                    <div class="setting-label">ブラシプリセット</div>
                    <div class="pressure-curve-selection brush-preset-list" data-preset-tool="airbrush"></div>
                    <div class="pressure-curve-selection brush-preset-actions">
                        <button class="pressure-curve-btn" type="button" data-preset-action="save" data-preset-tool="airbrush">＋ 今の設定を保存</button>
                        <button class="pressure-curve-btn" type="button" data-preset-action="delete" data-preset-tool="airbrush">選択中を削除</button>
                    </div>
                    <div class="setting-description">筆圧カーブや速度・傾きなど「描き味」を名前付きで保存します。サイズ・不透明度はクイックパレットのスロットで管理します。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">先端プレビュー</div>
                    <canvas id="airbrush-dab-preview" class="brush-tip-preview" width="240" height="64"></canvas>
                    <div class="setting-description">左が1回の吹き付け、右が1本のストローク。流量・柔らかさ・揺らぎの変更がすぐ反映されます。</div>
                </div>
                <div class="setting-group">
                    <div class="setting-label">流量 (Flow)</div>
                    <div class="slider-container">
                        <div class="slider" id="airbrush-flow-slider">
                            <div class="slider-track" id="airbrush-flow-track"></div>
                            <div class="slider-handle" id="airbrush-flow-handle"></div>
                        </div>
                        <div class="slider-value" id="airbrush-flow-value">0.08</div>
                    </div>
                    <div class="setting-description">線としての濃度。低いほど重ね塗りでゆっくり色が乗ります。</div>
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

                <div class="setting-group">
                    <div class="setting-label">溜まり (Build-up)</div>
                    <div class="slider-container">
                        <div class="slider" id="airbrush-buildup-rate-slider">
                            <div class="slider-track" id="airbrush-buildup-rate-track"></div>
                            <div class="slider-handle" id="airbrush-buildup-rate-handle"></div>
                        </div>
                        <div class="slider-value" id="airbrush-buildup-rate-value">20/秒</div>
                    </div>
                    <div class="setting-description">ペンを止めていても時間で吹き重ねます。値は1秒あたりの吹き付け回数。0でOFF。</div>
                </div>

                <div class="setting-group">
                    <div class="setting-label">傾き (Tilt)</div>
                    <div class="slider-container">
                        <div class="slider" id="airbrush-tilt-strength-slider">
                            <div class="slider-track" id="airbrush-tilt-strength-track"></div>
                            <div class="slider-handle" id="airbrush-tilt-strength-handle"></div>
                        </div>
                        <div class="slider-value" id="airbrush-tilt-strength-value">0.50</div>
                    </div>
                    <div class="setting-description">ペンを傾けると吹き付けが楕円になり、ペン先の向く側へ広がります（傾き対応ペンのみ）。0で無効。</div>
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

            <div id="tab-help" class="ui-tab-content settings-help-tab ui-scrollbar">
                <div class="help-list">${shortcutHelpHtml}</div>
            </div>
        `;

        const closeBtn = this.popup.querySelector('.ui-close-button');
        if (closeBtn) {
            closeBtn.onclick = () => this.hide();
        }

        this._setupTabs();
    }

    _buildShortcutHelpHtml() {
        const sections = [
            {
                title: 'ツール・色',
                matches: action => action.startsWith('TOOL_') || action.startsWith('COLOR_') || action.startsWith('RULER_')
            },
            {
                title: '編集・履歴・レイヤー',
                matches: action => action === 'UNDO'
                    || action === 'REDO'
                    || action.startsWith('SELECT_')
                    || action.startsWith('SELECTION_')
                    || action.startsWith('LAYER_')
            },
            { title: '表示・操作', matches: action => action.startsWith('CAMERA_') },
            {
                title: 'アニメーション',
                matches: action => action.startsWith('CLIP_')
                    || action.startsWith('FRAME_')
                    || action.startsWith('GIF_')
                    || action.startsWith('ANIMATION_')
            },
            {
                title: 'パネル・保存',
                matches: action => action.startsWith('SETTINGS_')
                    || action.startsWith('EXPORT_')
                    || action.startsWith('ALBUM_')
                    || action.startsWith('QUICK_ACCESS_')
                    || action.startsWith('REFERENCE_PREVIEW_')
                    || action.startsWith('PANEL_LAYOUT_')
                    || action.startsWith('FOCUS_LINES_')
                    || action.startsWith('BALLOON_')
            }
        ];
        const shortcuts = TEGAKI_KEYMAP.getShortcutList();

        return sections.map(section => {
            const items = shortcuts.filter(shortcut => section.matches(shortcut.action));
            if (!items.length) return '';
            return `
                <div class="help-section-title">${this._escapeHtml(section.title)}</div>
                ${items.map(shortcut => `
                    <div class="help-item" data-shortcut-action="${this._escapeHtml(shortcut.action)}">
                        <span class="help-label">${this._escapeHtml(shortcut.description)}</span>
                        <span class="help-key">${this._escapeHtml(shortcut.keys.join(' / '))}</span>
                    </div>
                `).join('')}
            `;
        }).join('');
    }

    _escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
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
                // 非表示タブのcanvasは寸法0のため、表示時に描き直す。
                if (targetTab === 'pen') this._drawPressureCurveEditor();
                if (targetTab === 'spray') this._drawAirbrushDabPreview();
            };
        });
    }

    _cacheElements() {
        this.elements = {
            pressureSlider: document.getElementById('pressure-correction-slider'),
            pressureTrack: document.getElementById('pressure-track'),
            pressureHandle: document.getElementById('pressure-handle'),
            pressureValue: document.getElementById('pressure-value'),
            pressureOpacityToggle: document.getElementById('pressure-opacity-toggle'),
            pressureOpacitySlider: document.getElementById('pressure-opacity-slider'),
            pressureOpacityTrack: document.getElementById('pressure-opacity-track'),
            pressureOpacityHandle: document.getElementById('pressure-opacity-handle'),
            pressureOpacityValue: document.getElementById('pressure-opacity-value'),

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
            airbrushBuildupRateSlider: document.getElementById('airbrush-buildup-rate-slider'),
            airbrushBuildupRateTrack: document.getElementById('airbrush-buildup-rate-track'),
            airbrushBuildupRateHandle: document.getElementById('airbrush-buildup-rate-handle'),
            airbrushBuildupRateValue: document.getElementById('airbrush-buildup-rate-value'),
            penVelocityThinningSlider: document.getElementById('pen-velocity-thinning-slider'),
            penVelocityThinningTrack: document.getElementById('pen-velocity-thinning-track'),
            penVelocityThinningHandle: document.getElementById('pen-velocity-thinning-handle'),
            penVelocityThinningValue: document.getElementById('pen-velocity-thinning-value'),
            penPressureSmoothingSlider: document.getElementById('pen-pressure-smoothing-slider'),
            penPressureSmoothingTrack: document.getElementById('pen-pressure-smoothing-track'),
            penPressureSmoothingHandle: document.getElementById('pen-pressure-smoothing-handle'),
            penPressureSmoothingValue: document.getElementById('pen-pressure-smoothing-value'),
            penTiltStrengthSlider: document.getElementById('pen-tilt-strength-slider'),
            penTiltStrengthTrack: document.getElementById('pen-tilt-strength-track'),
            penTiltStrengthHandle: document.getElementById('pen-tilt-strength-handle'),
            penTiltStrengthValue: document.getElementById('pen-tilt-strength-value'),
            penTaperInSlider: document.getElementById('pen-taper-in-slider'),
            penTaperInTrack: document.getElementById('pen-taper-in-track'),
            penTaperInHandle: document.getElementById('pen-taper-in-handle'),
            penTaperInValue: document.getElementById('pen-taper-in-value'),
            penTaperOutSlider: document.getElementById('pen-taper-out-slider'),
            penTaperOutTrack: document.getElementById('pen-taper-out-track'),
            penTaperOutHandle: document.getElementById('pen-taper-out-handle'),
            penTaperOutValue: document.getElementById('pen-taper-out-value'),
            penDabSoftnessSlider: document.getElementById('pen-dab-softness-slider'),
            penDabSoftnessTrack: document.getElementById('pen-dab-softness-track'),
            penDabSoftnessHandle: document.getElementById('pen-dab-softness-handle'),
            penDabSoftnessValue: document.getElementById('pen-dab-softness-value'),
            penEdgeAASlider: document.getElementById('pen-edge-aa-slider'),
            penEdgeAATrack: document.getElementById('pen-edge-aa-track'),
            penEdgeAAHandle: document.getElementById('pen-edge-aa-handle'),
            penEdgeAAValue: document.getElementById('pen-edge-aa-value'),
            eraserDabSoftnessSlider: document.getElementById('eraser-dab-softness-slider'),
            eraserDabSoftnessTrack: document.getElementById('eraser-dab-softness-track'),
            eraserDabSoftnessHandle: document.getElementById('eraser-dab-softness-handle'),
            eraserDabSoftnessValue: document.getElementById('eraser-dab-softness-value'),
            eraserPressureStrengthSlider: document.getElementById('eraser-pressure-strength-slider'),
            eraserPressureStrengthTrack: document.getElementById('eraser-pressure-strength-track'),
            eraserPressureStrengthHandle: document.getElementById('eraser-pressure-strength-handle'),
            eraserPressureStrengthValue: document.getElementById('eraser-pressure-strength-value'),
            airbrushTiltStrengthSlider: document.getElementById('airbrush-tilt-strength-slider'),
            airbrushTiltStrengthTrack: document.getElementById('airbrush-tilt-strength-track'),
            airbrushTiltStrengthHandle: document.getElementById('airbrush-tilt-strength-handle'),
            airbrushTiltStrengthValue: document.getElementById('airbrush-tilt-strength-value'),

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
            animationAutoCreateNext: document.getElementById('animation-auto-create-next'),
            emergencyRecoveryEnabled: document.getElementById('emergency-recovery-enabled'),
            emergencyRecoveryInterval: document.getElementById('emergency-recovery-interval'),
            emergencyRecoveryOnHide: document.getElementById('emergency-recovery-on-hide'),
            shortcutHelpVisible: document.getElementById('shortcut-help-visible'),
            emergencyRecoveryStatus: document.getElementById('emergency-recovery-status'),

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
        this.eventBus?.on('emergency-recovery:saved', (payload = {}) => {
            this._updateEmergencyRecoveryStatusDisplay(payload);
        });
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
            
            const { min, max } = this._getSliderSpec(sliderType);

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
                
                const settingKey = this._getSliderSpec(type).settingKey;
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
                
                const { min, max } = this._getSliderSpec(type);

                const value = min + ((max - min) * percent / 100);
                this._updateGenericSlider(type, value);
                
                this.settingsManager?.set(this._getSliderSpec(type).settingKey, value);
            });
        };

        [
            'pressure', 'smoothing', 'pressureOpacity', 'penVelocityThinning', 'penTiltStrength',
            'penTaperIn', 'penTaperOut', 'penPressureSmoothing',
            'penDabSoftness', 'penEdgeAA', 'eraserDabSoftness', 'eraserPressureStrength',
            'airbrushFlow', 'airbrushSoftness', 'airbrushScatter', 'airbrushBuildupRate', 'airbrushTiltStrength'
        ].forEach(setupSliderEvents);
    }

    _updateGenericSlider(type, value) {
        const spec = this._getSliderSpec(type);
        const { min, max } = spec;

        let val = Math.max(min, Math.min(max, value));
        if (spec.integer) val = Math.round(val);
        this[`current${type.charAt(0).toUpperCase() + type.slice(1)}`] = val;

        const percent = ((val - min) / (max - min)) * 100;
        const track = this.elements[`${type}Track`];
        const handle = this.elements[`${type}Handle`];
        const display = this.elements[`${type}Value`];

        if (track) track.style.width = percent + '%';
        if (handle) handle.style.left = percent + '%';
        if (display) display.textContent = spec.format ? spec.format(val) : val.toFixed(2);
        if (type === 'airbrushFlow' || type === 'airbrushSoftness' || type === 'airbrushScatter') {
            this._scheduleAirbrushDabPreview();
        }
        this._scheduleBrushPresetRender();

        if (this.eventBus) {
            const eventName = `settings:${spec.settingKey.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}`;
            this.eventBus.emit(eventName, { value: val });
        }
    }

    /**
     * 汎用sliderの値域・保存key・表示形式の一覧。sliderを足す時はここへ1行足す。
     * パネル標準化の際はこの表をそのまま共通slider部品へ移せる形にしておく。
     */
    _getSliderSpec(type) {
        const specs = {
            pressure: { min: this.MIN_PRESSURE, max: this.MAX_PRESSURE, settingKey: 'pressureCorrection' },
            smoothing: { min: this.MIN_SMOOTHING, max: this.MAX_SMOOTHING, settingKey: 'smoothing' },
            pressureOpacity: { min: 0.0, max: 1.0, settingKey: 'pressureOpacityStrength' },
            penVelocityThinning: { min: 0.0, max: 0.9, settingKey: 'penVelocityThinning' },
            penPressureSmoothing: { min: 0.0, max: 1.0, settingKey: 'penPressureSmoothing' },
            penTiltStrength: { min: 0.0, max: 1.0, settingKey: 'penTiltStrength' },
            penDabSoftness: { min: 0.0, max: 1.0, settingKey: 'penDabSoftness' },
            penTaperIn: { min: 0, max: 300, integer: true, settingKey: 'penTaperIn', format: (v) => (v <= 0 ? 'OFF' : `${v}px`) },
            penTaperOut: { min: 0, max: 300, integer: true, settingKey: 'penTaperOut', format: (v) => (v <= 0 ? 'OFF' : `${v}px`) },
            penEdgeAA: { min: 0.0, max: 4.0, settingKey: 'penEdgeAA', format: (v) => `${v.toFixed(1)}px` },
            eraserDabSoftness: { min: 0.0, max: 1.0, settingKey: 'eraserDabSoftness' },
            eraserPressureStrength: { min: 0.0, max: 1.0, settingKey: 'eraserPressureStrength' },
            airbrushTiltStrength: { min: 0.0, max: 1.0, settingKey: 'airbrushTiltStrength' },
            airbrushFlow: { min: 0.01, max: 1.0, settingKey: 'airbrushFlow' },
            airbrushSoftness: { min: 0.0, max: 1.0, settingKey: 'airbrushSoftness' },
            airbrushScatter: { min: 0.0, max: 1.0, settingKey: 'airbrushScatter' },
            airbrushBuildupRate: {
                min: 0,
                max: 60,
                integer: true,
                settingKey: 'airbrushBuildupRate',
                format: (v) => (v <= 0 ? 'OFF' : `${v}/秒`)
            }
        };
        return specs[type] || { min: 0, max: 1, settingKey: type };
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
        this.elements.animationAutoCreateNext?.addEventListener('change', () => {
            this.settingsManager?.set(
                'animationAutoCreateOnNext',
                this.elements.animationAutoCreateNext.checked
            );
        });
        this.elements.emergencyRecoveryEnabled?.addEventListener('change', () => {
            this.settingsManager?.set(
                'emergencyRecoveryEnabled',
                this.elements.emergencyRecoveryEnabled.checked
            );
            this._syncEmergencyRecoveryControlState();
            this._updateEmergencyRecoveryStatusDisplay();
        });
        this.elements.emergencyRecoveryInterval?.addEventListener('change', () => {
            this.settingsManager?.set(
                'emergencyRecoveryIntervalSeconds',
                Number(this.elements.emergencyRecoveryInterval.value)
            );
            this._updateEmergencyRecoveryStatusDisplay();
        });
        this.elements.shortcutHelpVisible?.addEventListener('change', () => {
            this.settingsManager?.set('shortcutHelpVisible', this.elements.shortcutHelpVisible.checked);
        });
        this.elements.emergencyRecoveryOnHide?.addEventListener('change', () => {
            this.settingsManager?.set(
                'emergencyRecoveryOnHide',
                this.elements.emergencyRecoveryOnHide.checked
            );
            this._updateEmergencyRecoveryStatusDisplay();
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
            });
        });
        this._setupPressureCurveEditor();
        this.popup?.querySelectorAll('[data-stabilizer-mode]').forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const mode = btn.dataset.stabilizerMode;
                this.settingsManager?.set('stabilizerMode', mode);
                this._applyStabilizerModeUI(mode);
                this._scheduleBrushPresetRender();
            });
        });
        this._setupBrushPresets();
        this.elements.pressureOpacityToggle?.addEventListener('change', () => {
            this.settingsManager?.set('pressureOpacityEnabled', this.elements.pressureOpacityToggle.checked);
            this._scheduleBrushPresetRender();
        });
    }

    _getDefaults() {
        const managerDefaults = this.settingsManager?.getDefaults?.() || {};
        return {
            ...managerDefaults,
            pressureCorrection: 1.0,
            smoothing: 0.5,
            pressureCurve: 'linear',
            pressureOpacityEnabled: true,
            pressureOpacityStrength: 0.65,
            airbrushFlow: managerDefaults.airbrushFlow ?? 0.08,
            airbrushSoftness: managerDefaults.airbrushSoftness ?? 0.8,
            airbrushScatter: managerDefaults.airbrushScatter ?? 0.0,
            statusPanelVisible: true,
            bucketGapClose: 0,
            bucketUnderpaint: 1,
            bucketReferenceAllLayers: true,
            animationAutoCreateOnNext: true,
            emergencyRecoveryEnabled: true,
            emergencyRecoveryIntervalSeconds: 60,
            emergencyRecoveryOnHide: true,
            shortcutHelpVisible: true,
            historyAutoAdjust: true,
            historyMaxEntries: 250,
            historyMaxMemoryMB: 512
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
        this._updateGenericSlider('pressureOpacity', settings.pressureOpacityStrength ?? defaults.pressureOpacityStrength);
        this._updateGenericSlider('airbrushFlow', settings.airbrushFlow ?? defaults.airbrushFlow);
        this._updateGenericSlider('airbrushSoftness', settings.airbrushSoftness ?? defaults.airbrushSoftness);
        this._updateGenericSlider('airbrushScatter', settings.airbrushScatter ?? defaults.airbrushScatter);
        this._updateGenericSlider('airbrushBuildupRate', settings.airbrushBuildupRate ?? defaults.airbrushBuildupRate);
        this._updateGenericSlider('penVelocityThinning', settings.penVelocityThinning ?? defaults.penVelocityThinning);
        this._updateGenericSlider('penTiltStrength', settings.penTiltStrength ?? defaults.penTiltStrength);
        this._updateGenericSlider('penPressureSmoothing', settings.penPressureSmoothing ?? defaults.penPressureSmoothing);
        this._updateGenericSlider('penTaperIn', settings.penTaperIn ?? defaults.penTaperIn);
        this._updateGenericSlider('penTaperOut', settings.penTaperOut ?? defaults.penTaperOut);
        this._updateGenericSlider('penDabSoftness', settings.penDabSoftness ?? defaults.penDabSoftness);
        this._updateGenericSlider('penEdgeAA', settings.penEdgeAA ?? defaults.penEdgeAA);
        this._updateGenericSlider('eraserDabSoftness', settings.eraserDabSoftness ?? defaults.eraserDabSoftness);
        this._updateGenericSlider('eraserPressureStrength', settings.eraserPressureStrength ?? defaults.eraserPressureStrength);
        this._updateGenericSlider('airbrushTiltStrength', settings.airbrushTiltStrength ?? defaults.airbrushTiltStrength);
        this._updateBucketGapSlider(settings.bucketGapClose ?? defaults.bucketGapClose);
        this._updateBucketUnderpaintSlider(settings.bucketUnderpaint ?? defaults.bucketUnderpaint);
        this._setBucketRefVisibility(settings.bucketReferenceAllLayers ?? defaults.bucketReferenceAllLayers);
        this._applyPressureCurveUI(settings.pressureCurve ?? defaults.pressureCurve);
        this._applyStabilizerModeUI(settings.stabilizerMode ?? 'follow');
        this._setPressureOpacityEnabled(settings.pressureOpacityEnabled ?? defaults.pressureOpacityEnabled);
        this._setStatusPanelVisibility(settings.statusPanelVisible ?? defaults.statusPanelVisible);
        if (this.elements.animationAutoCreateNext) {
            this.elements.animationAutoCreateNext.checked = settings.animationAutoCreateOnNext !== false;
        }
        this._applyEmergencyRecoverySettingsUI(settings);
        this._applyHistorySettingsUI(settings);
    }

    _applyEmergencyRecoverySettingsUI(settings) {
        const allowedIntervals = [5, 10, 30, 60, 180, 300];
        const interval = Number(settings.emergencyRecoveryIntervalSeconds);
        if (this.elements.emergencyRecoveryEnabled) {
            this.elements.emergencyRecoveryEnabled.checked = settings.emergencyRecoveryEnabled !== false;
        }
        if (this.elements.emergencyRecoveryInterval) {
            this.elements.emergencyRecoveryInterval.value = String(
                allowedIntervals.includes(interval) ? interval : 60
            );
        }
        if (this.elements.shortcutHelpVisible) {
            this.elements.shortcutHelpVisible.checked = settings.shortcutHelpVisible !== false;
        }
        if (this.elements.emergencyRecoveryOnHide) {
            this.elements.emergencyRecoveryOnHide.checked = settings.emergencyRecoveryOnHide !== false;
        }
        this._syncEmergencyRecoveryControlState();
        this._updateEmergencyRecoveryStatusDisplay();
    }

    _syncEmergencyRecoveryControlState() {
        if (this.elements.emergencyRecoveryInterval) {
            this.elements.emergencyRecoveryInterval.disabled =
                this.elements.emergencyRecoveryEnabled?.checked !== true;
        }
    }

    _updateEmergencyRecoveryStatusDisplay(payload = null) {
        if (!this.elements.emergencyRecoveryStatus) return;
        const status = this.emergencyRecoveryStore?.getStatus?.() || {};
        const periodicEnabled = this.elements.emergencyRecoveryEnabled?.checked === true;
        const saveOnHide = this.elements.emergencyRecoveryOnHide?.checked === true;
        if (!periodicEnabled && !saveOnHide) {
            this.elements.emergencyRecoveryStatus.textContent = '自動記録: OFF';
            return;
        }

        const timestamp = Number(payload?.timestamp || status.lastSaveTime);
        if (!Number.isFinite(timestamp) || timestamp <= 0) {
            const mode = periodicEnabled ? '操作中' : '非表示時のみ';
            this.elements.emergencyRecoveryStatus.textContent = `最終記録: まだありません（${mode}）`;
            return;
        }
        this.elements.emergencyRecoveryStatus.textContent =
            `最終記録: ${new Date(timestamp).toLocaleTimeString()}`;
    }

    _setPressureOpacityEnabled(enabled) {
        if (this.elements.pressureOpacityToggle) {
            this.elements.pressureOpacityToggle.checked = enabled !== false;
        }
    }

    _applyHistorySettingsUI(settings) {
        const automatic = this.settingsManager?.getAutomaticHistoryDefaults?.()
            || { maxEntries: 250, maxMemoryMB: 512 };
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
                autoAdjust ? automatic.maxMemoryMB : (settings.historyMaxMemoryMB || 512)
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
        const usageRatio = usage.maxBytes > 0 ? usage.bytes / usage.maxBytes : 0;
        const formatLimit = (valueMB) => {
            return valueMB >= 1024
                ? `${(valueMB / 1024).toFixed(valueMB % 1024 === 0 ? 0 : 1)} GB`
                : `${Math.round(valueMB)} MB`;
        };
        const pressure = usageRatio >= 0.95 ? 'critical' : (usageRatio >= 0.8 ? 'warning' : 'normal');
        const suffix = pressure === 'critical'
            ? '　上限付近'
            : (pressure === 'warning' ? '　高め' : '');
        this.elements.historyUsage.dataset.pressure = pressure;
        this.elements.historyUsage.textContent =
            `履歴: ${usage.entries} / ${usage.maxEntries}　使用量: ${usedMB.toFixed(1)} MB / ${formatLimit(maxMB)}${suffix}`;
    }

    _applyStabilizerModeUI(mode) {
        this.popup?.querySelectorAll('[data-stabilizer-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.stabilizerMode === (mode === 'string' ? 'string' : 'follow'));
        });
    }

    _applyPressureCurveUI(curve) {
        const curveBtns = this.popup.querySelectorAll('.pressure-curve-btn[data-curve]');
        curveBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-curve') === curve);
        });
        this._drawPressureCurveEditor();
        this._scheduleBrushPresetRender();
    }

    _scheduleAirbrushDabPreview() {
        if (this.dabPreviewFrame) return;
        const schedule = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (fn) => setTimeout(fn, 16);
        this.dabPreviewFrame = schedule(() => {
            this.dabPreviewFrame = null;
            this._drawAirbrushDabPreview();
        });
    }

    /**
     * エアブラシ先端のプレビュー。描画engineと同じfalloff・spacing補正flow・scatterを
     * CPUで小さく再現する(左: 1dab、右: 直線strokeの累積)。
     */
    _drawAirbrushDabPreview() {
        const canvas = this.popup?.querySelector('#airbrush-dab-preview');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cssW = Math.round(rect.width || canvas.width);
        const cssH = Math.round(rect.height || canvas.height);
        if (cssW <= 0 || cssH <= 0) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = Math.round(cssW * dpr);
        const H = Math.round(cssH * dpr);
        if (canvas.width !== W || canvas.height !== H) {
            canvas.width = W;
            canvas.height = H;
        }

        const softness = Number(this.currentAirbrushSoftness ?? 0.8);
        const flow = Math.max(0.001, Math.min(1, Number(this.currentAirbrushFlow ?? 0.08)));
        const scatter = Number(this.currentAirbrushScatter ?? 0);
        const spacingRatio = Number(window.TEGAKI_CONFIG?.BRUSH_DEFAULTS?.airbrushSpacingRatio ?? 0.1);
        const dabAlpha = 1 - Math.pow(1 - flow, spacingRatio / 0.18);

        const style = getComputedStyle(document.documentElement);
        const hex = (style.getPropertyValue('--futaba-maroon').trim() || '#800000').replace('#', '');
        const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
        const color = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) || 0);

        const R = Math.max(4, Math.floor(H / 2) - 4 * dpr);
        const remaining = new Float32Array(W * H).fill(1);
        const stamp = (cx, cy, alpha) => {
            const x0 = Math.max(0, Math.floor(cx - R));
            const x1 = Math.min(W - 1, Math.ceil(cx + R));
            const y0 = Math.max(0, Math.floor(cy - R));
            const y1 = Math.min(H - 1, Math.ceil(cy + R));
            for (let y = y0; y <= y1; y++) {
                for (let x = x0; x <= x1; x++) {
                    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / R;
                    if (d >= 1) continue;
                    remaining[y * W + x] *= 1 - alpha * computeDabFalloff(d, softness);
                }
            }
        };

        // 左: 1回の吹き付け(形が見えるよう濃度1で表示)
        const singleCx = R + 4 * dpr;
        stamp(singleCx, H / 2, 1);

        // 右: 直線strokeの累積(engineと同じ間隔・flow・scatter)
        let seed = 7;
        const random = () => {
            seed = (seed * 16807) % 2147483647;
            return seed / 2147483647;
        };
        const startX = singleCx + R * 2 + 10 * dpr;
        const endX = W - R - 4 * dpr;
        const spacing = Math.max(0.5, 2 * R * spacingRatio);
        for (let x = startX; x <= endX; x += spacing) {
            let cx = x;
            let cy = H / 2;
            if (scatter > 0) {
                const angle = random() * Math.PI * 2;
                const distance = random() * 2 * R * scatter * 0.2;
                cx += Math.cos(angle) * distance;
                cy += Math.sin(angle) * distance;
            }
            stamp(cx, cy, dabAlpha);
        }

        const ctx = canvas.getContext('2d');
        const image = ctx.createImageData(W, H);
        for (let i = 0; i < W * H; i++) {
            const a = 1 - remaining[i];
            image.data[i * 4] = color[0];
            image.data[i * 4 + 1] = color[1];
            image.data[i * 4 + 2] = color[2];
            image.data[i * 4 + 3] = Math.round(a * 255);
        }
        ctx.putImageData(image, 0, 0);
    }

    _getBrushPresetList(tool) {
        const user = this.settingsManager?.get?.('brushPresets')?.[tool] || [];
        return [
            ...(BUILTIN_BRUSH_PRESETS[tool] || []).map(preset => ({ ...preset, builtin: true })),
            ...user.map(preset => ({ ...preset, builtin: false }))
        ];
    }

    _getActiveBrushPreset(tool) {
        const getSetting = (key) => this.settingsManager?.get?.(key);
        const list = this._getBrushPresetList(tool);
        // 同じ値のpresetが複数あれば、最後に選んだ / 保存したものを優先する。
        const selectedId = this.selectedBrushPresetIds?.[tool];
        const selected = list.find(preset => preset.id === selectedId);
        if (selected && brushPresetMatches(selected, tool, getSetting)) return selected;
        return list.find(preset => brushPresetMatches(preset, tool, getSetting)) || null;
    }

    _setSelectedBrushPreset(tool, id) {
        this.selectedBrushPresetIds = { ...(this.selectedBrushPresetIds || {}), [tool]: id };
    }

    _scheduleBrushPresetRender() {
        if (this.brushPresetFrame) return;
        const schedule = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (fn) => setTimeout(fn, 16);
        this.brushPresetFrame = schedule(() => {
            this.brushPresetFrame = null;
            this._renderBrushPresets();
        });
    }

    /** presetボタン列を描き直す。現在値と一致するpresetをactive表示する。 */
    _renderBrushPresets() {
        this.popup?.querySelectorAll('.brush-preset-list[data-preset-tool]').forEach(list => {
            const tool = list.dataset.presetTool;
            const active = this._getActiveBrushPreset(tool);
            list.innerHTML = '';
            this._getBrushPresetList(tool).forEach(preset => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'pressure-curve-btn brush-preset-btn';
                button.dataset.presetId = preset.id;
                button.dataset.presetTool = tool;
                button.textContent = preset.name;
                button.title = preset.builtin ? `${preset.name}（組み込み）` : preset.name;
                button.classList.toggle('active', preset.id === active?.id);
                list.appendChild(button);
            });
            this._renderQtpPresetToggles(list, tool);
            const deleteButton = this.popup.querySelector(`[data-preset-action="delete"][data-preset-tool="${tool}"]`);
            if (deleteButton) deleteButton.disabled = !active || active.builtin;
        });
    }

    /** QTPの二行目に出すpresetを選ぶチェック列(presetごと)。 */
    _renderQtpPresetToggles(list, tool) {
        let box = list.nextElementSibling;
        if (!box?.classList?.contains('brush-preset-qtp')) {
            box = document.createElement('div');
            box.className = 'brush-preset-qtp';
            list.after(box);
        }
        const presets = this._getBrushPresetList(tool);
        const ids = this.settingsManager?.get?.('qtpBrushPresetIds')?.[tool];
        const shown = Array.isArray(ids) ? new Set(ids) : new Set(presets.map(p => p.id));
        box.innerHTML = '<span class="brush-preset-qtp-label">QTPに出す</span>';
        presets.forEach(preset => {
            const label = document.createElement('label');
            label.className = 'brush-preset-qtp-item';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = shown.has(preset.id);
            input.addEventListener('change', () => {
                const current = this.settingsManager.get('qtpBrushPresetIds') || { pen: null, airbrush: null, eraser: null };
                const next = presets.map(p => p.id).filter(id => (id === preset.id ? input.checked : shown.has(id)));
                this.settingsManager.set('qtpBrushPresetIds', { ...current, [tool]: next });
                this._renderBrushPresets();
            });
            const text = document.createElement('span');
            text.textContent = preset.name;
            label.append(input, text);
            box.appendChild(label);
        });
    }

    _applyBrushPreset(tool, presetId) {
        const preset = this._getBrushPresetList(tool).find(item => item.id === presetId);
        if (!preset || !this.settingsManager) return;
        applyBrushPresetValues(tool, preset, this.settingsManager);
        this._setSelectedBrushPreset(tool, preset.id);
        this._applySettingsToUI(this.settingsManager.get());
        this._drawPressureCurveEditor();
        this._drawAirbrushDabPreview();
        this._renderBrushPresets();
    }

    _saveBrushPreset(tool) {
        if (!this.settingsManager) return;
        const all = this.settingsManager.get('brushPresets') || { pen: [], airbrush: [], eraser: [] };
        const list = Array.isArray(all[tool]) ? [...all[tool]] : [];
        if (list.length >= MAX_USER_BRUSH_PRESETS) {
            window.alert?.(`保存できるプリセットは${MAX_USER_BRUSH_PRESETS}件までです。不要なものを削除してください。`);
            return;
        }
        const defaultName = `${tool === 'pen' ? 'ペン' : 'エアブラシ'} ${list.length + 1}`;
        const name = typeof window.prompt === 'function' ? window.prompt('プリセット名', defaultName) : defaultName;
        if (name === null || !String(name).trim()) return;
        const id = `user-${tool}-${Date.now().toString(36)}`;
        this._setSelectedBrushPreset(tool, id);
        list.push({
            id,
            name: String(name).trim().slice(0, 24),
            values: captureBrushPresetValues(tool, key => this.settingsManager.get(key))
        });
        this.settingsManager.set('brushPresets', { ...all, [tool]: list });
        this._renderBrushPresets();
    }

    _deleteActiveBrushPreset(tool) {
        const active = this._getActiveBrushPreset(tool);
        if (!active || active.builtin || !this.settingsManager) return;
        if (typeof window.confirm === 'function' && !window.confirm(`プリセット「${active.name}」を削除しますか？`)) return;
        const all = this.settingsManager.get('brushPresets') || { pen: [], airbrush: [], eraser: [] };
        const list = (all[tool] || []).filter(preset => preset.id !== active.id);
        this.settingsManager.set('brushPresets', { ...all, [tool]: list });
        this._renderBrushPresets();
    }

    _setupBrushPresets() {
        if (!this.popup || this.popup.dataset.brushPresetsReady === '1') return;
        this.popup.dataset.brushPresetsReady = '1';
        this.popup.addEventListener('pointerdown', (e) => {
            const presetButton = e.target.closest?.('.brush-preset-btn[data-preset-id]');
            const actionButton = e.target.closest?.('[data-preset-action]');
            if (!presetButton && !actionButton) return;
            e.preventDefault();
            e.stopPropagation();
            if (presetButton) {
                this._applyBrushPreset(presetButton.dataset.presetTool, presetButton.dataset.presetId);
            } else if (actionButton.dataset.presetAction === 'save') {
                this._saveBrushPreset(actionButton.dataset.presetTool);
            } else if (actionButton.dataset.presetAction === 'delete' && !actionButton.disabled) {
                this._deleteActiveBrushPreset(actionButton.dataset.presetTool);
            }
        });
        this._renderBrushPresets();
    }

    /** 現在のカーブ設定を制御点で返す(presetは近似点、customは保存点)。 */
    _getEditorCurvePoints() {
        const curve = this.settingsManager?.get?.('pressureCurve') ?? 'linear';
        if (curve === 'custom') {
            return normalizePressureCurvePoints(this.settingsManager?.get?.('pressureCurvePoints'))
                || PRESSURE_CURVE_PRESETS.linear.map(p => [...p]);
        }
        return (PRESSURE_CURVE_PRESETS[curve] || PRESSURE_CURVE_PRESETS.linear).map(p => [...p]);
    }

    /**
     * 筆圧カーブの2次元編集(入力筆圧→実効筆圧)。見た目は既存CSS tokenに合わせた最小実装で、
     * パネル標準化時に部品化しやすいよう描画と操作をこのメソッド群に閉じている。
     */
    _setupPressureCurveEditor() {
        const canvas = this.popup?.querySelector('#pressure-curve-editor');
        if (!canvas || canvas.dataset.ready === '1') return;
        canvas.dataset.ready = '1';
        this.curveEditor = { canvas, points: null, dragIndex: -1, pointerId: null };

        const PAD = 10;
        const HIT_RADIUS = 9;
        const toCurve = (e) => {
            const rect = canvas.getBoundingClientRect();
            const w = rect.width - PAD * 2;
            const h = rect.height - PAD * 2;
            return [
                Math.max(0, Math.min(1, (e.clientX - rect.left - PAD) / w)),
                Math.max(0, Math.min(1, 1 - (e.clientY - rect.top - PAD) / h))
            ];
        };
        const findPoint = (e, points) => {
            const rect = canvas.getBoundingClientRect();
            const w = rect.width - PAD * 2;
            const h = rect.height - PAD * 2;
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            let best = -1;
            let bestDist = HIT_RADIUS;
            points.forEach(([x, y], i) => {
                const d = Math.hypot(PAD + x * w - px, PAD + (1 - y) * h - py);
                if (d <= bestDist) { best = i; bestDist = d; }
            });
            return best;
        };
        const commit = () => {
            const points = normalizePressureCurvePoints(this.curveEditor.points);
            if (!points) return;
            this.settingsManager?.set('pressureCurvePoints', points);
            this.settingsManager?.set('pressureCurve', 'custom');
            this._applyPressureCurveUI('custom');
        };

        canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const points = this._getEditorCurvePoints();
            let index = findPoint(e, points);
            if (index < 0) {
                if (points.length >= MAX_PRESSURE_CURVE_POINTS) return;
                const [x, y] = toCurve(e);
                if (x <= 0.01 || x >= 0.99) return;
                points.push([x, y]);
                points.sort((a, b) => a[0] - b[0]);
                index = points.findIndex(p => p[0] === x && p[1] === y);
            }
            this.curveEditor.points = points;
            this.curveEditor.dragIndex = index;
            this.curveEditor.pointerId = e.pointerId;
            try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
            this._drawPressureCurveEditor(points);
        });
        canvas.addEventListener('pointermove', (e) => {
            const editor = this.curveEditor;
            if (editor.dragIndex < 0 || e.pointerId !== editor.pointerId) return;
            e.preventDefault();
            const points = editor.points;
            const i = editor.dragIndex;
            const [x, y] = toCurve(e);
            const isEnd = i === 0 || i === points.length - 1;
            // 端点はx固定(0/1)、内部点は隣の点を越えない。
            const minX = isEnd ? points[i][0] : points[i - 1][0] + 0.02;
            const maxX = isEnd ? points[i][0] : points[i + 1][0] - 0.02;
            points[i] = [Math.max(minX, Math.min(maxX, x)), y];
            this._drawPressureCurveEditor(points);
        });
        const end = (e) => {
            const editor = this.curveEditor;
            if (editor.dragIndex < 0 || e.pointerId !== editor.pointerId) return;
            editor.dragIndex = -1;
            editor.pointerId = null;
            try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
            commit();
        };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        canvas.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const points = this._getEditorCurvePoints();
            const index = findPoint(e, points);
            if (index <= 0 || index >= points.length - 1) return;
            points.splice(index, 1);
            this.curveEditor.points = points;
            commit();
        });

        this._setupPressureCurveLiveInput();
        this._drawPressureCurveEditor();
    }

    /**
     * ペンの現在筆圧をカーブ上の点として表示する(調整用)。
     * 横軸は筆圧補正後の入力、縦軸はカーブ適用後で、pointer-handlerと同じ順で計算する。
     */
    _setupPressureCurveLiveInput() {
        const LIVE_FADE_MS = 900;
        const onPointer = (e) => {
            const editor = this.curveEditor;
            if (!editor || e.pointerType !== 'pen') return;
            // 設定画面のペンタブが表示されている時だけ描く。
            if (!editor.canvas.isConnected || editor.canvas.offsetParent === null) return;
            const raw = Number(e.pressure);
            if (!Number.isFinite(raw) || raw <= 0) return;
            const correction = Number(this.settingsManager?.get?.('pressureCorrection') ?? 1) || 1;
            editor.live = { x: Math.max(0, Math.min(1, raw * correction)), time: performance.now() };
            if (!editor.liveFrame) {
                editor.liveFrame = requestAnimationFrame(() => {
                    editor.liveFrame = null;
                    this._drawPressureCurveEditor(editor.dragIndex >= 0 ? editor.points : null);
                });
            }
            clearTimeout(editor.liveFadeTimer);
            editor.liveFadeTimer = setTimeout(() => this._drawPressureCurveEditor(), LIVE_FADE_MS + 20);
        };
        window.addEventListener('pointermove', onPointer, { capture: true, passive: true });
        window.addEventListener('pointerdown', onPointer, { capture: true, passive: true });
        this.curveEditor.liveFadeMs = LIVE_FADE_MS;
    }

    /** 表示中カーブでの実効筆圧。presetは実際の評価式、customは制御点。 */
    _evaluateEditorCurve(points, x) {
        const curve = this.settingsManager?.get?.('pressureCurve') ?? 'linear';
        if (this.curveEditor?.dragIndex >= 0 || curve === 'custom') return evaluatePressureCurve(points, x);
        if (curve === 'ease-in') return 1 - (1 - x) * (1 - x);
        if (curve === 'ease-out') return x * x;
        return x;
    }

    _drawPressureCurveEditor(points = null) {
        const canvas = this.curveEditor?.canvas;
        if (!canvas) return;
        const pts = points || this._getEditorCurvePoints();
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const cssW = rect.width || canvas.width;
        const cssH = rect.height || canvas.height;
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
            canvas.width = Math.round(cssW * dpr);
            canvas.height = Math.round(cssH * dpr);
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);

        const style = getComputedStyle(document.documentElement);
        const maroon = style.getPropertyValue('--futaba-maroon').trim() || '#800000';
        const medium = style.getPropertyValue('--futaba-light-medium').trim() || '#d4a8a0';
        const active = style.getPropertyValue('--active-border').trim() || '#ff8c42';
        const PAD = 10;
        const w = cssW - PAD * 2;
        const h = cssH - PAD * 2;
        const X = (x) => PAD + x * w;
        const Y = (y) => PAD + (1 - y) * h;

        ctx.lineWidth = 1;
        ctx.strokeStyle = medium;
        ctx.globalAlpha = 0.6;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath(); ctx.moveTo(X(i / 4), Y(0)); ctx.lineTo(X(i / 4), Y(1)); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(X(0), Y(i / 4)); ctx.lineTo(X(1), Y(i / 4)); ctx.stroke();
        }
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = maroon;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
            const x = i / 64;
            // presetは実際の評価式で描き、ペンの点と線を一致させる。
            const y = this._evaluateEditorCurve(pts, x);
            if (i === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
        }
        ctx.stroke();

        pts.forEach(([x, y], i) => {
            ctx.beginPath();
            ctx.arc(X(x), Y(y), i === this.curveEditor?.dragIndex ? 5 : 4, 0, Math.PI * 2);
            ctx.fillStyle = i === this.curveEditor?.dragIndex ? active : '#ffffee';
            ctx.fill();
            ctx.strokeStyle = maroon;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        const live = this.curveEditor?.live;
        const liveAge = live ? performance.now() - live.time : Infinity;
        if (live && liveAge < (this.curveEditor.liveFadeMs ?? 900)) {
            const y = this._evaluateEditorCurve(pts, live.x);
            ctx.globalAlpha = Math.max(0.25, 1 - liveAge / (this.curveEditor.liveFadeMs ?? 900));
            ctx.strokeStyle = active;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath(); ctx.moveTo(X(live.x), Y(0)); ctx.lineTo(X(live.x), Y(y)); ctx.lineTo(X(0), Y(y)); ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(X(live.x), Y(y), 5, 0, Math.PI * 2);
            ctx.fillStyle = active;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = maroon;
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${live.x.toFixed(2)} → ${y.toFixed(2)}`, X(1), Y(0) - 4);
        }
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
        const wasVisible = this.isVisible === true;
        if (!this.popup) this._ensurePopupElement();
        if (!this.popup) return;
        if (!this.initialized) this.initialize();
        this.popup.classList.add('show');
        this.isVisible = true;
        this._loadSettings();
        if (!wasVisible) {
            this.eventBus.emit('popup:shown', { name: 'settings' });
        }
    }

    hide() {
        if (!this.popup) return;
        const wasVisible = this.isVisible === true;
        this.popup.classList.remove('show');
        this.isVisible = false;
        if (wasVisible) {
            this.eventBus.emit('popup:hidden', { name: 'settings' });
        }
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
