// BrushTool.ts - 高度描画ツール・テクスチャ対応・筆圧表現拡張
// Phase2実装・PenTool差別化・drawing-constants.ts活用

import * as PIXI from 'pixi.js';
import type { EventBus, IEventData } from '../core/EventBus.js';
import type { IDrawingTool } from './PenTool.js';
import { BRUSH_TOOL, INPUT } from '../constants/drawing-constants.js';

/**
 * ブラシテクスチャ種別・Phase3拡張予定
 */
export type BrushTextureType = typeof BRUSH_TOOL.TYPES[number];

/**
 * ブラシ設定・高度描画制御・drawing-constants.ts準拠
 */
interface IBrushSettings {
  // 基本設定・範囲制限あり
  size: number;           // BRUSH_TOOL.MIN_SIZE - MAX_SIZE
  opacity: number;        // BRUSH_TOOL.MIN_OPACITY - MAX_OPACITY
  color: number;          // RGB色値
  
  // ブラシ固有設定
  texture: BrushTextureType;    // テクスチャ種別
  hardness: number;            // エッジ硬度 0.0-1.0
  spacing: number;             // ストローク間隔 0.1-2.0
  
  // 動的変化・筆圧・速度対応
  pressureOpacity: boolean;     // 筆圧→不透明度
  pressureSize: boolean;        // 筆圧→サイズ
  velocitySize: boolean;        // 速度→サイズ変化
  velocityOpacity: boolean;     // 速度→不透明度
  
  // 高度設定・Phase3実装予定
  scattering: number;          // 散布 0.0-1.0
  rotation: number;            // 回転角度 0-360
  flowRate: number;            // フロー率 0.1-1.0
  
  // ブレンドモード・Pixi.js v8対応
  blendMode: typeof BRUSH_TOOL.DEFAULT_BLEND_MODE;
}

/**
 * 動的ブラシパラメータ・リアルタイム計算
 */
interface IDynamicBrushParams {
  size: number;
  opacity: number;
  rotation: number;
  scattering: { x: number; y: number };
}

/**
 * ブラシ描画統計・性能監視
 */
interface IBrushStats {
  strokeCount: number;
  averageStrokeLength: number;
  pressureVariation: number;
  velocityVariation: number;
  renderTime: number;
}

/**
 * 高度ブラシツール・PenTool差別化・表現力拡張・Phase2実装
 * - 筆圧・速度・テクスチャ対応・自然な筆表現
 * - drawing-constants.ts 設定値活用・一元管理
 * - Pixi.js v8対応・文字列ベースブレンドモード
 */
export class BrushTool implements IDrawingTool {
  public readonly name = 'brush';
  public readonly icon = 'ti ti-brush';
  public readonly category = 'drawing' as const;

  private eventBus: EventBus;
  private isActive = false;
  
  // ブラシ設定・drawing-constants.ts活用・PenToolとの差別化
  private settings: IBrushSettings = {
    // 基本設定・定数活用
    size: BRUSH_TOOL.DEFAULT_SIZE,              // 12px・PenToolより大きめ
    opacity: BRUSH_TOOL.DEFAULT_OPACITY,        // 0.6・重ね塗り表現
    color: BRUSH_TOOL.DEFAULT_BLEND_MODE === 'normal' ? 0x800000 : 0x000000, // ふたばマルーン
    
    // ブラシ固有設定
    texture: BRUSH_TOOL.DEFAULT_TYPE,           // 'round'・基本テクスチャ
    hardness: 0.7,                             // 中程度エッジ・自然な境界
    spacing: 0.2,                              // 20%間隔・滑らか描画
    
    // 動的変化・筆表現・定数活用
    pressureOpacity: BRUSH_TOOL.DEFAULT_PRESSURE_SENSITIVITY > 0, // 筆圧→透明度
    pressureSize: BRUSH_TOOL.DEFAULT_PRESSURE_SENSITIVITY > 0,    // 筆圧→サイズ
    velocitySize: BRUSH_TOOL.DEFAULT_VELOCITY_SENSITIVITY > 0,    // 速度→サイズ
    velocityOpacity: false,                    // 速度→透明度無効
    
    // 高度設定・Phase3拡張
    scattering: 0.0,                          // 散布なし・基本設定
    rotation: 0,                              // 回転なし
    flowRate: 0.8,                            // 80%フロー・自然な流れ
    
    // ブレンドモード・Pixi.js v8対応
    blendMode: BRUSH_TOOL.DEFAULT_BLEND_MODE   // 'normal'
  };
  
