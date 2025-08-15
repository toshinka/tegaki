'use strict';

var DisplayMixin = require('./DisplayMixin.js');
var RendererMixin = require('./RendererMixin.js');
var core = require('@pixi/core');
var Stage = require('./Stage.js');
var Layer = require('./Layer.js');
var Group = require('./Group.js');

DisplayMixin.applyDisplayMixin();
RendererMixin.applyRendererMixin(core.Renderer);

exports.applyContainerRenderMixin = DisplayMixin.applyContainerRenderMixin;
exports.applyDisplayMixin = DisplayMixin.applyDisplayMixin;
exports.applyParticleMixin = DisplayMixin.applyParticleMixin;
exports.applyCanvasMixin = RendererMixin.applyCanvasMixin;
exports.applyRendererMixin = RendererMixin.applyRendererMixin;
exports.Stage = Stage.Stage;
exports.Layer = Layer.Layer;
exports.LayerTextureCache = Layer.LayerTextureCache;
exports.Group = Group.Group;
//# sourceMappingURL=index.js.map
