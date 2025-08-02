/**
 * CanvasController.js
 * 
 * PixiJSベースのキャンバス管理とメイン制御を行うコントローラー
 * Phase2対応: PixiJS統合、レイヤー管理、描画ツール統合
 */

import * as PIXI from 'pixi.js';
import { EventStore } from './core/EventStore.js';
import { PixiCoordinateUnifier } from './core/PixiCoordinateUnifier.js';
import { PixiUnifiedRenderer } from './PixiUnifiedRenderer.js';
import { PixiInputController } from './PixiInputController.js';
import { PixiLayerProcessor } from './PixiLayerProcessor.js';
import { PixiToolProcessor } from './PixiToolProcessor.js';
import { PixiUIController } from './PixiUIController.js';
import { ColorProcessor } from './ColorProcessor.js';
import { HistoryController } from './HistoryController.js';
import { ShortcutController } from './ShortcutController.js';

export class CanvasController {
    constructor() {
        // Phase2: PixiJS統合による新しいアーキテクチャ
        this.eventStore = new EventStore();
        this.coordinateUnifier = new PixiCoordinateUnifier();
        this.renderer = null;
        this.inputController = null;
        this.layerProcessor = null;
        this.toolProcessor = null;
        this.uiController = null;
        this.colorProcessor = null;
        this.historyController = null;
        this.shortcutController = null;
        
        // PixiJSアプリケーション
        this.pixiApp = null;
        this.rootContainer = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        
        // キャンバス状態
        this.canvasSize = { width: 800, height: 600 };
        this.viewportTransform = { x: 0, y: 0, scale: 1 };
        this.isInitialized = false;
        
        // Phase2新機能
        this.layerSystem = new Map();
        this.activeLayerId = null;
        this.currentTool = 'brush';
        this.toolSettings = new Map();
        
        this._setupEventBindings();
    }

    /**
     * キャンバスの初期化
     * Phase2: PixiJSアプリケーションとコンテナ階層の構築
     */
    async initialize(canvasElement) {
        try {
            console.log('CanvasController: 初期化開始');
            
            // PixiJSアプリケーション作成
            await this._initializePixiApp(canvasElement);
            
            // コンテナ階層構築
            this._setupContainerHierarchy();
            
            // 各コントローラー初期化
            await this._initializeControllers();
            
            // 座標系統合初期化
            this.coordinateUnifier.initialize(this.pixiApp, this.canvasSize);
            
            // デフォルト設定
            this._setupDefaultConfiguration();
            
            this.isInitialized = true;
            this.eventStore.dispatch('canvas:initialized', { size: this.canvasSize });
            
            console.log('CanvasController: 初期化完了');
            
        } catch (error) {
            console.error('CanvasController初期化エラー:', error);
            throw error;
        }
    }

