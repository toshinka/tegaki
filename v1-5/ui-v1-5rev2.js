// ui.js
// v+ドラッグはv押下中のみレイヤー移動モード
// それ以外は全てキャンバス全体transform操作
// Shift+Hで上下反転も対応

class TopBarManager {
    constructor(app) {
        this.app = app;
        this.bindEvents();
        this.lastWheelTime = 0;
        this.wheelThrottle = 50;

    }
    bindEvents() {
        document.getElementById('undo-btn').addEventListener('click', () => this.app.canvasManager.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.app.canvasManager.redo());
        
        // ★ここを修正します。既存のcloseTool()ではなく、新しい転送&閉じる処理を呼び出します。
        document.getElementById('close-btn').addEventListener('click', () => this.transferAndCloseTool());

        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.title = 'アクティブレイヤーを消去 (Delete)';
            clearBtn.addEventListener('click', () => this.app.canvasManager.clearCanvas());

            const clearAllBtn = document.createElement('button');
            clearAllBtn.id = 'clear-all-btn';
            clearAllBtn.style.fontSize = "16px";
            clearAllBtn.style.padding = "0 4px";
            clearAllBtn.className = 'tool-btn';
            clearAllBtn.innerHTML = '🗑️*';
            clearAllBtn.title = '全レイヤーを消去 (Ctrl+Shift+Delete)'; // ツールチップを更新
            clearBtn.parentNode.insertBefore(clearAllBtn, clearBtn.nextSibling);
            clearAllBtn.addEventListener('click', () => {
                if (confirm('全てのレイヤーを消去します。よろしいですか？')) {
                    this.app.canvasManager.clearAllLayers();
                }
            });
        }

        // Spaceキー関連のイベントはCanvasManagerで処理されるため、ここでは不要。
        // Shift+H 反転もショートカットマネージャーで処理。
    }

    // 既存の closeTool() メソッドがある場合、その内容を確認し、以下のように変更するか、
    // この新しいメソッドに統合してください。
    // もし closeTool() が単に window.close() や iframe削除を親に求めるだけなら、
    // 以下のロジックを closeTool() に組み込む形でも良いです。
    // 例：元のcloseTool()が以下のような内容だった場合
    // closeTool() {
    //   window.parent.postMessage({type: 'closeTool'}, '*');
    // }
    // その場合、この transferAndCloseTool() がその役割も兼ねる。

    // ★追加: 描画内容を親フレームに転送してツールを閉じるメソッド
    transferAndCloseTool() {
        console.log('転送とツールの終了処理を開始します。');
        
        let mergedImageDataURL = null;
        try {
            // CanvasManagerに、全レイヤーを統合した画像をCanvasとして返すメソッドが必要です。
            // core-v1-5rev2.js に getMergedImageCanvas() を追加しています。
            const mergedCanvas = this.app.canvasManager.getMergedImageCanvas();
            if (mergedCanvas) {
                mergedImageDataURL = mergedCanvas.toDataURL('image/png');
                console.log('統合された画像データを取得しました。');
            } else {
                console.warn('統合画像のCanvasが取得できませんでした。');
            }
        } catch (e) {
            console.error('画像データ取得中にエラーが発生しました:', e);
            alert('描画データの取得中にエラーが発生しました。');
        }

        if (mergedImageDataURL) {
            // 親フレームに画像データを送信
            // 注意: targetOriginは、実際の二次元裏のオリジンに厳密に設定してください。
            // 例: window.parent.postMessage({ type: 'drawingData', data: mergedImageDataURL }, 'https://may.2chan.net');
            window.parent.postMessage({
                type: 'drawingData',
                data: mergedImageDataURL
            }, '*'); // 開発・テスト用に '*' を使用。本番では適切なオリジンを指定
            console.log('描画データを親フレームに送信しました。');
        } else {
            // 画像データがない場合、閉じるメッセージのみ送信
            window.parent.postMessage({
                type: 'closeTool'
            }, '*'); // 開発・テスト用に '*' を使用。本番では適切なオリジンを指定
            console.log('画像データなしで閉じるメッセージを親フレームに送信しました。');
        }

        // iframe自体は親フレームが閉じるので、ここでは何もしない。
        // もしここでiframeを閉じたい場合は以下のようにする
        // window.parent.document.getElementById('toshinka-tegaki-iframe')?.remove();
    }
}

