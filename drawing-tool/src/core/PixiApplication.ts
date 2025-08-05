import * as PIXI from 'pixi.js';

export class PixiApplication {
  private pixiApp: PIXI.Application | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: 'webgpu' | 'webgl2' | 'webgl' = 'webgl2';

  public async initialize(container: HTMLElement): Promise<boolean> {
    try {
      console.log('PixiJS初期化開始...');
      
      // Phase1: WebGL2確実実装・参考資料のWebGPU準備継承
      this.pixiApp = new PIXI.Application();
      await this.pixiApp.init({
        preference: 'webgl2', // Phase1確実動作
        powerPreference: 'high-performance',
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0xffffee, // ふたば背景色・参考資料継承
        width: this.getOptimalWidth(),
        height: this.getOptimalHeight()
      });

      this.canvas = this.pixiApp.canvas;
      container.appendChild(this.canvas);
      
      this.renderer = 'webgl2';
      console.log('WebGL2初期化成功・WebGPU準備完了');
      return true;
      
    } catch (error) {
      console.error('初期化失敗:', error);
      return false;
    }
  }

  // 2560×1440最適化・参考資料の2.5K対応継承
  private getOptimalWidth(): number {
    return Math.min(window.innerWidth, 2560);
  }
  
  private getOptimalHeight(): number {
    return Math.min(window.innerHeight, 1440);
  }

  public getApp(): PIXI.Application | null {
    return this.pixiApp;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  public getRendererType(): string {
    return this.renderer;
  }

  public destroy(): void {
    if (this.pixiApp) {
      this.pixiApp.destroy(true);
      this.pixiApp = null;
    }
  }
}