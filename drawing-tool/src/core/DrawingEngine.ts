// DrawingEngine.ts - 描画エンジン・Graphics統合・ツール制御
// PixiJS Graphics最適化・スムージング・手ブレ軽減・v8対応

import * as PIXI from 'pixi.js';
import type { EventBus, IEventData } from './EventBus.js';
import { DRAWING_CONSTANTS } from '../constants/drawing-constants.js';

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
 * 描画エンジン・ツール統合制御・Pixi.js v8対応
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
  
  // ツール設定
  private currentTool = {
    name: 'pen',
    size: 4,
    color: 0x000000,
    opacity: 1.0,
    blendMode: DRAWING_CONSTANTS.BLEND_MODES.NORMAL
  };

  constructor(app: PIXI.Application, eventBus: EventBus) {
    this.app = app;
    this.eventBus = eventBus;
    
    // 初期設定
    this.settings = this.createDefaultSettings();
    this.stats = this.createEmptyStats();
    
    // コンテナ階層初期化
    this.initializeContainers();
    
    // イベントリスナー設定
    this.setupEventListeners();
    
    console.log('🖌️ DrawingEngine初期化完了');
  }

  /**
   * コンテナ階層初期化・描画構造構築・Pixi.js v8対応
   */
  private initializeContainers(): void {
    // メイン描画コンテナ作成
    this.drawingContainer = new PIXI.Container();
    this.drawingContainer.label = 'DrawingContainer'; // v8: name → label
    this.drawingContainer.sortableChildren = true;
    
    // 基本レイヤー作成
    this.currentLayer = new PIXI.Graphics();
    this.currentLayer.label = 'Layer_0'; // v8: name → label
    this.currentLayer.zIndex = 0;
    
    // 一時描画Graphics
    this.tempGraphics = new PIXI.Graphics();
    this.tempGraphics.label = 'TempDrawing'; // v8: name → label
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
    // 描画イベント
    this.eventBus.on('drawing:start', this.onDrawingStart.bind(this));
    this.eventBus.on('drawing:move', this.onDrawingMove.bind(this));
    this.eventBus.on('drawing:end', this.onDrawingEnd.bind(this));
    
    // ツール変更
    this.eventBus.on('tool:change', this.onToolChange.bind(this));
    this.eventBus.on('tool:pen-mode', this.onToolModeChange.bind(this));
    this.eventBus.on('tool:brush-mode', this.onToolModeChange.bind(this));
    this.eventBus.on('tool:eraser-mode', this.onToolModeChange.bind(this));
    
    // 設定変更
    this.eventBus.on('drawing:settings-change', this.onSettingsChange.bind(this));
    this.eventBus.on('drawing:color-change', this.onColorChange.bind(this));
    this.eventBus.on('drawing:size-change', this.onSizeChange.bind(this));
    
    // レイヤー制御
    this.eventBus.on('layer:change', this.onLayerChange.bind(this));
    this.eventBus.on('layer:blend-mode', this.onLayerBlendModeChange.bind(this));
    
    console.log('🖌️ DrawingEngine イベントリスナー設定完了');
  }

  /**
   * 描画開始・ストローク初期化
   */
  private onDrawingStart(event: IEventData['drawing:start']): void {
    if (this.isDrawing) return;
    
    this.isDrawing = true;
    this.strokeId++;
    
    // 新しいストローク作成
    this.currentStroke = {
      id: `stroke_${this.strokeId}`,
      points: [new PIXI.Point(event.x, event.y)],
      pressures: [event.pressure || 1.0],
      timestamps: [performance.now()],
      color: this.currentTool.color,
      size: this.currentTool.size,
      tool: this.currentTool.name,
      smoothed: false
    };
    
    // 一時描画開始
    this.tempGraphics.clear();
    this.tempGraphics.lineStyle({
      width: this.currentTool.size,
      color: this.currentTool.color,
      alpha: this.currentTool.opacity,
      cap: PIXI.LINE_CAP.ROUND,
      join: PIXI.LINE_JOIN.ROUND
    });
    
    this.tempGraphics.moveTo(event.x, event.y);
    
    // 統計更新
    this.stats.totalStrokes++;
    this.stats.lastDrawTime = performance.now();
    
    console.log(`🖌️ 描画開始: ${this.currentStroke.id} at (${event.x}, ${event.y})`);
  }

  /**
   * 描画移動・ストローク追加・スムージング
   */
  private onDrawingMove(event: IEventData['drawing:move']): void {
    if (!this.isDrawing || !this.currentStroke) return;
    
    const point = new PIXI.Point(event.x, event.y);
    const pressure = event.pressure || 1.0;
    const timestamp = performance.now();
    
    // 最小距離チェック・パフォーマンス最適化
    const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
    const distance = Math.sqrt(
      Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
    );
    
    if (distance < this.settings.smoothing.minDistance) return;
    
    // ポイント追加
    this.currentStroke.points.push(point);
    this.currentStroke.pressures.push(pressure);
    this.currentStroke.timestamps.push(timestamp);
    
    // バッファに追加
    this.pointBuffer.push({ point, pressure, timestamp });
    if (this.pointBuffer.length > this.bufferSize) {
      this.pointBuffer.shift();
    }
    
    // リアルタイム描画・スムージング適用
    this.drawStrokeSegment(lastPoint, point, pressure);
    
    // 統計更新
    this.stats.totalPoints++;
  }

  /**
   * 描画終了・ストローク確定・最適化
   */
  private onDrawingEnd(event: IEventData['drawing:end']): void {
    if (!this.isDrawing || !this.currentStroke) return;
    
    this.isDrawing = false;
    
    // 最終ポイント追加
    const finalPoint = new PIXI.Point(event.x, event.y);
    this.currentStroke.points.push(finalPoint);
    this.currentStroke.pressures.push(event.pressure || 1.0);
    this.currentStroke.timestamps.push(performance.now());
    
    // ストローク最適化・スムージング適用
    if (this.settings.smoothing.enabled && 
        this.currentStroke.points.length > DRAWING_CONSTANTS.DRAWING_ENGINE.SMOOTHING.OPTIMIZATION_THRESHOLD) {
      this.optimizeStroke(this.currentStroke);
    }
    
    // 現在レイヤーに確定描画
    this.commitStrokeToLayer(this.currentStroke);
    
    // 一時描画クリア
    this.tempGraphics.clear();
    
    // 統計更新
    const strokeTime = performance.now() - this.stats.lastDrawTime;
    this.stats.drawingTime += strokeTime;
    this.stats.averageStrokeLength = this.stats.totalPoints / this.stats.totalStrokes;
    
    // イベント発火・履歴管理
    this.eventBus.emit('drawing:stroke-complete', {
      stroke: this.currentStroke,
      stats: this.stats,
      timestamp: performance.now()
    });
    
    console.log(`🖌️ 描画終了: ${this.currentStroke.id}, 点数: ${this.currentStroke.points.length}`);
    
    // クリーンアップ
    this.currentStroke = null;
    this.pointBuffer = [];
  }

  /**
   * ストローク描画セグメント・リアルタイム表示
   */
  private drawStrokeSegment(fromPoint: PIXI.Point, toPoint: PIXI.Point, pressure: number): void {
    // 筆圧対応サイズ計算
    const dynamicSize = this.currentTool.size * pressure;
    
    // 線スタイル更新
    this.tempGraphics.lineStyle({
      width: dynamicSize,
      color: this.currentTool.color,
      alpha: this.currentTool.opacity,
      cap: PIXI.LINE_CAP.ROUND,
      join: PIXI.LINE_JOIN.ROUND
    });
    
    // スムージングありの場合
    if (this.settings.smoothing.enabled && this.pointBuffer.length >= 3) {
      this.drawSmoothedSegment(fromPoint, toPoint);
    } else {
      // 直線描画
      this.tempGraphics.lineTo(toPoint.x, toPoint.y);
    }
  }

  /**
   * スムージング描画・ベジェ曲線近似
   */
  private drawSmoothedSegment(fromPoint: PIXI.Point, toPoint: PIXI.Point): void {
    if (this.pointBuffer.length < 3) return;
    
    const buffer = this.pointBuffer;
    const factor = this.settings.smoothing.factor;
    
    // 制御点計算・ベジェ曲線
    const p0 = buffer[buffer.length - 3].point;
    const p1 = buffer[buffer.length - 2].point;
    const p2 = buffer[buffer.length - 1].point;
    
    // スムージング制御点
    const cp1x = p1.x + (p2.x - p0.x) * factor * 0.25;
    const cp1y = p1.y + (p2.y - p0.y) * factor * 0.25;
    const cp2x = p2.x - (toPoint.x - p1.x) * factor * 0.25;
    const cp2y = p2.y - (toPoint.y - p1.y) * factor * 0.25;
    
    // ベジェ曲線描画
    this.tempGraphics.bezierCurveTo(
      cp1x, cp1y,
      cp2x, cp2y,
      toPoint.x, toPoint.y
    );
  }

  /**
   * ストローク最適化・点削減・性能向上
   */
  private optimizeStroke(stroke: IStrokeData): void {
    const originalLength = stroke.points.length;
    
    // Douglas-Peucker アルゴリズム簡易版
    const optimizedPoints: PIXI.Point[] = [];
    const optimizedPressures: number[] = [];
    const optimizedTimestamps: number[] = [];
    
    const epsilon = 2.0; // 許容誤差
    
    this.simplifyStroke(
      stroke.points,
      stroke.pressures,
      stroke.timestamps,
      epsilon,
      optimizedPoints,
      optimizedPressures,
      optimizedTimestamps
    );
    
    // 最適化結果適用
    stroke.points = optimizedPoints;
    stroke.pressures = optimizedPressures;
    stroke.timestamps = optimizedTimestamps;
    stroke.smoothed = true;
    
    console.log(`🖌️ ストローク最適化: ${originalLength} → ${stroke.points.length} 点`);
  }

  /**
   * ストローク簡略化・Douglas-Peucker簡易実装
   */
  private simplifyStroke(
    points: PIXI.Point[],
    pressures: number[],
    timestamps: number[],
    epsilon: number,
    resultPoints: PIXI.Point[],
    resultPressures: number[],
    resultTimestamps: number[]
  ): void {
    if (points.length <= 2) {
      resultPoints.push(...points);
      resultPressures.push(...pressures);
      resultTimestamps.push(...timestamps);
      return;
    }
    
    // 簡易実装：一定間隔で点を間引き
    const step = Math.max(1, Math.floor(points.length / 200)); // 最大200点
    
    for (let i = 0; i < points.length; i += step) {
      resultPoints.push(points[i]);
      resultPressures.push(pressures[i]);
      resultTimestamps.push(timestamps[i]);
    }
    
    // 最後の点は必ず含める
    if (resultPoints[resultPoints.length - 1] !== points[points.length - 1]) {
      resultPoints.push(points[points.length - 1]);
      resultPressures.push(pressures[pressures.length - 1]);
      resultTimestamps.push(timestamps[timestamps.length - 1]);
    }
  }

  /**
   * ストロークをレイヤーに確定描画
   */
  private commitStrokeToLayer(stroke: IStrokeData): void {
    if (stroke.points.length < 2) return;
    
    // 現在レイヤーに描画
    this.currentLayer.lineStyle({
      width: stroke.size,
      color: stroke.color,
      alpha: this.currentTool.opacity,
      cap: PIXI.LINE_CAP.ROUND,
      join: PIXI.LINE_JOIN.ROUND
    });
    
    // 描画パス構築
    this.currentLayer.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    if (stroke.smoothed && this.settings.performance.useQuadraticCurves) {
      // スムージング済み・曲線描画
      this.drawSmoothPath(stroke);
    } else {
      // 直線描画
      for (let i = 1; i < stroke.points.length; i++) {
        this.currentLayer.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
    }
  }

  /**
   * スムーズパス描画・曲線補間
   */
  private drawSmoothPath(stroke: IStrokeData): void {
    const points = stroke.points;
    
    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      
      // 中点計算
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      // 二次ベジェ曲線
      this.currentLayer.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    
    // 最後の点
    const lastPoint = points[points.length - 1];
    this.currentLayer.lineTo(lastPoint.x, lastPoint.y);
  }

  /**
   * ツール変更処理
   */
  private onToolChange(event: IEventData['tool:change']): void {
    this.currentTool.name = event.tool;
    
    // ツール別設定適用
    switch (event.tool) {
      case 'pen':
        this.applyPenSettings();
        break;
      case 'brush':
        this.applyBrushSettings();
        break;
      case 'eraser':
        this.applyEraserSettings();
        break;
      case 'fill':
        this.applyFillSettings();
        break;
      case 'shape':
        this.applyShapeSettings();
        break;
    }
    
    console.log(`🖌️ ツール変更: ${event.tool}`);
  }

  /**
   * ツールモード変更処理・BLEND_MODES修正
   */
  private onToolModeChange(event: any): void {
    if (event.blendMode !== undefined) {
      // DRAWING_CONSTANTS.BLEND_MODES使用に修正
      this.currentTool.blendMode = DRAWING_CONSTANTS.BLEND_MODES.NORMAL;
      this.currentLayer.blendMode = this.currentTool.blendMode;
    }
    
    if (event.size !== undefined) {
      this.currentTool.size = event.size;
    }
    
    if (event.opacity !== undefined) {
      this.currentTool.opacity = event.opacity;
    }
    
    console.log('🖌️ ツールモード更新:', this.currentTool);
  }

  /**
   * ペンツール設定適用
   */
  private applyPenSettings(): void {
    this.currentTool.size = DRAWING_CONSTANTS.PEN_TOOL.DEFAULT_SIZE;
    this.currentTool.opacity = DRAWING_CONSTANTS.PEN_TOOL.DEFAULT_OPACITY;
    this.currentTool.blendMode = DRAWING_CONSTANTS.BLEND_MODES.NORMAL;
    
    // スムージング設定
    this.settings.smoothing.factor = DRAWING_CONSTANTS.PEN_TOOL.SMOOTHING_FACTOR;
    this.settings.smoothing.minDistance = DRAWING_CONSTANTS.PEN_TOOL.MIN_DISTANCE;
  }

  /**
   * ブラシツール設定適用
   */
  private applyBrushSettings(): void {
    this.currentTool.size = DRAWING_CONSTANTS.BRUSH_TOOL.DEFAULT_SIZE;
    this.currentTool.opacity = DRAWING_CONSTANTS.BRUSH_TOOL.DEFAULT_OPACITY;
    this.currentTool.blendMode = DRAWING_CONSTANTS.BLEND_MODES.NORMAL;
    
    // スムージング設定・ブラシは強め
    this.settings.smoothing.factor = DRAWING_CONSTANTS.BRUSH_TOOL.SMOOTHING_FACTOR;
    this.settings.smoothing.minDistance = DRAWING_CONSTANTS.BRUSH_TOOL.MIN_DISTANCE;
  }

  /**
   * 消しゴムツール設定適用
   */
  private applyEraserSettings(): void {
    this.currentTool.size = DRAWING_CONSTANTS.ERASER_TOOL.DEFAULT_SIZE;
    this.currentTool.opacity = DRAWING_CONSTANTS.ERASER_TOOL.DEFAULT_OPACITY;
    this.currentTool.blendMode = DRAWING_CONSTANTS.BLEND_MODES.SUBTRACT; // 消去モード
  }

  /**
   * 塗りつぶしツール設定適用
   */
  private applyFillSettings(): void {
    // 塗りつぶしは線描画なし
    this.currentTool.size = 0;
    this.currentTool.opacity = 1.0;
    this.currentTool.blendMode = DRAWING_CONSTANTS.BLEND_MODES.NORMAL;
  }

  /**
   * 図形ツール設定適用
   */
  private applyShapeSettings(): void {
    this.currentTool.size = DRAWING_CONSTANTS.SHAPE_TOOL.DEFAULT_STROKE_WIDTH;
    this.currentTool.opacity = 1.0;
    this.currentTool.blendMode = DRAWING_CONSTANTS.BLEND_MODES.NORMAL;
  }

  /**
   * 設定変更処理
   */
  private onSettingsChange(event: any): void {
    if (event.smoothing !== undefined) {
      this.settings.smoothing = { ...this.settings.smoothing, ...event.smoothing };
    }
    
    if (event.performance !== undefined) {
      this.settings.performance = { ...this.settings.performance, ...event.performance };
    }
    
    if (event.quality !== undefined) {
      this.settings.quality = { ...this.settings.quality, ...event.quality };
    }
    
    console.log('🖌️ 描画設定更新:', this.settings);
  }

  /**
   * 色変更処理
   */
  private onColorChange(event: IEventData['drawing:color-change']): void {
    this.currentTool.color = event.color;
    console.log(`🖌️ 色変更: #${event.color.toString(16).padStart(6, '0')}`);
  }

  /**
   * サイズ変更処理
   */
  private onSizeChange(event: IEventData['drawing:size-change']): void {
    this.currentTool.size = Math.max(1, Math.min(200, event.size));
    console.log(`🖌️ サイズ変更: ${this.currentTool.size}px`);
  }

  /**
   * レイヤー変更処理
   */
  private onLayerChange(event: any): void {
    if (event.layerId && event.graphics) {
      this.currentLayer = event.graphics;
      console.log(`🖌️ レイヤー切り替え: ${event.layerId}`);
    }
  }

  /**
   * レイヤーブレンドモード変更
   */
  private onLayerBlendModeChange(event: any): void {
    if (event.blendMode !== undefined) {
      this.currentLayer.blendMode = event.blendMode;
      console.log(`🖌️ レイヤーブレンドモード変更: ${event.blendMode}`);
    }
  }

  /**
   * デフォルト設定作成
   */
  private createDefaultSettings(): IDrawingSettings {
    return {
      smoothing: {
        enabled: DRAWING_CONSTANTS.DRAWING_ENGINE.SMOOTHING.ENABLED,
        factor: DRAWING_CONSTANTS.DRAWING_ENGINE.SMOOTHING.FACTOR,
        minDistance: DRAWING_CONSTANTS.DRAWING_ENGINE.SMOOTHING.MIN_DISTANCE
      },
      performance: {
        maxPointsPerStroke: DRAWING_CONSTANTS.DRAWING_ENGINE.PERFORMANCE.MAX_POINTS_PER_STROKE,
        batchDrawing: DRAWING_CONSTANTS.DRAWING_ENGINE.PERFORMANCE.BATCH_DRAWING,
        useQuadraticCurves: DRAWING_CONSTANTS.DRAWING_ENGINE.PERFORMANCE.USE_QUADRATIC_CURVES
      },
      quality: {
        antialias: DRAWING_CONSTANTS.DRAWING_ENGINE.QUALITY.ANTIALIAS,
        lineJoin: DRAWING_CONSTANTS.DRAWING_ENGINE.QUALITY.LINE_JOIN,
        lineCap: DRAWING_CONSTANTS.DRAWING_ENGINE.QUALITY.LINE_CAP
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
   * 描画コンテナ取得・外部アクセス
   */
  public getDrawingContainer(): PIXI.Container {
    return this.drawingContainer;
  }

  /**
   * 現在レイヤー取得
   */
  public getCurrentLayer(): PIXI.Graphics {
    return this.currentLayer;
  }

  /**
   * 現在設定取得
   */
  public getCurrentSettings(): IDrawingSettings {
    return { ...this.settings };
  }

  /**
   * 統計情報取得
   */
  public getStats(): IDrawingStats {
    return { ...this.stats };
  }

  /**
   * 全クリア・リセット
   */
  public clear(): void {
    this.currentLayer.clear();
    this.tempGraphics.clear();
    this.stats = this.createEmptyStats();
    this.strokeId = 0;
    
    console.log('🖌️ 描画クリア実行');
  }

  /**
   * リソース解放・終了処理
   */
  public destroy(): void {
    console.log('🖌️ DrawingEngine終了処理開始...');
    
    // 描画停止
    this.isDrawing = false;
    this.currentStroke = null;
    
    // Graphics破棄
    this.tempGraphics.destroy();
    this.currentLayer.destroy();
    this.drawingContainer.destroy();
    
    // バッファクリア
    this.pointBuffer = [];
    
    console.log('🖌️ DrawingEngine終了処理完了');
  }
}