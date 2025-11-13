/**
 * ================================================================================
 * gpu-stroke-processor.js - Phase 1完全版
 * Stroke Points → EdgeBuffer 変換・GPU転送
 * ================================================================================
 * 
 * 【責務】
 * - stroke-recorder.points[] → EdgeBuffer Float32Array変換
 * - GPU StorageBuffer作成・アップロード
 * - Winding計算（Phase 3で完全実装予定）
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
 * - insideFlag: 符号判定 (-1 or +1, Phase 3で実装)
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

      console.log('✅ [GPUStrokeProcessor] Phase 1初期化完了');
    }

    /**
     * Points配列 → EdgeBuffer変換
     * @param {Array} points - [{x, y, pressure}, ...] (Local座標)
     * @param {Object} options - {windingData: null} (Phase 3で使用)
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

      // エッジ数計算 (点数 - 1)
      const edgeCount = points.length - 1;
      const edgeBuffer = new Float32Array(edgeCount * 8); // 8要素/エッジ

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

        // insideFlag (Phase 3で実装、仮に+1)
        edgeBuffer[offset + 6] = 1.0;

        // padding
        edgeBuffer[offset + 7] = 0.0;
      }

      console.log(`✅ [GPUStrokeProcessor] EdgeBuffer作成: ${edgeCount}エッジ`);
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

      // StorageBuffer作成
      const buffer = this.device.createBuffer({
        size: edgeBuffer.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        label: 'EdgeBuffer'
      });

      // データ転送
      this.queue.writeBuffer(buffer, 0, edgeBuffer);

      console.log(`✅ [GPUStrokeProcessor] GPU転送完了: ${edgeBuffer.length}要素`);
      return buffer;
    }

    /**
     * Winding計算 (Phase 3で完全実装)
     * @param {Array} points - [{x, y}, ...]
     * @returns {Object} {insideFlags: Float32Array}
     */
    calculateWinding(points) {
      // Phase 3で実装予定
      console.warn('[GPUStrokeProcessor] calculateWinding() はPhase 3で実装');
      
      const edgeCount = points.length - 1;
      const insideFlags = new Float32Array(edgeCount);
      insideFlags.fill(1.0); // 仮に全て+1

      return { insideFlags };
    }

    /**
     * リソース破棄
     */
    destroy() {
      this.device = null;
      this.queue = null;
      this.initialized = false;
      console.log('🗑️ [GPUStrokeProcessor] 破棄完了');
    }
  }

  // グローバル公開
  window.GPUStrokeProcessor = GPUStrokeProcessor;

  console.log('✅ gpu-stroke-processor.js Phase 1完全版 loaded');
  console.log('   🔧 createEdgeBuffer() 実装完了');
  console.log('   🔧 uploadToGPU() 実装完了');
  console.log('   ⏳ calculateWinding() Phase 3実装予定');

})();