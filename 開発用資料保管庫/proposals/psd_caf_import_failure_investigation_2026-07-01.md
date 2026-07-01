# PSD Active CAF import破壊調査 2026-07-01

## 目的

PSDをアクティブCAFへ取り込んだ後、別CAFへ同じPSDを再取り込みしたり、PSD由来の内部フォルダをV変形したりすると、Canvas表示が欠落し、その後の描画がサムネイルにだけ反映される症状を調査する。

この文書は実装前の調査・計画書であり、ここでは修正を行わない。

## 再現メモ

- `開発用資料保管庫/画像資料/TEST.psd`
  - PSD document: 900 x 1031
  - entries: 34
  - raster layers: 28
  - folders: 6
  - 最大bounds: `背景`, left -10, top -23, right 910, bottom 1300
- 手順例:
  1. CAF1へPSD import
  2. UndoまたはCAF2作成
  3. CAF2へPSD import
  4. レイヤーカードやサムネイルには構造が残るが、Canvas表示が欠落する
  5. 以後の描画・importもCanvasへ出ず、サムネイルにだけ反映されることがある
- 別手順:
  1. CAFへPSD import
  2. 内部フォルダを選択
  3. Vキーで拡縮/回転
  4. 確定後に遅延し、Canvas表示が消えることがある

## 現状構造の確認

### モデルは素材と配置を分離している

`tegaki_work/system/animation/animation-data-model.js`

- `ClipAssetModel`
  - CAF素材本体。
  - `internalLayers` と `drawingSnapshotId` を持つ。
- `ClipAssetInternalLayerModel`
  - CAF内部Layer/Folder。
  - Raster Layerは `drawingSnapshotId` で `DrawingSnapshotModel` を参照する。
- `ClipInstanceModel`
  - Timeline上の配置インスタンス。
  - `assetId` で `ClipAssetModel` を参照し、`transform` は配置側にある。

したがって、別AIの第一候補だった「素材アセットと配置インスタンスがまったく分離されていない」は、モデル定義上は当たらない。ただし、後述のbridge/history経路でこの契約が弱まっている。

### PSD importerはPSDオブジェクトをそのまま保持していない

`tegaki_work/system/psd-importer.js`

- `readPsd(... useImageData: true ...)` でPSDを読む。
- 各PSD layerを `imageData` から取り出し、alpha boundsでtrimする。
- `DrawingSnapshotModel({ pixels: Uint8ClampedArray, rasterBounds })` と `ClipAssetInternalLayerModel` へ変換する。
- import履歴は新しい `_captureActiveCafAssetHistoryState()` / `_recordActiveCafAssetHistoryFromStates()` を優先する。

PSD由来のCanvas / layer object / PSD nodeをそのままTimelineへ渡している形ではない。PSDそのものの参照共有より、取り込み後のCAF runtime bridgeが主疑い。

### Pixi DisplayObject再親子化は主因候補として低い

`tegaki_work/ui/animation-table-popup.js`

- CAF previewはsnapshot pixelsから `Texture.from(canvas)` を作り、表示ごとに `new Sprite(texture)` する。
- preview containerの破棄時はSpriteだけをdestroyし、cache textureは別管理する。

`tegaki_work/system/layer-system.js`

- `restoreLayerRasterSnapshot()` はsnapshot pixelsから一時Canvas/Texture/Spriteを作り、対象LayerのRenderTextureへ焼き込む。
- working layerのDisplayObjectをTimeline/previewへ再parentしている形ではない。

同じ `PIXI.Sprite` / `Container` を別Containerへ `addChild` して元表示が外れる、という説明は現状コードとは噛み合いにくい。

## 破壊的変更が起きうる候補

### P0: CAF内部Layer履歴が全clipAssets / 全drawingSnapshotsを丸ごと復元する

`tegaki_work/ui/animation-table-popup.js`

対象:

- `_captureInternalLayerHistoryState(asset)`
- `_restoreInternalLayerHistoryState(assetId, state)`
- `_recordInternalLayerHistory()`
- `_recordInternalLayerHistoryFromStates()`

問題:

- 名前は「internal layer history」だが、実際には `this.model.clipAssets` 全体と `this.model.drawingSnapshots` 全体をcaptureする。
- restore時は `this.model.clipAssets = ...` と `this.model.drawingSnapshots = ...` で全差し替えする。
- 単一CAF内部Layer/Folderの操作で、別CAFのasset/snapshot配列まで巻き戻せる。

症状との一致:

- CAF1 import後にCAF2 import、またはUndo/Redoを挟んだ後の破壊に合う。
- PSD import後のV変形はこの履歴経路を使うため、PSD由来の多数snapshotを持つ状態で全配列復元が発生する。
- Canvas表示が死に、サムネイルだけ更新される状態は、working layer側とTimelineModel側の参照整合が崩れた時に起きやすい。

