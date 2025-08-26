/**
 * 📐 CoordinateManager - キャンバス外描画対応座標変換システム（軽量版）
 * 📋 RESPONSIBILITY: 座標変換・キャンバス外描画判定・座標精度管理のみ
 * 🚫 PROHIBITION: 描画処理・UI操作・レイヤー管理・イベント処理・過度なデバッグログ
 * ✅ PERMISSION: 座標計算・境界判定・変換処理・必要最小限のログ
 * 
 * 📏 DESIGN_PRINCIPLE: シンプル座標変換・軽量実装・剛直構造・Rulebook準拠
 * 🔄 INTEGRATION: TegakiApplication・全ツール・NavigationManagerとの連携
 * 🎯 FEATURE: キャンバス外20px描画許可・正確な座標変換・クランプ処理
 * 
 * 🔧 使用メソッド一覧:
 * - HTMLElement: getBoundingClientRect (DOM座標取得)
 * - Math: round, max, min, pow, cos, sin (数値計算)
 * - console: log, warn, error (必要最小限ログ)
 * - typeof, isNaN: 型チェック・NaN判定
 * 
 * 🔄 処理フロー:
 * 1. Canvas要素設定 → 座標情報初期化 → サイズ取得
 * 2. 座標変換要求 → DOM Rect取得 → 基本変換計算
 * 3. 変形適用 → 精度調整 → 範囲判定
 * 4. 結果返却 → エラーチェック（必要最小限ログ）
 * 
 * 🔗 依存Manager: なし（独立動作）
 * 📦 連携Tool: AbstractTool, PenTool, EraserTool, NavigationManager
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * CoordinateManager - キャンバス外描画対応座標変換システム（軽量版）
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
        
        // 統計情報（軽量版）
        this.transformCount = 0;
        this.nanCount = 0;
        
        console.log('✅ CoordinateManager初期化完了');
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
        // 入力値検証（NaN対策）
        if (isNaN(screenX) || isNaN(screenY)) {
            console.error('❌ CoordinateManager: Input NaN detected');
            this.nanCount++;
            return { x: 0, y: 0, isValid: false, error: 'input_nan' };
        }
        
        if (!this.canvasElement) {
            console.warn('⚠️ CoordinateManager: Canvas element not set');
            return { x: screenX, y: screenY, isValid: false, error: 'no_canvas_element' };
        }
        
        this.transformCount++;
        
        // 基本座標変換（DOMからキャンバス内部座標）
        const rect = this.canvasElement.getBoundingClientRect();
        
        if (!rect || isNaN(rect.left) || isNaN(rect.top)) {
            console.error('❌ CoordinateManager: Invalid canvas rect');
            return { x: 0, y: 0, isValid: false, error: 'invalid_rect' };
        }
        
        let canvasX = screenX - rect.left;
        let canvasY = screenY - rect.top;
        
        // 中間計算結果検証（NaN対策）
        if (isNaN(canvasX) || isNaN(canvasY)) {
            console.error('❌ CoordinateManager: NaN in basic transform');
            this.nanCount++;
            return { x: 0, y: 0, isValid: false, error: 'basic_transform_nan' };
        }
        
        // Phase1.5: シンプル変形対応
        if (this.hasTransform()) {
            const transformed = this.applyInverseTransform(canvasX, canvasY);
            
            if (isNaN(transformed.x) || isNaN(transformed.y)) {
                console.error('❌ CoordinateManager: NaN in transform');
                this.nanCount++;
                return { x: 0, y: 0, isValid: false, error: 'transform_nan' };
            }
            
            canvasX = transformed.x;
            canvasY = transformed.y;
        }
        
        // 座標精度調整
        const preciseX = this.adjustPrecision(canvasX);
        const preciseY = this.adjustPrecision(canvasY);
        
        if (isNaN(preciseX) || isNaN(preciseY)) {
            console.error('❌ CoordinateManager: NaN in precision adjustment');
            this.nanCount++;
            return { x: 0, y: 0, isValid: false, error: 'precision_nan' };
        }
        
        // キャンバス内外判定
        const isInsideCanvas = this.isInsideCanvas(preciseX, preciseY);
        const isInExtendedArea = this.isInExtendedDrawArea(preciseX, preciseY);
        
        const result = {
            x: preciseX,
            y: preciseY,
            isValid: true,
            isInsideCanvas: isInsideCanvas,
            isInExtendedArea: isInExtendedArea,
            canDraw: isInExtendedArea
        };
        
        // 最終結果検証（NaN対策）
        if (isNaN(result.x) || isNaN(result.y)) {
            console.error('❌ CoordinateManager: Final result contains NaN');
            this.nanCount++;
            return { x: 0, y: 0, isValid: false, error: 'final_result_nan' };
        }
        
        return result;
    }
    
    /**
     * 🎯 クライアント座標→キャンバス座標変換（AbstractTool互換性メソッド）
     */
    clientToCanvas(clientX, clientY) {
        return this.screenToCanvas(clientX, clientY);
    }
    
    /**
     * 🎯 PointerEvent座標→キャンバス座標変換（AbstractTool互換性メソッド）
     */
    pointerToCanvas(pointerEvent) {
        if (!pointerEvent || typeof pointerEvent.clientX !== 'number' || typeof pointerEvent.clientY !== 'number') {
            console.error('❌ CoordinateManager: Invalid PointerEvent');
            return { x: 0, y: 0, isValid: false, error: 'invalid_event' };
        }
        
        return this.screenToCanvas(pointerEvent.clientX, pointerEvent.clientY);
    }
    
    /**
     * 🎯 座標変換（AbstractTool互換性メソッド・複数形式対応）
     */
    toCanvasCoords(eventOrX, y) {
        if (typeof eventOrX === 'object' && eventOrX !== null && eventOrX.clientX !== undefined) {
            // PointerEvent形式
            return this.pointerToCanvas(eventOrX);
        } else if (typeof eventOrX === 'number' && typeof y === 'number') {
            // (x, y) 座標形式
            return this.screenToCanvas(eventOrX, y);
        } else {
            console.error('❌ CoordinateManager: Invalid toCanvasCoords arguments');
            return { x: 0, y: 0, isValid: false, error: 'invalid_arguments' };
        }
    }
    
    /**
     * 🎯 キャンバス座標→スクリーン座標変換（逆変換）
     */
    canvasToScreen(canvasX, canvasY) {
        if (isNaN(canvasX) || isNaN(canvasY)) {
            console.error('❌ CoordinateManager: Input NaN in canvasToScreen');
            return { x: 0, y: 0, isValid: false, error: 'input_nan' };
        }
        
        if (!this.canvasElement) {
            console.warn('⚠️ CoordinateManager: Canvas element not set');
            return { x: canvasX, y: canvasY, isValid: false, error: 'no_canvas_element' };
        }
        
        let transformedX = canvasX;
        let transformedY = canvasY;
        
        if (this.hasTransform()) {
            const transformed = this.applyTransform(canvasX, canvasY);
            
            if (isNaN(transformed.x) || isNaN(transformed.y)) {
                console.error('❌ CoordinateManager: NaN in reverse transform');
                return { x: 0, y: 0, isValid: false, error: 'reverse_transform_nan' };
            }
            
            transformedX = transformed.x;
            transformedY = transformed.y;
        }
        
        const rect = this.canvasElement.getBoundingClientRect();
        
        if (!rect || isNaN(rect.left) || isNaN(rect.top)) {
            console.error('❌ CoordinateManager: Invalid rect in reverse transform');
            return { x: 0, y: 0, isValid: false, error: 'invalid_rect' };
        }
        
        const screenX = transformedX + rect.left;
        const screenY = transformedY + rect.top;
        
        if (isNaN(screenX) || isNaN(screenY)) {
            console.error('❌ CoordinateManager: NaN in final reverse transform result');
            return { x: 0, y: 0, isValid: false, error: 'final_reverse_nan' };
        }
        
        return {
            x: this.adjustPrecision(screenX),
            y: this.adjustPrecision(screenY),
            isValid: true
        };
    }
    
    /**
     * 🎯 キャンバス座標→クライアント座標変換（AbstractTool互換性メソッド）
     */
    canvasToClient(canvasX, canvasY) {
        return this.canvasToScreen(canvasX, canvasY);
    }
    
    /**
     * 🎯 描画可能エリアへのクランプ（キャンバス外描画対応）
     */
    clampToDrawableArea(x, y) {
        if (isNaN(x) || isNaN(y)) {
            console.error('❌ CoordinateManager: Input NaN in clampToDrawableArea');
            return { x: 0, y: 0, wasClamped: true, original: { x, y }, error: 'input_nan' };
        }
        
        const minX = -this.extendedDrawMargin;
        const maxX = this.canvasWidth + this.extendedDrawMargin;
        const minY = -this.extendedDrawMargin;
        const maxY = this.canvasHeight + this.extendedDrawMargin;
        
        const clampedX = Math.max(minX, Math.min(maxX, x));
        const clampedY = Math.max(minY, Math.min(maxY, y));
        
        if (isNaN(clampedX) || isNaN(clampedY)) {
            console.error('❌ CoordinateManager: NaN in clamp result');
            return { x: 0, y: 0, wasClamped: true, original: { x, y }, error: 'clamp_nan' };
        }
        
        const wasClamped = (clampedX !== x || clampedY !== y);
        
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
        if (isNaN(x) || isNaN(y)) return false;
        return x >= 0 && x <= this.canvasWidth && y >= 0 && y <= this.canvasHeight;
    }
    
    /**
     * 拡張描画エリア判定（キャンバス外描画許可範囲）
     */
    isInExtendedDrawArea(x, y) {
        if (isNaN(x) || isNaN(y)) return false;
        const margin = this.extendedDrawMargin;
        return x >= -margin && x <= this.canvasWidth + margin && 
               y >= -margin && y <= this.canvasHeight + margin;
    }
    
    /**
     * 座標精度調整（NaN対策）
     */
    adjustPrecision(coordinate) {
        if (typeof coordinate !== 'number' || isNaN(coordinate)) {
            return 0;
        }
        
        const factor = Math.pow(10, this.coordinatePrecision);
        const result = Math.round(coordinate * factor) / factor;
        
        return isNaN(result) ? 0 : result;
    }
    
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
        if (isNaN(x) || isNaN(y)) {
            return { x: 0, y: 0 };
        }
        
        const t = this.canvasTransform;
        
        if (isNaN(t.scaleX) || isNaN(t.scaleY) || isNaN(t.translateX) || isNaN(t.translateY) || isNaN(t.rotation)) {
            return { x: 0, y: 0 };
        }
        
        let transformedX = (x * t.scaleX) + t.translateX;
        let transformedY = (y * t.scaleY) + t.translateY;
        
        if (isNaN(transformedX) || isNaN(transformedY)) {
            return { x: 0, y: 0 };
        }
        
        // 回転処理（Phase1.5基本）
        if (t.rotation !== 0) {
            const cos = Math.cos(t.rotation);
            const sin = Math.sin(t.rotation);
            
            if (!isNaN(cos) && !isNaN(sin)) {
                const rotatedX = transformedX * cos - transformedY * sin;
                const rotatedY = transformedX * sin + transformedY * cos;
                
                if (!isNaN(rotatedX) && !isNaN(rotatedY)) {
                    transformedX = rotatedX;
                    transformedY = rotatedY;
                }
            }
        }
        
        return { x: transformedX, y: transformedY };
    }
    
    /**
     * 逆変形適用（逆変換）
     */
    applyInverseTransform(x, y) {
        if (isNaN(x) || isNaN(y)) {
            return { x: 0, y: 0 };
        }
        
        const t = this.canvasTransform;
        
        if (isNaN(t.scaleX) || isNaN(t.scaleY) || isNaN(t.translateX) || isNaN(t.translateY) || isNaN(t.rotation)) {
            return { x: 0, y: 0 };
        }
        
        let transformedX = x;
        let transformedY = y;
        
        // 逆回転
        if (t.rotation !== 0) {
            const cos = Math.cos(-t.rotation);
            const sin = Math.sin(-t.rotation);
            
            if (!isNaN(cos) && !isNaN(sin)) {
                const rotatedX = transformedX * cos - transformedY * sin;
                const rotatedY = transformedX * sin + transformedY * cos;
                
                if (!isNaN(rotatedX) && !isNaN(rotatedY)) {
                    transformedX = rotatedX;
                    transformedY = rotatedY;
                }
            }
        }
        
        // 逆拡縮・逆平行移動（ゼロ除算対策）
        if (t.scaleX === 0 || t.scaleY === 0) {
            return { x: 0, y: 0 };
        }
        
        transformedX = (transformedX - t.translateX) / t.scaleX;
        transformedY = (transformedY - t.translateY) / t.scaleY;
        
        if (isNaN(transformedX) || isNaN(transformedY)) {
            return { x: 0, y: 0 };
        }
        
        return { x: transformedX, y: transformedY };
    }
    
    /**
     * 平行移動設定
     */
    setTranslation(deltaX, deltaY) {
        if (isNaN(deltaX) || isNaN(deltaY)) {
            console.error('❌ CoordinateManager: NaN in setTranslation');
            return;
        }
        
        this.canvasTransform.translateX = this.adjustPrecision(deltaX);
        this.canvasTransform.translateY = this.adjustPrecision(deltaY);
        
        console.log(`📐 平行移動設定: (${deltaX.toFixed(1)}, ${deltaY.toFixed(1)})`);
    }
    
    /**
     * 拡縮設定
     */
    setScale(scaleX, scaleY = null) {
        if (isNaN(scaleX)) {
            console.error('❌ CoordinateManager: NaN in setScale');
            return;
        }
        
        if (scaleY === null) scaleY = scaleX;
        if (isNaN(scaleY)) return;
        
        const minScale = 0.1;
        const maxScale = 10.0;
        
        this.canvasTransform.scaleX = Math.max(minScale, Math.min(maxScale, scaleX));
        this.canvasTransform.scaleY = Math.max(minScale, Math.min(maxScale, scaleY));
        
        console.log(`📐 拡縮設定: (${this.canvasTransform.scaleX.toFixed(2)}, ${this.canvasTransform.scaleY.toFixed(2)})`);
    }
    
    /**
     * 回転設定
     */
    setRotation(angle) {
        if (isNaN(angle)) {
            console.error('❌ CoordinateManager: NaN in setRotation');
            return;
        }
        
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
     * 拡張描画エリア情報取得
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
     * 統計情報取得
     */
    getStats() {
        return {
            transformCount: this.transformCount,
            nanCount: this.nanCount,
            nanRatio: this.transformCount > 0 ? (this.nanCount / this.transformCount) : 0
        };
    }
    
    /**
     * デバッグ情報取得（軽量版）
     */
    getDebugInfo() {
        return {
            canvasSet: !!this.canvasElement,
            canvasInfo: this.getCanvasInfo(),
            transform: this.getCanvasTransform(),
            hasTransform: this.hasTransform(),
            extendedArea: this.getExtendedDrawArea(),
            stats: this.getStats(),
            phase: {
                current: '1.5',
                features: {
                    basicTransform: true,
                    extendedDrawArea: true,
                    coordinatePrecision: true,
                    nanProtection: true,
                    advancedTransform: false
                }
            }
        };
    }
}

// Tegaki名前空間に登録
window.Tegaki.CoordinateManager = CoordinateManager;

console.log('📐 CoordinateManager Phase1.5 Loaded（軽量版） - デバッグログ削減・Rulebook準拠・機能完全対応');
console.log('📐 coordinate-manager.js loaded - NaN対策・AbstractTool互換性・軽量実装完了');