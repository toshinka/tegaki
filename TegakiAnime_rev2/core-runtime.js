/**
 * ============================================================================
 * ファイル名: core-runtime.js
 * 責務: アプリケーション初期化・グローバル統合管理
 * 依存:
 *   - konva (外部ライブラリ - libs/konva.min.js)
 *   - pixi.js (外部ライブラリ - libs/pixi.min.js)
 *   - ui-components.js (UIComponents)
 *   - config.js (TEGAKI_CONFIG, TEGAKI_KEYMAP)
 *   - event-bus.js (TegakiEventBus)
 * 親依存:
 *   - index.html → このファイルを参照
 * 子依存:
 *   - このファイルは全システムファイルを初期化
 * 公開API:
 *   - CoreRuntime.initialize(): アプリケーション初期化
 *   - CoreRuntime.shutdown(): クリーンアップ
 * イベント発火:
 *   - 'runtime:initialized' - 初期化完了
 *   - 'runtime:error' - 初期化エラー
 * グローバル登録: window.CoreRuntime
 * 実装状態: 🆕新規
 * ============================================================================
 */

'use strict';

// グローバル依存確認
if (!window.Konva) {
  throw new Error('Konva.js が読み込まれていません');
}
if (!window.PIXI) {
  throw new Error('PixiJS が読み込まれていません');
}
if (!window.UIComponents) {
  throw new Error('UIComponents が読み込まれていません');
}
if (!window.TEGAKI_CONFIG) {
  throw new Error('config.js が読み込まれていません');
}
if (!window.TegakiEventBus) {
  throw new Error('EventBus が読み込まれていません');
}

