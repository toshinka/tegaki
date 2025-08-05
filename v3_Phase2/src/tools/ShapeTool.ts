// ShapeTool.ts - 図形描画ツール・基本図形・ベクター描画
// Phase2新規実装・IDrawingTool準拠・図形特化機能

import type { EventBus, IEventData } from '../core/EventBus.js';
import type { IDrawingTool } from './PenTool.js';
import * as PIXI from 'pixi.js';

/**
 * 図形種別・基本図形セット
 */
export type ShapeType = 'rectangle' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'triangle' | 'polygon' | 'star';

/**
 * 図形描画モード・塗りつぶし・輪郭
 */
export type ShapeDrawMode = 'fill' | 'stroke' | 'both';

/**
 * 図形設定・ベクター描画制御
 */
interface IShapeSettings {
  // 基本設定
  shapeType: ShapeType;        // 図形種別
  drawMode: ShapeDrawMode;     // 描画モード
  
  // 色・スタイル設定
  fillColor: number;           // 塗りつぶし色
  strokeColor: number;         // 輪郭色
  strokeWidth: number;         // 輪郭幅 1-20px
  opacity: number;             // 全体透明度 0.1-1.0
  
  // 図形設定
  cornerRadius: number;        // 角丸半径 0-50px（矩形用）
  sides: number;              // 多角形辺数 3-12（多角形用）
  starPoints: number;         // 星型頂点数 5-12（星型用）
  starInnerRadius: number;    // 星型内側半径 0.2-0.8（星型用）
  
  // 描画制御
  constrainProportions: boolean; // 比率固定（Shift相当）
  snapToGrid: boolean;          // グリッドスナップ
  antiAlias: boolean;           // アンチエイリアス
  
  // 高度機能・Phase3拡張予定
  gradient: boolean;            // グラデーション塗り
  shadow: boolean;              // ドロップシャドウ
  rotation: number;             // 回転角度 0-360度
}

/**
 * 図形描画状態・プレビュー管理
 */
interface IShapeDrawState {
  isDrawing: boolean;
  startPoint: PIXI.Point;
  currentPoint: PIXI.Point;
  previewGraphics: PIXI.Graphics | null;
  finalBounds: PIXI.Rectangle;
}

/**
 * 図形統計・性能監視
 */
interface IShapeStats {
  shapesDrawn: number;
  totalArea: number;
  averageComplexity: number;
  renderTime: number;
}

/**
 * 図形描画ツール・Phase2新規実装
 * 基本図形・ベクター描画・プレビュー機能・高精度位置指定
 */
export class ShapeTool implements IDrawingTool {
  public readonly name = 'shape';
  public readonly icon = 'ti ti-square';
  public readonly category = 'drawing' as const;

  private eventBus: EventBus;
  private isActive = false;
  
  // 図形設定・ベクター特化
  private settings: IShapeSettings = {
    // 基本設定
    shapeType: 'rectangle',    // 矩形・最も使用頻度高
    drawMode: 'both',          // 塗り+輪郭・視認性重視
    
    // 色設定・ふたば色継承
    fillColor: 0x800000,      // ふたばマルーン塗り
    strokeColor: 0x000000,    // 黒輪郭・明確な境界
    strokeWidth: 2,           // 2px輪郭・バランス良好
    opacity: 0.8,             // 80%透明度・背景透過
    
    // 図形設定
    cornerRadius: 8,          // 8px角丸・モダンな印象
    sides: 6,                 // 6角形・標準多角形
    starPoints: 5,            // 5角星・一般的
    starInnerRadius: 0.4,     // 40%内側・美しい比率
    
    // 描画制御
    constrainProportions: false, // 自由比率・デフォルト
    snapToGrid: false,          // グリッドなし・Phase3実装
    antiAlias: true,            // スムーズエッジ
    
    // 高度機能・Phase3実装予定
    gradient: false,            // 単色塗り・シンプル
    shadow: false,              // 影なし・軽量
    rotation: 0,                // 回転なし・基本姿勢
  };
  
