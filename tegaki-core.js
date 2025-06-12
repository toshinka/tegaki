// FutabaTegakiTool.js
class FutabaTegakiTool {
    constructor() {
        // 各Managerのインスタンスを保持
        this.colorManager = null;
        this.toolManager = null;
        this.canvasManager = null;
        this.topBarManager = null;
        this.penSettingsManager = null;
        this.layerManager = null; // 予告: レイヤーマネージャー
        this.shortcutManager = null; // 予告: ショートカットマネージャー

        this.initManagers();
        this.bindGlobalEvents();
    }

    initManagers() {
        // 各Managerの初期化と依存関係の注入
        // 以下のインスタンス化は、それぞれのJSファイルが読み込まれた後に実行されることを想定
        this.colorManager = new ColorManager(this); // this (FutabaTegakiToolインスタンス) を渡す
        this.toolManager = new ToolManager(this);
        this.canvasManager = new CanvasManager(this);
        this.topBarManager = new TopBarManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        // this.layerManager = new LayerManager(this); // 予告: LayerManager
        // this.shortcutManager = new ShortcutManager(this); // 予告: ShortcutManager

        // 初期設定の適用など
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor('#800000'); // 初期メインカラー
        this.colorManager.setSubColor('#f0e0d6'); // 初期サブカラー
        this.colorManager.updateColorDisplays();
        this.canvasManager.saveState(); // 初期状態を履歴に保存
    }

    bindGlobalEvents() {
        // FutabaTegakiTool全体で監視すべきキーボードイベントなどをここで処理し、
        // 各Managerのメソッドを呼び出す
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleKeyDown(e) {
        // ToolManager, CanvasManager, ColorManager, ShortcutManagerなどに処理を委譲
        // ここで各Managerの適切なメソッドを呼び出す
        // 例: this.shortcutManager.handleKeyDown(e);
        // 既存のhandleKeyDownロジックをここに移植し、各Managerのメソッドを呼び出す形にリファクタリング
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;
        
        // スペースキーによるパニングの管理
        if (e.key === ' ' && !this.canvasManager.isSpaceDown) {
            this.canvasManager.isSpaceDown = true;
            this.canvasManager.updateCursor();
            e.preventDefault();
        }

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
            return;
        }

        let handled = true;
        if (e.ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.canvasManager.undo(); break;
                case 'y': this.canvasManager.redo(); break;
                default: handled = false;
            }
        } else if (e.shiftKey) {
            switch (e.key) {
                case '}': // Shift + [ (JIS配列の場合)
                    this.colorManager.changeColor(true); // 上方向
                    break;
                case '{': // Shift + ] (JIS配列の場合)
                    this.colorManager.changeColor(false); // 下方向
                    break;
                default:
                    switch (e.key.toLowerCase()) {
                        case 'h': this.canvasManager.flipVertical(); break;
                        case 'arrowup': this.canvasManager.zoom(1.20); break;
                        case 'arrowdown': this.canvasManager.zoom(1 / 1.20); break;
                        case 'arrowleft': this.canvasManager.rotate(-15); break;
                        case 'arrowright': this.canvasManager.rotate(15); break;
                        default: handled = false;
                    }
            }
        } else {
             switch (e.key.toLowerCase()) {
                case '[': this.penSettingsManager.changeSize(false); break;
                case ']': this.penSettingsManager.changeSize(true); break;
                case 'x': this.colorManager.swapColors(); break;
                case 'd': this.colorManager.resetColors(); break;
                default:
                    switch (e.key.toLowerCase()) {
                        case 'p': this.toolManager.setTool('pen'); break;
                        case 'e': this.toolManager.setTool('eraser'); break;
                        case 'v': this.toolManager.setTool('move'); break;
                        case 'h': this.canvasManager.flipHorizontal(); break;
                        case '1': this.canvasManager.resetView(); break;
                        case 'arrowup': this.canvasManager.zoom(1.05); break;
                        case 'arrowdown': this.canvasManager.zoom(1 / 1.05); break;
                        case 'arrowleft': this.canvasManager.rotate(-5); break;
                        case 'arrowright': this.canvasManager.rotate(5); break;
                        default: handled = false;
                    }
            }
        }
        if (handled) e.preventDefault();
    }

    handleKeyUp(e) {
        if (e.key === ' ') {
            this.canvasManager.isSpaceDown = false;
            this.canvasManager.updateCursor();
            e.preventDefault();
        }
    }

    // 他のManagerが呼び出すための共通メソッド（必要に応じて）
    // 例:
    // getCurrentColor() { return this.colorManager.getCurrentColor(); }
    // getCurrentSize() { return this.penSettingsManager.getCurrentSize(); }
}

// ツール初期化フラグとインスタンス生成
if (!window.futabaTegakiInitialized) {
    window.futabaTegakiInitialized = true;
    window.futabaTegakiTool = new FutabaTegakiTool();
}
