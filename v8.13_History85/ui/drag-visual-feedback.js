// ===== ui/drag-visual-feedback.js - 視覚フィードバック強化版 =====
// 責務: P/E+ドラッグ時の視覚的フィードバック
// - リニアに変化する円のプレビュー
// - サイズと透明度の数値表示
// - スムーズなアニメーション

window.DragVisualFeedback = (function() {
    'use strict';

    class DragVisualFeedback {
        constructor(config, eventBus) {
            this.config = config;
            this.eventBus = eventBus;
            this.container = null;
            this.circle = null;
            this.textContainer = null;
            this.isActive = false;
            this.currentTool = null;
            
            this._createElements();
            this._setupEventListeners();
        }

        _createElements() {
            // メインコンテナ
            this.container = document.createElement('div');
            this.container.id = 'drag-visual-feedback';
            this.container.style.cssText = `
                position: fixed;
                pointer-events: none;
                z-index: 10000;
                display: none;
            `;
            
            // プレビュー円
            this.circle = document.createElement('div');
            this.circle.style.cssText = `
                position: absolute;
                border-radius: 50%;
                border: 2px solid ${this.config.dragAdjustment.visual.textColor};
                background: transparent;
                transform: translate(-50%, -50%);
                transition: width 0.05s ease, height 0.05s ease, opacity 0.05s ease;
            `;
            
            // 数値表示コンテナ
            this.textContainer = document.createElement('div');
            this.textContainer.style.cssText = `
                position: absolute;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: ${this.config.dragAdjustment.visual.fontSize}px;
                color: ${this.config.dragAdjustment.visual.textColor};
                background: rgba(255, 255, 255, 0.9);
                padding: 4px 8px;
                border-radius: 4px;
                white-space: nowrap;
                transform: translate(-50%, -100%);
                margin-top: -10px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            `;
            
            this.container.appendChild(this.circle);
            this.container.appendChild(this.textContainer);
            document.body.appendChild(this.container);
        }

        _setupEventListeners() {
            this.eventBus.on('visual-feedback:drag-start', (data) => {
                this._handleDragStart(data);
            });
            
            this.eventBus.on('visual-feedback:drag-update', (data) => {
                this._handleDragUpdate(data);
            });
            
            this.eventBus.on('visual-feedback:drag-end', () => {
                this._handleDragEnd();
            });
            
            // マウス位置追跡
            document.addEventListener('mousemove', (e) => {
                if (this.isActive) {
                    this._updatePosition(e.clientX, e.clientY);
                }
            });
        }

        _handleDragStart(data) {
            const { tool, size, opacity } = data;
            
            this.isActive = true;
            this.currentTool = tool;
            this.container.style.display = 'block';
            
            this._updateVisuals(size, opacity);
        }

        _handleDragUpdate(data) {
            if (!this.isActive) return;
            
            const { size, opacity } = data;
            this._updateVisuals(size, opacity);
        }

        _handleDragEnd() {
            if (!this.isActive) return;
            
            this.isActive = false;
            
            // フェードアウトアニメーション
            this.container.style.transition = `opacity ${this.config.dragAdjustment.visual.animationDuration}ms ease`;
            this.container.style.opacity = '0';
            
            setTimeout(() => {
                this.container.style.display = 'none';
                this.container.style.opacity = '1';
                this.container.style.transition = '';
            }, this.config.dragAdjustment.visual.animationDuration);
        }

        _updatePosition(x, y) {
            this.container.style.left = x + 'px';
            this.container.style.top = y + 'px';
        }

        _updateVisuals(size, opacity) {
            // 円のサイズを更新（リニアにスケール）
            const circleSize = size * 2; // 直径
            this.circle.style.width = circleSize + 'px';
            this.circle.style.height = circleSize + 'px';
            this.circle.style.opacity = Math.max(0.3, opacity);
            
            // 数値表示を更新
            if (this.config.dragAdjustment.visual.showValues) {
                const toolName = this.currentTool === 'pen' ? 'ペン' : '消しゴム';
                const sizeText = `サイズ: ${size.toFixed(1)}px`;
                const opacityText = `不透明度: ${(opacity * 100).toFixed(0)}%`;
                
                this.textContainer.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 2px;">${toolName}</div>
                    <div>${sizeText}</div>
                    <div>${opacityText}</div>
                `;
            }
            
            // テキストコンテナの位置調整（円の上に表示）
            const offset = (circleSize / 2) + 10;
            this.textContainer.style.marginTop = `-${offset + 50}px`;
        }

        // クリーンアップ
        destroy() {
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
        }
    }

    return DragVisualFeedback;
})();

console.log('✅ ui/drag-visual-feedback.js (視覚フィードバック強化版) loaded');