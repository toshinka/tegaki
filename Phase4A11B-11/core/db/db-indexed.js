/*
 * ===================================================================================
 * Toshinka Tegaki Tool - IndexedDB Handler (using Dexie.js)
 * Version: 1.0.0 (Phase 4A11B-11)
 *
 * - 機能:
 * - ブラウザのIndexedDBにレイヤーデータを保存・復元するための機能を提供します。
 * - 軽量ライブラリ Dexie.js を使って、データベース操作を簡単に行います。
 * ===================================================================================
 */

// Dexie.jsのインスタンスを作成し、データベースを定義します。
// "TegakiProjectDB" という名前のデータベースを使います。
const db = new Dexie("TegakiProjectDB");

// データベースのバージョンと、中に保存するデータの構造（ストア）を定義します。
// 'layers' という名前のストアを作成し、'id'を主キー（ユニークな目印）にします。
db.version(1).stores({
  layers: "id, name, imageData"
});

/**
 * 指定されたレイヤーのデータをIndexedDBに保存または更新します。
 * @param {number} layerId - レイヤーのID（配列のインデックスなど）。
 * @param {string} layerName - レイヤー名。
 * @param {string} imageDataUrl - レイヤーの画像データ（DataURL形式）。
 */
export async function saveLayerToIndexedDB(layerId, layerName, imageDataUrl) {
  try {
    // db.layers.put() は、同じIDのデータがあれば更新、なければ新規追加してくれます。
    await db.layers.put({ id: layerId, name: layerName, imageData: imageDataUrl });
  } catch (err) {
    console.error(`IndexedDBへのレイヤー(ID: ${layerId})保存に失敗しました:`, err);
  }
}

/**
 * IndexedDBに保存されているすべてのレイヤーデータをID順で取得します。
 * @returns {Promise<Array<Object>>} レイヤーデータの配列を返すPromiseオブジェクト。
 */
export async function loadLayersFromIndexedDB() {
  try {
    // .orderBy('id') でID順に並び替えて取得し、レイヤーの順序を保ちます。
    return await db.layers.orderBy('id').toArray();
  } catch (err) {
    console.error("IndexedDBからのレイヤー読み込みに失敗しました:", err);
    return []; // エラーが発生した場合は空の配列を返します。
  }
}

/**
 * IndexedDBに保存されているすべてのレイヤーデータを削除します。
 * 新しくキャンバスを作り始めるときなどに使います。
 */
export async function clearAllLayersFromIndexedDB() {
    try {
        await db.layers.clear();
        console.log("IndexedDBの全レイヤーデータを削除しました。");
    } catch (err) {
        console.error("IndexedDBのデータ削除に失敗しました:", err);
    }
}