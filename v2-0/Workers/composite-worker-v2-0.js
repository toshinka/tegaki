// composite-worker-v2-0.js
// Last updated: 2025-06-17 17:28:12
// Author: toshinka

self.currentUser = 'toshinka';
self.currentTimestamp = '2025-06-17 17:28:12';

// コンポジットワーカーの状態管理
const state = {
    isProcessing: false,
    queue: [],
    buffers: new Map(),
    metrics: {
        processedFrames: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        peakMemoryUsage: 0
    }
};

// 合成モード実装
const blendModes = {
    'source-over': (src, dst) => ({
        r: src.r + dst.r * (1 - src.a),
        g: src.g + dst.g * (1 - src.a),
        b: src.b + dst.b * (1 - src.a),
        a: src.a + dst.a * (1 - src.a)
    }),

    'multiply': (src, dst) => ({
        r: (src.r * dst.r) / 255,
        g: (src.g * dst.g) / 255,
        b: (src.b * dst.b) / 255,
        a: src.a + dst.a * (1 - src.a)
    }),

    'screen': (src, dst) => ({
        r: 255 - ((255 - src.r) * (255 - dst.r)) / 255,
        g: 255 - ((255 - src.g) * (255 - dst.g)) / 255,
        b: 255 - ((255 - src.b) * (255 - dst.b)) / 255,
        a: src.a + dst.a * (1 - src.a)
    }),

    'overlay': (src, dst) => ({
        r: dst.r < 128 ? 
            (2 * src.r * dst.r) / 255 : 
            255 - 2 * ((255 - src.r) * (255 - dst.r)) / 255,
        g: dst.g < 128 ? 
            (2 * src.g * dst.g) / 255 : 
            255 - 2 * ((255 - src.g) * (255 - dst.g)) / 255,
        b: dst.b < 128 ? 
            (2 * src.b * dst.b) / 255 : 
            255 - 2 * ((255 - src.b) * (255 - dst.b)) / 255,
        a: src.a + dst.a * (1 - src.a)
    })
};

// メインメッセージハンドラ
self.onmessage = async function(event) {
    const { type, data } = event.data;

    try {
        switch (type) {
            case 'composite':
                await processComposite(data);
                break;
            case 'clear-buffers':
                clearBuffers();
                break;
            case 'get-metrics':
                sendMetrics();
                break;
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: 'composite-error',
            data: error.message
        });
    }
};

// レイヤー合成処理
async function processComposite(data) {
    const startTime = performance.now();
    state.isProcessing = true;

    try {
        const { layers, width, height } = data;
        const result = new ImageData(width, height);

        // バッファの初期化
        initializeBuffer(result.data);

        // レイヤーの合成処理
        for (const layer of layers) {
            if (!layer.visible) continue;

            await compositeLayer(
                result.data,
                await createImageData(layer.imageData),
                layer.opacity,
                layer.blendMode
            );
        }

        // 結果の送信
        self.postMessage({
            type: 'composite-complete',
            data: result
        }, [result.data.buffer]);

        // メトリクスの更新
        updateMetrics(startTime);

    } catch (error) {
        throw new Error(`Composite processing failed: ${error.message}`);
    } finally {
        state.isProcessing = false;
        processQueue();
    }
}

// バッファの初期化
function initializeBuffer(buffer) {
    for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = 0;     // R
        buffer[i+1] = 0;   // G
        buffer[i+2] = 0;   // B
        buffer[i+3] = 0;   // A
    }
}

// ImageDataの作成
async function createImageData(imageData) {
    return new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
    );
}

// レイヤーの合成
async function compositeLayer(dst, src, opacity, blendMode) {
    const blend = blendModes[blendMode] || blendModes['source-over'];

    for (let i = 0; i < dst.length; i += 4) {
        const srcPixel = {
            r: src.data[i],
            g: src.data[i+1],
            b: src.data[i+2],
            a: src.data[i+3] * opacity / 255
        };

        const dstPixel = {
            r: dst[i],
            g: dst[i+1],
            b: dst[i+2],
            a: dst[i+3] / 255
        };

        if (srcPixel.a === 0) continue;

        const result = blend(srcPixel, dstPixel);

        dst[i] = Math.round(result.r);
        dst[i+1] = Math.round(result.g);
        dst[i+2] = Math.round(result.b);
        dst[i+3] = Math.round(result.a * 255);
    }
}

// 高速合成処理（SIMD対応）
async function compositeLayerSIMD(dst, src, opacity, blendMode) {
    if (!crossOriginIsolated) {
        return compositeLayer(dst, src, opacity, blendMode);
    }

    const blend = blendModes[blendMode] || blendModes['source-over'];
    const lanes = 4;

    // SIMD処理
    try {
        const simdLength = dst.length - (dst.length % (4 * lanes));
        
        for (let i = 0; i < simdLength; i += 4 * lanes) {
            const srcVec = SIMD.Float32x4.load(src.data, i);
            const dstVec = SIMD.Float32x4.load(dst, i);
            const opacityVec = SIMD.Float32x4.splat(opacity / 255);

            const resultVec = blend(
                SIMD.Float32x4.mul(srcVec, opacityVec),
                dstVec
            );

            SIMD.Float32x4.store(dst, i, resultVec);
        }

        // 残りのピクセルを通常処理
        for (let i = simdLength; i < dst.length; i += 4) {
            const srcPixel = {
                r: src.data[i],
                g: src.data[i+1],
                b: src.data[i+2],
                a: src.data[i+3] * opacity / 255
            };

            const dstPixel = {
                r: dst[i],
                g: dst[i+1],
                b: dst[i+2],
                a: dst[i+3] / 255
            };

            if (srcPixel.a === 0) continue;

            const result = blend(srcPixel, dstPixel);

            dst[i] = Math.round(result.r);
            dst[i+1] = Math.round(result.g);
            dst[i+2] = Math.round(result.b);
            dst[i+3] = Math.round(result.a * 255);
        }

    } catch (error) {
        // SIMD失敗時は通常処理にフォールバック
        return compositeLayer(dst, src, opacity, blendMode);
    }
}

// バッファ管理
function clearBuffers() {
    for (const buffer of state.buffers.values()) {
        if (buffer instanceof ImageData) {
            buffer.data = new Uint8ClampedArray(buffer.data.length);
        }
    }
    state.buffers.clear();
}

// メトリクス管理
function updateMetrics(startTime) {
    const processingTime = performance.now() - startTime;
    state.metrics.processedFrames++;
    state.metrics.totalProcessingTime += processingTime;
    state.metrics.averageProcessingTime = 
        state.metrics.totalProcessingTime / state.metrics.processedFrames;
    
    // メモリ使用量の記録
    if (performance.memory) {
        state.metrics.peakMemoryUsage = Math.max(
            state.metrics.peakMemoryUsage,
            performance.memory.usedJSHeapSize
        );
    }
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
        processComposite(next);
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
        user: self.currentUser,
        features: {
            simd: crossOriginIsolated,
            threads: navigator.hardwareConcurrency
        }
    }
});