# レイヤーパネル不具合 調査報告 & 修正指示書

**作成者**: Claude  
**対象フェーズ**: Phase 2（進行中）  
**対象ファイル**:
- `tegaki_work/system/layer-system.js`
- `tegaki_work/ui/layer-panel-renderer.js`

---

## 症状まとめ

| 症状 | 再現条件 |
|---|---|
| A: フォルダ／レイヤーが「状態には存在するがパネルに出ない」 | レイヤーのドラッグ並べ替え後、または折りたたみ状態のフォルダへの追加後 |
| B: 一度発生すると、新規レイヤーを作ってもパネルに出なくなる | 症状Aの後に継続発生 |
| C: アクティブ表示（枠・ハイライト）が実際の選択レイヤーとズレる | ドラッグ操作後のパネル再描画時 |

ステータスバー表示（下部）は常に正確。パネルの表示だけがズレる。

---

## Bug 1 — 最重要・症状B・Cの直接原因

### 場所
`system/layer-system.js` — `reorderLayers()` メソッド（履歴の `do()` / `undo()` 内部を含む）

### 原因
`getLayers()` は PixiJS の内部配列 `currentFrameContainer._children` への**参照**を返す。
これを直接 `splice()` すると、PixiJS が内部で管理しているマップやフラグと不整合が生じ、
その後の `removeChild()` / `addChildAt()` が二重操作になり、シーングラフが壊れる。

### 壊れる経路（コメント付き）

```js
// ❌ 現在の問題コード
reorderLayers(fromIndex, toIndex) {
    const layers = this.getLayers();
    //    ↑ これは this.currentFrameContainer._children の参照！コピーではない

    const [layer] = layers.splice(fromIndex, 1);
    //    ↑ PixiJS 内部配列を直接書き換えてしまう。_childByLabel 等は更新されない

    layers.splice(toIndex, 0, layer);
    //    ↑ さらに直接書き換え。layer は今 toIndex にいる状態になっている

    this.currentFrameContainer.removeChild(layer);
    //    ↑ PixiJS が layer を _children で indexOf 検索すると toIndex で見つかる。
    //      「fromIndex から削除」のつもりが「toIndex から削除」になってしまう

    this.currentFrameContainer.addChildAt(layer, toIndex);
    //    ↑ 追加自体は動くが、中間状態で layer.parent = null になっているため
    //      以後の addChild 系操作が予期しない動作をする可能性がある
}
```

### 修正方法

`getLayers()` を使う前に必ず配列コピーを取り、PixiJS API だけで位置を管理する。
手動 splice は一切使わない。

```js
// ✅ 修正後のコード（reorderLayers の do() / else 両方を同じ形に直す）
reorderLayers(fromIndex, toIndex) {
    // 事前バリデーション（変更なし）
    const layers = this.getLayers();
    if (fromIndex < 0 || fromIndex >= layers.length ||
        toIndex < 0   || toIndex >= layers.length ||
        fromIndex === toIndex) {
        return false;
    }

    // ★ ここだけ変更：コピーは取らず、PixiJS API だけで操作する
    const layer = layers[fromIndex];
    // layers.splice は一切しない

    if (historyManager && !historyManager.isApplying) {
        const oldActiveIndex = this.activeLayerIndex;
        const entry = {
            name: 'layer-reorder',
            do: () => {
                // PixiJS API だけで移動（_children は PixiJS が管理する）
                this.currentFrameContainer.removeChildAt(fromIndex);
                this.currentFrameContainer.addChildAt(layer, toIndex);

                // activeLayerIndex の補正（変更なし）
                if (this.activeLayerIndex === fromIndex) {
                    this.activeLayerIndex = toIndex;
                } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
                    this.activeLayerIndex--;
                } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
                    this.activeLayerIndex++;
                }

                this._emitPanelUpdateRequest();
                if (this.eventBus) {
                    this.eventBus.emit('layer:reordered', {
                        fromIndex, toIndex,
                        activeIndex: this.activeLayerIndex,
                        movedLayerId: layer.layerData?.id
                    });
                }
            },
            undo: () => {
                this.currentFrameContainer.removeChildAt(toIndex);
                this.currentFrameContainer.addChildAt(layer, fromIndex);
                this.activeLayerIndex = oldActiveIndex;
                this._emitPanelUpdateRequest();
                if (this.eventBus) {
                    this.eventBus.emit('layer:reordered', {
                        fromIndex: toIndex, toIndex: fromIndex,
                        activeIndex: this.activeLayerIndex,
                        movedLayerId: layer.layerData?.id
                    });
                }
            },
            meta: { fromIndex, toIndex }
        };
        historyManager.push(entry);
    } else {
        // isApplying 中（履歴 do/undo から呼ばれた場合）
        this.currentFrameContainer.removeChildAt(fromIndex);
        this.currentFrameContainer.addChildAt(layer, toIndex);

        if (this.activeLayerIndex === fromIndex) {
            this.activeLayerIndex = toIndex;
        } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
            this.activeLayerIndex--;
        } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
            this.activeLayerIndex++;
        }

        this._emitPanelUpdateRequest();
        if (this.eventBus) {
            this.eventBus.emit('layer:reordered', {
                fromIndex, toIndex,
                activeIndex: this.activeLayerIndex,
                movedLayerId: layer.layerData?.id
            });
        }
    }

    return true;
}
```

