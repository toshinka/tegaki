import { EventBus } from '../core/EventBus.js';
import { IEventData } from '../types/drawing.types.js';
import { IDrawingTool } from './PenTool.js';

export type ShapeType = 'rectangle' | 'circle' | 'line' | 'arrow';

export class ShapeTool implements IDrawingTool {
  public readonly name = 'shape';
  public readonly icon = 'ti ti-square';
  public readonly category = 'drawing' as const;

  private eventBus: EventBus;
  private settings = {
    shapeType: 'rectangle' as ShapeType,
    strokeColor: 0x800000, // ふたばマルーン
    fillColor: 0x000000,
    strokeWidth: 2,
    fillEnabled: false,
    opacity: 1.0,
    cornerRadius: 0 // 角丸矩形用
  };

  private isActive = false;
  private isDrawing = false;
  private startPoint: { x: number; y: number } | null = null;
  private previewShape: any = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    // EventBusを通じて図形モード設定
    this.eventBus.emit('tool:shape-mode', {
      enabled: true,
      settings: this.settings
    });
    
    console.log('図形ツール有効化・プレビュー対応');
  }

  public deactivate(): void {
    this.isActive = false;
    this.isDrawing = false;
    document.body.style.cursor = 'default';
    
    // プレビュー図形削除
    if (this.previewShape) {
      this.eventBus.emit('tool:shape-preview', {
        action: 'clear'
      });
      this.previewShape = null;
    }
    
    // EventBusを通じて図形モード解除
    this.eventBus.emit('tool:shape-mode', {
      enabled: false,
      settings: this.settings
    });
  }

  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    this.isDrawing = true;
    this.startPoint = { x: event.x, y: event.y };
    
    console.log(`図形描画開始: ${this.settings.shapeType} at (${event.x}, ${event.y})`);
  }

  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.isDrawing || !this.startPoint) return;
    
    // 図形データ計算
    const shapeData = this.calculateShapeData(this.startPoint, { x: event.x, y: event.y });
    
    // プレビュー図形更新
    this.eventBus.emit('tool:shape-preview', {
      action: 'update',
      shapeType: this.settings.shapeType,
      data: shapeData,
      settings: this.settings
    });
  }

  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive || !this.isDrawing || !this.startPoint) return;
    
    // 最終図形データ計算
    const shapeData = this.calculateShapeData(this.startPoint, { x: event.x, y: event.y });
    
    // 図形確定
    this.eventBus.emit('tool:shape-create', {
      shapeType: this.settings.shapeType,
      data: shapeData,
      settings: this.settings
    });
    
    // プレビュークリア
    this.eventBus.emit('tool:shape-preview', {
      action: 'clear'
    });
    
    this.isDrawing = false;
    this.startPoint = null;
    this.previewShape = null;
    
    console.log(`図形描画完了: ${this.settings.shapeType}`);
  }

  private calculateShapeData(start: { x: number; y: number }, end: { x: number; y: number }) {
    const width = end.x - start.x;
    const height = end.y - start.y;
    
    switch (this.settings.shapeType) {
      case 'rectangle':
        return {
          x: start.x,
          y: start.y,
          width: width,
          height: height,
          cornerRadius: this.settings.cornerRadius
        };
      
      case 'circle':
        const radius = Math.sqrt(width * width + height * height) / 2;
        return {
          x: start.x + width / 2,
          y: start.y + height / 2,
          radius: radius
        };
      
      case 'line':
        return {
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y
        };
      
      case 'arrow':
        const length = Math.sqrt(width * width + height * height);
        const angle = Math.atan2(height, width);
        const arrowLength = Math.min(20, length * 0.3);
        const arrowAngle = 0.5;
        
        return {
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          arrowHead: {
            x1: end.x - arrowLength * Math.cos(angle - arrowAngle),
            y1: end.y - arrowLength * Math.sin(angle - arrowAngle),
            x2: end.x - arrowLength * Math.cos(angle + arrowAngle),
            y2: end.y - arrowLength * Math.sin(angle + arrowAngle)
          }
        };
      
      default:
        return { x: start.x, y: start.y, width: width, height: height };
    }
  }

  public setShapeType(shapeType: ShapeType): void {
    this.settings.shapeType = shapeType;
    
    // EventBusを通じて設定更新通知
    if (this.isActive) {
      this.eventBus.emit('tool:shape-mode', {
        enabled: true,
        settings: this.settings
      });
    }
    
    console.log(`図形タイプ変更: ${shapeType}`);
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // EventBusを通じて設定更新通知
    if (this.isActive) {
      this.eventBus.emit('tool:shape-mode', {
        enabled: true,
        settings: this.settings
      });
    }
    
    console.log('図形ツール設定更新:', this.settings);
  }
}