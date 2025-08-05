import { EventBus } from '../core/EventBus.js';
import { IEventData } from '../types/drawing.types.js';

export interface IDrawingTool {
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IEventData['drawing:start']): void;
  onPointerMove(event: IEventData['drawing:move']): void;
  onPointerUp(event: IEventData['drawing:end']): void;
  getSettings(): any;
  updateSettings(settings: Partial<any>): void;
}

export class EraserTool implements IDrawingTool {
  public readonly name = 'eraser';
  public readonly icon = 'ti ti-eraser';
  public readonly category = 'editing' as const;

  private eventBus: EventBus;
  private settings = {
    size: 12,
    opacity: 1.0,
    hardness: 1.0,
    blendMode: 'destination-out' as const
  };

  private isActive = false;
  private isDrawing = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    // 消しゴムツール有効化イベント発火
    this.eventBus.emit('tool:change', {
      toolName: this.name,
      previousTool: 'unknown',
      settings: this.getSettings(),
      timestamp: performance.now()
    });
    
    console.log('消しゴムツール有効化');
  }

  public deactivate(): void {
    this.isActive = false;
    this.isDrawing = false;
    document.body.style.cursor = 'default';
  }

  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    this.isDrawing = true;
    
    // 消しゴム描画開始イベント発火
    this.eventBus.emit('drawing:start', {
      point: event.point,
      pressure: event.pressure,
      pointerType: event.pointerType,
      timestamp: performance.now()
    });
  }

  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.isDrawing) return;
    
    // 消しゴム描画継続イベント発火
    this.eventBus.emit('drawing:move', {
      point: event.point,
      pressure: event.pressure,
      velocity: event.velocity,
      timestamp: performance.now()
    });
  }

  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive || !this.isDrawing) return;
    
    this.isDrawing = false;
    
    // 消しゴム描画終了イベント発火
    this.eventBus.emit('drawing:end', {
      point: event.point,
      timestamp: performance.now()
    });
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    const previousSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    // 設定変更イベント発火
    for (const [key, value] of Object.entries(newSettings)) {
      this.eventBus.emit('tool:setting-change', {
        toolName: this.name,
        setting: key,
        value,
        timestamp: performance.now()
      });
    }
    
    console.log('消しゴムツール設定更新:', this.settings);
  }
}