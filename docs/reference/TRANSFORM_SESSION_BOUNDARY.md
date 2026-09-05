# Transform Session Boundary

<!-- Document relocated from tegaki_work/TRANSFORM_SESSION_BOUNDARY.md on 2026-09-06. -->

> 状態: REFERENCE — Phase別の設計変遷と詳細証拠。現在のSOURCE/ANIMATE/KEY連続編集は`docs/ARCHITECTURE.md`と`docs/STATUS.md`を優先する。本文冒頭のPhase 5限定説明を全contextへ一般化しない。

更新日: 2026-09-04

## 目的

Phase 5cで構築したLayer変形と、Phase 5dで追加するpixel selection変形が共有すべき境界を記録する。
操作入口はV単独を維持する。
Ctrl+Tはブラウザの新規タブ予約ショートカット、T単独は将来のText tool候補のため採用しない。

## 現行Layer全体変形

### 開始

- `LayerSystem.enterLayerMoveMode()` が対象Layer IDと開始時transformをsessionへ保持する。
- `LayerTransform` はContainer transformによるpreviewを担当する。
- Backgroundは開始しない。FolderはRaster子を持つ場合だけ対象にでき、CAF working Layer / FolderはAnimationTablePopupのadapter境界を使う。

### preview

- 移動、scale、rotation、flipはLayer Containerへ一時適用する。
- pixelとpathの保存正本はpreview中に変更しない。
- pointer captureを保持し、canvas外でpointerup / cancelしてもdragを終了する。
- 描画engineはVモード中のstroke開始を抑止する。

### confirm

- `LayerSystem.confirmLayerTransform()` が現在のContainer表示をRenderTextureへ一度焼き込む。
- 旧path情報がある場合は同じtransform行列をpathへ適用する。
- Container transformを既定値へ戻す。
- clipping maskを再構築する。
- 変形前後のRaster snapshotを1つのHistory commandへ記録する。

### cancel

- Escapeで開始時transformへ戻す。
- RenderTextureとHistoryを変更しない。
- `layer:transform-exit` は `cancelled: true` を通知する。

### Undo / Redo

- Undo: 変形前Raster snapshot + 既定Container transform。
- Redo: 焼き込み後Raster snapshot + 既定Container transform。
- preview用transformをUndo時に再適用しない。

## 対象別監査

| 対象 | Phase 5c時点 |
| --- | --- |
| 通常Raster Layer | preview / confirm / cancel / Undo / Redo対応 |
| path情報あり | Rasterを一度焼き込み、path座標も同じ行列で更新 |
| path情報なし | Raster snapshotとRenderTextureだけで完結 |
| clipping Layer | confirm後にclipping maskを再構築 |
| Folder | Raster子がある場合だけ複数target preview / confirm |
| Background | 変形対象外 |
| CAF internal Layer | animation working Layerを表示・入力adapterとして使い、confirm後はAnimationTablePopupがClipAsset / DrawingSnapshotとCAF Historyへ同期 |

## Phase 5dで再利用する責務

selection transformは別のUI数学を作らず、次をadapter化する。

1. 対象boundsとpivot。
2. 開始時Raster snapshot。
3. previewへ渡すtransform state。
4. confirm時の1回のRaster bake。
5. cancel時Snapshot復元。
6. History command生成。
7. pointer captureと描画入力抑止。

Layer全体とselectionの差は「対象Raster範囲とmask」であり、transform行列、confirm / cancel、History時系列は共有する。

## Phase 5dの接続状況

- `PixelSelectionSystem` にselection専用のfloating sessionを追加した。
- V開始時にselection範囲を元Rasterから除去し、Pixi Spriteでpreviewする。
- drag移動、V再入力confirm、Escape cancel、Ctrl+V floating pasteを実装した。
- 既存Layer transform panelをselection sessionへルーティングし、scale、rotate、horizontal / vertical flip、resetを共用する。
- 中心基準の変形行列は `system/transform-math.js` をLayer全体変形とselection変形から参照する。
- confirm時だけ移動先へ合成し、前後Raster snapshotを1つのHistory commandへ記録する。
- Undo / RedoはRasterとselection boundsを同時に復元する。
- project保存、画像preview、download前は未確定floating selectionを自動commitする。
- Ctrl+Dはfloating selectionをcommitしてからselectionを解除する。
- selection transform中のH / Shift+Hはselection水平 / 垂直反転を優先し、camera flipへ渡さない。
- preview対象はselection専用Pixi Sprite、保存正本は通常Layer RenderTextureのまま維持する。

## Phase 5hの接続状況

- 通常Layerとpixel selectionの純粋な平行移動は、確定時にx / yを整数化してRGBA bufferをshiftする。
- canvas外へ出たpixelは破棄し、空いた領域は透明化する。
- Layer全体とselectionは `system/raster-translation.js` の同じ純粋helperを使う。
- selection移動とfloating pasteの重なりは既存source-over合成を維持する。
- 回転・拡縮・flip・複合変形は従来の1回bake / Canvas2D fallbackを維持する。
- 永続transform state、原画像cache、保存形式変更は導入していない。

## Phase 9oの接続状況

