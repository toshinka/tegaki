/**
 * ================================================================================
 * drawing/brush-settings.js - Phase 3.5: シングルトン初期化版
 * ================================================================================
 * 
 * 【親依存】
 * - config.js (TEGAKI_CONFIG)
 * - system/event-bus.js (TegakiEventBus)
 * 
 * 【子依存】
 * - raster-brush-engine.js (getCurrentBrush()使用)
 * - drawing-controller.js (settings取得)
 * - ui/settings-popup.js (UI連携)
 * 
 * 【Phase 3.5改修内容】
 * 🔧 シングルトンインスタンス自動作成
 * 🔧 getCurrentBrush()メソッド追加（getSettings()のエイリアス）
 * ✅ Phase B-6全機能継承
 * 
 * 【責務】
 * - ブラシ設定の集中管理（サイズ、色、不透明度、流量、ツールモード、傾き設定）
 * - 設定変更イベントの発行
 * - デフォルト値の管理
 * ================================================================================
 */

(function() {
    'use strict';

    class BrushSettings {
        constructor(config, eventBus) {
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus || window.TegakiEventBus;

            if (!this.config) {
                console.warn('[BrushSettings] Config not found, using defaults');
                this.config = {
                    BRUSH_DEFAULTS: {
                        size: 10,
                        color: 0x800000,
                        opacity: 1.0,
                        flow: 0.8,
                        spacing: 0.1,
                        minWidth: 1,
                        maxWidth: 100
                    }
                };
            }

            // デフォルト値
            this.size = this.config.BRUSH_DEFAULTS?.size || 10;
            this.color = this.config.BRUSH_DEFAULTS?.color || 0x800000;
            this.opacity = this.config.BRUSH_DEFAULTS?.opacity || 1.0;
            this.flow = this.config.BRUSH_DEFAULTS?.flow || 0.8;
            this.spacing = this.config.BRUSH_DEFAULTS?.spacing || 0.1;
            this.minWidth = this.config.BRUSH_DEFAULTS?.minWidth || 1;
            this.maxWidth = this.config.BRUSH_DEFAULTS?.maxWidth || 100;
            
            // ツールモード
            this.mode = 'pen'; // 'pen' | 'eraser' | 'fill'
            
            // ペン傾き設定
            this.tilt = {
                sensitivity: 0.5,
                affectsWidth: true,
                affectsRotation: false,
                widthMin: 0.5,
                widthMax: 1.5
            };

            console.log('[BrushSettings] Initialized:', this.getSettings());
        }

        // ========================================
        // ツールモード
        // ========================================
        setMode(mode) {
            if (mode !== 'pen' && mode !== 'eraser' && mode !== 'fill') {
                console.warn('[BrushSettings] Invalid mode:', mode);
                return;
            }

            const oldMode = this.mode;
            this.mode = mode;
            
            if (oldMode !== this.mode && this.eventBus) {
                this.eventBus.emit('brush:mode-changed', { 
                    mode: this.mode,
                    oldMode
                });
            }
        }

        getMode() {
            return this.mode;
        }

        // ========================================
        // サイズ
        // ========================================
        setSize(size) {
            const oldSize = this.size;
            this.size = Math.max(this.minWidth, Math.min(this.maxWidth, size));
            
            if (oldSize !== this.size && this.eventBus) {
                this.eventBus.emit('brush:size-changed', { 
                    size: this.size,
                    oldSize
                });
            }
        }

        getSize() {
            return this.size;
        }

        // ========================================
        // 色
        // ========================================
        setColor(color) {
            const oldColor = this.color;
            this.color = color;
            
            if (oldColor !== this.color && this.eventBus) {
                this.eventBus.emit('brush:color-changed', { 
                    color: this.color,
                    oldColor
                });
            }
        }

        getColor() {
            return this.color;
        }

        // ========================================
        // 不透明度
        // ========================================
        setOpacity(opacity) {
            const oldOpacity = this.opacity;
            
            // 0-100の場合は0.0-1.0に変換
            if (opacity > 1) {
                opacity = opacity / 100;
            }
            
            this.opacity = Math.max(0, Math.min(1, opacity));
            
            if (oldOpacity !== this.opacity && this.eventBus) {
                this.eventBus.emit('brush:opacity-changed', { 
                    opacity: this.opacity,
                    oldOpacity
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

        // ========================================
        // 流量
        // ========================================
        setFlow(flow) {
            const oldFlow = this.flow;
            this.flow = Math.max(0, Math.min(1, flow));
            
            if (oldFlow !== this.flow && this.eventBus) {
                this.eventBus.emit('brush:flow-changed', { 
                    flow: this.flow,
                    oldFlow
                });
            }
        }

        getFlow() {
            return this.flow;
        }

        // ========================================
        // スペーシング
        // ========================================
        setSpacing(spacing) {
            this.spacing = Math.max(0.01, Math.min(1.0, spacing));
        }

        getSpacing() {
            return this.spacing;
        }

        // ========================================
        // ペン傾き設定
        // ========================================
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

            if (tiltSettings.affectsWidth !== undefined) {
                if (this.tilt.affectsWidth !== tiltSettings.affectsWidth) {
                    this.tilt.affectsWidth = tiltSettings.affectsWidth;
                    changed = true;
                }
            }

            if (tiltSettings.affectsRotation !== undefined) {
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
                    tilt: { ...this.tilt },
                    oldSettings: oldSettings
                });
            }
        }

        getTiltSettings() {
            return { ...this.tilt };
        }

        // ========================================
        // 設定取得（統合）
        // ========================================
        getSettings() {
            return {
                size: this.size,
                color: this.color,
                opacity: this.opacity,
                flow: this.flow,
                spacing: this.spacing,
                alpha: this.opacity,
                mode: this.mode,
                minWidth: this.minWidth,
                maxWidth: this.maxWidth,
                tilt: { ...this.tilt }
            };
        }

        /**
         * 🆕 Phase 3.5: getCurrentBrush() エイリアス
         * raster-brush-engine.jsとの互換性のため
         */
        getCurrentBrush() {
            return this.getSettings();
        }

        // ========================================
        // 設定更新（一括）
        // ========================================
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

            if (settings.flow !== undefined && settings.flow !== this.flow) {
                this.setFlow(settings.flow);
                changed = true;
            }

            if (settings.spacing !== undefined && settings.spacing !== this.spacing) {
                this.setSpacing(settings.spacing);
                changed = true;
            }

            if (settings.mode !== undefined && settings.mode !== this.mode) {
                this.setMode(settings.mode);
                changed = true;
            }

            if (settings.tilt !== undefined) {
                this.setTiltSettings(settings.tilt);
                changed = true;
            }

            return changed;
        }
    }

    // ========================================
    // クラス定義をグローバル登録
    // ========================================
    window.BrushSettings = BrushSettings;

    // ========================================
    // シングルトンインスタンス自動作成
    // ========================================
    window.brushSettings = new BrushSettings();

    console.log('✅ brush-settings.js Phase 3.5 loaded (シングルトン初期化版)');
    console.log('   🔧 window.brushSettings インスタンス作成');
    console.log('   🔧 getCurrentBrush()メソッド追加');
    console.log('   ✅ Phase B-6全機能継承');

})();