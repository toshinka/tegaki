// FillTool.ts - 塗りつぶしツール・フラッドフィル・色域選択
// Phase2新規実装・IDrawingTool準拠・高度塗りつぶし機能

import type { EventBus, IEventData } from '../core/EventBus.js';
import type { IDrawingTool } from './PenTool.js';
import * as PIXI from 'pixi.js';

/**
 * 塗りつぶしモード・アルゴリズム選択
 */
export type FillMode = 'flood' | 'color-range' | 'selection' | 'gradient';

/**
 * 塗りつぶし設定・高度制御
 */
interface IFillSettings {
  // 基本設定
  fillColor: number;          // 塗りつぶし色
  opacity: number;            // 透明度 0.1-1.0
  blendMode: PIXI.BlendModes; // ブレンドモード
  
  // フラッドフィル設定
  tolerance: number;          // 色差許容値 0-100
  fillMode: FillMode;         // 塗りつぶしモード
  antiAlias: boolean;         // エッジスムージング
  
  // 色域選択設定
  colorRange: number;         // 色域範囲 0-360（HSV色相）
  saturationRange: number;    // 彩度範囲 0-100
  valueRange: number;         // 明度範囲 0-100
  
  // 高度機能・Phase3拡張予定
  contiguous: boolean;        // 連続領域のみ
  sampleMerged: boolean;      // 全レイヤー参照
  preserveTransparency: boolean; // 透明度保持
}

/**
 * 塗りつぶし処理状態
 */
interface IFillProcessState {
  isProcessing: boolean;
  processedPixels: number;
  totalPixels: number;
  startTime: number;
  cancelled: boolean;
}

/**
 * 色情報・RGB+Alpha
 */
interface IColorInfo {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * 塗りつぶしツール・Phase2新規実装
 * フラッドフィル・色域選択・高性能塗りつぶし・GPU最適化準備
 */
export class FillTool implements IDrawingTool {
  public readonly name = 'fill';
  public readonly icon = 'ti ti-bucket';
  public readonly category = 'drawing' as const;

  private eventBus: EventBus;
  private isActive = false;
  
  // 塗りつぶし設定・高度制御
  private settings: IFillSettings = {
    // 基本設定
    fillColor: 0x800000,      // ふたばマルーン
    opacity: 1.0,             // 100%不透明
    blendMode: PIXI.BlendModes.NORMAL,
    
    // フラッドフィル設定
    tolerance: 5,             // 5%許容値・適度な感度
    fillMode: 'flood',        // フラッドフィル・標準
    antiAlias: true,          // エッジスムージング有効
    
    // 色域選択設定
    colorRange: 30,           // 30度色相範囲・適度
    saturationRange: 20,      // 20%彩度範囲
    valueRange: 20,           // 20%明度範囲
    
    // 高度機能
    contiguous: true,         // 連続領域のみ・標準動作
    sampleMerged: false,      // 現在レイヤーのみ
    preserveTransparency: false, // 透明度上書き
  };
  
  // 処理状態管理
  private processState: IFillProcessState = {
    isProcessing: false,
    processedPixels: 0,
    totalPixels: 0,
    startTime: 0,
    cancelled: false
  };
  
  // 画像データキャッシュ・性能最適化
  private imageDataCache: Map<string, ImageData> = new Map();
  private lastCanvasSize = { width: 0, height: 0 };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    console.log('🪣 FillTool初期化完了');
  }

  /**
   * 塗りつぶしツール有効化・カーソル・UI更新
   */
  public activate(): void {
    this.isActive = true;
    
    // 塗りつぶし専用カーソル・バケツアイコン
    document.body.style.cursor = 'crosshair';
    
    // 塗りつぶし設定UI表示
    this.eventBus.emit('ui:tool-activated', {
      toolName: this.name,
      settings: this.settings,
      timestamp: Date.now()
    });
    
    console.log('🪣 塗りつぶしツール有効化・フラッドフィル準備完了');
  }

  /**
   * 塗りつぶしツール無効化・処理中断
   */
  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    
    // 処理中断・メモリクリア
    this.cancelFillProcess();
    this.clearImageDataCache();
    
