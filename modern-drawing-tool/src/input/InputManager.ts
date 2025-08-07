// src/input/InputManager.ts - マウス・ペンタブレット統合・筆圧・座標変換

import { Point } from 'pixi.js';
import { EventBus } from '../core/EventBus';

export class InputManager {
  private eventBus: EventBus;
  private canvas: HTMLCanvasElement;
  private isPointerDown = false;
  private lastPointer: PointerEvent | null = null;
  private pressureHistory: number[] = [];
  private lastPosition: Point | null = null;
  private lastTime = 0;
  
  // 座標変換用キャッシュ
  private canvasRect: DOMRect | null = null;
  private scaleX = 1;
  private scaleY = 1;
  
  constructor(eventBus: EventBus, canvas: HTMLCanvasElement) {
    this.eventBus = eventBus;
    this.canvas = canvas;
    this.updateCanvasMetrics();
    this.setupPointerEvents();
    this.setupResizeObserver();
    console.log('🖱️ InputManager初期化完了');
  }

  // キャンバス座標変換情報更新・高精度・2.5K対応
  private updateCanvasMetrics(): void {
    this.canvasRect = this.canvas.getBoundingClientRect();
    this.scaleX = this.canvas.width / this.canvasRect.width;
    this.scaleY = this.canvas.height / this.canvasRect.height;
  }

