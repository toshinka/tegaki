// src/main.ts - アプリケーションエントリーポイント・PixiJS v8統合・モジュール統合

import { PixiApplication } from './core/PixiApplication';
import { EventBus } from './core/EventBus';
import { DrawingEngine } from './core/DrawingEngine';
import { PerformanceManager } from './core/PerformanceManager';
import { InputManager } from './input/InputManager';
import { PenTool } from './tools/PenTool';
import { EraserTool } from './tools/EraserTool';
import { UIManager } from './ui/UIManager';

class ModernDrawingApp {
  private pixiApp: PixiApplication;
  private eventBus: EventBus;
  private drawingEngine: DrawingEngine | null = null;
  private performanceManager: PerformanceManager;
  private inputManager: InputManager | null = null;
  private uiManager: UIManager | null = null;
  private currentTool: any = null; // Phase1: ツール管理簡易版
  private penTool: PenTool;
  private eraserTool: EraserTool;
  
  public isInitialized = false;

  constructor() {
    console.log('🚀 モダンお絵かきツール v3.2 初期化開始');
    
    // 基本システム初期化・依存関係順序重要
    this.eventBus = new EventBus();
    this.pixiApp = new PixiApplication();
    this.performanceManager = new PerformanceManager(this.eventBus);
    this.penTool = new PenTool();
    this.eraserTool = new EraserTool();
  }

  // アプリケーション初期化・Phase1基盤構築・エラー処理完全
  public async initialize(): Promise<boolean> {
    try {
      console.log('🔧 システム基盤初期化...');
      
      // Phase1: UI初期化・キャンバス準備
      const appElement = document.getElementById('app');
      if (!appElement) {
        throw new Error('アプリケーションルート要素が見つかりません');
      }
      
      this.uiManager = new UIManager(this.eventBus, appElement);
      await this.uiManager.initializeBasicUI();
      this.uiManager.setupKeyboardShortcuts();
      
      // キャンバスコンテナ取得・PixiJS初期化
      const canvasContainer = this.uiManager.getCanvasContainer();
      if (!canvasContainer) {
        throw new Error('キャンバスコンテナが見つかりません');
      }
      
      // PixiJS初期化・WebGL2優先・2.5K対応
      const pixiInitSuccess = await this.pixiApp.initialize(canvasContainer, {
        width: Math.min(window.innerWidth - 480, 2560), // サイドバー考慮
        height: Math.min(window.innerHeight, 1440),
        backgroundColor: 0xffffee, // ふたば背景色
        antialias: true,
        powerPreference: 'high-performance'
      });

      if (!pixiInitSuccess) {
        throw new Error('PixiJS初期化に失敗しました');
      }

      // 描画エンジン初期化・Graphics管理
      const app = this.pixiApp.getApp();
      if (!app) {
        throw new Error('PixiJSアプリケーション取得に失敗');
      }
      
      this.drawingEngine = new DrawingEngine(app, this.eventBus);
      
      // 入力管理初期化・マウス・ペンタブレット対応
      const canvas = this.pixiApp.getCanvas();
      if (!canvas) {
        throw new Error('キャンバス要素取得に失敗');
      }
      
      this.inputManager = new InputManager(this.eventBus, canvas);
      
      // イベントリスナー設定・ツール制御
      this.setupEventListeners();
      
      // デフォルトツール設定・ペンツール
      this.currentTool = this.penTool;
      this.currentTool.activate();
      
      // パフォーマンス監視開始
      this.performanceManager.startMonitoring();
      
      // リサイズ対応設定
      this.setupWindowResizeHandler();
      
      this.isInitialized = true;
      console.log('✅ アプリケーション初期化完了');
      console.log('🎨 描画準備完了・2560×1440対応・WebGL2有効');
      
      return true;
      
    } catch (error) {
      console.error('💥 初期化エラー:', error);
      this.showInitializationError(error as Error);
      return false;
    }
  }

  // イベントリスナー設定・UI連携・ツール制御
  private setupEventListeners(): void {
    // ツール切り替えイベント
    this.eventBus.on('ui:toolbar-click', (data) => {
      this.switchTool(data.tool);
    });

    // 色変更イベント
    this.eventBus.on('ui:color-change', (data) => {
      if (this.currentTool && typeof this.currentTool.setColor === 'function') {
        this.currentTool.setColor(data.color);
      }
    });

    // パフォーマンス警告イベント
    this.eventBus.on('performance:fps-low', (data) => {
      console.warn(`⚠️ FPS低下警告: ${data.currentFPS.toFixed(1)}fps`);
    });

    this.eventBus.on('performance:memory-warning', (data) => {
      console.warn(`⚠️ メモリ警告: ${data.used.toFixed(1)}MB`);
    });
  }

