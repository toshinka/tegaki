/**
 * StrokeRenderer - Phase 1: BrushSettings統一版
 * settingsパラメータを受け取るが、無ければwindow.brushSettingsを参照
 * 
 * 描画方式優先順位:
 * 1. WebGPU MSDF（最高品質）
 * 2. WebGPU SDF（高品質）
 * 3. Legacy Graphics（フォールバック）
 * 
 * 消しゴム: 'erase' blendMode（レイヤー内アルファのみ削除）
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
            this.currentTool = 'pen';
            
            // WebGPU関連
            this.webgpuLayer = null;
            this.webgpuComputeSDF = null;
            this.webgpuComputeMSDF = null;
            this.textureBridge = null;
            this.webgpuEnabled = false;
            
            // MSDF関連
            this.msdfBrushShader = null;
            this.msdfEnabled = false;
            
            // 設定
            this.config = window.TEGAKI_CONFIG?.webgpu || {};
        }

        // ★Phase 1追加: 設定取得ヘルパー
        _getSettings(providedSettings = null) {
            if (providedSettings) {
                return providedSettings;
            }
            
            if (window.brushSettings) {
                return window.brushSettings.getSettings();
            }
            
            console.warn('[StrokeRenderer] No settings available, using defaults');
            return {
                size: 3,
                opacity: 1.0,
                color: 0x800000
            };
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
                console.log('[StrokeRenderer] WebGPU + MSDF integration enabled');
            }
        }

        setTool(tool) {
            this.currentTool = tool;
            console.log(`[StrokeRenderer] Tool set to: ${tool}`);
        }

        calculateWidth(pressure, brushSize) {
            const minRatio = Math.max(0.3, this.minPhysicalWidth);
            const ratio = Math.max(minRatio, pressure || 0.5);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        // ★Phase 1修正: settingsパラメータはオプションに
        renderPreview(points, providedSettings = null, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);

            if (points.length === 0) {
                return graphics;
            }

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            } else {
                graphics.blendMode = 'normal';
            }

            if (points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                
                if (this.currentTool === 'eraser') {
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
                
                if (this.currentTool === 'eraser') {
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

        // ★Phase 1修正: settingsパラメータはオプションに
        async renderFinalStroke(strokeData, providedSettings = null, targetGraphics = null) {
            const settings = this._getSettings(providedSettings);
            const minPoints = this.config.sdf?.minPointsForGPU || 5;

            // 1. WebGPU MSDF
            if (this.msdfEnabled && this.webgpuComputeMSDF && strokeData.points.length > minPoints) {
                try {
                    return await this._renderFinalStrokeMSDF(strokeData, settings, targetGraphics);
                } catch (error) {
                    console.warn('[StrokeRenderer] WebGPU MSDF failed, fallback to SDF:', error);
                }
            }

            // 2. WebGPU SDF
            if (this.webgpuEnabled && this.webgpuComputeSDF && strokeData.points.length > minPoints) {
                try {
                    return await this._renderFinalStrokeWebGPU(strokeData, settings, targetGraphics);
                } catch (error) {
                    console.warn('[StrokeRenderer] WebGPU SDF failed, fallback to legacy:', error);
                }
            }

            // 3. Legacy Graphics
            return this._renderFinalStrokeLegacy(strokeData, settings, targetGraphics);
        }

        async _renderFinalStrokeMSDF(strokeData, settings, targetGraphics = null) {
            const points = strokeData.points;
            
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

            if (this.currentTool === 'eraser') {
                sprite.blendMode = 'erase';
            } else {
                sprite.tint = settings.color;
                sprite.alpha = settings.opacity || settings.alpha || 1.0;
            }

            return sprite;
        }

        async _renderFinalStrokeWebGPU(strokeData, settings, targetGraphics = null) {
            const points = strokeData.points;
            
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

            if (this.currentTool === 'eraser') {
                sprite.blendMode = 'erase';
            } else {
                sprite.tint = settings.color;
                sprite.alpha = settings.opacity || settings.alpha || 1.0;
            }

            return sprite;
        }

        _renderFinalStrokeLegacy(strokeData, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
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
                
                if (this.currentTool === 'eraser') {
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
            const width = this.calculateWidth(point.pressure, settings.size);

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            } else {
                graphics.blendMode = 'normal';
            }

            graphics.circle(point.x, point.y, width / 2);
            
            if (this.currentTool === 'eraser') {
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                graphics.fill({ color: settings.color, alpha: settings.opacity || settings.alpha || 1.0 });
            }

            return graphics;
        }

        // ★Phase 1追加: renderStroke()メソッド（BrushCoreから呼ばれる）
        renderStroke(layer, strokeData, providedSettings = null) {
            const settings = this._getSettings(providedSettings);
            
            // 同期的にLegacy描画を実行
            const graphics = this._renderFinalStrokeLegacy(strokeData, settings);
            
            // pathDataオブジェクトを返す
            return {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: graphics,
                points: strokeData.points,
                tool: this.currentTool,
                settings: { ...settings }
            };
        }

        updateResolution() {
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
        }
    }

    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ stroke-renderer.js (Phase 1: BrushSettings統一版) loaded');
    console.log('   ✓ Settings parameter now optional');
    console.log('   ✓ Falls back to window.brushSettings');
    console.log('   ✓ renderStroke() method added for BrushCore');

})();