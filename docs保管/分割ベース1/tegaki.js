// ==================================================
// tegaki.js
// お絵かき機能本体 - ふたば風デザイン
// ==================================================

(function() {
    'use strict';
    
    // ===== Tegakiコアクラス =====
    window.TegakiCore = class TegakiCore {
        constructor(container) {
            this.container = container;
            this.wrapper = null;
            this.canvas = null;
            this.ctx = null;
            this.bgCanvas = null;
            this.bgCtx = null;
            
            // 描画状態
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;
            
            // ツール設定
            this.tool = 'pen';
            this.color = '#800000'; // futaba-maroon
            this.size = 2;
            
            // カラーパレット
            this.colors = [
                '#800000', // futaba-maroon
                '#aa5a56', // futaba-light-maroon
                '#cf9c97', // futaba-medium
                '#e9c2ba', // futaba-light-medium
                '#f0e0d6', // futaba-cream
                '#ffffee'  // futaba-background
            ];
            
            this.init();
        }
        
        // ===== 初期化 =====
        init() {
            this.createUI();
            this.setupCanvas();
            this.attachEvents();
        }
        
        // ===== UI作成 =====
        createUI() {
            // ラッパー
            this.wrapper = document.createElement('div');
            this.wrapper.style.cssText = `
                display: flex;
                width: 100%;
                height: 100%;
                background: #ffffee;
            `;
            
            // サイドバー
            const sidebar = this.createSidebar();
            
            // キャンバスエリア
            const canvasArea = document.createElement('div');
            canvasArea.style.cssText = `
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                background: #ffffee;
                position: relative;
            `;
            
            // キャンバスコンテナ
            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = `
                position: relative;
                width: 400px;
                height: 400px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            `;
            
            // 背景キャンバス（レイヤー0）
            this.bgCanvas = document.createElement('canvas');
            this.bgCanvas.width = 400;
            this.bgCanvas.height = 400;
            this.bgCanvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                background: #f0e0d6;
            `;
            this.bgCtx = this.bgCanvas.getContext('2d');
            
            // 描画キャンバス（レイヤー1・透明）
            this.canvas = document.createElement('canvas');
            this.canvas.width = 400;
            this.canvas.height = 400;
            this.canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                cursor: crosshair;
            `;
            this.ctx = this.canvas.getContext('2d');
            
            canvasContainer.appendChild(this.bgCanvas);
            canvasContainer.appendChild(this.canvas);
            canvasArea.appendChild(canvasContainer);
            
            this.wrapper.appendChild(sidebar);
            this.wrapper.appendChild(canvasArea);
            
            this.container.appendChild(this.wrapper);
        }
        
        // ===== サイドバー作成 =====
        createSidebar() {
            const sidebar = document.createElement('div');
            sidebar.style.cssText = `
                width: 80px;
                background: #e9c2ba;
                padding: 16px 12px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                border-right: 2px solid #cf9c97;
                overflow-y: auto;
            `;
            
            // ツールセクション
            const toolSection = document.createElement('div');
            toolSection.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 8px;
            `;
            
            const toolLabel = this.createLabel('ツール');
            const penBtn = this.createToolButton('🖊️', 'ペン', 'pen', true);
            const eraserBtn = this.createToolButton('🧹', '消しゴム', 'eraser', false);
            
            penBtn.onclick = () => {
                this.tool = 'pen';
                penBtn.style.background = '#800000';
                penBtn.style.color = 'white';
                eraserBtn.style.background = '#cf9c97';
                eraserBtn.style.color = '#800000';
            };
            
            eraserBtn.onclick = () => {
                this.tool = 'eraser';
                eraserBtn.style.background = '#800000';
                eraserBtn.style.color = 'white';
                penBtn.style.background = '#cf9c97';
                penBtn.style.color = '#800000';
            };
            
            toolSection.appendChild(toolLabel);
            toolSection.appendChild(penBtn);
            toolSection.appendChild(eraserBtn);
            
            // カラーパレットセクション
            const colorSection = document.createElement('div');
            colorSection.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 8px;
            `;
            
            const colorLabel = this.createLabel('色');
            const palette = document.createElement('div');
            palette.style.cssText = `
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 6px;
            `;
            
            this.colors.forEach((color, index) => {
                const colorBtn = document.createElement('button');
                colorBtn.style.cssText = `
                    width: 100%;
                    height: 28px;
                    background: ${color};
                    border: 2px solid ${index === 0 ? '#800000' : '#aa5a56'};
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                `;
                
                colorBtn.onclick = () => {
                    this.color = color;
                    palette.querySelectorAll('button').forEach(btn => {
                        btn.style.border = '2px solid #aa5a56';
                        btn.style.transform = 'scale(1)';
                    });
                    colorBtn.style.border = '2px solid #800000';
                    colorBtn.style.transform = 'scale(1.1)';
                };
                
                palette.appendChild(colorBtn);
            });
            
            colorSection.appendChild(colorLabel);
            colorSection.appendChild(palette);
            
            // サイズセクション
            const sizeSection = document.createElement('div');
            sizeSection.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 8px;
            `;
            
            const sizeLabel = this.createLabel('サイズ');
            const sizeValue = document.createElement('div');
            sizeValue.textContent = '2px';
            sizeValue.style.cssText = `
                color: #800000;
                font-size: 12px;
                text-align: center;
                font-weight: bold;
            `;
            
            const sizeSlider = document.createElement('input');
            sizeSlider.type = 'range';
            sizeSlider.min = '1';
            sizeSlider.max = '50';
            sizeSlider.value = '2';
            sizeSlider.style.cssText = `
                width: 100%;
                cursor: pointer;
                accent-color: #800000;
            `;
            
            sizeSlider.oninput = (e) => {
                this.size = parseInt(e.target.value);
                sizeValue.textContent = `${this.size}px`;
            };
            
            sizeSection.appendChild(sizeLabel);
            sizeSection.appendChild(sizeValue);
            sizeSection.appendChild(sizeSlider);
            
            // クリアボタン
            const clearBtn = document.createElement('button');
            clearBtn.textContent = '🗑️ クリア';
            clearBtn.style.cssText = `
                background: #cf9c97;
                border: 2px solid #aa5a56;
                color: #800000;
                padding: 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-weight: bold;
                margin-top: auto;
                transition: all 0.2s;
            `;
            clearBtn.onmouseover = () => {
                clearBtn.style.background = '#aa5a56';
                clearBtn.style.color = 'white';
            };
            clearBtn.onmouseout = () => {
                clearBtn.style.background = '#cf9c97';
                clearBtn.style.color = '#800000';
            };
            clearBtn.onclick = () => {
                if (confirm('キャンバスをクリアしますか？')) {
                    this.clearCanvas();
                }
            };
            
            sidebar.appendChild(toolSection);
            sidebar.appendChild(colorSection);
            sidebar.appendChild(sizeSection);
            sidebar.appendChild(clearBtn);
            
            return sidebar;
        }
        
        // ===== ツールボタン作成 =====
        createToolButton(emoji, label, tool, isActive) {
            const btn = document.createElement('button');
            btn.innerHTML = `<div style="font-size: 20px;">${emoji}</div><div style="font-size: 10px; margin-top: 2px;">${label}</div>`;
            btn.title = label;
            btn.style.cssText = `
                background: ${isActive ? '#800000' : '#cf9c97'};
                color: ${isActive ? 'white' : '#800000'};
                border: 2px solid #aa5a56;
                padding: 8px;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                font-weight: bold;
            `;
            
            return btn;
        }
        
        // ===== ラベル作成 =====
        createLabel(text) {
            const label = document.createElement('div');
            label.textContent = text;
            label.style.cssText = `
                font-size: 11px;
                color: #800000;
                font-weight: bold;
                text-align: center;
                padding: 4px 0;
                background: #f0e0d6;
                border-radius: 3px;
            `;
            return label;
        }
        
        // ===== キャンバス設定 =====
        setupCanvas() {
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
        }
        
        // ===== イベント設定 =====
        attachEvents() {
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup', () => this.stopDrawing());
            this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
            
            // タッチイベント
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.canvas.dispatchEvent(mouseEvent);
            });
            
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.canvas.dispatchEvent(mouseEvent);
            });
            
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                const mouseEvent = new MouseEvent('mouseup', {});
                this.canvas.dispatchEvent(mouseEvent);
            });
        }
        
        // ===== 描画開始 =====
        startDrawing(e) {
            this.isDrawing = true;
            const rect = this.canvas.getBoundingClientRect();
            this.lastX = e.clientX - rect.left;
            this.lastY = e.clientY - rect.top;
        }
        
        // ===== 描画 =====
        draw(e) {
            if (!this.isDrawing) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(x, y);
            
            if (this.tool === 'pen') {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = this.color;
                this.ctx.lineWidth = this.size;
            } else if (this.tool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = this.size;
            }
            
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
        }
        
        // ===== 描画終了 =====
        stopDrawing() {
            this.isDrawing = false;
        }
        
        // ===== キャンバスクリア =====
        clearCanvas() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // ===== エクスポート（Blob） =====
        async exportAsBlob() {
            // 一時キャンバスで合成
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 400;
            tempCanvas.height = 400;
            const tempCtx = tempCanvas.getContext('2d');
            
            // 背景を描画
            tempCtx.drawImage(this.bgCanvas, 0, 0);
            // 描画レイヤーを重ねる
            tempCtx.drawImage(this.canvas, 0, 0);
            
            return new Promise((resolve) => {
                tempCanvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/png');
            });
        }
        
        // ===== 破棄 =====
        destroy() {
            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.remove();
            }
            this.canvas = null;
            this.ctx = null;
            this.bgCanvas = null;
            this.bgCtx = null;
        }
    };
    
    console.log('✅ tegaki.js (TegakiCore) loaded');
    
})();