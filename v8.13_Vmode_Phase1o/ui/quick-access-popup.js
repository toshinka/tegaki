// Tegaki Tool - Quick Access Popup (ペン設定・統一スライダー版)
// DO NOT use ESM, only global namespace

class QuickAccessPopup {
    constructor(config = {}) {
        this.config = config;
        this.panel = null;
        this.ready = false;
        this.isDraggingSize = false;
        this.isDraggingOpacity = false;
        
        this.sizeSlider = null;
        this.sizeTrack = null;
        this.sizeHandle = null;
        this.sizeDisplay = null;
        
        this.opacitySlider = null;
        this.opacityTrack = null;
        this.opacityHandle = null;
        this.opacityDisplay = null;
    }

    init() {
        this.createPanel();
        this.attachEventListeners();
        this.loadCurrentSettings();
        this.ready = true;
        return this;
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'quick-access-popup';
        this.panel.className = 'popup-panel';
        this.panel.style.left = '70px';
        this.panel.style.top = '60px';
        
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
                <div class="resize-slider-row">
                    <button class="resize-arrow-btn" id="pen-size-decrease">◀</button>
                    <div class="resize-slider" id="pen-size-slider">
                        <div class="resize-slider-track" id="pen-size-track"></div>
                        <div class="resize-slider-handle" id="pen-size-handle"></div>
                    </div>
                    <button class="resize-arrow-btn" id="pen-size-increase">▶</button>
                </div>
                <div class="resize-value-row">
                    <div class="resize-value-display" id="pen-size-display">1.0px</div>
                </div>
            </div>

            <!-- 透明度スライダー -->
            <div style="margin-bottom: 8px; padding: 0 8px;">
                <div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px;">
                    透明度
                </div>
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

    attachEventListeners() {
        // カラーパレット
        const colorButtons = this.panel.querySelectorAll('.color-button');
        colorButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const color = parseInt(btn.getAttribute('data-color'));
                if (window.BrushSettings) {
                    window.BrushSettings.setColor(color);
                }
                colorButtons.forEach(b => {
                    b.style.border = b === btn 
                        ? '3px solid #ff8c42' 
                        : '2px solid var(--futaba-light-medium)';
                });
            });
        });

        // ペンサイズスライダー
        this.setupSizeSlider();
        
        // 透明度スライダー
        this.setupOpacitySlider();
    }

    setupSizeSlider() {
        const MIN_SIZE = 0.5;
        const MAX_SIZE = 30;

        // ドラッグハンドラー
        const handleMouseMove = (e) => {
            if (!this.isDraggingSize) return;
            const rect = this.sizeSlider.getBoundingClientRect();
            const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const value = MIN_SIZE + ((MAX_SIZE - MIN_SIZE) * percent / 100);
            this.updateSizeSlider(value);
        };

        const handleMouseUp = () => {
            this.isDraggingSize = false;
        };

        // ハンドルドラッグ
        this.sizeHandle.addEventListener('mousedown', (e) => {
            this.isDraggingSize = true;
            e.preventDefault();
        });

        // スライダークリック
        this.sizeSlider.addEventListener('click', (e) => {
            if (e.target === this.sizeHandle) return;
            const rect = this.sizeSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = MIN_SIZE + ((MAX_SIZE - MIN_SIZE) * percent / 100);
            this.updateSizeSlider(value);
        });

        // ◀▶ボタン
        document.getElementById('pen-size-decrease').addEventListener('click', () => {
            const current = window.BrushSettings?.getSize() || 1;
            this.updateSizeSlider(Math.max(MIN_SIZE, current - 0.5));
        });

        document.getElementById('pen-size-increase').addEventListener('click', () => {
            const current = window.BrushSettings?.getSize() || 1;
            this.updateSizeSlider(Math.min(MAX_SIZE, current + 0.5));
        });

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    setupOpacitySlider() {
        const MIN_OPACITY = 0;
        const MAX_OPACITY = 100;

        // ドラッグハンドラー
        const handleMouseMove = (e) => {
            if (!this.isDraggingOpacity) return;
            const rect = this.opacitySlider.getBoundingClientRect();
            const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const value = MIN_OPACITY + ((MAX_OPACITY - MIN_OPACITY) * percent / 100);
            this.updateOpacitySlider(value);
        };

        const handleMouseUp = () => {
            this.isDraggingOpacity = false;
        };

        // ハンドルドラッグ
        this.opacityHandle.addEventListener('mousedown', (e) => {
            this.isDraggingOpacity = true;
            e.preventDefault();
        });

        // スライダークリック
        this.opacitySlider.addEventListener('click', (e) => {
            if (e.target === this.opacityHandle) return;
            const rect = this.opacitySlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = MIN_OPACITY + ((MAX_OPACITY - MIN_OPACITY) * percent / 100);
            this.updateOpacitySlider(value);
        });

        // ◀▶ボタン
        document.getElementById('pen-opacity-decrease').addEventListener('click', () => {
            const current = (window.BrushSettings?.getOpacity() || 1) * 100;
            this.updateOpacitySlider(Math.max(MIN_OPACITY, current - 5));
        });

        document.getElementById('pen-opacity-increase').addEventListener('click', () => {
            const current = (window.BrushSettings?.getOpacity() || 1) * 100;
            this.updateOpacitySlider(Math.min(MAX_OPACITY, current + 5));
        });

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    updateSizeSlider(value) {
        const MIN_SIZE = 0.5;
        const MAX_SIZE = 30;
        const clampedValue = Math.max(MIN_SIZE, Math.min(MAX_SIZE, value));
        const percent = ((clampedValue - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 100;
        
        this.sizeTrack.style.width = percent + '%';
        this.sizeHandle.style.left = percent + '%';
        this.sizeDisplay.textContent = clampedValue.toFixed(1) + 'px';
        
        if (window.BrushSettings) {
            window.BrushSettings.setSize(clampedValue);
        }
    }

    updateOpacitySlider(value) {
        const MIN_OPACITY = 0;
        const MAX_OPACITY = 100;
        const clampedValue = Math.max(MIN_OPACITY, Math.min(MAX_OPACITY, value));
        const percent = ((clampedValue - MIN_OPACITY) / (MAX_OPACITY - MIN_OPACITY)) * 100;
        
        this.opacityTrack.style.width = percent + '%';
        this.opacityHandle.style.left = percent + '%';
        this.opacityDisplay.textContent = Math.round(clampedValue) + '%';
        
        if (window.BrushSettings) {
            window.BrushSettings.setOpacity(clampedValue / 100);
        }
    }

    loadCurrentSettings() {
        if (!window.BrushSettings) return;
        
        const currentSize = window.BrushSettings.getSize();
        const currentOpacity = window.BrushSettings.getOpacity();
        const currentColor = window.BrushSettings.getColor();
        
        this.updateSizeSlider(currentSize);
        this.updateOpacitySlider(currentOpacity * 100);
        
        // カラーボタンのアクティブ状態を更新
        const colorButtons = this.panel.querySelectorAll('.color-button');
        colorButtons.forEach(btn => {
            const btnColor = parseInt(btn.getAttribute('data-color'));
            btn.style.border = btnColor === currentColor 
                ? '3px solid #ff8c42' 
                : '2px solid var(--futaba-light-medium)';
        });
    }

    show() {
        if (!this.ready) return;
        this.loadCurrentSettings();
        this.panel.classList.add('show');
        if (window.PopupManager) {
            window.PopupManager.registerPopup('quick-access', this);
        }
    }

    hide() {
        if (!this.ready) return;
        this.panel.classList.remove('show');
    }

    toggle() {
        if (!this.ready) return;
        if (this.panel.classList.contains('show')) {
            this.hide();
        } else {
            this.show();
        }
    }

    isReady() {
        return this.ready;
    }

    destroy() {
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.ready = false;
    }
}

// グローバル公開
window.QuickAccessPopup = QuickAccessPopup;