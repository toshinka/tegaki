// system/thumbnail-update-manager.js - サムネイル更新一元管理

(function() {
    'use strict';

    /**
     * サムネイル更新トリガー一元管理クラス
     * 
     * 【責務】
     * - すべてのサムネイル更新トリガーを集約
     * - 重複更新の防止（デバウンス）
     * - 更新対象の判定（背景/通常レイヤー）
     * 
     * 【更新トリガー】
     * 1. 描画: stroke-added, path-added
     * 2. 変形: transform-update, transform-confirmed
     * 3. リサイズ: camera:resized
     * 4. Vキー編集: layer:updated (Vキーモード時)
     * 5. 背景色変更: background-color-changed
     * 6. 可視性変更: visibility-changed
     * 7. 透明度変更: opacity-changed
     * 8. 反転: flip-horizontal, flip-vertical
     * 9. バケツ塗り: bucket-fill-applied（将来）
     */
    class ThumbnailUpdateManager {
        constructor(eventBus) {
            this.eventBus = eventBus;
            this.updateQueue = new Map(); // layerIndex → timestamp
            this.debounceTime = 100; // ms
            this.timers = new Map(); // layerIndex → timerId
            this.isEnabled = true;
        }

        /**
         * 初期化
         */
        init() {
            this._setupEventListeners();
        }

        /**
         * イベントリスナー設定
         */
        _setupEventListeners() {
            // 1. 描画系
            this.eventBus.on('layer:stroke-added', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'stroke-added');
            });

            this.eventBus.on('layer:path-added', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'path-added');
            });

            // 2. 変形系
            this.eventBus.on('layer:transform-updated', ({ layerId }) => {
                const layerIndex = this._getLayerIndexById(layerId);
                if (layerIndex >= 0) {
                    this.requestUpdate(layerIndex, 'transform-updated');
                }
            });

            this.eventBus.on('layer:transform-confirmed', ({ layerId }) => {
                const layerIndex = this._getLayerIndexById(layerId);
                if (layerIndex >= 0) {
                    this.requestUpdate(layerIndex, 'transform-confirmed', true); // 即座に更新
                }
            });

            // 3. Vキーモード編集
            this.eventBus.on('layer:updated', ({ layerId }) => {
                const layerIndex = this._getLayerIndexById(layerId);
                if (layerIndex >= 0) {
                    this.requestUpdate(layerIndex, 'vkey-edit');
                }
            });

            // 4. リサイズ
            this.eventBus.on('camera:resized', () => {
                this.requestUpdateAll('canvas-resized');
            });

            // 5. 背景色変更
            this.eventBus.on('layer:background-color-changed', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'background-color-changed', true);
            });

            // 6. 可視性変更
            this.eventBus.on('layer:visibility-changed', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'visibility-changed', true);
            });

            // 7. 透明度変更
            this.eventBus.on('layer:opacity-changed', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'opacity-changed');
            });

            // 8. 反転
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

            // 9. バケツ塗り（将来対応）
            this.eventBus.on('layer:bucket-fill-applied', ({ layerIndex }) => {
                this.requestUpdate(layerIndex, 'bucket-fill', true);
            });
        }

        /**
         * 単一レイヤーの更新リクエスト
         * @param {number} layerIndex - レイヤー番号
         * @param {string} reason - 更新理由
         * @param {boolean} immediate - 即座に更新（デバウンスなし）
         */
        requestUpdate(layerIndex, reason, immediate = false) {
            if (!this.isEnabled) return;
            if (layerIndex < 0) return;

            // 既存のタイマーをキャンセル
            if (this.timers.has(layerIndex)) {
                clearTimeout(this.timers.get(layerIndex));
                this.timers.delete(layerIndex);
            }

            if (immediate) {
                // 即座に更新
                this._executeUpdate(layerIndex, reason);
            } else {
                // デバウンス
                const timerId = setTimeout(() => {
                    this._executeUpdate(layerIndex, reason);
                    this.timers.delete(layerIndex);
                }, this.debounceTime);

                this.timers.set(layerIndex, timerId);
            }
        }

        /**
         * 全レイヤーの更新リクエスト
         * @param {string} reason - 更新理由
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
         * @param {number} layerIndex - レイヤー番号
         * @param {string} reason - 更新理由
         */
        _executeUpdate(layerIndex, reason) {
            const layers = this._getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return;

            const layer = layers[layerIndex];
            const layerId = layer?.layerData?.id;

            // thumbnail:layer-updated イベントを発行
            this.eventBus.emit('thumbnail:layer-updated', {
                component: 'thumbnail-update-manager',
                action: reason,
                data: {
                    layerIndex,
                    layerId
                }
            });

            // キューから削除
            this.updateQueue.delete(layerIndex);
        }

        /**
         * layerId から layerIndex を取得
         * @param {string} layerId
         * @returns {number}
         */
        _getLayerIndexById(layerId) {
            if (!layerId) return -1;
            
            const layers = this._getLayers();
            return layers.findIndex(l => l.layerData?.id === layerId);
        }

        /**
         * レイヤー配列を取得
         * @returns {Array}
         */
        _getLayers() {
            const layerManager = window.CoreRuntime?.internal?.layerManager || window.layerManager;
            return layerManager?.getLayers() || [];
        }

        /**
         * 更新を有効化/無効化
         * @param {boolean} enabled
         */
        setEnabled(enabled) {
            this.isEnabled = enabled;
            
            if (!enabled) {
                // すべてのタイマーをキャンセル
                for (const timerId of this.timers.values()) {
                    clearTimeout(timerId);
                }
                this.timers.clear();
                this.updateQueue.clear();
            }
        }

        /**
         * デバウンス時間を設定
         * @param {number} ms - ミリ秒
         */
        setDebounceTime(ms) {
            this.debounceTime = Math.max(0, ms);
        }

        /**
         * 統計情報取得（デバッグ用）
         * @returns {Object}
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

    // グローバル公開
    window.ThumbnailUpdateManager = ThumbnailUpdateManager;

})();