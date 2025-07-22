/**
 * Canvas2DRenderer.js - Canvas2D専用ラスター描画エンジン
 * 
 * 憲章準拠：
 * - ブラシ・消しゴムツール専用（ペンツール絶対禁止）
 * - ラスター描画に特化した設計
 * - BezierStrokeRenderer.jsとの役割分離厳守
 * 
 * Phase2-A制約：
 * - 最小限の実装（後回し可能）
 * - ToolEngineController経由でのみアクセス
 */
class Canvas2DRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isActive = false;
        this.lastPoint = null;
        
        // ラスター描画設定
        this.settings = {
            size: 20,
            opacity: 1.0,
            color: '#800000',
            hardness: 0.8  // ブラシの硬さ
        };

        // 禁止事項チェック
        this._validateToolRestrictions();
    }

    /**
     * 憲章準拠：ペンツール使用禁止の物理的強制
     */
    _validateToolRestrictions() {
        if (window.currentTool === 'pen') {
            throw new Error('🚨 憲章違反: Canvas2DRendererでペンツール使用禁止');
        }
    }

    /**
     * 描画設定更新
     */
    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * ブラシストローク開始
     */
    startBrushStroke(x, y, pressure = 0.5) {
        this._validateToolRestrictions();
        
        this.isActive = true;
        this.lastPoint = { x, y, pressure };
        
        // ブラシ開始点描画
        this._drawBrushPoint(x, y, pressure);
    }

    /**
     * ブラシストローク継続
     */
    continueBrushStroke(x, y, pressure = 0.5) {
        if (!this.isActive || !this.lastPoint) return;
        
        this._validateToolRestrictions();
        
        // 連続ブラシストローク描画
        this._drawBrushLine(this.lastPoint, { x, y, pressure });
        this.lastPoint = { x, y, pressure };
    }

    /**
     * ブラシストローク終了
     */
    endBrushStroke() {
        this.isActive = false;
        this.lastPoint = null;
    }

    /**
     * 消しゴムストローク開始
     */
    startEraserStroke(x, y) {
        this.isActive = true;
        this.lastPoint = { x, y };
        
        this._drawEraserPoint(x, y);
    }

    /**
     * 消しゴムストローク継続
     */
    continueEraserStroke(x, y) {
        if (!this.isActive || !this.lastPoint) return;
        
        this._drawEraserLine(this.lastPoint, { x, y });
        this.lastPoint = { x, y };
    }

    /**
     * 消しゴムストローク終了
     */
    endEraserStroke() {
        this.isActive = false;
        this.lastPoint = null;
    }

    /**
     * ブラシ単点描画（内部メソッド）
     */
    _drawBrushPoint(x, y, pressure) {
        const dynamicSize = this.settings.size * Math.max(0.3, pressure);
        
        this.ctx.save();
        this.ctx.globalAlpha = this.settings.opacity;
        this.ctx.fillStyle = this.settings.color;
        
        // ソフトブラシ効果（グラデーション）
        if (this.settings.hardness < 1.0) {
            const gradient = this.ctx.createRadialGradient(
                x, y, 0,
                x, y, dynamicSize / 2
            );
            gradient.addColorStop(0, this.settings.color);
            gradient.addColorStop(this.settings.hardness, this.settings.color);
            gradient.addColorStop(1, this.settings.color + '00'); // 透明
            this.ctx.fillStyle = gradient;
        }
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, dynamicSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    /**
     * ブラシライン描画（内部メソッド）
     */
    _drawBrushLine(from, to) {
        const steps = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y) / 2);
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = from.x + (to.x - from.x) * t;
            const y = from.y + (to.y - from.y) * t;
            const pressure = from.pressure + (to.pressure - from.pressure) * t;
            
            this._drawBrushPoint(x, y, pressure);
        }
    }

    /**
     * 消しゴム単点描画（内部メソッド）
     */
    _drawEraserPoint(x, y) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.settings.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    /**
     * 消しゴムライン描画（内部メソッド）
     */
    _drawEraserLine(from, to) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.lineWidth = this.settings.size;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * キャンバス初期化
     */
    initCanvas() {
        const dpr = 1; // DPR=1固定（憲章準拠）
        this.canvas.width = 800 * dpr;
        this.canvas.height = 600 * dpr;
        this.ctx.scale(dpr, dpr);
        
        // Canvas2D最適化設定
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    /**
     * キャンバスクリア
     */
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * ポインタデータ取得（ToolEngineController用）
     */
    getPointerData(event) {
        const rect = this.canvas.getBoundingClientRect();
        let pressure = event.pressure !== undefined ? event.pressure : 0.5;
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            pressure: Math.max(0.1, Math.min(1.0, pressure))
        };
    }

    /**
     * 描画エンジン情報取得
     */
    getEngineInfo() {
        return {
            name: 'Canvas2D Raster',
            type: 'raster',
            supportedTools: ['brush', 'eraser'],
            version: '1.0.0'
        };
    }
}

// Phase2-A制約：グローバルエクスポート（後でモジュール化）
window.Canvas2DRenderer = Canvas2DRenderer;