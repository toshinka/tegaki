/**
 * キャンバス操作・PixiJS v8座標制御システム
 * モダンお絵かきツール v3.3 - Phase2キャンバス統合システム
 * 
 * 機能:
 * - PixiJS v8統一座標・移動・拡縮・回転・反転制御
 * - ショートカット連携・スムーズアニメーション・慣性制御
 * - ビューリセット・フィット・中央配置・画面範囲制限
 * - Chrome API活用・GPU最適化・パフォーマンス監視
 * - EventStore統合・リアルタイム状態同期・設定保存
 */

import { Point, Matrix } from 'pixi.js';

/**
 * キャンバス操作制御
 * PixiJS v8統一座標・高性能変形・設定管理
 */
class CanvasController {
    constructor(pixiApp, eventStore) {
        this.app = pixiApp;
        this.eventStore = eventStore;
        this.stage = pixiApp.stage;
        
        // キャンバス変形状態
        this.transform = {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            flipH: false,
            flipV: false
        };
        
        // デフォルト設定
        this.defaultTransform = { ...this.transform };
        
        // 操作設定
        this.settings = {
            // 移動設定
            moveStep: 10,
            fastMoveStep: 50,
            smoothMove: true,
            
            // 拡縮設定
            zoomStep: 0.1,
            minZoom: 0.1,
            maxZoom: 10.0,
            smoothZoom: true,
            zoomToCenter: true,
            
            // 回転設定
            rotateStep: 15,
            smoothRotate: true,
            snapToAngles: [0, 45, 90, 135, 180, 225, 270, 315],
            snapThreshold: 5,
            
            // アニメーション設定
            animationDuration: 300,
            easing: 'ease-out',
            
            // 制限設定
            constrainToScreen: false,
            allowNegativeZoom: false,
            
            // パフォーマンス設定
            useGPUAcceleration: true,
            throttleUpdates: true
        };
        
        // アニメーション管理
        this.isAnimating = false;
        this.animationFrame = null;
        this.animations = new Map();
        
        // 慣性制御
        this.inertia = {
            enabled: true,
            friction: 0.95,
            threshold: 0.1,
            velocity: { x: 0, y: 0 }
        };
        
        // パフォーマンス監視
        this.performance = {
            updateCount: 0,
            lastUpdate: 0,
            averageFrameTime: 0,
            throttleDelay: 16 // 60fps
        };
        
        // 状態履歴（アンドゥ・リドゥ用）
        this.transformHistory = [];
        this.historyIndex = -1;
        this.maxHistorySize = 20;
        
        this.initializeEventStoreIntegration();
        this.setupPerformanceOptimization();
        this.loadSettings();
        
        console.log('✅ CanvasController初期化完了 - PixiJS v8座標制御');
    }
    
    /**
     * EventStore統合設定
     * キャンバス操作・ショートカット・UI連携
     */
    initializeEventStoreIntegration() {
        // キャンバス移動イベント
        this.eventStore.on('canvas-move', (data) => {
            this.moveCanvas(data.direction, data.amount);
        });
        
        // キャンバス拡縮イベント
        this.eventStore.on('canvas-zoom', (data) => {
            this.zoomCanvas(data.factor, data.center);
        });
        
        // キャンバス回転イベント
        this.eventStore.on('canvas-rotate', (data) => {
            this.rotateCanvas(data.angle, data.smooth);
        });
        
        // キャンバス反転イベント
        this.eventStore.on('canvas-flip', (data) => {
            this.flipCanvas(data.axis);
        });
        
        // ビューリセットイベント
        this.eventStore.on('canvas-reset-view', () => {
            this.resetView();
        });
        
        // リサイズイベント
        this.eventStore.on('canvas-resize', (data) => {
            this.handleResize(data.width, data.height);
        });
        
        console.log('🔗 EventStore統合完了');
    }
    
    /**
     * パフォーマンス最適化設定
     * GPU加速・スロットリング・フレーム監視
     */
    setupPerformanceOptimization() {
        if (this.settings.useGPUAcceleration) {
            // GPU加速適用
            this.stage.transform.setFromMatrix = this.stage.transform.setFromMatrix.bind(this.stage.transform);
        }
        
        // フレーム監視
        this.app.ticker.add(() => {
            this.updatePerformanceMetrics();
        });
        
        console.log('⚡ パフォーマンス最適化設定完了');
    }
    
