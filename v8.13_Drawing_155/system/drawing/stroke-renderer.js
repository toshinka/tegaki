/**
 * ================================================================================
 * system/drawing/stroke-renderer.js - Phase 3-E: mode統合版
 * ================================================================================
 * 
 * 【Phase 3-E 改修内容 - settings.mode 対応】
 * ✅ settings.mode を優先的に使用
 * ✅ this.currentTool はフォールバックのみ
 * ✅ 消しゴムの blendMode='erase' 確実適用
 * ✅ デバッグログ追加（mode 判定過程を可視化）
 * 
 * 【依存関係 - Parents (このファイルが依存)】
 *   - PixiJS v8.13 (Graphics, Sprite, Mesh)
 *   - webgpu-drawing-layer.js (WebGPU統合)
 *   - webgpu-compute-sdf.js (SDF生成)
 *   - webgpu-compute-msdf.js (MSDF生成)
 *   - webgpu-texture-bridge.js (テクスチャ変換)
 *   - sdf-brush-shader.js (shader管理)
 *   - msdf-brush-shader.js (MSDF shader)
 *   - brush-settings.js (settings取得)
 * 
 * 【依存関係 - Children (このファイルに依存)】
 *   - brush-core.js (ストローク描画)
 *   - layer-system.js (レイヤー追加)
 * 
 * 【責務】
 *   - ストロークの視覚化（プレビュー・最終描画）
 *   - ペン/消しゴムモード判定と描画分岐
 *   - WebGPU/Legacy描画パイプライン管理
 *   - BlendMode制御（pen='normal', eraser='erase'）
 * ================================================================================
 */

