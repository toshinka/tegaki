// InputManager.ts - 入力システム統合制御
// マウス・ペンタブレット・キーボード・ショートカット統合

import type { EventBus, IEventData } from '../core/EventBus.js';

/**
 * 入力デバイスタイプ
 */
export type InputDevice = 'mouse' | 'pen' | 'touch' | 'unknown';

/**
 * 入力イベントデータ
 */
interface IInputEventData extends IEventData {
  type: 'input:drawStart' | 'input:drawMove' | 'input:drawEnd' | 'input:hover';
  x: number;
  y: number;
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
  twist?: number;
  device: InputDevice;
  button?: number;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
  };
}

/**
 * 入力設定
 */
interface IInputSettings {
  pressure: {
    enabled: boolean;
    min: number; // 最小筆圧値
    max: number; // 最大筆圧値
    curve: number; // 筆圧カーブ 0-2 (1=リニア)
  };
  smoothing: {
    enabled: boolean;
    samples: number; // スムージングサンプル数
    threshold: number; // ノイズ閾値
  };
  filtering: {
    stabilization: boolean;
    prediction: boolean;
    minSpeed: number;
    maxSpeed: number;
  };
}

/**
 * 入力統計
 */
interface IInputStats {
  totalEvents: number;
  averagePressure: number;
  maxPressure: number;
  minPressure: number;
  averageSpeed: number;
  detectedDevice: InputDevice;
  lastEventTime: number;
}

/**
 * ポイント履歴・スムージング用
 */
interface IPointHistory {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
  speed: number;
}

/**
 * 入力システム統合管理
 */
export class InputManager {
  private eventBus: EventBus;
  private canvas: HTMLCanvasElement;
  
  // 入力状態
  private isActive = false;
  private isDrawing = false;
  private currentDevice: InputDevice = 'unknown';
  private lastPointerType = '';
  
  // 座標・変換
  private canvasRect: DOMRect;
  private devicePixelRatio: number;
  private scale = 1.0;
  private offsetX = 0;
  private offsetY = 0;
  
  // 入力履歴・スムージング
  private pointHistory: IPointHistory[] = [];
  private readonly historySize = 10;
  
  // 設定・統計
  private settings: IInputSettings;
  private stats: IInputStats;
  
  // イベントリスナー保持
  private boundEventListeners: Map<string, EventListener> = new Map();

  constructor(eventBus: EventBus, canvas: HTMLCanvasElement) {
    this.eventBus = eventBus;
    this.canvas = canvas;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // 初期設定
    this.settings = this.createDefaultSettings();
    this.stats = this.createEmptyStats();
    
    // Canvas情報更新
    this.updateCanvasInfo();
    
    // イベントリスナー設定
    this.setupEventListeners();
    
    // リサイズ監視
    this.setupResizeObserver();
    
    console.log('🎮 InputManager初期化完了');
  }

  /**
   * イベントリスナー設定・Pointer Events使用
   */
  private setupEventListeners(): void {
    // Pointer Events - 統合入力処理
    this.addEventListenerWithCleanup('pointerdown', this.handlePointerDown.bind(this));
    this.addEventListenerWithCleanup('pointermove', this.handlePointerMove.bind(this));
    this.addEventListenerWithCleanup('pointerup', this.handlePointerUp.bind(this));
    this.addEventListenerWithCleanup('pointerleave', this.handlePointerLeave.bind(this));
    this.addEventListenerWithCleanup('pointercancel', this.handlePointerCancel.bind(this));
    
    // マウス補完イベント
    this.addEventListenerWithCleanup('mouseenter', this.handleMouseEnter.bind(this));
    this.addEventListenerWithCleanup('mouseleave', this.handleMouseLeave.bind(this));
    
    // キーボードショートカット
    this.addEventListenerWithCleanup('keydown', this.handleKeyDown.bind(this), window);
    this.addEventListenerWithCleanup('keyup', this.handleKeyUp.bind(this), window);
    
    // コンテキストメニュー無効化
    this.addEventListenerWithCleanup('contextmenu', this.handleContextMenu.bind(this));
    
    // タッチイベント無効化（明示的非対応）
    this.addEventListenerWithCleanup('touchstart', this.preventTouch.bind(this));
    this.addEventListenerWithCleanup('touchmove', this.preventTouch.bind(this));
    this.addEventListenerWithCleanup('touchend', this.preventTouch.bind(this));
    
    console.log('🎮 入力イベントリスナー設定完了');
  }

