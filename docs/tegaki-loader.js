// ==================================================
// tegaki-loader.js (完全版)
// ブックマークレット用ローダー - めぶきちゃんねる連携
// index.htmlの完全機能移植版
// ==================================================

(function() {
    'use strict';
    
    // ===== 設定 =====
    const TEGAKI_BASE_URL = 'https://toshinka.github.io/tegaki/docs/';
    const MEBUKI_TIMEOUT = 3000;
    
    // ===== めぶきちゃんねる検出用セレクタ =====
    const MEBUKI_SELECTORS = {
        postButton: 'button[title="レスを投稿"]',
        fileInput: 'input[type="file"][accept*="image"]',
        previewImg: 'img[src^="blob:"]'
    };
    
    // ===== ブックマークレット本体 =====
    class TegakiBookmarklet {
        constructor() {
            this.boardType = null;
            this.targetInput = null;
            this.tegakiApp = null;
            this.container = null;
            this.elements = {};
            this.subscriptions = [];
            this.originalBodyOverflow = null;
            this.styleElement = null;
        }
        
        // ===== Phase 1: エントリーポイント =====
        async start() {
            try {
                this.boardType = this.detectBoard();
                if (!this.boardType) {
                    alert('対応していない掲示板です\n現在はめぶきちゃんねる(mebuki.moe)のみ対応しています');
                    return;
                }
                
                await this.findTargetElements();
                await this.loadCDNLibraries();
                await this.loadTegakiCore();
                this.injectCSS();
                this.createMainLayout();
                await this.initializeTegaki();
                this.setupShortcuts();
                this.setupEventBus();
                this.setupHistory();
                this.startFPSMonitor();
                
                console.log('[Tegaki] ✅ All systems ready');
                
            } catch (error) {
                console.error('[Tegaki] 起動失敗:', error);
                alert('Tegaki起動に失敗しました\n' + error.message);
                this.cleanup();
            }
        }
        
        detectBoard() {
            const host = location.host;
            if (host.includes('mebuki.moe')) return 'mebuki';
            return null;
        }
        
        async findTargetElements() {
            if (this.boardType === 'mebuki') {
                const postBtn = document.querySelector(MEBUKI_SELECTORS.postButton);
                if (postBtn) {
                    postBtn.click();
                    await this.wait(300);
                }
                
                await this.waitFor(() => {
                    this.targetInput = document.querySelector(MEBUKI_SELECTORS.fileInput);
                    return this.targetInput !== null;
                }, MEBUKI_TIMEOUT);
                
                if (!this.targetInput) {
                    throw new Error('ファイル入力要素が見つかりません');
                }
            }
        }
        
        // ===== Phase 2: CDN読込完全版 =====
        async loadCDNLibraries() {
            const cdnLibraries = [
                'https://cdn.jsdelivr.net/npm/pixi.js@8.13.0/dist/pixi.min.js',
                'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js',
                'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js',
                'https://unpkg.com/upng-js@2.1.0/UPNG.js',
                'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
            ];
            
            for (const url of cdnLibraries) {
                await this.loadScript(url);
            }
        }
        
        // ===== Phase 3: Tegakiコアスクリプト読込完全版 =====
        async loadTegakiCore() {
            const scripts = [
                'config.js',
                'coordinate-system.js',
                'system/event-bus.js',
                'system/state-manager.js',
                'system/layer-commands.js',
                'system/camera-system.js',
                'system/layer-system.js',
                'system/drawing-clipboard.js',
                'system/history.js',
                'system/virtual-album.js',
                'system/animation-system.js',
                'system/export-manager.js',
                'system/exporters/png-exporter.js',
                'system/exporters/apng-exporter.js',
                'system/exporters/gif-exporter.js',
                'system/exporters/webp-exporter.js',
                'system/exporters/mp4-exporter.js',
                'system/exporters/pdf-exporter.js',
                'system/quick-export-ui.js',
                'ui/timeline-ui.js',
                'ui/album-popup.js',
                'ui/export-popup.js',
                'ui/ui-panels.js',
                'ui/timeline-thumbnail-utils.js',
                'core-runtime.js',
                'core-engine.js',
                'system/diagnostics.js'
            ];
            
            for (const script of scripts) {
                const url = TEGAKI_BASE_URL + script;
                await this.loadScript(url);
            }
        }
        
        loadScript(url) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.charset = 'UTF-8';
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Failed to load: ${url}`));
                document.head.appendChild(script);
            });
        }
        
        // ===== Phase 4: CSS注入 =====
        injectCSS() {
            this.styleElement = document.createElement('style');
            this.styleElement.textContent = `
                #tegaki-bookmarklet-root * { margin: 0; padding: 0; box-sizing: border-box; }
                #tegaki-bookmarklet-root {
                    --futaba-maroon: #800000;
                    --futaba-light-maroon: #aa5a56;
                    --futaba-medium: #cf9c97;
                    --futaba-light-medium: #e9c2ba;
                    --futaba-cream: #f0e0d6;
                    --futaba-background: #ffffee;
                    --text-primary: #2c1810;
                    --text-secondary: #5d4037;
                    --text-inverse: #ffffff;
                }
                
                .tegaki-main-layout { display: grid; grid-template-columns: 50px 1fr; height: 100vh; width: 100vw; }
                .tegaki-sidebar { background: var(--futaba-cream); border-right: 2px solid var(--futaba-light-medium); display: flex; flex-direction: column; padding: 12px 6px; gap: 4px; overflow-y: auto; z-index: 100; }
                .tegaki-tool-button { width: 36px; height: 36px; border: 2px solid var(--futaba-light-medium); background: var(--futaba-background); border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; user-select: none; }
                .tegaki-tool-button svg { width: 20px; height: 20px; stroke: var(--futaba-maroon); }
                .tegaki-tool-button:hover { background: var(--futaba-medium); transform: scale(1.05); }
                .tegaki-tool-button.active { background: var(--futaba-maroon); }
                .tegaki-tool-button.active svg { stroke: #ffffff; }
                .tegaki-tool-separator { height: 1px; background: var(--futaba-light-medium); margin: 4px 2px; }
                .tegaki-canvas-area { background: var(--futaba-background); position: relative; overflow: hidden; display: flex; justify-content: center; align-items: center; }
                
                .tegaki-layer-panel-container { position: fixed; right: 12px; top: 50%; transform: translateY(-50%); z-index: 1000; display: flex; flex-direction: column; gap: 2px; pointer-events: none; }
                .tegaki-layer-controls-row { display: flex; gap: 4px; pointer-events: all; justify-content: center; margin-bottom: 4px; }
                .tegaki-layer-add-button { width: 32px; height: 32px; background: var(--futaba-cream); border: 1px solid var(--futaba-light-medium); border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
                .tegaki-layer-add-button:hover { background: var(--futaba-medium); transform: scale(1.08); }
                .tegaki-layer-add-button svg { width: 16px; height: 16px; stroke: var(--futaba-maroon); }
                .tegaki-layer-panel-items { display: flex; flex-direction: column; gap: 3px; padding: 4px; pointer-events: all; max-height: 60vh; overflow-y: auto; }
                .tegaki-layer-item { width: 170px; height: 56px; background: var(--futaba-cream); border: 1px solid var(--futaba-light-medium); border-radius: 4px; padding: 4px 6px; cursor: pointer; display: grid; grid-template-columns: 18px 1fr auto; grid-template-rows: 1fr 1fr; gap: 3px 6px; align-items: center; user-select: none; position: relative; }
                .tegaki-layer-item:hover { border-color: var(--futaba-medium); background: var(--futaba-background); }
                .tegaki-layer-item.active { border-color: var(--futaba-maroon); background: var(--futaba-light-medium); }
                .tegaki-layer-visibility { grid-column: 1; grid-row: 1 / 3; width: 18px; height: 18px; cursor: pointer; align-self: center; }
                .tegaki-layer-visibility:hover { background: var(--futaba-light-medium); border-radius: 2px; }
                .tegaki-layer-visibility svg { width: 14px; height: 14px; stroke: var(--futaba-maroon); }
                .tegaki-layer-opacity { grid-column: 2; grid-row: 1; font-size: 9px; color: var(--futaba-maroon); font-family: monospace; }
                .tegaki-layer-name { grid-column: 2; grid-row: 2; font-size: 11px; color: var(--futaba-maroon); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .tegaki-layer-thumbnail { grid-column: 3; grid-row: 1 / 3; width: 64px; height: 44px; background: var(--futaba-background); border: 1px solid var(--futaba-light-medium); border-radius: 3px; overflow: hidden; }
                .tegaki-layer-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
                
                .tegaki-status-panel { position: fixed; top: 12px; left: 70px; background: rgba(240, 224, 214, 0.95); border: 2px solid var(--futaba-medium); border-radius: 12px; padding: 10px 18px; font-family: monospace; font-size: 12px; display: flex; gap: 20px; z-index: 1000; }
                .tegaki-status-group { display: flex; gap: 20px; }
                .tegaki-status-item { display: flex; align-items: center; gap: 6px; color: var(--futaba-maroon); font-weight: 600; }
                
                .tegaki-popup-panel { position: fixed; background: var(--futaba-cream); border: 2px solid var(--futaba-maroon); border-radius: 16px; box-shadow: 0 12px 32px rgba(128, 0, 0, 0.3); padding: 20px; z-index: 2000; display: none; min-width: 280px; }
                .tegaki-popup-panel.show { display: block; }
                
                .tegaki-action-button { padding: 10px 20px; border: 2px solid var(--futaba-maroon); border-radius: 6px; background: var(--futaba-background); color: var(--futaba-maroon); font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: center; font-size: 14px; }
                .tegaki-action-button:hover { background: var(--futaba-maroon); color: var(--text-inverse); }
                .tegaki-action-button.primary { background: #4CAF50; color: white; border-color: #4CAF50; }
                .tegaki-action-button.primary:hover { background: #45a049; }
                .tegaki-action-button.danger { background: #f44336; color: white; border-color: #f44336; }
                .tegaki-action-button.danger:hover { background: #da190b; }
            `;
            document.head.appendChild(this.styleElement);
        }
        
        // ===== Phase 5: メインレイアウト作成 =====
        createMainLayout() {
            this.container = document.createElement('div');
            this.container.id = 'tegaki-bookmarklet-root';
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', sans-serif;
            `;
            
            const mainLayout = document.createElement('div');
            mainLayout.className = 'tegaki-main-layout';
            
            this.createSidebar(mainLayout);
            this.createCanvasArea(mainLayout);
            
            this.container.appendChild(mainLayout);
            document.body.appendChild(this.container);
            
            this.originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        
        // ===== Phase 6: サイドバー作成 =====
        createSidebar(parent) {
            const sidebar = document.createElement('div');
            sidebar.className = 'tegaki-sidebar';
            
            const tools = [
                { id: 'library', title: 'アルバム保管 (準備中)', svg: '<rect width="8" height="18" x="3" y="3" rx="1"/><path d="M7 3v18"/><path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z"/>' },
                { id: 'export', title: '画像・アニメ出力', svg: '<path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19 3 3v-5.5"/><path d="m17 22 3-3"/><circle cx="9" cy="9" r="2"/>' },
                { separator: true },
                { id: 'resize', title: 'リサイズ', svg: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M14 15H9v-5"/><path d="M16 3h5v5"/><path d="M21 3 9 15"/>' },
                { separator: true },
                { id: 'pen', title: 'ベクターペン (P)', active: true, svg: '<path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>' },
                { id: 'eraser', title: '消しゴム (E)', svg: '<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>' },
                { separator: true },
                { id: 'animation', title: 'GIFアニメーション (Alt+A)', svg: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>' }
            ];
            
            tools.forEach(tool => {
                if (tool.separator) {
                    const sep = document.createElement('div');
                    sep.className = 'tegaki-tool-separator';
                    sidebar.appendChild(sep);
                } else {
                    const btn = document.createElement('div');
                    btn.className = 'tegaki-tool-button' + (tool.active ? ' active' : '');
                    btn.id = `tegaki-${tool.id}-tool`;
                    btn.title = tool.title;
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${tool.svg}</svg>`;
                    btn.onclick = () => this.handleToolClick(tool.id);
                    sidebar.appendChild(btn);
                    this.elements[`${tool.id}Tool`] = btn;
                }
            });
            
            parent.appendChild(sidebar);
        }
        
        handleToolClick(toolId) {
            switch(toolId) {
                case 'pen':
                    window.TegakiEventBus?.emit('tool:select', { tool: 'pen' });
                    break;
                case 'eraser':
                    window.TegakiEventBus?.emit('tool:select', { tool: 'eraser' });
                    break;
                case 'export':
                    this.tegakiApp?.exportPopup?.open();
                    break;
                case 'animation':
                    this.tegakiApp?.timelineUI?.toggle();
                    break;
                case 'library':
                    this.tegakiApp?.albumPopup?.open();
                    break;
                case 'resize':
                    alert('リサイズ機能は準備中です');
                    break;
            }
        }
        
        // ===== Phase 7: キャンバスエリア作成 =====
        createCanvasArea(parent) {
            const canvasArea = document.createElement('div');
            canvasArea.className = 'tegaki-canvas-area';
            canvasArea.id = 'tegaki-canvas-container';
            
            parent.appendChild(canvasArea);
            
            this.createStatusPanel(canvasArea);
            this.createLayerPanel(canvasArea);
            this.createBottomBar();
        }
        
        // ===== Phase 8: ステータスパネル作成 =====
        createStatusPanel(parent) {
            const panel = document.createElement('div');
            panel.className = 'tegaki-status-panel';
            
            const leftGroup = document.createElement('div');
            leftGroup.className = 'tegaki-status-group';
            leftGroup.innerHTML = `
                <div class="tegaki-status-item">Canvas: <span id="tegaki-canvas-info">400×400px</span></div>
                <div class="tegaki-status-item">Tool: <span id="tegaki-current-tool">ベクターペン</span></div>
                <div class="tegaki-status-item">Layer: <span id="tegaki-current-layer">レイヤー0</span></div>
                <div class="tegaki-status-item">座標: <span id="tegaki-coordinates">x: 0, y: 0</span></div>
                <div class="tegaki-status-item">DPR: <span id="tegaki-dpr-info">1.0</span></div>
            `;
            
            const rightGroup = document.createElement('div');
            rightGroup.className = 'tegaki-status-group';
            rightGroup.innerHTML = `
                <div class="tegaki-status-item">FPS: <span id="tegaki-fps">60</span></div>
                <div class="tegaki-status-item">History: <span id="tegaki-history-info">0/50</span></div>
            `;
            
            panel.appendChild(leftGroup);
            panel.appendChild(rightGroup);
            parent.appendChild(panel);
            
            this.elements.statusPanel = panel;
            this.elements.canvasInfo = document.getElementById('tegaki-canvas-info');
            this.elements.currentTool = document.getElementById('tegaki-current-tool');
            this.elements.currentLayer = document.getElementById('tegaki-current-layer');
            this.elements.coordinates = document.getElementById('tegaki-coordinates');
            this.elements.dprInfo = document.getElementById('tegaki-dpr-info');
            this.elements.fps = document.getElementById('tegaki-fps');
            this.elements.historyInfo = document.getElementById('tegaki-history-info');
        }
        
        // ===== Phase 9: レイヤーパネル作成 =====
        createLayerPanel(parent) {
            const container = document.createElement('div');
            container.className = 'tegaki-layer-panel-container';
            
            const controlsRow = document.createElement('div');
            controlsRow.className = 'tegaki-layer-controls-row';
            
            const addBtn = document.createElement('div');
            addBtn.className = 'tegaki-layer-add-button';
            addBtn.title = 'レイヤー追加 (Ctrl+L)';
            addBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>';
            addBtn.onclick = () => {
                if (window.drawingApp?.layerManager) {
                    const layerSystem = window.drawingApp.layerManager;
                    const newLayerIndex = layerSystem.getLayers().length + 1;
                    layerSystem.createLayer(`L${newLayerIndex}`, false);
                }
            };
            controlsRow.appendChild(addBtn);
            
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'tegaki-layer-panel-items';
            itemsContainer.id = 'tegaki-layer-list';
            
            container.appendChild(controlsRow);
            container.appendChild(itemsContainer);
            parent.appendChild(container);
            
            this.elements.layerPanel = container;
            this.elements.layerList = itemsContainer;
        }
        
        // ===== Phase 10: 下部バー作成 =====
        createBottomBar() {
            const bottomBar = document.createElement('div');
            bottomBar.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 50px;
                right: 0;
                display: flex;
                justify-content: space-between;
                padding: 12px 20px;
                background: rgba(240, 224, 214, 0.95);
                border-top: 2px solid var(--futaba-medium);
                z-index: 1000;
            `;
            
            const leftInfo = document.createElement('div');
            leftInfo.style.cssText = 'color: #5d4037; font-size: 13px; line-height: 36px;';
            leftInfo.textContent = 'Ctrl+Z: 元に戻す | Space: アニメ再生 | P: ペン | E: 消しゴム';
            
            const rightButtons = document.createElement('div');
            rightButtons.style.cssText = 'display: flex; gap: 12px;';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '✕ キャンセル';
            cancelBtn.className = 'tegaki-action-button danger';
            cancelBtn.onclick = () => this.cancel();
            
            const doneBtn = document.createElement('button');
            doneBtn.textContent = '✓ 掲示板に貼り付けて閉じる';
            doneBtn.className = 'tegaki-action-button primary';
            doneBtn.onclick = () => this.exportAndClose();
            
            rightButtons.appendChild(cancelBtn);
            rightButtons.appendChild(doneBtn);
            
            bottomBar.appendChild(leftInfo);
            bottomBar.appendChild(rightButtons);
            this.container.appendChild(bottomBar);
            
            this.elements.bottomBar = bottomBar;
        }
        
        // ===== Phase 11: Tegaki初期化 =====
        async initializeTegaki() {
            const canvasDiv = document.getElementById('tegaki-canvas-container');
            
            if (!window.TegakiCore?.CoreEngine) {
                throw new Error('TegakiCoreEngineが見つかりません');
            }
            
            if (!window.PIXI) {
                throw new Error('PIXI.jsが読み込まれていません');
            }
            
            const screenWidth = window.innerWidth - 50;
            const screenHeight = window.innerHeight - 60;
            
            const pixiApp = new PIXI.Application();
            await pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: 1,
                antialias: true,
                eventMode: 'static'
            });
            
            canvasDiv.appendChild(pixiApp.canvas);
            pixiApp.canvas.style.width = `${screenWidth}px`;
            pixiApp.canvas.style.height = `${screenHeight}px`;
            
            const coreEngine = new window.TegakiCore.CoreEngine(pixiApp);
            const drawingApp = coreEngine.initialize();
            
            window.CoreRuntime.init({
                app: pixiApp,
                worldContainer: coreEngine.getCameraSystem().worldContainer,
                canvasContainer: coreEngine.getCameraSystem().canvasContainer,
                cameraSystem: coreEngine.getCameraSystem(),
                layerManager: coreEngine.getLayerManager(),
                drawingEngine: coreEngine.getDrawingEngine()
            });
            
            if (window.TegakiUI?.UIController) {
                const uiController = new window.TegakiUI.UIController(
                    coreEngine.getDrawingEngine(),
                    coreEngine.getLayerManager(),
                    pixiApp
                );
                
                if (coreEngine.animationSystem) {
                    uiController.initializeAlbumPopup(coreEngine.animationSystem);
                }
            }
            
            window.drawingApp = drawingApp;
            this.tegakiApp = { app: pixiApp, coreEngine, drawingApp };
            
            this.updateCanvasInfo();
            this.updateDPRInfo();
            
            setTimeout(() => {
                if (window.CoreRuntime) {
                    window.CoreRuntime.initializeExportSystem(pixiApp);
                }
            }, 500);
        }
        
        // ===== Phase 12: ショートカット統合 =====
        setupShortcuts() {
            const handler = (e) => {
                const eventBus = window.TegakiEventBus;
                const keymap = window.TEGAKI_KEYMAP;
                
                if (!eventBus || !keymap) return;
                
                const activeElement = document.activeElement;
                if (activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                )) return;
                
                if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') return;
                
                const action = keymap.getAction(e, { vMode: false });
                if (!action) return;
                
                switch(action) {
                    case 'UNDO':
                        if (window.History?.canUndo()) {
                            window.History.undo();
                        }
                        e.preventDefault();
                        break;
                        
                    case 'REDO':
                        if (window.History?.canRedo()) {
                            window.History.redo();
                        }
                        e.preventDefault();
                        break;
                    
                    case 'LAYER_CLEAR':
                        eventBus.emit('layer:clear-active');
                        e.preventDefault();
                        break;
                    
                    case 'LAYER_CREATE':
                        if (window.drawingApp?.layerManager) {
                            const layerSystem = window.drawingApp.layerManager;
                            const newLayerIndex = layerSystem.getLayers().length + 1;
                            layerSystem.createLayer(`L${newLayerIndex}`, false);
                        }
                        e.preventDefault();
                        break;
                    
                    case 'GIF_CREATE_CUT':
                        window.animationSystem?.createNewEmptyCut();
                        e.preventDefault();
                        break;
                    
                    case 'GIF_TOGGLE_TIMELINE':
                        eventBus.emit('ui:toggle-timeline');
                        e.preventDefault();
                        break;
                    
                    case 'GIF_PLAY_PAUSE':
                        const timelineUI = window.timelineUI;
                        if (timelineUI?.isVisible) {
                            timelineUI.togglePlayStop();
                        }
                        e.preventDefault();
                        break;
                    
                    case 'GIF_COPY_CUT':
                        eventBus.emit('cut:copy-current');
                        setTimeout(() => {
                            eventBus.emit('cut:paste-right-adjacent');
                        }, 10);
                        e.preventDefault();
                        break;
                    
                    case 'TOOL_PEN':
                        eventBus.emit('tool:select', { tool: 'pen' });
                        e.preventDefault();
                        break;
                    
                    case 'TOOL_ERASER':
                        eventBus.emit('tool:select', { tool: 'eraser' });
                        e.preventDefault();
                        break;
                }
            };
            
            document.addEventListener('keydown', handler);
            this.subscriptions.push({ event: 'keydown', handler });
        }
        
        // ===== Phase 13: イベントバス統合 =====
        setupEventBus() {
            if (!window.TegakiEventBus) return;
            
            const toolSelectHandler = (data) => {
                if (this.elements.currentTool) {
                    const toolNames = {
                        pen: 'ベクターペン',
                        eraser: '消しゴム',
                        hand: '移動'
                    };
                    this.elements.currentTool.textContent = toolNames[data.tool] || data.tool;
                }
                
                Object.values(this.elements).forEach(el => {
                    if (el.classList?.contains('tegaki-tool-button')) {
                        el.classList.remove('active');
                    }
                });
                
                if (data.tool === 'pen' && this.elements.penTool) {
                    this.elements.penTool.classList.add('active');
                } else if (data.tool === 'eraser' && this.elements.eraserTool) {
                    this.elements.eraserTool.classList.add('active');
                }
            };
            
            window.TegakiEventBus.on('tool:select', toolSelectHandler);
            this.subscriptions.push({ 
                eventBus: window.TegakiEventBus, 
                event: 'tool:select', 
                handler: toolSelectHandler 
            });
        }
        
        // ===== Phase 14: History統合 =====
        setupHistory() {
            if (!window.TegakiEventBus || !window.History) return;
            
            const historyChangeHandler = (data) => {
                if (this.elements.historyInfo && data) {
                    const currentIndex = data.currentIndex + 1;
                    const stackSize = data.stackSize;
                    this.elements.historyInfo.textContent = `${currentIndex}/${stackSize}`;
                }
            };
            
            window.TegakiEventBus.on('history:changed', historyChangeHandler);
            this.subscriptions.push({
                eventBus: window.TegakiEventBus,
                event: 'history:changed',
                handler: historyChangeHandler
            });
        }
        
        // ===== Phase 15: FPSモニター =====
        startFPSMonitor() {
            let frameCount = 0;
            let lastTime = performance.now();
            
            const updateFPS = () => {
                frameCount++;
                const currentTime = performance.now();
                
                if (currentTime - lastTime >= 1000) {
                    const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                    if (this.elements.fps) {
                        this.elements.fps.textContent = fps;
                    }
                    frameCount = 0;
                    lastTime = currentTime;
                }
                
                if (this.tegakiApp) {
                    requestAnimationFrame(updateFPS);
                }
            };
            
            updateFPS();
        }
        
        // ===== Phase 16: 情報更新 =====
        updateCanvasInfo() {
            if (this.elements.canvasInfo && window.TEGAKI_CONFIG) {
                const config = window.TEGAKI_CONFIG;
                this.elements.canvasInfo.textContent = 
                    `${config.canvas.width}×${config.canvas.height}px`;
            }
        }
        
        updateDPRInfo() {
            if (this.elements.dprInfo) {
                this.elements.dprInfo.textContent = 
                    (window.devicePixelRatio || 1).toFixed(1);
            }
        }
        
        // ===== Phase 17: エクスポート処理 =====
        async exportAndClose() {
            if (!this.tegakiApp?.coreEngine) {
                alert('Tegakiアプリケーションが初期化されていません');
                return;
            }
            
            try {
                const animationSystem = this.tegakiApp.coreEngine.getAnimationSystem();
                const animData = animationSystem?.getAnimationData();
                const cutCount = animData?.cuts?.length || 1;
                
                let format = 'png';
                if (cutCount > 1) {
                    const userChoice = confirm(
                        `${cutCount}カットのアニメーションです。\n\n` +
                        `OK: GIF形式で出力\n` +
                        `キャンセル: PNG形式で出力（最初のカットのみ）`
                    );
                    format = userChoice ? 'gif' : 'png';
                }
                
                const blob = await this.exportBlob(format);
                await this.injectToBoard(blob);
                
                alert('掲示板への画像貼り付けが完了しました！\nコメントを入力して投稿してください。');
                this.cleanup();
                
            } catch (error) {
                console.error('[Tegaki] エクスポート失敗:', error);
                alert('画像の出力に失敗しました\n' + error.message);
            }
        }
        
        async exportBlob(format) {
            const exportManager = window.CoreRuntime?.exportManager;
            if (!exportManager) {
                throw new Error('ExportManagerが見つかりません');
            }
            
            const result = await exportManager.generatePreview(format);
            if (!result?.blob) {
                throw new Error('Blob生成に失敗しました');
            }
            
            return result.blob;
        }
        
        async injectToBoard(blob) {
            if (!this.targetInput) {
                throw new Error('入力要素が見つかりません');
            }
            
            const ext = blob.type.split('/')[1]?.split('+')[0] || 'png';
            const filename = `tegaki_${Date.now()}.${ext}`;
            
            const file = new File([blob], filename, {
                type: blob.type,
                lastModified: Date.now()
            });
            
            const dt = new DataTransfer();
            dt.items.add(file);
            this.targetInput.files = dt.files;
            
            const changeEvent = new Event('change', { bubbles: true });
            this.targetInput.dispatchEvent(changeEvent);
            
            await this.waitForPreview();
        }
        
        async waitForPreview() {
            try {
                await this.waitFor(() => {
                    const preview = document.querySelector(MEBUKI_SELECTORS.previewImg);
                    return preview !== null;
                }, 5000);
            } catch (error) {
                console.warn('[Tegaki] プレビュー表示確認タイムアウト（処理は継続）');
            }
        }
        
        // ===== Phase 18: キャンセル処理 =====
        cancel() {
            if (confirm('描いた内容は破棄されます。よろしいですか？')) {
                this.cleanup();
            }
        }
        
        // ===== Phase 19: クリーンアップ =====
        cleanup() {
            if (this.tegakiApp?.app) {
                this.tegakiApp.app.destroy(true, { children: true });
                this.tegakiApp = null;
            }
            
            this.subscriptions.forEach(sub => {
                if (sub.eventBus) {
                    sub.eventBus.off(sub.event, sub.handler);
                } else {
                    document.removeEventListener(sub.event, sub.handler);
                }
            });
            this.subscriptions = [];
            
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
            
            if (this.styleElement) {
                this.styleElement.remove();
                this.styleElement = null;
            }
            
            if (this.originalBodyOverflow !== null) {
                document.body.style.overflow = this.originalBodyOverflow;
                this.originalBodyOverflow = null;
            }
            
            this.elements = {};
            
            window.drawingApp = null;
        }
        
        // ===== ユーティリティ =====
        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        waitFor(condition, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const check = () => {
                    if (condition()) {
                        resolve();
                    } else if (Date.now() - startTime > timeout) {
                        reject(new Error('タイムアウト'));
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        }
    }
    
    // ===== グローバル登録 =====
    window.tegakiStart = function() {
        if (!window._tegakiBookmarklet) {
            window._tegakiBookmarklet = new TegakiBookmarklet();
        }
        window._tegakiBookmarklet.start();
    };
    
    // ===== 自動起動 =====
    window.tegakiStart();
    
})();