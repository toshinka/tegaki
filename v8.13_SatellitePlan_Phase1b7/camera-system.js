// ===== camera-system.js - カメラ・ビューポート制御システム（PixiJS v8.13対応） =====
// core-engine.jsから分割 - 無限キャンバス対応の視点制御に特化
// レイヤー状態には一切影響を与えない純粋なビュー操作

/*
=== CameraSystemの責務 ===
- ビューポートのパン・ズーム・回転
- 無限キャンバスの視点制御
- 座標変換（screen↔world↔canvas）
- カメラフレーム・ガイドライン表示
- マウス・キーボード・タッチ操作のハンドリング
- カメラ状態の保存・復元

=== 重要な設計方針 ===
- レイヤー編集には一切関与しない
- レイヤーのTransformは変更しない
- 純粋なビュー座標変換のみ
- 他システムとの疎結合

=== APIデザイン ===
- init(app, options): 初期化
- panTo(x, y): 指定座標へパン
- panBy(dx, dy): 相対パン
- zoomTo(scale): 指定倍率へズーム
- zoomBy(factor): 相対ズーム
- resetView(): ビューリセット
- screenToWorld(x, y): screen→world座標変換
- worldToScreen(x, y): world→screen座標変換
- screenToCanvas(x, y): screen→canvas座標変換（描画用）
*/

