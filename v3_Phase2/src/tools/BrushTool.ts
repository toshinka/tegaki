// BrushTool.ts - 高度描画ツール・テクスチャ対応・筆圧表現拡張
// Phase1 PenTool継承・IDrawingTool準拠・差別化実装

import type { EventBus, IEventData } from '../core/EventBus.js';
import type { IDrawingTool } from './PenTool.js';
import * as PIXI from 'pixi.js';

/**
 * ブラシテクスチャ種別・Phase3拡張予定
 */
export type BrushTextureType = 'round' | 'flat' | 'texture' | 'watercolor' | 'oil';

/**
 * ブラシ設定・高度描画制御
 */
interface IBrushSettings {
  // 基本設定
  size: number;           // 12-120px
  opacity: number;        // 0.1-1.0
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
 * 高度ブラシツール・PenTool差別化・表現力拡張
 * 筆圧・速度・テクスチャ対応・自然な筆表現
 */
export class BrushTool implements IDrawingTool {
  public readonly name = 'brush';
  public readonly icon = 'ti ti-brush';
  public readonly category = 'drawing' as const;

  private eventBus: EventBus;
  private isActive = false;
  
  // ブラシ設定・PenToolより高度
  private settings: IBrushSettings = {
    // 基本設定・PenToolとの差別化
    size: 18,              // PenToolより大きな初期値
    opacity: 0.6,          // 重ね塗り表現・PenTool: 0.8
    color: 0x800000,       // ふたばマルーン継承
    
    // ブラシ固有設定
    texture: 'round',      // 丸筆・基本テクスチャ
    hardness: 0.7,         // 中程度エッジ・自然な境界
    spacing: 0.2,          // 20%間隔・滑らか描画
    
    // 動的変化・筆表現
    pressureOpacity: true,  // 筆圧→透明度変化有効
    pressureSize: true,     // 筆圧→サイズ変化有効
    velocitySize: true,     // 速度→サイズ変化有効
    velocityOpacity: false, // 速度→透明度変化無効
    
    // 高度設定・Phase3拡張
    scattering: 0.0,       // 散布なし・基本設定
    rotation: 0,           // 回転なし
    flowRate: 0.8,         // 80%フロー・自然な流れ
  };
  
  // 動的状態管理
  private lastPoint: PIXI.Point | null = null;
  private lastPressure = 0;
  private lastVelocity = 0;
  private lastTimestamp = 0;
  private strokeLength = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    console.log('🖌️ BrushTool初期化完了');
  }

  /**
   * ブラシツール有効化・カーソル・UI更新
   */
  public activate(): void {
    this.isActive = true;
    
    // ブラシ専用カーソル・差別化
    document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'8\' fill=\'none\' stroke=\'%23800000\' stroke-width=\'2\' stroke-dasharray=\'2,2\'/%3E%3C/svg%3E") 12 12, crosshair';
    
    // ブラシ設定送信・DrawingEngineにツール変更通知
    this.eventBus.emit('tool:change', {
      toolName: this.name,
      previousTool: '',
      settings: this.settings,
      timestamp: Date.now()
    });
    
    console.log('🖌️ ブラシツール有効化・高度描画準備完了');
  }

  /**
   * ブラシツール無効化・クリーンアップ
   */
  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    
    // 状態リセット
    this.resetStrokeState();
    
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
    this.strokeLength = 0;
    
    // 動的パラメータ計算・初回
    const dynamicParams = this.calculateDynamicParams(
      event.pressure,
      0, // 初回速度0
      event.timestamp
    );
    
    // DrawingEngine連携・ブラシストローク開始
    this.eventBus.emit('drawing:start', {
      point: event.point,
      pressure: event.pressure,
      pointerType: event.pointerType,
      timestamp: event.timestamp
    });

