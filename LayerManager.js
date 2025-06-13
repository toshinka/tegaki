// LayerManager.js
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayer = null;
        this.layerCounter = 1;
        this.draggedLayer = null;

        this.initUI();
        this.injectStyles();
        this.bindEvents();
        this.setupInitialLayers();
    }

    initUI() {
        this.panel = document.createElement('div');
        this.panel.id = 'layer-panel';
        const header = document.createElement('div');
        header.className = 'layer-panel-header';
        header.innerHTML = `<span>レイヤー</span><div class="layer-controls"><button id="add-layer-btn" title="新規レイヤーを追加">＋</button></div>`;
        this.layerList = document.createElement('div');
        this.layerList.id = 'layer-list';
        this.panel.appendChild(header);
        this.panel.appendChild(this.layerList);
        document.querySelector('.main-container').appendChild(this.panel);
        this.addLayerBtn = document.getElementById('add-layer-btn');
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* ★修正：背景を半透明に */
            #layer-panel { position: absolute; top: 30px; right: 0; width: 200px; max-height: calc(100vh - 40px); background-color: rgba(240, 208, 195, 0.9); border-left: 1px solid var(--light-brown-border); display: flex; flex-direction: column; font-size: 12px; color: var(--dark-brown); z-index: 2000; resize: horizontal; overflow: hidden; }
            .layer-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-bottom: 1px solid var(--light-brown-border); background-color: var(--light-brown-border); cursor: default; user-select: none; }
            .layer-panel-header span { font-weight: bold; }
            .layer-controls button { background: none; border: 1px solid var(--dark-brown); color: var(--dark-brown); border-radius: 3px; cursor: pointer; width: 22px; height: 22px; }
            .layer-controls button:hover { background-color: var(--button-active-bg); }
            #layer-list { flex-grow: 1; overflow-y: auto; }
            .layer-item { display: flex; align-items: center; padding: 6px 8px; border-bottom: 1px solid var(--light-brown-border); cursor: grab; user-select: none; background-color: transparent; }
            .layer-item.active { background-color: #fff; }
            .layer-item.drag-over { border-top: 2px solid #3498db; }
            .layer-item.dragging { opacity: 0.5; }
            /* ★修正：目のアイコンの色を茶色に */
            .layer-item .visibility-btn { background: none; border: none; cursor: pointer; font-size: 16px; margin-right: 8px; flex-shrink: 0; color: var(--dark-brown); }
            .layer-item .layer-name { flex-grow: 1; padding: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .layer-item .layer-name:focus { background-color: #fff; outline: 1px solid #3498db; }
            .layer-item .delete-btn { background: none; border: none; cursor: pointer; color: #f44; font-size: 18px; visibility: hidden; flex-shrink: 0;}
            .layer-item:hover .delete-btn { visibility: visible; }
            .layer-item.background-layer { background-color: rgb(220, 188, 175); cursor: default; }
        `;
        document.head.appendChild(style);
    }
    
    bindEvents() {
        this.addLayerBtn.addEventListener('click', () => this.addNewLayer());
        this.layerList.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.layerList.addEventListener('dragover', this.handleDragOver.bind(this));
        this.layerList.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.layerList.addEventListener('drop', this.handleDrop.bind(this));
        this.layerList.addEventListener('dragend', this.handleDragEnd.bind(this));
        this.layerList.addEventListener('click', this.handleLayerClick.bind(this));
        this.layerList.addEventListener('dblclick', this.handleLayerDblClick.bind(this));
    }
    
    setupInitialLayers() {
        const bgCanvas = document.getElementById('drawingCanvas');
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.fillStyle = '#f0e0d6';
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        
        const bgLayer = this.createLayerObject({
            name: '背景', canvas: bgCanvas, isDrawable: false,
        });
        bgLayer.uiElement.classList.add('background-layer');
        bgLayer.uiElement.setAttribute('draggable', false);
        this.layers.push(bgLayer);
        this.layerList.appendChild(bgLayer.uiElement);

        this.addNewLayer(); // ★修正：起動時に最初の描画レイヤーを必ず作成
    }

    createLayerObject(options = {}) {
        const layerId = `layer-${Date.now()}`;
        const canvas = options.canvas || document.createElement('canvas');
        if (!options.canvas) {
            const template = this.layers[0].canvas;
            canvas.width = template.width; canvas.height = template.height;
            canvas.className = 'layer-canvas';
            this.app.canvasContainer.appendChild(canvas);
        }

        const uiElement = document.createElement('div');
        uiElement.className = 'layer-item';
        uiElement.dataset.layerId = layerId;
        uiElement.setAttribute('draggable', options.isDrawable !== false);

        const name = options.name || `レイヤー ${this.layerCounter++}`;
        uiElement.innerHTML = `<button class="visibility-btn" title="表示/非表示">&#128065;</button><span class="layer-name" title="${name}">${name}</span>${options.isDrawable !== false ? '<button class="delete-btn" title="レイヤーを削除">&times;</button>' : ''}`;
        
        const layer = { id: layerId, name: name, canvas: canvas, ctx: canvas.getContext('2d'), visible: true, uiElement: uiElement, isDrawable: options.isDrawable !== false, history: [], historyIndex: -1, };
        if (layer.isDrawable) this.saveStateForLayer(layer);
        return layer;
    }

    addNewLayer() {
        const newLayer = this.createLayerObject();
        this.layers.unshift(newLayer);
        this.layerList.insertBefore(newLayer.uiElement, this.layerList.firstChild);
        this.updateZIndex();
        this.setActiveLayer(newLayer.id);
    }
    
    setActiveLayer(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;

        this.activeLayer = layer;
        this.layers.forEach(l => {
            l.uiElement.classList.toggle('active', l.id === layerId);
            // ★修正：アクティブな描画可能レイヤーのみ操作を受け付けるようにする
            l.canvas.style.pointerEvents = (l.id === layerId && l.isDrawable) ? 'auto' : 'none';
        });
    }
    
    toggleVisibility(layerId) { /* 変更なし */ }
    deleteLayer(layerId) { /* 変更なし */ }
    updateZIndex() { /* 変更なし */ }
    saveStateForLayer(layer) { /* 変更なし */ }
    saveStateForActiveLayer() { this.saveStateForLayer(this.activeLayer); }
    undoForActiveLayer() { /* 変更なし */ }
    redoForActiveLayer() { /* 変更なし */ }
    handleLayerClick(e) { /* 変更なし */ }
    handleLayerDblClick(e){ /* 変更なし */ }
    handleDragStart(e) { /* 変更なし */ }
    handleDragOver(e) { /* 変更なし */ }
    handleDragLeave(e) { /* 変更なし */ }
    handleDrop(e) { /* 変更なし */ }
    handleDragEnd(e) { /* 変更なし */ }
}