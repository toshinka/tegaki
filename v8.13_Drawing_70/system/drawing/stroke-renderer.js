/**
 * StrokeRenderer - ストローク描画専用クラス (Phase 3-B完全版)
 * 
 * 責務: ストロークデータ → PIXI描画オブジェクト変換
 * Phase 3-B改修: SDFプレビュー・Mesh描画完全実装
 * 
 * 描画方式:
 * - SDF Preview: 軽量化されたSDFプレビューメッシュ
 * - SDF Final: 最適化されたSDFバッチメッシュ
 * - Legacy: Graphics描画（後方互換・フォールバック用）
 * - Mask: RenderTextureへの消しゴム描画
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
            this.currentTool = 'pen'; // 'pen' or 'eraser'
            
            // Phase 3-B: SDF完全統合
            this.sdfEnabled = false;
            this.sdfShader = null;
            this.sdfTextureGen = null;
            this.brushTextures = null;
            this.sdfMeshBuilder = null;
            
            this._initializeSDF();
        }

        /**
         * Phase 3-B: SDF完全初期化
         */
        _initializeSDF() {
            if (!this.app || !this.app.renderer) {
                console.warn('[StrokeRenderer] Cannot initialize SDF: renderer not available');
                return;
            }

            try {
                // SDFシェーダー初期化
                if (window.SDFBrushShader) {
                    this.sdfShader = new window.SDFBrushShader();
                    this.sdfShader.initialize(this.app.renderer);
                }

                // SDFテクスチャ生成器初期化
                if (window.SDFTextureGenerator) {
                    this.sdfTextureGen = new window.SDFTextureGenerator(this.app.renderer);
                    this.brushTextures = this.sdfTextureGen.generateDefaultBrushSet();
                }

                // Phase 3-B: SDFMeshBuilder初期化
                if (window.SDFMeshBuilder) {
                    this.sdfMeshBuilder = new window.SDFMeshBuilder(this.app);
                }

                // SDF有効化チェック
                this.sdfEnabled = 
                    this.sdfShader?.isAvailable() && 
                    this.brushTextures !== null &&
                    this.sdfMeshBuilder !== null;

                if (this.sdfEnabled) {
                    console.log('✅ SDF rendering fully enabled (Phase 3-B)');
                    console.log('   ✓ Shader system ready');
                    console.log('   ✓ Texture generator ready');
                    console.log('   ✓ Mesh builder ready');
                } else {
                    console.warn('⚠️ SDF rendering not available, using legacy mode');
                }
            } catch (error) {
                console.error('❌ SDF initialization failed:', error);
                this.sdfEnabled = false;
            }
        }

        /**
         * 現在のツールを設定
         */
        setTool(tool) {
            this.currentTool = tool;
        }

        /**
         * 幅計算（プレビュー・確定共通）
         */
        calculateWidth(pressure, brushSize) {
            const minRatio = Math.max(0.3, this.minPhysicalWidth);
            const ratio = Math.max(minRatio, pressure || 0.5);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        /**
         * Phase 3-B: SDF有効/無効切り替え
         */
        setSDFEnabled(enabled) {
            if (!this.sdfShader || !this.brushTextures || !this.sdfMeshBuilder) {
                console.warn('[StrokeRenderer] SDF not available');
                return false;
            }
            this.sdfEnabled = enabled;
            console.log(`[StrokeRenderer] SDF rendering ${enabled ? 'enabled' : 'disabled'}`);
            return true;
        }

        /**
         * リアルタイムプレビュー描画
         * Phase 3-B: SDF完全対応
         */
        renderPreview(points, settings, targetGraphics = null) {
            // 消しゴムは常にレガシー描画（マスクテクスチャ用）
            if (this.currentTool === 'eraser') {
                return this._renderPreviewLegacy(points, settings, targetGraphics);
            }

            // SDF有効時はSDFプレビュー
            if (this.sdfEnabled) {
                return this._renderPreviewSDF(points, settings, targetGraphics);
            }

            // レガシーGraphics描画
            return this._renderPreviewLegacy(points, settings, targetGraphics);
        }

        /**
         * Phase 3-B: SDFプレビュー描画（Mesh使用）
         */
        _renderPreviewSDF(points, settings, targetGraphics) {
            if (points.length === 0) {
                return targetGraphics || new PIXI.Container();
            }

            // Containerを使用（Graphicsの代わり）
            const container = targetGraphics || new PIXI.Container();

            // 既存の子要素をクリア
            if (targetGraphics) {
                while (container.children.length > 0) {
                    const child = container.children[0];
                    container.removeChild(child);
                    if (child.destroy) {
                        child.destroy({ children: true });
                    }
                }
            }

            try {
                // シェーダー取得
                const shaderParams = this.sdfShader.getDefaultParams(
                    'pen',
                    points[points.length - 1]?.pressure || 0.5
                );
                const shader = this.sdfShader.getPenShader(shaderParams);

                if (!shader) {
                    console.warn('[StrokeRenderer] Failed to get SDF shader, falling back to legacy');
                    return this._renderPreviewLegacy(points, settings, targetGraphics);
                }

                // ブラシテクスチャ選択
                const brushTexture = this.brushTextures.softCircle;

                // プレビューメッシュ生成（軽量化版）
                const mesh = this.sdfMeshBuilder.createPreviewMesh(
                    points,
                    brushTexture,
                    settings.size,
                    shader,
                    settings.color,
                    settings.alpha || 1.0,
                    2 // 簡略化係数
                );

                if (mesh) {
                    container.addChild(mesh);
                }

                console.log(`[StrokeRenderer] SDF preview rendered: ${points.length} points`);
            } catch (error) {
                console.error('[StrokeRenderer] SDF preview failed:', error);
                // エラー時はレガシーにフォールバック
                return this._renderPreviewLegacy(points, settings, targetGraphics);
            }

            return container;
        }

        /**
         * レガシーGraphicsプレビュー描画
         */
        _renderPreviewLegacy(points, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();

            if (points.length === 0) {
                return graphics;
            }

            // 消しゴムモードの場合はblendModeを変更
            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            // 単独点の場合は円
            if (points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                
                if (this.currentTool === 'eraser') {
                    graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
                } else {
                    graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });
                }
                return graphics;
            }

            // PixiJS v8: 各線分ごとに stroke() を呼ぶ
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
                    color: this.currentTool === 'eraser' ? 0xFFFFFF : settings.color,
                    alpha: this.currentTool === 'eraser' ? 1.0 : (settings.alpha || 1.0),
                    cap: 'round',
                    join: 'round'
                });
            }

            return graphics;
        }

        /**
         * 確定ストローク描画（筆圧反映版）
         * Phase 3-B: SDF完全対応
         */
        renderFinalStroke(strokeData, settings, targetGraphics = null) {
            // 消しゴムは常にレガシー描画（マスクテクスチャ用）
            if (this.currentTool === 'eraser') {
                return this._renderFinalStrokeLegacy(strokeData, settings, targetGraphics);
            }

            // SDF有効時はSDFで描画
            if (this.sdfEnabled) {
                return this._renderFinalStrokeSDF(strokeData, settings);
            }

            // レガシーGraphics描画
            return this._renderFinalStrokeLegacy(strokeData, settings, targetGraphics);
        }

        /**
         * Phase 3-B: SDF確定ストローク描画（最適化Mesh）
         */
        _renderFinalStrokeSDF(strokeData, settings) {
            try {
                // シェーダー取得
                const avgPressure = strokeData.points.reduce((sum, p) => sum + (p.pressure || 0.5), 0) / strokeData.points.length;
                const shaderParams = this.sdfShader.getDefaultParams('pen', avgPressure);
                const shader = this.sdfShader.getPenShader(shaderParams);

                if (!shader) {
                    console.warn('[StrokeRenderer] Failed to get SDF shader for final stroke, falling back');
                    return this._renderFinalStrokeLegacy(strokeData, settings, null);
                }

                // ブラシテクスチャ選択（硬さに応じて）
                const hardness = 1.0 - (settings.alpha || 1.0) * 0.3;
                const brushTexture = hardness > 0.7 ? 
                    this.brushTextures.hardCircle : 
                    this.brushTextures.softCircle;

                // 最適化されたMesh生成
                const mesh = this.sdfMeshBuilder.createOptimizedStrokeMesh(
                    strokeData.points,
                    brushTexture,
                    settings.size,
                    shader,
                    settings.color,
                    settings.alpha || 1.0
                );

                if (!mesh) {
                    console.warn('[StrokeRenderer] Failed to create SDF mesh, falling back');
                    return this._renderFinalStrokeLegacy(strokeData, settings, null);
                }

                console.log(`[StrokeRenderer] SDF final stroke rendered: ${strokeData.points.length} points`);
                return mesh;

            } catch (error) {
                console.error('[StrokeRenderer] SDF final stroke failed:', error);
                return this._renderFinalStrokeLegacy(strokeData, settings, null);
            }
        }

        /**
         * レガシーGraphics確定ストローク描画
         */
        _renderFinalStrokeLegacy(strokeData, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                return this.renderDot(strokeData.points[0], settings, graphics);
            }

            const points = strokeData.points;
            if (points.length === 0) {
                return graphics;
            }

            // PixiJS v8: 各線分ごとに stroke() を呼ぶ
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
                    color: this.currentTool === 'eraser' ? 0xFFFFFF : settings.color,
                    alpha: this.currentTool === 'eraser' ? 1.0 : (settings.alpha || 1.0),
                    cap: 'round',
                    join: 'round'
                });
            }

            return graphics;
        }

        /**
         * 単独点描画（円）
         */
        renderDot(point, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const width = this.calculateWidth(point.pressure, settings.size);

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            graphics.circle(point.x, point.y, width / 2);
            graphics.fill({
                color: this.currentTool === 'eraser' ? 0xFFFFFF : settings.color,
                alpha: this.currentTool === 'eraser' ? 1.0 : (settings.alpha || 1.0)
            });

            return graphics;
        }

        /**
         * マスクテクスチャへ描画（消しゴム用）
         */
        renderToMask(maskTexture, strokeData, settings) {
            if (!maskTexture || !this.app || !this.app.renderer) {
                console.error('[StrokeRenderer] renderToMask: Invalid parameters');
                return false;
            }

            if (!strokeData || !strokeData.points || strokeData.points.length === 0) {
                console.error('[StrokeRenderer] renderToMask: No points');
                return false;
            }

            try {
                // 一時的なGraphicsを作成
                const tempGraphics = new PIXI.Graphics();
                
                // 消しゴムモード（blendMode='erase'）
                tempGraphics.blendMode = 'erase';

                // 単独点の場合
                if (strokeData.isSingleDot || strokeData.points.length === 1) {
                    const p = strokeData.points[0];
                    const width = this.calculateWidth(p.pressure || 0.5, settings.size);
                    
                    tempGraphics.circle(p.x, p.y, width / 2);
                    tempGraphics.fill({
                        color: 0xFFFFFF,
                        alpha: 1.0
                    });
                } else {
                    // 連続線の場合
                    for (let i = 0; i < strokeData.points.length - 1; i++) {
                        const p1 = strokeData.points[i];
                        const p2 = strokeData.points[i + 1];
                        
                        const w1 = this.calculateWidth(p1.pressure || 0.5, settings.size);
                        const w2 = this.calculateWidth(p2.pressure || 0.5, settings.size);
                        const avgWidth = (w1 + w2) / 2;

                        tempGraphics.moveTo(p1.x, p1.y);
                        tempGraphics.lineTo(p2.x, p2.y);
                        tempGraphics.stroke({
                            width: avgWidth,
                            color: 0xFFFFFF,
                            alpha: 1.0,
                            cap: 'round',
                            join: 'round'
                        });
                    }
                }

                // maskTextureに描画（累積モード）
                this.app.renderer.render({
                    container: tempGraphics,
                    target: maskTexture,
                    clear: false
                });

                // 一時Graphicsを破棄
                tempGraphics.destroy({ children: true });

                return true;

            } catch (error) {
                console.error('[StrokeRenderer] renderToMask failed:', error);
                return false;
            }
        }

        /**
         * 解像度更新（ウィンドウリサイズ時）
         */
        updateResolution() {
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
        }

        /**
         * Phase 3-B: SDF状態取得
         */
        getSDFStatus() {
            return {
                enabled: this.sdfEnabled,
                shaderAvailable: this.sdfShader?.isAvailable() || false,
                texturesAvailable: this.brushTextures !== null,
                meshBuilderAvailable: this.sdfMeshBuilder !== null,
                cacheSize: this.sdfTextureGen?.getCacheSize() || 0,
                phase: '3-B'
            };
        }
    }

    // グローバル登録
    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ system/drawing/stroke-renderer.js loaded (Phase 3-B完全版)');
    console.log('   ✓ SDF preview mesh rendering');
    console.log('   ✓ SDF final optimized mesh');
    console.log('   ✓ Automatic fallback to legacy');
    console.log('   ✓ Mask rendering support');

})();