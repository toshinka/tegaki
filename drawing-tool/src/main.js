// モダンお絵かきツール v3.3 - Phase1基本版
// PixiJS v8統一基盤 + アイコン責務集約対応

import { Application, Graphics, Container, Text } from 'pixi.js';
import mitt from 'mitt';

/**
 * アプリケーションメインクラス（Phase1基本版）
 * デザイン設定はindex.htmlから読み込み
 */
class ModernDrawingApp {
    constructor() {
        // デザイン設定読み込み（index.htmlから）
        this.config = window.DESIGN_CONFIG || this.getDefaultConfig();
        this.pixiConfig = window.PIXI_CONFIG || this.getDefaultPixiConfig();
        
        // イベントバス初期化
        this.eventBus = mitt();
        
        // 状態管理
        this.state = {
            currentTool: 'pen',
            brushSize: 10,
            color: this.config.colors.maroon,
            isDrawing: false
        };
        
        // 初期化実行
        this.init();
    }
    
    /**
     * アプリケーション初期化
     */
    async init() {
        try {
            console.log('🎨 モダンお絵かきツール v3.3 Phase1 起動中...');
            
            // PixiJS v8アプリ初期化
            await this.initPixiApp();
            
            // UI初期化（デザイン設定から）
            this.initUI();
            
            // イベント初期化
            this.initEvents();
            
            console.log('✅ Phase1初期化完了');
            
        } catch (error) {
            console.error('❌ 初期化エラー:', error);
            this.showError('アプリケーションの初期化に失敗しました');
        }
    }
    
    /**
     * PixiJS v8アプリ初期化
     */
    async initPixiApp() {
        const canvas = document.getElementById('drawingCanvas');
        if (!canvas) {
            throw new Error('drawingCanvas要素が見つかりません');
        }
        
        // PixiJS v8アプリ作成
        this.app = new Application();
        
        // 初期化設定
        await this.app.init({
            canvas: canvas,
            width: 800,
            height: 600,
            preference: this.pixiConfig.preference || 'webgl',
            antialias: this.pixiConfig.antialias !== false,
            autoDensity: this.pixiConfig.autoDensity !== false,
            resolution: this.pixiConfig.resolution || window.devicePixelRatio || 1,
            backgroundColor: this.pixiConfig.backgroundColor || this.config.colors.cream
        });
        
        console.log('🖼️ PixiJS v8アプリ初期化完了');
        
        // 基本レイヤー作成
        this.setupBasicLayers();
    }
    
    /**
     * 基本レイヤーセットアップ
     */
    setupBasicLayers() {
        // 背景レイヤー
        this.backgroundLayer = new Container();
        this.backgroundLayer.name = 'background';
        this.app.stage.addChild(this.backgroundLayer);
        
        // 描画レイヤー
        this.drawingLayer = new Container();
        this.drawingLayer.name = 'drawing';
        this.app.stage.addChild(this.drawingLayer);
        
        // UI レイヤー
        this.uiLayer = new Container();
        this.uiLayer.name = 'ui';
        this.app.stage.addChild(this.uiLayer);
        
        // 背景色設定
        const bg = new Graphics();
        bg.rect(0, 0, this.app.screen.width, this.app.screen.height);
        bg.fill(this.config.colors.cream);
        this.backgroundLayer.addChild(bg);
        
        console.log('📚 基本レイヤー作成完了');
    }
    
