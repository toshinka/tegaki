// stroke-worker-v2-0.js
// Last updated: 2025-06-17 17:11:05
// Author: toshinka

self.currentUser = 'toshinka';
self.currentTimestamp = '2025-06-17 17:11:05';

// ストロークワーカーの状態管理
const state = {
    isProcessing: false,
    queue: [],
    strokeCache: new Map(),
    pointCache: new Map(),
    maxCacheSize: 1000,
    metrics: {
        processedStrokes: 0,
        cachedStrokes: 0,
        totalPoints: 0,
        processingTime: 0
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
            case 'optimize-stroke':
                await optimizeStroke(data);
                break;
            case 'simplify-stroke':
                await simplifyStroke(data);
                break;
            case 'smooth-stroke':
                await smoothStroke(data);
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
            pressure = true,
            tilt = true,
            stabilize = true,
            simplify = true,
            smooth = true
        } = data;

        let processedPoints = [...points];
        state.metrics.totalPoints += points.length;

        // ストロークの最適化
        if (stabilize) {
            processedPoints = await stabilizeStroke(processedPoints);
        }
        if (simplify) {
            processedPoints = await simplifyStroke(processedPoints);
        }
        if (smooth) {
            processedPoints = await smoothStroke(processedPoints);
        }

        // 筆圧と傾きの処理
        processedPoints = processedPoints.map(point => ({
            ...point,
            pressure: pressure ? normalizePressure(point.pressure) : 1,
            tilt: tilt ? normalizeTilt(point.tilt) : { x: 0, y: 0 }
        }));

        // 結果の送信
        self.postMessage({
            type: 'stroke-processed',
            data: {
                points: processedPoints,
                metrics: {
                    originalPoints: points.length,
                    processedPoints: processedPoints.length,
                    processingTime: performance.now() - startTime
                }
            }
        });

        // メトリクスの更新
        updateMetrics(startTime);

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

// ストロークの安定化処理
async function stabilizeStroke(points) {
    if (points.length < 2) return points;

    const stabilized = [];
    const windowSize = 3;
    const weight = 0.8;

    for (let i = 0; i < points.length; i++) {
        const window = points.slice(
            Math.max(0, i - windowSize),
            Math.min(points.length, i + windowSize + 1)
        );

        const averaged = window.reduce((acc, p) => ({
            x: acc.x + p.x / window.length,
            y: acc.y + p.y / window.length,
            pressure: acc.pressure + (p.pressure || 0) / window.length,
            tilt: {
                x: acc.tilt.x + (p.tilt?.x || 0) / window.length,
                y: acc.tilt.y + (p.tilt?.y || 0) / window.length
            }
        }), { x: 0, y: 0, pressure: 0, tilt: { x: 0, y: 0 } });

        stabilized.push({
            x: lerp(points[i].x, averaged.x, weight),
            y: lerp(points[i].y, averaged.y, weight),
            pressure: lerp(points[i].pressure || 1, averaged.pressure, weight),
            tilt: {
                x: lerp(points[i].tilt?.x || 0, averaged.tilt.x, weight),
                y: lerp(points[i].tilt?.y || 0, averaged.tilt.y, weight)
            }
        });
    }

    return stabilized;
}

// ストロークの単純化（Ramer-Douglas-Peucker アルゴリズム）
async function simplifyStroke(points, tolerance = 1.0) {
    if (points.length <= 2) return points;

    const key = `${points.map(p => `${p.x},${p.y}`).join('|')}-${tolerance}`;
    if (state.pointCache.has(key)) {
        return state.pointCache.get(key);
    }

    function findFurthest(start, end) {
        let maxDistance = 0;
        let index = 0;
        
        const line = {
            x1: points[start].x,
            y1: points[start].y,
            x2: points[end].x,
            y2: points[end].y
        };

        for (let i = start + 1; i < end; i++) {
            const distance = pointToLineDistance(points[i], line);
            if (distance > maxDistance) {
                maxDistance = distance;
                index = i;
            }
        }

        return { maxDistance, index };
    }

    function simplifySection(start, end) {
        const { maxDistance, index } = findFurthest(start, end);

        if (maxDistance > tolerance) {
            const r1 = simplifySection(start, index);
            const r2 = simplifySection(index, end);
            return [...r1.slice(0, -1), ...r2];
        }

        return [points[start], points[end]];
    }

    const simplified = simplifySection(0, points.length - 1);
    
    // キャッシュの管理
    if (state.pointCache.size >= state.maxCacheSize) {
        const firstKey = state.pointCache.keys().next().value;
        state.pointCache.delete(firstKey);
    }
    state.pointCache.set(key, simplified);

    return simplified;
}

// ストロークのスムージング（Catmull-Rom スプライン）
async function smoothStroke(points, tension = 0.5) {
    if (points.length < 4) return points;

    const smoothed = [];
    
    for (let i = 0; i < points.length - 3; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const p2 = points[i + 2];
        const p3 = points[i + 3];

        for (let t = 0; t < 1; t += 0.1) {
            const x = catmullRom(t, p0.x, p1.x, p2.x, p3.x, tension);
            const y = catmullRom(t, p0.y, p1.y, p2.y, p3.y, tension);
            const pressure = catmullRom(t, 
                p0.pressure || 1,
                p1.pressure || 1,
                p2.pressure || 1,
                p3.pressure || 1,
                tension
            );

            smoothed.push({
                x, y, pressure,
                tilt: {
                    x: catmullRom(t, 
                        p0.tilt?.x || 0,
                        p1.tilt?.x || 0,
                        p2.tilt?.x || 0,
                        p3.tilt?.x || 0,
                        tension
                    ),
                    y: catmullRom(t,
                        p0.tilt?.y || 0,
                        p1.tilt?.y || 0,
                        p2.tilt?.y || 0,
                        p3.tilt?.y || 0,
                        tension
                    )
                }
            });
        }
    }

    return smoothed;
}

// Catmull-Rom スプライン補間
function catmullRom(t, p0, p1, p2, p3, tension) {
    const t2 = t * t;
    const t3 = t2 * t;

    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

// 点と線分の距離を計算
function pointToLineDistance(point, line) {
    const { x1, y1, x2, y2 } = line;
    const { x, y } = point;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

// 線形補間
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// 筆圧の正規化
function normalizePressure(pressure) {
    return Math.max(0, Math.min(1, pressure || 1));
}

// 傾きの正規化
function normalizeTilt(tilt) {
    return {
        x: Math.max(-1, Math.min(1, tilt?.x || 0)),
        y: Math.max(-1, Math.min(1, tilt?.y || 0))
    };
}

// キャッシュのクリア
function clearCache() {
    state.strokeCache.clear();
    state.pointCache.clear();
    state.metrics.cachedStrokes = 0;
}

// メトリクスの更新
function updateMetrics(startTime) {
    state.metrics.processedStrokes++;
    state.metrics.cachedStrokes = state.strokeCache.size;
    state.metrics.processingTime += performance.now() - startTime;
}

// メトリクスの送信
function sendMetrics() {
    self.postMessage({
        type: 'metrics',
        data: { ...state.metrics }
    });
}

// キューの処理
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