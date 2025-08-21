// PixiJSアプリケーションを作成（表示サイズ400x400、内部解像度800x800）
const app = new PIXI.Application({
    width: 400,
    height: 400,
    backgroundColor: 0xffffff, // 白背景
    resolution: 1, // 高DPI対応で内部解像度を2倍
    antialias: true // アンチエイリアス有効で滑らかに
});
document.body.appendChild(app.view);

// ここを追加: 表示サイズをCSSで400pxに固定（これで内部高解像度でも見た目が400x400になる）
app.view.style.width = '400px';
app.view.style.height = '400px';

// Graphicsオブジェクトを作成（描画用）
const graphics = new PIXI.Graphics();
app.stage.addChild(graphics);

// 描画状態の変数
let isDrawing = false;
let lastPosition = { x: 0, y: 0 };

// イベントを有効化（pointerイベントでマウス/タッチ対応）
app.stage.interactive = true;
app.stage.hitArea = new PIXI.Rectangle(0, 0, 400, 400);

// pointerdownイベント（描画開始）
app.stage.on('pointerdown', (event) => {
    isDrawing = true;
    const pos = event.data.getLocalPosition(app.stage);
    lastPosition = { x: pos.x, y: pos.y };
    
    // 開始点に小さな円を描いて点として表示（線がつながるように）
    graphics.lineStyle(5, 0x000000, 1); // ペン: 太さ5、黒、不透明度1
    graphics.moveTo(pos.x, pos.y);
    graphics.lineTo(pos.x, pos.y); // 自分自身への線で点描画
});

// pointermoveイベント（描画中）
app.stage.on('pointermove', (event) => {
    if (!isDrawing) return;
    const pos = event.data.getLocalPosition(app.stage);
    
    // 線を描画
    graphics.moveTo(lastPosition.x, lastPosition.y);
    graphics.lineTo(pos.x, pos.y);
    
    lastPosition = { x: pos.x, y: pos.y };
});

// pointerupイベント（描画終了）
app.stage.on('pointerup', () => {
    isDrawing = false;
});