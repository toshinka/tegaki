import { EventBus } from '../core/EventBus.js';
import { IEventData } from '../types/drawing.types.js';
import { IDrawingTool } from './PenTool.js';

export class BrushTool implements IDrawingTool {
  public readonly name = 'brush';
  public readonly icon = 'ti ti-brush';
  public readonly category = 'drawing' as const;

  private eventBus: EventBus;
  private settings = {
    size: 12, // PenToolより大きな初期値
    opacity: 0.6, // 重ね塗り表現
    texture: 'round', // round/flat/texture Phase3拡張
    pressureOpacity: true, // 筆圧→透明度
    velocitySize: true, // 速度→サイズ変化
    color: 0x800000,
    smoothing: true
  };

  private isActive = false;
  private lastPosition: { x: number; y: number } | null = null;
  private lastTime = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    // EventBusを通じてブラシモード設定
    this.eventBus.emit('tool:brush-mode', {
      enabled: true,
      settings: this.settings
    });
    
    console.log('ブラシツール有効化・動的サイズ対応');
  }

  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    this.lastPosition = null;
    
    // EventBusを通じてブラシモード解除
    this.eventBus.emit('tool:brush-mode', {
      enabled: false,
      settings: this.settings
    });
  }

  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    this.lastPosition = { x: event.x, y: event.y };
    this.lastTime = Date.now();
    
    // EventBusを通じて描画開始（ブラシモード）
    this.eventBus.emit('drawing:start', {
      ...event,
      toolType: 'brush',
      settings: this.settings
    });
  }

  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.lastPosition) return;
    
    // 速度計算
    const now = Date.now();
    const deltaTime = now - this.lastTime;
    const deltaX = event.x - this.lastPosition.x;
    const deltaY = event.y - this.lastPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = deltaTime > 0 ? distance / deltaTime : 0;
    
    // 動的設定計算
    const dynamicSettings = {
      ...this.settings,
      size: this.calculateDynamicSize(event.pressure, velocity),
      opacity: this.calculateDynamicOpacity(event.pressure)
    };
    
    // EventBusを通じて描画継続（ブラシモード・動的設定）
    this.eventBus.emit('drawing:move', {
      ...event,
      toolType: 'brush',
      settings: dynamicSettings
    });
    
    this.lastPosition = { x: event.x, y: event.y };
    this.lastTime = now;
  }

  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    
    // EventBusを通じて描画終了（ブラシモード）
    this.eventBus.emit('drawing:end', {
      ...event,
      toolType: 'brush',
      settings: this.settings
    });
    
    this.lastPosition = null;
  }

  private calculateDynamicSize(pressure: number, velocity: number): number {
    let size = this.settings.size;
    
    // 筆圧対応（0.5〜1.5倍）
    if (this.settings.pressureOpacity && pressure > 0) {
      size *= (0.5 + pressure * 1.0);
    }
    
    // 速度対応（遅いと太く、速いと細く）
    if (this.settings.velocitySize && velocity > 0) {
      const velocityFactor = Math.max(0.3, Math.min(1.5, 1.0 - velocity * 0.01));
      size *= velocityFactor;
    }
    
    return Math.max(1, Math.min(100, size));
  }

  private calculateDynamicOpacity(pressure: number): number {
    if (!this.settings.pressureOpacity || pressure <= 0) {
      return this.settings.opacity;
    }
    
    // 筆圧に応じた透明度（0.2〜1.0）
    return Math.max(0.2, Math.min(1.0, this.settings.opacity * (0.5 + pressure * 0.5)));
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // EventBusを通じて設定更新通知
    if (this.isActive) {
      this.eventBus.emit('tool:brush-mode', {
        enabled: true,
        settings: this.settings
      });
    }
    
    console.log('ブラシツール設定更新:', this.settings);
  }
}