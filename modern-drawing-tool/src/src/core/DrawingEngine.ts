// src/core/DrawingEngine.ts - 描画統合・Graphics管理・スムージング・GPU最適化

import { Application, Graphics, Container, Point } from 'pixi.js';
import { EventBus, IEventData } from './EventBus.js';

export class DrawingEngine {
  private pixiApp: Application;
  private eventBus: EventBus;
  private currentGraphics: Graphics | null = null;
  private strokePoints: Point[] = [];
  private drawingContainer: Container;
  
  // 描画設定・ふたば色・基本値
  private currentColor = 0x800000; // ふたばmaroon
  private currentSize = 4;
  private currentOpacity = 0.8;
  private isDrawing = false;

  // スムージング設定・手ブレ軽減
  private smoothingEnabled = true;
  private minDistance = 2; // 最小描画間隔・手ブレ軽減
  private smoothingFactor = 0.5; // スムージング強度

  constructor(pixiApp: Application, eventBus: EventBus) {
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
    
    // 描画用Container・階層管理・Phase2レイヤー準備
    this.drawingContainer = new Container();
    this.drawingContainer.name = 'DrawingContainer';
    this.pixiApp.stage.addChild(this.drawingContainer);
    
    this.setupEventListeners();
    console.log('🎨 DrawingEngine初期化完了');
  }

  // イベントリスナー設定・描画制御・UI連携
  private setupEventListeners(): void {
    this.eventBus.on('drawing:start', this.startDrawing.bind(this));
    this.eventBus.on('drawing:move', this.continueDrawing.bind(this));
    this.eventBus.on('drawing:end', this.endDrawing.bind(this));
    this.eventBus.on('ui:color-change', this.onColorChange.bind(this));
  }

  // 描画開始・新Graphics作成・設定適用
  private startDrawing(data: IEventData['drawing:start']): void {
    console.log(`🖊️ 描画開始: ${data.pointerType}, 筆圧: ${data.pressure.toFixed(2)}`);
    
    this.currentGraphics = new Graphics();
    this.strokePoints = [data.point];
    this.isDrawing = true;

    // PixiJS Graphics設定・筆圧対応・GPU最適化
    const brushSize = this.calculateBrushSize(data.pressure);
    this.currentGraphics.lineStyle({
      width: brushSize,
      color: this.currentColor,
      alpha: this.currentOpacity,
      cap: 'round',
      join: 'round',
      alignment: 0.5 // 中心線
    });

    // 最初の点・描画開始
    this.currentGraphics.moveTo(data.point.x, data.point.y);
    
    // 点描画・極小ストローク対応
    this.currentGraphics.lineTo(data.point.x + 0.1, data.point.y + 0.1);
    
    this.drawingContainer.addChild(this.currentGraphics);
  }

  // 描画継続・スムージング・ベジエ曲線・手ブレ軽減
  private continueDrawing(data: IEventData['drawing:move']): void {
    if (!this.currentGraphics || !this.isDrawing) return;

    const newPoint = data.point;
    const lastPoint = this.strokePoints[this.strokePoints.length - 1];
    
    // 最小距離チェック・手ブレ軽減・CPU負荷軽減
    const distance = this.calculateDistance(lastPoint, newPoint);
    if (distance < this.minDistance) return;

    this.strokePoints.push(newPoint);

    // スムージング適用・ベジエ曲線・自然な線
    if (this.smoothingEnabled && this.strokePoints.length >= 3) {
      const smoothPoint = this.calculateSmoothPoint();
      this.drawSmoothLine(smoothPoint, data.pressure);
    } else {
      // 直線描画・スムージング無効時
      this.drawDirectLine(newPoint, data.pressure);
    }
  }

  // 描画終了・最終化・最適化
  private endDrawing(data: IEventData['drawing:end']): void {
    if (!this.currentGraphics || !this.isDrawing) return;

    console.log('🏁 描画終了・ストローク完成');

    // 最終点追加・完全な線
    if (this.strokePoints.length > 0) {
      const lastPoint = this.strokePoints[this.strokePoints.length - 1];
      const finalDistance = this.calculateDistance(lastPoint, data.point);
      
      if (finalDistance > 1) {
        this.currentGraphics.lineTo(data.point.x, data.point.y);
      }
    }

    // ストローク完成・リソース解放準備
    this.currentGraphics.finishPoly();
    this.isDrawing = false;
    this.currentGraphics = null;
    this.strokePoints = [];
  }

  // スムージングポイント計算・3点ベジエ・手ブレ軽減
  private calculateSmoothPoint(): Point {
    const len = this.strokePoints.length;
    if (len < 3) return this.strokePoints[len - 1];

    const p1 = this.strokePoints[len - 3];
    const p2 = this.strokePoints[len - 2];
    const p3 = this.strokePoints[len - 1];

    // ベジエ曲線補間・スムージング係数適用
    const smoothX = p2.x + (p3.x - p1.x) * this.smoothingFactor * 0.25;
    const smoothY = p2.y + (p3.y - p1.y) * this.smoothingFactor * 0.25;

    return new Point(smoothX, smoothY);
  }

