/**
 * [クラス責務] LayerActions.js
 * 目的：レイヤーに対するユーザー操作（追加、削除、選択など）のロジックをカプセル化する。
 * このファイルは提供されていなかったため、指示書に基づき作成しました。
 */
export class LayerActions {
    /**
     * @param {object} layerStore - LayerStoreのインスタンス
     * @param {object} viewport - ViewportTransformのインスタンス
     * @param {object} historyStore - HistoryStoreのインスタンス
     * @param {object} storageService - PersistentStorageのインスタンス (指示書[2]対応で追加)
     */
    constructor(layerStore, viewport, historyStore, storageService) {
        this.layerStore = layerStore;
        this.viewport = viewport;
        this.historyStore = historyStore;
        // 🧹 START: レイヤー削除バグ修正 (指示書[2]対応)
        this.storageService = storageService; // IndexedDBへの保存サービス
        // 🧹 END: レイヤー削除バグ修正
    }

    /**
     * 新規レイヤーを追加する
     */
    addLayer() {
        this.layerStore.addLayer();
        this.historyStore.saveState();
        this.viewport.renderAllLayers(this.layerStore.getLayers());
        // 変更をDBに保存
        this.saveLayersToStorage();
    }

    /**
     * 指定されたIDのレイヤーを削除する
     * @param {string} layerId - 削除するレイヤーのID
     */
    deleteLayer(layerId) {
        this.layerStore.removeLayer(layerId);
        this.historyStore.saveState();
        this.viewport.renderAllLayers(this.layerStore.getLayers());
        // 🧹 START: レイヤー削除バグ修正 (指示書[2]対応)
        // 指示書[2]の修正点：削除後にDBへ保存する処理を呼び出す
        this.saveLayersToStorage();
        // 🧹 END: レイヤー削除バグ修正
    }
    
    /**
     * 指定されたIDのレイヤーを選択する
     * @param {string} layerId - 選択するレイヤーのID
     */
    selectLayer(layerId) {
        this.layerStore.selectLayer(layerId);
    }

    /**
     * アプリケーションの初期レイヤーをセットアップする
     * (AppControllerから呼ばれることを想定)
     */
    async setupInitialLayers() {
        if (this.layerStore.getLayers().length === 0) {
            this.layerStore.addLayer(); // 初期レイヤーを1つ追加
        }
        // 初期状態を保存
        await this.saveLayersToStorage();
    }

    // 🧹 START: レイヤー削除バグ修正 (指示書[2]対応)
    /**
     * 現在のレイヤー状態をIndexedDBに保存するヘルパーメソッド
     * @private
     */
    async saveLayersToStorage() {
        if (!this.storageService) {
            console.error("StorageServiceが注入されていません。");
            return;
        }
        try {
            const layers = this.layerStore.getLayers();
            await this.storageService.saveLayers(layers);
            console.log("💾 レイヤーの状態をDBに保存しました。");
        } catch (error) {
            console.error("レイヤー状態の保存に失敗しました:", error);
        }
    }
    // 🧹 END: レイヤー削除バグ修正
}