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

import { Graphics, Mesh, Geometry } from 'pixi.js';
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
        const minRatio = 0.02; // クランプを 0.02 に変更
        const ratio = Math.max(minRatio, pressure ?? 0.5);
        return Math.max(this.minPhysicalWidth, brushSize * ratio);
    }

    renderPreview(points, providedSettings = null, targetGraphics = null) {
        const graphics = targetGraphics || new Graphics();
        const settings = this._getSettings(providedSettings);
        const mode = this._getCurrentMode(settings);

        if (points.length === 0) {
            return graphics;
        }

        graphics.clear();
        
        // 消しゴムの場合はプレビューを描画しない（カーソルのみで十分なため）
        if (mode === 'eraser') {
            return graphics;
        }

        graphics.blendMode = 'normal';

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

        const inputPoints = points.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
        const options = {
            size: settings.size,
            thinning: 0.7,
            smoothing: 0.4,
            streamline: 0.3,
            simulatePressure: false,
            last: true
        };
        
        const outlinePoints = getStroke(inputPoints, options);
        if (outlinePoints.length < 2) return graphics;

        graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
        
        if (mode === 'eraser') {
            graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
        } else {
            graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
        }

        return graphics;
    }

    async renderFinalStroke(strokeData, settings) {
        const mode = settings?.mode || this.currentTool || 'pen';
        
        if (mode === 'eraser') {
            return this._renderEraserStroke(strokeData, settings);
        }
        
        // Phase 1cではMesh経路を使わない。鋭角ストロークの三角形化を避けるため、Graphics.poly()に統一する。
        return this._renderFinalStrokeGraphics(strokeData, settings, mode);
    }

    async _renderWithPerfectFreehand(strokeData, settings) {
        const points = strokeData.points;
        if (!points || points.length < 2) return null;

        const vertexBuffer = this.glStrokeProcessor.createPolygonVertexBuffer(
            points,
            settings.size
        );
        
        if (!vertexBuffer || !vertexBuffer.buffer) {
            return null;
        }

        const geometry = new Geometry({
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

        const mesh = new Mesh({
            geometry: geometry
        });

        mesh.tint = settings.color;
        mesh.alpha = settings.opacity || 1.0;
        mesh.blendMode = 'normal';

        return mesh;
    }

    _renderEraserStroke(strokeData, settings) {
        const inputPoints = strokeData.points.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
        const options = {
            size: settings.size,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
            simulatePressure: false,
            last: true
        };
        
        if (strokeData.isSingleDot || strokeData.points.length === 1) {
            const p = strokeData.points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            const graphics = new Graphics();
            graphics.circle(p.x, p.y, width / 2);
            graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            graphics.blendMode = 'erase';
            return graphics;
        }

        const outlinePoints = getStroke(inputPoints, options);
        if (!outlinePoints || outlinePoints.length < 2) return null;

        const graphics = new Graphics();
        graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
        graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
        graphics.blendMode = 'erase';

        return graphics;
    }

    _renderFinalStrokeGraphics(strokeData, settings, mode) {
        const graphics = new Graphics();
        
        if (mode === 'eraser') {
            graphics.blendMode = 'erase';
        } else {
            graphics.blendMode = 'normal';
        }

        const inputPoints = strokeData.points.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
        const options = {
            size: settings.size,
            thinning: 0.7,
            smoothing: 0.4,
            streamline: 0.3,
            simulatePressure: false,
            last: true
        };

        if (strokeData.isSingleDot || strokeData.points.length === 1) {
            const p = strokeData.points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            return graphics;
        }

        const outlinePoints = getStroke(inputPoints, options);
        if (!outlinePoints || outlinePoints.length < 2) return null;

        graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
        
        if (mode === 'eraser') {
            graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
        } else {
            // ペンの場合は設定色と不透明度で塗る
            graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
        }

        return graphics;
    }

    renderDot(point, providedSettings = null, mode = 'pen', targetGraphics = null) {
        const graphics = targetGraphics || new Graphics();
        const settings = this._getSettings(providedSettings);
        const width = this.calculateWidth(point.pressure, settings.size);

        if (mode === 'eraser') {
            graphics.blendMode = 'erase';
        } else {
            graphics.blendMode = 'normal';
        }

        graphics.circle(point.x, point.y, width / 2);
        graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });

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
