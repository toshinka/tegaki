/**
 * PIXI.js v8 UI Controller
 * UI・UX設計仕様に基づく統合UI管理システム
 * Tabler Icons対応版
 */

import * as PIXI from 'pixi.js';
import _ from 'lodash-es';

export class PixiV8UIController {
  constructor(eventStore, options = {}) {
    this.eventStore = eventStore;
    this.iconHelper = options.iconHelper || null; // TablerIconHelper
    
    // UI要素管理
    this.toolPanels = new Map();
    this.layerPanels = new Map();
    this.colorPanels = new Map();
    this.uiElements = new Map();
    this.popupWindows = new Map();
    
    // UI状態
    this.currentTool = 'brush';
    this.currentColor = '#000000';
    this.brushSize = 10;
    this.opacity = 1.0;
    this.isUIVisible = true;
    
    // レスポンシブ設定
    this.isMobile = window.innerWidth < 768;
    this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    this.isDesktop = window.innerWidth >= 1024;
    
    // アニメーション設定
    this.animationDuration = 300;
    this.easeFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
    
    // アイコンヘルパーが利用可能な場合
    if (this.iconHelper) {
      console.log('✅ Tabler Icons UI システムが利用可能です');
    }
    
    this.init();
  }

  /**
   * UI初期化
   */
  init() {
    this.createMainUI();
    this.setupEventListeners();
    this.applyResponsiveLayout();
    this.initializeAnimations();
    
    console.log('🎨 PIXI.js v8 UI Controller 初期化完了');
  }

  /**
   * メインUI作成
   */
  createMainUI() {
    this.createToolbar();
    this.createLayerPanel();
    this.createColorPanel();
    this.createPropertyPanel();
    this.createMenuBar();
    this.createStatusBar();
    this.createCanvasArea();
  }

  /**
   * ツールバー作成
   */
  createToolbar() {
    const toolbar = this.createElement('div', 'toolbar', {
      className: 'ui-toolbar',
      style: `
        position: fixed;
        left: 16px;
        top: 50%;
        transform: translateY(-50%);
        background: var(--panel-bg, #2a2a2a);
        border-radius: 12px;
        padding: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        backdrop-filter: blur(16px);
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 1000;
        transition: all ${this.animationDuration}ms ${this.easeFunction};
      `
    });

    // ツール定義
    const tools = [
      { id: 'brush', name: 'ブラシ', icon: 'brush', shortcut: 'B' },
      { id: 'pen', name: 'ペン', icon: 'pen', shortcut: 'P' },
      { id: 'eraser', name: '消しゴム', icon: 'eraser', shortcut: 'E' },
      { id: 'bucket', name: 'バケツ', icon: 'bucket', shortcut: 'G' },
      { id: 'eyedropper', name: 'スポイト', icon: 'eyedropper', shortcut: 'I' },
      { id: 'selection', name: '選択', icon: 'selection', shortcut: 'M' },
      { id: 'hand', name: 'ハンド', icon: 'hand', shortcut: 'H' },
      { id: 'zoom', name: 'ズーム', icon: 'zoom', shortcut: 'Z' }
    ];

    tools.forEach(tool => {
      const button = this.createToolButton(tool);
      toolbar.appendChild(button);
      this.toolPanels.set(tool.id, button);
    });

    document.body.appendChild(toolbar);
    this.uiElements.set('toolbar', toolbar);
  }

  /**
   * ツールボタン作成
   */
  createToolButton(tool) {
    const button = this.createElement('button', `tool-${tool.id}`, {
      className: 'tool-button',
      title: `${tool.name} (${tool.shortcut})`,
      style: `
        width: 48px;
        height: 48px;
        border: none;
        border-radius: 8px;
        background: var(--tool-bg, transparent);
        color: var(--tool-color, #ffffff);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 200ms ease;
        position: relative;
      `
    });

    // アイコン設定
    if (this.iconHelper) {
      this.iconHelper.setElementIcon(button, tool.icon, { 
        size: 24, 
        color: 'currentColor',
        stroke: '1.5'
      });
    } else {
      button.textContent = tool.name[0]; // フォールバック
    }

    // ホバー・アクティブ効果
    button.addEventListener('mouseenter', () => {
      button.style.background = 'var(--tool-hover-bg, rgba(255,255,255,0.1))';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      if (this.currentTool !== tool.id) {
        button.style.background = 'var(--tool-bg, transparent)';
        button.style.transform = 'scale(1)';
      }
    });

    button.addEventListener('click', () => {
      this.selectTool(tool.id);
    });

    return button;
  }

