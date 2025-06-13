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
        // this.templateCanvas = this.app.canvas; // HTML内の既存キャンバスを使用せず、動的に生成する
        this.mainCanvasElement = document.getElementById('drawingCanvas'); // メインのHTMLキャンバス要素
        this.mainCanvasElement.style.display = 'none'; // メインキャンバスを非表示にする

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

        // TopBarManagerのAPIを使ってアイコンを追加する
        // TopBarManagerには現時点でレイヤー操作に関するAPIがないため、今回は直接追加しない
        // 今後、TopBarManagerにレイヤーパネルの開閉ボタンなどを追加する際に検討
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
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                line-height: 1;
            }
            .layer-controls button:hover {
                background-color: var(--button-active-bg);
            }
            #layer-list {
                flex-grow: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column-reverse; /* 新しいレイヤーが下に追加されるように反転 */
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
                opacity: 1; /* 初期は表示 */
            }
            .layer-item .visibility-btn.hidden {
                opacity: 0.3; /* 非表示状態のアイコンは薄く */
            }
            .layer-item .layer-name {
                flex-grow: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .layer-item .delete-btn {
                background: none;
                border: none;
                cursor: pointer;
                color: #f44;
                font-size: 18px;
                visibility: hidden; /* ホバーで表示 */
                margin-left: 8px;
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
        // 背景レイヤー (最初に作成し、配列の最後になるようにする)
        const bgLayer = this.createLayer({
            id: 'background-layer', // 背景レイヤーに固有のIDを設定
            name: '背景',
            deletable: false,
            draggable: false
        });
        bgLayer.ctx.fillStyle = '#f0e0d6'; // 元のキャンバス背景色
        bgLayer.ctx.fillRect(0, 0, bgLayer.canvas.width, bgLayer.canvas.height);
        bgLayer.uiElement.classList.add('background-layer', 'no-drag');
        bgLayer.uiElement.setAttribute('draggable', false);
        this.layers.push(bgLayer); // 配列の末尾に追加
        this.layerList.appendChild(bgLayer.uiElement); // DOMの末尾に追加

        // 最初の描画用レイヤー
        this.addNewLayer(); // activeLayerはaddNewLayerで設定される
    }

    /**
     * 新しいレイヤーを作成する（内部処理）
     * @param {object} options - レイヤーのオプション
     * @returns {object} 作成されたレイヤーオブジェクト
     */
    createLayer(options = {}) {
        const { id, name, deletable = true, draggable = true } = options;
        const layerId = id || `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // レイヤーごとに独立したCanvasを生成
        const canvas = document.createElement('canvas');
        // メインキャンバスの現在のサイズを基準にする
        canvas.width = this.mainCanvasElement.width;
        canvas.height = this.mainCanvasElement.height;
        canvas.className = 'main-canvas layer-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';

        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // レイヤーUI要素を生成
        const uiElement = document.createElement('div');
        uiElement.className = 'layer-item';
        uiElement.dataset.layerId = layerId;
        uiElement.setAttribute('draggable', draggable.toString()); // HTML属性は文字列で設定

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
            history: [], // レイヤーごとの履歴
            historyIndex: -1,
        };

        // 新規レイヤーは背景レイヤーの直前に追加
        if (id !== 'background-layer') { // 背景レイヤーはsetupInitialLayersで直接追加するため除外
            // UIをリストの最後（DOMの順序では下になるが、表示は上に）に追加
            // この.insertBefore()は、既存のレイヤーUIの一番上（リストの最後）に挿入する意図
            // this.layerList.insertBefore(uiElement, this.layerList.firstChild); // 先頭に挿入
            // レイヤーリストの表示順序を反転させているため、新規レイヤーは一番下（新しいものほど下）に追加される
            this.layerList.appendChild(uiElement);
            this.layers.unshift(layer); // 配列の先頭に追加
        }

        // キャンバスコンテナの末尾にcanvasを追加（z-indexで重ね順を管理）
        this.app.canvasContainer.appendChild(canvas);

        this.updateZIndex();
        this.saveLayerState(layer.id); // 初期状態を履歴に保存

        return layer;
    }

    /**
     * 新しい透明レイヤーを追加し、アクティブにする
     */
    addNewLayer() {
        const newLayer = this.createLayer();
        this.setActiveLayer(newLayer.id);
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

        // CanvasManagerの描画対象をアクティブレイヤーに設定
        this.app.canvasManager.setTargetLayer(layer);
    }

    /**
     * アクティブなレイヤーを返す
     * @returns {object|null} アクティブなレイヤーオブジェクト、またはnull
     */
    getActiveLayer() {
        return this.activeLayer;
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
        // アイコンの見た目を更新
        const visibilityBtn = layer.uiElement.querySelector('.visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.classList.toggle('hidden', !layer.visible);
            visibilityBtn.innerHTML = layer.visible ? '&#128065;' : '&#128064;'; // 👁 /  blind 
            visibilityBtn.title = layer.visible ? 'レイヤーを非表示' : 'レイヤーを表示';
        }
    }

    /**
     * レイヤーを削除する
     * @param {string} layerId
     */
    deleteLayer(layerId) {
        // 背景レイヤーは削除不可
        if (layerId === 'background-layer') {
            alert('背景レイヤーは削除できません。');
            return;
        }

        // 描画可能レイヤーが1枚しかない場合は削除しない
        const deletableLayers = this.layers.filter(l => l.uiElement.querySelector('.delete-btn'));
        if (deletableLayers.length <= 1) {
            alert('描画レイヤーは最低1枚必要です。');
            return;
        }

        const layerIndex = this.layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return;

        const [deletedLayer] = this.layers.splice(layerIndex, 1);

        // DOMから要素を削除
        deletedLayer.uiElement.remove();
        deletedLayer.canvas.remove();

        // もし削除したレイヤーがアクティブだったら、別のレイヤーをアクティブにする
        if (this.activeLayer && this.activeLayer.id === layerId) {
            // 削除されたレイヤーのすぐ上のレイヤーをアクティブにする（配列のインデックスが若い方）
            const newActiveIndex = Math.max(0, layerIndex === 0 ? 0 : layerIndex - 1);
            // 新しいアクティブ候補が背景でないことを確認
            const newActiveLayer = this.layers[newActiveIndex];

            this.setActiveLayer(newActiveLayer.id);
        }

        this.updateZIndex();
    }

    /**
     * layers配列の順序に基づいてcanvasのz-indexを更新する
     * UIリストの順序 (上にあるものほど配列のインデックスが若い) と
     * canvasのz-index (数値が大きいほど手前) が一致するように調整
     */
    updateZIndex() {
        // UIリストの下にあるレイヤーほど手前に表示されるようにする
        // this.layers 配列は、UIの表示順とは逆 (先頭が新しいレイヤー) になっているので注意
        // layerListのflex-direction: column-reverse; と合わせて、UIの一番上が一番奥のレイヤーになる
        this.layers.forEach((layer, index) => {
            // z-indexは、UIリストの一番下の要素が最大値になるように設定する
            // 逆に、UIリストの一番上の要素（配列の最後）が最小値になる
            // 例: レイヤーが3つある場合 (L1, L2, 背景)
            // L1 (index 0) -> zIndex 2
            // L2 (index 1) -> zIndex 1
            // 背景 (index 2) -> zIndex 0
            const zIndex = this.layers.length - 1 - index;
            layer.canvas.style.zIndex = zIndex.toString();
        });
    }

    /**
     * 指定されたレイヤーの現在の状態を履歴に保存する
     * @param {string} layerId
     */
    saveLayerState(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;

        if (layer.historyIndex < layer.history.length - 1) {
            layer.history = layer.history.slice(0, layer.historyIndex + 1);
        }
        const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
        layer.history.push(imageData);
        layer.historyIndex++;
    }

    /**
     * 指定されたレイヤーの操作を元に戻す
     * @param {string} layerId
     */
    undoLayerState(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || layer.historyIndex <= 0) return;

        layer.historyIndex--;
        const imageData = layer.history[layer.historyIndex];
        layer.ctx.putImageData(imageData, 0, 0);
    }

    /**
     * 指定されたレイヤーの操作をやり直す
     * @param {string} layerId
     */
    redoLayerState(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || layer.historyIndex >= layer.history.length - 1) return;

        layer.historyIndex++;
        const imageData = layer.history[layer.historyIndex];
        layer.ctx.putImageData(imageData, 0, 0);
    }


    // --- イベントハンドラ ---

    handleLayerClick(e) {
        const target = e.target;
        const layerElement = target.closest('.layer-item');
        if (!layerElement) return;

        const layerId = layerElement.dataset.layerId;

        if (target.matches('.delete-btn')) {
            // alertの代わりにカスタムモーダルを使用することを推奨
            // 今回は既存のalert()を一時的に使用
            if (window.confirm(`レイヤー「${this.layers.find(l=>l.id===layerId).name}」を削除しますか？`)) {
                this.deleteLayer(layerId);
            }
        } else if (target.matches('.visibility-btn')) {
            this.toggleVisibility(layerId);
        } else { // レイヤーアイテム自体をクリックした場合（ドラッグ開始以外）
            this.setActiveLayer(layerId);
        }
    }

    handleDragStart(e) {
        const target = e.target.closest('.layer-item');
        if (target && target.getAttribute('draggable') === 'true') {
            this.draggedLayer = target;
            // ドラッグ開始時のデータをセット（Firefoxで必要になる場合がある）
            e.dataTransfer.setData('text/plain', target.dataset.layerId);
            e.dataTransfer.effectAllowed = 'move'; // 移動のみ許可

            setTimeout(() => {
                target.classList.add('dragging');
            }, 0); // クラス追加を少し遅らせる
        } else {
            e.preventDefault(); // ドラッグ不可の要素の場合はドラッグをキャンセル
        }
    }

    handleDragOver(e) {
        e.preventDefault(); // dropイベントを許可するために必要
        e.dataTransfer.dropEffect = 'move'; // ドロップカーソルを設定

        const target = e.target.closest('.layer-item');
        if (target && target !== this.draggedLayer && target.getAttribute('draggable') === 'true') {
            // drag-overクラスを一旦すべて削除
            this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
            target.classList.add('drag-over');
        } else {
            this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
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
        if (!dropTarget || !this.draggedLayer || dropTarget === this.draggedLayer) {
            this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
            return;
        }

        // DOM上でのUI要素の移動
        // dropTargetがdraggedLayerより上にあるか下にあるかで挿入位置を調整
        const dropTargetRect = dropTarget.getBoundingClientRect();
        const draggedRect = this.draggedLayer.getBoundingClientRect();
        const isDraggingUp = draggedRect.top > dropTargetRect.top; // 上に移動しているか

        if (isDraggingUp) {
            this.layerList.insertBefore(this.draggedLayer, dropTarget);
        } else {
            this.layerList.insertBefore(this.draggedLayer, dropTarget.nextSibling);
        }

        // `layers` 配列の並び替え
        const draggedId = this.draggedLayer.dataset.layerId;
        const targetId = dropTarget.dataset.layerId;

        const draggedItem = this.layers.find(l => l.id === draggedId);
        const targetItem = this.layers.find(l => l.id === targetId);

        if (!draggedItem || !targetItem) return;

        const oldIndex = this.layers.indexOf(draggedItem);
        const newIndex = this.layers.indexOf(targetItem);

        // 配列からdraggedItemを削除し、新しい位置に挿入
        this.layers.splice(oldIndex, 1);
        this.layers.splice(newIndex, 0, draggedItem);

        this.updateZIndex();
        this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
    }

    handleDragEnd(e) {
        if (this.draggedLayer) {
            this.draggedLayer.classList.remove('dragging');
        }
        this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
        this.draggedLayer = null;
    }
}
