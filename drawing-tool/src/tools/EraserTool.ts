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

  private settings = {
    size: 12,
    opacity: 1.0,
    hardness: 1.0 // 消しゴムの硬さ
  };

  private isActive = false;

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    console.log('消しゴムツール有効化');
  }

  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
  }

  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    // Phase1では描画エンジンが処理、消しゴム特有の処理はPhase2で実装予定
  }

  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive) return;
    // Phase1では描画エンジンが処理
  }

  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    // Phase1では描画エンジンが処理
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('消しゴムツール設定更新:', this.settings);
  }
}