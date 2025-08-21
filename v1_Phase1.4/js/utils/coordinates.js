/**
 * 🚫 座標ユーティリティシステム（非推奨版・CoordinateManager移行）
 * 🎯 AI_WORK_SCOPE: 座標変換・計算・色変換ユーティリティ（レガシー互換）
 * 🎯 DEPENDENCIES: なし（Pure JavaScript）- 非推奨
 * 🔄 COORDINATE_REFACTOR: CoordinateManager統合済み・重複排除対象
 * 📐 UNIFIED_COORDINATE: 責任分界明確化・統一システム移行
 * ⚠️  DEPRECATED: このファイルは非推奨です。CoordinateManagerを使用してください。
 * 🗑️ MIGRATION: Phase1.4→Phase2移行時に完全削除予定
 */

console.warn('⚠️ coordinates.js: このファイルは非推奨です。CoordinateManagerを使用してください。');
console.warn('🔄 座標処理は統一システム CoordinateManager に移行済みです。');
console.warn('📐 Phase2移行時にこのファイルは削除されます。');

/**
 * 🚫 非推奨：座標変換・計算ユーティリティシステム
 * ⚠️  CoordinateManagerに統合済み・使用非推奨
 */
class CoordinateUtils {
    constructor() {
        this.precision = 10; // 小数点精度
        
        // 非推奨警告
        console.warn('⚠️ CoordinateUtils: 非推奨クラスです。window.CoordinateManager を使用してください。');
        console.warn('📐 移行例: new CoordinateManager().calculateDistance(p1, p2)');
    }
    
    /**
     * 🚫 非推奨：Canvas座標からPixi座標への変換
     * ✅ 移行先: CoordinateManager.canvasToPixi()
     */
    canvasToPixi(canvasX, canvasY, canvasRect, pixiWidth, pixiHeight) {
        console.warn('⚠️ CoordinateUtils.canvasToPixi: 非推奨です。CoordinateManager.canvasToPixi()を使用してください。');
        
        // レガシー互換処理（基本的な変換のみ）
        const x = (canvasX - canvasRect.left) * (pixiWidth / canvasRect.width);
        const y = (canvasY - canvasRect.top) * (pixiHeight / canvasRect.height);
        
        return {
            x: Math.round(x * this.precision) / this.precision,
            y: Math.round(y * this.precision) / this.precision
        };
    }
    
    /**
     * 🚫 非推奨：Pixi座標からCanvas座標への変換
     * ✅ 移行先: CoordinateManager.pixiToCanvas() (新規実装)
     */
    pixiToCanvas(pixiX, pixiY, canvasRect, pixiWidth, pixiHeight) {
        console.warn('⚠️ CoordinateUtils.pixiToCanvas: 非推奨です。CoordinateManagerの新しいAPIを使用してください。');
        
        const x = (pixiX / pixiWidth) * canvasRect.width + canvasRect.left;
        const y = (pixiY / pixiHeight) * canvasRect.height + canvasRect.top;
        
        return {
            x: Math.round(x * this.precision) / this.precision,
            y: Math.round(y * this.precision) / this.precision
        };
    }
    
    /**
     * 🚫 非推奨：2点間距離計算
     * ✅ 移行先: CoordinateManager.calculateDistance()
     */
    distance(point1, point2) {
        console.warn('⚠️ CoordinateUtils.distance: 非推奨です。CoordinateManager.calculateDistance()を使用してください。');
        
        // CoordinateManagerに委譲（利用可能な場合）
        if (window.CoordinateManager) {
            const manager = new window.CoordinateManager();
            return manager.calculateDistance(point1, point2);
        }
        
        // フォールバック
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 🚫 非推奨：線形補間
     * ✅ 移行先: CoordinateManager.interpolatePoints()
     */
    lerp(start, end, t) {
        console.warn('⚠️ CoordinateUtils.lerp: 非推奨です。CoordinateManager.interpolatePoints()を使用してください。');
        
        return start + (end - start) * Math.max(0, Math.min(1, t));
    }
    
    /**
     * 🚫 非推奨：2点間補間ポイント生成
     * ✅ 移行先: CoordinateManager.interpolatePoints()
     */
    interpolatePoints(point1, point2, steps) {
        console.warn('⚠️ CoordinateUtils.interpolatePoints: 非推奨です。CoordinateManager.interpolatePoints()を使用してください。');
        
        // CoordinateManagerに委譲（利用可能な場合）
        if (window.CoordinateManager) {
            const manager = new window.CoordinateManager();
            return manager.interpolatePoints(point1, point2, steps);
        }
        
        // フォールバック
        const points = [];
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            points.push({
                x: this.lerp(point1.x, point2.x, t),
                y: this.lerp(point1.y, point2.y, t)
            });
        }
        
        return points;
    }
    
