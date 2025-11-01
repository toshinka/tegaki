/**
 * BrushSettings - ブラシ設定管理（最小限実装）
 * core-engine.js の依存解決用
 */

(function() {
    'use strict';

    class BrushSettings {
        constructor(config, eventBus) {
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus || window.TegakiEventBus;

            // デフォルト値
            this.size = this.config.BRUSH_DEFAULTS?.size || 3;
            this.color = this.config.BRUSH_DEFAULTS?.color || 0x800000;
            this.opacity = this.config.BRUSH_DEFAULTS?.opacity || 1.0;
            this.minWidth = this.config.BRUSH_DEFAULTS?.minWidth || 1;
            this.maxWidth = this.config.BRUSH_DEFAULTS?.maxWidth || 10;

            console.log('[BrushSettings] Initialized:', {
                size: this.size,
                color: `0x${this.color.toString(16)}`,
                opacity: this.opacity
            });
        }

        /**
         * サイズ設定
         */
        setSize(size) {
            this.size = Math.max(this.minWidth, Math.min(this.maxWidth, size));
            if (this.eventBus) {
                this.eventBus.emit('brush:size-changed', { size: this.size });
            }
        }

        getSize() {
            return this.size;
        }

        /**
         * 色設定
         */
        setColor(color) {
            this.color = color;
            if (this.eventBus) {
                this.eventBus.emit('brush:color-changed', { color: this.color });
            }
        }

        getColor() {
            return this.color;
        }

        /**
         * 不透明度設定
         */
        setOpacity(opacity) {
            this.opacity = Math.max(0, Math.min(1, opacity));
            if (this.eventBus) {
                this.eventBus.emit('brush:opacity-changed', { opacity: this.opacity });
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
    }

    // グローバル公開
    window.BrushSettings = BrushSettings;

    console.log('✅ brush-settings.js (minimal implementation) loaded');

})();