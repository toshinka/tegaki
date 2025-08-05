import { IEventData } from '../types/drawing.types.js';

export interface IDrawingTool {
  readonly name: string;
  readonly icon: string; // Phase3でTabler Icons統合・参考資料準備完了
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
  public readonly icon = 'ti ti-pencil'; // Tabler Icons準備・参考資料継承
  public readonly category = 'drawing' as const;

  private settings = {
    size: 4,
    opacity: 0.8,
    color: 0x800000, // ふたばマルーン・参考資料継承
    smoothing: true,
    pressureSensitive: true // 参考資料の120Hz筆圧対応準備
  };

  private isActive = false;

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    console.log('ペンツール有効化・参考資料の120Hz入力対応準備完了');
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