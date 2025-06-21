(function(global) {
  function Smooth(points, options) {
    options = options || {};
    this.points = points;
    this.method = options.method || Smooth.METHOD_CUBIC;
    this.clip = options.clip || 'clamp';
    this.cubicTension = options.cubicTension || 0.5;
  }

  Smooth.METHOD_CUBIC = 'cubic';

  Smooth.prototype.value = function(i, t) {
    var points = this.points;
    if (i < 0) i = 0;
    if (i >= points.length - 1) i = points.length - 2;
    var p0 = points[i > 0 ? i - 1 : i];
    var p1 = points[i];
    var p2 = points[i + 1];
    var p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    var t2 = t * t;
    var t3 = t2 * t;
    return {
      x: this._cubic(p0.x, p1.x, p2.x, p3.x, t, t2, t3),
      y: this._cubic(p0.y, p1.y, p2.y, p3.y, t, t2, t3),
      pressure: this._cubic(p0.pressure, p1.pressure, p2.pressure, p3.pressure, t, t2, t3)
    };
  };

  Smooth.prototype._cubic = function(p0, p1, p2, p3, t, t2, t3) {
    var tension = this.cubicTension;
    return (
      ((-tension * t3 + 2 * tension * t2 - tension * t) * p0) +
      ((2 - tension) * t3 + (tension - 3) * t2 + 1) * p1 +
      ((tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t) * p2 +
      (tension * t3 - tension * t2) * p3
    ) / 2;
  };

  global.Smooth = Smooth;
})(this);
