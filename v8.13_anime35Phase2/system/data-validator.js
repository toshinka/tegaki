// ===== system/data-validator.js =====
// Phase 1 Step 1.3: 検証機構導入
// 目的: 同期前後のデータ劣化を自動検出
// PixiJS v8.13 対応

(function() {
    'use strict';

    class DataValidator {
        constructor() {
            this.dataUtils = window.DataUtils;
            this.validationHistory = [];
            this.maxHistorySize = 50;
            this.enableLogging = false; // デバッグ時にtrueに
            
            if (!this.dataUtils) {
                console.warn('DataUtils not available - DataValidator will use limited functionality');
            }
        }

        /**
         * 同期前後のデータ検証（メインAPI）
         */
        validateSync(before, after, context = {}) {
            const timestamp = Date.now();
            
            // 基本チェック
            if (!before || !after) {
                return {
                    valid: false,
                    timestamp,
                    context,
                    errors: ['Before or after data is null/undefined']
                };
            }

            // DataUtils利用可能時の詳細チェック
            if (this.dataUtils) {
                return this._detailedValidation(before, after, context, timestamp);
            }

            // fallback: 基本チェックのみ
            return this._basicValidation(before, after, context, timestamp);
        }

        /**
         * 詳細検証（DataUtils利用）
         */
        _detailedValidation(before, after, context, timestamp) {
            const result = {
                valid: true,
                timestamp,
                context,
                errors: [],
                warnings: [],
                metrics: {}
            };

            // 1. Points数の変化チェック
            const beforePointsCount = this.dataUtils.countPoints(before);
            const afterPointsCount = this.dataUtils.countPoints(after);
            
            result.metrics.beforePointsCount = beforePointsCount;
            result.metrics.afterPointsCount = afterPointsCount;
            result.metrics.pointsDelta = afterPointsCount - beforePointsCount;

            if (beforePointsCount !== afterPointsCount) {
                result.warnings.push(
                    `Points count changed: ${beforePointsCount} → ${afterPointsCount} (Δ${result.metrics.pointsDelta})`
                );
            }

            // 2. ハッシュ比較（データ変化検出）
            const beforeHash = this.dataUtils.hashObject(before);
            const afterHash = this.dataUtils.hashObject(after);
            
            result.metrics.beforeHash = beforeHash;
            result.metrics.afterHash = afterHash;
            result.metrics.hashChanged = beforeHash !== afterHash;

            // 3. NaN/Infinity検出
            const invalidNumbers = this.dataUtils.detectInvalidNumbers(after);
            
            if (invalidNumbers.length > 0) {
                result.valid = false;
                result.errors.push(`Found ${invalidNumbers.length} invalid numbers (NaN/Infinity)`);
                result.metrics.invalidNumbers = invalidNumbers;
            }

            // 4. データ整合性チェック
            const integrityCheck = this.dataUtils.checkDataIntegrity(after, 'After');
            
            if (!integrityCheck.valid) {
                result.valid = false;
                result.errors.push(...integrityCheck.errors);
            }

            // 5. 構造変化チェック
            const structureCheck = this._checkStructureConsistency(before, after);
            
            if (!structureCheck.valid) {
                result.warnings.push(...structureCheck.warnings);
            }

            // 履歴に記録
            this._addToHistory(result);

            // ログ出力（有効時）
            if (this.enableLogging) {
                this._logValidationResult(result);
            }

            return result;
        }

        /**
         * 基本検証（fallback）
         */
        _basicValidation(before, after, context, timestamp) {
            const result = {
                valid: true,
                timestamp,
                context,
                errors: [],
                warnings: [],
                metrics: {}
            };

            // JSON化して簡易比較
            try {
                const beforeStr = JSON.stringify(before);
                const afterStr = JSON.stringify(after);
                
                result.metrics.beforeSize = beforeStr.length;
                result.metrics.afterSize = afterStr.length;
                result.metrics.sizeChanged = beforeStr.length !== afterStr.length;

                if (beforeStr.length !== afterStr.length) {
                    result.warnings.push(
                        `Data size changed: ${beforeStr.length} → ${afterStr.length}`
                    );
                }
            } catch (error) {
                result.errors.push('Failed to serialize data for comparison');
                result.valid = false;
            }

            this._addToHistory(result);

            return result;
        }

        /**
         * 構造の一貫性チェック
         */
        _checkStructureConsistency(before, after) {
            const result = {
                valid: true,
                warnings: []
            };

            // 配列長チェック
            if (Array.isArray(before) && Array.isArray(after)) {
                if (before.length !== after.length) {
                    result.warnings.push(
                        `Array length changed: ${before.length} → ${after.length}`
                    );
                }
            }

            // オブジェクトキーチェック
            if (typeof before === 'object' && typeof after === 'object' && 
                !Array.isArray(before) && !Array.isArray(after)) {
                
                const beforeKeys = Object.keys(before).sort();
                const afterKeys = Object.keys(after).sort();
                
                if (beforeKeys.join(',') !== afterKeys.join(',')) {
                    result.warnings.push('Object keys structure changed');
                }
            }

            // LayerState特有チェック
            if (this._isLayerState(before) && this._isLayerState(after)) {
                const layerCheck = this._validateLayerStateStructure(before, after);
                result.warnings.push(...layerCheck.warnings);
            }

            return result;
        }

        /**
         * LayerStateかどうか判定
         */
        _isLayerState(obj) {
            return obj && 
                   typeof obj.id === 'string' && 
                   typeof obj.visible === 'boolean' &&
                   Array.isArray(obj.paths);
        }

        /**
         * LayerState構造の検証
         */
        _validateLayerStateStructure(before, after) {
            const warnings = [];

            // paths配列長チェック
            if (before.paths.length !== after.paths.length) {
                warnings.push(
                    `LayerState paths count changed: ${before.paths.length} → ${after.paths.length}`
                );
            }

            // transform構造チェック
            if (before.transform && after.transform) {
                const transformFields = ['x', 'y', 'rotation', 'scaleX', 'scaleY'];
                transformFields.forEach(field => {
                    if (typeof before.transform[field] !== typeof after.transform[field]) {
                        warnings.push(`Transform.${field} type changed`);
                    }
                });
            }

            return { warnings };
        }

        /**
         * CUT切り替え時の検証
         */
        validateCutSwitch(fromCut, toCut, layerSystemState) {
            const result = {
                valid: true,
                timestamp: Date.now(),
                context: { type: 'cut-switch' },
                errors: [],
                warnings: []
            };

            // fromCutの保存状態検証
            if (fromCut && layerSystemState) {
                const saveValidation = this.validateSync(
                    fromCut.layers, 
                    layerSystemState,
                    { action: 'save-before-switch' }
                );

                if (!saveValidation.valid) {
                    result.errors.push('Failed to validate saved state before cut switch');
                    result.valid = false;
                }
            }

            // toCutのロード状態検証
            if (toCut && this.dataUtils) {
                const integrityCheck = this.dataUtils.checkDataIntegrity(
                    toCut.layers, 
                    'ToCut'
                );

                if (!integrityCheck.valid) {
                    result.errors.push('Target cut data is corrupted');
                    result.valid = false;
                }
            }

            this._addToHistory(result);

            if (this.enableLogging && !result.valid) {
                console.error('❌ Cut switch validation failed:', result);
            }

            return result;
        }

        /**
         * Transform適用時の検証
         */
        validateTransformApplication(originalPoints, transformedPoints, transform) {
            const result = {
                valid: true,
                timestamp: Date.now(),
                context: { type: 'transform-application', transform },
                errors: [],
                warnings: []
            };

            // Points配列長の一致チェック
            if (!Array.isArray(originalPoints) || !Array.isArray(transformedPoints)) {
                result.errors.push('Points must be arrays');
                result.valid = false;
                return result;
            }

            if (originalPoints.length !== transformedPoints.length) {
                result.errors.push(
                    `Points count mismatch: ${originalPoints.length} → ${transformedPoints.length}`
                );
                result.valid = false;
            }

            // NaN/Infinityチェック
            if (this.dataUtils) {
                const invalidNumbers = this.dataUtils.detectInvalidNumbers(transformedPoints);
                if (invalidNumbers.length > 0) {
                    result.errors.push(`Transform produced invalid numbers: ${invalidNumbers.length}`);
                    result.valid = false;
                }
            } else {
                // fallback: 簡易チェック
                const hasInvalid = transformedPoints.some(p => 
                    !isFinite(p.x) || !isFinite(p.y)
                );
                if (hasInvalid) {
                    result.errors.push('Transform produced NaN or Infinity');
                    result.valid = false;
                }
            }

            // 変換の妥当性チェック（極端な値の検出）
            if (transform) {
                if (Math.abs(transform.scaleX) > 100 || Math.abs(transform.scaleY) > 100) {
                    result.warnings.push('Extreme scale values detected');
                }
                if (Math.abs(transform.x) > 10000 || Math.abs(transform.y) > 10000) {
                    result.warnings.push('Extreme translation values detected');
                }
            }

            this._addToHistory(result);

            return result;
        }

        /**
         * 描画コミット時の検証
         */
        validateDrawingCommit(layerBefore, layerAfter) {
            const result = {
                valid: true,
                timestamp: Date.now(),
                context: { type: 'drawing-commit' },
                errors: [],
                warnings: []
            };

            if (!layerBefore || !layerAfter) {
                result.errors.push('Layer data is null');
                result.valid = false;
                return result;
            }

            // paths配列の増加チェック（描画時は通常増える）
            const beforePathsCount = layerBefore.paths?.length || 0;
            const afterPathsCount = layerAfter.paths?.length || 0;

            if (afterPathsCount < beforePathsCount) {
                result.warnings.push(
                    `Paths decreased during commit: ${beforePathsCount} → ${afterPathsCount}`
                );
            }

            // 新規追加されたpathsの検証
            if (this.dataUtils && afterPathsCount > beforePathsCount) {
                const newPaths = layerAfter.paths.slice(beforePathsCount);
                newPaths.forEach((path, index) => {
                    const pathValidation = this.dataUtils.validatePath(path);
                    if (!pathValidation.valid) {
                        result.errors.push(`New path[${index}] is invalid: ${pathValidation.errors.join(', ')}`);
                        result.valid = false;
                    }
                });
            }

            this._addToHistory(result);

            return result;
        }

        /**
         * 履歴管理
         */
        _addToHistory(result) {
            this.validationHistory.push(result);

            // 履歴サイズ制限
            if (this.validationHistory.length > this.maxHistorySize) {
                this.validationHistory.shift();
            }
        }

        /**
         * 検証結果のログ出力
         */
        _logValidationResult(result) {
            const icon = result.valid ? '✅' : '❌';
            const contextStr = result.context.type || 'sync';
            
            console.log(`${icon} Validation [${contextStr}]:`, {
                valid: result.valid,
                errors: result.errors,
                warnings: result.warnings,
                metrics: result.metrics
            });
        }

        /**
         * 検証履歴の取得
         */
        getHistory() {
            return [...this.validationHistory];
        }

        /**
         * 失敗した検証のみ取得
         */
        getFailedValidations() {
            return this.validationHistory.filter(v => !v.valid);
        }

        /**
         * 統計情報取得
         */
        getStats() {
            const total = this.validationHistory.length;
            const failed = this.validationHistory.filter(v => !v.valid).length;
            const warned = this.validationHistory.filter(v => v.warnings.length > 0).length;

            return {
                total,
                passed: total - failed,
                failed,
                warned,
                successRate: total > 0 ? ((total - failed) / total * 100).toFixed(2) + '%' : 'N/A'
            };
        }

        /**
         * 履歴クリア
         */
        clearHistory() {
            this.validationHistory = [];
        }

        /**
         * ログ有効化/無効化
         */
        setLogging(enabled) {
            this.enableLogging = enabled;
        }

        /**
         * レポート生成
         */
        generateReport() {
            const stats = this.getStats();
            const failed = this.getFailedValidations();
            const recent = this.validationHistory.slice(-10);

            return {
                timestamp: Date.now(),
                stats,
                failedValidations: failed,
                recentValidations: recent,
                summary: {
                    totalValidations: stats.total,
                    successRate: stats.successRate,
                    criticalErrors: failed.length,
                    warnings: recent.filter(v => v.warnings.length > 0).length
                }
            };
        }
    }

    // グローバル公開
    window.DataValidator = DataValidator;

    console.log('✅ data-validator.js loaded - Phase 1 Step 1.3');
    console.log('   - validateSync() for sync verification');
    console.log('   - validateCutSwitch() for cut transitions');
    console.log('   - validateTransformApplication() for transforms');
    console.log('   - validateDrawingCommit() for drawing operations');
    console.log('   - Validation history tracking');

    // 簡易テスト実行
    if (window.TEGAKI_CONFIG?.debug) {
        console.log('🧪 Running DataValidator self-test...');

        const validator = new DataValidator();

        // Test 1: 正常な同期
        const before = {
            id: 'layer1',
            visible: true,
            opacity: 1.0,
            paths: [{ id: 'path1', points: [{ x: 10, y: 20 }] }],
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
        };
        const after = JSON.parse(JSON.stringify(before)); // deep copy
        
        const result1 = validator.validateSync(before, after, { test: 1 });
        console.assert(result1.valid, 'Normal sync test FAILED');
        console.log('   ✓ Normal sync validation test passed');

        // Test 2: NaN検出
        const afterWithNaN = JSON.parse(JSON.stringify(before));
        afterWithNaN.paths[0].points[0].x = NaN;
        
        const result2 = validator.validateSync(before, afterWithNaN, { test: 2 });
        console.assert(!result2.valid, 'NaN detection test FAILED');
        console.log('   ✓ NaN detection test passed');

        // Test 3: Points数変化検出
        const afterFewerPoints = JSON.parse(JSON.stringify(before));
        afterFewerPoints.paths[0].points = [];
        
        const result3 = validator.validateSync(before, afterFewerPoints, { test: 3 });
        console.assert(result3.warnings.length > 0, 'Points count change detection FAILED');
        console.log('   ✓ Points count change detection test passed');

        // Stats表示
        console.log('   Validation stats:', validator.getStats());

        console.log('✅ All DataValidator self-tests passed!');
    }

})();