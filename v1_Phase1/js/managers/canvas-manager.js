/**
 * 🎯 AI_WORK_SCOPE: キャンバス制御・リサイズ・ビューポート管理
 * 🎯 DEPENDENCIES: app-core.js
 * 🎯 CDN_USAGE: pixi-viewport（オプション）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 300行以下維持
 * 
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Viewport API互換性保証
 * 📋 PERFORMANCE_TARGET: 滑らかズーム・パン操作
 */

export class CanvasManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.canvasSize = { width: 400, height: 400 };
        this.zoomLevel = 1.0;
        this.panOffset = { x: 0, y: 0 };
        this.isInitialized = false;
        
        // 変形履歴（非破壊変形用）
        this.transformHistory = [];
        this.currentHistoryIndex = -1;
    }

    async init() {
        console.log('🖼️ CanvasManager初期化中...');
        
        try {
            // 基本キャンバス制御初期化
            this.setupCanvasControls();
            
            // ビューポート統合（利用可能な場合）
            await this.setupViewportControls();
            
            // 変形システム初期化
            this.initializeTransformSystem();
            
            this.isInitialized = true;
            console.log('✅ CanvasManager初期化完了');
            
        } catch (error) {
            console.error('❌ CanvasManager初期化エラー:', error);
            // 基本機能で継続
            this.isInitialized = true;
        }
    }

    setupCanvasControls() {
        // 基本キャンバス制御設定
        this.canvasSize = {
            width: this.appCore.canvasSize.width,
            height: this.appCore.canvasSize.height
        };
        
        console.log('✅ 基本キャンバス制御セットアップ完了');
    }

    async setupViewportControls() {
        if (this.appCore.viewport) {
            console.log('🌐 Viewportコントロール統合中...');
            
            // ズーム制限設定
            this.appCore.viewport.clampZoom({
                minWidth: 50,
                maxWidth: 2000,
                minHeight: 50,
                maxHeight: 2000
            });
            
            // ドラッグ制限設定（キャンバス領域内）
            this.appCore.viewport.clamp({
                left: -this.canvasSize.width / 2,
                top: -this.canvasSize.height / 2,
                right: this.canvasSize.width * 1.5,
                bottom: this.canvasSize.height * 1.5
            });
            
            // ビューポートイベント
            this.appCore.viewport.on('moved', (viewport) => {
                this.onViewportMoved(viewport);
            });
            
            this.appCore.viewport.on('zoomed', (viewport) => {
                this.onViewportZoomed(viewport);
            });
            
            console.log('✅ Viewportコントロール統合完了');
        }
    }

    initializeTransformSystem() {
        console.log('🔄 変形システム初期化中...');
        
        // 初期変形状態を記録
        this.recordTransformState('initial', {
            canvasSize: { ...this.canvasSize },
            zoom: this.zoomLevel,
            pan: { ...this.panOffset }
        });
        
        console.log('✅ 変形システム初期化完了');
    }

    // ===== キャンバスリサイズ処理 =====

    resizeCanvas(width, height, centerContent = false) {
        console.log(`🔧 キャンバスリサイズ: ${width}×${height}px`);
        
        const oldSize = { ...this.canvasSize };
        
        // サイズ更新
        this.canvasSize.width = width;
        this.canvasSize.height = height;
        
        // AppCoreのリサイズ処理を呼び出し
        this.appCore.resizeCanvas(width, height, centerContent);
        
        // ビューポート更新
        if (this.appCore.viewport) {
            this.updateViewportBounds();
        }
        
        // 変形履歴記録
        this.recordTransformState('resize', {
            oldSize,
            newSize: { ...this.canvasSize },
            centered: centerContent
        });
        
        console.log('✅ キャンバスリサイズ完了');
    }

    updateViewportBounds() {
        if (this.appCore.viewport) {
            // ワールドサイズ更新
            this.appCore.viewport.worldWidth = this.canvasSize.width * 2;
            this.appCore.viewport.worldHeight = this.canvasSize.height * 2;
            
            // クランプ範囲更新
            this.appCore.viewport.clamp({
                left: -this.canvasSize.width / 2,
                top: -this.canvasSize.height / 2,
                right: this.canvasSize.width * 1.5,
                bottom: this.canvasSize.height * 1.5
            });
        }
    }

    // ===== ズーム・パン制御 =====

    zoomToFit() {
        if (this.appCore.viewport) {
            this.appCore.viewport.fitWorld();
        } else {
            this.zoomLevel = 1.0;
            this.panOffset = { x: 0, y: 0 };
        }
        
        this.recordTransformState('zoom_fit', {
            zoom: this.zoomLevel,
            pan: { ...this.panOffset }
        });
    }

    zoomToLevel(level) {
        const clampedLevel = Math.max(0.1, Math.min(5.0, level));
        
        if (this.appCore.viewport) {
            this.appCore.viewport.setZoom(clampedLevel);
        } else {
            this.zoomLevel = clampedLevel;
        }
        
        this.recordTransformState('zoom_level', {
            zoom: clampedLevel
        });
    }

    centerCanvas() {
        if (this.appCore.viewport) {
            this.appCore.viewport.moveCenter(
                this.canvasSize.width / 2,
                this.canvasSize.height / 2
            );
        } else {
            this.panOffset = { x: 0, y: 0 };
        }
        
        this.recordTransformState('center', {
            pan: { ...this.panOffset }
        });
    }

    // ===== イベントハンドラー =====

    onViewportMoved(viewport) {
        this.panOffset = {
            x: viewport.x,
            y: viewport.y
        };
        
        // パン操作の記録（頻繁すぎるので間引き）
        if (Math.random() < 0.1) { // 10%の確率で記録
            this.recordTransformState('pan', {
                pan: { ...this.panOffset }
            });
        }
    }

    onViewportZoomed(viewport) {
        this.zoomLevel = viewport.scale.x;
        
        // ズーム操作の記録
        this.recordTransformState('zoom', {
            zoom: this.zoomLevel,
            center: viewport.center
        });
    }

    // ===== 座標変換ユーティリティ =====

    screenToWorld(screenX, screenY) {
        if (this.appCore.viewport) {
            return this.appCore.viewport.toWorld(screenX, screenY);
        } else {
            return {
                x: screenX - this.panOffset.x,
                y: screenY - this.panOffset.y
            };
        }
    }

    worldToScreen(worldX, worldY) {
        if (this.appCore.viewport) {
            return this.appCore.viewport.toScreen(worldX, worldY);
        } else {
            return {
                x: worldX + this.panOffset.x,
                y: worldY + this.panOffset.y
            };
        }
    }

    // ===== 非破壊変形履歴システム =====

    recordTransformState(action, data) {
        const state = {
            id: `transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            action,
            timestamp: Date.now(),
            data: { ...data },
            canvasSize: { ...this.canvasSize },
            zoom: this.zoomLevel,
            pan: { ...this.panOffset }
        };
        
        // 現在位置より後の履歴を削除
        this.transformHistory.splice(this.currentHistoryIndex + 1);
        
        // 新しい状態を追加
        this.transformHistory.push(state);
        this.currentHistoryIndex = this.transformHistory.length - 1;
        
        // 履歴サイズ制限（100件）
        if (this.transformHistory.length > 100) {
            this.transformHistory.shift();
            this.currentHistoryIndex--;
        }
    }

    undoTransform() {
        if (this.currentHistoryIndex > 0) {
            this.currentHistoryIndex--;
            const state = this.transformHistory[this.currentHistoryIndex];
            this.applyTransformState(state);
            return true;
        }
        return false;
    }

    redoTransform() {
        if (this.currentHistoryIndex < this.transformHistory.length - 1) {
            this.currentHistoryIndex++;
            const state = this.transformHistory[this.currentHistoryIndex];
            this.applyTransformState(state);
            return true;
        }
        return false;
    }

    applyTransformState(state) {
        // キャンバスサイズ復元
        if (state.canvasSize) {
            this.resizeCanvas(
                state.canvasSize.width,
                state.canvasSize.height,
                false // 履歴復元時は中央寄せしない
            );
        }
        
        // ズーム・パン復元
        if (this.appCore.viewport) {
            this.appCore.viewport.setZoom(state.zoom);
            this.appCore.viewport.x = state.pan.x;
            this.appCore.viewport.y = state.pan.y;
        }
        
        this.zoomLevel = state.zoom;
        this.panOffset = { ...state.pan };
    }

    // ===== パブリックAPI =====

    getCanvasSize() {
        return { ...this.canvasSize };
    }

    getZoomLevel() {
        return this.zoomLevel;
    }

    getPanOffset() {
        return { ...this.panOffset };
    }

    getTransformHistory() {
        return {
            history: this.transformHistory.map(state => ({
                id: state.id,
                action: state.action,
                timestamp: state.timestamp
            })),
            currentIndex: this.currentHistoryIndex
        };
    }

    // ===== デバッグ・統計 =====

    getPerformanceStats() {
        return {
            canvasSize: this.canvasSize,
            zoomLevel: this.zoomLevel,
            panOffset: this.panOffset,
            historyCount: this.transformHistory.length,
            currentHistoryIndex: this.currentHistoryIndex,
            viewportActive: !!this.appCore.viewport
        };
    }
}