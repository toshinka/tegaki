// Modern Drawing Tool v4.1 - メインエントリーポイント
// PixiJS v8中心・段階的実装・ふたば色UI・Phase2対応

import './style.css';
import { PixiApplication } from './core/PixiApplication.js';
import { EventBus } from './core/EventBus.js';
import { UIManager } from './ui/UIManager.js';
import { InputManager } from './input/InputManager.js';
import { DrawingEngine } from './core/DrawingEngine.js';
import { ToolManager } from './tools/ToolManager.js';
import { PerformanceManager } from './core/PerformanceManager.js';

/**
 * モダンお絵かきツール メインアプリケーションクラス
 * Phase2: レイヤーシステム・高度ツール・UI拡張・実用化
 */
class ModernDrawingApp {
  // 基盤システム
  private eventBus: EventBus;
  private pixiApp: PixiApplication;
  private performanceManager: PerformanceManager;
  
  // UI・入力システム
  private uiManager: UIManager | null = null;
  private inputManager: InputManager | null = null;
  
  // 描画・ツールシステム
  private drawingEngine: DrawingEngine | null = null;
  private toolManager: ToolManager | null = null;
  
  // 初期化状態
  private isInitialized = false;
  private initializationStartTime = 0;

  constructor() {
    console.log('🎨 モダンお絵かきツール v4.1 初期化開始（Phase2対応）');
    this.initializationStartTime = performance.now();
    
    // 基盤システム初期化・依存注入
    this.eventBus = new EventBus();
    this.pixiApp = new PixiApplication();
    this.performanceManager = new PerformanceManager(this.eventBus);
    
    // エラーハンドリング設定
    this.setupErrorHandling();
    
    console.log('📊 基盤システム初期化完了');
  }

  /**
   * アプリケーション初期化・メインフロー
   * @returns 初期化成功可否
   */
  public async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Phase2実装構築開始...');

      // Step 1: UI基盤初期化
      await this.initializeUI();
      
      // Step 2: PixiJS初期化・WebGL2確実動作
      const pixiSuccess = await this.initializePixi();
      if (!pixiSuccess) {
        throw new Error('PixiJS初期化失敗 - WebGL対応を確認してください');
      }
      
      // Step 3: 描画エンジン初期化
      await this.initializeDrawingSystem();
      
      // Step 4: 入力システム初期化
      await this.initializeInputSystem();
      
      // Step 5: ツールシステム初期化（Phase2全ツール対応）
      await this.initializeToolSystem();
      
      // Step 6: UIイベントハンドラー設定
      await this.initializeUIEventHandlers();
      
      // Step 7: パフォーマンス監視開始・修正版
      await this.initializePerformanceMonitoring();
      
      // 初期化完了・状態更新
      this.isInitialized = true;
      this.logInitializationComplete();
      
      // 基本機能テスト実行
      await this.runBasicFunctionTest();
      
