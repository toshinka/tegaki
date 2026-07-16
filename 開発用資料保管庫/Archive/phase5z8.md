# Phase 5z8: 非破壊Canvas Resize / Camera分離

更新日: 2026-07-15

## 目的

Project frameの変更、保存Raster、CAF正本 / working adapter、Camera viewを分離する。Canvas-only Resizeでは保存pixelを切り取らず、`rasterBounds` とClip anchorのmetadata transactionだけで表示枠を変更する。content / both Resizeは immutable sourceを一度だけ変換し、Historyとworking同期を同じtransactionへ揃える。

Phase 5z7の欄外Raster capture / composite / merge / oversized guardは完了済みであり、本Phaseで別実装へ戻さない。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/00_計画索引.md`
6. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
7. `開発用資料保管庫/proposals/11_Animation_Table欄外Raster・Canvas_Resize整合性監査.md`
8. `開発用資料保管庫/Archive/phase5z7.md`
9. `tegaki_work/system/raster-bounds.js`
10. `tegaki_work/system/layer-system.js`
11. `tegaki_work/ui/resize-popup.js`
12. `tegaki_work/system/camera-system.js`
13. `tegaki_work/ui/animation-table-popup.js`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/` は調査・編集しない。

## Slice 0 — Canvas-only非破壊transaction（実装済み）

- Canvas resize時にRaster RenderTextureをProject寸法へ再確保しない。通常Layerは既存RTを保持し、整数alignment offsetだけ `rasterBounds` へ加える。
- DrawingSnapshot、legacy `clip.rasterSnapshot` も同じoffsetで移動する。
- Clip transformのnormalized anchorは、Project座標上の絶対pivotを維持するようrebaseする。
- animation working adapterは更新済みDrawingSnapshotから強制復元し、正本と表示adapterを分裂させない。
- clipping maskはframe変更後に再構築する。旧GPU textureはPixiの古いAlphaMask instructionが参照し終えるまで遅延destroyし、`BindGroup.getResource(null)` を起こさない。
- 通常Folder / CAF内部FolderのTransform preview対象は開始時に確定した全子孫IDを維持し、active working Layerの切替で先頭Layerだけへ縮退させない。

## Slice 1 — content / both Resizeの単一source化（実装済み）

- 通常Raster、CAF DrawingSnapshot、pixel正本を持つlegacy Clip snapshotを操作前に列挙する。
- animation working Layerは未保存内容を保存正本へ確定してからsource列挙から除外し、DrawingSnapshot変換後に復元する。
- source bounds、scale / alignment、出力bounds、vector path / brush size、Clip anchorをimmutable planへ固定してから適用する。
- 全出力のtexture axis / 16MP上限をCanvas確保前に検査する。途中適用失敗は操作前History stateへrollbackする。
- animation正本がない通常モードでは空Timeline stateをcapture / restoreせず、Layer表示を巻き込まない。
- boundsなし旧ProjectはProject originをfallbackとして維持する。

## Slice 2 — Resize Historyの軽量化とmemory preflight（実装済み）

- Canvas-onlyはpixel全複製を避け、旧新frame、通常Layer bounds、DrawingSnapshot / legacy snapshot bounds、Clip anchorだけをmetadata Historyへ保存する。Camera viewは現行挙動を維持し、将来の正本を混ぜない。
- content / bothは同じpixel bufferとboundsを共有するsourceを一度だけ変換し、alias先へ結果を配る。Layer固有vector pathは各targetのsourceから変換する。
- before / after Historyのpixel bufferを共有Setで数え、入力+出力の推定byteがHistory上限を超える場合はCanvas確保前に理由付きで中止する。失敗時rollbackはSlice 1の既存transactionを維持する。
- 固定入力でbuffer dedupe、metadata byte見積り、memory preflightの早期中止を確認した。Undo / Redo、Project / Album round-tripの実操作確認はSlice 0-1の結果を維持する。

