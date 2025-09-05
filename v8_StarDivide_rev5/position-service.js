/**
 * ==========================================================
 * @module PositionService
 * @role   キャンバスの位置・パン操作・座標系変換管理
 * @depends MainController (イベント経由)  
 * @provides
 *   - handleSpaceDown(): スペースキー押下処理
 *   - handleSpaceUp(): スペースキー離上処理
 *   - screenToWorld(x, y): スクリーン座標をワールド座標に変換
 *   - worldToScreen(x, y): ワールド座標をスクリーン座標に変換
 * @notes
 *   - カメラ操作はスペースキー+ドラッグで実行。
 *   - 座標変換は他の衛星が利用可能。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(global){
    class PositionService {
        constructor() {
            this.name = 'PositionService';
            this.mainApi = null;
            this.camera = { 
                x: 0, 
                y: 0, 
                zoom: 1 
            };
            this.panState = {
                active: false,
                lastX: 0,
                lastY: 0
            };
        }

        register(mainApi) { 
            this.mainApi = mainApi;
            this._setupPanHandlers();
        }

        _setupPanHandlers() {
            const canvas = document.querySelector('canvas');
            if(!canvas) return;

            let isPointerDown = false;

            canvas.addEventListener('pointerdown', (e) => {
                if(this._isSpacePressed()) {
                    isPointerDown = true;
                    this.panState.active = true;
                    this.panState.lastX = e.clientX;
                    this.panState.lastY = e.clientY;
                    e.preventDefault();
                }
            });

            canvas.addEventListener('pointermove', (e) => {
                if(this.panState.active && isPointerDown && this._isSpacePressed()) {
                    const dx = e.clientX - this.panState.lastX;
                    const dy = e.clientY - this.panState.lastY;
                    
                    this.camera.x += dx;
                    this.camera.y += dy;
                    
                    this._updateCameraPosition();
                    
                    this.panState.lastX = e.clientX;
                    this.panState.lastY = e.clientY;
                    e.preventDefault();
                }
            });

            canvas.addEventListener('pointerup', (e) => {
                isPointerDown = false;
                this.panState.active = false;
            });

            // ドキュメント全体でpointerupを監視（キャンバス外でのリリース対応）
            document.addEventListener('pointerup', (e) => {
                isPointerDown = false;
                this.panState.active = false;
            });
        }

        handleSpaceDown() {
            // スペースキー押下時の処理
            const canvas = document.querySelector('canvas');
            if(canvas) {
                canvas.style.cursor = 'grab';
            }
            
            if(global.MyApp.debug) {
                console.log('[PositionService] Space down - pan mode enabled');
            }
        }

        handleSpaceUp() {
            // スペースキー離上時の処理
            const canvas = document.querySelector('canvas');
            if(canvas) {
                canvas.style.cursor = 'crosshair';
            }
            
            this.panState.active = false;
            
            if(global.MyApp.debug) {
                console.log('[PositionService] Space up - pan mode disabled');
            }
        }

        _isSpacePressed() {
            // 主星に問い合わせ
            if(this.mainApi && this.mainApi.requestConfirm) {
                const state = this.mainApi.requestConfirm('spaceState');
                return state && state.pressed;
            }
            return false;
        }

        _updateCameraPosition() {
            const container = document.getElementById('canvas-container');
            if(container) {
                // 制限付きカメラ移動
                const maxOffset = 500;
                this.camera.x = Math.max(-maxOffset, Math.min(maxOffset, this.camera.x));
                this.camera.y = Math.max(-maxOffset, Math.min(maxOffset, this.camera.y));
                
                // CSS transformでカメラ位置更新（元の実装に合わせて）
                const baseX = 50; // サイドバー幅考慮
                const centerX = baseX + (window.innerWidth - baseX) / 2;
                const centerY = window.innerHeight / 2;
                
                const finalX = centerX + this.camera.x;
                const finalY = centerY + this.camera.y;
                
                container.style.left = `${finalX}px`;
                container.style.top = `${finalY}px`;
                container.style.transform = 'translate(-50%, -50%)';
                
                // UIService に座標更新を通知
                if(global.MyApp.UIServiceInstance && global.MyApp.UIServiceInstance.updateCoordinates) {
                    global.MyApp.UIServiceInstance.updateCoordinates(this.camera.x, this.camera.y);
                }
                
                if(global.MyApp.debug) {
                    console.log(`[PositionService] Camera: ${this.camera.x}, ${this.camera.y}`);
                }
            }
        }

        screenToWorld(x, y) {
            return { 
                x: x / this.camera.zoom - this.camera.x, 
                y: y / this.camera.zoom - this.camera.y 
            };
        }

        worldToScreen(x, y) {
            return { 
                x: (x + this.camera.x) * this.camera.zoom, 
                y: (y + this.camera.y) * this.camera.zoom 
            };
        }

        resetCamera() {
            this.camera.x = 0;
            this.camera.y = 0;
            this.camera.zoom = 1;
            this._updateCameraPosition();
            
            if(global.MyApp.debug) {
                console.log('[PositionService] Camera reset');
            }
        }

        setCamera(x, y, zoom = 1) {
            this.camera.x = x;
            this.camera.y = y;
            this.camera.zoom = zoom;
            this._updateCameraPosition();
        }

        getCamera() {
            return { 
                x: this.camera.x, 
                y: this.camera.y, 
                zoom: this.camera.zoom 
            };
        }
    }

    global.MyApp.PositionService = PositionService;
})(window);