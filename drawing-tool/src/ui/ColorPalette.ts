// ColorPalette.ts - HSV円形カラーパレット・200px・Phase2新規実装
// 2_TECHNICAL_DESIGN準拠・ふたば色プリセット・直感的操作

import type { EventBus, IEventData } from '../core/EventBus.js';
import { UI_CONSTANTS } from '../constants/ui-constants.js';
import { DRAWING_CONSTANTS } from '../constants/drawing-constants.js';

/**
 * HSV色情報・色相・彩度・明度
 */
interface IHSVColor {
  h: number; // 色相 0-360度
  s: number; // 彩度 0-100%
  v: number; // 明度 0-100%
}

/**
 * RGB色情報・赤・緑・青・アルファ
 */
interface IRGBColor {
  r: number; // 赤 0-255
  g: number; // 緑 0-255
  b: number; // 青 0-255
  a: number; // アルファ 0-1
}

/**
 * カラーパレット状態・選択色・UI状態
 */
interface IColorPaletteState {
  currentColor: IHSVColor;
  currentRGB: IRGBColor;
  currentHex: number;
  isDragging: boolean;
  dragTarget: 'wheel' | 'triangle' | 'lightness' | null;
  showPresets: boolean;
  recentColors: number[];
}

/**
 * カラーパレットUI・Phase2新規実装
 * HSV円形・200px・ふたば色プリセット・直感的色選択・2_TECHNICAL_DESIGN準拠
 */
export class ColorPalette {
  private eventBus: EventBus;
  private container: HTMLElement;
  
  // Canvas要素・HSV描画・マウス操作
  private paletteContainer: HTMLElement;
  private colorWheelCanvas: HTMLCanvasElement;
  private colorWheelCtx: CanvasRenderingContext2D;
  private brightnessSlider: HTMLCanvasElement;
  private brightnessCtx: CanvasRenderingContext2D;
  
  // 色プリセット・パネル
  private presetsContainer: HTMLElement;
  private recentColorsContainer: HTMLElement;
  private colorPreviewElement: HTMLElement;
  private hexInputElement: HTMLInputElement;
  
  // 状態管理
  private state: IColorPaletteState = {
    currentColor: { h: 0, s: 100, v: 100 }, // 赤・100%彩度・100%明度
    currentRGB: { r: 255, g: 0, b: 0, a: 1 },
    currentHex: 0xff0000,
    isDragging: false,
    dragTarget: null,
    showPresets: true,
    recentColors: [...DRAWING_CONSTANTS.COLORS.PALETTE], // デフォルトパレット
  };

  constructor(eventBus: EventBus, container: HTMLElement) {
    this.eventBus = eventBus;
    this.container = container;
    
    this.initializeColorPalette();
    this.setupEventListeners();
    this.updateColorDisplay();
    
    console.log('🎨 ColorPalette初期化完了・HSV円形・200px');
  }

  /**
   * カラーパレット初期化・DOM構築・Canvas設定
   */
  private initializeColorPalette(): void {
    // CSS注入・ふたば色統一
    this.injectColorPaletteCSS();
    
    // HTML構築・Canvas生成
    this.createColorPaletteHTML();
    
    // Canvas設定・描画コンテキスト
    this.setupCanvasElements();
    
    // HSVホイール描画・初期表示
    this.drawColorWheel();
    this.drawBrightnessSlider();
    
    // プリセット色生成
    this.createColorPresets();
    
    // 初期色設定・ふたばマルーン
    this.setColor(DRAWING_CONSTANTS.COLORS.PRIMARY);
  }

