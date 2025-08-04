// DrawingEngine.ts - 描画エンジン・Graphics統合・ツール制御 (簡略版)
// PixiJS Graphics最適化・スムージング・手ブレ軽減

import * as PIXI from 'pixi.js';
import type { EventBus } from './EventBus.js';

/**
 * ストロークデータ・描画情報
 */
interface IStrokeData {
  id: string;
  points: PIXI.Point[];
  pressures: number[];
  color: number;
  size: number;
  tool: string;
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
  quality: {
    antialias: boolean;
    lineJoin: 'round' | 'bevel' | 'miter';
    lineCap: 'round' | 'square' | 'butt';
  };
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
  
  // 現在の描画設定
  private currentColor = 0x800000; // ふたばマルーン
  private currentSize = 5;
  private currentTool = 'pen';
  
  // 設定
  private settings: IDrawingSettings;

  constructor(app: PIXI.Application, eventBus: EventBus) {
    this.app = app;
    this.eventBus = eventBus;
    
    // 初期設定
    this.settings = this.createDefaultSettings();
    
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
    // ツール変更
    this.eventBus.on('tool:activated', (data) => {
      this.currentTool = data.tool;
      console.log(`🖌️ ツール変更: ${this.currentTool}`);
    });

    // 色変更
    this.eventBus.on('ui:color-select', (data) => {
      this.currentColor = data.color;
      console.log(`🖌️ 色変更: ${this.currentColor.toString(16)}`);
    });

    // ブラシサイズ変更
    this.eventBus.on('brush:sizeChange', (data) => {
      this.currentSize = data.data.size;
      console.log(`🖌️ サイズ変更: ${this.currentSize}`);
    });

    // 描画イベント
    this.eventBus.on('drawing:stroke-start', (data) => {
      this.startStroke(data.x, data.y, data.pressure || 1.0);
    });

    this.eventBus.on('drawing:stroke-move', (data) => {
      this.continueStroke(data.x, data.y, data.pressure || 1.0);
    });

    this.eventBus.on('drawing:stroke-end', (data) => {
      this.endStroke();
    });

    // 消しゴムイベント
    this.eventBus.on('drawing:erase-start', (data) => {
      this.startErase(data.x, data.y, data.pressure || 1.0);
    });

    this.eventBus.on('drawing:erase-move', (data) => {
      this.continueErase(data.x, data.y, data.pressure || 1.0);
    });

    this.eventBus.on('drawing:erase-end', (data) => {
      this.endErase();
    });
  }

  /**
   * ストローク開始・ペン描画
   */
  private startStroke(x: number, y: number, pressure: number): void {
    if (this.isDrawing) return;

    this.isDrawing = true;
    this.strokeId++;

    // 新しいストロークデータ作成
    this.currentStroke = {
      id: `stroke_${this.strokeId}`,
      points: [new PIXI.Point(x, y)],
      pressures: [pressure],
      color: this.currentColor,
      size: this.currentSize,
      tool: this.currentTool
    };

    // 一時Graphics設定
    this.tempGraphics.clear();
    this.tempGraphics.lineStyle({
      width: this.currentSize * pressure,
      color: this.currentColor,
      cap: this.settings.quality.lineCap,
      join: this.settings.quality.lineJoin
    });

    this.tempGraphics.moveTo(x, y);

    console.log(`🖌️ ストローク開始: (${x}, ${y}) pressure=${pressure.toFixed(3)}`);
  }

  /**
   * ストローク継続・ペン描画
   */
  private continueStroke(x: number, y: number, pressure: number): void {
    if (!this.isDrawing || !this.currentStroke) return;

    // ポイント追加
    this.currentStroke.points.push(new PIXI.Point(x, y));
    this.currentStroke.pressures.push(pressure);

    // 線を描画
    this.tempGraphics.lineStyle({
      width: this.currentSize * pressure,
      color: this.currentColor,
      cap: this.settings.quality.lineCap,
      join: this.settings.quality.lineJoin
    });

    this.tempGraphics.lineTo(x, y);
  }

  /**
   * ストローク終了・ペン描画
   */
  private endStroke(): void {
    if (!this.isDrawing || !this.currentStroke) return;

    // 一時Graphicsを本レイヤーに転写
    this.transferTempToLayer();

    // 状態リセット
    this.isDrawing = false;
    this.currentStroke = null;
    this.tempGraphics.clear();

    console.log('🖌️ ストローク終了');
  }

