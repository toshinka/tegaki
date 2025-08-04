// CanvasManager.ts - Phase2 キャンバス管理システム
// 4K対応・座標変換・Viewport・2.5K最適化・ズーム・パン機能

import * as PIXI from 'pixi.js';
import { EventBus, IEventData } from '../core/EventBus.js';

export interface ICanvasSettings {
  width: number;
  height: number;
  backgroundColor: number;
  pixelRatio: number;
  antialias: boolean;
}

export interface IViewportState {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface ICanvasEventData extends IEventData {
  'canvas:resized': { width: number; height: number; pixelRatio: number };
  'canvas:viewport-changed': { viewport: IViewportState };
  'canvas:zoom-changed': { zoom: number; centerX: number; centerY: number };
  'canvas:coordinate-transform': { screen: PIXI.Point; canvas: PIXI.Point };
}

/**
 * キャンバス管理システム・Phase2実装
 * - 4K対応・2560×1440最適化・高解像度サポート
 * - 座標変換・スクリーン↔キャンバス・サブピクセル精度
 * - Viewport制御・ズーム・パン・回転機能
 * - デバイスピクセル比対応・網膜ディスプレイ最適化
 */
export class CanvasManager {
  private eventBus: EventBus;
  private pixiApp: PIXI.Application;
  private canvasContainer: PIXI.Container;
  
  // キャンバス設定
  private canvasSettings: ICanvasSettings;
  private actualCanvasSize: { width: number; height: number };
  
  // Viewport制御
  private viewport: IViewportState;
  private bounds: PIXI.Rectangle;
  
  // ズーム・パン
  private minZoom = 0.1;
  private maxZoom = 10.0;
  private zoomStep = 0.1;
  private panSpeed = 1.0;
  
  // 2.5K最適化
  private readonly TARGET_WIDTH = 2560;
  private readonly TARGET_HEIGHT = 1440;
  private readonly TARGET_ASPECT = this.TARGET_WIDTH / this.TARGET_HEIGHT;
  
  // パフォーマンス最適化
  private transformCache: Map<string, PIXI.Point> = new Map();
  private lastUpdateTime = 0;
  private updateThrottle = 16; // 60FPS制限

  constructor(pixiApp: PIXI.Application, eventBus: EventBus) {
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
    
    // キャンバス用Container作成
    this.canvasContainer = new PIXI.Container();
    this.canvasContainer.name = 'canvas-container';
    this.pixiApp.stage.addChild(this.canvasContainer);
    
    // 初期設定
    this.canvasSettings = this.getOptimalCanvasSettings();
    this.actualCanvasSize = {
      width: this.canvasSettings.width,
      height: this.canvasSettings.height
    };
    
    // 初期Viewport
    this.viewport = {
      x: 0,
      y: 0,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0
    };
    
    // 境界設定
    this.bounds = new PIXI.Rectangle(
      0, 0,
      this.canvasSettings.width,
      this.canvasSettings.height
    );
    
    this.setupEventListeners();
    this.initializeViewport();
    
    console.log('🖼️ CanvasManager初期化完了', this.canvasSettings);
  }

  /**
   * 最適キャンバス設定取得・2.5K環境対応
   */
  private getOptimalCanvasSettings(): ICanvasSettings {
    const pixelRatio = window.devicePixelRatio || 1;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // 2.5K環境検出・最適化
    let canvasWidth: number;
    let canvasHeight: number;
    
    if (screenWidth >= this.TARGET_WIDTH && screenHeight >= this.TARGET_HEIGHT) {
      // 2.5K環境・ネイティブ解像度
      canvasWidth = 2048; // 高品質キャンバス
      canvasHeight = 2048;
      console.log('🎯 2.5K環境検出・高品質モード');
    } else {
      // 標準環境・適応的サイズ
      const aspectRatio = screenWidth / screenHeight;
      if (aspectRatio > this.TARGET_ASPECT) {
        // 横長画面
        canvasHeight = Math.min(1024, screenHeight * 0.8);
        canvasWidth = canvasHeight * aspectRatio;
      } else {
        // 縦長・正方形画面
        canvasWidth = Math.min(1024, screenWidth * 0.8);
        canvasHeight = canvasWidth / aspectRatio;
      }
      console.log('📱 標準環境・適応的サイズ');
    }

    return {
      width: Math.floor(canvasWidth),
      height: Math.floor(canvasHeight),
      backgroundColor: 0xffffee, // ふたば背景色
      pixelRatio,
      antialias: pixelRatio >= 2 // 高DPI環境でアンチエイリアス
    };
  }

