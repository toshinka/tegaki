/**
 * ============================================================
 * data-models.js - Phase B-1: ペン傾き対応版
 * ============================================================
 * 【親依存】
 *   - なし（最上位データモデル定義）
 * 
 * 【子依存】
 *   - layer-system.js
 *   - history.js
 *   - brush-core.js
 *   - stroke-recorder.js
 *   - timeline-ui.js
 * 
 * 【Phase B-1改修内容】
 * ✅ StrokeData.points に tiltX/tiltY/twist 追加
 * ✅ STROKE_SCHEMA拡張（傾き情報定義）
 * ✅ toJSON() 傾きシリアライズ対応
 * ✅ 後方互換性維持（傾き未定義時は0）
 * ============================================================
 */

(function() {
    'use strict';

    const LAYER_SCHEMA = {
        id: { type: 'string', required: true, editable: false },
        name: { type: 'string', required: true, editable: true },
        visible: { type: 'boolean', default: true, editable: true },
        opacity: { type: 'number', min: 0, max: 1, default: 1.0, editable: true },
        isBackground: { type: 'boolean', default: false, editable: false },
        backgroundColor: { type: 'number', default: 0xf0e0d6, editable: true },
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
            this.backgroundColor = data.backgroundColor !== undefined ? data.backgroundColor : 0xf0e0d6;
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
                backgroundColor: this.backgroundColor,
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

    /**
     * Phase B-1: STROKE_SCHEMA拡張
     * ペン傾き情報を追加
     */
    const STROKE_SCHEMA = {
        points: {
            type: 'array',
            required: true,
            editable: false,
            itemSchema: {
                x: 'number',
                y: 'number',
                pressure: 'number',
                time: 'number',
                tiltX: 'number',  // -1 〜 1
                tiltY: 'number',  // -1 〜 1
                twist: 'number'   // 0 〜 2π
            }
        },
        isSingleDot: { type: 'boolean', default: false, editable: false },
        color: { type: 'number', required: true, editable: false },
        size: { type: 'number', min: 0.1, max: 500, required: true, editable: false },
        alpha: { type: 'number', min: 0, max: 1, default: 1.0, editable: false },
        layerId: { type: 'string', required: true, editable: false },
        tool: { type: 'string', default: 'pen', editable: false }
    };

    /**
     * Phase B-1: StrokeData拡張
     * ペン傾き情報の完全対応
     */
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

        /**
         * Phase B-1: toJSON() 傾きシリアライズ対応
         * 後方互換性維持（傾き未定義時は0）
         */
        toJSON() {
            return {
                points: this.points.map(p => ({
                    x: p.x,
                    y: p.y,
                    pressure: p.pressure,
                    time: p.time,
                    tiltX: p.tiltX !== undefined ? p.tiltX : 0,
                    tiltY: p.tiltY !== undefined ? p.tiltY : 0,
                    twist: p.twist !== undefined ? p.twist : 0
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
            
            // Phase B-1: 傾き値の範囲チェック
            for (const p of this.points) {
                if (p.tiltX !== undefined && (p.tiltX < -1 || p.tiltX > 1)) {
                    errors.push('tiltX must be -1 to 1');
                }
                if (p.tiltY !== undefined && (p.tiltY < -1 || p.tiltY > 1)) {
                    errors.push('tiltY must be -1 to 1');
                }
                if (p.twist !== undefined && (p.twist < 0 || p.twist > Math.PI * 2)) {
                    errors.push('twist must be 0 to 2π');
                }
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
        
        /**
         * Phase B-1: 傾き情報の有無を判定
         */
        hasTiltData() {
            if (this.points.length === 0) return false;
            
            return this.points.some(p => 
                p.tiltX !== undefined || 
                p.tiltY !== undefined || 
                p.twist !== undefined
            );
        }
        
        /**
         * Phase B-1: 平均傾き値を取得
         */
        getAverageTilt() {
            if (this.points.length === 0) {
                return { tiltX: 0, tiltY: 0, twist: 0 };
            }
            
            let sumTiltX = 0;
            let sumTiltY = 0;
            let sumTwist = 0;
            let count = 0;
            
            for (const p of this.points) {
                if (p.tiltX !== undefined) {
                    sumTiltX += p.tiltX;
                    sumTiltY += p.tiltY || 0;
                    sumTwist += p.twist || 0;
                    count++;
                }
            }
            
            if (count === 0) {
                return { tiltX: 0, tiltY: 0, twist: 0 };
            }
            
            return {
                tiltX: sumTiltX / count,
                tiltY: sumTiltY / count,
                twist: sumTwist / count
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

    console.log('✅ data-models.js Phase B-1 loaded (ペン傾き対応版)');
    console.log('   ✅ StrokeData.points に tiltX/tiltY/twist 追加');
    console.log('   ✅ STROKE_SCHEMA拡張');
    console.log('   ✅ toJSON() 傾きシリアライズ対応');
    console.log('   ✅ 後方互換性維持');

})();