    /**
     * UI初期化（デザイン設定から動的生成）
     */
    initUI() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) {
            console.warn('sidebar要素が見つかりません');
            return;
        }
        
        // サイドバーアイコン生成
        this.generateSidebarIcons(sidebar);
        
        // ショートカットヒント表示
        this.showShortcutHint();
        
        console.log('🎛️ UI初期化完了');
    }
    
    /**
     * サイドバーアイコン生成（デザイン設定から）
     */
    generateSidebarIcons(sidebar) {
        // 既存のアイコンをクリア
        sidebar.innerHTML = '';
        
        // ツールグループ毎にアイコン生成
        this.config.toolGroups.forEach((group, groupIndex) => {
            group.tools.forEach((tool, toolIndex) => {
                const iconElement = this.createToolIcon(tool);
                sidebar.appendChild(iconElement);
            });
            
            // グループ区切り線（最後のグループ以外）
            if (groupIndex < this.config.toolGroups.length - 1) {
                const separator = document.createElement('div');
                separator.className = 'tool-separator';
                sidebar.appendChild(separator);
            }
        });
    }
    
    /**
     * ツールアイコン作成
     */
    createToolIcon(tool) {
        const icon = document.createElement('div');
        icon.className = 'tool-icon';
        icon.id = `tool-${tool.id}`;
        icon.title = `${tool.title} (${tool.shortcut})`;
        
        // アイコン表示（Phase1では文字で代用）
        icon.innerHTML = this.getIconText(tool.icon);
        
        // アクティブ状態設定
        if (tool.id === this.state.currentTool) {
            icon.classList.add('active');
        }
        
        // クリックイベント
        icon.addEventListener('click', () => {
            this.selectTool(tool.id);
        });
        
        return icon;
    }
    
    /**
     * アイコン文字取得（Phase1暫定実装）
     */
    getIconText(iconId) {
        const iconMap = {
            download: '💾',
            resize: '📐',
            pen: '✏️',
            airbrush: '🖌️',
            blur: '🌫️',
            eraser: '🗑️',
            eyedropper: '💧',
            select: '⬚',
            fill: '🪣',
            text: '📝',
            shape: '⭕',
            transform: '✂️',
            animation: '🎬',
            layers: '📚',
            settings: '⚙️'
        };
        
        return iconMap[iconId] || '❓';
    }
    
    /**
     * ツール選択
     */
    selectTool(toolId) {
        // 前のツールの非アクティブ化
        const prevIcon = document.getElementById(`tool-${this.state.currentTool}`);
        if (prevIcon) {
            prevIcon.classList.remove('active');
        }
        
        // 新しいツールのアクティブ化
        const newIcon = document.getElementById(`tool-${toolId}`);
        if (newIcon) {
            newIcon.classList.add('active');
        }
        
        // 状態更新
        this.state.currentTool = toolId;
        
        // イベント発行
        this.eventBus.emit('toolChanged', { toolId, tool: toolId });
        
        console.log(`🔧 ツール切り替え: ${toolId}`);
    }
    
    /**
     * イベント初期化
     */
    initEvents() {
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
        
        // キャンバスマウスイベント
        const canvas = this.app.canvas;
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // リサイズイベント
        window.addEventListener('resize', () => this.handleResize());
        
        console.log('🎮 イベント初期化完了');
    }
    
    /**
     * キーボードショートカット処理
     */
    handleKeydown(e) {
        // ツールショートカット
        const toolShortcuts = {
            'KeyP': 'pen',
            'KeyA': 'airbrush',
            'KeyB': 'blur',
            'KeyE': 'eraser',
            'KeyI': 'eyedropper',
            'KeyM': 'select',
            'KeyG': 'fill',
            'KeyT': 'text',
            'KeyU': 'shape',
            'KeyV': 'transform'
        };
        
        if (toolShortcuts[e.code]) {
            e.preventDefault();
            this.selectTool(toolShortcuts[e.code]);
            return;
        }
        
        // その他のショートカット
        if (e.code === 'Tab') {
            e.preventDefault();
            this.togglePanel();
        } else if (e.code === 'KeyF') {
            e.preventDefault();
            this.toggleFullscreen();
        } else if (e.code === 'Escape') {
            e.preventDefault();
            this.closePopups();
        }
    }
    
    /**
     * マウスダウン処理
     */
    handleMouseDown(e) {
        if (this.state.currentTool === 'pen') {
            this.state.isDrawing = true;
            this.startDrawing(e);
        }
    }
    
    /**
     * マウス移動処理
     */
    handleMouseMove(e) {
        if (this.state.isDrawing && this.state.currentTool === 'pen') {
            this.continueDrawing(e);
        }
    }
    
    /**
     * マウスアップ処理
     */
    handleMouseUp(e) {
        if (this.state.isDrawing) {
            this.state.isDrawing = false;
            this.endDrawing(e);
        }
    }
    
    /**
     * 描画開始
     */
    startDrawing(e) {
        const rect = this.app.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.currentStroke = new Graphics();
        this.currentStroke.circle(x, y, this.state.brushSize / 2);
        this.currentStroke.fill(this.state.color);
        
        this.drawingLayer.addChild(this.currentStroke);
        
        this.lastPoint = { x, y };
    }
    
    /**
     * 描画継続
     */
    continueDrawing(e) {
        const rect = this.app.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.currentStroke && this.lastPoint) {
            // 線を描画
            this.currentStroke.moveTo(this.lastPoint.x, this.lastPoint.y);
            this.currentStroke.lineTo(x, y);
            this.currentStroke.stroke({
                width: this.state.brushSize,
                color: this.state.color,
                cap: 'round',
                join: 'round'
            });
            
            this.lastPoint = { x, y };
        }
    }
    
    /**
     * 描画終了
     */
    endDrawing(e) {
        this.currentStroke = null;
        this.lastPoint = null;
    }
    
    /**
     * パネル表示切り替え
     */
    togglePanel() {
        const layerPanel = document.getElementById('layerPanel');
        if (layerPanel) {
            layerPanel.classList.toggle('hidden');
        }
    }
    
    /**
     * フルスクリーン切り替え
     */
    toggleFullscreen() {
        document.body.classList.toggle('fullscreen-drawing');
    }
    
    /**
     * ポップアップ閉じる
     */
    closePopups() {
        const popups = document.querySelectorAll('.popup-panel');
        popups.forEach(popup => {
            popup.style.display = 'none';
        });
    }
    
    /**
     * リサイズ処理
     */
    handleResize() {
        if (this.app) {
            this.app.renderer.resize(
                this.app.canvas.clientWidth,
                this.app.canvas.clientHeight
            );
        }
    }
    
    /**
     * ショートカットヒント表示
     */
    showShortcutHint() {
        const hint = document.getElementById('shortcutHint');
        if (hint) {
            hint.classList.add('visible');
            setTimeout(() => {
                hint.classList.remove('visible');
            }, 3000);
        }
    }
    
    /**
     * エラー表示
     */
    showError(message) {
        console.error(message);
        alert(`エラー: ${message}`);
    }
    
    /**
     * デフォルト設定取得
     */
    getDefaultConfig() {
        return {
            colors: {
                maroon: '#800000',
                lightMaroon: '#aa5a56',
                medium: '#cf9c97',
                lightMedium: '#e9c2ba',
                cream: '#f0e0d6',
                background: '#ffffee'
            },
            toolGroups: [
                {
                    name: 'drawing',
                    tools: [
                        { id: 'pen', icon: 'pen', title: 'ペン', shortcut: 'P' },
                        { id: 'eraser', icon: 'eraser', title: '消しゴム', shortcut: 'E' }
                    ]
                }
            ]
        };
    }
    
    /**
     * デフォルトPixiJS設定取得
     */
    getDefaultPixiConfig() {
        return {
            preference: 'webgl',
            antialias: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
            backgroundColor: '#f0e0d6'
        };
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    window.drawingApp = new ModernDrawingApp();
});