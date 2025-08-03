/**
 * モダンお絵かきツール - メインエントリーポイント
 * Phase2: 高性能描画エンジン
 */

// Core PIXI.js v8 Engine
import { PixiV8UnifiedRenderer } from './pixi-v8/PixiV8UnifiedRenderer.js';
import { PixiV8UIController } from './pixi-v8/PixiV8UIController.js';
import { PixiV8InputController } from './pixi-v8/PixiV8InputController.js';
import { PixiV8LayerProcessor } from './pixi-v8/PixiV8LayerProcessor.js';
import { PixiV8ToolProcessor } from './pixi-v8/PixiV8ToolProcessor.js';

// Stores and Controllers
import { EventStore } from './stores/EventStore.js';
import { HistoryController } from './stores/HistoryController.js';

// Utilities
import { CanvasController } from './utils/CanvasController.js';
import { ColorProcessor } from './utils/ColorProcessor.js';
import { ShortcutController } from './utils/ShortcutController.js';
import { TablerIconHelper } from './utils/TablerIconHelper.js'; // 新規追加

// Third-party Dependencies
import * as PIXI from 'pixi.js';
import _ from 'lodash-es';

/**
 * アプリケーション初期化
 */
class TegakiDrawingTool {
  constructor() {
    this.renderer = null;
    this.uiController = null;
    this.inputController = null;
    this.layerProcessor = null;
    this.toolProcessor = null;
    this.eventStore = null;
    this.historyController = null;
    this.canvasController = null;
    this.colorProcessor = null;
    this.shortcutController = null;
    
    this.isInitialized = false;
  }

  /**
   * アプリケーション初期化
   */
  async init() {
    try {
      console.log('🎨 Tegaki Drawing Tool Phase2 初期化開始...');
      
      // 1. イベントストア初期化
      this.eventStore = new EventStore();
      
      // 2. Canvas Controller初期化
      this.canvasController = new CanvasController();
      
      // 3. Color Processor初期化
      this.colorProcessor = new ColorProcessor();
      
      // 4. PIXI.js v8 統合レンダラー初期化
      this.renderer = new PixiV8UnifiedRenderer({
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true
      });
      
      // 5. レイヤープロセッサー初期化
      this.layerProcessor = new PixiV8LayerProcessor(this.renderer, this.eventStore);
      
      // 6. ツールプロセッサー初期化
      this.toolProcessor = new PixiV8ToolProcessor(this.renderer, this.eventStore);
      
      // 7. UI Controller初期化（アイコンヘルパー含む）
      this.uiController = new PixiV8UIController(this.eventStore, {
        iconHelper: TablerIconHelper
      });
      
      // 8. Input Controller初期化
      this.inputController = new PixiV8InputController(this.renderer, this.eventStore);
      
      // 9. History Controller初期化
      this.historyController = new HistoryController(this.eventStore);
      
      // 10. Shortcut Controller初期化
      this.shortcutController = new ShortcutController(this.eventStore);
      
      // 11. UIアイコンの初期化
      this.initializeUIIcons();
      
      // 12. イベントリスナー設定
      this.setupEventListeners();
      
      // 13. 初期レイヤー作成
      this.layerProcessor.createLayer('背景レイヤー');
      
      this.isInitialized = true;
      console.log('✅ Tegaki Drawing Tool Phase2 初期化完了');
      
      // 14. 開発モード情報表示
      if (import.meta.env.DEV) {
        this.displayDevInfo();
      }
      
    } catch (error) {
      console.error('❌ アプリケーション初期化エラー:', error);
      throw error;
    }
  }

  /**
   * UIアイコンの初期化
   */
  initializeUIIcons() {
    console.log('🎯 UIアイコン初期化...');
    
    // ツールバーアイコン
    const toolIcons = {
      'brush-tool': 'brush',
      'pen-tool': 'pen',
      'eraser-tool': 'eraser',
      'bucket-tool': 'bucket',
      'eyedropper-tool': 'eyedropper',
      'selection-tool': 'selection',
      'zoom-tool': 'zoom',
      'hand-tool': 'hand'
    };

    // レイヤーパネルアイコン
    const layerIcons = {
      'layer-add': 'layer-add',
      'layer-delete': 'layer-delete',
      'layer-visible': 'layer-visible',
      'layer-lock': 'layer-lock'
    };

    // ファイルメニューアイコン
    const fileIcons = {
      'file-new': 'new',
      'file-open': 'open',
      'file-save': 'save',
      'file-export': 'export'
    };

    // アイコンを設定
    Object.entries({...toolIcons, ...layerIcons, ...fileIcons}).forEach(([elementId, iconType]) => {
      const element = document.getElementById(elementId);
      if (element) {
        TablerIconHelper.setElementIcon(element, iconType, { size: 20 });
      }
    });
  }

  /**
   * イベントリスナー設定
   */
  setupEventListeners() {
    // ウィンドウリサイズ
    window.addEventListener('resize', _.throttle(() => {
      this.renderer.resize(window.innerWidth, window.innerHeight);
    }, 100));

    // アプリケーション終了時
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  /**
   * 開発モード情報表示
   */
  displayDevInfo() {
    console.log('🔧 開発モード情報:');
    console.log('- PIXI.js Version:', PIXI.VERSION);
    console.log('- Renderer Type:', this.renderer.type);
    console.log('- Resolution:', this.renderer.resolution);
    console.log('- Canvas Size:', this.renderer.width, 'x', this.renderer.height);
    console.log('- Device Pixel Ratio:', window.devicePixelRatio);
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.renderer) {
      this.renderer.destroy();
    }
    if (this.eventStore) {
      this.eventStore.removeAllListeners();
    }
  }
}

/**
 * アプリケーション起動
 */
async function startApp() {
  try {
    const app = new TegakiDrawingTool();
    await app.init();
    
    // グローバルに公開（デバッグ用）
    if (import.meta.env.DEV) {
      window.tegakiApp = app;
    }
    
  } catch (error) {
    console.error('アプリケーション起動エラー:', error);
    
    // エラー表示UI
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff6b6b;
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: sans-serif;
      z-index: 10000;
    `;
    errorDiv.textContent = `初期化エラー: ${error.message}`;
    document.body.appendChild(errorDiv);
  }
}

// DOM読み込み完了後に起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

export { TegakiDrawingTool };