判断:

- 最優先で切るべき候補。
- import本体ではなく、import後の変形・内部Layer操作・Undo/Redoが危険。

### P0: CAF V変形確定が旧internal-layer全体履歴へ戻っている

`tegaki_work/ui/animation-table-popup.js`

対象:

- `keyboard:vkey-state-changed`
- `layer:transform-exit`
- `_confirmInternalFolderPeerTransforms()`
- `_saveSelectedClipFromWorkingLayers({ force: true })`
- `_recordInternalLayerHistoryFromStates(..., 'caf-internal-layer-transform', ...)`

問題:

- PSD importは対象CAF assetだけのscoped historyへ寄せている。
- しかしCAF内部Layer/FolderのV変形は、確定後に旧 `_captureInternalLayerHistoryState()` / `_restoreInternalLayerHistoryState()` を使う。
- つまり「PSD importの安全化」と「PSD後のV変形」の履歴契約が一致していない。

症状との一致:

- 「PSDを入れてフォルダV変形すると消える」に強く一致する。
- folder transformは複数working layerを同時に焼くため、失敗時rollbackも旧restoreに流れやすい。

判断:

- `caf-internal-layer-transform` は対象asset scoped historyへ移行する。
- rollbackにも `_restoreActiveCafAssetHistoryState()` 相当を使う。

### P1: working Layerのdirty判定がsnapshotId一致だけに依存する

`tegaki_work/ui/animation-table-popup.js`

対象:

- `_saveSelectedClipFromWorkingLayers()`
- `_hasDirtyWorkingLayersForClip()`
- `_markWorkingLayerSnapshotIds()`
- `_invalidateWorkingLayerSnapshotId()`

問題:

- dirty判定は `targetLayer.layerData.animationSnapshotId !== internalLayer.drawingSnapshotId` が中心。
- RenderTexture内容、rasterBounds、visible/opacity/parent/transform同期の破綻はsnapshotId一致だけでは検出できない。
- どこかの操作が `animationSnapshotId` を残したままRenderTextureを破壊/blank化すると、`_saveSelectedClipFromWorkingLayers()` がno-opになる。

症状との一致:

- Canvasへ描いても正本へ入らず、サムネイル/working layer側だけが動く状態を説明しうる。
- PSD import後に一度目の選択やCAF1/CAF2切替で掴みづらい状態にもつながる。

判断:

- dirty判定にcontent revisionまたは軽量signatureを追加する。
- 少なくともdebug検査で `snapshotId`, `rasterBounds`, `RenderTexture size`, `visible`, `selectedAssetId` を出す。

### P1: Timeline全体履歴はsnapshot pixelsを共有している

`tegaki_work/ui/animation-table-popup.js`

対象:

- `_captureTimelineModelHistoryState()`
- `_cloneDrawingSnapshotForRuntime(snapshot, { sharePixels: true })`
- `_restoreTimelineHistoryState()`

問題:

- Timeline全体履歴はメモリ削減のためsnapshot pixelsをcloneせず共有する。
- `DrawingSnapshotModel` constructorも `options.pixels` をそのまま保持する。
- snapshot pixelsが完全不変なら成立するが、どこかでin-place mutateされると履歴・現モデル・別CAFが同じpixel bufferを共有しうる。

症状との一致:

- 直接の第一候補ではない。
- ただし、PSD importや複数CAFでsnapshot数が増えるほど、共有前提の危険が増える。

判断:

- まずはP0/P1のscoped history化で切る。
- それでも再発する場合、Timeline historyはclone policyを見直す。

### P2: snapshot GCがグローバルに走る

`tegaki_work/ui/animation-table-popup.js`

対象:

- `_collectUnreferencedDrawingSnapshots()`
- `_restoreCafRasterHistoryState()`
- `_recordCafRasterHistory()`

問題:

- `model.clipAssets` から参照されない `drawingSnapshots` を一括削除する。
- 通常時は妥当だが、import/restore/transform中に一時的に参照が外れた状態で呼ぶと、必要snapshotを消す。
- 履歴stateやworking layerは正本参照ではないため、GCが正本更新途中に走ると欠落を作れる。

症状との一致:

- 「一部だけ読み込む」「背景だけ残る」系の欠落に合う可能性がある。

判断:

- GC前に参照整合検査を入れる。
- import/restore/transform中はGCを遅延するか、対象asset scopedに限定する。

### P2: restore失敗時のworking layer blank化が後続状態を曖昧にする

`tegaki_work/ui/animation-table-popup.js`

対象:

- `_syncClipAssetToWorkingLayers()`

問題:

