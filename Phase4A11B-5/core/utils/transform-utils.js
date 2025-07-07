/**
 * 行列が有効か（壊れていないか）をチェックする関数
 * @param {mat4} m - チェック対象の行列
 * @returns {boolean}
 */
export function isValidMatrix(m) {
  // この関数は、行列が計算不能な値（NaNなど）を含んでいないかチェックします。
  if (!m || m.length !== 16) {
    return false;
  }
  // 行列の16個の全要素をチェックします。
  for (let i = 0; i < 16; i++) {
    // isFinite で、数値が無限大やNaNでないことを確認します。
    if (!Number.isFinite(m[i])) {
      return false;
    }
  }
  return true;
}

/**
 * ワールド座標（画面上の座標）をレイヤーのローカル座標に変換する
 * @param {number} worldX - ワールドX座標
 * @param {number} worldY - ワールドY座標
 * @param {mat4} modelMatrix - レイヤーのモデル行列
 * @returns {{x: number, y: number}} ローカル座標
 */
export function transformWorldToLocal(worldX, worldY, modelMatrix) {
  // [修正点①] 逆行列を計算する前に、渡された行列が壊れていないかチェックします。
  // これで、レイヤー移動を繰り返した時に発生する不正なデータによるエラーを防ぎます。
  if (!isValidMatrix(modelMatrix)) {
    console.warn('不正な modelMatrix が渡されたため、座標変換をスキップします。World:', {x: worldX, y: worldY});
    // 安全のため、変換せずに元のワールド座標をそのまま返します。
    return { x: worldX, y: worldY };
  }

  const invMatrix = mat4.create();

  // [修正点②] 逆行列の計算が成功したかチェックします。
  // 計算に失敗すると `null` が返るので、その場合の対策（フォールバック）を追加します。
  if (!mat4.invert(invMatrix, modelMatrix)) {
    console.warn('逆行列の計算に失敗しました。単位行列をフォールバックとして使用します。');
    // 指示通り、失敗時は「単位行列」を使います。
    // 単位行列は「何も変換しない」行列なので、結果的にワールド座標がそのまま使われます。
    mat4.identity(invMatrix);
  }

  const worldPos = vec4.fromValues(worldX, worldY, 0, 1);
  const localPos = vec4.create();

  // 逆行列を使って、ワールド座標をローカル座標に変換します。
  vec4.transformMat4(localPos, worldPos, invMatrix);

  const localX = localPos[0];
  const localY = localPos[1];

  // [修正点③] 変換後の座標が計算不能な値（Infinity や NaN）になっていないかチェックします。
  if (!Number.isFinite(localX) || !Number.isFinite(localY)) {
    console.error('座標変換の結果が不正な値 (Infinity/NaN) になりました。ワールド座標を返します。');
    // 万が一、計算結果がおかしくなった場合も、安全のために元のワールド座標を返します。
    return { x: worldX, y: worldY };
  }

  // 指示通り、変換結果のログは残します。
  console.log('[座標変換] World:', worldX, worldY, '→ Local:', localX, localY);

  // 計算したローカル座標を返します。
  return { x: localX, y: localY };
}