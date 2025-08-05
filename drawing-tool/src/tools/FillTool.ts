import { EventBus } from '../core/EventBus.js';
import { IEventData } from '../types/drawing.types.js';
import { IDrawingTool } from './PenTool.js';

export class FillTool implements IDrawingTool {
  public readonly name = 'fill';
  public readonly icon = 'ti ti-bucket';
  public readonly category = 'editing' as const;

  private eventBus: EventBus;
  private settings = {
    color: 0x800000, // ふたばマルーン
    tolerance: 10, // 色の許容範囲（0-255）
    opacity: 1.0,
    blendMode: 'normal' as const,
    antiAlias: true
  };

  private isActive = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    // EventBusを通じて塗りつぶしモード設定
    this.eventBus.emit('tool:fill-mode', {
      enabled: true,
      settings: this.settings
    });
    
    console.log('塗りつぶしツール有効化・フラッドフィル準備完了');
  }

  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    
    // EventBusを通じて塗りつぶしモード解除
    this.eventBus.emit('tool:fill-mode', {
      enabled: false,
      settings: this.settings
    });
  }

  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    // 塗りつぶし実行（フラッドフィル）
    this.eventBus.emit('tool:flood-fill', {
      x: Math.floor(event.x),
      y: Math.floor(event.y),
      color: this.settings.color,
      tolerance: this.settings.tolerance,
      opacity: this.settings.opacity,
      blendMode: this.settings.blendMode
    });
    
    console.log(`塗りつぶし実行: (${event.x}, ${event.y}), 許容範囲: ${this.settings.tolerance}`);
  }

  public onPointerMove(event: IEventData['drawing:move']): void {
    // 塗りつぶしツールは移動処理なし
  }

  public onPointerUp(event: IEventData['drawing:end']): void {
    // 塗りつぶしツールは終了処理なし
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // EventBusを通じて設定更新通知
    if (this.isActive) {
      this.eventBus.emit('tool:fill-mode', {
        enabled: true,
        settings: this.settings
      });
    }
    
    console.log('塗りつぶしツール設定更新:', this.settings);
  }
}