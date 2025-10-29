// ===== coordinate-system.js - API統一版 =====
/**
 * 全座標変換の統一管理
 * 修正: 返り値を {座標系名X, 座標系名Y} に統一
 */

(function() {
    'use strict';
    
    class CoordinateSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            this.cameraSystem = null;
            this.worldContainer = null;
            this.canvasContainer = null;
            
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
        
        setContainers(containers) {
            if (containers.worldContainer) {
                this.worldContainer = containers.worldContainer;
            }
            if (containers.canvasContainer) {
                this.canvasContainer = containers.canvasContainer;
            }
            if (containers.app) {
                this.app = containers.app;
            }
        }
        
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }
        
        _getWorldContainer() {
            if (this.worldContainer) {
                return this.worldContainer;
            }
            
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
            
            this.eventBus.on('layer:transform-updated', () => {
                this.clearCache();
            });
            
            this.eventBus.on('layer:transform-changed', () => {
                this.clearCache();
            });
        }
        
        // ========== Screen → Canvas変換 (修正: 返り値統一) ==========
        
        /**
         * Screen座標(clientX/Y) → Canvas座標 変換
         * @returns {Object} {canvasX, canvasY}
         */
        screenClientToCanvas(clientX, clientY) {
            const canvas = this._getCanvas();
            if (!canvas) {
                return { canvasX: clientX, canvasY: clientY };
            }
            
            const rect = canvas.getBoundingClientRect();
            const cssX = clientX - rect.left;
            const cssY = clientY - rect.top;
            
            const rendererWidth = this._getRendererWidth();
            const rendererHeight = this._getRendererHeight();
            
            const scaleX = rendererWidth / rect.width;
            const scaleY = rendererHeight / rect.height;
            
            return {
                canvasX: cssX * scaleX,
                canvasY: cssY * scaleY
            };
        }
        
        /**
         * Canvas座標 → World座標 変換
         * @returns {Object} {worldX, worldY}
         */
        canvasToWorld(canvasX, canvasY) {
            const worldContainer = this._getWorldContainer();
            
            if (!worldContainer) {
                return { worldX: canvasX, worldY: canvasY };
            }
            
            // PIXI v8: worldTransformを取得
            let worldTransform = null;
            
            if (worldContainer.worldTransform) {
                worldTransform = worldContainer.worldTransform;
            } else if (worldContainer.transform?.worldTransform) {
                worldTransform = worldContainer.transform.worldTransform;
            }
            
            if (worldTransform && worldTransform.a !== undefined) {
                try {
                    const inv = worldTransform.clone().invert();
                    const point = inv.apply({ x: canvasX, y: canvasY });
                    return { worldX: point.x, worldY: point.y };
                } catch (error) {
                    // フォールバックに続く
                }
            }
            
            // フォールバック: 手動逆変換
            const pos = worldContainer.position;
            const scale = worldContainer.scale;
            const pivot = worldContainer.pivot || { x: 0, y: 0 };
            const rotation = worldContainer.rotation || 0;
            
            let x = canvasX - pos.x;
            let y = canvasY - pos.y;
            
            if (Math.abs(rotation) > 1e-6) {
                const cos = Math.cos(-rotation);
                const sin = Math.sin(-rotation);
                const rx = x * cos - y * sin;
                const ry = x * sin + y * cos;
                x = rx;
                y = ry;
            }
            
            if (Math.abs(scale.x) > 1e-6) x = x / scale.x;
            if (Math.abs(scale.y) > 1e-6) y = y / scale.y;
            
            x = x + pivot.x;
            y = y + pivot.y;
            
            return { worldX: x, worldY: y };
        }
        
        /**
         * Screen座標 → World座標 統合変換
         * @returns {Object} {worldX, worldY}
         */
        screenClientToWorld(clientX, clientY) {
            const canvas = this.screenClientToCanvas(clientX, clientY);
            return this.canvasToWorld(canvas.canvasX, canvas.canvasY);
        }
        
        /**
         * World座標 → Local座標 変換
         * @returns {Object} {localX, localY}
         */
        worldToLocal(worldX, worldY, container) {
            if (!container) {
                return { localX: worldX, localY: worldY };
            }
            
            // 親チェーン全体をさかのぼって各transformを逆算
            let transforms = [];
            let node = container;
            const worldContainer = this._getWorldContainer();
            
            while (node && node !== worldContainer && node !== null) {
                transforms.push({
                    pos: node.position || { x: 0, y: 0 },
                    scale: node.scale || { x: 1, y: 1 },
                    rotation: node.rotation || 0,
                    pivot: node.pivot || { x: 0, y: 0 }
                });
                node = node.parent;
            }
            
            let x = worldX;
            let y = worldY;
            
            for (let i = transforms.length - 1; i >= 0; i--) {
                const t = transforms[i];
                
                x -= t.pos.x;
                y -= t.pos.y;
                
                if (Math.abs(t.rotation) > 1e-6) {
                    const cos = Math.cos(-t.rotation);
                    const sin = Math.sin(-t.rotation);
                    const rx = x * cos - y * sin;
                    const ry = x * sin + y * cos;
                    x = rx;
                    y = ry;
                }
                
                if (Math.abs(t.scale.x) > 1e-6) x /= t.scale.x;
                if (Math.abs(t.scale.y) > 1e-6) y /= t.scale.y;
                
                x += t.pivot.x;
                y += t.pivot.y;
            }
            
            return { localX: x, localY: y };
        }
        
        /**
         * Screen座標 → Local座標 統合変換
         * @returns {Object} {localX, localY}
         */
        screenClientToLocal(clientX, clientY, container) {
            const world = this.screenClientToWorld(clientX, clientY);
            return this.worldToLocal(world.worldX, world.worldY, container);
        }
        
        // ========== 逆変換API ==========
        
        /**
         * World座標 → Canvas座標 変換
         * @returns {Object} {canvasX, canvasY}
         */
        worldToCanvas(worldX, worldY) {
            const worldContainer = this._getWorldContainer();
            
            if (!worldContainer) {
                return { canvasX: worldX, canvasY: worldY };
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
                    return { canvasX: point.x, canvasY: point.y };
                } catch (error) {
                    // フォールバック後に継続
                }
            }
            
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
            
            return { canvasX: x, canvasY: y };
        }
        
        /**
         * Canvas座標 → Screen座標 変換
         * @returns {Object} {clientX, clientY}
         */
        canvasToScreen(canvasX, canvasY) {
            const canvas = this._getCanvas();
            if (!canvas) {
                return { clientX: canvasX, clientY: canvasY };
            }
            
            const rect = canvas.getBoundingClientRect();
            const rendererWidth = this._getRendererWidth();
            const rendererHeight = this._getRendererHeight();
            
            const scaleX = rect.width / rendererWidth;
            const scaleY = rect.height / rendererHeight;
            
            return {
                clientX: rect.left + (canvasX * scaleX),
                clientY: rect.top + (canvasY * scaleY)
            };
        }
        
        /**
         * World座標 → Screen座標 変換
         * @returns {Object} {clientX, clientY}
         */
        worldToScreen(worldX, worldY) {
            const canvas = this.worldToCanvas(worldX, worldY);
            return this.canvasToScreen(canvas.canvasX, canvas.canvasY);
        }
        
        /**
         * Local座標 → World座標 変換
         * @returns {Object} {worldX, worldY}
         */
        localToWorld(localX, localY, container) {
            if (!container) {
                return { worldX: localX, worldY: localY };
            }
            
            if (container.toGlobal && typeof container.toGlobal === 'function') {
                try {
                    const world = container.toGlobal(new PIXI.Point(localX, localY));
                    return { worldX: world.x, worldY: world.y };
                } catch (error) {
                    // フォールバックに続く
                }
            }
            
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
            
            return { worldX: x, worldY: y };
        }
        
        /**
         * Local座標 → Screen座標 変換
         * @returns {Object} {clientX, clientY}
         */
        localToScreen(localX, localY, container) {
            const world = this.localToWorld(localX, localY, container);
            return this.worldToScreen(world.worldX, world.worldY);
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
        
        distance(x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
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
            const canvas = this._getCanvas();
            return canvas ? canvas.height : (this.config?.canvas?.height || 600);
        }
        
        clearCache() {
            this.transformCache.clear();
            this.cacheVersion++;
        }
    }
    
    // グローバル公開
    const coordinateSystem = new CoordinateSystem();
    window.CoordinateSystem = coordinateSystem;
    
    console.log('✅ coordinate-system.js (API統一版) loaded');
    
})();

