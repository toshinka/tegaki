// ==================================================
// tegaki-loader.js (動作確認用軽量版)
// めぶきちゃんねる連携テスト用
// スクリプト読込なし・400x400キャンバス・ふたばカラー
// ==================================================

(function() {
    'use strict';
    
    const MEBUKI_TIMEOUT = 3000;
    
    const MEBUKI_SELECTORS = {
        postButton: 'button[title="レスを投稿"]',
        fileInput: 'input[type="file"][accept*="image"]',
        previewImg: 'img[src^="blob:"]'
    };
    
    class TegakiBookmarkletTest {
        constructor() {
            this.boardType = null;
            this.targetInput = null;
            this.container = null;
            this.canvas = null;
            this.ctx = null;
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;
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
                this.createUI();
                this.setupCanvas();
                
            } catch (error) {
                console.error('[Tegaki Test] 起動失敗:', error);
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
        
        createUI() {
            this.container = document.createElement('div');
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 999999;
                background: #ffffee;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            `;
            
            const title = document.createElement('div');
            title.textContent = 'Tegaki 動作確認用テスト';
            title.style.cssText = `
                position: absolute;
                top: 20px;
                font-size: 20px;
                font-weight: bold;
                color: #800000;
            `;
            this.container.appendChild(title);
            
            const canvasWrapper = document.createElement('div');
            canvasWrapper.style.cssText = `
                background: #f0e0d6;
                padding: 20px;
                border-radius: 12px;
                border: 3px solid #800000;
                box-shadow: 0 8px 24px rgba(128, 0, 0, 0.3);
            `;
            
            this.canvas = document.createElement('canvas');
            this.canvas.width = 400;
            this.canvas.height = 400;
            this.canvas.style.cssText = `
                display: block;
                background: white;
                cursor: crosshair;
                border: 2px solid #cf9c97;
            `;
            canvasWrapper.appendChild(this.canvas);
            this.container.appendChild(canvasWrapper);
            
            const buttonBar = document.createElement('div');
            buttonBar.style.cssText = `
                position: absolute;
                bottom: 30px;
                display: flex;
                gap: 15px;
            `;
            
            const clearBtn = document.createElement('button');
            clearBtn.textContent = '🗑 クリア';
            clearBtn.style.cssText = `
                padding: 12px 24px;
                background: #f0e0d6;
                color: #800000;
                border: 2px solid #800000;
                border-radius: 8px;
                cursor: pointer;
                font-size: 15px;
                font-weight: bold;
                transition: all 0.2s;
            `;
            clearBtn.onmouseover = () => {
                clearBtn.style.background = '#cf9c97';
                clearBtn.style.transform = 'translateY(-2px)';
            };
            clearBtn.onmouseout = () => {
                clearBtn.style.background = '#f0e0d6';
                clearBtn.style.transform = 'translateY(0)';
            };
            clearBtn.onclick = () => this.clearCanvas();
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '✕ キャンセル';
            cancelBtn.style.cssText = `
                padding: 12px 24px;
                background: #f44336;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 15px;
                font-weight: bold;
                transition: all 0.2s;
            `;
            cancelBtn.onmouseover = () => {
                cancelBtn.style.background = '#da190b';
                cancelBtn.style.transform = 'translateY(-2px)';
            };
            cancelBtn.onmouseout = () => {
                cancelBtn.style.background = '#f44336';
                cancelBtn.style.transform = 'translateY(0)';
            };
            cancelBtn.onclick = () => this.cancel();
            
            const doneBtn = document.createElement('button');
            doneBtn.textContent = '✓ 掲示板に貼り付けて閉じる';
            doneBtn.style.cssText = `
                padding: 12px 28px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.2s;
            `;
            doneBtn.onmouseover = () => {
                doneBtn.style.background = '#45a049';
                doneBtn.style.transform = 'translateY(-2px)';
            };
            doneBtn.onmouseout = () => {
                doneBtn.style.background = '#4CAF50';
                doneBtn.style.transform = 'translateY(0)';
            };
            doneBtn.onclick = () => this.exportAndClose();
            
            buttonBar.appendChild(clearBtn);
            buttonBar.appendChild(cancelBtn);
            buttonBar.appendChild(doneBtn);
            this.container.appendChild(buttonBar);
            
            document.body.appendChild(this.container);
            
            this.originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        
        setupCanvas() {
            this.ctx = this.canvas.getContext('2d');
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.lineWidth = 3;
            this.ctx.strokeStyle = '#800000';
            
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup', () => this.stopDrawing());
            this.canvas.addEventListener('mouseout', () => this.stopDrawing());
            
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
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
        }
        
        stopDrawing() {
            this.isDrawing = false;
        }
        
        clearCanvas() {
            if (confirm('キャンバスをクリアしますか？')) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }
        
        async exportAndClose() {
            try {
                const blob = await this.canvasToBlob();
                await this.injectToBoard(blob);
                
                alert('掲示板への画像貼り付けが完了しました！\nコメントを入力して投稿してください。');
                this.cleanup();
                
            } catch (error) {
                console.error('[Tegaki Test] エクスポート失敗:', error);
                alert('画像の出力に失敗しました\n' + error.message);
            }
        }
        
        canvasToBlob() {
            return new Promise((resolve, reject) => {
                this.canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Blob生成に失敗しました'));
                    }
                }, 'image/png');
            });
        }
        
        async injectToBoard(blob) {
            if (!this.targetInput) {
                throw new Error('入力要素が見つかりません');
            }
            
            const filename = `tegaki_test_${Date.now()}.png`;
            
            const file = new File([blob], filename, {
                type: 'image/png',
                lastModified: Date.now()
            });
            
            const dt = new DataTransfer();
            dt.items.add(file);
            this.targetInput.files = dt.files;
            
            const changeEvent = new Event('change', { bubbles: true });
            this.targetInput.dispatchEvent(changeEvent);
            
            await this.waitForPreview();
        }
        
        async waitForPreview() {
            try {
                await this.waitFor(() => {
                    const preview = document.querySelector(MEBUKI_SELECTORS.previewImg);
                    return preview !== null;
                }, 5000);
            } catch (error) {
                console.warn('[Tegaki Test] プレビュー表示確認タイムアウト（処理は継続）');
            }
        }
        
        cancel() {
            if (confirm('描いた内容は破棄されます。よろしいですか？')) {
                this.cleanup();
            }
        }
        
        cleanup() {
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
            
            if (this.originalBodyOverflow !== null) {
                document.body.style.overflow = this.originalBodyOverflow;
                this.originalBodyOverflow = null;
            }
            
            this.canvas = null;
            this.ctx = null;
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
        if (!window._tegakiBookmarkletTest) {
            window._tegakiBookmarkletTest = new TegakiBookmarkletTest();
        }
        window._tegakiBookmarkletTest.start();
    };
    
    window.tegakiStart();
    
})();