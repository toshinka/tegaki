// src/main.ts - Phase1エントリーポイント・アプリケーション初期化・Claude理解容易

import { PixiApplication } from './core/PixiApplication.js';
import { EventBus } from './core/EventBus.js';
import { DrawingEngine } from './core/DrawingEngine.js';
import { PerformanceManager } from './core/PerformanceManager.js';
import { InputManager } from './input/InputManager.js';
import { UIManager } from './ui/UIManager.js';
import { PenTool } from './tools/PenTool.js';
import { EraserTool } from './tools/EraserTool.js';

// Phase1アプリケーションクラス・統合制御・シンプル構成
class DrawingApplication {
  private pixiApp!: PixiApplication;
  private eventBus!: EventBus;
  private drawingEngine!: DrawingEngine;
  private performanceManager!: PerformanceManager;
  private inputManager!: InputManager;
  private uiManager!: UIManager;
  
  // ツール管理・Phase1基本ツール・Phase2拡張準備
  private tools: Map<string, PenTool | EraserTool> = new Map();
  private activeTool: string = 'pen';
  private isInitialized = false;

  constructor() {
    console.log('🚀 Drawing Application Phase1初期化開始...');
  }

  // アプリケーション初期化・非同期・エラー処理
  public async initialize(): Promise<void> {
    try {
      // 1. 基盤システム初期化
      await this.initializeCoreSystems();
      
      // 2. UI初期化
      await this.initializeUI();
      
      // 3. ツール初期化
      await this.initializeTools();
      
      // 4. イベント統合
      this.setupEventIntegration();
      
      // 5. 初期状態設定
      this.setupInitialState();
      
      this.isInitialized = true;
      console.log('✅ Phase1アプリケーション初期化完了');
      
      // パフォーマンス統計開始
      this.performanceManager.startMonitoring();
      
    } catch (error) {
      console.error('❌ アプリケーション初期化失敗:', error);
      throw error;
    }
  }

  // 基盤システム初期化・PixiJS・EventBus・DrawingEngine
  private async initializeCoreSystems(): Promise<void> {
    console.log('🏗️ 基盤システム初期化...');
    
    // EventBus・中央通信
    this.eventBus = new EventBus();
    
    // PixiJS・GPU描画基盤
    this.pixiApp = new PixiApplication();
    await this.pixiApp.initialize();
    
    // DrawingEngine・描画統合
    this.drawingEngine = new DrawingEngine(this.pixiApp.getApplication(), this.eventBus);
    
    // PerformanceManager・監視基盤
    this.performanceManager = new PerformanceManager(this.eventBus);
    
    console.log('✅ 基盤システム初期化完了');
  }

  // UI初期化・2.5Kレイアウト・ふたば色
  private async initializeUI(): Promise<void> {
    console.log('🎨 UI初期化...');
    
    const rootElement = document.getElementById('app');
    if (!rootElement) {
      throw new Error('Root element #app not found');
    }
    
    this.uiManager = new UIManager(this.eventBus, rootElement);
    await this.uiManager.initializeBasicUI();
    
    // キーボードショートカット
    this.uiManager.setupKeyboardShortcuts();
    
    // PixiJSキャンバス追加
    const canvasContainer = this.uiManager.getCanvasContainer();
    if (canvasContainer) {
      canvasContainer.appendChild(this.pixiApp.getApplication().canvas);
    }
    
    console.log('✅ UI初期化完了');
  }

  // ツール初期化・Phase1基本セット・Phase2拡張準備
  private async initializeTools(): Promise<void> {
    console.log('🔧 ツール初期化...');
    
    // ペンツール・基本描画
    const penTool = new PenTool();
    this.tools.set('pen', penTool);
    
    // 消しゴムツール・Phase1簡易版
    const eraserTool = new EraserTool();
    this.tools.set('eraser', eraserTool);
    
    console.log('✅ ツール初期化完了:', Array.from(this.tools.keys()));
  }

  // イベント統合・ツール切り替え・入力処理・描画連携
  private setupEventIntegration(): void {
    console.log('🔗 イベント統合設定...');
    
    // ツール切り替えイベント
    this.eventBus.on('ui:toolbar-click', (data) => {
      this.switchTool(data.tool);
    });
    
    // 入力→描画イベント転送・自動処理
    this.setupInputManager();
    
    console.log('✅ イベント統合完了');
  }

