import { PixiApplication } from './core/PixiApplication.js';
import { EventBus } from './core/EventBus.js';
import { DrawingEngine } from './core/DrawingEngine.js';
import { InputManager } from './input/InputManager.js';
import { ToolManager } from './tools/ToolManager.js';
import { PerformanceManager } from './core/PerformanceManager.js';

class ModernDrawingApp {
  private pixiApp: PixiApplication;
  private eventBus: EventBus;
  private drawingEngine: DrawingEngine | null = null;
  private inputManager: InputManager | null = null;
  private toolManager: ToolManager | null = null;
  private performanceManager: PerformanceManager;

  constructor() {
    this.pixiApp = new PixiApplication();
    this.eventBus = new EventBus();
    this.performanceManager = new PerformanceManager();
  }

  public async initialize(): Promise<boolean> {
    try {
      console.log('Modern Drawing App 初期化開始...');

      // 1. PixiJS初期化
      const appElement = document.getElementById('app');
      if (!appElement) {
        throw new Error('#app element not found');
      }

      const success = await this.pixiApp.initialize(appElement);
      if (!success) {
        throw new Error('PixiJS初期化失敗');
      }

      // 2. UIの基本レイアウト作成
      this.createBasicUI(appElement);

      // 3. 描画エンジン初期化
      const pixiAppInstance = this.pixiApp.getApp();
      if (!pixiAppInstance) {
        throw new Error('PixiJS Application取得失敗');
      }

      this.drawingEngine = new DrawingEngine(pixiAppInstance, this.eventBus);

      // 4. 入力管理初期化
      const canvas = this.pixiApp.getCanvas();
      if (!canvas) {
        throw new Error('Canvas取得失敗');
      }

      this.inputManager = new InputManager(this.eventBus, canvas);

      // 5. ツール管理初期化
      this.toolManager = new ToolManager(this.eventBus);

      // 6. 性能監視開始
      this.performanceManager.startFPSMonitoring();

      console.log('初期化完了');
      console.log('レンダラー:', this.pixiApp.getRendererType());

      return true;
    } catch (error) {
      console.error('初期化エラー:', error);
      return false;
    }
  }

  private createBasicUI(container: HTMLElement): void {
    // 基本レイアウト作成
    container.innerHTML = `
      <div class="main-layout">
        <div class="toolbar" id="toolbar"></div>
        <div class="canvas-area" id="canvas-area"></div>
      </div>
    `;

    // CSS適用
    this.applyStyles();

    // ツールボタン作成
    this.createToolbar();

    // 色パレット作成
    this.createColorPalette();
  }

  private applyStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --futaba-maroon: #800000;
        --futaba-light-maroon: #aa5a56;
        --futaba-medium: #cf9c97;
        --futaba-light-medium: #e9c2ba;
        --futaba-cream: #f0e0d6;
        --futaba-background: #ffffee;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: var(--futaba-background);
        overflow: hidden;
      }
      
      .main-layout {
        display: grid;
        grid-template-columns: 64px 1fr;
        height: 100vh;
        width: 100vw;
      }
      
      .toolbar {
        background: var(--futaba-cream);
        border-right: 1px solid var(--futaba-light-medium);
        display: flex;
        flex-direction: column;
        padding: 16px 12px;
        gap: 8px;
      }
      
      .canvas-area {
        background: var(--futaba-background);
        position: relative;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      .tool-button {
        width: 48px;
        height: 48px;
        border: 1px solid var(--futaba-light-medium);
        background: var(--futaba-background);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 24px;
        color: var(--futaba-maroon);
      }
      
      .tool-button:hover {
        background: var(--futaba-medium);
        border-color: var(--futaba-light-maroon);
        transform: scale(1.05);
      }
      
      .tool-button.active {
        background: var(--futaba-maroon);
        color: white;
        border-color: var(--futaba-maroon);
      }
      
      .color-palette {
        position: absolute;
        top: 20px;
        right: 20px;
        background: var(--futaba-cream);
        border: 1px solid var(--futaba-light-medium);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        gap: 8px;
      }
      
      .color-swatch {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 2px solid var(--futaba-light-medium);
        cursor: pointer;
        transition: transform 0.2s ease;
      }
      
      .color-swatch:hover {
        transform: scale(1.1);
      }
      
      .color-swatch.active {
        border-color: var(--futaba-maroon);
        border-width: 3px;
      }
    `;
    document.head.appendChild(style);
  }

  private createToolbar(): void {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    const tools = [
      { name: 'pen', icon: '✏️', title: 'ペンツール' },
      { name: 'eraser', icon: '🗑️', title: '消しゴム' }
    ];

    tools.forEach(tool => {
      const button = document.createElement('button');
      button.className = 'tool-button';
      button.innerHTML = tool.icon;
      button.title = tool.title;
      button.dataset.tool = tool.name;
      
      if (tool.name === 'pen') {
        button.classList.add('active');
      }

      button.addEventListener('click', () => {
        this.onToolButtonClick(tool.name);
      });

      toolbar.appendChild(button);
    });
  }

  private createColorPalette(): void {
    const canvasArea = document.getElementById('canvas-area');
    if (!canvasArea) return;

    const palette = document.createElement('div');
    palette.className = 'color-palette';

    const colors = [
      { color: '#800000', name: 'ふたばマルーン' },
      { color: '#aa5a56', name: 'ふたばライトマルーン' },
      { color: '#cf9c97', name: 'ふたばミディアム' },
      { color: '#000000', name: '黒' },
      { color: '#ffffff', name: '白' }
    ];

    colors.forEach((colorData, index) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = colorData.color;
      swatch.title = colorData.name;
      
      if (index === 0) {
        swatch.classList.add('active');
      }

      swatch.addEventListener('click', () => {
        this.onColorSwatchClick(colorData.color, swatch);
      });

      palette.appendChild(swatch);
    });

    canvasArea.appendChild(palette);
  }

  private onToolButtonClick(toolName: string): void {
    // ツールボタンのアクティブ状態更新
    document.querySelectorAll('.tool-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const clickedButton = document.querySelector(`[data-tool="${toolName}"]`);
    if (clickedButton) {
      clickedButton.classList.add('active');
    }

    // イベント発火
    this.eventBus.emit('ui:toolbar-click', { tool: toolName });
  }

  private onColorSwatchClick(colorHex: string, swatchElement: HTMLElement): void {
    // スウォッチのアクティブ状態更新
    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.remove('active');
    });
    swatchElement.classList.add('active');

    // 16進数→数値変換
    const colorNumber = parseInt(colorHex.replace('#', ''), 16);
    
    // イベント発火
    this.eventBus.emit('ui:color-change', { 
      color: colorNumber, 
      previousColor: 0x800000 
    });
  }

  public destroy(): void {
    this.drawingEngine?.destroy();
    this.inputManager?.destroy();
    this.toolManager?.destroy();
    this.pixiApp.destroy();
    this.eventBus.destroy();
  }
}

// アプリケーション初期化
const app = new ModernDrawingApp();

app.initialize().then(success => {
  if (success) {
    console.log('🎨 Modern Drawing App 起動完了');
  } else {
    console.error('❌ アプリケーション起動失敗');
  }
});

// 開発用グローバル公開
(window as any).drawingApp = app;