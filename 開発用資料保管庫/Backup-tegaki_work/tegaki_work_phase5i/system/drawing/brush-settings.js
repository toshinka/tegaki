/**
 * ============================================================================
 * ファイル名: system/drawing/brush-settings.js
 * 責務: ブラシの設定（サイズ、色、不透明度、モード）を管理する
 * 依存: config.js, system/event-bus.js
 * 被依存: core-engine.js, drawing-engine.js, brush-core.js等
 * 公開API: BrushSettings
 * イベント発火: brush:mode-changed, brush:size-changed, brush:color-changed, brush:opacity-changed, brush:pressure-enabled-changed, brush:eraser-pressure-enabled-changed, brush:airbrush-settings-changed, brush:blur-settings-changed
 * イベント受信: なし
 * グローバル登録: window.BrushSettings
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { TEGAKI_CONFIG } from '../../config.js';
import { TegakiEventBus } from '../event-bus.js';

export class BrushSettings {
    constructor(config, eventBus, settingsManager = null) {
        // シングルトンチェック（互換性維持）
        if (window.brushSettings && arguments.length === 0) {
            return window.brushSettings;
        }

        this.config = config || TEGAKI_CONFIG;
        this.eventBus = eventBus || TegakiEventBus;
        this.settingsManager = settingsManager;

        if (!this.config) {
            throw new Error('[BrushSettings] Config is required');
        }

        // デフォルト値
        const defaultSize = this.config.BRUSH_DEFAULTS?.size || 3;
        this.sizes = {
            pen: defaultSize,
            eraser: defaultSize * 3, // 少し大きめ
            airbrush: 30, // スプレーは初期値を大きめに
            fill: defaultSize,
            'eraser-fill': defaultSize,
            'lasso-fill': defaultSize,
            'eyedropper': 1
        };
        this.color = this.config.BRUSH_DEFAULTS?.color || 0x800000;
        this.opacity = this.config.BRUSH_DEFAULTS?.opacity || 1.0;
        this.minWidth = this.config.BRUSH_DEFAULTS?.minWidth || 0.5;
        this.defaultMaxWidth = 100;
        this.airbrushMaxWidth = 100;
        
        this.mode = 'pen'; // 'pen' | 'eraser' | 'fill' | 'lasso-fill'
        this.pressureEnabled = true;
        this.eraserPressureEnabled = false;

        // Phase 3a: エアブラシ / ぼかしブラシ設定
        // airbrushSpacingRatio: 小さいほど高密度。size * ratio がスタンプ間隔になる。
        this.airbrushSpacingRatio = this.config.BRUSH_DEFAULTS?.airbrushSpacingRatio ?? 0.1;
        // airbrushFlow: 線としての濃度。dab alphaはspacingに応じて描画側で補正する。
        this.airbrushFlow = this.config.BRUSH_DEFAULTS?.airbrushFlow ?? 0.08;
        this.airbrushSoftness = this.config.BRUSH_DEFAULTS?.airbrushSoftness ?? 0.8;
        this.airbrushScatter = this.config.BRUSH_DEFAULTS?.airbrushScatter ?? 0.0;
        // blurStrength: PixiJS BlurFilter の強度。強すぎると重くなるため初期値は控えめ。
        this.blurStrength = this.config.BRUSH_DEFAULTS?.blurStrength ?? 4;
    }

    setMode(mode) {
        const validModes = ['pen', 'eraser', 'fill', 'eraser-fill', 'airbrush', 'airbrush-erase', 'blur', 'lasso-fill', 'eyedropper'];
        if (!validModes.includes(mode)) {
            console.warn('[BrushSettings] Invalid mode:', mode, `(allowed: ${validModes.join(', ')})`);
            return;
        }

        const oldMode = this.mode;
        this.mode = mode;
        
        if (oldMode !== this.mode && this.eventBus) {
            this.eventBus.emit('brush:mode-changed', { 
                component: 'brush',
                action: 'mode-changed',
                data: { mode: this.mode, oldMode }
            });
            
            // モード切り替え時に、そのモードに紐づくサイズ変更イベントも発火してUIを同期
            this.eventBus.emit('brush:size-changed', {
                component: 'brush',
                action: 'size-changed',
                data: { size: this.getSize(), oldSize: this.getSize() }
            });
        }
    }

    getMode() {
        return this.mode;
    }

    _getSizeKey(mode) {
        if (mode === 'airbrush-erase') return 'airbrush';
        if (mode === 'blur') return 'airbrush';
        return mode;
    }

    getMaxSize() {
        const key = this._getSizeKey(this.mode);
        if (key === 'airbrush') return this.airbrushMaxWidth;
        return this.defaultMaxWidth;
    }

    setSize(size) {
        const key = this._getSizeKey(this.mode);
        const oldSize = this.sizes[key] || this.minWidth;
        const max = this.getMaxSize();
        
        this.sizes[key] = Math.max(this.minWidth, Math.min(max, size));
        
        if (oldSize !== this.sizes[key] && this.eventBus) {
            this.eventBus.emit('brush:size-changed', { 
                component: 'brush',
                action: 'size-changed',
                data: { size: this.sizes[key], oldSize }
            });
        }
    }

    getSize() {
        const key = this._getSizeKey(this.mode);
        return this.sizes[key] || this.minWidth;
    }

    setColor(color) {
        const oldColor = this.color;
        this.color = color;
        
        if (oldColor !== this.color && this.eventBus) {
            this.eventBus.emit('brush:color-changed', { 
                component: 'brush',
                action: 'color-changed',
                data: { color: this.color, oldColor }
            });
        }
    }

    getColor() {
        return this.color;
    }

    setOpacity(opacity) {
        const oldOpacity = this.opacity;
        
        if (opacity > 1) {
            opacity = opacity / 100;
        }
        
        this.opacity = Math.max(0, Math.min(1, opacity));
        
        if (oldOpacity !== this.opacity && this.eventBus) {
            this.eventBus.emit('brush:opacity-changed', { 
                component: 'brush',
                action: 'opacity-changed',
                data: { opacity: this.opacity, oldOpacity }
            });
        }
    }

    getOpacity() {
        return this.opacity;
    }

    getAlpha() {
        return this.opacity;
    }

    get alpha() {
        return this.opacity;
    }

    getSettings() {
        const airbrush = this.getAirbrushSettings();
        return {
            size: this.getSize(),
            color: this.color,
            opacity: this.opacity,
            alpha: this.opacity,
            mode: this.mode,
            minWidth: this.minWidth,
            maxWidth: this.getMaxSize(),
            pressureEnabled: this.pressureEnabled,
            eraserPressureEnabled: this.eraserPressureEnabled,
            airbrushSpacingRatio: airbrush.spacingRatio,
            airbrushFlow: airbrush.flow,
            airbrushSoftness: airbrush.softness,
            airbrushScatter: airbrush.scatter,
            blurStrength: this.blurStrength
        };
    }

    getAirbrushSettings() {
        const flow = this.settingsManager?.get?.('airbrushFlow');
        const softness = this.settingsManager?.get?.('airbrushSoftness');
        const scatter = this.settingsManager?.get?.('airbrushScatter');
        const normalize = (value, fallback, min, max) => {
            const numeric = Number(value);
            return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback));
        };

        return Object.freeze({
            spacingRatio: normalize(this.airbrushSpacingRatio, 0.1, 0.05, 1),
            flow: normalize(flow, this.airbrushFlow, 0.01, 1),
            softness: normalize(softness, this.airbrushSoftness, 0, 1),
            scatter: normalize(scatter, this.airbrushScatter, 0, 1)
        });
    }

    _getAirbrushEventData() {
        const settings = this.getAirbrushSettings();
        return {
            airbrushSpacingRatio: settings.spacingRatio,
            airbrushFlow: settings.flow,
            airbrushSoftness: settings.softness,
            airbrushScatter: settings.scatter
        };
    }

    setPressureEnabled(enabled) {
        const oldEnabled = this.pressureEnabled;
        this.pressureEnabled = !!enabled;

        if (oldEnabled !== this.pressureEnabled && this.eventBus) {
            this.eventBus.emit('brush:pressure-enabled-changed', {
                component: 'brush',
                action: 'pressure-enabled-changed',
                data: { enabled: this.pressureEnabled, oldEnabled }
            });
        }
    }

    togglePressure() {
        this.setPressureEnabled(!this.pressureEnabled);
        return this.pressureEnabled;
    }

    setEraserPressureEnabled(enabled) {
        const oldEnabled = this.eraserPressureEnabled;
        this.eraserPressureEnabled = !!enabled;

        if (oldEnabled !== this.eraserPressureEnabled && this.eventBus) {
            this.eventBus.emit('brush:eraser-pressure-enabled-changed', {
                component: 'brush',
                action: 'eraser-pressure-enabled-changed',
                data: { enabled: this.eraserPressureEnabled, oldEnabled }
            });
        }
    }

    toggleEraserPressure() {
        this.setEraserPressureEnabled(!this.eraserPressureEnabled);
        return this.eraserPressureEnabled;
    }

    setAirbrushSpacingRatio(ratio) {
        const oldRatio = this.airbrushSpacingRatio;
        const fallback = this.config.BRUSH_DEFAULTS?.airbrushSpacingRatio ?? 0.1;
        this.airbrushSpacingRatio = Math.max(0.05, Math.min(1.0, Number(ratio) || fallback));

        if (oldRatio !== this.airbrushSpacingRatio && this.eventBus) {
            this.eventBus.emit('brush:airbrush-settings-changed', {
                component: 'brush',
                action: 'airbrush-settings-changed',
                data: {
                    ...this._getAirbrushEventData()
                }
            });
        }
    }

    setAirbrushFlow(flow) {
        const oldFlow = this.getAirbrushSettings().flow;
        const fallback = this.config.BRUSH_DEFAULTS?.airbrushFlow ?? 0.08;
        this.airbrushFlow = Math.max(0.01, Math.min(1.0, Number(flow) || fallback));
        this.settingsManager?.set?.('airbrushFlow', this.airbrushFlow);

        if (oldFlow !== this.airbrushFlow && this.eventBus) {
            this.eventBus.emit('brush:airbrush-settings-changed', {
                component: 'brush',
                action: 'airbrush-settings-changed',
                data: this._getAirbrushEventData()
            });
        }
    }

    setAirbrushSoftness(softness) {
        const oldSoftness = this.getAirbrushSettings().softness;
        const fallback = this.config.BRUSH_DEFAULTS?.airbrushSoftness ?? 0.8;
        const numeric = Number(softness);
        this.airbrushSoftness = Math.max(0, Math.min(1, Number.isFinite(numeric) ? numeric : fallback));
        this.settingsManager?.set?.('airbrushSoftness', this.airbrushSoftness);

        if (oldSoftness !== this.airbrushSoftness && this.eventBus) {
            this.eventBus.emit('brush:airbrush-settings-changed', {
                component: 'brush',
                action: 'airbrush-settings-changed',
                data: this._getAirbrushEventData()
            });
        }
    }

    setAirbrushScatter(scatter) {
        const oldScatter = this.getAirbrushSettings().scatter;
        const fallback = this.config.BRUSH_DEFAULTS?.airbrushScatter ?? 0;
        const numeric = Number(scatter);
        this.airbrushScatter = Math.max(0, Math.min(1, Number.isFinite(numeric) ? numeric : fallback));
        this.settingsManager?.set?.('airbrushScatter', this.airbrushScatter);

        if (oldScatter !== this.airbrushScatter && this.eventBus) {
            this.eventBus.emit('brush:airbrush-settings-changed', {
                component: 'brush',
                action: 'airbrush-settings-changed',
                data: this._getAirbrushEventData()
            });
        }
    }

    setBlurStrength(strength) {
        const oldStrength = this.blurStrength;
        this.blurStrength = Math.max(0.5, Math.min(16, Number(strength) || 4));

        if (oldStrength !== this.blurStrength && this.eventBus) {
            this.eventBus.emit('brush:blur-settings-changed', {
                component: 'brush',
                action: 'blur-settings-changed',
                data: {
                    blurStrength: this.blurStrength
                }
            });
        }
    }

    updateSettings(settings) {
        let changed = false;

        if (settings.size !== undefined && settings.size !== this.size) {
            this.setSize(settings.size);
            changed = true;
        }

        if (settings.color !== undefined && settings.color !== this.color) {
            this.setColor(settings.color);
            changed = true;
        }

        if (settings.opacity !== undefined && settings.opacity !== this.opacity) {
            this.setOpacity(settings.opacity);
            changed = true;
        }

        if (settings.mode !== undefined && settings.mode !== this.mode) {
            this.setMode(settings.mode);
            changed = true;
        }

        if (settings.airbrushSpacingRatio !== undefined && settings.airbrushSpacingRatio !== this.airbrushSpacingRatio) {
            this.setAirbrushSpacingRatio(settings.airbrushSpacingRatio);
            changed = true;
        }

        if (settings.airbrushFlow !== undefined && settings.airbrushFlow !== this.getAirbrushSettings().flow) {
            this.setAirbrushFlow(settings.airbrushFlow);
            changed = true;
        }

        if (settings.airbrushSoftness !== undefined && settings.airbrushSoftness !== this.getAirbrushSettings().softness) {
            this.setAirbrushSoftness(settings.airbrushSoftness);
            changed = true;
        }

        if (settings.airbrushScatter !== undefined && settings.airbrushScatter !== this.getAirbrushSettings().scatter) {
            this.setAirbrushScatter(settings.airbrushScatter);
            changed = true;
        }

        if (settings.blurStrength !== undefined && settings.blurStrength !== this.blurStrength) {
            this.setBlurStrength(settings.blurStrength);
            changed = true;
        }

        return changed;
    }
}

// 下位互換性のためにグローバルに登録
window.BrushSettings = BrushSettings;