> **注意**: `moveActiveLayerHierarchy()` でも同様に `removeChildAt` / `addChildAt` のみを使っているか確認すること。現行コードも同じパターンで書かれていれば問題ない。

---

## Bug 2 — 重要・症状A・Cの直接原因

### 場所
`ui/layer-panel-renderer.js` — `initializeSortable()` 内 `onEnd` コールバック

### 原因
`evt.newIndex` は DOM 上の**表示されているアイテムだけ**をカウントしたインデックス。
しかし `layers.length` は**折りたたまれたフォルダの中の非表示レイヤーも含む全数**。
この2つを組み合わせた変換式 `layers.length - 1 - evt.newIndex` は、
非表示レイヤーが1つでもあると必ずズレる。

### ズレの例（コメント付き）

```
全レイヤー配列: [bg(0), layer1(1), folder(2), hiddenChild(3)]
DOM 表示:       [folder,           layer1,    bg           ]
                  ↑DOM[0]            ↑DOM[1]   ↑DOM[2]

layer1 を DOM[0]（folder の上）にドラッグした場合:
  evt.item.dataset.layerIndex = 1   ← oldIndex は正しい
  evt.newIndex = 0                  ← DOM 上の新しい位置

❌ 現在: newIndex = layers.length - 1 - evt.newIndex
                  = 4 - 1 - 0
                  = 3  ← hiddenChild の位置！ 間違い

✅ 正しい: ドロップ先要素の data-layer-index 属性を直接読む
```

### 修正方法

`onEnd` でドロップ先の要素（`evt.related` または座標から取得）の `data-layer-index` を読み取る。
これはレンダリング時に正しい originalIndex で設定済みなので信頼できる。

```js
// ✅ 修正後の onEnd コールバック
onEnd: (evt) => {
    evt.item.style.opacity = '';
    evt.item.style.cursor = '';

    if (!this.layerSystem?.reorderLayers) return;

    const oldIndex = parseInt(evt.item.dataset.layerIndex, 10);
    if (Number.isNaN(oldIndex)) return;

    // ★ ここを変更：evt.newIndex ではなく、ドロップ先要素の属性を使う
    // evt.related = ドロップ先の隣接要素（SortableJS が設定する）
    const relatedEl = this.container.children[evt.newIndex];
    //    ↑ evt.newIndex は「DOM 上の位置」として container.children への参照に使う
    const newIndex = relatedEl
        ? parseInt(relatedEl.dataset.layerIndex, 10)
        : null;

    const draggedLayer = this.layerSystem.getLayers()[oldIndex];
    const finalTarget = this._findFolderDropTarget(evt, draggedLayer);
    const targetFolderId = this._dragFolderTargetId || finalTarget?.folder?.layerData?.id;

    this._finishFolderDrag();
    this._dragFolderTargetId = null;

    if (targetFolderId && this.layerSystem.moveLayerIntoFolder) {
        this.layerSystem.moveLayerIntoFolder(draggedLayer?.layerData?.id, targetFolderId);
    } else if (newIndex !== null && !Number.isNaN(newIndex) && newIndex !== oldIndex) {
        this.layerSystem.reorderLayers(oldIndex, newIndex);
    } else {
        // 移動なし or 判定失敗 → パネルを現在状態で再描画して表示を確定
        this.requestUpdate();
    }
}
```

> **補足**: SortableJS が DOM を操作した後に `render()` が呼ばれてすべて再構築されるため、
> `evt.newIndex` を `container.children[evt.newIndex]` への参照に使っても
> SortableJS の DOM 変更後の位置を指すので正しく動く。

