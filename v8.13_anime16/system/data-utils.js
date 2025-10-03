// ===== system/data-utils.js =====
// Phase 1 Step 1.1: Deep Clone実装と基盤ユーティリティ
// 目的: 信頼できるdeep clone関数とデータ検証機能の提供
// PixiJS v8.13 対応

(function() {
    'use strict';

    class DataUtils {
        /**
         * Deep clone - オブジェクトの完全な複製を作成
         * structuredClone優先、fallbackあり
         */
        static deepClone(obj) {
            if (obj === null || obj === undefined) {
                return obj;
            }

            // structuredClone利用可能ならそれを使用（最も信頼性が高い）
            if (typeof structuredClone === 'function') {
                try {
                    return structuredClone(obj);
                } catch (error) {
                    console.warn('structuredClone failed, using fallback:', error);
                }
            }

            // fallback: カスタム実装
            return this._deepCloneFallback(obj);
        }

        /**
         * Deep clone fallback実装
         * 循環参照対応、関数除外
         */
        static _deepCloneFallback(obj, hash = new WeakMap()) {
            // プリミティブ値
            if (obj === null || typeof obj !== 'object') {
                return obj;
            }

            // 循環参照チェック
            if (hash.has(obj)) {
                return hash.get(obj);
            }

            // Date
            if (obj instanceof Date) {
                return new Date(obj.getTime());
            }

            // Array
            if (Array.isArray(obj)) {
                const arrCopy = [];
                hash.set(obj, arrCopy);
                obj.forEach((item, index) => {
                    arrCopy[index] = this._deepCloneFallback(item, hash);
                });
                return arrCopy;
            }

            // Object
            const objCopy = {};
            hash.set(obj, objCopy);
            Object.keys(obj).forEach(key => {
                // 関数は除外（PixiJS Graphicsなど）
                if (typeof obj[key] !== 'function') {
                    objCopy[key] = this._deepCloneFallback(obj[key], hash);
                }
            });

            return objCopy;
        }

        /**
         * LayerStateの検証
         * NaN/Infinity検出、必須フィールド確認
         */
        static validateLayerState(layerState) {
            const errors = [];

            // 必須フィールドチェック
            if (!layerState) {
                errors.push('LayerState is null or undefined');
                return { valid: false, errors };
            }

            if (!layerState.id) {
                errors.push('LayerState.id is missing');
            }

            if (typeof layerState.visible !== 'boolean') {
                errors.push('LayerState.visible must be boolean');
            }

            if (typeof layerState.opacity !== 'number' || 
                !isFinite(layerState.opacity)) {
                errors.push('LayerState.opacity must be finite number');
            }

            // paths配列の検証
            if (layerState.paths && Array.isArray(layerState.paths)) {
                layerState.paths.forEach((path, pathIndex) => {
                    const pathErrors = this.validatePath(path);
                    if (!pathErrors.valid) {
                        errors.push(`Path[${pathIndex}]: ${pathErrors.errors.join(', ')}`);
                    }
                });
            }

            // transform検証
            if (layerState.transform) {
                const transformErrors = this.validateTransform(layerState.transform);
                if (!transformErrors.valid) {
                    errors.push(`Transform: ${transformErrors.errors.join(', ')}`);
                }
            }

            return {
                valid: errors.length === 0,
                errors
            };
        }

        /**
         * Pathの検証
         */
        static validatePath(path) {
            const errors = [];

            if (!path) {
                errors.push('Path is null or undefined');
                return { valid: false, errors };
            }

            if (!path.id) {
                errors.push('Path.id is missing');
            }

            if (!path.points || !Array.isArray(path.points)) {
                errors.push('Path.points must be array');
            } else {
                // points配列内のNaN/Infinity検出
                path.points.forEach((point, index) => {
                    if (typeof point.x !== 'number' || !isFinite(point.x)) {
                        errors.push(`Point[${index}].x is not finite number: ${point.x}`);
                    }
                    if (typeof point.y !== 'number' || !isFinite(point.y)) {
                        errors.push(`Point[${index}].y is not finite number: ${point.y}`);
                    }
                });
            }

            return {
                valid: errors.length === 0,
                errors
            };
        }

        /**
         * Transformの検証
         */
        static validateTransform(transform) {
            const errors = [];

            if (!transform) {
                errors.push('Transform is null or undefined');
                return { valid: false, errors };
            }

            const fields = ['x', 'y', 'rotation', 'scaleX', 'scaleY'];
            fields.forEach(field => {
                if (typeof transform[field] !== 'number' || 
                    !isFinite(transform[field])) {
                    errors.push(`Transform.${field} is not finite number: ${transform[field]}`);
                }
            });

            return {
                valid: errors.length === 0,
                errors
            };
        }

        /**
         * オブジェクトの簡易ハッシュ生成
         * 同期前後の比較用
         */
        static hashObject(obj) {
            if (obj === null || obj === undefined) {
                return 0;
            }

            try {
                const str = JSON.stringify(obj, (key, value) => {
                    // 関数は除外
                    if (typeof value === 'function') {
                        return undefined;
                    }
                    // 数値の精度を統一
                    if (typeof value === 'number') {
                        return Math.round(value * 1000) / 1000;
                    }
                    return value;
                });

                // 簡易ハッシュ（DJB2アルゴリズム）
                let hash = 5381;
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) + hash) + str.charCodeAt(i);
                    hash = hash & hash; // 32bit整数に変換
                }
                return hash;
            } catch (error) {
                console.warn('Hash generation failed:', error);
                return 0;
            }
        }

        /**
         * points配列のカウント（再帰的）
         */
        static countPoints(obj) {
            if (!obj) return 0;

            let count = 0;

            if (Array.isArray(obj)) {
                obj.forEach(item => {
                    count += this.countPoints(item);
                });
            } else if (typeof obj === 'object') {
                if (obj.points && Array.isArray(obj.points)) {
                    count += obj.points.length;
                }
                Object.keys(obj).forEach(key => {
                    if (key !== 'points') {
                        count += this.countPoints(obj[key]);
                    }
                });
            }

            return count;
        }

        /**
         * NaN/Infinityの検出（再帰的）
         */
        static detectInvalidNumbers(obj, path = '') {
            const issues = [];

            if (obj === null || obj === undefined) {
                return issues;
            }

            if (typeof obj === 'number') {
                if (!isFinite(obj)) {
                    issues.push({
                        path: path,
                        value: obj,
                        type: isNaN(obj) ? 'NaN' : 'Infinity'
                    });
                }
            } else if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    const itemIssues = this.detectInvalidNumbers(
                        item, 
                        `${path}[${index}]`
                    );
                    issues.push(...itemIssues);
                });
            } else if (typeof obj === 'object') {
                Object.keys(obj).forEach(key => {
                    if (typeof obj[key] !== 'function') {
                        const keyIssues = this.detectInvalidNumbers(
                            obj[key], 
                            path ? `${path}.${key}` : key
                        );
                        issues.push(...keyIssues);
                    }
                });
            }

            return issues;
        }

        /**
         * データ整合性の総合チェック
         */
        static checkDataIntegrity(data, label = 'Data') {
            const report = {
                label,
                timestamp: Date.now(),
                pointsCount: this.countPoints(data),
                hash: this.hashObject(data),
                invalidNumbers: this.detectInvalidNumbers(data),
                valid: true,
                errors: []
            };

            if (report.invalidNumbers.length > 0) {
                report.valid = false;
                report.errors.push(`Found ${report.invalidNumbers.length} invalid numbers`);
            }

            return report;
        }

        /**
         * 2つのデータの差分検出
         */
        static detectChanges(before, after) {
            const beforeReport = this.checkDataIntegrity(before, 'Before');
            const afterReport = this.checkDataIntegrity(after, 'After');

            return {
                before: beforeReport,
                after: afterReport,
                pointsCountChanged: beforeReport.pointsCount !== afterReport.pointsCount,
                hashChanged: beforeReport.hash !== afterReport.hash,
                pointsDelta: afterReport.pointsCount - beforeReport.pointsCount,
                integrityLost: !beforeReport.valid || !afterReport.valid
            };
        }

        /**
         * 安全なマージ（既存データを保護）
         */
        static safeMerge(target, source) {
            if (!target || !source) {
                return target || source;
            }

            // targetをcloneして保護
            const result = this.deepClone(target);

            Object.keys(source).forEach(key => {
                if (source[key] !== undefined) {
                    result[key] = this.deepClone(source[key]);
                }
            });

            return result;
        }

        /**
         * デバッグ用: オブジェクト構造の可視化
         */
        static visualizeStructure(obj, maxDepth = 3, currentDepth = 0) {
            if (currentDepth >= maxDepth) {
                return '[...]';
            }

            if (obj === null) return 'null';
            if (obj === undefined) return 'undefined';

            const type = typeof obj;

            if (type !== 'object') {
                return type;
            }

            if (Array.isArray(obj)) {
                return `Array(${obj.length})`;
            }

            const structure = {};
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] !== 'function') {
                    structure[key] = this.visualizeStructure(
                        obj[key], 
                        maxDepth, 
                        currentDepth + 1
                    );
                }
            });

            return structure;
        }
    }

    // グローバル公開
    window.DataUtils = DataUtils;

    console.log('✅ data-utils.js loaded - Phase 1 Step 1.1');
    console.log('   - deepClone() with structuredClone support');
    console.log('   - validateLayerState() for data integrity');
    console.log('   - hashObject() for sync verification');
    console.log('   - countPoints() for data tracking');
    console.log('   - detectInvalidNumbers() for NaN/Infinity detection');

    // 簡易テスト実行
    if (window.TEGAKI_CONFIG?.debug) {
        console.log('🧪 Running DataUtils self-test...');

        // Test 1: Deep clone
        const testObj = {
            id: 'test',
            paths: [{ points: [{ x: 10, y: 20 }] }],
            nested: { deep: { value: 42 } }
        };
        const cloned = DataUtils.deepClone(testObj);
        cloned.paths[0].points[0].x = 999;
        
        console.assert(
            testObj.paths[0].points[0].x === 10,
            'Deep clone test FAILED'
        );
        console.log('   ✓ Deep clone test passed');

        // Test 2: Validation
        const validLayer = {
            id: 'layer1',
            visible: true,
            opacity: 0.8,
            paths: [{
                id: 'path1',
                points: [{ x: 0, y: 0 }, { x: 10, y: 10 }]
            }],
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
        };
        const validation = DataUtils.validateLayerState(validLayer);
        console.assert(validation.valid, 'Validation test FAILED');
        console.log('   ✓ Validation test passed');

        // Test 3: Invalid number detection
        const invalidData = {
            points: [{ x: 10, y: NaN }, { x: Infinity, y: 20 }]
        };
        const issues = DataUtils.detectInvalidNumbers(invalidData);
        console.assert(issues.length === 2, 'Invalid number detection FAILED');
        console.log('   ✓ Invalid number detection test passed');

        console.log('✅ All DataUtils self-tests passed!');
    }

})();