- `restoreLayerRasterSnapshot()` が失敗するとblank snapshotをrestoreし、working layerを非表示にする。
- 失敗自体は守りとして正しいが、その後の選択/dirty判定/履歴記録が「復元失敗したCAF」をどう扱うか明確ではない。

症状との一致:

- Canvas表示が消えるがLayer構造は残る状態に合う。

判断:

- restore失敗時は操作を中断し、対象assetへ保存しない。
- debug時はfailureを明示し、selected stateを退避状態へ戻す。

### P3: 素材/配置の責務混線

対象:

- `ClipInstanceModel.rasterSnapshot`
- `clip.rasterSnapshot = captured.rasterSnapshot`
- `TimelineFrameCompositor`

問題:

- 現在も互換用に `ClipInstanceModel.rasterSnapshot` が残っている。
- assetIdを持つClipでは主にClipAssetを使うが、一部fallbackやpreview/export互換が残る。

判断:

- 今回の主因候補ではない。
- 長期的には、assetIdありのclipでは `clip.rasterSnapshot` を使わない契約を明文化する。

## 不変条件

以後の改修では、次を破ってはいけない。

1. `ClipAsset` はCAF素材正本、`ClipInstance` はTimeline配置正本である。
2. `ClipAssetInternalLayer.drawingSnapshotId` は、必ず `TimelineModel.drawingSnapshots` 内のsnapshotを参照する。
3. 単一CAF内部Layer/Folderの操作で、他CAFの `clipAssets` / `drawingSnapshots` を差し替えない。
4. `selectedCelId`, `selectedAssetId`, `activeLaneId`, `selectedInternalLayerId` は、working layer同期前に対象CAFへ揃える。
5. `_syncClipAssetToWorkingLayers()` 後、drawable internal layer数とworking raster layer数、各 `animationSnapshotId` が一致する。
6. `restoreLayerRasterSnapshot()` が失敗した場合、その失敗状態をCAF正本へ保存しない。
7. `DrawingSnapshotModel.pixels` は正本上では不変として扱う。加工する場合は必ず新しい `Uint8ClampedArray` と新snapshot idを作る。
8. snapshot GCは、全asset参照が整合している時だけ走らせる。
9. Timeline構造操作だけがTimeline全体履歴を使う。単一CAF asset操作はasset scoped履歴を使う。
10. WebGPU / DPR変更 / 内部2倍RenderTexture / 保存形式変更には踏み込まない。

## 診断slice

### Slice A: debug限定のCAF graph検査

新規または既存debug helperとして、`TEGAKI_CONFIG.debug === true` の時だけ以下を検査する。

候補名:

- `validateCafGraphState(context)`
- `collectCafGraphDebugState(context)`

出力項目:

- `context`
- `selectedCelId`
- `selectedAssetId`
- `activeLaneId`
- `selectedInternalLayerId`
- selected clip id / assetId
- target asset id
- `model.clipAssets.length`
- `model.drawingSnapshots.length`
- assetごとのsnapshot参照数
- missing snapshot refs
- duplicate snapshot ids
- working layer ids
- working layer `animationSnapshotId`
- working layer RenderTexture width/height
- working layer rasterBounds
- restore failures

挿入候補:

- PSD import直前/直後
- `_syncClipAssetToWorkingLayers()` 開始/終了
- `_saveSelectedClipFromWorkingLayers()` 開始/終了
- `_captureInternalLayerHistoryState()` / `_restoreInternalLayerHistoryState()`
- `_captureActiveCafAssetHistoryState()` / `_restoreActiveCafAssetHistoryState()`
- `layer:transform-exit` のconfirm/rollback前後
- `_collectUnreferencedDrawingSnapshots()` 前後

このsliceでは修正しない。missing refsまたはselected mismatchが出るかを先に見る。

### Slice B: `TEST.psd` 固定再現

固定操作:

1. 新規400x400
2. Animation Tableを開く
3. CAF1へ `TEST.psd` をキャンバス内フィットでimport
4. CAF2を作る
5. CAF2へ同じPSDをimport
6. CAF1/CAF2を切り替える
7. 各CAFのCanvas表示、Layer panelサムネ、内部Layer refsを確認
8. CAF2内部FolderをV変形して確定
9. Undo / Redo
10. penで追描画し、Canvasとサムネの両方に反映されるか確認

合格条件:

- missing snapshot refs 0
- selected clip/asset mismatch 0
- restore failures 0
- Canvas表示とサムネが一致
- import履歴はCAF1/CAF2それぞれ1entry相当
- Undo/Redo後もCAF1/CAF2の表示が崩れない

## 最小改修計画

### Slice 1: CAF内部Layer/Folder履歴をasset scopedへ置換

対象:

- `_captureInternalLayerHistoryState()`
- `_restoreInternalLayerHistoryState()`
- `_recordInternalLayerHistory()`
- `_recordInternalLayerHistoryFromStates()`
- CAF transform confirm/cancel path