  /**
   * イベントリスナー追加・クリーンアップ対応
   */
  private addEventListenerWithCleanup(
    event: string, 
    handler: EventListener, 
    target: EventTarget = this.canvas
  ): void {
    target.addEventListener(event, handler, { passive: false });
    this.boundEventListeners.set(`${event}_${target === window ? 'window' : 'canvas'}`, handler);
  }

  /**
   * Pointer Down処理・描画開始
   */
  private handlePointerDown(event: PointerEvent): void {
    event.preventDefault();
    
    // デバイス検出
    this.currentDevice = this.detectDevice(event);
    this.lastPointerType = event.pointerType;
    
    // 左クリック・ペン入力のみ対応
    if (event.button !== 0 && event.pointerType !== 'pen') {
      return;
    }
    
    // 座標変換
    const coords = this.transformCoordinates(event.clientX, event.clientY);
    const pressure = this.processPressure(event.pressure || 0.5);
    
    // 履歴追加
    this.addPointToHistory(coords.x, coords.y, pressure, performance.now());
    
    // 描画開始
    this.isActive = true;
    this.isDrawing = true;
    
    // イベント発火
    const inputData: IInputEventData = {
      type: 'input:drawStart',
      timestamp: performance.now(),
      x: coords.x,
      y: coords.y,
      pressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      twist: event.twist,
      device: this.currentDevice,
      button: event.button,
      modifiers: this.getModifierKeys(event),
      data: { pointerId: event.pointerId }
    };
    
    this.eventBus.emit('input:drawStart', inputData);
    
    // 統計更新
    this.updateStats(pressure);
    
    // ポインター捕捉
    this.canvas.setPointerCapture(event.pointerId);
    
    console.log(`🎮 描画開始: ${this.currentDevice} at (${coords.x}, ${coords.y}) pressure=${pressure.toFixed(3)}`);
  }

  /**
   * Pointer Move処理・描画継続/ホバー
   */
  private handlePointerMove(event: PointerEvent): void {
    event.preventDefault();
    
    const coords = this.transformCoordinates(event.clientX, event.clientY);
    const pressure = this.processPressure(event.pressure || 0.5);
    
    // 履歴追加・スムージング
    this.addPointToHistory(coords.x, coords.y, pressure, performance.now());
    const smoothedCoords = this.settings.smoothing.enabled ? 
      this.getSmoothedCoordinates() : coords;
    
    if (this.isDrawing) {
      // 描画継続
      const inputData: IInputEventData = {
        type: 'input:drawMove',
        timestamp: performance.now(),
        x: smoothedCoords.x,
        y: smoothedCoords.y,
        pressure,
        tiltX: event.tiltX,
        tiltY: event.tiltY,
        twist: event.twist,
        device: this.currentDevice,
        modifiers: this.getModifierKeys(event),
        data: { pointerId: event.pointerId }
      };
      
      this.eventBus.emit('input:drawMove', inputData);
      this.updateStats(pressure);
    } else {
      // ホバー
      this.eventBus.emit('input:hover', {
        type: 'input:hover',
        timestamp: performance.now(),
        x: coords.x,
        y: coords.y,
        device: this.currentDevice,
        modifiers: this.getModifierKeys(event),
        data: {}
      });
    }
  }

