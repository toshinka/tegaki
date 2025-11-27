/**
 * ============================================================
 * data-models.js - Phase F-1: フォルダ対応版
 * ============================================================
 * 【親依存】
 *   - なし（最上位データモデル定義）
 * 
 * 【子依存】
 *   - layer-system.js
 *   - layer-panel-renderer.js
 *   - history.js
 *   - brush-core.js
 *   - stroke-recorder.js
 *   - timeline-ui.js
 * 
 * 【Phase F-1改修内容】
 * ✅ LayerModel にフォルダ属性追加
 * ✅ LAYER_SCHEMA拡張（フォルダ情報定義）
 * ✅ toJSON() フォルダシリアライズ対応
 * ✅ 既存のペン傾き対応を完全継承
 * ✅ DRY原則: レイヤーとフォルダを統一モデルで管理
 * ============================================================
 */

(function() {
    'use strict';

    /**
     * Phase F-1: LAYER_SCHEMA拡張
     * フォルダ管理属性を追加
     */
    const LAYER_SCHEMA = {
        id: { type: 'string', required: true, editable: false },
        name: { type: 'string', required: true, editable: true },
        visible: { type: 'boolean', default: true, editable: true },
        opacity: { type: 'number', min: 0, max: 1, default: 1.0, editable: true },
        isBackground: { type: 'boolean', default: false, editable: false },
        backgroundColor: { type: 'number', default: 0xf0e0d6, editable: true },
        clipping: { type: 'boolean', default: false, editable: true },
        blendMode: { type: 'string', default: 'normal', editable: true },
        locked: { type: 'boolean', default: false, editable: true },
        
        // Phase F-1: フォルダ管理属性
        isFolder: { type: 'boolean', default: false, editable: false },
        folderExpanded: { type: 'boolean', default: true, editable: true },
        parentId: { type: 'string', default: null, editable: true },
        childIds: { type: 'array', default: [], editable: true }
    };

    /**
     * Phase F-1: LayerModel拡張
     * フォルダ機能を追加（既存機能は完全継承）
     */
    class LayerModel {
        constructor(data = {}) {
            // 既存プロパティ（完全継承）
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
            
            // Phase F-1: フォルダ管理プロパティ
            this.isFolder = data.isFolder || false;
            this.folderExpanded = data.folderExpanded !== undefined ? data.folderExpanded : true;
            this.parentId = data.parentId || null;
            this.childIds = data.childIds || [];
            
            // 既存のマスク管理（完全継承）
            this.maskTexture = null;
            this.maskSprite = null;
            this._maskInitialized = false;
        }

        static getSchema() {
            return LAYER_SCHEMA;
        }

        // ========================================
        // Phase F-1: フォルダ判定メソッド
        // ========================================
        
        /**
         * フォルダかどうかを判定
         */
        isFolderLayer() {
            return this.isFolder === true;
        }
        
        /**
         * フォルダが開いているかを判定
         */
        isFolderOpen() {
            return this.isFolder && this.folderExpanded;
        }
        
        /**
         * 親フォルダを持つかを判定
         */
        hasParent() {
            return this.parentId !== null && this.parentId !== undefined;
        }
        
        /**
         * 子レイヤーを持つかを判定
         */
        hasChildren() {
            return this.childIds && this.childIds.length > 0;
        }
        
        /**
         * 子レイヤーを追加
         */
        addChild(layerId) {
            if (!this.isFolder) return false;
            if (!layerId || this.childIds.includes(layerId)) return false;
            this.childIds.push(layerId);
            return true;
        }
        
        /**
         * 子レイヤーを削除
         */
        removeChild(layerId) {
            if (!this.isFolder) return false;
            const index = this.childIds.indexOf(layerId);
            if (index === -1) return false;
            this.childIds.splice(index, 1);
            return true;
        }
        
        /**
         * フォルダの開閉を切り替え
         */
        toggleExpanded() {
            if (!this.isFolder) return false;
            this.folderExpanded = !this.folderExpanded;
            return true;
        }

        // ========================================
        // 既存のマスク管理メソッド（完全継承）
        // ========================================
        
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

        /**
         * Phase F-1: toJSON() フォルダ対応
         * フォルダ属性を含めてシリアライズ
         */
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
                locked: this.locked,
                
                // Phase F-1: フォルダ情報
                isFolder: this.isFolder,
                folderExpanded: this.folderExpanded,
                parentId: this.parentId,
                childIds: this.childIds
            };
        }

        validate() {
            const errors = [];
            if (!this.id) errors.push('id is required');
            if (!this.name) errors.push('name is required');
            if (this.opacity < 0 || this.opacity > 1) errors.push('opacity must be 0-1');
            
            // Phase F-1: フォルダバリデーション
            if (this.isFolder && this.isBackground) {
                errors.push('folder cannot be background layer');
            }
            if (this.parentId && this.parentId === this.id) {
                errors.push('layer cannot be its own parent');
            }
            
            return { valid: errors.length === 0, errors };
        }
    }

    // ========================================
    // CutModel（既存のまま完全継承）
    // ========================================
    
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

    // ========================================
    // StrokeData（Phase B-1の傾き対応を完全継承）
    // ========================================
    
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
                tiltX: 'number',
                tiltY: 'number',
                twist: 'number'
            }
        },
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
        
        hasTiltData() {
            if (this.points.length === 0) return false;
            
            return this.points.some(p => 
                p.tiltX !== undefined || 
                p.tiltY !== undefined || 
                p.twist !== undefined
            );
        }
        
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

    // ========================================
    // グローバル登録
    // ========================================
    
    window.TegakiDataModels = {
        LayerModel,
        CutModel,
        StrokeData,
        LAYER_SCHEMA,
        CUT_SCHEMA,
        STROKE_SCHEMA
    };

    console.log('✅ data-models.js Phase F-1 loaded (フォルダ対応版)');
    console.log('   ✅ LayerModel にフォルダ属性追加');
    console.log('   ✅ isFolder / folderExpanded / parentId / childIds');
    console.log('   ✅ 既存の傾き対応を完全継承');
    console.log('   ✅ DRY原則: レイヤーとフォルダを統一モデルで管理');

})();