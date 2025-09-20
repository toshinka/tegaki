// ===== coordinate-system.js - Phase 1 =====
// 独立した座標系管理システム
// 全ての座標変換を統一管理し、明示的な座標空間コメントを提供

(function() {
    'use strict';
    
    /**
     * 【Phase 1】統一座標系管理システム
     * 
     * 座標空間定義:
     * - screen: CSS pixels from canvas top-left (UI interactions)
     * - world: Infinite canvas coordinates affected by camera zoom/pan
     * - canvas: Drawing canvas coordinates (0,0 to CONFIG.canvas.width/height)
     * - layer: Layer-local coordinates (affected by layer transforms)
     * 
     * 全ての座標変換はこのシステムを経由し、座標空間を明示する
     */
    window.CoordinateSystem = {
        
        // Version info
        version: '1.0.0',
        phase: 'Phase1-Separated',
        
        // Performance tracking
        stats: {
            conversionCount: {
                screenToWorld: 0,
                worldToScreen: 0,
                screenToCanvas: 0,
                layerToWorld: 0,
                worldToLayer: 0,
                transformPoint: 0
            },
            validationWarnings: 0,
            directCallWarnings: 0
        },
        
        // === 基本座標変換API ===
        
        /**
         * スクリーン座標をワールド座標に変換
         * @param {PIXI.Application} app - PIXIアプリケーション
         * @param {number} screenX - CSS pixels from canvas left  
         * @param {number} screenY - CSS pixels from canvas top
         * @returns {{x: number, y: number}} world coordinates
         */
        screenToWorld(app, screenX, screenY) {
            this.stats.conversionCount.screenToWorld++;
            
            // coord: screen -> world
            const cameraSystem = this._getCameraSystem(app);
            const globalPoint = { x: screenX, y: screenY };
            const worldPoint = cameraSystem.canvasContainer.toLocal(globalPoint);
            
            const result = { x: worldPoint.x, y: worldPoint.y };
            
            if (this._isDebugMode()) {
                this._validateCoordinateSpace(
                    result, 
                    'world', 
                    `screenToWorld(${screenX}, ${screenY})`
                );
            }
            
            return result;
        },
        
        /**
         * ワールド座標をスクリーン座標に変換
         * @param {PIXI.Application} app 
         * @param {number} worldX 
         * @param {number} worldY 
         * @returns {{x: number, y: number}} screen coordinates
         */
        worldToScreen(app, worldX, worldY) {
            this.stats.conversionCount.worldToScreen++;
            
            // coord: world -> screen
            const cameraSystem = this._getCameraSystem(app);
            const worldPoint = { x: worldX, y: worldY };
            const screenPoint = cameraSystem.canvasContainer.toGlobal(worldPoint);
            
            const result = { x: screenPoint.x, y: screenPoint.y };
            
            if (this._isDebugMode()) {
                this._validateCoordinateSpace(
                    result, 
                    'screen', 
                    `worldToScreen(${worldX}, ${worldY})`
                );
            }
            
            return result;
        },
        
        /**
         * スクリーン座標をキャンバス座標に変換（描画専用）
         * レイヤー変形を無視した純粋な描画座標変換
         * @param {PIXI.Application} app 
         * @param {number} screenX 
         * @param {number} screenY 
         * @returns {{x: number, y: number}} canvas coordinates for drawing
         */
        screenToCanvasForDrawing(app, screenX, screenY) {
            this.stats.conversionCount.screenToCanvas++;
            
            // coord: screen -> canvas (drawing space, layer-transform-agnostic)
            const cameraSystem = this._getCameraSystem(app);
            const globalPoint = { x: screenX, y: screenY };
            const canvasPoint = cameraSystem.canvasContainer.toLocal(globalPoint);
            
            const result = { x: canvasPoint.x, y: canvasPoint.y };
            
            if (this._isDebugMode()) {
                this._validateCoordinateSpace(
                    result, 
                    'canvas', 
                    `screenToCanvasForDrawing(${screenX}, ${screenY})`
                );
            }
            
            return result;
        },
        
        /**
         * レイヤー座標をワールド座標に変換
         * @param {PIXI.Container} layer - レイヤーコンテナ
         * @param {number} layerX - layer space X
         * @param {number} layerY - layer space Y 
         * @returns {{x: number, y: number}} world coordinates
         */
        layerToWorld(layer, layerX, layerY) {
            this.stats.conversionCount.layerToWorld++;
            
            if (!layer || typeof layer.toGlobal !== 'function') {
                throw new Error('CoordinateSystem.layerToWorld: Invalid layer container');
            }
            
            // coord: layer -> world
            const layerPoint = new PIXI.Point(layerX, layerY);
            const worldPoint = layer.toGlobal(layerPoint);
            
            const result = { x: worldPoint.x, y: worldPoint.y };
            
            if (this._isDebugMode()) {
                this._validateCoordinateSpace(
                    result, 
                    'world', 
                    `layerToWorld(${layerX}, ${layerY})`
                );
            }
            
            return result;
        },
        
        /**
         * ワールド座標をレイヤー座標に変換
         * @param {PIXI.Container} layer - レイヤーコンテナ
         * @param {number} worldX - world space X
         * @param {number} worldY - world space Y
         * @returns {{x: number, y: number}} layer coordinates
         */
        worldToLayer(layer, worldX, worldY) {
            this.stats.conversionCount.worldToLayer++;
            
            if (!layer || typeof layer.toLocal !== 'function') {
                throw new Error('CoordinateSystem.worldToLayer: Invalid layer container');
            }
            
            // coord: world -> layer
            const worldPoint = new PIXI.Point(worldX, worldY);
            const layerPoint = layer.toLocal(worldPoint);
            
            const result = { x: layerPoint.x, y: layerPoint.y };
            
            if (this._isDebugMode()) {
                this._validateCoordinateSpace(
                    result, 
                    'layer', 
                    `worldToLayer(${worldX}, ${worldY})`
                );
            }
            
            return result;
        },
        
        // === 高度な座標変換API ===
        
        /**
         * 点をピボット中心に変形（同一座標空間内で処理）
         * @param {{x: number, y: number}} point - 変形する点
         * @param {{x: number, y: number}} pivot - ピボット点（同一座標空間）
         * @param {Object} transform - 変形パラメータ
         * @param {number} transform.scaleX - X軸スケール
         * @param {number} transform.scaleY - Y軸スケール 
         * @param {number} transform.rotation - 回転角度（ラジアン）
         * @param {number} transform.tx - X軸平行移動
         * @param {number} transform.ty - Y軸平行移動
         * @returns {{x: number, y: number}} 変形後の点
         */
        transformPoint(point, pivot, transform) {
            this.stats.conversionCount.transformPoint++;
            
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
                throw new Error('CoordinateSystem.transformPoint: Invalid point');
            }
            if (!pivot || typeof pivot.x !== 'number' || typeof pivot.y !== 'number') {
                throw new Error('CoordinateSystem.transformPoint: Invalid pivot');
            }
            
            // 座標空間は呼び出し側で統一されている前提
            const dx = point.x - pivot.x;
            const dy = point.y - pivot.y;
            
            const scaleX = transform.scaleX ?? 1;
            const scaleY = transform.scaleY ?? 1;
            const rotation = transform.rotation ?? 0;
            const tx = transform.tx ?? 0;
            const ty = transform.ty ?? 0;
            
            // スケール適用
            let nx = dx * scaleX;
            let ny = dy * scaleY;
            
            // 回転適用
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const rx = nx * cos - ny * sin;
            const ry = nx * sin + ny * cos;
            
            // 平行移動適用
            const result = {
                x: pivot.x + rx + tx,
                y: pivot.y + ry + ty
            };
            
            if (this._isDebugMode()) {
                console.log('🔄 CoordinateSystem.transformPoint:', {
                    point, pivot, transform, result
                });
            }
            
            return result;
        },
        
        /**
         * 複数点を一括変形
         * @param {Array<{x: number, y: number}>} points - 変形する点の配列
         * @param {{x: number, y: number}} pivot - ピボット点
         * @param {Object} transform - 変形パラメータ
         * @returns {Array<{x: number, y: number}>} 変形後の点の配列
         */
        transformPoints(points, pivot, transform) {
            if (!Array.isArray(points)) {
                throw new Error('CoordinateSystem.transformPoints: points must be array');
            }
            
            return points.map(point => this.transformPoint(point, pivot, transform));
        },
        
        // === ユーティリティAPI ===
        
        /**
         * 拡張キャンバス範囲内かどうか判定
         * @param {{x: number, y: number}} canvasPoint - canvas space coordinates
         * @param {number} margin - 拡張マージン
         * @returns {boolean}
         */
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            const CONFIG = window.TEGAKI_CONFIG;
            if (!CONFIG) return false;
            
            return canvasPoint.x >= -margin && 
                   canvasPoint.x <= CONFIG.canvas.width + margin &&
                   canvasPoint.y >= -margin && 
                   canvasPoint.y <= CONFIG.canvas.height + margin;
        },
        
        /**
         * カメラフレーム中央座標を取得
         * @returns {{x: number, y: number}} camera center in canvas space
         */
        getCameraCenter() {
            const CONFIG = window.TEGAKI_CONFIG;
            if (!CONFIG) {
                throw new Error('CoordinateSystem.getCameraCenter: TEGAKI_CONFIG not found');
            }
            
            return {
                x: CONFIG.canvas.width / 2,
                y: CONFIG.canvas.height / 2
            };
        },
        
        /**
         * 2点間距離を計算
         * @param {{x: number, y: number}} point1
         * @param {{x: number, y: number}} point2
         * @returns {number} distance
         */
        distance(point1, point2) {
            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            return Math.sqrt(dx * dx + dy * dy);
        },
        
        /**
         * 点が矩形範囲内かどうか判定
         * @param {{x: number, y: number}} point - 判定する点
         * @param {{x: number, y: number, width: number, height: number}} rect - 矩形範囲
         * @returns {boolean}
         */
        isPointInRect(point, rect) {
            return point.x >= rect.x && 
                   point.x <= rect.x + rect.width &&
                   point.y >= rect.y && 
                   point.y <= rect.y + rect.height;
        },
        
        // === 内部メソッド ===
        
        /**
         * CameraSystemインスタンスを取得
         * @param {PIXI.Application} app 
         * @returns {CameraSystem}
         * @private
         */
        _getCameraSystem(app) {
            // Phase 1: 複数の方法でCameraSystemを取得
            if (window.drawingApp?.coreEngine) {
                return window.drawingApp.coreEngine.getCameraSystem();
            }
            if (app.cameraSystem) {
                return app.cameraSystem;
            }
            if (window.cameraSystem) {
                return window.cameraSystem;
            }
            
            throw new Error('CoordinateSystem: CameraSystem not found');
        },
        
        /**
         * デバッグモードかどうか判定
         * @returns {boolean}
         * @private
         */
        _isDebugMode() {
            return window.TEGAKI_CONFIG?.debug === true;
        },
        
        /**
         * 座標空間検証（デバッグ用）
         * @param {{x: number, y: number}} point - 検証する点
         * @param {string} expectedSpace - 期待する座標空間
         * @param {string} context - エラー文脈
         * @private
         */
        _validateCoordinateSpace(point, expectedSpace, context = '') {
            if (!this._isDebugMode()) return;
            
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
                this._showCoordinateWarning(`Invalid point in ${context}: ${JSON.stringify(point)}`);
                return;
            }
            
            // 簡易的な範囲チェック
            const CONFIG = window.TEGAKI_CONFIG;
            let suspicious = false;
            let reason = '';
            
            switch(expectedSpace) {
                case 'screen':
                    // スクリーン座標は通常正の値（一部負の値も許容）
                    if (point.x < -200 || point.y < -200 || 
                        point.x > window.innerWidth + 200 || point.y > window.innerHeight + 200) {
                        suspicious = true;
                        reason = 'out of reasonable screen bounds';
                    }
                    break;
                    
                case 'canvas':
                case 'world':
                    // キャンバス/ワールド座標は拡張範囲内
                    if (Math.abs(point.x) > CONFIG.canvas.width * 5 || 
                        Math.abs(point.y) > CONFIG.canvas.height * 5) {
                        suspicious = true;
                        reason = 'coordinates outside reasonable canvas/world bounds';
                    }
                    break;
                    
                case 'layer':
                    // レイヤー座標は非常に大きな値は疑わしい
                    if (Math.abs(point.x) > 50000 || Math.abs(point.y) > 50000) {
                        suspicious = true;
                        reason = 'unusually large layer coordinates';
                    }
                    break;
            }
            
            if (suspicious) {
                this.stats.validationWarnings++;
                this._showCoordinateWarning(
                    `${context}: ${reason} - ${JSON.stringify(point)}`
                );
            }
        },
        
        /**
         * 座標系警告表示
         * @param {string} message
         * @private
         */
        _showCoordinateWarning(message) {
            console.warn('⚠️ CoordinateSystem:', message);
            
            // UI要素が存在する場合のみ表示
            if (typeof document !== 'undefined') {
                const warningElement = document.getElementById('warning-info');
                const warningPanel = document.getElementById('coordinate-warning');
                if (warningElement && warningPanel) {
                    warningElement.textContent = message;
                    warningPanel.classList.add('show');
                    
                    // 5秒後に自動非表示
                    setTimeout(() => {
                        warningPanel.classList.remove('show');
                    }, 5000);
                }
            }
        },
        
        // === 公開統計API ===
        
        /**
         * 統計情報取得
         * @returns {Object} statistics
         */
        getStats() {
            return {
                version: this.version,
                phase: this.phase,
                conversions: { ...this.stats.conversionCount },
                totalConversions: Object.values(this.stats.conversionCount).reduce((a, b) => a + b, 0),
                validationWarnings: this.stats.validationWarnings,
                directCallWarnings: this.stats.directCallWarnings
            };
        },
        
        /**
         * 統計リセット
         */
        resetStats() {
            Object.keys(this.stats.conversionCount).forEach(key => {
                this.stats.conversionCount[key] = 0;
            });
            this.stats.validationWarnings = 0;
            this.stats.directCallWarnings = 0;
        },
        
        // === Phase 1 監視システム ===
        
        /**
         * 直接toLocal/toGlobal呼び出し監視の設定
         */
        setupDirectCallMonitoring() {
            if (!this._isDebugMode() || !window.PIXI) return;
            
            const maxWarnings = 20; // Phase 1では警告回数増加
            
            const originalToLocal = PIXI.Container.prototype.toLocal;
            const originalToGlobal = PIXI.Container.prototype.toGlobal;
            
            PIXI.Container.prototype.toLocal = function(position, from, point, skipUpdate) {
                CoordinateSystem.stats.directCallWarnings++;
                
                if (CoordinateSystem.stats.directCallWarnings <= maxWarnings) {
                    const stack = new Error().stack;
                    const caller = stack.split('\n')[2]?.trim() || 'unknown';
                    
                    console.warn(`⚠️ [Phase 1] Direct toLocal call #${CoordinateSystem.stats.directCallWarnings}:`, {
                        caller: caller,
                        container: this.label || this.constructor.name,
                        suggestion: 'Use CoordinateSystem.worldToLayer instead'
                    });
                    
                    CoordinateSystem._showCoordinateWarning(
                        `Direct toLocal call #${CoordinateSystem.stats.directCallWarnings} - migrate to CoordinateSystem API`
                    );
                }
                
                return originalToLocal.call(this, position, from, point, skipUpdate);
            };
            
            PIXI.Container.prototype.toGlobal = function(position, point, skipUpdate) {
                CoordinateSystem.stats.directCallWarnings++;
                
                if (CoordinateSystem.stats.directCallWarnings <= maxWarnings) {
                    const stack = new Error().stack;
                    const caller = stack.split('\n')[2]?.trim() || 'unknown';
                    
                    console.warn(`⚠️ [Phase 1] Direct toGlobal call #${CoordinateSystem.stats.directCallWarnings}:`, {
                        caller: caller,
                        container: this.label || this.constructor.name,
                        suggestion: 'Use CoordinateSystem.layerToWorld instead'
                    });
                    
                    CoordinateSystem._showCoordinateWarning(
                        `Direct toGlobal call #${CoordinateSystem.stats.directCallWarnings} - migrate to CoordinateSystem API`
                    );
                }
                
                return originalToGlobal.call(this, position, point, skipUpdate);
            };
            
            console.log('🔍 Phase 1: Enhanced coordinate conversion monitoring enabled');
        },
        
        // === 初期化メソッド ===
        
        /**
         * Phase 1初期化
         */
        initialize() {
            console.log(`🚀 CoordinateSystem ${this.version} (${this.phase}) initializing...`);
            
            // 監視システム設定
            if (this._isDebugMode()) {
                this.setupDirectCallMonitoring();
            }
            
            // ステータス表示更新
            if (typeof document !== 'undefined') {
                const coordStatus = document.getElementById('coord-status');
                if (coordStatus) {
                    coordStatus.textContent = this.phase;
                    coordStatus.style.color = '#0066cc';
                    coordStatus.title = 'Phase 1: Separated coordinate system with enhanced monitoring';
                }
            }
            
            console.log(`✅ CoordinateSystem ${this.version} (${this.phase}) initialized`);
            return this;
        }
    };
    
    // Phase 1 自動初期化
    if (typeof window !== 'undefined') {
        // DOM準備後またはconfig.js読み込み後に初期化
        const initializeWhenReady = () => {
            if (window.TEGAKI_CONFIG) {
                window.CoordinateSystem.initialize();
            } else {
                setTimeout(initializeWhenReady, 100);
            }
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeWhenReady);
        } else {
            initializeWhenReady();
        }
    }
    
})();