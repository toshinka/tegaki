import { DisplayObject } from '@pixi/display';
import { Layer } from './Layer';
/**
 * The {@link Stage stage} manages all the layers in its scene tree.
 *
 * @memberof PIXI.layers
 */
export declare class Stage extends Layer {
    static _updateOrderCounter: number;
    /** Flags that this is a {@link Stage stage}! */
    readonly isStage = true;
    _tempGroups: Array<DisplayObject>;
    /**
     * Found layers
     * @private
     */
    _activeLayers: Array<Layer>;
    _activeParentStage: Stage;
    /**
     * clears all display lists that were used in last rendering session
     * please clear it when you stop using this displayList, otherwise you may have problems with GC in some cases
     */
    clear(): void;
    destroy(options?: any): void;
    /**
     * This should be called before rendering for resolving items in the scene tree to their {@link Layer layers}.
     *
     * If your scene's root is a {@link Stage}, then the {@link ILayerRenderer} mixin will automatically
     * call it.
     */
    updateStage(): void;
    private updateAsChildStage;
    private _updateStageInner;
    private _addRecursive;
    private _addRecursiveChildren;
}
