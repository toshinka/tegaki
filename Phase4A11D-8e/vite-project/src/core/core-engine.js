import { CanvasManager } from './canvas-manager.js';

(async () => {
  console.log("🛠️ アプリケーションの初期化を開始します...");
  const canvas = document.getElementById("drawingCanvas");
  console.log("🖼️ Canvas取得結果:", canvas);
  if (!canvas) {
    console.error("❌ canvasが取得できませんでした");
    return;
  }

  const app = {};
  app.canvasManager = new CanvasManager(app, canvas);

  window.toshinkaTegakiTool = app;
})();
