/**
 * BrushSettings - Phase 1: シングルトン統一版
 * グローバルインスタンスで統一し、quick-access-popup → BrushSettings → drawing-engine の設定フローを確立
 */

(function() {
    'use strict';

    class BrushSettings {
        constructor(config, eventBus) {
            // シングルトンチェック
            if (window.brushSettings) {
                console.warn('[BrushSettings] Instance already exists. Returning existing instance.');
                return window.brushSettings;
            }

            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus || window.TegakiEventBus;

            // デフォルト値
            this.size = this.config.BRUSH_DEFAULTS?.size || 3;
            this.color = this.config.BRUSH_DEFAULTS?.color || 0x800000;
            this.opacity = this.config.BRUSH_DEFAULTS?.opacity || 1.0;
            this.minWidth = this.config.BRUSH_DEFAULTS?.minWidth || 0.5;
            this.maxWidth = this.config.BRUSH_DEFAULTS?.maxWidth || 30;

            console.log('[BrushSettings] Initialized (Phase 1):', {
                size: this.size,
                color: `0x${this.color.toString(16)}`,
                opacity: this.opacity,
                minWidth: this.minWidth,
                maxWidth: this.maxWidth
            });
        }

        /**
         * サイズ設定
         */
        setSize(size) {
            const oldSize = this.size;
            this.size = Math.max(this.minWidth, Math.min(this.maxWidth, size));
            
            if (oldSize !== this.size) {
                console.log(`[BrushSettings] Size changed: ${oldSize.toFixed(1)} → ${this.size.toFixed(1)}`);
                
                if (this.eventBus) {
                    this.eventBus.emit('brush:size-changed', { 
                        component: 'brush',
                        action: 'size-changed',
                        data: { size: this.size, oldSize }
                    });
                }
            }
        }

        getSize() {
            return this.size;
        }

        /**
         * 色設定
         */
        setColor(color) {
            const oldColor = this.color;
            this.color = color;
            
            if (oldColor !== this.color) {
                console.log(`[BrushSettings] Color changed: 0x${oldColor.toString(16)} → 0x${this.color.toString(16)}`);
                
                if (this.eventBus) {
                    this.eventBus.emit('brush:color-changed', { 
                        component: 'brush',
                        action: 'color-changed',
                        data: { color: this.color, oldColor }
                    });
                }
            }
        }

        getColor() {
            return this.color;
        }

        /**
         * 不透明度設定（0-100% または 0.0-1.0）
         */
        setOpacity(opacity) {
            const oldOpacity = this.opacity;
            
            // 0-100の場合は0.0-1.0に変換
            if (opacity > 1) {
                opacity = opacity / 100;
            }
            
            this.opacity = Math.max(0, Math.min(1, opacity));
            
            if (oldOpacity !== this.opacity) {
                console.log(`[BrushSettings] Opacity changed: ${(oldOpacity * 100).toFixed(0)}% → ${(this.opacity * 100).toFixed(0)}%`);
                
                if (this.eventBus) {
                    this.eventBus.emit('brush:opacity-changed', { 
                        component: 'brush',
                        action: 'opacity-changed',
                        data: { opacity: this.opacity, oldOpacity }
                    });
                }
            }
        }

        getOpacity() {
            return this.opacity;
        }

        // エイリアス（互換性維持）
        getAlpha() {
            return this.opacity;
        }

        get alpha() {
            return this.opacity;
        }

        /**
         * 現在の設定を全て取得
         */
        getSettings() {
            return {
                size: this.size,
                color: this.color,
                opacity: this.opacity,
                alpha: this.opacity,
                minWidth: this.minWidth,
                maxWidth: this.maxWidth
            };
        }

        /**
         * 設定を一括更新
         */
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

            if (changed) {
                console.log('[BrushSettings] Settings updated:', this.getSettings());
            }

            return changed;
        }
    }

    // ★Phase 1: グローバルシングルトンインスタンス作成
    if (!window.brushSettings) {
        window.brushSettings = new BrushSettings(window.TEGAKI_CONFIG, window.TegakiEventBus);
        console.log('✅ Global window.brushSettings instance created');
    }

    // クラスもエクスポート（互換性維持）
    window.BrushSettings = BrushSettings;

    console.log('✅ brush-settings.js (Phase 1: シングルトン統一版) loaded');
    console.log('   ✓ Singleton pattern implemented');
    console.log('   ✓ Global instance: window.brushSettings');
    console.log('   ✓ EventBus integration complete');

})();