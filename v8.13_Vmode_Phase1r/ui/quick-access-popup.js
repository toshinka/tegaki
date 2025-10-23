// ===== ui/quick-access-popup.js - 最終修正版 =====
// 責務: ペン設定クイックアクセスポップアップ
// 改修: resize-slider.js（IIFE版）の成功パターンを完全に模倣

(function() {
    'use strict';

    class QuickAccessPopup {
        constructor(config = {}) {
            this.config = config;
            this.eventBus = config.eventBus || window.TegakiEventBus;
            this.brushSettings = config.brushSettings || window.BrushSettings;
            
            if (!this.brushSettings) {
                setTimeout(() => {
                    this.brushSettings = window.BrushSettings;
                }, 500);
            }
            
            this.panel = null;
            this.isVisible = false;
            this.initialized = false;
            
            // resize-slider.jsと同じパターン：グローバル変数で状態管理
            this.isDraggingSize = false;
            this.isDraggingOpacity = false;
            
            // DOM要素キャッシュ
            this.elements = {};
            
            // 現在値
            this.currentSize = 3;
            this.currentOpacity = 100;
            
            // 範囲定義
            this.MIN_SIZE = 0.5;
            this.MAX_SIZE = 30;
            this.MIN_OPACITY = 0;
            this.MAX_OPACITY = 100;
            
            this._ensurePanelExists();
        }

        _ensurePanelExists() {
            this.panel = document.getElementById('quick-access-popup');
            
            if (!this.panel) {
                const canvasArea = document.querySelector('.canvas-area');
                if (!canvasArea) return;
                
                this.panel = document.createElement('div');
                this.panel.id = 'quick-access-popup';
                this.panel.className = 'popup-panel';
                this.panel.style.cssText = 'left: 70px; top: 60px;';
                canvasArea.appendChild(this.panel);
            }
            
            if (!this.panel.children.length) {
                this._populateContent();
            }
        }

        _populateContent() {
            if (!this.panel) return;
            
            // resize-popup.jsと同じHTML構造を使用
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
                <div class="resize-compact-group">
                    <div class="resize-compact-label">筆圧</div>
                    <div class="resize-slider-row">
                        <button class="resize-arrow-btn" id="pen-size-decrease">◀</button>
                        <div class="resize-slider" id="pen-size-slider">
                            <div class="resize-slider-track" id="pen-size-track"></div>
                            <div class="resize-slider-handle" id="pen-size-handle"></div>
                        </div>
                        <button class="resize-arrow-btn" id="pen-size-increase">▶</button>
                    </div>
                    <div class="resize-value-row">
                        <div class="resize-value-display" id="pen-size-display">3.0px</div>
                    </div>
                </div>

                <!-- 透明度スライダー -->
                <div class="resize-compact-group">
                    <div class="resize-compact-label">透明度</div>
                    <div class="resize-slider-row">
                        <button class="resize-arrow-btn" id="pen-opacity-decrease">◀</button>
                        <div class="resize-slider" id="pen-opacity-slider">
                            <div class="resize-slider-track" id="pen-opacity-track"></div>
                            <div class="resize-slider-handle" id="pen-opacity-handle"></div>
                        </div>
                        <button class="resize-arrow-btn" id="pen-opacity-increase">▶</button>
                    </div>
                    <div class="resize-value-row">
                        <div class="resize-value-display" id="pen-opacity-display">100%</div>
                    </div>
                </div>
            `;
        }

        _cacheElements() {
            this.elements = {
                // サイズスライダー
                sizeSlider: document.getElementById('pen-size-slider'),
                sizeTrack: document.getElementById('pen-size-track'),
                sizeHandle: document.getElementById('pen-size-handle'),
                sizeDisplay: document.getElementById('pen-size-display'),
                sizeDecrease: document.getElementById('pen-size-decrease'),
                sizeIncrease: document.getElementById('pen-size-increase'),
                
                // 透明度スライダー
                opacitySlider: document.getElementById('pen-opacity-slider'),
                opacityTrack: document.getElementById('pen-opacity-track'),
                opacityHandle: document.getElementById('pen-opacity-handle'),
                opacityDisplay: document.getElementById('pen-opacity-display'),
                opacityDecrease: document.getElementById('pen-opacity-decrease'),
                opacityIncrease: document.getElementById('pen-opacity-increase'),
                
                // カラーパレット
                colorPalette: document.getElementById('pen-color-palette')
            };
        }

        initialize() {
            if (this.initialized) return;
            
            if (!this.brushSettings) {
                console.error('❌ QuickAccessPopup: Cannot initialize without BrushSettings');
                return;
            }
            
            this._cacheElements();
            this._setupColorButtons();
            this._setupSizeSlider();
            this._setupOpacitySlider();
            this._setupStepButtons();
            this._updateUI();
            
            this.initialized = true;
        }

        _setupColorButtons() {
            const colorButtons = this.panel.querySelectorAll('.color-button');
            colorButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const color = parseInt(btn.getAttribute('data-color'));
                    this.brushSettings.setColor(color);
                    
                    colorButtons.forEach(b => {
                        b.style.border = b === btn 
                            ? '3px solid #ff8c42' 
                            : '2px solid var(--futaba-light-medium)';
                    });
                    
                    if (this.eventBus) {
                        this.eventBus.emit('brush:color-changed', { color });
                    }
                });
            });
        }

        // resize-slider.jsと同じパターン：独立した関数で処理
        _setupSizeSlider() {
            const handleMouseMove = (e) => {
                if (!this.isDraggingSize) return;
                const rect = this.elements.sizeSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                this._updateSizeSlider(value);
            };
            
            const handleMouseUp = () => {
                if (this.isDraggingSize) {
                    this.isDraggingSize = false;
                }
                if (this.isDraggingOpacity) {
                    this.isDraggingOpacity = false;
                }
            };
            
            // ハンドルにmousedown
            this.elements.sizeHandle.addEventListener('mousedown', (e) => {
                this.isDraggingSize = true;
                e.preventDefault();
            });
            
            // スライダー全体にclick
            this.elements.sizeSlider.addEventListener('click', (e) => {
                if (e.target === this.elements.sizeHandle) return;
                const rect = this.elements.sizeSlider.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                this._updateSizeSlider(value);
            });
            
            // documentにmousemove/mouseup
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        _setupOpacitySlider() {
            const handleMouseMove = (e) => {
                if (!this.isDraggingOpacity) return;
                const rect = this.elements.opacitySlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_OPACITY + ((this.MAX_OPACITY - this.MIN_OPACITY) * percent / 100);
                this._updateOpacitySlider(value);
            };
            
            // ハンドルにmousedown
            this.elements.opacityHandle.addEventListener('mousedown', (e) => {
                this.isDraggingOpacity = true;
                e.preventDefault();
            });
            
            // スライダー全体にclick
            this.elements.opacitySlider.addEventListener('click', (e) => {
                if (e.target === this.elements.opacityHandle) return;
                const rect = this.elements.opacitySlider.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                const value = this.MIN_OPACITY + ((this.MAX_OPACITY - this.MIN_OPACITY) * percent / 100);
                this._updateOpacitySlider(value);
            });
            
            // documentへのイベント登録は_setupSizeSlider()で済み
            document.addEventListener('mousemove', handleMouseMove);
        }

        _setupStepButtons() {
            // サイズステップボタン
            this.elements.sizeDecrease.addEventListener('click', () => {
                const current = this.brushSettings.getSize();
                this._updateSizeSlider(Math.max(this.MIN_SIZE, current - 0.5));
            });
            
            this.elements.sizeIncrease.addEventListener('click', () => {
                const current = this.brushSettings.getSize();
                this._updateSizeSlider(Math.min(this.MAX_SIZE, current + 0.5));
            });
            
            // 透明度ステップボタン
            this.elements.opacityDecrease.addEventListener('click', () => {
                const current = this.brushSettings.getOpacity();
                this._updateOpacitySlider(Math.max(this.MIN_OPACITY, current - 5));
            });
            
            this.elements.opacityIncrease.addEventListener('click', () => {
                const current = this.brushSettings.getOpacity();
                this._updateOpacitySlider(Math.min(this.MAX_OPACITY, current + 5));
            });
        }

        _updateSizeSlider(value) {
            this.currentSize = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, value));
            const percent = ((this.currentSize - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
            
            // スライダー表示更新
            this.elements.sizeTrack.style.width = percent + '%';
            this.elements.sizeHandle.style.left = percent + '%';
            this.elements.sizeDisplay.textContent = this.currentSize.toFixed(1) + 'px';
            
            // BrushSettings更新
            this.brushSettings.setSize(this.currentSize);
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('brush:size-changed', { size: this.currentSize });
            }
        }

        _updateOpacitySlider(value) {
            this.currentOpacity = Math.max(this.MIN_OPACITY, Math.min(this.MAX_OPACITY, value));
            const percent = ((this.currentOpacity - this.MIN_OPACITY) / (this.MAX_OPACITY - this.MIN_OPACITY)) * 100;
            
            // スライダー表示更新
            this.elements.opacityTrack.style.width = percent + '%';
            this.elements.opacityHandle.style.left = percent + '%';
            this.elements.opacityDisplay.textContent = Math.round(this.currentOpacity) + '%';
            
            // BrushSettings更新
            this.brushSettings.setOpacity(this.currentOpacity);
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('brush:opacity-changed', { opacity: this.currentOpacity / 100 });
            }
        }

        _updateUI() {
            if (!this.brushSettings) return;
            
            // 現在の設定を読み込み
            this.currentSize = this.brushSettings.getSize();
            this.currentOpacity = this.brushSettings.getOpacity();
            
            // サイズスライダー更新
            const sizePercent = ((this.currentSize - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
            this.elements.sizeTrack.style.width = sizePercent + '%';
            this.elements.sizeHandle.style.left = sizePercent + '%';
            this.elements.sizeDisplay.textContent = this.currentSize.toFixed(1) + 'px';
            
            // 透明度スライダー更新
            const opacityPercent = ((this.currentOpacity - this.MIN_OPACITY) / (this.MAX_OPACITY - this.MIN_OPACITY)) * 100;
            this.elements.opacityTrack.style.width = opacityPercent + '%';
            this.elements.opacityHandle.style.left = opacityPercent + '%';
            this.elements.opacityDisplay.textContent = Math.round(this.currentOpacity) + '%';
            
            // カラーボタンのアクティブ状態を更新
            const currentColor = this.brushSettings.getColor();
            const colorButtons = this.panel.querySelectorAll('.color-button');
            colorButtons.forEach(btn => {
                const btnColor = parseInt(btn.getAttribute('data-color'));
                btn.style.border = btnColor === currentColor 
                    ? '3px solid #ff8c42' 
                    : '2px solid var(--futaba-light-medium)';
            });
        }

        // ===== PopupManager必須メソッド =====

        show() {
            if (!this.panel) {
                this._ensurePanelExists();
            }
            
            if (!this.panel) return;
            
            this.panel.classList.add('show');
            this.isVisible = true;
            
            // 初期化（初回のみ）
            if (!this.initialized) {
                setTimeout(() => {
                    this.initialize();
                }, 50);
            } else {
                if (this.brushSettings) {
                    this._updateUI();
                }
            }
            
            if (this.eventBus) {
                this.eventBus.emit('popup:shown', { name: 'quickAccess' });
            }
        }

        hide() {
            if (!this.panel) return;
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
            return this.initialized && !!this.panel && !!this.brushSettings;
        }

        destroy() {
            // イベントリスナーは関数内で定義されているため、
            // 明示的な削除は不要（クロージャで管理）
            this.elements = {};
            this.initialized = false;
            
            if (this.panel && this.panel.parentNode) {
                this.panel.parentNode.removeChild(this.panel);
            }
            this.panel = null;
            this.isVisible = false;
        }
    }

    if (!window.TegakiUI) {
        window.TegakiUI = {};
    }
    window.TegakiUI.QuickAccessPopup = QuickAccessPopup;

    console.log('✅ quick-access-popup.js (最終修正版) loaded');
    console.log('   - resize-slider.js パターン完全模倣');
})();