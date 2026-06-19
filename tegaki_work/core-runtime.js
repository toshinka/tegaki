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
                        engine.pixelSelectionSystem?.setToolActive?.(false);
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
                selection: {
                    getState: () => engine.pixelSelectionSystem?.getState?.() || null,
                    getBoundsForLayer: (layerId) =>
                        engine.pixelSelectionSystem?.getBoundsForLayer?.(layerId) || null,
                    hasSelection: () => engine.pixelSelectionSystem?.hasSelection?.() === true,
                    setToolActive: (active) => engine.pixelSelectionSystem?.setToolActive?.(active) === true,
                    selectAll: () => engine.pixelSelectionSystem?.selectAll?.() === true,
                    requestTransform: () => engine.pixelSelectionSystem?.requestTransform?.() === true,
                    confirmTransform: () =>
                        engine.pixelSelectionSystem?.confirmTransform?.() === true,
                    cancelTransform: () =>
                        engine.pixelSelectionSystem?.cancelTransform?.('api') === true,
                    paste: () => engine.pixelSelectionSystem?.pasteSelection?.() === true,
                    getTransform: () => engine.pixelSelectionSystem?.getTransform?.() || null,
                    updateTransform: (property, value) =>
                        engine.pixelSelectionSystem?.updateTransform?.(property, value) === true,
                    flipTransform: (direction) =>
                        engine.pixelSelectionSystem?.flipTransform?.(direction) === true,
                    resetTransform: () =>
                        engine.pixelSelectionSystem?.resetTransform?.() === true,
                    constrainLayer: (layer, beforeSnapshot) =>
                        engine.pixelSelectionSystem?.constrainLayerToSelection?.(
                            layer,
                            beforeSnapshot
                        ) === true,
                    clear: () => engine.pixelSelectionSystem?.clearSelection?.('api') === true,
                    copy: () => engine.pixelSelectionSystem?.copySelection?.() === true,
                    delete: () => engine.pixelSelectionSystem?.deleteSelection?.() === true
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
                pixelSelectionSystem: engine.pixelSelectionSystem,
                brushCore: engine.brushCore,
                eventBus: engine.eventBus
            };
        }
    };
})();

// 下位互換性のためにグローバルに登録
window.CoreRuntime = CoreRuntime;
