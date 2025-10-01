# タイムラインサムネイル即時更新 実装ガイド

## 概要
描画・変形・ペーストなどの確定操作時に、タイムラインのサムネイルを即座に更新する機能を追加します。

既存コードへの影響を最小限に抑え、3つのファイルに小さな変更を加えるだけで実現できます。

---

## 改修1: system/event-bus.js

### 変更箇所
ファイル末尾の`console.log`の直前に以下を追加：

```javascript
// 【追加】確定操作イベント定義（プログラムで使用可能）
window.TegakiEventBus.EVENTS = {
    // 既存イベント
    LAYER_CREATED: 'layer:created',
    LAYER_DELETED: 'layer:deleted',
    LAYER_ACTIVATED: 'layer:activated',
    LAYER_UPDATED: 'layer:updated',
    LAYER_PATH_ADDED: 'layer:path-added',
    
    // 【新規】確定操作イベント（サムネイル更新トリガー）
    OPERATION_COMMIT: 'operation:commit',
    DRAW_COMMIT: 'draw:commit',
    TRANSFORM_COMMIT: 'transform:commit'
};
```

### 変更後のconsole.log
```javascript
console.log('✅ system/event-bus.js loaded (Phase 0 ready + commit events)');
```

---

## 改修2: system/layer-system.js

### 変更箇所1: addPathToLayerメソッド内

既存の`addPathToLayer`メソッド内で、AnimationSystemへの保存処理の直後に確定通知を追加：

**元のコード（1180行目付近）：**
```javascript
// 描画完了後、確実にAnimationSystemへ保存
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
```

**変更後：**
```javascript
// 描画完了後、確実にAnimationSystemへ保存
if (this.animationSystem?.saveCutLayerStates) {
    requestAnimationFrame(() => {
        this.animationSystem.saveCutLayerStates();
        
        // 【改修】確定操作イベント発火
        if (this.eventBus) {
            this.eventBus.emit('draw:commit', { layerIndex, layerId: layer.layerData.id });
            this.eventBus.emit('operation:commit', { layerIndex, layerId: layer.layerData.id, type: 'draw' });
        }
        
        // サムネイル生成も連動
        const currentCutIndex = this.animationSystem.getCurrentCutIndex();
        setTimeout(() => {
            this.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
        }, 50);
    });
}
```

### 変更箇所2: exitLayerMoveModeメソッド内

V キーを離してレイヤー移動モードを終了する際、変形確定イベントを発火：

**元のコード（480行目付近）：**
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

**変更後（`this.confirmLayerTransform();`の直後に追加）：**
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
    
    // 【改修】変形確定イベント発火
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
        }
        
        // サムネイル更新
        if (this.animationSystem?.generateCutThumbnailOptimized) {
            const currentCutIndex = this.animationSystem.getCurrentCutIndex();
            setTimeout(() => {
                this.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
            }, 100);
        }
    }
    
    if (this.eventBus) {
        this.eventBus.emit('layer:move-mode-exited');
    }
}
```

---

## 改修3: system/drawing-clipboard.js（オプション）

クリップボード操作時のサムネイル更新を追加する場合：

### pasteメソッド内

**変更箇所（90行目付近）：**

`layerManager.layerSystem.addPathToActiveLayer(pastedPath);`の直後に：

```javascript
// 【改修】ペースト確定イベント発火
if (layerManager.layerSystem.eventBus) {
    const activeIndex = layerManager.layerSystem.activeLayerIndex;
    const activeLayer = layerManager.layerSystem.getActiveLayer();
    if (activeLayer) {
        layerManager.layerSystem.eventBus.emit('paste:commit', { 
            layerIndex: activeIndex, 
            layerId: activeLayer.layerData.id 
        });
        layerManager.layerSystem.eventBus.emit('operation:commit', { 
            layerIndex: activeIndex, 
            layerId: activeLayer.layerData.id, 
            type: 'paste' 
        });
    }
    
    // サムネイル更新
    if (layerManager.layerSystem.animationSystem?.generateCutThumbnailOptimized) {
        const currentCutIndex = layerManager.layerSystem.animationSystem.getCurrentCutIndex();
        setTimeout(() => {
            layerManager.layerSystem.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
        }, 100);
    }
}
```

---

## 動作確認方法

1. **描画確定**
   - ペンツールで描画 → マウス/タッチを離す → サムネイル即時更新
   
2. **変形確定**
   - V キーでレイヤー移動モード → 位置・回転・スケール調整 → V キーを離す → サムネイル即時更新

3. **ペースト確定**
   - Ctrl+V でペースト → サムネイル即時更新

---

## アーキテクチャ

```
ユーザー操作
  ↓
LayerSystem (描画/変形処理)
  ↓
EventBus.emit('operation:commit')
  ↓
AnimationSystem.generateCutThumbnailOptimized()
  ↓
TimelineUI.updateSingleCutThumbnail()
```

### イベント統一設計
- `draw:commit`: 描画確定専用
- `transform:commit`: 変形確定専用
- `operation:commit`: **全確定操作の統一イベント**（将来の拡張用）

---

## メリット

### 1. 既存機能への影響ゼロ
- 既存の`generateCutThumbnailOptimized`をそのまま呼び出すだけ
- イベントは追加のみで、既存イベントは一切変更しない

### 2. 最小限のコード追加
- 3ファイル、合計30行程度の追加のみ
- 既存ロジックは完全継承

### 3. AI可読性向上
- イベント名で確定操作が一目瞭然
- `operation:commit`で全確定操作を統一的に扱える

### 4. 拡張性
- 将来、フィルタ・物理シミュレーション等の確定操作も同じパターンで追加可能
- イベント駆動なので、他のシステムも同じイベントを購読できる

---

## トラブルシューティング

### サムネイルが更新されない場合
1. `window.TegakiEventBus`が正しくロードされているか確認
2. ブラウザのコンソールで`OPERATION_COMMIT`イベントが発火しているか確認：
   ```javascript
   window.TegakiEventBus.setDebug(true);
   ```
3. `AnimationSystem.generateCutThumbnailOptimized`が正しく呼ばれているか確認

### イベントが多重発火する場合
- `requestAnimationFrame`と`setTimeout`の組み合わせで発火を抑制しているので問題なし
- デバッグモードで確認する場合は、`eventBus.setDebug(false)`で通常ログを無効化

---

## 今後の展開

### Phase 1完了時の機能
- ✅ 描画確定時のサムネイル更新
- ✅ 変形確定時のサムネイル更新
- ✅ ペースト確定時のサムネイル更新

### Phase 2（将来）
- フィルタ適用確定
- テキスト挿入確定
- 物理シミュレーション確定
- すべて`operation:commit`で統一的に処理可能
