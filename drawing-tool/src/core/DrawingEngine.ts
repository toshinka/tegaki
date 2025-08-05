// DrawingEngine.ts - 描画エンジン・Graphics統合・ツール制御
// PixiJS Graphics最適化・スムージング・手ブレ軽減・ツールイベント対応

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
  opacity: number;
  tool: string;
  toolType: string;
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
 * ツールモード設定
 */
interface IToolMode {
  type: 'pen' | 'brush' | 'eraser' | 'fill' | 'shape';
  settings: any;
  blendMode?: PIXI.BlendModes;
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
  
  // ツールモード
  private currentToolMode: IToolMode = {
    type: 'pen',
    settings: { size: 4, color: 0x800000, opacity: 0.8 }
  };
  
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
   * イベントリスナー設定・描画制御・ツールイベント対応
   */
  private setupEventListeners(): void {
    // 基本描画イベント
    this.eventBus.on('drawing:start', (data) => this.onDrawingStart(data));
    this.eventBus.on('drawing:move', (data) => this.onDrawingMove(data));
    this.eventBus.on('drawing:end', (data) => this.onDrawingEnd(data));

    // ツールモードイベント
    this.eventBus.on('tool:pen-mode', (data) => this.onToolModeChange('pen', data));
    this.eventBus.on('tool:brush-mode', (data) => this.onToolModeChange('brush', data));
    this.eventBus.on('tool:eraser-mode', (data) => this.onToolModeChange('eraser', data));
    this.eventBus.on('tool:fill-mode', (data) => this.onToolModeChange('fill', data));
    this.eventBus.on('tool:shape-mode', (data) => this.onToolModeChange('shape', data));

    // 塗りつぶしイベント
    this.eventBus.on('tool:flood-fill', (data) => this.onFloodFill(data));

    // 図形イベント
    this.eventBus.on('tool:shape-preview', (data) => this.onShapePreview(data));
    this.eventBus.on('tool:shape-create', (data) => this.onShapeCreate(data));

    // レイヤーイベント
    this.eventBus.on('layer:change', (data) => this.onLayerChange(data));

    console.log('🖌️ DrawingEngine イベントリスナー設定完了');
  }

  /**
   * ツールモード変更処理
   */
  private onToolModeChange(toolType: IToolMode['type'], data: { enabled: boolean; settings: any }): void {
    if (data.enabled) {
      this.currentToolMode = {
        type: toolType,
        settings: data.settings
      };

      // ツール別ブレンドモード設定
      switch (toolType) {
        case 'eraser':
          this.currentToolMode.blendMode = PIXI.BlendModes.ERASE;
          break;
        case 'brush':
          this.currentToolMode.blendMode = PIXI.BlendModes.NORMAL;
          break;
        default:
          this.currentToolMode.blendMode = PIXI.BlendModes.NORMAL;
      }

      console.log(`🖌️ ツールモード変更: ${toolType}`, data.settings);
    }
  }

  /**
   * 描画開始処理・ツール対応
   */
  private onDrawingStart(data: IEventData['drawing:start'] & { toolType?: string; settings?: any }): void {
    if (this.isDrawing) return;

    this.isDrawing = true;
    this.strokeId++;

    // ツール設定適用
    const toolSettings = data.settings || this.currentToolMode.settings;
    
    // ストロークデータ作成
    this.currentStroke = {
      id: `stroke_${this.strokeId}`,
      points: [new PIXI.Point(data.x, data.y)],
      pressures: [data.pressure || 1.0],
      timestamps: [Date.now()],
      color: toolSettings.color || 0x800000,
      size: toolSettings.size || 4,
      opacity: toolSettings.opacity || 0.8,
      tool: this.currentToolMode.type,
      toolType: data.toolType || this.currentToolMode.type,
      smoothed: false
    };

    // 一時描画開始
    this.tempGraphics.clear();
    this.setupGraphicsStyle(this.tempGraphics, this.currentStroke);
    this.tempGraphics.moveTo(data.x, data.y);

    // 統計更新
    this.stats.totalStrokes++;
    this.stats.lastDrawTime = Date.now();

    console.log(`🖌️ 描画開始: ${this.currentStroke.tool} at (${data.x}, ${data.y})`);
  }

