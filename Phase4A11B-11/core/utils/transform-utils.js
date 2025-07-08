// core/utils/transfer-utils.js

// gl-matrixライブラリから行列計算用のmat4オブジェクトを取得します
const mat4 = window.glMatrix.mat4;

/**
 * セル転写専用関数（Vキー押下時など）
 * 台紙レイヤーからバッファへ、画質劣化なしでデータをコピーします。
 * @param {Layer} sourceLayer - コピー元のレイヤー
 * @param {object} cellBuffer - コピー先のバッファオブジェクト
 */
export function transferToCell(sourceLayer, cellBuffer) {
  const sourceData = sourceLayer.imageData;
  // ImageDataをピクセル単位で直接クローンすることで、drawImage()による劣化を完全に防ぎます
  cellBuffer.imageData = new ImageData(
    new Uint8ClampedArray(sourceData.data), 
    sourceData.width, 
    sourceData.height
  );
  // 位置や変形情報（モデル行列）も正確にクローンします
  cellBuffer.originalModelMatrix = mat4.clone(sourceLayer.modelMatrix);
  
  console.log("📋 Cell transfer completed without quality loss.");
}

/**
 * 台紙復帰専用関数（Vキー離し時など）
 * バッファから台紙レイヤーへ、画質劣化なしでデータを復元します。
 * @param {object} cellBuffer - 復元元のバッファオブジェクト
 * @param {Layer} destLayer - 復元先のレイヤー
 */
export function transferFromCell(cellBuffer, destLayer) {
  // バッファのImageDataを直接レイヤーのデータに書き戻します
  destLayer.imageData.data.set(cellBuffer.imageData.data);
  // 位置や変形情報（モデル行列）も元に戻します
  destLayer.modelMatrix = mat4.clone(cellBuffer.originalModelMatrix);
  
  destLayer.gpuDirty = true; // 描画更新のフラグを立てる
  console.log("📋 Cell restore completed without quality loss.");
}

/**
 * IndexedDB等から読み込んだ画像データ(DataURL)を、画質劣化なしでCanvasに描画します
 * @param {string} imgSrc - 画像のDataURL
 * @param {HTMLCanvasElement} canvas - 描画先のCanvas要素
 * @returns {Promise<void>}
 */
export function loadImageWithoutSmoothing(imgSrc, canvas) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      // 🔑 この設定が最重要！drawImage()実行時のアンチエイリアス（ぼかし）を無効化します
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      resolve();
    };
    img.onerror = reject;
    img.src = imgSrc;
  });
}