/**
 * データベース操作を管理するファイル (Dexie.jsを使用)
 * 
 */

// Dexie.jsはHTMLで読み込まれているため、ここでは new Dexie() で直接使えます。
const db = new Dexie("TegakiProjectDB");

// データベースのバージョンと構造を定義します。
// 'layers' というテーブルに、id, name, imageData の3つのデータを保存します。
// '++id' は、データを追加するたびに自動でユニークな番号を振る設定です。
db.version(1).stores({
  layers: "++id, name, imageData"
});

/**
 * 指定されたレイヤーの画像データをIndexedDBに保存または更新します。
 * @param {number} layerId - レイヤーの一意のID。
 * @param {string} name - レイヤー名。
 * @param {string} dataURL - レイヤーの画像データ (Data URL形式)。
 */
export async function saveLayerToIndexedDB(layerId, name, dataURL) {
  // IDが不正な場合はエラーを防ぐために処理を中断します。
  if (layerId === null || typeof layerId === 'undefined') {
    console.error("無効なレイヤーIDのため、IndexedDBへの保存をスキップしました:", layerId);
    return;
  }
  await db.layers.put({ id: layerId, name: name, imageData: dataURL });
}

/**
 * IndexedDBからすべてのレイヤーデータを読み込みます。
 * @returns {Promise<Array>} レイヤーデータの配列を返します。
 */
export async function loadLayersFromIndexedDB() {
  return await db.layers.toArray();
}

/**
 * 指定されたIDのレイヤーをIndexedDBから削除します。
 * @param {number} layerId - 削除するレイヤーのID。
 */
export async function deleteLayerFromIndexedDB(layerId) {
    if (layerId === null || typeof layerId === 'undefined') {
        console.error("無効なレイヤーIDのため、IndexedDBからの削除をスキップしました:", layerId);
        return;
    }
    await db.layers.delete(layerId);
}