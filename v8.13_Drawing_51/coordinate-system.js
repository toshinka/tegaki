// ===== coordinate-system.js - PIXI v8完全対応版 Phase 0 完全修正 =====
/**
 * 全座標変換の統一管理
 * Phase 0: 座標変換システムの完全統合
 * 修正: canvasToWorld() のworldTransform適用順序を修正
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
            
            this.eventBus.on('camera:resized', () => {
                this.clearCache();
            });
            
            this.eventBus.on('camera:transform-changed', () => {
                this.clearCache();
            });
        }
        
        // ========== PIXI v8対応: 座標変換API Phase 0 ==========
        
        /**
         * Screen座標(clientX/Y) → Canvas座標 変換
         * ブラウザのクライアント座標からCanvasピクセル座標への変換
         * DPI/CSS拡大縮小を考慮
         */
        screenClientToCanvas(clientX, clientY) {
            const canvas = this._getCanvas();
            if (!canvas) {
                return { x: clientX, y: clientY };
            }
            
            // getBoundingClientRectでCSS座標系を取得
            const rect = canvas.getBoundingClientRect();
            
            // CSS相対座標
            const cssX = clientX - rect.left;
            const cssY = clientY - rect.top;
            
            // Canvas内部ピクセルサイズ
            const rendererWidth = this._getRendererWidth();
            const rendererHeight = this._getRendererHeight();
            
            // DPI補正: CSS座標 → Canvas座標
            const scaleX = rendererWidth / rect.width;
            const scaleY = rendererHeight / rect.height;
            
            return {
                x: cssX * scaleX,
                y: cssY * scaleY
            };
        }
        
        /**
         * Canvas座標 → World座標 変換（修正版）
         * worldContainerの逆行列を正確に適用
         */
        canvasToWorld(canvasX, canvasY) {
            const worldContainer = this._getWorldContainer();
            
            if (!worldContainer) {
                return { x: canvasX, y: canvasY };
            }
            
            // PIXI v8: worldTransformを取得
            let worldTransform = null;
            
            if (worldContainer.worldTransform) {
                worldTransform = worldContainer.worldTransform;
            } else if (worldContainer.transform?.worldTransform) {
                worldTransform = worldContainer.transform.worldTransform;
            }
            
            if (worldTransform && worldTransform.a !== undefined) {
                // worldTransformが利用可能 → 逆行列を適用
                try {
                    const inv = worldTransform.clone().invert();
                    const point = inv.apply({ x: canvasX, y: canvasY });
                    return { x: point.x, y: point.y };
                } catch (error) {
                    // 逆行列計算失敗時は手動計算にフォールバック
                }
            }
            
            // フォールバック: 手動逆変換（worldContainer構造から逆算）
            // worldContainer = position + scale + rotation
            // 逆順: 回転を戻す → スケールを戻す → ポジションを戻す
            
            const pos = worldContainer.position;
            const scale = worldContainer.scale;
            const pivot = worldContainer.pivot || { x: 0, y: 0 };
            const rotation = worldContainer.rotation || 0;
            
            // 1. ポジションを引く（最初に加算された移動を戻す）
            let x = canvasX - pos.x;
            let y = canvasY - pos.y;
            
            // 2. 回転を戻す（逆回転）
            if (Math.abs(rotation) > 1e-6) {
                const cos = Math.cos(-rotation);
                const sin = Math.sin(-rotation);
                const rx = x * cos - y * sin;
                const ry = x * sin + y * cos;
                x = rx;
                y = ry;
            }
            
            // 3. スケールを戻す（逆スケール）
            if (Math.abs(scale.x) > 1e-6) x = x / scale.x;
            if (Math.abs(scale.y) > 1e-6) y = y / scale.y;
            
            // 4. ピボットを加算（ピボットからの相対位置に変換）
            x = x + pivot.x;
            y = y + pivot.y;
            
            return { x, y };
        }
        
        /**
         * Screen座標 → World座標 統合変換
         */
        screenClientToWorld(clientX, clientY) {
            const canvas = this.screenClientToCanvas(clientX, clientY);
            return this.canvasToWorld(canvas.x, canvas.y);
        }
        
        /**
         * World座標 → Local座標 変換（修正版）
         * PIXI v8のtoLocal()は親チェーン全体のworldTransformを使うため、
         * worldContainerのoffsetを含んでしまう。
         * 代わりに手動計算で container のローカル変換のみを適用する。
         */
        worldToLocal(worldX, worldY, container) {
            if (!container) {
                return { x: worldX, y: worldY };
            }
            
            // 常に手動計算を使用（toLocal()の誤りを回避）
            // 親チェーン全体をさかのぼって各transformを逆算
            let transforms = [];
            let node = container;
            const worldContainer = this._getWorldContainer();
            
            // container から worldContainer の直前まで親チェーンを収集
            while (node && node !== worldContainer && node !== null) {
                transforms.push({
                    pos: node.position || { x: 0, y: 0 },
                    scale: node.scale || { x: 1, y: 1 },
                    rotation: node.rotation || 0,
                    pivot: node.pivot || { x: 0, y: 0 }
                });
                node = node.parent;
            }
            
            // 逆順で逆変換を適用
            let x = worldX;
            let y = worldY;
            
            for (let i = transforms.length - 1; i >= 0; i--) {
                const t = transforms[i];
                
                // position引く
                x -= t.pos.x;
                y -= t.pos.y;
                
                // rotation戻す
                if (Math.abs(t.rotation) > 1e-6) {
                    const cos = Math.cos(-t.rotation);
                    const sin = Math.sin(-t.rotation);
                    const rx = x * cos - y * sin;
                    const ry = x * sin + y * cos;
                    x = rx;
                    y = ry;
                }
                
                // scale戻す
                if (Math.abs(t.scale.x) > 1e-6) x /= t.scale.x;
                if (Math.abs(t.scale.y) > 1e-6) y /= t.scale.y;
                
                // pivot加算
                x += t.pivot.x;
                y += t.pivot.y;
            }
            
            return { x, y };
        }
        
        /**
         * Screen座標 → Local座標 統合変換
         */
        screenClientToLocal(clientX, clientY, container) {
            const world = this.screenClientToWorld(clientX, clientY);
            return this.worldToLocal(world.x, world.y, container);
        }
        
        // ========== 逆変換API ==========
        
        /**
         * World座標 → Canvas座標 変換
         */
        worldToCanvas(worldX, worldY) {
            const worldContainer = this._getWorldContainer();
            
            if (!worldContainer) {
                return { x: worldX, y: worldY };
            }
            
            let worldTransform = null;
            if (worldContainer.worldTransform) {
                worldTransform = worldContainer.worldTransform;
            } else if (worldContainer.transform?.worldTransform) {
                worldTransform = worldContainer.transform.worldTransform;
            }
            
            if (worldTransform && worldTransform.a !== undefined) {
                try {
                    const point = worldTransform.apply({ x: worldX, y: worldY });
                    return { x: point.x, y: point.y };
                } catch (error) {
                    // フォールバック後に継続
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
            
            if (Math.abs(rotation) > 1e-6) {
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
        
        /**
         * Canvas座標 → Screen座標 変換
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
         * World座標 → Screen座標 変換
         */
        worldToScreen(worldX, worldY) {
            const canvas = this.worldToCanvas(worldX, worldY);
            return this.canvasToScreen(canvas.x, canvas.y);
        }
        
        /**
         * Local座標 → World座標 変換
         */
        localToWorld(localX, localY, container) {
            if (!container) {
                return { x: localX, y: localY };
            }
            
            if (container.toGlobal && typeof container.toGlobal === 'function') {
                try {
                    const world = container.toGlobal(new PIXI.Point(localX, localY));
                    return { x: world.x, y: world.y };
                } catch (error) {
                    // フォールバック後に継続
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
            
            if (Math.abs(rotation) > 1e-6) {
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
        
        /**
         * Local座標 → Screen座標 変換
         */
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
                return this.cameraSystem.app.stage.parent.screen?.height;
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