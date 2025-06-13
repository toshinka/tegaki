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
        header.innerHTML = '<span>レイヤー</span><div class="layer-controls"><button id="add-layer-btn" title="新規レイヤーを追加">＋</button></div>';
        
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
            .layer-item .visibility-btn { background: none; border: none; cursor: pointer; font-size: 16px; margin-right: 8px; flex-shrink: 0; }
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
            name: '背景', 
            canvas: bgCanvas,
            isDrawable: false, // 背景は描画不可
        });
        bgLayer.uiElement.classList.add('background-layer');
        bgLayer.uiElement.setAttribute('draggable', false);
        this.layers.push(bgLayer);
        this.layerList.appendChild(bgLayer.uiElement);

        this.addNewLayer(); // 最初の描画レイヤー
    }

    createLayerObject(options = {}) {
        const layerId = `layer-${Date.now()}`;
        const canvas = options.canvas || document.createElement('canvas');
        if (!options.canvas) { // 新規キャンバスの場合
            const template = this.app.layerManager.layers[0].canvas; // 背景をテンプレートに
            canvas.width = template.width;
            canvas.height = template.height;
            canvas.className = 'layer-canvas';
            this.app.canvasContainer.appendChild(canvas);
        }

        const uiElement = document.createElement('div');
        uiElement.className = 'layer-item';
        uiElement.dataset.layerId = layerId;
        uiElement.setAttribute('draggable', options.isDrawable !== false);

        const name = options.name || `レイヤー ${this.layerCounter++}`;
        uiElement.innerHTML = `
            <button class="visibility-btn" title="表示/非表示">&#128065;</button>
            <span class="layer-name" title="${name}">${name}</span>
            ${options.isDrawable !== false ? '<button class="delete-btn" title="レイヤーを削除">&times;</button>' : ''}
        `;
        
        const layer = {
            id: layerId, name: name, canvas: canvas, ctx: canvas.getContext('2d'),
            visible: true, uiElement: uiElement,
            isDrawable: options.isDrawable !== false,
            history: [], historyIndex: -1,
        };
        
        if (layer.isDrawable) {
            // 新規レイヤーの初期履歴を保存
            this.saveStateForLayer(layer);
        }
        return layer;
    }

    addNewLayer() {
        const newLayer = this.createLayerObject();
        this.layers.unshift(newLayer); // 配列の先頭に追加
        this.layerList.insertBefore(newLayer.uiElement, this.layerList.firstChild);
        this.updateZIndex();
        this.setActiveLayer(newLayer.id);
    }
    
    setActiveLayer(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || layer === this.activeLayer) return;

        this.activeLayer = layer;
        this.layers.forEach(l => l.uiElement.classList.toggle('active', l.id === layerId));
    }
    
    toggleVisibility(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;
        layer.visible = !layer.visible;
        layer.canvas.style.display = layer.visible ? 'block' : 'none';
        layer.uiElement.querySelector('.visibility-btn').style.opacity = layer.visible ? 1 : 0.5;
    }
    
    deleteLayer(layerId) {
        if (this.layers.filter(l => l.isDrawable).length <= 1) {
            alert('最後の描画レイヤーは削除できません。'); return;
        }

        const layerIndex = this.layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return;

        const [deletedLayer] = this.layers.splice(layerIndex, 1);
        deletedLayer.uiElement.remove();
        deletedLayer.canvas.remove();
        
        if (this.activeLayer.id === layerId) {
            const newActiveLayer = this.layers.find(l => l.isDrawable) || this.layers[0];
            this.setActiveLayer(newActiveLayer.id);
        }
        this.updateZIndex();
    }
    
    updateZIndex() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = this.layers.length - index;
        });
    }

    // --- 履歴管理 ---
    saveStateForLayer(layer) {
        if (!layer || !layer.isDrawable) return;
        if (layer.historyIndex < layer.history.length - 1) {
            layer.history = layer.history.slice(0, layer.historyIndex + 1);
        }
        layer.history.push(layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height));
        layer.historyIndex++;
    }
    saveStateForActiveLayer() { this.saveStateForLayer(this.activeLayer); }

    undoForActiveLayer() {
        const layer = this.activeLayer;
        if (!layer || !layer.isDrawable || layer.historyIndex <= 0) return;
        layer.historyIndex--;
        layer.ctx.putImageData(layer.history[layer.historyIndex], 0, 0);
    }
    
    redoForActiveLayer() {
        const layer = this.activeLayer;
        if (!layer || !layer.isDrawable || layer.historyIndex >= layer.history.length - 1) return;
        layer.historyIndex++;
        layer.ctx.putImageData(layer.history[layer.historyIndex], 0, 0);
    }

    // --- イベントハンドラ ---
    handleLayerClick(e) {
        const layerElement = e.target.closest('.layer-item');
        if (!layerElement) return;
        const layerId = layerElement.dataset.layerId;
        
        if (e.target.matches('.delete-btn')) {
            if (confirm(`レイヤー「${this.layers.find(l=>l.id===layerId).name}」を削除しますか？`)) this.deleteLayer(layerId);
        } else if (e.target.matches('.visibility-btn')) {
            this.toggleVisibility(layerId);
        } else {
            this.setActiveLayer(layerId);
        }
    }

    handleLayerDblClick(e){
        const nameSpan = e.target.closest('.layer-name');
        if(nameSpan){
            nameSpan.setAttribute('contenteditable', 'true');
            nameSpan.focus();
            const range = document.createRange();
            range.selectNodeContents(nameSpan);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            const blurHandler = () => {
                nameSpan.setAttribute('contenteditable', 'false');
                const layer = this.layers.find(l => l.id === nameSpan.closest('.layer-item').dataset.layerId);
                if(layer) layer.name = nameSpan.textContent;
                nameSpan.removeEventListener('blur', blurHandler);
                nameSpan.removeEventListener('keydown', keydownHandler);
            };
            const keydownHandler = (ev) => {
                if(ev.key === 'Enter') { ev.preventDefault(); nameSpan.blur(); }
            };
            nameSpan.addEventListener('blur', blurHandler);
            nameSpan.addEventListener('keydown', keydownHandler);
        }
    }
    
    handleDragStart(e) {
        const target = e.target.closest('.layer-item');
        if (target && target.getAttribute('draggable') === 'true') {
            this.draggedLayer = target;
            setTimeout(() => target.classList.add('dragging'), 0);
        } else {
            e.preventDefault();
        }
    }
    
    handleDragOver(e) {
        e.preventDefault();
        const target = e.target.closest('.layer-item');
        if (target && target !== this.draggedLayer && target.getAttribute('draggable') === 'true') {
            this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
            target.classList.add('drag-over');
        }
    }

    handleDragLeave(e) { e.target.closest('.layer-item')?.classList.remove('drag-over'); }

    handleDrop(e) {
        e.preventDefault();
        const dropTarget = e.target.closest('.layer-item');
        if (!dropTarget || !this.draggedLayer || dropTarget === this.draggedLayer) return;

        const draggedId = this.draggedLayer.dataset.layerId;
        const targetId = dropTarget.dataset.layerId;
        const draggedIndex = this.layers.findIndex(l => l.id === draggedId);
        const targetIndex = this.layers.findIndex(l => l.id === targetId);

        this.layerList.insertBefore(this.draggedLayer, dropTarget);
        
        const [draggedItem] = this.layers.splice(draggedIndex, 1);
        this.layers.splice(targetIndex > draggedIndex ? targetIndex -1 : targetIndex, 0, draggedItem);
        
        this.updateZIndex();
    }
    
    handleDragEnd() {
        this.draggedLayer?.classList.remove('dragging');
        this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
        this.draggedLayer = null;
    }
}