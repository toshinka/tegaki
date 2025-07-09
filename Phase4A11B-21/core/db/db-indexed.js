// core/db/db-indexed.js

// Dexie.jsライブラリを使ってIndexedDBを操作します。
// 参考: https://dexie.org/
const db = new Dexie('ToshinkaTegakiDB');

// データベースのバージョンとテーブル構成を定義します。
// 'layers'テーブルを作成し、'id'をプライマリキー、'name'をインデックスとします。
db.version(1).stores({
    layers: '++id, name, imageData'
});

/**
 * 指定されたレイヤーのデータをIndexedDBに保存または更新します。
 * @param {number} id - レイヤーの一意なID
 * @param {string} name - レイヤー名
 * @param {string} imageDataUrl - toDataURL()で生成した画像データ
 * @returns {Promise<number>} 保存されたアイテムのID
 */
export async function saveLayerToIndexedDB(id, name, imageDataUrl) {
    try {
        // putは、同じIDがあれば更新、なければ新規追加する便利なメソッドです。
        return await db.layers.put({ id, name, imageData: imageDataUrl });
    } catch (error) {
        console.error(`レイヤーID ${id} のDB保存に失敗しました:`, error);
    }
}

/**
 * IndexedDBからすべてのレイヤーデータを読み込みます。
 * @returns {Promise<Array<object>>} レイヤーデータの配列
 */
export async function loadLayersFromIndexedDB() {
    try {
        // 'id'の昇順で全てのレイヤーデータを取得します。
        return await db.layers.orderBy('id').toArray();
    } catch (error) {
        console.error('DBからのレイヤー読み込みに失敗しました:', error);
        return [];
    }
}

/**
 * 指定されたIDのレイヤーをIndexedDBから削除します。
 * @param {number} id - 削除するレイヤーのID
 * @returns {Promise<void>}
 */
export async function deleteLayerFromIndexedDB(id) {
    try {
        return await db.layers.delete(id);
    } catch (error) {
        console.error(`レイヤーID ${id} のDB削除に失敗しました:`, error);
    }
}

/**
 * IndexedDBの全てのレイヤーデータを削除します。
 * @returns {Promise<void>}
 */
export async function clearAllLayersFromIndexedDB() {
    try {
        return await db.layers.clear();
    } catch (error) {
        console.error('DBの全レイヤーデータ削除に失敗しました:', error);
    }
}