  /**
   * イベントリスナー設定・リサイズ対応
   */
  private setupEventListeners(): void {
    // ウィンドウリサイズ対応
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // デバイス回転対応
    if (screen.orientation) {
      screen.orientation.addEventListener('change', this.handleResize.bind(this));
    }
  }

  /**
   * リサイズ処理・動的調整
   */
  private handleResize(): void {
    const now = performance.now();
    if (now - this.lastUpdateTime < this.updateThrottle) {
      return; // スロットリング
    }
    this.lastUpdateTime = now;

    const newSettings = this.getOptimalCanvasSettings();
    
    // 設定変更確認
    if (newSettings.width !== this.canvasSettings.width ||
        newSettings.height !== this.canvasSettings.height ||
        newSettings.pixelRatio !== this.canvasSettings.pixelRatio) {
      
      this.canvasSettings = newSettings;
      this.updateCanvasSize();
      
      console.log('📐 キャンバスリサイズ', this.canvasSettings);
    }
  }

  /**
   * キャンバスサイズ更新・PixiJS連携
   */
  private updateCanvasSize(): void {
    // PixiJS Renderer更新
    this.pixiApp.renderer.resize(
      this.canvasSettings.width * this.canvasSettings.pixelRatio,
      this.canvasSettings.height * this.canvasSettings.pixelRatio
    );

    // キャンバス実サイズ更新
    this.actualCanvasSize = {
      width: this.canvasSettings.width,
      height: this.canvasSettings.height
    };

    // 境界更新
    this.bounds.width = this.canvasSettings.width;
    this.bounds.height = this.canvasSettings.height;

    // Viewport調整・中央保持
    this.centerViewport();

    // キャッシュクリア
    this.transformCache.clear();

    // イベント発火
    this.eventBus.emit('canvas:resized', {
      width: this.canvasSettings.width,
      height: this.canvasSettings.height,
      pixelRatio: this.canvasSettings.pixelRatio
    });
  }

  /**
   * Viewport初期化・中央配置
   */
  private initializeViewport(): void {
    this.centerViewport();
    this.applyViewportTransform();
  }

  /**
   * Viewport中央配置
   */
  private centerViewport(): void {
    const screenCenterX = this.pixiApp.screen.width / 2;
    const screenCenterY = this.pixiApp.screen.height / 2;
    
    const canvasCenterX = this.canvasSettings.width / 2;
    const canvasCenterY = this.canvasSettings.height / 2;
    
    this.viewport.x = screenCenterX - canvasCenterX * this.viewport.scaleX;
    this.viewport.y = screenCenterY - canvasCenterY * this.viewport.scaleY;
  }

  /**
   * Viewport変換適用・Container更新
   */
  private applyViewportTransform(): void {
    this.canvasContainer.position.set(this.viewport.x, this.viewport.y);
    this.canvasContainer.scale.set(this.viewport.scaleX, this.viewport.scaleY);
    this.canvasContainer.rotation = this.viewport.rotation;

    // イベント発火
    this.eventBus.emit('canvas:viewport-changed', {
      viewport: { ...this.viewport }
    });
  }

  /**
   * スクリーン座標→キャンバス座標変換・高精度
   * @param screenX スクリーン座標X
   * @param screenY スクリーン座標Y
   * @returns キャンバス座標
   */
  public screenToCanvas(screenX: number, screenY: number): PIXI.Point {
    // キャッシュキー生成・パフォーマンス最適化
    const cacheKey = `${screenX.toFixed(2)},${screenY.toFixed(2)},${this.viewport.scaleX.toFixed(3)}`;
    const cached = this.transformCache.get(cacheKey);
    if (cached && this.transformCache.size < 1000) {
      return cached.clone();
    }

    // 逆変換行列計算
    const transform = this.canvasContainer.transform.worldTransform;
    const invTransform = new PIXI.Matrix();
    transform.invert(invTransform);

    // 座標変換実行
    const canvasPoint = invTransform.apply(new PIXI.Point(screenX, screenY));
    
    // デバイスピクセル比補正
    canvasPoint.x /= this.canvasSettings.pixelRatio;
    canvasPoint.y /= this.canvasSettings.pixelRatio;

    // 境界チェック・クランプ
    canvasPoint.x = Math.max(0, Math.min(this.canvasSettings.width, canvasPoint.x));
    canvasPoint.y = Math.max(0, Math.min(this.canvasSettings.height, canvasPoint.y));

    // キャッシュ保存
    if (this.transformCache.size < 1000) {
      this.transformCache.set(cacheKey, canvasPoint.clone());
    }

    // イベント発火（デバッグ用）
    this.eventBus.emit('canvas:coordinate-transform', {
      screen: new PIXI.Point(screenX, screenY),
      canvas: canvasPoint.clone()
    });

    return canvasPoint;
  }