// ========== デバッグコマンド ==========
window.TegakiDebug = window.TegakiDebug || {};
window.TegakiDebug.coord = {
    // 座標変換フルテスト
    testFullPipeline(clientX, clientY) {
        console.log('=== 座標変換フルパイプライン ===');
        console.log('Input Screen:', { clientX, clientY });
        
        const step1 = window.CoordinateSystem.screenClientToCanvas(clientX, clientY);
        console.log('Step 1 Canvas:', step1);
        
        const step2 = window.CoordinateSystem.canvasToWorld(step1.canvasX, step1.canvasY);
        console.log('Step 2 World:', step2);
        
        const layer = window.CoreRuntime?.internal?.layerManager?.getActiveLayer?.();
        if (layer) {
            const step3 = window.CoordinateSystem.worldToLocal(step2.worldX, step2.worldY, layer);
            console.log('Step 3 Local:', step3);
        } else {
            console.warn('⚠️ No active layer');
        }
    },
    
    // CoordinateSystem初期化確認
    inspectCoordSystem() {
        const cs = window.CoordinateSystem;
        console.log('=== CoordinateSystem Status ===');
        console.log('app:', !!cs.app);
        console.log('config:', !!cs.config);
        console.log('worldContainer:', !!cs.worldContainer);
        console.log('cameraSystem:', !!cs.cameraSystem);
        console.log('_getWorldContainer():', !!cs._getWorldContainer());
    }
};

console.log('✅ Debug commands: TegakiDebug.coord.*');