class ShortcutManager {
    constructor(app) {
        this.app = app;
        this.activeKeys = new Set(); // 現在押されているキーを追跡
    }

    initialize() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleKeyDown(e) {
        this.activeKeys.add(e.key);

        // Ctrl + Z (Undo)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            this.app.canvasManager.undo();
        }
        // Ctrl + Shift + Z (Redo)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
            e.preventDefault();
            this.app.canvasManager.redo();
        }
        // Delete (アクティブレイヤーを消去)
        if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.app.canvasManager.clearCanvas();
        }
        // Ctrl + Shift + Delete (全レイヤーを消去)
        if (e.key === 'Delete' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault();
            if (confirm('全てのレイヤーを消去します。よろしいですか？')) {
                this.app.canvasManager.clearAllLayers();
            }
        }
        // Shift + H (左右反転)
        if (e.key === 'H' && e.shiftKey) {
            e.preventDefault();
            this.flipHorizontal();
        }
        // Shift + V (上下反転)
        if (e.key === 'V' && e.shiftKey) {
            e.preventDefault();
            this.flipVertical();
        }
        // Rキー (回転)
        if (e.key === 'r') {
            e.preventDefault();
            this.rotate90Degrees();
        }
        // Lキー (拡大)
        if (e.key === 'l') {
            e.preventDefault();
            this.scaleCanvas(1.1); // 10%拡大
        }
        // Sキー (縮小)
        if (e.key === 's') {
            e.preventDefault();
            this.scaleCanvas(0.9); // 10%縮小
        }
        // ↑ ↓ ← → (移動)
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.translateCanvas(0, -10);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.translateCanvas(0, 10);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.translateCanvas(-10, 0);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.translateCanvas(10, 0);
                break;
        }

        // Vキーを押したままで移動モード
        if (e.key === 'v') {
            document.body.style.cursor = 'move';
        }
    }

    handleKeyUp(e) {
        this.activeKeys.delete(e.key);

        // Vキーを離したらカーソルを元に戻す
        if (e.key === 'v') {
            this.app.canvasManager.updateCursor(); // ツールに応じたカーソルに戻す
        }
    }

    // キャンバスを左右反転
    flipHorizontal() {
        const matrix = this.app.canvasManager.matrix;
        const width = this.app.canvasManager.drawingCanvas.width;
        
        // 左右反転の行列: [-1, 0, 0, 1, width, 0]
        // 変換の中心をキャンバスの中心に設定
        const centerX = width / 2;
        
        let newMatrix = multiplyMatrix(matrix, [1, 0, 0, 1, -centerX, 0]); // 中心に移動
        newMatrix = multiplyMatrix(newMatrix, [-1, 0, 0, 1, width, 0]); // 反転 (width は反転後のオフセット)
        newMatrix = multiplyMatrix(newMatrix, [1, 0, 0, 1, centerX, 0]); // 元に戻す

        this.app.canvasManager.matrix = newMatrix;
        this.app.canvasManager.updateLayerTransforms(newMatrix);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveCanvasState();
    }

    // キャンバスを上下反転
    flipVertical() {
        const matrix = this.app.canvasManager.matrix;
        const height = this.app.canvasManager.drawingCanvas.height;

        // 上下反転の行列: [1, 0, 0, -1, 0, height]
        // 変換の中心をキャンバスの中心に設定
        const centerY = height / 2;

        let newMatrix = multiplyMatrix(matrix, [1, 0, 0, 1, 0, -centerY]); // 中心に移動
        newMatrix = multiplyMatrix(newMatrix, [1, 0, 0, -1, 0, height]); // 反転 (height は反転後のオフセット)
        newMatrix = multiplyMatrix(newMatrix, [1, 0, 0, 1, 0, centerY]); // 元に戻す

        this.app.canvasManager.matrix = newMatrix;
        this.app.canvasManager.updateLayerTransforms(newMatrix);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveCanvasState();
    }

    // キャンバスを90度回転
    rotate90Degrees() {
        const matrix = this.app.canvasManager.matrix;
        const width = this.app.canvasManager.drawingCanvas.width;
        const height = this.app.canvasManager.drawingCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const angle = Math.PI / 2; // 90度

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        let newMatrix = multiplyMatrix(matrix, [1, 0, 0, 1, -centerX, -centerY]); // 中心に移動
        newMatrix = multiplyMatrix(newMatrix, [cos, sin, -sin, cos, 0, 0]); // 回転
        
        // 回転後の中心位置を調整
        // 新しい中心座標 = transformPoint([cos, sin, -sin, cos, 0, 0], centerX, centerY)
        // const newCenterX = centerX * cos + centerY * (-sin);
        // const newCenterY = centerX * sin + centerY * cos;
        
        // 中心に戻す計算は、元の中心からの相対位置で行う
        newMatrix = multiplyMatrix(newMatrix, [1, 0, 0, 1, centerX, centerY]); // 元に戻す

        this.app.canvasManager.matrix = newMatrix;
        this.app.canvasManager.updateLayerTransforms(newMatrix);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveCanvasState();
    }

    // キャンバスを拡縮
    scaleCanvas(factor) {
        const matrix = this.app.canvasManager.matrix;
        const width = this.app.canvasManager.drawingCanvas.width;
        const height = this.app.canvasManager.drawingCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;

        let newMatrix = multiplyMatrix(matrix, [1, 0, 0, 1, -centerX, -centerY]); // 中心に移動
        newMatrix = multiplyMatrix(newMatrix, [factor, 0, 0, factor, 0, 0]); // 拡縮
        newMatrix = multiplyMatrix(newMatrix, [1, 0, 0, 1, centerX, centerY]); // 元に戻す

        this.app.canvasManager.matrix = newMatrix;
        this.app.canvasManager.updateLayerTransforms(newMatrix);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveCanvasState();
    }

    // キャンバスを移動
    translateCanvas(dx, dy) {
        const matrix = this.app.canvasManager.matrix;
        matrix[4] += dx;
        matrix[5] += dy;
        this.app.canvasManager.matrix = matrix; // 参照渡しなのでこれは不要だが念のため
        this.app.canvasManager.updateLayerTransforms(matrix);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveCanvasState();
    }
}


