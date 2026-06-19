class Smooth {
    constructor(points, options = {}) {
        this.points = points;
        this.method = options.method || Smooth.METHOD_CUBIC;
        this.clip = options.clip || 'clamp';
        this.cubicTension = options.cubicTension || 0.5;
    }

    value(i, t) {
        const p0 = this.points[Math.max(0, i - 1)];
        const p1 = this.points[i];
        const p2 = this.points[i + 1];
        const p3 = this.points[Math.min(this.points.length - 1, i + 2)];

        const t2 = t * t;
        const t3 = t2 * t;

        const tension = this.cubicTension;

        const x =
            0.5 * ((-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3 +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + p2.x) * t +
                2 * p1.x);

        const y =
            0.5 * ((-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3 +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + p2.y) * t +
                2 * p1.y);

        const pressure = (p1.pressure + p2.pressure) / 2;

        return { x: x / 2, y: y / 2, pressure };
    }
}

Smooth.METHOD_CUBIC = 'cubic';
Smooth.CUBIC_TENSION_CATMULL_ROM = 0.5;