  /**
   * レイヤーパネル作成
   */
  createLayerPanel() {
    const panel = this.createElement('div', 'layer-panel', {
      className: 'ui-panel layer-panel',
      style: `
        position: fixed;
        right: 16px;
        top: 80px;
        width: 280px;
        background: var(--panel-bg, #2a2a2a);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        backdrop-filter: blur(16px);
        z-index: 1000;
      `
    });

    // パネルヘッダー
    const header = this.createElement('div', 'layer-header', {
      style: `
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color, #404040);
      `
    });

    const title = this.createElement('h3', 'layer-title', {
      textContent: 'レイヤー',
      style: `
        margin: 0;
        color: var(--text-color, #ffffff);
        font-size: 14px;
        font-weight: 600;
      `
    });

    const controls = this.createElement('div', 'layer-controls', {
      style: 'display: flex; gap: 4px;'
    });

    // レイヤー操作ボタン
    const layerActions = [
      { id: 'add', icon: 'layer-add', action: 'addLayer' },
      { id: 'delete', icon: 'layer-delete', action: 'deleteLayer' },
      { id: 'duplicate', icon: 'copy', action: 'duplicateLayer' }
    ];

    layerActions.forEach(action => {
      const button = this.createIconButton(action.icon, action.action);
      controls.appendChild(button);
    });

    header.appendChild(title);
    header.appendChild(controls);

    // レイヤーリスト
    const layerList = this.createElement('div', 'layer-list', {
      style: `
        max-height: 300px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      `
    });

    panel.appendChild(header);
    panel.appendChild(layerList);
    document.body.appendChild(panel);
    
    this.uiElements.set('layerPanel', panel);
    this.uiElements.set('layerList', layerList);
  }

  /**
   * カラーパネル作成
   */
  createColorPanel() {
    const panel = this.createElement('div', 'color-panel', {
      className: 'ui-panel color-panel',
      style: `
        position: fixed;
        right: 16px;
        bottom: 80px;
        width: 280px;
        background: var(--panel-bg, #2a2a2a);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        backdrop-filter: blur(16px);
        z-index: 1000;
      `
    });

    // カラーピッカー
    const colorPicker = this.createElement('div', 'color-picker', {
      style: `
        width: 100%;
        height: 200px;
        background: linear-gradient(to right, 
          #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);
        border-radius: 8px;
        margin-bottom: 12px;
        cursor: crosshair;
        position: relative;
      `
    });

    // 現在の色表示
    const currentColor = this.createElement('div', 'current-color', {
      style: `
        width: 48px;
        height: 48px;
        background: ${this.currentColor};
        border-radius: 8px;
        border: 2px solid var(--border-color, #404040);
        margin-bottom: 12px;
      `
    });

    // カラープリセット
    const presets = this.createElement('div', 'color-presets', {
      style: `
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 4px;
      `
    });

    const presetColors = [
      '#000000', '#ffffff', '#ff0000', '#00ff00',
      '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
      '#808080', '#800000', '#008000', '#000080',
      '#808000', '#800080', '#008080', '#c0c0c0'
    ];

    presetColors.forEach(color => {
      const preset = this.createElement('div', `preset-${color}`, {
        style: `
          width: 24px;
          height: 24px;
          background: ${color};
          border-radius: 4px;
          cursor: pointer;
          border: 1px solid var(--border-color, #404040);
        `
      });

      preset.addEventListener('click', () => {
        this.setColor(color);
      });

      presets.appendChild(preset);
    });

    panel.appendChild(colorPicker);
    panel.appendChild(currentColor);
    panel.appendChild(presets);
    document.body.appendChild(panel);
    
    this.uiElements.set('colorPanel', panel);
    this.uiElements.set('currentColor', currentColor);
  }

  /**
   * プロパティパネル作成
   */
  createPropertyPanel() {
    const panel = this.createElement('div', 'property-panel', {
      className: 'ui-panel property-panel',
      style: `
        position: fixed;
        right: 16px;
        top: 400px;
        width: 280px;
        background: var(--panel-bg, #2a2a2a);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        backdrop-filter: blur(16px);
        z-index: 1000;
      `
    });

    // ブラシサイズ
    const sizeControl = this.createSliderControl('ブラシサイズ', this.brushSize, 1, 100, (value) => {
      this.setBrushSize(value);
    });

    // 不透明度
    const opacityControl = this.createSliderControl('不透明度', this.opacity * 100, 0, 100, (value) => {
      this.setOpacity(value / 100);
    });

    panel.appendChild(sizeControl);
    panel.appendChild(opacityControl);
    document.body.appendChild(panel);
    
    this.uiElements.set('propertyPanel', panel);
  }