---

## Bug 3 — 中・症状Aの原因（フォルダへのレイヤー追加時）

### 場所
`system/layer-system.js` — `addLayerToFolder()` メソッド

### 原因
`addLayerToFolder()` はレイヤーの `parentId` を設定するだけで、フォルダの `folderExpanded` を変更しない。
フォルダが閉じている状態でレイヤーが追加されると、`_isLayerHiddenByClosedFolder()` が `true` を返し、
パネルから永続的に消える。History の redo 経由でも同様に発生する。

```js
// ❌ 現在の問題コード
addLayerToFolder(layerId, folderId) {
    // ...（中略）
    if (!folder.layerData.addChild(layerId)) return false;
    layer.layerData.parentId = folderId;
    // ↑ folderExpanded が false のままだと、このレイヤーはパネルに表示されない！
    this._emitPanelUpdateRequest();
    // ...
}
```

### 修正方法

```js
// ✅ 修正後：フォルダを強制展開してからレイヤーを追加
addLayerToFolder(layerId, folderId) {
    const layers = this.getLayers();
    const layer = layers.find(l => l.layerData?.id === layerId);
    const folder = layers.find(l => l.layerData?.id === folderId);

    if (!layer || !folder || !folder.layerData?.isFolder) return false;
    if (layer.layerData?.isBackground) return false;

    if (!folder.layerData.addChild(layerId)) return false;

    layer.layerData.parentId = folderId;

    // ★ 追加: フォルダを展開してレイヤーが見える状態にする
    folder.layerData.folderExpanded = true;

    this._emitPanelUpdateRequest();

    if (this.eventBus) {
        this.eventBus.emit('layer:added-to-folder', { layerId, folderId });
        // folder:toggled も発行してパネル側のトグルアイコンを更新
        this.eventBus.emit('folder:toggled', {
            folderId,
            expanded: true
        });
    }

    return true;
}
```

---

## Bug 4 — 中・症状Cの直接原因（ゴースト選択・枠のズレ）

### 場所
`ui/layer-panel-renderer.js` — `_applyActiveLayerState()` と `_setupEventListeners()` の
`layer:activated` ハンドラ

### 原因
`layer:activated` イベントを受信すると `_applyActiveLayerState(layerIndex)` が即座に呼ばれ、
DOM の `data-layer-index` 属性と `layerIndex` を比較して枠を更新する。

しかし Bug 1 / Bug 2 でシーングラフや配列のインデックスがズレていると、
「正しい `layerIndex` の値を持つが別のレイヤーを指す要素」にアクティブ枠が付く。

また `_applyActiveLayerState` は `borderColor` / `borderWidth` しか更新しない。
`rowWidth`（アクティブ時に160px）や `background-color` はリセットされないため、
フル再描画（`render()`）が終わるまで前の状態が残る。これがゴーストとして見える。

```js
// ❌ 問題となるパターン
this.eventBus.on('layer:activated', ({ layerIndex }) => {
    this._applyActiveLayerState(layerIndex);
    // ↑ 古い DOM（インデックスがズレている可能性）に対して枠を適用してしまう

    if (this._layerAttributePopup?.classList.contains('show')) {
        this._retargetLayerAttributePopup(layerIndex);
    }
    this.requestUpdate();
    // ↑ 16ms 後に render() でリセットされるが、それまでゴーストが見える
});
```

### 修正方法

`_applyActiveLayerState()` の高速更新は廃止し、`requestUpdate()` だけを呼ぶ。
16ms の遅延は実用上問題ない。

```js
// ✅ 修正後：高速更新を廃止してフル再描画だけにする
this.eventBus.on('layer:activated', ({ layerIndex }) => {
    // ★ _applyActiveLayerState の即時呼び出しを削除
    // （インデックスがズレていると逆効果になるため）

    if (this._layerAttributePopup?.classList.contains('show')) {
        this._retargetLayerAttributePopup(layerIndex);
    }

    // requestUpdate() のデバウンスで 16ms 後に render() が呼ばれ正しく描画される
    this.requestUpdate();
});
```

> **補足**: `_applyActiveLayerState()` メソッド自体は削除しなくてよい。
> ただし呼び出し元が `layer:activated` ハンドラだけなら、そこの呼び出しを削除すれば足りる。

---

## Bug 5 — 軽微・フォルダ削除 undo 後の孤立レイヤー

### 場所
`system/layer-system.js` — `deleteLayer()` のフォルダ削除分岐

