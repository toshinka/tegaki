/**
 * tool-size-manager.js v3.2
 * P/E+ドラッグ機能 - EventBus統合完全版（強制統合）
 * 
 * 🔧 修正内容 v3.2:
 * - EventBus統合をより確実に（即座購読 + フォールバック）
 * - window.TegakiEventBus直接参照を追加
 * - リスナー登録の確実性を最大化
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

            // EventBus購読フラグ
            this._isEventBusSubscribed = false;
            
            // 🔧 修正: 即座購読 + 遅延フォールバック
            this._immediateSubscription();
            this._setupEventBusSubscription();
        }
        
        /**
         * 🆕 即座にEventBus購読を試みる（利用可能な場合）
         */
        _immediateSubscription() {
            const eventBus = this.eventBus || window.TegakiEventBus;
            
            if (eventBus && typeof eventBus.on === 'function' && !this._isEventBusSubscribed) {
                this.eventBus = eventBus;
                this._setupEventListeners();
                this._isEventBusSubscribed = true;
            }
        }

        /**
         * 🆕 EventBus購読の遅延セットアップ（フォールバック）
         */
        _setupEventBusSubscription() {
            if (this._isEventBusSubscribed) return;

            const checkAndSubscribe = () => {
                if (this._isEventBusSubscribed) return;

                // グローバルEventBusを優先的に確認
                const eventBus = window.TegakiEventBus || this.eventBus;
                
                if (eventBus && typeof eventBus.on === 'function') {
                    this.eventBus = eventBus;
                    this._setupEventListeners();
                    this._isEventBusSubscribed = true;
                    return;
                }

                // 再試行
                setTimeout(checkAndSubscribe, 50);
            };

            setTimeout(checkAndSubscribe, 50);
        }

        _setupEventListeners() {
            if (!this.eventBus || this._isEventBusSubscribed) return;

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
                    // 不透明度計算（上にドラッグ=増加、下にドラッグ=減少）
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

                // BrushSettingsに確実に反映
                this._updateBrushSettings(newSize, newOpacity);

                // EventBus発行
                const eventBus = this.eventBus || window.TegakiEventBus;
                if (eventBus) {
                    eventBus.emit('tool:size-opacity-changed', {
                        tool: data.tool,
                        size: newSize,
                        opacity: newOpacity
                    });
                }
            });

            // tool:drag-size-end
            this.eventBus.on('tool:drag-size-end', () => {
                if (!this.dragState) return;

                const { tool, currentSize, currentOpacity } = this.dragState;

                const eventBus = this.eventBus || window.TegakiEventBus;
                if (eventBus) {
                    eventBus.emit('tool:size-drag-completed', {
                        tool,
                        finalSize: currentSize,
                        finalOpacity: currentOpacity
                    });
                }

                this.dragState = null;
            });

            this._isEventBusSubscribed = true;
        }

        /**
         * BrushSettings取得（DrawingEngine.settings優先）
         */
        _getBrushSettings() {
            if (this.brushSettings) {
                return this.brushSettings;
            }

            // 1. DrawingEngine.settings (最優先)
            const drawingEngines = [
                window.coreEngine?.drawingEngine,
                window.drawingApp?.drawingEngine,
                window.CoreEngine?.drawingEngine,
                window.drawingEngine
            ];

            for (const de of drawingEngines) {
                if (de?.settings) {
                    this.brushSettings = de.settings;
                    return de.settings;
                }
            }

            // 2. CoreRuntime.api経由
            if (window.CoreRuntime?.api?.getDrawingEngine) {
                const de = window.CoreRuntime.api.getDrawingEngine();
                if (de?.settings) {
                    this.brushSettings = de.settings;
                    return de.settings;
                }
            }

            return null;
        }

        /**
         * BrushSettingsへの値反映（確実化）
         */
        _updateBrushSettings(size, opacity) {
            const brushSettings = this._getBrushSettings();
            
            if (!brushSettings) {
                return;
            }

            try {
                // サイズ設定
                if (typeof brushSettings.setBrushSize === 'function') {
                    brushSettings.setBrushSize(size);
                } else if (brushSettings.size !== undefined) {
                    brushSettings.size = size;
                }

                // 不透明度設定
                if (typeof brushSettings.setBrushOpacity === 'function') {
                    brushSettings.setBrushOpacity(opacity);
                } else if (brushSettings.opacity !== undefined) {
                    brushSettings.opacity = opacity;
                }

                // EventBus発行（他のコンポーネント連携）
                const eventBus = this.eventBus || window.TegakiEventBus;
                if (eventBus) {
                    eventBus.emit('brushSizeChanged', { size });
                    eventBus.emit('brushOpacityChanged', { opacity });
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

            const eventBus = this.eventBus || window.TegakiEventBus;
            if (eventBus) {
                eventBus.emit('tool:size-slot-selected', {
                    tool: currentTool,
                    slot,
                    size: newSize
                });
            }
        }

        /**
         * 現在のツール取得
         */
        getCurrentTool() {
            if (window.CoreRuntime?.api?.getCurrentTool) {
                return window.CoreRuntime.api.getCurrentTool();
            }

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
                brushSettings: !!this._getBrushSettings(),
                brushSettingsDetails: this._getBrushSettings()?.getCurrentSettings?.(),
                eventBusSubscribed: this._isEventBusSubscribed,
                eventBusReference: !!(this.eventBus || window.TegakiEventBus)
            };
        }
    }

    window.ToolSizeManager = ToolSizeManager;
})();

console.log('✅ tool-size-manager.js v3.2 loaded (強制EventBus統合版)');