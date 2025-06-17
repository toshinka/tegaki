// color-worker-v2-0.js
// Last updated: 2025-06-17 17:26:00
// Author: toshinka

self.currentUser = 'toshinka';
self.currentTimestamp = '2025-06-17 17:26:00';

// カラーワーカーの状態管理
const state = {
    isProcessing: false,
    queue: [],
    cache: new Map(),
    maxCacheSize: 1000,
    metrics: {
        processedColors: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        cacheHits: 0,
        cacheMisses: 0
    }
};

// カラースペース変換行列
const matrices = {
    rgb2xyz: [
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041]
    ],
    xyz2rgb: [
        [ 3.2404542, -1.5371385, -0.4985314],
        [-0.9692660,  1.8760108,  0.0415560],
        [ 0.0556434, -0.2040259,  1.0572252]
    ]
};

// メッセージハンドラ
self.onmessage = async function(event) {
    const { type, data } = event.data;

    try {
        switch (type) {
            case 'process-color':
                await processColor(data);
                break;
            case 'generate-palette':
                await generatePalette(data);
                break;
            case 'analyze-image':
                await analyzeImage(data);
                break;
            case 'clear-cache':
                clearCache();
                break;
            case 'get-metrics':
                sendMetrics();
                break;
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: 'worker-error',
            data: error.message
        });
    }
};

// カラー処理のメイン関数
async function processColor(data) {
    const startTime = performance.now();
    state.isProcessing = true;

    try {
        const {
            color,
            operation,
            parameters = {}
        } = data;

        let result;
        switch (operation) {
            case 'harmonize':
                result = await harmonizeColor(color, parameters);
                break;
            case 'blend':
                result = await blendColors(color, parameters);
                break;
            case 'convert':
                result = await convertColor(color, parameters);
                break;
            case 'adjust':
                result = await adjustColor(color, parameters);
                break;
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }

        self.postMessage({
            type: 'color-processed',
            data: result
        });

        updateMetrics(startTime);

    } catch (error) {
        throw new Error(`Color processing failed: ${error.message}`);
    } finally {
        state.isProcessing = false;
        processQueue();
    }
}

// カラーハーモニー生成
async function harmonizeColor(color, parameters) {
    const { scheme = 'complementary', count = 2 } = parameters;
    const cacheKey = `${scheme}-${color}-${count}`;

    if (state.cache.has(cacheKey)) {
        state.metrics.cacheHits++;
        return state.cache.get(cacheKey);
    }

    state.metrics.cacheMisses++;
    let colors;

    const hsl = rgbToHsl(hexToRgb(color));

    switch (scheme) {
        case 'complementary':
            colors = [
                color,
                hslToHex([(hsl[0] + 180) % 360, hsl[1], hsl[2]])
            ];
            break;

        case 'analogous':
            colors = [
                color,
                hslToHex([(hsl[0] + 30) % 360, hsl[1], hsl[2]]),
                hslToHex([(hsl[0] - 30 + 360) % 360, hsl[1], hsl[2]])
            ];
            break;

        case 'triadic':
            colors = [
                color,
                hslToHex([(hsl[0] + 120) % 360, hsl[1], hsl[2]]),
                hslToHex([(hsl[0] + 240) % 360, hsl[1], hsl[2]])
            ];
            break;

        case 'tetradic':
            colors = [
                color,
                hslToHex([(hsl[0] + 90) % 360, hsl[1], hsl[2]]),
                hslToHex([(hsl[0] + 180) % 360, hsl[1], hsl[2]]),
                hslToHex([(hsl[0] + 270) % 360, hsl[1], hsl[2]])
            ];
            break;

        case 'monochromatic':
            colors = generateMonochromatic(hsl, count);
            break;

        default:
            throw new Error(`Unknown color scheme: ${scheme}`);
    }

    maintainCache();
    state.cache.set(cacheKey, colors);
    return colors;
}

// カラーブレンド処理
async function blendColors(colors, parameters) {
    const { mode = 'normal', weights = [] } = parameters;
    const cacheKey = `${mode}-${colors.join('-')}-${weights.join('-')}`;

    if (state.cache.has(cacheKey)) {
        state.metrics.cacheHits++;
        return state.cache.get(cacheKey);
    }

    state.metrics.cacheMisses++;
    let result;

    const rgbColors = colors.map(c => hexToRgb(c));

    switch (mode) {
        case 'normal':
            result = normalBlend(rgbColors, weights);
            break;
        case 'multiply':
            result = multiplyBlend(rgbColors, weights);
            break;
        case 'screen':
            result = screenBlend(rgbColors, weights);
            break;
        case 'overlay':
            result = overlayBlend(rgbColors, weights);
            break;
        default:
            throw new Error(`Unknown blend mode: ${mode}`);
    }

    const hexResult = rgbToHex(result);
    maintainCache();
    state.cache.set(cacheKey, hexResult);
    return hexResult;
}

// カラースペース変換
async function convertColor(color, parameters) {
    const { from = 'hex', to = 'rgb' } = parameters;
    const cacheKey = `${from}-${to}-${color}`;

    if (state.cache.has(cacheKey)) {
        state.metrics.cacheHits++;
        return state.cache.get(cacheKey);
    }

    state.metrics.cacheMisses++;
    let result;

    switch (`${from}-${to}`) {
        case 'hex-rgb':
            result = hexToRgb(color);
            break;
        case 'rgb-hex':
            result = rgbToHex(color);
            break;
        case 'rgb-hsl':
            result = rgbToHsl(color);
            break;
        case 'hsl-rgb':
            result = hslToRgb(color);
            break;
        case 'rgb-lab':
            result = rgbToLab(color);
            break;
        case 'lab-rgb':
            result = labToRgb(color);
            break;
        default:
            throw new Error(`Unsupported conversion: ${from} to ${to}`);
    }

    maintainCache();
    state.cache.set(cacheKey, result);
    return result;
}

