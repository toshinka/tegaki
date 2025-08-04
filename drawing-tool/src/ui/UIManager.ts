// UIManager.ts - 2.5K UI システム管理
// ふたば色・Grid レイアウト・WCAG AAA対応

import type { EventBus, IEventData } from '../core/EventBus.js';
import type { DrawingTool } from '../core/DrawingEngine.js';

/**
 * UI要素タイプ
 */
export type UIElement = 'toolbar' | 'colorPalette' | 'layerPanel' | 'statusBar' | 'menuBar';

/**
 * ふたば色定義・WCAG AAA準拠
 */
export const FUTABA_COLORS = {
  // メイン色・変更禁止
  maroon: '#800000',      // --futaba-maroon: メインブランド色
  background: '#ffffee',  // --futaba-background: 背景色
  sage: '#117743',        // --futaba-sage: アクセント色
  
  // UI色
  border: '#d6ae7b',      // --futaba-border: 境界線
  hover: '#f0e0d6',       // --futaba-hover: ホバー状態
  active: '#e0d0c4',      // --futaba-active: アクティブ状態
  disabled: '#c0c0c0',    // --futaba-disabled: 無効状態
  
  // テキスト色・コントラスト確保
  textPrimary: '#000000',    // 黒文字・高コントラスト
  textSecondary: '#666666',  // グレー文字・読みやすさ
  textInverse: '#ffffff',    // 白文字・暗背景用
  
  // 状態色・アクセシビリティ配慮
  success: '#28a745',     // 成功・緑
  warning: '#ffc107',     // 警告・黄
  error: '#dc3545',       // エラー・赤
  info: '#17a2b8'         // 情報・青
} as const;

/**
 * レイアウト設定・2.5K最適化
 */
export const LAYOUT_CONFIG = {
  // グリッドレイアウト: 80px | 1fr | 400px
  toolbarWidth: 80,       // ツールバー固定幅
  layerPanelWidth: 400,   // レイヤーパネル固定幅
  
  // 要素サイズ・2.5K環境最適化
  iconSize: 56,           // アイコンサイズ・視認性確保
  buttonHeight: 64,       // ボタン高さ・タッチフレンドリー
  spacing: 8,             // 基本間隔
  radius: 4,              // 角丸半径
  
  // フォント・可読性重視
  fontSizeBase: 14,       // 基本フォントサイズ
  fontSizeSmall: 12,      // 小フォント
  fontSizeLarge: 16,      // 大フォント
  lineHeight: 1.4,        // 行間・読みやすさ
  
  // Z-Index階層
  zIndexBase: 10,         // 基本UI
  zIndexDropdown: 100,    // ドロップダウン
  zIndexModal: 1000,      // モーダル
  zIndexTooltip: 10000    // ツールチップ
} as const;

/**
 * ツール定義・アイコン統合
 */
interface IToolDefinition {
  id: DrawingTool;
  name: string;
  icon: string;          // SVGアイコンパス
  shortcut: string;
  description: string;
  category: 'draw' | 'edit' | 'view';
}

/**
 * UI状態管理
 */
interface IUIState {
  currentTool: DrawingTool;
  currentColor: string;
  currentSize: number;
  currentOpacity: number;
  isMenuOpen: boolean;
  isColorPickerOpen: boolean;
  activePanel: UIElement | null;
  theme: 'light' | 'dark';
}

/**
 * UI設定
 */
interface IUISettings {
  layout: {
    showToolbar: boolean;
    showLayerPanel: boolean;
    showStatusBar: boolean;
    compactMode: boolean;
  };
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    screenReaderMode: boolean;
    keyboardNavigation: boolean;
  };
  display: {
    iconLabels: boolean;
    tooltips: boolean;
    animations: boolean;
    scale: number;
  };
}

/**
 * UI システム統合管理・2.5K特化
 */
export class UIManager {
  private eventBus: EventBus;
  private container: HTMLElement;
  
