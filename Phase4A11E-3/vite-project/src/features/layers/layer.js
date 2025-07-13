import { mat4 } from 'gl-matrix';

let layerIdCounter = 0;

/**
 * [クラス責務] Layer.js
 * 目的：単一のレイヤーを表現するデータ構造。
 * 責務：
 * - レイヤー固有のプロパティ（名前, 可視性, 不透明度, ImageData, etc.）を保持する。
 * - レイヤーのユニークIDを管理する。
 */
export class Layer {
    constructor(name, width, height, id = null) {
        this.id = id ?? `layer_${Date.now()}_${layerIdCounter++}`;
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        
        this.imageData = new ImageData(width, height);
        this.modelMatrix = mat4.create(); // Represents position, rotation, scale
        
        // State flags
        this.gpuDirty = true; // Does the GPU texture need updating from imageData?
        this.transformStage = null; // Temporary ImageData for transform operations
    }
}