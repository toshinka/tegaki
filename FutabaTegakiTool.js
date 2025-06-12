// FutabaTegakiTool.js
/**
 * FutabaTegakiToolクラス
 * アプリケーション全体のメインエントリポイントとして機能し、
 * 各マネージャーのインスタンス化とグローバルイベントのバインドを行います。
 */
class FutabaTegakiTool {
    constructor() {
        // 各Managerのインスタンスを保持するプロパティ
        this.colorManager = null;
        this.toolManager = null;
        this.canvasManager = null;
        this.topBarManager = null;
        this.penSettingsManager = null;
        this.layerManager = null; // レイヤーマネージャーを追加
        this.shortcutManager = null; // ショートカットマネージャー

        // CanvasManagerが使用するメインのcanvas要素への参照
        // LayerManagerがこのcanvasをテンプレートとして使用するため、constructorで取得しておく
        this.canvas = document.getElementById('drawingCanvas'); 
        this.canvasContainer = document.getElementById('canvas-container'); // canvasContainerも取得
        
        // CanvasManagerのctxを直接持つのではなく、layerManager経由でアクティブレイヤーのctxを参照するようにする
        // これはCanvasManager.setTargetLayer()で設定されるため、初期値はnullのままで良い
        this.ctx = null; 

        this.initManagers();
        this.bindGlobalEvents();
    }

    /**
     * 各Managerのインスタンスを初期化し、依存関係を注入します。
     * FutabaTegakiToolインスタンス (this) を各Managerのコンストラクタに渡します。
     */
    initManagers() {
        this.colorManager = new ColorManager(this);
        this.toolManager = new ToolManager(this);
        this.canvasManager = new CanvasManager(this); // CanvasManagerもthisを渡す
        this.topBarManager = new TopBarManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.layerManager = new LayerManager(this); // LayerManagerを初期化

        // 初期設定の適用など
        this.toolManager.setTool('pen'); // 初期ツールをペンに設定
        this.penSettingsManager.setSize(1); // 初期ペンサイズを設定
        this.colorManager.setColor('#800000'); // 初期メインカラーを設定
        this.colorManager.setSubColor('#f0e0d6'); // 初期サブカラーを設定
        this.colorManager.updateColorDisplays(); // カラー表示を更新

        // LayerManagerが初期レイヤーを作成した後、CanvasManagerに描画対象を設定
        // アクティブなレイヤーはLayerManagerが管理し、CanvasManagerはそのレイヤーのコンテキストを使用する
        this.canvasManager.setTargetLayer(this.layerManager.getActiveLayer());
        // console.log("Initial active layer set to CanvasManager:", this.layerManager.getActiveLayer().name); // デバッグ

        // 初期の履歴を保存 (アクティブレイヤーの初期状態を保存)
        // LayerManagerのsaveLayerStateを呼び出すことで、現在アクティブなレイヤーの履歴が保存される
        this.layerManager.saveLayerState(this.layerManager.getActiveLayer().id);
    }

