/**
 * ============================================================================
 * ファイル名: system/drawing/stroke-renderer.js
 * 責務: ストロークの視覚化（プレビュー・最終描画）を担当する。Perfect-Freehandを使用したポリゴン描画を基本とする。
 * 依存: pixi.js, config.js, brush-settings.js, perfect-freehand
 * 被依存: brush-core.js, core-engine.js等
 * 公開API: StrokeRenderer
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.StrokeRenderer
 * 実装状態: ♻️移植・最適化
 * ============================================================================
 */

import * as PIXI from 'pixi.js';
import { getStroke } from 'perfect-freehand';
import { TEGAKI_CONFIG } from '../../config.js';

export class StrokeRenderer {
    constructor(app, layerSystem, cameraSystem) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.resolution = 1; // Phase 1: DPR=1固定
        this.minPhysicalWidth = 1 / this.resolution;
        this.currentTool = 'pen';
        
        this.glStrokeProcessor = null;
        this.glMSDFPipeline = null;
        this.textureBridge = null;
        this.webgl2Enabled = false;
        
        this.config = TEGAKI_CONFIG?.webgpu || {};
    }

    async setWebGLLayer(webgl2Layer) {
        this.glStrokeProcessor = window.GLStrokeProcessor;
        
        if (!this.glStrokeProcessor) {
            console.error('[StrokeRenderer] GLStrokeProcessor not available');
            return false;
        }
        
        if (!this.glStrokeProcessor.isInitialized()) {
            console.error('[StrokeRenderer] GLStrokeProcessor not initialized');
            return false;
        }
        
        if (window.GLMSDFPipeline && this.config.msdf?.enabled !== false) {
            this.glMSDFPipeline = window.GLMSDFPipeline;
        }
        
        if (window.GLTextureBridge) {
            this.textureBridge = window.GLTextureBridge;
        }
        
        this.webgl2Enabled = true;
        return true;
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

    setTool(tool) {
        this.currentTool = tool;
    }

    calculateWidth(pressure, brushSize) {
        const minRatio = 0.3;
        const ratio = Math.max(minRatio, pressure || 0.5);
        return Math.max(this.minPhysicalWidth, brushSize * ratio);
    }

    renderPreview(points, providedSettings = null, targetGraphics = null) {
        const graphics = targetGraphics || new PIXI.Graphics();
        const settings = this._getSettings(providedSettings);
        const mode = this._getCurrentMode(settings);

        if (points.length === 0) {
            return graphics;
        }

        graphics.clear();
        
        if (mode === 'eraser') {
            graphics.blendMode = 'erase';
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
                graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
            }
            return graphics;
        }

        // Perfect-Freehandを使用したポリゴン生成
        const strokePoints = points.map(p => [p.x, p.y, p.pressure]);
        const options = {
            size: settings.size,
            thinning: 0.7,
            smoothing: 0.4,
            streamline: 0.3,
            simulatePressure: false,
            last: true
        };
        
        const outlinePoints = getStroke(strokePoints, options);
        if (outlinePoints.length < 2) return graphics;

        // 🆕 v8.17: graphics.poly() を使用して輪郭を塗る（closePathでの斜め線を防止）
        graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));

        if (mode === 'eraser') {
            graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
        } else {
            graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
        }

        return graphics;
    }

    async renderFinalStroke(strokeData, providedSettings = null) {
        const settings = this._getSettings(providedSettings);
        const mode = this._getCurrentMode(settings);
        
        if (mode === 'eraser') {
            return this._renderEraserStroke(strokeData, settings);
        }
        
        // WebGL2が有効な場合はメッシュで描画
        if (this.webgl2Enabled && this.glStrokeProcessor) {
            try {
                const mesh = await this._renderWithPerfectFreehand(strokeData, settings);
                if (mesh) {
                    return mesh;
                }
            } catch (error) {
                console.warn('[StrokeRenderer] WebGL2 mesh render failed, fallback to Graphics:', error);
            }
        }
        
        // フォールバック: Graphicsによる描画（getStrokeを使用）
        return this._renderFinalStrokeGraphics(strokeData, settings, mode);
    }

    async _renderWithPerfectFreehand(strokeData, settings) {
        // 注: ユーザーからの指示に基づき、もしWebGL2パスでも問題が出る場合は
        // ここをGraphics版に差し替えることも可能だが、一旦Meshロジックは維持。
        // もしMeshで問題が出る場合は、このメソッド自体を以下のGraphics生成に書き換える。
        
        const points = strokeData.points;
        if (!points || points.length < 2) return null;

        const vertexBuffer = this.glStrokeProcessor.createPolygonVertexBuffer(
            points,
            settings.size
        );
        
        if (!vertexBuffer || !vertexBuffer.buffer) {
            return null;
        }

        const geometry = new PIXI.Geometry({
            attributes: {
                aPosition: {
                    buffer: vertexBuffer.buffer,
                    size: 3,
                    stride: 28,
                    offset: 0
                },
                aUV: {
                    buffer: vertexBuffer.buffer,
                    size: 2,
                    stride: 28,
                    offset: 12
                }
            }
        });

        const mesh = new PIXI.Mesh({
            geometry: geometry
        });

        mesh.tint = settings.color;
        mesh.alpha = settings.opacity || 1.0;
        mesh.blendMode = 'normal';

        return mesh;
    }

    _renderEraserStroke(strokeData, settings) {
        const graphics = new PIXI.Graphics();
        graphics.blendMode = 'erase';
        
        if (strokeData.isSingleDot || strokeData.points.length === 1) {
            const p = strokeData.points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            return graphics;
        }

        const strokePoints = strokeData.points.map(p => [p.x, p.y, p.pressure]);
        const options = {
            size: settings.size,
            thinning: 0.7,
            smoothing: 0.4,
            streamline: 0.3,
            simulatePressure: false,
            last: true
        };
        
        const outlinePoints = getStroke(strokePoints, options);
        if (outlinePoints.length < 2) return graphics;

        // 🆕 graphics.poly() 使用
        graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
        graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });

        return graphics;
    }

    _renderFinalStrokeGraphics(strokeData, settings, mode) {
        const graphics = new PIXI.Graphics();
        
        if (mode === 'eraser') {
            graphics.blendMode = 'erase';
        } else {
            graphics.blendMode = 'normal';
        }

        if (strokeData.isSingleDot || strokeData.points.length === 1) {
            const p = strokeData.points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            graphics.fill({ color: mode === 'eraser' ? 0xFFFFFF : settings.color, alpha: settings.opacity || 1.0 });
            return graphics;
        }

        const strokePoints = strokeData.points.map(p => [p.x, p.y, p.pressure]);
        const options = {
            size: settings.size,
            thinning: 0.7,
            smoothing: 0.4,
            streamline: 0.3,
            simulatePressure: false,
            last: true
        };

        const outlinePoints = getStroke(strokePoints, options);
        if (outlinePoints.length < 2) return graphics;

        // 🆕 graphics.poly() 使用
        graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
        graphics.fill({ color: mode === 'eraser' ? 0xFFFFFF : settings.color, alpha: settings.opacity || 1.0 });

        return graphics;
    }

    renderDot(point, providedSettings = null, mode = 'pen', targetGraphics = null) {
        const graphics = targetGraphics || new PIXI.Graphics();
        const settings = this._getSettings(providedSettings);
        const width = this.calculateWidth(point.pressure, settings.size);

        if (mode === 'eraser') {
            graphics.blendMode = 'erase';
        } else {
            graphics.blendMode = 'normal';
        }

        graphics.circle(point.x, point.y, width / 2);
        graphics.fill({ color: mode === 'eraser' ? 0xFFFFFF : settings.color, alpha: settings.opacity || 1.0 });

        return graphics;
    }

    renderStroke(layer, strokeData, providedSettings = null) {
        const settings = this._getSettings(providedSettings);
        const mode = this._getCurrentMode(settings);
        
        let graphics;
        if (mode === 'eraser') {
            graphics = this._renderEraserStroke(strokeData, settings);
        } else {
            graphics = this._renderFinalStrokeGraphics(strokeData, settings, mode);
        }
        
        return {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: graphics,
            points: strokeData.points,
            tool: mode,
            settings: { ...settings }
        };
    }

    updateResolution() {
        this.resolution = 1;
        this.minPhysicalWidth = 1 / this.resolution;
    }
}

// 下位互換性のためにグローバルに登録
window.StrokeRenderer = StrokeRenderer;