  // UI要素参照
  private elements: Map<UIElement, HTMLElement> = new Map();
  private toolButtons: Map<DrawingTool, HTMLButtonElement> = new Map();
  private colorSwatches: HTMLElement[] = [];
  
  // 状態管理
  private state: IUIState;
  private settings: IUISettings;
  
  // ツール定義
  private readonly tools: IToolDefinition[] = [
    {
      id: 'pen',
      name: 'ペン',
      icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z',
      shortcut: 'P',
      description: '基本ペンツール・精密描画',
      category: 'draw'
    },
    {
      id: 'brush',
      name: 'ブラシ',
      icon: 'M12 2l3.09 6.26L22 9l-5.91 1.74L13 17l-3.09-6.26L2 9l5.91-1.74L12 2z',
      shortcut: 'B',
      description: 'ブラシツール・自然な描画',
      category: 'draw'
    },
    {
      id: 'eraser',
      name: '消しゴム',
      icon: 'M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4 4 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l8.48-8.48c.79-.78 2.05-.78 2.84 0l2.11 2.12z',
      shortcut: 'E',
      description: '消しゴムツール・部分削除',
      category: 'edit'
    },
    {
      id: 'pencil',
      name: '鉛筆',
      icon: 'M13.5 3a1.5 1.5 0 01.96.36l2.64 2.64c.48.48.48 1.26 0 1.74L7.5 17.5l-4 1 1-4L14.14 5.36A1.5 1.5 0 0113.5 3z',
      shortcut: 'L',
      description: '鉛筆ツール・スケッチ用',
      category: 'draw'
    }
  ];

  constructor(container: HTMLElement, eventBus: EventBus) {
    this.container = container;
    this.eventBus = eventBus;
    
    // 初期状態・設定
    this.state = this.createDefaultState();
    this.settings = this.createDefaultSettings();
    
    // CSS変数設定・ふたば色適用
    this.setupCSSVariables();
    
    // UI構築
    this.buildUI();
    
    // イベントリスナー設定
    this.setupEventListeners();
    
    // アクセシビリティ設定
    this.setupAccessibility();
    
    console.log('🎨 UIManager初期化完了・2.5K最適化');
  }

  /**
   * CSS変数設定・ふたば色システム適用
   */
  private setupCSSVariables(): void {
    const root = document.documentElement;
    
    // ふたば色設定
    Object.entries(FUTABA_COLORS).forEach(([key, value]) => {
      root.style.setProperty(`--futaba-${key}`, value);
    });
    
    // レイアウト設定
    Object.entries(LAYOUT_CONFIG).forEach(([key, value]) => {
      root.style.setProperty(`--layout-${key}`, `${value}px`);
    });
    
    // 基本CSS適用
    const style = document.createElement('style');
    style.textContent = this.getBaseCSSRules();
    document.head.appendChild(style);
    
    console.log('🎨 CSS変数・ふたば色システム適用完了');
  }

