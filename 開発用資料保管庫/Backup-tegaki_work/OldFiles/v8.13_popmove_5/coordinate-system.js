// ===== coordinate-system.js - Phase 2: 診断専用化明示版（ログスリム化） =====
/**
 * ⚠️ 診断・デバッグ専用
 * 本番コードでの座標変換使用禁止
 * 座標変換は CameraSystem.screenToCanvas() を使用すること
 */

(function() {
    'use strict';
    
    class CoordinateSystem {
        constructor() {
            this.config = null;
            this.eventBus = null;
            this.layerSystem = null;
            this.cameraSystem = null;
            this.animationSystem = null;
            this.transformCache = new Map();
            this.cacheVersion = 0;
            this.transformSettings = {
                enableCache: true,
                cacheMaxSize: 100,
                enableDebug: false
            };
        }
        
        init(config, eventBus) {
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus;
            
            if (!this.config?.canvas) {
                throw new Error('Canvas configuration required');
            }
            
            this.setupEventListeners();
        }
        
        setupEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('canvas:resize', () => {
                this.clearTransformCache();
            });
            
            this.eventBus.on('camera:transform-changed', () => {
                this.clearTransformCache();
            });
        }
        
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
        }
        
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }
        
        setAnimationSystem(animationSystem) {
            this.animationSystem = animationSystem;
        }
        
        applyLayerTransform(layer, transform, centerX, centerY) {
            if (!layer || !transform) return false;
            
            try {
                const hasRotationOrScale = (transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
                
                if (hasRotationOrScale) {
                    layer.pivot.set(centerX || 0, centerY || 0);
                    layer.position.set(
                        (centerX || 0) + (transform.x || 0), 
                        (centerY || 0) + (transform.y || 0)
                    );
                    layer.rotation = transform.rotation || 0;
                    layer.scale.set(transform.scaleX || 1, transform.scaleY || 1);
                } else if (transform.x !== 0 || transform.y !== 0) {
                    layer.pivot.set(0, 0);
                    layer.position.set(transform.x || 0, transform.y || 0);
                    layer.rotation = 0;
                    layer.scale.set(1, 1);
                } else {
                    layer.pivot.set(0, 0);
                    layer.position.set(0, 0);
                    layer.rotation = 0;
                    layer.scale.set(1, 1);
                }
                
                return true;
            } catch (error) {
                return false;
            }
        }
        
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
        
        screenToWorld(screenX, screenY) {
            const cacheKey = `s2w_${screenX}_${screenY}_${this.cacheVersion}`;
            
            if (this.transformSettings.enableCache && this.transformCache.has(cacheKey)) {
                return this.transformCache.get(cacheKey);
            }
            
            let worldX = screenX;
            let worldY = screenY;
            
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
        
        worldToScreen(worldX, worldY) {
            const cacheKey = `w2s_${worldX}_${worldY}_${this.cacheVersion}`;
            
            if (this.transformSettings.enableCache && this.transformCache.has(cacheKey)) {
                return this.transformCache.get(cacheKey);
            }
            
            let screenX = worldX;
            let screenY = worldY;
            
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
        
        localToWorld(localX, localY, layer) {
            if (!layer || !layer.transform) {
                return { x: localX, y: localY };
            }
            
            try {
                const point = layer.transform.worldTransform.apply({ x: localX, y: localY });
                return { x: point.x, y: point.y };
            } catch (error) {
                return { x: localX, y: localY };
            }
        }
        
        worldToLocal(worldX, worldY, layer) {
            if (!layer || !layer.transform) {
                return { x: worldX, y: worldY };
            }
            
            try {
                const matrix = layer.transform.worldTransform.clone().invert();
                const point = matrix.apply({ x: worldX, y: worldY });
                return { x: point.x, y: point.y };
            } catch (error) {
                return { x: worldX, y: worldY };
            }
        }
        
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
        
        setCache(key, value) {
            if (!this.transformSettings.enableCache) return;
            
            if (this.transformCache.size >= this.transformSettings.cacheMaxSize) {
                const firstKey = this.transformCache.keys().next().value;
                this.transformCache.delete(firstKey);
            }
            
            this.transformCache.set(key, value);
        }
        
        clearTransformCache() {
            this.transformCache.clear();
            this.cacheVersion++;
        }
        
        updateSettings(settings) {
            if (!settings || typeof settings !== 'object') return;
            
            Object.assign(this.transformSettings, settings);
            
            if (settings.enableCache === false) {
                this.clearTransformCache();
            }
        }
        
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
                    hasAnimationSystem: !!this.animationSystem
                },
                cache: {
                    enabled: this.transformSettings.enableCache,
                    size: this.transformCache.size,
                    maxSize: this.transformSettings.cacheMaxSize,
                    version: this.cacheVersion
                }
            };
            
            const issues = [];
            if (!diagnosis.config.hasConfig) issues.push('Config missing');
            if (!diagnosis.config.hasCanvasConfig) issues.push('Canvas config missing');
            if (!diagnosis.eventBus.hasEventBus) issues.push('EventBus missing');
            
            diagnosis.issues = issues;
            diagnosis.healthScore = Math.max(0, 100 - (issues.length * 20));
            
            return diagnosis;
        }
    }
    
    const coordinateSystem = new CoordinateSystem();
    window.CoordinateSystem = coordinateSystem;
    window.TEGAKI_COORDINATE_SYSTEM = coordinateSystem;
    window.CoordinateSystem.DIAGNOSTIC_ONLY = true;
    
    if (typeof window !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                if (window.TEGAKI_CONFIG && window.TegakiEventBus) {
                    try {
                        coordinateSystem.init(window.TEGAKI_CONFIG, window.TegakiEventBus);
                    } catch (error) {}
                }
            });
        } else {
            setTimeout(() => {
                if (window.TEGAKI_CONFIG && window.TegakiEventBus && !coordinateSystem.config) {
                    try {
                        coordinateSystem.init(window.TEGAKI_CONFIG, window.TegakiEventBus);
                    } catch (error) {}
                }
            }, 100);
        }
    }

})();