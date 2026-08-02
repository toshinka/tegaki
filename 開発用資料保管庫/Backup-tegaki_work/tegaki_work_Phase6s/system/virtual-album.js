/**
 * VirtualAlbum - IndexedDB仮想アルバムシステム
 * アニメーション(APNG/GIF)をブラウザ内に永続保存
 */
class VirtualAlbum {
    constructor() {
        this.dbName = 'ToshinkaTegakiAlbum';
        this.version = 1;
        this.storeName = 'animations';
        this.db = null;
        this.maxItems = 20;
    }

    async init() {
        if (this.db) return;
        
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.version);
            
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
            
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            
            req.onerror = () => reject(new Error('IndexedDB初期化失敗'));
        });
    }

    async saveAnimation(blob, metadata = {}) {
        await this.init();
        
        const data = {
            blob: blob,
            format: metadata.format || 'apng',
            width: metadata.width || 0,
            height: metadata.height || 0,
            frames: metadata.frames || 1,
            timestamp: Date.now(),
            thumbnail: metadata.thumbnail || null
        };
        
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        
        const all = await this._getAllKeys();
        if (all.length >= this.maxItems) {
            const deleteCount = all.length - this.maxItems + 1;
            for (let i = 0; i < deleteCount; i++) {
                store.delete(all[i]);
            }
        }
        
        return new Promise((resolve, reject) => {
            const req = store.add(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(new Error('保存失敗'));
        });
    }

    async getAllAnimations() {
        await this.init();
        
        const tx = this.db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const index = store.index('timestamp');
        
        return new Promise((resolve, reject) => {
            const req = index.openCursor(null, 'prev');
            const items = [];
            
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    items.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
            req.onerror = () => reject(new Error('取得失敗'));
        });
    }

    async getLatest() {
        const all = await this.getAllAnimations();
        return all.length > 0 ? all[0] : null;
    }

    async deleteAnimation(id) {
        await this.init();
        
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(new Error('削除失敗'));
        });
    }

    async copyToClipboard(id) {
        await this.init();
        
        const tx = this.db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        
        return new Promise(async (resolve, reject) => {
            const req = store.get(id);
            
            req.onsuccess = async () => {
                const item = req.result;
                if (!item) {
                    reject(new Error('データが見つかりません'));
                    return;
                }
                
                try {
                    const mimeType = item.format === 'apng' ? 'image/png' : 'image/gif';
                    
                    await navigator.clipboard.write([
                        new ClipboardItem({ [mimeType]: item.blob })
                    ]);
                    
                    resolve();
                } catch (err) {
                    reject(new Error('クリップボードコピー失敗: ' + err.message));
                }
            };
            
            req.onerror = () => reject(new Error('データ取得失敗'));
        });
    }

    async _getAllKeys() {
        const tx = this.db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(new Error('キー取得失敗'));
        });
    }
}

window.virtualAlbum = new VirtualAlbum();