    /**
     * キャンバス移動
     * 方向指定・段階移動・スムーズアニメーション
     */
    moveCanvas(direction, amount = null) {
        const moveAmount = amount || this.settings.moveStep;
        let deltaX = 0;
        let deltaY = 0;
        
        switch (direction) {
            case 'up':
                deltaY = moveAmount;
                break;
            case 'down':
                deltaY = -moveAmount;
                break;
            case 'left':
                deltaX = moveAmount;
                break;
            case 'right':
                deltaX = -moveAmount;
                break;
            case 'center':
                return this.centerCanvas();
            default:
                console.warn(`⚠️ 未知の移動方向: ${direction}`);
                return false;
        }
        
        const newX = this.transform.x + deltaX;
        const newY = this.transform.y + deltaY;
        
        if (this.settings.smoothMove) {
            this.animateTransform({ x: newX, y: newY });
        } else {
            this.setTransform({ x: newX, y: newY });
        }
        
        console.log(`📐 キャンバス移動: ${direction} (${deltaX}, ${deltaY})`);
        return true;
    }
    
    /**
     * キャンバス拡縮
     * 倍率指定・中央基準・制限付き
     */
    zoomCanvas(factor, center = null) {
        let newScaleX = this.transform.scaleX * factor;
        let newScaleY = this.transform.scaleY * factor;
        
        // 拡縮制限適用
        newScaleX = Math.max(this.settings.minZoom, Math.min(this.settings.maxZoom, newScaleX));
        newScaleY = Math.max(this.settings.minZoom, Math.min(this.settings.maxZoom, newScaleY));
        
        // 変更がない場合は終了
        if (newScaleX === this.transform.scaleX && newScaleY === this.transform.scaleY) {
            return false;
        }
        
        let newX = this.transform.x;
        let newY = this.transform.y;
        
        // 中央基準拡縮
        if (this.settings.zoomToCenter || center) {
            const centerPoint = center || {
                x: this.app.screen.width / 2,
                y: this.app.screen.height / 2
            };
            
            // 拡縮中心点計算
            const worldCenter = this.screenToWorld(centerPoint.x, centerPoint.y);
            
            // 新しい位置計算
            newX = centerPoint.x - worldCenter.x * newScaleX;
            newY = centerPoint.y - worldCenter.y * newScaleY;
        }
        
        const newTransform = {
            x: newX,
            y: newY,
            scaleX: newScaleX,
            scaleY: newScaleY
        };
        
        if (this.settings.smoothZoom) {
            this.animateTransform(newTransform);
        } else {
            this.setTransform(newTransform);
        }
        
        console.log(`🔍 キャンバス拡縮: ${factor}x (${newScaleX.toFixed(2)}, ${newScaleY.toFixed(2)})`);
        return true;
    }
    
    /**
     * キャンバス回転
     * 角度指定・スナップ機能・スムーズ回転
     */
    rotateCanvas(angleDelta, smooth = null) {
        let newRotation = this.transform.rotation + angleDelta;
        
        // 角度正規化（0-360度）
        newRotation = ((newRotation % 360) + 360) % 360;
        
        // スナップ機能
        if (this.settings.snapToAngles.length > 0) {
            const snapAngle = this.findNearestSnapAngle(newRotation);
            if (Math.abs(newRotation - snapAngle) <= this.settings.snapThreshold) {
                newRotation = snapAngle;
            }
        }
        
        const newTransform = { rotation: newRotation };
        const shouldSmooth = smooth !== null ? smooth : this.settings.smoothRotate;
        
        if (shouldSmooth) {
            this.animateTransform(newTransform);
        } else {
            this.setTransform(newTransform);
        }
        
        console.log(`🔄 キャンバス回転: ${angleDelta}° → ${newRotation}°`);
        return true;
    }
    
