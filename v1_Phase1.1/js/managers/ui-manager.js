/**
 * 🎨 UI統括マネージャー - @pixi/ui統合版
 * 🎯 AI_WORK_SCOPE: UI統括・@pixi/ui活用・ポップアップ管理・ステータス表示
 * 🎯 DEPENDENCIES: main.js, app-core.js
 * 🎯 CDN_USAGE: PIXI, PIXI_UI, GSAP（アニメーション）
 * 🎯 ISOLATION_TEST: ✅ UI単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行超過時 → ui-components.js分割
 * 
 * 📋 PHASE_TARGET: Phase1-3対応
 * 📋 V8_MIGRATION: @pixi/ui v8互換確認予定
 * 📋 PERFORMANCE_TARGET: UI応答性60FPS維持
 */

export class UIManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.app = appCore.app;
        
        // UI要素管理
        this.toolButtons = new Map();
        this.popups = new Map();
        this.sliders = new Map();
        this.statusElements = new Map();
        
        // 状態管理
        this.activePopup = null;
        this.currentTool = 'pen';
        
        // @pixi/ui利用可否
        this.pixiUIAvailable = !!window.PIXI_UI;
        
        // ToolManager参照（後で設定）
        this.toolManager = null;
        
        console.log('🎨 UIManager初期化完了', {
            pixiUI: this.pixiUIAvailable
        });
    }

    /**
     * ToolManager参照設定
     */
    setToolManager(toolManager) {
        this.toolManager = toolManager;
    }

    /**
     * ツールバー初期化（サイドバー）
     */
    async initializeToolbar() {
        console.log('🔧 ツールバー初期化開始');
        
        const sidebar = document.getElementById('tool-sidebar');
        if (!sidebar) {
            throw new Error('tool-sidebar要素が見つかりません');
        }

        // ツールボタン定義
        const tools = [
            {
                id: 'download-tool',
                name: 'ダウンロード',
                icon: this.createDownloadIcon(),
                disabled: true, // Phase2で有効化
                tooltip: 'ダウンロード'
            },
            {
                id: 'resize-tool',
                name: 'リサイズ',
                icon: this.createResizeIcon(),
                popup: 'resize-settings',
                tooltip: 'リサイズ'
            },
            { separator: true },
            {
                id: 'palette-tool',
                name: 'カラーパレット',
                icon: this.createPaletteIcon(),
                disabled: true, // Phase2で有効化
                tooltip: 'カラーパレット'
            },
            {
                id: 'pen-tool',
                name: 'ベクターペン',
                icon: this.createPenIcon(),
                popup: 'pen-settings',
                active: true,
                tooltip: 'ベクターペン'
            },
            {
                id: 'eraser-tool',
                name: '消しゴム',
                icon: this.createEraserIcon(),
                tooltip: '消しゴム'
            },
            { separator: true },
            {
                id: 'fill-tool',
                name: '塗りつぶし',
                icon: this.createFillIcon(),
                disabled: true, // Phase2で有効化
                tooltip: '塗りつぶし'
            },
            {
                id: 'select-tool',
                name: '範囲選択',
                icon: this.createSelectIcon(),
                disabled: true, // Phase2で有効化
                tooltip: '範囲選択'
            },
            { separator: true },
            {
                id: 'settings-tool',
                name: '設定',
                icon: this.createSettingsIcon(),
                disabled: true, // Phase2で有効化
                tooltip: '設定'
            }
        ];

        // ツールボタン作成・配置
        for (const tool of tools) {
            if (tool.separator) {
                this.createSeparator(sidebar);
            } else {
                const button = await this.createToolButton(tool);
                sidebar.appendChild(button);
                this.toolButtons.set(tool.id, button);
            }
        }

        console.log('✅ ツールバー初期化完了');
    }

    /**
     * ツールボタン作成
     */
    async createToolButton(toolConfig) {
        const button = document.createElement('div');
        button.className = 'tool-button';
        button.id = toolConfig.id;
        button.title = toolConfig.tooltip;
        
        // アイコン追加
        button.appendChild(toolConfig.icon);
        
        // 状態設定
        if (toolConfig.disabled) {
            button.classList.add('disabled');
        }
        if (toolConfig.active) {
            button.classList.add('active');
        }

        // クリックイベント
        button.addEventListener('click', (e) => {
            this.handleToolButtonClick(e, toolConfig);
        });

        // @pixi/ui統合（利用可能な場合）
        if (this.pixiUIAvailable && !toolConfig.disabled) {
            this.enhanceButtonWithPixiUI(button, toolConfig);
        }

        return button;
    }

    /**
     * ツールボタンクリック処理
     */
    handleToolButtonClick(event, toolConfig) {
        if (toolConfig.disabled) return;
        
        // ツール切り替え
        if (toolConfig.id.includes('-tool')) {
            this.setActiveTool(toolConfig.id.replace('-tool', ''));
        }
        
        // ポップアップ表示
        if (toolConfig.popup) {
            this.togglePopup(toolConfig.popup);
        }
    }

    /**
     * アクティブツール設定
     */
    setActiveTool(toolName) {
        // ボタン状態更新
        this.toolButtons.forEach((button, id) => {
            button.classList.remove('active');
        });
        
        const activeButton = this.toolButtons.get(toolName + '-tool');
        if (activeButton) {
            activeButton.classList.add('active');
        }

        this.currentTool = toolName;
        
        // ToolManagerに通知
        if (this.toolManager) {
            this.toolManager.setCurrentTool(toolName);
        }

        // ステータス更新
        this.updateToolStatus(toolName);
    }

    /**
     * セパレーター作成
     */
    createSeparator(container) {
        const separator = document.createElement('div');
        separator.className = 'tool-separator';
        container.appendChild(separator);
    }

    /**
     * ポップアップシステム初期化
     */
    async initializePopupSystem() {
        console.log('🔧 ポップアップシステム初期化開始');
        
        // ペン設定ポップアップ
        await this.createPenSettingsPopup();
        
        // リサイズ設定ポップアップ
        await this.createResizeSettingsPopup();
        
        // ポップアップ外クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && !e.target.closest('.tool-button')) {
                this.closeAllPopups();
            }
        });

        console.log('✅ ポップアップシステム初期化完了');
    }

    /**
     * ペン設定ポップアップ作成
     */
    async createPenSettingsPopup() {
        const popup = document.createElement('div');
        popup.className = 'popup-panel pen-settings draggable';
        popup.id = 'pen-settings';
        popup.style.left = '60px';
        popup.style.top = '100px';

        popup.innerHTML = `
            <div class="popup-title">ベクターペンツール設定</div>
            
            <div class="setting-group">
                <div class="size-presets" id="size-presets">
                    ${this.createSizePresets()}
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">サイズ</div>
                <div class="slider-controls">
                    ${this.createSliderControls('pen-size')}
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">不透明度</div>
                <div class="slider-controls">
                    ${this.createSliderControls('pen-opacity')}
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">筆圧</div>
                <div class="slider-controls">
                    ${this.createSliderControls('pen-pressure')}
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">線補正</div>
                <div class="slider-controls">
                    ${this.createSliderControls('pen-smoothing')}
                </div>
            </div>
            
            <div class="setting-group">
                ${this.createCheckboxSettings()}
            </div>
        `;

        document.getElementById('popup-container').appendChild(popup);
        this.popups.set('pen-settings', popup);
        
        // ドラッグ機能追加
        this.makeDraggable(popup);
        
        // スライダー初期化
        this.initializeSliders(popup);
    }

    /**
     * リサイズ設定ポップアップ作成
     */
    async createResizeSettingsPopup() {
        const popup = document.createElement('div');
        popup.className = 'popup-panel resize-settings draggable';
        popup.id = 'resize-settings';
        popup.style.left = '60px';
        popup.style.top = '150px';

        popup.innerHTML = `
            <div class="popup-title">キャンバスリサイズ</div>
            
            <div class="setting-group">
                <div class="setting-label">キャンバスサイズ</div>
                <div class="size-input-group">
                    <div class="size-input-field">
                        <input type="number" class="size-input" id="canvas-width" min="100" max="4096" value="400">
                    </div>
                    <div class="size-multiply">×</div>
                    <div class="size-input-field">
                        <input type="number" class="size-input" id="canvas-height" min="100" max="4096" value="400">
                    </div>
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">プリセット</div>
                <div class="resize-buttons">
                    <div class="resize-button" data-size="400,400">400×400</div>
                    <div class="resize-button" data-size="600,600">600×600</div>
                    <div class="resize-button" data-size="800,600">800×600</div>
                </div>
            </div>
            
            <div class="setting-group">
                <div class="resize-buttons">
                    <div class="resize-button" id="apply-resize">適用</div>
                    <div class="resize-button primary" id="apply-resize-center">適用して中央寄せ</div>
                </div>
            </div>
        `;

        document.getElementById('popup-container').appendChild(popup);
        this.popups.set('resize-settings', popup);
        
        this.makeDraggable(popup);
        this.setupResizeHandlers(popup);
    }

    /**
     * ステータスパネル初期化
     */
    async initializeStatusPanel() {
        console.log('🔧 ステータスパネル初期化開始');
        
        const statusPanel = document.getElementById('status-panel');
        if (!statusPanel) {
            throw new Error('status-panel要素が見つかりません');
        }

        statusPanel.innerHTML = `
            <div class="status-group">
                <div class="status-item">Canvas: <span id="canvas-info">400×400px</span></div>
                <div class="status-item">Tool: <span id="current-tool">ベクターペン</span></div>
                <div class="status-item">Color: <span id="current-color">#800000</span></div>
                <div class="status-item">座標: <span id="coordinates">x: 0, y: 0</span></div>
                <div class="status-item">筆圧: <span id="pressure-monitor">0.0%</span></div>
            </div>
            
            <div class="status-group">
                <div class="status-item">FPS: <span id="fps">60</span></div>
                <div class="status-item">GPU: <span id="gpu-usage">45%</span></div>
                <div class="status-item">Memory: <span id="memory-usage">1.2GB</span></div>
            </div>
        `;

        // ステータス要素参照保存
        this.statusElements.set('canvas-info', document.getElementById('canvas-info'));
        this.statusElements.set('current-tool', document.getElementById('current-tool'));
        this.statusElements.set('current-color', document.getElementById('current-color'));
        this.statusElements.set('coordinates', document.getElementById('coordinates'));
        this.statusElements.set('pressure-monitor', document.getElementById('pressure-monitor'));
        this.statusElements.set('fps', document.getElementById('fps'));
        this.statusElements.set('gpu-usage', document.getElementById('gpu-usage'));
        this.statusElements.set('memory-usage', document.getElementById('memory-usage'));

        console.log('✅ ステータスパネル初期化完了');
    }

    /**
     * ポップアップ表示切り替え
     */
    togglePopup(popupId) {
        const popup = this.popups.get(popupId);
        if (!popup) return;

        // 他のポップアップを閉じる
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }

        // 表示切り替え
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        
        this.activePopup = isVisible ? null : popup;

        // @pixi/ui統合アニメーション
        if (window.gsap && !isVisible) {
            gsap.fromTo(popup, 
                { scale: 0.9, opacity: 0 }, 
                { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
            );
        }
    }

    /**
     * 全ポップアップを閉じる
     */
    closeAllPopups() {
        this.popups.forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
    }

    /**
     * ツールステータス更新
     */
    updateToolStatus(toolName) {
        const toolNames = {
            pen: 'ベクターペン',
            eraser: '消しゴム',
            fill: '塗りつぶし',
            select: '範囲選択'
        };
        
        const statusElement = this.statusElements.get('current-tool');
        if (statusElement) {
            statusElement.textContent = toolNames[toolName] || toolName;
        }
    }

    /**
     * 座標更新
     */
    updateCoordinates(x, y) {
        const coordElement = this.statusElements.get('coordinates');
        if (coordElement) {
            coordElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }

    /**
     * キャンバス情報更新
     */
    updateCanvasInfo(width, height) {
        const canvasElement = this.statusElements.get('canvas-info');
        if (canvasElement) {
            canvasElement.textContent = `${width}×${height}px`;
        }
    }

    // ==== UI要素作成ヘルパー ====

    createSizePresets() {
        const sizes = [1, 2, 4, 8, 16, 32];
        return sizes.map((size, index) => `
            <div class="size-preset-item ${index === 4 ? 'active' : ''}" data-size="${size}">
                <div class="size-preview-circle" style="width: ${Math.min(20, Math.max(0.5, size))}px; height: ${Math.min(20, Math.max(0.5, size))}px; background: #800000;"></div>
                <div class="size-preview-label">${size}</div>
                <div class="size-preview-percent">85%</div>
            </div>
        `).join('');
    }

    createSliderControls(sliderId) {
        return `
            <div class="slider-button small" id="${sliderId}-decrease-small">-0.1</div>
            <div class="slider-button small" id="${sliderId}-decrease">-1</div>
            <div class="slider-button small" id="${sliderId}-decrease-large">-10</div>
            <div class="slider-container" style="flex: 1; margin-bottom: 0;">
                <div class="slider" id="${sliderId}-slider">
                    <div class="slider-track" id="${sliderId}-track"></div>
                    <div class="slider-handle" id="${sliderId}-handle"></div>
                </div>
                <div class="slider-value" id="${sliderId}-value">16.0px</div>
            </div>
            <div class="slider-button small" id="${sliderId}-increase-small">+0.1</div>
            <div class="slider-button small" id="${sliderId}-increase">+1</div>
            <div class="slider-button small" id="${sliderId}-increase-large">+10</div>
        `;
    }

    createCheckboxSettings() {
        return `
            <div class="checkbox-container">
                <div class="checkbox-left">
                    <div class="checkbox checked" id="pressure-sensitivity"></div>
                    <div class="checkbox-label">筆圧感度 (120Hz対応)</div>
                </div>
            </div>
            
            <div class="checkbox-container">
                <div class="checkbox-left">
                    <div class="checkbox checked" id="edge-smoothing"></div>
                    <div class="checkbox-label">エッジスムージング</div>
                </div>
            </div>
            
            <div class="checkbox-container">
                <div class="checkbox-left">
                    <div class="checkbox checked" id="gpu-acceleration"></div>
                    <div class="checkbox-label">GPU加速</div>
                </div>
                <div class="checkbox-status">遅延: 0.6ms</div>
            </div>
        `;
    }

    // ==== アイコン作成 ====

    createDownloadIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = `
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        `;
        return svg;
    }

    createResizeIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = `
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <path d="M8 12h8"/>
            <path d="M12 8v8"/>
        `;
        return svg;
    }

    createPaletteIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = `
            <circle cx="13.5" cy="6.5" r=".5"/>
            <circle cx="17.5" cy="10.5" r=".5"/>
            <circle cx="8.5" cy="7.5" r=".5"/>
            <circle cx="6.5" cy="12.5" r=".5"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
        `;
        return svg;
    }

    createPenIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = `
            <path d="M3 21v-4a4 4 0 1 1 4 4h-4"/>
            <path d="M21 3a16 16 0 0 0 -12.8 10.2"/>
            <path d="M21 3a16 16 0 0 1 -10.2 12.8"/>
            <path d="M10.6 9a9 9 0 0 1 4.4 4.4"/>
        `;
        return svg;
    }

    createEraserIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = `
            <path d="M20 20h-10.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41L11.5 20"/>
            <path d="M18 13.3l-6.3-6.3"/>
        `;
        return svg;
    }

    createFillIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = `
            <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10"/>
        `;
        return svg;
    }

    createSelectIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = `
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
            <path d="M9 9h6v6H9z"/>
        `;
        return svg;
    }

    createSettingsIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = `
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        `;
        return svg;
    }

    // ==== ユーティリティメソッド ====

    /**
     * ドラッグ機能追加
     */
    makeDraggable(popup) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        popup.addEventListener('mousedown', (e) => {
            if (e.target === popup || e.target.closest('.popup-title')) {
                isDragging = true;
                popup.classList.add('dragging');
                
                const rect = popup.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const x = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - popup.offsetWidth));
                const y = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - popup.offsetHeight));
                
                popup.style.left = x + 'px';
                popup.style.top = y + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        });
    }

    /**
     * スライダー初期化
     */
    initializeSliders(popup) {
        // Phase1では基本実装、Phase2で@pixi/ui統合
        console.log('📋 スライダー初期化（Phase2でPIXI_UI統合予定）');
    }

    /**
     * リサイズハンドラー設定
     */
    setupResizeHandlers(popup) {
        // リサイズボタンイベント
        popup.addEventListener('click', (e) => {
                            if (e.target.hasAttribute('data-size')) {
                    const [width, height] = e.target.getAttribute('data-size').split(',').map(Number);
                    document.getElementById('canvas-width').value = width;
                    document.getElementById('canvas-height').value = height;
                } else if (e.target.id === 'apply-resize') {
                    this.applyCanvasResize(false);
                } else if (e.target.id === 'apply-resize-center') {
                    this.applyCanvasResize(true);
                }
            }
        });
    }

    /**
     * キャンバスリサイズ適用
     */
    applyCanvasResize(centerContent) {
        const width = parseInt(document.getElementById('canvas-width').value);
        const height = parseInt(document.getElementById('canvas-height').value);
        
        if (this.appCore && this.appCore.resizeCanvas) {
            this.appCore.resizeCanvas(width, height, centerContent);
            this.updateCanvasInfo(width, height);
            this.closeAllPopups();
            console.log(`🔄 キャンバスリサイズ適用: ${width}x${height}, 中央寄せ: ${centerContent}`);
        }
    }

    /**
     * @pixi/ui統合強化（Phase2準備）
     */
    enhanceButtonWithPixiUI(button, toolConfig) {
        // 📋 Phase2: @pixi/ui.FancyButton統合予定
        // const pixiButton = new PIXI_UI.FancyButton({
        //     defaultView: toolConfig.icon,
        //     text: toolConfig.name
        // });
        console.log('📋 Phase2準備: @pixi/ui統合予定', toolConfig.name);
    }

    /**
     * Phase2準備: レイヤーUI統合
     */
    prepareLayerUI() {
        // 📋 Phase2: レイヤーパネルUI実装予定
        console.log('📋 Phase2準備: レイヤーUI統合予定');
    }

    /**
     * Phase3準備: アニメーションUI統合
     */
    prepareAnimationUI() {
        // 📋 Phase3: タイムライン・オニオンスキンUI実装予定
        console.log('📋 Phase3準備: アニメーションUI統合予定');
    }
}
                /**
 * 🎨 UI統括マネージャー - @pixi/ui統合版
 * 🎯 AI_WORK_SCOPE: UI統括・@pixi/ui活用・ポップアップ管理・ステータス表示
 * 🎯 DEPENDENCIES: main.js, app-core.js
 * 🎯 CDN_USAGE: PIXI, PIXI_UI, GSAP（アニメーション）
 * 🎯 ISOLATION_TEST: ✅ UI単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行超過時 → ui-components.js分割
 * 
 * 📋 PHASE_TARGET: Phase1-3対