import { IRenderableObject, IRendererRenderOptions, Renderer } from '@pixi/core';
import type { Layer } from './Layer';
/**
 * Mixin applied on {@link PIXI.Renderer} when using @pixi/layers.
 */
interface ILayeredRenderer {
    /** Order/index of last rendered object */
    _lastDisplayOrder: number;
    /** {@link Layer} currently being rendered */
    _activeLayer: Layer;
    /** **Internal** method for updating {@link ILayeredRenderer#_lastDisplayOrder} */
    incDisplayOrder(): number;
    /** **Internal** reference to old render method */
    _oldRender(displayObject: IRenderableObject, options?: IRendererRenderOptions): void;
}
export type { ILayeredRenderer };
/**
 * Mixes {@link ILayeredRenderer} into {@link PIXI.Renderer}.
 *
 * This is automatically done on importing @pixi/layers.
 */
export declare function applyRendererMixin(rendererClass: typeof Renderer): void;
/**
 * Mixes renderer mixin + container mixin for canvas.
 *
 * If you are using PixiJS' canvas renderer, you'll need to invoke this manually.
 *
 * @example
 * import { CanvasRenderer } from '@pixi/canvas-renderer';
 * import { applyCanvasMixin } from '@pixi/layers';
 *
 * applyCanvasMixin(CanvasRenderer);
 */
export declare function applyCanvasMixin(canvasRenderClass: any): void;
