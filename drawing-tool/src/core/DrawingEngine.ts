// DrawingEngine.ts - 描画エンジン・Graphics統合・ツール制御
// PixiJS Graphics最適化・スムージング・手ブレ軽減

import * as PIXI from 'pixi.js';
import type { EventBus, IEventData } from './EventBus.js';
import { 
  CANVAS, 
  PEN_TOOL, 
  BRUSH_TOOL, 
  DRAWING_ENGINE, 
  INPUT 
} from '../constants/drawing-constants.js';

/**
 * ストロークデータ・描画情報
 */
interface IStrokeData {
  id: string;
  points: PIXI.Point[];
  pressures: number[];
  timestamps: number[];
  color: number;
  size: number;
  tool: string;
  smoothed: boolean;
}

/**
 * 描画設定・品質制御
 */
interface IDrawingSettings {
  smoothing: {
    enabled: boolean;
    factor: number; // 0-1, 1=最大スムージング
    minDistance: number; // 最小描画距離
  };
  performance: {
    maxPointsPerStroke: number;
    batchDrawing: boolean;
    useQuadraticCurves: boolean;
  };
  quality: {
    antialias: boolean;
    lineJoin: 'round' | 'bevel' | 'miter';
    lineCap: 'round' | 'square' | 'butt';
  };
}

/**
 * 描画統計・パフォーマンス監視
 */
interface IDrawingStats {
  totalStrokes: number;
  totalPoints: number;
  averageStrokeLength: number;
  drawingTime: number;
  lastDrawTime: number;
}

/**
 * 描画エンジン・ツール統合制御
 */
export class DrawingEngine {
  private app: PIXI.Application;
  private eventBus: EventBus;
  
  // 描画コンテナ階層
  private drawingContainer: PIXI.Container;
  private currentLayer: PIXI.Graphics;
  private tempGraphics: PIXI.Graphics; // 描画中の一時Graphics
  
  // 描画状態
  private isDrawing = false;
  private currentStroke: IStrokeData | null = null;
  private strokeId = 0;
  
  // 設定・統計
  private settings: IDrawingSettings;
  private stats: IDrawingStats;
  
  // スムージング用バッファ
  private pointBuffer: { point: PIXI.Point; pressure: number; timestamp: number }[] = [];
  private readonly bufferSize = 5;

  constructor(app: PIXI.Application, eventBus: EventBus) {
    this.app = app;
    this.eventBus = eventBus;
    
    // 初期設定 - drawing-constants.ts 活用
    this.settings = this.createDefaultSettings();
    this.stats = this.createEmptyStats();
    
    // コンテナ階層初期化
    this.initializeContainers();
    
    // イベントリスナー設定
    this.setupEventListeners();
    
    console.log('🖌️ DrawingEngine初期化完了');
  }

  /**
   * コンテナ階層初期化・描画構造構築
   */
  private initializeContainers(): void {
    // メイン描画コンテナ作成
    this.drawingContainer = new PIXI.Container();
    this.drawingContainer.name = 'DrawingContainer';
    this.drawingContainer.sortableChildren = true;
    
    // 基本レイヤー作成
    this.currentLayer = new PIXI.Graphics();
    this.currentLayer.name = 'Layer_0';
    this.currentLayer.zIndex = 0;
    
    // 一時描画Graphics
    this.tempGraphics = new PIXI.Graphics();
    this.tempGraphics.name = 'TempDrawing';
    this.tempGraphics.zIndex = 1000; // 最前面
    
    // 階層構造構築
    this.drawingContainer.addChild(this.currentLayer);
    this.drawingContainer.addChild(this.tempGraphics);
    this.app.stage.addChild(this.drawingContainer);
    
    console.log('🖌️ 描画コンテナ階層構築完了');
  }

  /**
   * イベントリスナー設定・描画制御
   */
  private setupEventListeners(): void {
    // 描画開始・ツール統合
    this.eventBus.on('drawing:start', (data) => {
      this.startDrawing(data.point, data.pressure, data.tool);
    });

    // 描画中・ストローク追加
    this.eventBus.on('drawing:move', (data) => {
      if (this.isDrawing) {
        this.continueDrawing(data.point, data.pressure);
      }
    });

    // 描画終了・ストローク確定
    this.eventBus.on('drawing:end', (data) => {
      this.endDrawing(data.point, data.pressure);
    });

    // レイヤー変更対応
    this.eventBus.on('layer:active-changed', (data) => {
      this.switchToLayer(data.activeLayerId);
    });

    // 設定変更対応
    this.eventBus.on('tool:settings-changed', (data) => {
      this.updateToolSettings(data);
    });

    console.log('🎯 DrawingEngine イベントリスナー設定完了');
  }

