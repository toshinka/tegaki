# Phase 5f — Folder selection clipboard

更新日: 2026-06-20
状態: 完了

## 目的

通常Layer Folderを選択対象にした時、Canvas上の1つの選択範囲を配下Layerへ適用し、
Folder階層と各Layerの選択pixelを1つのclipboard payloadとしてcopy / pasteできるようにする。

Canvasへのpasteは新規Folderと配下Layerを作り、Animation Tableへのpasteは新規CAFの
internal Folder / Layerへ変換する。

## 現状

- `PixelSelectionSystem` の正本は単一の通常Layer IDとLayerローカルbounds。
- 通常Layer FolderはPixiの親子Containerではなく、`parentId` と並び順で階層を表現する。
- Layerごとにtransform、visibility、opacity、blend、clipping、RenderTextureを持つ。
- `LayerSystem.duplicateLayer()` はFolder本体だけを複製し、配下階層を複製しない。
- CAFは `ClipAsset.internalLayers` のFolder / Raster構造とDrawingSnapshotを保存正本にする。
- 単一Layer選択とCAF clipboard context routingは実装済み。

## 設計境界

### selection scope

- 既存の単一Layer選択は互換維持する。
- Folder選択時だけ `scope.kind = 'folder'` と対象Folder IDを持つ。
- 画面上の選択矩形は共通Canvas領域を正本とし、各Layerへ適用する際にLayerローカル領域へ変換する。
- transform済みLayerへ同じ数値boundsを直接流用しない。
- Background、Folderカード本体、animation working Layerはpixel対象に含めない。
- 閉じたFolderでも配下Layerは対象に含める。visibilityはclipboard metadataとして保持する。

### clipboard payload

新しいpayloadは単一Layer用clipboardを壊さず、判別可能なversion付き形式にする。

```text
kind: folder-pixel-selection
version: 1
copiedAt
canvasBounds
rootFolder
entries[]
  sourceId
  sourceParentId
  relativeParentKey
  order
  name
  visible
  opacity
  blendMode
  clipping
  transform
  width / height
  pixels
```

- IDはpaste先で再採番し、clipboard内では相対参照だけを使う。
- Rasterは選択範囲外を透明にしたCanvas寸法Snapshotか、座標付きregionのどちらかへ統一する。
- byteSizeを算出できるTypedArrayを維持する。
- OS clipboard画像との統合はPhase 5f対象外。

### History

- Folder作成、配下Layer作成、階層設定、Raster復元を1つのcomposite commandとして記録する。
- 子Layerごとの `layer-create` 履歴は抑止する。
- Undoで作成物を全て除去し、Redoで同じID・順序・親子・Raster・選択状態を復元する。
- cut / deleteは対象全Layerの前後Snapshotを1 commandへまとめ、`byteSize`を計上する。
- History class階層は新設せず、現行 `{ name, do, undo, byteSize, meta }` 契約を使う。

### CAF変換

- Animation Table contextでFolder clipboardをpasteした場合、新規ClipAssetを作成する。
- 通常Folder / Layer階層をCAF internal Folder / Raster Layerへ変換する。
- Raster entryごとにDrawingSnapshotを作り、relative parent参照を新しいinternal Layer IDへ解決する。
- 通常Layer ID、History、RenderTextureをCAF保存正本へ持ち込まない。
- 貼り付け先Frame/Laneの空き判定とTimeline Historyは既存CAF paste経路へ揃える。

## Slice

### Slice 1 — target resolverとpayload `完了`

- Folder配下を順序付きで列挙するread-only helperをLayerSystemへ追加する。
- Canvas boundsから各Raster Layerのlocal boundsを解決する。
- Folder clipboard payloadの作成とvalidationを追加する。
- このsliceではpasteやHistory変更を行わない。

実装状態:

- `LayerSystem.getFolderSelectionTargets()` が入れ子Folderを含む配下要素を現在の表示順で列挙する。
- Folder scopeの矩形はCanvas座標を正本とし、overlayとCtrl+Aを通常Layer selectionと共用する。
- 各Raster LayerへCanvas矩形を逆変換し、回転・拡縮Layerではlocal AABB外周の余分なpixelを透明化する。
- `folder-pixel-selection` version 1 payloadへFolder階層、Layer属性、transform、local bounds、TypedArrayを保持する。
- payload validationとCoreRuntime read-only APIを追加した。
- Folder Ctrl+X / Delete / V変形 / pasteは後続sliceまで安全なno-opとする。
- `node --check`、`npm.cmd run build` 成功。
- BrowserでFolder配下Layer、矩形overlay、Ctrl+A全域選択、Ctrl+C、新規console errorなしを確認した。

### Slice 2 — 通常Layer Folder paste `完了`

- 新規Folderと配下Layerを一括作成する。
- 名前、順序、階層、visibility、opacity、blend、clipping、transform、選択pixelを復元する。
- Undo / Redoを1 commandとして実装する。

実装状態:

