/**
 * 🎨 Tegaki Main v3 - 怪物撲滅版（描画機能完全版）
 * 📋 RESPONSIBILITY: キャンバス作成・PixiJS初期化・描画機能・UI連携
 * 🚫 PROHIBITION: 段階分岐・複雑な条件分岐・過度な検証・診断機能
 * ✅ PERMISSION: 直接的キャンバス作成・完全な描画処理・シンプルUI
 * 
 * 📏 DESIGN_PRINCIPLE: 200行 → 実用的シンプル構造
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * TegakiApplication v3 - 完全動作版
 * Constructor内で全初期化＋描画機能完了
 */
class TegakiApplication {
    constructor() {
        console.log('🎨 TegakiApplication v3 開始 - 完全動作版');
        
        // Step 1: キャンバス作成（最優先・例外隠蔽禁止）
        this.createCanvas();
        
        // Step 2: Manager初期化
        this.initializeManagers();
        
        // Step 3: 描画システム設定
        this.setupDrawingSystem();
        
        // Step 4: UI設定
        this.setupUI();
        
        console.log('✅ TegakiApplication v3 初期化完了');
        this.showSuccess();
    }
    
    /**
     * Step 1: キャンバス作成（例外隠蔽禁止）
     */
    createCanvas() {
        const container = document.getElementById('canvas-container');
        if (!container) {
            throw new Error('Canvas container #canvas-container not found');
        }
        
        // PixiJS Application作成
        this.pixiApp = new PIXI.Application({
            width: 400,
            height: 400,
            backgroundColor: 0xffffee, // #ffffee
            antialias: true,
            resolution: 1,
            autoDensity: false
        });
        
        container.appendChild(this.pixiApp.view);
        
        // 描画用コンテナ作成
        this.drawingContainer = new PIXI.Container();
        this.pixiApp.stage.addChild(this.drawingContainer);
        
        console.log('✅ キャンバス作成完了:', {
            width: this.pixiApp.view.width,
            height: this.pixiApp.view.height,
            visible: this.pixiApp.view.offsetWidth > 0
        });
    }
    
    /**
     * Step 2: Manager初期化
     */
    initializeManagers() {
        // CanvasManager作成・設定
        this.canvasManager = new window.Tegaki.CanvasManager();
        this.canvasManager.setPixiApp(this.pixiApp);
        window.Tegaki.CanvasManagerInstance = this.canvasManager;
        
        // ToolManager作成・設定
        this.toolManager = new window.Tegaki.ToolManager();
        this.toolManager.setCanvasManager(this.canvasManager);
        window.Tegaki.ToolManagerInstance = this.toolManager;
        
        console.log('✅ Manager初期化完了');
    }
    
    /**
     * Step 3: 描画システム設定
     */
    setupDrawingSystem() {
        // 描画設定
        this.isDrawing = false;
        this.currentPath = null;
        this.currentTool = 'pen';
        
        // 描画プロパティ
        this.penColor = 0x800000;  // ふたばマルーン
        this.penWidth = 2;
        this.eraserSize = 10;
        
        // デフォルトツール選択
        this.toolManager.selectTool('pen');
        
        console.log('✅ 描画システム設定完了');
    }
    
    /**
     * Step 4: UI設定
     */
    setupUI() {
        // キャンバスイベント設定
        this.setupCanvasEvents();
        
        // ツールボタン設定
        this.setupToolButtons();
        
        // ステータス更新開始
        this.setupStatusUpdates();
        
        console.log('✅ UI設定完了');
    }
    
    /**
     * キャンバスイベント設定（完全な描画機能）
     */
    setupCanvasEvents() {
        const canvas = this.pixiApp.view;
        
        // Pointer Events（統一的な入力処理）
        canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        canvas.addEventListener('pointerout', (e) => this.handlePointerUp(e));
        
        // コンテキストメニュー無効化
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        console.log('✅ キャンバスイベント設定完了');
    }
    
