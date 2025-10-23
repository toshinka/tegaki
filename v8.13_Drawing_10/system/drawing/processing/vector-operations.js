/**
 * VectorOperations - ストローク幾何演算ユーティリティ
 * Phase 0: 既存システムに依存しない純粋な数学関数
 */

class VectorOperations {
  /**
   * 2点間の距離を計算
   * @param {Object} p1 - {x, y}
   * @param {Object} p2 - {x, y}
   * @returns {number}
   */
  static distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 点と線分の最短距離を計算
   * @param {Object} point - {x, y}
   * @param {Object} segStart - {x, y}
   * @param {Object} segEnd - {x, y}
   * @returns {number}
   */
  static pointToSegmentDistance(point, segStart, segEnd) {
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      return this.distance(point, segStart);
    }
    
    let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    const closestPoint = {
      x: segStart.x + t * dx,
      y: segStart.y + t * dy
    };
    
    return this.distance(point, closestPoint);
  }

  /**
   * 円とストロークの交差判定
   * @param {Object} center - {x, y}
   * @param {number} radius
   * @param {Array} points - [{x, y, pressure?}, ...]
   * @returns {boolean}
   */
  static testCircleStrokeIntersection(center, radius, points) {
    if (!points || points.length < 2) return false;
    
    for (let i = 0; i < points.length - 1; i++) {
      const distance = this.pointToSegmentDistance(
        center,
        points[i],
        points[i + 1]
      );
      
      if (distance <= radius) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 円との交差でストロークを分割
   * @param {Array} points - [{x, y, pressure?}, ...]
   * @param {Object} center - {x, y}
   * @param {number} radius
   * @param {number} minLength - 最小セグメント長（これより短いセグメントは破棄）
   * @returns {Array} - 分割された複数のストローク配列 [ [{x,y},...], [{x,y},...], ... ]
   */
  static splitStrokeByCircle(points, center, radius, minLength = 5) {
    if (!points || points.length < 2) return [];
    
    const segments = [];
    let currentSegment = [];
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const distance = this.distance(center, point);
      const isInside = distance <= radius;
      
      if (isInside) {
        // 円の内側 → 現在のセグメントを保存して新規開始
        if (currentSegment.length >= 2) {
          const segmentLength = this.calculateStrokeLength(currentSegment);
          if (segmentLength >= minLength) {
            segments.push([...currentSegment]);
          }
        }
        currentSegment = [];
      } else {
        // 円の外側 → セグメントに追加
        currentSegment.push(point);
      }
    }
    
    // 最後のセグメントを保存
    if (currentSegment.length >= 2) {
      const segmentLength = this.calculateStrokeLength(currentSegment);
      if (segmentLength >= minLength) {
        segments.push(currentSegment);
      }
    }
    
    return segments;
  }

  /**
   * 複数の円でストロークを連続分割
   * @param {Array} points - [{x, y, pressure?}, ...]
   * @param {Array} circles - [{center: {x,y}, radius: number}, ...]
   * @param {number} minLength
   * @returns {Array}
   */
  static splitStrokeByCircles(points, circles, minLength = 5) {
    let segments = [points];
    
    for (const circle of circles) {
      const newSegments = [];
      
      for (const segment of segments) {
        const splits = this.splitStrokeByCircle(
          segment,
          circle.center,
          circle.radius,
          minLength
        );
        newSegments.push(...splits);
      }
      
      segments = newSegments;
      if (segments.length === 0) break;
    }
    
    return segments;
  }

  /**
   * ストロークの総長を計算
   * @param {Array} points - [{x, y}, ...]
   * @returns {number}
   */
  static calculateStrokeLength(points) {
    if (!points || points.length < 2) return 0;
    
    let length = 0;
    for (let i = 0; i < points.length - 1; i++) {
      length += this.distance(points[i], points[i + 1]);
    }
    
    return length;
  }

  /**
   * ストロークのバウンディングボックスを取得
   * @param {Array} points - [{x, y}, ...]
   * @returns {Object} - {x, y, width, height}
   */
  static getStrokeBounds(points) {
    if (!points || points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * 点がストローク上にあるかテスト（閾値付き）
   * @param {Object} point - {x, y}
   * @param {Array} points - [{x, y}, ...]
   * @param {number} threshold - 判定閾値
   * @returns {boolean}
   */
  static testPointInStroke(point, points, threshold = 5) {
    if (!points || points.length < 2) return false;
    
    for (let i = 0; i < points.length - 1; i++) {
      const distance = this.pointToSegmentDistance(
        point,
        points[i],
        points[i + 1]
      );
      
      if (distance <= threshold) {
        return true;
      }
    }
    
    return false;
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.VectorOperations = VectorOperations;