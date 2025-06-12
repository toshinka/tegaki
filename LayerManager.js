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
        this.layers = []; // レイヤーオブジェクトの配列
        this.activeLayer = null; // 現在アクティブなレイヤー
        this.layerCounter = 1; // 新規レイヤーの命名用カウンター
        this.draggedLayer = null; // ドラッグ中のレイヤー要素

        // 元のキャンバスはテンプレートとして保持し、DOMからは非表示にする
        this.templateCanvas = this.app.canvas;
        this.templateCanvas.style.display = 'none';

        // 各レイヤーの履歴を管理するマップ
        // key: layer.id, value: { history: [], historyIndex: -1 }
        this.layerHistories = new Map(); 

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
        this.addLayerBtn.textContent = '＋'; // プラス記号
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
    }

    /**
     * レイヤーパネル用のCSSを動的に注入する
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #layer-panel {
                position: absolute;
                top: 30px; /* 上部ツールバーの下から */
                right: 0;
                width: 180px;
                height: calc(100vh - 30px); /* 上部ツールバーを除いた高さ */
                background-color: var(--main-bg-color);
                border-left: 1px solid var(--light-brown-border);
                display: flex;
                flex-direction: column;
                font-size: 12px;
                color: var(--dark-brown);
                z-index: 2000; /* 他のUI要素の上に表示 */
                box-sizing: border-box; /* パディングとボーダーをwidth/heightに含める */
            }
            .layer-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px;
                border-bottom: 1px solid var(--light-brown-border);
                background-color: var(--light-brown-border);
                flex-shrink: 0; /* 高さ固定 */
            }
            .layer-panel-header span {
                font-weight: bold;
            }
            .layer-controls button {
                background: var(--button-inactive-bg);
                border: 1px solid var(--dark-brown);
                color: var(--dark-brown);
                border-radius: 3px;
                cursor: pointer;
                width: 22px;
                height: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                line-height: 1;
            }
            .layer-controls button:hover {
                background-color: var(--button-active-bg);
            }
            #layer-list {
                flex-grow: 1; /* 残りのスペースを埋める */
                overflow-y: auto; /* コンテンツがはみ出したらスクロール */
                padding-bottom: 5px; /* 最下部に見やすい隙間 */
            }
            .layer-item {
                display: flex;
                align-items: center;
                padding: 6px 8px;
                border-bottom: 1px solid var(--light-brown-border);
                cursor: grab;
                user-select: none; /* テキスト選択を無効化 */
                background-color: var(--main-bg-color);
                transition: background-color 0.1s ease, border-top 0.1s ease;
            }
            .layer-item.active {
                background-color: var(--button-active-bg); /* アクティブなレイヤーの背景色 */
                border: 1px solid var(--dark-brown); /* アクティブなレイヤーのボーダー */
                border-left: none;
                border-right: none;
                padding: 5px 8px; /* ボーダー分パディングを調整 */
            }
            .layer-item.drag-over {
                border-top: 2px solid #3498db; /* ドラッグオーバー時のインジケーター */
                padding-top: 4px; /* ボーダー分パディングを調整 */
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
                color: var(--dark-brown);
            }
            .layer-item .visibility-btn:hover {
                 opacity: 0.7;
            }
            .layer-item .layer-name {
                flex-grow: 1; /* 名前が残りのスペースを埋める */
                white-space: nowrap; /* テキストの折り返し禁止 */
                overflow: hidden; /* はみ出したテキストを隠す */
                text-overflow: ellipsis; /* はみ出したテキストを三点リーダーで表示 */
            }
            .layer-item .delete-btn {
                background: none;
                border: none;
                cursor: pointer;
                color: #f44;
                font-size: 18px;
                margin-left: 8px;
                visibility: hidden; /* デフォルトでは非表示 */
                opacity: 0.7;
            }
            .layer-item:hover .delete-btn {
                visibility: visible; /* ホバー時に表示 */
            }
            .layer-item.no-drag {
                cursor: default; /* ドラッグ不可のレイヤーのカーソル */
            }
            .layer-item.background-layer {
                background-color: rgb(220, 188, 175); /* 背景レイヤーの特別な色 */
                font-style: italic;
            }
            .layer-item.background-layer .delete-btn {
                visibility: hidden !important; /* 背景レイヤーの削除ボタンは常に非表示 */
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * イベントリスナーを設定
     */
    bindEvents() {
        this.addLayerBtn.addEventListener('click', () => this.addNewLayer());
        
        // ドラッグ＆ドロップイベント (イベント委任)
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
            deletable: false, // 削除不可
            draggable: false  // ドラッグ不可
        });
        bgLayer.ctx.fillStyle = '#f0e0d6'; // 元のキャンバス背景色
        bgLayer.ctx.fillRect(0, 0, bgLayer.canvas.width, bgLayer.canvas.height);
        bgLayer.uiElement.classList.add('background-layer', 'no-drag'); // CSSクラスを追加
        bgLayer.uiElement.setAttribute('draggable', 'false'); // HTML属性としてdraggableをfalseに設定

        // 最初の描画用レイヤーを追加
        this.addNewLayer(); 
    }

    /**
     * 新しいレイヤーを作成する（内部処理）
     * @param {object} options - レイヤーのオプション
     * @param {string} [options.name] - レイヤー名
     * @param {boolean} [options.deletable=true] - 削除可能か
     * @param {boolean} [options.draggable=true] - ドラッグ可能か
     * @returns {object} 作成されたレイヤーオブジェクト
     */
    createLayer(options = {}) {
        const { name, deletable = true, draggable = true } = options;
        const layerId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // ユニークなID

        // レイヤーごとに独立したCanvasを生成
        const canvas = document.createElement('canvas');
        canvas.id = layerId; // IDをcanvas要素にも設定
        canvas.width = this.templateCanvas.width;
        canvas.height = this.templateCanvas.height;
        canvas.className = 'main-canvas layer-canvas'; // 共通とレイヤー固有のクラス
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // レイヤーUI要素を生成
        const uiElement = document.createElement('div');
        uiElement.className = 'layer-item';
        uiElement.dataset.layerId = layerId; // カスタムデータ属性にIDを保存
        uiElement.setAttribute('draggable', draggable ? 'true' : 'false'); // ドラッグ可能属性

        const visibilityBtn = document.createElement('button');
        visibilityBtn.className = 'visibility-btn';
        visibilityBtn.innerHTML = '&#128065;'; // '👁' (目玉アイコン)
        visibilityBtn.title = 'レイヤーの表示/非表示';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = name || `レイヤー ${this.layerCounter++}`;
        
        uiElement.appendChild(visibilityBtn);
        uiElement.appendChild(nameSpan);

        if (deletable) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;'; // '×' (バツ印)
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
            history: [],     // このレイヤー専用の履歴スタック
            historyIndex: -1 // このレイヤー専用の履歴インデックス
        };
        
        // レイヤーリストの先頭にUIを追加 (新しいレイヤーはリストの最上位に表示)
        this.layerList.insertBefore(uiElement, this.layerList.firstChild);
        // キャンバスコンテナの末尾にcanvasを追加（z-indexで重ね順を管理）
        this.app.canvasContainer.appendChild(canvas);
        
        this.layers.unshift(layer); // 配列の先頭に追加 (z-index管理のため)
        this.updateZIndex(); // z-indexを更新

        // 新しいレイヤーの初期状態を履歴に保存
        this.saveLayerState(layer.id);

        return layer;
    }

    /**
     * 新しい透明レイヤーを追加し、それをアクティブにします。
     */
    addNewLayer() {
        const newLayer = this.createLayer();
        this.setActiveLayer(newLayer.id);
    }
    
    /**
     * 指定されたIDのレイヤーをアクティブにする
     * @param {string} layerId - アクティブにするレイヤーのID
     */
    setActiveLayer(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || layer === this.activeLayer) return;

        this.activeLayer = layer;

        // 全てのレイヤーのUIから 'active' クラスを削除
        this.layers.forEach(l => l.uiElement.classList.remove('active'));
        // アクティブなレイヤーのUIに 'active' クラスを追加
        layer.uiElement.classList.add('active');

        // ★重要: CanvasManagerの描画コンテキストをアクティブレイヤーのものに差し替える
        this.app.canvasManager.setTargetLayer(layer);
    }

    /**
     * 現在アクティブなレイヤーを返します。
     * @returns {object|null} アクティブなレイヤーオブジェクト、またはnull
     */
    getActiveLayer() {
        return this.activeLayer;
    }
    
    /**
     * レイヤーの表示/非表示を切り替える
     * @param {string} layerId - 表示/非表示を切り替えるレイヤーのID
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
     * @param {string} layerId - 削除するレイヤーのID
     */
    deleteLayer(layerId) {
        const layerToDelete = this.layers.find(l => l.id === layerId);
        if (!layerToDelete) return;

        // 背景レイヤーは削除不可
        if (layerToDelete.name === '背景') {
            // alert('背景レイヤーは削除できません。'); // alertは使わない
            console.warn('背景レイヤーは削除できません。');
            return;
        }

        // 描画可能レイヤーが1枚しかない場合は削除しない (背景以外)
        const drawableLayers = this.layers.filter(l => l.name !== '背景');
        if (drawableLayers.length <= 1 && layerToDelete.name !== '背景') {
            // alert('最後の描画レイヤーは削除できません。'); // alertは使わない
            console.warn('最後の描画レイヤーは削除できません。');
            return;
        }

        // 確認ダイアログの代わりに、よりユーザーフレンドリーなUI（カスタムモーダルなど）を使用すべきだが、今回はconsole.logで代替
        if (!confirm(`レイヤー「${layerToDelete.name}」を削除しますか？`)) {
            return;
        }

        const layerIndex = this.layers.findIndex(l => l.id === layerId);
        const [deletedLayer] = this.layers.splice(layerIndex, 1);
        
        // DOMから要素を削除
        deletedLayer.uiElement.remove();
        deletedLayer.canvas.remove();
        
        // 削除したレイヤーがアクティブだった場合、別のレイヤーをアクティブにする
        if (this.activeLayer && this.activeLayer.id === layerId) {
            // 削除されたレイヤーの次のレイヤー、または前のレイヤーをアクティブにする
            // 背景レイヤーを避けてアクティブにするロジックを優先
            const newActiveCandidate = this.layers[layerIndex] || this.layers[layerIndex - 1];
            if (newActiveCandidate && newActiveCandidate.name !== '背景') {
                this.setActiveLayer(newActiveCandidate.id);
            } else if (drawableLayers.length > 0) { // まだ描画可能なレイヤーがある場合
                // 残っている描画可能レイヤーの最初のものをアクティブにする
                this.setActiveLayer(drawableLayers[0].id);
            } else {
                // 描画可能レイヤーがなくなった場合は背景レイヤーをアクティブにする
                this.setActiveLayer(this.layers.find(l => l.name === '背景').id);
            }
        }
        
        // 履歴からも削除
        this.layerHistories.delete(layerId);
        this.updateZIndex(); // z-indexを更新
    }
    
    /**
     * layers配列の順序に基づいてcanvasのz-indexを更新する
     * 配列のインデックスが若いほどUIで上に表示されるため、z-indexは逆順にする
     */
    updateZIndex() {
        this.layers.forEach((layer, index) => {
            const zIndex = this.layers.length - 1 - index;
            layer.canvas.style.zIndex = zIndex;
        });
    }

    /**
     * 指定したレイヤーの状態を履歴に保存します。
     * @param {string} layerId - 状態を保存するレイヤーのID
     */
    saveLayerState(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;

        // レイヤーの履歴オブジェクトを取得/作成
        let historyEntry = this.layerHistories.get(layerId);
        if (!historyEntry) {
            historyEntry = { history: [], historyIndex: -1 };
            this.layerHistories.set(layerId, historyEntry);
        }

        // 古い履歴を破棄
        if (historyEntry.historyIndex < historyEntry.history.length - 1) {
            historyEntry.history = historyEntry.history.slice(0, historyEntry.historyIndex + 1);
        }
        
        // 現在のImageDataを保存
        // ImageDataは可変なので、deep copyまたは新しいImageDataオブジェクトを作成する必要がある
        const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
        historyEntry.history.push(imageData);
        historyEntry.historyIndex++;
        // console.log(`Layer ${layer.name} state saved. History length: ${historyEntry.history.length}`); // デバッグ
    }

    /**
     * 指定したレイヤーの履歴を元に戻します（Undo）。
     * @param {string} layerId - 元に戻すレイヤーのID
     */
    undoLayerState(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;

        let historyEntry = this.layerHistories.get(layerId);
        if (historyEntry && historyEntry.historyIndex > 0) {
            historyEntry.historyIndex--;
            const imageData = historyEntry.history[historyEntry.historyIndex];
            layer.ctx.putImageData(imageData, 0, 0);
            // console.log(`Layer ${layer.name} undone. Current index: ${historyEntry.historyIndex}`); // デバッグ
        } else {
            // console.log(`No more undo states for layer ${layer.name}.`); // デバッグ
        }
    }

    /**
     * 指定したレイヤーの履歴をやり直します（Redo）。
     * @param {string} layerId - やり直すレイヤーのID
     */
    redoLayerState(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;

        let historyEntry = this.layerHistories.get(layerId);
        if (historyEntry && historyEntry.historyIndex < historyEntry.history.length - 1) {
            historyEntry.historyIndex++;
            const imageData = historyEntry.history[historyEntry.historyIndex];
            layer.ctx.putImageData(imageData, 0, 0);
            // console.log(`Layer ${layer.name} redone. Current index: ${historyEntry.historyIndex}`); // デバッグ
        } else {
            // console.log(`No more redo states for layer ${layer.name}.`); // デバッグ
        }
    }

    // --- イベントハンドラ ---

    /**
     * レイヤーリスト内のクリックイベントを処理します。（イベント委任）
     * @param {MouseEvent} e - マウスイベントオブジェクト
     */
    handleLayerClick(e) {
        const target = e.target;
        const layerElement = target.closest('.layer-item');
        if (!layerElement) return;

        const layerId = layerElement.dataset.layerId;
        
        if (target.matches('.delete-btn')) {
            this.deleteLayer(layerId);
        } else if (target.matches('.visibility-btn')) {
            this.toggleVisibility(layerId);
        } else if (layerElement.getAttribute('draggable') === 'true' || layerElement.classList.contains('background-layer')) {
            // ドラッグ可能なレイヤーか、背景レイヤーがクリックされたらアクティブにする
            this.setActiveLayer(layerId);
        }
    }
    
    /**
     * ドラッグ開始イベントを処理します。
     * @param {DragEvent} e - ドラッグイベントオブジェクト
     */
    handleDragStart(e) {
        const target = e.target.closest('.layer-item');
        // ドラッグ不可のレイヤーはドラッグ開始を許可しない
        if (!target || target.getAttribute('draggable') === 'false') {
            e.preventDefault();
            return;
        }

        this.draggedLayer = target;
        // ドラッグ中に元の要素を半透明にする
        setTimeout(() => {
            target.classList.add('dragging');
        }, 0);
        // ドラッグ中のデータとしてレイヤーIDを設定（今回は使用しないが慣例的に）
        e.dataTransfer.setData('text/plain', target.dataset.layerId);
        e.dataTransfer.effectAllowed = 'move';
    }
    
    /**
     * ドラッグオーバーイベントを処理します。（ドロップを許可するために必要）
     * @param {DragEvent} e - ドラッグイベントオブジェクト
     */
    handleDragOver(e) {
        e.preventDefault(); // デフォルトの動作（ドロップ禁止）を抑制
        const target = e.target.closest('.layer-item');
        // ドラッグ中のレイヤーとドロップターゲットが異なる、かつドロップターゲットがドラッグ可能な場合
        if (target && target !== this.draggedLayer && target.getAttribute('draggable') === 'true') {
            // drag-overクラスを一旦すべて削除
            this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
            target.classList.add('drag-over'); // ドロップターゲットにハイライト
            e.dataTransfer.dropEffect = 'move';
        } else {
            e.dataTransfer.dropEffect = 'none'; // ドロップ不可
        }
    }

    /**
     * ドラッグリーブイベントを処理します。
     * @param {DragEvent} e - ドラッグイベントオブジェクト
     */
    handleDragLeave(e) {
         const target = e.target.closest('.layer-item');
         if (target) {
            target.classList.remove('drag-over'); // ハイライトを削除
         }
    }

    /**
     * ドロップイベントを処理し、レイヤーの順序を変更します。
     * @param {DragEvent} e - ドラッグイベントオブジェクト
     */
    handleDrop(e) {
        e.preventDefault();
        const dropTarget = e.target.closest('.layer-item');
        // ドロップターゲットが無効、ドラッグ中のレイヤーがない、または自身にドロップしようとした場合
        if (!dropTarget || !this.draggedLayer || dropTarget === this.draggedLayer) {
            return;
        }

        // DOM上でのUI要素の移動
        // dropTargetの手前にdraggedLayerを挿入
        this.layerList.insertBefore(this.draggedLayer, dropTarget);
        
        // `layers` 配列の並び替え
        const draggedId = this.draggedLayer.dataset.layerId;
        const targetId = dropTarget.dataset.layerId;

        const draggedIndex = this.layers.findIndex(l => l.id === draggedId);
        const targetIndex = this.layers.findIndex(l => l.id === targetId);

        // 配列からドラッグされた要素を削除し、ターゲットの位置に挿入
        const [draggedItem] = this.layers.splice(draggedIndex, 1);
        this.layers.splice(targetIndex, 0, draggedItem);
        
        this.updateZIndex(); // z-indexを更新して表示順を反映
    }
    
    /**
     * ドラッグ終了イベントを処理します。
     * @param {DragEvent} e - ドラッグイベントオブジェクト
     */
    handleDragEnd(e) {
        if (this.draggedLayer) {
            this.draggedLayer.classList.remove('dragging'); // 半透明状態を解除
        }
        // 全てのドラッグオーバーハイライトを解除
        this.layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
        this.draggedLayer = null; // ドラッグ状態をリセット
    }
}
