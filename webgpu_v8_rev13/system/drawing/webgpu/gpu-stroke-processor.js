// ============================================================================
// gpu-stroke-processor.js
// WebGPU MSDF ポリゴンペン - EdgeBuffer生成・GPU転送
// ============================================================================
// 【親ファイル依存】
// - stroke-recorder.js (points配列取得)
// - webgpu-drawing-layer.js (device/queue)
// 
// 【子ファイル依存】
// - msdf-pipeline-manager.js (EdgeBuffer受け渡し)
// 
// 【責務】
// - stroke-recorder.points[] → EdgeBuffer変換
// - Winding Number計算（符号判定）
// - GPU StorageBuffer作成・転送
// ============================================================================

(function() {
  'use strict';

  class GPUStrokeProcessor {
    constructor() {
      this.device = null;
      this.initialized = false;
    }

    /**
     * 初期化
     * @param {GPUDevice} device 
     */
    async initialize(device) {
      if (!device) {
        throw new Error('[GPUStrokeProcessor] device is required');
      }
      this.device = device;
      this.initialized = true;
    }

    /**
     * points配列からEdgeBufferを生成
     * @param {Array} points - [x0,y0, x1,y1, ...] Local座標
     * @param {Object} options - { closed: boolean }
     * @returns {Float32Array} EdgeBuffer
     */
    createEdgeBuffer(points, options = {}) {
      if (!points || points.length < 4) {
        return new Float32Array(0);
      }

      const pointCount = points.length / 2;
      const closed = options.closed || false;
      const edgeCount = closed ? pointCount : pointCount - 1;

      // EdgeBuffer構造: [x0, y0, x1, y1, edgeId, channelId, insideFlag, padding]
      const buffer = new Float32Array(edgeCount * 8);

      // Winding計算
      const windingFlags = this._calculateWinding(points, closed);

      for (let i = 0; i < edgeCount; i++) {
        const idx0 = i * 2;
        const idx1 = ((i + 1) % pointCount) * 2;
        
        const x0 = points[idx0];
        const y0 = points[idx0 + 1];
        const x1 = points[idx1];
        const y1 = points[idx1 + 1];

        const bufferOffset = i * 8;
        buffer[bufferOffset + 0] = x0;
        buffer[bufferOffset + 1] = y0;
        buffer[bufferOffset + 2] = x1;
        buffer[bufferOffset + 3] = y1;
        buffer[bufferOffset + 4] = i; // edgeId
        buffer[bufferOffset + 5] = i % 3; // channelId (0=R, 1=G, 2=B)
        buffer[bufferOffset + 6] = windingFlags[i]; // insideFlag
        buffer[bufferOffset + 7] = 0; // padding
      }

      return buffer;
    }

    /**
     * EdgeBufferをGPU StorageBufferへアップロード
     * @param {Float32Array} edgeBuffer 
     * @returns {GPUBuffer}
     */
    uploadToGPU(edgeBuffer) {
      if (!this.initialized) {
        throw new Error('[GPUStrokeProcessor] Not initialized');
      }

      if (!edgeBuffer || edgeBuffer.length === 0) {
        return null;
      }

      const buffer = this.device.createBuffer({
        label: 'EdgeBuffer',
        size: edgeBuffer.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      this.device.queue.writeBuffer(buffer, 0, edgeBuffer);

      return buffer;
    }

    /**
     * Winding Number法による符号判定
     * @param {Array} points - [x0,y0, x1,y1, ...]
     * @param {boolean} closed 
     * @returns {Float32Array} insideFlags (-1 or +1 per edge)
     */
    _calculateWinding(points, closed) {
      const pointCount = points.length / 2;
      const edgeCount = closed ? pointCount : pointCount - 1;
      const flags = new Float32Array(edgeCount);

      // 簡易実装: 反時計回り = +1（内側）、時計回り = -1（外側）
      // Signed Area法で判定
      let signedArea = 0;
      for (let i = 0; i < pointCount; i++) {
        const idx0 = i * 2;
        const idx1 = ((i + 1) % pointCount) * 2;
        const x0 = points[idx0];
        const y0 = points[idx0 + 1];
        const x1 = points[idx1];
        const y1 = points[idx1 + 1];
        signedArea += (x1 - x0) * (y1 + y0);
      }

      // signedArea > 0 = 時計回り（外側）, < 0 = 反時計回り（内側）
      const windingSign = signedArea < 0 ? 1.0 : -1.0;

      // 全エッジに同じ符号を適用
      flags.fill(windingSign);

      return flags;
    }

    /**
     * リソース破棄
     */
    destroy() {
      this.device = null;
      this.initialized = false;
    }
  }

  // グローバル登録
  window.GPUStrokeProcessor = GPUStrokeProcessor;

})();