/**
 * ToolSizeManager v2.0 - BrushSettings統合版
 * 
 * 改修内容:
 * - _getBrushSettings()を複数パス対応に変更（SOLID/OCP準拠）
 * - ツール状態の二重管理を削除（DRY原則準拠）
 * - BrushSettingsを唯一の情報源とする（SRP準拠）
 * - dragStateのみで一時状態を管理
 * 
 * 責務:
 * - tool:drag-size-update イベントを受信
 * - deltaX/deltaY からサイズ・不透明度を計算
 * - tool:size-opacity-changed イベントを発火
 * - BrushSettingsへの橋渡し
 */

(function() {
    'use strict';

    class ToolSizeManager {
        constructor(config, eventBus) {
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus || window.TegakiEventBus;
            
            if (!this.config) {
                console.error('❌ ToolSizeManager: TEGAKI_CONFIG not available');
                return;
            }
            
            if (!this.eventBus) {
                console.error('❌ ToolSizeManager: EventBus not available');
                return;
            }
            
            // ドラッグ一時状態のみを保持（BrushSettingsの値は保持しない）
            this.dragState = {
                tool: null,
                startSize: 0,
                startOpacity: 0,
                isDragging: false
            };
            
            // ドラッグ調整設定の取得
            this.sizeSensitivity = this.config.dragAdjustment?.size?.sensitivity || 0.1;
            this.opacitySensitivity = this.config.dragAdjustment?.opacity?.sensitivity || 0.005;
            this.sizeMin = this.config.dragAdjustment?.size?.min || 0.1;
            this.sizeMax = this.config.dragAdjustment?.size?.max || 100;
            this.opacityMin = this.config.dragAdjustment?.opacity?.min || 0.0;
            this.opacityMax = this.config.dragAdjustment?.opacity?.max || 1.0;
            
            // イベント購読
            this._setupEventListeners();
        }

        /**
         * 🔧 改修: 複数パス対応のBrushSettings取得
         * SOLID原則: OCP（Open/Closed Principle）準拠
         * 新しい参照パス追加が容易
         */
        _getBrushSettings() {
            const sources = [
                () => window.drawingApp?.drawingEngine?.settings,
                () => window.coreEngine?.drawingEngine?.settings,
                () => window.CoreRuntime?.internal?.drawingEngine?.settings,
                () => window.drawingEngine?.settings,
                () => window.TegakiDrawing?.DrawingEngine?.prototype?.settings
            ];
            
            for (const fn of sources) {
                try {
                    const settings = fn();
                    if (settings) {
                        return settings;
                    }
                } catch (e) {
                    // 次のパスを試行
                }
            }
            
            return null;
        }

        /**
         * イベントリスナーのセットアップ
         */
        _setupEventListeners() {
            if (!this.eventBus) return;
            
            // ドラッグ開始: BrushSettingsから開始値を取得
            this.eventBus.on('tool:drag-size-start', (data) => {
                this._handleDragStart(data);
            });
            
            // ドラッグ更新: サイズ・不透明度を計算して発火
            this.eventBus.on('tool:drag-size-update', (data) => {
                this._handleDragUpdate(data);
            });
            
            // ドラッグ終了: dragState をリセット
            this.eventBus.on('tool:drag-size-end', () => {
                this._handleDragEnd();
            });
            
            // ツール変更: 不要（BrushSettingsが管理）
        }

        /**
         * ドラッグ開始処理
         * 🔧 改修: BrushSettingsから開始値を取得
         */
        _handleDragStart(data) {
            const { tool, startSize, startOpacity } = data;
            
            if (!tool) {
                return;
            }
            
            this.dragState = {
                tool: tool,
                startSize: startSize,
                startOpacity: startOpacity,
                isDragging: true
            };
        }

        /**
         * ドラッグ更新処理
         * 🔧 改修: BrushSettingsへ直接反映（状態を保持しない）
         */
        _handleDragUpdate(data) {
            const { tool, deltaX, deltaY } = data;
            
            if (!this.dragState.isDragging || tool !== this.dragState.tool) {
                return;
            }
            
            // 新しいサイズ・不透明度を計算
            const newSize = this.calculateNewSize(this.dragState.startSize, deltaX);
            const newOpacity = this.calculateNewOpacity(this.dragState.startOpacity, deltaY);
            
            // 🔧 改修: tool:size-opacity-changedを発行（DrawingEngine/DragVisualFeedback向け）
            this.eventBus.emit('tool:size-opacity-changed', {
                tool: tool,
                size: newSize,
                opacity: newOpacity
            });
        }

        /**
         * ドラッグ終了処理
         */
        _handleDragEnd() {
            this.dragState = {
                tool: null,
                startSize: 0,
                startOpacity: 0,
                isDragging: false
            };
        }

        /**
         * サイズ計算（横方向の移動量から）
         */
        calculateNewSize(startSize, deltaX) {
            const rawSize = startSize + (deltaX * this.sizeSensitivity);
            return this.clamp(rawSize, this.sizeMin, this.sizeMax);
        }

        /**
         * 不透明度計算（縦方向の移動量から）
         */
        calculateNewOpacity(startOpacity, deltaY) {
            // 上に動かす（deltaY < 0）と不透明度が上がる
            const rawOpacity = startOpacity - (deltaY * this.opacitySensitivity);
            return this.clamp(rawOpacity, this.opacityMin, this.opacityMax);
        }

        /**
         * 値をクランプ（範囲内に収める）
         */
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        /**
         * 🔧 改修: BrushSettingsから現在値を取得（ツール指定なし）
         */
        getCurrentSize() {
            const settings = this._getBrushSettings();
            return settings ? settings.getBrushSize() : this.sizeMin;
        }

        getCurrentOpacity() {
            const settings = this._getBrushSettings();
            return settings ? settings.getBrushOpacity() : 1.0;
        }

        /**
         * 感度設定を更新
         */
        updateSensitivity(settings) {
            if (settings.sizeSensitivity !== undefined) {
                this.sizeSensitivity = Math.max(0.01, Math.min(1.0, settings.sizeSensitivity));
            }
            if (settings.opacitySensitivity !== undefined) {
                this.opacitySensitivity = Math.max(0.001, Math.min(0.1, settings.opacitySensitivity));
            }
        }

        /**
         * デバッグ情報を取得
         */
        getDebugInfo() {
            const settings = this._getBrushSettings();
            
            return {
                dragState: { ...this.dragState },
                sensitivity: {
                    size: this.sizeSensitivity,
                    opacity: this.opacitySensitivity
                },
                limits: {
                    size: { min: this.sizeMin, max: this.sizeMax },
                    opacity: { min: this.opacityMin, max: this.opacityMax }
                },
                brushSettings: {
                    available: !!settings,
                    currentSize: settings ? settings.getBrushSize() : null,
                    currentOpacity: settings ? settings.getBrushOpacity() : null
                },
                eventBus: !!this.eventBus,
                config: !!this.config
            };
        }
    }

    // グローバル登録
    window.ToolSizeManager = ToolSizeManager;

    console.log('✅ system/tool-size-manager.js v2.0 loaded');
    console.log('   🔧 BrushSettings統合版 - DRY/SOLID原則準拠');
    console.log('   ✨ _getBrushSettings()を複数パス対応に改修');
    console.log('   ✨ ツール状態の二重管理を削除');
    console.log('   ✨ BrushSettingsを唯一の情報源とする');

})();