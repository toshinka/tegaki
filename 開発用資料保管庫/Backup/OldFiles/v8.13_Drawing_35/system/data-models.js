// ===== system/data-models.js - マスク実装完了版 =====
// 🔥 maskSpriteを不可視化してレンダリング防止

(function() {
    'use strict';

    const LAYER_SCHEMA = {
        id: { type: 'string', required: true, editable: false },
        name: { type: 'string', required: true, editable: true },
        visible: { type: 'boolean', default: true, editable: true },
        opacity: { type: 'number', min: 0, max: 1, default: 1.0, editable: true },
        isBackground: { type: 'boolean', default: false, editable: false },
        clipping: { type: 'boolean', default: false, editable: true },
        blendMode: { type: 'string', default: 'normal', editable: true },
        locked: { type: 'boolean', default: false, editable: true }
    };

    class LayerModel {
        constructor(data = {}) {
            this.id = data.id || `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.name = data.name || 'レイヤー';
            this.visible = data.visible !== undefined ? data.visible : true;
            this.opacity = data.opacity !== undefined ? data.opacity : 1.0;
            this.isBackground = data.isBackground || false;
            this.clipping = data.clipping || false;
            this.blendMode = data.blendMode || 'normal';
            this.locked = data.locked || false;
            this.paths = data.paths || [];
            
            this.maskTexture = null;
            this.maskSprite = null;
            this._maskInitialized = false;
        }

        static getSchema() {
            return LAYER_SCHEMA;
        }

        hasMask() {
            return this._maskInitialized && 
                   this.maskTexture !== null && 
                   this.maskSprite !== null;
        }

        initializeMask(width, height, renderer) {
            if (this._maskInitialized) {
                this.destroyMask();
            }

            try {
                this.maskTexture = PIXI.RenderTexture.create({
                    width: width,
                    height: height
                });

                const whiteRect = new PIXI.Graphics();
                whiteRect.rect(0, 0, width, height);
                whiteRect.fill({ color: 0xFFFFFF });

                renderer.render({
                    container: whiteRect,
                    target: this.maskTexture,
                    clear: true
                });

                whiteRect.destroy({ children: true });

                this.maskSprite = new PIXI.Sprite(this.maskTexture);
                this.maskSprite.label = 'mask_sprite';
                
                // 🔥 マスクスプライト自体を不可視化（マスク機能は維持）
                this.maskSprite.renderable = false;

                this._maskInitialized = true;

                return true;

            } catch (error) {
                this.destroyMask();
                return false;
            }
        }

        destroyMask() {
            if (this.maskSprite) {
                try {
                    this.maskSprite.destroy({ children: true });
                } catch (e) {}
                this.maskSprite = null;
            }

            if (this.maskTexture) {
                try {
                    this.maskTexture.destroy(true);
                } catch (e) {}
                this.maskTexture = null;
            }

            this._maskInitialized = false;
        }

        toJSON() {
            return {
                id: this.id,
                name: this.name,
                visible: this.visible,
                opacity: this.opacity,
                isBackground: this.isBackground,
                clipping: this.clipping,
                blendMode: this.blendMode,
                locked: this.locked
            };
        }

        validate() {
            const errors = [];
            if (!this.id) errors.push('id is required');
            if (!this.name) errors.push('name is required');
            if (this.opacity < 0 || this.opacity > 1) errors.push('opacity must be 0-1');
            return { valid: errors.length === 0, errors };
        }
    }

    const CUT_SCHEMA = {
        id: { type: 'string', required: true, editable: false },
        name: { type: 'string', required: true, editable: true },
        duration: { type: 'number', min: 0.01, max: 10, default: 0.5, editable: true },
        visible: { type: 'boolean', default: true, editable: true },
        locked: { type: 'boolean', default: false, editable: true }
    };

    class CutModel {
        constructor(data = {}) {
            this.id = data.id || `cut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.name = data.name || 'CUT';
            this.duration = data.duration !== undefined ? data.duration : 0.5;
            this.visible = data.visible !== undefined ? data.visible : true;
            this.locked = data.locked || false;
        }

        static getSchema() {
            return CUT_SCHEMA;
        }

        toJSON() {
            return {
                id: this.id,
                name: this.name,
                duration: this.duration,
                visible: this.visible,
                locked: this.locked
            };
        }

        validate() {
            const errors = [];
            if (!this.id) errors.push('id is required');
            if (!this.name) errors.push('name is required');
            if (this.duration < 0.01 || this.duration > 10) {
                errors.push('duration must be 0.01-10');
            }
            return { valid: errors.length === 0, errors };
        }
    }

    const STROKE_SCHEMA = {
        points: { type: 'array', required: true, editable: false },
        isSingleDot: { type: 'boolean', default: false, editable: false },
        color: { type: 'number', required: true, editable: false },
        size: { type: 'number', min: 0.1, max: 500, required: true, editable: false },
        alpha: { type: 'number', min: 0, max: 1, default: 1.0, editable: false },
        layerId: { type: 'string', required: true, editable: false },
        tool: { type: 'string', default: 'pen', editable: false }
    };

    class StrokeData {
        constructor(data = {}) {
            this.points = data.points || [];
            this.isSingleDot = data.isSingleDot || false;
            this.color = data.color !== undefined ? data.color : 0x000000;
            this.size = data.size !== undefined ? data.size : 5;
            this.alpha = data.alpha !== undefined ? data.alpha : 1.0;
            this.layerId = data.layerId || '';
            this.tool = data.tool || 'pen';
            this.timestamp = data.timestamp || Date.now();
        }

        static getSchema() {
            return STROKE_SCHEMA;
        }

        toJSON() {
            return {
                points: this.points.map(p => ({
                    x: p.x,
                    y: p.y,
                    pressure: p.pressure,
                    time: p.time
                })),
                isSingleDot: this.isSingleDot,
                color: this.color,
                size: this.size,
                alpha: this.alpha,
                layerId: this.layerId,
                tool: this.tool,
                timestamp: this.timestamp
            };
        }

        validate() {
            const errors = [];
            if (!Array.isArray(this.points) || this.points.length === 0) {
                errors.push('points must be non-empty array');
            }
            if (this.color === undefined || this.color === null) {
                errors.push('color is required');
            }
            if (this.size <= 0 || this.size > 500) {
                errors.push('size must be 0.1-500');
            }
            if (this.alpha < 0 || this.alpha > 1) {
                errors.push('alpha must be 0-1');
            }
            if (!this.layerId) {
                errors.push('layerId is required');
            }
            return { valid: errors.length === 0, errors };
        }

        getTotalDistance() {
            if (this.points.length < 2) return 0;
            let dist = 0;
            for (let i = 1; i < this.points.length; i++) {
                const dx = this.points[i].x - this.points[i - 1].x;
                const dy = this.points[i].y - this.points[i - 1].y;
                dist += Math.sqrt(dx * dx + dy * dy);
            }
            return dist;
        }

        getBounds() {
            if (this.points.length === 0) {
                return { x: 0, y: 0, width: 0, height: 0 };
            }

            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;

            for (const point of this.points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }

            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        }
    }

    window.TegakiDataModels = {
        LayerModel,
        CutModel,
        StrokeData,
        LAYER_SCHEMA,
        CUT_SCHEMA,
        STROKE_SCHEMA
    };

})();

console.log('✅ data-models.js (マスクスプライト不可視版) loaded');