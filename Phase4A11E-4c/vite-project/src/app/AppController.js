import { Layer } from '../features/layers/LayerFactory.js';
import { LayerStore } from '../features/layers/LayerStore.js';
import { ToolStore } from '../features/tools/ToolStore.js';
import { HistoryStore } from '../features/history/HistoryStore.js';
import { PersistentStorage } from '../data/StorageService.js';
import { LayerRendererGL } from '../engine/WebGLRenderer.js'; 
import { CanvasViewport } from '../engine/CanvasViewport.js';
import { PointerInteractionHandler } from '../features/canvas/PointerInteractionHandler.js';
import { UIRoot } from '../ui/UIRoot.js';
import { LayerActions } from '../features/layers/LayerActions.js';
import { ToolActions } from '../features/tools/ToolActions.js';
import { KeyBindingController } from '../events/ShortcutHandler.js';

/**
 * [クラス責務] AppController.js
 * 目的：アプリケーション全体を統括し、各モジュール（Store, Engine, Service, UI）の初期化と連携を行う。
 * (変更後クラス名: AppBootstrap)
 */
// 変更: AppController -> AppBootstrap
export class AppBootstrap {
    constructor() {
        this.init();
    }

    async init() {
        console.log("🛠️ AppBootstrap: 初期化を開始します..."); // 変更: AppController -> AppBootstrap
        const canvas = document.getElementById('drawingCanvas');
        if (!canvas) {
            // NOTE: alertはCanvas環境で表示されないため、console.errorに変更
            console.error("致命的なエラー: 描画対象のCanvas要素が見つかりません。");
            return;
        }

        // --- 状態管理 (Stores) ---
        const layerStore = new LayerStore(Layer, canvas.width, canvas.height);
        const toolStore = new ToolStore();
        const historyStore = new HistoryStore({ layerStore });

        // --- 外部連携 (Services) ---
        const storageService = new PersistentStorage();

        // --- 描画エンジン (Engine) ---
        const renderer = new LayerRendererGL(canvas); // 変更: WebGLRenderer -> LayerRendererGL
        if (!renderer.isInitialized()) {
             console.error("お使いのブラウザはWebGLをサポートしていないか、有効になっていません。");
             return;
        }
        const viewport = new CanvasViewport(canvas, renderer);

        // --- ユーザー操作のロジック (Actions) ---
        const layerActions = new LayerActions(layerStore, viewport, historyStore);
        const toolActions = new ToolActions(toolStore);

        // --- 入力処理 (Handlers) ---
        new PointerInteractionHandler(canvas, {
            layerStore, toolStore, historyStore, viewport, layerActions, toolActions
        });
        
        // --- UIの統括 (UI Controller) ---
        new UIRoot({
            toolStore, layerStore, historyStore, viewport, layerActions, toolActions
        });
        
        // --- ショートカット処理 (Handler) ---
        new KeyBindingController({
            historyStore, viewport, toolActions, layerActions,
            // interactionインスタンスを渡す必要があったが、参照がなかったので直接渡す
            interaction: new PointerInteractionHandler(canvas, { layerStore, toolStore, historyStore, viewport, layerActions, toolActions })
        });

        // --- 描画完了時のデータ保存 ---
        // interaction.onDrawEnd は PointerInteractionHandler 内で直接管理されていないため、
        // この方法は機能しない。代わりに、適切なイベントバスやコールバック機構が必要（Phase 5以降）。
        // interaction.onDrawEnd = async (layer) => {
        //     if (!layer) return;
        //     await storageService.saveLayer(layer);
        // };
        
        // --- 起動時のデータ読み込み ---
        console.log("💾 IndexedDBからレイヤーデータの復元を試みます...");
        const storedLayers = await storageService.loadLayers(canvas.width, canvas.height, Layer);

        if (storedLayers && storedLayers.length > 0) {
            layerStore.setLayers(storedLayers);
            console.log(`✅ ${storedLayers.length}件のレイヤーをDBから復元しました。`);
        } else {
            console.log("DBにデータがないため、初期レイヤーを作成します。");
            await layerActions.setupInitialLayers();
        }

        // --- 初期状態の設定と描画 ---
        layerStore.notify();
        viewport.renderAllLayers(layerStore.getLayers());
        historyStore.saveState();

        // --- MODIFIED: Simple drawing test as requested in the instructions ---
        const activeLayer = layerStore.getCurrentLayer();
        if (activeLayer && renderer) {
            console.log("🧪 Running simple drawing test...");
            const s = renderer.SUPER_SAMPLING_FACTOR;
            // Draw a red circle in the center of the canvas
            renderer.drawCircle(
                canvas.width / 2 * s, 
                canvas.height / 2 * s,
                50 * s, // 円を大きくして視認性を向上
                { r: 255, g: 0, b: 0, a: 1.0 }, 
                false, 
                activeLayer
            );

            // 変更：syncDirtyRectToImageDataは表示テストには不要なためコメントアウト。
            // GPUへの描画から画面表示までのパイプラインを直接テストする。
            // const dirtyRect = { minX: 0, minY: 0, maxX: canvas.width * s, maxY: canvas.height * s};
            // renderer.syncDirtyRectToImageData(activeLayer, dirtyRect);
            
            // Re-render all layers to display the test circle
            viewport.renderAllLayers(layerStore.getLayers());
            console.log("✅ Simple drawing test complete. A red circle should be visible.");
        }
        // --- End of drawing test ---

        console.log("✅ AppBootstrap: アプリケーションの初期化が完了しました。"); // 変更: AppController -> AppBootstrap
    }
}