    console.log('🪣 塗りつぶしツール無効化');
  }

  /**
   * 塗りつぶし実行・クリック点から開始
   */
  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    const startTime = performance.now();
    console.log(`🪣 塗りつぶし開始: (${event.point.x}, ${event.point.y}), モード: ${this.settings.fillMode}`);
    
    // 非同期塗りつぶし実行・UIブロック回避
    this.executeFillAsync(event.point, startTime);
  }

  /**
   * 塗りつぶし移動・プレビュー表示・Phase2後半実装
   */
  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive) return;
    
    // Phase2後半でプレビュー実装・現在はスタブ
    // ホバー時の色情報表示・塗りつぶし範囲プレビュー
  }

  /**
   * 塗りつぶし終了・処理完了待ち
   */
  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    
    // 処理中なら完了待ち・既に完了なら何もしない
    if (this.processState.isProcessing) {
      console.log('🪣 塗りつぶし処理中・完了待ち...');
    }
  }

  /**
   * 塗りつぶし設定取得
   */
  public getSettings(): IFillSettings {
    return { ...this.settings };
  }

  /**
   * 塗りつぶし設定更新・リアルタイム反映
   */
  public updateSettings(newSettings: Partial<IFillSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    // 設定変更通知・UI同期
    this.eventBus.emit('fill:settings-changed', {
      oldSettings,
      newSettings: this.settings,
      timestamp: Date.now()
    });
    
    console.log('🪣 塗りつぶし設定更新:', newSettings);
  }

  /**
   * 非同期塗りつぶし実行・UIブロック回避
   */
  private async executeFillAsync(point: { x: number; y: number }, startTime: number): Promise<void> {
    if (this.processState.isProcessing) {
      console.warn('🪣 塗りつぶし処理中・重複実行回避');
      return;
    }

    this.processState.isProcessing = true;
    this.processState.startTime = startTime;
    this.processState.cancelled = false;

    try {
      // フラッドフィル実行・現在のモードに応じて分岐
      switch (this.settings.fillMode) {
        case 'flood':
          await this.executeFloodFill(point);
          break;
        case 'color-range':
          await this.executeColorRangeFill(point);
          break;
        case 'selection':
          await this.executeSelectionFill(point);
          break;
        default:
          console.warn('🪣 未対応塗りつぶしモード:', this.settings.fillMode);
      }

      const processTime = performance.now() - startTime;
      console.log(`🪣 塗りつぶし完了: ${processTime.toFixed(2)}ms`);

      // 完了通知
      this.eventBus.emit('fill:completed', {
        point,
        processTime,
        pixelsFilled: this.processState.processedPixels,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('🪣 塗りつぶしエラー:', error);
      this.eventBus.emit('fill:error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        point,
        timestamp: Date.now()
      });
    } finally {
      this.processState.isProcessing = false;
      this.processState.processedPixels = 0;
    }
  }

  /**
   * フラッドフィル実行・基本塗りつぶし
   */
  private async executeFloodFill(point: { x: number; y: number }): Promise<void> {
    // DrawingEngineから現在のレンダーテクスチャ取得
    this.eventBus.emit('drawing:request-fill', {
      point,
      fillColor: this.settings.fillColor,
      tolerance: this.settings.tolerance,
      opacity: this.settings.opacity,
      blendMode: this.settings.blendMode,
      contiguous: this.settings.contiguous,
      timestamp: Date.now()
    });

    console.log(`🪣 フラッドフィル実行: 色=${this.settings.fillColor.toString(16)}, 許容値=${this.settings.tolerance}%`);
  }

  /**
   * 色域選択塗りつぶし・HSV範囲指定
   */
  private async executeColorRangeFill(point: { x: number; y: number }): Promise<void> {
    // Phase2後半実装・HSV色域選択による塗りつぶし
    console.log('🪣 色域選択塗りつぶし（Phase2後半実装予定）');
  }

  /**
   * 選択範囲塗りつぶし・既存選択領域
   */
  private async executeSelectionFill(point: { x: number; y: number }): Promise<void> {
    // Phase3実装予定・選択範囲システム連携
    console.log('🪣 選択範囲塗りつぶし（Phase3実装予定）');
  }

  /**
   * 色差計算・RGB距離・許容値判定
   */
  private calculateColorDistance(color1: IColorInfo, color2: IColorInfo): number {
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;
    const da = color1.a - color2.a;
    
    // ユークリッド距離・重み付き
    return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11 + da * da * 0.1);
  }

  /**
   * RGB→HSV変換・色域選択用
   */
  private rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    const s = max === 0 ? 0 : diff / max;
    const v = max;

    if (diff !== 0) {
      switch (max) {
        case r: h = ((g - b) / diff + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / diff + 2) / 6; break;
        case b: h = ((r - g) / diff + 4) / 6; break;
      }
    }

    return { h: h * 360, s: s * 100, v: v * 100 };
  }

  /**
   * 処理中断・メモリ解放
   */
  private cancelFillProcess(): void {
    if (this.processState.isProcessing) {
      this.processState.cancelled = true;
      console.log('🪣 塗りつぶし処理中断');
    }
  }

  /**
   * 画像データキャッシュクリア・メモリ最適化
   */
  private clearImageDataCache(): void {
    this.imageDataCache.clear();
    console.log('🪣 画像データキャッシュクリア');
  }

  /**
   * 塗りつぶし統計取得・性能監視
   */
  public getStats(): { processState: IFillProcessState; cacheSize: number } {
    return {
      processState: { ...this.processState },
      cacheSize: this.imageDataCache.size
    };
  }
}