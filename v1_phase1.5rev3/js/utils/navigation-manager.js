/**
 * 🧭 NavigationManager - Phase1.5 キャンバス移動・変形システム
 * 📋 RESPONSIBILITY: キャンバス移動・ズーム・回転・変形状態管理のみ
 * 🚫 PROHIBITION: 描画処理・ツール操作・レイヤー管理・座標変換処理
 * ✅ PERMISSION: パン操作・ズーム操作・回転操作・変形状態保存復元
 * 
 * 📏 DESIGN_PRINCIPLE: ナビゲーション専門・CoordinateManager連携・剛直構造
 * 🔄 INTEGRATION: CoordinateManager・PixiJS・マウス/キーボードイベント連携
 * 🎯 FEATURE: パン・ズーム・回転・変形リセット・操作履歴
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * NavigationManager - キャンバス移動・変形システム
 * CoordinateManagerと連携してキャンバスの表示変形を管理
 */
class NavigationManager {
    constructor() {
        console.log('🧭 NavigationManager Phase1.5 ナビゲーション・変形システム 作成');
        
        // 依存関係
        this.coordinateManager = null;
        this.pixiApp = null;
        this.canvasContainer = null;
        
        // ナビゲーション状態
        this.isEnabled = true;
        this.isPanning = false;
        this.isZooming = false;
        this.panStartPosition = null;
        this.lastPanPosition = null;
        
        // 変形制限
        this.minZoom = 0.1;
        this.maxZoom = 10.0;
        this.maxPanDistance = 5000;  // キャンバスから最大移動距離
        
        // キーボード操作
        this.keyboardPanSpeed = 20;   // キーボード移動速度（px）
        this.keyboardZoomStep = 0.1;  // キーボードズーム段階
        
        // 操作履歴（Phase1.5基本・RecordManager連携準備）
        this.transformHistory = [];
        this.maxHistorySize = 50;
        
        // マウス・キーボードイベント状態
        this.mouseState = {
            leftButton: false,
            middleButton: false,
            rightButton: false,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            spaceKey: false
        };
        
        // パフォーマンス・統計
        this.navigationCount = 0;
        this.lastNavigationInfo = null;
        
        console.log('🧭 NavigationManager 基本設定完了');
    }
    
    /**
     * 依存関係設定
     */
    setCoordinateManager(coordinateManager) {
        if (!coordinateManager) {
            throw new Error('CoordinateManager is required');
        }
        
        this.coordinateManager = coordinateManager;
        console.log('✅ NavigationManager - CoordinateManager設定完了');
    }
    
    setPixiApp(pixiApp) {
        if (!pixiApp) {
            throw new Error('PixiJS Application is required');
        }
        
        this.pixiApp = pixiApp;
        this.canvasContainer = pixiApp.view?.parentElement || document.getElementById('canvas-container');
        console.log('✅ NavigationManager - PixiJS設定完了');
    }
    
    /**
     * 🎯 基本移動・変形操作
     */
    
