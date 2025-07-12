// src/db/db-indexed.js
import Dexie from 'dexie';

// --- IndexedDB データベースの定義 ---
const db = new Dexie('TegakiToolDatabase');
db.version(1).stores({
    layers: 'id, name, imageData' // 'id'をプライマリキーとして設定
});

/**
 * レイヤーデータをIndexedDBに保存（または更新）します。
 * @param {number} id - レイヤーの一意なID
 * @param {string} name - レイヤー名
 * @param {string} imageData - Base64エンコードされた画像データ
 * @returns {Promise<void>}
 */
export async function saveLayerToIndexedDB(id, name, imageData) {
    try {
        await db.layers.put({ id, name, imageData });
        // console.log(`[DB] レイヤー「${name}」(ID: ${id}) を保存しました。`);
    } catch (error) {
        console.error(`[DB] レイヤー(ID: ${id})の保存に失敗しました:`, error);
    }
}

/**
 * IndexedDBからすべてのレイヤーデータを読み込みます。
 * @returns {Promise<Array<{id: number, name: string, imageData: string}> | null>}
 */
export async function loadLayersFromIndexedDB() {
    try {
        const layers = await db.layers.toArray();
        if (layers.length > 0) {
            // console.log(`[DB] ${layers.length}件のレイヤーを読み込みました。`);
            return layers;
        }
        return null;
    } catch (error) {
        console.error('[DB] レイヤーの読み込みに失敗しました:', error);
        return null;
    }
}