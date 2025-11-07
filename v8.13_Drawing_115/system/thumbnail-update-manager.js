// system/thumbnail-update-manager.js - サムネイル更新一元管理改修版

(function() {
    'use strict';

    /**
     * サムネイル更新トリガー一元管理クラス
     * 
     * 【責務】
     * - すべてのサムネイル更新トリガーを集約
     * - 重複更新の防止（デバウンス）
     * - 更新対象の判定（背景/通常レイヤー）
     * - アクティブレイヤーの即座更新
     * 
     * 【改修内容】
     * - アクティブレイヤーは即座に更新（デバウンスなし）
     * - 非アクティブレイヤーはデバウンス適用
     * - デバウンス時間を50msに短縮
     */
    class ThumbnailUpdateManager {
        constructor(eventBus) {
            this.eventBus = eventBus;
            this.updateQueue = new Map();
            this.debounceTime = 50; // 100ms → 50msに短縮
            this.timers = new Map();
            this.isEnabled = true;
        }

        init() {
            this._setupEventListeners();
        }

        _setupEventListeners() {
            // 描画系
            this.eventBus.on('layer:stroke-added', ({ layerIndex }) => {
                this._requestUpdateWithActiveCheck(layerIndex, 'stroke-added');
            });

            this.eventBus.on('layer:path-added', ({ layerIndex }) => {
                this._requestUpdateWithActiveCheck(layerIndex, 'path-added');
            });

            // 変形系
            this.eventBus.on('layer:transform-updated', ({ layerId }) => {
                const layerIndex = this._getLayerIndexById(layerId);
                if (layerIndex >= 0) {
                    this._requestUpdateWithActiveCheck(layerIndex, 'transform-updated');
                }
            });

            this.eventBus.on('layer:transform-confirmed', ({ layerId }) => {
                const layerIndex = this._getLayerIndexById(layerId);
                if (layerIndex >= 0) {
                    this.requestUpdate(layerIndex, 'transform-confirmed', true);
                }
            });

            // Vキーモード編集
            this.eventBus.on('layer:updated', ({ layerId }) => {
                const layerIndex = this._getLayerIndexById(layerId);
                if (layerIndex >= 0) {
                    this._requestUpdateWithActiveCheck(layerIndex, 'vkey-edit');
                }
            });

            // リサイズ
            this.eventBus.on('camera:resized', () => {
                this.requestUpdateAll('canvas-resized');
            });

            // 背景色変更
            this.eventBus.on('layer:background-color-changed', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'background-color-changed', true);
            });

            // 可視性変更
            this.eventBus.on('layer:visibility-changed', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'visibility-changed', true);
            });

            // 透明度変更
            this.eventBus.on('layer:opacity-changed', ({ layerIndex }) => {
                this._requestUpdateWithActiveCheck(layerIndex, 'opacity-changed');
            });

            // 反転
            this.eventBus.on('layer:flip-horizontal', ({ layerId }) => {
                const layerIndex = this._getLayerIndexById(layerId);
                if (layerIndex >= 0) {
                    this.requestUpdate(layerIndex, 'flip-horizontal', true);
                }
            });

            this.eventBus.on('layer:flip-vertical', ({ layerId }) => {
                const layerIndex = this._getLayerIndexById(layerId);
                if (layerIndex >= 0) {
                    this.requestUpdate(layerIndex, 'flip-vertical', true);
                }
            });

            // バケツ塗り
            this.eventBus.on('layer:bucket-fill-applied', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'bucket-fill', true);
            });

            // レイヤー削除
            this.eventBus.on('layer:deleted', ({ layerIndex }) => {
                this._cancelUpdate(layerIndex);
            });

            // レイヤークリア
            this.eventBus.on('layer:cleared', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'layer-cleared', true);
            });

            // レイヤー復元
            this.eventBus.on('layer:restored', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'layer-restored', true);
            });
        }

        /**
         * アクティブレイヤーチェック付き更新リクエスト
         * アクティブレイヤーは即座に更新、非アクティブはデバウンス
         */
        _requestUpdateWithActiveCheck(layerIndex, reason) {
            if (!this.isEnabled || layerIndex < 0) return;

            const isActive = this._isActiveLayer(layerIndex);
            this.requestUpdate(layerIndex, reason, isActive);
        }

        /**
         * 単一レイヤーの更新リクエスト
         */
        requestUpdate(layerIndex, reason, immediate = false) {
            if (!this.isEnabled) return;
            if (layerIndex < 0) return;

            if (this.timers.has(layerIndex)) {
                clearTimeout(this.timers.get(layerIndex));
                this.timers.delete(layerIndex);
            }

            if (immediate) {
                this._executeUpdate(layerIndex, reason);
            } else {
                const timerId = setTimeout(() => {
                    this._executeUpdate(layerIndex, reason);
                    this.timers.delete(layerIndex);
                }, this.debounceTime);

                this.timers.set(layerIndex, timerId);
            }
        }

        /**
         * 全レイヤーの更新リクエスト
         */
        requestUpdateAll(reason) {
            if (!this.isEnabled) return;

            const layers = this._getLayers();
            for (let i = 0; i < layers.length; i++) {
                this.requestUpdate(i, reason, false);
            }
        }

        /**
         * 更新実行
         */
        _executeUpdate(layerIndex, reason) {
            const layers = this._getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return;

            const layer = layers[layerIndex];
            const layerId = layer?.layerData?.id;

            this.eventBus.emit('thumbnail:layer-updated', {
                component: 'thumbnail-update-manager',
                action: reason,
                data: {
                    layerIndex,
                    layerId
                }
            });

            this.updateQueue.delete(layerIndex);
        }

        /**
         * 更新キャンセル
         */
        _cancelUpdate(layerIndex) {
            if (this.timers.has(layerIndex)) {
                clearTimeout(this.timers.get(layerIndex));
                this.timers.delete(layerIndex);
            }
            this.updateQueue.delete(layerIndex);
        }

        /**
         * アクティブレイヤーか判定
         */
        _isActiveLayer(layerIndex) {
            const layerManager = this._getLayerManager();
            if (!layerManager) return false;

            const activeIndex = layerManager.getActiveLayerIndex?.() ?? -1;
            return activeIndex === layerIndex;
        }

        /**
         * layerId から layerIndex を取得
         */
        _getLayerIndexById(layerId) {
            if (!layerId) return -1;
            
            const layers = this._getLayers();
            return layers.findIndex(l => l.layerData?.id === layerId);
        }

        /**
         * レイヤー配列を取得
         */
        _getLayers() {
            const layerManager = this._getLayerManager();
            return layerManager?.getLayers() || [];
        }

        /**
         * LayerManager取得
         */
        _getLayerManager() {
            return window.CoreRuntime?.internal?.layerManager || window.layerManager;
        }

        /**
         * 更新を有効化/無効化
         */
        setEnabled(enabled) {
            this.isEnabled = enabled;
            
            if (!enabled) {
                for (const timerId of this.timers.values()) {
                    clearTimeout(timerId);
                }
                this.timers.clear();
                this.updateQueue.clear();
            }
        }

        /**
         * デバウンス時間を設定
         */
        setDebounceTime(ms) {
            this.debounceTime = Math.max(0, ms);
        }

        /**
         * 統計情報取得
         */
        getDebugInfo() {
            return {
                queueSize: this.updateQueue.size,
                activeTimers: this.timers.size,
                debounceTime: this.debounceTime,
                isEnabled: this.isEnabled
            };
        }

        /**
         * クリーンアップ
         */
        destroy() {
            for (const timerId of this.timers.values()) {
                clearTimeout(timerId);
            }
            this.timers.clear();
            this.updateQueue.clear();
        }
    }

    window.ThumbnailUpdateManager = ThumbnailUpdateManager;

})();