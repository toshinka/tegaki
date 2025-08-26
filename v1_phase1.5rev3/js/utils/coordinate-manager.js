/**
 * 📐 CoordinateManager - キャンバス外描画対応座標変換システム
 * 📋 RESPONSIBILITY: 座標変換・キャンバス外描画判定・座標精度管理のみ
 * 🚫 PROHIBITION: 描画処理・UI操作・レイヤー管理・イベント処理
 * ✅ PERMISSION: 座標計算・境界判定・変換処理・デバッグ情報
 * 
 * 📏 DESIGN_PRINCIPLE: シンプル座標変換・AI管理最適化・剛直構造
 * 🔄 INTEGRATION: TegakiApplication・全ツール・NavigationManagerとの連携
 * 🎯 FEATURE: キャンバス外20px描画許可・正確な座標変換・クランプ処理
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * CoordinateManager - キャンバス外描画対応座標変換システム
 * シンプルで確実な座標変換・AI管理に最適化された剛直構造
 */
class CoordinateManager {
    constructor() {
        console.log('📐 CoordinateManager Phase1.5 座標系強化版 作成');
        
        // キャンバス情報
        this.canvasElement = null;
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        
        // 座標変換設定
        this.extendedDrawMargin = 20;     // キャンバス外描画許可範囲（px）
        this.coordinatePrecision = 1;     // 座標精度（小数点以下桁数）
        
        // 変形状態（Phase1.5基本・Phase2で拡張）
        this.canvasTransform = {
            translateX: 0,
            translateY: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0
        };
        
        // デバッグ・統計情報
        this.transformCount = 0;          // 座標変換実行回数
        this.outOfBoundsCount = 0;        // 範囲外座標処理回数
        this.lastTransformInfo = null;    // 最後の変換情報
    }
    
    /**
     * キャンバス要素設定・情報取得
     */
    setCanvasElement(canvasElement) {
        if (!canvasElement) {
            throw new Error('CoordinateManager: Canvas element is required');
        }
        
        this.canvasElement = canvasElement;
        this.updateCanvasInfo();
        
        console.log(`📐 CoordinateManager - Canvas要素設定: ${this.canvasWidth}x${this.canvasHeight}px`);
    }
    
    /**
     * キャンバス情報更新（リサイズ対応）
     */
    updateCanvasInfo() {
        if (!this.canvasElement) return;
        
        const rect = this.canvasElement.getBoundingClientRect();
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
        
        console.log(`📐 Canvas情報更新: ${this.canvasWidth}x${this.canvasHeight}px`);
    }
    
    /**
     * 🎯 メイン機能: スクリーン座標→キャンバス座標変換（キャンバス外対応）
     */
    screenToCanvas(screenX, screenY) {
        if (!this.canvasElement) {
            console.warn('⚠️ CoordinateManager: Canvas element not set');
            return { x: screenX, y: screenY, isValid: false };
        }
        
        this.transformCount++;
        
        // 基本座標変換（DOMからキャンバス内部座標）
        const rect = this.canvasElement.getBoundingClientRect();
        let canvasX = screenX - rect.left;
        let canvasY = screenY - rect.top;
        
        // 🔧 Phase1.5: シンプル変形対応（基本のみ・Phase2で拡張）
        if (this.hasTransform()) {
            const transformed = this.applyInverseTransform(canvasX, canvasY);
            canvasX = transformed.x;
            canvasY = transformed.y;
        }
        
        // 座標精度調整
        const preciseX = this.adjustPrecision(canvasX);
        const preciseY = this.adjustPrecision(canvasY);
        
        // キャンバス内外判定
        const isInsideCanvas = this.isInsideCanvas(preciseX, preciseY);
        const isInExtendedArea = this.isInExtendedDrawArea(preciseX, preciseY);
        
        // デバッグ情報記録（範囲外の場合）
        if (!isInsideCanvas) {
            this.outOfBoundsCount++;
            this.lastTransformInfo = {
                screen: { x: screenX, y: screenY },
                canvas: { x: preciseX, y: preciseY },
                isInsideCanvas: isInsideCanvas,
                isInExtendedArea: isInExtendedArea,
                boundingRect: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                },
                timestamp: Date.now()
            };
        }
        