    /**
     * ポインター開始処理
     */
    handlePointerDown(event) {
        const coords = this.getCanvasCoordinates(event);
        this.isDrawing = true;
        
        // 新しいパス作成
        this.currentPath = this.createNewPath(coords.x, coords.y);
        
        // 座標更新
        this.updateCoordinates(coords.x, coords.y);
        
        // ToolManagerにも通知
        if (this.toolManager) {
            this.toolManager.handlePointerDown(coords.x, coords.y, event);
        }
        
        console.log(`🖊️ 描画開始: ${this.currentTool} at (${coords.x}, ${coords.y})`);
    }
    
    /**
     * ポインター移動処理
     */
    handlePointerMove(event) {
        const coords = this.getCanvasCoordinates(event);
        
        // 座標更新
        this.updateCoordinates(coords.x, coords.y);
        
        // 描画中の場合、線を延長
        if (this.isDrawing && this.currentPath) {
            this.extendPath(coords.x, coords.y);
        }
        
        // ToolManagerにも通知
        if (this.toolManager) {
            this.toolManager.handlePointerMove(coords.x, coords.y, event);
        }
    }
    
    /**
     * ポインター終了処理
     */
    handlePointerUp(event) {
        if (!this.isDrawing) return;
        
        const coords = this.getCanvasCoordinates(event);
        
        // 描画終了
        this.isDrawing = false;
        if (this.currentPath) {
            this.finalizePath(coords.x, coords.y);
            this.currentPath = null;
        }
        
        // ToolManagerにも通知
        if (this.toolManager) {
            this.toolManager.handlePointerUp(coords.x, coords.y, event);
        }
        
        console.log(`🖊️ 描画終了: ${this.currentTool}`);
    }
    
    /**
     * 新しいパス作成
     */
    createNewPath(x, y) {
        const graphics = new PIXI.Graphics();
        
        if (this.currentTool === 'pen') {
            // ペンツール: ふたばマルーン色で描画
            graphics.lineStyle(this.penWidth, this.penColor, 1.0);
            graphics.beginFill(this.penColor);
            graphics.drawCircle(x, y, this.penWidth / 2);
            graphics.endFill();
            graphics.moveTo(x, y);
        } else if (this.currentTool === 'eraser') {
            // 消しゴムツール: 背景色で描画（消去効果）
            graphics.lineStyle(this.eraserSize, 0xffffee, 1.0);
            graphics.beginFill(0xffffee);
            graphics.drawCircle(x, y, this.eraserSize / 2);
            graphics.endFill();
            graphics.moveTo(x, y);
        }
        
        // 描画コンテナに追加
        this.drawingContainer.addChild(graphics);
        
        return {
            graphics: graphics,
            tool: this.currentTool,
            startTime: Date.now(),
            points: [{ x, y }]
        };
    }
    
    /**
     * パス延長
     */
    extendPath(x, y) {
        if (!this.currentPath || !this.currentPath.graphics) return;
        
        const graphics = this.currentPath.graphics;
        
        // 線を描画
        graphics.lineTo(x, y);
        
        // 円形ブラシで滑らかに
        if (this.currentTool === 'pen') {
            graphics.beginFill(this.penColor);
            graphics.drawCircle(x, y, this.penWidth / 2);
            graphics.endFill();
        } else if (this.currentTool === 'eraser') {
            graphics.beginFill(0xffffee);
            graphics.drawCircle(x, y, this.eraserSize / 2);
            graphics.endFill();
        }
        
        // ポイント記録
        this.currentPath.points.push({ x, y });
    }
    
    /**
     * パス完了
     */
    finalizePath(x, y) {
        if (!this.currentPath) return;
        
        // 最終点追加
        this.extendPath(x, y);
        
        // パス情報更新
        this.currentPath.endTime = Date.now();
        this.currentPath.duration = this.currentPath.endTime - this.currentPath.startTime;
        
        console.log(`✅ パス完了: ${this.currentPath.points.length}点, ${this.currentPath.duration}ms`);
    }
    
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
        // ペンツールボタン
        const penButton = document.getElementById('pen-tool');
        if (penButton) {
            penButton.addEventListener('click', () => {
                this.selectTool('pen');
                this.updateActiveButton(penButton);
            });
        }
        
