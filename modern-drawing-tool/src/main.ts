// src/main.ts - アプリケーション初期化・Phase1基本機能統合

import { PixiApplication } from './core/PixiApplication.js';
import { EventBus } from './core/EventBus.js';
import { DrawingEngine } from './core/DrawingEngine.js';
import { PerformanceManager } from './core/PerformanceManager.js';
import { InputManager } from './input/InputManager.js';
import { UIManager } from './ui/UIManager.js';
import { PenTool } from './tools/PenTool.js';
import { EraserTool } from './tools/EraserTool.js';
import { IDrawingTool } from './tools/IDrawingTool.js';

// アプリケーション起動時エラー処理
window.addEventListener('error', (e) => {
  console.error('💥 アプリケーション致命的エラー:', e.error);
  showStartupError('予期しないエラーが発生しました。ページを再読み込みしてください。');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('💥 Promise未処理エラー:', e.reason);
  showStartupError('初期化処理でエラーが発生しました。ブラウザを更新してください。');
  e.preventDefault();
});

// アプリケーション起動エラー表示
function showStartupError(message: string): void {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: #f44336; color: white; padding: 20px; border-radius: 8px;
    max-width: 400px; text-align: center; z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 8px 24px rgba(244, 67, 54, 0.3);
  `;
  errorDiv.innerHTML = `
    <h3>🚨 起動エラー</h3>
    <p style="margin: 12px 0;">${message}</p>
    <button onclick="location.reload()" style="
      background: white; color: #f44336; border: none; padding: 10px 20px;
      border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 8px;
    ">ページを再読み込み</button>
  `;
  document.body.appendChild(errorDiv);
}

// ローディング表示・初期化フィードバック
function showLoadingIndicator(): HTMLElement {
  const loader = document.createElement('div');
  loader.id = 'loading-indicator';
  loader.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(255, 255, 238, 0.95); border: 2px solid #800000;
    border-radius: 12px; padding: 24px; text-align: center; z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
  `;
  loader.innerHTML = `
    <div style="color: #800000; font-size: 18px; font-weight: 600; margin-bottom: 12px;">
      🎨 お絵かきツール初期化中...
    </div>
    <div id="loading-status" style="color: #5d4037; font-size: 14px; margin-bottom: 16px;">
      システム確認中...
    </div>
    <div style="width: 200px; height: 4px; background: #e9c2ba; border-radius: 2px; overflow: hidden;">
      <div id="loading-progress" style="
        width: 10%; height: 100%; background: #800000; border-radius: 2px;
        transition: width 0.3s ease;
      "></div>
    </div>
  `;
  document.body.appendChild(loader);
  return loader;
}

// ローディング進捗更新
function updateLoadingProgress(progress: number, status: string): void {
  const progressBar = document.getElementById('loading-progress');
  const statusText = document.getElementById('loading-status');
  
  if (progressBar) {
    progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  }
  
  if (statusText) {
    statusText.textContent = status;
  }
}

// ローディング表示削除
function hideLoadingIndicator(): void {
  const loader = document.getElementById('loading-indicator');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.3s ease';
    setTimeout(() => loader.remove(), 300);
  }
}

// Phase1アプリケーションクラス・統合管理
class ModernDrawingApp {
  private pixiApp: PixiApplication;
  private eventBus: EventBus;
  private drawingEngine: DrawingEngine | null = null;
  private performanceManager: PerformanceManager | null = null;
  private inputManager: InputManager | null = null;
  private uiManager: UIManager | null = null;
  
  // ツール管理・Phase1基本ツール
  private tools: Map<string, IDrawingTool> = new Map();
  private activeTool: IDrawingTool | null = null;

  constructor() {
    this.pixiApp = new PixiApplication();
    this.eventBus = new EventBus();
  }

