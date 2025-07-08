// DexieはHTMLでグローバルに読み込まれているため、importは不要です。

// データベースの定義
export const db = new Dexie('ToshinkaTegakiDB');
db.version(1).stores({
    // layersテーブルのスキーマ定義
    // "&id"はidがユニークなプライマリキーであることを示します
    layers: '&id, name, imageData'
});

/**
 * 指定されたレイヤーデータをIndexedDBに保存または更新します。
 * @param {number} id - レイヤーの一意のID
 * @param {string} name - レイヤー名
 * @param {string} imageData - レイヤーの描画内容を表すData URL
 */
export async function saveLayerToIndexedDB(id, name, imageData) {
    if (id === undefined || name === undefined || imageData === undefined) {
        console.error("保存データが不完全なため、IndexedDBへの保存をスキップしました。", {id, name});
        return;
    }
    try {
        await db.layers.put({ id, name, imageData });
    } catch (error) {
        console.error(`IndexedDBへのレイヤー保存に失敗しました (ID: ${id}):`, error);
    }
}

/**
 * IndexedDBからすべてのレイヤーデータを読み込みます。
 * @returns {Promise<Array<{id: number, name: string, imageData: string}>>} レイヤーデータの配列
 */
export async function loadLayersFromIndexedDB() {
    try {
        const layers = await db.layers.toArray();
        return layers.sort((a, b) => a.id - b.id);
    } catch (error) {
        console.error("IndexedDBからのレイヤー読み込みに失敗しました:", error);
        return [];
    }
}

/**
 * 指定されたIDのレイヤーをIndexedDBから削除します。
 * @param {number} id - 削除するレイヤーのID
 */
// ✅ この関数の前に export を追加しました！
export async function deleteLayerFromIndexedDB(id) {
    try {
        await db.layers.delete(id);
        console.log(`🗑️ レイヤー [ID: ${id}] をIndexedDBから削除しました。`);
    } catch (error) {
        console.error(`IndexedDBからのレイヤー削除に失敗しました (ID: ${id}):`, error);
    }
}