/**
 * 🖼️ キャンバス制御マネージャー - pixi-viewport統合版
 * 🎯 AI_WORK_SCOPE: キャンバス操作・Viewport統合・座標変換
 * 🎯 DEPENDENCIES: main.js, app-core.js
 * 🎯 CDN_USAGE: PIXI, pixi-viewport, Hammer.js（タッチ）
 * 🎯 ISOLATION_TEST: ✅ キャンバス操作単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 300行維持（キャンバス制御専用）
 * 
 * 📋 PHASE_TARGET: Phase1-2対応
 * 📋 V8_MIGRATION: Viewport API互換確認予定
 * 📋 PERFORMANCE_TARGET: ズーム・パン操作60FPS維持
 */

export class CanvasManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.app = appCore.app;
        this.viewport = appCore.viewport;
        
        // 操作状態
        this.isPanning = false;
        this.isZooming = false;
        this.lastPointerPosition = null;
        
        // 設定
        this.settings = {
            minZoom: 0.1,
            maxZoom: 10.0,
            wheelZoomSpeed: 0.1,
            panSpeed: 1.0,
            smoothing: 0.8
        };
        
        // タッチ操作
        this.touchHandler = null;
        this.hammerAvailable = !!window.Hammer;
        
        // Settings Manager参照（後で設定）
        this.settingsManager = null;
        
        console.log('🖼️ CanvasManager初期化完了', {
            viewport: !!this.viewport,
            hammer: this.hammerAvailable
        });
    }

    /**
     * Settings Manager参照設定
     */
    setSettingsManager(settingsManager) {
        this.settingsManager = settingsManager;
    }

    /**
     * DOM統合処理
     */
    async integrateWithDOM() {
        console.log('🔧 キャンバスDOM統合開始');
        
        // 基本イベント設定
        this.setupBasicEvents();
        
        // Viewport拡張設定
        if (this.viewport) {
            this.setupViewportEvents();
        }
        
        // タッチ操作設定
        if (this.hammerAvailable) {
            this.setupTouchGestures();
        }
        
        // キーボードショートカット
        this.setupKeyboardShortcuts();
        
        console.log('✅ キャンバスDOM統合完了');
    }

    /**
     * 基本イベント設定
     */
    setupBasicEvents() {
        if (!this.app.view) return;
        
        // マウスホイールズーム（Viewportが無い場合の代替）
        if (!this.viewport) {
            this.app.view.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.handleWheelZoom(e);
            });
        }
        
        // 右クリック禁止（コンテキストメニュー無効化）
        this.app.view.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // キャンバスフォーカス管理
        this.app.view.addEventListener('mousedown', () => {
            this.app.view.focus();
        });
        
        this.app.view.tabIndex = 0; // フォーカス可能にする
    }

    /**
     * Viewport拡張イベント設定
     */
    setupViewportEvents() {
        if (!this.viewport) return;
        
        // ズームイベント
        this.viewport.on('zoomed', (e) => {
            this.handleZoomChange(e.viewport.scale.x);
        });
        
        // 移動イベント
        this.viewport.on('moved', (e) => {
            this.handlePositionChange(e.viewport.x, e.viewport.y);
        });
        
        // ドラッグ開始/終了
        this.viewport.on('drag-start', () => {
            this.isPanning = true;
            this.app.view.style.cursor = 'grabbing';
        });
        
        this.viewport.on('drag-end', () => {
            this.isPanning = false;
            this.app.view.style.cursor = 'grab';
        });
        
        // ズーム制限適用
        this.viewport.clampZoom({
            minScale: this.settings.minZoom,
            maxScale: this.settings.maxZoom
        });
        
        console.log('✅ Viewport拡張イベント設定完了');
    }

    /**
     * タッチジェスチャー設定（Hammer.js活用）
     */
    setupTouchGestures() {
        if (!this.hammerAvailable || !this.app.view) return;
        
        this.touchHandler = new Hammer(this.app.view);
        
        // ピンチズーム有効化
        this.touchHandler.get('pinch').set({ enable: true });
        this.touchHandler.on('pinchstart pinch', (e) => {
            this.handlePinchZoom(e);
        });
        
        // 2本指パン有効化
        this.touchHandler.get('pan').set({ fingers: 2 });
        this.touchHandler.on('panstart pan', (e) => {
            this.handleTwoFingerPan(e);
        });
        
        // 長押し（右クリック代替）
        this.touchHandler.get('press').set({ time: 500 });
        this.touchHandler.on('press', (e) => {
            this.handleLongPress(e);
        });
        
        console.log('✅ タッチジェスチャー設定完了');
    }

    /**
     * キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // フォーカスがキャンバスにない場合は無視
            if (document.activeElement !== this.app.view) return;
            
            this.handleCanvasKeyboard(e);
        });
    }

    /**
     * ホイールズーム処理（Viewport非使用時）
     */
    handleWheelZoom(event) {
        const delta = event.deltaY > 0 ? -this.settings.wheelZoomSpeed : this.settings.wheelZoomSpeed;
        const newScale = Math.max(this.settings.minZoom, 
                         Math.min(this.settings.maxZoom, this.app.stage.scale.x + delta));
        
        this.app.stage.scale.set(newScale);
        console.log(`🔍 ホイールズーム: ${newScale.toFixed(2)}x`);
    }

    /**
     * ピンチズーム処理
     */
    handlePinchZoom(event) {
        if (!this.viewport) return;
        
        const scale = event.scale;
        const currentScale = this.viewport.scale.x;
        const newScale = Math.max(this.settings.minZoom,
                         Math.min(this.settings.maxZoom, currentScale * scale));
        
        this.viewport.setZoom(newScale);
        this.isZooming = true;
    }

    /**
     * 2本指パン処理
     */
    handleTwoFingerPan(event) {
        if (!this.viewport) return;
        
        const deltaX = event.deltaX * this.settings.panSpeed;
        const deltaY = event.deltaY * this.settings.panSpeed;
        
        this.viewport.x -= deltaX;
        this.viewport.y -= deltaY;
    }

    /**
     * 長押し処理（右クリック代替）
     */
    handleLongPress(event) {
        // コンテキストメニュー相当の処理
        console.log('📱 長押し検出:', event.center);
        // Phase2: コンテキストメニュー実装予定
    }

    /**
     * ズーム変更通知処理
     */
    handleZoomChange(scale) {
        // UI更新
        const scalePercent = Math.round(scale * 100);
        console.log(`🔍 ズーム変更: ${scalePercent}%`);
        
        // GPU使用率シミュレート（ズームに応じて変化）
        const gpuUsage = Math.min(100, Math.round(30 + scale * 20));
        const gpuElement = document.getElementById('gpu-usage');
        if (gpuElement) {
            gpuElement.textContent = gpuUsage + '%';
        }
    }

    /**
     * 位置変更通知処理
     */
    handlePositionChange(x, y) {
        // 座標情報更新は他で処理されるためログのみ
        // console.log(`📍 位置変更: (${x.toFixed(0)}, ${y.toFixed(0)})`);
    }

    /**
     * キャンバスキーボード処理
     */
    handleCanvasKeyboard(event) {
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.togglePanMode();
                break;
                
            case 'Digit0':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.resetView();
                }
                break;
                
            case 'Equal':
            case 'NumpadAdd':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.zoomIn();
                }
                break;
                
            case 'Minus':
            case 'NumpadSubtract':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.zoomOut();
                }
                break;
                
            case 'KeyG':
                event.preventDefault();
                this.toggleGrid();
                break;
        }
    }

    /**
     * パンモード切り替え
     */
    togglePanMode() {
        if (this.viewport) {
            const isDragEnabled = this.viewport.plugins.get('drag');
            if (isDragEnabled) {
                this.viewport.plugins.remove('drag');
                this.app.view.style.cursor = 'crosshair';
                console.log('🖱️ パンモード: OFF');
            } else {
                this.viewport.drag();
                this.app.view.style.cursor = 'grab';
                console.log('🖱️ パンモード: ON');
            }
        }
    }

    /**
     * ビューリセット
     */
    resetView() {
        if (this.viewport) {
            this.viewport.animate({
                scale: 1,
                position: { x: 0, y: 0 },
                time: 500,
                ease: 'easeInOutSine'
            });
        } else {
            this.app.stage.scale.set(1);
            this.app.stage.position.set(0, 0);
        }
        
        console.log('🏠 ビューリセット');
    }

    /**
     * ズームイン
     */
    zoomIn() {
        const currentScale = this.viewport ? this.viewport.scale.x : this.app.stage.scale.x;
        const newScale = Math.min(this.settings.maxZoom, currentScale * 1.2);
        
        if (this.viewport) {
            this.viewport.setZoom(newScale, true);
        } else {
            this.app.stage.scale.set(newScale);
        }
        
        console.log(`🔍 ズームイン: ${(newScale * 100).toFixed(0)}%`);
    }

    /**
     * ズームアウト
     */
    zoomOut() {
        const currentScale = this.viewport ? this.viewport.scale.x : this.app.stage.scale.x;
        const newScale = Math.max(this.settings.minZoom, currentScale / 1.2);
        
        if (this.viewport) {
            this.viewport.setZoom(newScale, true);
        } else {
            this.app.stage.scale.set(newScale);
        }
        
        console.log(`🔍 ズームアウト: ${(newScale * 100).toFixed(0)}%`);
    }

    /**
     * グリッド表示切り替え
     */
    toggleGrid() {
        if (this.appCore && this.appCore.toggleGrid) {
            this.appCore.toggleGrid();
        }
    }

    /**
     * 座標変換: スクリーン → ワールド
     */
    screenToWorld(screenX, screenY) {
        if (this.viewport) {
            return this.viewport.toWorld({ x: screenX, y: screenY });
        } else {
            const scale = this.app.stage.scale.x;
            return {
                x: (screenX - this.app.stage.x) / scale,
                y: (screenY - this.app.stage.y) / scale
            };
        }
    }

    /**
     * 座標変換: ワールド → スクリーン
     */
    worldToScreen(worldX, worldY) {
        if (this.viewport) {
            return this.viewport.toScreen({ x: worldX, y: worldY });
        } else {
            const scale = this.app.stage.scale.x;
            return {
                x: worldX * scale + this.app.stage.x,
                y: worldY * scale + this.app.stage.y
            };
        }
    }

    /**
     * Phase2準備: 無限キャンバス対応
     */
    prepareInfiniteCanvas() {
        // 📋 Phase2: 無限スクロールキャンバス実装予定
        console.log('📋 Phase2準備: 無限キャンバス機能');
    }

    /**
     * Phase2準備: ミニマップ表示
     */
    prepareMinimap() {
        // 📋 Phase2: ナビゲーション用ミニマップ実装予定
        console.log('📋 Phase2準備: ミニマップ機能');
    }

    /**
     * リソース解放
     */
    destroy() {
        if (this.touchHandler) {
            this.touchHandler.destroy();
            this.touchHandler = null;
        }
        
        console.log('🗑️ CanvasManager リソース解放完了');
    }
}