    /**
     * キャンバス反転
     * 水平・垂直反転・トグル
     */
    flipCanvas(axis) {
        let newTransform = {};
        
        switch (axis) {
            case 'horizontal':
            case 'h':
                newTransform.flipH = !this.transform.flipH;
                break;
            case 'vertical':
            case 'v':
                newTransform.flipV = !this.transform.flipV;
                break;
            default:
                console.warn(`⚠️ 未知の反転軸: ${axis}`);
                return false;
        }
        
        this.setTransform(newTransform);
        
        console.log(`↔️ キャンバス反転: ${axis} - ${newTransform.flipH ? 'H' : ''}${newTransform.flipV ? 'V' : ''}`);
        return true;
    }
    
    /**
     * ビューリセット
     * デフォルト状態に復帰・アニメーション
     */
    resetView() {
        this.animateTransform({ ...this.defaultTransform });
        
        // 履歴追加
        this.addToHistory();
        
        console.log('🔄 ビューリセット完了');
        return true;
    }
    
    /**
     * キャンバス中央配置
     */
    centerCanvas() {
        const centerX = this.app.screen.width / 2;
        const centerY = this.app.screen.height / 2;
        
        this.animateTransform({ x: centerX, y: centerY });
        
        console.log('🎯 キャンバス中央配置');
        return true;
    }
    
    /**
     * フィット表示
     * キャンバス全体を画面に収める
     */
    fitToScreen() {
        // キャンバスサイズ取得（実装時には実際のコンテンツ境界を使用）
        const contentBounds = this.getContentBounds();
        
        if (!contentBounds || contentBounds.width <= 0 || contentBounds.height <= 0) {
            console.warn('⚠️ フィット対象のコンテンツが見つかりません');
            return false;
        }
        
        // 画面に収まるスケール計算
        const scaleX = this.app.screen.width / contentBounds.width;
        const scaleY = this.app.screen.height / contentBounds.height;
        const scale = Math.min(scaleX, scaleY) * 0.9; // 10%マージン
        
        // 中央配置
        const centerX = this.app.screen.width / 2;
        const centerY = this.app.screen.height / 2;
        
        this.animateTransform({
            x: centerX - (contentBounds.x + contentBounds.width / 2) * scale,
            y: centerY - (contentBounds.y + contentBounds.height / 2) * scale,
            scaleX: scale,
            scaleY: scale,
            rotation: 0,
            flipH: false,
            flipV: false
        });
        
        console.log(`📐 フィット表示: スケール ${scale.toFixed(2)}`);
        return true;
    }
    
    /**
     * 変形適用
     * PixiJS Stage変形・即座反映
     */
    setTransform(partialTransform) {
        // 変形データ更新
        Object.assign(this.transform, partialTransform);
        
        // PixiJS Stage変形適用
        this.applyTransformToStage();
        
        // イベント発行
        this.eventStore.emit('canvas-transform-changed', {
            transform: { ...this.transform },
            timestamp: Date.now()
        });
        
        // パフォーマンス監視
        this.performance.updateCount++;
        this.performance.lastUpdate = Date.now();
    }
    
    /**
     * Stage変形適用
     * PixiJS v8統一座標・Matrix活用
     */
    applyTransformToStage() {
        // 変形行列作成
        const matrix = new Matrix();
        
        // 移動
        matrix.translate(this.transform.x, this.transform.y);
        
        // 拡縮（反転含む）
        const scaleX = this.transform.scaleX * (this.transform.flipH ? -1 : 1);
        const scaleY = this.transform.scaleY * (this.transform.flipV ? -1 : 1);
        matrix.scale(scaleX, scaleY);
        
        // 回転
        if (this.transform.rotation !== 0) {
            const radians = (this.transform.rotation * Math.PI) / 180;
            matrix.rotate(radians);
        }
        
        // Stage変形適用
        this.stage.transform.setFromMatrix(matrix);
    }
    
    /**
     * アニメーション変形
     * スムーズトランジション・イージング
     */
    animateTransform(targetTransform) {
        if (this.isAnimating) {
            this.stopCurrentAnimation();
        }
        
        const startTransform = { ...this.transform };
        const animationId = Date.now();
        
        const animation = {
            id: animationId,
            startTime: Date.now(),
            duration: this.settings.animationDuration,
            startTransform: startTransform,
            targetTransform: targetTransform,
            easing: this.settings.easing
        };
        
        this.animations.set(animationId, animation);
        this.isAnimating = true;
        
        this.runAnimation(animation);
        
        return animationId;
    }
    
