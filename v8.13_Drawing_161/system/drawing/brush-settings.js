/**
 * ================================================================================
 * system/drawing/brush-settings.js - Phase 3-D: 塗りつぶしツール対応版
 * ================================================================================
 * 
 * 【Phase 3-D 改修内容】
 * - mode プロパティを 'pen' | 'eraser' | 'fill' に拡張
 * - fill モードのバリデーション追加
 * 
 * 【Phase 3-C 改修内容 - 消しゴム対応】
 * - mode プロパティ追加 ('pen' | 'eraser')
 * - setMode() / getMode() メソッド追加
 * - brush:mode-changed イベント発行
 * - BrushCore との統合
 * 
 * 【依存関係 - Parents (このファイルが依存)】
 *   - config.js (TEGAKI_CONFIG)
 *   - event-bus.js (EventBus)
 * 
 * 【依存関係 - Children (このファイルに依存)】
 *   - brush-core.js (mode 同期)
 *   - stroke-renderer.js (mode 参照)
 *   - drawing-engine.js (settings 取得)
 *   - core-runtime.js (API公開)
 * 
 * 【責務】
 *   - ブラシ設定の集中管理（サイズ、色、不透明度、ツールモード）
 *   - 設定変更イベントの発行
 *   - デフォルト値の管理
 * ================================================================================
 */

(function() {
    'use strict';

    class BrushSettings {
        /**
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
            
            // 🆕 Phase 3-D: ツールモード拡張
            this.mode = 'pen'; // 'pen' | 'eraser' | 'fill'

            console.log('[BrushSettings] Initialized (Phase 3-D - fill対応):', {
                size: this.size,
                color: `0x${this.color.toString(16)}`,
                opacity: this.opacity,
                mode: this.mode,
                minWidth: this.minWidth,
                maxWidth: this.maxWidth,
                hasEventBus: !!this.eventBus
            });
        }

        /**
         * 🆕 Phase 3-D: ツールモード設定 (fill追加)
         * @param {string} mode - 'pen' | 'eraser' | 'fill'
         */
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

            console.log(`[BrushSettings] Mode changed: ${oldMode} → ${this.mode}`);
        }

        /**
         * 🆕 Phase 3-C: ツールモード取得
         * @returns {string} 'pen' | 'eraser' | 'fill'
         */
        getMode() {
            return this.mode;
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
         * 🔧 Phase 3-C: mode を追加
         */
        getSettings() {
            return {
                size: this.size,
                color: this.color,
                opacity: this.opacity,
                alpha: this.opacity,
                mode: this.mode,
                minWidth: this.minWidth,
                maxWidth: this.maxWidth
            };
        }

        /**
         * 設定を一括更新
         * 🔧 Phase 3-C: mode 対応
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

            // 🆕 Phase 3-C: mode 更新
            if (settings.mode !== undefined && settings.mode !== this.mode) {
                this.setMode(settings.mode);
                changed = true;
            }

            return changed;
        }
    }

    window.BrushSettings = BrushSettings;

    console.log('✅ brush-settings.js (Phase 3-D - fill対応) loaded');
    console.log('   ✓ mode: pen/eraser/fill 拡張');
    console.log('   ✓ setMode() バリデーション改善');

})();