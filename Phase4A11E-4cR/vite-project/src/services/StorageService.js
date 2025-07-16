import Layer from '../features/layers/layer.js';

class StorageService {
    constructor(layerStore, drawingEngine, gl) {
        this.layerStore = layerStore;
        this.drawingEngine = drawingEngine;
        this.gl = gl;
        this.db = null;
        this.dbName = 'TegakiAppDB';
        this.storeName = 'layers';
        this._initDB();
    }

    // IndexedDBの初期化
    _initDB() {
        const request = indexedDB.open(this.dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            console.log("IndexedDB initialized successfully.");
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
        };
    }

    // レイヤーデータをIndexedDBに保存
    saveToIndexedDB() {
        if (!this.db) {
            console.error("IndexedDB is not initialized.");
            return;
        }

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        // 既存のデータをクリア
        store.clear();

        // 各レイヤーのデータを保存
        this.layerStore.getLayers().forEach(layer => {
            const layerData = {
                id: layer.id,
                imageData: layer.texture.export(), // テクスチャデータをエクスポート
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                width: layer.width,
                height: layer.height
            };
            store.put(layerData);
        });

        transaction.oncomplete = () => {
            console.log("All layers saved to IndexedDB.");
        };
        transaction.onerror = (event) => {
            console.error("Error saving layers to IndexedDB:", event.target.errorCode);
        };
    }
    
    // IndexedDBからレイヤーデータを読み込み
    async loadFromIndexedDB() {
        if (!this.db) {
            await new Promise(resolve => {
                const checkDB = setInterval(() => {
                    if (this.db) {
                        clearInterval(checkDB);
                        resolve();
                    }
                }, 100);
            });
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = async (event) => {
                const layersData = event.target.result;
                if (layersData && layersData.length > 0) {
                    this.layerStore.clearLayers();
                    for (const data of layersData) {
                        const newLayer = new Layer(this.gl, data.width, data.height, data.id, data.name);
                        newLayer.visible = data.visible;
                        newLayer.opacity = data.opacity;
                        // テクスチャデータをインポート
                        if (data.imageData) {
                             newLayer.texture.import(data.imageData);
                        }
                        this.layerStore.addLayer(newLayer, false); // 履歴には追加しない
                    }
                    this.layerStore.selectLayer(layersData[layersData.length-1].id);
                    this.drawingEngine.requestRedraw();
                    console.log("Layers loaded from IndexedDB.");
                    resolve(true); // データが見つかった
                } else {
                    console.log("No layers found in IndexedDB.");
                    resolve(false); // データが見つからなかった
                }
            };

            request.onerror = (event) => {
                console.error("Error loading layers from IndexedDB:", event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

}

export default StorageService;