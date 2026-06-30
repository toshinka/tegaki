/**
 * @file WebGPUContext.ts
 * @description WebGPUの初期化とコンテキスト管理を行います。
 * @relatedFiles src/engine/Renderer.ts
 * @mainFunctions initWebGPU(), getDevice()
 */

export class WebGPUContext {
  private static instance: WebGPUContext | null = null;
  public device: GPUDevice | null = null;
  public context: GPUCanvasContext | null = null;
  public format: GPUTextureFormat | null = null;

  private constructor() {}

  public static getInstance(): WebGPUContext {
    if (!WebGPUContext.instance) {
      WebGPUContext.instance = new WebGPUContext();
    }
    return WebGPUContext.instance;
  }

  public async init(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!navigator.gpu) {
      console.error("WebGPU is not supported on this browser.");
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance', // 4070等の強力なGPUを優先
    });

    if (!adapter) {
      console.error("Failed to get GPUAdapter.");
      return false;
    }

    this.device = await adapter.requestDevice();
    this.context = canvas.getContext("webgpu") as GPUCanvasContext;

    if (!this.context) {
      console.error("Failed to get GPUCanvasContext.");
      return false;
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied', // 背景との合成用
    });

    return true;
  }
}

export const webGPUContext = WebGPUContext.getInstance();
