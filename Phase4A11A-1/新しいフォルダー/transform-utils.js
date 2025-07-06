/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Transform Utilities
 * Version: 1.0.0 (Phase 4A11A-1)
 *
 * - 新規作成 (Phase 4A11A-1):
 * - 「Phase 4A11A-1」の指示に基づき、座標変換ユーティリティファイルを作成。
 * - ワールド座標（画面上の絶対座標）をレイヤーのローカル座標に変換する
 * `transformWorldToLocal`関数を実装。
 * - この関数は、レイヤーのmodelMatrixの逆行列を使用して座標を変換し、
 * レイヤーが移動・回転・拡縮されていても、描画位置が正しく計算されるようにする。
 * - デバッグ用のログ出力機能も実装。
 * ===================================================================================
 */

/**
 * ワールド座標（例：マウスクリック位置）を、指定されたモデル行列（modelMatrix）を持つ
 * オブジェクトのローカル座標系に変換します。
 * @param {number} worldX - ワールド座標のX値。
 * @param {number} worldY - ワールド座標のY値。
 * @param {Float32Array} modelMatrix - 変換の基準となる4x4のモデル行列。
 * @returns {{x: number, y: number}|null} 変換後のローカル座標。変換に失敗した場合はnull。
 */
export function transformWorldToLocal(worldX, worldY, modelMatrix) {
    if (!modelMatrix || modelMatrix.length !== 16) {
        console.error("transformWorldToLocal: 無効なmodelMatrixです。", modelMatrix);
        return { x: worldX, y: worldY }; // 行列がない場合は変換せずそのまま返す
    }

    // 1. 逆行列を計算するための入れ物を用意
    const invMatrix = glMatrix.mat4.create();

    // 2. modelMatrixの逆行列を計算する
    //    逆行列は、ローカル座標 -> ワールド座標の変換を、ワールド座標 -> ローカル座標 に戻すために必要
    if (!glMatrix.mat4.invert(invMatrix, modelMatrix)) {
        console.error("transformWorldToLocal: 逆行列の計算に失敗しました。");
        // 逆行列が計算できない（例：スケールが0の）場合、変換は不可能
        return null;
    }

    // 3. 変換したいワールド座標をベクトルとして用意
    const worldPos = glMatrix.vec4.fromValues(worldX, worldY, 0, 1);

    // 4. 変換後のローカル座標を入れるための入れ物を用意
    const localPos = glMatrix.vec4.create();

    // 5. ワールド座標のベクトルに逆行列を掛けて、ローカル座標に変換
    glMatrix.vec4.transformMat4(localPos, worldPos, invMatrix);
    
    // 指示書に基づいたデバッグログ
    console.log(`[座標変換] World: (${worldX.toFixed(2)}, ${worldY.toFixed(2)}) → Local: (${localPos[0].toFixed(2)}, ${localPos[1].toFixed(2)})`);

    return { x: localPos[0], y: localPos[1] };
}