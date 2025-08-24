'use strict';

var core = require('@pixi/core');

const _Group = class extends core.utils.EventEmitter {
  /**
   * @param zIndex - The z-index for the entire group.
   * @param sorting - This will enable sorting by z-order. You can also pass a callback that will assign
   *  the z-index _before_ sorting. This is useful, for example, when you want to sort by "y" - the callback
   *  can then set the {@link PIXI.DisplayObject#zOrder zOrder} to the y-coordinate. This callback is invoked
   *  as an event-listener to the {@link Group#sort} event.
   */
  constructor(zIndex = 0, sorting = false) {
    super();
    /** See {@link Layer#useRenderTexture} */
    this.useRenderTexture = false;
    /** See {@link Layer#useDoubleBuffer} */
    this.useDoubleBuffer = false;
    /**
     * Groups with a non-zero sort priority are sorted first.
     *
     * Unsure of the exact purpose yet :)
     */
    this.sortPriority = 0;
    /** See {@link Layer#clearColor} */
    this.clearColor = new Float32Array([0, 0, 0, 0]);
    // TODO: handle orphan groups
    // TODO: handle groups that don't want to be drawn in parent
    this.canDrawWithoutLayer = false;
    this.canDrawInParentStage = true;
    this._activeLayer = null;
    this._activeStage = null;
    /** @private */
    this._activeChildren = [];
    this._lastUpdateId = -1;
    this.zIndex = zIndex || 0;
    this.enableSort = !!sorting;
    if (typeof sorting === "function") {
      this.on("sort", sorting);
    }
  }
  doSort(layer, sorted) {
    if (this.listeners("sort", true)) {
      for (let i = 0; i < sorted.length; i++) {
        this.emit("sort", sorted[i]);
      }
    }
    sorted.sort(_Group.compareZIndex);
  }
  static compareZIndex(a, b) {
    if (a.zOrder < b.zOrder) {
      return -1;
    }
    if (a.zOrder > b.zOrder) {
      return 1;
    }
    return a.updateOrder - b.updateOrder;
  }
  /**
   * clears temporary variables
   */
  clear() {
    this._activeLayer = null;
    this._activeStage = null;
    this._activeChildren.length = 0;
  }
  /**
   * Resolve a child {@link PIXI.DisplayObject} that is set to be in this group.
   *
   * This is an **internal** method.
   *
   * @see Stage#updateStage
   * @private
   */
  _resolveChildDisplayObject(stage, displayObject) {
    this.check(stage);
    displayObject._activeParentLayer = this._activeLayer;
    if (this._activeLayer) {
      this._activeLayer._activeChildren.push(displayObject);
    } else {
      this._activeChildren.push(displayObject);
    }
  }
  /**
   * Resolve the layer rendering this group of {@link DisplayObject display objects}.
   *
   * This is an **internal** method.
   *
   * @see Layer#_onBeginLayerSubtreeTraversal
   * @private
   */
  _resolveLayer(stage, layer) {
    this.check(stage);
    if (this._activeLayer) {
      _Group.conflict();
    }
    this._activeLayer = layer;
    this._activeStage = stage;
  }
  check(stage) {
    if (this._lastUpdateId < _Group._layerUpdateId) {
      this._lastUpdateId = _Group._layerUpdateId;
      this.clear();
      this._activeStage = stage;
    } else if (this.canDrawInParentStage) {
      let current = this._activeStage;
      while (current && current !== stage) {
        current = current._activeParentStage;
      }
      this._activeStage = current;
      if (current === null) {
        this.clear();
      }
    }
  }
  /** Log a conflict that occurs when multiple layers render the same group. */
  static conflict() {
    if (_Group._lastLayerConflict + 5e3 < Date.now()) {
      _Group._lastLayerConflict = Date.now();
      console.log(`@pixi/layers found two layers with the same group in one stage - that's not healthy. Please place a breakpoint here and debug it`);
    }
  }
  /**
   * Fired for each {@link DisplayObject} in this group, right before they are sorted.
   *
   * @event sort
   * @param {PIXI.DisplayObject} object - The object that will be sorted.
   */
};
let Group = _Group;
Group._layerUpdateId = 0;
Group._lastLayerConflict = 0;

exports.Group = Group;
//# sourceMappingURL=Group.js.map