  /**
   * 消しゴム開始
   */
  private startErase(x: number, y: number, pressure: number): void {
    if (this.isDrawing) return;

    this.isDrawing = true;
    
    // 消しゴム設定（穴を開ける）
    this.tempGraphics.clear();
    this.tempGraphics.beginFill(0x000000); // 黒で塗りつぶし
    this.tempGraphics.drawCircle(x, y, this.currentSize * pressure);
    this.tempGraphics.endFill();

    // ブレンドモードを減算に設定
    this.tempGraphics.blendMode = PIXI.BLEND_MODES.ERASE;

    console.log(`🖌️ 消しゴム開始: (${x}, ${y})`);
  }

  /**
   * 消しゴム継続
   */
  private continueErase(x: number, y: number, pressure: number): void {
    if (!this.isDrawing) return;

    // 消しゴムの軌跡を描画
    this.tempGraphics.drawCircle(x, y, this.currentSize * pressure);
  }

  /**
   * 消しゴム終了
   */
  private endErase(): void {
    if (!this.isDrawing) return;

    // 一時Graphicsを本レイヤーに転写
    this.transferTempToLayer();

    // 状態リセット
    this.isDrawing = false;
    this.tempGraphics.clear();
    this.tempGraphics.blendMode = PIXI.BLEND_MODES.NORMAL;

    console.log('🖌️ 消しゴム終了');
  }

  /**
   * 一時Graphicsを本レイヤーに転写
   */
  private transferTempToLayer(): void {
    if (!this.tempGraphics || this.tempGraphics.geometry.graphicsData.length === 0) {
      return;
    }

    // 現在のレイヤーに描画内容をコピー
    const tempTexture = this.app.renderer.generateTexture(this.tempGraphics);
    const sprite = new PIXI.Sprite(tempTexture);
    
    // スプライトとして追加（パフォーマンス向上）
    this.currentLayer.addChild(sprite);
    
    // 一時Graphics クリア
    this.tempGraphics.clear();
  }

  /**
   * レイヤークリア
   */
  public clearLayer(): void {
    this.currentLayer.clear();
    this.currentLayer.removeChildren();
    this.tempGraphics.clear();
    console.log('🖌️ レイヤークリア');
  }

  /**
   * 全体クリア
   */
  public clearAll(): void {
    this.clearLayer();
    this.isDrawing = false;
    this.currentStroke = null;
    console.log('🖌️ 全体クリア');
  }

  /**
   * 描画状態取得
   */
  public isCurrentlyDrawing(): boolean {
    return this.isDrawing;
  }

  /**
   * 現在の設定取得
   */
  public getCurrentSettings() {
    return {
      color: this.currentColor,
      size: this.currentSize,
      tool: this.currentTool,
      isDrawing: this.isDrawing
    };
  }

  /**
   * キャンバス画像エクスポート・Phase2準備
   */
  public exportImage(): string {
    const texture = this.app.renderer.generateTexture(this.drawingContainer);
    const canvas = this.app.renderer.extract.canvas(texture);
    return canvas.toDataURL('image/png');
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
      quality: {
        antialias: true,
        lineJoin: 'round',
        lineCap: 'round'
      }
    };
  }

  /**
   * 設定更新
   */
  public updateSettings(newSettings: Partial<IDrawingSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('🖌️ 描画設定更新:', newSettings);
  }

  /**
   * デバッグ情報取得
   */
  public getDebugInfo() {
    return {
      isDrawing: this.isDrawing,
      currentTool: this.currentTool,
      currentColor: this.currentColor,
      currentSize: this.currentSize,
      strokeId: this.strokeId,
      settings: this.settings,
      containerChildren: this.drawingContainer.children.length,
      layerChildren: this.currentLayer.children.length
    };
  }

  /**
   * 破棄処理
   */
  public destroy(): void {
    try {
      // イベントリスナー削除
      this.eventBus.off('tool:activated');
      this.eventBus.off('ui:color-select');
      this.eventBus.off('brush:sizeChange');
      this.eventBus.off('drawing:stroke-start');
      this.eventBus.off('drawing:stroke-move');
      this.eventBus.off('drawing:stroke-end');
      this.eventBus.off('drawing:erase-start');
      this.eventBus.off('drawing:erase-move');
      this.eventBus.off('drawing:erase-end');

      // Graphics削除
      this.currentLayer?.destroy({ children: true });
      this.tempGraphics?.destroy();
      this.drawingContainer?.destroy({ children: true });

      // 参照クリア
      this.currentStroke = null;

      console.log('✅ DrawingEngine破棄完了');
    } catch (error) {
      console.error('⚠️ DrawingEngine破棄エラー:', error);
    }
  }
}