    /**
     * PixiJSアプリケーション初期化
     */
    async _initializePixiApp(canvasElement) {
        this.pixiApp = new PIXI.Application({
            width: this.canvasSize.width,
            height: this.canvasSize.height,
            view: canvasElement,
            backgroundColor: 0xFFFFFF,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        // WebGL対応チェック
        if (!this.pixiApp.renderer.type === PIXI.RENDERER_TYPE.WEBGL) {
            console.warn('WebGL未対応、Canvas2Dフォールバック');
        }

        // リサイズハンドリング
        window.addEventListener('resize', this._handleResize.bind(this));
    }

    /**
     * PixiJS Container階層構築
     */
    _setupContainerHierarchy() {
        // ルートコンテナ
        this.rootContainer = new PIXI.Container();
        this.pixiApp.stage.addChild(this.rootContainer);
        
        // 描画レイヤーコンテナ
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawingContainer';
        this.rootContainer.addChild(this.drawingContainer);
        
        // UIレイヤーコンテナ
        this.uiContainer = new PIXI.Container();
        this.uiContainer.name = 'uiContainer';
        this.rootContainer.addChild(this.uiContainer);
        
        // インタラクティブ設定
        this.drawingContainer.interactive = true;
        this.drawingContainer.interactiveChildren = true;
    }

    /**
     * 各コントローラー初期化
     */
    async _initializeControllers() {
        // 描画レンダラー
        this.renderer = new PixiUnifiedRenderer(this.pixiApp, this.drawingContainer);
        await this.renderer.initialize();
        
        // 入力制御
        this.inputController = new PixiInputController(
            this.pixiApp, 
            this.coordinateUnifier, 
            this.eventStore
        );
        await this.inputController.initialize();
        
        // レイヤー処理
        this.layerProcessor = new PixiLayerProcessor(
            this.drawingContainer, 
            this.eventStore
        );
        await this.layerProcessor.initialize();
        
        // ツール処理
        this.toolProcessor = new PixiToolProcessor(
            this.renderer, 
            this.eventStore
        );
        await this.toolProcessor.initialize();
        
        // UI制御
        this.uiController = new PixiUIController(
            this.uiContainer, 
            this.eventStore
        );
        await this.uiController.initialize();
        
        // カラー処理
        this.colorProcessor = new ColorProcessor(this.eventStore);
        this.colorProcessor.initialize();
        
        // 履歴制御
        this.historyController = new HistoryController(this.eventStore);
        this.historyController.initialize();
        
        // ショートカット制御
        this.shortcutController = new ShortcutController(this.eventStore);
        this.shortcutController.initialize();
    }

    /**
     * デフォルト設定
     */
    _setupDefaultConfiguration() {
        // デフォルトレイヤー作成
        this.layerProcessor.createLayer('background', 0);
        this.layerProcessor.createLayer('main', 1);
        this.activeLayerId = 'main';
        
        // デフォルトツール設定
        this.toolSettings.set('brush', {
            size: 10,
            opacity: 1.0,
            color: 0x000000,
            blendMode: 'normal'
        });
        
        this.toolSettings.set('eraser', {
            size: 15,
            opacity: 1.0,
            blendMode: 'erase'
        });
    }

    /**
     * イベントバインディング設定
     */
    _setupEventBindings() {
        // ツール変更
        this.eventStore.on('tool:changed', (data) => {
            this.currentTool = data.tool;
            this.toolProcessor.setCurrentTool(data.tool, data.settings);
        });
        
        // レイヤー変更
        this.eventStore.on('layer:changed', (data) => {
            this.activeLayerId = data.layerId;
            this.layerProcessor.setActiveLayer(data.layerId);
        });
        
        // カラー変更
        this.eventStore.on('color:changed', (data) => {
            const toolSettings = this.toolSettings.get(this.currentTool);
            if (toolSettings) {
                toolSettings.color = data.color;
                this.toolProcessor.updateToolSettings(this.currentTool, toolSettings);
            }
        });
        
        // ビューポート変更
        this.eventStore.on('viewport:changed', (data) => {
            this.viewportTransform = data;
            this._updateViewportTransform();
        });
        
        // キャンバスリサイズ
        this.eventStore.on('canvas:resize', (data) => {
            this.resizeCanvas(data.width, data.height);
        });
    }

    /**
     * ビューポート変換更新
     */
    _updateViewportTransform() {
        if (this.rootContainer) {
            this.rootContainer.x = this.viewportTransform.x;
            this.rootContainer.y = this.viewportTransform.y;
            this.rootContainer.scale.set(this.viewportTransform.scale);
        }
    }

    /**
     * ウィンドウリサイズハンドリング
     */
    _handleResize() {
        if (!this.isInitialized) return;
        
        const container = this.pixiApp.view.parentElement;
        if (container) {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            this.resizeCanvas(newWidth, newHeight);
        }
    }

    /**
     * キャンバスサイズ変更
     */
    resizeCanvas(width, height) {
        this.canvasSize = { width, height };
        this.pixiApp.renderer.resize(width, height);
        this.coordinateUnifier.updateCanvasSize(width, height);
        this.eventStore.dispatch('canvas:resized', { width, height });
    }

    /**
     * ツール変更
     */
    setTool(toolName, settings = {}) {
        this.currentTool = toolName;
        
        // ツール設定更新
        const currentSettings = this.toolSettings.get(toolName) || {};
        const newSettings = { ...currentSettings, ...settings };
        this.toolSettings.set(toolName, newSettings);
        
        this.eventStore.dispatch('tool:changed', { 
            tool: toolName, 
            settings: newSettings 
        });
    }

    /**
     * レイヤー作成
     */
    createLayer(name, index) {
        return this.layerProcessor.createLayer(name, index);
    }

    /**
     * レイヤー削除
     */
    deleteLayer(layerId) {
        this.layerProcessor.deleteLayer(layerId);
    }

    /**
     * アクティブレイヤー設定
     */
    setActiveLayer(layerId) {
        this.activeLayerId = layerId;
        this.eventStore.dispatch('layer:changed', { layerId });
    }

    /**
     * カラー設定
     */
    setColor(color) {
        this.eventStore.dispatch('color:changed', { color });
    }

    /**
     * ズーム制御
     */
    zoom(factor, centerPoint = null) {
        const center = centerPoint || { 
            x: this.canvasSize.width / 2, 
            y: this.canvasSize.height / 2 
        };
        
        const newScale = Math.max(0.1, Math.min(10, this.viewportTransform.scale * factor));
        
        // ズーム中心を基準に位置調整
        const dx = (center.x - this.viewportTransform.x) * (1 - factor);
        const dy = (center.y - this.viewportTransform.y) * (1 - factor);
        
        this.viewportTransform = {
            x: this.viewportTransform.x + dx,
            y: this.viewportTransform.y + dy,
            scale: newScale
        };
        
        this.eventStore.dispatch('viewport:changed', this.viewportTransform);
    }

    /**
     * パン制御
     */
    pan(deltaX, deltaY) {
        this.viewportTransform.x += deltaX;
        this.viewportTransform.y += deltaY;
        this.eventStore.dispatch('viewport:changed', this.viewportTransform);
    }

    /**
     * ビューポートリセット
     */
    resetViewport() {
        this.viewportTransform = { x: 0, y: 0, scale: 1 };
        this.eventStore.dispatch('viewport:changed', this.viewportTransform);
    }

    /**
     * エクスポート機能
     */
    async exportCanvas(format = 'png', quality = 1.0) {
        try {
            // UIレイヤーを一時的に非表示
            const uiVisible = this.uiContainer.visible;
            this.uiContainer.visible = false;
            
            // レンダリング
            const renderTexture = PIXI.RenderTexture.create({
                width: this.canvasSize.width,
                height: this.canvasSize.height
            });
            
            this.pixiApp.renderer.render(this.rootContainer, { renderTexture });
            
            // データURL取得
            const canvas = this.pixiApp.renderer.extract.canvas(renderTexture);
            const dataURL = canvas.toDataURL(`image/${format}`, quality);
            
            // UIレイヤー表示復元
            this.uiContainer.visible = uiVisible;
            
            // テクスチャクリーンアップ
            renderTexture.destroy(true);
            
            return dataURL;
            
        } catch (error) {
            console.error('エクスポートエラー:', error);
            throw error;
        }
    }

    /**
     * キャンバスクリア
     */
    clearCanvas() {
        this.layerProcessor.clearAllLayers();
        this.historyController.addSnapshot('clear');
        this.eventStore.dispatch('canvas:cleared');
    }

    /**
     * 現在の状態取得
     */
    getState() {
        return {
            canvasSize: this.canvasSize,
            viewportTransform: this.viewportTransform,
            activeLayerId: this.activeLayerId,
            currentTool: this.currentTool,
            toolSettings: Object.fromEntries(this.toolSettings),
            layers: this.layerProcessor.getLayerInfo(),
            isInitialized: this.isInitialized
        };
    }

    /**
     * リソースクリーンアップ
     */
    destroy() {
        if (this.pixiApp) {
            this.pixiApp.destroy(true, true);
        }
        
        if (this.inputController) {
            this.inputController.destroy();
        }
        
        if (this.shortcutController) {
            this.shortcutController.destroy();
        }
        
        window.removeEventListener('resize', this._handleResize.bind(this));
        this.eventStore.removeAllListeners();
        
        this.isInitialized = false;
    }
}