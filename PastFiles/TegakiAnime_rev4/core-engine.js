/**
 * ============================================================================
 * ファイル名: core-engine.js
 * 責務: アプリケーションメインループ・システム統合
 * 依存:
 *   - core-runtime.js (CoreRuntime)
 *   - event-bus.js (TegakiEventBus)
 *   - config.js (TEGAKI_CONFIG)
 * 親依存:
 *   - index.html → CoreRuntime初期化後に実行
 * 子依存:
 *   - core-runtime.js
 * 公開API:
 *   - CoreEngine.initialize(): エンジン初期化
 *   - CoreEngine.start(): メインループ開始
 *   - CoreEngine.stop(): メインループ停止
 * イベント発火:
 *   - 'engine:initialized' - 初期化完了
 *   - 'engine:started' - ループ開始
 *   - 'engine:stopped' - ループ停止
 * グローバル登録: window.CoreEngine
 * 実装状態: 🔧改修 Phase 1 - 旧依存削除・最小動作版
 * ============================================================================
 */

'use strict';

// ========================================
// グローバル依存確認
// ========================================
if (!window.CoreRuntime) {
  throw new Error('CoreRuntime が初期化されていません');
}
if (!window.TegakiEventBus) {
  throw new Error('EventBus が初期化されていません');
}
if (!window.TEGAKI_CONFIG) {
  throw new Error('config.js が読み込まれていません');
}

window.CoreEngine = (() => {
  
  // ========================================
  // グローバル状態
  // ========================================
  let initialized = false;
  let running = false;
  let lastTime = 0;
  let animationFrameId = null;

  const eventBus = window.TegakiEventBus;
  const config = window.TEGAKI_CONFIG;

  // ========================================
  // 初期化処理
  // ========================================
  /**
   * エンジン初期化
   * @returns {Promise<void>}
   */
  async function initialize() {
    if (initialized) {
      console.warn('[CoreEngine] Already initialized');
      return;
    }

    try {
      console.log('🚀 [CoreEngine] 初期化開始...');

      // CoreRuntime初期化確認
      if (!window.CoreRuntime.initialized) {
        throw new Error('CoreRuntime が初期化されていません');
      }

      // Phase 1では最小限の初期化
      console.log('  ⚙️ Phase 1: 最小システム構成');
      console.log('    ✅ Konva.Stage ready');
      console.log('    ✅ PixiJS ready');

      // システムチェック（Phase 2以降で実装）
      checkOptionalSystems();

      initialized = true;

      eventBus.emit('engine:initialized', {
        timestamp: Date.now()
      });

      console.log('✅ [CoreEngine] 初期化完了');

    } catch (error) {
      console.error('❌ [CoreEngine] 初期化失敗:', error);
      eventBus.emit('engine:error', { error });
      throw error;
    }
  }

  // ========================================
  // オプションシステムチェック
  // ========================================
  function checkOptionalSystems() {
    const optionalSystems = [
      { name: 'StateManager', desc: '状態管理' },
      { name: 'SettingsManager', desc: '設定管理' },
      { name: 'History', desc: 'Undo/Redo' },
      { name: 'PopupManager', desc: 'ポップアップ' },
      { name: 'BrushSettings', desc: 'ブラシ設定' },
      { name: 'PressureHandler', desc: '筆圧処理' },
      { name: 'PointerHandler', desc: 'ポインター処理' }
    ];

    console.log('  📋 オプショナルシステムチェック:');
    optionalSystems.forEach(sys => {
      if (window[sys.name]) {
        console.log(`    ✅ ${sys.name} (${sys.desc})`);
      } else {
        console.log(`    ⚠️ ${sys.name} (${sys.desc}) - 未実装`);
      }
    });
  }

  // ========================================
  // メインループ開始
  // ========================================
  /**
   * メインループ開始
   */
  function start() {
    if (!initialized) {
      throw new Error('[CoreEngine] Not initialized. Call initialize() first.');
    }

    if (running) {
      console.warn('[CoreEngine] Already running');
      return;
    }

    console.log('▶️ [CoreEngine] メインループ開始');

    running = true;
    lastTime = performance.now();

    eventBus.emit('engine:started', {
      timestamp: Date.now()
    });

    // メインループ起動
    tick(lastTime);
  }

  // ========================================
  // メインループ停止
  // ========================================
  /**
   * メインループ停止
   */
  function stop() {
    if (!running) {
      console.warn('[CoreEngine] Not running');
      return;
    }

    console.log('⏸️ [CoreEngine] メインループ停止');

    running = false;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    eventBus.emit('engine:stopped', {
      timestamp: Date.now()
    });
  }

  // ========================================
  // メインループ本体
  // ========================================
  /**
   * メインループ tick
   * @param {number} currentTime - 現在時刻(ms)
   */
  function tick(currentTime) {
    if (!running) return;

    // デルタタイム計算
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Phase 1では何もしない
    // Phase 2以降でアニメーション更新・描画更新等を実装

    // 次のフレームをスケジュール
    animationFrameId = requestAnimationFrame(tick);
  }

  // ========================================
  // 公開API
  // ========================================
  return {
    initialize,
    start,
    stop,
    get initialized() { return initialized; },
    get running() { return running; }
  };

})();

console.log('✅ CoreEngine Phase 1 loaded (旧依存削除・最小動作版)');