// UIManager.ts - 2.5K UI システム管理 (修正版)
// ふたば色・Grid レイアウト・WCAG AAA対応

import type { EventBus } from '../core/EventBus.js';

/**
 * UI要素タイプ
 */
export type UIElement = 'toolbar' | 'colorPalette' | 'layerPanel' | 'statusBar' | 'menuBar';

/**
 * ツール定義・基本ツールタイプ
 */
export type DrawingTool = 'pen' | 'brush' | 'eraser' | 'pencil';

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
 * UI システム統合管理・2.5K特化
 */
export class UIManager {
  private eventBus: EventBus;
  private container: HTMLElement;
  
  // UI要素参照
  private elements: Map<UIElement, HTMLElement> = new Map();
  private canvasContainer: HTMLElement | null = null;
  
  // 状態管理
  private currentTool: DrawingTool = 'pen';
  private currentColor = '#800000';

  constructor(eventBus: EventBus, container: HTMLElement) {
    this.eventBus = eventBus;
    this.container = container;
    
    console.log('🎨 UIManager初期化開始');
  }

  /**
   * 基本UI初期化・メインレイアウト構築
   */
  public async initializeBasicUI(): Promise<void> {
    try {
      // CSS変数設定・ふたば色適用
      this.setupCSSVariables();
      
      // メインレイアウト構築
      this.buildMainLayout();
      
      // イベントリスナー設定
      this.setupEventListeners();
      
      console.log('✅ 基本UI初期化完了');
      
    } catch (error) {
      console.error('❌ UI初期化エラー:', error);
      throw error;
    }
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
  }

  /**
   * 基本CSSルール定義・2.5K最適化
   */
  private getBaseCSSRules(): string {
    return `
      /* メインレイアウト・Grid 80px|1fr|400px */
      .drawing-app {
        display: grid;
        grid-template-columns: ${LAYOUT_CONFIG.toolbarWidth}px 1fr ${LAYOUT_CONFIG.layerPanelWidth}px;
        grid-template-rows: 1fr 40px;
        height: 100vh;
        width: 100vw;
        background-color: var(--futaba-background);
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
        font-size: 20px;
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
        display: flex;
        align-items: center;
        justify-content: center;
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
      
      .panel-title {
        color: var(--futaba-maroon);
        font-size: ${LAYOUT_CONFIG.fontSizeLarge}px;
        margin-bottom: ${LAYOUT_CONFIG.spacing}px;
        font-weight: bold;
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
      
      /* ブラシ設定スライダー */
      .slider-container {
        margin-bottom: ${LAYOUT_CONFIG.spacing}px;
      }
      
      .slider-label {
        display: block;
        font-size: ${LAYOUT_CONFIG.fontSizeSmall}px;
        color: var(--futaba-textSecondary);
        margin-bottom: ${LAYOUT_CONFIG.spacing / 2}px;
      }
      
      .slider-input-container {
        display: flex;
        align-items: center;
        gap: ${LAYOUT_CONFIG.spacing}px;
      }
      
      .slider-input {
        flex: 1;
        height: 24px;
        -webkit-appearance: none;
        background: var(--futaba-border);
        border-radius: ${LAYOUT_CONFIG.radius}px;
        outline: none;
      }
      
      .slider-value {
        min-width: 48px;
        text-align: right;
        font-size: ${LAYOUT_CONFIG.fontSizeSmall}px;
        color: var(--futaba-textSecondary);
      }
    `;
  }

  /**
   * メインレイアウト構築
   */
  private buildMainLayout(): void {
    this.container.className = 'drawing-app';
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
  }

  /**
   * ツールバー構築・基本ツール
   */
  private buildToolbar(): void {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'ツールバー');
    
    // 基本ツール定義
    const tools = [
      { id: 'pen' as DrawingTool, icon: '✏️', name: 'ペン' },
      { id: 'brush' as DrawingTool, icon: '🖌️', name: 'ブラシ' },
      { id: 'eraser' as DrawingTool, icon: '🧹', name: '消しゴム' },
      { id: 'pencil' as DrawingTool, icon: '✎', name: '鉛筆' }
    ];
    
    tools.forEach((tool, index) => {
      const button = document.createElement('button');
      button.className = 'tool-button';
      button.setAttribute('aria-label', `${tool.name}ツール`);
      button.setAttribute('title', tool.name);
      button.setAttribute('data-tool', tool.id);
      button.textContent = tool.icon;
      
      if (index === 0) {
        button.classList.add('active');
      }
      
      button.addEventListener('click', () => {
        this.selectTool(tool.id);
      });
      
      toolbar.appendChild(button);
    });
    
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
    canvasContainer.id = 'canvas-container';
    
    this.canvasContainer = canvasContainer;
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
    title.className = 'panel-title';
    title.textContent = 'ツール';
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
    sectionTitle.className = 'panel-title';
    sectionTitle.style.fontSize = LAYOUT_CONFIG.fontSizeBase + 'px';
    section.appendChild(sectionTitle);
    
    const palette = document.createElement('div');
    palette.className = 'color-palette';
    
    // 基本色パレット・ふたば色優先
    const colors = [
      { name: 'マルーン', value: '#800000' },
      { name: 'セージ', value: '#117743' },
      { name: '黒', value: '#000000' },
      { name: '白', value: '#ffffff' },
      { name: '赤', value: '#ff0000' },
      { name: '緑', value: '#00ff00' },
      { name: '青', value: '#0000ff' },
      { name: '黄', value: '#ffff00' }
    ];
    
