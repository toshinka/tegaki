/**
 * @file system/drawing/brush-settings.js
 * @description ブラシ設定管理（サイズ、色、不透明度）
 * 
 * 【Phase 6 改修内容 - DIP改善】
 * - シングルトンパターンを維持しつつ依存性注入も可能に
 * - constructor での明示的な依存性受け取り
 * - グローバルアクセスは互換性のため残すが、推奨しない
 * 
 * 【依存関係】
 * - config.js (TEGAKI_CONFIG)
 * - event-bus.js (EventBus)
 * 
 * 【親ファイル (依存元)】
 * - core-engine.js (依存性注入の中心)
 * 
 * 【子ファイル (このファイルに依存)】
 * - brush-core.js
 * - stroke-renderer.js
 * - core-runtime.js (API経由)
 */

(function() {
    'use strict';

    class BrushSettings {
        /**
         * 🔧 Phase 6: constructor で依存性を明示的に受け取る
         * @param {Object} config - 設定オブジェクト
         * @param {Object} eventBus - イベントバス
         */
        constructor(config, eventBus) {
            // シングルトンチェック（互換性維持）
            if (window.brushSettings && arguments.length === 0) {
                console.warn('[BrushSettings] Returning existing singleton instance');
                return window.brushSettings;
            }

            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus || window.TegakiEventBus;

            if (!this.config) {
                throw new Error('[BrushSettings] Config is required');
            }

            // デフォルト値
            this.size = this.config.BRUSH_DEFAULTS?.size || 3;
            this.color = this.config.BRUSH_DEFAULTS?.color || 0x800000;
            this.opacity = this.config.BRUSH_DEFAULTS?.opacity || 1.0;
            this.minWidth = this.config.BRUSH_DEFAULTS?.minWidth || 0.5;
            this.maxWidth = this.config.BRUSH_DEFAULTS?.maxWidth || 30;

            console.log('[BrushSettings] Initialized (Phase 6 - DIP改善):', {
                size: this.size,
                color: `0x${this.color.toString(16)}`,
                opacity: this.opacity,
                minWidth: this.minWidth,
                maxWidth: this.maxWidth,
                hasEventBus: !!this.eventBus
            });
        }

        /**
         * サイズ設定
         */
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

        /**
         * 色設定
         */
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

            return changed;
        }
    }

    /**
     * 🔧 Phase 6: グローバルインスタンスは遅延生成
     * CoreEngine が明示的にインスタンスを作成し注入する
     * グローバルアクセスは互換性のため残すが、推奨しない
     */
    window.BrushSettings = BrushSettings;

    console.log('✅ brush-settings.js (Phase 6 - DIP改善) loaded');
    console.log('   ✓ Constructor での依存性注入対応');
    console.log('   ✓ シングルトンは CoreEngine で管理');
    console.log('   ✓ グローバルアクセスは互換性維持のみ');

})();