        // 消しゴムツールボタン
        const eraserButton = document.getElementById('eraser-tool');
        if (eraserButton) {
            eraserButton.addEventListener('click', () => {
                this.selectTool('eraser');
                this.updateActiveButton(eraserButton);
            });
        }
        
        console.log('✅ ツールボタン設定完了');
    }
    
    /**
     * ツール選択
     */
    selectTool(toolName) {
        this.currentTool = toolName;
        
        // ToolManagerにも通知
        if (this.toolManager) {
            this.toolManager.selectTool(toolName);
        }
        
        // ステータス更新
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const statusElement = document.getElementById('current-tool');
        if (statusElement) {
            statusElement.textContent = toolNames[toolName] || toolName;
        }
        
        console.log(`🔧 ツール切り替え: ${toolName}`);
    }
    
    /**
     * アクティブボタン更新
     */
    updateActiveButton(activeButton) {
        // 全ボタンのactiveクラス削除
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 選択ボタンにactiveクラス追加
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    /**
     * ステータス更新設定
     */
    setupStatusUpdates() {
        // FPS監視
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        
        // 座標初期化
        this.updateCoordinates(0, 0);
        
        // FPSカウンター開始
        this.startFpsCounter();
        
        console.log('✅ ステータス更新設定完了');
    }
    
    /**
     * 座標更新
     */
    updateCoordinates(x, y) {
        const coordsElement = document.getElementById('coordinates');
        if (coordsElement) {
            coordsElement.textContent = `x: ${x}, y: ${y}`;
        }
    }
    
    /**
     * FPSカウンター開始
     */
    startFpsCounter() {
        const updateFps = () => {
            this.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.lastFpsUpdate >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                this.frameCount = 0;
                this.lastFpsUpdate = currentTime;
            }
            
            requestAnimationFrame(updateFps);
        };
        
        updateFps();
    }
    
    /**
     * キャンバス情報更新
     */
    updateCanvasInfo() {
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${this.pixiApp.view.width}×${this.pixiApp.view.height}px`;
        }
    }
    
    /**
     * 全クリア
     */
    clearCanvas() {
        // 全描画オブジェクト削除
        this.drawingContainer.removeChildren();
        
        // CanvasManagerのクリア
        if (this.canvasManager) {
            this.canvasManager.clear();
        }
        
        console.log('🧹 キャンバスクリア完了');
    }
    
    /**
     * 成功通知
     */
    showSuccess() {
        if (window.Tegaki?.ErrorManagerInstance) {
            window.Tegaki.ErrorManagerInstance.showInfo('🎨 Tegaki v3 初期化完了 - 描画機能動作中', {
                duration: 3000
            });
        }
        
        // キャンバス情報更新
        this.updateCanvasInfo();
        
        console.log('🎉 Tegaki v3 準備完了 - 描画機能付き');
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            initialized: true,
            canvasVisible: !!this.pixiApp?.view?.offsetWidth,
            canvasSize: {
                width: this.pixiApp.view.width,
                height: this.pixiApp.view.height
            },
            currentTool: this.currentTool,
            isDrawing: this.isDrawing,
            drawingObjects: this.drawingContainer.children.length,
            managersReady: {
                canvas: !!this.canvasManager,
                tool: !!this.toolManager
            },
            pixiReady: !!this.pixiApp
        };
    }
    
    /**
     * 強制クリーンアップ（ページ離脱時）
     */
    destroy() {
        if (this.pixiApp) {
            this.pixiApp.destroy(true, true);
            this.pixiApp = null;
        }
        
        console.log('🧹 TegakiApplication クリーンアップ完了');
    }
}

// Tegaki名前空間にクラス登録
window.Tegaki.TegakiApplication = TegakiApplication;

/**
 * デバッグ関数（完全版）
 */
window.checkTegaki = function() {
    console.log('🔍 Tegaki状態確認');
    
    if (window.Tegaki?.AppInstance) {
        const debug = window.Tegaki.AppInstance.getDebugInfo();
        console.log('📊 デバッグ情報:', debug);
        
        // 描画テスト
        console.log('🎨 描画テスト用関数:');
        console.log('  - window.drawTestLine() : テスト線描画');
        console.log('  - window.clearCanvas() : キャンバスクリア');
        
        return debug;
    } else {
        console.error('❌ TegakiApplication instance not found');
        return { error: 'TegakiApplication instance not found' };
    }
};

/**
 * 描画テスト関数
 */
window.drawTestLine = function() {
    if (window.Tegaki?.AppInstance) {
        const app = window.Tegaki.AppInstance;
        
        // テスト線描画
        const graphics = new PIXI.Graphics();
        graphics.lineStyle(2, 0x800000, 1.0);
        graphics.moveTo(50, 50);
        graphics.lineTo(350, 350);
        graphics.lineTo(50, 350);
        graphics.lineTo(350, 50);
        
        app.drawingContainer.addChild(graphics);
        
        console.log('✅ テスト線描画完了');
        return true;
    } else {
        console.error('❌ TegakiApplication not available');
        return false;
    }
};

/**
 * キャンバスクリア関数
 */
window.clearCanvas = function() {
    if (window.Tegaki?.AppInstance) {
        window.Tegaki.AppInstance.clearCanvas();
        return true;
    } else {
        console.error('❌ TegakiApplication not available');
        return false;
    }
};

/**
 * 緊急修復関数（完全版）
 */
window.emergencyFix = function() {
    console.log('🆘 緊急修復開始');
    
    try {
        // 既存インスタンス破棄
        if (window.Tegaki?.AppInstance?.destroy) {
            window.Tegaki.AppInstance.destroy();
        }
        
        // 新規インスタンス作成
        const app = new window.Tegaki.TegakiApplication();
        window.Tegaki.AppInstance = app;
        
        console.log('✅ 緊急修復完了');
        return true;
        
    } catch (error) {
        console.error('❌ 緊急修復失敗:', error);
        return false;
    }
};

/**
 * グローバルエラーハンドリング（ErrorManager完全委譲版）
 */
window.addEventListener('error', (event) => {
    if (window.Tegaki?.ErrorManagerInstance) {
        window.Tegaki.ErrorManagerInstance.showError('error', 
            `Global Error: ${event.error?.message || event.message}`, {
            context: 'Global Error Handler'
        });
    } else {
        console.error('🆘 Global Error:', event.error || event.message);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (window.Tegaki?.ErrorManagerInstance) {
        window.Tegaki.ErrorManagerInstance.showError('error', 
            `Unhandled Promise: ${event.reason?.message || event.reason}`, {
            context: 'Unhandled Promise Rejection'
        });
    } else {
        console.error('🆘 Unhandled Promise:', event.reason);
    }
});

/**
 * ページ離脱時のクリーンアップ
 */
window.addEventListener('beforeunload', () => {
    if (window.Tegaki?.AppInstance?.destroy) {
        window.Tegaki.AppInstance.destroy();
    }
});

console.log('🎨 Tegaki Main v3 Loaded - 完全描画機能付き');
console.log('✨ 特徴: 直線的初期化・完全描画処理・ふたばUI・エラー隠蔽禁止');
console.log('🔧 デバッグ: window.checkTegaki(), window.drawTestLine(), window.clearCanvas()');/**
 * 🎨 Tegaki Main v3 - 怪物撲滅版（50行）
 * 📋 RESPONSIBILITY: キャンバス作成・PixiJS初期化・基本初期化のみ
 * 🚫 PROHIBITION: 段階分岐・tryInitialize地獄・過度な検証・診断機能
 * ✅ PERMISSION: 直接的キャンバス作成・PixiJS初期化・Manager委譲・例外throw
 * 
 * 📏 DESIGN_PRINCIPLE: 200行 → 50行（75%削減）
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * TegakiApplication v3 - 怪物撲滅版
 * Constructor内で全初期化完了
 */
class TegakiApplication {
    constructor() {
        console.log('🎨 TegakiApplication v3 開始 - 怪物撲滅版');
        
        // Step 1: キャンバス作成（最優先・例外隠蔽禁止）
        this.createCanvas();
        
        // Step 2: PixiJS初期化
        this.initializePixi();
        
        // Step 3: ツール設定
        this.setupTools();
        
        console.log('✅ TegakiApplication v3 初期化完了');
        this.showSuccess();
    }
    
    /**
     * Step 1: キャンバス作成（例外隠蔽禁止）
     */
    createCanvas() {
        const container = document.getElementById('canvas-container');
        if (!container) {
            throw new Error('Canvas container #canvas-container not found');
        }
        
        this.app = new PIXI.Application({
            width: 400, 
            height: 400,
            backgroundColor: '#ffffee'
        });
        
        container.appendChild(this.app.view);
        console.log('✅ キャンバス作成完了');
    }
    
    /**
     * Step 2: PixiJS初期化
     */
    initializePixi() {
        // CanvasManager作成・設定
        this.canvasManager = new window.Tegaki.CanvasManager();
        this.canvasManager.setPixiApp(this.app);
        window.Tegaki.CanvasManagerInstance = this.canvasManager;
        
        // ToolManager作成・設定
        this.toolManager = new window.Tegaki.ToolManager();
        this.toolManager.setCanvasManager(this.canvasManager);
        window.Tegaki.ToolManagerInstance = this.toolManager;
        
        console.log('✅ Manager初期化完了');
    }
    
    /**
     * Step 3: ツール設定
     */
    setupTools() {
        // デフォルトツール選択
        this.toolManager.selectTool('pen');
        
        // イベント設定
        this.setupEvents();
        
        console.log('✅ ツール設定完了');
    }
    
    /**
     * イベント設定
     */
    setupEvents() {
        const canvas = this.app.view;
        
        canvas.addEventListener('pointerdown', (e) => this.handlePointer(e, 'down'));
        canvas.addEventListener('pointermove', (e) => this.handlePointer(e, 'move'));
        canvas.addEventListener('pointerup', (e) => this.handlePointer(e, 'up'));
        
        console.log('✅ イベント設定完了');
    }
    
    /**
     * ポインターイベント処理
     */
    handlePointer(event, type) {
        const rect = this.app.view.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const methodMap = {
            down: 'handlePointerDown',
            move: 'handlePointerMove', 
            up: 'handlePointerUp'
        };
        
        const method = methodMap[type];
        if (method && this.toolManager[method]) {
            this.toolManager[method](x, y, event);
        }
    }
    
    /**
     * 成功通知
     */
    showSuccess() {
        if (window.Tegaki?.ErrorManagerInstance) {
            window.Tegaki.ErrorManagerInstance.showInfo('Tegaki v3 初期化完了', {
                duration: 3000
            });
        }
        console.log('🎉 Tegaki v3 準備完了');
    }
}

// Tegaki名前空間にクラス登録
window.Tegaki.TegakiApplication = TegakiApplication;

/**
 * グローバルエラーハンドリング（ErrorManager完全委譲版）
 */
window.addEventListener('error', (event) => {
    if (window.Tegaki?.ErrorManagerInstance) {
        window.Tegaki.ErrorManagerInstance.showError('error', 
            `Global Error: ${event.error?.message || event.message}`, {
            context: 'Global Error Handler'
        });
    } else {
        console.error('🆘 Global Error:', event.error || event.message);
    }
});

console.log('🎨 Tegaki Main v3 Loaded - 怪物撲滅50行版');