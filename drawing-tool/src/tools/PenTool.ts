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

export class PenTool implements IDrawingTool {
  public readonly name = 'pen';
  public readonly icon = 'ti ti-pencil';
  public readonly category = 'drawing' as const;

  private eventBus: EventBus;
  private settings = {
    size: 4,
    opacity: 0.8,
    color: 0x800000, // ふたばマルーン
    smoothing: true,
    pressureSensitive: true
  };

  private isActive = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    // EventBusを通じてペンモード設定
    this.eventBus.emit('tool:pen-mode', {
      enabled: true,
      settings: this.settings
    });
    
    console.log('ペンツール有効化・120Hz入力対応準備完了');
  }

  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    
    // EventBusを通じてペンモード解除
    this.eventBus.emit('tool:pen-mode', {
      enabled: false,
      settings: this.settings
    });
  }

  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    // EventBusを通じて描画開始（ペンモード）
    this.eventBus.emit('drawing:start', {
      ...event,
      toolType: 'pen',
      settings: this.settings
    });
  }

  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive) return;
    
    // EventBusを通じて描画継続（ペンモード）
    this.eventBus.emit('drawing:move', {
      ...event,
      toolType: 'pen',
      settings: this.settings
    });
  }

  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    
    // EventBusを通じて描画終了（ペンモード）
    this.eventBus.emit('drawing:end', {
      ...event,
      toolType: 'pen',
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
      this.eventBus.emit('tool:pen-mode', {
        enabled: true,
        settings: this.settings
      });
    }
    
    console.log('ペンツール設定更新:', this.settings);
  }
}