    colors.forEach((color, index) => {
      const swatch = document.createElement('button');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color.value;
      swatch.setAttribute('aria-label', color.name);
      swatch.setAttribute('title', color.name);
      swatch.setAttribute('data-color', color.value);
      
      if (index === 0) {
        swatch.classList.add('active');
      }
      
      swatch.addEventListener('click', () => {
        this.selectColor(color.value);
      });
      
      palette.appendChild(swatch);
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
    sectionTitle.className = 'panel-title';
    sectionTitle.style.fontSize = LAYOUT_CONFIG.fontSizeBase + 'px';
    section.appendChild(sectionTitle);
    
    // サイズスライダー
    this.createSlider(section, 'size', 'サイズ', 1, 100, 5, 'px');
    
    // 透明度スライダー  
    this.createSlider(section, 'opacity', '透明度', 0, 100, 100, '%');
    
    parent.appendChild(section);
  }

  /**
   * スライダー作成
   */
  private createSlider(
    parent: HTMLElement,
    id: string,
    label: string,
    min: number,
    max: number,
    defaultValue: number,
    unit: string
  ): void {
    const container = document.createElement('div');
    container.className = 'slider-container';
    
    const labelElement = document.createElement('label');
    labelElement.className = 'slider-label';
    labelElement.textContent = label;
    labelElement.setAttribute('for', `slider-${id}`);
    
    const inputContainer = document.createElement('div');
    inputContainer.className = 'slider-input-container';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `slider-${id}`;
    slider.className = 'slider-input';
    slider.min = min.toString();
    slider.max = max.toString();
    slider.value = defaultValue.toString();
    
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'slider-value';
    valueDisplay.textContent = `${defaultValue}${unit}`;
    
    slider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      valueDisplay.textContent = `${value}${unit}`;
      
      this.eventBus.emit(`brush:${id}Change`, {
        type: `brush:${id}Change`,
        timestamp: performance.now(),
        data: { [id]: id === 'opacity' ? value / 100 : value }
      });
    });
    
    inputContainer.appendChild(slider);
    inputContainer.appendChild(valueDisplay);
    
    container.appendChild(labelElement);
    container.appendChild(inputContainer);
    parent.appendChild(container);
  }

  /**
   * ステータスバー構築
   */
  private buildStatusBar(): void {
    const statusBar = document.createElement('div');
    statusBar.className = 'status-bar';
    statusBar.setAttribute('role', 'status');
    
    const leftSection = document.createElement('div');
    leftSection.innerHTML = `<span>🎨 モダンお絵かきツール v4.1</span>`;
    
    const rightSection = document.createElement('div');
    rightSection.innerHTML = `<span id="performance-info">準備中...</span>`;
    
    statusBar.appendChild(leftSection);
    statusBar.appendChild(rightSection);
    
    this.container.appendChild(statusBar);
    this.elements.set('statusBar', statusBar);
  }

  /**
   * イベントリスナー設定
   */
  private setupEventListeners(): void {
    // ツール変更イベント
    this.eventBus.on('tool:changed', (data) => {
      this.updateToolSelection(data.currentTool);
    });
    
    // パフォーマンス更新イベント
    this.eventBus.on('performance:update', (data) => {
      this.updatePerformanceInfo(data);
    });
  }

  /**
   * ツール選択
   */
  private selectTool(tool: DrawingTool): void {
    const toolbar = this.elements.get('toolbar');
    if (!toolbar) return;
    
    // 全ボタンの選択状態リセット
    const buttons = toolbar.querySelectorAll('.tool-button');
    buttons.forEach(button => {
      button.classList.remove('active');
    });
    
    // 選択されたツールをアクティブに
    const selectedButton = toolbar.querySelector(`[data-tool="${tool}"]`);
    if (selectedButton) {
      selectedButton.classList.add('active');
    }
    
    this.currentTool = tool;
    
    // イベント発火
    this.eventBus.emit('ui:tool-select', {
      type: 'ui:tool-select',
      timestamp: performance.now(),
      data: { tool }
    });
  }

  /**
   * 色選択
   */
  private selectColor(color: string): void {
    const layerPanel = this.elements.get('layerPanel');
    if (!layerPanel) return;
    
    // 全カラースウォッチの選択状態リセット
    const swatches = layerPanel.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      swatch.classList.remove('active');
    });
    
    // 選択された色をアクティブに
    const selectedSwatch = layerPanel.querySelector(`[data-color="${color}"]`);
    if (selectedSwatch) {
      selectedSwatch.classList.add('active');
    }
    
    this.currentColor = color;
    
    // 色値をnumberに変換してイベント発火
    const colorValue = parseInt(color.replace('#', ''), 16);
    this.eventBus.emit('ui:color-select', {
      type: 'ui:color-select',
      timestamp: performance.now(),
      data: { color: colorValue }
    });
  }

  /**
   * ツール選択状態更新
   */
  private updateToolSelection(tool: DrawingTool): void {
    this.selectTool(tool);
  }

  /**
   * パフォーマンス情報更新
   */
  private updatePerformanceInfo(data: any): void {
    const perfInfo = document.getElementById('performance-info');
    if (perfInfo && data.fps !== undefined) {
      perfInfo.textContent = `${Math.round(data.fps)} FPS`;
    }
  }

  /**
   * キャンバスコンテナ取得
   */
  public getCanvasContainer(): HTMLElement | null {
    return this.canvasContainer;
  }

  /**
   * 現在のツール取得
   */
  public getCurrentTool(): DrawingTool {
    return this.currentTool;
  }

  /**
   * 現在の色取得
   */
  public getCurrentColor(): string {
    return this.currentColor;
  }

  /**
   * 破棄処理
   */
  public destroy(): void {
    this.elements.clear();
    this.canvasContainer = null;
    console.log('🎨 UIManager破棄完了');
  }