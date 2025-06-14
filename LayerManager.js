// LayerManager.js
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
        this.layers = []; // レイヤーとなるキャンバス要素とそのコンテキストを格納する配列
        this.activeLayer = null; // 現在アクティブなレイヤー
        this.layerCounter = 1; // 新規レイヤーの命名用カウンター
        this.draggedLayer = null; // ドラッグ中のレイヤー要素

        // 元のキャンバスはテンプレートとして保持し、DOMからは非表示にする
        this.templateCanvas = this.app.canvasManager.canvas; // CanvasManagerから既存のキャンバスを取得
        this.templateCanvas.style.display = 'none'; // テンプレートとして非表示にする

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
        
        // レイヤーリストのコンテナ
        this.layerList = document.createElement('div');
        this.layerList.className = 'layer-list';

        // フッター（操作ボタン）
        const footer = document.createElement('div');
        footer.className = 'layer-panel-footer';
        footer.innerHTML = `
            <button id="add-layer-btn" class="layer-btn" title="新規レイヤー"><i class="fas fa-plus"></i></button>
            <button id="delete-layer-btn" class="layer-btn" title="レイヤー削除"><i class="fas fa-trash-alt"></i></button>
            <button id="merge-layer-btn" class="layer-btn" title="レイヤー結合"><i class="fas fa-layer-group"></i></button>
            <button id="move-layer-up-btn" class="layer-btn" title="レイヤーを上へ"><i class="fas fa-arrow-up"></i></button>
            <button id="move-layer-down-btn" class="layer-btn" title="レイヤーを下へ"><i class="fas fa-arrow-down"></i></button>
        `;

        this.panel.appendChild(header);
        this.panel.appendChild(this.layerList);
        this.panel.appendChild(footer);

        // メインコンテナに追加
        document.querySelector('.main-container').appendChild(this.panel);
    }

    /**
     * レイヤーパネルのCSSスタイルを動的に注入する
     */
    injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            #layer-panel {
                position: absolute;
                top: 30px; /* Adjust based on top bar height */
                right: 0;
                width: 200px; /* Adjust width as needed */
                height: calc(100vh - 30px); /* Adjust height */
                background-color: rgba(255, 255, 255, 0.7); /* Slightly transparent */
                border-left: 1px solid var(--light-brown-border);
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
                z-index: 100; /* Make sure it's above the canvas */
            }

            .layer-panel-header {
                padding: 8px;
                background-color: var(--main-bg-color);
                border-bottom: 1px solid var(--light-brown-border);
                text-align: center;
                font-weight: bold;
                color: var(--dark-brown);
            }

            .layer-list {
                flex-grow: 1;
                overflow-y: auto;
                padding: 5px;
            }

            .layer-item {
                display: flex;
                align-items: center;
                padding: 5px;
                margin-bottom: 3px;
                background-color: rgba(255, 255, 255, 0.9);
                border: 1px solid var(--light-brown-border);
                border-radius: 3px;
                cursor: pointer;
                user-select: none; /* Prevent text selection */
            }

            .layer-item.active {
                background-color: var(--button-active-bg);
                border-color: var(--dark-brown);
            }

            .layer-item.dragging {
                opacity: 0.5;
                border: 2px dashed var(--dark-brown);
            }

            .layer-item.drag-over {
                border-top: 2px solid var(--dark-brown); /* ドラッグオーバー時の表示 */
            }

            .layer-thumbnail {
                width: 40px;
                height: 30px;
                background-color: #eee;
                border: 1px solid #ccc;
                margin-right: 8px;
                flex-shrink: 0; /* サムネイルが縮まないように */
            }

            .layer-name {
                flex-grow: 1;
                font-size: 0.9em;
                color: var(--dark-brown);
            }

            .layer-visibility-toggle {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--dark-brown);
                font-size: 1em;
                padding: 0 5px;
            }

            .layer-panel-footer {
                display: flex;
                justify-content: space-around;
                padding: 5px;
                border-top: 1px solid var(--light-brown-border);
                background-color: var(--main-bg-color);
            }

            .layer-btn {
                background-color: var(--button-inactive-bg);
                border: 1px solid var(--light-brown-border);
                color: var(--dark-brown);
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                transition: background-color 0.2s;
            }

            .layer-btn:hover {
                background-color: var(--button-active-bg);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * イベントリスナーをバインドする
     */
    bindEvents() {
        document.getElementById('add-layer-btn').addEventListener('click', () => this.addLayer());
        this.layerList.addEventListener('click', this.handleLayerClick.bind(this));
        this.layerList.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.layerList.addEventListener('dragover', this.handleDragOver.bind(this));
        this.layerList.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.layerList.addEventListener('drop', this.handleDrop.bind(this));
        this.layerList.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    /**
     * 初期レイヤー（背景レイヤーと最初の描画レイヤー）を設定する
     * 既存のdrawingCanvasを最初の描画レイヤーとして利用する
     */
javascript

setupInitialLayers() {
    console.log("setupInitialLayers started");
    const originalCanvas = this.app.canvasManager.canvas;
    console.log("Canvas size:", originalCanvas.width, originalCanvas.height);
    // const layer = this.createLayer(); // 仮
}


        // 既存のdrawingCanvasを非表示にする代わりに、最初のレイヤーとして利用する
        // ただし、CanvasManagerがメインキャンバスとして利用し続けるため、
        // ここでは便宜的にレイヤー管理用の新しいキャンバスを作成し、既存のキャンバスを上書きする形にする。
        // （本来は既存のキャンバスをLayerManagerが管理すべきだが、モジュール構造維持のため）

        // まず、既存のCanvasManagerが扱うキャンバスを取得
        const originalCanvas = this.app.canvasManager.canvas;
        const originalCtx = this.app.canvasManager.ctx;
        
        // 既存のキャンバスの内容をクリアし、最初のレイヤーとして扱う
        originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
        
        // 最初のレイヤーとして既存のキャンバスを追加
        // このキャンバスはCanvasManagerによって描画対象として設定されるため、
        // z-indexはLayerManagerが管理する他のレイヤーの基準となる
        this.layers.push({
            id: 'layer-' + (this.layerCounter++),
            name: 'レイヤー 1',
            canvas: originalCanvas,
            ctx: originalCtx,
            visible: true,
            imageData: null // レイヤーの内容を保持するImageData (Undo/Redo用)
        });

        // この既存のキャンバスをアクティブレイヤーにする
        this.activeLayer = this.layers[0];
        
        // レイヤーUIを更新
        this.updateLayerUI();
        this.switchLayer(0); // 最初のレイヤーをアクティブにする
    }

    /**
     * 新しいレイヤーを追加する
     */
    addLayer() {
        // 既存のdrawingCanvasのサイズを取得
        const baseCanvas = this.app.canvasManager.canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        const newCtx = newCanvas.getContext('2d');

        newCanvas.style.position = 'absolute';
        newCanvas.style.left = '0';
        newCanvas.style.top = '0';
        // z-indexは後でupdateZIndexで設定される

        const layerId = 'layer-' + (this.layerCounter++);
        newCanvas.id = layerId;
        newCanvas.className = 'drawing-layer'; // レイヤーを示すクラスを追加

        // canvas-containerに新しいキャンバスを追加
        document.getElementById('canvas-container').appendChild(newCanvas);

        const newLayer = {
            id: layerId,
            name: `レイヤー ${this.layerCounter -1}`,
            canvas: newCanvas,
            ctx: newCtx,
            visible: true,
            imageData: null // 初期状態ではImageDataはnull
        };

        this.layers.push(newLayer);
        this.updateLayerUI();
        this.switchLayer(this.layers.length - 1); // 新しいレイヤーをアクティブにする
        this.updateZIndex(); // z-indexを更新
    }

    /**
     * 指定されたインデックスのレイヤーをアクティブにする
     * @param {number} index アクティブにするレイヤーのインデックス
     */
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            console.warn('指定されたレイヤーインデックスは無効です:', index);
            return;
        }

        if (this.activeLayer) {
            // 現在アクティブなレイヤーのUIを非アクティブにする
            const currentActiveElement = document.querySelector(`.layer-item[data-layer-id="${this.activeLayer.id}"]`);
            if (currentActiveElement) {
                currentActiveElement.classList.remove('active');
            }
        }

        this.activeLayer = this.layers[index];
        // CanvasManagerの描画ターゲットを新しいアクティブレイヤーのコンテキストに設定
        this.app.canvasManager.setContext(this.activeLayer.ctx);

        // 新しくアクティブになったレイヤーのUIをアクティブにする
        const newActiveElement = document.querySelector(`.layer-item[data-layer-id="${this.activeLayer.id}"]`);
        if (newActiveElement) {
            newActiveElement.classList.add('active');
        }
        console.log(`レイヤーを「${this.activeLayer.name}」に切り替えました。`);
    }

    /**
     * 現在アクティブなレイヤーを返す
     * @returns {object} アクティブなレイヤーオブジェクト
     */
    getCurrentLayer() {
        return this.activeLayer;
    }

    /**
     * レイヤーUIを更新する
     */
    updateLayerUI() {
        this.layerList.innerHTML = ''; // リストをクリア

        // レイヤーを逆順に表示（上にあるレイヤーほど手前に表示されるため）
        this.layers.slice().reverse().forEach((layer, originalIndex) => {
            const displayIndex = this.layers.length - 1 - originalIndex; // 表示上のインデックス
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = layer.id;
            layerItem.dataset.layerIndex = displayIndex; // DOM要素の表示順のインデックス
            layerItem.draggable = true; // ドラッグ可能にする

            if (layer === this.activeLayer) {
                layerItem.classList.add('active');
            }

            // レイヤーのサムネイル（ここでは簡易的に背景色のみ）
            const thumbnail = document.createElement('canvas');
            thumbnail.className = 'layer-thumbnail';
            thumbnail.width = 40;
            thumbnail.height = 30;
            const thumbCtx = thumbnail.getContext('2d');
            
            // レイヤーの内容をサムネイルに描画
            thumbCtx.drawImage(layer.canvas, 0, 0, thumbnail.width, thumbnail.height);

            // レイヤー名
            const layerName = document.createElement('span');
            layerName.className = 'layer-name';
            layerName.textContent = layer.name;

            // 可視性トグルボタン
            const visibilityToggle = document.createElement('button');
            visibilityToggle.className = 'layer-visibility-toggle';
            visibilityToggle.innerHTML = layer.visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
            visibilityToggle.addEventListener('click', (e) => {
                e.stopPropagation(); // 親要素のクリックイベントが発火しないようにする
                this.toggleLayerVisibility(layer.id);
            });


            layerItem.appendChild(thumbnail);
            layerItem.appendChild(layerName);
            layerItem.appendChild(visibilityToggle);
            this.layerList.appendChild(layerItem);
        });
    }

    /**
     * レイヤーの可視性を切り替える
     * @param {string} layerId 可視性を切り替えるレイヤーのID
     */
    toggleLayerVisibility(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.visible = !layer.visible;
            layer.canvas.style.display = layer.visible ? 'block' : 'none';
            this.updateLayerUI(); // UIを更新して目のアイコンを切り替える
            this.app.canvasManager.renderAllLayers(); // 全レイヤーを再描画して変更を反映
        }
    }


    /**
     * レイヤーのz-indexを更新する
     * レイヤーリストの順序に基づいてz-indexを割り当てる
     */
    updateZIndex() {
        // レイヤーリストの順番はDOMの表示順（逆順）なので、layers配列のインデックスとは逆になる
        // z-indexは手前にあるものほど大きな値にする
        this.layers.forEach((layer, index) => {
            // 最下層のレイヤー (index 0) が最も小さいz-indexを持つ
            // レイヤーが上に来るほどz-indexを大きくする
            layer.canvas.style.zIndex = index; // indexがそのままz-indexになる
        });
        // CanvasManagerの表示更新をトリガー
        this.app.canvasManager.renderAllLayers();
    }


    /**
     * レイヤーアイテムがクリックされた時のハンドラー
     * @param {Event} e クリックイベント
     */
    handleLayerClick(e) {
        const layerItem = e.target.closest('.layer-item');
        if (layerItem) {
            const layerId = layerItem.dataset.layerId;
            const index = this.layers.findIndex(layer => layer.id === layerId);
            if (index !== -1) {
                this.switchLayer(index);
            }
        }
    }

    // ドラッグ＆ドロップ関連のイベントハンドラ

    handleDragStart(e) {
        const target = e.target.closest('.layer-item');
        if (target) {
            this.draggedLayer = target;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', target.dataset.layerId); // レイヤーIDをデータとして設定
            target.classList.add('dragging');
        }
    }

    handleDragOver(e) {
        e.preventDefault(); // デフォルトの挙動（ドロップ禁止）をキャンセル
        e.dataTransfer.dropEffect = 'move';
        
        // ドラッグオーバー中の要素にクラスを付与して視覚的にフィードバック
        const target = e.target.closest('.layer-item');
        if (target && target !== this.draggedLayer) {
            document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
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
        this.updateLayerUI(); // UIの表示順を再調整
    }
    
    handleDragEnd(e) {
        if (this.draggedLayer) {
            this.draggedLayer.classList.remove('dragging');
            this.draggedLayer = null;
        }
        document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
    }
}
