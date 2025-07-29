import { Renderer, Camera, Transform, Polyline, Vec3 } from 'https://cdn.skypack.dev/ogl';

/**
 * OGL統一エンジン - Canvas2D完全排除、OGL WebGL統一
 * 憲章v5.2準拠: Bezier.js依存排除、OGL内蔵機能活用
 */
class OGLUnifiedEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer({ 
            canvas: canvas, 
            alpha: true,
            premultipliedAlpha: false,
            antialias: true
        });
        
        this.scene = new Transform();
        this.camera = new Camera();
        this.camera.position.z = 5;
        
        // OGL統一システム
        this.polylines = [];
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentStroke = null;
        this.currentPoints = [];
        
        // ツール設定
        this.toolSettings = {
            pen: { size: 3, opacity: 100 },
            eraser: { size: 10, opacity: 100 }
        };
        
        // 履歴システム（OGL統一）
        this.history = [];
        this.historyIndex = -1;
        
        this.setupEventListeners();
        this.render();
    }
    
    /**
     * ツール選択 - OGL専用機能起動
     */
    selectTool(toolName) {
        this.currentTool = toolName;
        console.log(`Tool selected: ${toolName}`);
    }
    
    /**
     * ツール設定更新
     */
    updateToolSettings(tool, property, value) {
        if (this.toolSettings[tool]) {
            this.toolSettings[tool][property] = value;
        }
    }
    
    /**
     * OGL Polyline描画処理 - Bezier.js完全排除
     */
    createPolyline(points, tool = 'pen') {
        if (points.length < 2) return null;
        
        const settings = this.toolSettings[tool];
        const isEraser = tool === 'eraser';
        
        // OGL Polylineでの線描画（OGL内蔵機能活用）
        const positions = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            // キャンバス座標をWebGL座標に変換
            const x = (point.x / this.canvas.width) * 2 - 1;
            const y = -((point.y / this.canvas.height) * 2 - 1);
            positions.push(x, y, 0);
        }
        
        const polyline = new Polyline(this.renderer.gl, {
            points: positions,
            vertex: `
                attribute vec3 position;
                attribute vec3 next;
                attribute vec3 prev;
                attribute vec2 uv;
                attribute float side;
                
                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;
                uniform float uLineWidth;
                uniform vec2 uResolution;
                
                void main() {
                    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
                    vec2 nextScreen = (projectionMatrix * modelViewMatrix * vec4(next, 1.0)).xy * aspect;
                    vec2 prevScreen = (projectionMatrix * modelViewMatrix * vec4(prev, 1.0)).xy * aspect;
                    vec2 currentScreen = (projectionMatrix * modelViewMatrix * vec4(position, 1.0)).xy * aspect;
                    
                    vec2 dir = normalize(nextScreen - prevScreen);
                    vec2 normal = vec2(-dir.y, dir.x) * side * uLineWidth / uResolution.y;
                    
                    gl_Position = vec4(currentScreen + normal / aspect, 0.0, 1.0);
                }
            `,
            fragment: `
                precision highp float;
                uniform vec3 uColor;
                uniform float uOpacity;
                uniform float uIsEraser;
                
                void main() {
                    if (uIsEraser > 0.5) {
                        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
                    } else {
                        gl_FragColor = vec4(uColor, uOpacity);
                    }
                }
            `,
            uniforms: {
                uLineWidth: { value: settings.size },
                uResolution: { value: [this.canvas.width, this.canvas.height] },
                uColor: { value: isEraser ? [0, 0, 0] : [0.5, 0, 0] },
                uOpacity: { value: settings.opacity / 100 },
                uIsEraser: { value: isEraser ? 1.0 : 0.0 }
            }
        });
        
        polyline.setParent(this.scene);
        return polyline;
    }
    
    /**
     * 描画開始
     */
    startStroke(x, y) {
        this.isDrawing = true;
        this.currentPoints = [{ x, y }];
        
        // 履歴保存
        this.saveToHistory();
    }
    
    /**
     * 描画中
     */
    continueStroke(x, y) {
        if (!this.isDrawing) return;
        
        this.currentPoints.push({ x, y });
        
        // 既存のストロークを削除
        if (this.currentStroke) {
            this.scene.removeChild(this.currentStroke);
        }
        
        // 新しいPolylineを作成
        this.currentStroke = this.createPolyline(this.currentPoints, this.currentTool);
        if (this.currentStroke) {
            this.polylines.push(this.currentStroke);
        }
        
        this.render();
    }
    
    /**
     * 描画終了
     */
    endStroke() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        this.currentStroke = null;
        this.currentPoints = [];
    }
    
    /**
     * キャンバスクリア
     */
    clear() {
        // 全てのPolylineを削除
        this.polylines.forEach(polyline => {
            if (polyline.parent) {
                polyline.parent.removeChild(polyline);
            }
        });
        this.polylines = [];
        
        this.render();
        this.saveToHistory();
    }
    
    /**
     * 取り消し機能
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreFromHistory();
        }
    }
    
    /**
     * 履歴保存
     */
    saveToHistory() {
        // 現在の状態を保存（簡易版）
        const state = this.polylines.length;
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
    }
    
    /**
     * 履歴復元
     */
    restoreFromHistory() {
        // 簡易的な履歴復元
        if (this.polylines.length > 0) {
            const lastPolyline = this.polylines.pop();
            if (lastPolyline.parent) {
                lastPolyline.parent.removeChild(lastPolyline);
            }
            this.render();
        }
    }
    
    /**
     * キャンバスリサイズ
     */
    resizeCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.setSize(width, height);
        this.render();
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        let isPointerDown = false;
        
        // Pointer Events API使用（モダンブラウザ対応）
        this.canvas.addEventListener('pointerdown', (e) => {
            isPointerDown = true;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.startStroke(x, y);
        });
        
        this.canvas.addEventListener('pointermove', (e) => {
            if (!isPointerDown) return;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.continueStroke(x, y);
        });
        
        this.canvas.addEventListener('pointerup', () => {
            if (isPointerDown) {
                isPointerDown = false;
                this.endStroke();
            }
        });
        
        this.canvas.addEventListener('pointerleave', () => {
            if (isPointerDown) {
                isPointerDown = false;
                this.endStroke();
            }
        });
    }
    
    /**
     * OGL統一描画フロー
     */
    render() {
        this.renderer.render({ scene: this.scene, camera: this.camera });
    }
}

