/**
 * ===================================================================================
 * IndexedDB 操作モジュール (using Dexie.js)
 * Phase 4A11B-11
 * 目的: レイヤーデータをブラウザのIndexedDBに保存・復元する機能を提供します。
 * ===================================================================================
 */

// Dexieは ToshinkaTegakiTool.html でグローバルに読み込まれているため、直接使用します。
const db = new Dexie("TegakiProjectDB");

// データベースのバージョンとスキーマ（テーブル定義）を設定します。
// 
db.version(1).stores({
  // 'layers' という名前のテーブルを作成します。
  // '++id' は自動インクリメントのプライマリキーですが、今回はレイヤー固有のIDを外部から指定して使います。
  // 'name' はレイヤー名、 'imageData' はDataURL形式の画像データです。
  layers: "++id, name, imageData"
});

/**
 * 指定されたレイヤーの情報をIndexedDBに保存（または上書き）する関数
 * @param {string} layerId - 保存するレイヤーのユニークID
 * @param {string} layerName - 保存するレイヤーの名前
 * @param {string} imageDataUrl - 保存するレイヤーの画像データ (Data URL形式)
 */
export async function saveLayerToIndexedDB(layerId, layerName, imageDataUrl) {
  try {
    // 
    await db.layers.put({
      id: layerId,
      name: layerName,
      imageData: imageDataUrl
    });
    console.log(`✅ レイヤー「${layerName}」(ID: ${layerId})をIndexedDBに保存しました。`);
  } catch (error) {
    console.error(`❌ レイヤー(ID: ${layerId})のIndexedDBへの保存に失敗しました:`, error);
  }
}

/**
 * IndexedDBからすべてのレイヤー情報を復元する関数
 * @returns {Promise<Array>} 保存されているレイヤー情報の配列を返すPromise
 */
export async function loadLayersFromIndexedDB() {
  try {
    // 
    const layers = await db.layers.toArray();
    if (layers.length > 0) {
        console.log(`✅ IndexedDBから ${layers.length} 件のレイヤーを読み込みました。`);
    }
    return layers;
  } catch (error) {
    console.error("❌ IndexedDBからのレイヤー読み込みに失敗しました:", error);
    return []; // エラー時は空の配列を返す
  }
}