  // 描画状態管理
  private drawState: IShapeDrawState = {
    isDrawing: false,
    startPoint: new PIXI.Point(0, 0),
    currentPoint: new PIXI.Point(0, 0),
    previewGraphics: null,
    finalBounds: new PIXI.Rectangle(0, 0, 0, 0)
  };
  
  // プレビュー用コンテナ・一時表示
  private previewContainer: PIXI.Container | null = null;
  
  // 統計
  private stats: IShapeStats = {
    shapesDrawn: 0,
    totalArea: 0,
    averageComplexity: 0,
    renderTime: 0
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    console.log('📐 ShapeTool初期化完了');
  }

  /**
   * 図形ツール有効化・カーソル・UI更新
   */
  public activate(): void {
    this.isActive = true;
    
    // 図形専用カーソル・十字線
    document.body.style.cursor = 'crosshair';
    
    // 図形設定UI表示・Phase2後半実装予定
    this.eventBus.emit('ui:tool-activated', {
      toolName: this.name,
      settings: this.settings,
      timestamp: Date.now()
    });
    
    // プレビューコンテナ準備
    this.setupPreviewContainer();
    
    console.log('📐 図形ツール有効化・ベクター描画準備完了');
  }

  /**
   * 図形ツール無効化・プレビュークリア
   */
  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
    
    // プレビュー削除・クリーンアップ
    this.clearPreview();
    this.cleanupPreviewContainer();
    
    // 描画状態リセット
    this.drawState.isDrawing = false;
    
