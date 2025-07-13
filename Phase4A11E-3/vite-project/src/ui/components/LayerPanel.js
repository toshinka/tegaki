/**
 * [クラス責務] LayerPanel.js
 * 目的：レイヤーパネルUIの表示とイベント処理を担当する。
 * 旧LayerUIManagerの責務を引き継ぐ。
 */
export class LayerPanel {
    constructor({ layerStore, layerActions }) {
        this.layerStore = layerStore;
        this.layerActions = layerActions;
        this.container = document.getElementById('layer-list');
        
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('add-layer-btn')?.addEventListener('click', () => this.layerActions.addLayer());
        document.getElementById('delete-layer-btn')?.addEventListener('click', () => this.layerActions.deleteActiveLayer());
        document.getElementById('duplicate-layer-btn')?.addEventListener('click', () => this.layerActions.duplicateActiveLayer());
        document.getElementById('merge-layer-btn')?.addEventListener('click', () => this.layerActions.mergeDownActiveLayer());
        
        this.container?.addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem || e.target.closest('.layer-controls')) return;
            const index = parseInt(layerItem.dataset.index, 10);
            this.layerActions.switchLayer(index);
        });

        this.container?.addEventListener('input', (e) => {
            const target = e.target;
            const layerItem = target.closest('.layer-item');
            if (!layerItem) return;

            const index = parseInt(layerItem.dataset.index, 10);
            if (target.matches('.opacity-slider')) {
                this.layerActions.updateLayerProperties(index, { opacity: parseInt(target.value, 10) });
            }
        });

        this.container?.addEventListener('change', (e) => {
            const target = e.target;
            const layerItem = target.closest('.layer-item');
            if (!layerItem) return;

            const index = parseInt(layerItem.dataset.index, 10);
            if (target.matches('.blend-mode-select')) {
                this.layerActions.updateLayerProperties(index, { blendMode: target.value });
            }
        });
    }

    render({ layers, activeLayerIndex }) {
        if (!this.container) return;
        this.container.innerHTML = '';
        const blendModes = { 'normal': '通常', 'multiply': '乗算', 'screen': 'スクリーン' };

        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.dataset.index = i;
            if (i === activeLayerIndex) item.classList.add('active');
            
            // This is a simplified version of the original DOM creation logic
            item.innerHTML = `
                <span class="layer-name">${layer.name}</span>
                <div class="layer-controls">
                    <div class="opacity-control">
                        <span>不透明度: <span class="opacity-value">${layer.opacity}</span>%</span>
                        <input type="range" min="0" max="100" value="${layer.opacity}" class="opacity-slider">
                    </div>
                    <div class="blend-control">
                        <select class="blend-mode-select">
                            ${Object.entries(blendModes).map(([key, value]) => 
                                `<option value="${key}" ${key === layer.blendMode ? 'selected' : ''}>${value}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            `;
            this.container.appendChild(item);
        }
    }
}