  /**
   * メニューバー作成
   */
  createMenuBar() {
    const menuBar = this.createElement('div', 'menu-bar', {
      className: 'ui-menubar',
      style: `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 48px;
        background: var(--menubar-bg, #1a1a1a);
        border-bottom: 1px solid var(--border-color, #404040);
        display: flex;
        align-items: center;
        padding: 0 16px;
        z-index: 1100;
      `
    });

    // メニュー項目
    const menus = [
      { id: 'file', label: 'ファイル', items: ['new', 'open', 'save', 'export'] },
      { id: 'edit', label: '編集', items: ['undo', 'redo', 'copy', 'paste'] },
      { id: 'view', label: '表示', items: ['grid', 'rulers', 'fullscreen'] },
      { id: 'help', label: 'ヘルプ', items: ['about', 'shortcuts', 'docs'] }
    ];

    menus.forEach(menu => {
      const menuItem = this.createMenuItem(menu);
      menuBar.appendChild(menuItem);
    });

    document.body.appendChild(menuBar);
    this.uiElements.set('menuBar', menuBar);
  }

  /**
   * ステータスバー作成
   */
  createStatusBar() {
    const statusBar = this.createElement('div', 'status-bar', {
      className: 'ui-statusbar',
      style: `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 32px;
        background: var(--statusbar-bg, #1a1a1a);
        border-top: 1px solid var(--border-color, #404040);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        font-size: 12px;
        color: var(--text-secondary, #aaaaaa);
        z-index: 1100;
      `
    });

    const leftInfo = this.createElement('div', 'status-left', {
      textContent: 'Ready'
    });

    const rightInfo = this.createElement('div', 'status-right', {
      textContent: '100%'
    });

    statusBar.appendChild(leftInfo);
    statusBar.appendChild(rightInfo);
    document.body.appendChild(statusBar);
    
    this.uiElements.set('statusBar', statusBar);
  }

  /**
   * キャンバスエリア作成
   */
  createCanvasArea() {
    const canvasArea = this.createElement('div', 'canvas-area', {
      style: `
        position: fixed;
        top: 48px;
        left: 0;
        right: 0;
        bottom: 32px;
        background: var(--canvas-bg, #2c2c2c);
        overflow: hidden;
      `
    });

    document.body.appendChild(canvasArea);
    this.uiElements.set('canvasArea', canvasArea);
  }

  /**
   * アイコンボタン作成ヘルパー
   */
  createIconButton(iconType, action, size = 20) {
    const button = this.createElement('button', `btn-${action}`, {
      className: 'icon-button',
      style: `
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 6px;
        background: var(--button-bg, transparent);
        color: var(--button-color, #ffffff);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 200ms ease;
      `
    });

    // アイコン設定
    if (this.iconHelper) {
      this.iconHelper.setElementIcon(button, iconType, { size, color: 'currentColor' });
    } else {
      button.textContent = '●'; // フォールバック
    }

    // イベント
    button.addEventListener('click', () => {
      this.handleAction(action);
    });

    return button;
  }

  /**
   * スライダーコントロール作成
   */
  createSliderControl(label, value, min, max, onChange) {
    const container = this.createElement('div', `slider-${label}`, {
      style: 'margin-bottom: 16px;'
    });

    const labelEl = this.createElement('label', `label-${label}`, {
      textContent: label,
      style: `
        display: block;
        margin-bottom: 8px;
        color: var(--text-color, #ffffff);
        font-size: 12px;
        font-weight: 500;
      `
    });

    const slider = this.createElement('input', `input-${label}`, {
      type: 'range',
      min: min.toString(),
      max: max.toString(),
      value: value.toString(),
      style: `
        width: 100%;
        height: 4px;
        border-radius: 2px;
        background: var(--slider-track, #404040);
        outline: none;
        cursor: pointer;
      `
    });

    const valueDisplay = this.createElement('span', `value-${label}`, {
      textContent: Math.round(value).toString(),
      style: `
        float: right;
        color: var(--text-secondary, #aaaaaa);
        font-size: 11px;
      `
    });

    slider.addEventListener('input', (e) => {
      const newValue = parseFloat(e.target.value);
      valueDisplay.textContent = Math.round(newValue).toString();
      onChange(newValue);
    });

    labelEl.appendChild(valueDisplay);
    container.appendChild(labelEl);
    container.appendChild(slider);

    return container;
  }

  /**
   * メニューアイテム作成
   */
  createMenuItem(menu) {
    const item = this.createElement('div', `menu-${menu.id}`, {
      className: 'menu-item',
      textContent: menu.label,
      style: `
        padding: 8px 12px;
        cursor: pointer;
        color: var(--text-color, #ffffff);
        font-size: 14px;
        transition: background-color 200ms ease;
        border-radius: 4px;
      `
    });

    item.addEventListener('mouseenter', () => {
      item.style.background = 'var(--menu-hover-bg, rgba(255,255,255,0.1))';
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });

    return item;
  }

