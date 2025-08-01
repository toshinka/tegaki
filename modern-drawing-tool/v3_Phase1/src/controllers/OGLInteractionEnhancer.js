// 🎮 統一入力制御システム - 座標統一・ツール管理・UI生成
// マウス・キーボード・ペンタブレット対応 + サイドバーUI生成

/**
 * 🚀 OGLInteractionEnhancer - 統一入力処理・UI生成システム
 * 
 * 【責務】
 * - 統一座標系でのマウス・ペン入力処理
 * - ツールアイコンの動的生成・管理
 * - 基本UIインタラクション
 * - Phase2・3拡張のベース機能
 */
export class OGLInteractionEnhancer {
    constructor(canvas, coordinateUnifier, eventStore) {
        this.canvas = canvas;
        this.coordinate = coordinateUnifier;
        this.eventStore = eventStore;

        // 入力状態管理
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentStroke = null;
        this.lastPoint = null;
        
        // マウス・タッチ状態
        this.pointerState = {
            isDown: false,
            button: -1,
            pressure: 1.0,
            tiltX: 0,
            tiltY: 0
        };

        // UI要素参照
        this.sidebar = document.getElementById('sidebar');
        this.toolButtons = new Map();
        
        // ツール定義（Phase1基本セット）
        this.tools = {
            pen: { icon: '✏️', name: 'ペン', shortcut: 'P' },
            brush: { icon: '🖌️', name: 'ブラシ', shortcut: 'B' },
            eraser: { icon: '🗑️', name: '消しゴム', shortcut: 'E' },
            select: { icon: '⬚', name: '選択', shortcut: 'V' },
            eyedropper: { icon: '💧', name: 'スポイト', shortcut: 'I' },
            zoom: { icon: '🔍', name: 'ズーム', shortcut: 'Z' }
        };

        // Phase2・3拡張ツール（解封時追加予定）
        // this.advancedTools = { ... };    // 🔒Phase2解封
        // this.animationTools = { ... };   // 🔒Phase3解封

        // イベントリスナー設定
        this.setupEventListeners();
        
        // UI初期化
        this.initializeUI();

        console.log('🎮 OGLInteractionEnhancer初期化完了');
    }

