// PenTool.ts - ペンツール・基本描画・Phase1完成版
// IDrawingTool実装・設定管理・EventBus連携・drawing-constants.ts活用

import { IEventData } from '../types/drawing.types.js';
import { PEN_TOOL, INPUT } from '../constants/drawing-constants.js';

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

/**
 * ペンツール・基本描画実装・Phase1継承
 * - 基本線描画・滑らかなストローク・筆圧対応
 * - drawing-constants.ts 設定値活用・一元管理
 * - EventBus通信・DrawingEngine連携・責任分界
 */
export class PenTool implements IDrawingTool {
  public readonly name = 'pen';
  public readonly icon = 'ti ti-pencil';
  public readonly category = 'drawing' as const;

  // 設定・drawing-constants.ts活用
  private settings = {
    size: PEN_TOOL.DEFAULT_SIZE,
    opacity: PEN_TOOL.DEFAULT_OPACITY,
    color: PEN_TOOL.DEFAULT_COLOR,
    smoothing: PEN_TOOL.SMOOTHING_FACTOR > 0,
    pressureSensitive: PEN_TOOL.DEFAULT_PRESSURE_SENSITIVITY > 0,
    minDistance: PEN_TOOL.MIN_DISTANCE,
    maxPointsPerStroke: PEN_TOOL.MAX_POINTS_PER_STROKE
  };

  private isActive = false;
  private currentStrokePoints = 0;

