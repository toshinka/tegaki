// src/components/App.js - アプリケーション全体制御

// [修正] 正しいパスからBezierPenEngineをインポート
import { BezierPenEngine } from '../engine/vector/BezierPenEngine.js';
import { Toolbar } from './Toolbar.js';
import { Canvas } from './Canvas.js';

/**
 * アプリケーション状態管理
 */
class AppState {
    constructor() {
        this.penSize = 3;
        this.penOpacity = 100;
        this.currentTool = 'pen';
        this.listeners = [];
    }
    
    setState(updates) {
        Object.assign(this, updates);
        this.notifyListeners();
    }
    
    addListener(listener) {
        this.listeners.push(listener);
    }
    
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    
    notifyListeners() {
        this.listeners.forEach(listener => listener(this));
    }
    
    getPenSettings() {
        return {
            size: this.penSize,
            opacity: this.penOpacity / 100,
            color: '#800000'
        };
    }
}

/**
 * メインアプリケーションクラス
 */
export class App {
    constructor() {
        this.state = new AppState();
        this.bezierPenEngine = null;
        this.toolbar = null;
        this.canvas = null;
        this.isDrawing = false;
        
        // アプリケーション構造をDOM上に構築
        this.createAppStructure();
    }
    
    /**
     * アプリケーション初期化
     */
    initialize() {
        try {
            this.initializeComponents();
            this.setupStateListeners();
            this.initializeEngine();
            
            console.log('✅ App components initialized successfully');
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * HTMLアプリケーション構造をDOMに構築
     */
    createAppStructure() {
        document.body.innerHTML = `
            <div class="app-container">
                <div class="toolbar">
                    <div class="tool-button active" data-tool="pen" title="ベクターペンツール">✏️</div>
                </div>
                <div class="canvas-area">
                    <div class="canvas-container" id="canvasContainer">
                        <canvas id="vector-canvas" width="800" height="600"></canvas>
                    </div>
                </div>
                <div class="control-panel" id="penControls">
                    <div class="control-group">
                        <label class="control-label"><span>ペンサイズ</span><input type="number" class="control-input" id="penSizeValue" value="3" min="1" max="50"></label>
                        <input type="range" class="control-slider" id="penSizeSlider" value="3" min="1" max="50">
                    </div>
                    <div class="control-group">
                        <label class="control-label"><span>透明度</span><input type="number" class="control-input" id="penOpacityValue" value="100" min="1" max="100"></label>
                        <input type="range" class="control-slider" id="penOpacitySlider" value="100" min="1" max="100">
                    </div>
                </div>
                <div class="status-bar">
                    <div class="status-item"><span>エンジン:</span><span class="status-value">Bezier.js Vector</span></div>
                    <div class="status-item"><span>サイズ:</span><span class="status-value" id="statusSize">3</span></div>
                    <div class="status-item"><span>透明度:</span><span class="status-value" id="statusOpacity">100%</span></div>
                    <div class="status-item"><span>解像度:</span><span class="status-value">800x600</span></div>
                </div>
            </div>
        `;
    }
    
    /**
     * コンポーネント初期化
     */
    initializeComponents() {
        const canvasElement = document.getElementById('vector-canvas');
        if (!canvasElement) {
            throw new Error('Canvas element not found');
        }
        
        this.toolbar = new Toolbar(this.state);
        // [修正] CanvasコンポーネントにAppインスタンス自身を渡す
        this.canvas = new Canvas(canvasElement, this);
        
        console.log('✅ Components created successfully');
    }
    
    /**
     * 描画エンジン初期化
     */
    initializeEngine() {
        const canvasElement = document.getElementById('vector-canvas');
        this.bezierPenEngine = new BezierPenEngine(canvasElement);
        this.bezierPenEngine.initCanvas();
        
        this.bezierPenEngine.updateSettings(this.state.getPenSettings());
        
        console.log('✅ BezierPenEngine initialized');
    }
    
    /**
     * 状態変更リスナー設定
     */
    setupStateListeners() {
        this.state.addListener((newState) => {
            if (this.bezierPenEngine) {
                this.bezierPenEngine.updateSettings(newState.getPenSettings());
            }
            this.updateStatusBar(newState);
        });
    }
    
    /**
     * ステータスバー更新
     */
    updateStatusBar(state) {
        const statusSize = document.getElementById('statusSize');
        const statusOpacity = document.getElementById('statusOpacity');
        
        if (statusSize) statusSize.textContent = state.penSize;
        if (statusOpacity) statusOpacity.textContent = state.penOpacity + '%';
    }
    
    /**
     * 描画エンジンアクセサー（他のコンポーネント用）
     */
    getEngine() {
        return this.bezierPenEngine;
    }
    
    /**
     * 描画状態管理
     */
    setDrawing(isDrawing) {
        this.isDrawing = isDrawing;
    }
    
    isCurrentlyDrawing() {
        return this.isDrawing;
    }
}
