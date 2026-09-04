/**
 * ============================================================================
 * ファイル名: system/drawing/realtime-stroke-sampling.js
 * 責務: 画面ピクセル基準の適応的補間サンプリング計算（Stage C）
 * 依存: なし（DOM / Pixi非依存の純粋関数群）
 * 被依存: brush-core.js, verifier
 * 公開API:
 *   - calculateScreenToLocalRatio
 *   - calculateAdaptiveStep
 *   - calculateAdaptiveSamplingSteps
 *   - generateAdaptiveInterpolationPoints
 * ============================================================================
 */

/**
 * 画面座標移動量とローカル座標移動量から、1画面ピクセルあたりのローカル単位数を計算する。
 * @param {{x: number, y: number}|null} lastClient
 * @param {{x: number, y: number}|null} currentClient
 * @param {{x: number, y: number}} lastLocal
 * @param {{x: number, y: number}} currentLocal
 * @param {number} [epsilon=1e-4]
 * @returns {number} localPerScreenPx (未確定時は 1.0)
 */
export function calculateScreenToLocalRatio(lastClient, currentClient, lastLocal, currentLocal, epsilon = 1e-4) {
    if (!lastClient || !currentClient ||
        !Number.isFinite(lastClient.x) || !Number.isFinite(lastClient.y) ||
        !Number.isFinite(currentClient.x) || !Number.isFinite(currentClient.y)) {
        return 1.0;
    }

    const screenDistance = Math.hypot(currentClient.x - lastClient.x, currentClient.y - lastClient.y);
    const localDistance = Math.hypot(currentLocal.x - lastLocal.x, currentLocal.y - lastLocal.y);

    if (screenDistance <= epsilon) {
        return 1.0;
    }

    const ratio = localDistance / screenDistance;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1.0;
}

/**
 * 画面倍率に応じたローカル空間の補間ステップサイズ（local step）を算出する。
 * 100%表示（localPerScreenPx <= 1.0）時は既存と同一の 1 local px を維持。
 * 縮小表示（localPerScreenPx > 1.0）時は約1画面ピクセルあたり1セグメントになるようステップを拡張する。
 *
 * @param {Object} options
 * @param {number} [options.screenDistance]
 * @param {number} [options.localDistance]
 * @param {number} [options.localPerScreenPx]
 * @param {number} [options.minStep=1]
 * @param {number} [options.maxStep=16]
 * @param {string} [options.currentMode='pen']
 * @returns {number} localStep
 */
export function calculateAdaptiveStep({
    screenDistance,
    localDistance,
    localPerScreenPx,
    minStep = 1,
    maxStep = 16,
    currentMode = 'pen'
} = {}) {
    if (currentMode === 'lasso-fill') {
        return 5;
    }

    let ratio = localPerScreenPx;
    if (!Number.isFinite(ratio) || ratio <= 0) {
        if (Number.isFinite(screenDistance) && screenDistance > 1e-4 && Number.isFinite(localDistance)) {
            ratio = localDistance / screenDistance;
        } else {
            ratio = 1.0;
        }
    }

    // 100%表示（ratio <= 1.0）および拡大表示時は既存と同一の minStep (通常1)
    if (ratio <= 1.0) {
        return minStep;
    }

    // 縮小表示時は 1 screen px に相当する local 距離を基本ステップとし、安全クランプ
    const adaptive = Math.round(ratio);
    return Math.max(minStep, Math.min(maxStep, adaptive));
}

/**
 * 適応的補間による分割ステップ数を算出する。
 *
 * @param {Object} options
 * @param {number} options.localDistance
 * @param {number} [options.screenDistance]
 * @param {number} [options.localPerScreenPx]
 * @param {number} [options.pressureDelta=0]
 * @param {boolean} [options.pressureEnabled=false]
 * @param {string} [options.currentMode='pen']
 * @param {number} [options.minStep=1]
 * @param {number} [options.maxStep=16]
 * @returns {number} steps (1以上の整数)
 */
export function calculateAdaptiveSamplingSteps({
    localDistance,
    screenDistance,
    localPerScreenPx,
    pressureDelta = 0,
    pressureEnabled = false,
    currentMode = 'pen',
    minStep = 1,
    maxStep = 16
} = {}) {
    const validLocalDist = Number.isFinite(localDistance) ? Math.max(0, localDistance) : 0;
    const step = calculateAdaptiveStep({
        screenDistance,
        localDistance: validLocalDist,
        localPerScreenPx,
        minStep,
        maxStep,
        currentMode
    });

    let steps = Math.max(1, Math.floor(validLocalDist / step));

    // 指示書 Chapter 27: 筆圧急変時の線幅段差防止
    // 空間移動が小さくても筆圧変化が大きい場合、十分な補間ステップを確保する
    if (pressureEnabled && Number.isFinite(pressureDelta) && pressureDelta > 0.15) {
        const pressureSteps = Math.min(maxStep, Math.max(1, Math.ceil(pressureDelta / 0.15)));
        if (pressureSteps > steps) {
            steps = pressureSteps;
        }
    }

    return steps;
}

/**
 * 2点間の適応的補間中間点リストを生成する。
 * 終点 (currentLocal) は既存 updateStroke の契約通り呼び出し元で直接追加・描画されるため、
 * 本関数は [1 .. steps] の内分点のみを返す。
 *
 * @param {Object} options
 * @param {{x: number, y: number}} options.lastLocal
 * @param {{x: number, y: number}} options.currentLocal
 * @param {number} options.lastPressure
 * @param {number} options.currentPressure
 * @param {{x: number, y: number}|null} [options.lastClient]
 * @param {{x: number, y: number}|null} [options.currentClient]
 * @param {boolean} [options.pressureEnabled=false]
 * @param {string} [options.currentMode='pen']
 * @param {number} [options.minStep=1]
 * @param {number} [options.maxStep=16]
 * @returns {{steps: number, stepSize: number, points: Array<{x: number, y: number, pressure: number, t: number}>}}
 */
export function generateAdaptiveInterpolationPoints({
    lastLocal,
    currentLocal,
    lastPressure,
    currentPressure,
    lastClient = null,
    currentClient = null,
    pressureEnabled = false,
    currentMode = 'pen',
    minStep = 1,
    maxStep = 16
} = {}) {
    const dx = currentLocal.x - lastLocal.x;
    const dy = currentLocal.y - lastLocal.y;
    const localDistance = Math.hypot(dx, dy);

    let screenDistance = 0;
    if (lastClient && currentClient &&
        Number.isFinite(lastClient.x) && Number.isFinite(lastClient.y) &&
        Number.isFinite(currentClient.x) && Number.isFinite(currentClient.y)) {
        screenDistance = Math.hypot(currentClient.x - lastClient.x, currentClient.y - lastClient.y);
    }

    const pressureDelta = Math.abs(currentPressure - lastPressure);
    const steps = calculateAdaptiveSamplingSteps({
        localDistance,
        screenDistance,
        pressureDelta,
        pressureEnabled,
        currentMode,
        minStep,
        maxStep
    });

    const stepSize = calculateAdaptiveStep({
        screenDistance,
        localDistance,
        minStep,
        maxStep,
        currentMode
    });

    const points = [];
    for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1);
        points.push({
            x: lastLocal.x + dx * t,
            y: lastLocal.y + dy * t,
            pressure: lastPressure + (currentPressure - lastPressure) * t,
            t
        });
    }

    return { steps, stepSize, points };
}
