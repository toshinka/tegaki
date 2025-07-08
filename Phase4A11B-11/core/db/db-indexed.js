// core/db/db-indexed.js

// Dexie.jsを使用してIndexedDBを簡単に扱います
const db = new Dexie("TegakiProjectDB");

// データベースのバージョンとテーブル構成を定義します
db.version(1).stores({
  // 'layers' テーブル: 'id'を主キーとし、'timestamp'でインデックスを作成
  layers: "id, name, imageData, timestamp"
});

/**
 * レイヤーの描画データをIndexedDBに保存または更新します
 * @param {number} layerId - レイヤーの一意なID
 * @param {string} name - レイヤー名
 * @param {string} dataURL - レイヤーの画像データ (toDataURL()で生成)
 */
export async function saveLayerToIndexedDB(layerId, name, dataURL) {
  try {
    // putは、同じIDがあれば更新、なければ新規作成する便利なメソッドです
    await db.layers.put({ 
      id: layerId, 
      name, 
      imageData: dataURL,
      timestamp: Date.now() // 保存日時を記録
    });
    console.log(`✅ Layer ${layerId} saved to IndexedDB`);
  } catch (error) {
    console.error("❌ Failed to save layer:", error);
  }
}

/**
 * IndexedDBから全てのレイヤーデータを読み込みます
 * @returns {Promise<Array>} レイヤーデータの配列
 */
export async function loadLayersFromIndexedDB() {
  try {
    // timestampでソートして、レイヤーの順序を保ったまま読み込みます
    const layers = await db.layers.orderBy('timestamp').toArray();
    console.log(`📥 Loaded ${layers.length} layers from IndexedDB`);
    return layers;
  } catch (error) {
    console.error("❌ Failed to load layers:", error);
    return []; // エラー時は空の配列を返す
  }
}

/**
 * 指定したIDのレイヤーをIndexedDBから削除します
 * @param {number} layerId - 削除するレイヤーのID
 */
export async function deleteLayerFromIndexedDB(layerId) {
  try {
    await db.layers.delete(layerId);
    console.log(`🗑️ Layer ${layerId} deleted from IndexedDB`);
  } catch (error) {
    console.error("❌ Failed to delete layer:", error);
  }
}

/**
 * 全てのレイヤーデータをIndexedDBから削除します
 */
export async function clearAllLayersFromIndexedDB() {
  try {
    await db.layers.clear();
    console.log("🧹 All layers cleared from IndexedDB");
  } catch (error) {
    console.error("❌ Failed to clear layers:", error);
  }
}