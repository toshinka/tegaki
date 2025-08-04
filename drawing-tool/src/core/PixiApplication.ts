// PixiApplication.ts - PixiJS v8統合・WebGPU/WebGL2自動切り替え
// 2.5K最適化・段階的縮退戦略・性能監視

import { Application, ApplicationOptions } from 'pixi.js';

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
    // Phase1では確実なWebGL2を優先（WebGPUは準備のみ）
    console.log('⚡ レンダラー検出開始...');
    
    // WebGL2フォールバック・確実動作
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      // WebGL2性能チェック
      const maxTextureSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE);
      const maxVertexAttribs = gl2.getParameter(gl2.MAX_VERTEX_ATTRIBS);
      
      console.log('✅ WebGL2対応検出:', {
        maxTextureSize,
        maxVertexAttribs,
        extensions: gl2.getSupportedExtensions()?.length || 0
      });
      
      return 'webgl2';
    }
    
    // WebGL基本対応・最低限
    const gl = canvas.getContext('webgl');
    if (gl) {
      console.log('⚠️ WebGL対応検出 - WebGL2非対応');
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
  private app: Application | null = null;
  private rendererType: RendererType = 'webgl2';
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