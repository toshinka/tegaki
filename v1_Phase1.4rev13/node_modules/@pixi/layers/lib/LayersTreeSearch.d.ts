import { Point } from '@pixi/core';
import { DisplayObject } from '@pixi/display';
/**
 * @mixin
 */
export declare class LayersTreeSearch {
    _tempPoint: Point;
    _queue: DisplayObject[][];
    _eventDisplayOrder: number;
    worksWithLayers: boolean;
    recursiveFindHit(point: Point, displayObject: any, hitTestOrder: number, interactive: boolean, outOfMask: boolean): number;
    findHit(interactionEvent: any, displayObject: DisplayObject, func: any, hitTest: boolean): void;
    _startInteractionProcess(): void;
    _queueAdd(displayObject: DisplayObject, order: number): void;
    _finishInteractionProcess(event: any, func: any): void;
}
