// src/main.ts - Phase1アプリケーション統合・MVP完成
import { PixiApplication } from './core/PixiApplication.js';
import { EventBus } from './core/EventBus.js';
import { DrawingEngine } from './core/DrawingEngine.js';
import { InputManager } from './input/InputManager.js';
import { PerformanceManager } from './core/PerformanceManager.js';
import { UIManager } from './ui/UIManager.js';
import { PenTool, type IDrawingTool } from './tools/PenTool.js';
import { EraserTool } from './tools/EraserTool.js';

class ModernDrawingApp {
  // 基盤システム・責任分界
  private pixiApp: PixiApplication;
  private eventBus: EventBus;
  private drawingEngine: DrawingEngine | null = null;
  private inputManager: InputManager | null = null;
  private performanceManager: PerformanceManager;
  private uiManager: UIManager;
  
  // ツールシステム・Phase1基本
  private penTool: PenTool;
  private eraserTool: EraserTool;
  private currentTool: IDrawingTool;

  constructor() {
    console.log('🎨 モダンお絵かきツール v4.0 Phase1 起動準備...');
    
    // 基盤システム初期化・依存関係順序
    this.eventBus = new EventBus();
    this.pixiApp = new PixiApplication();
    this.performanceManager = new PerformanceManager(this.eventBus);
    this.uiManager = new UIManager(this.eventBus, document.getElementById('app')!);
    
    // ツール初期化
    this.penTool = new PenTool();
    this.eraserTool = new EraserTool();
    this.currentTool = this.penTool;
  }

  // Phase1初期化・段階的実装・エラー処理
  public async initialize(): Promise<boolean> {
    try {
      console.log('📋 Phase1初期化シーケンス開始...');

      // UI初期化・レイアウト構築
      console.log('🎨 UI初期化中...');
      await this.uiManager.initializeBasicUI();

      // PixiJS初期化・WebGL2確実
      console.log('🏗️ PixiJS初期化中...');
      const canvasContainer = this.uiManager.getCanvasContainer();
      if (!canvasContainer) throw new Error('Canvas container not found');

      const success = await this.pixiApp.initialize(canvasContainer);
      if (!success) throw new Error('PixiJS initialization failed');

      // 描画エンジン初期化
      console.log('🖊️ 描画エンジン初期化中...');
      const app = this.pixiApp.getApp();
      if (!app) throw new Error('PixiJS app not available');
      this.drawingEngine = new DrawingEngine(app, this.eventBus);

      // 入力システム初期化
      console.log('🎮 入力システム初期化中...');
      const canvas = this.pixiApp.getCanvas();
      if (!canvas) throw new Error('Canvas not available');
      this.inputManager = new InputManager(this.eventBus, canvas);

      // イベント統合
      console.log('⚡ イベントシステム統合中...');
      this.setupEventListeners();

      // ツール初期化
      console.log('🔧 ツールシステム初期化中...');
      this.currentTool.activate();

      // 性能監視開始
      console.log('📊 性能監視開始中...');
      this.performanceManager.startMonitoring();

      // キーボードショートカット設定
      console.log('⌨️ キーボードショートカット設定中...');
      this.uiManager.setupKeyboardShortcuts();

      console.log('✅ Phase1初期化完了！');
      console.log(`📱 レンダラー: ${this.pixiApp.getRendererType()}`);
      console.log(`🎯 キャンバス: ${canvas.width}x${canvas.height}`);
      console.log('🎨 描画テスト開始可能');
      
      // 読み込み表示削除
      const loading = document.getElementById('loading');
      if (loading) loading.style.display = 'none';
      
      return true;

    } catch (error) {
      console.error('❌ Phase1初期化失敗:', error);
      this.showErrorMessage(error as Error);
      return false;
    }
  }

  // イベントリスナー統合・UI←→Core連携
  private setupEventListeners(): void {
    // UI→ツール切り替え
    this.eventBus.on('ui:toolbar-click', (data) => {
      console.log(`🔧 ツール切り替え: ${data.tool}`);
      
      this.currentTool.deactivate();
      
      switch (data.tool) {
        case 'pen':
          this.currentTool = this.penTool;
          break;
        case 'eraser':
          this.currentTool = this.eraserTool;
          break;
        default:
          console.warn(`未知のツール: ${data.tool}`);
          this.currentTool = this.penTool;
      }
      
      this.currentTool.activate();
    });

    // UI→色変更
    this.eventBus.on('ui:color-change', (data) => {
      console.log(`🎨 色変更: #${data.color.toString(16).padStart(6, '0')}`);
      // DrawingEngine色反映はPhase2で実装
    });

    // 性能監視・警告
    this.eventBus.on('performance:fps-low', (data) => {
      console.warn(`⚠️ FPS低下: ${data.currentFPS.toFixed(1)}fps`);
      this.showPerformanceWarning('フレームレート低下', `現在: ${data.currentFPS.toFixed(1)}fps`);
    });

    this.eventBus.on('performance:memory-warning', (data) => {
      console.warn(`⚠️ メモリ警告: ${data.used.toFixed(0)}MB`);
      this.showPerformanceWarning('メモリ使用量増加', `現在: ${data.used.toFixed(0)}MB`);
    });
  }

  // エラー表示・復旧案内
  private showErrorMessage(error: Error): void {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #f44336; color: white; padding: 20px; border-radius: 8px;
      max-width: 400px; text-align: center; z-index: 10000;
    `;
    errorDiv.innerHTML = `
      <h3>初期化エラー</h3>
      <p>${error.message}</p>
      <button onclick="location.reload()" style="
        background: white; color: #f44336; border: none; padding: 8px 16px;
        border-radius: 4px; cursor: pointer; margin-top: 10px;
      ">ページを再読み込み</button>
    `;
    document.body.appendChild(errorDiv);
  }

  // 性能警告・一時表示
  private showPerformanceWarning(title: string, message: string): void {
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: #ff9800; color: white; padding: 12px 16px;
      border-radius: 4px; z-index: 9999; max-width: 300px;
    `;
    warningDiv.innerHTML = `<strong>${title}</strong><br>${message}`;
    document.body.appendChild(warningDiv);
    
    setTimeout(() => {
      if (document.body.contains(warningDiv)) {
        document.body.removeChild(warningDiv);
      }
    }, 5000);
  }

  // リソース解放・メモリリーク防止
  public destroy(): void {
    console.log('🔄 アプリケーション終了・リソース解放中...');
    
    this.currentTool.deactivate();
    this.performanceManager.stopMonitoring();
    this.inputManager?.destroy();
    this.drawingEngine?.destroy();
    this.pixiApp.destroy();
    this.eventBus.destroy();
    
    console.log('✅ リソース解放完了');
  }
}

// アプリケーション起動・Phase1完成
async function main() {
  const app = new ModernDrawingApp();
  
  const success = await app.initialize();
  if (success) {
    console.log('🎉 Phase1基盤構築完了！');
    console.log('📝 描画テスト手順:');
    console.log('  1. マウス・ペンでキャンバス上を描画');
    console.log('  2. ツールバーでペン・消しゴム切り替え');
    console.log('  3. 色パレットで色変更');
    console.log('  4. 15分連続描画で安定性確認');
  } else {
    console.error('💥 Phase1実装失敗 - エラー確認が必要');
  }

  // 開発用デバッグ参照
  if (import.meta.env.DEV) {
    (window as any).drawingApp = app;
    console.log('🔍 デバッグ: window.drawingApp 利用可能');
  }
}

// エントリーポイント
main().catch(error => {
  console.error('💥 アプリケーション起動失敗:', error);
});