方針:

- 既存の `_captureActiveCafAssetHistoryState()` / `_restoreActiveCafAssetHistoryState()` を共通化し、単一CAF asset操作の標準履歴にする。
- `caf-internal-layer-transform` はTimeline全体でも全clipAssetsでもなく、対象assetと参照snapshotだけを記録する。
- rollbackも対象asset scoped restoreで行う。
- 旧 `_restoreInternalLayerHistoryState()` はTimeline全体操作に流用しない。残す場合も名前を危険なものとしてコメントし、新規呼び出しを禁止する。

期待効果:

- CAF1の履歴がCAF2のasset/snapshot配列を巻き戻す問題を遮断する。
- PSD import後のV変形が全モデル復元を起こさない。

### Slice 2: working layer同期後の検査と失敗時rollback

対象:

- `_syncClipAssetToWorkingLayers()`
- `restoreLayerRasterSnapshot()`
- `layer:transform-exit`

方針:

- restore失敗をboolで集約し、1つでも失敗したらCAF正本保存へ進まない。
- 失敗時はbefore scoped stateへrollbackし、toast/debug logを出す。
- sync後に `animationSnapshotId` とasset snapshot refsが一致することをdebug assertする。

期待効果:

- Canvasがblank化した状態を「同期済み」として扱わない。

### Slice 3: dirty判定をsnapshotIdだけに依存しない

対象:

- `_hasDirtyWorkingLayersForClip()`
- `_markWorkingLayerSnapshotIds()`
- `_invalidateWorkingLayerSnapshotId()`
- layer transform / image import / fill / brush / selection paths

方針:

- まずは軽量に `layerData.animationSnapshotId = null` を漏れなくする検査を入れる。
- 必要なら `animationSnapshotSignature` を導入する。
  - `snapshotId`
  - `renderTexture.width/height`
  - `rasterBounds`
  - `visible`
  - `opacity`
  - `parentId`
- signature不一致ならdirty扱いにする。

期待効果:

- RenderTextureやboundsだけが変わったのに保存されない経路を減らす。

### Slice 4: snapshot GCの安全化

対象:

- `_collectUnreferencedDrawingSnapshots()`

方針:

- GC前に全assetの参照検査を行う。
- missing refがある場合はGCしない。
- import/restore/transform中はGCを遅延し、操作完了後に一回だけ走らせる。
- debug時は削除予定snapshot数と、各assetの参照数を出す。

期待効果:

- 一時的な不整合で必要snapshotを消す事故を防ぐ。

### Slice 5: Timeline全体履歴のclone policy確認

対象:

- `_captureTimelineModelHistoryState()`
- `_restoreTimelineHistoryState()`
- `DrawingSnapshotModel`

方針:

- P0/P1修正後も再発する場合だけ着手する。
- `sharePixels: true` を維持するなら、snapshot pixels不変の契約をassertする。
- 破壊が残る場合は、Timeline全体履歴も対象snapshotだけcloneする差分方式へ移行する。

期待効果:

- 大容量CAFでの履歴メモリと安全性の両立を再設計できる。

## 棚上げ条件

次の場合は、PSD importの深追いを止める。

- Slice 1 / Slice 2後も、`TEST.psd` のCAF1→CAF2再importでWebGL context lossまたはCanvas描画不能が再現する。
- `restoreLayerRasterSnapshot()` が安全ピクセル数内でも不安定で、Pixi RenderTexture / texture GCの深い問題へ入る。
- 修正範囲が `TimelineModel` / `LayerSystem` / History全体の保存形式再設計に広がる。

棚上げ時の運用:

- PSD exportは維持する。
- Active CAF PSD importは「実験的」と明示するか、一時的に通常メニューから隠す。
- 代替として、PSDをflattenして1枚のRasterとしてimportする軽量モードだけ残す案を検討する。

## 判断

現時点では完全棚上げではなく、限定改修に進む価値がある。

根拠:

- PSD importer自体は素材変換をしており、PSDオブジェクト共有が主因ではなさそう。
- Pixi DisplayObject再親子化も主因として低い。
- 一方で、CAF内部Layer履歴が全clipAssets / 全drawingSnapshotsを差し替える明確な危険箇所がある。
- PSD importはすでにasset scoped historyへ寄せているが、PSD後に起きやすいV変形が旧履歴経路のまま残っている。

推奨:

1. まずdebug検査を入れ、`TEST.psd` 固定手順で missing refs / selected mismatch / restore failure を観測する。
2. 次にCAF内部Layer/Folder履歴をasset scopedへ置換する。
3. それでも残る場合だけ、Timeline全体履歴のpixel共有とsnapshot GCへ進む。
