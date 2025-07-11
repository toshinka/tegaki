export class RenderingBridge {
  constructor(canvas) {
    console.log("🔍 RenderingBridge: canvas要素は", canvas);
    const gl = canvas.getContext("webgl") || canvas.getContext("webgl2");

    console.log("🔍 RenderingBridge: getContext(webgl/webgl2) 結果", gl);
    if (!gl) {
      console.error("❌ RenderingBridge: WebGLがサポートされていない、またはコンテキストの取得に失敗しました。");
      return;
    }

    console.log("✅ RenderingBridge: WebGL初期化成功");
    this.gl = gl;
  }
}
