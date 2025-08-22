import { DisplayObject, Container } from '@pixi/display';

function generateLayerContainerRenderMethod(originalRender) {
  return function render(renderer) {
    if (this._activeParentLayer && this._activeParentLayer !== renderer._activeLayer) {
      return;
    }
    if (!this.visible) {
      this.displayOrder = 0;
      return;
    }
    this.displayOrder = renderer.incDisplayOrder();
    if (this.worldAlpha <= 0 || !this.renderable) {
      return;
    }
    renderer._activeLayer = null;
    originalRender.call(this, renderer);
    renderer._activeLayer = this._activeParentLayer;
  };
}
function containerRender(renderer) {
  if (this._activeParentLayer && this._activeParentLayer !== renderer._activeLayer) {
    return;
  }
  if (!this.visible) {
    this.displayOrder = 0;
    return;
  }
  this.displayOrder = renderer.incDisplayOrder();
  if (this.worldAlpha <= 0 || !this.renderable) {
    return;
  }
  renderer._activeLayer = null;
  this.containerRenderWebGL(renderer);
  renderer._activeLayer = this._activeParentLayer;
}
function applyDisplayMixin() {
  if (DisplayObject.prototype.displayOrder !== void 0) {
    return;
  }
  Object.assign(DisplayObject.prototype, {
    parentLayer: null,
    _activeParentLayer: null,
    parentGroup: null,
    zOrder: 0,
    zIndex: 0,
    updateOrder: 0,
    displayOrder: 0,
    layerableChildren: true,
    isLayer: false
  });
  const ContainerProto = Container.prototype;
  ContainerProto.containerRenderWebGL = ContainerProto.render;
  ContainerProto.render = containerRender;
}
function applyContainerRenderMixin(CustomRenderContainer) {
  if (CustomRenderContainer.originalRenderWebGL) {
    return;
  }
  CustomRenderContainer.originalRenderWebGL = CustomRenderContainer.render;
  CustomRenderContainer.render = generateLayerContainerRenderMethod(CustomRenderContainer.render);
  if (CustomRenderContainer.renderCanvas) {
    CustomRenderContainer.originalRenderWebGL = CustomRenderContainer.renderCanvas;
    CustomRenderContainer.renderCanvas = generateLayerContainerRenderMethod(CustomRenderContainer.renderCanvas);
  }
}
function applyParticleMixin(ParticleContainer) {
  ParticleContainer.prototype.layerableChildren = false;
  applyContainerRenderMixin(ParticleContainer.prototype);
}

export { applyContainerRenderMixin, applyDisplayMixin, applyParticleMixin, generateLayerContainerRenderMethod };
//# sourceMappingURL=DisplayMixin.mjs.map
