// v1_Phase2/transform-manager.js
(function (global) {
    function TransformManager(rootContainer) {
        this.root = rootContainer; // PIXI.Container
        this.targets = {}; // id -> Container
    }

    TransformManager.prototype.register = function (id, container) {
        this.targets[id] = container;
    };

    TransformManager.prototype.get = function (id) {
        return this.targets[id] || null;
    };

    TransformManager.prototype.translate = function (id, dx, dy) {
        var t = this.get(id);
        if (!t) return;
        t.x += dx;
        t.y += dy;
    };

    TransformManager.prototype.scale = function (id, sx, sy) {
        var t = this.get(id);
        if (!t) return;
        t.scale.set(sx, sy);
    };

    TransformManager.prototype.rotate = function (id, radians) {
        var t = this.get(id);
        if (!t) return;
        t.rotation += radians;
    };

    TransformManager.prototype.setPivot = function (id, px, py) {
        var t = this.get(id);
        if (!t) return;
        t.pivot.set(px, py);
    };

    global.TransformManager = TransformManager;
})(this);
