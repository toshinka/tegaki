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

import { Graphics, Mesh, Geometry, Container, Sprite, Texture, BlurFilter } from 'pixi.js';
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
        this.airbrushTexture = null;
        
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
        const minRatio = 0.02; // クランプを 0.02 に変更
        const ratio = Math.max(minRatio, pressure ?? 0.5);
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
        if (!points || points.length < 1) return null;

        const container = new Container();
        const texture = this._getAirbrushTexture();

        if (points.length === 1) {
            const p = points[0];
            this._addAirbrushDab(container, texture, p.x, p.y, p.pressure ?? 1.0, settings);
            state.initialized = true;
            state.nextDistance = this._getAirbrushSpacing(settings);
            return container;
        }

        const start = points[0];
        const end = points[points.length - 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= 0) {
            this._addAirbrushDab(container, texture, end.x, end.y, end.pressure ?? 1.0, settings);
            return container;
        }

        const spacing = this._getAirbrushSpacing(settings);
        let nextDistance;

        if (!state.initialized) {
            nextDistance = 0;
            state.initialized = true;
        } else {
            nextDistance = state.nextDistance ?? spacing;
        }

        while (nextDistance <= distance) {
            const t = nextDistance / distance;
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const pressure = (start.pressure ?? 1.0) + ((end.pressure ?? 1.0) - (start.pressure ?? 1.0)) * t;

            this._addAirbrushDab(container, texture, x, y, pressure, settings);
            nextDistance += spacing;
        }

        state.nextDistance = nextDistance - distance;
        return container.children.length > 0 ? container : null;
    }

    _getAirbrushSpacing(settings) {
        const size = Math.max(1, settings.size || 1);
        // [指示書] 密度を向上 (0.18 -> 0.08) し、より隙間のない霧を実現
        const ratio = settings.airbrushSpacingRatio ?? 0.08;
        return Math.max(0.5, size * ratio);
    }

    _addAirbrushDab(container, texture, x, y, pressure, settings) {
        const sm = window.TegakiSettingsManager;
        const flow = sm ? (sm.get('airbrushFlow') ?? 0.22) : 0.22;
        const scatter = sm ? (sm.get('airbrushScatter') ?? 0.5) : 0.5;
        const grain = sm ? (sm.get('airbrushGrain') ?? 0.5) : 0.5;

        const baseSize = settings.pressureEnabled === true
            ? this.calculateWidth(Math.max(0.1, pressure ?? 1.0), settings.size)
            : settings.size;

        // [スプレー改修] スタンプの間隔や個数を Scatter 設定に同期
        const scatterCount = Math.max(1, Math.floor(1 + scatter * 5)); 
        const scatterRange = baseSize * (0.1 + scatter * 0.7); // 飛散範囲を 10% 〜 80% で可変

        for (let i = 0; i < scatterCount; i++) {
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);

            // 座標を範囲内でランダムに散らす
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.sqrt(Math.random()) * scatterRange;
            sprite.position.set(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist);
            
            sprite.rotation = Math.random() * Math.PI * 2;
            
            // Grain (粒の大きさ) 設定を反映
            const scaleMod = (0.5 + grain) * (0.8 + Math.random() * 0.4); 
            sprite.width = baseSize * scaleMod;
            sprite.height = baseSize * scaleMod;

            sprite.tint = settings.mode === 'airbrush-erase' ? 0xffffff : (settings.color ?? 0x800000);
            
            // Flow (流量) 設定を反映。累積しやすいようにさらに調整
            sprite.alpha = Math.max(0.001, Math.min(1, (settings.opacity ?? 1.0) * flow * 0.2));
            
            sprite.blendMode = settings.mode === 'airbrush-erase' ? 'erase' : 'normal';
            container.addChild(sprite);
        }
    }

    _getAirbrushTexture() {
        if (this.airbrushTexture) {
            // [スプレー改修] 常に最新の設定でテクスチャを生成し直すためのフラグチェック
            const sm = window.TegakiSettingsManager;
            const grain = sm ? (sm.get('airbrushGrain') ?? 0.5) : 0.5;
            if (this._lastGrain === grain) return this.airbrushTexture;
            this._lastGrain = grain;
        }

        const sm = window.TegakiSettingsManager;
        const grain = sm ? (sm.get('airbrushGrain') ?? 0.5) : 0.5;

        const size = 256; 
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        const center = size / 2;

        ctx.clearRect(0, 0, size, size);
        
        // --- 1. ベースのグラデーション ---
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0.0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
        gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.02)');
        gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // --- 2. ノイズ（粒状感）の反映 ---
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            // grain 値が小さいほどノイズを細かく、大きいほど粗く
            const noiseBase = 1.0 - (grain * 0.5);
            const noise = Math.random() < noiseBase ? (0.8 + Math.random() * 0.2) : (Math.random() * 0.4);
            data[i + 3] *= noise;
            
            const x = (i / 4) % size;
            const y = Math.floor((i / 4) / size);
            const dist = Math.hypot(x - center, y - center) / center;
            if (Math.random() < dist * 0.7) {
                data[i + 3] *= 0.2;
            }
        }
        ctx.putImageData(imageData, 0, 0);

        this.airbrushTexture = Texture.from(canvas);
        return this.airbrushTexture;
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

        if (points.length === 0) {
            return graphics;
        }

        graphics.clear();
        
        // 消しゴム・ペン・エアブラシ・ぼかしはライブ焼き込み側を正にする。
        // previewGraphics で重ね描きすると見た目と確定結果がずれるため描画しない。
        if (mode === 'eraser' || mode === 'airbrush' || mode === 'blur') {
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

        const inputPoints = filteredPoints.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
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
