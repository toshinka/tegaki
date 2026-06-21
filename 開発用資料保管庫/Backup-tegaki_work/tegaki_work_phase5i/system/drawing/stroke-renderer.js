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

import { Graphics, Mesh, Geometry, Container, Sprite, BlurFilter, RenderTexture } from 'pixi.js';
import { getStroke } from 'perfect-freehand';
import { TEGAKI_CONFIG } from '../../config.js';
import { AirbrushDabRenderer } from './airbrush-dab-renderer.js';

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
        this.airbrushDabRenderer = new AirbrushDabRenderer({
            calculateWidth: (pressure, size) => this.calculateWidth(pressure, size)
        });
        
        this.config = window.TEGAKI_CONFIG?.webgpu || {};
    }

    async setWebGLLayer(webgl2Layer) {
        if (!this.config.enabled) {
            this.webgl2Enabled = false;
            return false;
        }
        return false;
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
        const minRatio = 0.02;
        // フォールバックを 0.5 → 0.0 に変更。
        // pressure が未定義のとき（ペンダウン直後）は極細から始まる。
        // マウス入力は pointer-handler.js 側で 0.5 に補完されるためここは 0.0 でよい。
        const ratio = Math.max(minRatio, pressure ?? 0.0);
        return Math.max(this.minPhysicalWidth, brushSize * ratio);
    }

    /**
     * [指示書] 消しゴムのリアルタイム反映用：短いセグメント用の実描画Graphicsを生成
     */
    renderEraserSegment(points, settings) {
        return this._renderLineSegment(points, {
            ...settings,
            mode: 'eraser',
            pressureEnabled: settings.eraserPressureEnabled === true
        });
    }

    /**
     * [指示書] ペンのリアルタイム反映用：短いセグメント用の実描画Graphicsを生成
     * Graphics.moveTo/lineTo + stroke を使用する。
     */
    renderPenSegment(points, settings) {
        return this._renderLineSegment(points, {
            ...settings,
            mode: 'pen',
            pressureEnabled: settings.pressureEnabled === true
        });
    }

    /**
     * Phase 3a: エアブラシのリアルタイム焼き込み用コンテナを生成する。
     * state は BrushCore 側でストローク中だけ保持し、スタンプ間隔の端数を持ち越す。
     */
    renderAirbrushSegment(points, settings, state = {}) {
        return this.airbrushDabRenderer.renderSegment(points, settings, state);
    }

    /**
     * Phase 5g Slice 1: 現行airbrush経路を一時RenderTextureへ反復描画し、
     * pixel値と簡易profileを返す。通常実行では使用せずdebug時だけ許可する。
     */
    diagnoseAirbrushComposition(options = {}) {
        if (!TEGAKI_CONFIG.debug) {
            throw new Error('[StrokeRenderer] Airbrush diagnostics require TEGAKI_CONFIG.debug = true');
        }
        if (!this.app?.renderer) {
            throw new Error('[StrokeRenderer] Renderer is not available');
        }

        const baseSettings = this._getSettings();
        const settings = {
            ...baseSettings,
            mode: 'airbrush',
            size: Math.max(4, Number(options.size ?? baseSettings.size ?? 30)),
            color: Number(options.color ?? baseSettings.color ?? 0x800000),
            opacity: Math.max(0, Math.min(1, Number(options.opacity ?? baseSettings.opacity ?? 1))),
            pressureEnabled: false,
            airbrushSpacingRatio: Number(options.spacingRatio ?? baseSettings.airbrushSpacingRatio ?? 0.1),
            airbrushFlow: Number(options.flow ?? baseSettings.airbrushFlow ?? 0.08),
            airbrushSoftness: Number(options.softness ?? baseSettings.airbrushSoftness ?? 0.8),
            airbrushScatter: Number(options.scatter ?? baseSettings.airbrushScatter ?? 0)
        };
        const width = Math.max(64, Math.round(options.width ?? 192));
        const height = Math.max(64, Math.round(options.height ?? 96));
        const repetitions = Array.from(new Set(
            (options.repetitions || [1, 2, 4, 8, 16, 32, 64])
                .map(value => Math.max(1, Math.round(Number(value) || 1)))
        )).sort((a, b) => a - b);
        const path = options.path === 'line' ? 'line' : 'point';
        const backgroundColor = options.backgroundColor === undefined
            ? null
            : Number(options.backgroundColor);
        const target = RenderTexture.create({ width, height, resolution: 1 });
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const lineInset = Math.max(settings.size, 16);
        const points = path === 'line'
            ? [
                { x: lineInset, y: centerY, pressure: 1 },
                { x: width - lineInset, y: centerY, pressure: 1 }
            ]
            : [{ x: centerX, y: centerY, pressure: 1 }];
        const results = [];

        try {
            if (backgroundColor !== null) {
                const background = new Graphics();
                background.rect(0, 0, width, height);
                background.fill({ color: backgroundColor, alpha: 1 });
                this.app.renderer.render({
                    container: background,
                    target,
                    clear: true,
                    clearColor: [0, 0, 0, 0]
                });
                background.destroy();
            } else {
                const empty = new Container();
                this.app.renderer.render({
                    container: empty,
                    target,
                    clear: true,
                    clearColor: [0, 0, 0, 0]
                });
                empty.destroy();
            }

            let rendered = 0;
            const maximum = repetitions[repetitions.length - 1];
            for (let count = 1; count <= maximum; count++) {
                const renderContainer = this.renderAirbrushSegment(points, settings, {});
                if (renderContainer) {
                    this.app.renderer.render({
                        container: renderContainer,
                        target,
                        clear: false
                    });
                    renderContainer.destroy({ children: true });
                }
                rendered++;

                if (repetitions.includes(rendered)) {
                    const extracted = this.app.renderer.extract.pixels({ target });
                    const sourcePixels = extracted?.pixels
                        || (extracted instanceof Uint8ClampedArray
                            ? extracted
                            : new Uint8ClampedArray(extracted?.buffer || extracted));
                    const pixels = new Uint8ClampedArray(sourcePixels);
                    const sampleWidth = Math.round(extracted?.width || width);
                    const sampleHeight = Math.round(extracted?.height || height);
                    const center = this._readAirbrushDiagnosticPixel(
                        pixels,
                        sampleWidth,
                        sampleHeight,
                        centerX,
                        centerY
                    );
                    const targetColor = {
                        r: (settings.color >> 16) & 0xff,
                        g: (settings.color >> 8) & 0xff,
                        b: settings.color & 0xff
                    };
                    results.push({
                        repetitions: rendered,
                        center: {
                            ...center,
                            target: targetColor,
                            straightDelta: {
                                r: center.straight.r - targetColor.r,
                                g: center.straight.g - targetColor.g,
                                b: center.straight.b - targetColor.b
                            }
                        },
                        profile: this._summarizeAirbrushDiagnosticProfile(
                            pixels,
                            sampleWidth,
                            sampleHeight,
                            centerY,
                            path === 'line' ? lineInset : centerX - Math.ceil(settings.size / 2),
                            path === 'line' ? width - lineInset : centerX + Math.ceil(settings.size / 2)
                        )
                    });
                }
            }
        } finally {
            target.destroy(true);
        }

        return {
            path,
            width,
            height,
            backgroundColor,
            settings: {
                size: settings.size,
                color: settings.color,
                opacity: settings.opacity,
                spacingRatio: settings.airbrushSpacingRatio ?? null,
                flow: settings.airbrushFlow,
                softness: settings.airbrushSoftness,
                scatter: settings.airbrushScatter
            },
            results
        };
    }

    _readAirbrushDiagnosticPixel(pixels, width, height, x, y) {
        const px = Math.max(0, Math.min(width - 1, Math.round(x)));
        const py = Math.max(0, Math.min(height - 1, Math.round(y)));
        const index = (py * width + px) * 4;
        const raw = {
            r: pixels[index] ?? 0,
            g: pixels[index + 1] ?? 0,
            b: pixels[index + 2] ?? 0,
            a: pixels[index + 3] ?? 0
        };
        const alphaScale = raw.a > 0 && raw.a < 255 ? 255 / raw.a : 1;

        return {
            raw,
            straight: {
                r: Math.min(255, Math.round(raw.r * alphaScale)),
                g: Math.min(255, Math.round(raw.g * alphaScale)),
                b: Math.min(255, Math.round(raw.b * alphaScale)),
                a: raw.a
            }
        };
    }

    _summarizeAirbrushDiagnosticProfile(pixels, width, height, y, startX, endX) {
        const alphaValues = [];
        const lumaValues = [];
        const from = Math.max(0, Math.min(width - 1, Math.round(startX)));
        const to = Math.max(from, Math.min(width - 1, Math.round(endX)));

        for (let x = from; x <= to; x++) {
            const sample = this._readAirbrushDiagnosticPixel(pixels, width, height, x, y);
            alphaValues.push(sample.raw.a);
            lumaValues.push(
                (sample.straight.r * 0.2126)
                + (sample.straight.g * 0.7152)
                + (sample.straight.b * 0.0722)
            );
        }

        const summarize = (values) => {
            const minimum = values.length ? Math.min(...values) : 0;
            const maximum = values.length ? Math.max(...values) : 0;
            const mean = values.length
                ? values.reduce((sum, value) => sum + value, 0) / values.length
                : 0;
            const variance = values.length
                ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length
                : 0;
            return {
                min: Number(minimum.toFixed(3)),
                max: Number(maximum.toFixed(3)),
                mean: Number(mean.toFixed(3)),
                stdDev: Number(Math.sqrt(variance).toFixed(3))
            };
        };

        return {
            samples: alphaValues.length,
            alpha: summarize(alphaValues),
            straightLuma: summarize(lumaValues)
        };
    }

    /**
     * Phase 3a: ぼかしブラシのリアルタイム焼き込み用コンテナを生成する。
     * blurSourceTexture はストローク開始時点のアクティブレイヤー複製。
     */
    renderBlurSegment(points, settings, blurSourceTexture) {
        if (!points || points.length < 1 || !blurSourceTexture) return null;

        const container = new Container();
        const sourceSprite = new Sprite(blurSourceTexture);
        const maskGraphics = new Graphics();

        const width = Math.max(1, settings.size || 1);
        const strength = Math.max(0.5, Math.min(16, settings.blurStrength ?? 4));

        if (points.length === 1) {
            const p = points[0];
            maskGraphics.circle(p.x, p.y, width / 2);
            maskGraphics.fill({ color: 0xffffff, alpha: 1 });
        } else {
            maskGraphics.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                maskGraphics.lineTo(points[i].x, points[i].y);
            }
            maskGraphics.stroke({
                width,
                color: 0xffffff,
                alpha: 1,
                cap: 'round',
                join: 'round'
            });
        }

        const blurFilter = new BlurFilter({
            strength,
            quality: 2,
            resolution: 1
        });

        sourceSprite.filters = [blurFilter];
        sourceSprite.mask = maskGraphics;
        sourceSprite.blendMode = 'normal';

        container.addChild(sourceSprite);
        container.addChild(maskGraphics);

        // BrushCore 側で destroy 前に呼ぶ。Container.destroy だけでは Filter の破棄が曖昧なため明示する。
        container.__tegakiDestroyFilters = () => {
            sourceSprite.filters = null;
            blurFilter.destroy();
        };

        return container;
    }

    _renderLineSegment(points, settings) {
        if (!points || points.length < 2) return null;
        
        const graphics = new Graphics();
        const mode = settings.mode || 'pen';
        graphics.blendMode = mode === 'eraser' ? 'erase' : 'normal';
        
        const color = mode === 'eraser' ? 0xFFFFFF : settings.color;
        const alpha = mode === 'eraser' ? 1.0 : settings.opacity || 1.0;
        const p0 = points[0]?.pressure ?? 1.0;
        const p1 = points[points.length - 1]?.pressure ?? p0;
        const segmentPressure = (p0 + p1) / 2;
        const width = settings.pressureEnabled === true
            ? this.calculateWidth(segmentPressure, settings.size)
            : settings.size;
        
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        
        graphics.stroke({ 
            width: width, 
            color: color, 
            alpha: alpha, 
            cap: 'round', 
            join: 'round' 
        });
        
        return graphics;
    }

    /**
     * Perfect-Freehand のオプションを統一
     */
    _getFreehandOptions(size) {
        const sm = window.TegakiSettingsManager;
        const userSmoothing = sm ? (sm.get('smoothing') ?? 0.5) : 0.5;

        return {
            size: size,
            thinning: 0.7,
            // [案3拡張] 入力補正（LazyBrush）の拡大に合わせ、
            // Perfect-Freehand 側の平滑化強度も最大値を 0.4 -> 0.8 へ引き上げます。
            smoothing: 0.02 + userSmoothing * 0.78,
            streamline: 0.0,
            simulatePressure: false,
            last: true
        };
    }

    /**
     * [指示書] 鋭角対策：極端に近い点を除外するフィルタ
     */
    _filterNearPoints(points) {
        if (!points || points.length === 0) return [];
        const MIN_DIST = 0.25;
        const result = [];
        for (const p of points) {
            const last = result[result.length - 1];
            if (!last) {
                result.push(p);
                continue;
            }

            const dx = p.x - last.x;
            const dy = p.y - last.y;
            if (Math.hypot(dx, dy) >= MIN_DIST) {
                result.push(p);
            }
        }
        return result;
    }

    /**
     * [指示書] 高速ストローク対策：異常な輪郭を検知する
     */
    _isOutlineSuspicious(outlinePoints, sourcePoints, size) {
        if (!outlinePoints || outlinePoints.length < 3) return false;
        
        const getBounds = (pts) => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of pts) {
                const px = p.x ?? p[0];
                const py = p.y ?? p[1];
                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            }
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        };

        const sourceBounds = getBounds(sourcePoints);
        const outlineBounds = getBounds(outlinePoints);
        const pad = Math.max(size * 3, 12);

        return (
            outlineBounds.x < sourceBounds.x - pad ||
            outlineBounds.y < sourceBounds.y - pad ||
            outlineBounds.x + outlineBounds.width > sourceBounds.x + sourceBounds.width + pad ||
            outlineBounds.y + outlineBounds.height > sourceBounds.y + sourceBounds.height + pad
        );
    }

    renderPreview(points, providedSettings = null, targetGraphics = null) {
        const graphics = targetGraphics || new Graphics();
        const settings = this._getSettings(providedSettings);
        const mode = this._getCurrentMode(settings);

        if (!points || points.length === 0) {
            return graphics;
        }

        // 1点目から描画する（点描時の即時フィードバックのためガードを削除）。
        // 描き始めの太さは calculateWidth 側のフォールバック (0.0) で制御する。

        graphics.clear();

        // 消しゴム・ペン・エアブラシ・ぼかしはライブ焼き込み側を正にする。
        // previewGraphics で重ね描きすると見た目と確定結果がずれるため描画しない。
        // ※ペン(pen)もライブ焼き込み対象のため、プレビューは描かない。
        if (mode === 'pen' || mode === 'eraser' || mode === 'airbrush' || mode === 'airbrush-erase' || mode === 'blur') {
            return graphics;
        }

        graphics.blendMode = 'normal';

        if (points.length === 1) {
            const p = points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
            return graphics;
        }

        const filteredPoints = this._filterNearPoints(points);
        if (filteredPoints.length < 2) return graphics;

        // フォールバックを 0.5 -> 0.0 へ。
        const inputPoints = filteredPoints.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.0, 0.02)]);
        const options = this._getFreehandOptions(settings.size);

        const outlinePoints = getStroke(inputPoints, options);
        if (outlinePoints.length < 2) return graphics;

        // [指示書] 異常輪郭検知
        if (this._isOutlineSuspicious(outlinePoints, filteredPoints, settings.size)) {
            // 安全なフォールバック描画
            graphics.moveTo(filteredPoints[0].x, filteredPoints[0].y);
            for (let i = 1; i < filteredPoints.length; i++) {
                graphics.lineTo(filteredPoints[i].x, filteredPoints[i].y);
            }
            graphics.stroke({ width: settings.size, color: settings.color, alpha: settings.opacity || 1.0, cap: 'round', join: 'round' });
        } else {
            graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
            graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
        }

        return graphics;
    }

    async renderFinalStroke(strokeData, settings) {
        const mode = settings?.mode || this.currentTool || 'pen';
        
        if (mode === 'eraser') {
            return this._renderEraserStroke(strokeData, settings);
        }
        
        // [指示書] Mesh経路を使わず Graphics.poly に統一
        return this._renderFinalStrokeGraphics(strokeData, settings, mode);
    }

    async _renderWithPerfectFreehand(strokeData, settings) {
        // [指示書] Mesh経路は使用しない方針のため、nullを返す
        return null;
    }

    _renderEraserStroke(strokeData, settings) {
        const filteredPoints = this._filterNearPoints(strokeData.points);
        const options = this._getFreehandOptions(settings.size);
        
        const graphics = new Graphics();
        graphics.blendMode = 'erase';

        if (strokeData.isSingleDot || filteredPoints.length === 1) {
            const p = filteredPoints[0] || strokeData.points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            return graphics;
        }

        const inputPoints = filteredPoints.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
        const outlinePoints = getStroke(inputPoints, options);
        
        if (!outlinePoints || outlinePoints.length < 2 || this._isOutlineSuspicious(outlinePoints, filteredPoints, settings.size)) {
            // 安全なフォールバック
            graphics.moveTo(filteredPoints[0].x, filteredPoints[0].y);
            for (let i = 1; i < filteredPoints.length; i++) {
                graphics.lineTo(filteredPoints[i].x, filteredPoints[i].y);
            }
            graphics.stroke({ width: settings.size, color: 0xFFFFFF, alpha: 1.0, cap: 'round', join: 'round' });
            return graphics;
        }

        graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
        graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });

        return graphics;
    }

    _renderFinalStrokeGraphics(strokeData, settings, mode) {
        const graphics = new Graphics();
        
        if (mode === 'eraser') {
            graphics.blendMode = 'erase';
        } else {
            graphics.blendMode = 'normal';
        }

        const filteredPoints = this._filterNearPoints(strokeData.points);
        if (strokeData.isSingleDot || filteredPoints.length === 1) {
            const p = filteredPoints[0] || strokeData.points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            
            if (mode === 'eraser') {
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
            }
            return graphics;
        }

        const inputPoints = filteredPoints.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
        const options = this._getFreehandOptions(settings.size);

        const outlinePoints = getStroke(inputPoints, options);
        
        if (!outlinePoints || outlinePoints.length < 2 || this._isOutlineSuspicious(outlinePoints, filteredPoints, settings.size)) {
            // 安全なフォールバック
            graphics.moveTo(filteredPoints[0].x, filteredPoints[0].y);
            for (let i = 1; i < filteredPoints.length; i++) {
                graphics.lineTo(filteredPoints[i].x, filteredPoints[i].y);
            }
            graphics.stroke({ width: settings.size, color: mode === 'eraser' ? 0xFFFFFF : settings.color, alpha: mode === 'eraser' ? 1.0 : settings.opacity || 1.0, cap: 'round', join: 'round' });
        } else {
            graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
            
            if (mode === 'eraser') {
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
            }
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
