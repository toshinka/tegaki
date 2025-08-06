// src/ui/UIManager.ts - 2.5Kレイアウト・ふたば色・Grid構成・操作性

import { EventBus } from '../core/EventBus.js';

export class UIManager {
  private eventBus: EventBus;
  private rootElement: HTMLElement;

  constructor(eventBus: EventBus, rootElement: HTMLElement) {
    this.eventBus = eventBus;
    this.rootElement = rootElement;
  }

  // ふたば色CSS・2.5K最適化・4_UI_STYLE_GUIDE完全準拠
  private initializeCSS(): void {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        /* ふたば色システム・変更禁止・4_UI_STYLE_GUIDE準拠 */
        --futaba-maroon: #800000;
        --futaba-light-maroon: #aa5a56;
        --futaba-medium: #cf9c97;
        --futaba-light: #e9c2ba;
        --futaba-cream: #f0e0d6;
        --futaba-background: #ffffee;
        
        /* 機能色拡張・状態表現 */
        --success: #4caf50;
        --warning: #ff9800;
        --error: #f44336;
        --info: #2196f3;
        
        /* テキスト色・可読性最適化 */
        --text-primary: #2c1810;
        --text-secondary: #5d4037;
        --text-disabled: #8d6e63;
        --text-inverse: #ffffff;
      }
      
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', sans-serif;
        background: var(--futaba-background);
        overflow: hidden;
        height: 100vh;
        width: 100vw;
      }
      
      /* メインレイアウト・Grid・80px|1fr|400px・2.5K最適化 */
      .main-layout {
        display: grid;
        grid-template-columns: 80px 1fr 400px;
        grid-template-rows: 1fr;
        height: 100vh;
        width: 100vw;
        gap: 0;
      }
      
      /* ツールバー・80px幅・縦配置・56px アイコン */
      .toolbar {
        background: var(--futaba-cream);
        border-right: 1px solid var(--futaba-light);
        display: flex;
        flex-direction: column;
        padding: 16px 12px;
        gap: 8px;
        overflow-y: auto;
      }
      
      .tool-button {
        width: 56px;
        height: 56px;
        border: 1px solid var(--futaba-light);
        background: var(--futaba-background);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-size: 24px;
        color: var(--futaba-maroon);
        position: relative;
      }
      
      .tool-button:hover {
        background: var(--futaba-medium);
        border-color: var(--futaba-light-maroon);
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2);
      }
      
      .tool-button.active {
        background: var(--futaba-maroon);
        color: var(--text-inverse);
        border-color: var(--futaba-maroon);
        box-shadow: 0 2px 8px rgba(128, 0, 0, 0.3);
      }
      
      .tool-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      
      /* グループ分離線・視覚的分類 */
      .tool-separator {
        height: 1px;
        background: var(--futaba-light);
        margin: 8px 12px;
      }
      
      /* キャンバス領域・中央配置・背景色 */
      .canvas-area {
        background: var(--futaba-background);
        position: relative;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      /* 基本色パレット・右上配置・ふたば色プリセット */
      .color-palette {
        position: absolute;
        top: 20px;
        right: 20px;
        background: var(--futaba-cream);
        border: 1px solid var(--futaba-light);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(128, 0, 0, 0.15);
        z-index: 100;
      }
      
      .color-swatch {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 2px solid var(--futaba-light);
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .color-swatch:hover {
        transform: scale(1.1);
        border-color: var(--futaba-medium);
        z-index: 1;
      }
      
      .color-swatch.active {
        border-color: var(--futaba-maroon);
        border-width: 3px;
        transform: scale(1.05);
      }
      
      /* レイヤーパネル・400px幅・Phase2準備 */
      .layer-panel {
        background: var(--futaba-cream);
        border-left: 1px solid var(--futaba-light);
        padding: 16px;
        overflow-y: auto;
      }
      
      .layer-panel h3 {
        color: var(--text-primary);
        font-size: 16px;
        margin-bottom: 12px;
        font-weight: 500;
      }
      
      .layer-placeholder {
        color: var(--text-secondary);
        font-size: 14px;
        font-style: italic;
        padding: 20px;
        text-align: center;
        border: 2px dashed var(--futaba-light);
        border-radius: 8px;
      }
      
      /* 2.5K環境専用警告・小画面対応 */
      @media (max-width: 2559px) or (max-height: 1439px) {
        .resolution-warning {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--warning);
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          z-index: 9999;
          font-size: 14px;
          font-weight: 500;
        }
      }
      
      /* 高コントラストモード対応 */
      @media (prefers-contrast: high) {
        :root {
          --futaba-maroon: #000000;
          --futaba-background: #ffffff;
          --text-primary: #000000;
        }
      }
      
      /* 動きを減らす設定対応 */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
      
      /* フォーカス表示・アクセシビリティ */
      .focusable:focus {
        outline: 2px solid var(--futaba-maroon);
        outline-offset: 2px;
        border-radius: 4px;
      }
      
      .focusable:focus:not(:focus-visible) {
        outline: none;
      }
      
      /* スクロールバースタイル・ふたば色 */
      ::-webkit-scrollbar {
        width: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: var(--futaba-light);
      }
      
      ::-webkit-scrollbar-thumb {
        background: var(--futaba-medium);
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: var(--futaba-light-maroon);
      }
    `;
    document.head.appendChild(style);
  }

  // 基本UIレイアウト作成・Phase1最小限・Phase2拡張準備
  public async initializeBasicUI(): Promise<void> {
    console.log('🎨 基本UI初期化開始...');
    
    this.initializeCSS();
    this.createMainLayout();
    this.createToolbar();
    this.createCanvasArea();
    this.createBasicColorPalette();
    this.createResolutionWarning();
    
    console.log('✅ Phase1基本UI初期化完了');
  }

  // メインレイアウト構築・Grid・80px|1fr|400px
  private createMainLayout(): void {
    this.rootElement.innerHTML = `
      <div class="main-layout">
        <div class="toolbar" id="toolbar"></div>
        <div class="canvas-area" id="canvas-area"></div>
        <div class="layer-panel" id="layer-panel">
          <h3>レイヤー</h3>
          <div class="layer-placeholder">Phase2で実装予定<br>・20レイヤー管理<br>・ブレンドモード<br>・透明度制御</div>
        </div>
      </div>
    `;
  }

  // ツールバー・Phase1基本ツール・Phase2拡張
  private createToolbar(): void {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    const tools = [
      { name: 'pen', icon: '✏️', title: 'ペンツール (P)', shortcut: 'P' },
      { name: 'eraser', icon: '🗑️', title: '消しゴム (E)', shortcut: 'E' }
    ];

    tools.forEach((tool, index) => {
      const button = document.createElement('button');
      button.className = 'tool-button focusable';
      button.innerHTML = tool.icon;
      button.title = tool.title;
      button.dataset.tool = tool.name;
      button.setAttribute('aria-label', tool.title);
      
      if (index === 0) button.classList.add('active'); // ペン初期選択

      button.addEventListener('click', () => {
        this.onToolButtonClick(tool.name);
      });

      // キーボードアクセシビリティ
      button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.onToolButtonClick(tool.name);
        }
      });

      toolbar.appendChild(button);
    });

    // Phase2拡張予定プレースホルダー
    const separator = document.createElement('div');
    separator.className = 'tool-separator';
    toolbar.appendChild(separator);

    const placeholderText = document.createElement('div');
    placeholderText.style.cssText = `
      color: var(--text-secondary);
      font-size: 10px;
      text-align: center;
      padding: 8px 4px;
      line-height: 1.2;
    `;
    placeholderText.textContent = 'Phase2で追加予定: 筆・図形・塗りつぶし・選択ツール';
    toolbar.appendChild(placeholderText);
  }

  // キャンバス領域・描画エリア・中央配置
  private createCanvasArea(): void {
    const canvasArea = document.getElementById('canvas-area');
    if (!canvasArea) return;

    // Phase1では特別な処理なし・PixiJSキャンバス追加される
    canvasArea.setAttribute('role', 'img');
    canvasArea.setAttribute('aria-label', 'お絵かきキャンバス');
  }

  // 基本色パレット・ふたば色プリセット・Phase2 HSV円形予定
  private createBasicColorPalette(): void {
    const canvasArea = document.getElementById('canvas-area');
    if (!canvasArea) return;

    const palette = document.createElement('div');
    palette.className = 'color-palette';

    // ふたば色プリセット・4_UI_STYLE_GUIDE準拠
    const colors = [
      { color: '#800000', name: 'ふたばマルーン', hex: 0x800000 },
      { color: '#000000', name: '黒', hex: 0x000000 },
      { color: '#FF0000', name: '赤', hex: 0xff0000 },
      { color: '#00AA00', name: '緑', hex: 0x00aa00 },
      { color: '#0000FF', name: '青', hex: 0x0000ff },
      { color: '#FFFFFF', name: '白', hex: 0xffffff }
    ];

    colors.forEach((colorData, index) => {
      const swatch = document.createElement('button');
      swatch.className = 'color-swatch focusable';
      swatch.style.backgroundColor = colorData.color;
      swatch.title = colorData.name;
      swatch.setAttribute('aria-label', `色: ${colorData.name}`);
      
      if (index === 0) swatch.classList.add('active'); // マルーン初期選択

      swatch.addEventListener('click', () => {
        this.onColorSwatchClick(colorData.hex, swatch);
      });

      // キーボードアクセシビリティ
      swatch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.onColorSwatchClick(colorData.hex, swatch);
        }
      });

      palette.appendChild(swatch);
    });

    // Phase2拡張予定説明
    const expandNote = document.createElement('div');
    expandNote.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--futaba-light);
      border: 1px solid var(--futaba-medium);
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 8px;
      font-size: 11px;
      color: var(--text-secondary);
      text-align: center;
    `;
    expandNote.textContent = 'Phase2でHSV円形ピッカー実装予定';
    palette.appendChild(expandNote);

    canvasArea.appendChild(palette);
  }

  // 解像度警告・2.5K専用・使用案内
  private createResolutionWarning(): void {
    const warning = document.createElement('div');
    warning.className = 'resolution-warning';
    warning.textContent = '⚠ このツールは2560×1440以上の環境に最適化されています';
    
    // 画面サイズチェック・警告表示判定
    const updateWarningVisibility = () => {
      const showWarning = window.innerWidth < 2560 || window.innerHeight < 1440;
      warning.style.display = showWarning ? 'block' : 'none';
    };

    updateWarningVisibility();
    window.addEventListener('resize', updateWarningVisibility);
    
    document.body.appendChild(warning);
  }

  // ツールボタンクリック・状態更新・イベント発火
  private onToolButtonClick(toolName: string): void {
    console.log(`🔧 ツール選択: ${toolName}`);
    
    // アクティブ状態更新
    document.querySelectorAll('.tool-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const clickedButton = document.querySelector(`[data-tool="${toolName}"]`);
    if (clickedButton) {
      clickedButton.classList.add('active');
      
      // フォーカス設定・アクセシビリティ
      (clickedButton as HTMLElement).focus();
    }

    // イベント発火・ツール制御
    this.eventBus.emit('ui:toolbar-click', { tool: toolName });
  }

  // 色選択・16進数→数値変換・イベント発火
  private onColorSwatchClick(colorNumber: number, swatchElement: HTMLElement): void {
    console.log(`🎨 色選択: #${colorNumber.toString(16).padStart(6, '0')}`);
    
    // アクティブ状態更新
    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.remove('active');
    });
    swatchElement.classList.add('active');
    
    // フォーカス設定
    swatchElement.focus();

    // イベント発火・色変更通知
    this.eventBus.emit('ui:color-change', { 
      color: colorNumber, 
      previousColor: 0x800000 
    });
  }

  // キャンバスコンテナ取得・PixiJS初期化用
  public getCanvasContainer(): HTMLElement | null {
    return document.getElementById('canvas-area');
  }

  // キーボードショートカット設定・Phase1基本・Phase2拡張
  public setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // モディファイアキー無視・単純ショートカット
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      switch (e.key.toLowerCase()) {
        case 'p':
          e.preventDefault();
          this.onToolButtonClick('pen');
          break;
        case 'e':
          e.preventDefault();
          this.onToolButtonClick('eraser');
          break;
        default:
          // その他のキー・Phase2実装予定
          break;
      }
    });

    console.log('⌨️ キーボードショートカット有効化: P(ペン), E(消しゴム)');
  }

  // UI状態取得・デバッグ・同期確認
  public getUIState(): {
    activeTool: string | null;
    activeColor: string | null;
    resolution: { width: number; height: number };
    isOptimalResolution: boolean;
  } {
    const activeToolElement = document.querySelector('.tool-button.active');
    const activeColorElement = document.querySelector('.color-swatch.active');
    
    return {
      activeTool: activeToolElement?.getAttribute('data-tool') || null,
      activeColor: activeColorElement ? 
        window.getComputedStyle(activeColorElement).backgroundColor : null,
      resolution: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      isOptimalResolution: window.innerWidth >= 2560 && window.innerHeight >= 1440
    };
  }

  // リソース解放・メモリリーク防止
  public destroy(): void {
    console.log('🔄 UIManager破棄・リソース解放中...');
    
    // イベントリスナー削除は各要素の削除で自動処理
    // CSS削除
    const styleElements = document.head.querySelectorAll('style');
    styleElements.forEach(style => {
      if (style.textContent?.includes('--futaba-maroon')) {
        document.head.removeChild(style);
      }
    });
    
    console.log('✅ UIManager破棄完了');
  }
}