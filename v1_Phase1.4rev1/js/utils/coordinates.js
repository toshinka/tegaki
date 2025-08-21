/**
 * 🗑️ 座標ユーティリティシステム（削除準備版・使用禁止）
 * 🎯 AI_WORK_SCOPE: 座標変換・計算・色変換ユーティリティ（削除対象）
 * 🎯 DEPENDENCIES: なし（Pure JavaScript）- 削除予定
 * 🔄 COORDINATE_REFACTOR: CoordinateManager統合完了・重複排除対象
 * 📐 UNIFIED_COORDINATE: 責任分界明確化・統一システム移行完了
 * ⚠️  DEPRECATED: このファイルは削除対象です。絶対に使用しないでください。
 * 🗑️ DELETION: Phase2移行時に完全削除予定
 * ❌ USAGE_PROHIBITED: 新規開発での使用を完全禁止
 */

// 🚨 削除警告（最重要）
console.error('🗑️ coordinates.js: このファイルは削除対象です！');
console.error('❌ 使用禁止: 新規開発では絶対に使用しないでください');
console.error('📋 Phase2移行時に完全削除されます');
console.error('✅ 移行先: CoordinateManager（統一座標システム）');

// 削除予告警告（1秒後）
setTimeout(() => {
    console.group('🚨 coordinates.js 削除予告');
    console.error('⚠️ このファイルは非推奨・削除予定です');
    console.error('🔄 全ての機能がCoordinateManagerに移行済み');
    console.error('📋 移行ガイド:');
    console.error('  - window.CoordinateUtils.distance() → new CoordinateManager().calculateDistance()');
    console.error('  - window.CoordinateUtils.calculateAngle() → new CoordinateManager().calculateAngle()');
    console.error('  - window.ColorUtils.getFutabaColor() → ConfigManager.getColors().futabaMaroon');
    console.error('🗑️ Phase2移行で完全削除');
    console.groupEnd();
}, 1000);

/**
 * 🗑️ 削除対象：座標変換・計算ユーティリティシステム
 * ❌ 使用禁止・CoordinateManagerに統合済み
 */
class CoordinateUtils {
    constructor() {
        // 🚨 削除警告
        const errorMessage = '🗑️ CoordinateUtils: 削除対象クラスです。CoordinateManagerを使用してください。';
        console.error(errorMessage);
        
        // 使用禁止エラー
        throw new Error('❌ CoordinateUtils使用禁止: CoordinateManagerに移行してください');
    }
    
    /**
     * 🗑️ 削除対象：Canvas座標からPixi座標への変換
     * ❌ 使用禁止 → CoordinateManager.canvasToPixi()
     */
    canvasToPixi(canvasX, canvasY, canvasRect, pixiWidth, pixiHeight) {
        throw new Error('🗑️ 削除対象メソッド: CoordinateManager.canvasToPixi()を使用してください');
    }
    
    /**
     * 🗑️ 削除対象：Pixi座標からCanvas座標への変換
     * ❌ 使用禁止 → CoordinateManager新規API
     */
    pixiToCanvas(pixiX, pixiY, canvasRect, pixiWidth, pixiHeight) {
        throw new Error('🗑️ 削除対象メソッド: CoordinateManagerの新しいAPIを使用してください');
    }
    
    /**
     * 🗑️ 削除対象：2点間距離計算
     * ❌ 使用禁止 → CoordinateManager.calculateDistance()
     */
    distance(point1, point2) {
        throw new Error('🗑️ 削除対象メソッド: CoordinateManager.calculateDistance()を使用してください');
    }
    
    /**
     * 🗑️ 削除対象：線形補間
     * ❌ 使用禁止 → CoordinateManager.interpolatePoints()
     */
    lerp(start, end, t) {
        throw new Error('🗑️ 削除対象メソッド: CoordinateManager.interpolatePoints()を使用してください');
    }
    
