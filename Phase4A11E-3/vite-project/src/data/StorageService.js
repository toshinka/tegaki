import Dexie from 'dexie';

/**
 * [クラス責務] StorageService.js
 * [cite_start]目的：IndexedDBとのデータの保存・取得処理を専門に担当する。 [cite: 16]
 */
export class StorageService {
    constructor() {
        this.db = new Dexie('TegakiToolDatabase');
        this.db.version(1).stores({
            layers: 'id, name, imageData'
        });
        console.log("✅ StorageService: IndexedDB connection is set up.");
    }

    async saveLayer(layer) {
        if (!layer) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layer.imageData.width;
        tempCanvas.height = layer.imageData.height;
        tempCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
        const dataURL = tempCanvas.toDataURL();
        
        try {
            await this.db.layers.put({ id: layer.id, name: layer.name, imageData: dataURL });
        } catch (error) {
            console.error(`[DB] レイヤー(ID: ${layer.id})の保存に失敗しました:`, error);
        }
    }

    async loadLayers(canvasWidth, canvasHeight, LayerClass) {
        try {
            const storedLayers = await this.db.layers.toArray();
            if (!storedLayers || storedLayers.length === 0) return null;

            const loadPromises = storedLayers.map(layerData => {
                return new Promise((resolve, reject) => {
                    const layer = new LayerClass(layerData.name, canvasWidth, canvasHeight, layerData.id);
                    if (!layerData.imageData) {
                        resolve(layer);
                        return;
                    }
                    const img = new Image();
                    img.onload = () => {
                        const tempCtx = document.createElement('canvas').getContext('2d');
                        tempCtx.canvas.width = layer.imageData.width;
                        tempCtx.canvas.height = layer.imageData.height;
                        tempCtx.drawImage(img, 0, 0);
                        layer.imageData = tempCtx.getImageData(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
                        layer.gpuDirty = true;
                        resolve(layer);
                    };
                    img.onerror = reject;
                    img.src = layerData.imageData;
                });
            });

            return await Promise.all(loadPromises);

        } catch (error) {
            console.error('[DB] レイヤーの読み込みに失敗しました:', error);
            return null;
        }
    }
}