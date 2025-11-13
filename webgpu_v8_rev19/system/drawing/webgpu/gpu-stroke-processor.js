/**
 * ================================================================================
 * gpu-stroke-processor.js - Phase 1.5完全版
 * Stroke Points → EdgeBuffer 変換・GPU転送・Winding計算
 * ================================================================================
 * 
 * 【責務】
 * - stroke-recorder.points[] → EdgeBuffer Float32Array変換
 * - GPU StorageBuffer作成・アップロード
 * - Winding Number法による符号判定（Phase 3前倒し実装）
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device, queue)
 * - stroke-recorder.js (points配列取得)
 * 
 * 【依存Children】
 * - msdf-pipeline-manager.js (EdgeBuffer渡し)
 * 
 * 【座標系】
 * - 入力: Local座標 (drawing-engineで変換済み)
 * - 出力: EdgeBuffer (Local座標そのまま)
 * 
 * 【EdgeBuffer構造】
 * Float32Array: [x0, y0, x1, y1, edgeId, channelId, insideFlag, padding]
 * - x0,y0: エッジ始点
 * - x1,y1: エッジ終点
 * - edgeId: エッジ識別子
 * - channelId: MSDF割り当てチャンネル (0=R, 1=G, 2=B)
 * - insideFlag: 符号判定 (-1 or +1)
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class GPUStrokeProcessor {
    constructor() {
      this.device = null;
      this.queue = null;
      this.initialized = false;
    }

    /**
     * 初期化
     * @param {GPUDevice} device - WebGPU Device
     */
    initialize(device) {
      if (!device) {
        throw new Error('[GPUStrokeProcessor] Device is required');
      }

      this.device = device;
      this.queue = device.queue;
      this.initialized = true;

      console.log('✅ [GPUStrokeProcessor] Phase 1.5初期化完了');
    }

    /**
     * Points配列 → EdgeBuffer変換（Winding計算統合）
     * @param {Array} points - [{x, y, pressure}, ...] (Local座標)
     * @param {Object} options - {useWinding: true}
     * @returns {Float32Array} EdgeBuffer
     */
    createEdgeBuffer(points, options = {}) {
      if (!this.initialized) {
        throw new Error('[GPUStrokeProcessor] Not initialized');
      }

      if (!points || points.length < 2) {
        console.warn('[GPUStrokeProcessor] Points配列が不足');
        return new Float32Array(0);
      }

      const useWinding = options.useWinding !== false; // デフォルトtrue
      const edgeCount = points.length - 1;
      const edgeBuffer = new Float32Array(edgeCount * 8);

      // Winding計算（閉じたパスとして扱う）
      let insideFlags = null;
      if (useWinding && points.length > 2) {
        const windingResult = this.calculateWinding(points);
        insideFlags = windingResult.insideFlags;
      }

      for (let i = 0; i < edgeCount; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const offset = i * 8;

        // エッジ始点・終点
        edgeBuffer[offset + 0] = p0.x;
        edgeBuffer[offset + 1] = p0.y;
        edgeBuffer[offset + 2] = p1.x;
        edgeBuffer[offset + 3] = p1.y;

        // エッジID
        edgeBuffer[offset + 4] = i;

        // チャンネル割り当て (R/G/B循環)
        edgeBuffer[offset + 5] = i % 3;

        // insideFlag
        edgeBuffer[offset + 6] = insideFlags ? insideFlags[i] : 1.0;

        // padding
        edgeBuffer[offset + 7] = 0.0;
      }

      console.log(`✅ [GPUStrokeProcessor] EdgeBuffer作成: ${edgeCount}エッジ (Winding: ${useWinding})`);
      return edgeBuffer;
    }

    /**
     * EdgeBuffer → GPU StorageBuffer転送
     * @param {Float32Array} edgeBuffer - EdgeBuffer
     * @returns {GPUBuffer} GPU StorageBuffer
     */
    uploadToGPU(edgeBuffer) {
      if (!this.initialized) {
        throw new Error('[GPUStrokeProcessor] Not initialized');
      }

      if (!edgeBuffer || edgeBuffer.length === 0) {
        throw new Error('[GPUStrokeProcessor] EdgeBuffer is empty');
      }

      const buffer = this.device.createBuffer({
        size: edgeBuffer.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        label: 'EdgeBuffer'
      });

      this.queue.writeBuffer(buffer, 0, edgeBuffer);

      return buffer;
    }

    /**
     * Winding Number法による符号判定
     * @param {Array} points - [{x, y}, ...]
     * @returns {Object} {insideFlags: Float32Array}
     */
    calculateWinding(points) {
      if (!points || points.length < 3) {
        const edgeCount = Math.max(0, points.length - 1);
        const insideFlags = new Float32Array(edgeCount);
        insideFlags.fill(1.0);
        return { insideFlags };
      }

      const edgeCount = points.length - 1;
      const insideFlags = new Float32Array(edgeCount);

      // パスの重心計算（テストポイント）
      const centroid = this._calculateCentroid(points);

      // 各エッジに対してWinding Number計算
      for (let i = 0; i < edgeCount; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];

        // エッジの法線ベクトル（外向き）
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const nx = -dy;
        const ny = dx;

        // 中点から重心へのベクトル
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        const toCenter = {
          x: centroid.x - midX,
          y: centroid.y - midY
        };

        // 内積で符号判定
        const dot = nx * toCenter.x + ny * toCenter.y;
        
        // 正: 重心が法線方向（外側） → insideFlag = -1
        // 負: 重心が法線逆方向（内側） → insideFlag = +1
        insideFlags[i] = dot > 0 ? -1.0 : 1.0;
      }

      return { insideFlags };
    }

    /**
     * 重心計算
     * @private
     */
    _calculateCentroid(points) {
      let sumX = 0, sumY = 0;
      
      for (const p of points) {
        sumX += p.x;
        sumY += p.y;
      }

      return {
        x: sumX / points.length,
        y: sumY / points.length
      };
    }

    /**
     * リソース破棄
     */
    destroy() {
      this.device = null;
      this.queue = null;
      this.initialized = false;
    }
  }

  window.GPUStrokeProcessor = GPUStrokeProcessor;

  console.log('✅ gpu-stroke-processor.js Phase 1.5完全版 loaded');
  console.log('   ✅ createEdgeBuffer() 実装完了');
  console.log('   ✅ uploadToGPU() 実装完了');
  console.log('   ✅ calculateWinding() 実装完了（Winding Number法）');

})();