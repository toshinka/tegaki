/**
 * WebGPU Render Coordinator
 * 
 * 依存: webgpu-capabilities.js, event-bus.js
 * 親: core-engine.js
 * 責務: WebGPU/Pixiレンダリング順序の一元管理、GPU占有競合の解決
 * 
 * アーキテクチャ:
 * - WebGPU: マスターレンダラー (描画処理)
 * - Pixi: スレーブレンダラー (UI表示)
 * - レンダーループ統合: requestAnimationFrame → WebGPU render → Pixi render
 */

class WebGPURenderCoordinator {
  constructor() {
    this.rafId = null;
    this.isRendering = false;
    this.pixiApp = null;
    this.webgpuContext = null;
    
    // レンダリング統計
    this.stats = {
      frameCount: 0,
      lastFrameTime: 0,
      fps: 0
    };
    
    // Phase管理
    this.renderPhases = {
      webgpu: null,  // WebGPU描画フェーズ
      pixi: null     // Pixi UI描画フェーズ
    };
  }

  /**
   * 初期化: WebGPUコンテキストとPixiアプリを登録
   */
  initialize(webgpuContext, pixiApp) {
    if (!webgpuContext?.device) {
      throw new Error('[RenderCoordinator] WebGPU context required');
    }
    
    this.webgpuContext = webgpuContext;
    this.pixiApp = pixiApp;
    
    // Pixiの自動tickerを停止 (マニュアル制御に切り替え)
    if (this.pixiApp.ticker) {
      this.pixiApp.ticker.stop();
    }
    
    // EventBus登録
    window.eventBus?.on('render:request', () => this.requestFrame());
    window.eventBus?.on('render:pause', () => this.pause());
    window.eventBus?.on('render:resume', () => this.resume());
    
    console.log('[RenderCoordinator] Initialized - WebGPU master, Pixi slave');
  }

  /**
   * WebGPU描画フェーズコールバックを登録
   */
  setWebGPURenderPhase(callback) {
    this.renderPhases.webgpu = callback;
  }

  /**
   * Pixi描画フェーズコールバックを登録 (オプション)
   */
  setPixiRenderPhase(callback) {
    this.renderPhases.pixi = callback;
  }

  /**
   * レンダーループ開始
   */
  start() {
    if (this.isRendering) return;
    
    this.isRendering = true;
    this.stats.lastFrameTime = performance.now();
    this._renderLoop();
    
    console.log('[RenderCoordinator] Render loop started');
  }

  /**
   * レンダーループ停止
   */
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isRendering = false;
    
    console.log('[RenderCoordinator] Render loop stopped');
  }

  /**
   * 一時停止
   */
  pause() {
    this.isRendering = false;
  }

  /**
   * 再開
   */
  resume() {
    if (!this.isRendering) {
      this.isRendering = true;
      this._renderLoop();
    }
  }

  /**
   * フレームリクエスト (外部から明示的に描画要求)
   */
  requestFrame() {
    if (!this.isRendering) {
      this._renderLoop();
    }
  }

  /**
   * 統合レンダーループ
   * Priority: WebGPU → Pixi
   */
  _renderLoop() {
    if (!this.isRendering) return;

    const now = performance.now();
    const delta = now - this.stats.lastFrameTime;
    
    // FPS計算 (デバッグ用)
    this.stats.frameCount++;
    if (delta > 0) {
      this.stats.fps = 1000 / delta;
    }
    this.stats.lastFrameTime = now;

    try {
      // Phase 1: WebGPU描画 (マスター)
      if (this.renderPhases.webgpu) {
        this.renderPhases.webgpu(delta);
      }

      // Phase 2: Pixi UI描画 (スレーブ)
      // WebGPU描画完了後に実行することでGPU競合を回避
      if (this.pixiApp?.renderer) {
        if (this.renderPhases.pixi) {
          this.renderPhases.pixi(delta);
        }
        // Pixi手動レンダリング
        this.pixiApp.renderer.render(this.pixiApp.stage);
      }

    } catch (error) {
      console.error('[RenderCoordinator] Render error:', error);
      window.eventBus?.emit('render:error', { error });
    }

    // 次フレーム予約
    this.rafId = requestAnimationFrame(() => this._renderLoop());
  }

  /**
   * レンダリング統計取得
   */
  getStats() {
    return {
      ...this.stats,
      isRendering: this.isRendering
    };
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.stop();
    this.renderPhases = { webgpu: null, pixi: null };
    this.pixiApp = null;
    this.webgpuContext = null;
    
    window.eventBus?.off('render:request');
    window.eventBus?.off('render:pause');
    window.eventBus?.off('render:resume');
  }
}

// グローバル登録
window.WebGPURenderCoordinator = WebGPURenderCoordinator;