  // 動的状態管理
  private lastPoint: PIXI.Point | null = null;
  private lastPressure = 0;
  private lastVelocity = 0;
  private lastTimestamp = 0;
  
  // 統計・デバッグ
  private stats: IBrushStats = {
    strokeCount: 0,
    averageStrokeLength: 0,
    pressureVariation: 0,
    velocityVariation: 0,
    renderTime: 0
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    console.log('🖌️ BrushTool初期化完了・drawing-constants.ts活用');
  }

  /**
   * ブラシツール有効化・カーソル・UI更新
   */
  public activate(): void {
    this.isActive = true;
    
    // ブラシ専用カーソル・差別化・サイズ反映
    const cursorSize = Math.min(32, Math.max(8, this.settings.size));
    document.body.style.cursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}' viewBox='0 0 ${cursorSize} ${cursorSize}'%3E%3Ccircle cx='${cursorSize/2}' cy='${cursorSize/2}' r='${cursorSize/2-1}' fill='none' stroke='%23800000' stroke-width='2'/%3E%3C/svg%3E") ${cursorSize/2} ${cursorSize/2}, crosshair`;
    
    // ブラシ設定UI表示・Phase2後半実装予定
    this.eventBus.emit('ui:tool-activated', {
      toolName: this.name,
      settings: this.settings,
      timestamp: Date.now()
    });
    