  /**
   * キャンバス座標→スクリーン座標変換
   * @param canvasX キャンバス座標X
   * @param canvasY キャンバス座標Y
   * @returns スクリーン座標
   */
  public canvasToScreen(canvasX: number, canvasY: number): PIXI.Point {
    // デバイスピクセル比適用
    const adjustedX = canvasX * this.canvasSettings.pixelRatio;
    const adjustedY = canvasY * this.canvasSettings.pixelRatio;

    // 変換行列適用
    const transform = this.canvasContainer.transform.worldTransform;
    const screenPoint = transform.apply(new PIXI.Point(adjustedX, adjustedY));

    return screenPoint;
  }

  /**
   * ズーム機能・中心点指定
   * @param delta ズーム変化量
   * @param centerX ズーム中心X（スクリーン座標）
   * @param centerY ズーム中心Y（スクリーン座標）
   */
  public zoom(delta: number, centerX?: number, centerY?: number): void {
    const oldScale = this.viewport.scaleX;
    const newScale = Math.max(this.minZoom, Math.min(this.maxZoom, oldScale + delta * this.zoomStep));
    
    if (newScale === oldScale) {
      return; // 制限値・変更なし
    }

    // ズーム中心計算・未指定時は画面中央
    const zoomCenterX = centerX ?? this.pixiApp.screen.width / 2;
    const zoomCenterY = centerY ?? this.pixiApp.screen.height / 2;

    // ズーム前のキャンバス座標
    const canvasPointBefore = this.screenToCanvas(zoomCenterX, zoomCenterY);

    // スケール更新
    this.viewport.scaleX = newScale;
    this.viewport.scaleY = newScale;

    // ズーム後の位置調整・中心点維持
    const canvasPointAfter = this.screenToCanvas(zoomCenterX, zoomCenterY);
    const deltaCanvasX = canvasPointBefore.x - canvasPointAfter.x;
    const deltaCanvasY = canvasPointBefore.y - canvasPointAfter.y;

    this.viewport.x += deltaCanvasX * newScale;
    this.viewport.y += deltaCanvasY * newScale;

    // 境界制限適用
    this.constrainViewport();
    
    // 変換適用
    this.applyViewportTransform();

    // キャッシュクリア
    this.transformCache.clear();

    // イベント発火
    this.eventBus.emit('canvas:zoom-changed', {
      zoom: newScale,
      centerX: zoomCenterX,
      centerY: zoomCenterY
    });

    console.log(`🔍 ズーム変更: ${(oldScale * 100).toFixed(0)}% → ${(newScale * 100).toFixed(0)}%`);
  }

  /**
   * パン機能・相対移動
   * @param deltaX X軸移動量（スクリーン座標）
   * @param deltaY Y軸移動量（スクリーン座標）
   */
  public pan(deltaX: number, deltaY: number): void {
    this.viewport.x += deltaX * this.panSpeed;
    this.viewport.y += deltaY * this.panSpeed;

    // 境界制限適用
    this.constrainViewport();
    
    // 変換適用
    this.applyViewportTransform();

    // キャッシュクリア
    this.transformCache.clear();
  }

  /**
   * Viewport境界制限・範囲外防止
   */
  private constrainViewport(): void {
    const scaledWidth = this.canvasSettings.width * this.viewport.scaleX;
    const scaledHeight = this.canvasSettings.height * this.viewport.scaleY;
    
    const screenWidth = this.pixiApp.screen.width;
    const screenHeight = this.pixiApp.screen.height;

    // 最小表示範囲確保・完全に画面外に出ることを防ぐ
    const minVisibleSize = 100;
    
    // X軸制限
    const maxX = screenWidth - minVisibleSize;
    const minX = -(scaledWidth - minVisibleSize);
    this.viewport.x = Math.max(minX, Math.min(maxX, this.viewport.x));

    // Y軸制限
    const maxY = screenHeight - minVisibleSize;
    const minY = -(scaledHeight - minVisibleSize);
    this.viewport.y = Math.max(minY, Math.min(maxY, this.viewport.y));
  }