    /**
     * 🎛️ イベントリスナー設定
     */
    setupEventListeners() {
        // マウスイベント
        this.canvas.addEventListener('mousedown', this.handlePointerDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handlePointerMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handlePointerUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handlePointerLeave.bind(this));

        // ペンタブレットイベント（Pointer Events）
        this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.canvas.addEventListener('pointerleave', this.handlePointerLeave.bind(this));

        // ホイールイベント（ズーム・パン）
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));

        // コンテキストメニュー無効化
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // キーボードイベント
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // リサイズイベント
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * 🎨 UI初期化
     */
    initializeUI() {
        // サイドバーツールアイコン生成
        this.generateToolIcons();
        
        // 初期ツール設定
        this.setActiveTool('pen');
    }

    /**
     * 🛠️ ツールアイコン生成
     */
    generateToolIcons() {
        if (!this.sidebar) {
            console.warn('⚠️ サイドバー要素が見つかりません');
            return;
        }

        // 既存アイコンクリア
        this.sidebar.innerHTML = '';
        this.toolButtons.clear();

        // ツールアイコン生成
        Object.entries(this.tools).forEach(([toolId, toolData]) => {
            const button = this.createToolButton(toolId, toolData);
            this.sidebar.appendChild(button);
            this.toolButtons.set(toolId, button);
        });

        // 区切り線追加
        const separator = document.createElement('div');
        separator.style.cssText = `
            width: 80%; height: 1px;
            background: rgba(128, 0, 0, 0.3);
            margin: 8px auto;
        `;
        this.sidebar.appendChild(separator);

        // システムボタン追加
        this.addSystemButtons();
    }

    /**
     * 🎨 ツールボタン作成
     */
    createToolButton(toolId, toolData) {
        const button = document.createElement('button');
        button.className = 'tool-button';
        button.dataset.tool = toolId;
        button.innerHTML = toolData.icon;
        button.title = `${toolData.name} (${toolData.shortcut})`;
        
        // スタイル設定
        button.style.cssText = `
            width: 40px; height: 40px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.8);
            border: 1px solid var(--main-color);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: all 0.2s ease;
            font-size: 16px; color: var(--main-color);
            margin-bottom: 4px;
        `;

        // イベントリスナー
        button.addEventListener('click', () => this.setActiveTool(toolId));
        
        // ホバーエフェクト
        button.addEventListener('mouseenter', () => {
            button.style.background = 'var(--light-bg)';
            button.style.transform = 'translateY(-1px)';
        });
        
        button.addEventListener('mouseleave', () => {
            if (!button.classList.contains('active')) {
                button.style.background = 'rgba(255, 255, 255, 0.8)';
                button.style.transform = 'translateY(0)';
            }
        });

        return button;
    }

    /**
     * ⚙️ システムボタン追加
     */
    addSystemButtons() {
        const systemButtons = [
            { id: 'settings', icon: '⚙️', name: '設定', action: () => this.showSettings() },
            { id: 'fullscreen', icon: '⛶', name: 'フルスクリーン', action: () => this.toggleFullscreen() },
            { id: 'help', icon: '❓', name: 'ヘルプ', action: () => this.showHelp() }
        ];

        systemButtons.forEach(buttonData => {
            const button = document.createElement('button');
            button.className = 'tool-button system-button';
            button.innerHTML = buttonData.icon;
            button.title = buttonData.name;
            button.style.cssText = `
                width: 40px; height: 40px; border-radius: 6px;
                background: rgba(170, 90, 86, 0.2);
                border: 1px solid var(--sub-color);
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; transition: all 0.2s ease;
                font-size: 14px; color: var(--sub-color);
                margin-bottom: 4px;
            `;
            
            button.addEventListener('click', buttonData.action);
            this.sidebar.appendChild(button);
        });
    }

    /**
     * 🛠️ アクティブツール設定
     */
    setActiveTool(toolId) {
        if (!this.tools[toolId]) {
            console.warn(`⚠️ 不明なツール: ${toolId}`);
            return;
        }

        // 前のツールの非アクティブ化
        this.toolButtons.forEach(button => {
            button.classList.remove('active');
            button.style.background = 'rgba(255, 255, 255, 0.8)';
            button.style.color = 'var(--main-color)';
            button.style.transform = 'translateY(0)';
        });

        // 新しいツールのアクティブ化
        const activeButton = this.toolButtons.get(toolId);
        if (activeButton) {
            activeButton.classList.add('active');
            activeButton.style.background = 'var(--main-color)';
            activeButton.style.color = 'white';
            activeButton.style.boxShadow = '0 2px 8px rgba(128, 0, 0, 0.3)';
        }

        // ツール変更処理
        this.currentTool = toolId;
        
        // カーソル変更
        this.updateCursor();
        
        // イベント通知
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, {
            tool: toolId,
            toolData: this.tools[toolId]
        });

        console.log('🛠️ ツール変更:', toolId);
    }

    /**
     * 🖱️ ポインタアップ処理
     */
    handlePointerUp(event) {
        event.preventDefault();
        
        // 座標統一変換
        const rect = this.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const unifiedPoint = this.coordinate.screenToUnified(screenX, screenY);

        // 描画終了処理
        if (this.isDrawing) {
            this.endDrawing(unifiedPoint, event);
        }

        // ポインタ状態リセット
        this.pointerState.isDown = false;

        // 入力イベント通知
        this.eventStore.emit(this.eventStore.eventTypes.INPUT_MOUSE_UP, {
            x: unifiedPoint.x,
            y: unifiedPoint.y,
            tool: this.currentTool,
            strokeCompleted: this.isDrawing
        });
    }

    /**
     * 🖱️ ポインタリーブ処理
     */
    handlePointerLeave(event) {
        // 描画中の場合は強制終了
        if (this.isDrawing) {
            this.endDrawing(this.lastPoint || { x: 0, y: 0 }, event);
        }

        this.pointerState.isDown = false;
    }

    /**
     * 🖱️ ホイール処理（ズーム・パン）
     */
    handleWheel(event) {
        event.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const unifiedPoint = this.coordinate.screenToUnified(screenX, screenY);

        // ズーム・パン判定
        if (event.ctrlKey || event.metaKey) {
            // ズーム操作
            const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1;
            
            this.eventStore.emit(this.eventStore.eventTypes.CANVAS_ZOOM, {
                delta: zoomDelta,
                centerX: unifiedPoint.x,
                centerY: unifiedPoint.y
            });
        } else if (event.shiftKey) {
            // 横パン
            this.eventStore.emit(this.eventStore.eventTypes.CANVAS_PAN, {
                deltaX: -event.deltaY,
                deltaY: 0
            });
        } else {
            // 縦パン
            this.eventStore.emit(this.eventStore.eventTypes.CANVAS_PAN, {
                deltaX: -event.deltaX,
                deltaY: -event.deltaY
            });
        }
    }

    /**
     * ⌨️ キーダウン処理
     */
    handleKeyDown(event) {
        // ツールショートカット
        const toolByKey = {
            'KeyP': 'pen',
            'KeyB': 'brush', 
            'KeyE': 'eraser',
            'KeyV': 'select',
            'KeyI': 'eyedropper',
            'KeyZ': 'zoom'
        };

        if (toolByKey[event.code] && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            this.setActiveTool(toolByKey[event.code]);
        }

        // システムショートカット
        if (event.key === 'Tab') {
            event.preventDefault();
            this.toggleSidebar();
        }

        if (event.key === 'F11' || (event.key === 'f' && event.ctrlKey)) {
            event.preventDefault();
            this.toggleFullscreen();
        }

        // スペースキー（一時的にパンモード）
        if (event.code === 'Space' && !this.spacePressed) {
            event.preventDefault();
            this.spacePressed = true;
            this.tempTool = this.currentTool;
            this.canvas.style.cursor = 'grab';
        }

        // 入力イベント通知
        this.eventStore.emit(this.eventStore.eventTypes.INPUT_KEY_DOWN, {
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey
        });
    }

    /**
     * ⌨️ キーアップ処理
     */
    handleKeyUp(event) {
        // スペースキー離した時（パンモード終了）
        if (event.code === 'Space' && this.spacePressed) {
            this.spacePressed = false;
            this.setActiveTool(this.tempTool || this.currentTool);
            this.tempTool = null;
        }

        // 入力イベント通知
        this.eventStore.emit(this.eventStore.eventTypes.INPUT_KEY_UP, {
            key: event.key,
            code: event.code
        });
    }

    /**
     * 📏 リサイズ処理
     */
    handleResize() {
        // デバウンス処理
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.eventStore.emit(this.eventStore.eventTypes.CANVAS_RESIZE, {
                width: window.innerWidth,
                height: window.innerHeight
            });
        }, 100);
    }

    /**
     * 🖌️ 描画開始判定
     */
    shouldStartDrawing(event) {
        // 左クリックまたはペン
        if (event.button === 0 || event.pointerType === 'pen') {
            // パンモードではない
            if (!this.spacePressed) {
                // 描画可能ツール
                return ['pen', 'brush', 'eraser'].includes(this.currentTool);
            }
        }
        return false;
    }

    /**
     * 🖌️ 描画開始
     */
    startDrawing(point, event) {
        this.isDrawing = true;
        
        // ストローク開始イベント
        this.eventStore.emit(this.eventStore.eventTypes.STROKE_START, {
            x: point.x,
            y: point.y,
            pressure: this.pointerState.pressure,
            tool: this.currentTool,
            timestamp: Date.now()
        });

        console.log('🖌️ 描画開始:', { tool: this.currentTool, point });
    }

    /**
     * 🖌️ 描画継続
     */
    continueDrawing(point, event) {
        if (!this.isDrawing) return;

        // 距離チェック（最適化）
        if (this.lastPoint) {
            const distance = this.coordinate.calculateDistance(this.lastPoint, point);
            if (distance < 1) return; // 1px未満は無視
        }

        // ストローク移動イベント
        this.eventStore.emit(this.eventStore.eventTypes.STROKE_MOVE, {
            x: point.x,
            y: point.y,
            pressure: event.pressure || this.pointerState.pressure,
            tool: this.currentTool,
            timestamp: Date.now()
        });
    }

    /**
     * 🖌️ 描画終了
     */
    endDrawing(point, event) {
        if (!this.isDrawing) return;

        this.isDrawing = false;

        // ストローク完了イベント
        this.eventStore.emit(this.eventStore.eventTypes.STROKE_COMPLETE, {
            x: point.x,
            y: point.y,
            tool: this.currentTool,
            timestamp: Date.now()
        });

        console.log('🖌️ 描画終了:', { tool: this.currentTool, point });
    }

    /**
     * 📱 サイドバー切り替え
     */
    toggleSidebar() {
        if (this.sidebar) {
            this.sidebar.classList.toggle('collapsed');
            
            // キャンバス領域調整通知
            setTimeout(() => {
                this.eventStore.emit(this.eventStore.eventTypes.CANVAS_RESIZE, {
                    sidebarCollapsed: this.sidebar.classList.contains('collapsed')
                });
            }, 300); // CSS transition待ち
        }
    }

    /**
     * 🖥️ フルスクリーン切り替え
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('フルスクリーン失敗:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.warn('フルスクリーン終了失敗:', err);
            });
        }
        
        // フルスクリーンモードクラス切り替え
        document.body.classList.toggle('fullscreen-drawing');
    }

    /**
     * ⚙️ 設定画面表示（Phase2実装予定）
     */
    showSettings() {
        console.log('⚙️ 設定画面（Phase2実装予定）');
        
        // Phase2で実装予定のポップアップ
        this.eventStore.emit('ui:popup:show', {
            type: 'settings',
            title: '設定',
            content: 'Phase2で実装予定'
        });
    }

    /**
     * ❓ ヘルプ表示
     */
    showHelp() {
        const helpContent = `
        📖 基本操作ヘルプ
        
        🛠️ ツール切り替え:
        P: ペン | B: ブラシ | E: 消しゴム
        V: 選択 | I: スポイト | Z: ズーム
        
        📱 表示操作:
        Tab: サイドバー切り替え
        F11: フルスクリーン切り替え
        Space: 一時パンモード
        
        🖱️ マウス操作:
        左クリック: 描画
        ホイール: パン（上下・左右）
        Ctrl+ホイール: ズーム
        
        Phase1: 基本機能のみ実装済み
        Phase2・3: 高度機能は今後実装予定
        `;

        alert(helpContent);
    }

    /**
     * 📊 入力統計取得
     */
    getInputStats() {
        return {
            currentTool: this.currentTool,
            isDrawing: this.isDrawing,
            pointerState: { ...this.pointerState },
            lastPoint: this.lastPoint,
            toolCount: Object.keys(this.tools).length
        };
    }

    /**
     * 🎯 ツール設定更新（Phase2拡張予定）
     */
    updateToolConfig(toolId, config) {
        if (!this.tools[toolId]) return;
        
        // Phase2でToolProcessor連携予定
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CONFIG_UPDATE, {
            tool: toolId,
            config: config
        });
    }

    // 🎨 Phase2拡張メソッド（解封時有効化）
    /*
    setupAdvancedTools() {                          // 🔒Phase2解封
        this.advancedTools = {
            vectorPen: { icon: '🖋️', name: 'ベクターペン', shortcut: 'Shift+P' },
            gradientBrush: { icon: '🌈', name: 'グラデーションブラシ', shortcut: 'G' },
            textTool: { icon: '📝', name: 'テキスト', shortcut: 'T' },
            shapeTool: { icon: '⭕', name: '図形', shortcut: 'S' },
            layerTool: { icon: '📚', name: 'レイヤー', shortcut: 'L' }
        };
        
        // 拡張ツールボタン追加
        this.addAdvancedToolButtons();
        
        console.log('🎨 Phase2拡張ツール設定完了');
    }

    setupColorPicker() {                            // 🔒Phase2解封
        // カラーピッカー統合
        this.colorPickerTool = {
            icon: '🎨', name: 'カラーピッカー', shortcut: 'C'
        };
        
        console.log('🎨 カラーピッカー統合完了');
    }
    */

    // ⚡ Phase3拡張メソッド（解封時有効化）
    /*
    setupAnimationTools() {                         // 🔒Phase3解封
        this.animationTools = {
            onionSkin: { icon: '👻', name: 'オニオンスキン', shortcut: 'O' },
            timeline: { icon: '⏱️', name: 'タイムライン', shortcut: 'Shift+T' },
            keyframe: { icon: '🔑', name: 'キーフレーム', shortcut: 'K' },
            playback: { icon: '▶️', name: '再生', shortcut: 'Space' }
        };
        
        console.log('⚡ Phase3アニメーションツール設定完了');
    }

    setupMeshDeformTool() {                         // 🔒Phase3解封
        // LIVE2D風メッシュ変形ツール
        this.meshDeformTool = {
            icon: '🕸️', name: 'メッシュ変形', shortcut: 'M'
        };
        
        console.log('⚡ メッシュ変形ツール設定完了');
    }
    */

    /**
     * 🎯 ツール検索
     */
    findTool(query) {
        const searchTerm = query.toLowerCase();
        return Object.entries(this.tools).filter(([id, data]) => {
            return id.includes(searchTerm) || 
                   data.name.toLowerCase().includes(searchTerm) ||
                   data.shortcut.toLowerCase().includes(searchTerm);
        });
    }

    /**
     * 📋 ツール一覧取得
     */
    getAvailableTools() {
        return { ...this.tools };
    }

    /**
     * 🎯 現在ツール取得
     */
    getCurrentTool() {
        return {
            id: this.currentTool,
            data: this.tools[this.currentTool]
        };
    }

    /**
     * 🔧 入力感度調整
     */
    setInputSensitivity(sensitivity) {
        this.inputSensitivity = Math.max(0.1, Math.min(2.0, sensitivity));
        console.log('🔧 入力感度調整:', this.inputSensitivity);
    }

    /**
     * 🎯 ペンタブレット設定
     */
    configurePenTablet(config) {
        this.penTabletConfig = {
            pressureSensitivity: config.pressureSensitivity || 1.0,
            tiltSensitivity: config.tiltSensitivity || 1.0,
            enableTilt: config.enableTilt || false,
            ...config
        };
        
        console.log('🎯 ペンタブレット設定更新:', this.penTabletConfig);
    }

    /**
     * 📊 デバッグ情報取得
     */
    getDebugInfo() {
        return {
            inputStats: this.getInputStats(),
            penTabletConfig: this.penTabletConfig,
            inputSensitivity: this.inputSensitivity,
            eventListeners: {
                canvas: this.canvas.getEventListeners?.() || 'N/A',
                document: 'keyboard events attached'
            }
        };
    }

    /**
     * 🗑️ リソース解放
     */
    destroy() {
        // イベントリスナー削除
        this.canvas.removeEventListener('mousedown', this.handlePointerDown);
        this.canvas.removeEventListener('mousemove', this.handlePointerMove);
        this.canvas.removeEventListener('mouseup', this.handlePointerUp);
        this.canvas.removeEventListener('mouseleave', this.handlePointerLeave);
        
        this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
        this.canvas.removeEventListener('pointermove', this.handlePointerMove);
        this.canvas.removeEventListener('pointerup', this.handlePointerUp);
        this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
        
        this.canvas.removeEventListener('wheel', this.handleWheel);
        this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
        
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        window.removeEventListener('resize', this.handleResize);

        // UI要素クリア
        this.toolButtons.clear();
        
        // 参照クリア
        this.canvas = null;
        this.coordinate = null;
        this.eventStore = null;
        this.tools = null;
        
        console.log('🗑️ OGLInteractionEnhancer リソース解放完了');
    }
}️ カーソル更新
     */
    updateCursor() {
        const cursors = {
            pen: 'crosshair',
            brush: 'crosshair',
            eraser: 'crosshair',
            select: 'default',
            eyedropper: 'crosshair',
            zoom: 'zoom-in'
        };

        this.canvas.style.cursor = cursors[this.currentTool] || 'crosshair';
    }

    /**
     * 🖱️ ポインタダウン処理
     */
    handlePointerDown(event) {
        event.preventDefault();
        
        // 座標統一変換
        const rect = this.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const unifiedPoint = this.coordinate.screenToUnified(screenX, screenY);

        // ポインタ状態更新
        this.pointerState = {
            isDown: true,
            button: event.button || 0,
            pressure: event.pressure || 1.0,
            tiltX: event.tiltX || 0,
            tiltY: event.tiltY || 0
        };

        // 描画開始判定
        if (this.shouldStartDrawing(event)) {
            this.startDrawing(unifiedPoint, event);
        }

        // 入力イベント通知
        this.eventStore.emit(this.eventStore.eventTypes.INPUT_MOUSE_DOWN, {
            x: unifiedPoint.x,
            y: unifiedPoint.y,
            pressure: this.pointerState.pressure,
            button: this.pointerState.button,
            tool: this.currentTool,
            pointerType: event.pointerType || 'mouse'
        });
    }

    /**
     * 🖱️ ポインタムーブ処理
     */
    handlePointerMove(event) {
        event.preventDefault();
        
        // 座標統一変換
        const rect = this.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const unifiedPoint = this.coordinate.screenToUnified(screenX, screenY);

        // 描画中の処理
        if (this.isDrawing && this.pointerState.isDown) {
            this.continueDrawing(unifiedPoint, event);
        }

        // 入力イベント通知
        this.eventStore.emit(this.eventStore.eventTypes.INPUT_MOUSE_MOVE, {
            x: unifiedPoint.x,
            y: unifiedPoint.y,
            pressure: event.pressure || this.pointerState.pressure,
            isDrawing: this.isDrawing,
            tool: this.currentTool
        });

        this.lastPoint = unifiedPoint;
    }

    /**
     * 🖱