window.CoreRuntime = (() => {
  
  // ========================================
  // グローバル状態
  // ========================================
  let initialized = false;
  let konvaStage = null;
  let pixiApp = null;

  // ========================================
  // 初期化処理
  // ========================================
  /**
   * アプリケーション初期化
   * @returns {Promise<void>}
   */
  async function initialize() {
    if (initialized) {
      console.warn('[CoreRuntime] Already initialized');
      return;
    }

    try {
      console.log('🎬 [CoreRuntime] 初期化開始...');

      // ステップ1: DOM構築
      await initializeDOM();

      // ステップ2: Konva.Stage初期化
      await initializeKonvaStage();

      // ステップ3: PixiJS初期化（WebGL2ラスター描画用）
      await initializePixiApp();

      // ステップ4: システム初期化
      await initializeSystems();

      // ステップ5: UI初期化
      await initializeUI();

      // ステップ6: イベントハンドラー登録
      registerEventHandlers();

      initialized = true;

      window.TegakiEventBus.emit('runtime:initialized', {
        konvaStage,
        pixiApp
      });

      console.log('✅ [CoreRuntime] 初期化完了');

    } catch (error) {
      console.error('❌ [CoreRuntime] 初期化失敗:', error);
      window.TegakiEventBus.emit('runtime:error', { error });
      throw error;
    }
  }

  // ========================================
  // DOM構築
  // ========================================
  async function initializeDOM() {
    console.log('  📄 DOM構築中...');

    const app = document.getElementById('app');
    if (!app) {
      throw new Error('#app要素が見つかりません');
    }

    // ToonSquid風レイアウト
    app.innerHTML = `
      <div class="main-layout">
        <!-- サイドバー -->
        <div class="sidebar" id="sidebar">
          <!-- ツールボタンはui-panels.jsで生成 -->
        </div>

        <!-- キャンバスエリア -->
        <div class="canvas-area" id="canvas-area">
          <div id="konva-container"></div>
        </div>
      </div>

      <!-- レイヤーパネル（右側） -->
      <div class="layer-panel-container" id="layer-panel-container">
        <!-- layer-panel.jsで生成 -->
      </div>

      <!-- タイムラインパネル（下部） -->
      <div class="timeline-panel" id="timeline-panel">
        <!-- timeline-panel.jsで生成 -->
      </div>
    `;

    console.log('  ✅ DOM構築完了');
  }

  // ========================================
  // Konva.Stage初期化
  // ========================================
  async function initializeKonvaStage() {
    console.log('  🎨 Konva.Stage初期化中...');

    const container = document.getElementById('konva-container');
    if (!container) {
      throw new Error('#konva-container要素が見つかりません');
    }

    const canvasArea = document.getElementById('canvas-area');
    const width = canvasArea.clientWidth;
    const height = canvasArea.clientHeight;

    konvaStage = new Konva.Stage({
      container: 'konva-container',
      width: width,
      height: height,
      draggable: false
    });

    // 背景レイヤー作成（checker pattern）
    const bgLayer = new Konva.Layer({ id: 'bg-layer' });
    
    // チェッカーパターン生成
    const checkerSize = 20;
    const checker = new Konva.Rect({
      x: 0,
      y: 0,
      width: width,
      height: height,
      fillPatternImage: createCheckerPattern(checkerSize),
      fillPatternRepeat: 'repeat'
    });
    
    bgLayer.add(checker);
    konvaStage.add(bgLayer);

    // 描画グループ（レイヤー管理用）
    const drawingGroup = new Konva.Group({
      id: 'drawing-group',
      draggable: false
    });
    konvaStage.add(drawingGroup);

    // UIレイヤー（選択枠等）
    const uiLayer = new Konva.Layer({ id: 'ui-layer' });
    konvaStage.add(uiLayer);

    // グローバル登録
    window.konvaStage = konvaStage;

    // リサイズ対応
    window.addEventListener('resize', () => {
      const newWidth = canvasArea.clientWidth;
      const newHeight = canvasArea.clientHeight;
      konvaStage.width(newWidth);
      konvaStage.height(newHeight);
      
      // 背景も更新
      checker.width(newWidth);
      checker.height(newHeight);
      
      bgLayer.batchDraw();
    });

    console.log('  ✅ Konva.Stage初期化完了:', {
      width,
      height,
      layers: konvaStage.getLayers().length
    });
  }

  // ========================================
  // チェッカーパターン生成
  // ========================================
  function createCheckerPattern(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');

    // 明るい色
    ctx.fillStyle = window.UIComponents.UI_COLORS.cream;
    ctx.fillRect(0, 0, size * 2, size * 2);

    // 暗い色
    ctx.fillStyle = window.UIComponents.UI_COLORS.lightMedium;
    ctx.fillRect(0, 0, size, size);
    ctx.fillRect(size, size, size, size);

    return canvas;
  }

  // ========================================
  // PixiJS初期化（WebGL2ラスター描画用）
  // ========================================
  async function initializePixiApp() {
    console.log('  🖌️ PixiJS初期化中...');

    const config = window.TEGAKI_CONFIG;

    pixiApp = new PIXI.Application();
    await pixiApp.init({
      width: config.canvas.width,
      height: config.canvas.height,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: 'webgl2'
    });

    // グローバル登録
    window.pixiApp = pixiApp;

    console.log('  ✅ PixiJS初期化完了:', {
      renderer: pixiApp.renderer.type,
      width: pixiApp.renderer.width,
      height: pixiApp.renderer.height
    });
  }

  // ========================================
  // システム初期化
  // ========================================
  async function initializeSystems() {
    console.log('  ⚙️ システム初期化中...');

    // 各システムの初期化は各ファイルで自動実行される想定
    // ここでは依存チェックのみ

    const requiredSystems = [
      'StateManager',
      'SettingsManager',
      'History',
      'CameraSystem',
      'PopupManager'
    ];

    for (const system of requiredSystems) {
      if (!window[system]) {
        console.warn(`  ⚠️ ${system} が見つかりません（未実装の可能性）`);
      }
    }

    console.log('  ✅ システム初期化完了');
  }

  // ========================================
  // UI初期化
  // ========================================
  async function initializeUI() {
    console.log('  🎨 UI初期化中...');

    // UI初期化は各UIファイルで自動実行される想定
    const requiredUI = [
      'LayerPanel',
      'TimelinePanel',
      'KeyboardHandler'
    ];

    for (const ui of requiredUI) {
      if (!window[ui]) {
        console.warn(`  ⚠️ ${ui} が見つかりません（未実装の可能性）`);
      }
    }

    console.log('  ✅ UI初期化完了');
  }

  // ========================================
  // イベントハンドラー登録
  // ========================================
  function registerEventHandlers() {
    console.log('  🔗 イベントハンドラー登録中...');

    // ウィンドウ全体のエラーハンドリング
    window.addEventListener('error', (event) => {
      console.error('[CoreRuntime] Global error:', event.error);
      window.TegakiEventBus.emit('runtime:error', {
        error: event.error,
        message: event.message
      });
    });

    // 未処理のPromiseリジェクション
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[CoreRuntime] Unhandled promise rejection:', event.reason);
      window.TegakiEventBus.emit('runtime:error', {
        error: event.reason
      });
    });

    console.log('  ✅ イベントハンドラー登録完了');
  }

  // ========================================
  // クリーンアップ
  // ========================================
  function shutdown() {
    console.log('🛑 [CoreRuntime] シャットダウン中...');

    if (konvaStage) {
      konvaStage.destroy();
      konvaStage = null;
    }

    if (pixiApp) {
      pixiApp.destroy(true);
      pixiApp = null;
    }

    window.TegakiEventBus.clear();

    initialized = false;

    console.log('✅ [CoreRuntime] シャットダウン完了');
  }

  // ========================================
  // 公開API
  // ========================================
  return {
    initialize,
    shutdown,
    get initialized() { return initialized; },
    get konvaStage() { return konvaStage; },
    get pixiApp() { return pixiApp; }
  };

})();

console.log('✅ CoreRuntime loaded');