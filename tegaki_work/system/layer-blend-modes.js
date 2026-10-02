/**
 * ============================================================================
 * ファイル名: system/layer-blend-modes.js
 * 責務: Layer/フォルダの合成モード定義(値・表示名・短縮名・PSD名)の唯一の置き場
 * 依存: なし（Pixi 'pixi.js/advanced-blend-modes' が読み込み済みであること）
 * 被依存: system/layer-system.js, ui/layer-panel-renderer.js, system/exporters/psd-exporter.js, system/psd-importer.js
 * 公開API: isAdvancedLayerBlendMode, LAYER_BLEND_MODES, LAYER_BLEND_MODE_GROUPS, isLayerBlendMode, normalizeLayerBlendMode,
 *   getLayerBlendModeShortLabel, getLayerBlendModePsdName, layerBlendModeFromPsdName
 * 保存: layerData.blendMode(文字列)。未知の値は読み込み時に 'normal' へ正規化する。
 * 実装状態: ✅実装
 *
 * 採用範囲: PixiのGPU合成とCanvas2D(書き出し・アニメ合成)の双方に同名で存在し、見た目が一致する15種。
 * hue / divide / subtract 等はCanvas2D側に無い、または結果が一致しないため含めない。
 * ============================================================================
 */

/** value: Pixi/Canvas2D共通名 / psd: PSDのブレンドキー名 */
export const LAYER_BLEND_MODES = Object.freeze([
    { value: 'normal', label: '通常', short: '', group: 'normal', psd: 'normal' },
    { value: 'darken', label: '比較(暗)', short: '比暗', group: 'darken', psd: 'darken' },
    { value: 'multiply', label: '乗算', short: '乗算', group: 'darken', psd: 'multiply' },
    { value: 'color-burn', label: '焼き込みカラー', short: '焼込', group: 'darken', psd: 'color burn' },
    { value: 'lighten', label: '比較(明)', short: '比明', group: 'lighten', psd: 'lighten' },
    { value: 'screen', label: 'スクリーン', short: 'SC', group: 'lighten', psd: 'screen' },
    { value: 'color-dodge', label: '覆い焼きカラー', short: '覆焼', group: 'lighten', psd: 'color dodge' },
    { value: 'add', label: '加算', short: '加算', group: 'lighten', psd: 'linear dodge' },
    { value: 'overlay', label: 'オーバーレイ', short: 'OL', group: 'contrast', psd: 'overlay' },
    { value: 'soft-light', label: 'ソフトライト', short: 'SL', group: 'contrast', psd: 'soft light' },
    { value: 'hard-light', label: 'ハードライト', short: 'HL', group: 'contrast', psd: 'hard light' },
    { value: 'difference', label: '差の絶対値', short: '差', group: 'compare', psd: 'difference' },
    { value: 'exclusion', label: '除外', short: '除外', group: 'compare', psd: 'exclusion' },
    { value: 'saturation', label: '彩度', short: '彩度', group: 'color', psd: 'saturation' },
    { value: 'color', label: 'カラー', short: '色', group: 'color', psd: 'color' },
    { value: 'luminosity', label: '輝度', short: '輝度', group: 'color', psd: 'luminosity' }
]);

export const LAYER_BLEND_MODE_GROUPS = Object.freeze([
    { id: 'normal', label: '' },
    { id: 'darken', label: '暗くする' },
    { id: 'lighten', label: '明るくする' },
    { id: 'contrast', label: 'コントラスト' },
    { id: 'compare', label: '比較' },
    { id: 'color', label: '色' }
]);

const BY_VALUE = new Map(LAYER_BLEND_MODES.map(mode => [mode.value, mode]));
const BY_PSD = new Map(LAYER_BLEND_MODES.map(mode => [mode.psd, mode]));

/** Pixi標準の合成(バックバッファ不要)。それ以外はadvanced-blend-modes(フィルタ経路)で、バックバッファが要る。 */
const NATIVE_PIXI_BLEND_MODES = new Set(['normal', 'add', 'multiply', 'screen']);

export function isAdvancedLayerBlendMode(value) {
    return BY_VALUE.has(value) && !NATIVE_PIXI_BLEND_MODES.has(value);
}

export function isLayerBlendMode(value) {
    return BY_VALUE.has(value);
}

export function normalizeLayerBlendMode(value) {
    return BY_VALUE.has(value) ? value : 'normal';
}

export function getLayerBlendModeShortLabel(value) {
    return BY_VALUE.get(value)?.short || '';
}

export function getLayerBlendModePsdName(value, isFolder = false) {
    if (value === 'normal' || !BY_VALUE.has(value)) return isFolder ? 'pass through' : 'normal';
    return BY_VALUE.get(value).psd;
}

/** PSDのキー名 → 内部の値。未対応は normal。 */
export function layerBlendModeFromPsdName(name) {
    const key = String(name || '').toLowerCase();
    if (key === 'pass through') return 'normal';
    return BY_PSD.get(key)?.value || 'normal';
}
