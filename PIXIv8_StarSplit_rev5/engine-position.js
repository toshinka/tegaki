/**
 * 🛰️ engine-position.js - PositionManager座標・カメラ・ジェスチャー衛星
 * Version: 3.0.0 | Last Modified: 2025-09-07
 * 
 * [🎯 責務範囲]
 * - 無限ワールド座標系管理（screen↔world変換）
 * - カメラ制御（DOM transform、無制限移動）
 * - HammerJS統合（タッチ・ペンジェスチャー）
 * - キャンバス境界判定（外描画対応）
 * - レイヤー座標変換（将来のレイヤー移動対応）
 * 
 * [🔧 主要メソッド]
 * screenToWorld(x, y) → {x, y}           - 画面→ワールド座標
 * worldToScreen(x, y) → {x, y}           - ワールド→画面座標
 * canvasToWorld(x, y) → {x, y}           - キャンバス→ワールド座標
 * worldToCanvas(x, y) → {x, y}           - ワールド→キャンバス座標
 * isPointInCanvas(worldX, worldY) → bool  - キャンバス範囲判定
 * getVisibleWorldBounds() → bounds        - 可視範囲取得
 * moveCamera(dx, dy)                      - カメラ移動
 * setCameraPosition(x, y)                 - カメラ絶対位置
 * resetCamera()                           - カメラリセット
 * setupHammerJS()                         - ジェスチャー初期化
 * calibrateInitialPosition()              - 初期位置校正（新規追加）
 * 
 * [📡 処理イベント（IN）]
 * - camera-move-request : カメラ移動要求
 * - camera-set-position : カメラ位置設定
 * - camera-reset-request : カメラリセット
 * - gesture-pan-* : HammerJSジェスチャー
 * 
 * [📤 発火イベント（OUT）]
 * - camera-position-changed : カメラ位置変更
 * - camera-bounds-updated : 境界情報更新
 * - gesture-pan-* : ジェスチャー状態変更
 * 
 * [🔗 依存関係]
 * ← MainController (イベント・状態)
 * → HammerJS v2.0.8 (ジェスチャー認識)
 * → DOM要素: #canvas-container
 * 
 * [⚠️ 禁止事項]
 * - UI操作・レイヤー管理・描画内容変更
 * - ツール設定・エラー処理の直接実行
 */

