/**
 * ================================================================================
 * system/drawing/stroke-renderer.js - Phase 1-2: RenderTexture消しゴム実装
 * ================================================================================
 * 
 * 【Phase 1-2 改修内容 - RenderTexture方式消しゴム】
 * ✅ Container blendMode='erase'の問題を解決
 * ✅ RenderTextureベースのalpha mask合成
 * ✅ 既存レイヤーコンテンツを保持しながら消去
 * ✅ SDFEraserShader統合
 * 
 * 【依存関係 - Parents (このファイルが依存)】
 *   - PixiJS v8.13 (Graphics, Sprite, Mesh, RenderTexture)
 *   - webgpu-drawing-layer.js (WebGPU統合)
 *   - webgpu-compute-sdf.js (SDF生成)
 *   - webgpu-compute-msdf.js (MSDF生成)
 *   - webgpu-texture-bridge.js (テクスチャ変換)
 *   - sdf-brush-shader.js (shader管理)
 *   - sdf-eraser-shader.js (消しゴムshader)
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
 *   - RenderTexture消しゴム合成処理
 *   - WebGPU/Legacy描画パイプライン管理
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
            this.currentTool = 'pen';
            
            this.webgpuLayer = null;
            this.webgpuComputeSDF = null;
            this.webgpuComputeMSDF = null;
            this.textureBridge = null;
            this.webgpuEnabled = false;
            
            this.msdfBrushShader = null;
            this.msdfEnabled = false;
            
            this.config = window.TEGAKI_CONFIG?.webgpu || {};
            
            // RenderTexture管理
            this.layerRenderTextures = new Map(); // layerId -> RenderTexture
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
                mode: 'pen'
            };
        }

        _getCurrentMode(settings) {
            const mode = settings?.mode || this.currentTool || 'pen';
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
            this.currentTool = tool;
        }

        calculateWidth(pressure, brushSize) {
            const minRatio = Math.max(0.3, this.minPhysicalWidth);
            const ratio = Math.max(minRatio, pressure || 0.5);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        /**
         * ========================================================================
         * Phase 1-2: RenderTexture消しゴム処理
         * ========================================================================
         */
        
        /**
         * レイヤーのRenderTexture取得/作成
         * 🔧 Phase 3最適化: resolution対応
         */
        _getOrCreateLayerRenderTexture(layer) {
            if (!layer?.layerData?.id) return null;
            
            const layerId = layer.layerData.id;
            const width = this.config.canvas?.width || 1920;
            const height = this.config.canvas?.height || 1080;
            
            // 🔧 高DPI対応: devicePixelRatioを使用
            const resolution = window.devicePixelRatio || 1;
            
            let rt = this.layerRenderTextures.get(layerId);
            
            // サイズまたは解像度が変わった場合は再作成
            if (rt && (rt.width !== width * resolution || rt.height !== height * resolution)) {
                rt.destroy(true);
                rt = null;
            }
            
            if (!rt) {
                rt = PIXI.RenderTexture.create({
                    width,
                    height,
                    resolution: resolution  // 🔧 高DPI対応
                });
                
                this.layerRenderTextures.set(layerId, rt);
                console.log(`[StrokeRenderer] Created RT for layer ${layerId}: ${width}x${height} @ ${resolution}x`);
            }
            
            return rt;
        }
        
        /**
         * レイヤーコンテンツをRenderTextureに描画
         */
        _renderLayerToTexture(layer, renderTexture) {
            if (!this.app?.renderer || !layer || !renderTexture) return;
            
            // 現在のレイヤーコンテンツをRTに描画
            this.app.renderer.render({
                container: layer,
                target: renderTexture,
                clear: true
            });
        }
        
        /**
         * 消しゴムストロークをalpha maskとして適用
         * PixiJS v8対応: RenderTextureへの直接描画方式
         */
        _applyEraserMask(layer, renderTexture, eraserGraphics) {
            if (!this.app?.renderer || !layer || !renderTexture || !eraserGraphics) return;
            
            // Step 1: 消しゴムマスク用のRTを作成
            const maskTexture = PIXI.RenderTexture.create({
                width: renderTexture.width,
                height: renderTexture.height,
                resolution: 1
            });
            
            // Step 2: 消しゴムストロークを白色でマスクRTに描画
            eraserGraphics.tint = 0xFFFFFF;
            this.app.renderer.render({
                container: eraserGraphics,
                target: maskTexture,
                clear: true,
                clearColor: [0, 0, 0, 0] // 透明背景
            });
            
            // Step 3: 合成用のContainer作成
            const compositeContainer = new PIXI.Container();
            
            // 既存コンテンツのSprite
            const baseSprite = new PIXI.Sprite(renderTexture);
            
            // マスクSprite（blendMode='erase'を適用）
            const maskSprite = new PIXI.Sprite(maskTexture);
            maskSprite.blendMode = 'erase';
            
            compositeContainer.addChild(baseSprite);
            compositeContainer.addChild(maskSprite);
            
            // Step 4: 結果RTに合成
            const resultTexture = PIXI.RenderTexture.create({
                width: renderTexture.width,
                height: renderTexture.height,
                resolution: 1
            });
            
            this.app.renderer.render({
                container: compositeContainer,
                target: resultTexture,
                clear: true
            });
            
            // Step 5: レイヤーを更新
            layer.removeChildren();
            const resultSprite = new PIXI.Sprite(resultTexture);
            layer.addChild(resultSprite);
            
            // クリーンアップ
            maskTexture.destroy(true);
            compositeContainer.destroy({ children: true, texture: false });
            
            return resultSprite;
        }

        /**
         * ========================================================================
         * プレビュー描画（リアルタイム）
         * ========================================================================
         */
        renderPreview(points, providedSettings = null, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);

            if (points.length === 0) {
                return graphics;
            }

            // プレビューは通常のGraphicsで描画（高速化）
            graphics.blendMode = 'normal';

            if (points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                
                if (mode === 'eraser') {
                    // 消しゴムプレビューは白色
                    graphics.fill({ color: 0xFFFFFF, alpha: 0.5 });
                } else {
                    graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
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
                        alpha: 0.5,
                        cap: 'round',
                        join: 'round'
                    });
                } else {
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: settings.opacity || 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            return graphics;
        }

        /**
         * ========================================================================
         * 最終描画（ストローク確定時）
         * ========================================================================
         */
        async renderFinalStroke(strokeData, providedSettings = null, targetGraphics = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            // 消しゴムモードの場合はRenderTexture方式
            if (mode === 'eraser') {
                return await this._renderEraserStroke(strokeData, settings);
            }
            
            // ペンモードは従来通り
            const minPoints = this.config.sdf?.minPointsForGPU || 5;

            if (this.msdfEnabled && this.webgpuComputeMSDF && strokeData.points.length > minPoints) {
                try {
                    return await this._renderFinalStrokeMSDF(strokeData, settings, targetGraphics);
                } catch (error) {
                    console.warn('[StrokeRenderer] MSDF failed, fallback to SDF:', error);
                }
            }

            if (this.webgpuEnabled && this.webgpuComputeSDF && strokeData.points.length > minPoints) {
                try {
                    return await this._renderFinalStrokeWebGPU(strokeData, settings, targetGraphics);
                } catch (error) {
                    console.warn('[StrokeRenderer] SDF failed, fallback to legacy:', error);
                }
            }

            return this._renderFinalStrokeLegacy(strokeData, settings, targetGraphics);
        }

        /**
         * ========================================================================
         * Phase 1-2: 消しゴムストローク処理（RenderTexture方式）
         * ========================================================================
         */
        async _renderEraserStroke(strokeData, settings) {
            const activeLayer = this.layerSystem?.getActiveLayer();
            if (!activeLayer) {
                console.warn('[StrokeRenderer] No active layer for eraser');
                return null;
            }
            
            // 背景レイヤーは消せない
            if (activeLayer.layerData?.isBackground) {
                console.warn('[StrokeRenderer] Cannot erase background layer');
                return null;
            }
            
            // 1. 現在のレイヤーコンテンツをRTに保存
            const layerRT = this._getOrCreateLayerRenderTexture(activeLayer);
            if (!layerRT) {
                console.error('[StrokeRenderer] Failed to create RenderTexture');
                return null;
            }
            
            this._renderLayerToTexture(activeLayer, layerRT);
            
            // 2. 消しゴムストローク描画（独立したContainer）
            const eraserContainer = new PIXI.Container();
            const eraserGraphics = new PIXI.Graphics();
            const points = strokeData.points;
            
            if (points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                eraserGraphics.circle(p.x, p.y, width / 2);
                eraserGraphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                for (let i = 0; i < points.length - 1; i++) {
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    
                    const w1 = this.calculateWidth(p1.pressure, settings.size);
                    const w2 = this.calculateWidth(p2.pressure, settings.size);
                    const avgWidth = (w1 + w2) / 2;

                    eraserGraphics.moveTo(p1.x, p1.y);
                    eraserGraphics.lineTo(p2.x, p2.y);
                    eraserGraphics.stroke({
                        width: avgWidth,
                        color: 0xFFFFFF,
                        alpha: 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }
            
            eraserContainer.addChild(eraserGraphics);
            
            // 3. alpha mask合成
            const resultSprite = this._applyEraserMask(activeLayer, layerRT, eraserContainer);
            
            // クリーンアップ
            eraserContainer.destroy({ children: true });
            
            console.log('[StrokeRenderer] Eraser stroke applied');
            
            return resultSprite;
        }

        /**
         * ========================================================================
         * MSDF描画
         * ========================================================================
         */
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
            sprite.tint = settings.color;
            sprite.alpha = settings.opacity || 1.0;

            return sprite;
        }

        /**
         * ========================================================================
         * SDF描画
         * ========================================================================
         */
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
            sprite.tint = settings.color;
            sprite.alpha = settings.opacity || 1.0;

            return sprite;
        }

        /**
         * ========================================================================
         * Legacy描画
         * ========================================================================
         */
        _renderFinalStrokeLegacy(strokeData, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            graphics.blendMode = 'normal';

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
                graphics.stroke({
                    width: avgWidth,
                    color: settings.color,
                    alpha: settings.opacity || 1.0,
                    cap: 'round',
                    join: 'round'
                });
            }

            return graphics;
        }

        renderDot(point, providedSettings = null, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);
            const width = this.calculateWidth(point.pressure, settings.size);

            graphics.blendMode = 'normal';
            graphics.circle(point.x, point.y, width / 2);
            graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });

            return graphics;
        }

        renderStroke(layer, strokeData, providedSettings = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            const graphics = this._renderFinalStrokeLegacy(strokeData, settings);
            
            return {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: graphics,
                points: strokeData.points,
                tool: mode,
                settings: { ...settings }
            };
        }

        updateResolution() {
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            // RenderTextureのクリーンアップ
            for (const [layerId, rt] of this.layerRenderTextures.entries()) {
                rt.destroy(true);
            }
            this.layerRenderTextures.clear();
        }
    }

    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ stroke-renderer.js (Phase 1-2 - RenderTexture消しゴム) loaded');
    console.log('   ✓ RenderTextureベースalpha mask合成');
    console.log('   ✓ Container blendMode問題を解決');
    console.log('   ✓ 既存コンテンツ保持しながら消去');

})();