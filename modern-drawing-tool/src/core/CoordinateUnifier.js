// 🎯 統一座標変換システム - Y軸問題完全解決の核心
// WebGL(上向きY軸) ↔ Canvas2D(下向きY軸) の完全統一

/**
 * 🚀 CoordinateUnifier - 座標系統一の最重要クラス
 * 
 * 【責務】
 * - WebGL座標系とCanvas2D座標系の完全統一
 * - Y軸問題の物理的根絶
 * - マウス入力座標の正規化
 * - 変換マトリックス管理
 * - 座標変換の一元管理
 */
export class CoordinateUnifier {
    constructor(canvasWidth, canvasHeight) {
        this.width = canvasWidth;
        this.height = canvasHeight;
        
        // 統一座標系設定（Canvas2D座標系に統一: 左上原点・Y軸下向き）
        this.coordinateSystem = {
            origin: 'top-left',      // 左上原点
            yDirection: 'down',      // Y軸下向き
            xDirection: 'right'      // X軸右向き
        };

        // WebGL投影マトリックス（Canvas2D座標系に合わせる）
        this.projectionMatrix = this.createUnifiedProjectionMatrix();
        
        // 変換カウンタ（デバッグ・性能監視用）
        this.transformCount = 0;
        
        // パン・ズーム・回転状態
        this.viewTransforms = {
            pan: { x: 0, y: 0 },
            zoom: 1.0,
            rotation: 0
        };

        console.log('🎯 CoordinateUnifier初期化:', {
            dimensions: { width: this.width, height: this.height },
            coordinateSystem: this.coordinateSystem
        });
    }

    /**
     * 📐 統一投影マトリックス作成（WebGLをCanvas2D座標系に統一）
     */
    createUnifiedProjectionMatrix() {
        // WebGLの正規化座標(-1,1)をCanvas2D座標系(0,width,height,0)に変換
        // 重要: bottomとtopを反転してY軸を下向きに統一
        return this.createOrthographicMatrix(
            0,           // left
            this.width,  // right  
            this.height, // bottom（Canvas2Dに合わせて下）
            0,           // top（Canvas2Dに合わせて上）
            -1,          // near
            1            // far
        );
    }

    /**
     * 📏 直交投影マトリックス作成
     */
    createOrthographicMatrix(left, right, bottom, top, near, far) {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);

        return new Float32Array([
            -2 * lr, 0, 0, 0,
            0, -2 * bt, 0, 0,
            0, 0, 2 * nf, 0,
            (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1
        ]);
    }

    /**
     * 🖱️ スクリーン座標 → 統一座標（そのまま通す）
     * スクリーン座標は既にCanvas2D座標系なので変換不要
     */
    screenToUnified(screenX, screenY) {
        this.transformCount++;
        
        // Canvas2D座標系をそのまま統一座標系として使用
        return {
            x: screenX,
            y: screenY
        };
    }

    /**
     * 🎮 統一座標 → WebGL正規化座標（Y軸問題解決変換）
     */
    unifiedToWebGL(unifiedX, unifiedY) {
        this.transformCount++;
        
        // Canvas2D座標系(0,width,0,height) → WebGL正規化座標(-1,1,-1,1)
        // Y軸反転でWebGLの上向きY軸に対応
        return {
            x: (unifiedX / this.width) * 2 - 1,       // 0→-1, width→1
            y: 1 - (unifiedY / this.height) * 2       // 0→1, height→-1（Y軸反転）
        };
    }

    /**
     * 🔄 WebGL正規化座標 → スクリーン座標（逆変換）
     */
    webglToScreen(webglX, webglY) {
        this.transformCount++;
        
        return {
            x: (webglX + 1) * this.width / 2,         // -1→0, 1→width
            y: (1 - webglY) * this.height / 2         // 1→0, -1→height（Y軸復元）
        };
    }

    /**
     * 📐 統一座標 → Canvas2D座標（そのまま通す）
     */
    unifiedToCanvas2D(unifiedX, unifiedY) {
        // 統一座標系はCanvas2D座標系なので変換不要
        return {
            x: unifiedX,
            y: unifiedY
        };
    }

    /**
     * 🔧 キャンバスサイズ更新
     */
    updateDimensions(newWidth, newHeight) {
        const oldDimensions = { width: this.width, height: this.height };
        
        this.width = newWidth;
        this.height = newHeight;
        
        // 投影マトリックス再生成
        this.projectionMatrix = this.createUnifiedProjectionMatrix();
        
        console.log('📏 座標系サイズ更新:', {
            old: oldDimensions,
            new: { width: this.width, height: this.height }
        });
    }

    /**
     * 🎯 投影マトリックス取得
     */
    getProjectionMatrix() {
        return this.projectionMatrix;
    }