  /**
   * ズームリセット・1:1表示
   */
  public resetZoom(): void {
    this.viewport.scaleX = 1.0;
    this.viewport.scaleY = 1.0;
    this.centerViewport();
    this.applyViewportTransform();
    this.transformCache.clear();

    console.log('🎯 ズームリセット・1:1表示');
  }

  /**
   * 全体表示・キャンバス全体をフィット
   */
  public fitToScreen(): void {
    const screenWidth = this.pixiApp.screen.width;
    const screenHeight = this.pixiApp.screen.height;
    
    const scaleX = screenWidth / this.canvasSettings.width;
    const scaleY = screenHeight / this.canvasSettings.height;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 余白確保

    this.viewport.scaleX = Math.max(this.minZoom, Math.min(this.maxZoom, scale));
    this.viewport.scaleY = this.viewport.scaleX;
    
    this.centerViewport();
    this.applyViewportTransform();
    this.transformCache.clear();

    console.log(`📐 全体表示・スケール: ${(scale * 100).toFixed(0)}%`);
  }

  /**
   * キャンバス設定取得
   */
  public getCanvasSettings(): Readonly<ICanvasSettings> {
    return { ...this.canvasSettings };
  }

  /**
   * Viewport状態取得
   */
  public getViewportState(): Readonly<IViewportState> {
    return { ...this.viewport };
  }

  /**
   * 実際のキャンバスサイズ取得
   */
  public getActualCanvasSize(): Readonly<{ width: number; height: number }> {
    return { ...this.actualCanvasSize };
  }

  /**
   * ズーム範囲取得
   */
  public getZoomRange(): { min: number; max: number; current: number } {
    return {
      min: this.minZoom,
      max: this.maxZoom,
      current: this.viewport.scaleX
    };
  }

  /**
   * キャンバス境界矩形取得・描画範囲判定用
   */
  public getCanvasBounds(): Readonly<PIXI.Rectangle> {
    return this.bounds.clone();
  }

  /**
   * 表示可能領域取得・カリング最適化用
   */
  public getVisibleBounds(): PIXI.Rectangle {
    const topLeft = this.screenToCanvas(0, 0);
    const bottomRight = this.screenToCanvas(
      this.pixiApp.screen.width,
      this.pixiApp.screen.height
    );

    return new PIXI.Rectangle(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    );
  }

  /**
   * キャンバス中心点取得
   */
  public getCanvasCenter(): PIXI.Point {
    return new PIXI.Point(
      this.canvasSettings.width / 2,
      this.canvasSettings.height / 2
    );
  }

  /**
   * デバッグ情報取得
   */
  public getDebugInfo(): Record<string, any> {
    return {
      canvasSettings: this.canvasSettings,
      viewport: this.viewport,
      transformCacheSize: this.transformCache.size,
      visibleBounds: this.getVisibleBounds(),
      devicePixelRatio: window.devicePixelRatio,
      screenSize: {
        width: this.pixiApp.screen.width,
        height: this.pixiApp.screen.height
      }
    };
  }

  /**
   * パフォーマンス最適化・キャッシュクリア
   */
  public clearTransformCache(): void {
    this.transformCache.clear();
    console.log('🧹 座標変換キャッシュクリア');
  }

  /**
   * ズーム制限設定
   */
  public setZoomLimits(min: number, max: number): void {
    this.minZoom = Math.max(0.01, min);
    this.maxZoom = Math.min(50.0, max);
    
    // 現在のズームを制限内に調整
    if (this.viewport.scaleX < this.minZoom || this.viewport.scaleX > this.maxZoom) {
      this.viewport.scaleX = Math.max(this.minZoom, Math.min(this.maxZoom, this.viewport.scaleX));
      this.viewport.scaleY = this.viewport.scaleX;
      this.applyViewportTransform();
    }

    console.log(`🔧 ズーム制限設定: ${this.minZoom}-${this.maxZoom}`);
  }

  /**
   * リソース解放・アプリケーション終了時
   */
  public destroy(): void {
    console.log('🔄 CanvasManager終了処理開始...');

    // イベントリスナー削除
    window.removeEventListener('resize', this.handleResize.bind(this));
    if (screen.orientation) {
      screen.orientation.removeEventListener('change', this.handleResize.bind(this));
    }

    // キャッシュクリア
    this.transformCache.clear();

    // Container削除
    if (this.canvasContainer.parent) {
      this.canvasContainer.parent.removeChild(this.canvasContainer);
    }
    this.canvasContainer.destroy({ children: true, texture: false });

    console.log('✅ CanvasManager終了処理完了');
  }
}