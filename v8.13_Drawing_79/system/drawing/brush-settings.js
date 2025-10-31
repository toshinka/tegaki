/**
 * BrushSettings - ブラシ設定管理クラス（Phase 2統合版）
 * 
 * 責務: ペンの色・サイズ・透明度を一元管理
 * 
 * Phase 2変更:
 * - window.BrushSettings として直接公開（core-engine.jsとの互換性）
 * - グローバル統一（TegakiDrawing名前空間は後方互換として維持）
 */

(function() {
    'use strict';

    class BrushSettings {
        constructor(config, eventBus) {
            this.config = config || window.TEGAKI_CONFIG || {};
            this.eventBus = eventBus;

            // config.jsから初期値を取得（デフォルト値を背後に配置）
            const penConfig = this.config.pen || {};
            
            // デフォルト値をconfig.jsから取得
            this.size = penConfig.size !== undefined ? penConfig.size : 3;
            this.color = penConfig.color !== undefined ? penConfig.color : 0x800000; // futaba-maroon
            this.alpha = penConfig.opacity !== undefined ? penConfig.opacity : 1.0;
            
            // devicePixelRatio対応最小幅
            this.minPhysicalWidth = 1;

            // EventBus購読
            this.subscribeToEvents();
        }

        /**
         * イベント購読
         */
        subscribeToEvents() {
            if (!this.eventBus) return;

            // サイズ変更
            this.eventBus.on('brush:size-changed', (data) => {
                const size = data.size !== undefined ? data.size : data.data?.size;
                if (size !== undefined) this.setSize(size);
            });

            // 色変更
            this.eventBus.on('brush:color-changed', (data) => {
                const color = data.color !== undefined ? data.color : data.data?.color;
                if (color !== undefined) this.setColor(color);
            });

            // 透明度変更（0.0-1.0形式）
            this.eventBus.on('brush:alpha-changed', (data) => {
                const alpha = data.alpha !== undefined ? data.alpha : data.data?.alpha;
                if (alpha !== undefined) this.setAlpha(alpha);
            });

            // 透明度変更（0-100%形式）
            this.eventBus.on('brush:opacity-changed', (data) => {
                const opacity = data.opacity !== undefined ? data.opacity : data.data?.opacity;
                if (opacity !== undefined) this.setOpacity(opacity);
            });
        }

        /**
         * サイズ取得
         */
        getSize() {
            return this.size;
        }

        /**
         * サイズ設定
         */
        setSize(size) {
            this.size = Math.max(0.1, Math.min(500, size));
        }

        /**
         * 色取得（0xRRGGBB形式）
         */
        getColor() {
            return this.color;
        }

        /**
         * 色設定
         */
        setColor(color) {
            // 16進数値チェック
            if (typeof color === 'string') {
                this.color = parseInt(color, 16);
            } else {
                this.color = color;
            }
        }

        /**
         * 透明度取得（0.0-1.0）
         */
        getAlpha() {
            return this.alpha;
        }

        /**
         * 透明度設定（0.0-1.0）
         */
        setAlpha(alpha) {
            this.alpha = Math.max(0, Math.min(1, alpha));
        }

        /**
         * 透明度取得（0-100%）
         * UI表示用
         */
        getOpacity() {
            return this.alpha * 100;
        }

        /**
         * 透明度設定（0-100%）
         * UI操作用
         */
        setOpacity(opacity) {
            this.setAlpha(opacity / 100);
        }

        /**
         * 最小物理幅設定（StrokeRendererから呼ばれる）
         */
        setMinPhysicalWidth(width) {
            this.minPhysicalWidth = width;
        }

        /**
         * 最小物理幅取得
         */
        getMinPhysicalWidth() {
            return this.minPhysicalWidth;
        }

        /**
         * 現在の設定を一括取得
         */
        getCurrentSettings() {
            return {
                size: this.size,
                color: this.color,
                alpha: this.alpha,
                opacity: this.getOpacity(),
                minPhysicalWidth: this.minPhysicalWidth
            };
        }

        /**
         * 設定を一括設定
         */
        setCurrentSettings(settings) {
            if (settings.size !== undefined) this.setSize(settings.size);
            if (settings.color !== undefined) this.setColor(settings.color);
            if (settings.alpha !== undefined) this.setAlpha(settings.alpha);
            if (settings.opacity !== undefined) this.setOpacity(settings.opacity);
        }

        /**
         * デフォルトにリセット
         */
        resetToDefaults() {
            const penConfig = this.config.pen || {};
            this.size = penConfig.size !== undefined ? penConfig.size : 3;
            this.color = penConfig.color !== undefined ? penConfig.color : 0x800000;
            this.alpha = penConfig.opacity !== undefined ? penConfig.opacity : 1.0;
        }
    }

    // ✅ Phase 2: グローバル統一登録
    window.BrushSettings = BrushSettings;
    
    // 後方互換性: TegakiDrawing名前空間にも登録
    if (typeof window.TegakiDrawing === 'undefined') {
        window.TegakiDrawing = {};
    }
    window.TegakiDrawing.BrushSettings = BrushSettings;

    console.log('✅ system/drawing/brush-settings.js (Phase 2統合版) loaded');
    console.log('   - window.BrushSettings として公開');
    console.log('   - getOpacity() / setOpacity() API提供');

})();