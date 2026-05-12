/**
 * ============================================================================
 * ファイル名: system/drawing/stroke-renderer.js
 * 責務: ストロークの視覚化（プレビュー・最終描画）を担当する
 * 依存: pixi.js, config.js, brush-settings.js
 * 被依存: brush-core.js, core-engine.js等
 * 公開API: StrokeRenderer
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.StrokeRenderer
 * 実装状態: ♻️移植
 * ============================================================================
 */

import * as PIXI from 'pixi.js';
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
        const minRatio = Math.max(0.3, this.minPhysicalWidth);
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

        graphics.blendMode = 'normal';

        if (points.length === 1) {
            const p = points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            
            if (mode === 'eraser') {
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

    async renderFinalStroke(strokeData, providedSettings = null, targetGraphics = null) {
        const settings = this._getSettings(providedSettings);
        const mode = this._getCurrentMode(settings);
        
        if (mode === 'eraser') {
            return this._renderEraserStroke(strokeData, settings);
        }
        
        if (this.webgl2Enabled && this.glStrokeProcessor) {
            try {
                const mesh = await this._renderWithPerfectFreehand(strokeData, settings);
                if (mesh) {
                    return mesh;
                }
            } catch (error) {
                console.warn('[StrokeRenderer] Perfect-Freehand failed, fallback to legacy:', error);
            }
        }
        
        return this._renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics);
    }

    async _renderWithPerfectFreehand(strokeData, settings) {
        const points = strokeData.points;
        
        if (!points || points.length < 2) {
            return null;
        }

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

        if (vertexBuffer.bounds) {
            mesh.position.set(0, 0);
        }

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

        const points = strokeData.points;
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
                color: 0xFFFFFF,
                alpha: 1.0,
                cap: 'round',
                join: 'round'
            });
        }

        return graphics;
    }

    _renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics = null) {
        const graphics = targetGraphics || new PIXI.Graphics();
        
        graphics.blendMode = 'normal';

        if (strokeData.isSingleDot || strokeData.points.length === 1) {
            return this.renderDot(strokeData.points[0], settings, mode, graphics);
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

    renderDot(point, providedSettings = null, mode = 'pen', targetGraphics = null) {
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
        
        let graphics;
        if (mode === 'eraser') {
            graphics = this._renderEraserStroke(strokeData, settings);
        } else {
            graphics = this._renderFinalStrokeLegacy(strokeData, settings, mode);
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
