/**
 * tool-size-manager.js
 * P/E+ドラッグ機能 - EventBus統合完全版 v2
 * 
 * 🔧 修正内容 v2:
 * - dragState初期化時に軸ロック機能追加（先に動かした軸を優先）
 * - サイズに応じた感度の可変化（小サイズは繊細、大サイズは大胆に）
 * - 実サイズ変更の確実化
 */

(function() {
    'use strict';

    class ToolSizeManager {
        constructor(config, eventBus) {
            this.config = config;
            this.eventBus = eventBus;

            // ペン・消しゴムの現在値（config.tools構造から取得）
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

            // BrushSettings直接参照（初期化後に設定される）
            this.brushSettings = null;

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
                    currentOpacity: data.startOpacity,
                    lockedAxis: null, // 'size' or 'opacity'
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
                
                // 累積デルタを更新
                this.dragState.totalDeltaX += Math.abs(data.deltaX);
                this.dragState.totalDeltaY += Math.abs(data.deltaY);

                // 軸ロック判定（最初に5px以上動いた軸を優先）
                if (!this.dragState.lockedAxis) {
                    if (this.dragState.totalDeltaX > 5) {
                        this.dragState.lockedAxis = 'size';
                    } else if (this.dragState.totalDeltaY > 5) {
                        this.dragState.lockedAxis = 'opacity';
                    }
                }

                let newSize = this.dragState.currentSize;
                let newOpacity = this.dragState.currentOpacity;

                // サイズ計算（軸ロックされていない、またはsize軸の場合）
                if (!this.dragState.lockedAxis || this.dragState.lockedAxis === 'size') {
                    // サイズに応じた感度の可変化
                    let sizeSensitivity = sensitivity.size.sensitivity;
                    if (this.dragState.startSize < 10) {
                        sizeSensitivity *= 0.5; // 小サイズは繊細に
                    } else if (this.dragState.startSize > 30) {
                        sizeSensitivity *= 2.0; // 大サイズは大胆に
                    }

                    newSize = Math.max(
                        sensitivity.size.min,
                        Math.min(
                            sensitivity.size.max,
                            this.dragState.startSize + data.deltaX * sizeSensitivity
                        )
                    );
                }

                // 透明度計算（軸ロックされていない、またはopacity軸の場合）
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

        /**
         * BrushSettings取得（強制パッチ互換メソッド）
         */
        _getBrushSettings() {
            // 直接参照が既に設定されている場合
            if (this.brushSettings) {
                return this.brushSettings;
            }

            // CoreRuntime.api経由で取得
            if (window.CoreRuntime?.api?.getDrawingEngine) {
                const de = window.CoreRuntime.api.getDrawingEngine();
                if (de?.settings) {
                    this.brushSettings = de.settings;
                    return de.settings;
                }
            }

            // フォールバック: 直接参照を試行
            const candidates = [
                window.coreEngine?.drawingEngine,
                window.drawingApp?.drawingEngine,
                window.CoreEngine?.drawingEngine,
                window.drawingEngine
            ];

            for (const de of candidates) {
                if (de?.settings) {
                    this.brushSettings = de.settings;
                    return de.settings;
                }
            }

            return null;
        }

        /**
         * BrushSettingsへの値反映
         */
        _updateBrushSettings(size, opacity) {
            const brushSettings = this._getBrushSettings();
            
            if (!brushSettings) {
                return;
            }

            try {
                if (typeof brushSettings.setBrushSize === 'function') {
                    brushSettings.setBrushSize(size);
                }
                if (typeof brushSettings.setBrushOpacity === 'function') {
                    brushSettings.setBrushOpacity(opacity);
                }
            } catch (e) {
                // 静かに失敗
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
            // CoreRuntime.api経由で取得
            if (window.CoreRuntime?.api?.getCurrentTool) {
                return window.CoreRuntime.api.getCurrentTool();
            }

            // フォールバック: DrawingEngineから取得
            const de = window.coreEngine?.drawingEngine || 
                       window.drawingApp?.drawingEngine;
            
            return de?.currentTool || 'pen';
        }

        /**
         * デバッグ情報
         */
        getDebugInfo() {
            return {
                penSize: this.penSize,
                penOpacity: this.penOpacity,
                eraserSize: this.eraserSize,
                eraserOpacity: this.eraserOpacity,
                dragState: this.dragState,
                sizeSlots: this.sizeSlots,
                brushSettings: !!this._getBrushSettings()
            };
        }
    }

    // グローバル登録
    window.ToolSizeManager = ToolSizeManager;
})();

console.log('✅ tool-size-manager.js v2 loaded (軸ロック + 可変感度)');