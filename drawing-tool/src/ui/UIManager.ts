import { EventBus } from '../core/EventBus.js';

export class UIManager {
  private eventBus: EventBus;
  private rootElement: HTMLElement;

  constructor(eventBus: EventBus, rootElement: HTMLElement) {
    this.eventBus = eventBus;
    this.rootElement = rootElement;
    this.initializeCSS();
  }

  public async initializeBasicUI(): Promise<void> {
    this.createMainLayout();
    this.createToolbar();
    this.createCanvasArea();
    this.createBasicColorPalette();

    console.log('基本UI初期化完了・参考資料のふたば色・レイアウト継承');
  }

  private initializeCSS(): void {
    // ふたば色CSS変数定義・参考資料完全継承
    const style = document.createElement('style');
    style.textContent = `
      :root {
        /* 参考資料のふたば色システム完全継承 */
        --futaba-maroon: #800000;        /* 基調色・GPU最適化準備 */
        --futaba-light-maroon: #aa5a56;  /* WebGPU グラデーション準備 */
        --futaba-medium: #cf9c97;        /* GPU加速ホバー準備 */
        --futaba-light-medium: #e9c2ba;  /* OffscreenCanvas最適化準備 */
        --futaba-cream: #f0e0d6;         /* WebGPU テクスチャ効率準備 */
        --futaba-background: #ffffee;    /* GPU最優先背景 */
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: var(--futaba-background);
        overflow: hidden;
      }
      
      /* 参考資料のGrid Layout完全継承・64px|1fr|400px */
      .main-layout {
        display: grid;
        grid-template-columns: 64px 1fr;
        grid-template-rows: 1fr;
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
      }
      
      /* 参考資料の48pxツールボタン完全継承 */
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
      
      /* 参考資料のポップアップ色パレット準備・移動可能・GPU加速準備 */
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
        /* Phase3でz-index: 2000・移動可能・WebGPU最適化予定 */
      }
      
      /* 参考資料の32px色スウォッチ完全継承 */
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

  private createMainLayout(): void {
    this.rootElement.innerHTML = `
      <div class="main-layout">
        <div class="toolbar" id="toolbar"></div>
        <div class="canvas-area" id="canvas-area"></div>
      </div>
    `;
  }

  private createToolbar(): void {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    // Phase1基本ツール・参考資料のSVGアイコン準備完了
    const tools = [
      { name: 'pen', icon: '✏️', title: 'ペンツール' }, // Phase3でti-pencil予定
      { name: 'eraser', icon: '🗑️', title: '消しゴム' } // Phase3でti-eraser予定
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

  private createCanvasArea(): void {
    const canvasArea = document.getElementById('canvas-area');
    if (!canvasArea) return;

    canvasArea.style.display = 'flex';
    canvasArea.style.justifyContent = 'center';
    canvasArea.style.alignItems = 'center';
  }

  private createBasicColorPalette(): void {
    const canvasArea = document.getElementById('canvas-area');
    if (!canvasArea) return;

    const palette = document.createElement('div');
    palette.className = 'color-palette';

    // 参考資料のふたば色プリセット完全継承
    const colors = [
      { color: '#800000', name: 'ふたばマルーン' }, // 参考資料継承
      { color: '#aa5a56', name: 'ふたばライトマルーン' }, // 参考資料継承
      { color: '#cf9c97', name: 'ふたばミディアム' }, // 参考資料継承
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

  public getCanvasContainer(): HTMLElement | null {
    return document.getElementById('canvas-area');
  }
}