  /**
   * 描画開始・ストローク初期化
   */
  private startDrawing(point: PIXI.Point, pressure: number, tool: string): void {
    if (this.isDrawing) {
      console.warn('⚠️ 既に描画中です');
      return;
    }

    this.isDrawing = true;
    const timestamp = performance.now();

    // 新しいストローク作成
    this.currentStroke = {
      id: `stroke_${++this.strokeId}`,
      points: [point.clone()],
      pressures: [pressure],
      timestamps: [timestamp],
      color: PEN_TOOL.DEFAULT_COLOR, // 後でツール設定から取得
      size: PEN_TOOL.DEFAULT_SIZE,
      tool,
      smoothed: false
    };

    // 一時Graphics初期化
    this.tempGraphics.clear();
    this.initializeGraphicsStyle(this.tempGraphics, tool);

    // 初期点描画
    this.tempGraphics.circle(point.x, point.y, this.currentStroke.size / 2);
    this.tempGraphics.fill();

    // バッファ초기화
    this.pointBuffer = [{ point: point.clone(), pressure, timestamp }];

    // 統計更新
    this.stats.totalStrokes++;
    this.stats.lastDrawTime = timestamp;

    console.log(`🖌️ 描画開始: ${tool} at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
  }

  /**
   * 描画継続・ストローク拡張
   */
  private continueDrawing(point: PIXI.Point, pressure: number): void {
    if (!this.isDrawing || !this.currentStroke) return;

    const timestamp = performance.now();
    
    // 最小距離チェック・パフォーマンス最適化
    const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
    const distance = Math.sqrt(
      Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
    );

    if (distance < INPUT.DRAG_THRESHOLD_PX) {
      return; // 距離が小さすぎる場合は無視
    }

    // ポイント追加
    this.currentStroke.points.push(point.clone());
    this.currentStroke.pressures.push(pressure);
    this.currentStroke.timestamps.push(timestamp);

    // バッファ管理
    this.pointBuffer.push({ point: point.clone(), pressure, timestamp });
    if (this.pointBuffer.length > this.bufferSize) {
      this.pointBuffer.shift();
    }

    // スムージング適用
    if (this.settings.smoothing.enabled && this.pointBuffer.length >= 3) {
      this.drawSmoothedLine();
    } else {
      this.drawDirectLine(lastPoint, point, pressure);
    }

    // 統計更新
    this.stats.totalPoints++;
  }

  /**
   * 描画終了・ストローク確定
   */
  private endDrawing(point: PIXI.Point, pressure: number): void {
    if (!this.isDrawing || !this.currentStroke) return;

    // 最終ポイント追加
    this.currentStroke.points.push(point.clone());
    this.currentStroke.pressures.push(pressure);
    this.currentStroke.timestamps.push(performance.now());

    // 一時Graphics から currentLayer へコピー
    this.finalizeStroke();

    // 状態リセット
    this.isDrawing = false;
    this.currentStroke = null;
    this.pointBuffer = [];
    this.tempGraphics.clear();

    // 統計更新
    this.stats.drawingTime = performance.now() - this.stats.lastDrawTime;
    this.updateAverageStrokeLength();

    console.log(`✅ 描画終了: ${this.stats.totalPoints}点, ${this.stats.drawingTime.toFixed(1)}ms`);

    // 描画完了イベント
    this.eventBus.emit('drawing:stroke-completed', {
      strokeId: this.currentStroke?.id || '',
      pointCount: this.stats.totalPoints,
      drawingTime: this.stats.drawingTime
    });
  }

  /**
   * スムージング描画・ベジェ曲線
   */
  private drawSmoothedLine(): void {
    if (this.pointBuffer.length < 3) return;

    const p1 = this.pointBuffer[this.pointBuffer.length - 3];
    const p2 = this.pointBuffer[this.pointBuffer.length - 2];
    const p3 = this.pointBuffer[this.pointBuffer.length - 1];

    // 制御点計算・カトマル-ロム補間
    const cp1x = p1.point.x + (p2.point.x - p1.point.x) * this.settings.smoothing.factor;
    const cp1y = p1.point.y + (p2.point.y - p1.point.y) * this.settings.smoothing.factor;
    const cp2x = p2.point.x + (p3.point.x - p2.point.x) * this.settings.smoothing.factor;
    const cp2y = p2.point.y + (p3.point.y - p2.point.y) * this.settings.smoothing.factor;

    // 動的線幅・筆圧対応
    const dynamicSize = this.calculateDynamicSize(p2.pressure);
    
    this.tempGraphics
      .moveTo(p1.point.x, p1.point.y)
      .bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.point.x, p2.point.y)
      .stroke({ width: dynamicSize, cap: 'round', join: 'round' });
  }

  /**
   * 直線描画・非スムージング
   */
  private drawDirectLine(from: PIXI.Point, to: PIXI.Point, pressure: number): void {
    const dynamicSize = this.calculateDynamicSize(pressure);
    
    this.tempGraphics
      .moveTo(from.x, from.y)
      .lineTo(to.x, to.y)
      .stroke({ width: dynamicSize, cap: 'round', join: 'round' });
  }

  /**
   * 動的サイズ計算・筆圧・速度対応
   */
  private calculateDynamicSize(pressure: number): number {
    if (!this.currentStroke) return PEN_TOOL.DEFAULT_SIZE;

    const baseSize = this.currentStroke.size;
    const pressureFactor = Math.max(0.1, pressure); // 最小10%
    
    return baseSize * pressureFactor;
  }

  /**
   * Graphics スタイル初期化・ツール別
   */
  private initializeGraphicsStyle(graphics: PIXI.Graphics, tool: string): void {
    // ツール別スタイル設定
    switch (tool) {
      case 'pen':
        graphics.stroke({ 
          width: PEN_TOOL.DEFAULT_SIZE, 
          color: PEN_TOOL.DEFAULT_COLOR,
          cap: PEN_TOOL.LINE_CAP as any,
          join: PEN_TOOL.LINE_JOIN as any
        });
        break;
      
      case 'brush':
        graphics.stroke({ 
          width: BRUSH_TOOL.DEFAULT_SIZE, 
          color: PEN_TOOL.DEFAULT_COLOR, // 後で設定システムから取得
          cap: 'round',
          join: 'round'
        });
        graphics.alpha = BRUSH_TOOL.DEFAULT_OPACITY;
        break;
      
      default:
        graphics.stroke({ 
          width: PEN_TOOL.DEFAULT_SIZE, 
          color: PEN_TOOL.DEFAULT_COLOR,
          cap: 'round',
          join: 'round'
        });
    }
  }

  /**
   * ストローク確定・レイヤーへ転送
   */
  private finalizeStroke(): void {
    if (!this.currentStroke) return;

    // 一時Graphics の内容を currentLayer にコピー
    // PixiJS v8 では Geometry を直接コピー
    const tempTexture = this.app.renderer.extract.canvas(this.tempGraphics);
    const sprite = PIXI.Sprite.from(tempTexture);
    this.currentLayer.addChild(sprite);

    // メモリ管理・一時テクスチャ破棄は後で
    console.log(`📋 ストローク確定: ${this.currentStroke.id}`);
  }

  /**
   * レイヤー切り替え・LayerManager連携
   */
  private switchToLayer(layerId: string): void {
    // LayerManager から新しいレイヤーContainer取得
    this.eventBus.emit('drawing:request-layer-container', { layerId });
    
    console.log(`🔄 描画レイヤー切り替え: ${layerId}`);
  }

  /**
   * ツール設定更新・動的変更
   */
  private updateToolSettings(settings: any): void {
    // 設定更新処理・後で詳細実装
    console.log('⚙️ ツール設定更新:', settings);
  }

  /**
   * デフォルト設定作成・定数活用
   */
  private createDefaultSettings(): IDrawingSettings {
    return {
      smoothing: {
        enabled: true,
        factor: PEN_TOOL.SMOOTHING_FACTOR,
        minDistance: PEN_TOOL.MIN_DISTANCE
      },
      performance: {
        maxPointsPerStroke: PEN_TOOL.MAX_POINTS_PER_STROKE,
        batchDrawing: DRAWING_ENGINE.BATCH_SIZE > 0,
        useQuadraticCurves: true
      },
      quality: {
        antialias: DRAWING_ENGINE.ANTI_ALIAS,
        lineJoin: PEN_TOOL.LINE_JOIN as any,
        lineCap: PEN_TOOL.LINE_CAP as any
      }
    };
  }

  /**
   * 空統計作成
   */
  private createEmptyStats(): IDrawingStats {
    return {
      totalStrokes: 0,
      totalPoints: 0,
      averageStrokeLength: 0,
      drawingTime: 0,
      lastDrawTime: 0
    };
  }

  /**
   * 平均ストローク長更新
   */
  private updateAverageStrokeLength(): void {
    if (this.stats.totalStrokes > 0) {
      this.stats.averageStrokeLength = this.stats.totalPoints / this.stats.totalStrokes;
    }
  }

  /**
   * 描画統計取得・パフォーマンス監視
   */
  public getDrawingStats(): Readonly<IDrawingStats> {
    return { ...this.stats };
  }

  /**
   * 設定更新・外部からの変更
   */
  public updateSettings(newSettings: Partial<IDrawingSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ DrawingEngine設定更新:', newSettings);
  }

  /**
   * 描画クリア・レイヤー初期化
   */
  public clearCurrentLayer(): void {
    this.currentLayer.clear();
    this.tempGraphics.clear();
    console.log('🧹 現在レイヤークリア');
  }

  /**
   * リソース解放・終了処理
   */
  public destroy(): void {
    console.log('🔄 DrawingEngine終了処理開始...');

    // 描画中断
    if (this.isDrawing) {
      this.isDrawing = false;
      this.currentStroke = null;
    }

    // Graphics破棄
    this.tempGraphics.destroy();
    this.currentLayer.destroy();
    
    // Container破棄
    if (this.drawingContainer.parent) {
      this.drawingContainer.parent.removeChild(this.drawingContainer);
    }
    this.drawingContainer.destroy({ children: true });

    // バッファクリア
    this.pointBuffer = [];

    console.log('✅ DrawingEngine終了処理完了');
  }
}