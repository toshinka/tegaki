// src/main.ts - アプリケーション統合・Phase1完成・動作確認

import { PixiApplication } from './core/PixiApplication.js';
import { EventBus } from './core/EventBus.js';
import { DrawingEngine } from './core/DrawingEngine.js';
import { InputManager } from './input/InputManager.js';
import { PerformanceManager } from './core/PerformanceManager.js';
import { UIManager } from './ui/UIManager.js';
import { PenTool } from './tools/PenTool.js';
import { EraserTool } from './tools/EraserTool.js';

class ModernDrawingApp {
  // Phase1基盤システム・Claude理解容易・責任分界
  private pixiApp: PixiApplication;
  private eventBus: EventBus;
  private drawingEngine: DrawingEngine | null = null;
  private inputManager: InputManager | null = null;
  private performanceManager: PerformanceManager;
  private uiManager: UIManager;
  
  // Phase1基本ツール・Phase2拡張準備
  private penTool: PenTool;
  private eraserTool: EraserTool;
  private currentTool: PenTool | EraserTool;

  constructor() {
    console.log('🎨 モダンお絵かきツール v4.0 Phase1 起動準備...');
    
  constructor() {
    console.log('🎨 モダンお絵かきツール v4.0 Phase1 起動準備...');
    
    // 基盤システム初期化・順序重要・依存関係
    this.eventBus = new EventBus();
    this.pixiApp = new PixiApplication();
    this.performanceManager = new PerformanceManager(this.eventBus);
    this.uiManager = new UIManager(this.eventBus, document.getElementById('app')!);
    
    // ツール初期化・Phase1基本・Phase2拡張
    this.penTool = new PenTool();
    this.eraserTool = new EraserTool();
    this.currentTool = this.penTool; // ペン初期選択
  }

  // 段階的初期化・エラー処理・復旧機能・品質保証
  public async initialize(): Promise<boolean> {
    try {
      console.log('📋 Phase1初期化シーケンス開始...');

      // Step 1: UI初期化・レイアウト構築
      console.log('🎨 UI初期化中...');
      await this.uiManager.initializeBasicUI();

      // Step 2: PixiJS初期化・WebGL2確実・2.5K対応
      console.log('🏗️ PixiJS初期化中...');
      const canvasContainer = this.uiManager.getCanvasContainer();
      if (!canvasContainer) throw new Error('Canvas container not found');

      const success = await this.pixiApp.initialize(canvasContainer);
      if (!success) throw new Error('PixiJS initialization failed');

      // Step 3: 描画エンジン初期化・Graphics管理
      console.log('🖊️ 描画エンジン初期化中...');
      const app = this.pixiApp.getApp();
      if (!app) throw new Error('PixiJS app not available');
      this.drawingEngine = new DrawingEngine(app, this.eventBus);

      // Step 4: 入力管理初期化・筆圧・座標変換
      console.log('🎮 入力システム初期化中...');
      const canvas = this.pixiApp.getCanvas();
      if (!canvas) throw new Error('Canvas not available');
      this.inputManager = new InputManager(this.eventBus, canvas);

      // Step 5: イベント統合・UI連携・ツール制御
      console.log('⚡ イベントシステム統合中...');
      this.setupEventListeners();

      // Step 6: ツール初期化・ペン有効化
      console.log('🔧 ツールシステム初期化中...');
      this.currentTool.activate();

      // Step 7: キーボードショートカット設定
      console.log('⌨️ ショートカット設定中...');
      this.uiManager.setupKeyboardShortcuts();

      // Step 8: 性能監視開始・60FPS・1GB監視
      console.log('📊 性能監視開始中...');
      this.performanceManager.startMonitoring();

      // 初期化完了・成功ログ・デバッグ情報
      console.log('✅ Phase1初期化完了！');
      console.log(`📱 レンダラー: ${this.pixiApp.getRendererType()}`);
      console.log(`🎯 キャンバス: ${canvas.width}x${canvas.height}`);
      console.log(`🖥️ 解像度: ${window.innerWidth}x${window.innerHeight}`);
      console.log('🎨 描画テスト開始可能 - マウス・ペンで描画してください');
      
      // 使用方法案内
      this.showUsageInstructions();
      
      return true;

    } catch (error) {
      console.error('❌ Phase1初期化失敗:', error);
      this.showErrorMessage(error as Error);
      return false;
    }
  }

  // イベントリスナー統合・UI←→Core連携・ツール制御
  private setupEventListeners(): void {
    // UI→ツール連携・切り替え制御
    this.eventBus.on('ui:toolbar-click', (data) => {
      console.log(`🔧 ツール切り替え: ${data.tool}`);
      
      // 現在ツール無効化
      this.currentTool.deactivate();
      
      // 新ツール有効化
      switch (data.tool) {
        case 'pen':
          this.currentTool = this.penTool;
          break;
        case 'eraser':
          this.currentTool = this.eraserTool;
          break;
        default:
          console.warn(`未知のツール: ${data.tool}`);
          this.currentTool = this.penTool; // フォールバック
      }
      
      this.currentTool.activate();
      
      // ツール切り替え通知
      this.eventBus.emit('tool:change', {
        toolName: data.tool,
        previousTool: this.currentTool === this.penTool ? 'eraser' : 'pen'
      });
    });

    // UI→描画連携・色変更・リアルタイム反映
    this.eventBus.on('ui:color-change', (data) => {
      console.log(`🎨 色変更: #${data.color.toString(16).padStart(6, '0')}`);
      
      // ツール設定更新・Phase2で強化予定
      if (this.currentTool === this.penTool) {
        this.penTool.setColor(data.color);
      }
      
      // DrawingEngineに直接通知・既存の仕組み活用
    });

    // 性能監視・警告・調整・ユーザー通知
    this.eventBus.on('performance:fps-low', (data) => {
      console.warn(`⚠️ FPS低下警告: ${data.currentFPS.toFixed(1)}fps`);
      this.showPerformanceWarning(
        'フレームレート低下', 
        `現在: ${data.currentFPS.toFixed(1)}fps（目標: ${data.targetFPS}fps）`
      );
    });

    this.eventBus.on('performance:memory-warning', (data) => {
      console.warn(`⚠️ メモリ使用量警告: ${data.used.toFixed(0)}MB`);
      this.showPerformanceWarning(
        'メモリ使用量増加', 
        `現在: ${data.used.toFixed(0)}MB / ${data.limit}MB`
      );
    });

    // 描画イベント・ツール連携・統合制御
    this.eventBus.on('drawing:start', (data) => {
      this.currentTool.onPointerDown(data);
    });

    this.eventBus.on('drawing:move', (data) => {
      this.currentTool.onPointerMove(data);
    });

    this.eventBus.on('drawing:end', (data) => {
      this.currentTool.onPointerUp(data);
    });
  }

  // 使用方法案内・初回ユーザー支援
  private showUsageInstructions(): void {
    const instructionDiv = document.createElement('div');
    instructionDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: var(--futaba-cream); border: 2px solid var(--futaba-maroon);
      padding: 24px; border-radius: 12px; max-width: 400px;
      text-align: center; z-index: 10000; font-family: inherit;
      box-shadow: 0 8px 24px rgba(128, 0, 0, 0.3);
    `;
    
    instructionDiv.innerHTML = `
      <h3 style="color: var(--futaba-maroon); margin-bottom: 16px; font-size: 18px;">
        🎨 Phase1 お絵かきツール
      </h3>
      <div style="text-align: left; margin-bottom: 16px; color: var(--text-primary); line-height: 1.5;">
        <p><strong>📝 基本操作:</strong></p>
        <ul style="margin: 8px 0 0 20px;">
          <li>マウス・ペンタブレットで描画</li>
          <li>ツールバー: ペン・消しゴム切り替え</li>
          <li>色パレット: 色選択・リアルタイム反映</li>
        </ul>
        
        <p style="margin-top: 12px;"><strong>⌨️ ショートカット:</strong></p>
        <ul style="margin: 8px 0 0 20px;">
          <li><code>P</code>: ペンツール</li>
          <li><code>E</code>: 消しゴムツール</li>
        </ul>
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: var(--futaba-maroon); color: white; border: none;
        padding: 10px 20px; border-radius: 6px; cursor: pointer;
        font-size: 14px; font-weight: 500;
      ">開始する</button>
    `;
    
    document.body.appendChild(instructionDiv);
    
    // 10秒後自動削除
    setTimeout(() => {
      if (document.body.contains(instructionDiv)) {
        document.body.removeChild(instructionDiv);
      }
    }, 10000);
  }

  // エラー表示・ユーザー通知・復旧案内
  private showErrorMessage(error: Error): void {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #f44336; color: white; padding: 20px; border-radius: 8px;
      max-width: 400px; text-align: center; z-index: 10000;
      font-family: inherit;
    `;
    errorDiv.innerHTML = `
      <h3>初期化エラー</h3>
      <p>アプリケーションの初期化に失敗しました。</p>
      <p><small>${error.message}</small></p>
      <div style="margin-top: 16px;">
        <p>推奨環境:</p>
        <ul style="text-align: left; margin: 8px 0 16px 20px;">
          <li>Chrome/Edge最新版</li>
          <li>2560×1440以上の解像度</li>
          <li>WebGL2対応GPU</li>
        </ul>
      </div>
      <button onclick="location.reload()" style="
        background: white; color: #f44336; border: none; padding: 8px 16px;
        border-radius: 4px; cursor: pointer; margin-top: 10px; font-weight: bold;
      ">ページを再読み込み</button>
    `;
    document.body.appendChild(errorDiv);
  }

  // 性能警告・ユーザー通知・一時表示
  private showPerformanceWarning(title: string, message: string): void {
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: var(--warning); color: white; padding: 12px 16px;
      border-radius: 4px; z-index: 9999; max-width: 300px;
      font-family: inherit; font-size: 14px;
      box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
    `;
    warningDiv.innerHTML = `<strong>${title}</strong><br><small>${message}</small>`;
    document.body.appendChild(warningDiv);
    
    // 5秒後自動削除
    setTimeout(() => {
      if (document.body.contains(warningDiv)) {
        document.body.removeChild(warningDiv);
      }
    }, 5000);
  }

  // アプリケーション状態取得・デバッグ・監視用
  public getAppStatus(): {
    initialized: boolean;
    renderer: string;
    performance: any;
    ui: any;
    currentTool: string;
  } {
    return {
      initialized: this.drawingEngine !== null && this.inputManager !== null,
      renderer: this.pixiApp.getRendererType(),
      performance: this.performanceManager.getCurrentMetrics(),
      ui: this.uiManager.getUIState(),
      currentTool: this.currentTool.name
    };
  }

  // 統計情報取得・分析・最適化
  public getDetailedStats(): {
    pixi: any;
    drawing: any;
    input: any;
    performance: any;
    eventBus: any;
  } {
    return {
      pixi: this.pixiApp.getRenderStats(),
      drawing: this.drawingEngine?.getDrawingStats(),
      input: this.inputManager?.getInputStats(),
      performance: this.performanceManager.getDetailedStats(),
      eventBus: this.eventBus.getStats()
    };
  }

  // アプリケーション終了・リソース解放・メモリリーク防止
  public destroy(): void {
    console.log('🔄 アプリケーション終了・リソース解放中...');
    
    try {
      // ツール無効化
      this.currentTool.deactivate();
      
      // 性能監視停止
      this.performanceManager.stopMonitoring();
      
      // 各システム破棄・順序重要
      this.inputManager?.destroy();
      this.drawingEngine?.destroy();
      this.uiManager.destroy();
      this.pixiApp.destroy();
      this.performanceManager.destroy();
      this.eventBus.destroy();
      
      console.log('✅ リソース解放完了');
    } catch (error) {
      console.error('リソース解放エラー:', error);
    }
  }
}

// アプリケーション起動・Phase1完成・動作確認
async function main() {
  console.log('🚀 モダンお絵かきツール Phase1 起動開始...');
  
  // アプリインスタンス作成
  const app = new ModernDrawingApp();
  
  // 初期化実行
  const success = await app.initialize();
  
  if (success) {
    console.log('🎉 Phase1基盤構築完了！');
    console.log('');
    console.log('📝 Phase1動作確認手順:');
    console.log('  1. マウス・ペンでキャンバス上を描画');
    console.log('  2. ツールバーでペン・消しゴム切り替え（P/Eキー）');
    console.log('  3. 色パレットで色変更・リアルタイム反映');
    console.log('  4. 15分連続描画で安定性確認');
    console.log('  5. F12コンソールで統計情報確認');
    console.log('');
    console.log('🚀 Phase2機能拡張準備完了！');
    console.log('  - レイヤーシステム（20枚管理）');
    console.log('  - 高度ツール（筆・図形・塗りつぶし）');
    console.log('  - HSV色選択・エクスポート機能');
    
    // グローバル参照・デバッグ支援
    if (typeof window !== 'undefined') {
      (window as any).drawingApp = app;
      (window as any).getAppStatus = () => app.getAppStatus();
      (window as any).getDetailedStats = () => app.getDetailedStats();
      console.log('🔍 デバッグ: window.drawingApp, window.getAppStatus() 利用可能');
    }
    
  } else {
    console.error('💥 Phase1実装失敗 - エラー確認・修正が必要');
    console.error('環境確認: Chrome最新版・WebGL2・2560×1440推奨');
  }

  // アプリ終了処理・beforeunload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      app.destroy();
    });
  }

  return app;
}

// アプリケーション開始・エラーハンドリング
main().catch(error => {
  console.error('💥 アプリケーション起動失敗:', error);
  
  // 緊急エラー表示
  if (typeof document !== 'undefined') {
    const emergencyDiv = document.createElement('div');
    emergencyDiv.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(244, 67, 54, 0.9); color: white;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; z-index: 99999; font-family: monospace;
    `;
    emergencyDiv.innerHTML = `
      <h1>🚨 緊急エラー</h1>
      <p>アプリケーションが起動できませんでした</p>
      <code>${error.message}</code>
      <button onclick="location.reload()" style="
        margin-top: 20px; padding: 10px 20px; font-size: 16px;
        background: white; color: #f44336; border: none; border-radius: 4px;
      ">再読み込み</button>
    `;
    document.body.appendChild(emergencyDiv);
  }
});