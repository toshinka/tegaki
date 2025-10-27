// ===== coordinate-system.js - Phase 0: 座標変換完全統合版 =====
/**
 * 全座標変換の統一管理
 * Screen(clientX/Y) ↔ Canvas(内部px) ↔ World ↔ Local
 * DPI/DPR/CSS変形を正確に考慮
 */

(function() {
    'use strict';
    
    class CoordinateSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            this.cameraSystem = null;
            
            // キャッシュ（パフォーマンス用）
            this.transformCache = new Map();
            this.cacheVersion = 0;
            this.cacheEnabled = false; // 初期は無効（正確性優先）
            this.cacheMaxSize = 100;
        }
        
        /**
         * 初期化
         */
        init(app, config, eventBus) {
            this.app = app;
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus;
            
            if (!this.config?.canvas) {
                throw new Error('Canvas configuration required');
            }
            
            this.setupEventListeners();
        }
        
        /**
         * CameraSystemへの参照設定
         */
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }
        
        /**
         * イベント購読
         */
        setupEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('canvas:resize', () => {
                this.clearCache();
            });
            
            this.eventBus.on('camera:transform-changed', () => {
                this.clearCache();
            });
        }
        
        // ========== Phase 0: 座標変換API（完全実装） ==========
        
        /**
         * Screen座標（clientX/Y）→ Canvas内部ピクセル座標
         * DPI/DPR/CSSスケールを考慮
         */
        screenClientToCanvas(clientX, clientY) {
            const canvas = this._getCanvas();
            if (!canvas) {
                return { x: clientX, y: clientY };
            }
            
            const rect = canvas.getBoundingClientRect();
            
            // CSS空間での相対位置
            const cssX = clientX - rect.left;
            const cssY = clientY - rect.top;
            
            // レンダラーの内部解像度を取得
            const rendererWidth = this._getRendererWidth();
            const rendererHeight = this._getRendererHeight();
            
            // DPI補正スケール
            const scaleX = rendererWidth / rect.width;
            const scaleY = rendererHeight / rect.height;
            
            return {
                x: cssX * scaleX,
                y: cssY * scaleY
            };
        }
        
        /**
         * Canvas内部ピクセル座標 → World座標
         * worldContainerの逆変換を適用
         */
        canvasToWorld(canvasX, canvasY) {
            if (!this.cameraSystem?.worldContainer) {
                return { x: canvasX, y: canvasY };
            }
            
            const worldContainer = this.cameraSystem.worldContainer;
            const inv = worldContainer.transform.worldTransform.clone().invert();
            const point = inv.apply({ x: canvasX, y: canvasY });
            
            return { x: point.x, y: point.y };
        }
        
        /**
         * Screen座標 → World座標（統合版）
         * screenClientToCanvas() + canvasToWorld() の統合
         */
        screenClientToWorld(clientX, clientY) {
            const canvas = this.screenClientToCanvas(clientX, clientY);
            return this.canvasToWorld(canvas.x, canvas.y);
        }
        
        /**
         * World座標 → Local座標（コンテナ内相対座標）
         * container.toLocal() のラッパー
         */
        worldToLocal(worldX, worldY, container) {
            if (!container || !container.toLocal) {
                return { x: worldX, y: worldY };
            }
            
            try {
                const local = container.toLocal(new PIXI.Point(worldX, worldY));
                return { x: local.x, y: local.y };
            } catch (error) {
                return { x: worldX, y: worldY };
            }
        }
        
        /**
         * Screen座標 → Local座標（統合版・最頻出）
         * screenClientToWorld() + worldToLocal() の統合
         */
        screenClientToLocal(clientX, clientY, container) {
            const world = this.screenClientToWorld(clientX, clientY);
            return this.worldToLocal(world.x, world.y, container);
        }
        
        // ========== 逆変換API ==========
        
        /**
         * World座標 → Canvas内部ピクセル座標
         */
        worldToCanvas(worldX, worldY) {
            if (!this.cameraSystem?.worldContainer) {
                return { x: worldX, y: worldY };
            }
            
            const worldContainer = this.cameraSystem.worldContainer;
            const point = worldContainer.transform.worldTransform.apply({ x: worldX, y: worldY });
            
            return { x: point.x, y: point.y };
        }
        
        /**
         * Canvas内部ピクセル座標 → Screen座標
         */
        canvasToScreen(canvasX, canvasY) {
            const canvas = this._getCanvas();
            if (!canvas) {
                return { x: canvasX, y: canvasY };
            }
            
            const rect = canvas.getBoundingClientRect();
            const rendererWidth = this._getRendererWidth();
            const rendererHeight = this._getRendererHeight();
            
            const scaleX = rect.width / rendererWidth;
            const scaleY = rect.height / rendererHeight;
            
            return {
                x: rect.left + (canvasX * scaleX),
                y: rect.top + (canvasY * scaleY)
            };
        }
        
        /**
         * World座標 → Screen座標
         */
        worldToScreen(worldX, worldY) {
            const canvas = this.worldToCanvas(worldX, worldY);
            return this.canvasToScreen(canvas.x, canvas.y);
        }
        
        /**
         * Local座標 → World座標
         */
        localToWorld(localX, localY, container) {
            if (!container || !container.toGlobal) {
                return { x: localX, y: localY };
            }
            
            try {
                const world = container.toGlobal(new PIXI.Point(localX, localY));
                return { x: world.x, y: world.y };
            } catch (error) {
                return { x: localX, y: localY };
            }
        }
        
        /**
         * Local座標 → Screen座標
         */
        localToScreen(localX, localY, container) {
            const world = this.localToWorld(localX, localY, container);
            return this.worldToScreen(world.x, world.y);
        }
        
        // ========== ユーティリティ ==========
        
        /**
         * レイヤーの境界取得
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
                return { x: 0, y: 0, width: 0, height: 0 };
            }
        }
        
        /**
         * Canvas内判定
         */
        isInsideCanvas(x, y, margin = 0) {
            return (x >= -margin && 
                    y >= -margin && 
                    x < this.config.canvas.width + margin && 
                    y < this.config.canvas.height + margin);
        }
        
        /**
         * 矩形重なり判定
         */
        rectanglesOverlap(rect1, rect2) {
            if (!rect1 || !rect2) return false;
            
            return !(rect1.x + rect1.width <= rect2.x ||
                     rect2.x + rect2.width <= rect1.x ||
                     rect1.y + rect1.height <= rect2.y ||
                     rect2.y + rect2.height <= rect1.y);
        }
        
        /**
         * 2点間距離
         */
        distance(x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        /**
         * 2点間角度
         */
        angle(x1, y1, x2, y2) {
            return Math.atan2(y2 - y1, x2 - x1);
        }
        
        /**
         * 角度正規化
         */
        normalizeAngle(angle) {
            while (angle > Math.PI) angle -= 2 * Math.PI;
            while (angle < -Math.PI) angle += 2 * Math.PI;
            return angle;
        }
        
        /**
         * 度→ラジアン
         */
        degreesToRadians(degrees) {
            return degrees * Math.PI / 180;
        }
        
        /**
         * ラジアン→度
         */
        radiansToDegrees(radians) {
            return radians * 180 / Math.PI;
        }
        
        /**
         * ベクトル正規化
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
         * 内積
         */
        dotProduct(x1, y1, x2, y2) {
            return x1 * x2 + y1 * y2;
        }
        
        /**
         * 外積
         */
        crossProduct(x1, y1, x2, y2) {
            return x1 * y2 - y1 * x2;
        }
        
        // ========== 内部ヘルパー ==========
        
        /**
         * Canvasエレメント取得
         */
        _getCanvas() {
            if (this.app?.view) {
                return this.app.view;
            }
            if (this.app?.renderer?.view) {
                return this.app.renderer.view;
            }
            if (this.cameraSystem?.app?.stage?.parent?.view) {
                return this.cameraSystem.app.stage.parent.view;
            }
            const canvases = document.querySelectorAll('canvas');
            return canvases.length > 0 ? canvases[0] : null;
        }
        
        /**
         * レンダラー内部幅取得
         */
        _getRendererWidth() {
            if (this.app?.renderer?.width) {
                return this.app.renderer.width;
            }
            if (this.app?.screen?.width) {
                return this.app.screen.width;
            }
            if (this.cameraSystem?.app?.stage?.parent?.renderer?.width) {
                return this.cameraSystem.app.stage.parent.renderer.width;
            }
            const canvas = this._getCanvas();
            return canvas ? canvas.width : 800;
        }
        
        /**
         * レンダラー内部高さ取得
         */
        _getRendererHeight() {
            if (this.app?.renderer?.height) {
                return this.app.renderer.height;
            }
            if (this.app?.screen?.height) {
                return this.app.screen.height;
            }
            if (this.cameraSystem?.app?.stage?.parent?.renderer?.height) {
                return this.cameraSystem.app.stage.parent.renderer.height;
            }
            const canvas = this._getCanvas();
            return canvas ? canvas.height : 600;
        }
        
        /**
         * キャッシュクリア
         */
        clearCache() {
            this.transformCache.clear();
            this.cacheVersion++;
        }
        
        /**
         * キャッシュ設定更新
         */
        updateCacheSettings(settings) {
            if (settings.enabled !== undefined) {
                this.cacheEnabled = settings.enabled;
            }
            if (settings.maxSize !== undefined) {
                this.cacheMaxSize = settings.maxSize;
            }
            if (!this.cacheEnabled) {
                this.clearCache();
            }
        }
    }
    
    // グローバル公開
    const coordinateSystem = new CoordinateSystem();
    window.CoordinateSystem = coordinateSystem;
    window.TEGAKI_COORDINATE_SYSTEM = coordinateSystem;
    
})();

console.log('✅ coordinate-system.js (Phase 0: 完全統合版) loaded');