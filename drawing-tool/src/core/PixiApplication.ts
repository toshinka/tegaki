// PixiApplication.ts - PixiJS v8統合・WebGPU/WebGL2自動切り替え
// 2.5K最適化・段階的縮退戦略・性能監視

import * as PIXI from 'pixi.js';

/**
 * レンダラー種別・性能Tier分類
 */
export type RendererType = 'webgpu' | 'webgl2' | 'webgl';

/**
 * レンダラー設定・Tier別最適化
 */
interface IRendererConfig {
  renderer: RendererType;
  maxCanvasSize: { width: number; height: number };
  targetFPS: number;
  features: {
    antialias: boolean;
    multisampling: boolean;
    highPrecision: boolean;
    computeShaders: boolean;
  };
  memoryLimits: {
    maxTextures: number;
    maxVertices: number;
    gcThreshold: number;
  };
}

/**
 * WebGPU対応検出・段階的フォールバック
 */
class WebGPUDetector {
  /**
   * WebGPU対応・GPU性能評価
   */
  public static async detectSupport(): Promise<RendererType> {
    // WebGPU対応チェック・Chrome/Edge優先
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance'
        });
        
        if (adapter) {
          // GPU性能評価・制限チェック
          const limits = adapter.limits;
          const features = adapter.features;
          
          console.log('🚀 WebGPU対応検出:', {
            maxTextureSize: limits.maxTextureDimension2D,
            maxComputeWorkgroups: limits.maxComputeWorkgroupsPerDimension,
            features: Array.from(features)
          });
          
          return 'webgpu';
        }
      } catch (error) {
        console.warn('⚠️ WebGPU初期化失敗:', error);
      }
    }
    
    // WebGL2フォールバック・Firefox/Safari
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      // WebGL2性能チェック
      const maxTextureSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE);
      const maxVertexAttribs = gl2.getParameter(gl2.MAX_VERTEX_ATTRIBS);
      
      console.log('⚡ WebGL2対応検出:', {
        maxTextureSize,
        maxVertexAttribs,
        extensions: gl2.getSupportedExtensions()?.length || 0
      });
      
      return 'webgl2';
    }
    
    // WebGL基本対応・最低限
    const gl = canvas.getContext('webgl');
    if (gl) {
      console.log('📱 WebGL対応検出 - 基本機能のみ');
      return 'webgl';
    }
    
    throw new Error('WebGL非対応ブラウザ - 3D描画不可');
  }

  /**
   * GPU性能評価・Tier判定
   */
  public static async evaluateGPUPerformance(): Promise<number> {
    // 簡易GPU性能テスト・描画速度測定
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 0;
    
    const startTime = performance.now();
    
    // 描画テスト実行
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    for (let i = 0; i < 100; i++) {
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    
    const endTime = performance.now();
    const fps = 100 / ((endTime - startTime) / 1000);
    
    console.log(`🎮 GPU性能評価: ${fps.toFixed(1)}FPS (テスト描画)`);
    return fps;
  }
}

/**
 * PixiJS統合管理・WebGPU/WebGL最適化
 */
export class PixiApplication {
  private app: PIXI.Application | null = null;
  private rendererType: RendererType = 'webgl';
  private rendererConfig: IRendererConfig | null = null;
  private container: HTMLElement | null = null;
  private isInitialized = false;

  constructor() {
    console.log('⚡ PixiApplication初期化準備');
  }

