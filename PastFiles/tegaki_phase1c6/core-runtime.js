/**
 * ============================================================================
 * ファイル名: core-runtime.js
 * 責務: 外部APIレイヤー（レガシー互換性、他システムからのアクセス窓口）
 * 依存: core-engine.js, system/event-bus.js等
 * 被依存: ui-panels.js, keyboard-handler.js等
 * 公開API: CoreRuntime
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.CoreRuntime
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { TegakiEventBus } from './system/event-bus.js';

export const CoreRuntime = (function() {
    'use strict';

    return {
        get api() {
            const engine = window.coreEngine;
            if (!engine) return null;

            return {
                tool: {
                    get: () => engine.brushCore.getMode(),
                    set: (mode) => {
                        engine.brushCore.setMode(mode);
                        return true;
                    },
                    getSize: () => engine.brushSettings.getSize(),
                    setSize: (size) => engine.brushSettings.setSize(size),
                    getOpacity: () => engine.brushSettings.getOpacity(),
                    setOpacity: (opacity) => engine.brushSettings.setOpacity(opacity),
                    getColor: () => engine.brushSettings.getColor(),
                    setColor: (color) => engine.brushSettings.setColor(color)
                },
                layer: {
                    getLayers: () => engine.layerSystem.getLayers(),
                    getActive: () => engine.layerSystem.activeLayerIndex,
                    setActive: (index) => engine.layerSystem.setActiveLayer(index),
                    create: (name) => engine.layerSystem.createLayer(name),
                    delete: (index) => engine.layerSystem.deleteLayer(index),
                    setVisibility: (index, visible) => {
                        const layer = engine.layerSystem.getLayers()[index];
                        if (layer) {
                            layer.visible = visible;
                            if (layer.layerData) layer.layerData.visible = visible;
                            engine.layerSystem._emitPanelUpdateRequest();
                        }
                    },
                    setOpacity: (index, opacity) => engine.layerSystem.setLayerOpacity(index, opacity),
                    flipActiveLayer: (direction, bypass) => engine.layerSystem.flipActiveLayer(direction, bypass),
                    exitMoveMode: () => engine.layerSystem.exitLayerMoveMode()
                },
                camera: {
                    reset: () => engine.cameraSystem.resetCanvas(),
                    zoom: (level) => engine.cameraSystem.setZoom(level),
                    pan: (dx, dy) => engine.cameraSystem.pan(dx, dy),
                    resize: (w, h) => engine.cameraSystem.resizeCanvas(w, h)
                },
                history: {
                    undo: () => engine.history.undo(),
                    redo: () => engine.history.redo(),
                    canUndo: () => engine.history.canUndo(),
                    canRedo: () => engine.history.canRedo(),
                    clear: () => engine.history.clear()
                },
                export: {
                    png: (options) => window.exportManager?.export('png', options),
                    webp: (options) => window.exportManager?.export('webp', options),
                    psd: (options) => window.exportManager?.export('psd', options)
                }
            };
        },

        get internal() {
            const engine = window.coreEngine;
            if (!engine) return null;

            return {
                engine: engine,
                layerManager: engine.layerSystem,
                cameraSystem: engine.cameraSystem,
                drawingEngine: engine.drawingEngine,
                brushCore: engine.brushCore,
                eventBus: engine.eventBus
            };
        }
    };
})();

// 下位互換性のためにグローバルに登録
window.CoreRuntime = CoreRuntime;