(function() {
    'use strict';

    class StrokeRenderer {
        constructor(app, layerSystem, cameraSystem) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
            this.currentTool = 'pen'; // フォールバック用
            
            this.webgpuLayer = null;
            this.webgpuComputeSDF = null;
            this.webgpuComputeMSDF = null;
            this.textureBridge = null;
            this.webgpuEnabled = false;
            
            this.msdfBrushShader = null;
            this.msdfEnabled = false;
            
            this.config = window.TEGAKI_CONFIG?.webgpu || {};
        }

        _getSettings(providedSettings = null) {
            if (providedSettings) {
                return providedSettings;
            }
            
            if (window.brushSettings) {
                return window.brushSettings.getSettings();
            }
            
            return {
                size: 3,
                opacity: 1.0,
                color: 0x800000,
                mode: 'pen' // デフォルト
            };
        }

        /**
         * 🆕 Phase 3-E: mode判定を統一
         * settings.mode を優先、フォールバックで this.currentTool
         */
        _getCurrentMode(settings) {
            const mode = settings?.mode || this.currentTool || 'pen';
            console.log(`[StrokeRenderer] Current mode: ${mode} (from settings: ${settings?.mode}, fallback: ${this.currentTool})`);
            return mode;
        }

        async setWebGPULayer(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            
            if (webgpuLayer && webgpuLayer.isInitialized()) {
                if (this.config.sdf?.enabled !== false) {
                    this.webgpuComputeSDF = new window.WebGPUComputeSDF(webgpuLayer);
                    await this.webgpuComputeSDF.initialize();
                }
                
                if (this.config.msdf?.enabled !== false) {
                    this.webgpuComputeMSDF = new window.WebGPUComputeMSDF(webgpuLayer);
                    await this.webgpuComputeMSDF.initialize();
                    this.msdfEnabled = true;
                }
                
                this.textureBridge = new window.WebGPUTextureBridge(webgpuLayer);
                
                if (this.msdfEnabled) {
                    this.msdfBrushShader = new window.MSDFBrushShader();
                    this.msdfBrushShader.initialize(this.app.renderer);
                }
                
                this.webgpuEnabled = true;
            }
        }

        setTool(tool) {
            console.log(`[StrokeRenderer] setTool: ${this.currentTool} → ${tool}`);
            this.currentTool = tool;
        }

        calculateWidth(pressure, brushSize) {
            const minRatio = Math.max(0.3, this.minPhysicalWidth);
            const ratio = Math.max(minRatio, pressure || 0.5);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        _ensureLayerBlendMode(targetGraphics) {
            if (!targetGraphics || !targetGraphics.parent) return;
            
            const parentLayer = targetGraphics.parent;
            
            if (parentLayer && !parentLayer._blendModeSet) {
                parentLayer.blendMode = 'normal';
                parentLayer._blendModeSet = true;
            }
        }

        renderPreview(points, providedSettings = null, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings); // 🔧 統一判定

            if (points.length === 0) {
                return graphics;
            }

            this._ensureLayerBlendMode(graphics);

            // 🔧 mode に基づいて blendMode 設定
            if (mode === 'eraser') {
                graphics.blendMode = 'erase';
                console.log('[StrokeRenderer] Preview blendMode set to: erase');
            } else {
                graphics.blendMode = 'normal';
            }

            if (points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                
                if (mode === 'eraser') {
                    graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
                } else {
                    graphics.fill({ color: settings.color, alpha: settings.opacity || settings.alpha || 1.0 });
                }
                return graphics;
            }

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p2.x, p2.y);
                
                if (mode === 'eraser') {
                    graphics.stroke({
                        width: avgWidth,
                        color: 0xFFFFFF,
                        alpha: 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                } else {
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: settings.opacity || settings.alpha || 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            return graphics;
        }

        async renderFinalStroke(strokeData, providedSettings = null, targetGraphics = null) {
            const settings = this._getSettings(providedSettings);
            const minPoints = this.config.sdf?.minPointsForGPU || 5;

            if (this.msdfEnabled && this.webgpuComputeMSDF && strokeData.points.length > minPoints) {
                try {
                    return await this._renderFinalStrokeMSDF(strokeData, settings, targetGraphics);
                } catch (error) {
                    console.warn('[StrokeRenderer] WebGPU MSDF failed, fallback to SDF:', error);
                }
            }

            if (this.webgpuEnabled && this.webgpuComputeSDF && strokeData.points.length > minPoints) {
                try {
                    return await this._renderFinalStrokeWebGPU(strokeData, settings, targetGraphics);
                } catch (error) {
                    console.warn('[StrokeRenderer] WebGPU SDF failed, fallback to legacy:', error);
                }
            }

            return this._renderFinalStrokeLegacy(strokeData, settings, targetGraphics);
        }

        async _renderFinalStrokeMSDF(strokeData, settings, targetGraphics = null) {
            const points = strokeData.points;
            const mode = this._getCurrentMode(settings); // 🔧 統一判定
            
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            for (const p of points) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }

            const padding = settings.size * 3;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            const width = Math.ceil(maxX - minX);
            const height = Math.ceil(maxY - minY);

            const localPoints = points.map(p => ({
                x: p.x - minX,
                y: p.y - minY
            }));

            const msdfConfig = this.config.msdf || {};
            const msdfData = await this.webgpuComputeMSDF.generateMSDF(
                localPoints,
                width,
                height,
                settings.size * 2,
                msdfConfig.range || 4.0
            );

            if (!msdfData) {
                throw new Error('MSDF generation failed');
            }

            const msdfTexture = await this.textureBridge.msdfToPixiTexture(
                msdfData,
                width,
                height
            );

            if (!msdfTexture) {
                throw new Error('MSDF texture conversion failed');
            }

            const sprite = new PIXI.Sprite(msdfTexture);
            sprite.position.set(minX, minY);

            const msdfShader = this.msdfBrushShader.getMSDFShader({
                threshold: msdfConfig.threshold || 0.5,
                smoothness: msdfConfig.smoothness || 0.05
            });
            sprite.shader = msdfShader;

            // 🔧 mode に基づいて設定
            if (mode === 'eraser') {
                sprite.blendMode = 'erase';
                console.log('[StrokeRenderer] MSDF blendMode set to: erase');
            } else {
                sprite.tint = settings.color;
                sprite.alpha = settings.opacity || settings.alpha || 1.0;
                sprite.blendMode = 'normal';
            }

            return sprite;
        }

        async _renderFinalStrokeWebGPU(strokeData, settings, targetGraphics = null) {
            const points = strokeData.points;
            const mode = this._getCurrentMode(settings); // 🔧 統一判定
            
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            for (const p of points) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }

            const padding = settings.size * 3;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            const width = Math.ceil(maxX - minX);
            const height = Math.ceil(maxY - minY);

            const localPoints = points.map(p => ({
                x: p.x - minX,
                y: p.y - minY
            }));

            const sdfData = await this.webgpuComputeSDF.generateSDF(
                localPoints,
                width,
                height,
                settings.size * 2
            );

            if (!sdfData) {
                throw new Error('SDF generation failed');
            }

            const sdfTexture = await this.textureBridge.sdfToPixiTexture(
                sdfData,
                width,
                height
            );

            if (!sdfTexture) {
                throw new Error('SDF texture conversion failed');
            }

            const sprite = new PIXI.Sprite(sdfTexture);
            sprite.position.set(minX, minY);

            // 🔧 mode に基づいて設定
            if (mode === 'eraser') {
                sprite.blendMode = 'erase';
                console.log('[StrokeRenderer] SDF blendMode set to: erase');
            } else {
                sprite.tint = settings.color;
                sprite.alpha = settings.opacity || settings.alpha || 1.0;
                sprite.blendMode = 'normal';
            }

            return sprite;
        }

        _renderFinalStrokeLegacy(strokeData, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const mode = this._getCurrentMode(settings); // 🔧 統一判定

            this._ensureLayerBlendMode(graphics);

            // 🔧 mode に基づいて blendMode 設定
            if (mode === 'eraser') {
                graphics.blendMode = 'erase';
                console.log('[StrokeRenderer] Legacy blendMode set to: erase');
            } else {
                graphics.blendMode = 'normal';
            }

            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                return this.renderDot(strokeData.points[0], settings, graphics);
            }

            const points = strokeData.points;
            if (points.length === 0) {
                return graphics;
            }

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p2.x, p2.y);
                
                if (mode === 'eraser') {
                    graphics.stroke({
                        width: avgWidth,
                        color: 0xFFFFFF,
                        alpha: 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                } else {
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: settings.opacity || settings.alpha || 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            return graphics;
        }

        renderDot(point, providedSettings = null, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings); // 🔧 統一判定
            const width = this.calculateWidth(point.pressure, settings.size);

            this._ensureLayerBlendMode(graphics);

            // 🔧 mode に基づいて blendMode 設定
            if (mode === 'eraser') {
                graphics.blendMode = 'erase';
                console.log('[StrokeRenderer] Dot blendMode set to: erase');
            } else {
                graphics.blendMode = 'normal';
            }

            graphics.circle(point.x, point.y, width / 2);
            
            if (mode === 'eraser') {
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                graphics.fill({ color: settings.color, alpha: settings.opacity || settings.alpha || 1.0 });
            }

            return graphics;
        }

        renderStroke(layer, strokeData, providedSettings = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings); // 🔧 統一判定
            
            const graphics = this._renderFinalStrokeLegacy(strokeData, settings);
            
            return {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: graphics,
                points: strokeData.points,
                tool: mode, // 🔧 現在の mode を記録
                settings: { ...settings }
            };
        }

        updateResolution() {
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
        }
    }

    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ stroke-renderer.js (Phase 3-E - mode統合版) loaded');
    console.log('   ✓ _getCurrentMode() で統一判定');
    console.log('   ✓ settings.mode を優先使用');
    console.log('   ✓ blendMode="erase" 確実適用');
    console.log('   ✓ デバッグログ追加');

})();