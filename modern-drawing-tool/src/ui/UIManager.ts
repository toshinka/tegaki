import { EventBus } from '../core/EventBus';

export class UIManager {
  private eventBus: EventBus;
  private currentTool: string = 'pen';
  private brushSize: number = 3;
  private brushColor: string = '#000000';
  private brushOpacity: number = 1.0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  init(): void {
    this.createUI();
    this.setupEventListeners();
  }

  private createUI(): void {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <div class="toolbar">
        <div class="tool-group">
          <button class="tool-button active" data-tool="pen">Pen</button>
          <button class="tool-button" data-tool="eraser">Eraser</button>
        </div>
        
        <div class="tool-group">
          <button class="tool-button" id="clear-canvas">Clear</button>
        </div>
        
        <div class="slider-container">
          <label>Size:</label>
          <input type="range" class="slider" id="brush-size" min="1" max="50" value="3">
          <span id="size-value">3</span>
        </div>
        
        <div class="slider-container">
          <label>Color:</label>
          <input type="color" class="color-input" id="brush-color" value="#000000">
        </div>
        
        <div class="slider-container">
          <label>Opacity:</label>
          <input type="range" class="slider" id="brush-opacity" min="0" max="1" step="0.1" value="1">
          <span id="opacity-value">100%</span>
        </div>
      </div>
      
      <div class="canvas-container"></div>
      
      <div class="status-bar">
        <div class="performance-info">
          <span id="fps">FPS: --</span>
          <span id="draw-calls">Draws: 0</span>
        </div>
        <div>
          <span id="tool-info">Tool: Pen</span>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Tool buttons
    document.querySelectorAll('[data-tool]').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const tool = target.dataset.tool;
        if (tool) {
          this.selectTool(tool);
        }
      });
    });

    // Clear canvas
    const clearButton = document.getElementById('clear-canvas');
    clearButton?.addEventListener('click', () => {
      this.eventBus.emit('canvas:clear');
    });

    // Brush size slider
    const brushSizeSlider = document.getElementById('brush-size') as HTMLInputElement;
    const sizeValue = document.getElementById('size-value');
    brushSizeSlider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.brushSize = parseInt(target.value);
      this.eventBus.emit('brush:size', { size: this.brushSize });
      if (sizeValue) sizeValue.textContent = this.brushSize.toString();
    });

    // Color picker
    const colorPicker = document.getElementById('brush-color') as HTMLInputElement;
    colorPicker?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.brushColor = target.value;
      this.eventBus.emit('brush:color', { color: this.brushColor });
    });

    // Opacity slider
    const opacitySlider = document.getElementById('brush-opacity') as HTMLInputElement;
    const opacityValue = document.getElementById('opacity-value');
    opacitySlider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.brushOpacity = parseFloat(target.value);
      this.eventBus.emit('brush:opacity', { opacity: this.brushOpacity });
      if (opacityValue) opacityValue.textContent = `${Math.round(this.brushOpacity * 100)}%`;
    });

    // Performance updates
    this.eventBus.on('performance:update', (data) => {
      this.updatePerformanceDisplay(data);
    });
  }

  private selectTool(toolName: string): void {
    // Update UI
    document.querySelectorAll('.tool-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const selectedButton = document.querySelector(`[data-tool="${toolName}"]`);
    selectedButton?.classList.add('active');

    // Update tool info
    const toolInfo = document.getElementById('tool-info');
    if (toolInfo) {
      toolInfo.textContent = `Tool: ${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`;
    }

    // Emit tool change event
    this.currentTool = toolName;
    this.eventBus.emit('tool:change', { tool: toolName });
  }

  private updatePerformanceDisplay(data: any): void {
    const fpsElement = document.getElementById('fps');
    const drawCallsElement = document.getElementById('draw-calls');
    
    if (fpsElement && data.fps !== undefined) {
      fpsElement.textContent = `FPS: ${data.fps}`;
    }
    
    if (drawCallsElement && data.drawCalls !== undefined) {
      drawCallsElement.textContent = `Draws: ${data.drawCalls}`;
    }
  }
}