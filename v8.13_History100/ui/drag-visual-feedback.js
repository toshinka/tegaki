// ui/drag-visual-feedback.js - P/E+ドラッグ視覚フィードバック
// 🔧 修正: カーソル位置追従、ドラッグ開始位置に表示

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
            this.currentX = 0;
            this.currentY = 0;
            this.dragStartX = 0;
            this.dragStartY = 0;
            
            this._createElements();
            
            // 🔧 修正: EventBusの存在確認後にリスナー登録
            if (this.eventBus && typeof this.eventBus.on === 'function') {
                this._setupEventListeners();
            } else {
                setTimeout(() => this._retrySetupEventListeners(), 100);
            }
        }
        
        _retrySetupEventListeners() {
            if (window.TegakiEventBus && typeof window.TegakiEventBus.on === 'function') {
                this.eventBus = window.TegakiEventBus;
                this._setupEventListeners();
            } else {
                setTimeout(() => this._retrySetupEventListeners(), 100);
            }
        }

        _createElements() {
            const futabaColor = '#800000';
            
            this.container = document.createElement('div');
            this.container.id = 'drag-visual-feedback';
            this.container.style.cssText = `
                position: fixed;
                pointer-events: none;
                z-index: 10000;
                display: none;
            `;
            
            this.circle = document.createElement('div');
            this.circle.style.cssText = `
                position: absolute;
                border-radius: 50%;
                border: 2px solid ${futabaColor};
                background: transparent;
                transform: translate(-50%, -50%);
                transition: width 0.05s ease, height 0.05s ease, opacity 0.05s ease;
            `;
            
            this.textContainer = document.createElement('div');
            this.textContainer.style.cssText = `
                position: absolute;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 13px;
                color: ${futabaColor};
                background: rgba(255, 248, 220, 0.95);
                padding: 6px 10px;
                border-radius: 4px;
                border: 1px solid ${futabaColor};
                white-space: nowrap;
                transform: translate(-50%, -100%);
                margin-top: -10px;
                box-shadow: 0 2px 8px rgba(128, 0, 0, 0.2);
            `;
            
            this.container.appendChild(this.circle);
            this.container.appendChild(this.textContainer);
            document.body.appendChild(this.container);
        }

        _setupEventListeners() {
            this.eventBus.on('tool:drag-size-start', (data) => {
                this._handleDragStart(data);
            });
            
            this.eventBus.on('tool:size-opacity-changed', (data) => {
                this._handleDragUpdate(data);
            });
            
            this.eventBus.on('tool:drag-size-end', () => {
                this._handleDragEnd();
            });
            
            // 🔧 修正: マウス移動でカーソル位置を常に更新
            document.addEventListener('mousemove', (e) => {
                this.currentX = e.clientX;
                this.currentY = e.clientY;
                
                if (this.isActive) {
                    this._updatePosition();
                }
            });
        }

        _handleDragStart(data) {
            const { tool, startSize, startOpacity } = data;
            
            this.isActive = true;
            this.currentTool = tool;
            this.container.style.display = 'block';
            
            // 🔧 修正: ドラッグ開始位置を記録
            this.dragStartX = this.currentX;
            this.dragStartY = this.currentY;
            
            // 初期位置をドラッグ開始位置に設定
            this._updatePosition();
            this._updateVisuals(startSize, startOpacity);
        }

        _handleDragUpdate(data) {
            if (!this.isActive) return;
            
            const { size, opacity } = data;
            this._updateVisuals(size, opacity);
        }

        _handleDragEnd() {
            if (!this.isActive) return;
            
            this.isActive = false;
            
            const duration = this.config.dragAdjustment?.visual?.animationDuration || 200;
            this.container.style.transition = `opacity ${duration}ms ease`;
            this.container.style.opacity = '0';
            
            setTimeout(() => {
                this.container.style.display = 'none';
                this.container.style.opacity = '1';
                this.container.style.transition = '';
            }, duration);
        }

        _updatePosition() {
            // 🔧 修正: 現在のカーソル位置に表示
            this.container.style.left = this.currentX + 'px';
            this.container.style.top = this.currentY + 'px';
        }

        _updateVisuals(size, opacity) {
            const circleSize = size * 2;
            this.circle.style.width = circleSize + 'px';
            this.circle.style.height = circleSize + 'px';
            this.circle.style.opacity = Math.max(0.3, opacity);
            
            const toolName = this.currentTool === 'pen' ? 'ペン' : '消しゴム';
            const sizeText = `サイズ: ${size.toFixed(1)}px`;
            const opacityText = `不透明度: ${(opacity * 100).toFixed(0)}%`;
            
            this.textContainer.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 2px;">${toolName}</div>
                <div>${sizeText}</div>
                <div>${opacityText}</div>
            `;
            
            const offset = (circleSize / 2) + 10;
            this.textContainer.style.marginTop = `-${offset + 50}px`;
        }

        destroy() {
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
        }
    }

    return DragVisualFeedback;
})();

console.log('✅ drag-visual-feedback.js loaded (カーソル追従改善)');