  /**
   * 描画継続処理・スムージング・ツール対応
   */
  private onDrawingMove(data: IEventData['drawing:move'] & { toolType?: string; settings?: any }): void {
    if (!this.isDrawing || !this.currentStroke) return;

    const point = new PIXI.Point(data.x, data.y);
    const pressure = data.pressure || 1.0;
    const timestamp = Date.now();

    // ツール設定動的更新（ブラシなど）
    if (data.settings) {
      this.currentStroke.size = data.settings.size || this.currentStroke.size;
      this.currentStroke.opacity = data.settings.opacity || this.currentStroke.opacity;
    }

    // 最小距離チェック
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

    // 描画更新
    this.updateTempDrawing();

    // 統計更新
    this.stats.totalPoints++;
  }

  /**
   * 描画終了処理・確定
   */
  private onDrawingEnd(data: IEventData['drawing:end'] & { toolType?: string; settings?: any }): void {
    if (!this.isDrawing || !this.currentStroke) return;

    // 最終ポイント追加
    const finalPoint = new PIXI.Point(data.x, data.y);
    this.currentStroke.points.push(finalPoint);
    this.currentStroke.pressures.push(data.pressure || 1.0);
    this.currentStroke.timestamps.push(Date.now());

    // スムージング適用
    if (this.settings.smoothing.enabled && this.currentStroke.points.length > 2) {
      this.applySmoothingToStroke(this.currentStroke);
    }

    // 確定描画
    this.commitStrokeToLayer(this.currentStroke);

    // クリーンアップ
    this.tempGraphics.clear();
    this.pointBuffer = [];
    this.isDrawing = false;
    this.currentStroke = null;

    // 統計更新
    this.stats.drawingTime += Date.now() - this.stats.lastDrawTime;

    console.log(`🖌️ 描画終了: ストローク確定`);
  }

  /**
   * Graphics スタイル設定
   */
  private setupGraphicsStyle(graphics: PIXI.Graphics, stroke: IStrokeData): void {
    graphics.lineStyle({
      width: stroke.size,
      color: stroke.color,
      alpha: stroke.opacity,
      cap: this.settings.quality.lineCap,
      join: this.settings.quality.lineJoin
    });

    // ツール別ブレンドモード
    if (this.currentToolMode.blendMode) {
      graphics.blendMode = this.currentToolMode.blendMode;
    }
  }

  /**
   * 一時描画更新
   */
  private updateTempDrawing(): void {
    if (!this.currentStroke || this.currentStroke.points.length < 2) return;

    this.tempGraphics.clear();
    this.setupGraphicsStyle(this.tempGraphics, this.currentStroke);

    const points = this.currentStroke.points;
    this.tempGraphics.moveTo(points[0].x, points[0].y);

    // 滑らかな曲線描画
    if (this.settings.performance.useQuadraticCurves && points.length > 2) {
      for (let i = 1; i < points.length - 1; i++) {
        const currentPoint = points[i];
        const nextPoint = points[i + 1];
        const controlX = (currentPoint.x + nextPoint.x) / 2;
        const controlY = (currentPoint.y + nextPoint.y) / 2;
        this.tempGraphics.quadraticCurveTo(currentPoint.x, currentPoint.y, controlX, controlY);
      }
      // 最後の点
      const lastPoint = points[points.length - 1];
      this.tempGraphics.lineTo(lastPoint.x, lastPoint.y);
    } else {
      // 直線描画
      for (let i = 1; i < points.length; i++) {
        this.tempGraphics.lineTo(points[i].x, points[i].y);
      }
    }
  }

  /**
   * ストロークスムージング適用
   */
  private applySmoothingToStroke(stroke: IStrokeData): void {
    if (stroke.points.length < 3) return;

    const smoothedPoints: PIXI.Point[] = [stroke.points[0]]; // 最初の点はそのまま
    const factor = this.settings.smoothing.factor;

    for (let i = 1; i < stroke.points.length - 1; i++) {
      const prev = stroke.points[i - 1];
      const curr = stroke.points[i];
      const next = stroke.points[i + 1];

      // 加重平均でスムージング
      const smoothedX = curr.x * (1 - factor) + (prev.x + next.x) * factor * 0.5;
      const smoothedY = curr.y * (1 - factor) + (prev.y + next.y) * factor * 0.5;

      smoothedPoints.push(new PIXI.Point(smoothedX, smoothedY));
    }

    smoothedPoints.push(stroke.points[stroke.points.length - 1]); // 最後の点はそのまま
    stroke.points = smoothedPoints;
    stroke.smoothed = true;
  }

