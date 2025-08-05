import * as PIXI from 'pixi.js';
import { EventBus } from './EventBus.js';
import { IEventData } from '../types/drawing.types.js';

export class DrawingEngine {
  private pixiApp: PIXI.Application;
  private eventBus: EventBus;
  private currentGraphics: PIXI.Graphics | null = null;
  private strokePoints: PIXI.Point[] = [];
  private drawingContainer: PIXI.Container;
  
  // 描画設定・参考資料のふたば色継承
  private currentColor = 0x800000; // ふたばマルーン・参考資料継承
  private currentSize = 4;
  private currentOpacity = 0.8;

  constructor(pixiApp: PIXI.Application, eventBus: EventBus) {
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
    
    // 描画用Container作成・参考資料のContainer階層継承
    this.drawingContainer = new PIXI.Container();
    this.pixiApp.stage.addChild(this.drawingContainer);
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventBus.on('drawing:start', this.startDrawing.bind(this));
    this.eventBus.on('drawing:move', this.continueDrawing.bind(this));
    this.eventBus.on('drawing:end', this.endDrawing.bind(this));
    this.eventBus.on('ui:color-change', this.onColorChange.bind(this));
  }

  private startDrawing(data: IEventData['drawing:start']): void {
    // 新しいGraphics作成・GPU最適化・参考資料継承
    this.currentGraphics = new PIXI.Graphics();
    this.strokePoints = [data.point];

    // 描画設定適用・参考資料のGPU最適化準備
    this.currentGraphics.lineStyle({
      width: this.calculateBrushSize(data.pressure),
      color: this.currentColor,
      alpha: this.currentOpacity,
      cap: PIXI.LINE_CAP.ROUND,
      join: PIXI.LINE_JOIN.ROUND
    });

    // 開始点設定
    this.currentGraphics.moveTo(data.point.x, data.point.y);
    this.drawingContainer.addChild(this.currentGraphics);
  }

  private continueDrawing(data: IEventData['drawing:move']): void {
    if (!this.currentGraphics) return;

    this.strokePoints.push(data.point);

    // スムージング適用・3点以上で処理・参考資料の滑らか描画継承
    if (this.strokePoints.length >= 3) {
      const smoothPoint = this.calculateSmoothPoint(
        this.strokePoints[this.strokePoints.length - 3],
        this.strokePoints[this.strokePoints.length - 2],
        this.strokePoints[this.strokePoints.length - 1]
      );

      // 筆圧対応・線幅動的変更・参考資料の筆圧感知継承
      this.currentGraphics.lineStyle({
        width: this.calculateBrushSize(data.pressure),
        color: this.currentColor,
        alpha: this.currentOpacity
      });

      this.currentGraphics.lineTo(smoothPoint.x, smoothPoint.y);
    } else {
      // 点が少ない場合は直線
      this.currentGraphics.lineTo(data.point.x, data.point.y);
    }
  }

  private endDrawing(data: IEventData['drawing:end']): void {
    if (!this.currentGraphics) return;

    // 最終点追加
    this.currentGraphics.lineTo(data.point.x, data.point.y);
    
    // GPU最適化・Batch処理準備・参考資料のWebGPU準備継承
    this.optimizeGraphics(this.currentGraphics);
    
    // 描画完了・リセット
    this.currentGraphics = null;
    this.strokePoints = [];
  }

  // ベジエ曲線スムージング・手ブレ軽減・参考資料継承
  private calculateSmoothPoint(p1: PIXI.Point, p2: PIXI.Point, p3: PIXI.Point): PIXI.Point {
    const smoothFactor = 0.5;
    return new PIXI.Point(
      p2.x + (p3.x - p1.x) * smoothFactor * 0.25,
      p2.y + (p3.y - p1.y) * smoothFactor * 0.25
    );
  }

  // 筆圧対応サイズ計算・参考資料の自然な太さ変化継承
  private calculateBrushSize(pressure: number): number {
    const minSize = this.currentSize * 0.3;
    const maxSize = this.currentSize * 1.5;
    return minSize + (maxSize - minSize) * pressure;
  }

  // Graphics最適化・GPU効率化・参考資料の性能最適化継承
  private optimizeGraphics(graphics: PIXI.Graphics): void {
    // バッチング最適化
    graphics.finishPoly();
    
    // 複雑度チェック・簡略化
    if (this.strokePoints.length > 500) {
      this.simplifyStroke();
    }
  }

  // ストローク簡略化・性能最適化
  private simplifyStroke(): void {
    const simplified: PIXI.Point[] = [];
    
    for (let i = 0; i < this.strokePoints.length; i += 2) {
      simplified.push(this.strokePoints[i]);
    }

    this.strokePoints = simplified;
  }

  // 色変更イベント処理・参考資料のリアルタイム反映継承
  private onColorChange(data: IEventData['ui:color-change']): void {
    this.currentColor = data.color;
  }

  // 公開設定メソッド
  public setBrushSize(size: number): void {
    this.currentSize = Math.max(1, Math.min(200, size));
  }

  public setOpacity(opacity: number): void {
    this.currentOpacity = Math.max(0, Math.min(1, opacity));
  }

  public getCurrentColor(): number {
    return this.currentColor;
  }

  public destroy(): void {
    if (this.drawingContainer) {
      this.drawingContainer.destroy({ children: true });
    }
  }
}