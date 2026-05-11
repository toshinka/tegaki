// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Status Display Renderer - ステータス表示レンダラー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class StatusDisplayRenderer {
  constructor(eventBus, settingsManager) {
    this.eventBus = eventBus;
    this.settingsManager = settingsManager;
    this.container = null;
    this.frameDisplay = null;
    this._initialize();
  }

  _initialize() {
    this._createContainer();
    this._createFrameDisplay();
    this._createBrushInfo();
    this._setupEventListeners();
  }

  _createContainer() {
    this.container = document.createElement('div');
    this.container.className = 'status-display';
    document.body.appendChild(this.container);
  }

  _createFrameDisplay() {
    this.frameDisplay = document.createElement('div');
    this.frameDisplay.className = 'frame-display';
    this.frameDisplay.innerHTML = `
      <button class="frame-nav-btn" data-action="prev">◀</button>
      <span class="frame-label" style="color: maroon;">NO　FRAME</span>
      <button class="frame-nav-btn" data-action="next">▶</button>
    `;
    this.container.appendChild(this.frameDisplay);

    this.frameDisplay.querySelector('[data-action="prev"]').addEventListener('click', () => {
      this.eventBus.emit('frame:navigate', { direction: 'prev' });
    });
    this.frameDisplay.querySelector('[data-action="next"]').addEventListener('click', () => {
      this.eventBus.emit('frame:navigate', { direction: 'next' });
    });
  }

  _createBrushInfo() {
    this.brushInfo = document.createElement('div');
    this.brushInfo.className = 'brush-info';
    this.container.appendChild(this.brushInfo);
    this._updateBrushInfo();
  }

  _setupEventListeners() {
    this.eventBus.on('frame:changed', ({ frameId }) => {
      this._updateFrameDisplay(frameId);
    });

    this.eventBus.on('settings:changed', () => {
      this._updateBrushInfo();
    });

    this.eventBus.on('brush:sizeChanged', () => {
      this._updateBrushInfo();
    });

    this.eventBus.on('tool:changed', () => {
      this._updateBrushInfo();
    });
  }

  _updateFrameDisplay(frameId) {
    const label = this.frameDisplay.querySelector('.frame-label');
    if (frameId) {
      label.textContent = frameId;
      label.style.color = 'maroon';
    } else {
      label.textContent = 'NO　FRAME';
      label.style.color = 'maroon';
    }
  }

  _updateBrushInfo() {
    const settings = this.settingsManager.getAllSettings();
    const tool = settings.currentTool || 'pen';
    const size = settings.brushSize || 5;
    const color = settings.strokeColor || '#000000';

    this.brushInfo.innerHTML = `
      <div class="brush-detail">
        <span class="tool-name">${tool === 'pen' ? 'ペン' : '消しゴム'}</span>
        <span class="brush-size">${size}px</span>
        ${tool === 'pen' ? `<span class="brush-color" style="background: ${color};"></span>` : ''}
      </div>
    `;
  }

  updateCoordinates(x, y) {
    // 座標表示は必要に応じて実装
  }

  show() {
    this.container.style.display = 'flex';
  }

  hide() {
    this.container.style.display = 'none';
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}