  // アプリケーション初期化・段階的処理・エラー処理完全
  public async initialize(): Promise<void> {
    console.log('🚀 ModernDrawingApp初期化開始...');
    
    try {
      // Phase 1: UIシステム初期化 (20%)
      await this.initializeUI();
      updateLoadingProgress(20, 'UI初期化完了...');

      // Phase 2: PixiJS初期化 (40%)
      await this.initializePixiJS();
      updateLoadingProgress(40, 'WebGL初期化完了...');

      // Phase 3: コアシステム初期化 (60%)
      await this.initializeCoreComponents();
      updateLoadingProgress(60, '描画エンジン初期化完了...');

      // Phase 4: ツール初期化 (80%)
      await this.initializeTools();
      updateLoadingProgress(80, 'ツール初期化完了...');

      // Phase 5: イベント接続・最終設定 (100%)
      await this.connectEventHandlers();
      updateLoadingProgress(100, '初期化完了！');

      console.log('✅ ModernDrawingApp初期化成功');
      
      // 少し待ってからローディング削除
      setTimeout(hideLoadingIndicator, 500);
      
    } catch (error) {
      console.error('💥 ModernDrawingApp初期化失敗:', error);
      hideLoadingIndicator();
      showStartupError(`初期化エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      throw error;
    }
  }

  // UI初期化・レイアウト作成
  private async initializeUI(): Promise<void> {
    const appElement = document.getElementById('app');
    if (!appElement) {
      throw new Error('#app要素が見つかりません');
    }

    this.uiManager = new UIManager(this.eventBus, appElement);
    await this.uiManager.initializeBasicUI();
    this.uiManager.setupKeyboardShortcuts();
    
    console.log('🎨 UI初期化完了');
  }

  // PixiJS初期化・WebGL確保
  private async initializePixiJS(): Promise<void> {
    if (!this.uiManager) {
      throw new Error('UIManager未初期化');
    }

    const canvasContainer = this.uiManager.getCanvasContainer();
    if (!canvasContainer) {
      throw new Error('キャンバスコンテナが見つかりません');
    }

    const success = await this.pixiApp.initialize(canvasContainer, {
      width: Math.min(window.innerWidth - 480, 2080), // 80px + 400px = 480px UI分
      height: Math.min(window.innerHeight, 1440),
      backgroundColor: 0xffffee, // ふたば背景色
      antialias: true,
      powerPreference: 'high-performance'
    });

    if (!success) {
      throw new Error('PixiJS初期化に失敗しました');
    }

    console.log('🖥️ PixiJS初期化完了');
  }

  // コアコンポーネント初期化・描画・性能・入力
  private async initializeCoreComponents(): Promise<void> {
    const app = this.pixiApp.getApp();
    if (!app) {
      throw new Error('PixiJS Application未初期化');
    }

    // DrawingEngine初期化・描画処理の中核
    this.drawingEngine = new DrawingEngine(app, this.eventBus);
    await this.drawingEngine.initialize();

    // PerformanceManager初期化・監視システム
    this.performanceManager = new PerformanceManager(this.eventBus);
    this.performanceManager.startMonitoring();

    // InputManager初期化・入力制御
    const canvas = this.pixiApp.getCanvas();
    if (!canvas) {
      throw new Error('Canvas要素が見つかりません');
    }
    
    this.inputManager = new InputManager(canvas, this.eventBus);
    this.inputManager.initialize();

    console.log('🔧 コアコンポーネント初期化完了');
  }

  // ツール初期化・Phase1基本ツール・ペン・消しゴム
  private async initializeTools(): Promise<void> {
    console.log('🔨 ツール初期化開始...');

    // ペンツール初期化
    const penTool = new PenTool();
    this.tools.set('pen', penTool);

    // 消しゴムツール初期化
    const eraserTool = new EraserTool();
    this.tools.set('eraser', eraserTool);

    // 初期ツール選択・ペンをデフォルト
    this.activeTool = penTool;
    this.activeTool.activate();

    console.log(`✅ ツール初期化完了: ${this.tools.size}個のツール登録`);
  }

  // イベント接続・コンポーネント間連携
  private async connectEventHandlers(): Promise<void> {
    console.log('🔗 イベントハンドラー接続開始...');

    // UIツール選択イベント
    this.eventBus.on('ui:toolbar-click', (data) => {
      this.switchTool(data.tool);
    });

    // UI色変更イベント
    this.eventBus.on('ui:color-change', (data) => {
      if (this.activeTool && 'setColor' in this.activeTool) {
        (this.activeTool as any).setColor(data.color);
      }
      
      // DrawingEngineに色設定反映
      if (this.drawingEngine) {
        this.drawingEngine.setDrawingColor(data.color);
      }
    });

    // 描画イベント→アクティブツールに転送
    this.eventBus.on('drawing:start', (data) => {
      if (this.activeTool) {
        this.activeTool.onPointerDown(data);
      }
    });

    this.eventBus.on('drawing:move', (data) => {
      if (this.activeTool) {
        this.activeTool.onPointerMove(data);
      }
    });

    this.eventBus.on('drawing:end', (data) => {
      if (this.activeTool) {
        this.activeTool.onPointerUp(data);
      }
    });

    // ウィンドウリサイズ対応
    window.addEventListener('resize', this.handleWindowResize.bind(this));

    // ページ終了時のクリーンアップ
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    console.log('✅ イベントハンドラー接続完了');
  }

  // ツール切り替え・状態管理
  private switchTool(toolName: string): void {
    const newTool = this.tools.get(toolName);
    if (!newTool) {
      console.warn(`未知のツール: ${toolName}`);
      return;
    }

    if (this.activeTool === newTool) {
      console.log(`既に${toolName}が選択済み`);
      return;
    }

    // 現在のツール無効化
    if (this.activeTool) {
      this.activeTool.deactivate();
    }

    // 新しいツール有効化
    this.activeTool = newTool;
    this.activeTool.activate();

    console.log(`🔧 ツール切り替え: ${toolName}`);
  }

  // ウィンドウリサイズ処理・レスポンシブ対応
  private handleWindowResize(): void {
    if (!this.pixiApp) return;

    const newWidth = Math.min(window.innerWidth - 480, 2080);
    const newHeight = Math.min(window.innerHeight, 1440);
    
    this.pixiApp.resizeCanvas(newWidth, newHeight);
    console.log(`📐 ウィンドウリサイズ: ${newWidth}x${newHeight}`);
  }

  // アプリケーション終了前処理・リソース解放
  private handleBeforeUnload(): void {
    console.log('🔄 アプリケーション終了処理開始...');
    this.destroy();
  }

  // 現在の状態取得・デバッグ・監視用
  public getApplicationState(): {
    isInitialized: boolean;
    activeTool: string | null;
    toolsCount: number;
    renderStats: any;
    performance: any;
  } {
    return {
      isInitialized: this.drawingEngine !== null && this.inputManager !== null,
      activeTool: this.activeTool?.name || null,
      toolsCount: this.tools.size,
      renderStats: this.pixiApp.getRenderStats(),
      performance: this.performanceManager?.getCurrentStats() || null
    };
  }

  // リソース完全解放・メモリリーク防止
  public destroy(): void {
    console.log('🔄 ModernDrawingApp破棄開始...');

    // ツール無効化
    if (this.activeTool) {
      this.activeTool.deactivate();
      this.activeTool = null;
    }
    this.tools.clear();

    // コンポーネント破棄・順序重要
    this.inputManager?.destroy();
    this.performanceManager?.destroy();
    this.drawingEngine?.destroy();
    this.uiManager?.destroy();
    this.pixiApp?.destroy();

    // イベントリスナー削除
    window.removeEventListener('resize', this.handleWindowResize.bind(this));
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    console.log('✅ ModernDrawingApp破棄完了');
  }
}

// アプリケーション起動・DOMロード完了後
async function startApplication(): Promise<void> {
  console.log('🎯 アプリケーション起動開始...');
  
  // ローディング表示
  const loader = showLoadingIndicator();
  
  try {
    // 短い遅延でローディング表示を確実にする
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const app = new ModernDrawingApp();
    await app.initialize();
    
    // グローバルアクセス・デバッグ用
    (window as any).drawingApp = app;
    
    console.log('🎉 アプリケーション起動完了！');
    console.log('👨‍💻 デバッグ: window.drawingApp でアクセス可能');
    
  } catch (error) {
    console.error('💥 アプリケーション起動失敗:', error);
    hideLoadingIndicator();
    showStartupError('アプリケーションの起動に失敗しました。');
  }
}

// DOM準備完了検知・起動制御
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApplication);
} else {
  // すでにDOMロード完了・即座に起動
  startApplication();
}

// TypeScript型定義・グローバル拡張
declare global {
  interface Window {
    drawingApp?: ModernDrawingApp;
  }
}