        return {
            x: preciseX,
            y: preciseY,
            isValid: true,
            isInsideCanvas: isInsideCanvas,
            isInExtendedArea: isInExtendedArea,
            canDraw: isInExtendedArea  // 描画可能判定
        };
    }
    
    /**
     * 🎯 キャンバス座標→スクリーン座標変換（逆変換）
     */
    canvasToScreen(canvasX, canvasY) {
        if (!this.canvasElement) {
            console.warn('⚠️ CoordinateManager: Canvas element not set');
            return { x: canvasX, y: canvasY, isValid: false };
        }
        
        // 🔧 Phase1.5: 変形適用（Phase2で拡張）
        let transformedX = canvasX;
        let transformedY = canvasY;
        
        if (this.hasTransform()) {
            const transformed = this.applyTransform(canvasX, canvasY);
            transformedX = transformed.x;
            transformedY = transformed.y;
        }
        
        // DOM座標に変換
        const rect = this.canvasElement.getBoundingClientRect();
        const screenX = transformedX + rect.left;
        const screenY = transformedY + rect.top;
        
        return {
            x: this.adjustPrecision(screenX),
            y: this.adjustPrecision(screenY),
            isValid: true
        };
    }
    
    /**
     * 🎯 描画可能エリアへのクランプ（キャンバス外描画対応）
     */
    clampToDrawableArea(x, y) {
        // 拡張描画エリア範囲でクランプ
        const minX = -this.extendedDrawMargin;
        const maxX = this.canvasWidth + this.extendedDrawMargin;
        const minY = -this.extendedDrawMargin;
        const maxY = this.canvasHeight + this.extendedDrawMargin;
        
        const clampedX = Math.max(minX, Math.min(maxX, x));
        const clampedY = Math.max(minY, Math.min(maxY, y));
        
        // クランプが発生した場合の情報記録
        const wasClamped = (clampedX !== x || clampedY !== y);
        if (wasClamped) {
            console.log(`📐 座標クランプ実行: (${x.toFixed(1)}, ${y.toFixed(1)}) → (${clampedX.toFixed(1)}, ${clampedY.toFixed(1)})`);
        }
        
        return {
            x: this.adjustPrecision(clampedX),
            y: this.adjustPrecision(clampedY),
            wasClamped: wasClamped,
            original: { x, y }
        };
    }
    
    /**
     * キャンバス内判定
     */
    isInsideCanvas(x, y) {
        return x >= 0 && x <= this.canvasWidth && y >= 0 && y <= this.canvasHeight;
    }
    
    /**
     * 拡張描画エリア判定（キャンバス外描画許可範囲）
     */
    isInExtendedDrawArea(x, y) {
        const margin = this.extendedDrawMargin;
        return x >= -margin && x <= this.canvasWidth + margin && 
               y >= -margin && y <= this.canvasHeight + margin;
    }
    
    /**
     * 座標精度調整
     */
    adjustPrecision(coordinate) {
        const factor = Math.pow(10, this.coordinatePrecision);
        return Math.round(coordinate * factor) / factor;
    }
    
    /**
     * 🔧 Phase1.5基本変形機能（Phase2で大幅拡張）
     */
    
    /**
     * 変形状態確認
     */
    hasTransform() {
        const t = this.canvasTransform;
        return t.translateX !== 0 || t.translateY !== 0 || 
               t.scaleX !== 1 || t.scaleY !== 1 || t.rotation !== 0;
    }
    
    /**
     * 変形適用（順変換）
     */
    applyTransform(x, y) {
        const t = this.canvasTransform;
        
        // 🔧 Phase1.5: 基本的な平行移動・拡縮のみ（回転はPhase2）
        let transformedX = (x * t.scaleX) + t.translateX;
        let transformedY = (y * t.scaleY) + t.translateY;
        
        // 回転処理（Phase2で完全実装・Phase1.5は基本のみ）
        if (t.rotation !== 0) {
            const cos = Math.cos(t.rotation);
            const sin = Math.sin(t.rotation);
            const rotatedX = transformedX * cos - transformedY * sin;
            const rotatedY = transformedX * sin + transformedY * cos;
            transformedX = rotatedX;
            transformedY = rotatedY;
        }
        
        return { x: transformedX, y: transformedY };
    }
    
    /**
     * 逆変形適用（逆変換）
     */
    applyInverseTransform(x, y) {
        const t = this.canvasTransform;
        
        let transformedX = x;
        let transformedY = y;
        
        // 逆回転（Phase2で完全実装）
        if (t.rotation !== 0) {
            const cos = Math.cos(-t.rotation);
            const sin = Math.sin(-t.rotation);
            const rotatedX = transformedX * cos - transformedY * sin;
            const rotatedY = transformedX * sin + transformedY * cos;
            transformedX = rotatedX;
            transformedY = rotatedY;
        }
        
        // 逆拡縮・逆平行移動
        transformedX = (transformedX - t.translateX) / t.scaleX;
        transformedY = (transformedY - t.translateY) / t.scaleY;
        
        return { x: transformedX, y: transformedY };
    }
    
    /**
     * 🔧 Phase1.5基本変形操作（NavigationManager連携用）
     */
    
    /**
     * 平行移動設定
     */
    setTranslation(deltaX, deltaY) {
        this.canvasTransform.translateX = this.adjustPrecision(deltaX);
        this.canvasTransform.translateY = this.adjustPrecision(deltaY);
        
        console.log(`📐 平行移動設定: (${deltaX.toFixed(1)}, ${deltaY.toFixed(1)})`);
    }
    
    /**
     * 拡縮設定
     */
    setScale(scaleX, scaleY = null) {
        if (scaleY === null) scaleY = scaleX; // 均等拡縮
        
        // 拡縮範囲制限（Phase1.5基本制限）
        const minScale = 0.1;
        const maxScale = 10.0;
        
        this.canvasTransform.scaleX = Math.max(minScale, Math.min(maxScale, scaleX));
        this.canvasTransform.scaleY = Math.max(minScale, Math.min(maxScale, scaleY));
        
        console.log(`📐 拡縮設定: (${this.canvasTransform.scaleX.toFixed(2)}, ${this.canvasTransform.scaleY.toFixed(2)})`);
    }
    
    /**
     * 回転設定（Phase1.5基本・Phase2で拡張）
     */
    setRotation(angle) {
        // 角度正規化（0-2π）
        this.canvasTransform.rotation = angle % (2 * Math.PI);
        
        console.log(`📐 回転設定: ${(this.canvasTransform.rotation * 180 / Math.PI).toFixed(1)}度`);
    }
    
    /**
     * 変形状態取得
     */
    getCanvasTransform() {
        return { ...this.canvasTransform };
    }
    
    /**
     * 変形リセット
     */
    resetTransform() {
        this.canvasTransform = {
            translateX: 0,
            translateY: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0
        };
        
        console.log('📐 変形リセット完了');
    }
    
    /**
     * 🎯 拡張描画エリア情報取得
     */
    getExtendedDrawArea() {
        const margin = this.extendedDrawMargin;
        
        return {
            left: -margin,
            top: -margin,
            right: this.canvasWidth + margin,
            bottom: this.canvasHeight + margin,
            width: this.canvasWidth + (margin * 2),
            height: this.canvasHeight + (margin * 2),
            margin: margin
        };
    }
    
    /**
     * キャンバス情報取得
     */
    getCanvasInfo() {
        return {
            width: this.canvasWidth,
            height: this.canvasHeight,
            element: this.canvasElement,
            hasElement: !!this.canvasElement
        };
    }
    
    /**
     * 設定取得・変更
     */
    getSettings() {
        return {
            extendedDrawMargin: this.extendedDrawMargin,
            coordinatePrecision: this.coordinatePrecision
        };
    }
    
    setExtendedDrawMargin(margin) {
        const minMargin = 0;
        const maxMargin = 100;
        this.extendedDrawMargin = Math.max(minMargin, Math.min(maxMargin, margin));
        
        console.log(`📐 拡張描画マージン設定: ${this.extendedDrawMargin}px`);
    }
    
    setCoordinatePrecision(precision) {
        const minPrecision = 0;
        const maxPrecision = 3;
        this.coordinatePrecision = Math.max(minPrecision, Math.min(maxPrecision, precision));
        
        console.log(`📐 座標精度設定: 小数点以下${this.coordinatePrecision}桁`);
    }
    
    /**
     * 統計・デバッグ情報取得
     */
    getStats() {
        return {
            transformCount: this.transformCount,
            outOfBoundsCount: this.outOfBoundsCount,
            outOfBoundsRatio: this.transformCount > 0 ? (this.outOfBoundsCount / this.transformCount) : 0,
            lastTransformInfo: this.lastTransformInfo
        };
    }
    
    /**
     * デバッグ情報取得（完全版）
     */
    getDebugInfo() {
        return {
            // 基本状態
            canvasSet: !!this.canvasElement,
            canvasInfo: this.getCanvasInfo(),
            
            // 座標変換設定
            settings: this.getSettings(),
            transform: this.getCanvasTransform(),
            hasTransform: this.hasTransform(),
            
            // 拡張描画エリア
            extendedArea: this.getExtendedDrawArea(),
            
            // 統計情報
            stats: this.getStats(),
            
            // パフォーマンス情報
            performance: {
                avgTransformsPerSecond: this.calculateTransformRate(),
                memoryUsage: this.estimateMemoryUsage()
            },
            
            // Phase情報
            phase: {
                current: '1.5',
                features: {
                    basicTransform: true,
                    extendedDrawArea: true,
                    coordinatePrecision: true,
                    advancedTransform: false  // Phase2で追加
                }
            }
        };
    }
    
    /**
     * パフォーマンス計算（デバッグ用）
     */
    calculateTransformRate() {
        // 簡易的な変換レート計算（実装省略・概算値）
        return this.transformCount > 0 ? Math.min(this.transformCount, 60) : 0;
    }
    
    estimateMemoryUsage() {
        // 簡易的なメモリ使用量推定（実装省略・概算値）
        const baseSize = 1024; // 基本サイズ
        const transformDataSize = 256; // 変形データサイズ
        const debugDataSize = this.lastTransformInfo ? 512 : 0;
        
        return baseSize + transformDataSize + debugDataSize;
    }
}

// Tegaki名前空間に登録
window.Tegaki.CoordinateManager = CoordinateManager;

console.log('📐 CoordinateManager Phase1.5 Loaded - キャンバス外描画・座標変換・変形基盤完成');
console.log('📐 coordinate-manager.js loaded - シンプル座標変換・AI管理最適化・剛直構造実現');