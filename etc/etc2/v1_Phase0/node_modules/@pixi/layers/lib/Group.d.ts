import { utils } from '@pixi/core';
import type { DisplayObject } from '@pixi/display';
import type { Layer } from './Layer';
import type { Stage } from './Stage';
/**
 * A context for z-ordering {@link PIXI.DisplayObject}s within the same {@link Layer}.
 * @memberof PIXI.layers
 */
export declare class Group extends utils.EventEmitter {
    static _layerUpdateId: number;
    /** See {@link Layer#useRenderTexture} */
    useRenderTexture: boolean;
    /** See {@link Layer#useDoubleBuffer} */
    useDoubleBuffer: boolean;
    /**
     * Groups with a non-zero sort priority are sorted first.
     *
     * Unsure of the exact purpose yet :)
     */
    sortPriority: number;
    /** See {@link Layer#clearColor} */
    clearColor: ArrayLike<number>;
    canDrawWithoutLayer: boolean;
    canDrawInParentStage: boolean;
    /** Default zIndex value for layers that are created with this Group */
    zIndex: number;
    /** Enabling sorting objects within this group by {@link PIXI.DisplayObject#zOrder zOrder}. */
    enableSort: boolean;
    private _activeLayer;
    private _activeStage;
    /** @private */
    _activeChildren: Array<DisplayObject>;
    private _lastUpdateId;
    /**
     * @param zIndex - The z-index for the entire group.
     * @param sorting - This will enable sorting by z-order. You can also pass a callback that will assign
     *  the z-index _before_ sorting. This is useful, for example, when you want to sort by "y" - the callback
     *  can then set the {@link PIXI.DisplayObject#zOrder zOrder} to the y-coordinate. This callback is invoked
     *  as an event-listener to the {@link Group#sort} event.
     */
    constructor(zIndex?: number, sorting?: boolean | ((displayObject: DisplayObject) => void));
    doSort(layer: Layer, sorted: Array<DisplayObject>): void;
    private static compareZIndex;
    /**
     * clears temporary variables
     */
    private clear;
    /**
     * Resolve a child {@link PIXI.DisplayObject} that is set to be in this group.
     *
     * This is an **internal** method.
     *
     * @see Stage#updateStage
     * @private
     */
    _resolveChildDisplayObject(stage: Stage, displayObject: DisplayObject): void;
    /**
     * Resolve the layer rendering this group of {@link DisplayObject display objects}.
     *
     * This is an **internal** method.
     *
     * @see Layer#_onBeginLayerSubtreeTraversal
     * @private
     */
    _resolveLayer(stage: Stage, layer: Layer): void;
    private check;
    private static _lastLayerConflict;
    /** Log a conflict that occurs when multiple layers render the same group. */
    private static conflict;
}
