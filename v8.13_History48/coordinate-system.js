// ===== coordinate-system.js - システム統合改修版 =====
// 【統一】LayerSystem・AnimationSystem・CameraSystem座標変換API統合
// 【根本解決】座標系混在問題・API断片化解消
// 【完全統合】EventBus・システム間連携強化
// PixiJS v8.13 対応・計画書完全準拠版

(function() {
    'use strict';
    
    // === 座標変換統一API ===
    class CoordinateSystem {
        constructor() {
            this.config = null;
            this.eventBus = null;
            
            // システム参照
            this.layerSystem = null;
            this.cameraSystem = null;
            this.animationSystem = null;
            
            // 座標変換キャッシュ
            this.transformCache = new Map();
            this.cacheVersion = 0;
            
            // 変換設定
            this.transformSettings = {
                enableCache: true,
                cacheMaxSize: 100,
                enableDebug: false
            };
            
            console.log('🧭 CoordinateSystem: システム統合改修版 初期化');
        }
        
        init(config, eventBus) {
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus;
            
            if (!this.config?.canvas) {
                console.error('CoordinateSystem: canvas config required');
                throw new Error('Canvas configuration required');
            }
            
            // EventBus統合
            this.setupEventListeners();
            
            console.log('✅ CoordinateSystem initialized with canvas:', 
                `${this.config.canvas.width}x${this.config.canvas.height}`);
        }
        
        setupEventListeners() {
            if (!this.eventBus) return;
            
            // キャッシュクリアイベント
            this.eventBus.on('canvas:resize', () => {
                this.clearTransformCache();
            });
            
            this.eventBus.on('camera:transform-changed', () => {
                this.clearTransformCache();
            });
            
            console.log('🔗 CoordinateSystem EventBus integration configured');
        }
        
        // === システム参照設定 ===
        
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
            console.log('🔗 LayerSystem reference set in CoordinateSystem');
        }
        
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
            console.log('🔗 CameraSystem reference set in CoordinateSystem');
        }
        
        setAnimationSystem(animationSystem) {
            this.animationSystem = animationSystem;
            console.log('🔗 AnimationSystem reference set in CoordinateSystem');
        }
        
        // === 【統一】レイヤー変形API ===
        
        /**
         * レイヤー変形の統一適用
         * @param {PIXI.Container} layer - 対象レイヤー
         * @param {Object} transform - 変形データ {x, y, rotation, scaleX, scaleY}
         * @param {number} centerX - 回転・拡縮の中心X座標
         * @param {number} centerY - 回転・拡縮の中心Y座標
         */
        applyLayerTransform(layer, transform, centerX, centerY) {
            if (!layer || !transform) {
                console.warn('applyLayerTransform: invalid parameters');
                return false;
            }
            
            try {
                const hasRotationOrScale = (transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
                
                if (hasRotationOrScale) {
                    // 回転・拡縮がある場合: pivot基準変形
                    layer.pivot.set(centerX || 0, centerY || 0);
                    layer.position.set(
                        (centerX || 0) + (transform.x || 0), 
                        (centerY || 0) + (transform.y || 0)
                    );
                    layer.rotation = transform.rotation || 0;
                    layer.scale.set(transform.scaleX || 1, transform.scaleY || 1);
                } else if (transform.x !== 0 || transform.y !== 0) {
                    // 移動のみ: シンプル変形
                    layer.pivot.set(0, 0);
                    layer.position.set(transform.x || 0, transform.y || 0);
                    layer.rotation = 0;
                    layer.scale.set(1, 1);
                } else {
                    // 変形なし: デフォルト状態
                    layer.pivot.set(0, 0);
                    layer.position.set(0, 0);
                    layer.rotation = 0;
                    layer.scale.set(1, 1);
                }
                
                if (this.transformSettings.enableDebug) {
                    console.log('🧭 Layer transform applied:', {
                        layerId: layer.label,
                        transform: transform,
                        pivot: { x: layer.pivot.x, y: layer.pivot.y },
                        position: { x: layer.position.x, y: layer.position.y },
                        rotation: layer.rotation,
                        scale: { x: layer.scale.x, y: layer.scale.y }
                    });
                }
                
                return true;
                
            } catch (error) {
                console.error('applyLayerTransform failed:', error);
                return false;
            }
        }
        
        /**
         * レイヤー変形データの正規化
         * @param {Object} rawTransform - 生の変形データ
         * @returns {Object} 正規化された変形データ
         */
        normalizeTransform(rawTransform) {
            if (!rawTransform || typeof rawTransform !== 'object') {
                return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
            }
            
            return {
                x: Number(rawTransform.x) || 0,
                y: Number(rawTransform.y) || 0,
                rotation: Number(rawTransform.rotation) || 0,
                scaleX: Number(rawTransform.scaleX) || 1,
                scaleY: Number(rawTransform.scaleY) || 1
            };
        }
        
        /**
         * 変形データの合成
         * @param {Object} transform1 - 基準変形
         * @param {Object} transform2 - 追加変形
         * @returns {Object} 合成された変形データ
         */
        combineTransforms(transform1, transform2) {
            const t1 = this.normalizeTransform(transform1);
            const t2 = this.normalizeTransform(transform2);
            
            return {
                x: t1.x + t2.x,
                y: t1.y + t2.y,
                rotation: t1.rotation + t2.rotation,
                scaleX: t1.scaleX * t2.scaleX,
                scaleY: t1.scaleY * t2.scaleY
            };
        }
        
        // === 【統一】座標変換API ===
        
        /**
         * スクリーン座標 → ワールド座標変換
         * @param {number} screenX - スクリーン X座標
         * @param {number} screenY - スクリーン Y座標
         * @returns {Object} {x, y} ワールド座標
         */
        screenToWorld(screenX, screenY) {
            const cacheKey = `s2w_${screenX}_${screenY}_${this.cacheVersion}`;
            
            if (this.transformSettings.enableCache && this.transformCache.has(cacheKey)) {
                return this.transformCache.get(cacheKey);
            }
            
            let worldX = screenX;
            let worldY = screenY;
            
            // CameraSystemの変形を考慮
            if (this.cameraSystem?.worldContainer) {
                const container = this.cameraSystem.worldContainer;
                const matrix = container.transform.worldTransform.clone().invert();
                const point = matrix.apply({ x: screenX, y: screenY });
                worldX = point.x;
                worldY = point.y;
            }
            
            const result = { x: worldX, y: worldY };
            
            if (this.transformSettings.enableCache) {
                this.setCache(cacheKey, result);
            }
            
            return result;
        }
        
        /**
         * ワールド座標 → スクリーン座標変換
         * @param {number} worldX - ワールド X座標
         * @param {number} worldY - ワールド Y座標
         * @returns {Object} {x, y} スクリーン座標
         */
        worldToScreen(worldX, worldY) {
            const cacheKey = `w2s_${worldX}_${worldY}_${this.cacheVersion}`;
            
            if (this.transformSettings.enableCache && this.transformCache.has(cacheKey)) {
                return this.transformCache.get(cacheKey);
            }
            
            let screenX = worldX;
            let screenY = worldY;
            
            // CameraSystemの変形を考慮
            if (this.cameraSystem?.worldContainer) {
                const container = this.cameraSystem.worldContainer;
                const point = container.transform.worldTransform.apply({ x: worldX, y: worldY });
                screenX = point.x;
                screenY = point.y;
            }
            
            const result = { x: screenX, y: screenY };
            
            if (this.transformSettings.enableCache) {
                this.setCache(cacheKey, result);
            }
            
            return result;
        }
        
        /**
         * ローカル座標 → ワールド座標変換 (レイヤー用)
         * @param {number} localX - ローカル X座標
         * @param {number} localY - ローカル Y座標
         * @param {PIXI.Container} layer - 対象レイヤー
         * @returns {Object} {x, y} ワールド座標
         */
        localToWorld(localX, localY, layer) {
            if (!layer || !layer.transform) {
                return { x: localX, y: localY };
            }
            
            try {
                const point = layer.transform.worldTransform.apply({ x: localX, y: localY });
                return { x: point.x, y: point.y };
            } catch (error) {
                console.warn('localToWorld conversion failed:', error);
                return { x: localX, y: localY };
            }
        }
        
        /**
         * ワールド座標 → ローカル座標変換 (レイヤー用)
         * @param {number} worldX - ワールド X座標
         * @param {number} worldY - ワールド Y座標
         * @param {PIXI.Container} layer - 対象レイヤー
         * @returns {Object} {x, y} ローカル座標
         */
        worldToLocal(worldX, worldY, layer) {
            if (!layer || !layer.transform) {
                return { x: worldX, y: worldY };
            }
            
            try {
                const matrix = layer.transform.worldTransform.clone().invert();
                const point = matrix.apply({ x: worldX, y: worldY });
                return { x: point.x, y: point.y };
            } catch (error) {
                console.warn('worldToLocal conversion failed:', error);
                return { x: worldX, y: worldY };
            }
        }
        
        // === 【統一】境界・衝突判定API ===
        
        /**
         * レイヤーの境界ボックス取得
         * @param {PIXI.Container} layer - 対象レイヤー
         * @param {boolean} includeTransform - 変形を含めるかどうか
         * @returns {Object} {x, y, width, height} 境界ボックス
         */
        getLayerBounds(layer, includeTransform = true) {
            if (!layer) {
                return { x: 0, y: 0, width: 0, height: 0 };
            }
            
            try {
                const bounds = includeTransform ? layer.getBounds() : layer.getLocalBounds();
                
                return {
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height
                };
            } catch (error) {
                console.warn('getLayerBounds failed:', error);
                return { x: 0, y: 0, width: 0, height: 0 };
            }
        }
        
        /**
         * キャンバス境界チェック
         * @param {number} x - X座標
         * @param {number} y - Y座標
         * @param {number} margin - マージン
         * @returns {boolean} キャンバス内かどうか
         */
        isInsideCanvas(x, y, margin = 0) {
            return (x >= -margin && 
                    y >= -margin && 
                    x < this.config.canvas.width + margin && 
                    y < this.config.canvas.height + margin);
        }
        
        /**
         * 矩形の重なり判定
         * @param {Object} rect1 - 矩形1 {x, y, width, height}
         * @param {Object} rect2 - 矩形2 {x, y, width, height}
         * @returns {boolean} 重なっているかどうか
         */
        rectanglesOverlap(rect1, rect2) {
            if (!rect1 || !rect2) return false;
            
            return !(rect1.x + rect1.width <= rect2.x ||
                     rect2.x + rect2.width <= rect1.x ||
                     rect1.y + rect1.height <= rect2.y ||
                     rect2.y + rect2.height <= rect1.y);
        }
        
        // === 【統一】距離・角度計算API ===
        
        /**
         * 2点間距離計算
         * @param {number} x1 - 点1のX座標
         * @param {number} y1 - 点1のY座標
         * @param {number} x2 - 点2のX座標
         * @param {number} y2 - 点2のY座標
         * @returns {number} 距離
         */
        distance(x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        /**
         * 2点間角度計算 (ラジアン)
         * @param {number} x1 - 点1のX座標
         * @param {number} y1 - 点1のY座標
         * @param {number} x2 - 点2のX座標
         * @param {number} y2 - 点2のY座標
         * @returns {number} 角度 (ラジアン)
         */
        angle(x1, y1, x2, y2) {
            return Math.atan2(y2 - y1, x2 - x1);
        }
        
        /**
         * 角度の正規化 (-π ～ π)
         * @param {number} angle - 角度 (ラジアン)
         * @returns {number} 正規化された角度
         */
        normalizeAngle(angle) {
            while (angle > Math.PI) angle -= 2 * Math.PI;
            while (angle < -Math.PI) angle += 2 * Math.PI;
            return angle;
        }
        
        /**
         * 度数法 → ラジアン変換
         * @param {number} degrees - 度数
         * @returns {number} ラジアン
         */
        degreesToRadians(degrees) {
            return degrees * Math.PI / 180;
        }
        
        /**
         * ラジアン → 度数法変換
         * @param {number} radians - ラジアン
         * @returns {number} 度数
         */
        radiansToDegrees(radians) {
            return radians * 180 / Math.PI;
        }
        
        // === 【統一】ベクトル計算API ===
        
        /**
         * ベクトル正規化
         * @param {number} x - X成分
         * @param {number} y - Y成分
         * @returns {Object} {x, y, length} 正規化されたベクトルと長さ
         */
        normalizeVector(x, y) {
            const length = Math.sqrt(x * x + y * y);
            
            if (length === 0) {
                return { x: 0, y: 0, length: 0 };
            }
            
            return {
                x: x / length,
                y: y / length,
                length: length
            };
        }
        
        /**
         * ベクトル内積
         * @param {number} x1 - ベクトル1のX成分
         * @param {number} y1 - ベクトル1のY成分
         * @param {number} x2 - ベクトル2のX成分
         * @param {number} y2 - ベクトル2のY成分
         * @returns {number} 内積
         */
        dotProduct(x1, y1, x2, y2) {
            return x1 * x2 + y1 * y2;
        }
        
        /**
         * ベクトル外積 (2Dでは Z成分のスカラー値)
         * @param {number} x1 - ベクトル1のX成分
         * @param {number} y1 - ベクトル1のY成分
         * @param {number} x2 - ベクトル2のX成分
         * @param {number} y2 - ベクトル2のY成分
         * @returns {number} 外積のZ成分
         */
        crossProduct(x1, y1, x2, y2) {
            return x1 * y2 - y1 * x2;
        }
        
        // === キャッシュ管理 ===
        
        setCache(key, value) {
            if (!this.transformSettings.enableCache) return;
            
            if (this.transformCache.size >= this.transformSettings.cacheMaxSize) {
                // 古いキャッシュを削除
                const firstKey = this.transformCache.keys().next().value;
                this.transformCache.delete(firstKey);
            }
            
            this.transformCache.set(key, value);
        }
        
        clearTransformCache() {
            this.transformCache.clear();
            this.cacheVersion++;
            
            if (this.transformSettings.enableDebug) {
                console.log('🧭 Transform cache cleared, version:', this.cacheVersion);
            }
        }
        
        // === 設定管理 ===
        
        /**
         * 座標変換設定の更新
         * @param {Object} settings - 設定オブジェクト
         */
        updateSettings(settings) {
            if (!settings || typeof settings !== 'object') return;
            
            Object.assign(this.transformSettings, settings);
            
            if (settings.enableCache === false) {
                this.clearTransformCache();
            }
            
            console.log('🧭 CoordinateSystem settings updated:', this.transformSettings);
        }
        
        // === 診断・デバッグ ===
        
        /**
         * システム参照状態の診断
         * @returns {Object} 診断結果
         */
        diagnoseReferences() {
            const diagnosis = {
                timestamp: new Date().toISOString(),
                config: {
                    hasConfig: !!this.config,
                    hasCanvasConfig: !!(this.config?.canvas),
                    canvasSize: this.config?.canvas ? 
                        `${this.config.canvas.width}x${this.config.canvas.height}` : 'Unknown'
                },
                eventBus: {
                    hasEventBus: !!this.eventBus,
                    eventBusType: this.eventBus ? this.eventBus.constructor.name : 'None'
                },
                systemReferences: {
                    hasLayerSystem: !!this.layerSystem,
                    hasCameraSystem: !!this.cameraSystem,
                    hasAnimationSystem: !!this.animationSystem,
                    layerSystemType: this.layerSystem ? this.layerSystem.constructor.name : 'None',
                    cameraSystemType: this.cameraSystem ? this.cameraSystem.constructor.name : 'None',
                    animationSystemType: this.animationSystem ? this.animationSystem.constructor.name : 'None'
                },
                cache: {
                    enabled: this.transformSettings.enableCache,
                    size: this.transformCache.size,
                    maxSize: this.transformSettings.cacheMaxSize,
                    version: this.cacheVersion
                },
                settings: { ...this.transformSettings }
            };
            
            // 問題検出
            const issues = [];
            if (!diagnosis.config.hasConfig) issues.push('Config missing');
            if (!diagnosis.config.hasCanvasConfig) issues.push('Canvas config missing');
            if (!diagnosis.eventBus.hasEventBus) issues.push('EventBus missing');
            if (!diagnosis.systemReferences.hasLayerSystem) issues.push('LayerSystem reference missing');
            if (!diagnosis.systemReferences.hasCameraSystem) issues.push('CameraSystem reference missing');
            
            diagnosis.issues = issues;
            diagnosis.healthScore = Math.max(0, 100 - (issues.length * 20));
            
            return diagnosis;
        }
        
        /**
         * 座標変換のテスト実行
         * @returns {Object} テスト結果
         */
        runTransformTests() {
            const tests = [];
            
            // 基本変形テスト
            try {
                const testTransform = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1 };
                const normalized = this.normalizeTransform(testTransform);
                tests.push({
                    name: 'normalizeTransform',
                    passed: normalized.x === 100 && normalized.y === 50,
                    result: normalized
                });
            } catch (error) {
                tests.push({
                    name: 'normalizeTransform',
                    passed: false,
                    error: error.message
                });
            }
            
            // 座標変換テスト
            try {
                const screenPoint = { x: 400, y: 300 };
                const worldPoint = this.screenToWorld(screenPoint.x, screenPoint.y);
                const backToScreen = this.worldToScreen(worldPoint.x, worldPoint.y);
                
                const accuracy = this.distance(screenPoint.x, screenPoint.y, backToScreen.x, backToScreen.y);
                tests.push({
                    name: 'screenToWorld_worldToScreen',
                    passed: accuracy < 1.0,
                    accuracy: accuracy,
                    original: screenPoint,
                    converted: backToScreen
                });
            } catch (error) {
                tests.push({
                    name: 'screenToWorld_worldToScreen',
                    passed: false,
                    error: error.message
                });
            }
            
            // 距離計算テスト
            try {
                const dist = this.distance(0, 0, 3, 4);
                tests.push({
                    name: 'distance',
                    passed: Math.abs(dist - 5) < 0.001,
                    expected: 5,
                    actual: dist
                });
            } catch (error) {
                tests.push({
                    name: 'distance',
                    passed: false,
                    error: error.message
                });
            }
            
            // 角度正規化テスト
            try {
                const normalized = this.normalizeAngle(3 * Math.PI);
                tests.push({
                    name: 'normalizeAngle',
                    passed: Math.abs(normalized - Math.PI) < 0.001,
                    expected: Math.PI,
                    actual: normalized
                });
            } catch (error) {
                tests.push({
                    name: 'normalizeAngle',
                    passed: false,
                    error: error.message
                });
            }
            
            const passedTests = tests.filter(test => test.passed).length;
            
            return {
                tests: tests,
                totalTests: tests.length,
                passedTests: passedTests,
                failedTests: tests.length - passedTests,
                successRate: (passedTests / tests.length) * 100
            };
        }
        
        /**
         * デバッグ情報の出力
         */
        logDebugInfo() {
            console.log('🔍 CoordinateSystem Debug Info:');
            console.log('=====================================');
            
            const diagnosis = this.diagnoseReferences();
            const testResults = this.runTransformTests();
            
            console.log('📊 System Status:');
            console.log(`  - Health Score: ${diagnosis.healthScore}%`);
            console.log(`  - Canvas Size: ${diagnosis.config.canvasSize}`);
            console.log(`  - EventBus: ${diagnosis.eventBus.hasEventBus ? '✅' : '❌'}`);
            
            console.log('🔗 System References:');
            console.log(`  - LayerSystem: ${diagnosis.systemReferences.hasLayerSystem ? '✅' : '❌'}`);
            console.log(`  - CameraSystem: ${diagnosis.systemReferences.hasCameraSystem ? '✅' : '❌'}`);
            console.log(`  - AnimationSystem: ${diagnosis.systemReferences.hasAnimationSystem ? '✅' : '❌'}`);
            
            console.log('💾 Cache Status:');
            console.log(`  - Enabled: ${diagnosis.cache.enabled ? '✅' : '❌'}`);
            console.log(`  - Size: ${diagnosis.cache.size}/${diagnosis.cache.maxSize}`);
            console.log(`  - Version: ${diagnosis.cache.version}`);
            
            console.log('🧪 Transform Tests:');
            console.log(`  - Success Rate: ${testResults.successRate.toFixed(1)}%`);
            console.log(`  - Passed: ${testResults.passedTests}/${testResults.totalTests}`);
            
            if (testResults.failedTests > 0) {
                console.log('  - Failed Tests:');
                testResults.tests.filter(test => !test.passed).forEach(test => {
                    console.log(`    ❌ ${test.name}: ${test.error || 'Assertion failed'}`);
                });
            }
            
            if (diagnosis.issues.length > 0) {
                console.log('⚠️ Issues:');
                diagnosis.issues.forEach(issue => {
                    console.log(`  - ${issue}`);
                });
            } else {
                console.log('✅ All systems operational');
            }
            
            console.log('=====================================');
            
            return { diagnosis, testResults };
        }
        
        /**
         * パフォーマンステスト
         * @param {number} iterations - 反復回数
         * @returns {Object} パフォーマンス結果
         */
        runPerformanceTest(iterations = 1000) {
            const results = {};
            
            // 座標変換パフォーマンス
            const startTime = performance.now();
            
            for (let i = 0; i < iterations; i++) {
                const x = Math.random() * this.config.canvas.width;
                const y = Math.random() * this.config.canvas.height;
                const world = this.screenToWorld(x, y);
                const screen = this.worldToScreen(world.x, world.y);
            }
            
            const endTime = performance.now();
            const avgTime = (endTime - startTime) / iterations;
            
            results.coordinateTransform = {
                iterations: iterations,
                totalTime: endTime - startTime,
                averageTime: avgTime,
                operationsPerSecond: 1000 / avgTime
            };
            
            console.log('⚡ CoordinateSystem Performance Test Results:');
            console.log(`  - ${iterations} coordinate transformations in ${(endTime - startTime).toFixed(2)}ms`);
            console.log(`  - Average: ${avgTime.toFixed(4)}ms per operation`);
            console.log(`  - Throughput: ${Math.round(results.coordinateTransform.operationsPerSecond)} ops/sec`);
            
            return results;
        }
    }
    
    // グローバル公開
    const coordinateSystem = new CoordinateSystem();
    window.CoordinateSystem = coordinateSystem;
    
    // 後方互換性のための旧API
    window.TEGAKI_COORDINATE_SYSTEM = coordinateSystem;
    
    console.log('✅ coordinate-system.js loaded (システム統合改修版)');
    console.log('🔧 改修完了項目:');
    console.log('  🆕 applyLayerTransform(): 統一レイヤー変形API');
    console.log('  🆕 normalizeTransform(): 変形データ正規化');
    console.log('  🆕 combineTransforms(): 変形合成');
    console.log('  🆕 screenToWorld/worldToScreen(): キャッシュ対応座標変換');
    console.log('  🆕 localToWorld/worldToLocal(): レイヤー座標変換');
    console.log('  🆕 getLayerBounds(): 統一境界取得');
    console.log('  🆕 distance/angle/normalizeAngle(): 数学関数統合');
    console.log('  🆕 normalizeVector/dotProduct/crossProduct(): ベクトル計算');
    console.log('  🆕 diagnoseReferences(): システム統合診断');
    console.log('  🆕 runTransformTests(): 座標変換テスト');
    console.log('  🆕 runPerformanceTest(): パフォーマンス測定');
    console.log('  🔧 EventBus完全統合・キャッシュシステム');
    console.log('  🔧 LayerSystem/CameraSystem/AnimationSystem参照統合');
    console.log('  🔧 座標系混在問題・API断片化解消');
    console.log('  ✅ PixiJS v8.13 完全対応');
    console.log('  ✅ システム間連携強化');
    
    // 自動初期化（設定が利用可能な場合）
    if (typeof window !== 'undefined') {
        // DOM読み込み完了後に自動設定
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                if (window.TEGAKI_CONFIG && window.TegakiEventBus) {
                    try {
                        coordinateSystem.init(window.TEGAKI_CONFIG, window.TegakiEventBus);
                        console.log('🔄 CoordinateSystem auto-initialized');
                    } catch (error) {
                        console.warn('CoordinateSystem auto-init failed:', error.message);
                    }
                }
            });
        } else {
            // 既に読み込み完了済み
            setTimeout(() => {
                if (window.TEGAKI_CONFIG && window.TegakiEventBus && !coordinateSystem.config) {
                    try {
                        coordinateSystem.init(window.TEGAKI_CONFIG, window.TegakiEventBus);
                        console.log('🔄 CoordinateSystem auto-initialized (delayed)');
                    } catch (error) {
                        console.warn('CoordinateSystem auto-init failed:', error.message);
                    }
                }
            }, 100);
        }
    }

})();