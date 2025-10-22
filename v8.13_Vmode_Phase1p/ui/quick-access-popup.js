// ===== ui/quick-access-popup.js =====
// 責務: ペン設定クイックアクセスポップアップ
// 統一スライダーパターン（settings-popup.js準拠）

(function() {
    'use strict';

    class QuickAccessPopup {
        constructor(config = {}) {
            this.config = config;
            this.eventBus = config.eventBus || window.TegakiEventBus;
            this.panel = null;
            this.isVisible = false;
            this.isDraggingSize = false;
            this.isDraggingOpacity = false;
            
            // DOM要素参照
            this.sizeSlider = null;
            this.sizeTrack = null;
            this.sizeHandle = null;
            this.sizeDisplay = null;
            
            this.opacitySlider = null;
            this.opacityTrack = null;
            this.opacityHandle = null;
            this.opacityDisplay = null;
            
            this._init();
        }

        _init() {
            this._createPanel();
            this._attachEventListeners();
            this._loadCurrentSettings();
        }

        _createPanel() {
            this.panel = document.createElement('div');
            this.panel.id = 'quick-access-popup';
            this.panel.className = 'popup-panel';
            this.panel.style.cssText = 'left: 70px; top: 60px;';
            
            this.panel.innerHTML = `
                <!-- カラーパレット -->
                <div style="margin-bottom: 20px; padding: 0 8px;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px;">
                        色
                    </div>
                    <div id="pen-color-palette" style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="color-button" data-color="0x800000" style="
                            width: 36px; height: 36px; border-radius: 4px; border: 3px solid #ff8c42;
                            background: #800000; cursor: pointer; transition: all 0.2s ease;
                        " title="futaba-maroon"></button>
                        <button class="color-button" data-color="0xaa5a56" style="
                            width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                            background: #aa5a56; cursor: pointer; transition: all 0.2s ease;
                        " title="light-maroon"></button>
                        <button class="color-button" data-color="0xcf9c97" style="
                            width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                            background: #cf9c97; cursor: pointer; transition: all 0.2s ease;
                        " title="medium"></button>
                        <button class="color-button" data-color="0xe9c2ba" style="
                            width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                            background: #e9c2ba; cursor: pointer; transition: all 0.2s ease;
                        " title="light-medium"></button>
                        <button class="color-button" data-color="0xf0e0d6" style="
                            width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                            background: #f0e0d6; cursor: pointer; transition: all 0.2s ease;
                        " title="cream"></button>
                    </div>
                </div>

                <!-- ペンサイズスライダー -->
                <div style="margin-bottom: 16px; padding: 0 8px;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px;">
                        筆圧
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <button class="resize-arrow-btn" id="pen-size-decrease">◀</button>
                        <div class="slider" id="pen-size-slider" style="flex: 1; height: 6px; background: var(--futaba-light-medium); border-radius: 3px; position: relative; cursor: pointer;">
                            <div class="slider-track" id="pen-size-track" style="height: 100%; background: var(--futaba-maroon); border-radius: 3px; width: 0%; transition: width 0.1s;"></div>
                            <div class="slider-handle" id="pen-size-handle" style="width: 16px; height: 16px; background: var(--futaba-maroon); border: 2px solid var(--futaba-background); border-radius: 50%; position: absolute; top: 50%; left: 0%; transform: translate(-50%, -50%); cursor: grab; transition: left 0.1s;"></div>
                        </div>
                        <button class="resize-arrow-btn" id="pen-size-increase">▶</button>
                    </div>
                    <div style="text-align: center;">
                        <div class="resize-value-display" id="pen-size-display" style="font-size: 12px; color: var(--futaba-maroon);">1.0px</div>
                    </div>
                </div>

                <!-- 透明度スライダー -->
                <div style="margin-bottom: 8px; padding: 0 8px;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px;">
                        透明度
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <button class="resize-arrow-btn" id="pen-opacity-decrease">◀</button>
                        <div class="slider" id="pen-opacity-slider" style="flex: 1; height: 6px; background: var(--futaba-light-medium); border-radius: 3px; position: relative; cursor: pointer;">
                            <div class="slider-track" id="pen-opacity-track" style="height: 100%; background: var(--futaba-maroon); border-radius: 3px; width: 0%; transition: width 0.1s;"></div>
                            <div class="slider-handle" id="pen-opacity-handle" style="width: 16px; height: 16px; background: var(--futaba-maroon); border: 2px solid var(--futaba-background); border-radius: 50%; position: absolute; top: 50%; left: 0%; transform: translate(-50%, -50%); cursor: grab; transition: left 0.1s;"></div>
                        </div>
                        <button class="resize-arrow-btn" id="pen-opacity-increase">▶</button>
                    </div>
                    <div style="text-align: center;">
                        <div class="resize-value-display" id="pen-opacity-display" style="font-size: 12px; color: var(--futaba-maroon);">100%</div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(this.panel);
            
            // DOM要素の取得
            this.sizeSlider = document.getElementById('pen-size-slider');
            this.sizeTrack = document.getElementById('pen-size-track');
            this.sizeHandle = document.getElementById('pen-size-handle');
            this.sizeDisplay = document.getElementById('pen-size-display');
            
            this.opacitySlider = document.getElementById('pen-opacity-slider');
            this.opacityTrack = document.getElementById('pen-opacity-track');
            this.opacityHandle = document.getElementById('pen-opacity-handle');
            this.opacityDisplay = document.getElementById('pen-opacity-display');
        }

        _attachEventListeners() {
            // カラーパレット
            const colorButtons = this.panel.querySelectorAll('.color-button');
            colorButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const color = parseInt(btn.getAttribute('data-color'));
                    if (window.BrushSettings) {
                        window.BrushSettings.setColor(color);
                    }
                    // アクティブ状態の更新
                    colorButtons.forEach(b => {
                        b.style.border = b === btn 
                            ? '3px solid #ff8c42' 
                            : '2px solid var(--futaba-light-medium)';
                    });
                    
                    // EventBus通知
                    if (this.eventBus) {
                        this.eventBus.emit('brush:color-changed', { color });
                    }
                });
            });

            // ペンサイズスライダー
            this._setupSizeSlider();
            
            // 透明度スライダー
            this._setupOpacitySlider();
        }

        _setupSizeSlider() {
            const MIN_SIZE = 0.5;
            const MAX_SIZE = 30;

            // ドラッグハンドラー（グローバルリスナー）
            const handleMouseMove = (e) => {
                if (!this.isDraggingSize) return;
                const rect = this.sizeSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = MIN_SIZE + ((MAX_SIZE - MIN_SIZE) * percent / 100);
                this._updateSizeSlider(value);
            };

            const handleMouseUp = () => {
                if (this.isDraggingSize) {
                    this.isDraggingSize = false;
                    if (this.sizeHandle) {
                        this.sizeHandle.style.cursor = 'grab';
                    }
                }
            };

            // ハンドルドラッグ開始
            this.sizeHandle.addEventListener('mousedown', (e) => {
                this.isDraggingSize = true;
                this.sizeHandle.style.cursor = 'grabbing';
                e.preventDefault();
                e.stopPropagation();
            });

            // スライダー直接クリック
            this.sizeSlider.addEventListener('click', (e) => {
                if (e.target === this.sizeHandle) return;
                const rect = this.sizeSlider.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                const value = MIN_SIZE + ((MAX_SIZE - MIN_SIZE) * percent / 100);
                this._updateSizeSlider(value);
            });

            // ◀▶ボタン
            document.getElementById('pen-size-decrease').addEventListener('click', () => {
                const current = window.BrushSettings?.getSize() || 1;
                this._updateSizeSlider(Math.max(MIN_SIZE, current - 0.5));
            });

            document.getElementById('pen-size-increase').addEventListener('click', () => {
                const current = window.BrushSettings?.getSize() || 1;
                this._updateSizeSlider(Math.min(MAX_SIZE, current + 0.5));
            });

            // グローバルイベントリスナー登録
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        _setupOpacitySlider() {
            const MIN_OPACITY = 0;
            const MAX_OPACITY = 100;

            // ドラッグハンドラー（グローバルリスナー）
            const handleMouseMove = (e) => {
                if (!this.isDraggingOpacity) return;
                const rect = this.opacitySlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = MIN_OPACITY + ((MAX_OPACITY - MIN_OPACITY) * percent / 100);
                this._updateOpacitySlider(value);
            };

            const handleMouseUp = () => {
                if (this.isDraggingOpacity) {
                    this.isDraggingOpacity = false;
                    if (this.opacityHandle) {
                        this.opacityHandle.style.cursor = 'grab';
                    }
                }
            };

            // ハンドルドラッグ開始
            this.opacityHandle.addEventListener('mousedown', (e) => {
                this.isDraggingOpacity = true;
                this.opacityHandle.style.cursor = 'grabbing';
                e.preventDefault();
                e.stopPropagation();
            });

            // スライダー直接クリック
            this.opacitySlider.addEventListener('click', (e) => {
                if (e.target === this.opacityHandle) return;
                const rect = this.opacitySlider.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                const value = MIN_OPACITY + ((MAX_OPACITY - MIN_OPACITY) * percent / 100);
                this._updateOpacitySlider(value);
            });

            // ◀▶ボタン
            document.getElementById('pen-opacity-decrease').addEventListener('click', () => {
                const current = (window.BrushSettings?.getOpacity() || 1) * 100;
                this._updateOpacitySlider(Math.max(MIN_OPACITY, current - 5));
            });

            document.getElementById('pen-opacity-increase').addEventListener('click', () => {
                const current = (window.BrushSettings?.getOpacity() || 1) * 100;
                this._updateOpacitySlider(Math.min(MAX_OPACITY, current + 5));
            });

            // グローバルイベントリスナー登録
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        _updateSizeSlider(value) {
            const MIN_SIZE = 0.5;
            const MAX_SIZE = 30;
            const clampedValue = Math.max(MIN_SIZE, Math.min(MAX_SIZE, value));
            const percent = ((clampedValue - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 100;
            
            // スライダー表示更新
            this.sizeTrack.style.width = percent + '%';
            this.sizeHandle.style.left = percent + '%';
            this.sizeDisplay.textContent = clampedValue.toFixed(1) + 'px';
            
            // BrushSettings更新
            if (window.BrushSettings) {
                window.BrushSettings.setSize(clampedValue);
            }
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('brush:size-changed', { size: clampedValue });
            }
        }

        _updateOpacitySlider(value) {
            const MIN_OPACITY = 0;
            const MAX_OPACITY = 100;
            const clampedValue = Math.max(MIN_OPACITY, Math.min(MAX_OPACITY, value));
            const percent = ((clampedValue - MIN_OPACITY) / (MAX_OPACITY - MIN_OPACITY)) * 100;
            
            // スライダー表示更新
            this.opacityTrack.style.width = percent + '%';
            this.opacityHandle.style.left = percent + '%';
            this.opacityDisplay.textContent = Math.round(clampedValue) + '%';
            
            // BrushSettings更新
            if (window.BrushSettings) {
                window.BrushSettings.setOpacity(clampedValue / 100);
            }
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('brush:opacity-changed', { opacity: clampedValue / 100 });
            }
        }

        _loadCurrentSettings() {
            if (!window.BrushSettings) return;
            
            const currentSize = window.BrushSettings.getSize();
            const currentOpacity = window.BrushSettings.getOpacity();
            const currentColor = window.BrushSettings.getColor();
            
            // スライダー位置を更新（BrushSettingsには反映させない）
            const MIN_SIZE = 0.5;
            const MAX_SIZE = 30;
            const sizePercent = ((currentSize - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 100;
            this.sizeTrack.style.width = sizePercent + '%';
            this.sizeHandle.style.left = sizePercent + '%';
            this.sizeDisplay.textContent = currentSize.toFixed(1) + 'px';
            
            const opacityPercent = currentOpacity * 100;
            this.opacityTrack.style.width = opacityPercent + '%';
            this.opacityHandle.style.left = opacityPercent + '%';
            this.opacityDisplay.textContent = Math.round(opacityPercent) + '%';
            
            // カラーボタンのアクティブ状態を更新
            const colorButtons = this.panel.querySelectorAll('.color-button');
            colorButtons.forEach(btn => {
                const btnColor = parseInt(btn.getAttribute('data-color'));
                btn.style.border = btnColor === currentColor 
                    ? '3px solid #ff8c42' 
                    : '2px solid var(--futaba-light-medium)';
            });
        }

        // PopupManager必須メソッド
        show() {
            this._loadCurrentSettings();
            this.panel.classList.add('show');
            this.isVisible = true;
            
            if (this.eventBus) {
                this.eventBus.emit('popup:shown', { name: 'quickAccess' });
            }
        }

        hide() {
            this.panel.classList.remove('show');
            this.isVisible = false;
            
            if (this.eventBus) {
                this.eventBus.emit('popup:hidden', { name: 'quickAccess' });
            }
        }

        toggle() {
            if (this.isVisible) {
                this.hide();
            } else {
                this.show();
            }
        }

        isReady() {
            return !!this.panel;
        }

        destroy() {
            if (this.panel && this.panel.parentNode) {
                this.panel.parentNode.removeChild(this.panel);
            }
            this.panel = null;
            this.isVisible = false;
        }
    }

    // TegakiUI名前空間に登録
    if (!window.TegakiUI) {
        window.TegakiUI = {};
    }
    window.TegakiUI.QuickAccessPopup = QuickAccessPopup;

    console.log('✅ quick-access-popup.js loaded (TegakiUI.QuickAccessPopup)');

})();