  // ツール切り替え・状態管理・Phase1簡易版
  private switchTool(toolName: string): void {
    console.log(`🔧 ツール切り替え: ${toolName}`);
    
    // 現在のツール無効化
    if (this.currentTool) {
      this.currentTool.deactivate();
    }
    
    // 新しいツール有効化
    switch (toolName) {
      case 'pen':
        this.currentTool = this.penTool;
        break;
      case 'eraser':
        this.currentTool = this.eraserTool;
        break;
      default:
        console.warn(`未知のツール: ${toolName}`);
        this.currentTool = this.penTool; // デフォルト
        break;
    }
    
    if (this.currentTool) {
      this.currentTool.activate();
    }
  }

  // ウィンドウリサイズ対応・2.5K対応・レスポンシブ
  private setupWindowResizeHandler(): void {
    let resizeTimeout: number;
    
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        if (this.pixiApp) {
          const newWidth = Math.min(window.innerWidth - 480, 2560);
          const newHeight = Math.min(window.innerHeight, 1440);
          this.pixiApp.resizeCanvas(newWidth, newHeight);
          console.log(`📐 キャンバスリサイズ: ${newWidth}x${newHeight}`);
        }
      }, 250); // デバウンス処理
    });
  }

  // 初期化エラー表示・ユーザー向け・詳細情報
  private showInitializationError(error: Error): void {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #800000; color: #f0e0d6; padding: 30px; border-radius: 12px;
      max-width: 500px; text-align: center; z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    `;
    
    errorDiv.innerHTML = `
      <h2 style="margin-bottom: 15px;">🚨 初期化エラー</h2>
      <p style="margin-bottom: 15px;">アプリケーションの初期化に失敗しました</p>
      <details style="text-align: left; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; margin: 15px 0;">
        <summary style="cursor: pointer; font-weight: bold;">詳細情報</summary>
        <pre style="white-space: pre-wrap; font-size: 12px; margin-top: 10px;">${error.message}\n\n${error.stack || ''}</pre>
      </details>
      <button onclick="location.reload()" style="
        background: #f0e0d6; color: #800000; border: none; padding: 10px 20px;
        border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;
      ">ページを再読み込み</button>
    `;
    
    document.body.appendChild(errorDiv);
  }

  // デバッグ情報取得・Phase1開発支援
  public getDebugInfo(): {
    system: any;
    performance: any;
    tools: any;
    ui: any;
  } {
    return {
      system: {
        pixiInitialized: !!this.pixiApp.getApp(),
        rendererType: this.pixiApp.getRendererType(),
        canvasSize: this.pixiApp.getCanvas() ? {
          width: this.pixiApp.getCanvas()!.width,
          height: this.pixiApp.getCanvas()!.height
        } : null,
        eventBusStats: this.eventBus.getStats()
      },
      performance: this.performanceManager.getDetailedStats(),
      tools: {
        current: this.currentTool?.name || 'none',
        pen: this.penTool.getToolState(),
        eraser: this.eraserTool.getToolState()
      },
      ui: this.uiManager?.getUIState() || null
    };
  }

  // アプリケーション終了・リソース解放・メモリリーク防止
  public destroy(): void {
    console.log('🔄 アプリケーション終了・リソース解放中...');
    
    // ツール無効化
    if (this.currentTool) {
      this.currentTool.deactivate();
    }
    
    // 各コンポーネント破棄・順序重要
    this.performanceManager?.stopMonitoring();
    this.inputManager?.destroy();
    this.drawingEngine?.destroy();
    this.uiManager?.destroy();
    this.pixiApp?.destroy();
    this.eventBus?.destroy();
    
    console.log('✅ アプリケーション終了完了');
  }
}

// アプリケーション起動・エラーハンドリング・グローバル化
async function startApplication(): Promise<void> {
  try {
    const app = new ModernDrawingApp();
    
    // グローバル化・デバッグ用
    (window as any).modernDrawingApp = app;
    
    const success = await app.initialize();
    if (!success) {
      throw new Error('アプリケーション初期化に失敗しました');
    }
    
    console.log('🎉 モダンお絵かきツール起動完了');
    console.log('📋 デバッグ情報: window.modernDrawingApp.getDebugInfo()');
    
  } catch (error) {
    console.error('💥 アプリケーション起動エラー:', error);
  }
}

// DOM準備完了後に起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApplication);
} else {
  startApplication();
}