class LayerUIManager {
    constructor(app) {
        this.app = app;
        this.layerListContainer = document.getElementById('layer-list');
        this.addLayerBtn = document.getElementById('add-layer-btn');
        this.duplicateLayerBtn = document.getElementById('duplicate-layer-btn');
        this.mergeLayerBtn = document.getElementById('merge-layer-btn');
        this.deleteLayerBtn = document.getElementById('delete-layer-btn');
        
        this.bindEvents();
    }

    bindEvents() {
        this.addLayerBtn.addEventListener('click', () => this.app.layerManager.addLayer());
        this.duplicateLayerBtn.addEventListener('click', () => this.app.layerManager.duplicateLayer());
        this.mergeLayerBtn.addEventListener('click', () => this.app.layerManager.mergeLayer());
        this.deleteLayerBtn.addEventListener('click', () => this.app.layerManager.deleteLayer());

        this.layerListContainer.addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem) return;

            const index = parseInt(layerItem.dataset.index);

            // 表示/非表示の切り替え
            const visibilityToggle = e.target.closest('.layer-visibility-toggle');
            if (visibilityToggle) {
                this.app.layerManager.toggleLayerVisibility(index);
                return;
            }

            // 不透明度スライダーの操作
            const opacitySlider = e.target.closest('.layer-opacity-slider');
            if (opacitySlider) {
                // スライダーのイベントはinputイベントで別途処理
                return;
            }
            
