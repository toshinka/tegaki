// stroke-worker-v2-0.js
class TegakiStrokeWorker {
    constructor() {
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 10:28:02';
        
        // ワーカーの設定
        this.settings = {
            maxPoints: 1000,
            minDistance: 0.1,
            maxDistance: 100,
            smoothing: 0.5,
            pressureScale: 1.0,
            tiltInfluence: 0.3
        };

        // 処理状態
        this.state = {
            isProcessing: false,
            currentBrush: null,
            points: []
        };

        // メッセージハンドラの設定
        self.onmessage = this.handleMessage.bind(this);
    }

    handleMessage(e) {
        const { type, points, brush, settings } = e.data;

        try {
            switch (type) {
                case 'init':
                    this.settings = { ...this.settings, ...settings };
                    self.postMessage({ type: 'init', success: true });
                    break;

                case 'process':
                    if (!points || !brush) {
                        throw new Error('Invalid stroke data');
                    }

                    const segments = this.processStroke(points, brush);
                    self.postMessage({
                        type: 'process',
                        segments: segments
                    });
                    break;

                default:
                    throw new Error(`Unknown message type: ${type}`);
            }
        } catch (error) {
            self.postMessage({
                type: 'error',
                error: error.message
            });
        }
    }

    processStroke(points, brush) {
        if (points.length < 2) {
            return this.createSinglePointSegment(points[0], brush);
        }

        // ストロークの補間とスムージング
        const smoothedPoints = this.smoothPoints(points);
        
        // セグメントの生成
        return this.generateSegments(smoothedPoints, brush);
    }

    smoothPoints(points) {
        if (points.length < 3) return points;

        const smoothed = [];
        const weight = this.settings.smoothing;

        // 最初のポイントは保持
        smoothed.push(points[0]);

        // 中間ポイントのスムージング
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];

            smoothed.push({
                x: curr.x * (1 - weight) + (prev.x + next.x) * 0.5 * weight,
                y: curr.y * (1 - weight) + (prev.y + next.y) * 0.5 * weight,
                pressure: curr.pressure * (1 - weight) + 
                    (prev.pressure + next.pressure) * 0.5 * weight,
                tilt: {
                    x: curr.tilt.x * (1 - weight) + 
                        (prev.tilt.x + next.tilt.x) * 0.5 * weight,
                    y: curr.tilt.y * (1 - weight) + 
                        (prev.tilt.y + next.tilt.y) * 0.5 * weight
                },
                timestamp: curr.timestamp
            });
        }

        // 最後のポイントは保持
        smoothed.push(points[points.length - 1]);

        return smoothed;
    }

    generateSegments(points, brush) {
        const segments = [];
        const spacing = brush.spacing * brush.size;

        let distance = 0;
        let lastSegment = null;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];

            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            if (len < this.settings.minDistance) continue;

            // セグメントの生成
            while (distance < len) {
                const t = distance / len;
                const x = prev.x + dx * t;
                const y = prev.y + dy * t;
                const pressure = prev.pressure + 
                    (curr.pressure - prev.pressure) * t;
                const tiltX = prev.tilt.x + 
                    (curr.tilt.x - prev.tilt.x) * t;
                const tiltY = prev.tilt.y + 
                    (curr.tilt.y - prev.tilt.y) * t;

                // スケールの計算
                const scale = this.calculateScale(
                    brush,
                    pressure,
                    { x: tiltX, y: tiltY }
                );

                const segment = {
                    x,
                    y,
                    scale,
                    pressure,
                    tilt: { x: tiltX, y: tiltY }
                };

                if (lastSegment) {
                    const overlap = this.calculateOverlap(lastSegment, segment);
                    if (overlap < 0.98) {
                        segments.push(segment);
                        lastSegment = segment;
                    }
                } else {
                    segments.push(segment);
                    lastSegment = segment;
                }

                distance += spacing;
            }

            distance -= len;
        }

        return segments;
    }

    createSinglePointSegment(point, brush) {
        const scale = this.calculateScale(
            brush,
            point.pressure,
            point.tilt
        );

        return [{
            x: point.x,
            y: point.y,
            scale,
            pressure: point.pressure,
            tilt: point.tilt
        }];
    }

    calculateScale(brush, pressure, tilt) {
        // 基本スケール
        let scale = brush.size;

        // 筆圧の影響
        scale *= 1.0 + (pressure - 1.0) * this.settings.pressureScale;

        // ペンの傾きの影響
        const tiltMagnitude = Math.sqrt(tilt.x * tilt.x + tilt.y * tilt.y);
        scale *= 1.0 + tiltMagnitude * this.settings.tiltInfluence;

        return Math.max(
            this.settings.minDistance,
            Math.min(scale, this.settings.maxDistance)
        );
    }

    calculateOverlap(seg1, seg2) {
        const dx = seg2.x - seg1.x;
        const dy = seg2.y - seg1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxScale = Math.max(seg1.scale, seg2.scale);

        return distance / maxScale;
    }

    dispose() {
        // 状態のリセット
        this.settings = null;
        this.state = null;
    }
}

// ワーカーのインスタンス化
const worker = new TegakiStrokeWorker();