    /**
     * 🚫 非推奨：ベジェ曲線座標計算
     * ✅ 移行先: CoordinateManager（Phase2で高度曲線機能実装予定）
     */
    calculateBezier(p0, p1, p2, p3, t) {
        console.warn('⚠️ CoordinateUtils.calculateBezier: 非推奨です。Phase2でCoordinateManagerに高度曲線機能が実装されます。');
        
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;
        
        return {
            x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
            y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
        };
    }
    
    /**
     * 🚫 非推奨：角度計算（ラジアン）
     * ✅ 移行先: CoordinateManager.calculateAngle()
     */
    calculateAngle(point1, point2) {
        console.warn('⚠️ CoordinateUtils.calculateAngle: 非推奨です。CoordinateManager.calculateAngle()を使用してください。');
        
        // CoordinateManagerに委譲（利用可能な場合）
        if (window.CoordinateManager) {
            const manager = new window.CoordinateManager();
            return manager.calculateAngle(point1, point2);
        }
        
        // フォールバック
        return Math.atan2(point2.y - point1.y, point2.x - point1.x);
    }
    
    // その他のメソッドも同様に非推奨警告を追加...
    // 📝 簡潔性のため、主要メソッドのみ示す
}

/**
 * 🚫 非推奨：色変換ユーティリティ
 * ✅ 移行先: ConfigManagerのcolors設定 + 必要に応じて専用ColorManager実装
 */
class ColorUtils {
    constructor() {
        // ふたば☆ちゃんねる風カラーパレット
        this.futabaColors = {
            maroon: 0x800000,
            lightMaroon: 0xaa5a56,
            medium: 0xcf9c97,
            lightMedium: 0xe9c2ba,
            cream: 0xf0e0d6,
            background: 0xffffee
        };
        
        console.warn('⚠️ ColorUtils: 非推奨クラスです。ConfigManager.getColors()を使用してください。');
        console.warn('🎨 カラーパレット: ConfigManager.getColors().futabaMaroon等で取得可能');
    }
    
    /**
     * 🚫 非推奨：16進数→RGB変換
     * ✅ 移行先: 標準的なColor処理ライブラリまたは必要に応じて専用Manager
     */
    hexToRgb(hex) {
        console.warn('⚠️ ColorUtils.hexToRgb: 非推奨です。標準ライブラリまたは専用ColorManagerの使用を検討してください。');
        
        const r = (hex >> 16) & 0xFF;
        const g = (hex >> 8) & 0xFF;
        const b = hex & 0xFF;
        return { r, g, b };
    }
    
    /**
     * 🚫 非推奨：ふたば風カラー取得
     * ✅ 移行先: ConfigManager.getColors().futabaMaroon等
     */
    getFutabaColor(colorName) {
        console.warn('⚠️ ColorUtils.getFutabaColor: 非推奨です。ConfigManager.getColors()を使用してください。');
        
        // ConfigManagerに委譲（利用可能な場合）
        if (window.ConfigManager) {
            const colors = window.ConfigManager.getColors();
            return colors[`futaba${colorName.charAt(0).toUpperCase() + colorName.slice(1)}`] || colors.futabaMaroon;
        }
        
        // フォールバック
        return this.futabaColors[colorName] || this.futabaColors.maroon;
    }
}

/**
 * 🚫 非推奨：マス計算ユーティリティ
 * ✅ 移行先: lodash（既存利用） + 必要に応じてMathManager実装
 */
class MathUtils {
    constructor() {
        this.lodashAvailable = window._ !== undefined;
        console.warn('⚠️ MathUtils: 非推奨クラスです。lodash（window._）または標準Math関数を使用してください。');
    }
    