  // リサイズ監視・座標変換更新・自動調整
  private setupResizeObserver(): void {
    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(() => {
        this.updateCanvasMetrics();
      });
      resizeObserver.observe(this.canvas);
    } else {
      // フォールバック・定期更新
      setInterval(() => this.updateCanvasMetrics(), 1000);
    }
  }

  // Pointer Events統一・マウス・ペン・デバイス抽象化
  private setupPointerEvents(): void {
    // タッチ無効化・マウス・ペン専用
    this.canvas.style.touchAction = 'none';
    
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this), { passive: false });
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this), { passive: false });
    this.canvas.addEventListener('pointercancel', this.onPointerUp.bind(this), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // マウスホイール無効化・描画専用
    this.canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  }

  // ポインター開始・描画開始・座標・筆圧処理
  private onPointerDown(event: PointerEvent): void {
    // プライマリポインターのみ・マルチタッチ無効
    if (!event.isPrimary) return;

    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    
    this.isPointerDown = true;
    this.lastPointer = event;
    this.lastTime = performance.now();

    // 座標変換・スクリーン→キャンバス・高精度
    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
    this.lastPosition = canvasPoint;

    // 筆圧処理・0.1-1.0範囲・デバイス対応
    const pressure = this.processPressure(event.pressure || 0.5);

    console.log(`🖊️ 描画開始: ${canvasPoint.x.toFixed(1)}, ${canvasPoint.y.toFixed(1)}, 筆圧: ${pressure.toFixed(2)}`);

    this.eventBus.emit('drawing:start', {
      point: canvasPoint,
      pressure,
      pointerType: event.pointerType === 'pen' ? 'pen' : 'mouse'
    });
  }

  // ポインター移動・描画継続・ベロシティ計算
  private onPointerMove(event: PointerEvent): void {
    if (!event.isPrimary) return;
    
    const currentTime = performance.now();
    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
    
    // 描画中の場合・継続描画イベント発火
    if (this.isPointerDown && this.lastPosition) {
      event.preventDefault();
      
      // ベロシティ計算・自然な描画・手ブレ検出
      const velocity = this.calculateVelocity(canvasPoint, currentTime);
      const pressure = this.processPressure(event.pressure || 0.5);

      this.eventBus.emit('drawing:move', {
        point: canvasPoint,
        pressure,
        velocity
      });

      this.lastPosition = canvasPoint;
      this.lastTime = currentTime;
    }
    
    this.lastPointer = event;
  }

  // ポインター終了・描画終了・リソース解放
  private onPointerUp(event: PointerEvent): void {
    if (!event.isPrimary) return;

    event.preventDefault();
    
    if (this.isPointerDown) {
      const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
      
      console.log(`🏁 描画終了: ${canvasPoint.x.toFixed(1)}, ${canvasPoint.y.toFixed(1)}`);
      
      this.eventBus.emit('drawing:end', { point: canvasPoint });
    }

    // 状態リセット・次回描画準備
    this.isPointerDown = false;
    this.lastPointer = null;
    this.lastPosition = null;
    this.pressureHistory = [];
    this.canvas.releasePointerCapture(event.pointerId);
  }

  // 座標変換・スクリーン→キャンバス・2560×1440対応・高精度
  private screenToCanvas(screenX: number, screenY: number): Point {
    if (!this.canvasRect) {
      this.updateCanvasMetrics();
    }

    const x = (screenX - this.canvasRect!.left) * this.scaleX;
    const y = (screenY - this.canvasRect!.top) * this.scaleY;

    return new Point(
      Math.max(0, Math.min(this.canvas.width, x)),
      Math.max(0, Math.min(this.canvas.height, y))
    );
  }

  // 筆圧処理・スムージング・0.1-1.0範囲・自然な変化
  private processPressure(rawPressure: number): number {
    // 筆圧履歴追加・スムージング用
    this.pressureHistory.push(rawPressure);
    if (this.pressureHistory.length > 5) this.pressureHistory.shift();

    // 移動平均スムージング・自然な筆圧変化
    const smoothPressure = this.pressureHistory.reduce((sum, p) => sum + p, 0) / this.pressureHistory.length;
    
    // 0.1-1.0範囲に正規化・最小筆圧保証
    return Math.max(0.1, Math.min(1.0, smoothPressure));
  }

  // ベロシティ計算・px/ms・描画速度・手ブレ検出
  private calculateVelocity(currentPoint: Point, currentTime: number): number {
    if (!this.lastPosition || this.lastTime === 0) return 0;

    const deltaTime = currentTime - this.lastTime;
    if (deltaTime === 0) return 0;

    const deltaX = currentPoint.x - this.lastPosition.x;
    const deltaY = currentPoint.y - this.lastPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // px/ms→px/s変換・ベロシティ正規化
    return (distance / deltaTime) * 1000;
  }

  // デバイス情報取得・ペンタブレット・マウス判定
  public getDeviceInfo(): {
    hasPointerEvents: boolean;
    supportsPressure: boolean;
    supportsTilt: boolean;
    currentDevice: 'mouse' | 'pen' | 'unknown';
  } {
    return {
      hasPointerEvents: 'PointerEvent' in window,
      supportsPressure: this.lastPointer ? this.lastPointer.pressure > 0 : false,
      supportsTilt: this.lastPointer ? 
        (this.lastPointer.tiltX !== undefined && this.lastPointer.tiltY !== undefined) : false,
      currentDevice: this.lastPointer ? 
        (this.lastPointer.pointerType === 'pen' ? 'pen' : 'mouse') : 'unknown'
    };
  }

  // 座標変換テスト・デバッグ・精度確認
  public testCoordinateAccuracy(screenX: number, screenY: number): {
    screen: { x: number; y: number };
    canvas: { x: number; y: number };
    scale: { x: number; y: number };
    rect: DOMRect;
  } {
    const canvasPoint = this.screenToCanvas(screenX, screenY);
    
    return {
      screen: { x: screenX, y: screenY },
      canvas: { x: canvasPoint.x, y: canvasPoint.y },
      scale: { x: this.scaleX, y: this.scaleY },
      rect: this.canvasRect!
    };
  }

  // 統計情報取得・分析・最適化
  public getInputStats(): {
    isActive: boolean;
    pressureRange: { min: number; max: number; current: number };
    lastVelocity: number;
    deviceType: string;
  } {
    const pressureMin = this.pressureHistory.length > 0 ? Math.min(...this.pressureHistory) : 0;
    const pressureMax = this.pressureHistory.length > 0 ? Math.max(...this.pressureHistory) : 0;
    const pressureCurrent = this.pressureHistory.length > 0 ? 
      this.pressureHistory[this.pressureHistory.length - 1] : 0;

    return {
      isActive: this.isPointerDown,
      pressureRange: {
        min: pressureMin,
        max: pressureMax,
        current: pressureCurrent
      },
      lastVelocity: this.lastPosition && this.lastTime ? 
        this.calculateVelocity(this.lastPosition, performance.now()) : 0,
      deviceType: this.lastPointer?.pointerType || 'unknown'
    };
  }

  // リソース解放・イベント削除・メモリリーク防止
  public destroy(): void {
    console.log('🔄 InputManager破棄・リソース解放中...');
    
    // イベントリスナー削除
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    
    // 状態リセット
    this.isPointerDown = false;
    this.lastPointer = null;
    this.lastPosition = null;
    this.pressureHistory = [];
    this.canvasRect = null;
    
    console.log('✅ InputManager破棄完了');
  }
}