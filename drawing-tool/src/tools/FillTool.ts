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
  
  // グラデーション・Phase3実装予定
  gradientType: 'linear' | 'radial' | 'angular';
  gradientStops: Array<{ color: number; position: number }>;
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
 * 塗りつぶし統計・性能監視
 */
interface IFillStats {
  fillCount: number;
  totalPixelsFilled: number;
  averageProcessTime: number;
  maxProcessTime: number;
  toleranceDistribution: number[];
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
    
    // グラデーション・Phase3実装予定
    gradientType: 'linear',
    gradientStops: [
      { color: 0x800000, position: 0.0 },
      { color: 0xffffff, position: 1.0 }
    ]
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
  
  // ワーカー・非同期処理・Phase3実装予定
  private fillWorker: Worker | null = null;
  
  // 統計
  private stats: IFillStats = {
    fillCount: 0,
    totalPixelsFilled: 0,
    averageProcessTime: 0,
    maxProcessTime: 0,
    toleranceDistribution: new Array(101).fill(0) // 0-100%分布
  };

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
    document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M9 3 5 6.99h3V14h2V6.99h3L9 3zM16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3z\' fill=\'%23800000\'/%3E%3C/svg%3E") 12 12, crosshair';
    
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
    
    // 許容値分布統計更新
    if (newSettings.tolerance !== undefined) {
      this.stats.toleranceDistribution[Math.round(newSettings.tolerance)]++;
    }
    
    // 設定変更通知・UI同期
    this.eventBus.emit('fill:settings-changed', {
      oldSettings,
      newSettings: this.settings,
      timestamp: Date.now()
    });
    
    console.log('🪣 塗りつぶ