            // レイヤーのアクティブ化
            this.app.layerManager.switchLayer(index);
        });

        // 不透明度スライダーの input イベントはレイヤーアイテムではなくスライダー自体に付けるべき
        this.layerListContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('layer-opacity-slider')) {
                const layerItem = e.target.closest('.layer-item');
                if (!layerItem) return;
                const index = parseInt(layerItem.dataset.index);
                const opacity = parseFloat(e.target.value);
                this.app.layerManager.setLayerOpacity(index, opacity);
            }
        });

        // ドラッグアンドドロップによるレイヤー順序変更
        let draggedItem = null;
        this.layerListContainer.addEventListener('dragstart', (e) => {
            draggedItem = e.target.closest('.layer-item');
            if (draggedItem) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedItem.dataset.index);
                setTimeout(() => {
                    draggedItem.classList.add('dragging');
                }, 0);
            }
        });

        this.layerListContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // dropを許可
            const targetItem = e.target.closest('.layer-item');
            if (targetItem && draggedItem && targetItem !== draggedItem) {
                const bounding = targetItem.getBoundingClientRect();
                const offset = bounding.y + (bounding.height / 2);
                if (e.clientY > offset) {
                    targetItem.style.borderBottom = '2px solid blue';
                    targetItem.style.borderTop = '';
                } else {
                    targetItem.style.borderTop = '2px solid blue';
                    targetItem.style.borderBottom = '';
                }
            }
        });

        this.layerListContainer.addEventListener('dragleave', (e) => {
            const targetItem = e.target.closest('.layer-item');
            if (targetItem) {
                targetItem.style.borderTop = '';
                targetItem.style.borderBottom = '';
            }
        });

        this.layerListContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetItem = e.target.closest('.layer-item');
            if (targetItem && draggedItem) {
                const toIndex = parseInt(targetItem.dataset.index);
                
                // borderスタイルをリセット
                targetItem.style.borderTop = '';
                targetItem.style.borderBottom = '';

                // ドラッグ要素のclassをリセット
                draggedItem.classList.remove('dragging');

                const bounding = targetItem.getBoundingClientRect();
                const offset = bounding.y + (bounding.height / 2);

                let actualToIndex = toIndex;
                if (e.clientY > offset && fromIndex < toIndex) {
                    actualToIndex = toIndex; // 下に挿入
                } else if (e.clientY <= offset && fromIndex > toIndex) {
                    actualToIndex = toIndex; // 上に挿入
                } else if (e.clientY > offset && fromIndex > toIndex) {
                    actualToIndex = toIndex + 1; // 下に移動
                } else if (e.clientY <= offset && fromIndex < toIndex) {
                    actualToIndex = toIndex - 1; // 上に移動
                }

                this.app.layerManager.moveLayer(fromIndex, actualToIndex);
            }
            draggedItem = null;
        });

        this.layerListContainer.addEventListener('dragend', (e) => {
            const layerItems = this.layerListContainer.querySelectorAll('.layer-item');
            layerItems.forEach(item => {
                item.classList.remove('dragging');
                item.style.borderTop = '';
                item.style.borderBottom = '';
            });
            draggedItem = null;
        });
    }

    renderLayers() {
        this.layerListContainer.innerHTML = ''; // Clear existing list
        const layers = this.app.layerManager.getLayers();
        const activeLayerIndex = this.app.layerManager.activeLayerIndex;

        // レイヤーを逆順に表示（上にあるレイヤーほどリストの上に来るように）
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.dataset.index = i; // インデックスは元の配列のものを保持
            item.draggable = true; // ドラッグ可能にする

            const visibilityToggle = document.createElement('span');
            visibilityToggle.className = 'layer-visibility-toggle';
            visibilityToggle.textContent = layer.visible ? '👁️' : '🚫';
            visibilityToggle.title = layer.visible ? '表示' : '非表示';
            item.appendChild(visibilityToggle);
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            item.appendChild(nameSpan);

            // 不透明度スライダー
            const opacitySlider = document.createElement('input');
            opacitySlider.type = 'range';
            opacitySlider.min = '0';
            opacitySlider.max = '1';
            opacitySlider.step = '0.01';
            opacitySlider.value = layer.opacity;
            opacitySlider.className = 'layer-opacity-slider';
            opacitySlider.title = '不透明度';
            item.appendChild(opacitySlider);

            if (i === activeLayerIndex) {
                item.classList.add('active');
            }
            this.layerListContainer.appendChild(item);
        }
    }
}


window.addEventListener('DOMContentLoaded', () => {
    if (window.toshinkaTegakiTool) {
        // 既存のマネージャーを初期化
        window.toshinkaTegakiTool.topBarManager = new TopBarManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager = new ShortcutManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager.initialize();

        // ★新しい LayerUIManager を初期化して、メインオブジェクトに登録
        window.toshinkaTegakiTool.layerUIManager = new LayerUIManager(window.toshinkaTegakiTool);
        
        // Coreの初期化処理から自動で呼ばれるため、ここでの呼び出しは不要
        window.toshinkaTegakiTool.layerUIManager.renderLayers();
        window.toshinkaTegakiTool.layerManager.switchLayer(window.toshinkaTegakiTool.layerManager.activeLayerIndex); 
        // ★テスト用のボタンに関する記述はすべて削除
        const testControls = document.getElementById('test-controls');
        if (testControls) {
            testControls.remove();
        }
    }
});