/**
 * ================================================================================
 * system/drawing/brush-settings.js - Phase B-6: ペン傾き設定対応版
 * ================================================================================
 * 
 * 【親依存】
 * - config.js (TEGAKI_CONFIG)
 * - system/event-bus.js (EventBus)
 * 
 * 【子依存】
 * - brush-core.js (settings取得)
 * - stroke-renderer.js (傾き設定参照)
 * - drawing-engine.js (settings取得)
 * - ui/settings-popup.js (UI連携)
 * 
 * 【Phase B-6改修内容】
 * ✅ tilt オブジェクト追加
 *    - sensitivity: 傾き感度 (0.0 〜 1.0)
 *    - affectsWidth: 幅変調ON/OFF
 *    - affectsRotation: 回転ON/OFF (Phase C実装予定)
 *    - widthMin: 最小幅比率
 *    - widthMax: 最大幅比率
 * ✅ setTiltSettings() / getTiltSettings() メソッド追加
 * ✅ イベント発行 'brush:tilt-changed'
 * ✅ Phase 3-D全機能継承
 * 
 * 【責務】
 * - ブラシ設定の集中管理（サイズ、色、不透明度、ツールモード、傾き設定）
 * - 設定変更イベントの発行
 * - デフォルト値の管理
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
            
            // ツールモード
            this.mode = 'pen'; // 'pen' | 'eraser' | 'fill'
            
            // 🆕 Phase B-6: ペン傾き設定
            this.tilt = {
                sensitivity: 0.5,           // 傾き感度 (0.0 〜 1.0)
                affectsWidth: true,         // 幅変調ON/OFF
                affectsRotation: false,     // 回転ON/OFF (Phase C実装予定)
                widthMin: 0.5,             // 最小幅比率
                widthMax: 1.5              // 最大幅比率
            };
        }

        /**
         * ツールモード設定
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
        }

        /**
         * ツールモード取得
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
         * 🆕 Phase B-6: ペン傾き設定を更新
         * @param {Object} tiltSettings - 傾き設定オブジェクト
         * @param {number} [tiltSettings.sensitivity] - 傾き感度 (0.0 〜 1.0)
         * @param {boolean} [tiltSettings.affectsWidth] - 幅変調ON/OFF
         * @param {boolean} [tiltSettings.affectsRotation] - 回転ON/OFF
         * @param {number} [tiltSettings.widthMin] - 最小幅比率
         * @param {number} [tiltSettings.widthMax] - 最大幅比率
         */
        setTiltSettings(tiltSettings) {
            if (!tiltSettings || typeof tiltSettings !== 'object') {
                console.warn('[BrushSettings] Invalid tilt settings');
                return;
            }

            const oldSettings = { ...this.tilt };
            let changed = false;

            if (tiltSettings.sensitivity !== undefined) {
                const newSensitivity = Math.max(0, Math.min(1, tiltSettings.sensitivity));
                if (this.tilt.sensitivity !== newSensitivity) {
                    this.tilt.sensitivity = newSensitivity;
                    changed = true;
                }
            }

            if (tiltSettings.affectsWidth !== undefined && typeof tiltSettings.affectsWidth === 'boolean') {
                if (this.tilt.affectsWidth !== tiltSettings.affectsWidth) {
                    this.tilt.affectsWidth = tiltSettings.affectsWidth;
                    changed = true;
                }
            }

            if (tiltSettings.affectsRotation !== undefined && typeof tiltSettings.affectsRotation === 'boolean') {
                if (this.tilt.affectsRotation !== tiltSettings.affectsRotation) {
                    this.tilt.affectsRotation = tiltSettings.affectsRotation;
                    changed = true;
                }
            }

            if (tiltSettings.widthMin !== undefined) {
                const newWidthMin = Math.max(0.1, Math.min(1.0, tiltSettings.widthMin));
                if (this.tilt.widthMin !== newWidthMin) {
                    this.tilt.widthMin = newWidthMin;
                    changed = true;
                }
            }

            if (tiltSettings.widthMax !== undefined) {
                const newWidthMax = Math.max(1.0, Math.min(3.0, tiltSettings.widthMax));
                if (this.tilt.widthMax !== newWidthMax) {
                    this.tilt.widthMax = newWidthMax;
                    changed = true;
                }
            }

            if (changed && this.eventBus) {
                this.eventBus.emit('brush:tilt-changed', {
                    component: 'brush',
                    action: 'tilt-changed',
                    data: {
                        tilt: { ...this.tilt },
                        oldSettings: oldSettings
                    }
                });
            }
        }

        /**
         * 🆕 Phase B-6: ペン傾き設定を取得
         * @returns {Object} 傾き設定オブジェクト
         */
        getTiltSettings() {
            return { ...this.tilt };
        }

        /**
         * 現在の設定を全て取得
         * 🔧 Phase B-6: tilt を追加
         */
        getSettings() {
            return {
                size: this.size,
                color: this.color,
                opacity: this.opacity,
                alpha: this.opacity,
                mode: this.mode,
                minWidth: this.minWidth,
                maxWidth: this.maxWidth,
                tilt: { ...this.tilt }  // 🆕 Phase B-6
            };
        }

        /**
         * 設定を一括更新
         * 🔧 Phase B-6: tilt 対応
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

            if (settings.mode !== undefined && settings.mode !== this.mode) {
                this.setMode(settings.mode);
                changed = true;
            }

            // 🆕 Phase B-6: tilt 更新
            if (settings.tilt !== undefined) {
                this.setTiltSettings(settings.tilt);
                changed = true;
            }

            return changed;
        }
    }

    window.BrushSettings = BrushSettings;

    console.log('✅ brush-settings.js Phase B-6 loaded (ペン傾き設定対応版)');
    console.log('   ✅ tilt.sensitivity / affectsWidth / affectsRotation 追加');
    console.log('   ✅ setTiltSettings() / getTiltSettings() 実装');
    console.log('   ✅ Phase 3-D全機能継承');

})();