    /**
     * 🗑️ 削除対象：2点間補間ポイント生成
     * ❌ 使用禁止 → CoordinateManager.interpolatePoints()
     */
    interpolatePoints(point1, point2, steps) {
        throw new Error('🗑️ 削除対象メソッド: CoordinateManager.interpolatePoints()を使用してください');
    }
    
    /**
     * 🗑️ 削除対象：ベジェ曲線座標計算
     * ❌ 使用禁止 → Phase2でCoordinateManagerに高度曲線機能実装予定
     */
    calculateBezier(p0, p1, p2, p3, t) {
        throw new Error('🗑️ 削除対象メソッド: Phase2でCoordinateManagerに高度曲線機能が実装されます');
    }
    
    /**
     * 🗑️ 削除対象：角度計算（ラジアン）
     * ❌ 使用禁止 → CoordinateManager.calculateAngle()
     */
    calculateAngle(point1, point2) {
        throw new Error('🗑️ 削除対象メソッド: CoordinateManager.calculateAngle()を使用してください');
    }
}

/**
 * 🗑️ 削除対象：色変換ユーティリティ
 * ❌ 使用禁止 → ConfigManager.getColors()
 */
class ColorUtils {
    constructor() {
        console.error('🗑️ ColorUtils: 削除対象クラスです。ConfigManager.getColors()を使用してください');
        throw new Error('❌ ColorUtils使用禁止: ConfigManager.getColors()に移行してください');
    }
    
    /**
     * 🗑️ 削除対象：16進数→RGB変換
     * ❌ 使用禁止 → 標準ライブラリまたは専用ColorManager
     */
    hexToRgb(hex) {
        throw new Error('🗑️ 削除対象メソッド: 標準ライブラリまたは専用ColorManagerを使用してください');
    }
    
    /**
     * 🗑️ 削除対象：ふたば風カラー取得
     * ❌ 使用禁止 → ConfigManager.getColors().futabaMaroon等
     */
    getFutabaColor(colorName) {
        throw new Error('🗑️ 削除対象メソッド: ConfigManager.getColors()を使用してください');
    }
}

/**
 * 🗑️ 削除対象：数学計算ユーティリティ
 * ❌ 使用禁止 → lodash（既存利用）または標準Math関数
 */
class MathUtils {
    constructor() {
        console.error('🗑️ MathUtils: 削除対象クラスです。lodash（window._）または標準Math関数を使用してください');
        throw new Error('❌ MathUtils使用禁止: lodash（window._）に移行してください');
    }
    
    /**
     * 🗑️ 削除対象：値のクランプ（範囲制限）
     * ❌ 使用禁止 → lodash.clamp()またはMath.max/Math.min
     */
    clamp(value, min, max) {
        throw new Error('🗑️ 削除対象メソッド: lodash.clamp()を使用してください');
    }
}

// ==== 🚨 削除警告付きグローバル公開（使用時エラー） ====
if (typeof window !== 'undefined') {
    console.group('🗑️ coordinates.js 削除対象グローバル公開');
    
    // 使用時エラーを発生させるプロキシオブジェクト
    const createDeprecatedProxy = (className) => {
        return new Proxy({}, {
            get() {
                throw new Error(`🗑️ ${className}は削除対象です。統一システムに移行してください`);
            },
            set() {
                throw new Error(`🗑️ ${className}は削除対象です。設定できません`);
            }
        });
    };
    
    // エラー発生プロキシとして設定
    window.CoordinateUtils = createDeprecatedProxy('CoordinateUtils');
    window.ColorUtils = createDeprecatedProxy('ColorUtils');
    window.MathUtils = createDeprecatedProxy('MathUtils');
    
    // 統合ヘルパーも削除対象
    window.Utils = createDeprecatedProxy('Utils');
    
    console.error('🗑️ window.CoordinateUtils, window.ColorUtils, window.MathUtils: 全て削除対象');
    console.error('❌ 使用時エラー発生: 統一システムに移行必須');
    console.error('✅ 移行先:');
    console.error('  - 座標処理: new CoordinateManager()');
    console.error('  - カラー: ConfigManager.getColors()');
    console.error('  - 数学: lodash（window._）または標準Math関数');
    console.error('🗑️ Phase2移行時に完全削除');
    
    console.groupEnd();
}

