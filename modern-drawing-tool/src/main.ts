import * as PIXI from 'pixi.js';

// Drawing Tool Class
class ModernDrawingTool {
    constructor() {
        this.app = null;
        this.graphics = null;
        this.currentTool = 'pen';
        this.brushSize = 3;
        this.brushColor = 0x000000;
        this.isDrawing = false;
        this.lastPoint = { x: 0, y: 0 };
        
        // FPS tracking
        this.frameCount = 0;
        this.lastFPSTime = performance.now();
        
        this.init();
        this.setupEventListeners();
    }

    init() {
        // PIXI Application setup
        this.app = new PIXI.Application({
            width: window.innerWidth - 280,
            height: window.innerHeight,
            backgroundColor: 0xffffff,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        // Canvas container
        const canvasContainer = document.getElementById('canvasContainer');
        canvasContainer.appendChild(this.app.view);

        // Graphics object for drawing
        this.graphics = new PIXI.Graphics();
        this.app.stage.addChild(this.graphics);

        // Setup interactive
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.app.screen.width, this.app.screen.height);

        // Start FPS counter
        this.app.ticker.add(() => this.updateFPS());

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
        
        console.log('Drawing tool initialized successfully');
    }

    setupEventListeners() {
        // Mouse/Touch events for drawing
        this.app.stage.on('pointerdown', (event) => this.onPointerDown(event));
        this.app.stage.on('pointermove', (event) => this.onPointerMove(event));
        this.app.stage.on('pointerup', () => this.onPointerUp());
        this.app.stage.on('pointerupoutside', () => this.onPointerUp());

        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
            });
        });

        // Color picker
        document.getElementById('colorPicker').addEventListener('input', (e) => {
            this.brushColor = PIXI.utils.string2hex(e.target.value);
            this.updateBrushPreview();
        });

        // Size slider
        document.getElementById('sizeSlider').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('sizeValue').textContent = this.brushSize + 'px';
            this.updateBrushPreview();
        });

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearCanvas();
        });
    }

    onPointerDown(event) {
        this.isDrawing = true;
        const point = event.data.getLocalPosition(this.app.stage);
        this.lastPoint = { x: point.x, y: point.y };

        if (this.currentTool === 'pen') {
            this.graphics.lineStyle(this.brushSize, this.brushColor, 1);
            this.graphics.moveTo(point.x, point.y);
        } else if (this.currentTool === 'eraser') {
            // Set blend mode to erase
            this.graphics.lineStyle(this.brushSize, 0xffffff, 1);
            this.graphics.blendMode = PIXI.BLEND_MODES.MULTIPLY;
            this.graphics.moveTo(point.x, point.y);
        }
    }

    onPointerMove(event) {
        if (!this.isDrawing) return;

        const point = event.data.getLocalPosition(this.app.stage);
        
        if (this.currentTool === 'pen') {
            this.graphics.lineTo(point.x, point.y);
        } else if (this.currentTool === 'eraser') {
            // Create circular eraser effect
            this.graphics.beginFill(0xffffff);
            this.graphics.drawCircle(point.x, point.y, this.brushSize / 2);
            this.graphics.endFill();
        }

        this.lastPoint = { x: point.x, y: point.y };
    }

    onPointerUp() {
        this.isDrawing = false;
        
        // Reset blend mode if eraser was used
        if (this.currentTool === 'eraser') {
            this.graphics.blendMode = PIXI.BLEND_MODES.NORMAL;
        }
    }

    clearCanvas() {
        this.graphics.clear();
        console.log('Canvas cleared');
    }

    updateBrushPreview() {
        const preview = document.getElementById('brushPreview');
        const colorHex = PIXI.utils.hex2string(this.brushColor);
        const size = Math.min(Math.max(this.brushSize, 4), 40);
        
        preview.style.width = size + 'px';
        preview.style.height = size + 'px';
        preview.style.backgroundColor = colorHex;
    }

    updateFPS() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastFPSTime >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFPSTime));
            document.getElementById('fpsCounter').textContent = fps + ' FPS';
            
            this.frameCount = 0;
            this.lastFPSTime = currentTime;
        }
    }

    handleResize() {
        const newWidth = window.innerWidth - 280;
        const newHeight = window.innerHeight;
        
        this.app.renderer.resize(newWidth, newHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
    }
}

// Initialize the drawing tool when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const drawingTool = new ModernDrawingTool();
    window.drawingTool = drawingTool; // For debugging
    console.log('Modern Drawing Tool Phase 0 loaded successfully!');
});