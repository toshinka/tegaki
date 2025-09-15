'use strict';

var core = require('@pixi/core');
var display = require('@pixi/display');
var DisplayMixin = require('./DisplayMixin.js');

function generateLayerRendererMethod(_oldRender) {
  return function render(displayObject, options, arg1, arg2, arg3) {
    if (!options || !options.renderTexture && !options.baseTexture) {
      this._lastDisplayOrder = 0;
    }
    this._activeLayer = null;
    if (displayObject.isStage) {
      displayObject.updateStage();
    }
    _oldRender.call(this, displayObject, options, arg1, arg2, arg3);
  };
}
function applyRendererMixin(rendererClass) {
  const RendererProto = rendererClass.prototype;
  if (RendererProto._oldRender) {
    return;
  }
  Object.assign(RendererProto, {
    _lastDisplayOrder: 0,
    _activeLayer: null,
    incDisplayOrder() {
      return ++this._lastDisplayOrder;
    },
    _oldRender: core.Renderer.prototype.render
  });
  RendererProto._oldRender = RendererProto.render;
  RendererProto.render = generateLayerRendererMethod(RendererProto.render);
}
function applyCanvasMixin(canvasRenderClass) {
  if (!canvasRenderClass) {
    console.log("@pixi/layers: Canvas mixin was called with empty parameter. Are you sure that you even need this line?");
    return;
  }
  applyRendererMixin(canvasRenderClass);
  const ContainerProto = display.Container.prototype;
  if (ContainerProto.containerRenderCanvas) {
    return;
  }
  ContainerProto.containerRenderCanvas = ContainerProto.renderCanvas;
  ContainerProto.renderCanvas = DisplayMixin.generateLayerContainerRenderMethod(ContainerProto.renderCanvas);
}

exports.applyCanvasMixin = applyCanvasMixin;
exports.applyRendererMixin = applyRendererMixin;
//# sourceMappingURL=RendererMixin.js.map
