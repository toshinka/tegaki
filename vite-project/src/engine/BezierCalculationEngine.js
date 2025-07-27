// src/engine/BezierCalculationEngine.js

import { Bezier } from 'bezier-js'; [cite: 23]

export class BezierCalculationEngine {
    constructor() {
        this.config = { smoothing: 0.5, baseWidth: 2 }; [cite: 24]
        this.currentStroke = []; [cite: 24]
    }

    setToolConfig(config) {
        this.config = { ...this.config, ...config }; [cite: 25]
    }

    addPoint(x, y, pressure = 1.0) {
        this.currentStroke.push({ x, y, pressure }); [cite: 26]
        if (this.currentStroke.length < 3) return null;
        
        return this.calculateSegment(); [cite: 27]
    }

    calculateSegment() {
        if (this.currentStroke.length < 3) return null;

        const points = this.currentStroke;
        const p0 = points[points.length - 3];
        const p1 = points[points.length - 2];
        const p2 = points[points.length - 1];

        const p1_mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, pressure: (p0.pressure + p1.pressure) / 2 };
        const p2_mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, pressure: (p1.pressure + p2.pressure) / 2 };

        const bezier = new Bezier(p1_mid.x, p1_mid.y, p1.x, p1.y, p2_mid.x, p2_mid.y);
        const lut = bezier.getLUT(16);

        return {
            points: lut,
            widths: this.calculateWidths(lut, p1_mid, p2_mid) [cite: 28]
        };
    }
    
    finalizePath() {
        if (this.currentStroke.length === 0) return null; [cite: 29]
        const finalPath = this.calculateSegment();
        this.currentStroke = []; [cite: 30]
        return finalPath;
    }

    calculateWidths(points, startPoint, endPoint) {
        if (points.length === 0) return [];
        return points.map((p, i) => {
            const t = i / (points.length - 1);
            const interpolatedPressure = startPoint.pressure * (1 - t) + endPoint.pressure * t;
            const basePressure = interpolatedPressure || 1.0; [cite: 31]
            return Math.max(0.5, basePressure * this.config.baseWidth); [cite: 32]
        });
    }
}