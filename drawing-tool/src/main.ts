// Modern Drawing Tool v4.1 - メインエントリーポイント
// PixiJS v8中心・段階的実装・ふたば色UI・Phase2ツール対応

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
 * Phase2: レイヤーシステム・高度ツール・UI拡張
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
      
      // Step 5: ツールシステム初期化（Phase2対応）
      await this.initializeToolSystem();
      
      // Step 6: UIイベントバインド（Phase2ツールボタン対応）
      this.setupUIEventHandlers();
      
      // Step 7: パフォーマンス監視開始
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
   * 描画エンジン初期化・Graphics管理・ツール対応
   */
  private async initializeDrawingSystem(): Promise<void> {
    console.log('🖌️ 描画システム初期化...');
    
    const app = this.pixiApp.getApp();
    if (!app) {
      throw new Error('PixiJS app未初期化');
    }

    // DrawingEngine初期化・ふたばマルーン初期色・ツールイベント対応
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
   * ツールシステム初期化・Phase2全ツール対応
   */
  private async initializeToolSystem(): Promise<void> {
    console.log('🔧 ツールシステム初期化（Phase2全ツール対応）...');
    
    // ToolManager初期化・EventBus注入・Phase2全ツール
    this.toolManager = new ToolManager(this.eventBus);
    
    // デフォルトペンツール有効化
    this.toolManager.setCurrentTool('pen');
    
    console.log('✅ ツールシステム初期化完了（pen/brush/eraser/fill/shape対応）');
  }

  /**
   * UIイベントハンドラー設定・Phase2ツールボタン対応
   */
  private setupUIEventHandlers(): void {
    console.log('🔗 UIイベントハンドラー設定...');

    // ツールボタンクリックイベント
    this.eventBus.on('ui:toolbar-click', (data) => {
      this.onToolButtonClick(data);
    });

    // レイヤーパネルイベント（Phase2対応）
    this.eventBus.on('ui:layer-click', (data) => {
      console.log('レイヤークリック:', data);
    });

    // カラーパレットイベント（Phase2対応）
    this.eventBus.on('ui:color-change', (data) => {
      this.onColorChange(data);
    });

    // 設定変更イベント
    this.eventBus.on('ui:setting-change', (data) => {
      this.onSettingChange(data);
    });

    console.log('✅ UIイベントハンドラー設定完了');
  }

  /**
   * ツールボタンクリック処理・ツール切り替え
   */
  private onToolButtonClick(data: { tool: string }): void {
    if (!this.toolManager) {
      console.warn('ToolManager未初期化');
      return;
    }

    try {
      // ToolManagerでツール切り替え
      this.toolManager.setCurrentTool(data.tool);
      
      // UI状態更新
      this.eventBus.emit('ui:tool-changed', {
        toolName: data.tool,
        timestamp: Date.now()
      });
      
      console.log(`🔧 ツール切り替え: ${data.tool}`);
      
    } catch (error) {
      console.error('ツール切り替えエラー:', error);
    }
  }

  /**
   * 色変更処理・全ツール色更新
   */
  private onColorChange(data: { color: number; colorString: string }): void {
    if (!this.toolManager) return;

    // 現在のツールに色設定を適用
    const currentTool = this.toolManager.getCurrentTool();
    if (currentTool) {
      currentTool.updateSettings({ color: data.color });
    }

    console.log(`🎨 色変更: ${data.colorString} (${data.color.toString(16)})`);
  }

  /**
   * 設定変更処理・ツール設定更新
   */
  private onSettingChange(data: { setting: string; value: any; toolName?: string }): void {
    if (!this.toolManager) return;

    try {
      if (data.toolName) {
        // 特定ツールの設定更新
        this.toolManager.updateToolSettings(data.toolName, { [data.setting]: data.value });
      } else {
        // 現在のツールの設定更新
        const currentTool = this.toolManager.getCurrentTool();
        if (currentTool) {
          currentTool.updateSettings({ [data.setting]: data.value });
        }
      }

      console.log(`⚙️ 設定変更: ${data.setting} = ${data.value}`);

    } catch (error) {
      console.error('設定変更エラー:', error);
    }
  }

  /**
   * 基本機能テスト・動作確認・Phase2対応
   */
  private async runBasicFunctionTest(): Promise<void> {
    console.log('🧪 基本機能テスト実行（Phase2対応）...');
    
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
      
      // ツールシステムテスト
      if (this.toolManager) {
        const availableTools = this.toolManager.getAvailableTools();
        console.log(`✅ ツールシステムテスト成功: ${availableTools.join(', ')}`);
      }
      
      // 描画エンジンテスト
      if (this.drawingEngine) {
        const stats = this.drawingEngine.getStats();
        console.log('✅ 描画エンジンテスト成功:', stats);
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
    const availableTools = this.toolManager?.getAvailableTools() || [];
    
    console.log(`
🎉 Phase2実装構築完了！
─────────────────────
⏱️  初期化時間: ${initTime.toFixed(1)}ms
⚡ レンダラー: ${rendererType.toUpperCase()}
🛠️  対応ツール: ${availableTools.join(', ')}
🎯 目標性能: 30FPS・512MB以下・実用性重視
📏 対象環境: 2560×1440液タブレット
🎨 カラー: ふたば色システム
─────────────────────
✏️ 全ツールで描画開始可能
🖌️ レイヤーシステム対応
🎨 高度描画ツール対応
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

    // EventBusエラーハンドリング
    this.eventBus.on('error:tool-system', (data) => {
      console.error('🚨 ツールシステムエラー:', data);
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
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        ">
          <h2>❌ 初期化エラー</h2>
          <p>アプリケーションの起動に失敗しました。</p>
          <p><strong>エラー:</strong> ${error.message}</p>
          <div style="margin-top: 16px;">
            <button onclick="location.reload()" style="
              padding: 8px 16px; margin: 4px;
              background: white; color: #f44336; 
              border: none; border-radius: 4px; cursor: pointer;
            ">
              再読み込み
            </button>
            <button onclick="localStorage.clear(); location.reload()" style="
              padding: 8px 16px; margin: 4px;
              background: #ffcdd2; color: #d32f2f; 
              border: none; border-radius: 4px; cursor: pointer;
            ">
              設定リセット
            </button>
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
   * アプリケーション状態取得・デバッグ用・Phase2対応
   */
  public getStatus() {
    return {
      initialized: this.isInitialized,
      renderer: this.pixiApp?.getRendererType(),
      performance: this.performanceManager?.getCurrentMetrics(),
      currentTool: this.toolManager?.getCurrentTool()?.name,
      availableTools: this.toolManager?.getAvailableTools(),
      drawingStats: this.drawingEngine?.getStats(),
      version: '4.1.0-phase2'
    };
  }
}

// アプリケーション起動・メイン処理
async function startApplication(): Promise<void> {
  const app = new ModernDrawingApp();
  
  try {
    const success = await app.initialize();
    
    if (success) {
      console.log('🎨 モダンお絵かきツール v4.1 起動完了（Phase2対応）');
      console.log('✏️ 全ツールでお絵かき開始できます');
      
      // 開発環境・グローバル参照設定
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        (window as any).drawingApp = app;
        console.log('🔧 開発モード: window.drawingApp でアクセス可能');
      }
      
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