  /**
   * 基本CSSルール定義
   */
  private getBaseCSSRules(): string {
    return `
      /* 基本リセット・2.5K最適化 */
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: ${LAYOUT_CONFIG.fontSizeBase}px;
        line-height: ${LAYOUT_CONFIG.lineHeight};
        color: var(--futaba-textPrimary);
        background-color: var(--futaba-background);
        overflow: hidden; /* スクロール無効化 */
      }
      
      /* メインレイアウト・Grid 80px|1fr|400px */
      .drawing-app {
        display: grid;
        grid-template-columns: ${LAYOUT_CONFIG.toolbarWidth}px 1fr ${LAYOUT_CONFIG.layerPanelWidth}px;
        grid-template-rows: 1fr;
        height: 100vh;
        width: 100vw;
      }
      
      /* ツールバー・56pxアイコン */
      .toolbar {
        background-color: var(--futaba-maroon);
        border-right: 2px solid var(--futaba-border);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: ${LAYOUT_CONFIG.spacing}px;
        gap: ${LAYOUT_CONFIG.spacing}px;
        overflow-y: auto;
      }
      
      .tool-button {
        width: ${LAYOUT_CONFIG.iconSize}px;
        height: ${LAYOUT_CONFIG.iconSize}px;
        border: none;
        border-radius: ${LAYOUT_CONFIG.radius}px;
        background-color: transparent;
        color: var(--futaba-textInverse);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .tool-button:hover {
        background-color: var(--futaba-hover);
        color: var(--futaba-textPrimary);
        transform: scale(1.05);
      }
      
      .tool-button.active {
        background-color: var(--futaba-active);
        color: var(--futaba-textPrimary);
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .tool-button:focus {
        outline: 2px solid var(--futaba-info);
        outline-offset: 2px;
      }
      
      /* キャンバス領域 */
      .canvas-container {
        background-color: var(--futaba-background);
        position: relative;
        overflow: hidden;
        border-left: 1px solid var(--futaba-border);
        border-right: 1px solid var(--futaba-border);
      }
      
      .canvas-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      canvas {
        border: 1px solid var(--futaba-border);
        border-radius: ${LAYOUT_CONFIG.radius}px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        cursor: crosshair;
      }
      
      /* レイヤーパネル */
      .layer-panel {
        background-color: var(--futaba-background);
        border-left: 2px solid var(--futaba-border);
        display: flex;
        flex-direction: column;
        padding: ${LAYOUT_CONFIG.spacing}px;
        overflow-y: auto;
      }
      
      /* カラーパレット */
      .color-palette {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: ${LAYOUT_CONFIG.spacing / 2}px;
        margin: ${LAYOUT_CONFIG.spacing}px 0;
      }
      
      .color-swatch {
        width: ${LAYOUT_CONFIG.iconSize / 2}px;
        height: ${LAYOUT_CONFIG.iconSize / 2}px;
        border: 2px solid var(--futaba-border);
        border-radius: ${LAYOUT_CONFIG.radius}px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .color-swatch:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .color-swatch.active {
        border-color: var(--futaba-maroon);
        border-width: 3px;
        transform: scale(1.1);
      }
      
      /* ステータスバー */
      .status-bar {
        grid-column: 1 / -1;
        background-color: var(--futaba-maroon);
        color: var(--futaba-textInverse);
        padding: ${LAYOUT_CONFIG.spacing / 2}px ${LAYOUT_CONFIG.spacing}px;
        font-size: ${LAYOUT_CONFIG.fontSizeSmall}px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid var(--futaba-border);
      }
      
      /* アニメーション・reduced-motion対応 */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
      
      /* 高コントラストモード */
      @media (prefers-contrast: high) {
        .tool-button {
          border: 1px solid currentColor;
        }
        
        .color-swatch {
          border-width: 3px;
        }
      }
      
      /* 2.5K未満環境警告 */
      @media (max-width: 2559px) {
        body::before {
          content: "⚠️ このアプリは2560×1440以上の環境に最適化されています";
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background-color: var(--futaba-warning);
          color: var(--futaba-textPrimary);
          padding: ${LAYOUT_CONFIG.spacing}px;
          text-align: center;
          z-index: ${LAYOUT_CONFIG.zIndexModal};
          font-weight: bold;
        }
      }
      
      /* SVGアイコン・共通スタイル */
      .icon {
        width: 24px;
        height: 24px;
        fill: currentColor;
        pointer-events: none;
      }
      
      /* ツールチップ */
      .tooltip {
        position: absolute;
        background-color: var(--futaba-textPrimary);
        color: var(--futaba-textInverse);
        padding: ${LAYOUT_CONFIG.spacing / 2}px ${LAYOUT_CONFIG.spacing}px;
        border-radius: ${LAYOUT_CONFIG.radius}px;
        font-size: ${LAYOUT_CONFIG.fontSizeSmall}px;
        white-space: nowrap;
        z-index: ${LAYOUT_CONFIG.zIndexTooltip};
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      
      .tooltip.show {
        opacity: 1;
      }
    `;
  }

