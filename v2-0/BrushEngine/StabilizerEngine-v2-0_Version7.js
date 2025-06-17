class TegakiStabilizer {
    constructor(weight = 0.8) {
        this.weight = Math.max(0, Math.min(1, weight));
        this.currentPoint = null;
        this.smoothedPoint = null;
    }

    reset() {
        this.currentPoint = null;
        this.smoothedPoint = null;
    }

    update(point) {
        if (!this.currentPoint) {
            this.currentPoint = { ...point };
            this.smoothedPoint = { ...point };
            return this.smoothedPoint;
        }

        // 位置の補間
        this.smoothedPoint.x += (point.x - this.smoothedPoint.x) * (1 - this.weight);
        this.smoothedPoint.y += (point.y - this.smoothedPoint.y) * (1 - this.weight);

        // 筆圧の補間
        if (point.pressure !== undefined) {
            this.smoothedPoint.pressure = this.smoothedPoint.pressure || point.pressure;
            this.smoothedPoint.pressure += (point.pressure - this.smoothedPoint.pressure) * (1 - this.weight);
        }

        // 傾きの補間
        if (point.tilt) {
            this.smoothedPoint.tilt = this.smoothedPoint.tilt || { x: 0, y: 0 };
            this.smoothedPoint.tilt.x += (point.tilt.x - this.smoothedPoint.tilt.x) * (1 - this.weight);
            this.smoothedPoint.tilt.y += (point.tilt.y - this.smoothedPoint.tilt.y) * (1 - this.weight);
        }

        this.currentPoint = { ...point };
        return { ...this.smoothedPoint };
    }

    end(point) {
        return point;
    }

    dispose() {
        this.currentPoint = null;
        this.smoothedPoint = null;
    }
}