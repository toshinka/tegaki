/**
 * tool-size-manager.js v5.0 - DRY/SOLID準拠版
 * 
 * 改修内容:
 * - _getBrushSettings()を複数パス対応（フォールバック強化）
 * - ツール状態の二重管理を廃止（penSize/penOpacity等削除）
 * - dragState のみで一時状態を管理
 * - BrushSettings を唯一の情報源とする（DRY原則）
 * - 責務を「delta計算・変換」のみに限定（SRP原則）
 */

(function() {
    'use strict';

    class ToolSizeManager {
        constructor(config, eventBus) {
            this.config = config;
            this.eventBus = eventBus;

            // サイズスロット（将来の1-9キー対応用）
            this.sizeSlots = {
                pen: [...(config.sizeSlots?.pen || [2, 4, 6, 8, 12, 16, 24, 36, 50])],
                eraser: [...(config.sizeSlots?.eraser || [10, 15, 20, 30, 40, 50, 60, 80, 100])]
            };

            // ドラッグ状態（一時的な状態のみ保持）
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
                
                // 軸ロック判定用の累積
                this.dragState.totalDeltaX += Math.abs(data.deltaX);
                this.dragState.totalDeltaY += Math.abs(data.deltaY);

                // 軸ロック（最初の5px移動で判定）
                if (!this.dragState.lockedAxis) {
                    if (this.dragState.totalDeltaX > 5) {
                        this.dragState.lockedAxis = 'size';
                    } else if (this.dragState.totalDeltaY > 5) {
                        this.dragState.lockedAxis = 'opacity';
                    }
                }

                // 新しい値を計算
                let newSize = this.dragState.startSize;
                let newOpacity = this.dragState.startOpacity;

                // サイズ計算（横方向）
                if (!this.dragState.lockedAxis || this.dragState.lockedAxis === 'size') {
                    let sizeSensitivity = sensitivity.size.sensitivity;
                    
                    // サイズに応じた感度調整
                    if (this.dragState.startSize < 10) {
                        sizeSensitivity *= 0.5;
                    } else if (this.dragState.startSize > 30) {
                        sizeSensitivity *= 2.0;
                    }

                    newSize = this._clamp(
                        this.dragState.startSize + data.deltaX * sizeSensitivity,
                        sensitivity.size.min,
                        sensitivity.size.max
                    );
                }

                // 不透明度計算（縦方向、上=増加）
                if (!this.dragState.lockedAxis || this.dragState.lockedAxis === 'opacity') {
                    newOpacity = this._clamp(
                        this.dragState.startOpacity - data.deltaY * sensitivity.opacity.sensitivity,
                        sensitivity.opacity.min,
                        sensitivity.opacity.max
                    );
                }

                // BrushSettingsに反映
                this._updateBrushSettings(newSize, newOpacity);

                // tool:size-opacity-changed イベント発行
                // （DragVisualFeedback と DrawingEngine が購読）
                this.eventBus.emit('tool:size-opacity-changed', {
                    tool: data.tool,
                    size: newSize,
                    opacity: newOpacity
                });
            });

            // tool:drag-size-end
            this.eventBus.on('tool:drag-size-end', () => {
                if (!this.dragState) return;

                // 完了通知（将来の拡張用）
                this.eventBus.emit('tool:size-drag-completed', {
                    tool: this.dragState.tool
                });

                this.dragState = null;
            });
        }

        /**
         * BrushSettings取得（複数パス対応・フォールバック強化）
         */
        _getBrushSettings() {
            // 試行する参照パス（優先順）
            const sources = [
                () => window.drawingApp?.drawingEngine?.settings,
                () => window.coreEngine?.drawingEngine?.settings,
                () => window.CoreRuntime?.internal?.drawingEngine?.settings,
                () => window.drawingEngine?.settings,
                () => window.CoreEngine?.drawingEngine?.settings
            ];
            
            for (const fn of sources) {
                try {
                    const settings = fn();
                    if (settings && typeof settings.getBrushSize === 'function') {
                        return settings;
                    }
                } catch (e) {
                    // 次の候補を試行
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

            if (typeof brushSettings.setBrushSize === 'function') {
                brushSettings.setBrushSize(size);
            }

            if (typeof brushSettings.setBrushOpacity === 'function') {
                brushSettings.setBrushOpacity(opacity);
            }
        }

        /**
         * 値のクランプ
         */
        _clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        /**
         * 将来の拡張用: サイズスロット選択
         */
        selectSizeSlot(slot) {
            const currentTool = this.getCurrentTool();
            if (!currentTool || slot < 1 || slot > 9) return;

            const slotIndex = slot - 1;
            const newSize = this.sizeSlots[currentTool][slotIndex];
            
            if (!newSize) return;

            const brushSettings = this._getBrushSettings();
            if (!brushSettings) return;

            const currentOpacity = brushSettings.getBrushOpacity?.() || 1.0;

            this._updateBrushSettings(newSize, currentOpacity);

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

            // フォールバック
            const de = window.drawingApp?.drawingEngine || 
                       window.coreEngine?.drawingEngine ||
                       window.drawingEngine;
            return de?.currentTool || 'pen';
        }

        /**
         * デバッグ情報
         */
        getDebugInfo() {
            const brushSettings = this._getBrushSettings();
            
            return {
                dragState: this.dragState,
                sizeSlots: this.sizeSlots,
                hasBrushSettings: !!brushSettings,
                brushSettingsDetails: brushSettings ? {
                    size: brushSettings.getBrushSize?.(),
                    opacity: brushSettings.getBrushOpacity?.(),
                    color: brushSettings.getBrushColor?.()
                } : null,
                eventBusAvailable: !!this.eventBus
            };
        }
    }

    window.ToolSizeManager = ToolSizeManager;
    console.log('✅ tool-size-manager.js v5.0 loaded (DRY/SOLID準拠版)');
})();