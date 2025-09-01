// EventBus 統一ライフサイクルメソッド追加修正
// 既存のEventBusクラスに統一ライフサイクルメソッドを追加

(function() {
    'use strict';
    
    // 既存EventBusクラスの取得・拡張
    const OriginalEventBus = window.Tegaki?.EventBus;
    if (!OriginalEventBus) {
        console.error('🔄 EventBus class not found for lifecycle extension');
        return;
    }
    
    // 統一ライフサイクルメソッド追加
    const eventBusPrototype = OriginalEventBus.prototype;
    
    // configure（設定注入）- 既存の場合はスキップ
    if (!eventBusPrototype.configure) {
        eventBusPrototype.configure = function(config) {
            this._config = { ...config };
            this._configured = true;
        };
    }
    
    // attach（参照注入）- 既存の場合はスキップ
    if (!eventBusPrototype.attach) {
        eventBusPrototype.attach = function(context) {
            this._context = context;
            this._attached = true;
        };
    }
    
    // init（内部初期化）- 既存の場合はスキップ
    if (!eventBusPrototype.init) {
        eventBusPrototype.init = function() {
            this._initialized = true;
            return Promise.resolve();
        };
    }
    
    // isReady（準備完了確認）- 既存の場合はスキップ
    if (!eventBusPrototype.isReady) {
        eventBusPrototype.isReady = function() {
            return this._initialized || true; // EventBus は常に準備完了
        };
    }
    
    // dispose（解放）- 既存の場合はスキップ
    if (!eventBusPrototype.dispose) {
        eventBusPrototype.dispose = function() {
            this._events = {};
            this._initialized = false;
            this._attached = false;
            this._configured = false;
        };
    }
    
    console.log('🔄 EventBus統一ライフサイクルメソッド追加完了');
    
})();