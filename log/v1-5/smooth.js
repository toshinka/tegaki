class Smooth {
  constructor(points, options = {}) {
    this.points = points;
    this.method = options.method || Smooth.METHOD_CUBIC;
    this.clip = options.clip || 'clamp';
    this.cubicTension = options.cubicTension || 0.5; // Catmull-Rom tension
  }

  value(i, t) {
    // 描画に必要なポイント数が足りない場合は最初の点を返す
    if (this.points.length < 2) {
      return this.points.length ? this.points[0] : { x: 0, y: 0, pressure: 0 };
    }

    // Catmull-Romスプライン補間に必要な4つの制御点を取得
    // 配列の範囲外にならないようにインデックスを調整
    const p0 = this.points[Math.max(0, i - 1)];
    const p1 = this.points[i];
    const p2 = this.points[Math.min(this.points.length - 1, i + 1)];
    const p3 = this.points[Math.min(this.points.length - 1, i + 2)];

    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Romスプライン補間の計算式
    const x =
      0.5 *
      ((-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3 +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + p2.x) * t +
        2 * p1.x);

    const y =
      0.5 *
      ((-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3 +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + p2.y) * t +
        2 * p1.y);

    // 筆圧はp1とp2の間で線形補間する
    const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
    
    // ★★★ 修正点 ★★★
    // 以前のコードでは、ここで計算結果の x, y をさらに2で割っていましたが、
    // それが座標ズレ（放射状になる不具合）の原因でした。
    // Catmull-Romの計算式(0.5 * ...)に既に割り算が含まれているため、不要な処理を削除しました。
    return { x: x, y: y, pressure: pressure };
  }
}

Smooth.METHOD_CUBIC = 'cubic';
Smooth.CUBIC_TENSION_CATMULL_ROM = 0.5;