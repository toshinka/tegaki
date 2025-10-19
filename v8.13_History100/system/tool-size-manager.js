/**
 * tool-size-manager.js v4.0 - Phase2: 簡素化・DRY原則適用版
 * 
 * 改修内容:
 * - _getBrushSettings()をwindow.drawingEngine.settingsのみに簡素化
 * - 冗長な再試行ロジック削除
 * - イベント購読をtool:size-opacity-changedに統一
 * - 複数フォールバックパス削除
 */

(function() {
    'use strict';

    class ToolSizeManager {
        constructor(config, eventBus) {
            this.config = config;
            this.eventBus = eventBus;

            // ペン・消しゴムの現在値
            this.penSize = config.tools?.pen?.defaultSize || config.pen?.size || 10;
            this.penOpacity = config.tools?.pen?.defaultOpacity || config.pen?.opacity || 0.85;
            this.eraserSize = config.tools?.eraser?.defaultSize || config.eraser?.size || 20;
            this.eraserOpacity = config.tools?.eraser?.defaultOpacity || config.eraser?.opacity || 1.0;

            // サイズスロット（将来の1-9キー対応用）
            this.sizeSlots = {
                pen: [...(config.sizeSlots?.pen || [2, 4, 6, 8, 12, 16, 24, 36, 50])],
                eraser: [...(config.sizeSlots?.eraser || [10, 15, 20, 30, 40, 50, 60, 80, 100])]
            };

            // ドラッグ状態
            this.dragState = null;

            // EventBus購読
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
                    currentOpacity: data.startOpacity,
                    lockedAxis: null,
                    totalDeltaX: 0,
                    totalDeltaY: 0
                };
            });

            // tool:drag-size-update
            this.eventBus.on('tool:drag-size-update', (data) => {
                if (!this.dragState || this.dragState.tool !== data.tool) {
                    return;
                }

                const sensitivity = this.config.dragAdjustment;
                
                this.dragState.totalDeltaX += Math.abs(data.deltaX);
                this.dragState.totalDeltaY += Math.abs(data.deltaY);

                if (!this.dragState.lockedAxis) {
                    if (this.dragState.totalDeltaX > 5) {
                        this.dragState.lockedAxis = 'size';
                    } else if (this.dragState.totalDeltaY > 5) {
                        this.dragState.lockedAxis = 'opacity';
                    }
                }

                let newSize = this.dragState.currentSize;
                let newOpacity = this.dragState.currentOpacity;

                if (!this.dragState.lockedAxis || this.dragState.lockedAxis === 'size') {
                    let sizeSensitivity = sensitivity.size.sensitivity;
                    if (this.dragState.startSize < 10) {
                        sizeSensitivity *= 0.5;
                    } else if (this.dragState.startSize > 30) {
                        sizeSensitivity *= 2.0;
                    }

                    newSize = Math.max(
                        sensitivity.size.min,
                        Math.min(
                            sensitivity.size.max,
                            this.dragState.startSize + data.deltaX * sizeSensitivity
                        )
                    );
                }

                if (!this.dragState.lockedAxis || this.dragState.lockedAxis === 'opacity') {
                    newOpacity = Math.max(
                        sensitivity.opacity.min,
                        Math.min(
                            sensitivity.opacity.max,
                            this.dragState.startOpacity - data.deltaY * sensitivity.opacity.sensitivity
                        )
                    );
                }

                this.dragState.currentSize = newSize;
                this.dragState.currentOpacity = newOpacity;

                if (data.tool === 'pen') {
                    this.penSize = newSize;
                    this.penOpacity = newOpacity;
                } else if (data.tool === 'eraser') {
                    this.eraserSize = newSize;
                    this.eraserOpacity = newOpacity;
                }

                // BrushSettingsに反映
                this._updateBrushSettings(newSize, newOpacity);

                // tool:size-opacity-changed イベント発行
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

        /**
         * BrushSettings取得（window.drawingEngine.settings優先）
         */
        _getBrushSettings() {
            // Phase2: window.drawingEngineのみを参照
            if (!window.drawingEngine?.settings) {
                return null;
            }

            return window.drawingEngine.settings;
        }

        /**
         * BrushSettingsへの値反映
         */
        _updateBrushSettings(size, opacity) {
            const brushSettings = this._getBrushSettings();
            
            if (!brushSettings) {
                return;
            }

            if (typeof brushSettings.setBrushSize === 'function') {
                brushSettings.setBrushSize(size);
            }

            if (typeof brushSettings.setBrushOpacity === 'function') {
                brushSettings.setBrushOpacity(opacity);
            }
        }

        /**
         * 将来の拡張用: サイズスロット選択
         */
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

        /**
         * 現在のツール取得
         */
        getCurrentTool() {
            if (window.CoreRuntime?.api?.getCurrentTool) {
                return window.CoreRuntime.api.getCurrentTool();
            }

            const de = window.drawingEngine;
            return de?.currentTool || 'pen';
        }

        /**
         * デバッグ情報
         */
        getDebugInfo() {
            const brushSettings = this._getBrushSettings();
            
            return {
                penSize: this.penSize,
                penOpacity: this.penOpacity,
                eraserSize: this.eraserSize,
                eraserOpacity: this.eraserOpacity,
                dragState: this.dragState,
                sizeSlots: this.sizeSlots,
                hasBrushSettings: !!brushSettings,
                brushSettingsDetails: brushSettings?.getCurrentSettings?.(),
                eventBusAvailable: !!this.eventBus
            };
        }
    }

    window.ToolSizeManager = ToolSizeManager;
})();