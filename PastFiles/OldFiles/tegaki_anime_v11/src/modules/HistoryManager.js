// ========================================
// HistoryManager.js - Undo/Redo履歴管理
// ========================================

(function() {
    'use strict';
    
    class HistoryManager {
        constructor(frameCount, layerCount, canvasManager) {
            this.frameCount = frameCount;
            this.layerCount = layerCount;
            this.canvasManager = canvasManager;
            
            // 3次元配列: history[frameIndex][layerIndex] = [ImageData, ...]
            this.history = [];
            
            // 履歴インデックス: historyIndex[frameIndex][layerIndex]
            this.historyIndex = [];
            
            // 最大履歴数（メモリ対策）
            this.maxHistorySize = 100;
            
            this.init();
        }
        
        /**
         * 履歴構造の初期化
         */
        init() {
            for (let frameIndex = 0; frameIndex < this.frameCount; frameIndex++) {
                const frameLayers = [];
                const frameIndices = [];
                
                for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex++) {
                    // 空の履歴配列
                    frameLayers.push([]);
                    frameIndices.push(-1); // 初期状態は履歴なし
                }
                
                this.history.push(frameLayers);
                this.historyIndex.push(frameIndices);
            }
        }
        
        /**
         * 履歴に追加
         */
        pushHistory(frameIndex, layerIndex, imageData) {
            if (!this.isValidIndex(frameIndex, layerIndex)) return;
            
            const layerHistory = this.history[frameIndex][layerIndex];
            const currentIndex = this.historyIndex[frameIndex][layerIndex];
            
            // 現在位置より後の履歴を削除（分岐を防ぐ）
            if (currentIndex < layerHistory.length - 1) {
                this.history[frameIndex][layerIndex] = layerHistory.slice(0, currentIndex + 1);
            }
            
            // ImageDataのクローンを保存
            const clonedData = this.canvasManager.cloneImageData(imageData);
            this.history[frameIndex][layerIndex].push(clonedData);
            this.historyIndex[frameIndex][layerIndex]++;
            
            // 履歴サイズ制限
            this.trimHistory(frameIndex, layerIndex);
        }
        
        /**
         * Undo
         */
        undo(frameIndex, layerIndex) {
            if (!this.canUndo(frameIndex, layerIndex)) return null;
            
            this.historyIndex[frameIndex][layerIndex]--;
            const imageData = this.history[frameIndex][layerIndex][this.historyIndex[frameIndex][layerIndex]];
            
            return this.canvasManager.cloneImageData(imageData);
        }
        
        /**
         * Redo
         */
        redo(frameIndex, layerIndex) {
            if (!this.canRedo(frameIndex, layerIndex)) return null;
            
            this.historyIndex[frameIndex][layerIndex]++;
            const imageData = this.history[frameIndex][layerIndex][this.historyIndex[frameIndex][layerIndex]];
            
            return this.canvasManager.cloneImageData(imageData);
        }
        
        /**
         * Undo可能かチェック
         */
        canUndo(frameIndex, layerIndex) {
            if (!this.isValidIndex(frameIndex, layerIndex)) return false;
            return this.historyIndex[frameIndex][layerIndex] > 0;
        }
        
        /**
         * Redo可能かチェック
         */
        canRedo(frameIndex, layerIndex) {
            if (!this.isValidIndex(frameIndex, layerIndex)) return false;
            
            const currentIndex = this.historyIndex[frameIndex][layerIndex];
            const historyLength = this.history[frameIndex][layerIndex].length;
            
            return currentIndex < historyLength - 1;
        }
        
        /**
         * 履歴をクリア
         */
        clearHistory(frameIndex, layerIndex) {
            if (!this.isValidIndex(frameIndex, layerIndex)) return;
            
            this.history[frameIndex][layerIndex] = [];
            this.historyIndex[frameIndex][layerIndex] = -1;
        }
        
        /**
         * 全履歴をクリア
         */
        clearAllHistory() {
            for (let frameIndex = 0; frameIndex < this.frameCount; frameIndex++) {
                for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex++) {
                    this.clearHistory(frameIndex, layerIndex);
                }
            }
        }
        
        /**
         * 履歴数を制限（古い履歴から削除）
         */
        trimHistory(frameIndex, layerIndex) {
            const layerHistory = this.history[frameIndex][layerIndex];
            
            if (layerHistory.length > this.maxHistorySize) {
                const removeCount = layerHistory.length - this.maxHistorySize;
                this.history[frameIndex][layerIndex] = layerHistory.slice(removeCount);
                this.historyIndex[frameIndex][layerIndex] -= removeCount;
            }
        }
        
        /**
         * フレーム追加時の履歴拡張
         */
        addFrame() {
            const frameLayers = [];
            const frameIndices = [];
            
            for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex++) {
                frameLayers.push([]);
                frameIndices.push(-1);
            }
            
            this.history.push(frameLayers);
            this.historyIndex.push(frameIndices);
            this.frameCount++;
        }
        
        /**
         * フレーム削除時の履歴調整
         */
        deleteFrame(frameIndex) {
            if (frameIndex < 0 || frameIndex >= this.frameCount) return false;
            if (this.frameCount <= 1) return false;
            
            this.history.splice(frameIndex, 1);
            this.historyIndex.splice(frameIndex, 1);
            this.frameCount--;
            
            return true;
        }
        
        /**
         * インデックスの妥当性チェック
         */
        isValidIndex(frameIndex, layerIndex) {
            return frameIndex >= 0 && frameIndex < this.frameCount &&
                   layerIndex >= 0 && layerIndex < this.layerCount;
        }
        
        /**
         * メモリ使用量を取得（デバッグ用）
         */
        getHistorySize() {
            let totalSize = 0;
            
            for (let frameIndex = 0; frameIndex < this.frameCount; frameIndex++) {
                for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex++) {
                    totalSize += this.history[frameIndex][layerIndex].length;
                }
            }
            
            return totalSize;
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            this.clearAllHistory();
            this.history = null;
            this.historyIndex = null;
            this.canvasManager = null;
        }
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.HistoryManager = HistoryManager;
        console.log('✅ HistoryManager loaded');
    }
})();