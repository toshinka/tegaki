// ===== system/tool-size-manager.js =====
// 責務: ツールサイズ・透明度の一元管理
// - P/E+ドラッグ時のサイズ・透明度計算
// - BrushSettings への反映
// - EventBus 統合
// - 将来のサイズスロット機能（1-9キー）の基盤

window.ToolSizeManager = (function() {
    'use strict';

    class ToolSizeManager {
        constructor(config, eventBus) {
            this.config = config;
            this.eventBus = eventBus;
            
            // 現在のツール設定
            this.penSize = config.tools.pen.defaultSize;
            this.penOpacity = config.tools.pen.defaultOpacity;
            this.eraserSize = config.tools.eraser.defaultSize;
            this.eraserOpacity = config.tools.eraser.defaultOpacity;
            
            // サイズスロット（将来の1-9キー対応用）
            this.sizeSlots = {
                pen: [...config.sizeSlots.pen],
                eraser: [...config.sizeSlots.eraser]
            };
            
            // ドラッグ状態
            this.dragState = {
                active: false,
                tool: null,
                startSize: 0,
                startOpacity: 0
            };
            
            this._setupEventListeners();
        }

        _setupEventListeners() {
            console.log('🔧 ToolSizeManager: Setting up event listeners...');
            
            // P/E+ドラッグイベントを購読
            this.eventBus.on('tool:drag-size-start', (data) => {
                console.log('📨 ToolSizeManager: Received drag-size-start', data);
                this._handleDragStart(data);
            });
            
            this.eventBus.on('tool:drag-size-update', (data) => {
                this._handleDragUpdate(data);
            });
            
            this.eventBus.on('tool:drag-size-end', () => {
                console.log('📨 ToolSizeManager: Received drag-size-end');
                this._handleDragEnd();
            });
            
            console.log('✅ ToolSizeManager: Event listeners registered');
        }

        _handleDragStart(data) {
            const { tool, startSize, startOpacity } = data;
            
            console.log('✅ ToolSizeManager: Drag started', { tool, startSize, startOpacity });
            
            this.dragState = {
                active: true,
                tool,
                startSize,
                startOpacity
            };
            
            // 視覚フィードバックを開始
            this.eventBus.emit('visual-feedback:drag-start', {
                tool,
                size: startSize,
                opacity: startOpacity
            });
        }

        _handleDragUpdate(data) {
            if (!this.dragState.active) return;
            
            const { tool, deltaX, deltaY } = data;
            const { startSize, startOpacity } = this.dragState;
            
            // ドラッグ感度設定を取得
            const sizeConfig = this.config.dragAdjustment.size;
            const opacityConfig = this.config.dragAdjustment.opacity;
            
            // サイズ計算（左右ドラッグ）
            let newSize = startSize + (deltaX * sizeConfig.sensitivity);
            newSize = Math.max(sizeConfig.min, Math.min(sizeConfig.max, newSize));
            
            // 透明度計算（上下ドラッグ、下方向で透明度UP）
            let newOpacity = startOpacity + (deltaY * opacityConfig.sensitivity);
            newOpacity = Math.max(opacityConfig.min, Math.min(opacityConfig.max, newOpacity));
            
            // 内部状態を更新
            if (tool === 'pen') {
                this.penSize = newSize;
                this.penOpacity = newOpacity;
            } else if (tool === 'eraser') {
                this.eraserSize = newSize;
                this.eraserOpacity = newOpacity;
            }
            
            // BrushSettings に反映
            this._applyToBrushSettings(tool, newSize, newOpacity);
            
            // 視覚フィードバックを更新
            this.eventBus.emit('visual-feedback:drag-update', {
                tool,
                size: newSize,
                opacity: newOpacity
            });
            
            // 変更通知
            this.eventBus.emit('tool:size-opacity-changed', {
                tool,
                size: newSize,
                opacity: newOpacity
            });
        }

        _handleDragEnd() {
            if (!this.dragState.active) return;
            
            const { tool } = this.dragState;
            const finalSize = tool === 'pen' ? this.penSize : this.eraserSize;
            const finalOpacity = tool === 'pen' ? this.penOpacity : this.eraserOpacity;
            
            // 視覚フィードバックを終了
            this.eventBus.emit('visual-feedback:drag-end', {
                tool,
                size: finalSize,
                opacity: finalOpacity
            });
            
            // 完了通知
            this.eventBus.emit('tool:size-drag-completed', {
                tool,
                finalSize,
                finalOpacity
            });
            
            this.dragState.active = false;
        }

        _applyToBrushSettings(tool, size, opacity) {
            const drawingEngine = window.drawingApp?.drawingEngine;
            if (!drawingEngine) return;
            
            if (tool === 'pen') {
                const brushSettings = drawingEngine.brushSettings;
                if (brushSettings) {
                    brushSettings.setBrushSize(size);
                    brushSettings.setBrushOpacity(opacity);
                }
            } else if (tool === 'eraser') {
                const eraserSettings = drawingEngine.eraserBrushSettings;
                if (eraserSettings) {
                    eraserSettings.setBrushSize(size);
                    eraserSettings.setBrushOpacity(opacity);
                }
            }
        }

        // サイズスロット選択（将来の1-9キー対応用）
        selectSizeSlot(tool, slotIndex) {
            if (slotIndex < 0 || slotIndex >= 9) return;
            
            const slots = this.sizeSlots[tool];
            if (!slots) return;
            
            const size = slots[slotIndex];
            
            if (tool === 'pen') {
                this.penSize = size;
            } else if (tool === 'eraser') {
                this.eraserSize = size;
            }
            
            this._applyToBrushSettings(tool, size, tool === 'pen' ? this.penOpacity : this.eraserOpacity);
            
            this.eventBus.emit('tool:size-slot-selected', {
                tool,
                slot: slotIndex + 1,
                size
            });
        }

        // デバッグ情報取得
        getDebugInfo() {
            return {
                penSize: this.penSize,
                penOpacity: this.penOpacity,
                eraserSize: this.eraserSize,
                eraserOpacity: this.eraserOpacity,
                dragActive: this.dragState.active,
                dragTool: this.dragState.tool
            };
        }
    }

    return ToolSizeManager;
})();

console.log('✅ system/tool-size-manager.js loaded');