  /**
   * Pointer Up処理・描画終了
   */
  private handlePointerUp(event: PointerEvent): void {
    event.preventDefault();
    
    if (!this.isDrawing) return;
    
    const coords = this.transformCoordinates(event.clientX, event.clientY);
    const pressure = this.processPressure(event.pressure || 0.5);
    
    // 最終点を履歴に追加
    this.addPointToHistory(coords.x, coords.y, pressure, performance.now());
    
    // 描画終了イベント
    const inputData: IInputEventData = {
      type: 'input:drawEnd',
      timestamp: performance.now(),
      x: coords.x,
      y: coords.y,
      pressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      twist: event.twist,
      device: this.currentDevice,
      button: event.button,
      modifiers: this.getModifierKeys(event),
      data: { pointerId: event.pointerId }
    };
    
    this.eventBus.emit('input:drawEnd', inputData);
    
    // 状態リセット
    this.isDrawing = false;
    this.isActive = false;
    
    // ポインター解放
    if (this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    
    console.log(`🎮 描画終了: ${this.currentDevice} at (${coords.x}, ${coords.y})`);
  }

  /**
   * Pointer Leave処理
   */
  private handlePointerLeave(event: PointerEvent): void {
    if (this.isDrawing) {
      // 描画中にCanvasから離れた場合は終了
      this.handlePointerUp(event);
    }
    this.isActive = false;
  }

  /**
   * Pointer Cancel処理
   */
  private handlePointerCancel(event: PointerEvent): void {
    if (this.isDrawing) {
      this.handlePointerUp(event);
    }
    this.isActive = false;
  }

  /**
   * Mouse Enter処理
   */
  private handleMouseEnter(event: MouseEvent): void {
    this.isActive = true;
    this.updateCanvasInfo();
  }

  /**
   * Mouse Leave処理
   */
  private handleMouseLeave(event: MouseEvent): void {
    this.isActive = false;
  }

  /**
   * キーボード押下処理・ショートカット
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const modifiers = this.getModifierKeys(event);
    
    // ショートカット処理
    if (modifiers.ctrl) {
      switch (event.code) {
        case 'KeyZ':
          event.preventDefault();
          this.eventBus.emit('action:undo', { type: 'action:undo', timestamp: performance.now(), data: {} });
          break;
        case 'KeyY':
          event.preventDefault();
          this.eventBus.emit('action:redo', { type: 'action:redo', timestamp: performance.now(), data: {} });
          break;
        case 'KeyS':
          event.preventDefault();
          this.eventBus.emit('action:save', { type: 'action:save', timestamp: performance.now(), data: {} });
          break;
        case 'KeyN':
          event.preventDefault();
          this.eventBus.emit('action:new', { type: 'action:new', timestamp: performance.now(), data: {} });
          break;
      }
    }
    
    // ツールショートカット
    switch (event.code) {
      case 'KeyB':
        this.eventBus.emit('tool:change', { type: 'tool:change', timestamp: performance.now(), data: { tool: 'brush' } });
        break;
      case 'KeyP':
        this.eventBus.emit('tool:change', { type: 'tool:change', timestamp: performance.now(), data: { tool: 'pen' } });
        break;
      case 'KeyE':
        this.eventBus.emit('tool:change', { type: 'tool:change', timestamp: performance.now(), data: { tool: 'eraser' } });
        break;
      case 'Space':
        event.preventDefault();
        this.eventBus.emit('canvas:pan', { type: 'canvas:pan', timestamp: performance.now(), data: { active: true } });
        break;
    }
  }

  /**
   * キーボード解放処理
   */
  private handleKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this.eventBus.emit('canvas:pan', { type: 'canvas:pan', timestamp: performance.now(), data: { active: false } });
        break;
    }
  }

  /**
   * コンテキストメニュー無効化
   */
  private handleContextMenu(event: Event): void {
    event.preventDefault();
  }

  /**
   * タッチイベント防止・明示的非対応
   */
  private preventTouch(event: TouchEvent): void {
    event.preventDefault();
    console.warn('🎮 タッチ操作は非対応です。マウスまたはペンタブレットをご使用ください。');
  }

  /**
   * デバイス検出
   */
  private detectDevice(event: PointerEvent): InputDevice {
    switch (event.pointerType) {
      case 'pen':
        return 'pen';
      case 'mouse':
        return 'mouse';
      case 'touch':
        return 'touch'; // 非対応だが識別
      default:
        return 'unknown';
    }
  }

  /**
   * 座標変換・Canvas座標系
   */
  private transformCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvasRect;
    const x = (clientX - rect.left - this.offsetX) * this.devicePixelRatio / this.scale;
    const y = (clientY - rect.top - this.offsetY) * this.devicePixelRatio / this.scale;
    
    return { x, y };
  }

  /**
   * 筆圧処理・カーブ適用
   */
  private processPressure(rawPressure: number): number {
    if (!this.settings.pressure.enabled) {
      return 1.0;
    }
    
    // 範囲正規化
    let pressure = Math.max(this.settings.pressure.min, Math.min(this.settings.pressure.max, rawPressure));
    
    // カーブ適用
    if (this.settings.pressure.curve !== 1.0) {
      pressure = Math.pow(pressure, this.settings.pressure.curve);
    }
    
    return pressure;
  }

  /**
   * 修飾キー状態取得
   */
  private getModifierKeys(event: PointerEvent | KeyboardEvent | MouseEvent): { shift: boolean; ctrl: boolean; alt: boolean } {
    return {
      shift: event.shiftKey,
      ctrl: event.ctrlKey || event.metaKey,
      alt: event.altKey
    };
  }

  /**
   * ポイント履歴追加・スムージング用
   */
  private addPointToHistory(x: number, y: number, pressure: number, timestamp: number): void {
    // 速度計算
    let speed = 0;
    if (this.pointHistory.length > 0) {
      const lastPoint = this.pointHistory[this.pointHistory.length - 1];
      const deltaTime = timestamp - lastPoint.timestamp;
      const deltaDistance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
      speed = deltaTime > 0 ? deltaDistance / deltaTime : 0;
    }
    
    // 履歴追加
    this.pointHistory.push({ x, y, pressure, timestamp, speed });
    
    // 履歴サイズ制限
    if (this.pointHistory.length > this.historySize) {
      this.pointHistory.shift();
    }
  }

  /**
   * スムージング座標取得
   */
  private getSmoothedCoordinates(): { x: number; y: number } {
    if (this.pointHistory.length < this.settings.smoothing.samples) {
      const lastPoint = this.pointHistory[this.pointHistory.length - 1];
      return { x: lastPoint.x, y: lastPoint.y };
    }
    
    // 重み付き平均によるスムージング
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    
    const samples = Math.min(this.settings.smoothing.samples, this.pointHistory.length);
    for (let i = this.pointHistory.length - samples; i < this.pointHistory.length; i++) {
      const point = this.pointHistory[i];
      const weight = i - (this.pointHistory.length - samples) + 1; // 新しいほど重み大
      
      weightedX += point.x * weight;
      weightedY += point.y * weight;
      totalWeight += weight;
    }
    
    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight
    };
  }

  /**
   * Canvas情報更新
   */
  private updateCanvasInfo(): void {
    this.canvasRect = this.canvas.getBoundingClientRect();
    this.devicePixelRatio = window.devicePixelRatio || 1;
  }

  /**
   * リサイズ監視設定
   */
  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        this.updateCanvasInfo();
      });
      
      resizeObserver.observe(this.canvas);
    }
    
    // ウィンドウリサイズも監視
    window.addEventListener('resize', () => {
      this.updateCanvasInfo();
    });
  }

  /**
   * 統計更新
   */
  private updateStats(pressure: number): void {
    this.stats.totalEvents++;
    this.stats.lastEventTime = performance.now();
    
    // 筆圧統計
    if (this.stats.totalEvents === 1) {
      this.stats.averagePressure = pressure;
      this.stats.maxPressure = pressure;
      this.stats.minPressure = pressure;
    } else {
      this.stats.averagePressure = (this.stats.averagePressure * (this.stats.totalEvents - 1) + pressure) / this.stats.totalEvents;
      this.stats.maxPressure = Math.max(this.stats.maxPressure, pressure);
      this.stats.minPressure = Math.min(this.stats.minPressure, pressure);
    }
    
    // 速度統計
    if (this.pointHistory.length > 0) {
      const lastPoint = this.pointHistory[this.pointHistory.length - 1];
      this.stats.averageSpeed = (this.stats.averageSpeed * (this.stats.totalEvents - 1) + lastPoint.speed) / this.stats.totalEvents;
    }
    
    this.stats.detectedDevice = this.currentDevice;
  }

  /**
   * スケール設定・ズーム対応
   */
  public setScale(scale: number, offsetX: number = 0, offsetY: number = 0): void {
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    console.log(`🎮 スケール変更: ${scale}x, offset(${offsetX}, ${offsetY})`);
  }

  /**
   * 設定更新
   */
  public updateSettings(newSettings: Partial<IInputSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('🎮 入力設定更新:', newSettings);
  }

  /**
   * 統計取得
   */
  public getStats(): IInputStats {
    return { ...this.stats };
  }

  /**
   * アクティブ状態取得
   */
  public isInputActive(): boolean {
    return this.isActive;
  }

  /**
   * 描画状態取得
   */
  public isCurrentlyDrawing(): boolean {
    return this.isDrawing;
  }

  /**
   * デフォルト設定作成
   */
  private createDefaultSettings(): IInputSettings {
    return {
      pressure: {
        enabled: true,
        min: 0.1,
        max: 1.0,
        curve: 1.0
      },
      smoothing: {
        enabled: true,
        samples: 3,
        threshold: 0.5
      },
      filtering: {
        stabilization: true,
        prediction: false,
        minSpeed: 0.1,
        maxSpeed: 1000
      }
    };
  }

  /**
   * 空統計作成
   */
  private createEmptyStats(): IInputStats {
    return {
      totalEvents: 0,
      averagePressure: 0,
      maxPressure: 0,
      minPressure: 1,
      averageSpeed: 0,
      detectedDevice: 'unknown',
      lastEventTime: 0
    };
  }

  /**
   * 破棄処理
   */
  public destroy(): void {
    // イベントリスナー削除
    this.boundEventListeners.forEach((handler, key) => {
      const [event, target] = key.split('_');
      const element = target === 'window' ? window : this.canvas;
      element.removeEventListener(event, handler);
    });
    
    this.boundEventListeners.clear();
    this.pointHistory = [];
    
    console.log('🎮 InputManager破棄完了');
  }
}