    /**
     * 🌐 ビュー変換適用（パン・ズーム・回転）
     */
    applyTransform(transform) {
        if (transform.pan) {
            this.viewTransforms.pan.x += transform.pan.x;
            this.viewTransforms.pan.y += transform.pan.y;
        }
        
        if (transform.zoom) {
            this.viewTransforms.zoom *= transform.zoom;
            // ズーム制限
            this.viewTransforms.zoom = Math.max(0.1, Math.min(10, this.viewTransforms.zoom));
        }
        
        if (transform.rotation) {
            this.viewTransforms.rotation += transform.rotation;
        }

        // ビュー変換マトリックス更新
        this.updateViewMatrix();
    }

    /**
     * 🔄 ビュー変換マトリックス更新
     */
    updateViewMatrix() {
        // パン・ズーム・回転を統合したビューマトリックス作成
        const pan = this.viewTransforms.pan;
        const zoom = this.viewTransforms.zoom;
        const rotation = this.viewTransforms.rotation;

        // ビュー変換を統一座標系に適用
        this.viewMatrix = this.createViewMatrix(pan.x, pan.y, zoom, rotation);
    }

    /**
     * 📊 ビューマトリックス作成
     */
    createViewMatrix(panX, panY, zoom, rotation) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        return new Float32Array([
            zoom * cos, -zoom * sin, 0, 0,
            zoom * sin, zoom * cos, 0, 0,
            0, 0, 1, 0,
            panX, panY, 0, 1
        ]);
    }

    /**
     * 📍 点変換（ビュー変換適用）
     */
    transformPoint(point, matrix) {
        // 統一座標系での点変換
        const x = point.x * matrix[0] + point.y * matrix[4] + matrix[12];
        const y = point.x * matrix[1] + point.y * matrix[5] + matrix[13];
        
        return { x, y };
    }

    /**
     * 🎪 座標範囲チェック
     */
    isPointInBounds(x, y) {
        return x >= 0 && x <= this.width && y >= 0 && y <= this.height;
    }

    /**
     * 🔍 統一座標系検証
     */
    validateCoordinateUnity() {
        const testPoints = [
            { x: 0, y: 0 },                    // 左上
            { x: this.width, y: 0 },           // 右上
            { x: 0, y: this.height },          // 左下
            { x: this.width, y: this.height }, // 右下
            { x: this.width/2, y: this.height/2 } // 中央
        ];

        const results = testPoints.map(point => {
            const unified = this.screenToUnified(point.x, point.y);
            const webgl = this.unifiedToWebGL(unified.x, unified.y);
            const backToScreen = this.webglToScreen(webgl.x, webgl.y);
            
            const error = {
                x: Math.abs(point.x - backToScreen.x),
                y: Math.abs(point.y - backToScreen.y)
            };

            return {
                original: point,
                unified,
                webgl,
                backToScreen,
                error,
                isValid: error.x < 0.1 && error.y < 0.1
            };
        });

        const allValid = results.every(r => r.isValid);
        
        if (!allValid) {
            console.error('❌ 座標統一検証失敗:', results);
            return false;
        }

        console.log('✅ 座標統一検証成功:', results.length + '点検証完了');
        return true;
    }

    /**
     * 📈 変換回数取得（性能監視用）
     */
    getTransformCount() {
        return this.transformCount;
    }

    /**
     * 🔄 変換カウンタリセット
     */
    resetTransformCount() {
        this.transformCount = 0;
    }

    /**
     * 📊 座標系情報取得（デバッグ用）
     */
    getCoordinateSystemInfo() {
        return {
            dimensions: { width: this.width, height: this.height },
            coordinateSystem: this.coordinateSystem,
            viewTransforms: this.viewTransforms,
            transformCount: this.transformCount,
            projectionMatrix: Array.from(this.projectionMatrix)
        };
    }

    /**
     * 🎯 ビュー変換リセット
     */
    resetViewTransforms() {
        this.viewTransforms = {
            pan: { x: 0, y: 0 },
            zoom: 1.0,
            rotation: 0
        };
        this.updateViewMatrix();
        
        console.log('🔄 ビュー変換リセット完了');
    }

    /**
     * 📐 距離計算（統一座標系）
     */
    calculateDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 📏 角度計算（統一座標系）
     */
    calculateAngle(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.atan2(dy, dx);
    }

    /**
     * 🎪 矩形内判定（統一座標系）
     */
    isPointInRect(point, rect) {
        return point.x >= rect.x && 
               point.x <= rect.x + rect.width &&
               point.y >= rect.y && 
               point.y <= rect.y + rect.height;
    }

    /**
     * 🔧 デストラクタ（リソース解放）
     */
    destroy() {
        this.projectionMatrix = null;
        this.viewMatrix = null;
        this.viewTransforms = null;
        
        console.log('🗑️ CoordinateUnifier リソース解放完了');
    }
}
                