- D hybrid BASICとしてCanvas frame、corner Uniform Scale、quiet side one-axis Scale、Rotate handleを既存LayerTransform sessionへ接続した。
- 初期 / Reset / Anchor button double clickはruntime content bounds中央。Anchor編集は現行sessionだけを変更し、Project schemaへ保存しない。
- Canvas handleだけScale下限`0.0001`とし、last-touched hit優先、Anchor越えflip、反転後再展開を許可する。
- `pointercancel`だけを現在gesture rollbackとし、`lostpointercapture`は喪失時点のpreviewを維持する。V confirm / Escape / Historyの意味は変えない。
- 拡大preview中だけunique textureをexact-pixel samplingへ切り替え、confirm / cancel前に元へ戻す。source Raster / exportを変更しない。
- animation working Layerの通常Layer Historyは記録せず、`layer:transform-exit`後にAnimationTablePopupがCAF internal source Historyを所有する。

## Phase 9p Transform-to-Clip Key Bridge Gate

- Table / primary Clip / current Frameから`SOURCE / ANIMATE READY / ANIMATE KEYED / BLOCKED`を`system/animation/transform-edit-context.js`でpure projectionする。Contextは保存しない。
- CAF全体の時間変形正本は既存`ClipInstance.transformKeyframes`。active internal Raster一枚だけの時間変形正本は`ClipInstance.layerTransformTracks[]`。対象範囲を混同せず、Historyはどちらも既存Timeline Historyを共有する。
- 現行CLIP MOTIONと将来Bridgeのfull composite key shapeは`system/animation/clip-transform-key-upsert.js`を共有する。
- samplerの暗黙base start / endを維持し、Stage B0ではbaseline keyを永続化しない。
- Layer Transform開始→現在のgesture差分は`system/animation/clip-transform-layer-gesture.js`でpureに求め、現在Frameのsampled Clip transformへ合成する。x / y / rotationは加算、scaleは符号付き比率とし、source Layerの絶対transformやRasterをkeyへ転記しない。
- Layer / ClipのAnchor context一致を必須とする。Anchor editはFrame-local transform keyへ暗黙変換せず拒否し、static / global authoringとして後続Gateへ送る。
- Stage B2 Gate 2=`GO — B: split owner + synchronous adapter`。LayerSystemはinput sessionとSOURCE、AnimationTablePopupはANIMATE preview / Timeline rollback / Historyを所有する。`layer:transform-exit`はRaster Bake後なのでANIMATE分岐に使わない。
- ANIMATE開始時のsampled Clip transform / keyframes / duration / Clip・Frame identityを固定し、各previewは同じbaselineから再計算する。READY入場だけではkeyを作らず、実変形の最初のpreviewで候補を作る。
- V confirmは変更ありならTimeline History 1、Escape / context変化 /開始位置復帰はrollbackしてHistory 0。handle pointercancelはhandle gestureだけを戻しsessionを閉じない。
- Stage B3で`AnimationTablePopup`のoptional同期adapterを`LayerSystem`へ注入した。SOURCEは従来のRaster Bake、ANIMATEはBake前の時間key preview / Timeline Historyへ分岐する。
- Stage B4のOwner correctionにより、Layer Transformはactive working Raster一枚だけを表示proxyとし、`layerTransformTracks`へ投影する。root `transformKeyframes`はCLIP MOTIONのCAF全体配置として残し、兄弟working Rasterを一括proxyにしない。
- Layer Motion trackは`internalLayerId / pivotX / pivotY / keyframes`だけを持つ。DrawingSnapshot、working Layer、RIG / Mesh、evaluated RenderIslandを保存正本にしない。
- Layer MotionのMove / Scale / Rotate / flipは固定baselineからtrackへ一時投影する。READY入場はkey 0、V再入力の実変更はTimeline History 1、Escape / no-opはHistory 0。
- compositorは対象Rasterだけを一Raster一RenderIslandとしてsampleする。RIG Part / Mesh / Skin / clipping splitと同一Rasterで重なる場合は二重変形せずunsupportedとする。
- Project serialize / validate、internal Layer削除、Clip copy / paste、structured bake、duration retime、Timeline History capture / restoreは同じ`layerTransformTracks`を参照する。
- Frame変更とTable closeは時間key sessionを即cancelする。rollbackはtargetに応じて`baselineKeyframes`または`baselineLayerTransformTracks`だけを戻し、新Frame選択など無関係なTimeline stateを巻き戻さない。
- Transform-local indicatorはproduction transactionに同期して`ANIMATE · F# READY / KEYED`を表示する。ANIMATE中のAnchorはFrame-local schema外なので編集不可とし、既存static Clip Anchorを維持する。
- app / browserのfocus移動だけではANIMATE sessionを確定しない。SOURCEの既存blur confirmは維持する。
- TimelineのLayer Motion KEYは対象internal Layer行だけへ7px単色丸で表示する。親Clip Motionのecho、Part / Bone菱形、WARP key、click actionとは別の読み取り専用表示とする。

## 制約

- CAF internal Layerへ接続する場合、通常Layer HistoryではなくCAF Raster履歴adapterを使う。
- exportとthumbnailへcamera view flipを焼き込まない。
- selection preview中に元pixelとfloating pixelを二重表示しない。