// カラー調整
async function adjustColor(color, parameters) {
    const {
        lightness = 0,
        saturation = 0,
        hue = 0,
        temperature = 0,
        tint = 0
    } = parameters;

    const cacheKey = `adjust-${color}-${lightness}-${saturation}-${hue}-${temperature}-${tint}`;

    if (state.cache.has(cacheKey)) {
        state.metrics.cacheHits++;
        return state.cache.get(cacheKey);
    }

    state.metrics.cacheMisses++;

    const hsl = rgbToHsl(hexToRgb(color));
    
    // 色相の調整
    hsl[0] = (hsl[0] + hue + 360) % 360;
    
    // 彩度の調整
    hsl[1] = Math.max(0, Math.min(1, hsl[1] + saturation));
    
    // 明度の調整
    hsl[2] = Math.max(0, Math.min(1, hsl[2] + lightness));

    let rgb = hslToRgb(hsl);

    // 色温度の調整
    if (temperature !== 0) {
        rgb = adjustTemperature(rgb, temperature);
    }

    // 色味の調整
    if (tint !== 0) {
        rgb = adjustTint(rgb, tint);
    }

    const result = rgbToHex(rgb);
    maintainCache();
    state.cache.set(cacheKey, result);
    return result;
}

// カラーパレット生成
async function generatePalette(data) {
    const {
        baseColor,
        paletteSize = 5,
        variation = 'balanced'
    } = data;

    const hsl = rgbToHsl(hexToRgb(baseColor));
    let palette;

    switch (variation) {
        case 'balanced':
            palette = generateBalancedPalette(hsl, paletteSize);
            break;
        case 'gradient':
            palette = generateGradientPalette(hsl, paletteSize);
            break;
        case 'random':
            palette = generateRandomPalette(hsl, paletteSize);
            break;
        default:
            throw new Error(`Unknown palette variation: ${variation}`);
    }

    self.postMessage({
        type: 'palette-generated',
        data: palette
    });
}

// 画像からの色分析
async function analyzeImage(data) {
    const { imageData, maxColors = 5 } = data;
    
    // 色の出現頻度を集計
    const colorMap = new Map();
    
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];

        if (a < 128) continue; // 透明部分をスキップ

        const color = rgbToHex([r, g, b]);
        colorMap.set(color, (colorMap.get(color) || 0) + 1);
    }

    // 出現頻度でソートして上位の色を抽出
    const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxColors)
        .map(([color]) => color);

    self.postMessage({
        type: 'image-analyzed',
        data: sortedColors
    });
}

// ヘルパー関数群
function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    return [
        (bigint >> 16) & 255,
        (bigint >> 8) & 255,
        bigint & 255
    ];
}

function rgbToHex(rgb) {
    return '#' + rgb.map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x)))
            .toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function rgbToHsl(rgb) {
    const [r, g, b] = rgb.map(x => x / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    let s = 0;
    let l = (max + min) / 2;

    if (diff !== 0) {
        s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / diff + (g < b ? 6 : 0)) * 60;
                break;
            case g:
                h = ((b - r) / diff + 2) * 60;
                break;
            case b:
                h = ((r - g) / diff + 4) * 60;
                break;
        }
    }

    return [h, s, l];
}

function hslToRgb(hsl) {
    const [h, s, l] = hsl;
    const hue = ((h % 360) + 360) % 360;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = l - c / 2;

    let [r, g, b] = [0, 0, 0];

    if (hue >= 0 && hue < 60) {
        [r, g, b] = [c, x, 0];
    } else if (hue >= 60 && hue < 120) {
        [r, g, b] = [x, c, 0];
    } else if (hue >= 120 && hue < 180) {
        [r, g, b] = [0, c, x];
    } else if (hue >= 180 && hue < 240) {
        [r, g, b] = [0, x, c];
    } else if (hue >= 240 && hue < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }

    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
    ];
}

// キャッシュ管理
function maintainCache() {
    if (state.cache.size >= state.maxCacheSize) {
        const firstKey = state.cache.keys().next().value;
        state.cache.delete(firstKey);
    }
}

function clearCache() {
    state.cache.clear();
    state.metrics.cacheHits = 0;
    state.metrics.cacheMisses = 0;
}

// メトリクス管理
function updateMetrics(startTime) {
    const processingTime = performance.now() - startTime;
    state.metrics.processedColors++;
    state.metrics.totalProcessingTime += processingTime;
    state.metrics.averageProcessingTime = 
        state.metrics.totalProcessingTime / state.metrics.processedColors;
}

function sendMetrics() {
    self.postMessage({
        type: 'metrics',
        data: { ...state.metrics }
    });
}

// キュー処理
function processQueue() {
    if (state.queue.length > 0 && !state.isProcessing) {
        const next = state.queue.shift();
        processColor(next);
    }
}

// エラーハンドリング
self.onerror = function(error) {
    self.postMessage({
        type: 'worker-error',
        data: error.message
    });
};

// 初期化完了通知
self.postMessage({
    type: 'worker-ready',
    data: {
        timestamp: self.currentTimestamp,
        user: self.currentUser
    }
});