// ==== 🔍 削除確認・移行支援システム ====
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.group('🔍 座標系削除確認・移行支援');
        
        try {
            // CoordinateManagerの利用可能性確認
            const hasCoordinateManager = window.CoordinateManager !== undefined;
            const hasConfigManager = window.ConfigManager !== undefined;
            
            console.log('🔍 移行状況確認:');
            console.log(`  - CoordinateManager利用可能: ${hasCoordinateManager ? '✅' : '❌'}`);
            console.log(`  - ConfigManager利用可能: ${hasConfigManager ? '✅' : '❌'}`);
            
            if (hasCoordinateManager && hasConfigManager) {
                console.log('✅ 移行準備完了 - CoordinateManagerが利用可能');
                console.log('🗑️ このファイル（coordinates.js）は削除可能です');
                
                // 設定確認
                if (hasConfigManager) {
                    const coordinateIntegration = window.ConfigManager.isCoordinateIntegrationEnabled();
                    const duplicateElimination = window.ConfigManager.isDuplicateEliminationEnabled();
                    
                    console.log(`  - 座標統合設定: ${coordinateIntegration ? '✅' : '❌'}`);
                    console.log(`  - 重複排除設定: ${duplicateElimination ? '✅' : '❌'}`);
                    
                    if (coordinateIntegration && duplicateElimination) {
                        console.log('🎯 完全移行条件クリア - coordinates.js削除推奨');
                        console.log('📋 削除手順:');
                        console.log('  1. 他ファイルでの参照確認');
                        console.log('  2. CoordinateManager動作確認');
                        console.log('  3. coordinates.js完全削除');
                    } else {
                        console.warn('⚠️ 設定未完了 - ConfigManagerで座標統合設定を有効にしてください');
                    }
                } else {
                    console.warn('⚠️ ConfigManager利用不可 - 統一システム初期化を確認してください');
                }
                
            } else {
                console.error('❌ 移行未完了 - CoordinateManager初期化を確認してください');
                console.log('🔧 修正方法:');
                console.log('  1. CoordinateManagerクラスの読み込み確認');
                console.log('  2. ConfigManagerの初期化確認');
                console.log('  3. 統一システムの依存関係確認');
            }
            
            // 削除テスト実行
            console.log('🧪 削除対象メソッドテスト:');
            
            const testMethods = [
                'CoordinateUtils',
                'ColorUtils', 
                'MathUtils'
            ];
            
            testMethods.forEach(methodName => {
                try {
                    // アクセス試行（エラーが発生すべき）
                    const obj = window[methodName];
                    console.log(`❌ ${methodName}: エラーが発生しませんでした（削除不完全）`);
                } catch (error) {
                    console.log(`✅ ${methodName}: 正常に削除エラー発生`);
                }
            });
            
        } catch (error) {
            console.error('❌ 削除確認エラー:', error);
        }
        
        console.groupEnd();
    }, 1500);
}