    console.log(`🖌️ ブラシツール有効化:`, {
      size: this.settings.size,
      opacity: this.settings.opacity,
      texture: this.settings.texture,
      pressureOpacity: this.settings.pressureOpacity,
      velocitySize: this.settings.velocitySize
    });
  }

  /**
   * ブラシツール無効化・クリーンアップ
   */
  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    
    // 状態リセット
    this.lastPoint = null;
    this.lastPressure = 0;
    this.lastVelocity = 0;
    this.lastTimestamp = 0;
    
    console.log('🖌️ ブラシツール無効化');
  }

  /**
   * 描画開始・ブラシ初期化
   */
  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    // 初期状態設定
    this.lastPoint = event.point.clone();
    this.lastPressure = event.pressure;
    this.lastTimestamp = event.timestamp;
    this.lastVelocity = 0;
    
    // 動的パラメータ計算・初回
    const dynamicParams = this.calculateDynamicParams(
      event.pressure,
      0, // 初回速度0
      event.timestamp
    );
    
    // DrawingEngine連携・ブラシ設定送信
    this.eventBus.emit('brush:stroke-start', {
      point: event.point,
      params: dynamicParams,
      settings: this.settings,
      timestamp: event.timestamp
    });
    
    this.stats.strokeCount++;
    
    console.log(`🖌️ ブラシ描画開始: サイズ${dynamicParams.size.toFixed(1)}px, 透明度${(dynamicParams.opacity * 100).toFixed(0)}%`);
  }

  /**
   * 描画移動・動的パラメータ更新・リアルタイム変化
   */
  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.lastPoint) return;
    
    // 速度計算・画面座標
    const velocity = this.calculateVelocity(event.point, event.timestamp);
    this.lastVelocity = velocity;
    
    // 最小距離チェック・パフォーマンス最適化
    const distance = this.calculateDistance(this.lastPoint, event.point);
    if (distance < BRUSH_TOOL.MIN_DISTANCE) {
      return; // 距離が小さすぎる場合は無視
    }
    
    // 動的パラメータ計算・筆圧・速度反映
    const dynamicParams = this.calculateDynamicParams(
      event.pressure,
      velocity,
      event.timestamp
    );
    
    // DrawingEngine連携・リアルタイム更新
    this.eventBus.emit('brush:stroke-continue', {
      point: event.point,
      params: dynamicParams,
      velocity,
      distance,
      timestamp: event.timestamp
    });
    
    // 状態更新
    this.lastPoint = event.point.clone();
    this.lastPressure = event.pressure;
    this.lastTimestamp = event.timestamp;
  }

  /**
   * 描画終了・ストローク完了
   */
  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    
    // 最終パラメータ計算
    const finalVelocity = this.lastPoint ? 
      this.calculateVelocity(event.point, event.timestamp) : 0;
    
    const finalParams = this.calculateDynamicParams(
      event.pressure,
      finalVelocity,
      event.timestamp
    );
    
    // DrawingEngine連携・ストローク終了
    this.eventBus.emit('brush:stroke-end', {
      point: event.point,
      params: finalParams,
      velocity: finalVelocity,
      timestamp: event.timestamp
    });
    
    // 統計更新
    this.updateStats();
    
    console.log(`✅ ブラシストローク完了: ${this.stats.strokeCount}本目`);
    
    // 状態リセット
    this.lastPoint = null;
    this.lastPressure = 0;
    this.lastVelocity = 0;
  }

  /**
   * 設定取得・UI表示用
   */
  public getSettings(): IBrushSettings {
    return { ...this.settings };
  }

  /**
   * 設定更新・UI変更反映・検証付き
   */
  public updateSettings(newSettings: Partial<IBrushSettings>): void {
    const validatedSettings = this.validateSettings(newSettings);
    this.settings = { ...this.settings, ...validatedSettings };
    
    // カーソルサイズ更新
    if (this.isActive && validatedSettings.size !== undefined) {
      this.updateCursor();
    }
    
    console.log('🖌️ ブラシツール設定更新:', validatedSettings);
  }

  /**
   * 動的パラメータ計算・筆圧・速度反映・リアルタイム
   */
  private calculateDynamicParams(
    pressure: number, 
    velocity: number, 
    timestamp: number
  ): IDynamicBrushParams {
    let dynamicSize = this.settings.size;
    let dynamicOpacity = this.settings.opacity;
    
    // 筆圧→サイズ変化
    if (this.settings.pressureSize) {
      const pressureFactor = Math.max(0.1, pressure); // 最小10%
      const sensitivity = BRUSH_TOOL.DEFAULT_PRESSURE_SENSITIVITY;
      dynamicSize *= (1 - sensitivity + (sensitivity * pressureFactor));
    }
    
    // 筆圧→透明度変化
    if (this.settings.pressureOpacity) {
      const pressureFactor = Math.max(0.1, pressure);
      const sensitivity = BRUSH_TOOL.DEFAULT_PRESSURE_SENSITIVITY;
      dynamicOpacity *= (1 - sensitivity + (sensitivity * pressureFactor));
    }
    
    // 速度→サイズ変化・自然な筆表現
    if (this.settings.velocitySize && velocity > 0) {
      const velocityFactor = Math.min(2.0, velocity / 100); // 正規化
      const sensitivity = BRUSH_TOOL.DEFAULT_VELOCITY_SENSITIVITY;
      dynamicSize *= (1 + (sensitivity * velocityFactor * 0.5)); // 50%まで増加
    }
    
    // 速度→透明度変化
    if (this.settings.velocityOpacity && velocity > 0) {
      const velocityFactor = Math.min(1.0, velocity / 200);
      dynamicOpacity *= (1 - velocityFactor * 0.3); // 最大30%減少
    }
    
    // 範囲制限・安全性確保
    dynamicSize = Math.max(BRUSH_TOOL.MIN_SIZE, Math.min(BRUSH_TOOL.MAX_SIZE, dynamicSize));
    dynamicOpacity = Math.max(BRUSH_TOOL.MIN_OPACITY, Math.min(BRUSH_TOOL.MAX_OPACITY, dynamicOpacity));
    
    return {
      size: dynamicSize,
      opacity: dynamicOpacity,
      rotation: this.settings.rotation + (velocity * 0.1), // 微細回転
      scattering: { 
        x: this.settings.scattering * (Math.random() - 0.5) * 2,
        y: this.settings.scattering * (Math.random() - 0.5) * 2
      }
    };
  }

  /**
   * 速度計算・ピクセル/ミリ秒
   */
  private calculateVelocity(currentPoint: PIXI.Point, timestamp: number): number {
    if (!this.lastPoint || this.lastTimestamp === 0) return 0;
    
    const distance = this.calculateDistance(this.lastPoint, currentPoint);
    const timeDelta = timestamp - this.lastTimestamp;
    
    return timeDelta > 0 ? distance / timeDelta : 0;
  }

  /**
   * 距離計算・ユークリッド距離
   */
  private calculateDistance(point1: PIXI.Point, point2: PIXI.Point): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 設定値検証・範囲制限・型安全性・drawing-constants.ts準拠
   */
  private validateSettings(settings: Partial<IBrushSettings>): Partial<IBrushSettings> {
    const validated: Partial<IBrushSettings> = {};

    // サイズ検証・定数範囲
    if (settings.size !== undefined) {
      validated.size = Math.max(
        BRUSH_TOOL.MIN_SIZE, 
        Math.min(BRUSH_TOOL.MAX_SIZE, settings.size)
      );
    }

    // 透明度検証・定数範囲
    if (settings.opacity !== undefined) {
      validated.opacity = Math.max(
        BRUSH_TOOL.MIN_OPACITY, 
        Math.min(BRUSH_TOOL.MAX_OPACITY, settings.opacity)
      );
    }

    // 色検証
    if (settings.color !== undefined) {
      validated.color = Math.max(0, Math.min(0xffffff, settings.color));
    }

    // テクスチャ検証・定数値チェック
    if (settings.texture !== undefined && BRUSH_TOOL.TYPES.includes(settings.texture)) {
      validated.texture = settings.texture;
    }

    // ブレンドモード検証・Pixi.js v8対応
    if (settings.blendMode !== undefined && BRUSH_TOOL.SUPPORTED_BLEND_MODES.includes(settings.blendMode)) {
      validated.blendMode = settings.blendMode;
    }

    // 硬度・間隔・フロー率検証
    if (settings.hardness !== undefined) {
      validated.hardness = Math.max(0, Math.min(1, settings.hardness));
    }

    if (settings.spacing !== undefined) {
      validated.spacing = Math.max(0.1, Math.min(2.0, settings.spacing));
    }

    if (settings.flowRate !== undefined) {
      validated.flowRate = Math.max(0.1, Math.min(1.0, settings.flowRate));
    }

    // 散布・回転検証
    if (settings.scattering !== undefined) {
      validated.scattering = Math.max(0, Math.min(1, settings.scattering));
    }

    if (settings.rotation !== undefined) {
      validated.rotation = settings.rotation % 360;
    }

    // ブール値検証
    ['pressureOpacity', 'pressureSize', 'velocitySize', 'velocityOpacity'].forEach(key => {
      if (settings[key as keyof IBrushSettings] !== undefined) {
        validated[key as keyof IBrushSettings] = Boolean(settings[key as keyof IBrushSettings]) as any;
      }
    });

    return validated;
  }

  /**
   * カーソル更新・サイズ反映
   */
  private updateCursor(): void {
    if (!this.isActive) return;
    
    const cursorSize = Math.min(32, Math.max(8, this.settings.size));
    document.body.style.cursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}' viewBox='0 0 ${cursorSize} ${cursorSize}'%3E%3Ccircle cx='${cursorSize/2}' cy='${cursorSize/2}' r='${cursorSize/2-1}' fill='none' stroke='%23800000' stroke-width='2'/%3E%3C/svg%3E") ${cursorSize/2} ${cursorSize/2}, crosshair`;
  }

  /**
   * 統計更新・性能監視
   */
  private updateStats(): void {
    // 圧力・速度の変動計算
    this.stats.pressureVariation = Math.abs(this.lastPressure - 0.5);
    this.stats.velocityVariation = this.lastVelocity;
    this.stats.renderTime = performance.now();
    
    // 平均ストローク長計算（簡易版）
    if (this.stats.strokeCount > 0) {
      this.stats.averageStrokeLength = this.stats.renderTime / this.stats.strokeCount;
    }
  }

  /**
   * ブラシプリセット適用・Phase3実装予定
   */
  public applyPreset(presetName: string): void {
    const presets: Record<string, Partial<IBrushSettings>> = {
      'soft-round': {
        texture: 'round',
        hardness: 0.3,
        opacity: 0.4,
        pressureOpacity: true,
        velocitySize: false
      },
      'hard-round': {
        texture: 'round',
        hardness: 0.9,
        opacity: 0.8,
        pressureSize: true,
        velocitySize: true
      },
      'flat-brush': {
        texture: 'flat',
        hardness: 0.7,
        spacing: 0.1,
        rotation: 45,
        pressureOpacity: true
      },
      'watercolor': {
        texture: 'watercolor',
        hardness: 0.2,
        opacity: 0.3,
        flowRate: 0.6,
        scattering: 0.3,
        blendMode: 'multiply'
      }
    };

    const preset = presets[presetName];
    if (preset) {
      this.updateSettings(preset);
      console.log(`🎨 ブラシプリセット適用: ${presetName}`);
    } else {
      console.warn(`⚠️ 未知のプリセット: ${presetName}`);
    }
  }

  /**
   * 設定リセット・デフォルト値復元
   */
  public resetSettings(): void {
    this.settings = {
      size: BRUSH_TOOL.DEFAULT_SIZE,
      opacity: BRUSH_TOOL.DEFAULT_OPACITY,
      color: 0x800000,
      texture: BRUSH_TOOL.DEFAULT_TYPE,
      hardness: 0.7,
      spacing: 0.2,
      pressureOpacity: BRUSH_TOOL.DEFAULT_PRESSURE_SENSITIVITY > 0,
      pressureSize: BRUSH_TOOL.DEFAULT_PRESSURE_SENSITIVITY > 0,
      velocitySize: BRUSH_TOOL.DEFAULT_VELOCITY_SENSITIVITY > 0,
      velocityOpacity: false,
      scattering: 0.0,
      rotation: 0,
      flowRate: 0.8,
      blendMode: BRUSH_TOOL.DEFAULT_BLEND_MODE
    };

    if (this.isActive) {
      this.updateCursor();
    }

    console.log('🔄 ブラシツール設定リセット完了');
  }

  /**
   * ツール情報取得・デバッグ用
   */
  public getToolInfo(): {
    name: string;
    isActive: boolean;
    settings: IBrushSettings;
    stats: IBrushStats;
    constants: {
      minSize: number;
      maxSize: number;
      defaultSize: number;
      supportedTextures: readonly string[];
      supportedBlendModes: readonly string[];
    };
  } {
    return {
      name: this.name,
      isActive: this.isActive,
      settings: this.getSettings(),
      stats: { ...this.stats },
      constants: {
        minSize: BRUSH_TOOL.MIN_SIZE,
        maxSize: BRUSH_TOOL.MAX_SIZE,
        defaultSize: BRUSH_TOOL.DEFAULT_SIZE,
        supportedTextures: BRUSH_TOOL.TYPES,
        supportedBlendModes: BRUSH_TOOL.SUPPORTED_BLEND_MODES
      }
    };
  }

  /**
   * プレビュー情報生成・UI用
   */
  public getPreviewInfo(): {
    displaySize: string;
    displayOpacity: string;
    displayTexture: string;
    features: string[];
    blendMode: string;
  } {
    const features: string[] = [];
    
    if (this.settings.pressureOpacity) features.push('筆圧→透明度');
    if (this.settings.pressureSize) features.push('筆圧→サイズ');
    if (this.settings.velocitySize) features.push('速度→サイズ');
    if (this.settings.velocityOpacity) features.push('速度→透明度');
    if (this.settings.scattering > 0) features.push('散布');
    
    return {
      displaySize: `${this.settings.size}px`,
      displayOpacity: `${Math.round(this.settings.opacity * 100)}%`,
      displayTexture: this.settings.texture,
      features,
      blendMode: this.settings.blendMode
    };
  }

  /**
   * パフォーマンス情報取得・監視用
   */
  public getPerformanceInfo(): {
    strokeCount: number;
    averageRenderTime: number;
    lastVelocity: number;
    memoryUsage: string;
  } {
    return {
      strokeCount: this.stats.strokeCount,
      averageRenderTime: this.stats.averageStrokeLength,
      lastVelocity: this.lastVelocity,
      memoryUsage: `${Math.round(this.stats.renderTime / 1000)}KB` // 概算
    };
  }
}