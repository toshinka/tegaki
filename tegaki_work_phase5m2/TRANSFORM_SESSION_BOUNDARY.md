# Transform Session Boundary

更新日: 2026-06-20

## 目的

Phase 5cで構築したLayer変形と、Phase 5dで追加するpixel selection変形が共有すべき境界を記録する。
操作入口はV単独を維持する。
Ctrl+Tはブラウザの新規タブ予約ショートカット、T単独は将来のText tool候補のため採用しない。

## 現行Layer全体変形

### 開始

- `LayerSystem.enterLayerMoveMode()` が対象Layer IDと開始時transformをsessionへ保持する。
- `LayerTransform` はContainer transformによるpreviewを担当する。
- Background、Folder、CAF animation contextでは開始しない。

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
| Folder | 変形対象外 |
| Background | 変形対象外 |
| CAF internal Layer | 現行は対象外。working Layer同期とCAF Historyの統合前に有効化しない |

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

## 制約

- CAF internal Layerへ接続する場合、通常Layer HistoryではなくCAF Raster履歴adapterを使う。
- exportとthumbnailへcamera view flipを焼き込まない。
- selection preview中に元pixelとfloating pixelを二重表示しない。