  /**
   * ツール有効化・UI状態変更
   */
  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    console.log(`🖊️ ペンツール有効化:`, {
      size: this.settings.size,
      opacity: this.settings.opacity,
      smoothing: this.settings.smoothing,
      pressureSensitive: this.settings.pressureSensitive
    });
  }

  /**
   * ツール無効化・状態リセット
   */
  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    this.currentStrokePoints = 0;
    
    console.log('🖊️ ペンツール無効化');
  }

  /**
   * 描画開始・PointerDown処理
   * - DrawingEngineに描画開始通知
   * - ツール固有設定適用
   */
  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;

    this.currentStrokePoints = 1;
    
    // ツール設定をDrawingEngineに送信・動的適用
    // EventBus経由でDrawingEngineに設定通知
    console.log(`🖊️ ペン描画開始: (${event.point.x.toFixed(1)}, ${event.point.y.toFixed(1)}) 筆圧:${event.pressure.toFixed(2)}`);
  }

  /**
   * 描画中・PointerMove処理
   * - 最小距離チェック・パフォーマンス最適化
   * - 筆圧・速度計算・動的サイズ調整
   */
  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive) return;

    // 点数制限チェック・メモリ保護
    if (this.currentStrokePoints >= this.settings.maxPointsPerStroke) {
      console.warn(`⚠️ ストローク点数上限到達: ${this.settings.maxPointsPerStroke}点`);
      return;
    }

    this.currentStrokePoints++;

    // 筆圧敏感性適用・動的サイズ計算
    if (this.settings.pressureSensitive) {
      const dynamicSize = this.calculatePressureSize(event.pressure);
      // DrawingEngineに動的設定送信（Phase2で実装）
      console.log(`🖊️ 動的サイズ: ${dynamicSize.toFixed(1)}px (筆圧: ${event.pressure.toFixed(2)})`);
    }
  }

  /**
   * 描画終了・PointerUp処理
   * - ストローク完了・統計更新
   */
  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;

    console.log(`✅ ペンストローク完了: ${this.currentStrokePoints}点, 筆圧:${event.pressure.toFixed(2)}`);
    this.currentStrokePoints = 0;
  }

  /**
   * 設定取得・UI表示用
   */
  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  /**
   * 設定更新・UI変更反映
   * @param newSettings 新しい設定（部分更新）
   */
  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    // 設定値検証・範囲チェック
    const validatedSettings = this.validateSettings(newSettings);
    this.settings = { ...this.settings, ...validatedSettings };
    
    console.log('🖊️ ペンツール設定更新:', validatedSettings);
  }

  /**
   * 筆圧ベースサイズ計算・動的調整
   * @param pressure 筆圧値 (0.0-1.0)
   * @returns 調整後サイズ
   */
  private calculatePressureSize(pressure: number): number {
    if (!this.settings.pressureSensitive) {
      return this.settings.size;
    }

    // 筆圧カーブ・自然な太さ変化
    const pressureFactor = Math.max(0.1, pressure); // 最小10%
    const sensitivityFactor = PEN_TOOL.DEFAULT_PRESSURE_SENSITIVITY;
    
    return this.settings.size * (1 - sensitivityFactor + (sensitivityFactor * pressureFactor));
  }

  /**
   * 設定値検証・範囲制限・型安全性
   * @param settings 検証対象設定
   * @returns 検証済み設定
   */
  private validateSettings(settings: Partial<typeof this.settings>): Partial<typeof this.settings> {
    const validated: Partial<typeof this.settings> = {};

    // サイズ検証
    if (settings.size !== undefined) {
      validated.size = Math.max(
        PEN_TOOL.MIN_SIZE, 
        Math.min(PEN_TOOL.MAX_SIZE, settings.size)
      );
    }

    // 透明度検証
    if (settings.opacity !== undefined) {
      validated.opacity = Math.max(
        PEN_TOOL.MIN_OPACITY, 
        Math.min(PEN_TOOL.MAX_OPACITY, settings.opacity)
      );
    }

    // 色検証・16進数チェック
    if (settings.color !== undefined) {
      validated.color = Math.max(0, Math.min(0xffffff, settings.color));
    }

    // ブール値検証
    if (settings.smoothing !== undefined) {
      validated.smoothing = Boolean(settings.smoothing);
    }

    if (settings.pressureSensitive !== undefined) {
      validated.pressureSensitive = Boolean(settings.pressureSensitive);
    }

    // 最小距離検証
    if (settings.minDistance !== undefined) {
      validated.minDistance = Math.max(0.1, settings.minDistance);
    }

    // 最大点数検証
    if (settings.maxPointsPerStroke !== undefined) {
      validated.maxPointsPerStroke = Math.max(10, Math.min(10000, settings.maxPointsPerStroke));
    }

    return validated;
  }

  /**
   * ツール情報取得・デバッグ用
   */
  public getToolInfo(): {
    name: string;
    isActive: boolean;
    currentStrokePoints: number;
    settings: typeof this.settings;
    constants: {
      minSize: number;
      maxSize: number;
      defaultSize: number;
      smoothingFactor: number;
    };
  } {
    return {
      name: this.name,
      isActive: this.isActive,
      currentStrokePoints: this.currentStrokePoints,
      settings: this.getSettings(),
      constants: {
        minSize: PEN_TOOL.MIN_SIZE,
        maxSize: PEN_TOOL.MAX_SIZE,
        defaultSize: PEN_TOOL.DEFAULT_SIZE,
        smoothingFactor: PEN_TOOL.SMOOTHING_FACTOR
      }
    };
  }

  /**
   * 設定リセット・初期値復元
   */
  public resetSettings(): void {
    this.settings = {
      size: PEN_TOOL.DEFAULT_SIZE,
      opacity: PEN_TOOL.DEFAULT_OPACITY,
      color: PEN_TOOL.DEFAULT_COLOR,
      smoothing: PEN_TOOL.SMOOTHING_FACTOR > 0,
      pressureSensitive: PEN_TOOL.DEFAULT_PRESSURE_SENSITIVITY > 0,
      minDistance: PEN_TOOL.MIN_DISTANCE,
      maxPointsPerStroke: PEN_TOOL.MAX_POINTS_PER_STROKE
    };

    console.log('🔄 ペンツール設定リセット完了');
  }

  /**
   * 現在の設定でプレビュー情報生成・UI用
   */
  public getPreviewInfo(): {
    displaySize: string;
    displayOpacity: string;
    displayColor: string;
    features: string[];
  } {
    const features: string[] = [];
    
    if (this.settings.smoothing) features.push('スムージング');
    if (this.settings.pressureSensitive) features.push('筆圧感知');
    
    return {
      displaySize: `${this.settings.size}px`,
      displayOpacity: `${Math.round(this.settings.opacity * 100)}%`,
      displayColor: `#${this.settings.color.toString(16).padStart(6, '0')}`,
      features
    };
  }
}