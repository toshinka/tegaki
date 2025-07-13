import CanvasManager from '../canvas/CanvasManager.js';
import DrawingEngine from '../canvas/DrawingEngine.js';
import InputHandler from '../events/InputHandler.js';
import ToolManager from '../tools/ToolManager.js';
import UIManager from '../ui/UIManager.js';

// State (状態管理)
import PenState from '../state/PenState.js';
import ColorState from '../state/ColorState.js';
import ToolState from '../state/ToolState.js';

// Tools (道具)
import PenTool from '../tools/PenTool.js';
import EraserTool from '../tools/EraserTool.js';


class App {
    constructor(container) {
        // --- 1. 状態管理クラスを初期化 ---
        this.penState = new PenState();
        this.colorState = new ColorState();
        this.toolState = new ToolState();

        // --- 2. 主要なモジュールを初期化 ---
        this.canvasManager = new CanvasManager(container);
        this.drawingEngine = new DrawingEngine(this.canvasManager.getContext());
        this.toolManager = new ToolManager(this.toolState); // ToolStateを渡す
        this.inputHandler = new InputHandler(this.canvasManager.getCanvas());
        
        // --- 3. UIマネージャーを初期化し、状態を渡す ---
        this.uiManager = new UIManager(this.penState, this.colorState, this.toolState);

        // --- 4. ツールを登録 ---
        // PenStateとColorStateをツールに渡して、描画時に最新の状態を使えるようにする
        const penTool = new PenTool(this.drawingEngine, this.penState, this.colorState);
        const eraserTool = new EraserTool(this.drawingEngine, this.penState);
        this.toolManager.addTool('pen', penTool);
        this.toolManager.addTool('eraser', eraserTool);
        
        // ToolStateの初期値に応じて、最初のツールを設定
        this.toolManager.setActiveTool(this.toolState.getActiveTool());


        // --- 5. 入力イベントをツールマネージャーに接続 ---
        this.inputHandler.on('drawStart', (pos) => this.toolManager.onDrawStart(pos));
        this.inputHandler.on('drawMove', (pos) => this.toolManager.onDrawMove(pos));
        this.inputHandler.on('drawEnd', (pos) => this.toolManager.onDrawEnd(pos));
    }
}

export default App;