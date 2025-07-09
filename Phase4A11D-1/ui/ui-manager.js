// ui/ui-manager.js

export class TopBarManager {
    constructor(app) {
        this.app = app;
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('undo-btn').addEventListener('click', () => this.app.canvasManager.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.app.canvasManager.redo());
        document.getElementById('close-btn').addEventListener('click', () => this.closeTool());

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
            clearAllBtn.title = '全レイヤーを消去 (Ctrl+Shift+Delete)';
            clearBtn.parentNode.insertBefore(clearAllBtn, clearBtn.nextSibling);
            clearAllBtn.addEventListener('click', () => {
                if (confirm('すべてのレイヤーを消去しますか？\nこの操作は元に戻すのが難しい場合があります。')) {
                    this.app.canvasManager.clearAllLayers();
                }
            });
        }
        document.getElementById('flip-h-btn').addEventListener('click', () => this.app.canvasManager.flipHorizontal());
        document.getElementById('flip-v-btn').addEventListener('click', () => this.app.canvasManager.flipVertical());
        document.getElementById('zoom-in-btn').addEventListener('click', () => this.app.canvasManager.zoom(1.2));
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.app.canvasManager.zoom(1/1.2));
        document.getElementById('rotate-btn').addEventListener('click', () => this.app.canvasManager.rotate(15));
        document.getElementById('rotate-ccw-btn').addEventListener('click', () => this.app.canvasManager.rotate(-15));
        document.getElementById('reset-view-btn').addEventListener('click', () => this.app.canvasManager.resetView());
    }
    closeTool() {
        if (confirm('あうぅ…閉じるけど平気…？')) {
            window.close();
        }
    }
}

export class LayerUIManager {
    constructor(app) {
        this.app = app;
        this.layerListContainer = document.getElementById('layer-list');
        this.addBtn = document.getElementById('add-layer-btn');
        this.deleteBtn = document.getElementById('delete-layer-btn');
        this.duplicateBtn = document.getElementById('duplicate-layer-btn');
        this.mergeBtn = document.getElementById('merge-layer-btn');
        this.bindEvents();
    }

    bindEvents() {
        this.addBtn.addEventListener('click', () => this.app.layerManager.addLayer());
        this.deleteBtn.addEventListener('click', () => this.app.layerManager.deleteActiveLayer());
        this.duplicateBtn.addEventListener('click', () => this.app.layerManager.duplicateActiveLayer());
        this.mergeBtn.addEventListener('click', () => this.app.layerManager.mergeDownActiveLayer());
        
        // ★★★ 修正箇所: イベント処理を集約(イベントデリゲーション) ★★★
        this.layerListContainer.addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (layerItem && layerItem.dataset.index) {
                const index = parseInt(layerItem.dataset.index, 10);
                if (e.target.closest('.layer-controls')) {
                    // UIコントロール部分のクリックは無視
                    return;
                }
                if (index !== this.app.layerManager.activeLayerIndex) {
                    this.app.layerManager.switchLayer(index);
                }
            }
        });

        // 不透明度スライダーの操作
        this.layerListContainer.addEventListener('input', (e) => {
            if (e.target.type === 'range' && e.target.classList.contains('opacity-slider')) {
                const index = parseInt(e.target.dataset.index, 10);
                const layer = this.app.layerManager.layers[index];
                if (layer) {
                    const newOpacity = parseInt(e.target.value, 10);
                    layer.opacity = newOpacity;
                    const valueSpan = e.target.closest('.layer-item').querySelector('.opacity-value');
                    if (valueSpan) {
                        valueSpan.textContent = newOpacity;
                    }
                    this.app.canvasManager.renderAllLayers();
                }
            }
        });

        // ブレンドモードの変更
        this.layerListContainer.addEventListener('change', (e) => {
            if (e.target.tagName === 'SELECT' && e.target.classList.contains('blend-mode-select')) {
                 const index = parseInt(e.target.dataset.index, 10);
                 const layer = this.app.layerManager.layers[index];
                 if (layer) {
                     layer.blendMode = e.target.value;
                     this.app.canvasManager.renderAllLayers();
                 }
            }
        });
    }

    renderLayers() {
        if (!this.layerListContainer) return;
        this.layerListContainer.innerHTML = '';
        const layers = this.app.layerManager.layers;
        const activeLayerIndex = this.app.layerManager.activeLayerIndex;

        // ★★★ 修正箇所: UI要素（不透明度・ブレンド）を追加 ★★★
        const blendModes = {
            'normal': '通常', 'multiply': '乗算', 'screen': 'スクリーン',
            'overlay': 'オーバーレイ', 'darken': '比較(暗)', 'lighten': '比較(明)',
            'color-dodge': '覆い焼きカラー', 'color-burn': '焼き込みカラー',
            'hard-light': 'ハードライト', 'soft-light': 'ソフトライト',
            'difference': '差の絶対値', 'exclusion': '除外',
            'hue': '色相', 'saturation': '彩度', 'color': 'カラー', 'luminosity': '輝度'
        };

        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.dataset.index = i;

            if (i === activeLayerIndex) {
                item.classList.add('active');
            }
            
            // --- レイヤー名 ---
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            item.appendChild(nameSpan);

            // --- UIコントロール (背景レイヤー以外) ---
            if (i > 0) {
                const controls = document.createElement('div');
                controls.className = 'layer-controls';

                // 不透明度スライダー
                const opacityContainer = document.createElement('div');
                opacityContainer.className = 'opacity-control';
                opacityContainer.innerHTML = `<span>不透明度: <span class="opacity-value">${layer.opacity}</span>%</span>`;
                const opacitySlider = document.createElement('input');
                opacitySlider.type = 'range';
                opacitySlider.min = 0;
                opacitySlider.max = 100;
                opacitySlider.value = layer.opacity;
                opacitySlider.dataset.index = i;
                opacitySlider.className = 'opacity-slider';
                opacityContainer.appendChild(opacitySlider);
                controls.appendChild(opacityContainer);

                // ブレンドモード選択
                const blendContainer = document.createElement('div');
                blendContainer.className = 'blend-control';
                const blendSelect = document.createElement('select');
                blendSelect.dataset.index = i;
                blendSelect.className = 'blend-mode-select';
                for (const [key, value] of Object.entries(blendModes)) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = value;
                    if (key === layer.blendMode) {
                        option.selected = true;
                    }
                    blendSelect.appendChild(option);
                }
                blendContainer.appendChild(blendSelect);
                controls.appendChild(blendContainer);
                
                item.appendChild(controls);
            }

            this.layerListContainer.appendChild(item);
        }
    }
}