    /**
     * アプリケーション全体で監視すべきグローバルイベント（キーボードイベントなど）をバインドします。
     */
    bindGlobalEvents() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    /**
     * グローバルなキーダウンイベントを処理し、各Managerに適切なアクションを委譲します。
     * @param {KeyboardEvent} e - キーボードイベントオブジェクト
     */
    handleKeyDown(e) {
        // INPUTやTEXTAREA要素での入力、またはキーリピートの場合は処理しない
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;
        
        // スペースキーによるパニングの管理
        if (e.key === ' ' && !this.canvasManager.isSpaceDown) {
            this.canvasManager.isSpaceDown = true;
            this.canvasManager.updateCursor();
            e.preventDefault(); // デフォルトのスクロールを抑制
        }

        // スペースキーが押されている間のパンニング操作
        if (this.canvasManager.isSpaceDown) {
            let handled = true;
            const moveAmount = 10;
            switch(e.key) {
                case 'ArrowUp': this.canvasManager.setAbsolutePosition(); this.canvasManager.canvasContainer.style.top = (parseFloat(this.canvasManager.canvasContainer.style.top) - moveAmount) + 'px'; break;
                case 'ArrowDown': this.canvasManager.setAbsolutePosition(); this.canvasManager.canvasContainer.style.top = (parseFloat(this.canvasManager.canvasContainer.style.top) + moveAmount) + 'px'; break;
                case 'ArrowLeft': this.canvasManager.setAbsolutePosition(); this.canvasManager.canvasContainer.style.left = (parseFloat(this.canvasManager.canvasContainer.style.left) - moveAmount) + 'px'; break;
                case 'ArrowRight': this.canvasManager.setAbsolutePosition(); this.canvasManager.canvasContainer.style.left = (parseFloat(this.canvasManager.canvasContainer.style.left) + moveAmount) + 'px'; break;
                default: handled = false;
            }
            if(handled) e.preventDefault();
            return; // スペースキーが押されている間は他のショートカットを処理しない
        }
        
        let handled = true;
        if (e.ctrlKey) {
            // Ctrlキーが押されている場合のショートカット
            switch (e.key.toLowerCase()) {
                case 'z': this.canvasManager.undo(); break; // Undo
                case 'y': this.canvasManager.redo(); break; // Redo
                default: handled = false;
            }
        } else if (e.shiftKey) {
            // Shiftキーが押されている場合のショートカット
            switch (e.key) {
                case '}': // Shift + [ (JIS配列の場合) - カラーパレットを上に移動
                    this.colorManager.changeColor(false); 
                    break;
                case '{': // Shift + ] (JIS配列の場合) - カラーパレットを下に移動
                    this.colorManager.changeColor(true); 
                    break;
                default:
                    switch (e.key.toLowerCase()) {
                        case 'h': this.canvasManager.flipVertical(); break; // 上下反転
                        case 'arrowup': this.canvasManager.zoom(1.20); break; // 拡大
                        case 'arrowdown': this.canvasManager.zoom(1 / 1.20); break; // 縮小
                        case 'arrowleft': this.canvasManager.rotate(-15); break; // 反時計回り回転
                        case 'arrowright': this.canvasManager.rotate(15); break; // 時計回り回転
                        default: handled = false;
                    }
            }
        } else {
            // Ctrl/Shiftキーが押されていない場合のショートカット
            switch (e.key.toLowerCase()) {
                case '[': this.penSettingsManager.changeSize(false); break; // ペンサイズ縮小
                case ']': this.penSettingsManager.changeSize(true); break; // ペンサイズ拡大
                case 'x': this.colorManager.swapColors(); break; // メイン/サブカラー入れ替え
                case 'd': this.colorManager.resetColors(); break; // カラーリセット
                case 'g': this.toolManager.setTool('bucket'); break; // バケツツール
                case 'p': this.toolManager.setTool('pen'); break; // ペンツール
                case 'e': this.toolManager.setTool('eraser'); break; // 消しゴムツール
                case 'v': this.toolManager.setTool('move'); break; // レイヤー移動ツール
                case 'h': this.canvasManager.flipHorizontal(); break; // 左右反転
                case '1': this.canvasManager.resetView(); break; // 表示リセット
                case 'arrowup': this.canvasManager.zoom(1.05); break; // 微妙に拡大
                case 'arrowdown': this.canvasManager.zoom(1 / 1.05); break; // 微妙に縮小
                case 'arrowleft': this.canvasManager.rotate(-5); break; // 微妙に反時計回り回転
                case 'arrowright': this.canvasManager.rotate(5); break; // 微妙に時計回り回転
                default: handled = false;
            }
        }
        if (handled) e.preventDefault(); // デフォルトのイベント動作を抑制
    }

    /**
     * グローバルなキーアップイベントを処理します。
     * @param {KeyboardEvent} e - キーボードイベントオブジェクト
     */
    handleKeyUp(e) {
        if (e.key === ' ') {
            this.canvasManager.isSpaceDown = false;
            this.canvasManager.updateCursor(); // カーソルを通常に戻す
            e.preventDefault();
        }
    }

    // 他のManagerが呼び出すための共通メソッド（必要に応じて）
    // 例:
    // getCurrentColor() { return this.colorManager.getCurrentColor(); }
    // getCurrentSize() { return this.penSettingsManager.getCurrentSize(); }
}

// ツール初期化フラグとインスタンス生成
// このスクリプトが複数回読み込まれることを防ぐためのガード
if (!window.futabaTegakiInitialized) {
    // futabaTegakiInitializedフラグはHTMLファイル側で管理
    // window.futabaTegakiInitialized = true; // HTML側で設定済み
    // window.futabaTegakiTool = new FutabaTegakiTool(); // HTML側でロード完了後に呼び出し
}
