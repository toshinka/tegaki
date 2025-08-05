import { EventBus } from '../core/EventBus.js';
import { IEventData, PointerType } from '../types/drawing.types.js';
import * as PIXI from 'pixi.js';

export class InputManager {
  private eventBus: EventBus;
  private canvas: HTMLCanvasElement;
  private isPointerDown = false;
  private lastPointer: PointerEvent | null = null;
  private pressureHistory: number[] = [];

  constructor(eventBus: EventBus, canvas: HTMLCanvasElement) {
    this.eventBus = eventBus;
    this.canvas = canvas;
    this.setupPointerEvents();
  }

  // 参考資料の120Hz入力対応・Pointer Events統合継承
  private setupPointerEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('pointerleave', this.onPointerUp.bind(this));
    
    // コンテキストメニュー無効化
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary) return; // 主ポインターのみ

    event.preventDefault();
    this.isPointerDown = true;
    this.lastPointer = event;

    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
    const pressure = this.processPressure(event.pressure || 0.5);

    const drawingData: IEventData['drawing:start'] = {
      point: canvasPoint,
      pressure,
      pointerType: event.pointerType === 'pen' ? 'pen' : 'mouse',
      button: event.button
    };

    this.eventBus.emit('drawing:start', drawingData);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!event.isPrimary) return;

    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);

    if (this.isPointerDown) {
      // 移動量フィルタリング・不要イベント削減
      if (this.lastPointer) {
        const distance = Math.hypot(
          event.clientX - this.lastPointer.clientX,
          event.clientY - this.lastPointer.clientY
        );
        
        if (distance < 1) return; // 1px未満無視
      }

      const pressure = this.processPressure(event.pressure || 0.5);
      const velocity = this.calculateVelocity(event);

      const drawingData: IEventData['drawing:move'] = {
        point: canvasPoint,
        pressure,
        velocity
      };

      this.eventBus.emit('drawing:move', drawingData);
    }

    this.lastPointer = event;
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.isPointerDown || !event.isPrimary) return;

    this.isPointerDown = false;
    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);

    const drawingData: IEventData['drawing:end'] = {
      point: canvasPoint
    };

    this.eventBus.emit('drawing:end', drawingData);
    this.lastPointer = null;
    this.pressureHistory = [];
  }

  // 座標変換・スクリーン→キャンバス・2.5K対応・参考資料継承
  private screenToCanvas(screenX: number, screenY: number): PIXI.Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return new PIXI.Point(
      (screenX - rect.left) * scaleX,
      (screenY - rect.top) * scaleY
    );
  }

  // 筆圧処理・スムージング・自然な変化・参考資料の120Hz対応継承
  private processPressure(rawPressure: number): number {
    // 筆圧履歴でスムージング
    this.pressureHistory.push(rawPressure);
    if (this.pressureHistory.length > 5) {
      this.pressureHistory.shift();
    }

    // 移動平均でスムース化
    const smoothPressure = this.pressureHistory.reduce((sum, p) => sum + p, 0) / this.pressureHistory.length;
    
    // 筆圧曲線補正・0.1-1.0範囲・参考資料準拠
    return Math.max(0.1, Math.min(1.0, smoothPressure));
  }

  // 速度計算・描画表現用
  private calculateVelocity(currentEvent: PointerEvent): number {
    if (!this.lastPointer) return 0;

    const distance = Math.hypot(
      currentEvent.clientX - this.lastPointer.clientX,
      currentEvent.clientY - this.lastPointer.clientY
    );

    const timeDelta = currentEvent.timeStamp - this.lastPointer.timeStamp;
    return timeDelta > 0 ? distance / timeDelta : 0;
  }

  public destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.removeEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.removeEventListener('pointerup', this.onPointerUp.bind(this));
  }
}