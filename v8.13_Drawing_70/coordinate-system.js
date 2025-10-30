// ===== coordinate-system.js - worldToLocal完全修正版 Phase 2.5 =====
/**
 * 全座標変換の統一管理
 * Phase 2.5修正: worldToLocal() の pivot/position/rotation/scale の計算順序を完全修正
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
        
        // ========== Screen → Canvas変換 ==========
        
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
         * Phase 2.5完全修正: pivot/position/rotation/scale の計算順序を修正
         * 
         * 正しい逆変換の順序:
         * world → position引く → pivot引く → rotate逆 → scale割る → pivot足す
         * 
         * @returns {Object} {localX, localY}
         */
        worldToLocal(worldX, worldY, container) {
            if (!container) {
                return { localX: worldX, localY: worldY };
            }
            
            // 親チェーン全体をさかのぼって各transformを収集
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
            
            // 親から子へ順番に逆変換を適用
            for (let i = transforms.length - 1; i >= 0; i--) {
                const t = transforms[i];
                
                // Phase 2.5修正: 正しい逆変換の順序
                // 順変換: local → -pivot → *scale → rotate → +pivot → +position
                // 逆変換: world → -position → -pivot → rotate^-1 → /scale → +pivot
                
                // 1. position を引く
                x -= t.pos.x;
                y -= t.pos.y;
                
                // 2. pivot を引く（回転・スケールの中心点に移動）
                x -= t.pivot.x;
                y -= t.pivot.y;
                
                // 3. rotation を逆回転
                if (Math.abs(t.rotation) > 1e-6) {
                    const cos = Math.cos(-t.rotation);
                    const sin = Math.sin(-t.rotation);
                    const rx = x * cos - y * sin;
                    const ry = x * sin + y * cos;
                    x = rx;
                    y = ry;
                }
                
                // 4. scale で割る
                if (Math.abs(t.scale.x) > 1e-6) x /= t.scale.x;
                if (Math.abs(t.scale.y) > 1e-6) y /= t.scale.y;
                
                // 5. pivot を足す（元のローカル座標系に戻す）
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
         * Phase 2.5修正: worldToLocal()と完全に対応する順変換
         * 
         * 正しい順変換の順序:
         * local → -pivot → *scale → rotate → +pivot → +position
         * 
         * @returns {Object} {worldX, worldY}
         */
        localToWorld(localX, localY, container) {
            if (!container) {
                return { worldX: localX, worldY: localY };
            }
            
            // 親チェーン全体を収集
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
            
            // 子から親へ順番に順変換を適用
            for (let i = 0; i < transforms.length; i++) {
                const t = transforms[i];
                
                // Phase 2.5修正: 正しい順変換の順序
                // local → -pivot → *scale → rotate → +pivot → +position
                
                // 1. pivot を引く（回転・スケールの中心点に移動）
                x -= t.pivot.x;
                y -= t.pivot.y;
                
                // 2. scale を掛ける
                x *= t.scale.x;
                y *= t.scale.y;
                
                // 3. rotation を適用
                if (Math.abs(t.rotation) > 1e-6) {
                    const cos = Math.cos(t.rotation);
                    const sin = Math.sin(t.rotation);
                    const rx = x * cos - y * sin;
                    const ry = x * sin + y * cos;
                    x = rx;
                    y = ry;
                }
                
                // 4. pivot を足す（親座標系での位置に戻す）
                x += t.pivot.x;
                y += t.pivot.y;
                
                // 5. position を足す
                x += t.pos.x;
                y += t.pos.y;
            }
            
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
    
    console.log('✅ coordinate-system.js (Phase 2.5完全修正版) loaded');
    console.log('   - Phase 2.5: worldToLocal() の pivot/position/rotation/scale 計算順序を完全修正');
    console.log('   - Phase 2.5: localToWorld() も同様に修正（完全な逆変換を保証）');
    console.log('   - サムネイル問題の根本原因を解決');
    
})();

// ========== デバッグコマンド ==========
window.TegakiDebug = window.TegakiDebug || {};
window.TegakiDebug.coord = {
    // 座標変換フルテスト
    testFullPipeline(clientX, clientY) {
        console.log('=== 座標変換フルパイプライン Phase 2.5 ===');
        console.log('Input Screen:', { clientX, clientY });
        
        const step1 = window.CoordinateSystem.screenClientToCanvas(clientX, clientY);
        console.log('Step 1 Canvas:', step1);
        
        const step2 = window.CoordinateSystem.canvasToWorld(step1.canvasX, step1.canvasY);
        console.log('Step 2 World:', step2);
        
        const layer = window.CoreRuntime?.internal?.layerManager?.getActiveLayer?.();
        if (layer) {
            const step3 = window.CoordinateSystem.worldToLocal(step2.worldX, step2.worldY, layer);
            console.log('Step 3 Local:', step3);
            
            // NaN チェック
            if (!isFinite(step3.localX) || !isFinite(step3.localY)) {
                console.error('❌ worldToLocal returned non-finite value');
                console.log('Layer state:', {
                    position: layer.position,
                    pivot: layer.pivot,
                    rotation: layer.rotation,
                    scale: layer.scale
                });
                return;
            }
            
            // 検証: Local → World → Canvas → Screen と逆変換
            const verify1 = window.CoordinateSystem.localToWorld(step3.localX, step3.localY, layer);
            console.log('Verify World:', verify1);
            
            if (!isFinite(verify1.worldX) || !isFinite(verify1.worldY)) {
                console.error('❌ localToWorld returned non-finite value');
                return;
            }
            
            const verify2 = window.CoordinateSystem.worldToCanvas(verify1.worldX, verify1.worldY);
            console.log('Verify Canvas:', verify2);
            
            const verify3 = window.CoordinateSystem.canvasToScreen(verify2.canvasX, verify2.canvasY);
            console.log('Verify Screen:', verify3);
            
            // 誤差確認
            const errorX = Math.abs(verify3.clientX - clientX);
            const errorY = Math.abs(verify3.clientY - clientY);
            console.log('Error:', { x: errorX.toFixed(4), y: errorY.toFixed(4) });
            
            if (errorX < 0.1 && errorY < 0.1) {
                console.log('✅ 座標変換: 正常（誤差0.1px未満）');
            } else if (errorX < 1.0 && errorY < 1.0) {
                console.log('⚠️ 座標変換: 許容範囲（誤差1px未満）');
            } else {
                console.log('❌ 座標変換: 誤差大（Phase 2.5修正が必要）');
            }
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