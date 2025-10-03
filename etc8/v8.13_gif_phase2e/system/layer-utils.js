/**
 * LayerUtils - レイヤー操作ユーティリティ
 * 
 * 責務:
 * - レイヤー操作の補助関数群
 * - 座標系変換ユーティリティ
 * - Transform制御補助
 * 
 * 依存: PixiJS v8.13（グローバルPIXI）
 * 使用: LayerSystem, AnimationSystem
 */

window.LayerUtils = (() => {
    'use strict';

    // ========================================
    // レイヤー操作
    // ========================================

    /**
     * レイヤー内の全描画オブジェクトを削除
     * @param {PIXI.Container} layer - 対象レイヤー
     */
    function clearLayer(layer) {
        if (!layer || !(layer instanceof PIXI.Container)) {
            console.warn('[LayerUtils] clearLayer: Invalid layer', layer);
            return;
        }

        // 背景Graphics以外を削除（背景は layer.layerData?.backgroundGraphics）
        const bgGraphics = layer.layerData?.backgroundGraphics;
        const children = [...layer.children]; // コピーしてから削除

        children.forEach(child => {
            if (child !== bgGraphics) {
                layer.removeChild(child);
                if (child.destroy) {
                    child.destroy({ children: true });
                }
            }
        });
    }

    /**
     * Graphicsをレイヤーに追加
     * @param {PIXI.Container} layer - 対象レイヤー
     * @param {PIXI.Graphics} graphics - 追加するGraphics
     */
    function addGraphicsToLayer(layer, graphics) {
        if (!layer || !graphics) {
            console.warn('[LayerUtils] addGraphicsToLayer: Invalid arguments');
            return;
        }
        layer.addChild(graphics);
    }

    /**
     * Graphicsをレイヤーから削除
     * @param {PIXI.Container} layer - 対象レイヤー
     * @param {PIXI.Graphics} graphics - 削除するGraphics
     * @returns {boolean} 削除成功したか
     */
    function removeGraphicsFromLayer(layer, graphics) {
        if (!layer || !graphics) {
            console.warn('[LayerUtils] removeGraphicsFromLayer: Invalid arguments');
            return false;
        }

        if (graphics.parent === layer) {
            layer.removeChild(graphics);
            return true;
        }
        return false;
    }

    // ========================================
    // 座標系変換
    // ========================================

    /**
     * グローバル座標をレイヤーローカル座標に変換
     * @param {PIXI.Container} layer - 対象レイヤー
     * @param {number} globalX - グローバルX座標
     * @param {number} globalY - グローバルY座標
     * @returns {{x: number, y: number}} ローカル座標
     */
    function toLocalCoordinates(layer, globalX, globalY) {
        if (!layer) {
            console.warn('[LayerUtils] toLocalCoordinates: Invalid layer');
            return { x: globalX, y: globalY };
        }

        const point = new PIXI.Point(globalX, globalY);
        const local = layer.toLocal(point);
        return { x: local.x, y: local.y };
    }

    /**
     * レイヤーローカル座標をグローバル座標に変換
     * @param {PIXI.Container} layer - 対象レイヤー
     * @param {number} localX - ローカルX座標
     * @param {number} localY - ローカルY座標
     * @returns {{x: number, y: number}} グローバル座標
     */
    function toGlobalCoordinates(layer, localX, localY) {
        if (!layer) {
            console.warn('[LayerUtils] toGlobalCoordinates: Invalid layer');
            return { x: localX, y: localY };
        }

        const point = new PIXI.Point(localX, localY);
        const global = layer.toGlobal(point);
        return { x: global.x, y: global.y };
    }

    /**
     * スクリーン座標をレイヤー座標に変換
     * @param {PIXI.Container} layer - 対象レイヤー
     * @param {number} screenX - スクリーンX座標
     * @param {number} screenY - スクリーンY座標
     * @param {PIXI.Renderer} renderer - レンダラー
     * @returns {{x: number, y: number}} レイヤー座標
     */
    function screenToLayerCoordinates(layer, screenX, screenY, renderer) {
        if (!layer || !renderer) {
            console.warn('[LayerUtils] screenToLayerCoordinates: Invalid arguments');
            return { x: screenX, y: screenY };
        }

        // スクリーン座標→グローバル座標（Canvas基準）
        const rect = renderer.view.getBoundingClientRect();
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;

        // グローバル座標→レイヤーローカル座標
        return toLocalCoordinates(layer, canvasX, canvasY);
    }

    // ========================================
    // レイヤー制御
    // ========================================

    /**
     * レイヤー可視性設定
     * @param {PIXI.Container} layer - 対象レイヤー
     * @param {boolean} visible - 表示状態
     */
    function setLayerVisibility(layer, visible) {
        if (!layer) {
            console.warn('[LayerUtils] setLayerVisibility: Invalid layer');
            return;
        }
        layer.visible = visible;
    }

    /**
     * レイヤー不透明度設定
     * @param {PIXI.Container} layer - 対象レイヤー
     * @param {number} alpha - 不透明度 (0.0~1.0)
     */
    function setLayerOpacity(layer, alpha) {
        if (!layer) {
            console.warn('[LayerUtils] setLayerOpacity: Invalid layer');
            return;
        }
        layer.alpha = Math.max(0, Math.min(1, alpha));
    }

    /**
     * レイヤー可視性トグル
     * @param {PIXI.Container} layer - 対象レイヤー
     * @returns {boolean} 変更後の可視性
     */
    function toggleLayerVisibility(layer) {
        if (!layer) {
            console.warn('[LayerUtils] toggleLayerVisibility: Invalid layer');
            return false;
        }
        layer.visible = !layer.visible;
        return layer.visible;
    }

    // ========================================
    // 検索・取得
    // ========================================

    /**
     * ラベルでレイヤーを検索
     * @param {PIXI.Container} container - 検索対象Container
     * @param {string} label - 検索するラベル
     * @returns {PIXI.Container|null} 見つかったレイヤー
     */
    function findLayerByLabel(container, label) {
        if (!container || !label) {
            return null;
        }

        for (const child of container.children) {
            if (child.label === label) {
                return child;
            }
        }
        return null;
    }

    /**
     * 描画可能なレイヤー一覧を取得（背景以外）
     * @param {PIXI.Container} container - 対象Container
     * @returns {Array<PIXI.Container>} レイヤー配列
     */
    function getAllDrawableLayers(container) {
        if (!container) {
            return [];
        }

        return container.children.filter(layer => {
            return layer.layerData && !layer.layerData.isBackground;
        });
    }

    /**
     * インデックスでレイヤーを取得
     * @param {PIXI.Container} container - 対象Container
     * @param {number} index - レイヤーインデックス
     * @returns {PIXI.Container|null} レイヤー
     */
    function getLayerAtIndex(container, index) {
        if (!container || index < 0 || index >= container.children.length) {
            return null;
        }
        return container.children[index];
    }

    // ========================================
    // Transform補助
    // ========================================

    /**
     * レイヤーのTransform情報を取得
     * @param {PIXI.Container} layer - 対象レイヤー
     * @returns {Object} Transform情報
     */
    function getLayerTransform(layer) {
        if (!layer) {
            return null;
        }

        return {
            x: layer.position.x,
            y: layer.position.y,
            rotation: layer.rotation,
            scaleX: layer.scale.x,
            scaleY: layer.scale.y,
            pivotX: layer.pivot.x,
            pivotY: layer.pivot.y
        };
    }

    /**
     * レイヤーにTransform情報を設定
     * @param {PIXI.Container} layer - 対象レイヤー
     * @param {Object} transform - Transform情報
     */
    function setLayerTransform(layer, transform) {
        if (!layer || !transform) {
            console.warn('[LayerUtils] setLayerTransform: Invalid arguments');
            return;
        }

        if (transform.x !== undefined) layer.position.x = transform.x;
        if (transform.y !== undefined) layer.position.y = transform.y;
        if (transform.rotation !== undefined) layer.rotation = transform.rotation;
        if (transform.scaleX !== undefined) layer.scale.x = transform.scaleX;
        if (transform.scaleY !== undefined) layer.scale.y = transform.scaleY;
        if (transform.pivotX !== undefined) layer.pivot.x = transform.pivotX;
        if (transform.pivotY !== undefined) layer.pivot.y = transform.pivotY;
    }

    /**
     * レイヤーのTransformをリセット
     * @param {PIXI.Container} layer - 対象レイヤー
     */
    function resetLayerTransform(layer) {
        if (!layer) {
            console.warn('[LayerUtils] resetLayerTransform: Invalid layer');
            return;
        }

        layer.position.set(0, 0);
        layer.rotation = 0;
        layer.scale.set(1, 1);
        layer.pivot.set(0, 0);
    }

    // ========================================
    // 公開API
    // ========================================

    return {
        // レイヤー操作
        clearLayer,
        addGraphicsToLayer,
        removeGraphicsFromLayer,

        // 座標系変換
        toLocalCoordinates,
        toGlobalCoordinates,
        screenToLayerCoordinates,

        // レイヤー制御
        setLayerVisibility,
        setLayerOpacity,
        toggleLayerVisibility,

        // 検索・取得
        findLayerByLabel,
        getAllDrawableLayers,
        getLayerAtIndex,

        // Transform補助
        getLayerTransform,
        setLayerTransform,
        resetLayerTransform
    };
})();