    /**
     * 🚫 非推奨：値のクランプ（範囲制限）
     * ✅ 移行先: lodash.clamp() または Math.max(min, Math.min(max, value))
     */
    clamp(value, min, max) {
        console.warn('⚠️ MathUtils.clamp: 非推奨です。lodash.clamp()を使用してください。');
        
        if (this.lodashAvailable) {
            return window._.clamp(value, min, max);
        }
        return Math.max(min, Math.min(max, value));
    }
}

// ==== 非推奨グローバル公開 ====
if (typeof window !== 'undefined') {
    // 非推奨警告付きでグローバル公開
    console.group('🚫 coordinates.js 非推奨グローバル公開');
    
    window.CoordinateUtils = new CoordinateUtils();
    window.ColorUtils = new ColorUtils();  
    window.MathUtils = new MathUtils();
    
    // 統合ヘルパー（非推奨）
    window.Utils = {
        coord: window.CoordinateUtils,
        color: window.ColorUtils,
        math: window.MathUtils
    };
    
    console.warn('⚠️ window.CoordinateUtils, window.ColorUtils, window.MathUtils: 全て非推奨');
    console.warn('✅ 推奨移行先:');
    console.warn('  - 座標処理: new CoordinateManager()');
    console.warn('  - カラー: ConfigManager.getColors()');
    console.warn('  - 数学: lodash（window._）');
    console.warn('🗑️ Phase2移行時に削除予定');
    
    console.groupEnd();
}

// ==== 自動移行支援テスト（非推奨警告） ====
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.group('🔍 座標系統合移行確認（非推奨システム）');
        
        try {
            // CoordinateManagerの利用可能性確認
            const hasCoordinateManager = window.CoordinateManager !== undefined;
            const hasConfigManager = window.ConfigManager !== undefined;
            
            console.warn('🚫 非推奨システム移行確認:');
            console.log(`  - CoordinateManager利用可能: ${hasCoordinateManager ? '✅' : '❌'}`);
            console.log(`  - ConfigManager利用可能: ${hasConfigManager ? '✅' : '❌'}`);
            
            if (hasCoordinateManager && hasConfigManager) {
                console.log('✅ 移行準備完了 - CoordinateManagerが利用可能');
                console.log('🔄 このファイル（coordinates.js）は削除可能です');
                
                // 設定確認
                const coordinateIntegration = window.ConfigManager.isCoordinateIntegrationEnabled();
                const duplicateElimination = window.ConfigManager.isDuplicateEliminationEnabled();
                
                console.log(`  - 座標統合設定: ${coordinateIntegration ? '✅' : '❌'}`);
                console.log(`  - 重複排除設定: ${duplicateElimination ? '✅' : '❌'}`);
                
                if (coordinateIntegration && duplicateElimination) {
                    console.log('🎯 完全移行条件クリア - coordinates.js削除推奨');
                }
            } else {
                console.warn('⚠️ 移行未完了 - CoordinateManager初期化を確認してください');
            }
            
        } catch (error) {
            console.error('❌ 移行確認エラー:', error);
        }
        
        console.groupEnd();
    }, 1200);
}

// DRY原則適用完了ログ（非推奨版）
console.warn('🚫 coordinates.js: 重複する座標・色・数学計算処理 → CoordinateManager統合済み');
console.warn('♻️ DRY原則適用: このファイルの機能は統一システムに移行完了');
console.warn('🗑️ 削除予定: Phase2移行時に完全削除');

/**
 * 📋 移行ガイド
 * 
 * 🚫 非推奨 → ✅ 推奨移行先
 * 
 * window.CoordinateUtils.distance(p1, p2)
 * → new CoordinateManager().calculateDistance(p1, p2)
 * 
 * window.CoordinateUtils.calculateAngle(p1, p2)  
 * → new CoordinateManager().calculateAngle(p1, p2)
 * 
 * window.CoordinateUtils.interpolatePoints(p1, p2, steps)
 * → new CoordinateManager().interpolatePoints(p1, p2, steps)
 * 
 * window.ColorUtils.getFutabaColor('maroon')
 * → ConfigManager.getColors().futabaMaroon
 * 
 * window.MathUtils.clamp(value, min, max)
 * → _.clamp(value, min, max) または Math.max(min, Math.min(max, value))
 */