// src/main.ts - モダンお絵かきツール・Phase1統合・WebGL2確実動作

import { PixiApplication } from './core/PixiApplication';
import { EventBus } from './core/EventBus';
import { DrawingEngine } from './core/DrawingEngine';
import { InputManager } from './input/InputManager';
import { UIManager } from './ui/UIManager';
import { PerformanceManager } from './core/PerformanceManager';
import { PenTool } from './tools/PenTool';
import { EraserTool } from './tools/EraserTool';

class ModernDrawingApp {
  private pixiApp: PixiApplication | null = null;
  private eventBus: EventBus | null = null;
  private drawingEngine: DrawingEngine | null = null;
  private inputManager: InputManager | null = null;
  private uiManager: UIManager | null = null;
  private performanceManager: PerformanceManager | null = null;
  private penTool: PenTool | null = null;
  private eraserTool: EraserTool | null = null;

  // アプリケーション初期化・Phase1確実動作
  public async initialize(): Promise<boolean> {
    try {
      console.log('🚀 ModernDrawingApp初期化開始...');

      // HTML要素準備・DOM構築
      this.setupHTML();
      
      // 1. イベントバス初期化・通信基盤
      this.eventBus = new EventBus();
      
      // 2. PixiJS初期化・WebGL2確実動作
      this.pixiApp = new PixiApplication();
      const canvasContainer = document.getElementById('canvas-container');
      if (!canvasContainer) {
        throw new Error('Canvas container not found');
      }

      const success = await this.pixiApp.initialize(canvasContainer, {
        width: 2560,
        height: 1440,
        backgroundColor: 0xffffee, // ふたば背景色
        antialias: true,
        powerPreference: 'high-performance'
      });

      if (!success) {
        throw new Error('PixiJS initialization failed');
      }

      const pixiAppInstance = this.pixiApp.getApp();
      if (!pixiAppInstance) {
        throw new Error('PixiJS application instance not available');
      }

      // 3. 描画エンジン初期化・Graphics管理
      this.drawingEngine = new DrawingEngine(pixiAppInstance, this.eventBus);

      // 4. 入力管理初期化・マウス・ペンタブレット
      const canvas = this.pixiApp.getCanvas();
      if (!canvas) {
        throw new Error('Canvas element not available');
      }
      this.inputManager = new InputManager(this.eventBus, canvas);

      // 5. UI管理初期化・2.5K対応・ふたば色
      this.uiManager = new UIManager(this.eventBus);

      // 6. パフォーマンス監視・60FPS・メモリ監視
      this.performanceManager = new PerformanceManager(pixiAppInstance, this.eventBus);

      // 7. ツール初期化・ペン・消しゴム・Phase1基盤
      this.penTool = new PenTool(this.eventBus);
      this.eraserTool = new EraserTool(this.eventBus);

      // アプリ統合・イベント連携・Phase1完成
      this.setupAppIntegration();

      console.log('✅ ModernDrawingApp初期化完了');
      console.log(`📊 レンダラー: ${this.pixiApp.getRendererType()}`);
      console.log(`📱 キャンバス: ${canvas.width}x${canvas.height}`);

      return true;

    } catch (error) {
      console.error('💥 ModernDrawingApp初期化失敗:', error);
      this.showInitializationError(error as Error);
      return false;
    }
  }

