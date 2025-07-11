import { RenderingBridge } from './rendering/rendering-bridge.js';

export class CanvasManager {
  constructor(app, canvas) {
    this.app = app;
    this.canvas = canvas;

    if (!this.canvas) {
      console.error("❌ CanvasManager: canvasがnullです");
      return;
    }

    this.bridge = new RenderingBridge(this.canvas);

    console.log("✅ CanvasManager: 初期化成功");
  }
}