- Folder clipboardから新規root Folderと配下Folder / Raster Layerを一括生成する。
- 元の相対順序、親子、名前、visibility、opacity、blend、clipping、transformを復元する。
- 選択pixelをCanvas寸法の透明Rasterへ戻し、元のLayer local位置へ配置する。
- 個別のfolder / layer create Historyを抑止し、`folder-selection-paste` 1 commandへまとめる。
- `byteSize`へclipboard内TypedArray合計を計上する。
- Undo 1回で作成block全体をdetachし、元のactive / multi-selectionを復元する。
- Redo 1回で同じLayer object、ID、階層、Raster、selection scopeを復元する。
- BrowserでFolder copy / paste、階層、Undo / Redo、新規console errorなしを確認した。

### Slice 3 — cut / deleteと選択編集 `完了`

- Folder scopeのCtrl+X、Delete / Backspaceを全対象Rasterへ適用する。
- 単一Layer選択のfloating transformは維持する。
- 複数Layer同時transformはPhase 5f対象外とし、V操作時は明示的に非対応表示または安全なno-opにする。
- brush / fillをFolder全Layerへ同時適用する機能は対象外。選択範囲による描画制限はアクティブRaster Layerだけを維持する。

実装状態:

- Folder scopeのCanvas矩形を各Raster Layerへ逆変換し、矩形内pixelだけを透明化する。
- 回転・拡縮Layerは各pixel中心をCanvas座標へ戻して選択範囲内か判定する。
- Delete / Backspaceを`folder-selection-delete`、Ctrl+Xを`folder-selection-cut`のcomposite History 1 commandへまとめる。
- Undo / Redoで全対象Raster snapshotを一括復元し、History `byteSize`へbefore / after pixel量を計上する。
- Folder scopeのV変形は安全なno-opを維持する。
- BrowserでDelete、Cut本体、Undo / Redo、新規console errorなしを確認した。

### Slice 4 — Folder clipboardからCAF作成 `完了`

- 新規CAF internal Folder / LayerとDrawingSnapshotへ変換する。
- 空きFrame/LaneへClipInstanceを配置する。
- Timeline Undo / Redo、保存・復元、Album往復を確認する。

実装状態:

- Animation Table contextでは最新のFolder clipboardを単一Layer selection / CAF clipboardと時刻比較して選択する。
- 通常Folder rootと配下Folder / RasterをCAF internal Folder / Layerへ再採番して変換する。
- RasterごとにCanvas寸法のDrawingSnapshotを作成し、元transformをCanvas座標へ焼き込む。
- visibility、opacity、blend、clipping、相対親子、表示順をCAF内部へ維持する。
- 現在Frameのactive Lane、他の空きLane、独立Lane新設の順で配置先を解決する。
- `caf-clip-paste-folder-selection` Timeline HistoryへClipAsset、DrawingSnapshot、Lane追加を1 commandで記録する。
- History `byteSize`へ生成した全DrawingSnapshotのpixel量を計上する。
- BrowserでCAF作成、内部Folder / Raster、空きLane追加、Undo / Redo、Album保存復元、新規console errorなしを確認した。

## 受け入れ条件

- Folderを選択して矩形選択後、Ctrl+C / Ctrl+Vで新規Folderと配下Layerが作られる。
- 貼り付け後も階層、順序、名前、visibility、opacity、blend、clippingが一致する。
- 各Layerは選択範囲内のpixelだけを保持し、元のCanvas位置へ配置される。
- transform済みLayerを含んでもCanvas上の同じ矩形領域が切り出される。
- Undo 1回で貼り付けたFolder全体が消え、Redo 1回で完全復元する。
- cut / deleteもUndo 1回で全対象Layerが復元する。
- Animation Tableへpasteすると新規CAFが作られ、内部Folder / Layerとpixelが保存・復元される。
- 単一LayerのCtrl+C / Ctrl+V、CAF copy / paste、通常Layer Folder D&Dを壊さない。
- Historyの推定memory使用量へ全Raster payloadを計上する。

## 対象外

- 複数Layerの同時scale / rotate / warp。
- Folder配下全Layerへの同時brush / fill。
- CAF internal FolderをCanvas通常Folderへ逆変換する汎用import。
- OS clipboard画像、PSD、無限キャンバス。
- LayerSystemとClipAssetのdata model統合。

## 検証

```powershell
node --check tegaki_work/system/pixel-selection-system.js
node --check tegaki_work/system/layer-system.js
node --check tegaki_work/ui/animation-table-popup.js
Set-Location tegaki_work
npm.cmd run build
```

Browser:

1. 2枚以上のRaster Layerと入れ子Folder、transform済みLayerを用意する。
2. Folder scopeでcopy / pasteし、pixel位置と属性を確認する。
3. Undo / RedoでFolder全体を確認する。
4. cut / deleteのUndo / Redoを確認する。
5. Animation Tableへpasteし、CAF internal階層、Frame表示、保存・復元を確認する。
6. 単一Layer selectionと通常CAF copy / pasteを回帰確認する。

build後は `tegaki_work/dist/` とVite cacheの生成差分を残さない。
