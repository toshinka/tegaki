/**
 * ============================================================================
 * ファイル名: system/drawing/eyedropper-tool.js
 * 責務: キャンバス上のピクセル色を取得（スポイト）し、現在色へ反映する
 * 依存: pixi.js, system/event-bus.js, system/drawing/brush-settings.js
 * 被依存: core-engine.js
 * ============================================================================
 */

import { RenderTexture, Matrix } from 'pixi.js';
import { TegakiEventBus } from '../event-bus.js';

export class EyedropperTool {
    constructor() {
        this.eventBus = TegakiEventBus;
        this.isActive = false;
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;
        this._setupEventListeners();
        this.initialized = true;
    }

    _setupEventListeners() {
        if (!this.eventBus) return;

        const syncActiveTool = (event = {}) => {
            const mode = event?.data?.mode || event?.data?.tool || event?.mode || event?.tool;
            if (mode) {
                this.isActive = (mode === 'eyedropper');
            }
        };

        this.eventBus.on('brush:mode-changed', syncActiveTool);
        this.eventBus.on('tool:changed', syncActiveTool);
        this.eventBus.on('tool:select', syncActiveTool);
        this.eventBus.on('ui:sidebar:sync-tool', syncActiveTool);

        this.eventBus.on('canvas:pointerdown', (event) => {
            if (!this.isActive) return;
            this.pickColor(event.localX, event.localY);
        });
    }

    async pickColor(localX, localY) {
        if (localX === undefined || localY === undefined) return;

        const layerManager = window.layerManager;
        const app = layerManager?.app;
        if (!layerManager || !app?.renderer) return;

        const container = layerManager.currentFrameContainer;
        if (!container) return;

        // 1x1 の一時テクスチャを作成して抽出
        const tempRT = RenderTexture.create({ width: 1, height: 1 });
        
        try {
            // 指定座標を原点 (0,0) に持ってくる行列
            const matrix = new Matrix();
            matrix.translate(-Math.floor(localX), -Math.floor(localY));
            
            // 1x1 の範囲にレンダリング
            app.renderer.render({
                container: container,
                target: tempRT,
                clear: true,
                clearColor: [0, 0, 0, 0],
                transform: matrix
            });

            // ピクセル抽出
            const result = app.renderer.extract.pixels({ target: tempRT });
            const pixels = result?.pixels || (result instanceof Uint8ClampedArray ? result : new Uint8ClampedArray(result?.buffer || result));

            if (pixels && pixels.length >= 4) {
                const r = pixels[0];
                const g = pixels[1];
                const b = pixels[2];
                const a = pixels[3];

                if (a === 0) {
                    // 透明なら背景色を拾う（本来はチェッカーも考慮すべきだが、一旦背景色固定）
                    const bgColor = window.TEGAKI_CONFIG?.background?.color || 0xf0e0d6;
                    if (window.brushSettings) {
                        window.brushSettings.setColor(bgColor);
                    }
                } else {
                    const colorHex = (r << 16) | (g << 8) | b;
                    if (window.brushSettings) {
                        window.brushSettings.setColor(colorHex);
                    }
                }
            }
        } catch (err) {
            console.error('❌ Eyedropper: Pick failed', err);
        } finally {
            tempRT.destroy(true);
        }
    }
}

export const eyedropperTool = new EyedropperTool();
window.EyedropperTool = eyedropperTool;
