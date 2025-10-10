// ==================================================
// tegaki-loader.js
// ブックマークレット用ローダー - インライン版
// ==================================================

(function() {
    'use strict';
    
    // ===== 設定 =====
    const MEBUKI_TIMEOUT = 3000;
    const MEBUKI_SELECTORS = {
        postButton: 'button[title="レスを投稿"]',
        fileInput: 'input[type="file"][accept*="image"]',
        previewImg: 'img[src^="blob:"]'
    };
    
    // ===== TegakiCore（インライン埋め込み） =====
    const TEGAKI_CORE_CODE = `
(function() {
    'use strict';
    
    window.TegakiCore = class TegakiCore {
        constructor(container) {
            this.container = container;
            this.wrapper = null;
            this.canvas = null;
            this.ctx = null;
            this.bgCanvas = null;
            this.bgCtx = null;
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;
            this.tool = 'pen';
            this.color = '#800000';
            this.size = 2;
            this.colors = ['#800000', '#aa5a56', '#cf9c97', '#e9c2ba', '#f0e0d6', '#ffffee'];
            this.init();
        }
        
        init() {
            this.createUI();
            this.setupCanvas();
            this.attachEvents();
        }
        
        createUI() {
            this.wrapper = document.createElement('div');
            this.wrapper.style.cssText = 'display:flex;width:100%;height:100%;background:#ffffee;';
            
            const sidebar = this.createSidebar();
            const canvasArea = document.createElement('div');
            canvasArea.style.cssText = 'flex:1;display:flex;justify-content:center;align-items:center;background:#ffffee;position:relative;';
            
            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = 'position:relative;width:400px;height:400px;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
            
            this.bgCanvas = document.createElement('canvas');
            this.bgCanvas.width = 400;
            this.bgCanvas.height = 400;
            this.bgCanvas.style.cssText = 'position:absolute;top:0;left:0;background:#f0e0d6;';
            this.bgCtx = this.bgCanvas.getContext('2d');
            
            this.canvas = document.createElement('canvas');
            this.canvas.width = 400;
            this.canvas.height = 400;
            this.canvas.style.cssText = 'position:absolute;top:0;left:0;cursor:crosshair;';
            this.ctx = this.canvas.getContext('2d');
            
            canvasContainer.appendChild(this.bgCanvas);
            canvasContainer.appendChild(this.canvas);
            canvasArea.appendChild(canvasContainer);
            this.wrapper.appendChild(sidebar);
            this.wrapper.appendChild(canvasArea);
            this.container.appendChild(this.wrapper);
        }
        
        createSidebar() {
            const sidebar = document.createElement('div');
            sidebar.style.cssText = 'width:80px;background:#e9c2ba;padding:16px 12px;display:flex;flex-direction:column;gap:20px;border-right:2px solid #cf9c97;overflow-y:auto;';
            
            const toolSection = document.createElement('div');
            toolSection.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
            
            const toolLabel = this.createLabel('ツール');
            const penBtn = this.createToolButton('🖊️', 'ペン', true);
            const eraserBtn = this.createToolButton('🧹', '消しゴム', false);
            
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
            
            const colorSection = document.createElement('div');
            colorSection.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
            const colorLabel = this.createLabel('色');
            const palette = document.createElement('div');
            palette.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px;';
            
            this.colors.forEach((color, i) => {
                const btn = document.createElement('button');
                btn.style.cssText = \`width:100%;height:28px;background:\${color};border:2px solid \${i===0?'#800000':'#aa5a56'};border-radius:4px;cursor:pointer;transition:all 0.2s;\`;
                btn.onclick = () => {
                    this.color = color;
                    palette.querySelectorAll('button').forEach(b => {
                        b.style.border = '2px solid #aa5a56';
                        b.style.transform = 'scale(1)';
                    });
                    btn.style.border = '2px solid #800000';
                    btn.style.transform = 'scale(1.1)';
                };
                palette.appendChild(btn);
            });
            
            colorSection.appendChild(colorLabel);
            colorSection.appendChild(palette);
            
            const sizeSection = document.createElement('div');
            sizeSection.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
            const sizeLabel = this.createLabel('サイズ');
            const sizeValue = document.createElement('div');
            sizeValue.textContent = '2px';
            sizeValue.style.cssText = 'color:#800000;font-size:12px;text-align:center;font-weight:bold;';
            
            const sizeSlider = document.createElement('input');
            sizeSlider.type = 'range';
            sizeSlider.min = '1';
            sizeSlider.max = '50';
            sizeSlider.value = '2';
            sizeSlider.style.cssText = 'width:100%;cursor:pointer;accent-color:#800000;';
            sizeSlider.oninput = (e) => {
                this.size = parseInt(e.target.value);
                sizeValue.textContent = this.size + 'px';
            };
            
            sizeSection.appendChild(sizeLabel);
            sizeSection.appendChild(sizeValue);
            sizeSection.appendChild(sizeSlider);
            
            const clearBtn = document.createElement('button');
            clearBtn.textContent = '🗑️ クリア';
            clearBtn.style.cssText = 'background:#cf9c97;border:2px solid #aa5a56;color:#800000;padding:10px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;margin-top:auto;transition:all 0.2s;';
            clearBtn.onmouseover = () => { clearBtn.style.background = '#aa5a56'; clearBtn.style.color = 'white'; };
            clearBtn.onmouseout = () => { clearBtn.style.background = '#cf9c97'; clearBtn.style.color = '#800000'; };
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
        
        createToolButton(emoji, label, isActive) {
            const btn = document.createElement('button');
            btn.innerHTML = '<div style="font-size:20px;">' + emoji + '</div><div style="font-size:10px;margin-top:2px;">' + label + '</div>';
            btn.title = label;
            btn.style.cssText = 'background:' + (isActive ? '#800000' : '#cf9c97') + ';color:' + (isActive ? 'white' : '#800000') + ';border:2px solid #aa5a56;padding:8px;border-radius:4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:all 0.2s;font-weight:bold;';
            return btn;
        }
        
        createLabel(text) {
            const label = document.createElement('div');
            label.textContent = text;
            label.style.cssText = 'font-size:11px;color:#800000;font-weight:bold;text-align:center;padding:4px 0;background:#f0e0d6;border-radius:3px;';
            return label;
        }
        
        setupCanvas() {
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
        }
        
        attachEvents() {
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup', () => this.stopDrawing());
            this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
            
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.isDrawing = true;
                this.lastX = touch.clientX - rect.left;
                this.lastY = touch.clientY - rect.top;
            });
            
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (!this.isDrawing) return;
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
                this.ctx.lineTo(x, y);
                if (this.tool === 'pen') {
                    this.ctx.globalCompositeOperation = 'source-over';
                    this.ctx.strokeStyle = this.color;
                    this.ctx.lineWidth = this.size;
                } else {
                    this.ctx.globalCompositeOperation = 'destination-out';
                    this.ctx.lineWidth = this.size;
                }
                this.ctx.stroke();
                this.lastX = x;
                this.lastY = y;
            });
            
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.stopDrawing();
            });
        }
        
        startDrawing(e) {
            this.isDrawing = true;
            const rect = this.canvas.getBoundingClientRect();
            this.lastX = e.clientX - rect.left;
            this.lastY = e.clientY - rect.top;
        }
        
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
            } else {
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = this.size;
            }
            this.ctx.stroke();
            this.lastX = x;
            this.lastY = y;
        }
        
        stopDrawing() {
            this.isDrawing = false;
        }
        
        clearCanvas() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        async exportAsBlob() {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 400;
            tempCanvas.height = 400;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(this.bgCanvas, 0, 0);
            tempCtx.drawImage(this.canvas, 0, 0);
            return new Promise((resolve) => {
                tempCanvas.toBlob((blob) => resolve(blob), 'image/png');
            });
        }
        
        destroy() {
            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.remove();
            }
        }
    };
    
    console.log('✅ TegakiCore loaded (inline)');
})();
`;
    
    // ===== ブックマークレット本体 =====
    class TegakiBookmarklet {
        constructor() {
            this.boardType = null;
            this.targetInput = null;
            this.tegakiCore = null;
            this.container = null;
            this.originalBodyOverflow = null;
        }
        
        async start() {
            try {
                this.boardType = this.detectBoard();
                if (!this.boardType) {
                    alert('対応していない掲示板です\n現在はめぶきちゃんねる(mebuki.moe)のみ対応しています');
                    return;
                }
                
                await this.findTargetElements();
                this.createContainer();
                this.loadTegakiCore();
                await this.initTegaki();
                
            } catch (error) {
                console.error('[Tegaki] 起動失敗:', error);
                alert('Tegaki起動に失敗しました\n' + error.message);
                this.cleanup();
            }
        }
        
        detectBoard() {
            const host = location.host;
            if (host.includes('mebuki.moe')) return 'mebuki';
            return null;
        }
        
        async findTargetElements() {
            if (this.boardType === 'mebuki') {
                const postBtn = document.querySelector(MEBUKI_SELECTORS.postButton);
                if (postBtn) {
                    postBtn.click();
                    await this.wait(300);
                }
                
                await this.waitFor(() => {
                    this.targetInput = document.querySelector(MEBUKI_SELECTORS.fileInput);
                    return this.targetInput !== null;
                }, MEBUKI_TIMEOUT);
                
                if (!this.targetInput) {
                    throw new Error('ファイル入力要素が見つかりません');
                }
            }
        }
        
        createContainer() {
            this.container = document.createElement('div');
            this.container.id = 'tegaki-bookmarklet-container';
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 999999;
                display: flex;
                flex-direction: column;
            `;
            
            const topBar = document.createElement('div');
            topBar.style.cssText = `
                display: flex;
                justify-content: flex-end;
                align-items: center;
                padding: 8px 16px;
                background: #cf9c97;
                border-bottom: 2px solid #aa5a56;
                gap: 8px;
            `;
            
            const postBtn = document.createElement('button');
            postBtn.textContent = '📎';
            postBtn.title = '掲示板に添付';
            postBtn.style.cssText = `
                padding: 8px 12px;
                background: #4ade80;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: background 0.2s;
            `;
            postBtn.onmouseover = () => postBtn.style.background = '#22c55e';
            postBtn.onmouseout = () => postBtn.style.background = '#4ade80';
            postBtn.onclick = () => this.exportAndAttach();
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.title = '閉じる';
            closeBtn.style.cssText = `
                padding: 8px 12px;
                background: #f87171;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: background 0.2s;
            `;
            closeBtn.onmouseover = () => closeBtn.style.background = '#ef4444';
            closeBtn.onmouseout = () => closeBtn.style.background = '#f87171';
            closeBtn.onclick = () => this.cancel();
            
            topBar.appendChild(postBtn);
            topBar.appendChild(closeBtn);
            this.container.appendChild(topBar);
            
            const canvasArea = document.createElement('div');
            canvasArea.id = 'tegaki-canvas-area';
            canvasArea.style.cssText = `
                flex: 1;
                position: relative;
                overflow: hidden;
                background: #ffffee;
            `;
            this.container.appendChild(canvasArea);
            
            document.body.appendChild(this.container);
            this.originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        
        loadTegakiCore() {
            // インラインコードを実行
            eval(TEGAKI_CORE_CODE);
        }
        
        async initTegaki() {
            if (!window.TegakiCore) {
                throw new Error('TegakiCoreの初期化に失敗しました');
            }
            
            const canvasArea = document.getElementById('tegaki-canvas-area');
            this.tegakiCore = new window.TegakiCore(canvasArea);
        }
        
        async exportAndAttach() {
            if (!this.tegakiCore) {
                alert('お絵かきツールが初期化されていません');
                return;
            }
            
            try {
                const blob = await this.tegakiCore.exportAsBlob();
                await this.injectToBoard(blob);
                alert('画像を添付しました！投稿ボタンを押してください。');
                this.cleanup();
            } catch (error) {
                console.error('[Tegaki] エクスポート失敗:', error);
                alert('画像の出力に失敗しました\n' + error.message);
            }
        }
        
        async injectToBoard(blob) {
            if (!this.targetInput) {
                throw new Error('入力要素が見つかりません');
            }
            
            const filename = `tegaki_${Date.now()}.png`;
            const file = new File([blob], filename, {
                type: 'image/png',
                lastModified: Date.now()
            });
            
            const dt = new DataTransfer();
            dt.items.add(file);
            this.targetInput.files = dt.files;
            
            const changeEvent = new Event('change', { bubbles: true });
            this.targetInput.dispatchEvent(changeEvent);
            
            try {
                await this.waitFor(() => {
                    return document.querySelector(MEBUKI_SELECTORS.previewImg) !== null;
                }, 3000);
            } catch (error) {
                console.warn('[Tegaki] プレビュー確認タイムアウト');
            }
        }
        
        cancel() {
            if (confirm('描いた内容は破棄されます。よろしいですか?')) {
                this.cleanup();
            }
        }
        
        cleanup() {
            if (this.tegakiCore && this.tegakiCore.destroy) {
                this.tegakiCore.destroy();
                this.tegakiCore = null;
            }
            
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
            
            if (this.originalBodyOverflow !== null) {
                document.body.style.overflow = this.originalBodyOverflow;
                this.originalBodyOverflow = null;
            }
        }
        
        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        waitFor(condition, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const check = () => {
                    if (condition()) {
                        resolve();
                    } else if (Date.now() - startTime > timeout) {
                        reject(new Error('タイムアウト'));
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        }
    }
    
    window.tegakiStart = function() {
        if (!window._tegakiBookmarklet) {
            window._tegakiBookmarklet = new TegakiBookmarklet();
        }
        window._tegakiBookmarklet.start();
    };
    
    window.tegakiStart();
    
})();

console.log('✅ tegaki-loader.js (inline) loaded');