  /**
   * UI構築・メインレイアウト作成
   */
  private buildUI(): void {
    // メインコンテナ設定
    this.container.className = 'drawing-app');
    this.container.setAttribute('role', 'application');
    this.container.setAttribute('aria-label', 'モダンお絵かきツール');
    
    // ツールバー構築
    this.buildToolbar();
    
    // キャンバス領域構築
    this.buildCanvasArea();
    
    // レイヤーパネル構築
    this.buildLayerPanel();
    
    // ステータスバー構築
    this.buildStatusBar();
    
    console.log('🎨 UI構築完了・Grid レイアウト適用');
  }

  /**
   * ツールバー構築・56pxアイコン
   */
  private buildToolbar(): void {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'ツールバー');
    
    // ツールボタン作成
    this.tools.forEach((tool, index) => {
      const button = document.createElement('button');
      button.className = 'tool-button';
      button.setAttribute('aria-label', `${tool.name} (${tool.shortcut})`);
      button.setAttribute('title', `${tool.description} - ${tool.shortcut}キー`);
      button.setAttribute('data-tool', tool.id);
      button.tabIndex = index === 0 ? 0 : -1; // 最初のツールのみフォーカス可能
      
      // SVGアイコン作成
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', tool.icon);
      svg.appendChild(path);
      
      button.appendChild(svg);
      toolbar.appendChild(button);
      
      // ボタン参照保持
      this.toolButtons.set(tool.id, button);
      
      // クリックイベント
      button.addEventListener('click', () => {
        this.selectTool(tool.id);
      });
      
      // キーボードナビゲーション
      button.addEventListener('keydown', (e) => {
        this.handleToolbarKeydown(e, index);
      });
    });
    
    // 初期ツール選択
    this.selectTool('pen');
    
    this.container.appendChild(toolbar);
    this.elements.set('toolbar', toolbar);
  }

  /**
   * キャンバス領域構築
   */
  private buildCanvasArea(): void {
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    canvasContainer.setAttribute('role', 'main');
    canvasContainer.setAttribute('aria-label', '描画領域');
    
    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'canvas-wrapper');
    canvasWrapper.id = 'canvas-wrapper';
    
    canvasContainer.appendChild(canvasWrapper);
    this.container.appendChild(canvasContainer);
    this.elements.set('canvasContainer', canvasContainer);
  }

  /**
   * レイヤーパネル構築
   */
  private buildLayerPanel(): void {
    const layerPanel = document.createElement('div');
    layerPanel.className = 'layer-panel';
    layerPanel.setAttribute('role', 'complementary');
    layerPanel.setAttribute('aria-label', 'レイヤーパネル');
    
    // パネルタイトル
    const title = document.createElement('h2');
    title.textContent = 'レイヤー';
    title.style.cssText = `
      color: var(--futaba-maroon);
      font-size: ${LAYOUT_CONFIG.fontSizeLarge}px;
      margin-bottom: ${LAYOUT_CONFIG.spacing}px;
      font-weight: bold;
    `;
    layerPanel.appendChild(title);
    
    // カラーパレット構築
    this.buildColorPalette(layerPanel);
    
    // ブラシ設定構築
    this.buildBrushSettings(layerPanel);
    
    this.container.appendChild(layerPanel);
    this.elements.set('layerPanel', layerPanel);
  }

  /**
   * カラーパレット構築・ふたば色中心
   */
  private buildColorPalette(parent: HTMLElement): void {
    const section = document.createElement('section');
    section.setAttribute('aria-label', 'カラーパレット');
    
    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = '色';
    sectionTitle.style.cssText = `
      color: var(--futaba-textSecondary);
      font-size: ${LAYOUT_CONFIG.fontSizeBase}px;
      margin-bottom: ${LAYOUT_CONFIG.spacing}px;
    `;
    section.appendChild(sectionTitle);
    
    const palette = document.createElement('div');
    palette.className = 'color-palette';
    palette.setAttribute('role', 'radiogroup');
    palette.setAttribute('aria-label', 'カラー選択');
    
    // 基本色パレット・ふたば色優先
    const colors = [
      { name: 'マルーン', value: FUTABA_COLORS.maroon, primary: true },
      { name: 'セージ', value: FUTABA_COLORS.sage },
      { name: '黒', value: '#000000' },
      { name: '白', value: '#ffffff' },
      { name: '赤', value: '#ff0000' },
      { name: '緑', value: '#00ff00' },
      { name: '青', value: '#0000ff' },
      { name: '黄', value: '#ffff00' },
      { name: 'オレンジ', value: '#ff8000' },
      { name: '紫', value: '#8000ff' },
      { name: 'ピンク', value: '#ff0080' },
      { name: 'シアン', value: '#00ffff' }
    ];
    
    colors.forEach((color, index) => {
      const swatch = document.createElement('button');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color.value;
      swatch.setAttribute('role', 'radio');
      swatch.setAttribute('aria-label', color.name);
      swatch.setAttribute('aria-checked', color.primary ? 'true' : 'false');
      swatch.setAttribute('data-color', color.value);
      swatch.tabIndex = color.primary ? 0 : -1;
      
      if (color.primary) {
        swatch.classList.add('active');
        this.state.currentColor = color.value;
      }
      
      // クリックイベント
      swatch.addEventListener('click', () => {
        this.selectColor(color.value);
      });
      
      // キーボードナビゲーション
      swatch.addEventListener('keydown', (e) => {
        this.handleColorPaletteKeydown(e, index);
      });
      
      palette.appendChild(swatch);
      this.colorSwatches.push(swatch);
    });
    
    section.appendChild(palette);
    parent.appendChild(section);
  }

  /**
   * ブラシ設定構築
   */
  private buildBrushSettings(parent: HTMLElement): void {
    const section = document.createElement('section');
    section.setAttribute('aria-label', 'ブラシ設定');
    
    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = 'ブラシ';
    sectionTitle.style.cssText = `
      color: var(--futaba-textSecondary);
      font-size: ${LAYOUT_CONFIG.fontSizeBase}px;
      margin: ${LAYOUT_CONFIG.spacing * 2}px 0 ${LAYOUT_CONFIG.spacing}px 0;
    `;
    section.appendChild(sectionTitle);
    
    // サイズスライダー
    this.createSliderControl(section, 'size', 'サイズ', 1, 100, 5, 'px');
    
    // 透明度スライダー
    this.createSliderControl(section, 'opacity', '透明度', 0, 1, 1, '', 0.01);
    
    parent.appendChild(section);
  }

  /**
   * スライダーコントロール作成
   */
  private createSliderControl(
    parent: HTMLElement,
    id: string,
    label: string,
    min: number,
    max: number,
    defaultValue: number,
    unit: string,
    step: number = 1
  ): void {
    const container = document.createElement('div');
    container.style.cssText = `
      margin-bottom: ${LAYOUT_CONFIG.spacing}px;
    `;
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.setAttribute('for', `slider-${id}`);
    labelElement.style.cssText = `
      display: block;
      font-size: ${LAYOUT_CONFIG.fontSizeSmall}px;
      color: var(--futaba-textSecondary);
      margin-bottom: ${LAYOUT_CONFIG.spacing / 2}px;
    `;
    
    const sliderContainer = document.createElement('div');
    sliderContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: ${LAYOUT_CONFIG.spacing}px;
    `;
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `slider-${id}`;
    slider.min = min.toString();
    slider.max = max.toString();
    slider.step = step.toString();
    slider.value = defaultValue.toString();
    slider.style.cssText = `
      flex: 1;
      height: 24px;
      -webkit-appearance: none;
      background: var(--futaba-border);
      border-radius: ${LAYOUT_CONFIG.radius}px;
      outline: none;
    `;
    
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = `${defaultValue}${unit}`;
    valueDisplay.style.cssText = `
      min-width: 48px;
      text-align: right;
      font-size: ${LAYOUT_CONFIG.fontSizeSmall}px;
      color: var(--futaba-textSecondary);
    `;
    
    // スライダー値変更
    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      valueDisplay.textContent = `${value}${unit}`;
      
      if (id === 'size') {
        this.state.currentSize = value;
        this.eventBus.emit('brush:sizeChange', {
          type: 'brush:sizeChange',
          timestamp: performance.now(),
          data: { size: value }
        });
      } else if (id === 'opacity') {
        this.state.currentOpacity = value;
        this.eventBus.emit('brush:opacityChange', {
          type: 'brush:opacityChange',
          timestamp: performance.now(),
          data: { opacity: value }
        });
      }
    });
    
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(valueDisplay);
    
    container.appendChild(labelElement);
    container.appendChild(sliderContainer);
    parent.appendChild(container);
  }

  /**
   * ステータスバー構築
   */
  private buildStatusBar(): void {
    const statusBar = document.createElement('div');
    statusBar.className = 'status-bar';
    statusBar.setAttribute('role', 'status');
    statusBar.setAttribute('aria-live', 'polite');
    
    const leftSection = document.createElement('div');
    leftSection.innerHTML = `
      <span>🎨 モダンお絵かきツール</span>
      <span id="tool-status">ツール: ${this.state.currentTool}</span>
    `;
    
    const rightSection = document.createElement('div');
    rightSection.innerHTML = `
      <span id="performance-status">60 FPS</span>
      <span id="memory-status">128 MB</span>
    `;
    
    statusBar.appendChild(leftSection);
    statusBar.appendChild(rightSection);
    
    this.container.appendChild(statusBar);
    this.elements.set('statusBar', statusBar);
  }

  /**
   * イベントリスナー設定
   */
  private setupEventListeners(): void {
    // ツール変更通知
    this.eventBus.on('tool:change', (data) => {
      this.selectTool(data.data.tool);
    });
    
    // 色変更通知
    this.eventBus.on('color:change', (data) => {
      this.selectColor(data.data.color);
    });
    
    // パフォーマンス更新
    this.eventBus.on('performance:update', (data) => {
      this.updatePerformanceDisplay(data.data);
    });
  }

  /**
   * ツール選択・UI更新
   */
  private selectTool(tool: DrawingTool): void {
    // 前のツール非選択
    this.toolButtons.forEach((button, buttonTool) => {
      button.classList.toggle('active', buttonTool === tool);
      button.setAttribute('aria-pressed', (buttonTool === tool).toString());
      button.tabIndex = buttonTool === tool ? 0 : -1;
    });
    
    this.state.currentTool = tool;
    
    // ステータス更新
    const toolStatus = document.getElementById('tool-status');
    if (toolStatus) {
      toolStatus.textContent = `ツール: ${tool}`;
    }
    
    // イベント発火
    this.eventBus.emit('tool:change', {
      type: 'tool:change',
      timestamp: performance.now(),
      data: { tool }
    });
    
    console.log(`🎨 ツール選択: ${tool}`);
  }

  /**
   * 色選択・UI更新
   */
  private selectColor(color: string): void {
    // 前の色非選択
    this.colorSwatches.forEach((swatch) => {
      const isSelected = swatch.getAttribute('data-color') === color;
      swatch.classList.toggle('active', isSelected);
      swatch.setAttribute('aria-checked', isSelected.toString());
      swatch.tabIndex = isSelected ? 0 : -1;
    });
    
    this.state.currentColor = color;
    
    // 色値をnumberに変換
    const colorValue = parseInt(color.replace('#', ''), 16);
    
    // イベント発火
    this.eventBus.emit('color:change', {
      type: 'color:change',
      timestamp: performance.now(),
      data: { color: colorValue }
    });
    
    console.log(`🎨 色選択: ${color}`);
  }

  /**
   * パフォーマンス表示更新
   */
  private updatePerformanceDisplay(data: any): void {
    const fpsStatus = document.getElementById('performance-status');
    const memoryStatus = document.getElementById('memory-status');
    
    if (fpsStatus && data.fps !== undefined) {
      fpsStatus.textContent = `${Math.round(data.fps)} FPS`;
    }
    
    if (memoryStatus && data.memory !== undefined) {
      memoryStatus.textContent = `${Math.round(data.memory)} MB`;
    }
  }

  /**
   * ツールバーキーボードナビゲーション
   */
  private handleToolbarKeydown(event: KeyboardEvent, index: number): void {
    let newIndex = index;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        newIndex = (index + 1) % this.tools.length;
        break;
      case 'ArrowUp':
        event.preventDefault();
        newIndex = (index - 1 + this.tools.length) % this.tools.length;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.selectTool(this.tools[index].id);
        return;
    }
    
    if (newIndex !== index) {
      const newButton = this.toolButtons.get(this.tools[newIndex].id);
      if (newButton) {
        newButton.focus();
      }
    }
  }

  /**
   * カラーパレットキーボードナビゲーション
   */
  private handleColorPaletteKeydown(event: KeyboardEvent, index: number): void {
    const colors = this.colorSwatches;
    let newIndex = index;
    
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        newIndex = (index + 1) % colors.length;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = (index - 1 + colors.length) % colors.length;
        break;
      case 'ArrowDown':
        event.preventDefault();
        newIndex = Math.min(index + 4, colors.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        newIndex = Math.max(index - 4, 0);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        const color = colors[index].getAttribute('data-color');
        if (color) {
          this.selectColor(color);
        }
        return;
    }
    
    if (newIndex !== index) {
      colors[newIndex].focus();
    }
  }

  /**
   * アクセシビリティ設定
   */
  private setupAccessibility(): void {
    // スクリーンリーダー対応
    document.addEventListener('keydown', (event) => {
      // Alt + Shift + A: アクセシビリティモード切り替え
      if (event.altKey && event.shiftKey && event.key === 'A') {
        this.toggleAccessibilityMode();
      }
    });
    
    // 高コントラスト検出
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      this.settings.accessibility.highContrast = true;
      document.body.classList.add('high-contrast');
    }
    
    // アニメーション軽減検出
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.accessibility.reducedMotion = true;
      document.body.classList.add('reduced-motion');
    }
  }

  /**
   * アクセシビリティモード切り替え
   */
  private toggleAccessibilityMode(): void {
    this.settings.accessibility.screenReaderMode = !this.settings.accessibility.screenReaderMode;
    
    if (this.settings.accessibility.screenReaderMode) {
      // アイコンにラベル追加
      this.toolButtons.forEach((button, tool) => {
        const toolDef = this.tools.find(t => t.id === tool);
        if (toolDef) {
          button.setAttribute('aria-label', `${toolDef.name} ツール - ${toolDef.description}`);
        }
      });
      
      console.log('🎨 アクセシビリティモード: 有効');
    } else {
      console.log('🎨 アクセシビリティモード: 無効');
    }
  }

  /**
   * UI状態取得
   */
  public getState(): IUIState {
    return { ...this.state };
  }

  /**
   * 設定取得
   */
  public getSettings(): IUISettings {
    return { ...this.settings };
  }

  /**
   * デフォルト状態作成
   */
  private createDefaultState(): IUIState {
    return {
      currentTool: 'pen',
      currentColor: FUTABA_COLORS.maroon,
      currentSize: 5,
      currentOpacity: 1,
      isMenuOpen: false,
      isColorPickerOpen: false,
      activePanel: null,
      theme: 'light'
    };
  }

  /**
   * デフォルト設定作成
   */
  private createDefaultSettings(): IUISettings {
    return {
      layout: {
        showToolbar: true,
        showLayerPanel: true,
        showStatusBar: true,
        compactMode: false
      },
      accessibility: {
        highContrast: false,
        reducedMotion: false,
        screenReaderMode: false,
        keyboardNavigation: true
      },
      display: {
        iconLabels: false,
        tooltips: true,
        animations: true,
        scale: 1.0
      }
    };
  }

  /**
   * 破棄処理
   */
  public destroy(): void {
    this.elements.clear();
    this.toolButtons.clear();
    this.colorSwatches = [];
    
    console.log('🎨 UIManager破棄完了');
  }
}