## Slice 3 — Camera view分離（Phase 7以降へ設計分離）

- Phase 6のmesh / morphを先行し、Resize popupの大幅UI変更とAnimation Camera TrackはPhase 7以降へ棚上げする。
- View Camera、Project Frame / Resize、Animation Camera Trackを別正本とする契約を `proposals/12_Camera_Frame・Resize_UI将来設計.md` へ分離した。
- 現行ResizeのCamera再中心化は互換挙動として残す。Phase 5z8では将来Camera metadataをHistoryへ先行混入しない。

## 対象外

- 明示的な破壊trim、真の無限Project frame、tiled canvas。
- Motion Graph / Motion Path、mesh、morph、Bone、physics、WebGPU。
- D&Dのデータ契約変更。残る瞬間移動感はdrag ghost / transitionの視覚改善として別途扱う。

## 別系統の既知回帰

- Animation Table previewではClip MotionのADD等が作用する一方、GIF / APNG等のanimation exportでClip blendが失われる実制作報告がある。`blendMode / blendStrength` sampling、`TimelineFrameCompositor`のtransform後Clip合成、各exporterのframe取得を同じ固定入力で比較する後続回帰とし、Resize transactionへ混ぜない。

## 維持する契約

- `rasterBounds` が保存RasterのProject座標正本であり、Project frameは表示・出力範囲とする。
- CAF working Layerは表示・入力adapter、TimelineModel / ClipAsset / DrawingSnapshotは保存正本とする。
- stroke中working Layer、preview staging交換、preview container順、上側Lane前面を変更しない。
- PSD record順、Lane / Timeline onionのdisplay-only境界、Folder clipping契約を変更しない。

## 検証

- 変更JSを `node --check` する。
- center / corner alignment、奇数差、縮小→再拡大、anchor絶対pivotを固定入力で確認する。
- `npm.cmd run build` を行う。
- Browserで通常Layer / Folder、clipping、CAF内部Folder、欄外pixel、縮小後stroke、再拡大、Undo / Redo、Project / Album復元、console errorなしを確認する。
- build後に `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。

## 完了条件

- Canvas-only縮小で保存pixelが消えず、再拡大またはCamera移動で再表示できる。
- resize後に描画してもCanvas / mask / rendererが失効しない。
- content / bothが各保存sourceを一度だけ変換し、CAF正本とworking adapterが一致する。
- Undo / Redoと旧Project round-tripがbounds / anchor / active編集状態を維持する。
- Camera / Resizeの将来責務がPhase 6実装へ混入しない独立proposalとして固定される。

## 完了状態

- Slice 0〜2を実装し、固定入力、全変更JSの`node --check`、build、通常LayerのCanvas-only縮小 / Undo / Redo、内容75%縮小 / Undo / Redo、console errorなしを確認した。
- オーナー実機で外部保存Animation ProjectをAlbumから開き、Resize後に描画してもCanvasが破壊されないことを確認済み。
- Slice 3は中途半端なCamera正本を追加せず、Phase 7以降の `proposals/12_Camera_Frame・Resize_UI将来設計.md` へ移した。Phase 5z8内の実装残件はない。
- 完了後実機報告から、通常Folderのslider / wheelがFolder自身の空Containerだけをpreviewし、子孫Rasterは確定時に突然変わる経路を修正した。全入力を既存 `_applyFolderPreviewTransform()` へ戻し、重いpanel / thumbnail通知だけを1 animation frameへ集約する。
- CAF化後にTableを閉じた標準表示でも、内部Folder変形は開Table時と同じworking adapter / History境界を開始する。代表working Layerへ選択・変形が縮退せず、Folder選択正本と全子孫previewを維持する。
- 現行Folder正本を持たない旧Animation JSONでFolder一括Transformできない場合は許容互換とする。旧形式を推測して現行階層へ書き換える移行処理は追加しない。
