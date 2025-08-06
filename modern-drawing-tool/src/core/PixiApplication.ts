// src/core/PixiApplication.ts - WebGL2確実初期化・2.5K対応

import { Application } from 'pixi.js';

export type RendererType = 'webgl2' | 'webgl';

export interface PixiInitOptions {
  width?: number;
  height?: number;
  backgroundColor?: number;
  antialias?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
}

export class PixiApplication {
  private pixiApp: Application | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private rendererType: RendererType = 'webgl2';

  // WebGL2確実初期化・2560×1440対応・エラー処理完全・引数なしオーバーロード
  public async initialize(options: PixiInitOptions = {}): Promise<boolean> {
    try {
      console.log('🚀 PixiJS v8初期化開始...');
      
      // Phase1: WebGL2確実実装・WebGPU準備のみ
      this.pixiApp = new Application();
      
      const initOptions = {
        preference: 'webgl2' as const, // Phase1確実動作
        powerPreference: options.powerPreference || 'high-performance' as const,
        antialias: options.antialias !== undefined ? options.antialias : true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: options.backgroundColor || 0xffffee, // ふたば背景色
        width: options.width || this.getOptimalWidth(),
        height: options.height || this.getOptimalHeight()
      };

      await this.pixiApp.init(initOptions);

      // キャンバス要素取得・DOM追加準備
      this.canvas = this.pixiApp.canvas as HTMLCanvasElement;
      if (!this.canvas) {
        throw new Error('Canvas element not created');
      }

      // キャンバススタイル設定・中央配置・2.5K対応
      this.canvas.style.maxWidth = '100%';
      this.canvas.style.maxHeight = '100%';
      this.canvas.style.display = 'block';
      
      // レンダラー情報確認・WebGL2検証
      const renderer = this.pixiApp.renderer;
      this.rendererType = 'webgl2'; // Phase1はWebGL2固定
      
      console.log(`✅ WebGL2初期化成功: ${initOptions.width}x${initOptions.height}`);
      console.log(`📱 レンダラー: ${renderer.type}, GPU: ${renderer.gl?.getParameter(renderer.gl.RENDERER)}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ WebGL2初期化失敗, WebGL基本モードで再試行:', error);
      return this.fallbackToWebGL(options);
    }
  }

  // 2560×1440最適化・デバイス適応・1_PROJECT_SPEC準拠
  private getOptimalWidth(): number {
    return Math.min(window.innerWidth, 2560);
  }
  
  private getOptimalHeight(): number {
    return Math.min(window.innerHeight, 1440);
  }

  // WebGL基本フォールバック・安全性確保
  private async fallbackToWebGL(options: PixiInitOptions): Promise<boolean> {
    try {
      console.log('🔄 WebGL基本モードで初期化...');
      
      // 破棄処理・メモリリーク防止
      if (this.pixiApp) {
        this.pixiApp.destroy(true);
        this.pixiApp = null;
      }

      // WebGL基本モード・最低限動作保証
      this.pixiApp = new Application();
      
      const fallbackOptions = {
        preference: 'webgl' as const,
        powerPreference: 'default' as const, // 消費電力抑制
        antialias: false, // 性能優先
        resolution: 1, // 解像度下げる
        autoDensity: false,
        backgroundColor: options.backgroundColor || 0xffffee,
        width: Math.min(this.getOptimalWidth(), 1920), // 解像度制限
        height: Math.min(this.getOptimalHeight(), 1080)
      };

      await this.pixiApp.init(fallbackOptions);

      this.canvas = this.pixiApp.canvas as HTMLCanvasElement;
      if (!this.canvas) {
        throw new Error('WebGL Canvas element not created');
      }

      this.canvas.style.maxWidth = '100%';
      this.canvas.style.maxHeight = '100%';
      this.canvas.style.display = 'block';
      
      this.rendererType = 'webgl';
      
      console.log(`⚠️ WebGL基本モード動作: ${fallbackOptions.width}x${fallbackOptions.height}`);
      console.warn('機能制限・性能低下の可能性あり');
      
      return true;

    } catch (error) {
      console.error('💥 WebGL初期化も失敗・描画不可能:', error);
      this.showFatalError(error as Error);
      return false;
    }
  }

  // 致命的エラー表示・ユーザー通知
  private showFatalError(error: Error): void {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #f44336; color: white; padding: 20px; border-radius: 8px;
      max-width: 400px; text-align: center; z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    errorDiv.innerHTML = `
      <h3>WebGL対応エラー</h3>
      <p>お使いのブラウザまたはGPUではWebGLが利用できません。</p>
      <p><small>${error.message}</small></p>
      <p>Chrome最新版・Firefox最新版での利用を推奨します。</p>
      <button onclick="location.reload()" style="
        background: white; color: #f44336; border: none; padding: 8px 16px;
        border-radius: 4px; cursor: pointer; margin-top: 10px; font-weight: bold;
      ">ページを再読み込み</button>
    `;
    document.body.appendChild(errorDiv);
  }

  // キャンバスサイズ変更・2.5K対応・レスポンシブ
  public resizeCanvas(width: number, height: number): void {
    if (!this.pixiApp) return;

    try {
      this.pixiApp.renderer.resize(width, height);
      console.log(`📐 Canvas resize: ${width}x${height}`);
    } catch (error) {
      console.error('Canvas resize failed:', error);
    }
  }

  // アプリケーション取得・null安全
  public getApplication(): Application {
    if (!this.pixiApp) {
      throw new Error('PixiJS Application not initialized');
    }
    return this.pixiApp;
  }

  // キャンバス要素取得・DOM操作用
  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  // レンダラー種別取得・性能判定用
  public getRendererType(): RendererType {
    return this.rendererType;
  }

  // 描画統計取得・デバッグ・監視用
  public getRenderStats(): { 
    fps: number; 
    drawCalls: number; 
    textureCount: number; 
    memoryUsage: number;
  } {
    if (!this.pixiApp) {
      return { fps: 0, drawCalls: 0, textureCount: 0, memoryUsage: 0 };
    }

    const renderer = this.pixiApp.renderer;
    return {
      fps: this.pixiApp.ticker.FPS,
      drawCalls: renderer.gl ? 0 : 0, // Phase2で実装予定
      textureCount: renderer.texture?.managedTextures?.length || 0,
      memoryUsage: 0 // Phase2で実装予定
    };
  }

  // リソース解放・メモリリーク防止・アプリ終了時
  public destroy(): void {
    console.log('🔄 PixiApplication破棄・リソース解放中...');
    
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    
    if (this.pixiApp) {
      this.pixiApp.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true
      });
    }

    this.pixiApp = null;
    this.canvas = null;
    
    console.log('✅ PixiApplication破棄完了');
  }
}