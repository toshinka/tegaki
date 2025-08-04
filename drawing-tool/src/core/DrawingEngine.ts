// DrawingEngine.ts - 描画エンジン・Graphics統合・ツール制御
// PixiJS Graphics最適化・スムージング・手ブレ軽減

import * as PIXI from 'pixi.js';
import type { EventBus, IEventData } from './EventBus.js';

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
 * 描画ツールタイプ
 */
export type DrawingTool = 'pen' | 'brush' | 'eraser' | 'pencil';

/**
 * 描画イベントデータ
 */
interface IDrawingEventData extends IEventData {
  type: 'drawing:start' | 'drawing:move' | 'drawing:end' | 'drawing:clear' | 'drawing:settings';
  data: any;
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
  
  // 描画設定
  private currentTool: DrawingTool = 'pen';
  private currentColor = 0x800000; // ふたば色マルーン
  private currentSize = 5;
  private currentOpacity = 1.0;
  
  // 設定・統計
  private settings: IDrawingSettings;
  private stats: IDrawingStats;
  
  // スムージング用バッファ
  private pointBuffer: { point: PIXI.Point; pressure: number; timestamp: number }[] = [];
  private readonly bufferSize = 5;

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
    // 描画開始
    this.eventBus.on('input:drawStart', (data) => {
      this.startDrawing(data.x, data.y, data.pressure || 1.0);
    });

    // 描画継続
    this.eventBus.on('input:drawMove', (data) => {
      if (this.isDrawing) {
        this.continueDrawing(data.x, data.y, data.pressure || 1.0);
      }
    });

    // 描画終了
    this.eventBus.on('input:drawEnd', (data) => {
      if (this.isDrawing) {
        this.endDrawing(data.x, data.y, data.pressure || 1.0);
      }
    });

    // ツール変更
    this.eventBus.on('tool:change', (data) => {
      this.setTool(data.tool);
    });

    // 色変更
    this.eventBus.on('color:change', (data) => {
      this.setColor(data.color);
    });

    // サイズ変更
    this.eventBus.on('brush:sizeChange', (data) => {
      this.setSize(data.size);
    });

    // 透明度変更
    this.eventBus.on('brush:opacityChange', (data) => {
      this.setOpacity(data.opacity);
    });

