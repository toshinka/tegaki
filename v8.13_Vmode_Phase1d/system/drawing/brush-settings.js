/**
 * BrushSettings - ブラシ設定管理クラス（簡素化版）
 * 
 * 責務: 描画設定の保持と取得のみ
 * 複雑な補正ロジックはPressureHandlerに移譲
 */

class BrushSettings {
    constructor(config, eventBus) {
        this.config = config || {};
        this.eventBus = eventBus;

        // 基本設定
        this.size = this.config.pen?.size || 8;
        this.color = 0x000000;
        this.alpha = this.config.pen?.opacity || 1.0;
        
        // devicePixelRatio対応最小幅
        this.minPhysicalWidth = 1; // StrokeRendererで計算される実際の値

        // EventBus購読
        this.subscribeToEvents();
    }

    /**
     * イベント購読
     */
    subscribeToEvents() {
        if (!this.eventBus) return;

        this.eventBus.on('brush:size-changed', ({ size }) => {
            this.size = size;
        });

        this.eventBus.on('brush:color-changed', ({ color }) => {
            this.color = color;
        });

        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {
            this.alpha = alpha;
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
        if (this.eventBus) {
            this.eventBus.emit('brush:size-changed', { size: this.size });
        }
    }

    /**
     * 色取得
     */
    getColor() {
        return this.color;
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

    /**
     * 透明度取得
     */
    getAlpha() {
        return this.alpha;
    }

    /**
     * 透明度設定
     */
    setAlpha(alpha) {
        this.alpha = Math.max(0, Math.min(1, alpha));
        if (this.eventBus) {
            this.eventBus.emit('brush:alpha-changed', { alpha: this.alpha });
        }
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
            minPhysicalWidth: this.minPhysicalWidth
        };
    }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
    window.TegakiDrawing = {};
}
window.TegakiDrawing.BrushSettings = BrushSettings;