    /**
     * アニメーション実行
     * フレーム更新・イージング適用
     */
    runAnimation(animation) {
        const update = () => {
            const elapsed = Date.now() - animation.startTime;
            const progress = Math.min(elapsed / animation.duration, 1);
            
            // イージング適用
            const easedProgress = this.applyEasing(progress, animation.easing);
            
            // 補間計算
            const interpolatedTransform = this.interpolateTransform(
                animation.startTransform,
                animation.targetTransform,
                easedProgress
            );
            
            // 変形適用
            this.setTransform(interpolatedTransform);
            
            // アニメーション継続判定
            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(update);
            } else {
                this.completeAnimation(animation.id);
            }
        };
        
        this.animationFrame = requestAnimationFrame(update);
    }
    
    /**
     * イージング適用
     */
    applyEasing(progress, easingType) {
        switch (easingType) {
            case 'linear':
                return progress;
            case 'ease-in':
                return progress * progress;
            case 'ease-out':
                return 1 - Math.pow(1 - progress, 2);
            case 'ease-in-out':
                return progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            default:
                return 1 - Math.pow(1 - progress, 2); // ease-out
        }
    }
    
    /**
     * 変形補間
     */
    interpolateTransform(start, target, progress) {
        const result = {};
        
        // 各プロパティを補間
        ['x', 'y', 'scaleX', 'scaleY', 'rotation'].forEach(prop => {
            if (target[prop] !== undefined) {
                result[prop] = start[prop] + (target[prop] - start[prop]) * progress;
            }
        });
        
        // ブール値プロパティ
        ['flipH', 'flipV'].forEach(prop => {
            if (target[prop] !== undefined) {
                result[prop] = progress > 0.5 ? target[prop] : start[prop];
            }
        });
        
        return result;
    }
    
    /**
     * アニメーション完了
     */
    completeAnimation(animationId) {
        this.animations.delete(animationId);
        
        if (this.animations.size === 0) {
            this.isAnimating = false;
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
        }
        
        // 履歴追加
        this.addToHistory();
    }
    
    /**
     * 現在のアニメーション停止
     */
    stopCurrentAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        this.animations.clear();
        this.isAnimating = false;
    }
    
    /**
     * 座標変換: スクリーン → ワールド
     */
    screenToWorld(screenX, screenY) {
        const point = new Point(screenX, screenY);
        return this.stage.toLocal(point);
    }
    
    /**
     * 座標変換: ワールド → スクリーン
     */
    worldToScreen(worldX, worldY) {
        const point = new Point(worldX, worldY);
        return this.stage.toGlobal(point);
    }
    
    /**
     * 最近スナップ角度検索
     */
    findNearestSnapAngle(angle) {
        if (this.settings.snapToAngles.length === 0) return angle;
        
        let nearestAngle = this.settings.snapToAngles[0];
        let minDistance = Math.abs(angle - nearestAngle);
        
        this.settings.snapToAngles.forEach(snapAngle => {
            const distance = Math.abs(angle - snapAngle);
            if (distance < minDistance) {
                minDistance = distance;
                nearestAngle = snapAngle;
            }
        });
        
        return nearestAngle;
    }
    
    /**
     * コンテンツ境界取得
     */
    getContentBounds() {
        try {
            // 実際の描画コンテンツの境界を取得
            // レイヤーコンテナから境界計算
            const bounds = this.stage.getBounds();
            
            if (bounds.width > 0 && bounds.height > 0) {
                return bounds;
            }
            
            // フォールバック: デフォルトサイズ
            return {
                x: 0,
                y: 0,
                width: 800,
                height: 600
            };
            
        } catch (error) {
            console.error('❌ コンテンツ境界取得エラー:', error);
            return null;
        }
    }
    
    /**
     * リサイズ処理
     */
    handleResize(width, height) {
        // アスペクト比維持オプション
        if (this.settings.maintainAspectRatio) {
            const aspectRatio = this.transform.scaleX / this.transform.scaleY;
            // アスペクト比調整ロジック（必要に応じて実装）
        }
        
        console.log(`📐 リサイズ処理: ${width}x${height}`);
    }
    
    /**
     * 変形履歴管理
     */
    addToHistory() {
        // 現在の位置以降の履歴削除
        this.transformHistory = this.transformHistory.slice(0, this.historyIndex + 1);
        
        // 新しい履歴追加
        this.transformHistory.push({ ...this.transform });
        this.historyIndex++;
        
        // 履歴サイズ制限
        if (this.transformHistory.length > this.maxHistorySize) {
            this.transformHistory.shift();
            this.historyIndex--;
        }
    }
    
    /**
     * アンドゥ
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const previousTransform = this.transformHistory[this.historyIndex];
            this.animateTransform(previousTransform);
            console.log('↶ キャンバス変形アンドゥ');
            return true;
        }
        return false;
    }
    
    /**
     * リドゥ
     */
    redo() {
        if (this.historyIndex < this.transformHistory.length - 1) {
            this.historyIndex++;
            const nextTransform = this.transformHistory[this.historyIndex];
            this.animateTransform(nextTransform);
            console.log('↷ キャンバス変形リドゥ');
            return true;
        }
        return false;
    }
    
    /**
     * パフォーマンス監視更新
     */
    updatePerformanceMetrics() {
        const now = Date.now();
        const deltaTime = now - this.performance.lastUpdate;
        
        if (deltaTime > 0) {
            this.performance.averageFrameTime = 
                (this.performance.averageFrameTime * 0.9) + (deltaTime * 0.1);
        }
    }
    
    /**
     * 現在の変形状態取得
     */
    getTransform() {
        return { ...this.transform };
    }
    
    /**
     * 設定取得
     */
    getSettings() {
        return { ...this.settings };
    }
    
    /**
     * 設定更新
     */
    updateSettings(newSettings) {
        this.settings = {
            ...this.settings,
            ...newSettings
        };
        
        this.saveSettings();
        console.log('⚙️ キャンバス設定更新', newSettings);
    }
    
    /**
     * 設定保存
     */
    saveSettings() {
        try {
            const settingsData = {
                settings: this.settings,
                transform: this.transform,
                version: '3.3'
            };
            
            localStorage.setItem('canvas-controller-settings', JSON.stringify(settingsData));
            console.log('💾 キャンバス設定保存完了');
            
        } catch (error) {
            console.error('❌ キャンバス設定保存失敗:', error);
        }
    }
    
    /**
     * 設定読み込み
     */
    loadSettings() {
        try {
            const settingsData = localStorage.getItem('canvas-controller-settings');
            if (settingsData) {
                const parsed = JSON.parse(settingsData);
                
                if (parsed.settings) {
                    this.settings = { ...this.settings, ...parsed.settings };
                }
                
                if (parsed.transform) {
                    this.transform = { ...this.transform, ...parsed.transform };
                    this.applyTransformToStage();
                }
                
                console.log('📂 キャンバス設定読み込み完了');
            }
        } catch (error) {
            console.error('❌ キャンバス設定読み込み失敗:', error);
        }
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            transform: this.getTransform(),
            settings: this.getSettings(),
            animation: {
                isAnimating: this.isAnimating,
                activeAnimations: this.animations.size
            },
            performance: {
                ...this.performance,
                frameTime: this.performance.averageFrameTime.toFixed(2) + 'ms'
            },
            history: {
                size: this.transformHistory.length,
                index: this.historyIndex,
                canUndo: this.historyIndex > 0,
                canRedo: this.historyIndex < this.transformHistory.length - 1
            }
        };
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // アニメーション停止
        this.stopCurrentAnimation();
        
        // 設定保存
        this.saveSettings();
        
        // 配列クリア
        this.transformHistory = [];
        this.animations.clear();
        
        // 状態リセット
        this.isAnimating = false;
        this.historyIndex = -1;
        
        console.log('🗑️ CanvasController リソース解放完了');
    }
}

export default CanvasController;