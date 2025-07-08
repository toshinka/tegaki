// Dexie.jsはHTMLでグローバルに読み込まれていることを前提とします
const { Dexie } = window;

if (!Dexie) {
    throw new Error("Dexie.jsが読み込まれていません。ToshinkaTegakiTool.htmlを確認してください。");
}

const db = new Dexie("TegakiProjectDB");

// データベースのスキーマを定義
db.version(1).stores({
  layers: "++id, name, opacity, visible, blendMode, modelMatrix, imageData"
});

/**
 * レイヤーオブジェクトをIndexedDBに保存（追加または更新）します。
 * ImageDataをDataURLに変換してから保存します。
 * @param {Layer} layerObject - 保存するレイヤーオブジェクト
 * @returns {Promise<number>} 保存されたアイテムのID
 */
export async function saveLayerToDB(layerObject) {
  // Layerオブジェクトから保存用のプレーンオブジェクトを作成
  const { imageData, ...propsToSave } = layerObject;

  // ImageDataをDataURLに変換
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  const dataURL = canvas.toDataURL();
  
  // DBに保存するオブジェクト
  const dbEntry = {
      ...propsToSave,
      modelMatrix: Array.from(propsToSave.modelMatrix), // Float32Arrayを通常の配列に変換
      imageData: dataURL
  };

  // layerObjectにidがあれば更新、なければ追加として動作する
  const id = await db.layers.put(dbEntry);
  // console.log(`レイヤー "${layerObject.name}" (ID: ${id}) をDBに保存しました。`);
  return id;
}

/**
 * IndexedDBからすべてのレイヤーデータを読み込みます。
 * @returns {Promise<Array<object>>} レイヤーオブジェクトの配列
 */
export async function loadLayersFromDB() {
  const layersFromDB = await db.layers.toArray();
  return layersFromDB;
}

/**
 * IndexedDBのレイヤーテーブルを空にします。
 * @returns {Promise<void>}
 */
export async function clearDB() {
    return await db.layers.clear();
}