    /**
     * キャンバス移動（パン）
     */
    panCanvas(deltaX, deltaY) {
        if (!this.coordinateManager || !this.isEnabled) return false;
        
        // 現在の変形状態取得
        const currentTransform = this.coordinateManager.getCanvasTransform();
        
        // 新しい移動量計算（制限適用）
        const newTranslateX = this.clampPanDistance(currentTransform.translateX + deltaX);
        const newTranslateY = this.clampPanDistance(currentTransform.translateY + deltaY);
        
        // 移動量変更があった場合のみ適用
        if (newTranslateX !== currentTransform.translateX || 
            newTranslateY !== currentTransform.translateY) {
            
            this.coordinateManager.setTranslation(newTranslateX, newTranslateY);
            this.applyTransformToCanvas();
            
            // 履歴記録
            this.recordTransformation('pan', {
                deltaX: deltaX,
                deltaY: deltaY,
                newTranslateX: newTranslateX,
                newTranslateY: newTranslateY
            });
            
            this.navigationCount++;
            console.log(`🧭 パン実行: (${deltaX.toFixed(1)}, ${deltaY.toFixed(1)})`);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * キャンバスズーム
     */
    zoomCanvas(scaleFactor, centerX = null, centerY = null) {
        if (!this.coordinateManager || !this.isEnabled) return false;
        
        // 現在の変形状態取得
        const currentTransform = this.coordinateManager.getCanvasTransform();
        
        // 新しいスケール計算（制限適用）
        const newScale = Math.max(this.minZoom, Math.min(this.maxZoom, 
            currentTransform.scaleX * scaleFactor));
        
        // スケール変更があった場合のみ適用
        if (Math.abs(newScale - currentTransform.scaleX) > 0.001) {
            
            // 中心点指定がある場合はズーム中心を考慮した移動調整
            let adjustedTranslateX = currentTransform.translateX;
            let adjustedTranslateY = currentTransform.translateY;
            
            if (centerX !== null && centerY !== null) {
                // ズーム中心点を基準とした移動調整（基本実装）
                const scaleChange = newScale / currentTransform.scaleX - 1;
                adjustedTranslateX -= (centerX - currentTransform.translateX) * scaleChange;
                adjustedTranslateY -= (centerY - currentTransform.translateY) * scaleChange;
                
                // 移動制限適用
                adjustedTranslateX = this.clampPanDistance(adjustedTranslateX);
                adjustedTranslateY = this.clampPanDistance(adjustedTranslateY);
            }
            
            // 変形適用
            this.coordinateManager.setScale(newScale, newScale);
            this.coordinateManager.setTranslation(adjustedTranslateX, adjustedTranslateY);
            this.applyTransformToCanvas();
            
            // 履歴記録
            this.recordTransformation('zoom', {
                scaleFactor: scaleFactor,
                newScale: newScale,
                centerX: centerX,
                centerY: centerY,
                adjustedTranslateX: adjustedTranslateX,
                adjustedTranslateY: adjustedTranslateY
            });
            
            this.navigationCount++;
            console.log(`🧭 ズーム実行: scale=${newScale.toFixed(2)}, factor=${scaleFactor.toFixed(2)}`);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * キャンバス回転（Phase1.5基本実装・Phase2で拡張）
     */
    rotateCanvas(angleDelta, centerX = null, centerY = null) {
        if (!this.coordinateManager || !this.isEnabled) return false;
        
        // 現在の変形状態取得
        const currentTransform = this.coordinateManager.getCanvasTransform();
        
        // 新しい角度計算（正規化）
        const newRotation = (currentTransform.rotation + angleDelta) % (2 * Math.PI);
        
        // 角度変更があった場合のみ適用
        if (Math.abs(angleDelta) > 0.001) {
            
            this.coordinateManager.setRotation(newRotation);
            this.applyTransformToCanvas();
            
            // 履歴記録
            this.recordTransformation('rotate', {
                angleDelta: angleDelta,
                newRotation: newRotation,
                centerX: centerX,
                centerY: centerY
            });
            
            this.navigationCount++;
            console.log(`🧭 回転実行: ${(angleDelta * 180 / Math.PI).toFixed(1)}度`);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * キャンバス変形リセット
     */
    resetCanvasTransform() {
        if (!this.coordinateManager || !this.isEnabled) return false;
        
        this.coordinateManager.resetTransform();
        this.applyTransformToCanvas();
        
        // 履歴記録
        this.recordTransformation('reset', {
            resetTime: Date.now()
        });
        
        this.navigationCount++;
        console.log('🧭 キャンバス変形リセット完了');
        
        return true;
    }
    
    /**
     * 🎯 インタラクティブナビゲーション操作
     */
    
    /**
     * パン操作開始
     */
    startPan(x, y) {
        if (!this.isEnabled || this.isPanning) return false;
        
        this.isPanning = true;
        this.panStartPosition = { x, y };
        this.lastPanPosition = { x, y };
        
        // UI状態変更（カーソル変更等）
        this.updateCursor('panning');
        
        console.log(`🧭 パン開始: (${x.toFixed(1)}, ${y.toFixed(1)})`);
        return true;
    }
    
    /**
     * パン操作更新
     */
    updatePan(x, y) {
        if (!this.isPanning || !this.lastPanPosition) return false;
        
        // 前回位置からの移動量計算
        const deltaX = x - this.lastPanPosition.x;
        const deltaY = y - this.lastPanPosition.y;
        
        // パン実行
        const success = this.panCanvas(deltaX, deltaY);
        
        if (success) {
            this.lastPanPosition = { x, y };
        }
        
        return success;
    }
    
    /**
     * パン操作終了
     */
    endPan() {
        if (!this.isPanning) return false;
        
        this.isPanning = false;
        this.panStartPosition = null;
        this.lastPanPosition = null;
        
        // UI状態復元
        this.updateCursor('default');
        
        console.log('🧭 パン終了');
        return true;
    }
    
    /**
     * 🎯 キーボード・マウス操作
     */
    
    /**
     * キーボードナビゲーション処理
     */
    handleKeyboardNavigation(event) {
        if (!this.isEnabled) return false;
        
        let handled = false;
        
        // キーボードパン（方向キー）
        if (event.key === 'ArrowLeft' && event.code === 'Space') {
            this.panCanvas(-this.keyboardPanSpeed, 0);
            handled = true;
        } else if (event.key === 'ArrowRight' && event.code === 'Space') {
            this.panCanvas(this.keyboardPanSpeed, 0);
            handled = true;
        } else if (event.key === 'ArrowUp' && event.code === 'Space') {
            this.panCanvas(0, -this.keyboardPanSpeed);
            handled = true;
        } else if (event.key === 'ArrowDown' && event.code === 'Space') {
            this.panCanvas(0, this.keyboardPanSpeed);
            handled = true;
        }
        
        // キーボードズーム（+ / - キー）
        else if (event.key === '=' || event.key === '+') {
            this.zoomCanvas(1 + this.keyboardZoomStep);
            handled = true;
        } else if (event.key === '-' || event.key === '_') {
            this.zoomCanvas(1 - this.keyboardZoomStep);
            handled = true;
        }
        
        // 変形リセット（Ctrl+0）
        else if (event.key === '0' && event.ctrlKey) {
            this.resetCanvasTransform();
            handled = true;
        }
        
        if (handled) {
            event.preventDefault();
            console.log(`🧭 キーボードナビゲーション: ${event.key}`);
        }
        
        return handled;
    }
    
    /**
     * マウスホイールズーム処理
     */
    handleMouseWheelZoom(event) {
        if (!this.isEnabled || !event.ctrlKey) return false;
        
        // ホイール方向に応じてズーム
        const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
        
        // マウス位置を中心としたズーム
        const centerX = event.offsetX || event.layerX;
        const centerY = event.offsetY || event.layerY;
        
        const success = this.zoomCanvas(scaleFactor, centerX, centerY);
        
        if (success) {
            event.preventDefault();
            console.log(`🧭 マウスホイールズーム: factor=${scaleFactor.toFixed(2)}`);
        }
        
        return success;
    }
    
    /**
     * 中ボタンパン処理
     */
    handleMiddleClickPan(event) {
        if (!this.isEnabled) return false;
        
        if (event.type === 'mousedown' && event.button === 1) {
            // 中ボタン押下：パン開始
            this.startPan(event.offsetX || event.layerX, event.offsetY || event.layerY);
            event.preventDefault();
            return true;
        } else if (event.type === 'mousemove' && this.isPanning) {
            // 中ボタンドラッグ：パン更新
            this.updatePan(event.offsetX || event.layerX, event.offsetY || event.layerY);
            event.preventDefault();
            return true;
        } else if (event.type === 'mouseup' && event.button === 1) {
            // 中ボタン離し：パン終了
            this.endPan();
            event.preventDefault();
            return true;
        }
        
        return false;
    }
    
    /**
     * 🔧 内部処理・ヘルパーメソッド
     */
    
    /**
     * 移動距離制限
     */
    clampPanDistance(distance) {
        return Math.max(-this.maxPanDistance, Math.min(this.maxPanDistance, distance));
    }
    
    /**
     * キャンバスへの変形適用
     */
    applyTransformToCanvas() {
        if (!this.pixiApp?.stage) return;
        
        const transform = this.coordinateManager.getCanvasTransform();
        
        // PixiJS Stageに変形適用
        this.pixiApp.stage.position.set(transform.translateX, transform.translateY);
        this.pixiApp.stage.scale.set(transform.scaleX, transform.scaleY);
        this.pixiApp.stage.rotation = transform.rotation;
        
        // 再描画要求（必要に応じて）
        if (this.pixiApp.renderer) {
            this.pixiApp.renderer.render(this.pixiApp.stage);
        }
        
        console.log(`🧭 Canvas変形適用: translate=(${transform.translateX.toFixed(1)}, ${transform.translateY.toFixed(1)}), scale=${transform.scaleX.toFixed(2)}, rotation=${(transform.rotation * 180 / Math.PI).toFixed(1)}°`);
    }
    
    /**
     * カーソル更新
     */
    updateCursor(cursorType) {
        if (!this.canvasContainer) return;
        
        const cursorMap = {
            'default': 'crosshair',
            'panning': 'move',
            'zooming': 'zoom-in',
            'rotating': 'grab'
        };
        
        const cursor = cursorMap[cursorType] || 'crosshair';
        this.canvasContainer.style.cursor = cursor;
    }
    
    /**
     * 変形履歴記録
     */
    recordTransformation(type, details) {
        const record = {
            type: type,
            details: details,
            transform: this.coordinateManager.getCanvasTransform(),
            timestamp: Date.now(),
            navigationCount: this.navigationCount
        };
        
        this.transformHistory.push(record);
        
        // 履歴サイズ制限
        if (this.transformHistory.length > this.maxHistorySize) {
            this.transformHistory.shift();
        }
        
        this.lastNavigationInfo = record;
    }
    
    /**
     * 🎯 変形状態管理
     */
    
    /**
     * 現在の変形状態取得
     */
    getCanvasTransform() {
        return this.coordinateManager ? this.coordinateManager.getCanvasTransform() : null;
    }
    
    /**
     * 変形状態設定
     */
    setCanvasTransform(transform) {
        if (!this.coordinateManager) return false;
        
        try {
            this.coordinateManager.setTranslation(transform.translateX, transform.translateY);
            this.coordinateManager.setScale(transform.scaleX, transform.scaleY);
            this.coordinateManager.setRotation(transform.rotation);
            
            this.applyTransformToCanvas();
            
            // 履歴記録
            this.recordTransformation('set_transform', {
                transform: transform,
                source: 'external'
            });
            
            console.log('🧭 変形状態設定完了');
            return true;
        } catch (error) {
            console.error('❌ 変形状態設定エラー:', error);
            return false;
        }
    }
    
    /**
     * 変形状態保存
     */
    saveTransformState(name = null) {
        const transform = this.getCanvasTransform();
        if (!transform) return null;
        
        const state = {
            name: name || `state_${Date.now()}`,
            transform: { ...transform },
            timestamp: Date.now(),
            navigationCount: this.navigationCount
        };
        
        console.log(`🧭 変形状態保存: ${state.name}`);
        return state;
    }
    
    /**
     * 変形状態復元
     */
    restoreTransformState(state) {
        if (!state || !state.transform) {
            console.warn('⚠️ 無効な変形状態');
            return false;
        }
        
        const success = this.setCanvasTransform(state.transform);
        
        if (success) {
            console.log(`🧭 変形状態復元: ${state.name}`);
        } else {
            console.error(`❌ 変形状態復元失敗: ${state.name}`);
        }
        
        return success;
    }
    
    /**
     * 🎯 設定・状態管理
     */
    
    /**
     * ナビゲーション有効/無効切り替え
     */
    setEnabled(enabled) {
        const wasEnabled = this.isEnabled;
        this.isEnabled = !!enabled;
        
        // 無効化時は進行中の操作を停止
        if (!this.isEnabled && wasEnabled) {
            this.endPan();
            this.updateCursor('default');
        }
        
        console.log(`🧭 ナビゲーション: ${this.isEnabled ? '有効' : '無効'}`);
        return this.isEnabled;
    }
    
    /**
     * 変形制限設定
     */
    setZoomLimits(minZoom, maxZoom) {
        this.minZoom = Math.max(0.01, minZoom);
        this.maxZoom = Math.min(100, maxZoom);
        
        console.log(`🧭 ズーム制限設定: ${this.minZoom} - ${this.maxZoom}`);
    }
    
    setPanLimit(maxDistance) {
        this.maxPanDistance = Math.max(100, maxDistance);
        
        console.log(`🧭 パン制限設定: ${this.maxPanDistance}px`);
    }
    
    /**
     * キーボード操作速度設定
     */
    setKeyboardSpeeds(panSpeed, zoomStep) {
        this.keyboardPanSpeed = Math.max(1, panSpeed);
        this.keyboardZoomStep = Math.max(0.01, Math.min(0.5, zoomStep));
        
        console.log(`🧭 キーボード速度設定: pan=${this.keyboardPanSpeed}px, zoom=${this.keyboardZoomStep}`);
    }
    
    /**
     * 設定取得
     */
    getSettings() {
        return {
            isEnabled: this.isEnabled,
            minZoom: this.minZoom,
            maxZoom: this.maxZoom,
            maxPanDistance: this.maxPanDistance,
            keyboardPanSpeed: this.keyboardPanSpeed,
            keyboardZoomStep: this.keyboardZoomStep
        };
    }
    
    /**
     * 履歴取得
     */
    getTransformHistory() {
        return [...this.transformHistory];
    }
    
    /**
     * 履歴クリア
     */
    clearTransformHistory() {
        this.transformHistory = [];
        this.lastNavigationInfo = null;
        
        console.log('🧭 変形履歴クリア完了');
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            navigationCount: this.navigationCount,
            transformHistorySize: this.transformHistory.length,
            lastNavigationInfo: this.lastNavigationInfo,
            currentState: {
                isEnabled: this.isEnabled,
                isPanning: this.isPanning,
                isZooming: this.isZooming
            }
        };
    }
    
    /**
     * デバッグ情報取得（完全版）
     */
    getDebugInfo() {
        return {
            // 基本状態
            isReady: !!(this.coordinateManager && this.pixiApp),
            coordinateManagerSet: !!this.coordinateManager,
            pixiAppSet: !!this.pixiApp,
            canvasContainerSet: !!this.canvasContainer,
            
            // ナビゲーション状態
            navigation: {
                isEnabled: this.isEnabled,
                isPanning: this.isPanning,
                isZooming: this.isZooming,
                panStartPosition: this.panStartPosition,
                lastPanPosition: this.lastPanPosition
            },
            
            // 設定情報
            settings: this.getSettings(),
            
            // 現在の変形状態
            transform: this.getCanvasTransform(),
            
            // 履歴・統計
            history: {
                size: this.transformHistory.length,
                maxSize: this.maxHistorySize,
                lastEntry: this.transformHistory[this.transformHistory.length - 1] || null
            },
            stats: this.getStats(),
            
            // マウス状態
            mouseState: { ...this.mouseState },
            
            // パフォーマンス情報
            performance: {
                avgNavigationsPerSecond: this.calculateNavigationRate(),
                memoryUsage: this.estimateMemoryUsage()
            },
            
            // Phase情報
            phase: {
                current: '1.5',
                features: {
                    panCanvas: true,
                    zoomCanvas: true,
                    rotateCanvas: true,
                    keyboardNavigation: true,
                    mouseNavigation: true,
                    transformHistory: true
                },
                nextPhase: {
                    target: '2',
                    newFeatures: [
                        'layerTransform',
                        'selectionTransform',
                        'advancedRotation'
                    ]
                }
            }
        };
    }
    
    /**
     * パフォーマンス計算（デバッグ用）
     */
    calculateNavigationRate() {
        // 簡易的なナビゲーションレート計算（実装省略・概算値）
        return this.navigationCount > 0 ? Math.min(this.navigationCount / 10, 30) : 0;
    }
    
    estimateMemoryUsage() {
        // 簡易的なメモリ使用量推定（実装省略・概算値）
        const baseSize = 2048; // NavigationManager基本サイズ
        const historySize = this.transformHistory.length * 512; // 履歴データサイズ
        const stateSize = 256; // 現在状態サイズ
        
        return baseSize + historySize + stateSize;
    }
}

// Tegaki名前空間に登録
window.Tegaki.NavigationManager = NavigationManager;

console.log('🧭 NavigationManager Phase1.5 Loaded - キャンバス移動・ズーム・回転・変形履歴完成');
console.log('🧭 navigation-manager.js loaded - CoordinateManager連携・インタラクティブナビゲーション・剛直構造実現');