    // ブラシ固有設定適用
    this.applyBrushSettings(dynamicParams);
  }

  /**
   * 描画移動・動的パラメータ更新・リアルタイム変化
   */
  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.lastPoint) return;
    
    // 速度計算・距離ベース
    const distance = this.calculateDistance(this.lastPoint, event.point);
    const timeDelta = Math.max(1, event.timestamp - this.lastTimestamp);
    const currentVelocity = distance / timeDelta * 1000; // px/sec
    
    // 動的パラメータ計算・筆圧・速度反映
    const dynamicParams = this.calculateDynamicParams(
      event.pressure,
      currentVelocity,
      event.timestamp
    );
    
    // スペーシング制御・滑らか描画
    if (this.shouldDrawPoint(distance)) {
      // DrawingEngine連携・動的設定適用
      this.eventBus.emit('drawing:move', {
        point: event.point,
        pressure: event.pressure,
        velocity: currentVelocity,
        timestamp: event.timestamp
      });

      this.applyBrushSettings(dynamicParams);
      this.updateStrokeState(event.point, event.pressure, currentVelocity, event.timestamp);
    }
  }

  /**
   * 描画終了・ストローク完了
   */
  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    
    // DrawingEngine連携・ストローク終了
    this.eventBus.emit('drawing:end', {
      point: event.point,
      timestamp: event.timestamp
    });
    
    console.log(`🖌️ ストローク完了 - 長さ: ${this.strokeLength.toFixed(1)}px`);
    
    this.resetStrokeState();
  }

  /**
   * 動的ブラシパラメータ計算・筆圧・速度反映
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
      const pressureFactor = Math.max(0.3, Math.min(1.5, pressure * 1.2));
      dynamicSize *= pressureFactor;
    }
    
    // 筆圧→不透明度変化
    if (this.settings.pressureOpacity) {
      const pressureFactor = Math.max(0.2, Math.min(1.0, pressure * 0.8 + 0.2));
      dynamicOpacity *= pressureFactor;
    }
    
    // 速度→サイズ変化（高速で細くなる）
    if (this.settings.velocitySize) {
      const velocityFactor = Math.max(0.5, Math.min(1.2, 1.0 - velocity * 0.0005));
      dynamicSize *= velocityFactor;
    }
    
    // 速度→不透明度変化
    if (this.settings.velocityOpacity) {
      const velocityFactor = Math.max(0.3, Math.min(1.0, 1.0 - velocity * 0.0003));
      dynamicOpacity *= velocityFactor;
    }
    
    // 散布計算・Phase3拡張予定
    const scattering = {
      x: (Math.random() - 0.5) * this.settings.scattering * dynamicSize,
      y: (Math.random() - 0.5) * this.settings.scattering * dynamicSize
    };
    
    return {
      size: Math.max(1, Math.min(120, dynamicSize)),
      opacity: Math.max(0.1, Math.min(1.0, dynamicOpacity)),
      rotation: this.settings.rotation,
      scattering
    };
  }

  /**
   * ブラシ設定適用・DrawingEngineに送信
   */
  private applyBrushSettings(params: IDynamicBrushParams): void {
    this.eventBus.emit('tool:setting-change', {
      toolName: this.name,
      setting: 'dynamicParams',
      value: {
        size: params.size,
        opacity: params.opacity,
        color: this.settings.color,
        blendMode: this.getBlendModeForTexture()
      },
      timestamp: Date.now()
    });
  }

  /**
   * スペーシング制御・描画間隔判定
   */
  private shouldDrawPoint(distance: number): boolean {
    const minSpacing = this.settings.size * this.settings.spacing;
    return distance >= minSpacing;
  }

  /**
   * 距離計算・ユークリッド距離
   */
  private calculateDistance(p1: PIXI.Point, p2: PIXI.Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * ストローク状態更新
   */
  private updateStrokeState(
    point: PIXI.Point,
    pressure: number,
    velocity: number,
    timestamp: number
  ): void {
    if (this.lastPoint) {
      this.strokeLength += this.calculateDistance(this.lastPoint, point);
    }
    
    this.lastPoint = point.clone();
    this.lastPressure = pressure;
    this.lastVelocity = velocity;
    this.lastTimestamp = timestamp;
  }

  /**
   * ストローク状態リセット
   */
  private resetStrokeState(): void {
    this.lastPoint = null;
    this.lastPressure = 0;
    this.lastVelocity = 0;
    this.lastTimestamp = 0;
    this.strokeLength = 0;
  }

  /**
   * テクスチャ別ブレンドモード取得・Phase3拡張予定
   */
  private getBlendModeForTexture(): PIXI.BlendModes {
    switch (this.settings.texture) {
      case 'watercolor':
        return PIXI.BlendModes.MULTIPLY;
      case 'oil':
        return PIXI.BlendModes.NORMAL;
      case 'texture':
        return PIXI.BlendModes.OVERLAY;
      default:
        return PIXI.BlendModes.NORMAL;
    }
  }

  /**
   * 設定更新・外部からの設定変更
   */
  public updateSetting<K extends keyof IBrushSettings>(
    key: K,
    value: IBrushSettings[K]
  ): void {
    this.settings[key] = value;
    
    this.eventBus.emit('tool:setting-change', {
      toolName: this.name,
      setting: key,
      value,
      timestamp: Date.now()
    });
    
    console.log(`🖌️ ブラシ設定更新: ${key} = ${value}`);
  }

  /**
   * 現在の設定取得
   */
  public getSettings(): Readonly<IBrushSettings> {
    return { ...this.settings };
  }

  /**
   * プリセット適用・Phase3実装予定
   */
  public applyPreset(presetName: string): void {
    const presets: Record<string, Partial<IBrushSettings>> = {
      'soft': {
        hardness: 0.3,
        opacity: 0.4,
        pressureOpacity: true,
        pressureSize: true
      },
      'hard': {
        hardness: 0.9,
        opacity: 0.8,
        pressureOpacity: false,
        pressureSize: false
      },
      'textured': {
        texture: 'texture',
        scattering: 0.3,
        rotation: 45,
        spacing: 0.4
      }
    };

    const preset = presets[presetName];
    if (preset) {
      Object.assign(this.settings, preset);
      console.log(`🖌️ プリセット適用: ${presetName}`);
    }
  }
}