// main.ts - アプリケーション統合エントリーポイント
// システム初期化・Phase1基盤構築・2.5K環境最適化

import { PixiApplication } from './core/PixiApplication.js';
import { EventBus } from './core/EventBus.js';
import { PerformanceManager } from './core/PerformanceManager.js';
import { DrawingEngine } from './core/DrawingEngine.js';
import { InputManager } from './input/InputManager.js';
import { UIManager } from './ui/UIManager.js';

/**
 * アプリケーション設定・2.5K環境特化
 */
interface IAppConfig {
  canvas: {
    width: number;
    height: number;
    targetWidth: number;  // 2.5K幅
    targetHeight: number; // 2.5K高さ
  };
  performance: {
    targetFPS: number;
    memoryLimit: number;
    enableMonitoring: boolean;
  };
  rendering: {
    antialias: boolean;
    resolution: number;
    backgroundColor: number;
    preserveDrawingBuffer: boolean;
  };
  environment: {
    isDevelopment: boolean;
    enableDebug: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * アプリケーション状態管理
 */
interface IAppState {
  isInitialized: boolean;
  isRunning: boolean;
  currentPhase: 'loading' | 'initializing' | 'ready' | 'running' | 'error';
  errorMessage: string | null;
  initStartTime: number;
  initEndTime: number;
}

/**
 * モダンお絵かきツール・メインアプリケーション
 * Phase1実装・確実な基盤構築
 */
class ModernDrawingApp {
  // システムコンポーネント
  private eventBus: EventBus;
  private pixiApp: PixiApplication | null = null;
  private performanceManager: PerformanceManager | null = null;
  private drawingEngine: DrawingEngine | null = null;
  private inputManager: InputManager | null = null;
  private uiManager: UIManager | null = null;
  
  // アプリケーション状態
  private config: IAppConfig;
  private state: IAppState;
  
  // DOM要素参照
  private appContainer: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;

  constructor() {
    console.log('🚀 ModernDrawingApp初期化開始');
    
    // 設定・状態初期化
    this.config = this.createDefaultConfig();
    this.state = this.createInitialState();
    
    // EventBus作成・中央集権通信
    this.eventBus = new EventBus();
    
    // エラーハンドリング設定
    this.setupErrorHandling();
    
    // 初期化開始
    this.initialize().catch((error) => {
      this.handleInitializationError(error);
    });
  }

  /**
   * アプリケーション初期化・段階的構築
   */
  private async initialize(): Promise<void> {
    try {
      this.state.currentPhase = 'initializing';
      this.state.initStartTime = performance.now();
      
      console.log('📋 Phase1初期化開始: 基盤システム構築');
      
      // Step 1: 環境確認・2.5K環境チェック
      await this.checkEnvironment();
      
      // Step 2: DOM要素準備・UIコンテナ作成
      await this.setupDOMStructure();
      
      // Step 3: PixiJS初期化・WebGL2確実動作
      await this.initializePixiApplication();
      
      // Step 4: 性能監視システム開始
      await this.initializePerformanceManager();
      
      // Step 5: UI システム構築・ふたば色適用
      await this.initializeUIManager();
      
      // Step 6: 入力システム統合・マウス/ペン対応
      await this.initializeInputManager();
      
      // Step 7: 描画エンジン・Graphics統合
      await this.initializeDrawingEngine();
      
      // Step 8: システム統合・イベント連携
      await this.integrateAllSystems();
      
      // 初期化完了
      this.state.currentPhase = 'ready';
      this.state.isInitialized = true;
      this.state.initEndTime = performance.now();
      
      // アプリケーション開始
      await this.startApplication();
      
      const initTime = this.state.initEndTime - this.state.initStartTime;
      console.log(`✅ Phase1初期化完了: ${initTime.toFixed(2)}ms`);
      
    } catch (error) {
      throw new Error(`初期化失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 環境確認・2.5K環境チェック
   */
  private async checkEnvironment(): Promise<void> {
    console.log('🔍 環境確認中...');
    
    // 画面解像度チェック
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    console.log(`画面解像度: ${screenWidth}×${screenHeight}`);
    console.log(`ウィンドウサイズ: ${windowWidth}×${windowHeight}`);
    
    // 2.5K環境推奨警告
    if (windowWidth < 2560 || windowHeight < 1440) {
      console.warn('⚠️ 2.5K環境推奨: 最適なエクスペリエンスには2560×1440以上が必要です');
    }
    
    // WebGL2対応確認
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (!gl2) {
      throw new Error('WebGL2未対応: このブラウザではアプリケーションを実行できません');
    }
    
    // デバイスピクセル比確認
    const dpr = window.devicePixelRatio || 1;
    console.log(`デバイスピクセル比: ${dpr}`);
    
    // メモリ情報（Chrome）
    const memory = (performance as any).memory;
    if (memory) {
      const memoryMB = memory.usedJSHeapSize / (1024 * 1024);
      console.log(`初期メモリ使用量: ${memoryMB.toFixed(1)}MB`);
    }
    
    console.log('✅ 環境確認完了');
  }

  /**
   * DOM構造準備・UIコンテナ作成
   */
  private async setupDOMStructure(): Promise<void> {
    console.log('🏗️ DOM構造構築中...');
    
    // メインアプリコンテナ取得/作成
    this.appContainer = document.getElementById('app');
    if (!this.appContainer) {
      this.appContainer = document.createElement('div');
      this.appContainer.id = 'app';
      document.body.appendChild(this.appContainer);
    }
    
    // 基本スタイル適用
    document.body.style.cssText = `
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #ffffee;
    `;
    
    this.appContainer.style.cssText = `
      width: 100vw;
      height: 100vh;
      position: relative;
    `;
    
    console.log('✅ DOM構造構築完了');
  }

  /**
   * PixiJS初期化・WebGL2確実動作
   */
  private async initializePixiApplication(): Promise<void> {
    console.log('🖼️ PixiJS初期化中...');
    
    if (!this.appContainer) {
      throw new Error('アプリコンテナが見つかりません');
    }
    
    // PixiApplication初期化
    this.pixiApp = new PixiApplication(this.eventBus);
    
    // 初期化実行
    await this.pixiApp.initialize({
      width: this.config.canvas.width,
      height: this.config.canvas.height,
      antialias: this.config.rendering.antialias,
      resolution: this.config.rendering.resolution,
      backgroundColor: this.config.rendering.backgroundColor,
      preserveDrawingBuffer: this.config.rendering.preserveDrawingBuffer
    });
    
    console.log('✅ PixiJS初期化完了');
  }

  /**
   * 性能監視システム初期化
   */
  private async initializePerformanceManager(): Promise<void> {
    console.log('📊 性能監視システム初期化中...');
    
    this.performanceManager = new PerformanceManager(this.eventBus);
    
    if (this.config.performance.enableMonitoring) {
      this.performanceManager.startMonitoring();
    }
    
    // 性能イベントリスナー設定
    this.eventBus.on('performance:warning', (data) => {
      console.warn(`⚠️ 性能警告: ${data.data.message}`);
    });
    
    this.eventBus.on('performance:level-change', (data) => {
      console.log(`📊 性能レベル変更: ${data.data.level}`);
    });
    
    console.log('✅ 性能監視システム初期化完了');
  }

  /**
   * UIシステム初期化・ふたば色適用
   */
  private async initializeUIManager(): Promise<void> {
    console.log('🎨 UIシステム初期化中...');
    
    if (!this.appContainer) {
      throw new Error('アプリコンテナが見つかりません');
    }
    
    this.uiManager = new UIManager(this.appContainer, this.eventBus);
    
    console.log('✅ UIシステム初期化完了');
  }

  /**
   * 入力システム初期化・マウス/ペン統合
   */
  private async initializeInputManager(): Promise<void> {
    console.log('🎮 入力システム初期化中...');
    
    if (!this.pixiApp) {
      throw new Error('PixiApplicationが初期化されていません');
    }
    
    const canvas = this.pixiApp.getCanvas();
    if (!canvas) {
      throw new Error('Canvasが取得できません');
    }
    
    this.inputManager = new InputManager(canvas, this.eventBus);
    
    console.log('✅ 入力システム初期化完了');
  }

  /**
   * 描画エンジン初期化・Graphics統合
   */
  private async initializeDrawingEngine(): Promise<void> {
    console.log('🖌️ 描画エンジン初期化中...');
    
    if (!this.pixiApp) {
      throw new Error('PixiApplicationが初期化されていません');
    }
    
    const app = this.pixiApp.getApplication();
    if (!app) {
      throw new Error('PIXI.Applicationが取得できません');
    }
    
    this.drawingEngine = new DrawingEngine(app, this.eventBus);
    
    console.log('✅ 描画エンジン初期化完了');
  }

  /**
   * システム統合・イベント連携
   */
  private async integrateAllSystems(): Promise<void> {
    console.log('🔗 システム統合中...');
    
    // Canvas要素をUIに統合
    if (this.pixiApp && this.appContainer) {
      const canvas = this.pixiApp.getCanvas();
      const canvasWrapper = document.getElementById('canvas-wrapper');
      
      if (canvas && canvasWrapper) {
        canvasWrapper.appendChild(canvas);
        console.log('✅ Canvas統合完了');
      }
    }
    
    // 性能データのUI更新連携
    this.eventBus.on('performance:update', (data) => {
      // UI側でパフォーマンス表示更新
      this.eventBus.emit('ui:performance-update', data);
    });
    
    // アプリケーション全体イベント設定
    this.setupApplicationEvents();
    
    console.log('✅ システム統合完了');
  }

  /**
   * アプリケーションイベント設定
   */
  private setupApplicationEvents(): void {
    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => {
      this.handleWindowResize();
    });
    
    // ページ離脱時クリーンアップ
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
    
    // エラー回復処理
    this.eventBus.on('app:error', (data) => {
      this.handleApplicationError(data.data);
    });
    
    // フォーカス管理
    window.addEventListener('focus', () => {
      this.handleFocusGain();
    });
    
    window.addEventListener('blur', () => {
      this.handleFocusLoss();
    });
  }

  /**
   * アプリケーション開始
   */
  private async startApplication(): Promise<void> {
    console.log('🚀 アプリケーション開始...');
    
    this.state.currentPhase = 'running';
    this.state.isRunning = true;
    
    // 初期化完了イベント発火
    this.eventBus.emit('app:ready', {
      type: 'app:ready',
      timestamp: performance.now(),
      data: {
        initTime: this.state.initEndTime - this.state.initStartTime,
        phase: 'Phase1',
        features: ['drawing', 'ui', 'input', 'performance']
      }
    });
    
    // メインループ開始（必要に応じて）
    this.startMainLoop();
    
    console.log('✅ アプリケーション開始完了');
  }

  /**
   * メインループ開始
   */
  private startMainLoop(): void {
    const update = (timestamp: number) => {
      if (!this.state.isRunning) return;
      
      // 性能データ更新通知
      if (this.performanceManager) {
        const metrics = this.performanceManager.getCurrentMetrics();
        this.eventBus.emit('performance:update', {
          type: 'performance:update',
          timestamp,
          data: {
            fps: metrics.currentFPS,
            memory: metrics.memoryUsed,
            cpu: metrics.cpuUsage,
            gpu: metrics.gpuUsage
          }
        });
      }
      
      requestAnimationFrame(update);
    };
    
    requestAnimationFrame(update);
  }

  /**
   * ウィンドウリサイズ処理
   */
  private handleWindowResize(): void {
    if (this.pixiApp) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Canvas領域のサイズ調整（ツールバー・パネル分を差し引き）
      const canvasWidth = width - 80 - 400; // ツールバー80px + パネル400px
      const canvasHeight = height;
      
      this.pixiApp.resize(canvasWidth, canvasHeight);
      
      console.log(`📐 リサイズ: ${canvasWidth}×${canvasHeight}`);
    }
  }

  /**
   * フォーカス取得処理
   */
  private handleFocusGain(): void {
    if (this.performanceManager && this.config.performance.enableMonitoring) {
      this.performanceManager.startMonitoring();
    }
    
    console.log('👁️ アプリケーションフォーカス取得');
  }

  /**
   * フォーカス喪失処理
   */
  private handleFocusLoss(): void {
    // 性能監視を一時停止してリソース節約
    if (this.performanceManager) {
      this.performanceManager.stopMonitoring();
    }
    
    console.log('😴 アプリケーションフォーカス喪失');
  }

  /**
   * エラーハンドリング設定
   */
  private setupErrorHandling(): void {
    // 未処理エラー捕捉
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error);
    });
    
    // Promise未処理拒否捕捉
    window.addEventListener('unhandledrejection', (event) => {
      this.handleGlobalError(event.reason);
    });
  }

  /**
   * グローバルエラー処理
   */
  private handleGlobalError(error: any): void {
    console.error('🚨 グローバルエラー:', error);
    
    this.state.currentPhase = 'error';
    this.state.errorMessage = error instanceof Error ? error.message : String(error);
    
    // エラー通知
    this.eventBus.emit('app:error', {
      type: 'app:error',
      timestamp: performance.now(),
      data: {
        error: this.state.errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }
    });
  }

  /**
   * 初期化エラー処理
   */
  private handleInitializationError(error: any): void {
    console.error('🚨 初期化エラー:', error);
    
    this.state.currentPhase = 'error';
    this.state.errorMessage = error instanceof Error ? error.message : String(error);
    
    // エラー表示UI作成
    this.showErrorUI(this.state.errorMessage);
  }

  /**
   * アプリケーションエラー処理
   */
  private handleApplicationError(errorData: any): void {
    console.error('🚨 アプリケーションエラー:', errorData);
    
    // 復旧試行
    this.attemptRecovery();
  }

  /**
   * エラー復旧試行
   */
  private attemptRecovery(): void {
    console.log('🔄 エラー復旧試行中...');
    
    // 基本的な復旧処理
    try {
      if (this.drawingEngine) {
        this.drawingEngine.clearCanvas();
      }
      
      if (this.performanceManager) {
        this.performanceManager.stopMonitoring();
        this.performanceManager.startMonitoring();
      }
      
      console.log('✅ エラー復旧成功');
    } catch (recoveryError) {
      console.error('❌ エラー復旧失敗:', recoveryError);
    }
  }

  /**
   * エラーUI表示
   */
  private showErrorUI(message: string): void {
    if (!this.appContainer) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #dc3545;
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-size: 16px;
      text-align: center;
      z-index: 10000;
      max-width: 80%;
    `;
    
    errorDiv.innerHTML = `
      <h2>🚨 エラーが発生しました</h2>
      <p>${message}</p>
      <button onclick="location.reload()" style="
        margin-top: 10px;
        padding: 8px 16px;
        background: white;
        color: #dc3545;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      ">ページを再読み込み</button>
    `;
    
    this.appContainer.appendChild(errorDiv);
  }

  /**
   * クリーンアップ処理
   */
  private cleanup(): void {
    console.log('🧹 クリーンアップ開始...');
    
    this.state.isRunning = false;
    
    // 各システムのクリーンアップ
    if (this.inputManager) {
      this.inputManager.destroy();
    }
    
    if (this.drawingEngine) {
      this.drawingEngine.destroy();
    }
    
    if (this.uiManager) {
      this.uiManager.destroy();
    }
    
    if (this.performanceManager) {
      this.performanceManager.destroy();
    }
    
    if (this.pixiApp) {
      this.pixiApp.destroy();
    }
    
    console.log('✅ クリーンアップ完了');
  }

  /**
   * デフォルト設定作成
   */
  private createDefaultConfig(): IAppConfig {
    return {
      canvas: {
        width: 1024,
        height: 768,
        targetWidth: 2560,
        targetHeight: 1440
      },
      performance: {
        targetFPS: 60,
        memoryLimit: 1024, // 1GB
        enableMonitoring: true
      },
      rendering: {
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        backgroundColor: 0xffffee, // ふたば色背景
        preserveDrawingBuffer: true
      },
      environment: {
        isDevelopment: import.meta.env?.MODE === 'development',
        enableDebug: import.meta.env?.MODE === 'development',
        logLevel: import.meta.env?.MODE === 'development' ? 'debug' : 'info'
      }
    };
  }

  /**
   * 初期状態作成
   */
  private createInitialState(): IAppState {
    return {
      isInitialized: false,
      isRunning: false,
      currentPhase: 'loading',
      errorMessage: null,
      initStartTime: 0,
      initEndTime: 0
    };
  }

  /**
   * アプリケーション状態取得
   */
  public getState(): IAppState {
    return { ...this.state };
  }

  /**
   * アプリケーション設定取得
   */
  public getConfig(): IAppConfig {
    return { ...this.config };
  }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 モダンお絵かきツール Phase1 開始');
  new ModernDrawingApp();
});

// エクスポート（必要に応じて）
export { ModernDrawingApp };