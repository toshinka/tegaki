/**
 * tool-size-manager.js
 * EventBus統合修正版 - P/E+ドラッグ機能対応
 */

(function() {
    'use strict';

    class ToolSizeManager {
        constructor(config, eventBus) {
            this.config = config;
            this.eventBus = eventBus;

            // ペン・消しゴムの現在値
            this.penSize = config.tools.pen.size;
            this.penOpacity = config.tools.pen.opacity;
            this.eraserSize = config.tools.eraser.size;
            this.eraserOpacity = config.tools.eraser.opacity;

            // サイズスロット（将来の1-9キー対応用）
            this.sizeSlots = {
                pen: [...config.sizeSlots.pen],
                eraser: [...config.sizeSlots.eraser]
            };

            // ドラッグ状態
            this.dragState = null;

            // EventBusリスナー登録
            this._setupEventListeners();
        }

        _setupEventListeners() {
            if (!this.eventBus) return;

            // tool:drag-size-start
            this.eventBus.on('tool:drag-size-start', (data) => {
                this.dragState = {
                    tool: data.tool,
                    startSize: data.startSize,
                    startOpacity: data.startOpacity,
                    currentSize: data.startSize,
                    currentOpacity: data.startOpacity
                };
            });

            // tool:drag-size-update
            this.eventBus.on('tool:drag-size-update', (data) => {
                if (!this.dragState || this.dragState.tool !== data.tool) {
                    return;
                }

                const sensitivity = this.config.dragAdjustment;

                // サイズ計算
                const newSize = Math.max(
                    sensitivity.size.min,
                    Math.min(
                        sensitivity.size.max,
                        this.dragState.startSize + data.deltaX * sensitivity.size.sensitivity
                    )
                );

                // 透明度計算（下方向で透明度UP = deltaYを反転）
                const newOpacity = Math.max(
                    sensitivity.opacity.min,
                    Math.min(
                        sensitivity.opacity.max,
                        this.dragState.startOpacity - data.deltaY * sensitivity.opacity.sensitivity
                    )
                );

                this.dragState.currentSize = newSize;
                this.dragState.currentOpacity = newOpacity;

                // 値を保存
                if (data.tool === 'pen') {
                    this.penSize = newSize;
                    this.penOpacity = newOpacity;
                } else if (data.tool === 'eraser') {
                    this.eraserSize = newSize;
                    this.eraserOpacity = newOpacity;
                }

                // BrushSettingsに反映
                this._updateBrushSettings(newSize, newOpacity);

                // イベント発行
                this.eventBus.emit('tool:size-opacity-changed', {
                    tool: data.tool,
                    size: newSize,
                    opacity: newOpacity
                });
            });

            // tool:drag-size-end
            this.eventBus.on('tool:drag-size-end', () => {
                if (!this.dragState) return;

                const { tool, currentSize, currentOpacity } = this.dragState;

                this.eventBus.emit('tool:size-drag-completed', {
                    tool,
                    finalSize: currentSize,
                    finalOpacity: currentOpacity
                });

                this.dragState = null;
            });
        }

        _updateBrushSettings(size, opacity) {
            const de = window.coreEngine?.drawingEngine || window.drawingApp?.drawingEngine;
            if (!de?.settings) return;

            de.settings.setBrushSize(size);
            de.settings.setBrushOpacity(opacity);
        }

        // 将来の拡張用: サイズスロット選択
        selectSizeSlot(slot) {
            const currentTool = this.getCurrentTool();
            if (!currentTool || slot < 1 || slot > 9) return;

            const slotIndex = slot - 1;
            const newSize = this.sizeSlots[currentTool][slotIndex];
            
            if (currentTool === 'pen') {
                this.penSize = newSize;
            } else if (currentTool === 'eraser') {
                this.eraserSize = newSize;
            }

            this._updateBrushSettings(newSize, 
                currentTool === 'pen' ? this.penOpacity : this.eraserOpacity);

            this.eventBus.emit('tool:size-slot-selected', {
                tool: currentTool,
                slot,
                size: newSize
            });
        }

        getCurrentTool() {
            // 現在のツール取得（将来的にToolManagerから取得）
            return 'pen';  // 仮実装
        }

        getDebugInfo() {
            return {
                penSize: this.penSize,
                penOpacity: this.penOpacity,
                eraserSize: this.eraserSize,
                eraserOpacity: this.eraserOpacity,
                dragState: this.dragState,
                sizeSlots: this.sizeSlots
            };
        }
    }

    // グローバル登録
    window.ToolSizeManager = ToolSizeManager;
})();