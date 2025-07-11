/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 5.0.2 (Phase 4A11D-8 DOM Timing Hotfix)
 *
 * - 変更点 (Phase 4A11D-8 Hotfix):
 * - DOM構築前にCanvasManagerがcanvas要素を取得しようとして失敗する問題を修正。
 * - core-engine側で要素を明示的に取得し、CanvasManagerのコンストラクタに渡すように変更。
 * ===================================================================================
 */

// --- Library Imports ---
import { mat4 } from 'gl-matrix';
import * as twgl from 'twgl.js';
import Dexie from 'dexie';

// --- Module Imports ---
import { Layer } from './layer.js';
import { CanvasManager } from './canvas-manager.js';
import { LayerManager } from '../layer-manager/layer-manager.js';
import { ToolManager } from '../ui/tool-manager.js';
import { LayerUIManager, TopBarManager } from '../ui/ui-manager.js';
import { PenSettingsManager } from '../ui/pen-settings-manager.js';
import { ColorManager } from '../ui/color-manager.js';
import { ShortcutManager } from '../ui/shortcut-manager.js';
import { BucketTool } from '../tools/toolset.js';
import { saveLayerToIndexedDB, loadLayersFromIndexedDB } from '../db/db-indexed.js';

// --- Application Initialization ---
(async () => {
    if (window.toshinkaTegakiInitialized) return;
    window.toshinkaTegakiInitialized = true;

    console.log("🛠️ アプリケーションの初期化を開始します...");

    // --- DOM要素の取得 ---
    const canvas = document.getElementById('drawingCanvas');
    console.log("🖼️ Canvas取得結果:", canvas); // 指示書に基づきログを追加

    if (!canvas) {
        alert("致命的なエラー: 描画対象のCanvas要素が見つかりません。");
        return;
    }

    const app = {};
    app.glMatrix = { mat4 };
    app.twgl = twgl;
    app.Layer = Layer;

    // --- 各マネージャーのインスタンス化 ---
    // CanvasManagerに取得したcanvas要素を渡す
    app.canvasManager = new CanvasManager(app, canvas);
    app.layerManager = new LayerManager(app);
    app.toolManager = new ToolManager(app);
    app.layerUIManager = new LayerUIManager(app);
    app.penSettingsManager = new PenSettingsManager(app);
    app.colorManager = new ColorManager(app);
    app.topBarManager = new TopBarManager(app);
    app.shortcutManager = new ShortcutManager(app);
    app.bucketTool = new BucketTool(app);
    window.toshinkaTegakiTool = app;

    app.canvasManager.onDrawEnd = async (layer) => {
        if (!layer) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layer.imageData.width;
        tempCanvas.height = layer.imageData.height;
        tempCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
        const dataURL = tempCanvas.toDataURL();
        await saveLayerToIndexedDB(layer.id, layer.name, dataURL, Dexie);
    };

    console.log("💾 IndexedDBからレイヤーデータの復元を試みます...");
    const storedLayers = await loadLayersFromIndexedDB(Dexie);

    if (storedLayers && storedLayers.length > 0) {
        app.layerManager.layers = [];
        
        const loadPromises = storedLayers.map(layerData => {
            const layer = new Layer(layerData.name, app.canvasManager.width, app.canvasManager.height, layerData.id);
            app.layerManager.layers.push(layer);

            return new Promise((resolve, reject) => {
                if (!layerData.imageData) {
                    resolve();
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    const tempCtx = document.createElement('canvas').getContext('2d');
                    tempCtx.canvas.width = layer.imageData.width;
                    tempCtx.canvas.height = layer.imageData.height;
                    tempCtx.imageSmoothingEnabled = false;
                    tempCtx.drawImage(img, 0, 0);
                    layer.imageData = tempCtx.getImageData(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
                    layer.gpuDirty = true;
                    resolve();
                };
                img.onerror = reject;
                img.src = layerData.imageData;
            });
        });
        
        try {
            await Promise.all(loadPromises);
            console.log(`✅ ${storedLayers.length}件のレイヤーをDBから復元しました。`);
            app.layerManager.switchLayer(app.layerManager.layers.length - 1);
        } catch(error) {
             console.error("レイヤーの復元中にエラーが発生したため、初期状態で起動します。", error);
             await app.layerManager.setupInitialLayers();
        }
    } else {
        console.log("DBにデータがないため、初期レイヤーを作成します。");
        await app.layerManager.setupInitialLayers();
    }
    
    const initialLayer = app.layerManager.getCurrentLayer();
    if (initialLayer) {
        app.canvasManager.setCurrentLayer(initialLayer);
    }

    app.shortcutManager.initialize();
    app.layerUIManager.renderLayers?.();
    app.canvasManager.renderAllLayers();
    app.toolManager.setTool('pen');
    app.canvasManager.saveState();

    console.log("✅ アプリケーションの初期化が完了しました。");
})();