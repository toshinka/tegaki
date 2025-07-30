// Phase1: OGL統一エンジン + 基本描画システム（規約v3.3完全準拠）
import { Renderer, Camera, Transform, Mesh, Program, Geometry, Vec3 } from 'ogl';

class OGLUnifiedEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });
        
        this.gl = this.renderer.gl;
        this.camera = new Camera(this.gl);
        this.scene = new Transform();
        
        // OGL統一カメラ設定（2D描画用正投影）
        this.camera.orthographic({
            left: -canvas.width / 2,
            right: canvas.width / 2,
            bottom: -canvas.height / 2,
            top: canvas.height / 2,
            near: 0.1,
            far: 100
        });
        this.camera.position.z = 1;
        
        // OGL統一描画データ
        this.strokes = [];
        this.currentStroke = null;
        this.isDrawing = false;
        
        // ペンツール設定（Phase1基本機能）
        this.penSize = 3;
        this.opacity = 1.0;
        this.pressureSensitivity = 0.5;
        this.smoothing = true;
        
        // パフォーマンス監視
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
        
        // UI制御オブジェクト（Phase1統合）
        this.ui = {
            controlPanel: null,
            statusInfo: null,
            actionButtons: null,
            shortcutHint: null
        };
        
        this.initializeOGLUnifiedSystem();
    }
    
    // OGL統一システム初期化（規約v3.3準拠）
    initializeOGLUnifiedSystem() {
        this.setupOGLSidebar();
        this.setupOGLControlPanel();
        this.setupOGLActionButtons();
        this.setupOGLStatusInfo();
        this.setupOGLShortcuts();
        this.setupOGLEventListeners();
        this.startOGLRenderLoop();
    }
    
    // OGL統一サイドバー生成
    setupOGLSidebar() {
        const sidebar = document.getElementById('sidebar');
        
        // ペンツールアイコン（Phase1基本ツール）
        const penTool = this.createOGLToolButton('✏️', 'ペンツール (P)', 'pen');
        penTool.classList.add('active');
        
        penTool.addEventListener('click', () => {
            this.selectOGLTool('pen');
        });
        
        sidebar.appendChild(penTool);
    }
    
    createOGLToolButton(icon, title, toolId) {
        const button = document.createElement('div');
        button.className = 'tool-button';
        button.id = `${toolId}Tool`;
        button.innerHTML = icon;
        button.title = title;
        button.dataset.tool = toolId;
        
        return button;
    }
    
    selectOGLTool(toolName) {
        // Phase1ではペンツールのみ実装
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const toolButton = document.querySelector(`[data-tool="${toolName}"]`);
        if (toolButton) {
            toolButton.classList.add('active');
        }
        
        console.log(`OGL統一ツール選択: ${toolName}`);
    }
    
    // OGL統一コントロールパネル
    setupOGLControlPanel() {
        this.ui.controlPanel = document.createElement('div');
        this.ui.controlPanel.className = 'popup-panel control-panel';
        this.ui.controlPanel.style.cssText = `
            position: absolute;
            top: 15px;
            left: 75px;
            width: 320px;
            pointer-events: auto;
            z-index: 100;
        `;
        
        // ペンサイズ制御
        const penSizeGroup = this.createOGLControlGroup('ペンサイズ', 'penSize', 3, 1, 50);
        this.ui.controlPanel.appendChild(penSizeGroup);
        
        // 不透明度制御
        const opacityGroup = this.createOGLControlGroup('不透明度', 'opacity', 100, 1, 100);
        this.ui.controlPanel.appendChild(opacityGroup);
        
        // 筆圧感度制御
        const pressureGroup = this.createOGLControlGroup('筆圧感度', 'pressure', 50, 0, 100);
        this.ui.controlPanel.appendChild(pressureGroup);
        
        // スムージング制御
        const smoothingGroup = this.createOGLCheckboxGroup('線間補間', 'smoothing', true);
        this.ui.controlPanel.appendChild(smoothingGroup);
        
        document.getElementById('popupContainer').appendChild(this.ui.controlPanel);
    }
    
    createOGLControlGroup(label, id, defaultValue, min, max) {
        const group = document.createElement('div');
        group.className = 'control-group';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'control-label';
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'control-input';
        input.id = `${id}Input`;
        input.value = defaultValue;
        input.min = min;
        input.max = max;
        
        labelDiv.appendChild(labelSpan);
        labelDiv.appendChild(input);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'control-slider';
        slider.id = `${id}Slider`;
        slider.min = min;
        slider.max = max;
        slider.value = defaultValue;
        
        // OGL統一イベント処理
        const updateOGLValue = (value) => {
            input.value = value;
            slider.value = value;
            this.updateOGLControlValue(id, value);
        };
        
        slider.addEventListener('input', (e) => updateOGLValue(e.target.value));
        input.addEventListener('input', (e) => updateOGLValue(e.target.value));
        
        group.appendChild(labelDiv);
        group.appendChild(slider);
        
        return group;
    }
    
    createOGLCheckboxGroup(label, id, defaultValue) {
        const group = document.createElement('div');
        group.className = 'control-group';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'control-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'control-checkbox';
        checkbox.id = `${id}Check`;
        checkbox.checked = defaultValue;
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        
        checkbox.addEventListener('change', (e) => {
            this.updateOGLControlValue(id, e.target.checked);
        });
        
        labelDiv.appendChild(checkbox);
        labelDiv.appendChild(labelSpan);
        group.appendChild(labelDiv);
        
        return group;
    }
    
    updateOGLControlValue(controlId, value) {
        switch(controlId) {
            case 'penSize':
                this.setOGLPenSize(parseInt(value));
                break;
            case 'opacity':
                this.setOGLOpacity(parseInt(value));
                break;
            case 'pressure':
                this.setOGLPressureSensitivity(parseInt(value));
                break;
            case 'smoothing':
                this.setOGLSmoothing(value);
                break;
        }
    }
    
    // OGL統一アクションボタン
    setupOGLActionButtons() {
        this.ui.actionButtons = document.createElement('div');
        this.ui.actionButtons.className = 'action-buttons';
        this.ui.actionButtons.style.cssText = `
            position: absolute;
            top: 10px;
            right: 15px;
            display: flex;
            gap: 8px;
            pointer-events: auto;
            z-index: 100;
        `;
        
        const clearButton = this.createOGLActionButton('🗑️ クリア', () => this.clearOGL());
        const undoButton = this.createOGLActionButton('↶ 取り消し', () => this.undoOGL());
        
        this.ui.actionButtons.appendChild(clearButton);
        this.ui.actionButtons.appendChild(undoButton);
        
        document.getElementById('popupContainer').appendChild(this.ui.actionButtons);
    }
    
    createOGLActionButton(text, onClick) {
        const button = document.createElement('button');
        button.className = 'action-button';
        button.innerHTML = text;
        button.style.cssText = `
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid var(--main-color);
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.2s ease;
            color: var(--main-color);
        `;
        
        button.addEventListener('click', onClick);
        button.addEventListener('mouseenter', () => {
            button.style.background = 'var(--main-color)';
            button.style.color = 'white';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(255, 255, 255, 0.9)';
            button.style.color = 'var(--main-color)';
        });
        
        return button;
    }
    
    // OGL統一ステータス情報
    setupOGLStatusInfo() {
        this.ui.statusInfo = document.createElement('div');
        this.ui.statusInfo.className = 'status-info';
        this.ui.statusInfo.style.cssText = `
            position: absolute;
            bottom: 15px;
            left: 75px;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(128, 0, 0, 0.2);
            border-radius: 4px;
            font-size: 11px;
            color: var(--text-color);
            pointer-events: auto;
            z-index: 100;
        `;
        
        this.updateOGLStatus();
        document.getElementById('popupContainer').appendChild(this.ui.statusInfo);
    }
    
    // OGL統一ショートカット
    setupOGLShortcuts() {
        document.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'p':
                    e.preventDefault();
                    this.selectOGLTool('pen');
                    break;
                case 'z':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.undoOGL();
                    }
                    break;
                case 'c':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.clearOGL();
                    }
                    break;
                case 'f':
                    e.preventDefault();
                    this.toggleOGLFullscreen();
                    break;
                case 'tab':
                    e.preventDefault();
                    this.toggleOGLControlPanel();
                    break;
                case 'escape':
                    e.preventDefault();
                    this.hideOGLPanels();
                    break;
            }
        });
        
        // ショートカットヒント表示
        this.ui.shortcutHint = document.getElementById('shortcutHint');
        setTimeout(() => {
            if (this.ui.shortcutHint) {
                this.ui.shortcutHint.classList.add('visible');
                setTimeout(() => {
                    this.ui.shortcutHint.classList.remove('visible');
                }, 3000);
            }
        }, 1000);
    }
    
    toggleOGLControlPanel() {
        if (this.ui.controlPanel) {
            const isHidden = this.ui.controlPanel.style.display === 'none';
            this.ui.controlPanel.style.display = isHidden ? 'block' : 'none';
        }
    }
    
    hideOGLPanels() {
        if (this.ui.controlPanel) this.ui.controlPanel.style.display = 'none';
    }
    
    toggleOGLFullscreen() {
        document.body.classList.toggle('fullscreen-drawing');
        
        const isFullscreen = document.body.classList.contains('fullscreen-drawing');
        
        if (isFullscreen) {
            this.resizeOGLCanvas(window.innerWidth - 20, window.innerHeight - 20);
            this.hideOGLPanels();
        } else {
            this.resizeOGLCanvas(800, 600);
            if (this.ui.controlPanel) this.ui.controlPanel.style.display = 'block';
        }
    }
    
    resizeOGLCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        
        // OGL統一カメラ調整
        this.camera.orthographic({
            left: -width / 2,
            right: width / 2,
            bottom: -height / 2,
            top: height / 2,
            near: 0.1,
            far: 100
        });
        
        this.renderOGL();
    }
    
    // OGL統一イベントリスナー（規約v3.3準拠）
    setupOGLEventListeners() {
        this.canvas.addEventListener('pointerdown', this.startOGLDrawing.bind(this));
        this.canvas.addEventListener('pointermove', this.drawOGL.bind(this));
        this.canvas.addEventListener('pointerup', this.stopOGLDrawing.bind(this));
        this.canvas.addEventListener('pointercancel', this.stopOGLDrawing.bind(this));
        this.canvas.addEventListener('pointerleave', this.stopOGLDrawing.bind(this));
        
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('touchstart', e => e.preventDefault());
        this.canvas.addEventListener('touchmove', e => e.preventDefault());
    }
    
    getOGLCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left - this.canvas.width / 2;
        const y = -(event.clientY - rect.top - this.canvas.height / 2);
        const pressure = event.pressure || 0.5;
        return { x, y, pressure };
    }
    
    // OGL統一描画開始（規約v3.3準拠）
    startOGLDrawing(event) {
        this.isDrawing = true;
        const pos = this.getOGLCanvasCoordinates(event);
        
        this.currentStroke = {
            points: [{ 
                x: pos.x, 
                y: pos.y, 
                pressure: pos.pressure,
                timestamp: performance.now()
            }],
            baseSize: this.penSize,
            opacity: this.opacity,
            mesh: null,
            vertices: [],
            indices: []
        };
        
        event.preventDefault();
    }
    
    // OGL統一描画処理（規約v3.3準拠）
    drawOGL(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        const pos = this.getOGLCanvasCoordinates(event);
        const points = this.currentStroke.points;
        const lastPoint = points[points.length - 1];
        
        const dx = pos.x - lastPoint.x;
        const dy = pos.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 1) return;
        
        const newPoint = {
            x: pos.x,
            y: pos.y,
            pressure: pos.pressure,
            timestamp: performance.now()
        };
        
        if (this.smoothing && points.length > 0) {
            const interpolatedPoints = this.interpolateOGLPoints(lastPoint, newPoint);
            points.push(...interpolatedPoints);
        } else {
            points.push(newPoint);
        }
        
        this.updateOGLCurrentStrokeOptimized();
        event.preventDefault();
    }
    
    // OGL統一描画終了（規約v3.3準拠）
    stopOGLDrawing(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        this.isDrawing = false;
        
        if (this.currentStroke.points.length >= 1) {
            if (this.currentStroke.points.length === 1) {
                this.createOGLSinglePointMesh();
            } else {
                this.finalizeOGLStroke();
            }
            this.strokes.push(this.currentStroke);
        } else if (this.currentStroke.mesh) {
            this.currentStroke.mesh.setParent(null);
        }
        
        this.currentStroke = null;
        this.updateOGLStatus();
        event.preventDefault();
    }
    
    // OGL統一点補間（OGL内蔵数学関数活用）
    interpolateOGLPoints(p1, p2) {
        const points = [];
        const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const steps = Math.max(2, Math.floor(distance / 2));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = p1.x + (p2.x - p1.x) * t;
            const y = p1.y + (p2.y - p1.y) * t;
            const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
            const timestamp = p1.timestamp + (p2.timestamp - p1.timestamp) * t;
            
            points.push({ x, y, pressure, timestamp });
        }
        
        return points;
    }
    
    // OGL統一筆圧サイズ計算
    calculateOGLPressureSize(pressure, baseSize) {
        const pressureEffect = this.pressureSensitivity;
        const minSize = baseSize * 0.3;
        const maxSize = baseSize * 1.5;
        
        return minSize + (maxSize - minSize) * (pressure * pressureEffect + (1 - pressureEffect));
    }
    
    // OGL統一ストローク更新最適化
    updateOGLCurrentStrokeOptimized() {
        const points = this.currentStroke.points;
        if (points.length < 2) return;
        
        const batchSize = Math.min(5, points.length - this.currentStroke.vertices.length / 3 / 4);
        for (let i = Math.max(1, points.length - batchSize); i < points.length; i++) {
            if (i > 0) {
                this.addOGLLineSegmentWithPressure(points[i - 1], points[i], this.currentStroke);
            }
        }
        
        this.updateOGLStrokeMesh(this.currentStroke);
    }
    
    // OGL統一線分追加（筆圧対応）
    addOGLLineSegmentWithPressure(p1, p2, stroke) {
        const size1 = this.calculateOGLPressureSize(p1.pressure, stroke.baseSize);
        const size2 = this.calculateOGLPressureSize(p2.pressure, stroke.baseSize);
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        const perpX = (-dy / length);
        const perpY = (dx / length);
        
        const baseIndex = stroke.vertices.length / 3;
        
        stroke.vertices.push(
            p1.x + perpX * (size1 / 2), p1.y + perpY * (size1 / 2), 0,
            p1.x - perpX * (size1 / 2), p1.y - perpY * (size1 / 2), 0,
            p2.x + perpX * (size2 / 2), p2.y + perpY * (size2 / 2), 0,
            p2.x - perpX * (size2 / 2), p2.y - perpY * (size2 / 2), 0
        );
        
        stroke.indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex + 1, baseIndex + 3, baseIndex + 2
        );
        
        if (baseIndex > 0) {
            const prevIndex = baseIndex - 4;
            stroke.indices.push(
                prevIndex + 2, prevIndex + 3, baseIndex,
                prevIndex + 3, baseIndex + 1, baseIndex
            );
        }
    }
    
    // OGL統一単一点メッシュ作成
    createOGLSinglePointMesh() {
        const point = this.currentStroke.points[0];
        const size = this.calculateOGLPressureSize(point.pressure, this.currentStroke.baseSize);
        const radius = size / 2;
        
        const vertices = [];
        const indices = [];
        const segments = 16;
        
        vertices.push(point.x, point.y, 0);
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = point.x + Math.cos(angle) * radius;
            const y = point.y + Math.sin(angle) * radius;
            vertices.push(x, y, 0);
        }
        
        for (let i = 1; i <= segments; i++) {
            indices.push(0, i, i + 1 > segments ? 1 : i + 1);
        }
        
        this.createOGLMeshFromGeometry(vertices, indices, this.currentStroke);
    }
    
    // OGL統一ストロークメッシュ更新
    updateOGLStrokeMesh(stroke) {
        if (stroke.vertices.length === 0) return;
        
        if (stroke.mesh) {
            stroke.mesh.setParent(null);
        }
        
        this.createOGLMeshFromGeometry(stroke.vertices, stroke.indices, stroke);
    }
    
    // OGL統一メッシュ作成（規約v3.3準拠）
    createOGLMeshFromGeometry(vertices, indices, stroke) {
        const geometry = new Geometry(this.gl, {
            position: { size: 3, data: new Float32Array(vertices) },
            index: { data: new Uint16Array(indices) }
        });
        
        const program = new Program(this.gl, {
            vertex: `
                attribute vec3 position;
                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;
                
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragment: `
                precision mediump float;
                uniform float uOpacity;
                uniform vec3 uColor;
                
                void main() {
                    gl_FragColor = vec4(uColor, uOpacity);
                }
            `,
            uniforms: {
                uOpacity: { value: stroke.opacity },
                uColor: { value: [0.5, 0.0, 0.0] }
            }
        });
        
        stroke.mesh = new Mesh(this.gl, { geometry, program });
        stroke.mesh.setParent(this.scene);
    }
    
    // OGL統一ストローク終端処理
    finalizeOGLStroke() {
        const points = this.currentStroke.points;
        if (points.length > 1) {
            const lastPoint = points[points.length - 1];
            const secondLastPoint = points[points.length - 2];
            this.addOGLEndCap(lastPoint, secondLastPoint, this.currentStroke);
            this.updateOGLStrokeMesh(this.currentStroke);
        }
    }
    
    // OGL統一終端キャップ追加
    addOGLEndCap(endPoint, prevPoint, stroke) {
        const size = this.calculateOGLPressureSize(endPoint.pressure, stroke.baseSize);
        const radius = size / 2;
        
        const dx = endPoint.x - prevPoint.x;
        const dy = endPoint.y - prevPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        const dirX = dx / length;
        const dirY = dy / length;
        
        const segments = 8;
        const baseIndex = stroke.vertices.length / 3;
        
        stroke.vertices.push(endPoint.x, endPoint.y, 0);
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI - Math.PI / 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            const x = endPoint.x + (cos * dirX - sin * (-dirY)) * radius;
            const y = endPoint.y + (cos * dirY + sin * dirX) * radius;
            
            stroke.vertices.push(x, y, 0);
        }
        
        for (let i = 1; i <= segments; i++) {
            stroke.indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
        }
    }
    
    // OGL統一レンダーループ開始
    startOGLRenderLoop() {
        const animate = (currentTime) => {
            this.frameCount++;
            if (currentTime - this.lastTime >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                this.frameCount = 0;
                this.lastTime = currentTime;
                this.updateOGLStatus();
            }
            
            this.renderOGL();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
    
    // OGL統一レンダー（規約v3.3準拠）
    renderOGL() {
        this.renderer.render({ scene: this.scene, camera: this.camera });
    }
    
    // OGL統一ステータス更新
    updateOGLStatus() {
        if (this.ui.statusInfo) {
            const totalPoints = this.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
            this.ui.statusInfo.textContent = `OGL統一 | ストローク: ${this.strokes.length} | 点数: ${totalPoints} | FPS: ${this.fps}`;
        }
    }
    
    // OGL統一クリア
    clearOGL() {
        this.strokes.forEach(stroke => {
            if (stroke.mesh) {
                stroke.mesh.setParent(null);
            }
        });
        this.strokes = [];
        
        if (this.currentStroke && this.currentStroke.mesh) {
            this.currentStroke.mesh.setParent(null);
        }
        this.currentStroke = null;
        this.isDrawing = false;
        
        this.updateOGLStatus();
        this.renderOGL();
    }
    
    // OGL統一取り消し
    undoOGL() {
        if (this.strokes.length === 0) return;
        
        const lastStroke = this.strokes.pop();
        if (lastStroke.mesh) {
            lastStroke.mesh.setParent(null);
        }
        
        this.updateOGLStatus();
        this.renderOGL();
    }
    
    // OGL統一ペン設定
    setOGLPenSize(size) {
        this.penSize = Math.max(1, Math.min(50, size));
    }
    
    setOGLOpacity(opacity) {
        this.opacity = Math.max(0.01, Math.min(1, opacity / 100));
    }
    
    setOGLPressureSensitivity(sensitivity) {
        this.pressureSensitivity = Math.max(0, Math.min(1, sensitivity / 100));
    }
    
    setOGLSmoothing(enabled) {
        this.smoothing = enabled;
    }
}

// Phase1アプリケーション初期化（規約v3.3準拠）
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    const oglUnifiedEngine = new OGLUnifiedEngine(canvas);
    
    // OGL統一ウィンドウリサイズ対応
    window.addEventListener('resize', () => {
        if (!document.body.classList.contains('fullscreen-drawing')) {
            return;
        }
        oglUnifiedEngine.resizeOGLCanvas(window.innerWidth - 20, window.innerHeight - 20);
    });
    
    // Phase1完了メッセージ
    console.log('Phase1: OGL統一エンジン + 基本描画システム 初期化完了');
    console.log('規約v3.3準拠: Canvas2D禁止、OGL WebGL統一、外部依存排除');
});