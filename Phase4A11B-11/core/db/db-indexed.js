/*
 * ===================================================================================
 * Toshinka Tegaki Tool - IndexedDB Module (using Dexie.js)
 * Version: 1.0.0 (Phase 4A11B-11)
 *
 * - 機能:
 * - Dexie.jsライブラリを使い、ブラウザのIndexedDBへのアクセスを簡略化する。
 * - レイヤーデータをDataURL形式で保存、読み込み、全件取得するAPIを提供する。
 * ===================================================================================
 */

// Dexieのインスタンスを生成し、データベース名とバージョン、テーブルスキーマを定義
// 'TegakiCanvasDB' という名前のデータベースを作成
const db = new Dexie('TegakiCanvasDB');

// バージョン1のスキーマを定義
db.version(1).stores({
  // 'layers' というテーブル（オブジェクトストア）を作成
  // '++id'は自動インクリメントのプライマリキー
  // 'name'と'data'は保存するデータのフィールド
  layers: '++id, name, data'
});

/**
 * レイヤーデータをデータベースに保存する
 * @param {string} name - レイヤー名
 * @param {string} dataURL - canvas.toDataURL()で取得した画像データ
 * @returns {Promise<number>} 保存されたアイテムのID
 */
export async function saveLayer(name, dataURL) {
  // db.layers.add()でデータを追加し、そのPromiseを返す
  console.log(`💾 Saving layer "${name}" to IndexedDB...`);
  return await db.layers.add({ name, data: dataURL });
}

/**
 * IDを指定してレイヤーデータを読み込む
 * @param {number} id - 読み込むレイヤーのID
 * @returns {Promise<object|undefined>} 読み込まれたレイヤーデータ、または見つからない場合はundefined
 */
export async function loadLayerById(id) {
  // db.layers.get()でIDに対応するデータを取得し、そのPromiseを返す
  console.log(`💾 Loading layer with ID: ${id} from IndexedDB...`);
  return await db.layers.get(id);
}

/**
 * 保存されている全てのレイヤーデータを取得する
 * @returns {Promise<Array<object>>} 全レイヤーデータの配列
 */
export async function getAllLayers() {
  // db.layers.toArray()で全データを配列として取得し、そのPromiseを返す
  console.log("💾 Fetching all layers from IndexedDB...");
  return await db.layers.toArray();
}

// テスト用に、コンソールからアクセスできるようにグローバルスコープにdbオブジェクトを公開
window.db = {
    saveLayer,
    loadLayerById,
    getAllLayers
};