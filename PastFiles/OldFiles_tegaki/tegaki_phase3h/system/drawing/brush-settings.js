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
    constructor(config, eventBus) {
        // シングルトンチェック（互換性維持）
        if (window.brushSettings && arguments.length === 0) {
            return window.brushSettings;
        }

        this.config = config || TEGAKI_CONFIG;
        this.eventBus = eventBus || TegakiEventBus;

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
            'lasso-fill': defaultSize
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
        this.airbrushSpacingRatio = this.config.BRUSH_DEFAULTS?.airbrushSpacingRatio ?? 0.18;
        // airbrushFlow: 1スタンプあたりの濃度。opacity と掛け合わせる。
        this.airbrushFlow = this.config.BRUSH_DEFAULTS?.airbrushFlow ?? 0.22;
        // blurStrength: PixiJS BlurFilter の強度。強すぎると重くなるため初期値は控えめ。
        this.blurStrength = this.config.BRUSH_DEFAULTS?.blurStrength ?? 4;
    }

    setMode(mode) {
        const validModes = ['pen', 'eraser', 'fill', 'eraser-fill', 'airbrush', 'airbrush-erase', 'blur', 'lasso-fill'];
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
            airbrushSpacingRatio: this.airbrushSpacingRatio,
            airbrushFlow: this.airbrushFlow,
            blurStrength: this.blurStrength
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
        this.airbrushSpacingRatio = Math.max(0.05, Math.min(1.0, Number(ratio) || 0.18));

        if (oldRatio !== this.airbrushSpacingRatio && this.eventBus) {
            this.eventBus.emit('brush:airbrush-settings-changed', {
                component: 'brush',
                action: 'airbrush-settings-changed',
                data: {
                    airbrushSpacingRatio: this.airbrushSpacingRatio,
                    airbrushFlow: this.airbrushFlow
                }
            });
        }
    }

    setAirbrushFlow(flow) {
        const oldFlow = this.airbrushFlow;
        this.airbrushFlow = Math.max(0.01, Math.min(1.0, Number(flow) || 0.22));

        if (oldFlow !== this.airbrushFlow && this.eventBus) {
            this.eventBus.emit('brush:airbrush-settings-changed', {
                component: 'brush',
                action: 'airbrush-settings-changed',
                data: {
                    airbrushSpacingRatio: this.airbrushSpacingRatio,
                    airbrushFlow: this.airbrushFlow
                }
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

        if (settings.airbrushFlow !== undefined && settings.airbrushFlow !== this.airbrushFlow) {
            this.setAirbrushFlow(settings.airbrushFlow);
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