  /**
   * カラーパレットCSS注入・2_TECHNICAL_DESIGN準拠
   */
  private injectColorPaletteCSS(): void {
    const cssId = 'color-palette-styles';
    if (document.getElementById(cssId)) return;

    const style = document.createElement('style');
    style.id = cssId;
    style.textContent = `
      /* カラーパレット・200px・HSV円形・Phase2新規 */
      .color-palette {
        position: fixed;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: ${UI_CONSTANTS.COLOR_PALETTE.SIZE + 40}px;
        background: ${UI_CONSTANTS.COLORS.BACKGROUND};
        border: 2px solid ${UI_CONSTANTS.COLORS.MAROON};
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 4px 16px rgba(128, 0, 0, 0.2);
        z-index: 1000;
        user-select: none;
        font-family: 'Noto Sans JP', sans-serif;
      }
      
      /* HSVカラーホイール・200px円形 */
      .color-wheel-container {
        position: relative;
        width: ${UI_CONSTANTS.COLOR_PALETTE.SIZE}px;
        height: ${UI_CONSTANTS.COLOR_PALETTE.SIZE}px;
        margin: 0 auto 16px;
        cursor: crosshair;
      }
      
      .color-wheel {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        cursor: crosshair;
      }
      
      /* 明度スライダー・横バー */
      .brightness-slider-container {
        width: 100%;
        height: 16px;
        margin-bottom: 16px;
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #cccccc;
      }
      
      .brightness-slider {
        width: 100%;
        height: 100%;
        cursor: ew-resize;
      }
      
      /* 色プレビュー・現在選択色表示 */
      .color-preview-container {
        display: flex;
        align-items: center;
        margin-bottom: 16px;
        gap: 8px;
      }
      
      .color-preview {
        width: 40px;
        height: 40px;
        border: 2px solid ${UI_CONSTANTS.COLORS.MAROON};
        border-radius: 6px;
        cursor: pointer;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
      }
      
      .hex-input {
        flex: 1;
        padding: 8px 10px;
        border: 2px solid #cccccc;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        text-align: center;
        background: white;
      }
      
      .hex-input:focus {
        outline: none;
        border-color: ${UI_CONSTANTS.COLORS.NAVY};
        box-shadow: 0 0 0 2px rgba(0, 0, 128, 0.2);
      }
      
      /* カラープリセット・ふたば色・よく使う色 */
      .color-presets {
        margin-bottom: 12px;
      }
      
      .presets-label {
        font-size: 12px;
        font-weight: bold;
        color: ${UI_CONSTANTS.COLORS.MAROON};
        margin-bottom: 6px;
        display: block;
      }
      
      .preset-colors {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
      }
      
      .preset-color {
        width: 32px;
        height: 32px;
        border: 1px solid #cccccc;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
      }
      
      .preset-color:hover {
        transform: scale(1.1);
        border-color: ${UI_CONSTANTS.COLORS.NAVY};
        box-shadow: 0 2px 8px rgba(0, 0, 128, 0.3);
      }
      
      .preset-color.active {
        border-color: ${UI_CONSTANTS.COLORS.MAROON};
        border-width: 2px;
        box-shadow: 0 0 0 2px rgba(128, 0, 0, 0.3);
      }
      
      /* 最近使った色・履歴表示 */
      .recent-colors {
        border-top: 1px solid #eeeeee;
        padding-top: 12px;
      }
      
      .recent-label {
        font-size: 11px;
        color: #666666;
        margin-bottom: 6px;
        display: block;
      }
      
      .recent-colors-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 3px;
      }
      
      .recent-color {
        width: 24px;
        height: 24px;
        border: 1px solid #ddd;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      
      .recent-color:hover {
        transform: scale(1.15);
        border-color: ${UI_CONSTANTS.COLORS.ACCENT};
      }
      
      /* カラーピッカー・インジケーター */
      .color-indicator {
        position: absolute;
        width: 12px;
        height: 12px;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2);
        pointer-events: none;
        transform: translate(-50%, -50%);
      }
      
      .brightness-indicator {
        position: absolute;
        top: -2px;
        width: 4px;
        height: 20px;
        background: white;
        border: 1px solid rgba(0,0,0,0.3);
        border-radius: 2px;
        pointer-events: none;
        transform: translateX(-50%);
      }
      
      /* レスポンシブ・小画面対応 */
      @media (max-width: 768px) {
        .color-palette {
          position: fixed;
          bottom: 120px;
          right: 8px;
          top: auto;
          transform: none;
          width: ${UI_CONSTANTS.COLOR_PALETTE.SIZE + 20}px;
          padding: 12px;
        }
        
        .color-wheel-container {
          width: ${UI_CONSTANTS.COLOR_PALETTE.SIZE - 40}px;
          height: ${UI_CONSTANTS.COLOR_PALETTE.SIZE - 40}px;
        }
        
        .preset-colors {
          grid-template-columns: repeat(4, 1fr);
        }
      }
      
      /* 高DPI対応・Retina表示 */
      @media (min-resolution: 2dppx) {
        .color-wheel,
        .brightness-slider {
          image-rendering: pixelated;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * カラーパレットHTML構築・DOM生成
   */
  private createColorPaletteHTML(): void {
    this.paletteContainer = document.createElement('div');
    this.paletteContainer.className = 'color-palette';
    this.paletteContainer.setAttribute('role', 'dialog');
    this.paletteContainer.setAttribute('aria-label', 'Color Picker');
    
    this.paletteContainer.innerHTML = `
      <!-- HSVカラーホイール -->
      <div class="color-wheel-container">
        <canvas class="color-wheel" width="${UI_CONSTANTS.COLOR_PALETTE.SIZE * 2}" height="${UI_CONSTANTS.COLOR_PALETTE.SIZE * 2}"></canvas>
        <div class="color-indicator"></div>
      </div>
      
      <!-- 明度スライダー -->
      <div class="brightness-slider-container">
        <canvas class="brightness-slider" width="${(UI_CONSTANTS.COLOR_PALETTE.SIZE + 40 - 32) * 2}" height="32"></canvas>
        <div class="brightness-indicator"></div>
      </div>
      
      <!-- 色プレビュー・Hex入力 -->
      <div class="color-preview-container">
        <div class="color-preview"></div>
        <input type="text" class="hex-input" value="#FF0000" maxlength="7" placeholder="#RRGGBB">
      </div>
      
      <!-- プリセット色 -->
      <div class="color-presets">
        <span class="presets-label">プリセット色</span>
        <div class="preset-colors"></div>
      </div>
      
      <!-- 最近使った色 -->
      <div class="recent-colors">
        <span class="recent-label">最近使った色</span>
        <div class="recent-colors-grid"></div>
      </div>
    `;
    
    this.container.appendChild(this.paletteContainer);
  }

  /**
   * Canvas要素設定・描画コンテキスト取得
   */
  private setupCanvasElements(): void {
    // カラーホイールCanvas
    this.colorWheelCanvas = this.paletteContainer.querySelector('.color-wheel') as HTMLCanvasElement;
    this.colorWheelCtx = this.colorWheelCanvas.getContext('2d')!;
    
    // 明度スライダーCanvas
    this.brightnessSlider = this.paletteContainer.querySelector('.brightness-slider') as HTMLCanvasCanvas;
    this.brightnessCtx = this.brightnessSlider.getContext('2d')!;
    
    // その他要素
    this.presetsContainer = this.paletteContainer.querySelector('.preset-colors') as HTMLElement;
    this.recentColorsContainer = this.paletteContainer.querySelector('.recent-colors-grid') as HTMLElement;
    this.colorPreviewElement = this.paletteContainer.querySelector('.color-preview') as HTMLElement;
    this.hexInputElement = this.paletteContainer.querySelector('.hex-input') as HTMLInputElement;
    
    // High DPI対応・Retina表示
    const pixelRatio = window.devicePixelRatio || 1;
    
    // カラーホイール高解像度設定
    const wheelSize = UI_CONSTANTS.COLOR_PALETTE.SIZE;
    this.colorWheelCanvas.width = wheelSize * pixelRatio;
    this.colorWheelCanvas.height = wheelSize * pixelRatio;
    this.colorWheelCanvas.style.width = `${wheelSize}px`;
    this.colorWheelCanvas.style.height = `${wheelSize}px`;
    this.colorWheelCtx.scale(pixelRatio, pixelRatio);
    
    // 明度スライダー高解像度設定
    const sliderWidth = wheelSize + 40 - 32;
    this.brightnessSlider.width = sliderWidth * pixelRatio;
    this.brightnessSlider.height = 16 * pixelRatio;
    this.brightnessSlider.style.width = `${sliderWidth}px`;
    this.brightnessSlider.style.height = '16px';
    this.brightnessCtx.scale(pixelRatio, pixelRatio);
  }

  /**
   * HSVカラーホイール描画・色相・彩度円形表示
   */
  private drawColorWheel(): void {
    const ctx = this.colorWheelCtx;
    const size = UI_CONSTANTS.COLOR_PALETTE.SIZE;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = UI_CONSTANTS.COLOR_PALETTE.CIRCLE_RADIUS;
    
    ctx.clearRect(0, 0, size, size);
    
    // HSVカラーホイール・放射状グラデーション
    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = angle * Math.PI / 180;
      
      // 色相グラデーション・外周
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, this.hsvToHex(angle, 100, 100));
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
    }
    
    // 中央白円・彩度0表現
    const whiteRadius = UI_CONSTANTS.COLOR_PALETTE.CENTER_SIZE;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(centerX, centerY, whiteRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // 外周境界線
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * 明度スライダー描画・水平グラデーション
   */
  private drawBrightnessSlider(): void {
    const ctx = this.brightnessCtx;
    const width = UI_CONSTANTS.COLOR_PALETTE.SIZE + 40 - 32;
    const height = 16;
    
    ctx.clearRect(0, 0, width, height);
    
    // 明度グラデーション・黒→現在色相
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'black');
    gradient.addColorStop(1, this.hsvToHex(this.state.currentColor.h, this.state.currentColor.s, 100));
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * プリセット色生成・ふたば色・よく使う色
   */
  private createColorPresets(): void {
    this.presetsContainer.innerHTML = '';
    
    DRAWING_CONSTANTS.COLORS.PALETTE.forEach((color, index) => {
      const presetElement = document.createElement('div');
      presetElement.className = 'preset-color';
      presetElement.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
      presetElement.setAttribute('data-color', color.toString());
      presetElement.setAttribute('title', `プリセット色 ${index + 1}`);
      
      presetElement.addEventListener('click', () => {
        this.setColor(color);
      });
      
      this.presetsContainer.appendChild(presetElement);
    });
  }

  /**
   * イベントリスナー設定・マウス・タッチ・キーボード
   */
  private setupEventListeners(): void {
    // カラーホイールマウス操作
    this.setupColorWheelEvents();
    
    // 明度スライダーマウス操作
    this.setupBrightnessSliderEvents();
    
    // Hex入力処理
    this.setupHexInputEvents();
    
    // EventBus連携・外部色変更
    this.eventBus.on('color:changed', (data: IEventData['color:changed']) => {
      this.setColor(data.color);
    });
    
    // ツール色設定要求
    this.eventBus.on('tool:request-color', () => {
      this.eventBus.emit('color:selected', {
        color: this.state.currentHex,
        rgb: this.state.currentRGB,
        hsv: this.state.currentColor,
        timestamp: Date.now()
      });
    });
  }

  /**
   * カラーホイールマウス操作・色相・彩度選択
   */
  private setupColorWheelEvents(): void {
    const handleWheelInteraction = (event: MouseEvent | TouchEvent) => {
      const rect = this.colorWheelCanvas.getBoundingClientRect();
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      
      const x = clientX - rect.left - rect.width / 2;
      const y = clientY - rect.top - rect.height / 2;
      
      const distance = Math.sqrt(x * x + y * y);
      const maxRadius = UI_CONSTANTS.COLOR_PALETTE.CIRCLE_RADIUS;
      
      if (distance <= maxRadius) {
        const angle = Math.atan2(y, x) * 180 / Math.PI;
        const hue = (angle + 360) % 360;
        const saturation = Math.min(distance / maxRadius * 100, 100);
        
        this.state.currentColor.h = hue;
        this.state.currentColor.s = saturation;
        
        this.updateColorFromHSV();
        this.updateColorDisplay();
      }
    };
    
    this.colorWheelCanvas.addEventListener('mousedown', (event) => {
      this.state.isDragging = true;
      this.state.dragTarget = 'wheel';
      handleWheelInteraction(event);
    });
    
    this.colorWheelCanvas.addEventListener('mousemove', (event) => {
      if (this.state.isDragging && this.state.dragTarget === 'wheel') {
        handleWheelInteraction(event);
      }
    });
    
    // タッチ操作対応
    this.colorWheelCanvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.state.isDragging = true;
      this.state.dragTarget = 'wheel';
      handleWheelInteraction(event);
    });
    
    this.colorWheelCanvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      if (this.state.isDragging && this.state.dragTarget === 'wheel') {
        handleWheelInteraction(event);
      }
    });
  }

  /**
   * 明度スライダーマウス操作・明度選択
   */
  private setupBrightnessSliderEvents(): void {
    const handleBrightnessInteraction = (event: MouseEvent | TouchEvent) => {
      const rect = this.brightnessSlider.getBoundingClientRect();
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      
      this.state.currentColor.v = percentage;
      this.updateColorFromHSV();
      this.updateColorDisplay();
    };
    
    this.brightnessSlider.addEventListener('mousedown', (event) => {
      this.state.isDragging = true;
      this.state.dragTarget = 'lightness';
      handleBrightnessInteraction(event);
    });
    
    this.brightnessSlider.addEventListener('mousemove', (event) => {
      if (this.state.isDragging && this.state.dragTarget === 'lightness') {
        handleBrightnessInteraction(event);
      }
    });
    
    // タッチ操作
    this.brightnessSlider.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.state.isDragging = true;
      this.state.dragTarget = 'lightness';
      handleBrightnessInteraction(event);
    });
    
    this.brightnessSlider.addEventListener('touchmove', (event) => {
      event.preventDefault();
      if (this.state.isDragging && this.state.dragTarget === 'lightness') {
        handleBrightnessInteraction(event);
      }
    });
    
    // グローバルマウスアップ・ドラッグ終了
    document.addEventListener('mouseup', () => {
      this.state.isDragging = false;
      this.state.dragTarget = null;
    });
    
    document.addEventListener('touchend', () => {
      this.state.isDragging = false;
      this.state.dragTarget = null;
    });
  }

  /**
   * Hex入力処理・手動色入力
   */
  private setupHexInputEvents(): void {
    this.hexInputElement.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      let value = target.value.replace(/[^0-9A-Fa-f#]/g, '');
      
      if (!value.startsWith('#')) {
        value = '#' + value;
      }
      
      if (value.length <= 7) {
        target.value = value.toUpperCase();
        
        if (value.length === 7) {
          const hexValue = parseInt(value.substring(1), 16);
          if (!isNaN(hexValue)) {
            this.setColor(hexValue);
          }
        }
      }
    });
    
    this.hexInputElement.addEventListener('blur', () => {
      // 無効な値の場合は現在の色に戻す
      this.hexInputElement.value = `#${this.state.currentHex.toString(16).padStart(6, '0').toUpperCase()}`;
    });
  }

  /**
   * 色設定・外部からの色変更・内部状態更新
   */
  public setColor(color: number): void {
    this.state.currentHex = color;
    this.state.currentRGB = this.hexToRgb(color);
    this.state.currentColor = this.rgbToHsv(this.state.currentRGB.r, this.state.currentRGB.g, this.state.currentRGB.b);
    
    this.updateColorDisplay();
    this.addToRecentColors(color);
    
    // 色変更通知
    this.eventBus.emit('color:selected', {
      color: this.state.currentHex,
      rgb: this.state.currentRGB,
      hsv: this.state.currentColor,
      timestamp: Date.now()
    });
    
    console.log(`🎨 色選択: #${color.toString(16).padStart(6, '0').toUpperCase()}`);
  }

  /**
   * HSVから色更新・内部色変換
   */
  private updateColorFromHSV(): void {
    this.state.currentRGB = this.hsvToRgb(this.state.currentColor.h, this.state.currentColor.s, this.state.currentColor.v);
    this.state.currentHex = this.rgbToHex(this.state.currentRGB.r, this.state.currentRGB.g, this.state.currentRGB.b);
    
    // 色変更通知
    this.eventBus.emit('color:selected', {
      color: this.state.currentHex,
      rgb: this.state.currentRGB,
      hsv: this.state.currentColor,
      timestamp: Date.now()
    });
  }

  /**
   * 色表示更新・UI反映・インジケーター位置
   */
  private updateColorDisplay(): void {
    // 色プレビュー更新
    this.colorPreviewElement.style.backgroundColor = `#${this.state.currentHex.toString(16).padStart(6, '0')}`;
    
    // Hex入力更新
    this.hexInputElement.value = `#${this.state.currentHex.toString(16).padStart(6, '0').toUpperCase()}`;
    
    // 明度スライダー再描画
    this.drawBrightnessSlider();
    
    // インジケーター位置更新
    this.updateIndicatorPositions();
    
    // プリセット色アクティブ状態
    this.updatePresetActiveState();
  }

  /**
   * インジケーター位置更新・視覚フィードバック
   */
  private updateIndicatorPositions(): void {
    const centerX = UI_CONSTANTS.COLOR_PALETTE.SIZE / 2;
    const centerY = UI_CONSTANTS.COLOR_PALETTE.SIZE / 2;
    const radius = (this.state.currentColor.s / 100) * UI_CONSTANTS.COLOR_PALETTE.CIRCLE_RADIUS;
    const angle = this.state.currentColor.h * Math.PI / 180;
    
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    const indicator = this.paletteContainer.querySelector('.color-indicator') as HTMLElement;
    if (indicator) {
      indicator.style.left = `${x}px`;
      indicator.style.top = `${y}px`;
    }
    
    // 明度インジケーター
    const brightnessIndicator = this.paletteContainer.querySelector('.brightness-indicator') as HTMLElement;
    if (brightnessIndicator) {
      const brightnessX = (this.state.currentColor.v / 100) * (UI_CONSTANTS.COLOR_PALETTE.SIZE + 40 - 32);
      brightnessIndicator.style.left = `${brightnessX}px`;
    }
  }

  /**
   * プリセット色アクティブ状態更新
   */
  private updatePresetActiveState(): void {
    const presetColors = this.presetsContainer.querySelectorAll('.preset-color');
    presetColors.forEach((element) => {
      const presetColor = parseInt((element as HTMLElement).getAttribute('data-color') || '0');
      if (presetColor === this.state.currentHex) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    });
  }

  /**
   * 最近使った色に追加・履歴管理
   */
  private addToRecentColors(color: number): void {
    // 既存色削除・先頭追加
    const index = this.state.recentColors.indexOf(color);
    if (index > -1) {
      this.state.recentColors.splice(index, 1);
    }
    
    this.state.recentColors.unshift(color);
    
    // 最大12色まで
    if (this.state.recentColors.length > 12) {
      this.state.recentColors = this.state.recentColors.slice(0, 12);
    }
    
    this.updateRecentColorsDisplay();
  }

  /**
   * 最近使った色表示更新
   */
  private updateRecentColorsDisplay(): void {
    this.recentColorsContainer.innerHTML = '';
    
    this.state.recentColors.forEach((color) => {
      const recentElement = document.createElement('div');
      recentElement.className = 'recent-color';
      recentElement.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
      recentElement.setAttribute('title', `#${color.toString(16).padStart(6, '0').toUpperCase()}`);
      
      recentElement.addEventListener('click', () => {
        this.setColor(color);
      });
      
      this.recentColorsContainer.appendChild(recentElement);
    });
  }

  /**
   * HSV→RGB変換・色空間変換
   */
  private hsvToRgb(h: number, s: number, v: number): IRGBColor {
    h = h / 360;
    s = s / 100;
    v = v / 100;
    
    const c = v * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = v - c;
    
    let r = 0, g = 0, b = 0;
    
    if (h < 1/6) {
      r = c; g = x; b = 0;
    } else if (h < 2/6) {
      r = x; g = c; b = 0;
    } else if (h < 3/6) {
      r = 0; g = c; b = x;
    } else if (h < 4/6) {
      r = 0; g = x; b = c;
    } else if (h < 5/6) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }
    
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
      a: 1
    };
  }

  /**
   * RGB→HSV変換・色空間変換
   */
  private rgbToHsv(r: number, g: number, b: number): IHSVColor {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    const s = max === 0 ? 0 : diff / max;
    const v = max;
    
    if (diff !== 0) {
      switch (max) {
        case r: h = ((g - b) / diff + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / diff + 2) / 6; break;
        case b: h = ((r - g) / diff + 4) / 6; break;
      }
    }
    
    return {
      h: h * 360,
      s: s * 100,
      v: v * 100
    };
  }

  /**
   * Hex→RGB変換
   */
  private hexToRgb(hex: number): IRGBColor {
    return {
      r: (hex >> 16) & 0xFF,
      g: (hex >> 8) & 0xFF,
      b: hex & 0xFF,
      a: 1
    };
  }

  /**
   * RGB→Hex変換
   */
  private rgbToHex(r: number, g: number, b: number): number {
    return ((r << 16) | (g << 8) | b);
  }

  /**
   * HSV→Hex変換・直接変換
   */
  private hsvToHex(h: number, s: number, v: number): string {
    const rgb = this.hsvToRgb(h, s, v);
    return `#${((rgb.r << 16) | (rgb.g << 8) | rgb.b).toString(16).padStart(6, '0')}`;
  }

  /**
   * 現在の色取得・外部アクセス用
   */
  public getCurrentColor(): { hex: number; rgb: IRGBColor; hsv: IHSVColor } {
    return {
      hex: this.state.currentHex,
      rgb: { ...this.state.currentRGB },
      hsv: { ...this.state.currentColor }
    };
  }

  /**
   * 色履歴取得・設定保存用
   */
  public getRecentColors(): number[] {
    return [...this.state.recentColors];
  }

  /**
   * 色履歴設定・設定復元用
   */
  public setRecentColors(colors: number[]): void {
    this.state.recentColors = colors.slice(0, 12);
    this.updateRecentColorsDisplay();
  }

  /**
   * プリセット表示切り替え・UI最適化
   */
  public togglePresets(): void {
    this.state.showPresets = !this.state.showPresets;
    const presetsElement = this.paletteContainer.querySelector('.color-presets') as HTMLElement;
    if (presetsElement) {
      presetsElement.style.display = this.state.showPresets ? 'block' : 'none';
    }
  }

  /**
   * カラーパレット状態取得・デバッグ用
   */
  public getState(): IColorPaletteState {
    return {
      ...this.state,
      currentColor: { ...this.state.currentColor },
      currentRGB: { ...this.state.currentRGB },
      recentColors: [...this.state.recentColors]
    };
  }

  /**
   * カラーパレット破棄・メモリクリア
   */
  public destroy(): void {
    // イベントリスナー削除
    document.removeEventListener('mouseup', () => {});
    document.removeEventListener('touchend', () => {});
    
    // DOM削除
    if (this.paletteContainer && this.paletteContainer.parentNode) {
      this.paletteContainer.parentNode.removeChild(this.paletteContainer);
    }
    
    // CSS削除
    const cssElement = document.getElementById('color-palette-styles');
    if (cssElement) {
      cssElement.remove();
    }
    
    console.log('🎨 ColorPalette破棄完了');
  }
}