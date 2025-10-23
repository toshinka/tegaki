/**
 * StrokeDataManager - ストロークデータのCRUD・空間検索
 * Phase 1: ツール基盤の構築
 * 
 * 役割:
 * - ストロークデータの一元管理
 * - CRUD操作の提供
 * - 空間検索機能（将来QuadTree化予定）
 * 
 * EventBus発行:
 * - 'stroke:added' { id, strokeData }
 * - 'stroke:removed' { id }
 * - 'stroke:updated' { id, strokeData }
 * 
 * 依存: EventBus
 * 参考: system/layer-system.js
 */

class StrokeDataManager {
  /**
   * @param {Object} eventBus - EventBus インスタンス
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    // ストロークデータストア: Map<id, strokeData>
    this.strokes = new Map();
    
    // ID生成用カウンター
    this.nextId = 1;
  }

  /**
   * ストロークデータ追加
   * 
   * @param {Object} strokeData - ストロークデータ
   * @returns {string} 生成されたID
   */
  addStroke(strokeData) {
    const id = `stroke_${this.nextId++}`;
    
    const stroke = {
      id,
      ...strokeData,
      createdAt: Date.now()
    };
    
    this.strokes.set(id, stroke);
    
    // イベント発行
    if (this.eventBus) {
      this.eventBus.emit('stroke:added', { id, strokeData: stroke });
    }
    
    return id;
  }

  /**
   * ストローク削除
   * 
   * @param {string} id
   * @returns {boolean} 成功時 true
   */
  removeStroke(id) {
    if (!this.strokes.has(id)) {
      return false;
    }
    
    this.strokes.delete(id);
    
    // イベント発行
    if (this.eventBus) {
      this.eventBus.emit('stroke:removed', { id });
    }
    
    return true;
  }

  /**
   * ストローク更新
   * 
   * @param {string} id
   * @param {Object} strokeData - 更新するデータ
   * @returns {boolean} 成功時 true
   */
  updateStroke(id, strokeData) {
    if (!this.strokes.has(id)) {
      return false;
    }
    
    const existing = this.strokes.get(id);
    const updated = {
      ...existing,
      ...strokeData,
      id, // IDは変更不可
      updatedAt: Date.now()
    };
    
    this.strokes.set(id, updated);
    
    // イベント発行
    if (this.eventBus) {
      this.eventBus.emit('stroke:updated', { id, strokeData: updated });
    }
    
    return true;
  }

  /**
   * ストローク取得
   * 
   * @param {string} id
   * @returns {Object|null}
   */
  getStroke(id) {
    return this.strokes.get(id) || null;
  }

  /**
   * 全ストローク取得
   * 
   * @returns {Object[]}
   */
  getAllStrokes() {
    return Array.from(this.strokes.values());
  }

  /**
   * 境界ボックス内のストローク検索（簡易実装）
   * Phase 6でQuadTree化予定
   * 
   * @param {Object} bounds - { x, y, width, height }
   * @returns {string[]} ストロークID配列
   */
  findStrokesInBounds(bounds) {
    const result = [];
    
    for (const [id, stroke] of this.strokes) {
      if (this._strokeIntersectsBounds(stroke, bounds)) {
        result.push(id);
      }
    }
    
    return result;
  }

  /**
   * 円形範囲内のストローク検索（簡易実装）
   * Phase 4: 消しゴムツールで使用
   * 
   * @param {Object} center - { x, y }
   * @param {number} radius
   * @returns {string[]} ストロークID配列
   */
  findStrokesInRadius(center, radius) {
    const result = [];
    const radiusSq = radius * radius;
    
    for (const [id, stroke] of this.strokes) {
      if (this._strokeIntersectsCircle(stroke, center, radiusSq)) {
        result.push(id);
      }
    }
    
    return result;
  }

  /**
   * ストローク数取得
   * 
   * @returns {number}
   */
  getStrokeCount() {
    return this.strokes.size;
  }

  /**
   * 全ストローククリア
   */
  clear() {
    this.strokes.clear();
    this.nextId = 1;
    
    if (this.eventBus) {
      this.eventBus.emit('stroke:cleared');
    }
  }

  /**
   * ストロークが境界ボックスと交差するか判定（内部用）
   * 
   * @private
   * @param {Object} stroke
   * @param {Object} bounds
   * @returns {boolean}
   */
  _strokeIntersectsBounds(stroke, bounds) {
    if (!stroke.points || stroke.points.length === 0) {
      return false;
    }
    
    // 簡易判定: いずれかの点が境界内にあるか
    for (const point of stroke.points) {
      if (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      ) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * ストロークが円と交差するか判定（内部用）
   * 
   * @private
   * @param {Object} stroke
   * @param {Object} center
   * @param {number} radiusSq - 半径の二乗
   * @returns {boolean}
   */
  _strokeIntersectsCircle(stroke, center, radiusSq) {
    if (!stroke.points || stroke.points.length === 0) {
      return false;
    }
    
    // 簡易判定: いずれかの点が円内にあるか
    for (const point of stroke.points) {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq <= radiusSq) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * バッチ削除（Phase 6で実装予定）
   * 
   * @param {string[]} ids
   * @returns {number} 削除数
   */
  batchRemove(ids) {
    let count = 0;
    
    for (const id of ids) {
      if (this.removeStroke(id)) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * バッチ追加（Phase 6で実装予定）
   * 
   * @param {Object[]} strokeDataArray
   * @returns {string[]} 生成されたID配列
   */
  batchAdd(strokeDataArray) {
    const ids = [];
    
    for (const strokeData of strokeDataArray) {
      const id = this.addStroke(strokeData);
      ids.push(id);
    }
    
    return ids;
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeDataManager = StrokeDataManager;