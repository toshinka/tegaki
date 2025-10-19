/**
 * ToolSizeManager v1.0 - P/E+ドラッグ機能の中核処理
 * 
 * 📝 このファイルを system/tool-size-manager.js として保存してください
 * 
 * 責務:
 * - tool:drag-size-update イベントを受信
 * - deltaX/deltaY からサイズ・不透明度を計算
 * - tool:size-opacity-changed イベントを発火
 * - ツールごとの状態管理（pen/eraser）
 * 
 * イベントフロー:
 * KeyboardHandler → tool:drag-size-update
 *                 ↓
 *           ToolSizeManager (本クラス)
 *                 ↓
 *        tool:size-opacity-changed
 *                 ↓
 *    DrawingEngine & DragVisualFeedback
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
            
            // 現在のアクティブツール
            this.currentTool = null;
            
            // ツールごとの状態管理
            this.toolStates = {
                pen: {
                    size: this.config.pen?.size || 10,
                    opacity: this.config.pen?.opacity || 0.85,
                    startSize: 0,
                    startOpacity: 0
                },
                eraser: {
                    size: this.config.eraser?.size || 20,
                    opacity: this.config.eraser?.opacity || 1.0,
                    startSize: 0,
                    startOpacity: 0
                }
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
         * イベントリスナーのセットアップ
         */
        _setupEventListeners() {
            if (!this.eventBus) return;
            
            // ドラッグ開始: 開始値を保存
            this.eventBus.on('tool:drag-size-start', (data) => {
                this._handleDragStart(data);
            });
            
            // ドラッグ更新: サイズ・不透明度を計算して発火
            this.eventBus.on('tool:drag-size-update', (data) => {
                this._handleDragUpdate(data);
            });
            
            // ツール変更: currentTool を更新
            this.eventBus.on('toolChanged', (data) => {
                this._handleToolChanged(data);
            });
            
            // BrushSettings からの更新を反映
            this.eventBus.on('brushSizeChanged', (data) => {
                if (this.currentTool && data.size !== undefined) {
                    this.toolStates[this.currentTool].size = data.size;
                }
            });
            
            this.eventBus.on('brushOpacityChanged', (data) => {
                if (this.currentTool && data.opacity !== undefined) {
                    this.toolStates[this.currentTool].opacity = data.opacity;
                }
            });
        }

        /**
         * ドラッグ開始処理
         * @param {Object} data - {tool, startSize, startOpacity}
         */
        _handleDragStart(data) {
            const { tool, startSize, startOpacity } = data;
            
            if (!tool || !this.toolStates[tool]) {
                return;
            }
            
            this.currentTool = tool;
            
            // 開始値を保存
            this.toolStates[tool].startSize = startSize;
            this.toolStates[tool].startOpacity = startOpacity;
            
            // 現在値も更新
            this.toolStates[tool].size = startSize;
            this.toolStates[tool].opacity = startOpacity;
        }

        /**
         * ドラッグ更新処理（核心部分）
         * @param {Object} data - {tool, deltaX, deltaY}
         */
        _handleDragUpdate(data) {
            const { tool, deltaX, deltaY } = data;
            
            if (!tool || !this.toolStates[tool]) {
                return;
            }
            
            const state = this.toolStates[tool];
            
            // 新しいサイズを計算（横方向の移動量から）
            const newSize = this.calculateNewSize(state.startSize, deltaX);
            
            // 新しい不透明度を計算（縦方向の移動量から、上に動かすと増える）
            const newOpacity = this.calculateNewOpacity(state.startOpacity, deltaY);
            
            // 状態を更新
            state.size = newSize;
            state.opacity = newOpacity;
            
            // tool:size-opacity-changed イベントを発火
            this.eventBus.emit('tool:size-opacity-changed', {
                tool: tool,
                size: newSize,
                opacity: newOpacity
            });
        }

        /**
         * ツール変更処理
         * @param {Object} data - {tool}
         */
        _handleToolChanged(data) {
            const { tool } = data;
            
            if (tool && this.toolStates[tool]) {
                this.currentTool = tool;
            }
        }

        /**
         * サイズ計算（横方向の移動量から）
         * @param {number} startSize - 開始サイズ
         * @param {number} deltaX - 横方向の移動量（px）
         * @returns {number} 新しいサイズ
         */
        calculateNewSize(startSize, deltaX) {
            const rawSize = startSize + (deltaX * this.sizeSensitivity);
            return this.clamp(rawSize, this.sizeMin, this.sizeMax);
        }

        /**
         * 不透明度計算（縦方向の移動量から）
         * @param {number} startOpacity - 開始不透明度
         * @param {number} deltaY - 縦方向の移動量（px）
         * @returns {number} 新しい不透明度（0.0-1.0）
         */
        calculateNewOpacity(startOpacity, deltaY) {
            // 上に動かす（deltaY < 0）と不透明度が上がる
            const rawOpacity = startOpacity - (deltaY * this.opacitySensitivity);
            return this.clamp(rawOpacity, this.opacityMin, this.opacityMax);
        }

        /**
         * 値をクランプ（範囲内に収める）
         * @param {number} value - 値
         * @param {number} min - 最小値
         * @param {number} max - 最大値
         * @returns {number} クランプされた値
         */
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        /**
         * ツールの現在状態を取得
         * @param {string} tool - 'pen' | 'eraser'
         * @returns {Object|null} {size, opacity, startSize, startOpacity}
         */
        getToolState(tool) {
            if (!this.toolStates[tool]) {
                return null;
            }
            return { ...this.toolStates[tool] };
        }

        /**
         * ツールの状態を設定
         * @param {string} tool - 'pen' | 'eraser'
         * @param {number} size - サイズ
         * @param {number} opacity - 不透明度
         */
        setToolState(tool, size, opacity) {
            if (!this.toolStates[tool]) {
                return;
            }
            
            if (size !== undefined) {
                this.toolStates[tool].size = this.clamp(size, this.sizeMin, this.sizeMax);
            }
            
            if (opacity !== undefined) {
                this.toolStates[tool].opacity = this.clamp(opacity, this.opacityMin, this.opacityMax);
            }
        }

        /**
         * ツールをデフォルト値にリセット
         * @param {string} tool - 'pen' | 'eraser'
         */
        resetToDefault(tool) {
            if (!this.toolStates[tool]) {
                return;
            }
            
            const defaults = this.config.tools?.[tool] || this.config[tool];
            if (defaults) {
                this.toolStates[tool].size = defaults.defaultSize || defaults.size || 10;
                this.toolStates[tool].opacity = defaults.defaultOpacity || defaults.opacity || 1.0;
                this.toolStates[tool].startSize = 0;
                this.toolStates[tool].startOpacity = 0;
            }
        }

        /**
         * 全ツールをデフォルト値にリセット
         */
        resetAllToDefaults() {
            Object.keys(this.toolStates).forEach(tool => {
                this.resetToDefault(tool);
            });
        }

        /**
         * 現在のアクティブツールを取得
         * @returns {string|null} 'pen' | 'eraser' | null
         */
        getCurrentTool() {
            return this.currentTool;
        }

        /**
         * 感度設定を更新
         * @param {Object} settings - {sizeSensitivity, opacitySensitivity}
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
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                currentTool: this.currentTool,
                toolStates: JSON.parse(JSON.stringify(this.toolStates)),
                sensitivity: {
                    size: this.sizeSensitivity,
                    opacity: this.opacitySensitivity
                },
                limits: {
                    size: { min: this.sizeMin, max: this.sizeMax },
                    opacity: { min: this.opacityMin, max: this.opacityMax }
                },
                eventBus: !!this.eventBus,
                config: !!this.config
            };
        }

        /**
         * デバッグ情報をコンソールに出力
         */
        printDebugInfo() {
            console.log('=== ToolSizeManager Debug Info ===');
            console.log('Current Tool:', this.currentTool);
            console.log('Tool States:', this.toolStates);
            console.log('Sensitivity:', {
                size: this.sizeSensitivity,
                opacity: this.opacitySensitivity
            });
            console.log('Limits:', {
                size: { min: this.sizeMin, max: this.sizeMax },
                opacity: { min: this.opacityMin, max: this.opacityMax }
            });
            console.log('==================================');
        }
    }

    // グローバル登録
    window.ToolSizeManager = ToolSizeManager;

    console.log('✅ system/tool-size-manager.js loaded');
    console.log('   📐 ToolSizeManager: P/E+ドラッグ機能の中核処理を実装');
    console.log('   🔄 tool:drag-size-update → tool:size-opacity-changed 変換');
    console.log('   🎯 ツールごとの状態管理（pen/eraser）');

})();