  /**
   * HTML要素作成ヘルパー
   */
  createElement(tag, id, props = {}) {
    const element = document.createElement(tag);
    if (id) element.id = id;
    
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'style') {
        element.style.cssText = value;
      } else if (key === 'className') {
        element.className = value;
      } else {
        element[key] = value;
      }
    });

    return element;
  }

  /**
   * ツール選択
   */
  selectTool(toolId) {
    // 前のツールのアクティブ状態をクリア
    if (this.currentTool) {
      const prevButton = this.toolPanels.get(this.currentTool);
      if (prevButton) {
        prevButton.style.background = 'var(--tool-bg, transparent)';
        prevButton.style.transform = 'scale(1)';
      }
    }

    // 新しいツールをアクティブに
    this.currentTool = toolId;
    const button = this.toolPanels.get(toolId);
    if (button) {
      button.style.background = 'var(--tool-active-bg, rgba(96, 165, 250, 0.3))';
      button.style.transform = 'scale(1)';
    }

    // イベント発行
    this.eventStore.emit('tool:change', { tool: toolId });
  }

  /**
   * 色設定
   */
  setColor(color) {
    this.currentColor = color;
    const colorDisplay = this.uiElements.get('currentColor');
    if (colorDisplay) {
      colorDisplay.style.background = color;
    }

    this.eventStore.emit('color:change', { color });
  }

  /**
   * ブラシサイズ設定
   */
  setBrushSize(size) {
    this.brushSize = size;
    this.eventStore.emit('brush:sizeChange', { size });
  }

  /**
   * 不透明度設定
   */
  setOpacity(opacity) {
    this.opacity = opacity;
    this.eventStore.emit('brush:opacityChange', { opacity });
  }

  /**
   * アクション処理
   */
  handleAction(action) {
    this.eventStore.emit('ui:action', { action });
  }

  /**
   * イベントリスナー設定
   */
  setupEventListeners() {
    // ウィンドウリサイズ
    window.addEventListener('resize', _.throttle(() => {
      this.applyResponsiveLayout();
    }, 100));

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });
  }

  /**
   * キーボード処理
   */
  handleKeyboard(e) {
    if (e.ctrlKey || e.metaKey) return;

    const toolMap = {
      'KeyB': 'brush',
      'KeyP': 'pen',
      'KeyE': 'eraser',
      'KeyG': 'bucket',
      'KeyI': 'eyedropper',
      'KeyM': 'selection',
      'KeyH': 'hand',
      'KeyZ': 'zoom'
    };

    if (toolMap[e.code]) {
      e.preventDefault();
      this.selectTool(toolMap[e.code]);
    }
  }

  /**
   * レスポンシブレイアウト適用
   */
  applyResponsiveLayout() {
    this.isMobile = window.innerWidth < 768;
    this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    this.isDesktop = window.innerWidth >= 1024;

    if (this.isMobile) {
      this.applyMobileLayout();
    } else if (this.isTablet) {
      this.applyTabletLayout();
    } else {
      this.applyDesktopLayout();
    }
  }

  /**
   * モバイルレイアウト
   */
  applyMobileLayout() {
    const toolbar = this.uiElements.get('toolbar');
    if (toolbar) {
      toolbar.style.cssText = `
        position: fixed;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        flex-direction: row;
        padding: 8px 16px;
      `;
    }
  }

  /**
   * タブレットレイアウト
   */
  applyTabletLayout() {
    // タブレット用のレイアウト調整
  }

  /**
   * デスクトップレイアウト
   */
  applyDesktopLayout() {
    // デスクトップ用のレイアウト（デフォルト）
  }

  /**
   * アニメーション初期化
   */
  initializeAnimations() {
    // CSS変数でアニメーション設定
    document.documentElement.style.setProperty('--animation-duration', `${this.animationDuration}ms`);
    document.documentElement.style.setProperty('--ease-function', this.easeFunction);
  }

  /**
   * UI表示/非表示切り替え
   */
  toggleUI() {
    this.isUIVisible = !this.isUIVisible;
    const elements = ['toolbar', 'layerPanel', 'colorPanel', 'propertyPanel'];
    
    elements.forEach(elementKey => {
      const element = this.uiElements.get(elementKey);
      if (element) {
        element.style.opacity = this.isUIVisible ? '1' : '0';
        element.style.pointerEvents = this.isUIVisible ? 'auto' : 'none';
      }
    });
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.uiElements.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    this.toolPanels.clear();
    this.layerPanels.clear();
    this.colorPanels.clear();
    this.uiElements.clear();
    this.popupWindows.clear();
  }
}