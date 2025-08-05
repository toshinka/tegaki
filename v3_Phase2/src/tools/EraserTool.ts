// EraserTool.ts - Phase2強化版・高度消去・アルファブレンド・選択消去
// Phase1基本実装継承・IDrawingTool準拠・差別化機能追加

import type { EventBus, IEventData } from '../core/EventBus.js';
import type { IDrawingTool } from './PenTool.js';
import * as PIXI from 'pixi.js';

/**
 * 消しゴムモード・消去方法選択
 */
export type EraserMode = 'normal' | 'alpha' | 'color' | 'selection';

/**
 * 消しゴム設定・高度消去制御
 */
interface IEraserSettings {
  // 基本設定
  size: number;           // 8-80px・PenToolより大きめ
  opacity: number;        // 消去強度 0.1-1.0
  hardness: number;       // エッジ硬度 0.0-1.0
  
  // 消去モード
  mode: EraserMode;       // 消去方法選択
  
  // 高度機能・Phase2実装
  antiAlias: boolean;     // アンチエイリアス有効
  preserveOpacity: boolean; // 不透明度保持消去
  colorThreshold: number; // 色域消去閾値 0-255
  
  // 動的変化
  pressureSize: boolean;   // 筆圧→サイズ変化
  pressureOpacity: boolean; // 筆圧→消去強度
  velocityFade: boolean;   // 速度→消去減衰
}

/**
 * 動的消去パラメータ
 */
interface IDynamicEraserParams {
  size: number;
  opacity: number;
  hardness: number;
  blendMode: PIXI.BlendModes;
}

/**
 * 消去統計・性能監視
 */
interface IEraserStats {
  eraseCount: number;
  totalPixelsErased: number;
  averageEraseSize: number;
  lastEraseTime: number;
}

/**
 * 高度消しゴムツール・Phase2実装
 * アルファブレンド・色域消去・選択範囲消去対応
 */
export class EraserTool implements IDrawingTool {
  public readonly name = 'eraser';
  public readonly icon = 'ti ti-eraser';
  public readonly category = 'editing' as const;

  private eventBus: EventBus;
  private isActive = false;
  
  // 消しゴム設定・高度機能
  private settings: IEraserSettings = {
    // 基本設定・消しゴム特化
    size: 16,              // PenTool: 8, BrushTool: 12より大きめ
    opacity: 1.0,          // 100%消去・明確な効果
    hardness: 0.8,         // 80%硬度・クリアなエッジ
    
    // 消去モード
    mode: 'normal',        // 通常消去・アルファ消去
    
    // 高度機能
    antiAlias: true,       // スムーズエッジ
    preserveOpacity: false, // 完全消去
    colorThreshold: 10,    // 色域消去感度
    
    // 動的変化
    pressureSize: true,    // 筆圧サイズ変化有効
    pressureOpacity: true, // 筆圧消去強度有効
    velocityFade: false,   // 速度減衰無効・確実消去
  };
  
  // 動的状態管理
  private lastPoint: PIXI.Point | null = null;
  private lastPressure = 0;
  private lastVelocity = 0;
  private lastTimestamp = 0;
  
  // 消去データ・取り消し用
  private eraseHistory: Array<{
    layer: string;
    region: PIXI.Rectangle;
    imageData: ImageData;
    timestamp: number;
  }> = [];
  
  // 統計
  private stats: IEraserStats = {
    eraseCount: 0,
    totalPixelsErased: 0,
    averageEraseSize: 0,
    lastEraseTime: 0
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    console.log('🧹 EraserTool強化版初期化完了');
  }

  /**
   * 消しゴムツール有効化・専用カーソル・UI更新
   */
  public activate(): void {
    this.isActive = true;
    
    // 消しゴム専用カーソル・視覚的差別化
    document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Crect x=\'4\' y=\'8\' width=\'16\' height=\'12\' rx=\'2\' fill=\'none\' stroke=\'%23800000\' stroke-width=\'2\'/%3E%3Cpath d=\'m4 12 4-4\' stroke=\'%23800000\' stroke-width=\'2\'/%3E%3C/svg%3E") 12 12, crosshair';
    
    // 消しゴム設定UI表示
    this.eventBus.emit('ui:tool-activated', {
      toolName: this.name,
      settings: this.settings,
      timestamp: Date.now()
    });
    
    console.log('🧹 消しゴムツール有効化・高度消去準備完了');
  }