  /**
   * ストロークをレイヤーに確定
   */
  private commitStrokeToLayer(stroke: IStrokeData): void {
    this.setupGraphicsStyle(this.currentLayer, stroke);

    const points = stroke.points;
    if (points.length === 0) return;

    this.currentLayer.moveTo(points[0].x, points[0].y);

    if (this.settings.performance.useQuadraticCurves && points.length > 2) {
      for (let i = 1; i < points.length - 1; i++) {
        const currentPoint = points[i];
        const nextPoint = points[i + 1];
        const controlX = (currentPoint.x + nextPoint.x) / 2;
        const controlY = (currentPoint.y + nextPoint.y) / 2;
        this.currentLayer.quadraticCurveTo(currentPoint.x, currentPoint.y, controlX, controlY);
      }
      this.currentLayer.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    } else {
      for (let i = 1; i < points.length; i++) {
        this.currentLayer.lineTo(points[i].x, points[i].y);
      }
    }
  }

  /**
   * 塗りつぶし処理（簡易実装）
   */
  private onFloodFill(data: { x: number; y: number; color: number; tolerance: number; opacity: number }): void {
    console.log(`🖌️ 塗りつぶし実行: (${data.x}, ${data.y}) 色:${data.color.toString(16)}`);
    
    // Phase2では簡易実装：クリック位置に円形塗りつぶし
    this.currentLayer.beginFill(data.color, data.opacity);
    this.currentLayer.drawCircle(data.x, data.y, 20);
    this.currentLayer.endFill();
    
    // TODO: Phase3で本格的なフラッドフィルアルゴリズム実装
  }

  /**
   * 図形プレビュー処理
   */
  private onShapePreview(data: any): void {
    if (data.action === 'clear') {
      this.tempGraphics.clear();
      return;
    }

    if (data.action === 'update') {
      this.tempGraphics.clear();
      this.drawShape(this.tempGraphics, data.shapeType, data.data, data.settings);
    }
  }

  /**
   * 図形作成処理
   */
  private onShapeCreate(data: any): void {
    this.drawShape(this.currentLayer, data.shapeType, data.data, data.settings);
  }

  /**
   * 図形描画共通処理
   */
  private drawShape(graphics: PIXI.Graphics, shapeType: string, data: any, settings: any): void {
    graphics.lineStyle({
      width: settings.strokeWidth || 2,
      color: settings.strokeColor || 0x800000,
      alpha: settings.opacity || 1.0
    });

    if (settings.fillEnabled) {
      graphics.beginFill(settings.fillColor || 0x000000, settings.opacity || 1.0);
    }

    switch (shapeType) {
      case 'rectangle':
        if (settings.cornerRadius > 0) {
          graphics.drawRoundedRect(data.x, data.y, data.width, data.height, settings.cornerRadius);
        } else {
          graphics.drawRect(data.x, data.y, data.width, data.height);
        }
        break;
      case 'circle':
        graphics.drawCircle(data.x, data.y, data.radius);
        break;
      case 'line':
        graphics.moveTo(data.x1, data.y1);
        graphics.lineTo(data.x2, data.y2);
        break;
      case 'arrow':
        // 矢印の線
        graphics.moveTo(data.x1, data.y1);
        graphics.lineTo(data.x2, data.y2);
        // 矢印の頭
        graphics.moveTo(data.x2, data.y2);
        graphics.lineTo(data.arrowHead.x1, data.arrowHead.y1);
        graphics.moveTo(data.x2, data.y2);
        graphics.lineTo(data.arrowHead.x2, data.arrowHead.y2);
        break;
    }

    if (settings.fillEnabled) {
      graphics.endFill();
    }
  }

  /**
   * レイヤー変更処理
   */
  private onLayerChange(data: { layerId: string; container: PIXI.Graphics }): void {
    this.currentLayer = data.container;
    console.log(`🖌️ アクティブレイヤー変更: ${data.layerId}`);
  }

  /**
   * デフォルト設定作成
   */
  private createDefaultSettings(): IDrawingSettings {
    return {
      smoothing: {
        enabled: true,
        factor: 0.3,
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
   * 空の統計データ作成
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
   * 描画コンテナ取得
   */
  public getDrawingContainer(): PIXI.Container {
    return this.drawingContainer;
  }

  /**
   * 現在のレイヤー取得
   */
  public getCurrentLayer(): PIXI.Graphics {
    return this.currentLayer;
  }

  /**
   * 統計情報取得
   */
  public getStats(): IDrawingStats {
    return { ...this.stats };
  }

  /**
   * 設定更新
   */
  public updateSettings(newSettings: Partial<IDrawingSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('🖌️ DrawingEngine設定更新:', newSettings);
  }

  /**
   * クリーンアップ
   */
  public destroy(): void {
    this.tempGraphics.destroy();
    this.drawingContainer.destroy();
    console.log('🖌️ DrawingEngine破棄完了');
  }
}