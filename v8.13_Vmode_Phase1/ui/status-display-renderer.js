// ===== ui/status-display-renderer.js - Phase4 =====
// 責務: ステータスパネルのDOM操作専用
// 規則: 座標・ズーム・回転などの表示更新を一元管理

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.StatusDisplayRenderer = class {
    constructor() {
        this.elements = {
            coordinates: null,
            zoomLevel: null,
            rotationLevel: null,
            canvasInfo: null,
            dprInfo: null,
            fps: null,
            historyInfo: null,
            currentTool: null,
            brushInfo: null
        };

        this.initializeElements();
    }

    /**
     * DOM要素をキャッシュ
     */
    initializeElements() {
        this.elements.coordinates = document.getElementById('coordinates');
        this.elements.zoomLevel = document.getElementById('zoom-level');
        this.elements.rotationLevel = document.getElementById('rotation-level');
        this.elements.canvasInfo = document.getElementById('canvas-info');
        this.elements.dprInfo = document.getElementById('dpr-info');
        this.elements.fps = document.getElementById('fps');
        this.elements.historyInfo = document.getElementById('history-info');
        this.elements.currentTool = document.getElementById('current-tool');
        this.elements.brushInfo = document.getElementById('brush-info');
    }

    /**
     * カメラ座標表示更新
     */
    updateCoordinates(data) {
        if (!data || !this.elements.coordinates) return;

        const { x, y } = data;
        this.elements.coordinates.textContent = `${Math.round(x)}, ${Math.round(y)}`;
    }

    /**
     * ズームレベル表示更新
     */
    updateZoomLevel(data) {
        if (!data || !this.elements.zoomLevel) return;

        const { scale } = data;
        const percentage = Math.round(parseFloat(scale) * 100);
        this.elements.zoomLevel.textContent = `${percentage}%`;
    }

    /**
     * 回転角度表示更新
     */
    updateRotationLevel(data) {
        if (!data || !this.elements.rotationLevel) return;

        const { rotation } = data;
        this.elements.rotationLevel.textContent = `${Math.round(rotation)}°`;
    }

    /**
     * カメラ情報を一括更新
     */
    updateCameraTransform(data) {
        this.updateCoordinates(data);
        this.updateZoomLevel(data);
        this.updateRotationLevel(data);
    }

    /**
     * キャンバスサイズ表示更新
     */
    updateCanvasInfo(width, height) {
        if (!this.elements.canvasInfo) return;

        this.elements.canvasInfo.textContent = `${width}×${height}px`;
    }

    /**
     * DPR（デバイスピクセルレシオ）表示更新
     */
    updateDPRInfo() {
        if (!this.elements.dprInfo) return;

        const dpr = (window.devicePixelRatio || 1).toFixed(1);
        this.elements.dprInfo.textContent = dpr;
    }

    /**
     * FPS表示更新
     */
    updateFPS(fps) {
        if (!this.elements.fps) return;

        this.elements.fps.textContent = Math.round(fps);
    }

    /**
     * 履歴情報表示更新
     */
    updateHistoryInfo(data) {
        if (!data || !this.elements.historyInfo) return;

        const { currentIndex, stackSize } = data;
        this.elements.historyInfo.textContent = `${currentIndex + 1}/${stackSize}`;
    }

    /**
     * 現在ツール表示更新
     */
    updateCurrentTool(tool) {
        if (!this.elements.currentTool) return;

        const toolNames = {
            'pen': 'ベクターペン',
            'eraser': '消しゴム',
            'gif-animation': 'GIFアニメーション'
        };

        this.elements.currentTool.textContent = toolNames[tool] || tool;
    }

    /**
     * ブラシ情報表示更新
     */
    updateBrushInfo(data) {
        if (!data || !this.elements.brushInfo) return;

        const { size, opacity } = data;
        const sizeStr = typeof size === 'number' ? size.toFixed(1) : 'N/A';
        const opacityStr = typeof opacity === 'number' ? (opacity * 100).toFixed(0) : 'N/A';

        this.elements.brushInfo.textContent = `${sizeStr}px / ${opacityStr}%`;
    }

    /**
     * 複数要素を初期化
     */
    initializeDisplay(config) {
        if (!config) return;

        this.updateCanvasInfo(config.canvas.width, config.canvas.height);
        this.updateDPRInfo();
        this.updateCurrentTool('pen');
        this.updateHistoryInfo({ currentIndex: 0, stackSize: 1 });
    }

    /**
     * すべての要素をリセット
     */
    reset() {
        Object.values(this.elements).forEach(el => {
            if (el) {
                el.textContent = '—';
            }
        });
    }

    /**
     * EventBusのリスナー設定（core-initializerで呼ぶ）
     */
    setupEventListeners() {
        if (!window.TegakiEventBus) return;

        const eventBus = window.TegakiEventBus;

        eventBus.on('camera:transform-changed', (data) => {
            this.updateCameraTransform(data);
        });

        eventBus.on('history:changed', (data) => {
            this.updateHistoryInfo(data);
        });

        eventBus.on('drawing:tool-changed', (data) => {
            if (data?.tool) {
                this.updateCurrentTool(data.tool);
            }
        });

        eventBus.on('drawing:brush-changed', (data) => {
            this.updateBrushInfo(data);
        });
    }
};