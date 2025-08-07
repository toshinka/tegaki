// src/main.ts - モダンお絵かきツール・エントリーポイント

import './style.css';
import { PixiApplication } from './core/PixiApplication';
import { EventBus } from './core/EventBus';
import { DrawingEngine } from './core/DrawingEngine';
import { InputManager } from './input/InputManager';
import { UIManager } from './ui/UIManager';
import { PerformanceManager } from './core/PerformanceManager';

/**
 * アプリケーションメインクラス - 全体統合・Phase1基盤
 */
class ModernDrawingTool {
  private pixiApp: PixiApplication;
  private eventBus: EventBus;
  private drawingEngine: DrawingEngine;
  private inputManager: InputManager;
  private uiManager: UIManager;
  private performanceManager: PerformanceManager;
  private isInitialized = false;

  constructor() {
    this.eventBus = new EventBus();
    this.pixiApp = new PixiApplication();
    this.drawingEngine = new DrawingEngine(this.eventBus);
    this.inputManager = new InputManager(this.eventBus);
    this.uiManager = new UIManager(this.eventBus);
    this.performanceManager = new PerformanceManager(this.eventBus);
  }

  /**
   * アプリケーション初期化・段階的セットアップ
   */
  public async initialize(): Promise<boolean> {
    try {
      console.log('🎨 モダンお絵かきツール初期化開始...');

      // HTML要素確認・DOM準備完了待機
      const appContainer = document.getElementById('drawing-container');
      if (!appContainer) {
        throw new Error('描画コンテナ要素 #drawing-container が見つかりません');
      }

      // Phase1: WebGL2/PixiJS初期化
      const pixiInitialized = await this.pixiApp.initialize(appContainer, {
        width: 2560,
        height: 1440,
        backgroundColor: 0xffffee, // ふたば背景色
        antialias: true,
        powerPreference: 'high-performance'
      });

      if (!pixiInitialized) {
        throw new Error('PixiJS初期化失敗');
      }

      // Phase2: 描画エンジン初期化
      const pixiAppInstance = this.pixiApp.getApp();
      if (!pixiAppInstance) {
        throw new Error('PixiJS Application取得失敗');
      }

      await this.drawingEngine.initialize(pixiAppInstance);
      console.log('✅ 描画エンジン初期化完了');

      // Phase3: 入力システム初期化
      const canvas = this.pixiApp.getCanvas();
      if (!canvas) {
        throw new Error('Canvas要素取得失敗');
      }

      this.inputManager.initialize(canvas);
      console.log('✅ 入力システム初期化完了');

      // Phase4: UI初期化
      this.uiManager.initialize();
      console.log('✅ UI初期化完了');

      // Phase5: 性能監視開始
      this.performanceManager.initialize();
      console.log('✅ 性能監視開始');

      // リサイズ対応・レスポンシブ
      this.setupResizeHandling();

      // エラー処理・グローバル例外捕捉
      this.setupErrorHandling();

      this.isInitialized = true;
      console.log('🎉 モダンお絵かきツール初期化完了！');

      return true;

    } catch (error) {
      console.error('💥 初期化失敗:', error);
      this.showInitializationError(error as Error);
      return false;
    }
  }

  /**
   * ウィンドウリサイズ対応・2.5K適応
   */
  private setupResizeHandling(): void {
    let resizeTimeout: number;

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        const newWidth = Math.min(window.innerWidth, 2560);
        const newHeight = Math.min(window.innerHeight, 1440);
        
        this.pixiApp.resizeCanvas(newWidth, newHeight);
        this.eventBus.emit('ui:resize', { width: newWidth, height: newHeight });
        
        console.log(`📐 リサイズ対応: ${newWidth}x${newHeight}`);
      }, 250);
    });
  }

  /**
   * グローバルエラー処理・安定性確保
   */
  private setupErrorHandling(): void {
    window.addEventListener('error', (event) => {
      console.error('グローバルエラー:', event.error);
      this.eventBus.emit('performance:error', {
        message: event.error?.message || 'Unknown error',
        source: event.filename || 'Unknown',
        lineno: event.lineno || 0
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('未処理Promise拒否:', event.reason);
      this.eventBus.emit('performance:error', {
        message: event.reason?.message || 'Unhandled Promise rejection',
        source: 'Promise',
        lineno: 0
      });
      event.preventDefault();
    });
  }

  /**
   * 初期化エラー表示・ユーザー通知
   */
  private showInitializationError(error: Error): void {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #f44336; color: white; padding: 20px; border-radius: 8px;
      max-width: 500px; text-align: center; z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    errorDiv.innerHTML = `
      <h3>🎨 お絵かきツール初期化エラー</h3>
      <p>アプリケーションの初期化に失敗しました。</p>
      <p><small style="color: #ffcdd2;">${error.message}</small></p>
      <div style="margin-top: 15px;">
        <button onclick="location.reload()" style="
          background: white; color: #f44336; border: none; padding: 10px 20px;
          border-radius: 4px; cursor: pointer; margin: 5px; font-weight: bold;
        ">再読み込み</button>
        <button onclick="this.parentElement.parentElement.style.display='none'" style="
          background: transparent; color: white; border: 1px solid white; 
          padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;
        ">閉じる</button>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }

  /**
   * アプリケーション終了・リソース解放
   */
  public destroy(): void {
    if (!this.isInitialized) return;

    console.log('🔄 アプリケーション終了・リソース解放中...');

    this.performanceManager.destroy();
    this.uiManager.destroy();
    this.inputManager.destroy();
    this.drawingEngine.destroy();
    this.pixiApp.destroy();
    this.eventBus.destroy();

    this.isInitialized = false;
    console.log('✅ アプリケーション終了完了');
  }
}

/**
 * DOM読み込み完了後の初期化
 */
async function initializeApp(): Promise<void> {
  // HTMLの初期化確認
  console.log('✅ HTML初期化完了・main.ts読み込み準備完了');

  // DOM完全読み込み待機
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }

  // アプリケーション開始
  const app = new ModernDrawingTool();
  const initSuccess = await app.initialize();

  if (initSuccess) {
    console.log('🎨 モダンお絵かきツール開始');

    // ページ離脱時のクリーンアップ
    window.addEventListener('beforeunload', () => {
      app.destroy();
    });

    // デバッグ用グローバル参照（開発時のみ）
    if (import.meta.env.DEV) {
      (window as any).__drawingApp = app;
      console.log('🔧 デバッグモード: window.__drawingApp でアクセス可能');
    }
  } else {
    console.error('💥 アプリケーション開始失敗');
  }
}

// エントリーポイント実行
initializeApp().catch(error => {
  console.error('💥 main.ts実行エラー:', error);
});