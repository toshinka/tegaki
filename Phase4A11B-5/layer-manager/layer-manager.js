// layer-manager/layer-manager.js

import { Layer } from '../core-engine.js';
const mat4 = window.glMatrix.mat4;

export class LayerManager { 
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.width = 344;
        this.height = 135;
    } 
    
    setupInitialLayers() {
        const bgLayer = new Layer('背景', this.width, this.height);
        bgLayer.fill('#f0e0d6');
        this.layers.push(bgLayer);
        const drawingLayer = new Layer('レイヤー 1', this.width, this.height);
        this.layers.push(drawingLayer);
        this.switchLayer(1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    } 
    
    addLayer() {
        if (this.layers.length >= 99) return;
        const insertIndex = this.activeLayerIndex + 1;
        const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    } 
    
    deleteActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        this.layers.splice(this.activeLayerIndex, 1);
        const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex);
        this.renameLayers();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    } 
    
    renameLayers() {
        this.layers.forEach((layer, index) => {
            if (index > 0) layer.name = `レイヤー ${index}`;
        });
        if (this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
    } 
    
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
    } 
    
    getCurrentLayer() {
        return this.layers[this.activeLayerIndex] || null;
    } 
    
    duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer) return;
        const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height);
        newLayer.imageData.data.set(activeLayer.imageData.data);
        newLayer.visible = activeLayer.visible;
        newLayer.opacity = activeLayer.opacity;
        newLayer.blendMode = activeLayer.blendMode;
        newLayer.gpuDirty = true;
        const insertIndex = this.activeLayerIndex + 1;
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    } 
    
    mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        
        this.bakeLayerTransform(this.layers[this.activeLayerIndex], this.app.renderingBridge.currentEngine);
        this.bakeLayerTransform(this.layers[this.activeLayerIndex - 1], this.app.renderingBridge.currentEngine);

        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.putImageData(bottomLayer.imageData, 0, 0);
        tempCtx.globalAlpha = topLayer.opacity / 100;
        tempCtx.globalCompositeOperation = topLayer.blendMode;
        
        const topLayerCanvas = document.createElement('canvas');
        topLayerCanvas.width = this.width;
        topLayerCanvas.height = this.height;
        topLayerCanvas.getContext('2d').putImageData(topLayer.imageData, 0, 0);
        
        tempCtx.drawImage(topLayerCanvas, 0, 0);
        
        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.width, this.height);
        bottomLayer.gpuDirty = true;
        
        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    } 

    bakeLayerTransform(layer, engine) {
        if (!layer || !engine || !engine.gl) return;

        const identityMatrix = mat4.create();
        if (mat4.equals(layer.modelMatrix, identityMatrix)) {
            console.log("変形がないため、確定処理をスキップしました。");
            return;
        }

        const gl = engine.gl;
        
        const tempTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tempTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, engine.superWidth, engine.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const tempFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tempTexture, 0);
        
        gl.viewport(0, 0, engine.superWidth, engine.superHeight);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        engine._createOrUpdateLayerTexture(layer);
        const sourceTexture = engine.layerTextures.get(layer);

        const program = engine.programs.compositor;
        gl.useProgram(program);
        
        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, engine.projectionMatrix, layer.modelMatrix);
        gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, mvpMatrix);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, engine.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);

        gl.bindBuffer(gl.ARRAY_BUFFER, engine.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);
        gl.uniform2f(program.locations.u_source_resolution, engine.superWidth, engine.superHeight);

        engine._setBlendMode('normal');
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        const pixels = new Uint8Array(engine.superWidth * engine.superHeight * 4);
        gl.readPixels(0, 0, engine.superWidth, engine.superHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = engine.superWidth;
        tempCanvas.height = engine.superHeight;
        const tempCtx = tempCanvas.getContext('2d');
        const superClamped = new Uint8ClampedArray(pixels);
        const superImageData = new ImageData(superClamped, engine.superWidth, engine.superHeight);
        tempCtx.putImageData(superImageData, 0, 0);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = this.width;
        finalCanvas.height = this.height;
        const finalCtx = finalCanvas.getContext('2d');
        const yFlipCanvas = document.createElement('canvas');
        yFlipCanvas.width = this.width;
        yFlipCanvas.height = this.height;
        const yFlipCtx = yFlipCanvas.getContext('2d');
        yFlipCtx.translate(0, this.height);
        yFlipCtx.scale(1, -1);
        yFlipCtx.drawImage(tempCanvas, 0, 0, this.width, this.height);
        finalCtx.drawImage(yFlipCanvas, 0, 0);
        
        layer.imageData = finalCtx.getImageData(0, 0, this.width, this.height);
        layer.modelMatrix = mat4.create();
        layer.gpuDirty = true;

        gl.deleteFramebuffer(tempFBO);
        gl.deleteTexture(tempTexture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
}