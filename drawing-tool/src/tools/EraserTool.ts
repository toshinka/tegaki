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
    hardness: 1.0 // 消しゴムの硬さ
  };

  private isActive = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    // EventBusを通じて消しゴムモード設定
    this.eventBus.emit('tool:eraser-mode', {
      enabled: true,
      settings: this.settings
    });
    
    console.log('消しゴムツール有効化');
  }

  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    
    // EventBusを通じて消しゴムモード解除
    this.eventBus.emit('tool:eraser-mode', {
      enabled: false,
      settings: this.settings
    });
  }

  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    // EventBusを通じて描画開始（消しゴムモード）
    this.eventBus.emit('drawing:start', {
      ...event,
      toolType: 'eraser',
      settings: this.settings
    });
  }

  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive) return;
    
    // EventBusを通じて描画継続（消しゴムモード）
    this.eventBus.emit('drawing:move', {
      ...event,
      toolType: 'eraser',
      settings: this.settings
    });
  }

  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    
    // EventBusを通じて描画終了（消しゴムモード）
    this.eventBus.emit('drawing:end', {
      ...event,
      toolType: 'eraser',
      settings: this.settings
    });
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // EventBusを通じて設定更新通知
    if (this.isActive) {
      this.eventBus.emit('tool:eraser-mode', {
        enabled: true,
        settings: this.settings
      });
    }
    
    console.log('消しゴムツール設定更新:', this.settings);
  }
}