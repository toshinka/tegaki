'use strict';

var Layer = require('./Layer.js');
var Group = require('./Group.js');

const _Stage = class extends Layer.Layer {
  constructor() {
    super(...arguments);
    /** Flags that this is a {@link Stage stage}! */
    this.isStage = true;
    this._tempGroups = [];
    /**
     * Found layers
     * @private
     */
    this._activeLayers = [];
    this._activeParentStage = null;
  }
  /**
   * clears all display lists that were used in last rendering session
   * please clear it when you stop using this displayList, otherwise you may have problems with GC in some cases
   */
  clear() {
    this._activeLayers.length = 0;
    this._tempGroups.length = 0;
  }
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  destroy(options) {
    this.clear();
    super.destroy(options);
  }
  /**
   * This should be called before rendering for resolving items in the scene tree to their {@link Layer layers}.
   *
   * If your scene's root is a {@link Stage}, then the {@link ILayerRenderer} mixin will automatically
   * call it.
   */
  updateStage() {
    this._activeParentStage = null;
    Group.Group._layerUpdateId++;
    this._updateStageInner();
  }
  updateAsChildStage(stage) {
    this._activeParentStage = stage;
    _Stage._updateOrderCounter = 0;
    this._updateStageInner();
  }
  _updateStageInner() {
    this.clear();
    this._addRecursive(this);
    const layers = this._activeLayers;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.group.sortPriority) {
        layer._onEndLayerSubtreeTraversal();
        const sorted = layer._sortedChildren;
        for (let j = 0; j < sorted.length; j++) {
          this._addRecursiveChildren(sorted[j]);
        }
      }
    }
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer.group.sortPriority) {
        layer._onEndLayerSubtreeTraversal();
      }
    }
  }
  _addRecursive(displayObject) {
    if (!displayObject.visible) {
      return;
    }
    if (displayObject.isLayer) {
      const layer2 = displayObject;
      this._activeLayers.push(layer2);
      layer2._onBeginLayerSubtreeTraversal(this);
    }
    if (displayObject !== this && displayObject.isStage) {
      const stage = displayObject;
      stage.updateAsChildStage(this);
      return;
    }
    displayObject._activeParentLayer = null;
    let group = displayObject.parentGroup;
    if (group) {
      group._resolveChildDisplayObject(this, displayObject);
    }
    const layer = displayObject.parentLayer;
    if (layer) {
      group = layer.group;
      group._resolveChildDisplayObject(this, displayObject);
    }
    displayObject.updateOrder = ++_Stage._updateOrderCounter;
    if (displayObject.alpha <= 0 || !displayObject.renderable || !displayObject.layerableChildren || group && group.sortPriority) {
      return;
    }
    const children = displayObject.children;
    if (children && children.length) {
      for (let i = 0; i < children.length; i++) {
        this._addRecursive(children[i]);
      }
    }
  }
  _addRecursiveChildren(displayObject) {
    if (displayObject.alpha <= 0 || !displayObject.renderable || !displayObject.layerableChildren) {
      return;
    }
    const children = displayObject.children;
    if (children && children.length) {
      for (let i = 0; i < children.length; i++) {
        this._addRecursive(children[i]);
      }
    }
  }
};
let Stage = _Stage;
Stage._updateOrderCounter = 0;

exports.Stage = Stage;
//# sourceMappingURL=Stage.js.map
