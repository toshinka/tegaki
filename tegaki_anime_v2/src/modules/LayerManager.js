// ========================================
// LayerManager.js - レイヤー・フレーム管理
// ========================================

(function() {
    'use strict';
    
    class LayerManager {
        constructor(frameCount, layerCountPerFrame, canvasManager) {
            const config = window.TegakiConstants?.ANIMATION_CONFIG || {};
            
            this.frameCount = frameCount || config.DEFAULT_FRAME_COUNT || 3;
            this.layerCountPerFrame = layerCountPerFrame || config.DEFAULT_LAYER_COUNT || 3;
            this.canvasManager = canvasManager;
            
            // フレーム構造: frames[frameIndex].layers[layerIndex] = ImageData
            this.frames = [];
            
            // アクティブなフレームとレイヤー
            this.activeFrameIndex = 0;
            this.activeLayerIndex = 1; // デフォルトはレイヤー1（背景=0, 描画レイヤー=1,2）
            
            this.init();
        }
        
        /**
         * フレーム・レイヤー構造の初期化
         */
        init() {
            for (let frameIndex = 0; frameIndex < this.frameCount; frameIndex++) {
                const frame = {
                    layers: []
                };
                
                for (let layerIndex = 0; layerIndex < this.layerCountPerFrame; layerIndex++) {
                    let imageData;
                    
                    if (layerIndex === 0) {
                        // レイヤー0（背景）は背景色で塗りつぶし
                        imageData = this.canvasManager.createEmptyImageData();
                        const bgColor = this.canvasManager.backgroundColor;
                        if (window.TegakiHelpers) {
                            window.TegakiHelpers.fillImageData(imageData, bgColor);
                        }
                    } else {
                        // レイヤー1以降は透明
                        imageData = this.canvasManager.createEmptyImageData();
                    }
                    
                    frame.layers.push({
                        imageData: imageData,
                        visible: true,
                        opacity: 1.0,
                        name: layerIndex === 0 ? '背景' : `レイヤー${layerIndex}`
                    });
                }
                
                this.frames.push(frame);
            }
        }
        
        /**
         * フレームを切り替え
         */
        switchFrame(frameIndex) {
            if (frameIndex < 0 || frameIndex >= this.frameCount) return false;
            if (frameIndex === this.activeFrameIndex) return false;
            
            this.activeFrameIndex = frameIndex;
            return true;
        }
        
        /**
         * レイヤーを切り替え
         */
        switchLayer(layerIndex) {
            if (layerIndex < 0 || layerIndex >= this.layerCountPerFrame) return false;
            if (layerIndex === this.activeLayerIndex) return false;
            
            this.activeLayerIndex = layerIndex;
            return true;
        }
        
        /**
         * アクティブなフレームを取得
         */
        getActiveFrame() {
            return this.frames[this.activeFrameIndex];
        }
        
        /**
         * アクティブなレイヤーを取得
         */
        getActiveLayer() {
            const frame = this.getActiveFrame();
            return frame.layers[this.activeLayerIndex];
        }
        
        /**
         * アクティブなレイヤーのImageDataを取得
         */
        getActiveLayerImageData() {
            const layer = this.getActiveLayer();
            return layer.imageData;
        }
        
        /**
         * アクティブなレイヤーのImageDataを設定
         */
        setActiveLayerImageData(imageData) {
            const layer = this.getActiveLayer();
            layer.imageData = this.canvasManager.cloneImageData(imageData);
        }
        
        /**
         * 指定フレーム・レイヤーのImageDataを取得
         */
        getLayerImageData(frameIndex, layerIndex) {
            if (frameIndex < 0 || frameIndex >= this.frameCount) return null;
            if (layerIndex < 0 || layerIndex >= this.layerCountPerFrame) return null;
            
            return this.frames[frameIndex].layers[layerIndex].imageData;
        }
        
        /**
         * 指定フレーム・レイヤーのImageDataを設定
         */
        setLayerImageData(frameIndex, layerIndex, imageData) {
            if (frameIndex < 0 || frameIndex >= this.frameCount) return;
            if (layerIndex < 0 || layerIndex >= this.layerCountPerFrame) return;
            
            this.frames[frameIndex].layers[layerIndex].imageData = 
                this.canvasManager.cloneImageData(imageData);
        }
        
        /**
         * 指定フレームの全レイヤーを合成したImageDataを取得
         */
        getCompositeImageData(frameIndex) {
            if (frameIndex < 0 || frameIndex >= this.frameCount) return null;
            
            const frame = this.frames[frameIndex];
            let composite = this.canvasManager.createEmptyImageData();
            
            // レイヤー0（背景）から順に合成
            for (let i = 0; i < frame.layers.length; i++) {
                const layer = frame.layers[i];
                if (!layer.visible) continue;
                
                if (window.TegakiHelpers) {
                    composite = window.TegakiHelpers.compositeImageData(
                        this.canvasManager.ctx,
                        composite,
                        layer.imageData
                    );
                }
            }
            
            return composite;
        }
        
        /**
         * レイヤーの表示/非表示を設定
         */
        setLayerVisibility(frameIndex, layerIndex, visible) {
            if (frameIndex < 0 || frameIndex >= this.frameCount) return;
            if (layerIndex < 0 || layerIndex >= this.layerCountPerFrame) return;
            
            this.frames[frameIndex].layers[layerIndex].visible = visible;
        }
        
        /**
         * レイヤーの不透明度を設定
         */
        setLayerOpacity(frameIndex, layerIndex, opacity) {
            if (frameIndex < 0 || frameIndex >= this.frameCount) return;
            if (layerIndex < 0 || layerIndex >= this.layerCountPerFrame) return;
            
            this.frames[frameIndex].layers[layerIndex].opacity = Math.max(0, Math.min(1, opacity));
        }
        
        /**
         * 新しいフレームを追加
         */
        addFrame() {
            const frame = {
                layers: []
            };
            
            for (let layerIndex = 0; layerIndex < this.layerCountPerFrame; layerIndex++) {
                let imageData;
                
                if (layerIndex === 0) {
                    // レイヤー0（背景）は背景色で塗りつぶし
                    imageData = this.canvasManager.createEmptyImageData();
                    const bgColor = this.canvasManager.backgroundColor;
                    if (window.TegakiHelpers) {
                        window.TegakiHelpers.fillImageData(imageData, bgColor);
                    }
                } else {
                    // レイヤー1以降は透明
                    imageData = this.canvasManager.createEmptyImageData();
                }
                
                frame.layers.push({
                    imageData: imageData,
                    visible: true,
                    opacity: 1.0,
                    name: layerIndex === 0 ? '背景' : `レイヤー${layerIndex}`
                });
            }
            
            this.frames.push(frame);
            this.frameCount++;
        }
        
        /**
         * フレームを削除
         */
        deleteFrame(frameIndex) {
            if (this.frameCount <= 1) return false; // 最後の1フレームは削除不可
            if (frameIndex < 0 || frameIndex >= this.frameCount) return false;
            
            this.frames.splice(frameIndex, 1);
            this.frameCount--;
            
            // アクティブフレームの調整
            if (this.activeFrameIndex >= this.frameCount) {
                this.activeFrameIndex = this.frameCount - 1;
            }
            
            return true;
        }
        
        /**
         * 全フレームデータをエクスポート用に取得
         */
        getAllFrames() {
            return this.frames;
        }
        
        /**
         * エクスポート用：全フレームの合成ImageDataを取得
         */
        getCompositeFrames() {
            const compositeFrames = [];
            
            for (let i = 0; i < this.frameCount; i++) {
                compositeFrames.push(this.getCompositeImageData(i));
            }
            
            return compositeFrames;
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            this.frames = null;
            this.canvasManager = null;
        }
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.LayerManager = LayerManager;
        console.log('✅ LayerManager loaded');
    }
})();