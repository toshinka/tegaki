/** @ignore */
export declare function generateLayerContainerRenderMethod(originalRender: any): (renderer: any) => void;
export declare function applyDisplayMixin(): void;
/** Apply mixin to your custom Container class (not needed if using built-in {@link PIXI.Container})
 * Call it for `myClass.prototype`, not for `myClass` !
 * */
export declare function applyContainerRenderMixin(CustomRenderContainer: any): void;
/** Apply mixin for particles */
export declare function applyParticleMixin(ParticleContainer: any): void;
