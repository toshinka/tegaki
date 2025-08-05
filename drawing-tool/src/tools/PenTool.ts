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

  private settings = {
    size: 4,
    opacity: 0.8,
    color: 0x800000, // ふたばマルーン
    smoothing: true,
    pressureSensitive: true
  };

  private isActive = false;

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    console.log('ペンツール有効化・120Hz入力対応準備完了');
  }

  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
  }

  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    // DrawingEngineが処理・ツール固有処理なし
  }

  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive) return;
    // DrawingEngineが処理・ツール固有処理なし
  }

  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    // DrawingEngineが処理・ツール固有処理なし
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('ペンツール設定更新:', this.settings);
  }
}