/**
 * UIコントローラー - ツール・パネル制御
 */
class UIController {
    constructor(engine) {
        this.engine = engine;
        this.currentTool = 'pen';
        
        this.setupToolButtons();
        this.setupControlPanels();
        this.setupActionButtons();
        
        // 初期パネル表示
        this.showToolPanel('pen');
    }
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
        const toolButtons = document.querySelectorAll('.tool-button');
        
        toolButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tool = button.getAttribute('data-tool');
                this.selectTool(tool);
            });
        });
    }
    
    /**
     * ツール選択
     */
    selectTool(tool) {
        // ボタン状態更新
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
        
        // エンジンツール変更
        this.engine.selectTool(tool);
        this.currentTool = tool;
        
        // パネル表示切替
        this.showToolPanel(tool);
    }
    
    /**
     * ツールパネル表示
     */
    showToolPanel(tool) {
        const controlPanel = document.getElementById('controlPanel');
        const toolControls = document.querySelectorAll('.tool-controls');
        
        // 全パネル非表示
        toolControls.forEach(panel => {
            panel.style.display = 'none';
        });
        
        // 対象パネル表示
        const targetPanel = document.getElementById(`${tool}Controls`);
        if (targetPanel) {
            targetPanel.style.display = 'block';
            controlPanel.classList.add('show');
        } else {
            controlPanel.classList.remove('show');
        }
    }
    
    /**
     * コントロールパネル設定
     */
    setupControlPanels() {
        // ペンコントロール
        this.setupSliderControl('penSize', 'penSizeSlider', (value) => {
            this.engine.updateToolSettings('pen', 'size', value);
        });
        
        this.setupSliderControl('penOpacity', 'penOpacitySlider', (value) => {
            this.engine.updateToolSettings('pen', 'opacity', value);
        });
        
        // 消しゴムコントロール
        this.setupSliderControl('eraserSize', 'eraserSizeSlider', (value) => {
            this.engine.updateToolSettings('eraser', 'size', value);
        });
        
        this.setupSliderControl('eraserOpacity', 'eraserOpacitySlider', (value) => {
            this.engine.updateToolSettings('eraser', 'opacity', value);
        });
        
        // リサイズコントロール
        this.setupSliderControl('canvasWidth', 'canvasWidthSlider', (value) => {
            const height = parseInt(document.getElementById('canvasHeight').value);
            this.engine.resizeCanvas(value, height);
        });
        
        this.setupSliderControl('canvasHeight', 'canvasHeightSlider', (value) => {
            const width = parseInt(document.getElementById('canvasWidth').value);
            this.engine.resizeCanvas(width, value);
        });
    }
    
    /**
     * スライダーコントロール設定
     */
    setupSliderControl(inputId, sliderId, callback) {
        const input = document.getElementById(inputId);
        const slider = document.getElementById(sliderId);
        
        if (!input || !slider) return;
        
        // 同期処理
        const syncValues = (value) => {
            input.value = value;
            slider.value = value;
            callback(parseInt(value));
        };
        
        input.addEventListener('input', () => syncValues(input.value));
        slider.addEventListener('input', () => syncValues(slider.value));
    }
    
    /**
     * アクションボタン設定
     */
    setupActionButtons() {
        const clearButton = document.getElementById('clearButton');
        const undoButton = document.getElementById('undoButton');
        
        clearButton.addEventListener('click', () => {
            this.engine.clear();
        });
        
        undoButton.addEventListener('click', () => {
            this.engine.undo();
        });
    }
}

/**
 * アプリケーション初期化 - OGL統一エンジン起動
 */
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    
    try {
        // OGL統一エンジン初期化
        const engine = new OGLUnifiedEngine(canvas);
        
        // UIコントローラー初期化
        const uiController = new UIController(engine);
        
        console.log('OGL Unified Engine initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize OGL Unified Engine:', error);
        
        // フォールバック表示
        const canvasWrapper = document.querySelector('.canvas-wrapper');
        canvasWrapper.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-color);">
                <p>WebGL初期化に失敗しました</p>
                <p>ブラウザがWebGLに対応していない可能性があります</p>
            </div>
        `;
    }
});