    // キャンバスクリア
    this.eventBus.on('canvas:clear', () => {
      this.clearCanvas();
    });
  }

  /**
   * 描画開始処理
   */
  private startDrawing(x: number, y: number, pressure: number): void {
    if (this.isDrawing) return;

    this.isDrawing = true;
    const timestamp = performance.now();
    const strokeId = `stroke_${++this.strokeId}_${timestamp}`;

    // 新しいストローク作成
    this.currentStroke = {
      id: strokeId,
      points: [new PIXI.Point(x, y)],
      pressures: [pressure],
      timestamps: [timestamp],
      color: this.currentColor,
      size: this.currentSize,
      tool: this.currentTool,
      smoothed: this.settings.smoothing.enabled
    };

    // バッファクリア・初期点追加
    this.pointBuffer = [];
    this.addPointToBuffer(x, y, pressure, timestamp);

    // 描画開始通知
    this.eventBus.emit('drawing:start', {
      type: 'drawing:start',
      timestamp,
      data: { strokeId, tool: this.currentTool, x, y }
    });

    // 統計更新
    this.stats.totalStrokes++;
    this.stats.lastDrawTime = timestamp;

    console.log(`🖌️ 描画開始: ${strokeId} at (${x}, ${y})`);
  }

  /**
   * 描画継続処理・スムージング適用
   */
  private continueDrawing(x: number, y: number, pressure: number): void {
    if (!this.isDrawing || !this.currentStroke) return;

    const timestamp = performance.now();
    
    // 距離チェック・最小描画距離
    const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
    const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
    
    if (distance < this.settings.smoothing.minDistance) {
      return; // 距離が小さすぎる場合スキップ
    }

    // ポイント追加
    this.currentStroke.points.push(new PIXI.Point(x, y));
    this.currentStroke.pressures.push(pressure);
    this.currentStroke.timestamps.push(timestamp);

    // バッファに追加・スムージング処理
    this.addPointToBuffer(x, y, pressure, timestamp);
    
    if (this.settings.smoothing.enabled && this.pointBuffer.length >= 3) {
      this.drawSmoothedSegment();
    } else {
      this.drawDirectLine(lastPoint, new PIXI.Point(x, y), pressure);
    }

    // 統計更新
    this.stats.totalPoints++;
  }

  /**
   * 描画終了処理・ストローク確定
   */
  private endDrawing(x: number, y: number, pressure: number): void {
    if (!this.isDrawing || !this.currentStroke) return;

    const timestamp = performance.now();

    // 最終点追加
    this.currentStroke.points.push(new PIXI.Point(x, y));
    this.currentStroke.pressures.push(pressure);
    this.currentStroke.timestamps.push(timestamp);

    // 残りのバッファポイント処理
    this.flushPointBuffer();

    // 一時Graphicsから本レイヤーに転送
    this.commitStroke();

    // 描画時間計算
    const drawingTime = timestamp - this.stats.lastDrawTime;
    this.stats.drawingTime += drawingTime;
    this.stats.averageStrokeLength = this.stats.totalPoints / this.stats.totalStrokes;

    // 描画終了通知
    this.eventBus.emit('drawing:end', {
      type: 'drawing:end',
      timestamp,
      data: { 
        strokeId: this.currentStroke.id, 
        points: this.currentStroke.points.length,
        duration: drawingTime
      }
    });

    // 状態リセット
    this.isDrawing = false;
    this.currentStroke = null;
    this.pointBuffer = [];

    console.log(`🖌️ 描画終了: ${drawingTime.toFixed(2)}ms, ${this.stats.totalPoints}点`);
  }

  /**
   * バッファポイント追加・サイズ管理
   */
  private addPointToBuffer(x: number, y: number, pressure: number, timestamp: number): void {
    this.pointBuffer.push({
      point: new PIXI.Point(x, y),
      pressure,
      timestamp
    });

    // バッファサイズ制限
    if (this.pointBuffer.length > this.bufferSize) {
      this.pointBuffer.shift();
    }
  }

  /**
   * スムージング描画・ベジエ曲線
   */
  private drawSmoothedSegment(): void {
    if (this.pointBuffer.length < 3) return;

    const p0 = this.pointBuffer[this.pointBuffer.length - 3];
    const p1 = this.pointBuffer[this.pointBuffer.length - 2];
    const p2 = this.pointBuffer[this.pointBuffer.length - 1];

    // ベジエ曲線制御点計算
    const smoothing = this.settings.smoothing.factor;
    const cp1x = p1.point.x + (p2.point.x - p0.point.x) * smoothing * 0.2;
    const cp1y = p1.point.y + (p2.point.y - p0.point.y) * smoothing * 0.2;

    // 筆圧による線幅計算
    const size = this.calculateLineWidth(p1.pressure);
    
    // Graphics描画
    this.tempGraphics.lineStyle({
      width: size,
      color: this.currentColor,
      alpha: this.currentOpacity,
      cap: this.settings.quality.lineCap,
      join: this.settings.quality.lineJoin
    });

    if (this.settings.performance.useQuadraticCurves) {
      this.tempGraphics.moveTo(p0.point.x, p0.point.y);
      this.tempGraphics.quadraticCurveTo(cp1x, cp1y, p1.point.x, p1.point.y);
    } else {
      this.tempGraphics.moveTo(p0.point.x, p0.point.y);
      this.tempGraphics.lineTo(p1.point.x, p1.point.y);
    }
  }

  /**
   * 直線描画・スムージングなし
   */
  private drawDirectLine(from: PIXI.Point, to: PIXI.Point, pressure: number): void {
    const size = this.calculateLineWidth(pressure);
    
    this.tempGraphics.lineStyle({
      width: size,
      color: this.currentColor,
      alpha: this.currentOpacity,
      cap: this.settings.quality.lineCap,
      join: this.settings.quality.lineJoin
    });

    this.tempGraphics.moveTo(from.x, from.y);
    this.tempGraphics.lineTo(to.x, to.y);
  }

  /**
   * バッファ残り処理・描画完了
   */
  private flushPointBuffer(): void {
    while (this.pointBuffer.length >= 2) {
      const p1 = this.pointBuffer[0];
      const p2 = this.pointBuffer[1];
      
      this.drawDirectLine(p1.point, p2.point, p1.pressure);
      this.pointBuffer.shift();
    }
  }

  /**
   * ストローク確定・レイヤーに転送
   */
  private commitStroke(): void {
    if (!this.currentStroke) return;

    // tempGraphicsの内容をcurrentLayerに転送
    const texture = this.app.renderer.generateTexture(this.tempGraphics);
    const sprite = new PIXI.Sprite(texture);
    
    this.currentLayer.addChild(sprite);
    
    // 一時Graphics クリア
    this.tempGraphics.clear();
    
    console.log(`🖌️ ストローク確定: ${this.currentStroke.id}`);
  }

  /**
   * 筆圧による線幅計算
   */
  private calculateLineWidth(pressure: number): number {
    const baseSizeMultiplier = this.currentTool === 'pen' ? 1.0 : 
                              this.currentTool === 'brush' ? 1.5 :
                              this.currentTool === 'pencil' ? 0.8 : 1.0;
    
    return Math.max(1, this.currentSize * pressure * baseSizeMultiplier);
  }

  /**
   * キャンバスクリア
   */
  public clearCanvas(): void {
    this.currentLayer.clear();
    this.tempGraphics.clear();
    
    // 統計リセット
    this.stats = this.createEmptyStats();
    
    this.eventBus.emit('drawing:clear', {
      type: 'drawing:clear',
      timestamp: performance.now(),
      data: {}
    });
    
    console.log('🖌️ キャンバスクリア完了');
  }

  /**
   * ツール設定
   */
  public setTool(tool: DrawingTool): void {
    this.currentTool = tool;
    console.log(`🖌️ ツール変更: ${tool}`);
  }

  /**
   * 色設定
   */
  public setColor(color: number): void {
    this.currentColor = color;
    console.log(`🖌️ 色変更: #${color.toString(16).padStart(6, '0')}`);
  }

  /**
   * サイズ設定
   */
  public setSize(size: number): void {
    this.currentSize = Math.max(1, Math.min(100, size));
    console.log(`🖌️ サイズ変更: ${this.currentSize}px`);
  }

  /**
   * 透明度設定
   */
  public setOpacity(opacity: number): void {
    this.currentOpacity = Math.max(0, Math.min(1, opacity));
    console.log(`🖌️ 透明度変更: ${this.currentOpacity}`);
  }

  /**
   * 設定取得
   */
  public getSettings(): IDrawingSettings {
    return { ...this.settings };
  }

  /**
   * 統計取得
   */
  public getStats(): IDrawingStats {
    return { ...this.stats };
  }

  /**
   * デフォルト設定作成
   */
  private createDefaultSettings(): IDrawingSettings {
    return {
      smoothing: {
        enabled: true,
        factor: 0.5,
        minDistance: 2
      },
      performance: {
        maxPointsPerStroke: 1000,
        batchDrawing: true,
        useQuadraticCurves: true
      },
      quality: {
        antialias: true,
        lineJoin: 'round',
        lineCap: 'round'
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
   * 破棄処理
   */
  public destroy(): void {
    this.currentLayer?.destroy();
    this.tempGraphics?.destroy();
    this.drawingContainer?.destroy();
    
    console.log('🖌️ DrawingEngine破棄完了');
  }
}