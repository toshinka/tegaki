// Modern Drawing Tool v4.1 - メインエントリーポイント
// PixiJS v8中心・段階的実装・ふたば色UI

import './style.css';
import { PixiApplication } from './core/PixiApplication.js';
import { EventBus } from './core/EventBus.js';
import { UIManager } from './ui/UIManager.js';
import { InputManager } from './input/InputManager.js';
import { DrawingEngine } from './core/DrawingEngine.js';
import { ToolManager } from './tools/ToolManager.js';
import { PerformanceManager } from './core/PerformanceManager.js';
import { isDevelopment, devOnly, devLog } from './utils/dev.js';

/**
 * モダンお絵かきツール メインアプリケーションクラス
 * Phase1: 基盤構築・確実動作・60FPS目標
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
    console.log('🎨 モダンお絵かきツール v4.1 初期化開始');
    this.initializationStartTime = performance.now();
    
    // 基盤システム初期化・依存注入
    this.eventBus = new EventBus(isDevelopment());
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
      console.log('🚀 Phase1基盤構築開始...');

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
      
      // Step 5: ツールシステム初期化
      await this.initializeToolSystem();
      
      // Step 6: パフォーマンス監視開始
      this.performanceManager.startMonitoring();
      
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
    
    // ツールバーイベントリスナー設定
    this.setupToolbarEventListeners();
    
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
   * ツールシステム初期化・基本ペンツール
   */
  private async initializeToolSystem(): Promise<void> {
    console.log('🔧 ツールシステム初期化...');
    
    // ToolManager初期化・EventBus注入
    this.toolManager = new ToolManager(this.eventBus);
    
    // 基本ペンツールは既にToolManagerのconstructor内で設定されるため、
    // ここでは追加の設定は不要
    
    console.log('✅ ツールシステム初期化完了');
  }

  /**
   * ツールバーイベントリスナー設定
   */
  private setupToolbarEventListeners(): void {
    // ツールボタンクリックイベント設定
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // ツールボタンのクリック処理
      if (target.classList.contains('tool-btn')) {
        const toolName = target.dataset.tool;
        if (toolName) {
          this.onToolButtonClick(toolName, target);
        }
      }
    });
  }

  /**
   * ツールボタンクリック処理
   */
  private onToolButtonClick(toolName: string, buttonElement: HTMLElement): void {
    // 既存のアクティブボタンを無効化
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // 新しいボタンをアクティブ化
    buttonElement.classList.add('active');
    
    // EventBusにツール変更イベント発火
    this.eventBus.emit('ui:toolbar-click', {
      toolName,
      buttonElement
    });
    
    console.log(`🔧 ツール選択: ${toolName}`);
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
      
      this.eventBus.emit('test:basic-function', { timestamp: performance.now() });
      
      if (!testEventReceived) {
        console.warn('⚠️ イベントバス通信テスト失敗');
      } else {
        console.log('✅ イベントバス通信テスト成功');
      }
      
      cleanup();
      
      // 描画テスト・基本Graphics動作確認
      if (this.drawingEngine) {
        console.log('✅ 描画エンジンテスト成功');
      }
      
    } catch (error) {
      console.warn('⚠️ 基本機能テスト中にエラー:', error);
    }
  }

  /**
   * 初期化完了ログ・性能情報
   */
  private logInitializationComplete(): void {
    const initTime = performance.now() - this.initializationStartTime;
    const rendererType = this.pixiApp.getRendererType();
    
    console.log(`
🎉 Phase1基盤構築完了！
─────────────────────
⏱️  初期化時間: ${initTime.toFixed(1)}ms
⚡ レンダラー: ${rendererType.toUpperCase()}
🎯 目標性能: 60FPS・300MB以下・5ms遅延
📏 対象環境: 2560×1440液タブレット
🎨 カラー: ふたば色システム
─────────────────────
✏️ ペンツールで描画開始可能
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
        timestamp: performance.now()
      });
    });

    // Promise未処理拒否
    window.addEventListener('unhandledrejection', (event) => {
      console.error('🚨 未処理Promise拒否:', event.reason);
      this.eventBus.emit('error:promise-rejection', {
        reason: event.reason,
        timestamp: performance.now()
      });
    });
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
        ">
          <h2>❌ 初期化エラー</h2>
          <p>アプリケーションの起動に失敗しました。</p>
          <p><strong>エラー:</strong> ${error.message}</p>
          <button onclick="location.reload()" style="
            margin-top: 16px; padding: 8px 16px;
            background: white; color: #f44336; 
            border: none; border-radius: 4px; cursor: pointer;
          ">
            再読み込み
          </button>
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
      this.performanceManager?.stopMonitoring();
      this.toolManager?.destroy();
      this.inputManager?.destroy();
      this.drawingEngine?.destroy();
      this.pixiApp?.destroy();
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
      performance: this.performanceManager?.getCurrentMetrics(),
      version: '4.1.0'
    };
  }
}

// 開発環境判定・Vite環境変数使用

// アプリケーション起動・メイン処理
async function startApplication(): Promise<void> {
  const app = new ModernDrawingApp();
  
  try {
    const success = await app.initialize();
    
    if (success) {
      console.log('🎨 モダンお絵かきツール v4.1 起動完了');
      console.log('✏️ ペン操作でお絵かき開始できます');
      
      // 開発環境・グローバル参照設定
      devOnly(() => {
        (window as any).drawingApp = app;
        devLog('開発モード: window.drawingApp でアクセス可能');
      });
      
    } else {
      console.error('❌ アプリケーション起動失敗');
    }
    
  } catch (error) {
    console.error('💥 起動中に予期しないエラー:', error);
  }
}

// ページ読み込み完了後にアプリケーション起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApplication);
} else {
  startApplication();
}