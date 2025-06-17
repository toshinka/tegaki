// brush-worker-v2-0.js
// Last updated: 2025-06-17 17:09:02
// Author: toshinka

self.currentUser = 'toshinka';
self.currentTimestamp = '2025-06-17 17:09:02';

// ブラシワーカーの状態管理
const state = {
    isProcessing: false,
    queue: [],
    cache: new Map(),
    maxCacheSize: 100,
    buffers: new Map(),
    metrics: {
        processedStrokes: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0
    }
};

// 初期化処理
self.onmessage = async function(event) {
    const { type, data } = event.data;

    try {
        switch (type) {
            case 'process-stroke':
                await processStroke(data);
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

// ストローク処理のメイン関数
async function processStroke(data) {
    const startTime = performance.now();
    state.isProcessing = true;

    try {
        const {
            points,
            color,
            size,
            flow,
            hardness,
            spacing,
            angle,
            roundness,
            scattering,
            jitter
        } = data;

        // バッファの作成または取得
        const buffer = getStrokeBuffer(size);
        const ctx = buffer.getContext('2d');

        // ストロークの描画
        await drawStroke(ctx, {
            points,
            color,
            size,
            flow,
            hardness,
            spacing,
            angle,
            roundness,
            scattering,
            jitter
        });

        // 結果の転送
        const imageData = ctx.getImageData(0, 0, buffer.width, buffer.height);
        self.postMessage({
            type: 'stroke-processed',
            data: {
                buffer: imageData.data.buffer,
                width: buffer.width,
                height: buffer.height
            }
        }, [imageData.data.buffer]);

        // メトリクスの更新
        updateMetrics(performance.now() - startTime);

    } catch (error) {
        self.postMessage({
            type: 'worker-error',
            data: error.message
        });
    } finally {
        state.isProcessing = false;
        processQueue();
    }
}

// ストロークバッファの管理
function getStrokeBuffer(size) {
    const bufferSize = Math.ceil(size * 2);
    const key = `buffer-${bufferSize}`;

    if (!state.buffers.has(key)) {
        const buffer = new OffscreenCanvas(bufferSize, bufferSize);
        state.buffers.set(key, buffer);
    }

    return state.buffers.get(key);
}

// ストロークの描画処理
async function drawStroke(ctx, options) {
    const {
        points,
        color,
        size,
        flow,
        hardness,
        spacing,
        angle,
        roundness,
        scattering,
        jitter
    } = options;

    // コンテキストの初期化
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // カラーとアルファの設定
    const rgbaColor = parseColor(color);
    ctx.strokeStyle = `rgba(${rgbaColor.join(',')})`;
    ctx.globalAlpha = flow;

    // パスの描画
    ctx.beginPath();
    
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        
        // 点間の補間
        const segments = interpolatePoints(p1, p2, spacing);
        
        for (const point of segments) {
            // スキャタリングとジッターの適用
            const scattered = applyScattering(point, size, scattering);
            const jittered = applyJitter(scattered, jitter);
            
            // 筆圧と傾きの処理
            const pressure = calculatePressure(point.pressure, hardness);
            const tilt = calculateTilt(point.tilt, angle);
            
            // ブラシスタンプの描画
            drawBrushStamp(ctx, {
                x: jittered.x,
                y: jittered.y,
                size: size * pressure,
                angle: tilt,
                roundness,
                flow: flow * pressure
            });
        }
    }

    ctx.stroke();
}

// カラー処理
function parseColor(color) {
    if (typeof color === 'string') {
        if (color.startsWith('#')) {
            return hexToRgba(color);
        } else if (color.startsWith('rgba')) {
            return color.match(/\d+/g).map(Number);
        } else if (color.startsWith('rgb')) {
            const rgb = color.match(/\d+/g).map(Number);
            return [...rgb, 1];
        }
    }
    return [0, 0, 0, 1];
}

function hexToRgba(hex) {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    
    if (hex.length === 3) {
        const r = ((bigint >> 8) & 15) * 17;
        const g = ((bigint >> 4) & 15) * 17;
        const b = (bigint & 15) * 17;
        return [r, g, b, 1];
    }
    
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b, 1];
}

// 点の補間
function interpolatePoints(p1, p2, spacing) {
    const segments = [];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        segments.push({
            x: p1.x + dx * t,
            y: p1.y + dy * t,
            pressure: lerp(p1.pressure, p2.pressure, t),
            tilt: {
                x: lerp(p1.tilt.x, p2.tilt.x, t),
                y: lerp(p1.tilt.y, p2.tilt.y, t)
            }
        });
    }

    return segments;
}

// 線形補間
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// スキャタリングの適用
function applyScattering(point, size, scattering) {
    const radius = size * scattering;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;

    return {
        x: point.x + Math.cos(angle) * distance,
        y: point.y + Math.sin(angle) * distance,
        pressure: point.pressure,
        tilt: point.tilt
    };
}

// ジッターの適用
function applyJitter(point, jitter) {
    const jitterAmount = jitter * 2 - 1;
    return {
        x: point.x + Math.random() * jitterAmount,
        y: point.y + Math.random() * jitterAmount,
        pressure: point.pressure,
        tilt: point.tilt
    };
}

// 筆圧の計算
function calculatePressure(pressure, hardness) {
    return Math.pow(pressure, 1 + hardness);
}

// 傾きの計算
function calculateTilt(tilt, baseAngle) {
    const tiltAngle = Math.atan2(tilt.y, tilt.x);
    return baseAngle + tiltAngle;
}

// ブラシスタンプの描画
function drawBrushStamp(ctx, options) {
    const {
        x,
        y,
        size,
        angle,
        roundness,
        flow
    } = options;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1, roundness);
    
    const radius = size / 2;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    
    gradient.addColorStop(0, `rgba(255,255,255,${flow})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-radius, -radius, size, size);
    
    ctx.restore();
}

// キャッシュ管理
function clearCache() {
    state.cache.clear();
    state.buffers.forEach(buffer => {
        buffer.width = 0;
        buffer.height = 0;
    });
    state.buffers.clear();
}

// メトリクス管理
function updateMetrics(processTime) {
    state.metrics.processedStrokes++;
    state.metrics.totalProcessingTime += processTime;
    state.metrics.averageProcessingTime = 
        state.metrics.totalProcessingTime / state.metrics.processedStrokes;
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
        processStroke(next);
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