  // HTML要素構築・2.5K UI・ふたば色・Phase1レイアウト
  private setupHTML(): void {
    const app = document.getElementById('app');
    if (!app) {
      throw new Error('App container not found');
    }

    app.innerHTML = `
      <!-- Phase1: 基本レイアウト・2560×1440最適化 -->
      <div id="drawing-app" style="
        width: 100vw; height: 100vh; overflow: hidden;
        background: #ffffee; /* ふたば背景色 */
        display: flex; flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <!-- ツールバー・Phase1基本ツール -->
        <div id="toolbar" style="
          height: 64px; background: #800000; /* ふたばmaroon */
          display: flex; align-items: center; padding: 0 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          flex-shrink: 0;
        ">
          <div style="color: #ffffee; font-weight: bold; font-size: 18px; margin-right: 30px;">
            🎨 モダンお絵かきツール
          </div>
          
          <!-- 基本ツール・Phase1 -->
          <button id="pen-tool" class="tool-btn active" data-tool="pen" style="
            background: #a00000; border: none; color: #ffffee;
            padding: 12px 16px; margin: 0 4px; border-radius: 6px;
            cursor: pointer; font-weight: bold; transition: all 0.2s;
          ">🖊️ ペン</button>
          
          <button id="eraser-tool" class="tool-btn" data-tool="eraser" style="
            background: #600000; border: none; color: #ffffee;
            padding: 12px 16px; margin: 0 4px; border-radius: 6px;
            cursor: pointer; font-weight: bold; transition: all 0.2s;
          ">🧹 消しゴム</button>

          <!-- 色選択・Phase1基本色 -->
          <div style="margin: 0 20px; display: flex; align-items: center;">
            <span style="color: #ffffee; margin-right: 10px;">色:</span>
            <input id="color-picker" type="color" value="#800000" style="
              width: 40px; height: 40px; border: 2px solid #ffffee;
              border-radius: 6px; cursor: pointer; background: none;
            ">
          </div>

          <!-- ブラシサイズ・Phase1 -->
          <div style="margin: 0 20px; display: flex; align-items: center;">
            <span style="color: #ffffee; margin-right: 10px;">サイズ:</span>
            <input id="brush-size" type="range" min="1" max="50" value="4" style="
              width: 120px; margin-right: 10px;
            ">
            <span id="size-display" style="color: #ffffee; font-weight: bold; width: 30px;">4px</span>
          </div>

          <!-- クリア・Phase1 -->
          <button id="clear-canvas" style="
            background: #cc0000; border: none; color: #ffffee;
            padding: 12px 16px; margin-left: 20px; border-radius: 6px;
            cursor: pointer; font-weight: bold; transition: all 0.2s;
          ">🗑️ クリア</button>

          <!-- パフォーマンス表示・Phase1監視 -->
          <div id="performance-display" style="
            margin-left: auto; color: #ffffee; font-family: monospace;
            font-size: 14px; background: rgba(0,0,0,0.3);
            padding: 8px 12px; border-radius: 4px;
          ">
            FPS: <span id="fps-counter">60</span> | 
            Objects: <span id="object-counter">0</span>
          </div>
        </div>

        <!-- キャンバス領域・Phase1描画エリア -->
        <div id="canvas-container" style="
          flex: 1; background: #ffffee;
          display: flex; justify-content: center; align-items: center;
          overflow: hidden; position: relative;
        ">
          <!-- PixiJSキャンバスがここに挿入 -->
        </div>

        <!-- ステータスバー・Phase1情報表示 -->
        <div id="status-bar" style="
          height: 32px; background: #600000;
          display: flex; align-items: center; padding: 0 20px;
          font-size: 14px; color: #ffffee; flex-shrink: 0;
        ">
          <span id="status-text">描画ツール準備完了 - マウスまたはペンタブレットで描画開始</span>
        </div>
      </div>
    `;

    // CSS動的追加・ホバー効果・2.5K最適化
    const style = document.createElement('style');
    style.textContent = `
      /* Phase1: 基本スタイル・2.5K最適化 */
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { overflow: hidden; }
      
      .tool-btn:hover {
        background: #c00000 !important;
        transform: translateY(-1px);
      }
      
      .tool-btn.active {
        background: #e00000 !important;
        box-shadow: 0 0 8px rgba(224, 0, 0, 0.5);
      }
      
      #clear-canvas:hover {
        background: #ff0000 !important;
        transform: translateY(-1px);
      }
      
      /* 入力要素・2.5K対応 */
      input[type="range"] {
        accent-color: #ffffee;
      }
      
      input[type="color"] {
        padding: 0;
        border-radius: 6px;
      }
      
      /* レスポンシブ・2.5K優先 */
      @media (max-width: 1920px) {
        #toolbar { padding: 0 15px; }
        #performance-display { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // アプリ統合・イベント連携・Phase1完成度
  private setupAppIntegration(): void {
    if (!this.eventBus) return;

    // UI要素イベント・ツール切り替え・Phase1基本操作
    const penBtn = document.getElementById('pen-tool');
    const eraserBtn = document.getElementById('eraser-tool');
    const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
    const brushSize = document.getElementById('brush-size') as HTMLInputElement;
    const sizeDisplay = document.getElementById('size-display');
    const clearBtn = document.getElementById('clear-canvas');

    // ツール切り替え・Phase1基本ツール
    penBtn?.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      penBtn.classList.add('active');
      this.eventBus!.emit('tool:change', { toolName: 'pen', previousTool: 'eraser' });
      this.updateStatus('ペンツール - 描画モード');
    });

    eraserBtn?.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      eraserBtn.classList.add('active');
      this.eventBus!.emit('tool:change', { toolName: 'eraser', previousTool: 'pen' });
      this.updateStatus('消しゴムツール - 消去モード');
    });

    // 色選択・リアルタイム反映
    colorPicker?.addEventListener('input', () => {
      const color = parseInt(colorPicker.value.substring(1), 16);
      this.eventBus!.emit('ui:color-change', { 
        color, 
        previousColor: this.drawingEngine?.getCurrentSettings().color || 0x800000 
      });
      this.updateStatus(`色変更: ${colorPicker.value}`);
    });

    // ブラシサイズ・リアルタイム調整
    brushSize?.addEventListener('input', () => {
      const size = parseInt(brushSize.value);
      this.drawingEngine?.setBrushSize(size);
      if (sizeDisplay) sizeDisplay.textContent = `${size}px`;
      this.updateStatus(`ブラシサイズ: ${size}px`);
    });

    // キャンバスクリア・確認なし即座実行
    clearBtn?.addEventListener('click', () => {
      this.drawingEngine?.clearCanvas();
      this.updateStatus('キャンバスクリア完了');
    });

    // パフォーマンス監視表示・Phase1監視基盤
    this.eventBus.on('performance:fps-low', (data) => {
      console.warn(`⚠️ FPS低下: ${data.currentFPS}fps`);
      this.updateStatus(`パフォーマンス警告: FPS ${data.currentFPS}`);
    });

    // メモリ警告監視
    this.eventBus.on('performance:memory-warning', (data) => {
      console.warn(`⚠️ メモリ使用量警告: ${(data.used / 1024 / 1024).toFixed(1)}MB`);
      this.updateStatus(`メモリ警告: ${(data.used / 1024 / 1024).toFixed(1)}MB使用中`);
    });

    // パフォーマンス表示更新・リアルタイム
    this.startPerformanceUpdate();
  }

  // パフォーマンス表示更新・60FPS監視
  private startPerformanceUpdate(): void {
    const fpsCounter = document.getElementById('fps-counter');
    const objectCounter = document.getElementById('object-counter');

    setInterval(() => {
      if (this.pixiApp && fpsCounter) {
        const stats = this.pixiApp.getRenderStats();
        fpsCounter.textContent = Math.round(stats.fps).toString();
      }

      if (this.drawingEngine && objectCounter) {
        const drawingStats = this.drawingEngine.getDrawingStats();
        objectCounter.textContent = drawingStats.objectCount.toString();
      }
    }, 1000);
  }

  // ステータス更新・ユーザーフィードバック
  private updateStatus(message: string): void {
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = message;
      
      // 3秒後に元のメッセージに戻す
      setTimeout(() => {
        if (statusText.textContent === message) {
          statusText.textContent = '描画ツール準備完了 - マウスまたはペンタブレットで描画開始';
        }
      }, 3000);
    }
  }

  // 初期化エラー表示・ユーザー通知
  private showInitializationError(error: Error): void {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <div style="
        width: 100vw; height: 100vh; background: #f44336;
        display: flex; justify-content: center; align-items: center;
        color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <div style="
          background: rgba(255,255,255,0.1); padding: 40px;
          border-radius: 12px; text-align: center; max-width: 500px;
        ">
          <h2 style="margin-bottom: 20px;">🚨 アプリ初期化エラー</h2>
          <p style="margin-bottom: 15px; line-height: 1.6;">
            モダンお絵かきツールの初期化に失敗しました。
          </p>
          <p style="margin-bottom: 20px; font-size: 14px; opacity: 0.8;">
            エラー詳細: ${error.message}
          </p>
          <button onclick="location.reload()" style="
            background: white; color: #f44336; border: none;
            padding: 12px 24px; border-radius: 6px; font-weight: bold;
            cursor: pointer; font-size: 16px;
          ">ページを再読み込み</button>
          <p style="margin-top: 20px; font-size: 14px; opacity: 0.7;">
            Chrome最新版・WebGL2対応ブラウザでの利用を推奨します
          </p>
        </div>
      </div>
    `;
  }

