// ===== system/data-models.js - Phase 2: meshVertices対応 =====

(function() {
    'use strict';

    // ========== Layer データモデル ==========
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
        }

        static getSchema() {
            return LAYER_SCHEMA;
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

    // ========== CUT データモデル ==========
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

    // ========== Phase 2: StrokeData拡張 START ==========
    /**
     * StrokeData - ストローク描画データ
     * Phase 2: meshVertices対応
     */
    const STROKE_SCHEMA = {
        id: { type: 'string', required: true },
        points: { type: 'array', required: true },
        size: { type: 'number', default: 8 },
        color: { type: 'number', default: 0x000000 },
        opacity: { type: 'number', min: 0, max: 1, default: 1.0 },
        strokeOptions: { type: 'object', required: false },
        meshVertices: { type: 'object', required: false } // 🆕 Phase 2
    };

    class StrokeData {
        constructor(data = {}) {
            this.id = data.id || `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.points = data.points || [];
            this.size = data.size || 8;
            this.color = data.color !== undefined ? data.color : 0x000000;
            this.opacity = data.opacity !== undefined ? data.opacity : 1.0;
            this.strokeOptions = data.strokeOptions || null;
            
            // 🆕 Phase 2: meshVerticesフィールド
            // { vertices: [], uvs: [], indices: [], color, alpha }
            this.meshVertices = data.meshVertices || null;
        }

        static getSchema() {
            return STROKE_SCHEMA;
        }

        toJSON() {
            return {
                id: this.id,
                points: this.points,
                size: this.size,
                color: this.color,
                opacity: this.opacity,
                strokeOptions: this.strokeOptions,
                meshVertices: this.meshVertices // 🆕 Phase 2
            };
        }

        validate() {
            const errors = [];
            if (!this.id) errors.push('id is required');
            if (!Array.isArray(this.points)) errors.push('points must be array');
            if (this.opacity < 0 || this.opacity > 1) errors.push('opacity must be 0-1');
            return { valid: errors.length === 0, errors };
        }
    }
    // ========== Phase 2: StrokeData拡張 END ==========

    window.TegakiDataModels = {
        LayerModel,
        CutModel,
        StrokeData, // 🆕 Phase 2
        LAYER_SCHEMA,
        CUT_SCHEMA,
        STROKE_SCHEMA // 🆕 Phase 2
    };

    console.log('✅ data-models.js (Phase 2: meshVertices対応) loaded');
})();