// ==== 📋 移行ガイド表示システム ====
if (typeof window !== 'undefined') {
    // 移行ガイド関数
    window.showCoordinatesMigrationGuide = function() {
        console.group('📋 coordinates.js → CoordinateManager 移行ガイド');
        
        console.log('🔄 メソッド移行対応表:');
        console.log('');
        console.log('🗑️ 削除対象 → ✅ 移行先');
        console.log('');
        console.log('【座標処理】');
        console.log('window.CoordinateUtils.distance(p1, p2)');
        console.log('→ new CoordinateManager().calculateDistance(p1, p2)');
        console.log('');
        console.log('window.CoordinateUtils.calculateAngle(p1, p2)');
        console.log('→ new CoordinateManager().calculateAngle(p1, p2)');
        console.log('');
        console.log('window.CoordinateUtils.interpolatePoints(p1, p2, steps)');
        console.log('→ new CoordinateManager().interpolatePoints(p1, p2, steps)');
        console.log('');
        console.log('window.CoordinateUtils.canvasToPixi(x, y, rect, w, h)');
        console.log('→ new CoordinateManager().canvasToPixi(x, y, pixiApp)');
        console.log('');
        console.log('【カラー処理】');
        console.log('window.ColorUtils.getFutabaColor("maroon")');
        console.log('→ ConfigManager.getColors().futabaMaroon');
        console.log('');
        console.log('【数学処理】');
        console.log('window.MathUtils.clamp(value, min, max)');
        console.log('→ _.clamp(value, min, max) または Math.max(min, Math.min(max, value))');
        console.log('');
        console.log('🎯 移行完了確認方法:');
        console.log('window.checkCoordinateIntegration() // 統合状況確認');
        console.log('window.runCoordinateIntegrationTests() // 機能テスト');
        console.log('');
        console.log('✅ 移行完了後の利点:');
        console.log('- 座標処理の統一化・高精度化');
        console.log('- パフォーマンス向上（キャッシュ・バッチ処理）');
        console.log('- Phase2レイヤーシステム対応');
        console.log('- エラー処理の統一化');
        
        console.groupEnd();
    };
    
    // 自動移行確認（3秒後）
    setTimeout(() => {
        console.log('💡 移行ガイド表示: window.showCoordinatesMigrationGuide()');
    }, 3000);
}

// DRY原則完全適用ログ（削除版）
console.error('🗑️ coordinates.js: 重複する座標・色・数学計算処理 → 完全削除対象');
console.error('♻️ DRY原則完全適用: 全機能が統一システムに移行完了');
console.error('🚨 使用禁止: 新規開発では絶対に使用しないこと');
console.error('🗑️ 削除予定: Phase2移行時に完全削除');

/**
 * 📋 完全移行ガイド・削除準備完了
 * 
 * 🗑️ 削除対象 → ✅ 移行先（完全版）
 * 
 * === 座標処理 ===
 * window.CoordinateUtils.distance(p1, p2)
 * → new CoordinateManager().calculateDistance(p1, p2)
 * 
 * window.CoordinateUtils.calculateAngle(p1, p2)
 * → new CoordinateManager().calculateAngle(p1, p2)
 * 
 * window.CoordinateUtils.interpolatePoints(p1, p2, steps)
 * → new CoordinateManager().interpolatePoints(p1, p2, steps)
 * 
 * window.CoordinateUtils.canvasToPixi(x, y, rect, w, h)
 * → new CoordinateManager().canvasToPixi(x, y, pixiApp)
 * 
 * window.CoordinateUtils.screenToCanvas(x, y, rect)
 * → new CoordinateManager().screenToCanvas(x, y, rect)
 * 
 * === カラー処理 ===
 * window.ColorUtils.getFutabaColor('maroon')
 * → ConfigManager.getColors().futabaMaroon
 * 
 * window.ColorUtils.hexToRgb(hex)
 * → 標準ライブラリまたは専用ColorManager（Phase2予定）
 * 
 * === 数学処理 ===
 * window.MathUtils.clamp(value, min, max)
 * → _.clamp(value, min, max) または Math.max(min, Math.min(max, value))
 * 
 * === 統合確認 ===
 * window.checkCoordinateIntegration() // 統合状況確認
 * window.runCoordinateIntegrationTests() // 機能テスト
 * window.showCoordinatesMigrationGuide() // 移行ガイド表示
 * 
 * === 削除条件 ===
 * ✅ CoordinateManager実装完了
 * ✅ ConfigManager座標設定完了
 * ✅ 統合テスト全PASS
 * ✅ 他ファイルでの参照なし
 * 
 * === 削除手順 ===
 * 1. 統合確認: window.checkCoordinateIntegration()
 * 2. テスト実行: window.runCoordinateIntegrationTests()
 * 3. 参照確認: プロジェクト全体検索
 * 4. coordinates.js完全削除
 * 
 * 🎯 Phase2移行時に自動削除予定
 */