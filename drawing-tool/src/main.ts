import { PixiApplication } from './core/PixiApplication.js';
import { EventBus } from './core/EventBus.js';
import { DrawingEngine } from './core/DrawingEngine.js';
import { InputManager } from './input/InputManager.js';
import { UIManager } from './ui/UIManager.js';
import { ToolManager } from './tools/ToolManager.js';
import { PerformanceManager } from './core/PerformanceManager.js';

class ModernDrawingApp {
  private pixiApp: PixiApplication;
  private eventBus: EventBus;
  private drawingEngine: DrawingEngine | null = null;
  private inputManager: InputManager | null = null;
  private uiManager: UIManager;
  private toolManager: ToolManager | null = null;
  private performanceManager: PerformanceManager;

  constructor() {
    this.eventBus = new EventBus();
    this.pixiApp = new PixiApplication();
    this.uiManager = new UIManager(this.eventBus, document.getElementById('app')!);
    this.performanceManager = new PerformanceManager();
  }

  public async initialize(): Promise<boolean> {
    try {
      console.log('モダンお絵かきツール Phase1 起動中...');

      // UI初期化
      await this.uiManager.initializeBasicUI();
      
      // PixiJs初期化
      const canvasContainer = this.uiManager.getCanvasContainer();
      if (!canvasContainer) {
        throw new Error('Canvas container not found');
      }

      const success = await this.pixiApp.initialize(canvasContainer);
      if (!success) {
        throw new Error('PixiJS initialization failed');
      }

      // 描画エンジン初期化
      const app = this.pixiApp.getApp();
      if (!app) {
        throw new Error('PixiJS app not available');
      }

      this.drawingEngine = new DrawingEngine(app, this.eventBus);

      // 入力管理初期化
      const canvas = this.pixiApp.getCanvas();
      if (!canvas) {
        throw new Error('Canvas not available');
      }

      this.inputManager = new InputManager(this.eventBus, canvas);

      // ツール管理初期化
      this.toolManager = new ToolManager(this.eventBus);

      // 性能監視開始
      this.performanceManager.startFPSMonitoring();

      // イベントリスナー設定
      this.setupEventListeners();

      console.log('✅ Phase1初期化完了！');
      console.log(`レンダラー: ${this.pixiApp.getRendererType()}`);
      console.log('🎨 描画テスト開始可能');
      
      return true;

    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      return false;
    }
  }

  private setupEventListeners(): void {
    // UI→ツール連携
    this.eventBus.on('ui:toolbar-click', (data) => {
      console.log(`ツール切り替え: ${data.tool}`);
    });

    // 色変更連携
    this.eventBus.on('ui:color-change', (data) => {
      console.log(`色変更: #${data.color.toString(16).padStart(6, '0')}`);
    });

    // ツール変更ログ
    this.eventBus.on('tool:change', (data) => {
      console.log(`ツール変更: ${data.previousTool} → ${data.toolName}`);
    });

    // 性能監視・定期チェック
    setInterval(() => {
      const memoryStatus = this.performanceManager.checkMemoryUsage();
      const fps = this.performanceManager.getCurrentFPS();
      
      if (memoryStatus.status === 'warning') {
        console.warn(`メモリ警告: ${memoryStatus.used.toFixed(1)}MB`);
      }
      
      if (fps < 30) {
        console.warn(`FPS低下: ${fps.toFixed(1)}fps`);
      }
    }, 5000); // 5秒間隔
  }

  public destroy(): void {
    this.inputManager?.destroy();
    this.drawingEngine?.destroy();
    this.toolManager?.destroy();
    this.pixiApp.destroy();
    this.eventBus.destroy();
  }
}

// アプリケーション起動
async function main() {
  const app = new ModernDrawingApp();
  
  const success = await app.initialize();
  if (success) {
    console.log('✅ Phase1基盤構築完了 - 描画テスト開始可能');
    console.log('🖱️ マウスまたはペンタブレットで描画してください');
  } else {
    console.error('❌ 初期化失敗');
  }

  // 開発用・グローバル参照
  (globalThis as any).drawingApp = app;
}

main().catch(console.error);