  // InputManager初期化・遅延初期化・キャンバス取得後
  private setupInputManager(): void {
    const canvas = this.pixiApp.getApplication().canvas;
    this.inputManager = new InputManager(this.eventBus, canvas);
    
    // 描画イベント→ツール通知
    this.eventBus.on('drawing:start', (data) => {
      const tool = this.tools.get(this.activeTool);
      tool?.onPointerDown(data);
    });
    
    this.eventBus.on('drawing:move', (data) => {
      const tool = this.tools.get(this.activeTool);
      tool?.onPointerMove(data);
    });
    
    this.eventBus.on('drawing:end', (data) => {
      const tool = this.tools.get(this.activeTool);
      tool?.onPointerUp(data);
    });
  }

  // 初期状態設定・デフォルトツール・色・サイズ
  private setupInitialState(): void {
    console.log('⚙️ 初期状態設定...');
    
    // ペンツール有効化
    this.switchTool('pen');
    
    // 初期色設定・ふたばマルーン
    this.eventBus.emit('ui:color-change', { 
      color: 0x800000, 
      previousColor: 0x000000 
    });
    
    console.log('✅ 初期状態設定完了');
  }

  // ツール切り替え・状態管理・UI同期
  private switchTool(toolName: string): void {
    if (!this.tools.has(toolName)) {
      console.warn(`未知のツール: ${toolName}`);
      return;
    }

    // 現在ツール無効化
    const currentTool = this.tools.get(this.activeTool);
    if (currentTool) {
      currentTool.deactivate();
    }

    // 新ツール有効化
    this.activeTool = toolName;
    const newTool = this.tools.get(toolName);
    if (newTool) {
      newTool.activate();
    }

    // イベント発火・他システム通知
    this.eventBus.emit('tool:change', { 
      toolName, 
      previousTool: this.activeTool !== toolName ? this.activeTool : 'none'
    });

    console.log(`🔄 ツール切り替え: ${toolName}`);
  }

  // アプリケーション統計・デバッグ・監視
  public getApplicationStats(): {
    isInitialized: boolean;
    activeTool: string;
    toolCount: number;
    performance: any;
    drawing: any;
    ui: any;
  } {
    return {
      isInitialized: this.isInitialized,
      activeTool: this.activeTool,
      toolCount: this.tools.size,
      performance: this.performanceManager.getDetailedStats(),
      drawing: this.drawingEngine.getDrawingStats(),
      ui: this.uiManager.getUIState()
    };
  }

  // アプリケーション破棄・リソース解放・メモリリーク防止
  public async destroy(): Promise<void> {
    console.log('🔄 アプリケーション破棄開始...');
    
    try {
      // ツール破棄
      this.tools.forEach(tool => {
        tool.deactivate();
      });
      this.tools.clear();
      
      // システム破棄・逆順
      this.inputManager?.destroy();
      this.uiManager?.destroy();
      this.drawingEngine?.destroy();
      this.performanceManager?.destroy();
      this.pixiApp?.destroy();
      this.eventBus?.destroy();
      
      this.isInitialized = false;
      console.log('✅ アプリケーション破棄完了');
      
    } catch (error) {
      console.error('❌ アプリケーション破棄エラー:', error);
    }
  }
}

// エラーハンドリング・未キャッチ例外・開発支援
window.addEventListener('error', (event) => {
  console.error('🚨 未キャッチエラー:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 未処理Promise拒否:', event.reason);
});

// アプリケーション起動・DOM準備後・自動初期化
async function startApplication(): Promise<void> {
  console.log('🎯 アプリケーション起動開始...');
  
  try {
    const app = new DrawingApplication();
    await app.initialize();
    
    // グローバル参照・デバッグ支援・Phase1のみ
    (window as any).drawingApp = app;
    
    console.log('🎉 Phase1お絵かきツール起動完了！');
    console.log('💡 デバッグ: window.drawingApp.getApplicationStats()');
    
  } catch (error) {
    console.error('❌ アプリケーション起動失敗:', error);
    
    // エラー表示・ユーザー通知
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; 
                  height: 100vh; font-family: sans-serif; background: #f0e0d6;">
        <div style="text-align: center; padding: 32px; background: white; 
                    border: 1px solid #800000; border-radius: 8px;">
          <h2 style="color: #800000; margin-bottom: 16px;">
            🚨 アプリケーション初期化エラー
          </h2>
          <p style="color: #666; margin-bottom: 16px;">
            お絵かきツールの起動に失敗しました
          </p>
          <details style="text-align: left; margin-top: 16px;">
            <summary style="cursor: pointer; color: #800000;">技術詳細</summary>
            <pre style="background: #f5f5f5; padding: 16px; margin-top: 8px; 
                        border-radius: 4px; font-size: 12px; overflow: auto;">
${error instanceof Error ? error.stack : String(error)}
            </pre>
          </details>
        </div>
      </div>
    `;
  }
}

// DOM準備完了後実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApplication);
} else {
  startApplication();
}