(function() {
    'use strict';
    
    // === 設定とユーティリティ ===
    const CONFIG = window.TEGAKI_CONFIG;
    const CoordinateSystem = window.CoordinateSystem;
    
    if (!CONFIG) {
        throw new Error('TEGAKI_CONFIG is required for CameraSystem');
    }
    
    const debug = (message, ...args) => {
        if (CONFIG.debug) {
            console.log(`[CameraSystem] ${message}`, ...args);
        }
    };

    // === EventBusシンプル実装 ===
    class SimpleEventBus {
        constructor() {
            this.listeners = new Map();
        }
        
        on(eventName, callback) {
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, []);
            }
            this.listeners.get(eventName).push(callback);
        }
        
        off(eventName, callback) {
            if (!this.listeners.has(eventName)) return;
            const listeners = this.listeners.get(eventName);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
        
        emit(eventName, payload) {
            if (!this.listeners.has(eventName)) return;
            this.listeners.get(eventName).forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`CameraSystem EventBus error in ${eventName}:`, error);
                }
            });
        }
    }

    // === カメラ状態管理 ===
    class CameraState {
        constructor() {
            this.position = { x: 0, y: 0 };
            this.scale = CONFIG.camera.initialScale;
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            this.bounds = null; // カメラ移動制限（将来用）
        }
        
        /**
         * カメラ状態をJSON形式にシリアライズ
         */
        serialize() {
            return {
                position: { ...this.position },
                scale: this.scale,
                rotation: this.rotation,
                horizontalFlipped: this.horizontalFlipped,
                verticalFlipped: this.verticalFlipped,
                bounds: this.bounds
            };
        }
        
        /**
         * JSON形式からカメラ状態を復元
         */
        static deserialize(data) {
            const state = new CameraState();
            state.position = data.position || { x: 0, y: 0 };
            state.scale = data.scale || CONFIG.camera.initialScale;
            state.rotation = data.rotation || 0;
            state.horizontalFlipped = data.horizontalFlipped || false;
            state.verticalFlipped = data.verticalFlipped || false;
            state.bounds = data.bounds || null;
            return state;
        }
        
        /**
         * 初期状態へのリセット
         */
        reset() {
            this.position = { x: 0, y: 0 };
            this.scale = CONFIG.camera.initialScale;
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            this.bounds = null;
        }
    }

    // === メインCameraSystemクラス ===
    class CameraSystem {
        constructor() {
            this.app = null;
            this.worldContainer = null;
            this.canvasContainer = null;
            this.cameraFrame = null;
            this.guideLines = null;
            this.canvasMask = null;
            
            this.state = new CameraState();
            this.initialState = new CameraState();
            
            this.eventBus = new SimpleEventBus();
            
            // 操作状態管理
            this.isDragging = false;
            this.isScaleRotateDragging = false;
            this.lastPointerPos = { x: 0, y: 0 };
            
            // キー状態管理
            this.keysPressed = new Set();
            this.spacePressed = false;
            this.shiftPressed = false;
            
            // 外部システム連携
            this.layerSystemActive = false; // レイヤー操作モード検出用
            
            // 設定
            this.panSpeed = CONFIG.camera.dragMoveSpeed;
            this.zoomSpeed = CONFIG.camera.wheelZoomSpeed;
            this.rotationSpeed = CONFIG.camera.dragRotationSpeed;
            this.scaleSpeed = CONFIG.camera.dragScaleSpeed;
        }
        
        /**
         * CameraSystemの初期化
         * @param {Object} options - 初期化オプション
         * @param {PIXI.Application} options.app - PixiJSアプリケーション
         * @param {Object} options.containers - コンテナ設定
         */
        init(options) {
            this.app = options.app;
            
            // コンテナ構造の構築
            this.setupContainers(options.containers);
            
            // イベントハンドラーの設定
            this.setupEventHandlers();
            
            // 初期カメラ位置の設定
            this.initializeCamera();
            
            // UI要素の作成
            this.createCameraFrame();
            this.createGuideLines();
            this.createCanvasMask();
            
            debug('CameraSystem initialized');
            return this;
        }
        
        /**
         * コンテナ構造の構築
         * @param {Object} containers - カスタムコンテナ（オプション）
         */
        setupContainers(containers = {}) {
            // WorldContainerの設定（カメラが制御するルートコンテナ）
            if (containers.worldContainer) {
                this.worldContainer = containers.worldContainer;
            } else {
                this.worldContainer = new PIXI.Container();
                this.worldContainer.label = 'worldContainer';
                this.app.stage.addChild(this.worldContainer);
            }
            
            // CanvasContainerの設定（実際の描画コンテンツが入る）
            if (containers.canvasContainer) {
                this.canvasContainer = containers.canvasContainer;
            } else {
                this.canvasContainer = new PIXI.Container();
                this.canvasContainer.label = 'canvasContainer';
                this.worldContainer.addChild(this.canvasContainer);
            }
            
            debug('Camera containers set up');
        }
        
        /**
         * 初期カメラ位置の設定
         */
        initializeCamera() {
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            // キャンバスを画面中央に配置
            const initialX = centerX - CONFIG.canvas.width / 2;
            const initialY = centerY - CONFIG.canvas.height / 2;
            
            this.state.position.x = initialX;
            this.state.position.y = initialY;
            
            // 初期状態を保存
            this.initialState.position = { ...this.state.position };
            this.initialState.scale = this.state.scale;
            
            // WorldContainerに適用
            this.applyStateToWorldContainer();
            
            debug('Camera initialized at', this.state.position);
        }
        
        /**
         * カメラ状態をWorldContainerに適用
         */
        applyStateToWorldContainer() {
            this.worldContainer.position.set(this.state.position.x, this.state.position.y);
            this.worldContainer.scale.set(
                this.state.scale * (this.state.horizontalFlipped ? -1 : 1),
                this.state.scale * (this.state.verticalFlipped ? -1 : 1)
            );
            this.worldContainer.rotation = this.state.rotation;
            
            // UI更新通知
            this.eventBus.emit('camera-moved', {
                position: { ...this.state.position },
                scale: this.state.scale,
                rotation: this.state.rotation
            });
        }
        
        /**
         * 指定座標へのパン
         * @param {number} x - X座標
         * @param {number} y - Y座標
         * @param {Object} options - オプション
         */
        panTo(x, y, options = {}) {
            this.state.position.x = x;
            this.state.position.y = y;
            
            this.applyStateToWorldContainer();
            
            debug(`Camera panned to (${x}, ${y})`);
        }
        
        /**
         * 相対パン
         * @param {number} dx - X方向の移動量
         * @param {number} dy - Y方向の移動量
         */
        panBy(dx, dy) {
            this.state.position.x += dx;
            this.state.position.y += dy;
            
            this.applyStateToWorldContainer();
            
            debug(`Camera panned by (${dx}, ${dy})`);
        }
        
        /**
         * 指定倍率へのズーム
         * @param {number} scale - 倍率
         * @param {Object} options - オプション
         */
        zoomTo(scale, options = {}) {
            const clampedScale = Math.max(
                CONFIG.camera.minScale,
                Math.min(CONFIG.camera.maxScale, scale)
            );
            
            if (clampedScale === this.state.scale) return false;
            
            // ズーム中心点
            const centerX = options.centerX !== undefined ? options.centerX : CONFIG.canvas.width / 2;
            const centerY = options.centerY !== undefined ? options.centerY : CONFIG.canvas.height / 2;
            
            // 中心点を維持してズーム
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            this.state.scale = clampedScale;
            this.applyStateToWorldContainer();
            
            // 中心点補正
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.state.position.x += worldCenter.x - newWorldCenter.x;
            this.state.position.y += worldCenter.y - newWorldCenter.y;
            this.applyStateToWorldContainer();
            
            debug(`Camera zoomed to ${clampedScale}x`);
            return true;
        }
        
        /**
         * 相対ズーム
         * @param {number} factor - 倍率係数
         * @param {Object} options - オプション
         */
        zoomBy(factor, options = {}) {
            return this.zoomTo(this.state.scale * factor, options);
        }
        
        /**
         * カメラ回転
         * @param {number} rotation - 回転角（ラジアン）
         * @param {Object} options - オプション
         */
        rotateTo(rotation, options = {}) {
            // 回転中心点
            const centerX = options.centerX !== undefined ? options.centerX : CONFIG.canvas.width / 2;
            const centerY = options.centerY !== undefined ? options.centerY : CONFIG.canvas.height / 2;
            
            // 中心点を維持して回転
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            this.state.rotation = rotation;
            this.applyStateToWorldContainer();
            
            // 中心点補正
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.state.position.x += worldCenter.x - newWorldCenter.x;
            this.state.position.y += worldCenter.y - newWorldCenter.y;
            this.applyStateToWorldContainer();
            
            debug(`Camera rotated to ${rotation} rad`);
        }
        
        /**
         * 水平反転
         */
        flipHorizontal() {
            this.state.horizontalFlipped = !this.state.horizontalFlipped;
            
            // 反転中心を維持
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            this.applyStateToWorldContainer();
            
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.state.position.x += worldCenter.x - newWorldCenter.x;
            this.state.position.y += worldCenter.y - newWorldCenter.y;
            this.applyStateToWorldContainer();
            
            debug(`Camera horizontal flip: ${this.state.horizontalFlipped}`);
        }
        
        /**
         * 垂直反転
         */
        flipVertical() {
            this.state.verticalFlipped = !this.state.verticalFlipped;
            
            // 反転中心を維持
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            this.applyStateToWorldContainer();
            
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.state.position.x += worldCenter.x - newWorldCenter.x;
            this.state.position.y += worldCenter.y - newWorldCenter.y;
            this.applyStateToWorldContainer();
            
            debug(`Camera vertical flip: ${this.state.verticalFlipped}`);
        }
        
        /**
         * ビューのリセット
         */
        resetView() {
            this.state.position = { ...this.initialState.position };
            this.state.scale = this.initialState.scale;
            this.state.rotation = 0;
            this.state.horizontalFlipped = false;
            this.state.verticalFlipped = false;
            
            this.applyStateToWorldContainer();
            
            debug('Camera reset to initial state');
        }
        
        /**
         * Screen座標からWorld座標への変換
         * @param {number} screenX - スクリーンX座標
         * @param {number} screenY - スクリーンY座標
         * @returns {Object} World座標 {x, y}
         */
        screenToWorld(screenX, screenY) {
            return CoordinateSystem.screenToWorld(this.app, screenX, screenY);
        }
        
        /**
         * World座標からScreen座標への変換
         * @param {number} worldX - ワールドX座標
         * @param {number} worldY - ワールドY座標
         * @returns {Object} Screen座標 {x, y}
         */
        worldToScreen(worldX, worldY) {
            return CoordinateSystem.worldToScreen(this.app, worldX, worldY);
        }
        
        /**
         * Screen座標からCanvas座標への変換（描画用、レイヤー変形無視）
         * @param {number} screenX - スクリーンX座標
         * @param {number} screenY - スクリーンY座標
         * @returns {Object} Canvas座標 {x, y}
         */
        screenToCanvas(screenX, screenY) {
            return CoordinateSystem.screenToCanvas(this.app, screenX, screenY);
        }
        
        /**
         * Canvas座標からWorld座標への変換
         * @param {number} canvasX - キャンバスX座標
         * @param {number} canvasY - キャンバスY座標
         * @returns {Object} World座標 {x, y}
         */
        canvasToWorld(canvasX, canvasY) {
            return CoordinateSystem.canvasToWorld(this.app, canvasX, canvasY);
        }
        
        /**
         * カメラフレームの作成
         */
        createCameraFrame() {
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            this.drawCameraFrame();
            debug('Camera frame created');
        }
        
        /**
         * カメラフレームの描画
         */
        drawCameraFrame() {
            if (!this.cameraFrame) return;
            
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        }
        
        /**
         * ガイドラインの作成
         */
        createGuideLines() {
            this.guideLines = new PIXI.Container();
            this.guideLines.label = 'guideLines';
            this.worldContainer.addChild(this.guideLines);
            
            this.drawGuideLines();
            this.guideLines.visible = false; // 初期は非表示
            
            debug('Guide lines created');
        }
        
        /**
         * ガイドラインの描画
         */
        drawGuideLines() {
            if (!this.guideLines) return;
            
            this.guideLines.removeChildren();
            
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // 縦線（中央）
            const verticalLine = new PIXI.Graphics();
            verticalLine.rect(centerX - 0.5, 0, 1, CONFIG.canvas.height);
            verticalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(verticalLine);
            
            // 横線（中央）
            const horizontalLine = new PIXI.Graphics();
            horizontalLine.rect(0, centerY - 0.5, CONFIG.canvas.width, 1);
            horizontalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(horizontalLine);
            
            debug('Guide lines drawn');
        }
        
        /**
         * ガイドライン表示
         */
        showGuideLines() {
            if (this.guideLines) {
                this.guideLines.visible = true;
                debug('Guide lines shown');
            }
        }
        
        /**
         * ガイドライン非表示
         */
        hideGuideLines() {
            if (this.guideLines) {
                this.guideLines.visible = false;
                debug('Guide lines hidden');
            }
        }
        
        /**
         * キャンバスマスクの作成
         */
        createCanvasMask() {
            this.canvasMask = new PIXI.Graphics();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
            this.worldContainer.addChild(this.canvasMask);
            
            if (this.canvasContainer) {
                this.canvasContainer.mask = this.canvasMask;
            }
            
            debug('Canvas mask created');
        }
        
        /**
         * キャンバスサイズ変更への対応
         * @param {number} newWidth - 新しい幅
         * @param {number} newHeight - 新しい高さ
         */
        resizeCanvas(newWidth, newHeight) {
            debug(`Resizing camera elements: ${newWidth}x${newHeight}`);
            
            // カメラフレーム更新
            this.drawCameraFrame();
            
            // ガイドライン更新
            this.drawGuideLines();
            
            // マスク更新
            if (this.canvasMask) {
                this.canvasMask.clear();
                this.canvasMask.rect(0, 0, newWidth, newHeight);
                this.canvasMask.fill(0xffffff);
            }
            
            this.eventBus.emit('canvas-resized', { width: newWidth, height: newHeight });
        }
        
        /**
         * 点がキャンバス拡張領域内にあるかチェック
         * @param {Object} canvasPoint - キャンバス座標
         * @param {number} margin - マージン
         * @returns {boolean}
         */
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return CoordinateSystem.isPointInExtendedCanvas(canvasPoint, margin);
        }
        
        /**
         * イベントハンドラーの設定
         */
        setupEventHandlers() {
            this.setupMouseEvents();
            this.setupKeyboardEvents();
            this.setupResizeEvents();
        }
        
        /**
         * マウス・タッチイベントの設定
         */
        setupMouseEvents() {
            const canvas = this.app.canvas;
            
            // コンテキストメニュー無効化
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // ポインターダウン
            canvas.addEventListener('pointerdown', (e) => {
                if (this.layerSystemActive) return; // レイヤー操作中は無視
                
                if ((e.button === 2 || this.spacePressed) && !this.shiftPressed) {
                    // パン操作開始
                    this.isDragging = true;
                    this.lastPointerPos = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'move';
                    e.preventDefault();
                } else if ((e.button === 2 || this.spacePressed) && this.shiftPressed) {
                    // スケール・ローテート操作開始
                    this.isScaleRotateDragging = true;
                    this.lastPointerPos = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'grab';
                    e.preventDefault();
                }
            });
            
            // ポインタームーブ
            canvas.addEventListener('pointermove', (e) => {
                // 座標情報更新
                const rect = canvas.getBoundingClientRect();
                const canvasPoint = this.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
                this.eventBus.emit('pointer-move', {
                    screen: { x: e.clientX - rect.left, y: e.clientY - rect.top },
                    canvas: canvasPoint
                });
                
                if (this.isDragging) {
                    // パン操作
                    const dx = (e.clientX - this.lastPointerPos.x) * this.panSpeed;
                    const dy = (e.clientY - this.lastPointerPos.y) * this.panSpeed;
                    
                    this.panBy(dx, dy);
                    this.lastPointerPos = { x: e.clientX, y: e.clientY };
                    
                } else if (this.isScaleRotateDragging) {
                    // スケール・ローテート操作
                    const dx = e.clientX - this.lastPointerPos.x;
                    const dy = e.clientY - this.lastPointerPos.y;
                    
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // 水平方向優先: 回転
                        const rotationDelta = dx * this.rotationSpeed;
                        this.rotateTo(this.state.rotation + rotationDelta * Math.PI / 180, {
                            centerX, centerY
                        });
                    } else {
                        // 垂直方向優先: スケール
                        const scaleFactor = 1 + (dy * this.scaleSpeed);
                        this.zoomBy(scaleFactor, { centerX, centerY });
                    }
                    
                    this.lastPointerPos = { x: e.clientX, y: e.clientY };
                }
            });
            
            // ポインターアップ
            canvas.addEventListener('pointerup', (e) => {
                if (this.isDragging && (e.button === 2 || this.spacePressed)) {
                    this.isDragging = false;
                    this.updateCursor();
                }
                if (this.isScaleRotateDragging && (e.button === 2 || this.spacePressed)) {
                    this.isScaleRotateDragging = false;
                    this.updateCursor();
                }
            });
            
            // ホイールイベント
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                if (this.layerSystemActive) return; // レイヤー操作中は無視
                
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                if (this.shiftPressed) {
                    // Shift + ホイール: 回転
                    const rotationDelta = e.deltaY < 0 ? 
                        CONFIG.camera.keyRotationDegree : -CONFIG.camera.keyRotationDegree;
                    this.rotateTo(this.state.rotation + rotationDelta * Math.PI / 180, {
                        centerX, centerY
                    });
                } else {
                    // ホイール: ズーム
                    const scaleFactor = e.deltaY < 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
                    this.zoomBy(scaleFactor, { centerX, centerY });
                }
            });
            
            debug('Mouse events set up');
        }
        
        /**
         * キーボードイベントの設定
         */
        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                this.keysPressed.add(e.code);
                
                // キー状態更新
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.updateCursor();
                    e.preventDefault();
                }
                if (e.shiftKey) {
                    this.shiftPressed = true;
                }
                
                // Ctrl+0: カメラリセット
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetView();
                    e.preventDefault();
                    return;
                }
                
                // レイヤーシステムがアクティブな場合はカメラ操作を無効化
                if (this.layerSystemActive) return;
                
                // Space + 方向キー: カメラ移動
                if (this.spacePressed && !this.shiftPressed && 
                    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    
                    const moveAmount = CONFIG.camera.keyMoveAmount;
                    switch(e.code) {
                        case 'ArrowUp': this.panBy(0, -moveAmount); break;
                        case 'ArrowDown': this.panBy(0, moveAmount); break;
                        case 'ArrowLeft': this.panBy(-moveAmount, 0); break;
                        case 'ArrowRight': this.panBy(moveAmount, 0); break;
                    }
                    e.preventDefault();
                }
                
                // Shift + Space + 方向キー: カメラ拡縮・回転
                if (this.spacePressed && this.shiftPressed && 
                    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    
                    switch(e.code) {
                        case 'ArrowUp':
                            this.zoomBy(1 + CONFIG.camera.wheelZoomSpeed, { centerX, centerY });
                            break;
                        case 'ArrowDown':
                            this.zoomBy(1 - CONFIG.camera.wheelZoomSpeed, { centerX, centerY });
                            break;
                        case 'ArrowLeft':
                            this.rotateTo(this.state.rotation - CONFIG.camera.keyRotationDegree * Math.PI / 180, {
                                centerX, centerY
                            });
                            break;
                        case 'ArrowRight':
                            this.rotateTo(this.state.rotation + CONFIG.camera.keyRotationDegree * Math.PI / 180, {
                                centerX, centerY
                            });
                            break;
                    }
                    e.preventDefault();
                }
                
                // H / Shift+H: カメラ反転（レイヤー操作中以外）
                if (!this.layerSystemActive && e.code === 'KeyH' && 
                    !e.ctrlKey && !e.altKey && !e.metaKey) {
                    
                    if (e.shiftKey) {
                        this.flipVertical();
                    } else {
                        this.flipHorizontal();
                    }
                    e.preventDefault();
                }
            });
            
            document.addEventListener('keyup', (e) => {
                this.keysPressed.delete(e.code);
                
                if (e.code === 'Space') {
                    this.spacePressed = false;
                    this.updateCursor();
                }
                if (!e.shiftKey) {
                    this.shiftPressed = false;
                }
            });
            
            debug('Keyboard events set up');
        }
        
        /**
         * ウィンドウリサイズイベントの設定
         */
        setupResizeEvents() {
            window.addEventListener('resize', () => {
                const newWidth = window.innerWidth - 50; // サイドバー幅を考慮
                const newHeight = window.innerHeight;
                
                // PixiJSアプリケーションのリサイズ
                this.app.renderer.resize(newWidth, newHeight);
                if (this.app.canvas) {
                    this.app.canvas.style.width = `${newWidth}px`;
                    this.app.canvas.style.height = `${newHeight}px`;
                }
                
                // カメラ位置の再計算
                this.initializeCamera();
                
                this.eventBus.emit('window-resized', { width: newWidth, height: newHeight });
            });
            
            debug('Resize events set up');
        }
        
        /**
         * カーソルの更新
         */
        updateCursor() {
            if (!this.app.canvas) return;
            
            if (this.layerSystemActive) {
                // レイヤーシステムアクティブ時はレイヤーシステムに任せる
                return;
            }
            
            if (this.isDragging || (this.spacePressed && !this.shiftPressed)) {
                this.app.canvas.style.cursor = 'move';
            } else if (this.isScaleRotateDragging || (this.spacePressed && this.shiftPressed)) {
                this.app.canvas.style.cursor = 'grab';
            } else {
                // デフォルトカーソル（描画ツールによって決まる）
                this.eventBus.emit('cursor-update-requested');
            }
        }
        
        /**
         * レイヤーシステムの状態を設定
         * @param {boolean} active - レイヤーシステムがアクティブかどうか
         */
        setLayerSystemActive(active) {
            this.layerSystemActive = active;
            this.updateCursor();
            
            if (active) {
                debug('Layer system activated - camera controls disabled');
            } else {
                debug('Layer system deactivated - camera controls enabled');
            }
        }
        
        /**
         * カメラ状態のシリアライズ
         * @returns {Object} シリアライズされたカメラ状態
         */
        serialize() {
            return {
                version: '1.0',
                state: this.state.serialize(),
                initialState: this.initialState.serialize(),
                meta: {
                    exportedAt: Date.now()
                }
            };
        }
        
        /**
         * シリアライズされた状態からカメラを復元
         * @param {Object} data - シリアライズされたデータ
         */
        deserialize(data) {
            if (!data.version || !data.state) {
                throw new Error('Invalid camera data format');
            }
            
            this.state = CameraState.deserialize(data.state);
            if (data.initialState) {
                this.initialState = CameraState.deserialize(data.initialState);
            }
            
            this.applyStateToWorldContainer();
            
            debug('Camera state deserialized');
        }
        
        /**
         * イベントリスナー追加
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         */
        on(eventName, callback) {
            this.eventBus.on(eventName, callback);
        }
        
        /**
         * イベントリスナー削除
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         */
        off(eventName, callback) {
            this.eventBus.off(eventName, callback);
        }
        
        /**
         * デバッグ情報取得
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                state: this.state.serialize(),
                interactions: {
                    isDragging: this.isDragging,
                    isScaleRotateDragging: this.isScaleRotateDragging,
                    layerSystemActive: this.layerSystemActive,
                    spacePressed: this.spacePressed,
                    shiftPressed: this.shiftPressed
                },
                containers: {
                    worldContainer: !!this.worldContainer,
                    canvasContainer: !!this.canvasContainer,
                    cameraFrame: !!this.cameraFrame,
                    guideLines: !!this.guideLines,
                    guideLinesVisible: this.guideLines?.visible || false
                }
            };
        }
    }

    // === グローバル公開 ===
    window.CameraSystem = CameraSystem;
    window.CameraState = CameraState;

    debug('CameraSystem module loaded');

})();