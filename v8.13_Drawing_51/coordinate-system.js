// ===== coordinate-system.js - PIXI v8完全対応版 =====
/**
 * 全座標変換の統一管理
 * PIXI v8のTransform APIに完全対応
 */

(function() {
    'use strict';
    
    class CoordinateSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            this.cameraSystem = null;
            
            this.transformCache = new Map();
            this.cacheVersion = 0;
            this.cacheEnabled = false;
            this.cacheMaxSize = 100;
        }
        
        init(app, config, eventBus) {
            this.app = app;
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus;
            
            if (!this.config?.canvas) {
                throw new Error('Canvas configuration required');
            }
            
            this.setupEventListeners();
        }
        
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }
        
        _getWorldContainer() {
            if (this.cameraSystem?.worldContainer) {
                return this.cameraSystem.worldContainer;
            }
            
            if (window.cameraSystem?.worldContainer) {
                return window.cameraSystem.worldContainer;
            }
            
            if (this.app?.stage?.children) {
                const worldContainer = this.app.stage.children.find(
                    child => child.label === 'worldContainer'
                );
                if (worldContainer) return worldContainer;
            }
            
            return null;
        }
        
        setupEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('canvas:resize', () => {
                this.clearCache();
            });
            
            this.eventBus.on('camera:transform-changed', () => {
                this.clearCache();
            });
        }
        
        // ========== PIXI v8対応: 座標変換API ==========
        
        screenClientToCanvas(clientX, clientY) {
            const canvas = this._getCanvas();
            if (!canvas) {
                return { x: clientX, y: clientY };
            }
            
            const rect = canvas.getBoundingClientRect();
            const cssX = clientX - rect.left;
            const cssY = clientY - rect.top;
            
            const rendererWidth = this._getRendererWidth();
            const rendererHeight = this._getRendererHeight();
            
            const scaleX = rendererWidth / rect.width;
            const scaleY = rendererHeight / rect.height;
            
            return {
                x: cssX * scaleX,
                y: cssY * scaleY
            };
        }
        
        /**
         * Canvas → World 変換（PIXI v8対応）
         * worldTransformが未初期化の場合は手動計算
         */
        canvasToWorld(canvasX, canvasY) {
            const worldContainer = this._getWorldContainer();
            
            if (!worldContainer) {
                console.warn('CoordinateSystem: worldContainer not found');
                return { x: canvasX, y: canvasY };
            }
            
            // PIXI v8: worldTransformをチェック
            const worldTransform = worldContainer.worldTransform || worldContainer.transform?.worldTransform;
            
            if (worldTransform && worldTransform.a !== undefined) {
                // worldTransformが利用可能
                try {
                    const inv = worldTransform.clone().invert();
                    const point = inv.apply({ x: canvasX, y: canvasY });
                    return { x: point.x, y: point.y };
                } catch (error) {
                    console.error('CoordinateSystem: worldTransform.invert error:', error);
                }
            }
            
            // フォールバック: 手動で逆変換を計算
            console.log('CoordinateSystem: Using manual transform calculation');
            
            const pos = worldContainer.position;
            const scale = worldContainer.scale;
            const pivot = worldContainer.pivot || { x: 0, y: 0 };
            const rotation = worldContainer.rotation || 0;
            
            // 1. positionのオフセットを引く
            let x = canvasX - pos.x;
            let y = canvasY - pos.y;
            
            // 2. 回転の逆変換
            if (rotation !== 0) {
                const cos = Math.cos(-rotation);
                const sin = Math.sin(-rotation);
                const rx = x * cos - y * sin;
                const ry = x * sin + y * cos;
                x = rx;
                y = ry;
            }
            
            // 3. スケールの逆変換
            x = x / scale.x;
            y = y / scale.y;
            
            // 4. pivotを加算
            x = x + pivot.x;
            y = y + pivot.y;
            
            return { x, y };
        }
        
        screenClientToWorld(clientX, clientY) {
            const canvas = this.screenClientToCanvas(clientX, clientY);
            return this.canvasToWorld(canvas.x, canvas.y);
        }
        
        worldToLocal(worldX, worldY, container) {
            if (!container) {
                return { x: worldX, y: worldY };
            }
            
            // PIXI v8: toLocal()を使用
            if (container.toLocal) {
                try {
                    const local = container.toLocal(new PIXI.Point(worldX, worldY));
                    return { x: local.x, y: local.y };
                } catch (error) {
                    console.error('CoordinateSystem: toLocal error:', error);
                }
            }
            
            // フォールバック: 手動計算
            const pos = container.position || { x: 0, y: 0 };
            const scale = container.scale || { x: 1, y: 1 };
            const pivot = container.pivot || { x: 0, y: 0 };
            const rotation = container.rotation || 0;
            
            let x = worldX - pos.x;
            let y = worldY - pos.y;
            
            if (rotation !== 0) {
                const cos = Math.cos(-rotation);
                const sin = Math.sin(-rotation);
                const rx = x * cos - y * sin;
                const ry = x * sin + y * cos;
                x = rx;
                y = ry;
            }
            
            x = x / scale.x;
            y = y / scale.y;
            x = x + pivot.x;
            y = y + pivot.y;
            
            return { x, y };
        }
        
        screenClientToLocal(clientX, clientY, container) {
            const world = this.screenClientToWorld(clientX, clientY);
            return this.worldToLocal(world.x, world.y, container);
        }
        
        // ========== 逆変換API ==========
        
        worldToCanvas(worldX, worldY) {
            const worldContainer = this._getWorldContainer();
            
            if (!worldContainer) {
                return { x: worldX, y: worldY };
            }
            
            const worldTransform = worldContainer.worldTransform || worldContainer.transform?.worldTransform;
            
            if (worldTransform && worldTransform.a !== undefined) {
                try {
                    const point = worldTransform.apply({ x: worldX, y: worldY });
                    return { x: point.x, y: point.y };
                } catch (error) {
                    console.error('CoordinateSystem: worldTransform.apply error:', error);
                }
            }
            
            // フォールバック: 手動計算
            const pos = worldContainer.position;
            const scale = worldContainer.scale;
            const pivot = worldContainer.pivot || { x: 0, y: 0 };
            const rotation = worldContainer.rotation || 0;
            
            let x = worldX - pivot.x;
            let y = worldY - pivot.y;
            
            x = x * scale.x;
            y = y * scale.y;
            
            if (rotation !== 0) {
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const rx = x * cos - y * sin;
                const ry = x * sin + y * cos;
                x = rx;
                y = ry;
            }
            
            x = x + pos.x;
            y = y + pos.y;
            
            return { x, y };
        }
        
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
        
        worldToScreen(worldX, worldY) {
            const canvas = this.worldToCanvas(worldX, worldY);
            return this.canvasToScreen(canvas.x, canvas.y);
        }
        
        localToWorld(localX, localY, container) {
            if (!container) {
                return { x: localX, y: localY };
            }
            
            if (container.toGlobal) {
                try {
                    const world = container.toGlobal(new PIXI.Point(localX, localY));
                    return { x: world.x, y: world.y };
                } catch (error) {
                    console.error('CoordinateSystem: toGlobal error:', error);
                }
            }
            
            // フォールバック: 手動計算
            const pos = container.position || { x: 0, y: 0 };
            const scale = container.scale || { x: 1, y: 1 };
            const pivot = container.pivot || { x: 0, y: 0 };
            const rotation = container.rotation || 0;
            
            let x = localX - pivot.x;
            let y = localY - pivot.y;
            
            x = x * scale.x;
            y = y * scale.y;
            
            if (rotation !== 0) {
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const rx = x * cos - y * sin;
                const ry = x * sin + y * cos;
                x = rx;
                y = ry;
            }
            
            x = x + pos.x;
            y = y + pos.y;
            
            return { x, y };
        }
        
        localToScreen(localX, localY, container) {
            const world = this.localToWorld(localX, localY, container);
            return this.worldToScreen(world.x, world.y);
        }
        
        // ========== ユーティリティ ==========
        
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
        
        isInsideCanvas(x, y, margin = 0) {
            return (x >= -margin && 
                    y >= -margin && 
                    x < this.config.canvas.width + margin && 
                    y < this.config.canvas.height + margin);
        }
        
        rectanglesOverlap(rect1, rect2) {
            if (!rect1 || !rect2) return false;
            
            return !(rect1.x + rect1.width <= rect2.x ||
                     rect2.x + rect2.width <= rect1.x ||
                     rect1.y + rect1.height <= rect2.y ||
                     rect2.y + rect2.height <= rect1.y);
        }
        
        distance(x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        angle(x1, y1, x2, y2) {
            return Math.atan2(y2 - y1, x2 - x1);
        }
        
        normalizeAngle(angle) {
            while (angle > Math.PI) angle -= 2 * Math.PI;
            while (angle < -Math.PI) angle += 2 * Math.PI;
            return angle;
        }
        
        degreesToRadians(degrees) {
            return degrees * Math.PI / 180;
        }
        
        radiansToDegrees(radians) {
            return radians * 180 / Math.PI;
        }
        
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
        
        dotProduct(x1, y1, x2, y2) {
            return x1 * x2 + y1 * y2;
        }
        
        crossProduct(x1, y1, x2, y2) {
            return x1 * y2 - y1 * x2;
        }
        
        // ========== 内部ヘルパー ==========
        
        _getCanvas() {
            if (this.app?.view) {
                return this.app.view;
            }
            if (this.app?.renderer?.view) {
                return this.app.renderer.view;
            }
            if (this.app?.canvas) {
                return this.app.canvas;
            }
            if (this.cameraSystem?.app?.stage?.parent?.canvas) {
                return this.cameraSystem.app.stage.parent.canvas;
            }
            if (this.cameraSystem?.app?.stage?.parent?.view) {
                return this.cameraSystem.app.stage.parent.view;
            }
            if (window.cameraSystem?.app?.stage?.parent?.canvas) {
                return window.cameraSystem.app.stage.parent.canvas;
            }
            const canvases = document.querySelectorAll('canvas');
            return canvases.length > 0 ? canvases[0] : null;
        }
        
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
            if (this.cameraSystem?.app?.stage?.parent?.screen?.width) {
                return this.cameraSystem.app.stage.parent.screen.width;
            }
            const canvas = this._getCanvas();
            return canvas ? canvas.width : (this.config?.canvas?.width || 800);
        }
        
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
            if (this.cameraSystem?.app?.stage?.parent?.screen?.height) {
                return this.cameraSystem.app.stage.parent.screen.height;
            }
            const canvas = this._getCanvas();
            return canvas ? canvas.height : (this.config?.canvas?.height || 600);
        }
        
        clearCache() {
            this.transformCache.clear();
            this.cacheVersion++;
        }
        
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

console.log('✅ coordinate-system.js (PIXI v8完全対応・手動変換実装) loaded');