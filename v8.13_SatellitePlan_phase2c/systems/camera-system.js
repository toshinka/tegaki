/**
 * Camera System (Phase2 Separated)
 * PixiJS v8.13 対応版
 * 座標変換API統一、構文エラー修正済み
 */
(function() {
    'use strict';

    class CameraSystem {
        constructor() {
            this.pixiApp = null;
            this.worldContainer = null;
            this.gridContainer = null;
            this.camera = {
                x: 0,
                y: 0,
                zoom: 1,
                minZoom: 0.1,
                maxZoom: 10,
                isDragging: false,
                dragStartX: 0,
                dragStartY: 0,
                cameraStartX: 0,
                cameraStartY: 0
            };
            
            // システム間連携
            this.layerManager = null;
            this.drawingEngine = null;
            
            this.boundEvents = {
                wheel: null,
                pointerdown: null,
                pointermove: null,
                pointerup: null,
                keydown: null,
                keyup: null,
                contextmenu: null
            };
            
            this.keys = {
                space: false
            };
        }

        /**
         * システム連携設定
         */
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }

        setDrawingEngine(drawingEngine) {
            this.drawingEngine = drawingEngine;
        }

        /**
         * 初期化
         */
        async initialize(pixiApp, worldContainer) {
            this.pixiApp = pixiApp;
            this.worldContainer = worldContainer;
            
            // Grid container作成
            this.gridContainer = new PIXI.Container();
            this.gridContainer.eventMode = 'static';
            this.worldContainer.addChild(this.gridContainer);
            
            this.createGrid();
            this.setupEventListeners();
            this.updateCamera();
            
            console.log('✅ CameraSystem initialized');
        }

        /**
         * グリッド作成
         */
        createGrid() {
            if (!this.gridContainer) return;
            
            this.gridContainer.removeChildren();
            
            const graphics = new PIXI.Graphics();
            const gridSize = window.CONFIG?.CANVAS?.GRID_SIZE || 50;
            const screenWidth = this.pixiApp.screen.width;
            const screenHeight = this.pixiApp.screen.height;
            
            // グリッド範囲を拡張（カメラ移動に対応）
            const extend = Math.max(screenWidth, screenHeight) * 2;
            const startX = -extend;
            const endX = extend;
            const startY = -extend;
            const endY = extend;
            
            // 縦線
            for (let x = startX; x <= endX; x += gridSize) {
                if (x === 0) {
                    graphics.moveTo(x, startY).lineTo(x, endY).stroke({ width: 2, color: 0x666666 });
                } else {
                    graphics.moveTo(x, startY).lineTo(x, endY).stroke({ width: 1, color: 0x333333 });
                }
            }
            
            // 横線
            for (let y = startY; y <= endY; y += gridSize) {
                if (y === 0) {
                    graphics.moveTo(startX, y).lineTo(endX, y).stroke({ width: 2, color: 0x666666 });
                } else {
                    graphics.moveTo(startX, y).lineTo(endX, y).stroke({ width: 1, color: 0x333333 });
                }
            }
            
            this.gridContainer.addChild(graphics);
        }

        /**
         * イベントリスナー設定
         */
        setupEventListeners() {
            if (!this.pixiApp?.canvas) return;
            
            const canvas = this.pixiApp.canvas;
            
            // ホイールズーム
            this.boundEvents.wheel = (e) => this.handleWheel(e);
            canvas.addEventListener('wheel', this.boundEvents.wheel, { passive: false });
            
            // ドラッグ操作
            this.boundEvents.pointerdown = (e) => this.handlePointerDown(e);
            this.boundEvents.pointermove = (e) => this.handlePointerMove(e);
            this.boundEvents.pointerup = (e) => this.handlePointerUp(e);
            
            canvas.addEventListener('pointerdown', this.boundEvents.pointerdown);
            canvas.addEventListener('pointermove', this.boundEvents.pointermove);
            canvas.addEventListener('pointerup', this.boundEvents.pointerup);
            
            // キーボード
            this.boundEvents.keydown = (e) => this.handleKeyDown(e);
            this.boundEvents.keyup = (e) => this.handleKeyUp(e);
            
            document.addEventListener('keydown', this.boundEvents.keydown);
            document.addEventListener('keyup', this.boundEvents.keyup);
            
            // コンテキストメニュー無効
            this.boundEvents.contextmenu = (e) => e.preventDefault();
            canvas.addEventListener('contextmenu', this.boundEvents.contextmenu);
        }

        /**
         * ホイールズーム処理
         */
        handleWheel(e) {
            e.preventDefault();
            
            const rect = this.pixiApp.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            
            // 座標変換API使用
            const worldPos = this.screenToCanvasForDrawing(screenX, screenY);
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.max(this.camera.minZoom, 
                           Math.min(this.camera.maxZoom, this.camera.zoom * zoomFactor));
            
            if (newZoom !== this.camera.zoom) {
                // ズーム中心点を維持
                this.camera.x += (worldPos.x - this.camera.x) * (1 - newZoom / this.camera.zoom);
                this.camera.y += (worldPos.y - this.camera.y) * (1 - newZoom / this.camera.zoom);
                this.camera.zoom = newZoom;
                
                this.updateCamera();
            }
        }

        /**
         * ポインターダウン処理
         */
        handlePointerDown(e) {
            if (e.button !== 1 && !this.keys.space) return; // 中ボタンまたはSpace
            
            e.preventDefault();
            this.camera.isDragging = true;
            this.camera.dragStartX = e.clientX;
            this.camera.dragStartY = e.clientY;
            this.camera.cameraStartX = this.camera.x;
            this.camera.cameraStartY = this.camera.y;
            
            this.pixiApp.canvas.setPointerCapture(e.pointerId);
        }

        /**
         * ポインタームーブ処理
         */
        handlePointerMove(e) {
            if (!this.camera.isDragging) return;
            
            const deltaX = (e.clientX - this.camera.dragStartX) / this.camera.zoom;
            const deltaY = (e.clientY - this.camera.dragStartY) / this.camera.zoom;
            
            this.camera.x = this.camera.cameraStartX - deltaX;
            this.camera.y = this.camera.cameraStartY - deltaY;
            
            this.updateCamera();
        }

        /**
         * ポインターアップ処理
         */
        handlePointerUp(e) {
            if (!this.camera.isDragging) return;
            
            this.camera.isDragging = false;
            
            try {
                this.pixiApp.canvas.releasePointerCapture(e.pointerId);
            } catch (ex) {
                // ポインターキャプチャー解除の失敗は無視
            }
        }

        /**
         * キーダウン処理
         */
        handleKeyDown(e) {
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.keys.space = true;
                    break;
                    
                case 'Home':
                    this.resetCamera();
                    break;
                    
                case 'KeyR':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.resetCamera();
                    }
                    break;
            }
        }

        /**
         * キーアップ処理
         */
        handleKeyUp(e) {
            switch (e.code) {
                case 'Space':
                    this.keys.space = false;
                    break;
            }
        }

        /**
         * カメラリセット
         */
        resetCamera() {
            this.camera.x = 0;
            this.camera.y = 0;
            this.camera.zoom = 1;
            this.updateCamera();
        }

        /**
         * カメラ更新
         */
        updateCamera() {
            if (!this.worldContainer) return;
            
            const centerX = this.pixiApp.screen.width / 2;
            const centerY = this.pixiApp.screen.height / 2;
            
            this.worldContainer.position.set(
                centerX - this.camera.x * this.camera.zoom,
                centerY - this.camera.y * this.camera.zoom
            );
            
            this.worldContainer.scale.set(this.camera.zoom, this.camera.zoom);
        }

        /**
         * 座標変換: スクリーン → ワールド（描画用）
         * CoordinateSystem API 統一使用
         */
        screenToCanvasForDrawing(screenX, screenY) {
            if (window.CoordinateSystem) {
                return window.CoordinateSystem.screenToCanvas(this.pixiApp, screenX, screenY);
            }
            
            // フォールバック（緊急用のみ）
            const rect = this.pixiApp.canvas.getBoundingClientRect();
            const centerX = this.pixiApp.screen.width / 2;
            const centerY = this.pixiApp.screen.height / 2;
            
            return {
                x: this.camera.x + (screenX - centerX) / this.camera.zoom,
                y: this.camera.y + (screenY - centerY) / this.camera.zoom
            };
        }

        /**
         * 座標変換: ワールド → スクリーン
         */
        worldToScreen(worldX, worldY) {
            const centerX = this.pixiApp.screen.width / 2;
            const centerY = this.pixiApp.screen.height / 2;
            
            return {
                x: centerX + (worldX - this.camera.x) * this.camera.zoom,
                y: centerY + (worldY - this.camera.y) * this.camera.zoom
            };
        }

        /**
         * ビューポート取得
         */
        getViewport() {
            const halfWidth = this.pixiApp.screen.width / (2 * this.camera.zoom);
            const halfHeight = this.pixiApp.screen.height / (2 * this.camera.zoom);
            
            return {
                x: this.camera.x - halfWidth,
                y: this.camera.y - halfHeight,
                width: halfWidth * 2,
                height: halfHeight * 2
            };
        }

        /**
         * カメラ情報取得
         */
        getCameraInfo() {
            return {
                x: this.camera.x,
                y: this.camera.y,
                zoom: this.camera.zoom,
                isDragging: this.camera.isDragging
            };
        }

        /**
         * カメラ設定
         */
        setCameraPosition(x, y, zoom = null) {
            this.camera.x = x;
            this.camera.y = y;
            if (zoom !== null) {
                this.camera.zoom = Math.max(this.camera.minZoom, 
                                  Math.min(this.camera.maxZoom, zoom));
            }
            this.updateCamera();
        }

        /**
         * 破棄処理
         */
        destroy() {
            if (!this.pixiApp?.canvas) return;
            
            const canvas = this.pixiApp.canvas;
            
            // イベントリスナー削除
            if (this.boundEvents.wheel) {
                canvas.removeEventListener('wheel', this.boundEvents.wheel);
            }
            if (this.boundEvents.pointerdown) {
                canvas.removeEventListener('pointerdown', this.boundEvents.pointerdown);
            }
            if (this.boundEvents.pointermove) {
                canvas.removeEventListener('pointermove', this.boundEvents.pointermove);
            }
            if (this.boundEvents.pointerup) {
                canvas.removeEventListener('pointerup', this.boundEvents.pointerup);
            }
            if (this.boundEvents.contextmenu) {
                canvas.removeEventListener('contextmenu', this.boundEvents.contextmenu);
            }
            
            if (this.boundEvents.keydown) {
                document.removeEventListener('keydown', this.boundEvents.keydown);
            }
            if (this.boundEvents.keyup) {
                document.removeEventListener('keyup', this.boundEvents.keyup);
            }
            
            // コンテナ破棄
            if (this.gridContainer) {
                this.gridContainer.destroy({ children: true });
                this.gridContainer = null;
            }
            
            // 参照クリア
            this.pixiApp = null;
            this.worldContainer = null;
            this.layerManager = null;
            this.drawingEngine = null;
        }
    }

    // グローバル公開
    if (!window.TegakiCameraSeparated) {
        window.TegakiCameraSeparated = {};
    }
    window.TegakiCameraSeparated.CameraSystem = CameraSystem;
    
    console.log('✅ camera-system.js loaded (Phase2 separated)');
})();