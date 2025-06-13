/**
 * LayerManager.js
 * レイヤー機能の管理を行うモジュール
 */
class LayerManager {
    /**
     * @param {FutabaTegakiTool} app メインアプリケーションのインスタンス
     */
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayer = null;
        this.layerCounter = 1; // 新規レイヤーの命名用カウンター
        this.draggedLayer = null; // ドラッグ中のレイヤー要素

        // 元のキャンバスはテンプレートとして保持し、DOMからは非表示にする
        this.templateCanvas = this.app.canvas;
        this.templateCanvas.style.display = 'none';

        // レイヤーUIとスタイルを初期化
        this.initUI();
        this.injectStyles();

        // イベントリスナーをバインド
        this.bindEvents();

        // 初期レイヤー（背景＋新規レイヤー）を作成
        this.setupInitialLayers();
    }

    /**
     * レイヤーパネルのUIを動的に生成してページに追加する
     */
    initUI() {
        // レイヤーパネルのコンテナ
        this.panel = document.createElement('div');
        this.panel.id = 'layer-panel';
        
        // ヘッダー
        const header = document.createElement('div');
        header.className = 'layer-panel-header';
        header.innerHTML = '<span>レイヤー</span>';

        // ヘッダーのボタン類
        const controls = document.createElement('div');
        controls.className = 'layer-controls';
        
        // 新規レイヤー追加ボタン
        this.addLayerBtn = document.createElement('button');
        this.addLayerBtn.textContent = '＋';
        this.addLayerBtn.title = '新規レイヤーを追加';
        controls.appendChild(this.addLayerBtn);
        header.appendChild(controls);

        // レイヤーリストのコンテナ
        this.layerList = document.createElement('div');
        this.layerList.id = 'layer-list';
        
        this.panel.appendChild(header);
        this.panel.appendChild(this.layerList);
        
        // main-containerの末尾にパネルを追加
        document.querySelector('.main-container').appendChild(this.panel);

        // 予告: TopBarManagerのAPIを使ってアイコンを追加する
        // 難易度：低｜優先度：低
    }

    /**
     * レイヤーパネル用のCSSを動的に注入する
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #layer-panel {
                position: absolute;
                top: 30px;
                right: 0;
                width: 180px;
                height: calc(100vh - 30px);
                background-color: var(--main-bg-color);
                border-left: 1px solid var(--light-brown-border);
                display: flex;
                flex-direction: column;
                font-size: 12px;
                color: var(--dark-brown);
                z-index: 2000;
            }
            .layer-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px;
                border-bottom: 1px solid var(--light-brown-border);
                background-color: var(--light-brown-border);
            }
            .layer-panel-header span {
                font-weight: bold;
            }
            .layer-controls button {
                background: none;
                border: 1px solid var(--dark-brown);
                color: var(--dark-brown);
                border-radius: 3px;
                cursor: pointer;
                width: 22px;
                height: 22px;
            }
            .layer-controls button:hover {
                background-color: var(--button-active-bg);
            }
            #layer-list {
                flex-grow: 1;
                overflow-y: auto;
            }
            .layer-item {
                display: flex;
                align-items: center;
                padding: 6px 8px;
                border-bottom: 1px solid var(--light-brown-border);
                cursor: grab;
                user-select: none;
                background-color: var(--main-bg-color);
            }
            .layer-item.active {
                background-color: #fff;
            }
            .layer-item.drag-over {
                border-top: 2px solid #3498db;
            }
            .layer-item.dragging {
                opacity: 0.5;
            }
            .layer-item .visibility-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 16px;
                margin-right: 8px;
            }
            .layer-item .layer-name {
                flex-grow: 1;
            }
            .layer-item .delete-btn {
                background: none;
                border: none;
                cursor: pointer;
                color: #f44;
                font-size: 18px;
                visibility: hidden;
            }
            .layer-item:hover .delete-btn {
                visibility: visible;
            }
            .layer-item.no-drag {
                cursor: default;
            }
            .layer-item.background-layer {
                background-color: rgb(220, 188, 175);
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * イベントリスナーを設定
     */
    bindEvents() {
        this.addLayerBtn.addEventListener('click', () => this.addNewLayer());
        
        // ドラッグ＆ドロップイベント
        this.layerList.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.layerList.addEventListener('dragover', this.handleDragOver.bind(this));
        this.layerList.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.layerList.addEventListener('drop', this.handleDrop.bind(this));
        this.layerList.addEventListener('dragend', this.handleDragEnd.bind(this));
        
        // クリックイベント（イベント委任）
        this.layerList.addEventListener('click', this.handleLayerClick.bind(this));
    }
    
    /**
     * 初期状態のレイヤー（背景と透明レイヤー）をセットアップ
     */
    setupInitialLayers() {
        // 背景レイヤー
        const bgLayer = this.createLayer({
            name: '背景',
            deletable: false,
            draggable: false
        });
        bgLayer.ctx.fillStyle = '#f0e0d6'; // 元のキャンバス背景色
        bgLayer.ctx.fillRect(0, 0, bgLayer.canvas.width, bgLayer.canvas.height);
        bgLayer.uiElement.classList.add('background-layer', 'no-drag');
        bgLayer.uiElement.setAttribute('draggable', false);

        // 最初の描画用レイヤー
        this.addNewLayer();
    }

    /**
     * 新しいレイヤーを作成する（内部処理）
     * @param {object} options - レイヤーのオプション
     * @returns {object} 作成されたレイヤーオブジェクト
     */
    createLayer(options = {}) {
        const { name, deletable = true, draggable = true } = options;
        const layerId = `layer-${Date.now()}-${Math.random()}`;

        // レイヤーごとに独立したCanvasを生成
        const canvas = document.createElement('canvas');
        canvas.width = this.templateCanvas.width;
        canvas.height = this.templateCanvas.height;
        canvas.className = 'main-canvas layer-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = 0;
        canvas.style.left = 0;
        
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // レイヤーUI要素を生成
        const uiElement = document.createElement('div');
        uiElement.className = 'layer-item';
        uiElement.dataset.layerId = layerId;
        uiElement.setAttribute('draggable', draggable);

        const visibilityBtn = document.createElement('button');
        visibilityBtn.className = 'visibility-btn';
        visibilityBtn.innerHTML = '&#128065;'; // '👁'
        visibilityBtn.title = 'レイヤーの表示/非表示';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = name || `レイヤー ${this.layerCounter++}`;
        
        uiElement.appendChild(visibilityBtn);
        uiElement.appendChild(nameSpan);

        if (deletable) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'レイヤーを削除';
            uiElement.appendChild(deleteBtn);
        }

        const layer = {
            id: layerId,
            name: nameSpan.textContent,
            canvas,
            ctx,
            visible: true,
            uiElement,
        };
        
        // レイヤーリストの先頭にUIを追加
        this.layerList.insertBefore(uiElement, this.layerList.firstChild);
        // キャンバスコンテナの末尾にcanvasを追加（z-indexで重ね順を管理）
        this.app.canvasContainer.appendChild(canvas);
        
        this.layers.unshift(layer); // 配列の先頭に追加
        this.updateZIndex();

        return layer;
    }

    /**
     * 新しい透明レイヤーを追加し、アクティブにする
     */
    addNewLayer() {
        const newLayer = this.createLayer();
        this.setActiveLayer(newLayer.id);
        // 予告: Undo/Redoのレイヤー履歴対応機能 今後実装予定
        // 難易度：高｜優先度：中
        // this.app.saveState(); // 本来はここで履歴を保存
    }
    
    /**
     * 指定されたIDのレイヤーをアクティブにする
     * @param {string} layerId 
     */
    setActiveLayer(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || layer === this.activeLayer) return;

        this.activeLayer = layer;

        // 全てのレイヤーのUIから 'active' クラスを削除
        this.layers.forEach(l => l.uiElement.classList.remove('active'));
        // アクティブなレイヤーのUIに 'active' クラスを追加
        layer.uiElement.classList.add('active');

        // ★重要: メインアプリの描画コンテキストをアクティブレイヤーのものに差し替える
        this.app.ctx = layer.ctx;
        this.app.canvas = layer.canvas; // 描画イベントのターゲットも更新
    }
    
    /**
     * レイヤーの表示/非表示を切り替える
     * @param {string} layerId
     */
    toggleVisibility(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;

        layer.visible = !layer.visible;
        layer.canvas.style.display = layer.visible ? 'block' : 'none';
        layer.uiElement.querySelector('.visibility-btn').style.opacity = layer.visible ? 1 : 0.5;
    }
    
    /**
     * レイヤーを削除する
     * @param {string} layerId
     */
    deleteLayer(layerId) {
        // 背景レイヤーや、描画可能レイヤーが1枚しかない場合は削除しない
        const deletableLayers = this.layers.filter(l => l.uiElement.querySelector('.delete-btn'));
        if (deletableLayers.length <= 1) {
            alert('最後のレイヤーは削除できません。');
            return;
        }

        const layerIndex = this.layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return;

        const [deletedLayer] = this.layers.splice(layerIndex, 1);
        
        // DOMから要素を削除
        deletedLayer.uiElement.remove();
        deletedLayer.canvas.remove();
        
        // もし削除したレイヤーがアクティブだったら、別のレイヤーをアクティブにする
        if (this.activeLayer.id === layerId) {
            const newActiveIndex = Math.max(0, layerIndex - 1);
            // 新しいアクティブ候補が背景でないことを確認
            const newActiveLayer = this.layers.find((l, idx) => idx === newActiveIndex && l.uiElement.querySelector('.delete-btn')) || deletableLayers[0];
            this.setActiveLayer(newActiveLayer.id);
        }

        this.updateZIndex();
    }
    
    /**
     * layers配列の順序に基づいてcanvasのz-indexを更新する
     */
    updateZIndex() {
        this.layers.forEach((layer, index) => {
            // 配列のインデックスが下の方がUIで上に表示されるため、z-indexは逆順にする
            const zIndex = this.layers.length - 1 - index;
            layer.canvas.style.zIndex = zIndex;
        });
    }

    // --- イベントハンドラ ---

    handleLayerClick(e) {
        const target = e.target;
        const layerElement = target.closest('.layer-item');
        if (!layerElement) return;

        const layerId = layerElement.dataset.layerId;
        
        if (target.matches('.delete-btn')) {
            // 予告: フリックによるレイヤー削除機能 今後実装予定
            // 難易度：中｜優先度：中
            if (confirm(`レイヤー「${this.layers.find(l=>l.id===layerId).name}」を削除しますか？`)) {
                this.deleteLayer(layerId);
            }
        } else if (target.matches('.visibility-btn')) {
            this.toggleVisibility(layerId);
        } else if (layerElement.getAttribute('draggable') === 'true') {
            this.setActiveLayer(layerId);
        }
    }
    
    handleDragStart(e) {
        const target = e.target.closest('.layer-item');
        if (target && target.getAttribute('draggable') === 'true') {
            this.draggedLayer = target;
            setTimeout(() => {
                target.classList.add('dragging');
            }, 0);
        }
    }
    
    handleDragOver(e) {
        e.preventDefault();
        const target = e.target.closest('.layer-item');
        if (target && target !== this.draggedLayer && target.getAttribute('draggable') === 'true') {
            // drag-overクラスを一旦すべて削除
            this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
            target.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
         const target = e.target.closest('.layer-item');
         if (target) {
            target.classList.remove('drag-over');
         }
    }

    handleDrop(e) {
        e.preventDefault();
        const dropTarget = e.target.closest('.layer-item');
        if (!dropTarget || !this.draggedLayer || dropTarget === this.draggedLayer) return;

        // DOM上でのUI要素の移動
        this.layerList.insertBefore(this.draggedLayer, dropTarget);
        
        // `layers` 配列の並び替え
        const draggedId = this.draggedLayer.dataset.layerId;
        const targetId = dropTarget.dataset.layerId;

        const draggedIndex = this.layers.findIndex(l => l.id === draggedId);
        const targetIndex = this.layers.findIndex(l => l.id === targetId);

        const [draggedItem] = this.layers.splice(draggedIndex, 1);
        this.layers.splice(targetIndex, 0, draggedItem);
        
        this.updateZIndex();
    }
    
    handleDragEnd(e) {
        if (this.draggedLayer) {
            this.draggedLayer.classList.remove('dragging');
        }
        this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
        this.draggedLayer = null;
    }

    // --- 今後実装予定の機能 ---
    
    // 予告: レイヤーフォルダ管理機能
    // 難易度：高｜優先度：後

    // 予告: レイヤー透明度変更機能
    // 難易度：中｜優先度：中
}