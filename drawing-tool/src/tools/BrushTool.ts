// BrushTool.ts - 高度描画ツール・テクスチャ対応・筆圧表現拡張
// Phase1 PenTool継承・IDrawingTool準拠・差別化実装

import type { EventBus, IEventData } from '../core/EventBus.js';
import type { IDrawingTool } from './PenTool.js';

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
    size: 12,              // PenToolより大きな初期値
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
    console.log('🖌️ BrushTool初期化完了');
  }

  /**
   * ブラシツール有効化・カーソル・UI更新
   */
  public activate(): void {
    this.isActive = true;
    
    // ブラシ専用カーソル・差別化
    document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'8\' fill=\'none\' stroke=\'%23800000\' stroke-width=\'2\'/%3E%3C/svg%3E") 12 12, crosshair';
    
    // ブラシ設定UI表示・Phase2後半実装予定
    this.eventBus.emit('ui:tool-activated', {
      toolName: this.name,
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
  }

  /**
   * 描画移動・動的パラメータ更新・リアルタイム変化