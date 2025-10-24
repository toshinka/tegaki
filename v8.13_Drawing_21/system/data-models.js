// ============================================================================
// system/data-models.js - Phase 1完全版: StrokeData追加
// ============================================================================

(function() {
    'use strict';

    // ========================================================================
    // StrokeData - ストローク情報モデル
    // ========================================================================
    class StrokeData {
        constructor(data = {}) {
            this.points = data.points || [];
            this.color = data.color || 0x000000;
            this.size = data.size || 2;
            this.opacity = data.opacity || 1.0;
            this.pressure = data.pressure || [];
            this.tool = data.tool || 'pen';
            this.timestamp = data.timestamp || Date.now();
        }

        addPoint(x, y, pressure = 1.0) {
            this.points.push({ x, y });
            this.pressure.push(pressure);
        }

        serialize() {
            return {
                points: this.points,
                color: this.color,
                size: this.size,
                opacity: this.opacity,
                pressure: this.pressure,
                tool: this.tool,
                timestamp: this.timestamp
            };
        }

        static deserialize(data) {
            return new StrokeData(data);
        }

        clone() {
            return StrokeData.deserialize(this.serialize());
        }
    }

    // ========================================================================
    // LayerModel
    // ========================================================================
    class LayerModel {
        constructor(data = {}) {
            this.id = data.id || `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.name = data.name || 'Layer';
            this.visible = data.visible !== undefined ? data.visible : true;
            this.opacity = data.opacity !== undefined ? data.opacity : 1.0;
            this.blendMode = data.blendMode || 'normal';
            this.isBackground = data.isBackground || false;
            this.locked = data.locked || false;
            
            this.paths = [];
            
            // Phase 1: マスク関連プロパティ
            this.maskTexture = null;
            this.maskSprite = null;
            this._maskInitialized = false;
            this.maskMode = data.maskMode || 'raster';
        }

        // Phase 1: マスク初期化
        initializeMask(width, height, renderer) {
            if (this._maskInitialized) {
                this.destroyMask();
            }
            
            if (!renderer) {
                return false;
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
                
                whiteRect.destroy();
                
                this.maskSprite = new PIXI.Sprite(this.maskTexture);
                this.maskSprite.label = 'mask_sprite';
                this._maskInitialized = true;
                
                return true;
            } catch (error) {
                return false;
            }
        }

        // Phase 1: マスク存在確認
        hasMask() {
            return this._maskInitialized && 
                   this.maskTexture !== null && 
                   this.maskSprite !== null;
        }

        // 既存: マスク破棄
        destroyMask() {
            if (this.maskSprite) {
                this.maskSprite.destroy();
                this.maskSprite = null;
            }
            if (this.maskTexture) {
                this.maskTexture.destroy(true);
                this.maskTexture = null;
            }
            this._maskInitialized = false;
        }

        addPath(path) {
            this.paths.push(path);
        }

        removePath(path) {
            const index = this.paths.indexOf(path);
            if (index > -1) {
                this.paths.splice(index, 1);
            }
        }

        clearPaths() {
            this.paths = [];
        }

        getPaths() {
            return this.paths;
        }

        serialize() {
            return {
                id: this.id,
                name: this.name,
                visible: this.visible,
                opacity: this.opacity,
                blendMode: this.blendMode,
                isBackground: this.isBackground,
                locked: this.locked,
                paths: this.paths.map(p => ({
                    points: p.points,
                    color: p.color,
                    size: p.size,
                    opacity: p.opacity
                }))
            };
        }

        static deserialize(data) {
            return new LayerModel(data);
        }

        clone() {
            const data = this.serialize();
            return LayerModel.deserialize(data);
        }
    }

    // ========================================================================
    // CutModel
    // ========================================================================
    class CutModel {
        constructor(data = {}) {
            this.id = data.id || `cut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.name = data.name || 'Cut 1';
            this.frameCount = data.frameCount || 1;
            this.currentFrame = data.currentFrame || 0;
        }

        serialize() {
            return {
                id: this.id,
                name: this.name,
                frameCount: this.frameCount,
                currentFrame: this.currentFrame
            };
        }

        static deserialize(data) {
            return new CutModel(data);
        }

        clone() {
            return CutModel.deserialize(this.serialize());
        }
    }

    // ========================================================================
    // Global Export
    // ========================================================================
    window.TegakiDataModels = {
        StrokeData,
        LayerModel,
        CutModel
    };

    console.log('✅ data-models.js (Phase 1完全版) loaded');

})();