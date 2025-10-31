// ===== coordinate-system.js - Phase 1: TransformStack統合完全版 =====
// Phase 1: TransformStack導入 + グローバル統一
// Phase 2: リサイズ対応 + getBoundingClientRect() キャッシュ
// Phase 2.5: worldToLocal完全修正版

(function() {
    'use strict';
    
    // ========== TransformStackクラス (Phase 1追加) ==========
    class TransformStack {
        constructor(id, initialTransform = null) {
            this.id = id;
            this.position = { x: 0, y: 0 };
            this.scale = { x: 1, y: 1 };
            this.rotation = 0;
            this.pivot = { x: 0, y: 0 };
            this.parent = null;
            this.matrix = new PIXI.Matrix();
            this.inverseMatrix = new PIXI.Matrix();
            this.isDirty = true;
            
            if (initialTransform) {
                this.setTransform(initialTransform);
            }
        }
        
        updateMatrix() {
            if (!this.isDirty) return;
            
            this.matrix.identity();
            
            // Pivot適用
            this.matrix.translate(-this.pivot.x, -this.pivot.y);
            
            // Scale適用
            this.matrix.scale(this.scale.x, this.scale.y);
            
            // Rotation適用
            if (this.rotation !== 0) {
                this.matrix.rotate(this.rotation);
            }
            
            // Position適用
            this.matrix.translate(this.position.x, this.position.y);
            
            // 親との合成
            if (this.parent) {
                const parentMatrix = this.parent.getWorldMatrix();
                this.matrix.prepend(parentMatrix);
            }
            
            // 逆行列計算
            this.inverseMatrix = this.matrix.clone().invert();
            
            this.isDirty = false;
        }
        
        getWorldMatrix() {
            if (this.isDirty) {
                this.updateMatrix();
            }
            return this.matrix;
        }
        
        worldToLocal(worldX, worldY) {
            if (this.isDirty) {
                this.updateMatrix();
            }
            
            const point = new PIXI.Point(worldX, worldY);
            this.inverseMatrix.apply(point, point);
            
            return {
                localX: point.x,
                localY: point.y
            };
        }
        
        localToWorld(localX, localY) {
            if (this.isDirty) {
                this.updateMatrix();
            }
            
            const point = new PIXI.Point(localX, localY);
            this.matrix.apply(point, point);
            
            return {
                worldX: point.x,
                worldY: point.y
            };
        }
        
        setTransform(transform) {
            if (transform.x !== undefined) this.position.x = transform.x;
            if (transform.y !== undefined) this.position.y = transform.y;
            if (transform.rotation !== undefined) this.rotation = transform.rotation;
            if (transform.scaleX !== undefined) this.scale.x = transform.scaleX;
            if (transform.scaleY !== undefined) this.scale.y = transform.scaleY;
            if (transform.pivotX !== undefined) this.pivot.x = transform.pivotX;
            if (transform.pivotY !== undefined) this.pivot.y = transform.pivotY;
            
            this.isDirty = true;
        }
        
        getTransform() {
            return {
                x: this.position.x,
                y: this.position.y,
                rotation: this.rotation,
                scaleX: this.scale.x,
                scaleY: this.scale.y,
                pivotX: this.pivot.x,
                pivotY: this.pivot.y
            };
        }
        
        applyToContainer(container) {
            container.position.set(this.position.x, this.position.y);
            container.scale.set(this.scale.x, this.scale.y);
            container.rotation = this.rotation;
            container.pivot.set(this.pivot.x, this.pivot.y);
        }
        
        syncFromContainer(container) {
            this.setTransform({
                x: container.position.x,
                y: container.position.y,
                rotation: container.rotation,
                scaleX: container.scale.x,
                scaleY: container.scale.y,
                pivotX: container.pivot.x,
                pivotY: container.pivot.y
            });
        }
        
        clone() {
            const cloned = new TransformStack(this.id + '_clone');
            cloned.position = { ...this.position };
            cloned.scale = { ...this.scale };
            cloned.rotation = this.rotation;
            cloned.pivot = { ...this.pivot };
            cloned.parent = this.parent;
            cloned.isDirty = true;
            return cloned;
        }
        
        reset() {
            this.position = { x: 0, y: 0 };
            this.scale = { x: 1, y: 1 };
            this.rotation = 0;
            this.pivot = { x: 0, y: 0 };
            this.isDirty = true;
        }
        
        destroy() {
            this.parent = null;
            this.matrix = null;
            this.inverseMatrix = null;
        }
    }
    
    // ========== CoordinateSystemクラス ==========
    class CoordinateSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            this.cameraSystem = null;
            this.worldContainer = null;
            this.canvasContainer = null;
            
            // Phase 1追加: TransformStack管理
            this.transformStacks = new Map();
            
            // Phase 2追加: getBoundingClientRect() キャッシュ
            this.cachedRect = null;
            this.rectCacheVersion = 0;
            
            // 既存キャッシュ機構
            this.transformCache = new Map();
            this.cacheVersion = 0;
            this.cacheEnabled = false;
            this.cacheMaxSize = 100;
            
            // デバッグモード (Phase 1追加)
            this.debugMode = false;
            this.debugStats = {
                transformCacheHits: 0,
                transformCacheMisses: 0,
                worldToLocalCalls: 0,
                screenToWorldCalls: 0
            };
            this._debugInterval = null;
            
            this.precisionVerified = false;
            this.subpixelAccuracy = null;
        }
        
        init(app, config, eventBus) {
            this.app = app;
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus;
            
            if (!this.config?.canvas) {
                throw new Error('Canvas configuration required');
            }
            
            this.setupEventListeners();
            
            console.log('[CoordinateSystem] Phase 1: TransformStack統合完了');
        }
        
        // Phase 1: TransformStack管理メソッド
        createTransformStack(id, initialTransform) {
            if (this.transformStacks.has(id)) {
                console.warn(`[CoordinateSystem] TransformStack "${id}" already exists`);
                return this.transformStacks.get(id);
            }
            
            const stack = new TransformStack(id, initialTransform);
            this.transformStacks.set(id, stack);
            
            if (this.debugMode) {
                console.log(`[CoordinateSystem] Created TransformStack: ${id}`, stack.getTransform());
            }
            
            return stack;
        }
        
        getTransformStack(id) {
            return this.transformStacks.get(id) || null;
        }
        
        removeTransformStack(id) {
            const stack = this.transformStacks.get(id);
            if (stack) {
                stack.destroy();
                this.transformStacks.delete(id);
                
                if (this.debugMode) {
                    console.log(`[CoordinateSystem] Removed TransformStack: ${id}`);
                }
            }
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
        
        // Phase 2: イベントリスナー強化
        setupEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('canvas:resize', () => {
                this.clearCache();
                this._invalidateRectCache();
            });
            
            this.eventBus.on('camera:resized', ({ width, height }) => {
                console.log(`[CoordinateSystem] Canvas resized to ${width}x${height} - invalidating rect cache`);
                this.clearCache();
                this._invalidateRectCache();
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
        
        // Phase 2追加: Rectキャッシュ無効化
        _invalidateRectCache() {
            this.cachedRect = null;
            this.rectCacheVersion++;
            if (this.debugMode) {
                console.log(`[CoordinateSystem] Rect cache invalidated (version: ${this.rectCacheVersion})`);
            }
        }
        
        // Phase 2追加: Rect取得（キャッシュ付き）
        _getBoundingClientRect() {
            if (this.cachedRect) {
                return this.cachedRect;
            }
            
            const canvas = this._getCanvas();
            if (!canvas) {
                return { left: 0, top: 0, width: 800, height: 600 };
            }
            
            const rect = canvas.getBoundingClientRect();
            this.cachedRect = {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            };
            
            return this.cachedRect;
        }
        
        // ========== Screen → Canvas変換 ==========
        
        screenClientToCanvas(clientX, clientY) {
            const canvas = this._getCanvas();
            if (!canvas) {
                return { canvasX: clientX, canvasY: clientY };
            }
            
            const rect = this._getBoundingClientRect();
            const cssX = clientX - rect.left;
            const cssY = clientY - rect.top;
            
            const rendererWidth = this._getRendererWidth();
            const rendererHeight = this._getRendererHeight();
            
            const scaleX = rendererWidth / rect.width;
            const scaleY = rendererHeight / rect.height;
            
            if (this.debugMode) {
                this.debugStats.screenToWorldCalls++;
            }
            
            return {
                canvasX: cssX * scaleX,
                canvasY: cssY * scaleY
            };
        }
        
        canvasToWorld(canvasX, canvasY) {
            // Phase 1: TransformStack優先
            const cameraStack = this.getTransformStack('camera-world');
            if (cameraStack) {
                return cameraStack.worldToLocal(canvasX, canvasY);
            }
            
            // フォールバック: 既存ロジック
            const worldContainer = this._getWorldContainer();
            
            if (!worldContainer) {
                return { worldX: canvasX, worldY: canvasY };
            }
            
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
            
            // 手動逆変換
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
        
        screenClientToWorld(clientX, clientY) {
            const canvas = this.screenClientToCanvas(clientX, clientY);
            return this.canvasToWorld(canvas.canvasX, canvas.canvasY);
        }
        
        /**
         * Phase 1統合 + Phase 2.5完全修正版
         * World座標 → Local座標 変換
         */
        worldToLocal(worldX, worldY, container) {
            if (this.debugMode) {
                this.debugStats.worldToLocalCalls++;
            }
            
            if (!container) {
                return { localX: worldX, localY: worldY };
            }
            
            // Phase 1: TransformStack対応レイヤーの場合
            const layerId = container.layerData?.id;
            if (layerId) {
                const layerStack = this.getTransformStack(`layer-${layerId}`);
                if (layerStack) {
                    if (this.debugMode) {
                        this.debugStats.transformCacheHits++;
                    }
                    return layerStack.worldToLocal(worldX, worldY);
                }
            }
            
            if (this.debugMode) {
                this.debugStats.transformCacheMisses++;
            }
            
            // 既存の手動逆算ロジック
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
                
                x -= t.pivot.x;
                y -= t.pivot.y;
                
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
        
        screenClientToLocal(clientX, clientY, container) {
            const world = this.screenClientToWorld(clientX, clientY);
            return this.worldToLocal(world.worldX, world.worldY, container);
        }
        
        // ========== 逆変換API ==========
        
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
        
        canvasToScreen(canvasX, canvasY) {
            const canvas = this._getCanvas();
            if (!canvas) {
                return { clientX: canvasX, clientY: canvasY };
            }
            
            const rect = this._getBoundingClientRect();
            const rendererWidth = this._getRendererWidth();
            const rendererHeight = this._getRendererHeight();
            
            const scaleX = rect.width / rendererWidth;
            const scaleY = rect.height / rendererHeight;
            
            return {
                clientX: rect.left + (canvasX * scaleX),
                clientY: rect.top + (canvasY * scaleY)
            };
        }
        
        worldToScreen(worldX, worldY) {
            const canvas = this.worldToCanvas(worldX, worldY);
            return this.canvasToScreen(canvas.canvasX, canvas.canvasY);
        }
        
        localToWorld(localX, localY, container) {
            if (!container) {
                return { worldX: localX, worldY: localY };
            }
            
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
            
            let x = localX;
            let y = localY;
            
            for (let i = 0; i < transforms.length; i++) {
                const t = transforms[i];
                
                x -= t.pivot.x;
                y -= t.pivot.y;
                
                x *= t.scale.x;
                y *= t.scale.y;
                
                if (Math.abs(t.rotation) > 1e-6) {
                    const cos = Math.cos(t.rotation);
                    const sin = Math.sin(t.rotation);
                    const rx = x * cos - y * sin;
                    const ry = x * sin + y * cos;
                    x = rx;
                    y = ry;
                }
                
                x += t.pivot.x;
                y += t.pivot.y;
                
                x += t.pos.x;
                y += t.pos.y;
            }
            
            return { worldX: x, worldY: y };
        }
        
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
        
        clearCache() {
            this.transformCache.clear();
            this.cacheVersion++;
        }
        
        // ========== デバッグ機能 (Phase 1追加) ==========
        
        enableDebugMode() {
            this.debugMode = true;
            console.log('[CoordinateSystem] Debug mode enabled');
            this._startDebugMonitoring();
        }
        
        disableDebugMode() {
            this.debugMode = false;
            console.log('[CoordinateSystem] Debug mode disabled');
            if (this._debugInterval) {
                clearInterval(this._debugInterval);
                this._debugInterval = null;
            }
        }
        
        _startDebugMonitoring() {
            if (this._debugInterval) {
                clearInterval(this._debugInterval);
            }
            
            this._debugInterval = setInterval(() => {
                if (!this.debugMode) {
                    clearInterval(this._debugInterval);
                    return;
                }
                
                const total = this.debugStats.transformCacheHits + this.debugStats.transformCacheMisses;
                const hitRate = total > 0 ? (this.debugStats.transformCacheHits / total * 100).toFixed(1) : 0;
                
                console.log('[CoordinateSystem Stats]', {
                    transformStacks: this.transformStacks.size,
                    cacheHits: this.debugStats.transformCacheHits,
                    cacheMisses: this.debugStats.transformCacheMisses,
                    hitRate: hitRate + '%',
                    worldToLocalCalls: this.debugStats.worldToLocalCalls,
                    screenToWorldCalls: this.debugStats.screenToWorldCalls
                });
            }, 5000);
        }
        
        getDebugInfo() {
            return {
                debugMode: this.debugMode,
                stats: { ...this.debugStats },
                transformStacks: Array.from(this.transformStacks.keys()),
                cacheSize: this.transformCache.size,
                cacheVersion: this.cacheVersion,
                rectCacheVersion: this.rectCacheVersion
            };
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
    }
    
    // ========== グローバル統一 ==========
    const coordinateSystem = new CoordinateSystem();
    window.CoordinateSystem = coordinateSystem;
    window.TransformStack = TransformStack;
    
    // ========== デバッグコマンド (Phase 1追加) ==========
    window.debugCoordinateSystem = () => {
        window.CoordinateSystem.enableDebugMode();
    };
    
    window.debugTransformStacks = () => {
        const stacks = window.CoordinateSystem.transformStacks;
        console.log('[TransformStacks]', stacks.size, 'stacks');
        stacks.forEach((stack, id) => {
            console.log(`  ${id}:`, stack.getTransform());
        });
    };
    
    console.log('✅ coordinate-system.js (Phase 1: TransformStack統合完全版) loaded');
    console.log('   ✓ Phase 1: TransformStack導入 + グローバル統一');
    console.log('   ✓ Phase 2: getBoundingClientRect() キャッシュ + 無効化');
    console.log('   ✓ Phase 2.5: worldToLocal完全修正版');
    console.log('   ✓ デバッグコマンド: window.debugTransformStacks()');
    
})();