  // アプリケーション終了・リソース解放
  public destroy(): void {
    console.log('🔄 ModernDrawingApp終了・リソース解放中...');

    // 逆順で破棄・依存関係考慮
    this.performanceManager?.destroy();
    this.eraserTool?.destroy();
    this.penTool?.destroy();
    this.uiManager?.destroy();
    this.inputManager?.destroy();
    this.drawingEngine?.destroy();
    this.pixiApp?.destroy();
    this.eventBus?.destroy();

    // 参照クリア・メモリリーク防止
    this.performanceManager = null;
    this.eraserTool = null;
    this.penTool = null;
    this.uiManager = null;
    this.inputManager = null;
    this.drawingEngine = null;
    this.pixiApp = null;
    this.eventBus = null;

    console.log('✅ ModernDrawingApp終了完了');
  }
}

// アプリケーション起動・グローバル初期化
async function startApp(): Promise<void> {
  console.log('🎨 モダンお絵かきツール起動中...');
  
  const app = new ModernDrawingApp();
  
  // グローバル参照・デバッグ・終了処理用
  (window as any).drawingApp = app;
  
  const success = await app.initialize();
  
  if (success) {
    console.log('🎉 アプリケーション起動成功！');
    console.log('💡 ヒント: window.drawingApp でデバッグ可能');
  } else {
    console.error('💥 アプリケーション起動失敗');
  }

  // ページ離脱時リソース解放・メモリリーク防止
  window.addEventListener('beforeunload', () => {
    app.destroy();
  });
}

// DOM読み込み完了後・アプリ起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}