### 原因
フォルダを削除するとき、子レイヤーを先に削除してからフォルダを削除する。
しかし各子削除は個別の History エントリになるため、undo 時に復元順序が逆になり、
フォルダが復元されないまま子だけ復元されて `parentId` が孤立する。

また、稀なケースとして削除ループ中のインデックスズレで子の削除が1件失敗し、
孤立した `parentId` を持つレイヤーが残る可能性がある。

### 修正方法（優先度低・後回し可）

子削除とフォルダ削除を単一の Composite コマンドにまとめる。

```js
// ✅ フォルダ削除時のコード改善例（deleteLayer 内のフォルダ分岐）
if (layer.layerData?.isFolder) {
    // 子をインデックス降順で先に収集（削除でインデックスがズレないよう逆順）
    const children = this.getFolderChildren(layerId);
    children.reverse(); // 後ろのインデックスから削除するとズレない

    // ★ Composite コマンドで子+フォルダをまとめて1回の履歴エントリにする
    const childDeleteCommands = children.map(child => {
        const childIdx = this.getLayerIndex(child);
        // 子の do/undo ロジックを個別のコマンドオブジェクトとして返す
        return this._buildDeleteCommand(child, childIdx);
    });
    const folderDeleteCommand = this._buildDeleteCommand(layer, layerIndex);

    if (historyManager && !historyManager.isApplying) {
        const composite = historyManager.createComposite(
            [...childDeleteCommands, folderDeleteCommand],
            'folder-delete-with-children'
        );
        historyManager.push(composite);
    }
    return true;
}
```

> **注意**: `_buildDeleteCommand()` ヘルパーは現行 `deleteLayer()` 内の
> `do`/`undo` 定義を抽出してリファクタリングする必要がある。
> 工数が大きい場合は「undo 後に孤立 parentId が残ったら _isLayerHiddenByClosedFolder が
> 誤判定しないことを確認する」だけでも当面は許容できる（実際に誤判定しないことは確認済み）。

---

## 修正の優先順位と実施順序

| 優先度 | Bug | 期待効果 | 工数 |
|---|---|---|---|
| **1** | Bug 1: `reorderLayers` の live array splice 廃止 | 症状B・C の主因解消 | 小 |
| **2** | Bug 2: `onEnd` の newIndex 変換を data-layer-index ベースに変更 | 症状A・C の主因解消 | 小 |
| **3** | Bug 4: `_applyActiveLayerState` 即時呼び出しの削除 | 症状C（ゴースト）の解消 | 極小 |
| **4** | Bug 3: `addLayerToFolder` でフォルダ自動展開 | 症状A の一部解消 | 極小 |
| **5** | Bug 5: フォルダ削除 Composite コマンド化 | undo 後の孤立防止 | 大 |

Bug 1→2→4→3 の順に修正することを推奨。Bug 5 は後続フェーズ対応で可。

---

## D&D設計提案書（Claude提案_DnD_設計提案書.md）との関係

Bug 1・2 は**まさに提案書が指摘した SortableJS の構造的限界**が顕在化したもの。

> 「SortableJSはフラットリストの並び替え専用であり、  
>  ツリー操作（階層移動）には根本的に向いていない」

- Bug 2（onEnd の newIndex ズレ）: SortableJS が非表示アイテムを認識できないことによる
- Bug 1（live array splice）: SortableJS の onEnd を受けて自前インデックス計算を補うために
  生まれた実装ミス

**上記 Bug 1〜4 の修正は「止血」**。  
提案書の選択肢C（Pointer Events 完全自前実装）への移行が長期的な根本解決となる。  
移行後は `initializeSortable()` ごと削除でき、Bug 1・2 は消滅する。

---

## 受け入れ確認（修正完了の判定基準）

修正後、以下をすべて確認してから完了とする。

- [ ] レイヤーを上下にドラッグして並べ替えた後、パネルの順序が正しく反映される
- [ ] フォルダ内に子レイヤーがある状態でドラッグしても、パネル表示が壊れない
- [ ] 新規レイヤー追加後、必ずパネルに表示される（何度繰り返しても）
- [ ] 選択中レイヤーとステータスバーの「Layer:」表示が一致している
- [ ] 前の選択レイヤーにゴースト枠が残らない
- [ ] undo / redo 後もパネル表示が正しい
- [ ] フォルダへレイヤーを追加後、フォルダが展開されて子レイヤーが見える

---

*Claude 作成 / 2026-05-22*