    console.log('📐 図形ツール無効化');
  }

  /**
   * 図形描画開始・開始点記録・プレビュー準備
   */
  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    
    // 描画状態初期化
    this.drawState.isDrawing = true;
    this.drawState.startPoint = event.point.clone();
    this.drawState.currentPoint = event.point.clone();
    
    // プレビュー図形作成
    this.createPreviewShape();
    
    console.log(`📐 図形描画開始: ${this.settings.shapeType} at (${event.point.x}, ${event.point.y})`);
  }

  /**
   * 図形描画移動・プレビュー更新・リアルタイム表示
   */
  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive || !this.drawState.isDrawing) return;
    
    // 現在点更新
    this.drawState.currentPoint = event.point.clone();
    
    // 比率固定・Shiftキー相当
    if (this.settings.constrainProportions) {
      this.constrainCurrentPoint();
    }
    
    // プレビュー更新・リアルタイム描画
    this.updatePreviewShape();
    
    // グリッドスナップ・Phase3実装予定
    if (this.settings.snapToGrid) {
      this.snapCurrentPointToGrid();
    }
  }

  /**
   * 図形描画終了・確定描画・プレビュー削除
   */
  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive || !this.drawState.isDrawing) return;
    
    // 最終点設定
    this.drawState.currentPoint = event.point.clone();
    
    // 比率固定・最終調整
    if (this.settings.constrainProportions) {
      this.constrainCurrentPoint();
    }
    
    // 最小サイズチェック・誤操作防止
    const bounds = this.calculateShapeBounds();
    if (bounds.width < 3 || bounds.height < 3) {
      console.log('📐 図形サイズ不足・描画キャンセル');
      this.clearPreview();
      this.drawState.isDrawing = false;
      return;
    }
    
    // 確定描画・LayerManagerに送信
    this.finalizeShape();
    
    // プレビュークリア・状態リセット
    this.clearPreview();
    this.drawState.isDrawing = false;
    
    // 統計更新
    this.updateStats(bounds);
    
    console.log(`📐 図形描画完了: ${this.settings.shapeType}, サイズ: ${bounds.width}x${bounds.height}`);
  }

  /**
   * 図形設定取得
   */
  public getSettings(): IShapeSettings {
    return { ...this.settings };
  }

  /**
   * 図形設定更新・リアルタイム反映
   */
  public updateSettings(newSettings: Partial<IShapeSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    // プレビュー更新・設定変更反映
    if (this.drawState.isDrawing) {
      this.updatePreviewShape();
    }
    
    // 設定変更通知・UI同期
    this.eventBus.emit('shape:settings-changed', {
      oldSettings,
      newSettings: this.settings,
      timestamp: Date.now()
    });
    
    console.log('📐 図形設定更新:', {
      shapeType: this.settings.shapeType,
      drawMode: this.settings.drawMode,
      fillColor: `#${this.settings.fillColor.toString(16).padStart(6, '0')}`
    });
  }

  /**
   * 図形種別変更・ツール切り替え
   * @param shapeType 新しい図形種別
   */
  public setShapeType(shapeType: ShapeType): void {
    const oldType = this.settings.shapeType;
    this.settings.shapeType = shapeType;
    
    // 図形別デフォルト設定調整
    this.adjustSettingsForShape(shapeType);
    
    // プレビュー更新
    if (this.drawState.isDrawing) {
      this.updatePreviewShape();
    }
    
    console.log(`📐 図形種別変更: ${oldType} → ${shapeType}`);
  }

  /**
   * プレビューコンテナ設定・一時表示用
   */
  private setupPreviewContainer(): void {
    // DrawingEngineにプレビューコンテナ要求
    this.eventBus.emit('shape:preview-container-request', {
      toolName: this.name,
      timestamp: Date.now()
    });
  }

  /**
   * プレビューコンテナクリーンアップ
   */
  private cleanupPreviewContainer(): void {
    if (this.previewContainer && this.previewContainer.parent) {
      this.previewContainer.parent.removeChild(this.previewContainer);
    }
    this.previewContainer = null;
  }

  /**
   * プレビュー図形作成・初期化
   */
  private createPreviewShape(): void {
    if (!this.previewContainer) return;
    
    // 既存プレビュー削除
    this.clearPreview();
    
    // 新しいGraphics作成
    this.drawState.previewGraphics = new PIXI.Graphics();
    this.drawState.previewGraphics.alpha = 0.7; // プレビュー用透明度
    
    this.previewContainer.addChild(this.drawState.previewGraphics);
  }

  /**
   * プレビュー図形更新・リアルタイム描画
   */
  private updatePreviewShape(): void {
    if (!this.drawState.previewGraphics) return;
    
    const graphics = this.drawState.previewGraphics;
    graphics.clear();
    
    // 図形描画・種別別処理
    this.drawShape(graphics, this.calculateShapeBounds(), true);
  }

  /**
   * プレビュークリア・一時表示削除
   */
  private clearPreview(): void {
    if (this.drawState.previewGraphics) {
      if (this.drawState.previewGraphics.parent) {
        this.drawState.previewGraphics.parent.removeChild(this.drawState.previewGraphics);
      }
      this.drawState.previewGraphics.destroy();
      this.drawState.previewGraphics = null;
    }
  }

  /**
   * 図形確定描画・最終出力
   */
  private finalizeShape(): void {
    const bounds = this.calculateShapeBounds();
    
    // DrawingEngine連携・確定描画
    this.eventBus.emit('shape:draw-final', {
      shapeType: this.settings.shapeType,
      bounds,
      settings: this.settings,
      timestamp: Date.now()
    });
  }

  /**
   * 図形描画・共通描画ロジック
   * @param graphics PixiJS Graphics
   * @param bounds 描画範囲
   * @param isPreview プレビューモード
   */
  private drawShape(graphics: PIXI.Graphics, bounds: PIXI.Rectangle, isPreview = false): void {
    // スタイル設定
    this.applyGraphicsStyle(graphics, isPreview);
    
    // 図形種別別描画
    switch (this.settings.shapeType) {
      case 'rectangle':
        this.drawRectangle(graphics, bounds);
        break;
      case 'circle':
        this.drawCircle(graphics, bounds);
        break;
      case 'ellipse':
        this.drawEllipse(graphics, bounds);
        break;
      case 'line':
        this.drawLine(graphics, bounds);
        break;
      case 'arrow':
        this.drawArrow(graphics, bounds);
        break;
      case 'triangle':
        this.drawTriangle(graphics, bounds);
        break;
      case 'polygon':
        this.drawPolygon(graphics, bounds);
        break;
      case 'star':
        this.drawStar(graphics, bounds);
        break;
    }
  }

  /**
   * Graphics スタイル適用・色・線幅設定
   */
  private applyGraphicsStyle(graphics: PIXI.Graphics, isPreview: boolean): void {
    const opacity = isPreview ? this.settings.opacity * 0.7 : this.settings.opacity;
    
    // 描画モード別スタイル設定
    switch (this.settings.drawMode) {
      case 'fill':
        graphics.beginFill(this.settings.fillColor, opacity);
        break;
      case 'stroke':
        graphics.lineStyle(this.settings.strokeWidth, this.settings.strokeColor, opacity);
        break;
      case 'both':
        graphics.beginFill(this.settings.fillColor, opacity);
        graphics.lineStyle(this.settings.strokeWidth, this.settings.strokeColor, opacity);
        break;
    }
  }

  /**
   * 矩形描画・角丸対応
   */
  private drawRectangle(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
    if (this.settings.cornerRadius > 0) {
      graphics.drawRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, this.settings.cornerRadius);
    } else {
      graphics.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
  }

  /**
   * 円描画・正円
   */
  private drawCircle(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const radius = Math.min(bounds.width, bounds.height) / 2;
    
    graphics.drawCircle(centerX, centerY, radius);
  }

  /**
   * 楕円描画・自由比率
   */
  private drawEllipse(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const radiusX = bounds.width / 2;
    const radiusY = bounds.height / 2;
    
    graphics.drawEllipse(centerX, centerY, radiusX, radiusY);
  }

  /**
   * 直線描画・シンプル
   */
  private drawLine(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
    graphics.moveTo(bounds.x, bounds.y);
    graphics.lineTo(bounds.x + bounds.width, bounds.y + bounds.height);
  }

  /**
   * 矢印描画・方向線
   */
  private drawArrow(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
    const startX = bounds.x;
    const startY = bounds.y;
    const endX = bounds.x + bounds.width;
    const endY = bounds.y + bounds.height;
    
    // 矢印本体
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    
    // 矢印頭部・20度角度
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = Math.min(bounds.width, bounds.height) * 0.3;
    
    const leftX = endX - arrowLength * Math.cos(angle - Math.PI / 6);
    const leftY = endY - arrowLength * Math.sin(angle - Math.PI / 6);
    const rightX = endX - arrowLength * Math.cos(angle + Math.PI / 6);
    const rightY = endY - arrowLength * Math.sin(angle + Math.PI / 6);
    
    graphics.moveTo(endX, endY);
    graphics.lineTo(leftX, leftY);
    graphics.moveTo(endX, endY);
    graphics.lineTo(rightX, rightY);
  }

  /**
   * 三角形描画・正三角形
   */
  private drawTriangle(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
    const centerX = bounds.x + bounds.width / 2;
    const topY = bounds.y;
    const bottomY = bounds.y + bounds.height;
    const leftX = bounds.x;
    const rightX = bounds.x + bounds.width;
    
    graphics.moveTo(centerX, topY);
    graphics.lineTo(rightX, bottomY);
    graphics.lineTo(leftX, bottomY);
    graphics.closePath();
  }

  /**
   * 多角形描画・設定辺数
   */
  private drawPolygon(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const radius = Math.min(bounds.width, bounds.height) / 2;
    const sides = this.settings.sides;
    
    const points: PIXI.Point[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2; // 上向き開始
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push(new PIXI.Point(x, y));
    }
    
    graphics.drawPolygon(points);
  }

  /**
   * 星型描画・設定頂点数・内側半径
   */
  private drawStar(graphics: PIXI.Graphics, bounds: PIXI.Rectangle): void {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const outerRadius = Math.min(bounds.width, bounds.height) / 2;
    const innerRadius = outerRadius * this.settings.starInnerRadius;
    const points = this.settings.starPoints;
    
    const vertices: PIXI.Point[] = [];
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2; // 上向き開始
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      vertices.push(new PIXI.Point(x, y));
    }
    
    graphics.drawPolygon(vertices);
  }

  /**
   * 図形範囲計算・描画用Rectangle
   */
  private calculateShapeBounds(): PIXI.Rectangle {
    const startX = this.drawState.startPoint.x;
    const startY = this.drawState.startPoint.y;
    const currentX = this.drawState.currentPoint.x;
    const currentY = this.drawState.currentPoint.y;
    
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    return new PIXI.Rectangle(x, y, width, height);
  }

  /**
   * 比率固定・正方形・正円制約
   */
  private constrainCurrentPoint(): void {
    const deltaX = this.drawState.currentPoint.x - this.drawState.startPoint.x;
    const deltaY = this.drawState.currentPoint.y - this.drawState.startPoint.y;
    
    // 長辺に合わせて正方形化
    const maxDelta = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    
    this.drawState.currentPoint.x = this.drawState.startPoint.x + (deltaX >= 0 ? maxDelta : -maxDelta);
    this.drawState.currentPoint.y = this.drawState.startPoint.y + (deltaY >= 0 ? maxDelta : -maxDelta);
  }

  /**
   * グリッドスナップ・Phase3実装予定
   */
  private snapCurrentPointToGrid(): void {
    // Phase3で実装・グリッドシステム依存
    console.log('📐 グリッドスナップ・Phase3実装予定');
  }

  /**
   * 図形別設定調整・最適化
   */
  private adjustSettingsForShape(shapeType: ShapeType): void {
    switch (shapeType) {
      case 'line':
      case 'arrow':
        // 線系は塗りつぶし無効
        this.settings.drawMode = 'stroke';
        this.settings.strokeWidth = Math.max(2, this.settings.strokeWidth);
        break;
        
      case 'circle':
      case 'ellipse':
        // 円系は角丸無効
        this.settings.cornerRadius = 0;
        break;
        
      case 'polygon':
        // 多角形は辺数確認
        this.settings.sides = Math.max(3, Math.min(12, this.settings.sides));
        break;
        
      case 'star':
        // 星型は頂点数・内側半径確認
        this.settings.starPoints = Math.max(3, Math.min(12, this.settings.starPoints));
        this.settings.starInnerRadius = Math.max(0.2, Math.min(0.8, this.settings.starInnerRadius));
        break;
    }
  }

  /**
   * 統計更新・性能監視
   */
  private updateStats(bounds: PIXI.Rectangle): void {
    this.stats.shapesDrawn++;
    
    const area = bounds.width * bounds.height;
    this.stats.totalArea += area;
    
    // 複雑度計算・図形種別別
    let complexity = 1;
    switch (this.settings.shapeType) {
      case 'polygon':
        complexity = this.settings.sides;
        break;
      case 'star':
        complexity = this.settings.starPoints * 2;
        break;
      case 'arrow':
        complexity = 3; // 本体+矢印頭部2本
        break;
      default:
        complexity = 1;
    }
    
    this.stats.averageComplexity = 
      (this.stats.averageComplexity * (this.stats.shapesDrawn - 1) + complexity) / this.stats.shapesDrawn;
  }

  /**
   * 図形統計取得・デバッグ・分析用
   */
  public getStats(): IShapeStats {
    return { ...this.stats };
  }

  /**
   * キーボードショートカット処理・Phase2後半実装
   * @param key キーコード
   */
  public handleKeyPress(key: string): void {
    switch (key) {
      case 'Shift':
        this.settings.constrainProportions = true;
        if (this.drawState.isDrawing) {
          this.constrainCurrentPoint();
          this.updatePreviewShape();
        }
        break;
        
      case '1':
        this.setShapeType('rectangle');
        break;
      case '2':
        this.setShapeType('circle');
        break;
      case '3':
        this.setShapeType('line');
        break;
      case '4':
        this.setShapeType('triangle');
        break;
    }
  }

  /**
   * キーボードリリース処理
   * @param key キーコード
   */
  public handleKeyRelease(key: string): void {
    switch (key) {
      case 'Shift':
        this.settings.constrainProportions = false;
        break;
    }
  }

  /**
   * リソース解放・メモリクリーンアップ
   */
  public destroy(): void {
    console.log('📐 ShapeTool終了処理開始...');
    
    this.clearPreview();
    this.cleanupPreviewContainer();
    
    // 統計リセット
    this.stats = {
      shapesDrawn: 0,
      totalArea: 0,
      averageComplexity: 0,
      renderTime: 0
    };
    
    console.log('✅ ShapeTool終了処理完了');
  }
}