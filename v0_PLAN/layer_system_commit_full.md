# layer-system.js 確定イベント追加パッチ

既存の `system/layer-system.js` に以下の2箇所を修正してください。

---

## 修正1: addPathToLayer メソッド (1177行目付近)

### 修正前
```javascript
addPathToLayer(layerIndex, path) {
    if (layerIndex >= 0 && layerIndex < this.layers.length) {
        const layer = this.layers[layerIndex];
        
        layer.layerData.paths.push(path);
        layer.addChild(path.graphics);
        
        this.requestThumbnailUpdate(layerIndex);
        
        // 【改修】描画完了後、確実にAnimationSystemへ保存
        if (this.animationSystem?.saveCutLayerStates) {
            requestAnimationFrame(() => {
                this.animationSystem.saveCutLayerStates();
                
                // サムネイル生成も連動
                const currentCutIndex = this.animationSystem.getCurrentCutIndex();
                setTimeout(() => {
                    this.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
                }, 50);
            });
        }
        
        if (this.eventBus) {
            this.eventBus.emit('layer:path-added', { 
                layerIndex, 
                pathId: path.id,
                layerId: layer.layerData.id
            });
        }
    }
}
```

### 修正後（setTimeout内の最初に確定イベントを追加）
```javascript
addPathToLayer(layerIndex, path) {
    if (layerIndex >= 0 && layerIndex < this.layers.length) {
        const layer = this.layers[layerIndex];
        
        layer.layerData.paths.push(path);
        layer.addChild(path.graphics);
        
        this.requestThumbnailUpdate(layerIndex);
        
        // 【改修】描画完了後、確実にAnimationSystemへ保存
        if (this.animationSystem?.saveCutLayerStates) {
            requestAnimationFrame(() => {
                this.animationSystem.saveCutLayerStates();
                
                // 【追加】確定操作イベント発火
                if (this.eventBus) {
                    this.eventBus.emit('draw:commit', { 
                        layerIndex, 
                        layerId: layer.layerData.id 
                    });
                    this.eventBus.emit('operation:commit', { 
                        layerIndex, 
                        layerId: layer.layerData.id, 
                        type: 'draw' 
                    });
                }
                
                // サムネイル生成も連動
                const currentCutIndex = this.animationSystem.getCurrentCutIndex();
                setTimeout(() => {
                    this.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
                }, 50);
            });
        }
        
        if (this.eventBus) {
            this.eventBus.emit('layer:path-added', { 
                layerIndex, 
                pathId: path.id,
                layerId: layer.layerData.id
            });
        }
    }
}
```

---

## 修正2: exitLayerMoveMode メソッド (474行目付近)

### 修正前
```javascript
exitLayerMoveMode() {
    if (!this.isLayerMoveMode) return;
    
    this.isLayerMoveMode = false;
    this.vKeyPressed = false;
    this.isLayerDragging = false;
    
    if (this.cameraSystem?.setVKeyPressed) {
        this.cameraSystem.setVKeyPressed(false);
        this.cameraSystem.hideGuideLines();
    }
    
    if (this.layerTransformPanel) {
        this.layerTransformPanel.classList.remove('show');
    }
    
    this.updateCursor();
    this.confirmLayerTransform();
    
    if (this.eventBus) {
        this.eventBus.emit('layer:move-mode-exited');
    }
}
```

### 修正後（confirmLayerTransform()の直後に確定イベントを追加）
```javascript
exitLayerMoveMode() {
    if (!this.isLayerMoveMode) return;
    
    this.isLayerMoveMode = false;
    this.vKeyPressed = false;
    this.isLayerDragging = false;
    
    if (this.cameraSystem?.setVKeyPressed) {
        this.cameraSystem.setVKeyPressed(false);
        this.cameraSystem.hideGuideLines();
    }
    
    if (this.layerTransformPanel) {
        this.layerTransformPanel.classList.remove('show');
    }
    
    this.updateCursor();
    this.confirmLayerTransform();
    
    // 【追加】変形確定イベント発火
    if (this.activeLayerIndex >= 0 && this.eventBus) {
        const layer = this.layers[this.activeLayerIndex];
        if (layer) {
            this.eventBus.emit('transform:commit', { 
                layerIndex: this.activeLayerIndex, 
                layerId: layer.layerData.id 
            });
            this.eventBus.emit('operation:commit', { 
                layerIndex: this.activeLayerIndex, 
                layerId: layer.layerData.id, 
                type: 'transform' 
            });
            
            // サムネイル更新
            if (this.animationSystem?.generateCutThumbnailOptimized) {
                const currentCutIndex = this.animationSystem.getCurrentCutIndex();
                setTimeout(() => {
                    this.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
                }, 100);
            }
        }
    }
    
    if (this.eventBus) {
        this.eventBus.emit('layer:move-mode-exited');
    }
}
```

---

## 修正完了後のconsole.log

ファイル末尾のconsole.logを以下に変更：

```javascript
console.log('✅ layer-system.js loaded (CUT独立性修正版 + 確定イベント)');
console.log('🔧 改修内容:');
console.log('  ❌ グローバルlayers配列廃止 → AnimationSystemのCUT構造を参照');
console.log('  🆕 _syncLayersContainerFromAnimationSystem: CUT切替時にLayerを再構築');
console.log('  🆕 _applyTransformToLayerFromData: Transform復元処理');
console.log('  🆕 _rebuildPathFromData: Path復元処理');
console.log('  ✅ AnimationSystem同期強化: saveCutLayerStates確実実行');
console.log('  ✅ サムネイル生成連動: generateCutThumbnailOptimized自動実行');
console.log('  🆕 確定操作イベント: draw:commit, transform:commit, operation:commit');
console.log('  ✅ CoordinateSystem統合維持');
console.log('  ✅ EventBus統合維持');
```

---

## 動作確認

1. **描画確定**
   - ペンで描画 → マウスアップ → コンソールで `draw:commit` と `operation:commit` が表示される
   
2. **変形確定**
   - V キー押下 → レイヤー移動 → V キー離す → コンソールで `transform:commit` と `operation:commit` が表示される

3. **サムネイル更新**
   - タイムラインのCUTサムネイルが即座に更新されることを確認