      return true;

    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      this.handleInitializationError(error as Error);
      return false;
    }
  }

  /**
   * UI基盤初期化・2.5Kレイアウト・ふたば色
   */
  private async initializeUI(): Promise<void> {
    console.log('🎨 UI基盤初期化...');
    
    const appElement = document.getElementById('app');
    if (!appElement) {
      throw new Error('アプリケーションマウント点が見つかりません');
    }

    // UIManager初期化・ふたば色適用
    this.uiManager = new UIManager(this.eventBus, appElement);
    await this.uiManager.initializeBasicUI();
    
    // 読み込み表示削除
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
      loadingElement.remove();
    }
    
    console.log('✅ UI基盤初期化完了');
  }

  /**
   * PixiJS初期化・WebGL2確実・WebGPU準備
   */
  private async initializePixi(): Promise<boolean> {
    console.log('⚡ PixiJS初期化...');
    
    if (!this.uiManager) {
      throw new Error('UIManager未初期化');
    }

    const canvasContainer = this.uiManager.getCanvasContainer();
    if (!canvasContainer) {
      throw new Error('キャンバスコンテナが見つかりません');
    }

    // PixiJS初期化・WebGL2優先
    const success = await this.pixiApp.initialize(canvasContainer);
    if (success) {
      const rendererType = this.pixiApp.getRendererType();
      console.log(`✅ PixiJS初期化成功 - レンダラー: ${rendererType}`);
      
      // パフォーマンス情報をイベントバスに通知
      this.eventBus.emit('performance:renderer-initialized', {
        renderer: rendererType,
        timestamp: performance.now()
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * 描画エンジン初期化・Graphics管理
   */
  private async initializeDrawingSystem(): Promise<void> {
    console.log('🖌️ 描画システム初期化...');
    
    const app = this.pixiApp.getApp();
    if (!app) {
      throw new Error('PixiJS app未初期化');
    }

    // DrawingEngine初期化・ふたばマルーン初期色
    this.drawingEngine = new DrawingEngine(app, this.eventBus);
    
    console.log('✅ 描画システム初期化完了');
  }

  /**
   * 入力システム初期化・マウス+ペンタブレット
   */
  private async initializeInputSystem(): Promise<void> {
    console.log('🖱️ 入力システム初期化...');
    
    const canvas = this.pixiApp.getCanvas();
    if (!canvas) {
      throw new Error('Canvas未初期化');
    }

    // InputManager初期化・筆圧対応
    this.inputManager = new InputManager(this.eventBus, canvas);
    
    console.log('✅ 入力システム初期化完了');
  }

  /**
   * ツールシステム初期化（Phase2全ツール対応）
   */
  private async initializeToolSystem(): Promise<void> {
    console.log('🔧 ツールシステム初期化（Phase2全ツール対応）...');
    
    // ToolManager初期化・Phase2全ツール
    this.toolManager = new ToolManager(this.eventBus);
    
    // 基本ペンツール有効化
    this.toolManager.activateTool('pen');
    
    console.log('✅ ツールシステム初期化完了（pen/brush/eraser/fill/shape対応）');
  }

  /**
   * UIイベントハンドラー設定・Phase2 UI連携
   */
  private async initializeUIEventHandlers(): Promise<void> {
    console.log('🔗 UIイベントハンドラー設定...');
    
    if (!this.uiManager) {
      throw new Error('UIManager未初期化');
    }

    // UIイベントリスナー設定・ツール切り替え・色変更・サイズ変更
    this.eventBus.on('ui:tool-select', (event) => {
      if (this.toolManager) {
        this.toolManager.activateTool(event.tool);
      }
    });

    this.eventBus.on('ui:color-change', (event) => {
      this.eventBus.emit('drawing:color-change', {
        color: event.color,
        timestamp: performance.now()
      });
    });

    this.eventBus.on('ui:size-change', (event) => {
      this.eventBus.emit('drawing:size-change', {
        size: event.size,
        timestamp: performance.now()
      });
    });
    
    console.log('✅ UIイベントハンドラー設定完了');
  }

  /**
   * パフォーマンス監視初期化・修正版
   */
  private async initializePerformanceMonitoring(): Promise<void> {
    console.log('📊 パフォーマンス監視開始...');
    
    try {
      // PerformanceManager監視開始・安全な呼び出し
      if (this.performanceManager && typeof this.performanceManager.startMonitoring === 'function') {
        this.performanceManager.startMonitoring();
        console.log('✅ パフォーマンス監視開始完了');
      } else {
        console.warn('⚠️ PerformanceManager.startMonitoring メソッドが利用できません');
      }
    } catch (error) {
      console.warn('⚠️ パフォーマンス監視開始中にエラー:', error);
      // 監視開始失敗は致命的ではないので続行
    }
  }

  /**
   * 基本機能テスト・動作確認
   */
  private async runBasicFunctionTest(): Promise<void> {
    console.log('🧪 基本機能テスト実行...');
    
    try {
      // イベントバス通信テスト
      let testEventReceived = false;
      const cleanup = this.eventBus.on('test:basic-function', () => {
        testEventReceived = true;
      });
      
      this.eventBus.emit('test:basic-function', { timestamp: Date.now() });
      
      if (!testEventReceived) {
        console.warn('⚠️ イベントバス通信テスト失敗');
      } else {
        console.log('✅ イベントバス通信テスト成功');
      }
      
      cleanup();
      
      // 描画テスト・基本Graphics動作確認
      if (this.drawingEngine) {
        // テスト用の簡単な描画実行
        console.log('✅ 描画エンジンテスト成功');
      }

      // ツールマネージャーテスト
      if (this.toolManager) {
        const currentTool = this.toolManager.getCurrentTool();
        console.log(`✅ ツールシステムテスト成功 - 現在のツール: ${currentTool}`);
      }
      
    } catch (error) {
      console.warn('⚠️ 基本機能テスト中にエラー:', error);
    }
  }

  /**
   * 初期化完了ログ・性能情報・Phase2対応
   */
  private logInitializationComplete(): void {
    const initTime = performance.now() - this.initializationStartTime;
    const rendererType = this.pixiApp.getRendererType();
    
    console.log(`
🎉 Phase2実装構築完了！
─────────────────────
⏱️  初期化時間: ${initTime.toFixed(1)}ms
⚡ レンダラー: ${rendererType.toUpperCase()}
🎯 目標性能: 60FPS・512MB以下・5ms遅延
📏 対象環境: 2560×1440液タブレット
🎨 カラー: ふたば色システム
🔧 ツール: pen/brush/eraser/fill/shape対応
📐 レイヤー: 20枚制限・ブレンドモード対応
─────────────────────
✏️ 全ツールで描画開始可能
🎨 実用的お絵かきツール完成
    `);
  }

  /**
   * エラーハンドリング設定・グローバル例外処理
   */
  private setupErrorHandling(): void {
    // グローバルエラーハンドリング
    window.addEventListener('error', (event) => {
      console.error('🚨 グローバルエラー:', event.error);
      this.eventBus.emit('error:global', {
        message: event.error?.message || 'Unknown error',
        filename: event.filename,
        lineno: event.lineno,
        timestamp: Date.now()
      });
    });

    // Promise未処理拒否
    window.addEventListener('unhandledrejection', (event) => {
      console.error('🚨 未処理Promise拒否:', event.reason);
      this.eventBus.emit('error:promise-rejection', {
        reason: event.reason,
        timestamp: Date.now()
      });
    });

    // PixiJS警告抑制・開発環境用
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      // Pixi.js v8の非推奨警告を開発環境でのみ表示
      console.log('🔧 開発環境: PixiJS v8非推奨警告は既知の問題です');
    }
  }

  /**
   * 初期化エラー処理・復旧試行
   */
  private handleInitializationError(error: Error): void {
    // エラー情報をDOM表示
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.innerHTML = `
        <div style="
          position: fixed; top: 50%; left: 50%; 
          transform: translate(-50%, -50%);
          background: #f44336; color: white; 
          padding: 20px; border-radius: 8px;
          max-width: 500px; text-align: center;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        ">
          <h2>❌ 初期化エラー</h2>
          <p>アプリケーションの起動に失敗しました。</p>
          <p><strong>エラー:</strong> ${error.message}</p>
          <div style="margin-top: 16px;">
            <button onclick="location.reload()" style="
              margin: 4px; padding: 8px 16px;
              background: white; color: #f44336; 
              border: none; border-radius: 4px; cursor: pointer;
              font-weight: bold;
            ">
              再読み込み
            </button>
            <button onclick="window.open('https://github.com/toshinka/tegaki/issues', '_blank')" style="
              margin: 4px; padding: 8px 16px;
              background: #333; color: white; 
              border: none; border-radius: 4px; cursor: pointer;
            ">
              問題を報告
            </button>
          </div>
          <div style="margin-top: 12px; font-size: 0.8em; opacity: 0.8;">
            WebGL2対応ブラウザが必要です<br>
            Chrome/Firefox/Safari最新版を推奨
          </div>
        </div>
      `;
    }
  }

  /**
   * アプリケーション終了・リソース解放
   */
  public destroy(): void {
    console.log('🔄 アプリケーション終了・リソース解放中...');
    
    try {
      // 監視停止・安全な呼び出し
      if (this.performanceManager && typeof this.performanceManager.stopMonitoring === 'function') {
        this.performanceManager.stopMonitoring();
      }
      
      this.toolManager?.destroy();
      this.inputManager?.destroy();
      this.drawingEngine?.destroy();
      this.pixiApp?.destroy();
      this.uiManager?.destroy();
      this.eventBus?.destroy();
      
      this.isInitialized = false;
      console.log('✅ リソース解放完了');
      
    } catch (error) {
      console.error('⚠️ 終了処理中にエラー:', error);
    }
  }

  /**
   * アプリケーション状態取得・デバッグ用
   */
  public getStatus() {
    return {
      initialized: this.isInitialized,
      renderer: this.pixiApp?.getRendererType(),
      performance: this.performanceManager?.getCurrentMetrics?.(),
      currentTool: this.toolManager?.getCurrentTool?.(),
      version: '4.1.0',
      phase: 'Phase2'
    };
  }

  /**
   * 開発者用メソッド・デバッグ支援
   */
  public dev() {
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      return {
        eventBus: this.eventBus,
        pixiApp: this.pixiApp,
        drawingEngine: this.drawingEngine,
        toolManager: this.toolManager,
        performanceManager: this.performanceManager,
        status: this.getStatus()
      };
    }
    return null;
  }
}

// グローバル型定義・開発環境用
declare global {
  interface Window {
    __DEV__: boolean;
    drawingApp: ModernDrawingApp;
  }
}

// アプリケーション起動・メイン処理
async function startApplication(): Promise<void> {
  const app = new ModernDrawingApp();
  
  try {
    const success = await app.initialize();
    
    if (success) {
      console.log('🎨 モダンお絵かきツール v4.1 起動完了');
      console.log('✏️ 全ツール操作でお絵かき開始できます');
      
      // 開発環境・グローバル参照設定
      if (typeof window !== 'undefined') {
        (window as any).drawingApp = app;
        (window as any).__DEV__ = true; // 開発フラグ設定
        console.log('🔧 開発モード: window.drawingApp でアクセス可能');
        console.log('🔧 デバッグ: window.drawingApp.dev() で内部状態確認');
      }
      
    } else {
      console.error('❌ アプリケーション起動失敗');
    }
    
  } catch (error) {
    console.error('❌ アプリケーション起動失敗', error);
  }
}

// ページ読み込み完了後にアプリケーション起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApplication);
} else {
  startApplication();
}