/**
 * ============================================================================
 * ファイル名: system/drawing/brush-settings.js
 * 責務: ブラシの設定（サイズ、色、不透明度、モード）を管理する
 * 依存: config.js, system/event-bus.js
 * 被依存: core-engine.js, drawing-engine.js, brush-core.js等
 * 公開API: BrushSettings
 * イベント発火: brush:mode-changed, brush:size-changed, brush:color-changed, brush:opacity-changed, brush:pressure-enabled-changed, brush:eraser-pressure-enabled-changed
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
        this.size = this.config.BRUSH_DEFAULTS?.size || 3;
        this.color = this.config.BRUSH_DEFAULTS?.color || 0x800000;
        this.opacity = this.config.BRUSH_DEFAULTS?.opacity || 1.0;
        this.minWidth = this.config.BRUSH_DEFAULTS?.minWidth || 0.5;
        this.maxWidth = this.config.BRUSH_DEFAULTS?.maxWidth || 30;
        
        this.mode = 'pen'; // 'pen' | 'eraser' | 'fill'
        this.pressureEnabled = true;
        this.eraserPressureEnabled = false;
    }

    setMode(mode) {
        if (mode !== 'pen' && mode !== 'eraser' && mode !== 'fill') {
            console.warn('[BrushSettings] Invalid mode:', mode, '(allowed: pen, eraser, fill)');
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
        }
    }

    getMode() {
        return this.mode;
    }

    setSize(size) {
        const oldSize = this.size;
        this.size = Math.max(this.minWidth, Math.min(this.maxWidth, size));
        
        if (oldSize !== this.size && this.eventBus) {
            this.eventBus.emit('brush:size-changed', { 
                component: 'brush',
                action: 'size-changed',
                data: { size: this.size, oldSize }
            });
        }
    }

    getSize() {
        return this.size;
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
            size: this.size,
            color: this.color,
            opacity: this.opacity,
            alpha: this.opacity,
            mode: this.mode,
            minWidth: this.minWidth,
            maxWidth: this.maxWidth,
            pressureEnabled: this.pressureEnabled,
            eraserPressureEnabled: this.eraserPressureEnabled
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

        return changed;
    }
}

// 下位互換性のためにグローバルに登録
window.BrushSettings = BrushSettings;
