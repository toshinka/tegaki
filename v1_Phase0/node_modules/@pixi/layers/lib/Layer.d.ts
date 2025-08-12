import { Container } from '@pixi/display';
import { Group } from './Group';
import { Rectangle, RenderTexture, Renderer } from '@pixi/core';
import type { DisplayObject, IDestroyOptions } from '@pixi/display';
import type { Stage } from './Stage';
import type { ILayeredRenderer } from './RendererMixin';
/**
 * This manages the render-texture a {@link Layer} renders into.
 *
 * This is used internally by {@link Layer#render}.
 * @memberof PIXI.layers
 */
export declare class LayerTextureCache {
    layer: Layer;
    constructor(layer: Layer);
    private renderTexture;
    private doubleBuffer;
    private currentBufferIndex;
    _tempRenderTarget: RenderTexture;
    _tempRenderTargetSource: Rectangle;
    _tempRenderTargetDestination: Rectangle;
    private init;
    /** See {@link Layer#getRenderTexture}. */
    getRenderTexture(): RenderTexture;
    /** Prepares the layer's render-texture and set it as the render-target. */
    pushTexture(renderer: Renderer): void;
    /** Flushes the renderer and restores the old render-target. */
    popTexture(renderer: Renderer): void;
    /** Destroy the texture-cache. Set {@link Layer.textureCache} to {@code null} after destroying it! */
    destroy(): void;
}
/**
 * A {@link Layer layer} can be used to render {@link PIXI.DisplayObject}s in a different part of the scene graph together.
 *
 * A layer can be used to structure a scene graph in a data-oriented manner and separate the z-ordering hierarchy in
 * a different tree. Each layer is associated with a {@link Group} that provides the context for sorting objects
 * in the same layer.
 *
 * All layers must be placed underneath a {@link Stage} - generally, you should assign a {@link Stage} as your
 * scene's root.
 * @memberof PIXI.layers
 */
export declare class Layer extends Container {
    /** Flags that this container is a layer! */
    readonly isLayer = true;
    /** The group of {@link DisplayObject}s that are rendered within this layer */
    group: Group;
    /** The texture manager used when rendering into a {@link Layer#useRenderTexture layer render-texture}. */
    textureCache: LayerTextureCache;
    _activeChildren: Array<DisplayObject>;
    _tempChildren: Array<DisplayObject>;
    _activeStageParent: Stage;
    _sortedChildren: Array<DisplayObject>;
    _tempLayerParent: Layer;
    insertChildrenBeforeActive: boolean;
    insertChildrenAfterActive: boolean;
    /**
     * @param group - The group of {@link DisplayObject}s to be rendered by this layer.
     */
    constructor(group?: Group);
    /**
     * Flags whether this layer should render into a render-texture.
     *
     * This is useful if you want to use the layer as a texture elsewhere - for example, in sprites or to apply
     * filters. The layer's render-texture is resized to the size of the renderer's screen.
     */
    get useRenderTexture(): boolean;
    set useRenderTexture(value: boolean);
    /**
     * This will enable double buffering for this layer.
     *
     * This layer will keep two render-textures to render into - choosing one each frame on a flip-flop
     * basis. This is useful when you
     *
     * **Caveat**: You must enable {@link Layer#useRenderTexture} to prevent framebuffer errors in rendering.
     */
    get useDoubleBuffer(): boolean;
    set useDoubleBuffer(value: boolean);
    /**
     * The background color to clear the layer.
     *
     * This should be used when {@link Layer#useRenderTexture} is enabled.
     */
    get clearColor(): ArrayLike<number>;
    set clearColor(value: ArrayLike<number>);
    get sortPriority(): number;
    set sortPriority(value: number);
    /**
     * The rendering {@link Layer#useRenderTexture into a render-texture} is enabled, this will return
     * the render-texture used by this layer.
     */
    getRenderTexture(): RenderTexture;
    /**
     * you can override this method for this particular layer, if you want
     */
    doSort(): void;
    /** @override */
    destroy(options?: IDestroyOptions): void;
    /** @override */
    render(renderer: Renderer): void;
    /**
     * renderCanvas named this way because of some TS mixin problem
     * @param renderer
     */
    layerRenderCanvas(renderer: any): void;
    /**
     * This should be called when the layer is found while traversing the scene for updating object-layer association.
     *
     * This is an **internal** method.
     *
     * @see Stage#updateStage
     * @private
     */
    _onBeginLayerSubtreeTraversal(stage: Stage): void;
    /**
     * This should be called when the full subtree of the layer has been traversed while updating the stage's scene.
     *
     * This is an **internal** method.
     *
     * @see Stage#updateStage
     * @private
     */
    _onEndLayerSubtreeTraversal(): void;
    /**
     * Prepares the renderer for this layer.
     *
     * It will assign {@link PIXI.Renderer#_activeLayer} to {@code this}, and set the active layer before
     * this to {@link Layer#_activeParentLayer _activeParentLayer}. It will also temporarily sort the
     * children by z-order.
     *
     * @return `true`, if the layer needs to be rendered; `false`, when the layer is invisible or has
     * zero alpha.
     */
    protected prerender(renderer: ILayeredRenderer): boolean;
    /**
     * Cleans up the renderer after this layer is rendered.
     *
     * It restores {@link Renderer#_activeLayer} to the parent layer and restores the canonical
     * order of children.
     */
    protected postrender(renderer: ILayeredRenderer): void;
}