  /**
   * 消しゴムツール無効化・履歴保存
   */
  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    
    // 状態リセット・履歴は保持
    this.lastPoint = null;
    this.lastPressure = 0;
    this.lastVelocity = 0;
    this.lastTimestamp = 0;
    
    console.log('🧹 消しゴムツール無効化・履歴保持');
  }

  /**
   * 消去開始・初期化・履歴記録準備
   */
  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    // 初期状態設定
    this.lastPoint = event.point.clone();
    this.lastPressure = event.pressure;
    this.lastTimestamp = event.timestamp;
    this.lastVelocity = 0;
    
    // 動的パラメータ計算
    const dynamicParams = this.calculateDynamicParams(
      event.pressure,
      0, // 初回速度0
      event.timestamp
    );
    
    // 消去履歴記録開始・Phase2後半実装
    this.startEraseHistory(event.point, dynamicParams.size);
    
    // DrawingEngine連携・消去設定送信
    this.eventBus.emit('eraser:stroke-start', {
      point: event.point,
      params: dynamicParams,
      settings: this.settings,
      timestamp: event.timestamp
    });
    
    this.stats.eraseCount++;
  }

  /**
   * 消去移動・動的パラメータ更新・リアルタイム消去
   */
  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.lastPoint) return;
    
    // 速度計算・動的パラメータ更新
    const velocity = this.calculateVelocity(event.point, event.timestamp);
    const dynamicParams = this.calculateDynamicParams(
      event.pressure,
      velocity,
      event.timestamp
    );
    
    // 消去データ送信・DrawingEngine連携
    this.eventBus.emit('eraser:stroke-move', {
      point: event.point,
      params: dynamicParams,
      settings: this.settings,
      velocity,
      timestamp: event.timestamp
    });
    
    // 状態更新
    this.updateState(event.point, event.pressure, velocity, event.timestamp);
    
    // 統計更新
    this.updateStats(dynamicParams.size);
  }

  /**
   * 消去終了・履歴確定・統計記録
   */
  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    
    // 消去終了通知
    this.eventBus.emit('eraser:stroke-end', {
      point: event.point,
      settings: this.settings,
      timestamp: event.timestamp
    });
    
    // 履歴確定・取り消し準備
    this.finalizeEraseHistory();
    
    // 状態リセット
    this.lastPoint = null;
    this.stats.lastEraseTime = event.timestamp;
    
    console.log(`🧹 消去完了・サイズ: ${this.settings.size}px, 強度: ${(this.settings.opacity * 100).toFixed(0)}%`);
  }

  /**
   * 消しゴム設定取得
   */
  public getSettings(): IEraserSettings {
    return { ...this.settings };
  }

  /**
   * 消しゴム設定更新・リアルタイム反映
   */
  public updateSettings(newSettings: Partial<IEraserSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    // 設定変更通知・UI同期
    this.eventBus.emit('eraser:settings-changed', {
      oldSettings,
      newSettings: this.settings,
      timestamp: Date.now()
    });
    
    console.log('🧹 消しゴム設定更新:', {
      size: this.settings.size,
      mode: this.settings.mode,
      opacity: this.settings.opacity
    });
  }

  /**
   * 消去モード変更・高度機能切り替え
   * @param mode 消去モード
   */
  public setEraseMode(mode: EraserMode): void {
    const oldMode = this.settings.mode;
    this.settings.mode = mode;
    
    // モード別設定調整
    switch (mode) {
      case 'normal':
        // 通常消去・アルファブレンド
        this.settings.opacity = 1.0;
        break;
        
      case 'alpha':
        // アルファ消去・透明度減少
        this.settings.opacity = 0.3;
        this.settings.preserveOpacity = true;
        break;
        
      case 'color':
        // 色域消去・特定色削除
        this.settings.colorThreshold = 20;
        break;
        
      case 'selection':
        // 選択範囲消去・Phase2後半実装
        break;
    }
    
    console.log(`🧹 消去モード変更: ${oldMode} → ${mode}`);
  }

  /**
   * 動的パラメータ計算・筆圧・速度対応
   */
  private calculateDynamicParams(
    pressure: number,
    velocity: number,
    timestamp: number
  ): IDynamicEraserParams {
    let size = this.settings.size;
    let opacity = this.settings.opacity;
    let hardness = this.settings.hardness;
    
    // 筆圧→サイズ変化・より大きな変動
    if (this.settings.pressureSize) {
      const pressureFactor = Math.max(0.3, pressure); // 最小30%
      size = this.settings.size * (0.5 + pressureFactor * 0.8); // 50%-130%
    }
    
    // 筆圧→消去強度変化
    if (this.settings.pressureOpacity) {
      const pressureFactor = Math.max(0.2, pressure); // 最小20%
      opacity = this.settings.opacity * pressureFactor;
    }
    
    // 速度→消去減衰・高速では薄く
    if (this.settings.velocityFade && velocity > 0.5) {
      const velocityFactor = Math.max(0.5, 1.0 - (velocity - 0.5) * 0.3);
      opacity *= velocityFactor;
    }
    
    // ブレンドモード選択・消去方法
    let blendMode: PIXI.BlendModes;
    switch (this.settings.mode) {
      case 'normal':
        blendMode = PIXI.BlendModes.NORMAL; // アルファ消去
        break;
      case 'alpha':
        blendMode = PIXI.BlendModes.MULTIPLY; // 透明度減少
        break;
      case 'color':
        blendMode = PIXI.BlendModes.DIFFERENCE; // 色差消去
        break;
      default:
        blendMode = PIXI.BlendModes.NORMAL;
    }
    
    return {
      size: Math.max(1, Math.round(size)),
      opacity: Math.max(0.1, Math.min(1.0, opacity)),
      hardness: Math.max(0.1, Math.min(1.0, hardness)),
      blendMode
    };
  }

  /**
   * 速度計算・動的制御用
   */
  private calculateVelocity(currentPoint: PIXI.Point, timestamp: number): number {
    if (!this.lastPoint || this.lastTimestamp === 0) return 0;
    
    const distance = Math.sqrt(
      Math.pow(currentPoint.x - this.lastPoint.x, 2) +
      Math.pow(currentPoint.y - this.lastPoint.y, 2)
    );
    
    const timeDelta = Math.max(1, timestamp - this.lastTimestamp);
    return Math.min(2.0, distance / timeDelta * 10); // 正規化・最大2.0
  }

  /**
   * 状態更新・内部管理
   */
  private updateState(
    point: PIXI.Point,
    pressure: number,
    velocity: number,
    timestamp: number
  ): void {
    this.lastPoint = point.clone();
    this.lastPressure = pressure;
    this.lastVelocity = velocity;
    this.lastTimestamp = timestamp;
  }

  /**
   * 統計更新・性能監視
   */
  private updateStats(eraseSize: number): void {
    const pixelsErased = Math.PI * Math.pow(eraseSize / 2, 2);
    this.stats.totalPixelsErased += pixelsErased;
    
    // 移動平均更新
    this.stats.averageEraseSize = 
      (this.stats.averageEraseSize * 0.9) + (eraseSize * 0.1);
  }

  /**
   * 消去履歴記録開始・取り消し用・Phase2後半実装
   */
  private startEraseHistory(point: PIXI.Point, size: number): void {
    // Phase2後半で実装・現在はスタブ
    console.log(`🧹 消去履歴記録開始: ${point.x}, ${point.y}, サイズ: ${size}`);
  }

  /**
   * 消去履歴確定・取り消し準備
   */
  private finalizeEraseHistory(): void {
    // Phase2後半で実装・現在はスタブ
    console.log('🧹 消去履歴確定・取り消し準備完了');
  }

  /**
   * 消去統計取得・デバッグ・分析用
   */
  public getStats(): IEraserStats {
    return { ...this.stats };
  }

  /**
   * 消去履歴クリア・メモリ最適化
   */
  public clearHistory(): void {
    this.eraseHistory = [];
    console.log('🧹 消去履歴クリア・メモリ解放');
  }

  /**
   * カーソルサイズ更新・視覚フィードバック
   */
  public updateCursor(): void {
    if (!this.isActive) return;
    
    const size = Math.max(8, Math.min(64, this.settings.size));
    const cursorSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'%3E%3Ccircle cx='${size/2}' cy='${size/2}' r='${size/2 - 1}' fill='none' stroke='%23800000' stroke-width='1' stroke-dasharray='2,2'/%3E%3C/svg%3E`;
    
    document.body.style.cursor = `url("${cursorSvg}") ${size/2} ${size/2}, crosshair`;
  }

  /**
   * リソース解放・メモリクリーンアップ
   */
  public destroy(): void {
    console.log('🧹 EraserTool終了処理開始...');
    
    this.clearHistory();
    this.lastPoint = null;
    
    // 統計リセット
    this.stats = {
      eraseCount: 0,
      totalPixelsErased: 0,
      averageEraseSize: 0,
      lastEraseTime: 0
    };
    
    console.log('✅ EraserTool終了処理完了');
  }
}