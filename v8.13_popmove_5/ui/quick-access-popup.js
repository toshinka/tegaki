// ===== ui/quick-access-popup.js - 背景ドラッグ + 閉じるボタン版 =====
// 責務: ペン設定クイックアクセスポップアップ
// 改修: ヘッダー削除 → 背景ドラッグ + 右上×ボタン追加

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
            
            // スライダードラッグ状態フラグ
            this.isDraggingSize = false;
            this.isDraggingOpacity = false;
            
            // ✅ ポップアップドラッグ状態フラグ
            this.isDraggingPanel = false;
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.panelStartX = 0;
            this.panelStartY = 0;
            
            // DOM要素キャッシュ
            this.elements = {};
            
            // グローバルイベントリスナー参照
            this.mouseMoveHandler = null;
            this.mouseUpHandler = null;
            this.dragMoveHandler = null;
            this.dragUpHandler = null;
            
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
                this.panel.className = 'popup-panel resize-popup-compact';
                
                const savedPos = this._loadPosition();
                this.panel.style.cssText = `left: ${savedPos.x}px; top: ${savedPos.y}px;`;
                
                canvasArea.appendChild(this.panel);
            }
            
            if (this.panel && !this.panel.classList.contains('resize-popup-compact')) {
                this.panel.classList.add('resize-popup-compact');
            }
            
            if (!this.panel.children.length) {
                this._populateContent();
            }
        }

        _populateContent() {
            if (!this.panel) return;
            
            this.panel.innerHTML = `
                <!-- ✅ 閉じるボタン（右上） -->
                <button class="quick-access-close-btn" id="quick-access-close-btn" title="閉じる">×</button>

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
                // ✅ 閉じるボタン
                closeBtn: document.getElementById('quick-access-close-btn'),
                
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
            this._setupCloseButton(); // ✅ 閉じるボタン
            this._setupColorButtons();
            this._setupSliders();
            this._setupPanelDragHandlers(); // ✅ 背景ドラッグ
            this._updateUI();
            
            this.initialized = true;
        }

        // ✅ 閉じるボタンのセットアップ
        _setupCloseButton() {
            if (!this.elements.closeBtn) return;
            
            this.elements.closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
            });
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

        _setupSliders() {
            // スライダー用グローバルマウスハンドラー
            this.mouseMoveHandler = (e) => {
                if (this.isDraggingSize) {
                    const rect = this.elements.sizeSlider.getBoundingClientRect();
                    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                    const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                    this._updateSizeSlider(value);
                }
                if (this.isDraggingOpacity) {
                    const rect = this.elements.opacitySlider.getBoundingClientRect();
                    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                    const value = this.MIN_OPACITY + ((this.MAX_OPACITY - this.MIN_OPACITY) * percent / 100);
                    this._updateOpacitySlider(value);
                }
            };
            
            this.mouseUpHandler = () => {
                this.isDraggingSize = false;
                this.isDraggingOpacity = false;
            };
            
            document.addEventListener('mousemove', this.mouseMoveHandler);
            document.addEventListener('mouseup', this.mouseUpHandler);
            
            // サイズハンドル
            this.elements.sizeHandle.addEventListener('mousedown', (e) => {
                this.isDraggingSize = true;
                e.preventDefault();
                e.stopPropagation();
            });
            
            // 透明度ハンドル
            this.elements.opacityHandle.addEventListener('mousedown', (e) => {
                this.isDraggingOpacity = true;
                e.preventDefault();
                e.stopPropagation();
            });
            
            // スライダー直接クリック（サイズ）
            this.elements.sizeSlider.addEventListener('click', (e) => {
                if (e.target === this.elements.sizeHandle) return;
                const rect = this.elements.sizeSlider.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                this._updateSizeSlider(value);
            });
            
            // スライダー直接クリック（透明度）
            this.elements.opacitySlider.addEventListener('click', (e) => {
                if (e.target === this.elements.opacityHandle) return;
                const rect = this.elements.opacitySlider.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                const value = this.MIN_OPACITY + ((this.MAX_OPACITY - this.MIN_OPACITY) * percent / 100);
                this._updateOpacitySlider(value);
            });
            
            // ステップボタン
            this.elements.sizeDecrease.addEventListener('click', () => {
                const current = this.brushSettings.getSize();
                this._updateSizeSlider(Math.max(this.MIN_SIZE, current - 0.5));
            });
            
            this.elements.sizeIncrease.addEventListener('click', () => {
                const current = this.brushSettings.getSize();
                this._updateSizeSlider(Math.min(this.MAX_SIZE, current + 0.5));
            });
            
            this.elements.opacityDecrease.addEventListener('click', () => {
                const current = this.brushSettings.getOpacity();
                this._updateOpacitySlider(Math.max(this.MIN_OPACITY, current - 5));
            });
            
            this.elements.opacityIncrease.addEventListener('click', () => {
                const current = this.brushSettings.getOpacity();
                this._updateOpacitySlider(Math.min(this.MAX_OPACITY, current + 5));
            });
        }

        // ✅ パネル背景ドラッグハンドラーのセットアップ
        _setupPanelDragHandlers() {
            // パネル全体に mousedown イベント
            this.panel.addEventListener('mousedown', (e) => {
                // ✅ インタラクティブ要素（ボタン、スライダー）をクリックした場合はドラッグしない
                const target = e.target;
                const isInteractive = 
                    target.classList.contains('color-button') ||
                    target.classList.contains('resize-arrow-btn') ||
                    target.classList.contains('resize-slider-handle') ||
                    target.classList.contains('quick-access-close-btn') ||
                    target.closest('.resize-slider') ||
                    target.closest('.color-button') ||
                    target.closest('.resize-arrow-btn') ||
                    target.closest('.quick-access-close-btn');
                
                if (isInteractive) return;
                
                // 背景部分のドラッグ開始
                this.isDraggingPanel = true;
                
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                
                const rect = this.panel.getBoundingClientRect();
                this.panelStartX = rect.left;
                this.panelStartY = rect.top;
                
                this.panel.style.cursor = 'grabbing';
                
                e.preventDefault();
            });
            
            // グローバルドラッグハンドラー
            this.dragMoveHandler = (e) => {
                if (!this.isDraggingPanel) return;
                
                const deltaX = e.clientX - this.dragStartX;
                const deltaY = e.clientY - this.dragStartY;
                
                let newX = this.panelStartX + deltaX;
                let newY = this.panelStartY + deltaY;
                
                // 画面境界チェック
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const panelRect = this.panel.getBoundingClientRect();
                
                newX = Math.max(0, Math.min(newX, viewportWidth - panelRect.width));
                newY = Math.max(0, Math.min(newY, viewportHeight - panelRect.height));
                
                this.panel.style.left = newX + 'px';
                this.panel.style.top = newY + 'px';
            };
            
            this.dragUpHandler = () => {
                if (!this.isDraggingPanel) return;
                
                this.isDraggingPanel = false;
                this.panel.style.cursor = 'default';
                
                // 位置を永続化
                const rect = this.panel.getBoundingClientRect();
                this._savePosition(rect.left, rect.top);
            };
            
            document.addEventListener('mousemove', this.dragMoveHandler);
            document.addEventListener('mouseup', this.dragUpHandler);
        }

        _savePosition(x, y) {
            try {
                localStorage.setItem('quick-access-position', JSON.stringify({ x, y }));
            } catch (error) {
                // silent fail
            }
        }

        _loadPosition() {
            try {
                const saved = localStorage.getItem('quick-access-position');
                if (saved) {
                    return JSON.parse(saved);
                }
            } catch (error) {
                // silent fail
            }
            
            return { x: 70, y: 60 };
        }

        _updateSizeSlider(value) {
            this.currentSize = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, value));
            const percent = ((this.currentSize - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
            
            this.elements.sizeTrack.style.width = percent + '%';
            this.elements.sizeHandle.style.left = percent + '%';
            this.elements.sizeDisplay.textContent = this.currentSize.toFixed(1) + 'px';
            
            this.brushSettings.setSize(this.currentSize);
            
            if (this.eventBus) {
                this.eventBus.emit('brush:size-changed', { size: this.currentSize });
            }
        }

        _updateOpacitySlider(value) {
            this.currentOpacity = Math.max(this.MIN_OPACITY, Math.min(this.MAX_OPACITY, value));
            const percent = ((this.currentOpacity - this.MIN_OPACITY) / (this.MAX_OPACITY - this.MIN_OPACITY)) * 100;
            
            this.elements.opacityTrack.style.width = percent + '%';
            this.elements.opacityHandle.style.left = percent + '%';
            this.elements.opacityDisplay.textContent = Math.round(this.currentOpacity) + '%';
            
            this.brushSettings.setOpacity(this.currentOpacity);
            
            if (this.eventBus) {
                this.eventBus.emit('brush:opacity-changed', { opacity: this.currentOpacity });
            }
        }

        _updateUI() {
            if (!this.brushSettings) return;
            
            this.currentSize = this.brushSettings.getSize();
            this.currentOpacity = this.brushSettings.getOpacity();
            
            const sizePercent = ((this.currentSize - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
            this.elements.sizeTrack.style.width = sizePercent + '%';
            this.elements.sizeHandle.style.left = sizePercent + '%';
            this.elements.sizeDisplay.textContent = this.currentSize.toFixed(1) + 'px';
            
            const opacityPercent = ((this.currentOpacity - this.MIN_OPACITY) / (this.MAX_OPACITY - this.MIN_OPACITY)) * 100;
            this.elements.opacityTrack.style.width = opacityPercent + '%';
            this.elements.opacityHandle.style.left = opacityPercent + '%';
            this.elements.opacityDisplay.textContent = Math.round(this.currentOpacity) + '%';
            
            const currentColor = this.brushSettings.getColor();
            const colorButtons = this.panel.querySelectorAll('.color-button');
            colorButtons.forEach(btn => {
                const btnColor = parseInt(btn.getAttribute('data-color'));
                btn.style.border = btnColor === currentColor 
                    ? '3px solid #ff8c42' 
                    : '2px solid var(--futaba-light-medium)';
            });
        }

        show() {
            if (!this.panel) {
                this._ensurePanelExists();
            }
            
            if (!this.panel) return;
            
            this.panel.classList.add('show');
            this.isVisible = true;
            
            if (!this.initialized) {
                this.initialize();
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
            // スライダーグローバルイベントリスナーの削除
            if (this.mouseMoveHandler) {
                document.removeEventListener('mousemove', this.mouseMoveHandler);
                this.mouseMoveHandler = null;
            }
            if (this.mouseUpHandler) {
                document.removeEventListener('mouseup', this.mouseUpHandler);
                this.mouseUpHandler = null;
            }
            
            // ドラッググローバルイベントリスナーの削除
            if (this.dragMoveHandler) {
                document.removeEventListener('mousemove', this.dragMoveHandler);
                this.dragMoveHandler = null;
            }
            if (this.dragUpHandler) {
                document.removeEventListener('mouseup', this.dragUpHandler);
                this.dragUpHandler = null;
            }
            
            this.elements = {};
            this.initialized = false;
            this.isDraggingSize = false;
            this.isDraggingOpacity = false;
            this.isDraggingPanel = false;
            
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

    console.log('✅ quick-access-popup.js (背景ドラッグ + 閉じるボタン版) loaded');
    console.log('   - 背景ドラッグで移動可能（スライダー/ボタン以外）');
    console.log('   - 右上×ボタンで閉じる');
    console.log('   - 画面外クリックで閉じない（常時開きっぱなし可能）');
})();