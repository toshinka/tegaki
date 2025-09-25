/**
 * Camera System - 座標変換API・カメラ制御・DOM イベント処理
 * 責務: 座標変換・カメラ制御・DOM イベント処理
 */

(function() {
    'use strict';
    
    class CameraSystem {
        constructor(coreEngine) {
            this.coreEngine = coreEngine;
            this.app = coreEngine.app;
            this.CONFIG = window.TEGAKI_CONFIG;
            
            // PixiJS Container階層
            this.worldContainer = null;
            this.canvasContainer = null;
            
            // カメラ状態
            this.camera = {
                x: 0,
                y: 0,
                zoom: 1,
                rotation: 0
            };
            
            this.setupContainers();
            this.setupEventListeners();
            
            if (this.CONFIG?.debug) {
                console.log('✅ CameraSystem initialized');
            }
        }
        
        /**
         * Container階層設定
         */
        setupContainers() {
            // worldContainer: カメラ変形を適用するコンテナ
            this.worldContainer = new PIXI.Container();
            this.app.stage.addChild(this.worldContainer);
            
            // canvasContainer: キャンバス内容を格納するコンテナ
            this.canvasContainer = new PIXI.Container();
            this.worldContainer.addChild(this.canvasContainer);
            
            // 初期位置設定（キャンバス中央）
            this.worldContainer.position.set(
                this.CONFIG.canvas.width / 2, 
                this.CONFIG.canvas.height / 2
            );
            
            if (this.CONFIG?.debug) {
                console.log('✅ Camera containers setup');
            }
        }
        
        /**
         * イベントリスナー設定
         */
        setupEventListeners() {
            // キャンバスリサイズイベント
            window.Tegaki.EventBus.on('canvas:resize', (data) => {
                this.handleCanvasResize(data.width, data.height);
            });
        }
        
        // ========================================
        // 座標変換API（最重要）
        // ========================================
        
        /**
         * スクリーン座標 → ワールド座標変換
         * @input screen coordinates {x, y} - ブラウザクライアントピクセル（mouse event の clientX/Y）
         * @output world coordinates {x, y} - worldContainer 上の座標
         */
        screenToWorld(screenPt) {
            const rect = this.app.view.getBoundingClientRect();
            
            // ブラウザ補正（CSS scale・devicePixelRatio考慮）
            const scale = this.app.view.width / rect.width;
            const x = (screenPt.x - rect.left) * scale;
            const y = (screenPt.y - rect.top) * scale;
            
            // worldContainer上での座標に変換
            return this.worldContainer.toLocal({x, y}, this.app.stage);
        }
        
        /**
         * ワールド座標 → キャンバス座標変換
         * @input world coordinates {x, y} - worldContainer 上の座標
         * @output canvas coordinates {x, y} - キャンバス論理座標（canonical）
         */
        worldToCanvas(worldPt) {
            return this.canvasContainer.toLocal(worldPt, this.worldContainer);
        }
        
        /**
         * スクリーン座標 → キャンバス座標変換（統一API）
         * @input screen coordinates {x, y} - ブラウザクライアントピクセル
         * @output canvas coordinates {x, y} - キャンバス論理座標（canonical）
         */
        screenToCanvas(screenPt) {
            const world = this.screenToWorld(screenPt);
            return this.worldToCanvas(world);
        }
        
        /**
         * キャンバス座標 → ワールド座標変換（逆変換）
         * @input canvas coordinates {x, y} - キャンバス論理座標（canonical）
         * @output world coordinates {x, y} - worldContainer 上の座標
         */
        canvasToWorld(canvasPt) {
            return this.worldContainer.toLocal(canvasPt, this.canvasContainer);
        }
        
        /**
         * ワールド座標 → スクリーン座標変換（逆変換）
         * @input world coordinates {x, y} - worldContainer 上の座標
         * @output screen coordinates {x, y} - ブラウザクライアントピクセル
         */
        worldToScreen(worldPt) {
            const stagePt = this.app.stage.toLocal(worldPt, this.worldContainer);
            const rect = this.app.view.getBoundingClientRect();
            
            // ブラウザ補正の逆算
            const scale = this.app.view.width / rect.width;
            
            return {
                x: (stagePt.x / scale) + rect.left,
                y: (stagePt.y / scale) + rect.top
            };
        }
        
        /**
         * キャンバス座標 → スクリーン座標変換（逆変換）
         * @input canvas coordinates {x, y} - キャンバス論理座標（canonical）
         * @output screen coordinates {x, y} - ブラウザクライアントピクセル
         */
        canvasToScreen(canvasPt) {
            const world = this.canvasToWorld(canvasPt);
            return this.worldToScreen(world);
        }
        
        // ========================================
        // カメラ操作API
        // ========================================
        
        /**
         * カメラ移動
         * @param {number} deltaX - X方向移動量
         * @param {number} deltaY - Y方向移動量
         */
        panCamera(deltaX, deltaY) {
            this.camera.x += deltaX;
            this.camera.y += deltaY;
            
            this.worldContainer.position.set(
                this.CONFIG.canvas.width / 2 + this.camera.x,
                this.CONFIG.canvas.height / 2 + this.camera.y
            );
            
            if (this.CONFIG?.debug) {
                console.log(`📷 Camera pan: ${this.camera.x}, ${this.camera.y}`);
            }
        }
        
        /**
         * カメラズーム
         * @param {number} zoomFactor - ズーム倍率
         * @param {Object} [center] - ズーム中心点（screen座標）
         */
        zoomCamera(zoomFactor, center = null) {
            const oldZoom = this.camera.zoom;
            this.camera.zoom = Math.max(0.1, Math.min(10, this.camera.zoom * zoomFactor));
            
            if (center) {
                // ズーム中心点を維持しながらズーム
                const worldPt = this.screenToWorld(center);
                this.worldContainer.scale.set(this.camera.zoom, this.camera.zoom);
                
                // 中心点がずれないように位置調整
                const newWorldPt = this.screenToWorld(center);
                const deltaX = (worldPt.x - newWorldPt.x) * this.camera.zoom;
                const deltaY = (worldPt.y - newWorldPt.y) * this.camera.zoom;
                
                this.panCamera(deltaX, deltaY);
            } else {
                // 中央ズーム
                this.worldContainer.scale.set(this.camera.zoom, this.camera.zoom);
            }
            
            if (this.CONFIG?.debug) {
                console.log(`📷 Camera zoom: ${this.camera.zoom}`);
            }
        }
        
        /**
         * カメラ回転
         * @param {number} deltaRotation - 回転角度（ラジアン）
         */
        rotateCamera(deltaRotation) {
            this.camera.rotation += deltaRotation;
            this.worldContainer.rotation = this.camera.rotation;
            
            if (this.CONFIG?.debug) {
                console.log(`📷 Camera rotation: ${this.camera.rotation}`);
            }
        }
        
        /**
         * カメラリセット
         */
        resetCamera() {
            this.camera = {
                x: 0,
                y: 0,
                zoom: 1,
                rotation: 0
            };
            
            this.worldContainer.position.set(
                this.CONFIG.canvas.width / 2,
                this.CONFIG.canvas.height / 2
            );
            this.worldContainer.scale.set(1, 1);
            this.worldContainer.rotation = 0;
            
            if (this.CONFIG?.debug) {
                console.log('📷 Camera reset');
            }
        }
        
        // ========================================
        // キャンバスリサイズ対応
        // ========================================
        
        /**
         * キャンバスリサイズハンドラ
         * @param {number} width - 新しい幅
         * @param {number} height - 新しい高さ
         */
        handleCanvasResize(width, height) {
            this.resizeCanvas(width, height);
        }
        
        /**
         * キャンバスサイズ変更
         * @param {number} width - 幅
         * @param {number} height - 高さ
         */
        resizeCanvas(width, height) {
            // アプリケーションサイズ更新
            this.app.renderer.resize(width, height);
            
            // worldContainer位置更新（中央維持）
            this.worldContainer.position.set(
                width / 2 + this.camera.x,
                height / 2 + this.camera.y
            );
            
            if (this.CONFIG?.debug) {
                console.log(`📷 Canvas resized: ${width}x${height}`);
            }
        }
        
        // ========================================
        // ユーティリティ・状態取得
        // ========================================
        
        /**
         * カメラ状態取得
         * @returns {Object} カメラ状態
         */
        getCameraState() {
            return {
                ...this.camera,
                viewCenter: {
                    x: this.CONFIG.canvas.width / 2,
                    y: this.CONFIG.canvas.height / 2
                }
            };
        }
        
        /**
         * 可視領域取得（キャンバス座標）
         * @returns {Object} 可視領域 {x, y, width, height}
         */
        getVisibleBounds() {
            const halfWidth = (this.CONFIG.canvas.width / 2) / this.camera.zoom;
            const halfHeight = (this.CONFIG.canvas.height / 2) / this.camera.zoom;
            
            const center = this.screenToCanvas({
                x: this.CONFIG.canvas.width / 2,
                y: this.CONFIG.canvas.height / 2
            });
            
            return {
                x: center.x - halfWidth,
                y: center.y - halfHeight,
                width: halfWidth * 2,
                height: halfHeight * 2
            };
        }
        
        /**
         * Container参照取得
         */
        getContainers() {
            return {
                world: this.worldContainer,
                canvas: this.canvasContainer
            };
        }
        
        /**
         * システム状態取得（デバッグ用）
         */
        getState() {
            if (!this.CONFIG?.debug) return null;
            
            return {
                camera: this.camera,
                containers: {
                    world: {
                        position: this.worldContainer.position,
                        scale: this.worldContainer.scale,
                        rotation: this.worldContainer.rotation
                    },
                    canvas: {
                        position: this.canvasContainer.position,
                        scale: this.canvasContainer.scale,
                        rotation: this.canvasContainer.rotation
                    }
                },
                visibleBounds: this.getVisibleBounds()
            };
        }
    }

    // システム登録
    window.TegakiSystems.Register('CameraSystem', CameraSystem);
    
    if (window.TEGAKI_CONFIG?.debug) {
        console.log('✅ camera-system.js loaded');
    }

})();