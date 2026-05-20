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
import { attachPopupDrag } from './popup-drag-helper.js';

export class SettingsPopup {
    constructor(dependencies = {}) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = TegakiEventBus;
        this.settingsManager = this._getSettingsManager();
        
        this.popup = null;
        this.isVisible = false;
        this.initialized = false;
        
        this.isDraggingPressure = false;
        this.isDraggingSmoothing = false;
        
        this.activeSliderPointerId = null;
        this.popupDragCleanup = null;
        
        this.elements = {};
        
        this.currentPressure = 1.0;
        this.currentSmoothing = 0.5;
        
        this.MIN_PRESSURE = 0.1;
        this.MAX_PRESSURE = 3.0;
        this.MIN_SMOOTHING = 0.0;
        this.MAX_SMOOTHING = 1.0;
        
        this._ensurePopupElement();
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        if (!this.eventBus) return;
        
        this.eventBus.on('ui:open-settings', () => {
            this.show();
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
            this.popup.classList.remove('show');
            this.popup.style.display = '';
            
            // 重要: スライダー等が存在しない場合は、DOMBuilder版（枠のみ）と判断して中身を構築する
            if (!document.getElementById('pressure-correction-slider')) {
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
        const container = document.querySelector('.canvas-area') || document.body;
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
        
        // DOMBuilderがあれば閉じるボタンを利用、なければ自前で構築
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
                <button class="ui-tab-btn" data-tab="help">ショートカット</button>
            </div>

            <div id="tab-settings" class="ui-tab-content active">
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
                    <div class="setting-label">筆圧カーブ</div>
                    <div class="pressure-curve-selection">
                        <button class="pressure-curve-btn active" data-curve="linear">リニア</button>
                        <button class="pressure-curve-btn" data-curve="ease-in">軽め</button>
                        <button class="pressure-curve-btn" data-curve="ease-out">重め</button>
                    </div>
                </div>
                
                <div class="setting-group">
                    <div class="setting-label">ステータスパネル</div>
                    <div class="status-panel-controls">
                        <button id="status-panel-toggle">非表示</button>
                        <span id="status-panel-state">表示中</span>
                    </div>
                </div>
            </div>

            <div id="tab-help" class="ui-tab-content ui-scrollbar" style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
                <div class="help-list">
                    <div style="font-size: 11px; font-weight: 700; color: var(--futaba-maroon); margin: 4px 0 8px 4px; border-left: 3px solid var(--futaba-maroon); padding-left: 8px;">ツール</div>
                    <div class="help-item"><span class="help-label">ペンツール</span><span class="help-key">B</span></div>
                    <div class="help-item"><span class="help-label">消しゴムツール</span><span class="help-key">E</span></div>
                    <div class="help-item"><span class="help-label">塗りつぶしツール</span><span class="help-key">G</span></div>
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
                
                <div style="margin-top: 20px; padding: 10px; background: rgba(255, 140, 66, 0.08); border: 1px solid rgba(255, 140, 66, 0.2); border-radius: 6px; font-size: 11px; color: var(--text-primary); line-height: 1.6;">
                    <b style="color: #ff6600;">✨ 変形モード(V) の小技:</b><br>
                    ・<b>矢印キー:</b> 1pxずつ微調整<br>
                    ・<b>H キー:</b> 左右反転<br>
                    ・<b>Shift + H キー:</b> 上下反転
                </div>
            </div>
        `;

        // 閉じるボタンのイベント紐付け
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
            
            statusToggle: document.getElementById('status-panel-toggle'),
            statusState: document.getElementById('status-panel-state')
        };
        
        // インラインスタイル指定を削除 (CSS 側で一括管理)
    }

    
    initialize() {
        if (this.initialized) return;
        
        this._cacheElements();
        this._setupSliders();
        this._setupPopupDrag();
        this._setupButtons();
        this._loadSettings();
        
        this.initialized = true;
    }

    _setupPopupDrag() {
        if (!this.popup) return;
        this.popupDragCleanup = attachPopupDrag(this.popup);
    }
    
    _setupSliders() {
        const globalMoveHandler = (e) => {
            if (!this.isDraggingPressure && !this.isDraggingSmoothing) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            if (this.isDraggingPressure && this.activeSliderPointerId === e.pointerId) {
                const rect = this.elements.pressureSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_PRESSURE + ((this.MAX_PRESSURE - this.MIN_PRESSURE) * percent / 100);
                this._updatePressureSlider(value);
            }
            
            if (this.isDraggingSmoothing && this.activeSliderPointerId === e.pointerId) {
                const rect = this.elements.smoothingSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_SMOOTHING + ((this.MAX_SMOOTHING - this.MIN_SMOOTHING) * percent / 100);
                this._updateSmoothingSlider(value);
            }
        };
        
        const globalUpHandler = (e) => {
            if (this.activeSliderPointerId !== e.pointerId) return;
            
            if (this.isDraggingPressure) {
                if (this.elements.pressureHandle.releasePointerCapture) {
                    try {
                        this.elements.pressureHandle.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                }
                if (this.settingsManager) {
                    this.settingsManager.set('pressureCorrection', this.currentPressure);
                }
            }
            
            if (this.isDraggingSmoothing) {
                if (this.elements.smoothingHandle.releasePointerCapture) {
                    try {
                        this.elements.smoothingHandle.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                }
                if (this.settingsManager) {
                    this.settingsManager.set('smoothing', this.currentSmoothing);
                }
            }
            
            this.isDraggingPressure = false;
            this.isDraggingSmoothing = false;
            this.activeSliderPointerId = null;
        };
        
        document.addEventListener('pointermove', globalMoveHandler, { passive: false, capture: true });
        document.addEventListener('pointerup', globalUpHandler, { capture: true });
        document.addEventListener('pointercancel', globalUpHandler, { capture: true });
        
        this._globalMoveHandler = globalMoveHandler;
        this._globalUpHandler = globalUpHandler;
        
        this.elements.pressureHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingPressure = true;
            this.activeSliderPointerId = e.pointerId;
            this.elements.pressureHandle.style.cursor = 'grabbing';
            
            if (this.elements.pressureHandle.setPointerCapture) {
                try {
                    this.elements.pressureHandle.setPointerCapture(e.pointerId);
                } catch (err) {}
            }
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.elements.smoothingHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingSmoothing = true;
            this.activeSliderPointerId = e.pointerId;
            this.elements.smoothingHandle.style.cursor = 'grabbing';
            
            if (this.elements.smoothingHandle.setPointerCapture) {
                try {
                    this.elements.smoothingHandle.setPointerCapture(e.pointerId);
                } catch (err) {}
            }
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.elements.pressureSlider.addEventListener('pointerdown', (e) => {
            if (e.target === this.elements.pressureHandle) return;
            const rect = this.elements.pressureSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_PRESSURE + ((this.MAX_PRESSURE - this.MIN_PRESSURE) * percent / 100);
            this._updatePressureSlider(value);
            if (this.settingsManager) {
                this.settingsManager.set('pressureCorrection', this.currentPressure);
            }
        });
        
        this.elements.smoothingSlider.addEventListener('pointerdown', (e) => {
            if (e.target === this.elements.smoothingHandle) return;
            const rect = this.elements.smoothingSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_SMOOTHING + ((this.MAX_SMOOTHING - this.MIN_SMOOTHING) * percent / 100);
            this._updateSmoothingSlider(value);
            if (this.settingsManager) {
                this.settingsManager.set('smoothing', this.currentSmoothing);
            }
        });
    }
    
    _updatePressureSlider(value) {
        this.currentPressure = Math.max(this.MIN_PRESSURE, Math.min(this.MAX_PRESSURE, value));
        const percent = ((this.currentPressure - this.MIN_PRESSURE) / (this.MAX_PRESSURE - this.MIN_PRESSURE)) * 100;
        
        this.elements.pressureTrack.style.width = percent + '%';
        this.elements.pressureHandle.style.left = percent + '%';
        this.elements.pressureValue.textContent = this.currentPressure.toFixed(2);
        
        if (this.eventBus) {
            this.eventBus.emit('settings:pressure-correction', { value: this.currentPressure });
        }
    }
    
    _updateSmoothingSlider(value) {
        this.currentSmoothing = Math.max(this.MIN_SMOOTHING, Math.min(this.MAX_SMOOTHING, value));
        const percent = ((this.currentSmoothing - this.MIN_SMOOTHING) / (this.MAX_SMOOTHING - this.MIN_SMOOTHING)) * 100;
        
        this.elements.smoothingTrack.style.width = percent + '%';
        this.elements.smoothingHandle.style.left = percent + '%';
        this.elements.smoothingValue.textContent = this.currentSmoothing.toFixed(2);
        
        if (this.eventBus) {
            this.eventBus.emit('settings:smoothing', { value: this.currentSmoothing });
        }
    }
    
    _setupButtons() {
        if (this.elements.statusToggle) {
            this.elements.statusToggle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._toggleStatusPanel();
            });
        }
        
        const curveBtns = document.querySelectorAll('.pressure-curve-btn');
        curveBtns.forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const curve = e.currentTarget.getAttribute('data-curve');
                if (!curve) return;
                
                this._applyPressureCurveUI(curve);
                
                if (this.settingsManager) {
                    this.settingsManager.set('pressureCurve', curve);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('settings:pressure-curve', { curve });
                }
            });
        });
    }
    
    _getDefaults() {
        return {
            pressureCorrection: 1.0,
            smoothing: 0.5,
            pressureCurve: 'linear',
            statusPanelVisible: true
        };
    }
    
    _loadSettings() {
        let settings;
        
        if (this.settingsManager) {
            settings = this.settingsManager.get();
        } else {
            settings = this._getDefaults();
        }
        
        this._applySettingsToUI(settings);
    }
    
    _applySettingsToUI(settings) {
        const defaults = this._getDefaults();
        
        const pressure = settings.pressureCorrection !== undefined ? settings.pressureCorrection : defaults.pressureCorrection;
        this._updatePressureSlider(pressure);
        
        const smoothing = settings.smoothing !== undefined ? settings.smoothing : defaults.smoothing;
        this._updateSmoothingSlider(smoothing);
        
        if (settings.pressureCurve !== undefined) {
            this._applyPressureCurveUI(settings.pressureCurve);
        }
        
        if (settings.statusPanelVisible !== undefined) {
            this._setStatusPanelVisibility(settings.statusPanelVisible);
        }
    }
    
    _applyPressureCurveUI(curve) {
        const curveBtns = document.querySelectorAll('.pressure-curve-btn');
        curveBtns.forEach(btn => {
            const btnCurve = btn.getAttribute('data-curve');
            if (btnCurve === curve) {
                btn.classList.add('active');
                btn.style.background = 'rgba(207, 156, 151, 0.82)';
                btn.style.borderColor = 'var(--futaba-medium)';
                btn.style.color = 'var(--futaba-maroon)';
            } else {
                btn.classList.remove('active');
                btn.style.background = 'rgba(255, 255, 238, 0.62)';
                btn.style.borderColor = 'rgba(207, 156, 151, 0.78)';
                btn.style.color = 'var(--futaba-maroon)';
            }
        });
    }
    
    _toggleStatusPanel() {
        const statusPanel = document.querySelector('.status-panel');
        if (!statusPanel) return;
        
        const isVisible = statusPanel.style.display !== 'none';
        this._setStatusPanelVisibility(!isVisible);
        
        if (this.settingsManager) {
            this.settingsManager.set('statusPanelVisible', !isVisible);
        }
    }
    
    _setStatusPanelVisibility(visible) {
        const statusPanel = document.querySelector('.status-panel');
        if (!statusPanel) return;
        
        statusPanel.style.display = visible ? 'flex' : 'none';
        
        if (this.elements.statusToggle) {
            this.elements.statusToggle.textContent = visible ? '非表示' : '表示';
        }
        if (this.elements.statusState) {
            this.elements.statusState.textContent = visible ? '表示中' : '非表示中';
        }
    }
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        if (!this.initialized) {
            this.initialize();
        }
        
        this.popup.classList.add('show');
        this.isVisible = true;
        
        if (this.initialized) {
            this._loadSettings();
        }
    }
    
    hide() {
        if (!this.popup) return;
        
        this.popup.classList.remove('show');
        this.isVisible = false;
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    destroy() {
        if (this._globalMoveHandler) {
            document.removeEventListener('pointermove', this._globalMoveHandler, true);
            document.removeEventListener('pointerup', this._globalUpHandler, true);
            document.removeEventListener('pointercancel', this._globalUpHandler, true);
            this._globalMoveHandler = null;
            this._globalUpHandler = null;
        }
        if (this.popupDragCleanup) {
            this.popupDragCleanup();
            this.popupDragCleanup = null;
        }
        
        this.elements = {};
        this.initialized = false;
    }
}

// 下位互換性のためにグローバルに登録
window.SettingsPopup = SettingsPopup;