  /**
   * PixiJS初期化・段階的縮退戦略
   */
  public async initialize(container: HTMLElement): Promise<boolean> {
    try {
      this.container = container;
      
      // Step 1: レンダラー種別検出
      this.rendererType = await WebGPUDetector.detectSupport();
      
      // Step 2: Tier別設定適用
      this.rendererConfig = this.getRendererConfig(this.rendererType);
      
      // Step 3: PixiJS初期化実行
      const success = await this.initializePixiApp();
      
      if (success) {
        // Step 4: 2.5K環境最適化
        this.optimize2KEnvironment();
        
        // Step 5: コンテナ統合
        this.integrateWithContainer();
        
        this.isInitialized = true;
        console.log(`✅ PixiJS初期化成功 - ${this.rendererType.toUpperCase()}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ PixiJS初期化失敗:', error);
      return false;
    }
  }

  /**
   * Tier別レンダラー設定取得
   */
  private getRendererConfig(renderer: RendererType): IRendererConfig {
    const configs: Record<RendererType, IRendererConfig> = {
      webgpu: {
        renderer: 'webgpu',
        maxCanvasSize: { width: 2048, height: 2048 },
        targetFPS: 60,
        features: {
          antialias: true,
          multisampling: true,
          highPrecision: true,
          computeShaders: true
        },
        memoryLimits: {
          maxTextures: 1000,
          maxVertices: 100000,
          gcThreshold: 800 // 800MB
        }
      },
      webgl2: {
        renderer: 'webgl2',
        maxCanvasSize: { width: 1024, height: 1024 },
        targetFPS: 30,
        features: {
          antialias: true,
          multisampling: false,
          highPrecision: true,
          computeShaders: false
        },
        memoryLimits: {
          maxTextures: 500,
          maxVertices: 50000,
          gcThreshold: 400 // 400MB
        }
      },
      webgl: {
        renderer: 'webgl',
        maxCanvasSize: { width: 512, height: 512 },
        targetFPS: 20,
        features: {
          antialias: false,
          multisampling: false,
          highPrecision: false,
          computeShaders: false
        },
        memoryLimits: {
          maxTextures: 200,
          maxVertices: 20000,
          gcThreshold: 200 // 200MB
        }
      }
    };
    
    return configs[renderer];
  }

  /**
   * PixiJS Application初期化・設定適用
   */
  private async initializePixiApp(): Promise<boolean> {
    if (!this.rendererConfig) return false;
    
    const config = this.rendererConfig;
    const canvasSize = this.getOptimalCanvasSize();
    
    try {
      // PixiJS Application設定
      this.app = new PIXI.Application();
      
      await this.app.init({
        width: canvasSize.width,
        height: canvasSize.height,
        preference: config.renderer as any,
        powerPreference: 'high-performance',
        antialias: config.features.antialias,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0xffffee, // ふたば背景色
        clearBeforeRender: true,
        preserveDrawingBuffer: false // パフォーマンス優先
      });
      
      // レンダラー設定確認
      const actualRenderer = this.app.renderer.type;
      console.log(`📊 PixiJS設定:`, {
        targetRenderer: config.renderer,
        actualRenderer,
        canvasSize,
        devicePixelRatio: window.devicePixelRatio,
        antialias: config.features.antialias
      });
      
      // 性能監視設定
      this.app.ticker.maxFPS = config.targetFPS;
      this.app.ticker.minFPS = Math.max(10, config.targetFPS / 3);
      
      return true;
      
    } catch (error) {
      console.error('❌ PixiJS Application初期化失敗:', error);
      
      // フォールバック試行
      if (config.renderer !== 'webgl') {
        console.log('🔄 フォールバック試行中...');
        return this.fallbackToWebGL();
      }
      
      return false;
    }
  }

  /**
   * WebGLフォールバック・最終手段
   */
  private async fallbackToWebGL(): Promise<boolean> {
    try {
      this.rendererType = 'webgl';
      this.rendererConfig = this.getRendererConfig('webgl');
      
      const canvasSize = this.getOptimalCanvasSize();
      
      this.app = new PIXI.Application();
      
      await this.app.init({
        width: canvasSize.width,
        height: canvasSize.height,
        preference: 'webgl',
        antialias: false,
        resolution: 1, // 解像度下げる
        backgroundColor: 0xffffee
      });
      
      console.log('🔄 WebGLフォールバック成功');
      return true;
      
    } catch (error) {
      console.error('💥 WebGLフォールバック失敗:', error);
      return false;
    }
  }

  /**
   * 2.5K環境最適化・液タブレット対応
   */
  private optimize2KEnvironment(): void {
    if (!this.app || !this.rendererConfig) return;
    
    // 高解像度対応・デバイスピクセル比
    const dpr = window.devicePixelRatio || 1;
    const canvas = this.app.canvas;
    
    // CSS サイズ設定・2560×1440最適化
    const displayWidth = Math.min(window.innerWidth * 0.8, 2048);
    const displayHeight = Math.min(window.innerHeight * 0.8, 1440);
    
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.style.cursor = 'crosshair';
    canvas.style.touchAction = 'none'; // タッチ無効化
    
    // WebGPU専用最適化
    if (this.rendererType === 'webgpu') {
      // 高性能設定・60FPS目標
      this.app.ticker.maxFPS = 60;
      
      // GPU最適化
      if (this.app.renderer.gl) {
        const gl = this.app.renderer.gl;
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
    }
    
    console.log(`🎯 2.5K環境最適化完了:`, {
      displaySize: `${displayWidth}×${displayHeight}`,
      canvasSize: `${canvas.width}×${canvas.height}`,
      devicePixelRatio: dpr,
      renderer: this.rendererType
    });
  }

  /**
   * 最適キャンバスサイズ計算・2.5K対応
   */
  private getOptimalCanvasSize(): { width: number; height: number } {
    if (!this.rendererConfig) {
      return { width: 800, height: 600 };
    }
    
    const maxSize = this.rendererConfig.maxCanvasSize;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 2560×1440環境検出
    const is2K = windowWidth >= 2400 && windowHeight >= 1300;
    
    if (is2K && this.rendererType === 'webgpu') {
      // 2.5K・WebGPU環境・フル性能
      return {
        width: Math.min(maxSize.width, 2048),
        height: Math.min(maxSize.height, 1440)
      };
    }
    
    // 標準環境・制限適用
    return {
      width: Math.min(maxSize.width, Math.floor(windowWidth * 0.8)),
      height: Math.min(maxSize.height, Math.floor(windowHeight * 0.8))
    };
  }

  /**
   * HTMLコンテナ統合・DOM構造
   */
  private integrateWithContainer(): void {
    if (!this.app || !this.container) return;
    
    // Canvas追加・スタイル適用
    const canvas = this.app.canvas;
    canvas.className = 'drawing-canvas';
    
    // コンテナクリア・Canvas配置
    this.container.innerHTML = '';
    this.container.appendChild(canvas);
    
    // コンテナスタイル適用
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.background = '#ffffee'; // ふたば背景
    this.container.style.border = '2px solid #800000'; // ふたばマルーン
    this.container.style.borderRadius = '4px';
  }

  /**
   * レンダラー種別取得
   */
  public getRendererType(): RendererType {
    return this.rendererType;
  }

  /**
   * PixiJS Application取得
   */
  public getApp(): PIXI.Application | null {
    return this.app;
  }

  /**
   * Canvas要素取得
   */
  public getCanvas(): HTMLCanvasElement | null {
    return this.app?.canvas || null;
  }

  /**
   * レンダラー設定取得
   */
  public getRendererConfig(): IRendererConfig | null {
    return this.rendererConfig;
  }

  /**
   * 初期化状態確認
   */
  public isReady(): boolean {
    return this.isInitialized && this.app !== null;
  }

  /**
   * パフォーマンス情報取得
   */
  public getPerformanceInfo() {
    if (!this.app) return null;
    
    return {
      renderer: this.rendererType,
      fps: this.app.ticker.FPS,
      targetFPS: this.app.ticker.maxFPS,
      deltaTime: this.app.ticker.deltaTime,
      elapsedMS: this.app.ticker.elapsedMS,
      canvasSize: {
        width: this.app.canvas.width,
        height: this.app.canvas.height
      },
      displaySize: {
        width: this.app.canvas.clientWidth,
        height: this.app.canvas.clientHeight
      }
    };
  }

  /**
   * キャンバスリサイズ・動的対応
   */
  public resize(width?: number, height?: number): void {
    if (!this.app) return;
    
    const newSize = width && height 
      ? { width, height }
      : this.getOptimalCanvasSize();
    
    this.app.renderer.resize(newSize.width, newSize.height);
    
    console.log(`📏 キャンバスリサイズ: ${newSize.width}×${newSize.height}`);
  }

  /**
   * WebGPU専用機能有効確認
   */
  public hasWebGPUFeatures(): boolean {
    return this.rendererType === 'webgpu' && this.rendererConfig?.features.computeShaders === true;
  }

  /**
   * メモリ使用量監視・制限チェック
   */
  public checkMemoryUsage(): { used: number; limit: number; status: 'normal' | 'warning' | 'critical' } {
    if (!this.rendererConfig) {
      return { used: 0, limit: 0, status: 'normal' };
    }

    // TextureGC統計取得
    const textureGC = PIXI.TextureGCSystem;
    const textureCount = PIXI.Texture.from('').source?.resource ? 1 : 0; // 概算

    const limit = this.rendererConfig.memoryLimits.gcThreshold;
    const estimated = textureCount * 4; // 4MB per texture (概算)

    let status: 'normal' | 'warning' | 'critical' = 'normal';
    if (estimated > limit) status = 'critical';
    else if (estimated > limit * 0.8) status = 'warning';

    return { used: estimated, limit, status };
  }

  /**
   * 強制ガベージコレクション・メモリ解放
   */
  public forceGarbageCollection(): void {
    if (!this.app) return;

    // PIXI TextureGC強制実行
    this.app.renderer.textureGC.run();
    
    // Texture キャッシュクリア
    PIXI.Texture.removeFromCache();
    
    // Graphics プール解放
    PIXI.GraphicsGeometry.clear();

    console.log('🗑️ PixiJS強制GC実行完了');
  }

  /**
   * リソース解放・アプリケーション終了
   */
  public destroy(): void {
    if (!this.app) return;
    
    console.log('🔄 PixiApplication終了処理開始...');
    
    try {
      // PixiJS App破棄
      this.app.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true
      });
      
      // Canvas削除
      if (this.container && this.app.canvas.parentNode) {
        this.container.removeChild(this.app.canvas);
      }
      
      // 参照クリア
      this.app = null;
      this.container = null;
      this.rendererConfig = null;
      this.isInitialized = false;
      
      console.log('✅ PixiApplication終了処理完了');
      
    } catch (error) {
      console.error('⚠️ PixiApplication終了処理エラー:', error);
    }
  }
}