  // スムーズライン描画・筆圧対応・動的線幅
  private drawSmoothLine(point: Point, pressure: number): void {
    if (!this.currentGraphics) return;

    // 筆圧対応サイズ・動的変更
    const brushSize = this.calculateBrushSize(pressure);
    
    this.currentGraphics.lineStyle({
      width: brushSize,
      color: this.currentColor,
      alpha: this.currentOpacity,
      cap: 'round',
      join: 'round'
    });

    this.currentGraphics.lineTo(point.x, point.y);
  }

  // 直線描画・スムージング無効・高速描画
  private drawDirectLine(point: Point, pressure: number): void {
    if (!this.currentGraphics) return;

    const brushSize = this.calculateBrushSize(pressure);
    this.currentGraphics.lineStyle({
      width: brushSize,
      color: this.currentColor,
      alpha: this.currentOpacity
    });

    this.currentGraphics.lineTo(point.x, point.y);
  }

  // 筆圧対応サイズ・自然な太さ変化・0.3-1.5倍
  private calculateBrushSize(pressure: number): number {
    const minSize = this.currentSize * 0.3;
    const maxSize = this.currentSize * 1.5;
    
    // 筆圧曲線・自然な変化・指数関数的
    const pressureCurve = Math.pow(pressure, 0.7);
    
    return minSize + (maxSize - minSize) * pressureCurve;
  }

  // 距離計算・最適化・手ブレ判定
  private calculateDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 色変更・UI連携・リアルタイム反映
  private onColorChange(data: IEventData['ui:color-change']): void {
    console.log(`🎨 色変更: #${data.color.toString(16).padStart(6, '0')}`);
    this.currentColor = data.color;
  }

  // ブラシサイズ設定・ツール連携
  public setBrushSize(size: number): void {
    this.currentSize = Math.max(1, Math.min(100, size));
    console.log(`🖌️ ブラシサイズ: ${this.currentSize}px`);
  }

  // 不透明度設定・レイヤー透明度
  public setBrushOpacity(opacity: number): void {
    this.currentOpacity = Math.max(0.1, Math.min(1.0, opacity));
    console.log(`🌐 不透明度: ${(this.currentOpacity * 100).toFixed(0)}%`);
  }

  // スムージング設定・描画品質調整
  public setSmoothingEnabled(enabled: boolean): void {
    this.smoothingEnabled = enabled;
    console.log(`✨ スムージング: ${enabled ? '有効' : '無効'}`);
  }

  // スムージング強度設定・0.0-1.0
  public setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0.0, Math.min(1.0, factor));
    console.log(`🎛️ スムージング強度: ${(this.smoothingFactor * 100).toFixed(0)}%`);
  }

  // 全描画削除・キャンバスクリア
  public clearCanvas(): void {
    console.log('🧹 キャンバスクリア実行');
    this.drawingContainer.removeChildren();
    
    // 現在描画中断
    if (this.isDrawing) {
      this.isDrawing = false;
      this.currentGraphics = null;
      this.strokePoints = [];
    }
  }

  // 描画統計・パフォーマンス監視
  public getDrawingStats(): {
    objectCount: number;
    isDrawing: boolean;
    currentStrokeLength: number;
    totalDrawingArea: { width: number; height: number };
  } {
    const bounds = this.drawingContainer.getBounds();
    
    return {
      objectCount: this.drawingContainer.children.length,
      isDrawing: this.isDrawing,
      currentStrokeLength: this.strokePoints.length,
      totalDrawingArea: {
        width: bounds.width,
        height: bounds.height
      }
    };
  }

  // 現在設定取得・UI同期・状態確認
  public getCurrentSettings(): {
    color: number;
    size: number;
    opacity: number;
    smoothing: boolean;
    smoothingFactor: number;
  } {
    return {
      color: this.currentColor,
      size: this.currentSize,
      opacity: this.currentOpacity,
      smoothing: this.smoothingEnabled,
      smoothingFactor: this.smoothingFactor
    };
  }

  // リソース解放・メモリリーク防止・アプリ終了時
  public destroy(): void {
    console.log('🔄 DrawingEngine破棄・リソース解放中...');
    
    // 描画中断
    if (this.isDrawing) {
      this.isDrawing = false;
      this.currentGraphics = null;
    }
    
    // Container削除・GPU リソース解放
    if (this.drawingContainer.parent) {
      this.drawingContainer.parent.removeChild(this.drawingContainer);
    }
    this.drawingContainer.destroy({ children: true, texture: true });
    
    // 配列クリア
    this.strokePoints = [];
    
    console.log('✅ DrawingEngine破棄完了');
  }
}