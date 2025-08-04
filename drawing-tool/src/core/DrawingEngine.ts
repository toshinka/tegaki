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