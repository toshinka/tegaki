'use strict';

var display = require('@pixi/display');

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
  if (display.DisplayObject.prototype.displayOrder !== void 0) {
    return;
  }
  Object.assign(display.DisplayObject.prototype, {
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
  const ContainerProto = display.Container.prototype;
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

exports.applyContainerRenderMixin = applyContainerRenderMixin;
exports.applyDisplayMixin = applyDisplayMixin;
exports.applyParticleMixin = applyParticleMixin;
exports.generateLayerContainerRenderMethod = generateLayerContainerRenderMethod;
//# sourceMappingURL=DisplayMixin.js.map