(function() {
    'use strict';
    
    class PositionManager {
        constructor() {
            this.container = null;
            this.camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
            this.canvasBounds = { x: 0, y: 0, width: 400, height: 400 };
            this.worldBounds = { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
            this.hammer = null;
            this.lastDelta = null;
            this.updateScheduled = false;
            this.initialPositionCalibrated = false; // ✅ 新規追加: 初期校正フラグ
            
            // パン状態管理
            this.panState = {
                active: false,
                pointerId: null,
                pointerType: null,
                startX: 0,
                startY: 0
            };
            
            // イベントハンドラー参照
            this.handlers = {
                move: null,
                up: null,
                cancel: null
            };
        }
        
        initialize() {
            this.container = document.getElementById('canvas-container');
            if (!this.container) {
                MainController.emit('system-error', {
                    code: 'CANVAS_CONTAINER_NOT_FOUND',
                    details: { message: 'Canvas container element not found' },
                    stack: new Error().stack
                });
                return false;
            }
            
            // HammerJS初期化
            this.setupHammerJS();
            
            // ポインターイベント初期化
            this.setupPointerEvents();
            
            // イベント監視開始
            this.setupEventHandlers();
            
            // 定期更新開始
            this.startUpdateLoop();
            
            // ✅ 新規追加: 初期位置校正
            setTimeout(() => {
                this.calibrateInitialPosition();
            }, 50); // DOM描画完了待ち
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'PositionManager initialized',
                data: { 
                    canvasContainer: this.container.id,
                    hammerEnabled: !!this.hammer 
                },
                timestamp: Date.now()
            });
            
            return true;
        }
        
        // ✅ 新規追加: 初期位置校正
        calibrateInitialPosition() {
            const rect = this.container.getBoundingClientRect();
            const viewportCenter = {
                x: (window.innerWidth - 310) / 2, // サイドバー50px + レイヤーパネル予約160px
                y: window.innerHeight / 2
            };
            
            // 初期オフセット補正
            this.camera.x = 0;
            this.camera.y = 0;
            this.camera.targetX = 0;
            this.camera.targetY = 0;
            
            // DOM位置を正確に設定
            this.container.style.transform = 'translate(-50%, -50%)';
            this.container.style.left = '50%';
            this.container.style.top = '50%';
            
            this.initialPositionCalibrated = true;
            
            MainController.emit('camera-position-changed', { x: 0, y: 0 });
            MainController.emit('system-debug', {
                category: 'position',
                message: 'Initial camera position calibrated',
                data: { 
                    viewportCenter,
                    containerRect: { width: rect.width, height: rect.height }
                },
                timestamp: Date.now()
            });
        }
        
        setupHammerJS() {
            if (typeof Hammer === 'undefined') {
                MainController.emit('system-error', {
                    code: 'HAMMER_NOT_LOADED',
                    details: { message: 'HammerJS library not found' },
                    stack: new Error().stack
                });
                return;
            }
            
            
            // Pan設定
            this.hammer.get('pan').set({
                direction: Hammer.DIRECTION_ALL,
                threshold: 1,
                pointers: 1
            });
            
            // Pinch設定（将来のズーム機能用）
            this.hammer.get('pinch').set({ 
                enable: true,
                threshold: 0.1 
            });
            
            // イベントバインド
            this.hammer.on('panstart', (e) => this.onHammerPanStart(e));
            this.hammer.on('panmove', (e) => this.onHammerPanMove(e));
            this.hammer.on('panend', (e) => this.onHammerPanEnd(e));
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'HammerJS initialized',
                data: { element: this.container.id },
                timestamp: Date.now()
            });
        }
        
        setupPointerEvents() {
            this.handlers.move = (e) => this.onPointerMove(e);
            this.handlers.up = (e) => this.onPointerUp(e);
            this.handlers.cancel = (e) => this.onPointerCancel(e);
            
            this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        }
        
        setupEventHandlers() {
            MainController.on('camera-move-request', (payload) => this.handleCameraMoveRequest(payload));
            MainController.on('camera-set-position', (payload) => this.handleCameraSetPosition(payload));
            MainController.on('camera-reset-request', () => this.handleCameraResetRequest());
            MainController.on('ui-canvas-resize', (payload) => this.handleCanvasResize(payload));
        }
        
        startUpdateLoop() {
            const update = () => {
                this.updateCameraPosition();
                requestAnimationFrame(update);
            };
            update();
        }
        
        // === 座標変換メソッド（無限ワールド対応） ===
        
        screenToWorld(screenX, screenY) {
            return {
                x: screenX - this.camera.x,
                y: screenY - this.camera.y
            };
        }
        
        worldToScreen(worldX, worldY) {
            return {
                x: worldX + this.camera.x,
                y: worldY + this.camera.y
            };
        }
        
        canvasToWorld(canvasX, canvasY) {
            const rect = this.container.getBoundingClientRect();
            return {
                x: canvasX - rect.left - this.camera.x,
                y: canvasY - rect.top - this.camera.y
            };
        }
        
        worldToCanvas(worldX, worldY) {
            const rect = this.container.getBoundingClientRect();
            return {
                x: worldX + this.camera.x + rect.left,
                y: worldY + this.camera.y + rect.top
            };
        }
        
        // === 境界判定（キャンバス外描画対応） ===
        
        isPointInCanvas(worldX, worldY) {
            return worldX >= 0 && worldX <= this.canvasBounds.width &&
                   worldY >= 0 && worldY <= this.canvasBounds.height;
        }
        
        isRectInCanvas(worldBounds) {
            return !(worldBounds.right < 0 || 
                     worldBounds.left > this.canvasBounds.width ||
                     worldBounds.bottom < 0 || 
                     worldBounds.top > this.canvasBounds.height);
        }
        
        getVisibleWorldBounds() {
            const rect = this.container.getBoundingClientRect();
            return {
                left: -this.camera.x,
                top: -this.camera.y,
                right: rect.width - this.camera.x,
                bottom: rect.height - this.camera.y
            };
        }
        
        // === カメラ制御（無制限移動対応） ===
        
        moveCamera(dx, dy) {
            // ✅ 修正: 初期校正後のみ移動を許可
            if (!this.initialPositionCalibrated) {
                this.calibrateInitialPosition();
            }
            
            this.camera.targetX += dx;
            this.camera.targetY += dy;
            
            // 移動範囲制限（将来の設定可能化予定）
            const maxOffset = {
                x: (window.innerWidth - 310) / 2,
                y: window.innerHeight / 2
            };
            
            this.camera.targetX = Math.max(-maxOffset.x * 2, Math.min(maxOffset.x * 2, this.camera.targetX));
            this.camera.targetY = Math.max(-maxOffset.y * 2, Math.min(maxOffset.y * 2, this.camera.targetY));
            
            this.updateScheduled = true;
        }
        
        setCameraPosition(x, y) {
            this.camera.targetX = x;
            this.camera.targetY = y;
            this.updateScheduled = true;
        }
        
        resetCamera() {
            this.camera.targetX = 0;
            this.camera.targetY = 0;
            this.updateScheduled = true;
            
            // 即座にDOM更新
            this.container.style.transform = 'translate(-50%, -50%)';
            this.container.style.left = '50%';
            this.container.style.top = '50%';
            
            // ✅ 修正: カメラ値も即座にリセット
            this.camera.x = 0;
            this.camera.y = 0;
            
            MainController.emit('camera-position-changed', { x: 0, y: 0 });
        }
        
        getCameraPosition() {
            return { x: this.camera.x, y: this.camera.y };
        }
        
        updateCameraPosition() {
            if (!this.updateScheduled) return;
            
            const { x, y } = this.camera;
            const { targetX, targetY } = this.camera;
            
            if (x !== targetX || y !== targetY) {
                this.camera.x = Math.round(targetX);
                this.camera.y = Math.round(targetY);
                
                // ✅ 修正: DOM transform更新（より正確な計算）
                const viewportCenter = {
                    x: (window.innerWidth - 310) / 2, // サイドバー50px + レイヤーパネル予約160px
                    y: window.innerHeight / 2
                };
                
                const offset = {
                    x: viewportCenter.x + this.camera.x,
                    y: viewportCenter.y + this.camera.y
                };
                
                // ✅ 修正: より正確なDOM位置計算
                this.container.style.transform = 
                    `translate3d(${offset.x}px, ${offset.y}px, 0) translate(-50%, -50%)`;
                this.container.style.left = '0px';
                this.container.style.top = '0px';
                
                // 位置変更通知
                MainController.emit('camera-position-changed', { 
                    x: this.camera.x, 
                    y: this.camera.y 
                });
            }
            
            this.updateScheduled = false;
        }
        
        // === HammerJSイベントハンドラー ===
        
        onHammerPanStart(e) {
            MainController.emit('gesture-pan-start', {
                centerX: e.center.x,
                centerY: e.center.y,
                pointerType: e.pointerType || 'touch',
                timestamp: Date.now()
            });
        }
        
        onHammerPanMove(e) {
            // タッチまたはSpaceキー押下時のみパン実行
            if (e.pointerType === 'touch' || MainController.getState('spacePressed')) {
                const dx = e.deltaX - (this.lastDelta?.x || 0);
                const dy = e.deltaY - (this.lastDelta?.y || 0);
                
                MainController.emit('camera-move-request', { dx, dy });
                
                this.lastDelta = { x: e.deltaX, y: e.deltaY };
            }
            
            MainController.emit('gesture-pan-move', {
                centerX: e.center.x,
                centerY: e.center.y,
                deltaX: e.deltaX,
                deltaY: e.deltaY
            });
        }
        
        onHammerPanEnd(e) {
            this.lastDelta = null;
            
            MainController.emit('gesture-pan-end', {
                centerX: e.center.x,
                centerY: e.center.y,
                velocityX: e.velocityX,
                velocityY: e.velocityY
            });
        }
        
        // === ポインターイベントハンドラー ===
        
        onPointerDown(e) {
            const spacePressed = MainController.getState('spacePressed');
            
            if (!spacePressed) return;
            
            // ペン圧力0の場合はスキップ
            if (e.pointerType === 'pen' && e.pressure === 0) {
                return;
            }
            
            this.panState.active = true;
            this.panState.pointerId = e.pointerId;
            this.panState.pointerType = e.pointerType;
            this.panState.startX = e.clientX;
            this.panState.startY = e.clientY;
            
            this.container.setPointerCapture(e.pointerId);
            
            this.container.addEventListener('pointermove', this.handlers.move);
            this.container.addEventListener('pointerup', this.handlers.up);
            this.container.addEventListener('pointercancel', this.handlers.cancel);
            
            e.preventDefault();
        }
        
        onPointerMove(e) {
            if (!this.panState.active || e.pointerId !== this.panState.pointerId) return;
            if (!MainController.getState('spacePressed')) return;
            
            // ペン圧力0の場合はスキップ
            if (e.pointerType === 'pen' && e.pressure === 0) {
                return;
            }
            
            const dx = e.clientX - this.panState.startX;
            const dy = e.clientY - this.panState.startY;
            
            MainController.emit('camera-move-request', { dx, dy });
            
            this.panState.startX = e.clientX;
            this.panState.startY = e.clientY;
            
            e.preventDefault();
        }
        
        onPointerUp(e) {
            if (e.pointerId !== this.panState.pointerId) return;
            this.stopPanning();
        }
        
        onPointerCancel(e) {
            if (e.pointerId !== this.panState.pointerId) return;
            this.stopPanning();
        }
        
        stopPanning() {
            this.panState.active = false;
            
            if (this.panState.pointerId && this.container.hasPointerCapture(this.panState.pointerId)) {
                this.container.releasePointerCapture(this.panState.pointerId);
            }
            
            this.container.removeEventListener('pointermove', this.handlers.move);
            this.container.removeEventListener('pointerup', this.handlers.up);
            this.container.removeEventListener('pointercancel', this.handlers.cancel);
            
            this.panState = {
                active: false,
                pointerId: null,
                pointerType: null,
                startX: 0,
                startY: 0
            };
        }
        
        // === イベントハンドラー ===
        
        handleCameraMoveRequest(payload) {
            this.moveCamera(payload.dx, payload.dy);
        }
        
        handleCameraSetPosition(payload) {
            this.setCameraPosition(payload.x, payload.y);
        }
        
        handleCameraResetRequest() {
            this.resetCamera();
        }
        
        handleCanvasResize(payload) {
            this.canvasBounds.width = payload.width;
            this.canvasBounds.height = payload.height;
            
            MainController.emit('camera-bounds-updated', {
                visibleBounds: this.getVisibleWorldBounds()
            });
        }
        
        // === レイヤー座標変換（将来機能） ===
        
        transformLayerCoordinates(layer, dx, dy) {
            // 将来のレイヤー移動機能用メソッド
            const transformation = {
                layerId: layer.id,
                dx: dx,
                dy: dy,
                timestamp: Date.now()
            };
            
            MainController.emit('layer-transform-request', {
                layerId: layer.id,
                dx: dx,
                dy: dy
            });
            
            return transformation;
        }
    }
    
    // PositionManager初期化
    const positionManager = new PositionManager();
    
    // グローバル参照設定
    window.PositionManager = positionManager;
    
    // MainController準備完了待機
    const initWhenReady = () => {
        if (window.MainController && MainController.getState) {
            positionManager.initialize();
        } else {
            setTimeout(initWhenReady, 10);
        }
    };
    
    // DOM読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenReady);
    } else {
        initWhenReady();
    }
    
})();