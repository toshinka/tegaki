# Phase 5j — Timeline再生範囲・終端・ループ制御

更新日: 2026-06-21
状態: 実装途中（2026-06-21監査で要修正）

> [!IMPORTANT]
> 別AIによる部分実装を維持し、最初に
> `tegaki_work/PHASE5J_AUDIT.md` の修正必須項目を解消する。
> 現在はmodel helperとmarker描画入口だけが存在し、Phase完了条件は未達。

## 目的

Animation Tableの再生を、総Frame末尾固定から次の明示的な契約へ拡張する。

- 停止 / ループをUIから切り替える。
- 再生終端を総Frame末尾、最後のCAF終端、OUT markerから選ぶ。
- IN / OUT markerで部分再生範囲を指定する。
- 再生中、停止後、Frame手動移動、project / Album復元で同じ範囲を維持する。

既存の `ALL / LANE / SET` は「再生対象Lane」、IN / OUTは「時間範囲」として分離する。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE5J_HANDOFF.md`
5. `tegaki_work/PHASE5J_AUDIT.md`
6. `task-codex/phase5j.md`
7. `tegaki_work/PHASE4Z_BOUNDARY.md`
8. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/ui/animation-table-popup.js`
11. `tegaki_work/system/project-manager.js`
12. `tegaki_work/system/export-manager.js`

## 監査後の修正優先順位

1. `play()` から実効Lane集合をrange計算と `advanceFrame()` へ渡す。
2. constructor、totalFrames変更、History復元、project復元を共通正規化へ接続する。
3. loop / endMode / IN / OUTの小型UIと1操作1Historyを追加する。
4. marker CSSと解除操作を追加し、未使用range計算を除去する。
5. 保存復元、Export独立、Timeline既存gestureをブラウザ回帰する。

最初の修正sliceでは1と2を完了し、固定入力と実再生sequenceを一致させる。
UI追加とHistory接続を同時に広げない。

## 現行コードで確認済みの境界

- `TimelineModel.playback` は `currentFrame` と `loop` を持ち、serialize済み。
- `TimelineModel.advanceFrame()` は総Frame末尾でloopまたは停止する。
- `AnimationTablePopup.play()` はsetIntervalで `advanceFrame()` を呼ぶ。
- 再生対象Laneは `playbackScope = all / activeLane / includedLanes` が正本。
- Timeline headerには再生、Scope、Preview、Onion、FPS、総Frame入力がある。
- Ctrl+Click、Shift操作、Timeline pan、Clip作成・削除の既存gestureがある。
- Export popupは独自の開始 / 終了Frame入力を持つ。

## データ契約

`TimelineModel.playback` を次へ拡張する。

```text
currentFrame: number
loop: boolean
endMode: "timeline" | "last-clip" | "out-marker"
inFrame: number | null
outFrame: number | null
```

- Frame値は内部0-origin、UI表示は1-origin。
- `timeline`: 終端は `totalFrames - 1`。
- `last-clip`: 現在のplayback scope内で最後に存在するCAFの終了Frame。
- `out-marker`: 有効な `outFrame`。未設定時はtimelineへ安全fallbackする。
- 開始Frameは有効な `inFrame`、未設定時は0。
- `inFrame <= outFrame` を維持する。
- totalFrames縮小時はmarkerを範囲内へclampする。
- 旧データで新fieldが無い場合は、現行互換のtimeline終端・loop有効として読む。
- playback設定はTimelineModel serialize経路でproject / Albumへ保存する。
- Export popupの開始 / 終了入力は別契約とし、自動上書きしない。

## Slice

### Slice 1 — 固定再生sequenceと境界helper

- 総Frame 12、CAF終端6、IN=2、OUT=8等の固定入力を作る。
- loop ON / OFF、各endMode、scope内CAFなしの期待sequenceを固定する。
- effective start / end、marker正規化、次Frame判定を純粋helperまたはTimelineModelの副作用なしmethodへ置く。
- まず現行 `advanceFrame()`、`play()`、停止時UI更新、Frame event境界を確認する。

### Slice 2 — TimelineModel契約と保存互換

- playbackへ `endMode / inFrame / outFrame` を追加する。
- `getPlaybackRange(options)` と範囲対応のadvance処理を追加する。
- last-clip終端は現在のplayback scopeに含まれるLaneだけから計算できる入力契約にする。
- totalFrames変更時のclampを共通methodへ寄せる。
- serialize / constructorで新旧データを往復する。
- 設定変更を既存Timeline History 1件でUndo / Redo可能にする。

### Slice 3 — Loop・終端基準UI

- play button付近へ小型loop buttonと終端mode buttonを追加する。
- loop ON / OFF、timeline / last-clip / OUTの状態をicon、active class、tooltipで明示する。
- 既存Lucide iconとCSS変数を再利用する。
- narrow表示でもplay buttonを押し出さない。
- playback scope、Preview、Onion、FPS、総Frame入力を変更しない。

### Slice 4 — IN / OUT marker

- 現在FrameをINまたはOUTへ設定する小型buttonを追加する。
- marker解除操作を明示buttonまたは同buttonの状態操作として持つ。
- Timeline ruler上へIN / OUT位置を表示する。
- 最初から修飾clickへ割り当てない。
- marker dragを追加する場合は共通Pointer D&DとClip retime/panの競合を確認し、独立handleだけをdrag対象にする。
- Frame移動、総Frame変更、CAF移動後にmarkerが不正化しないことを確認する。

### Slice 5 — 再生・保存・最終回帰

- loop OFFはeffective endで停止し、そのFrameを表示したままにする。
- loop ONはeffective endの次にeffective startへ戻る。
- 再生開始時にcurrentFrameが範囲外ならeffective startへ移動する。
- ALL / LANE / SETごとのlast-clip終端を確認する。
- project / Album保存復元、Undo / Redo、Animation Table再表示を確認する。
- PNG / APNG / GIF Exportの独自範囲入力が変わらないことを確認する。
- `PROGRESS.md`、proposal、要望メモを同期し、完了時に本書とhandoffをArchiveへ移す。

## 受け入れ条件

- loop ON / OFFをAnimation Tableから切り替えられる。
- timeline / last-clip / OUT markerの終端が期待Frameで動く。
- IN / OUT範囲で停止・loop sequenceが一致する。
- ALL / LANE / SETの対象Laneだけでlast-clip終端を計算する。
- 再生中のFrame表示、CAF preview、Layer Panel同期が現行どおり更新される。
- totalFrames縮小、marker逆転、marker未設定を安全に正規化する。
- playback設定はproject / Albumで復元する。
- Export popupの開始 / 終了Frameを勝手に変更しない。
- 既存CAF作成・削除、Clip移動・retime、Timeline pan、Shift操作を壊さない。
- 新規console error、debug log、`dist/`、Vite cache差分を残さない。

## 対象外

- Export範囲とplayback markerの自動同期。
- 音声track、音声同期、秒単位marker。
- markerへの修飾click shortcut固定。
- ClipInstance keyframe、easing、graph UI。
- Lane完全独立化。
- Animation Tableを閉じた時のLane表示mode。
- Timeline DOM全面再構成。
- EventBus全件整理、History class化。

## 検証

```powershell
node --check tegaki_work/system/animation/animation-data-model.js
node --check tegaki_work/ui/animation-table-popup.js
node --check tegaki_work/system/project-manager.js
Set-Location tegaki_work
npm.cmd run build
```

Browser:

1. timeline末尾、最後のCAF終端、OUT markerでloop OFF停止。
2. 同条件でloop ONし、INまたは0へ戻る。
3. currentFrameが範囲外の状態から再生。
4. ALL / LANE / SETでlast-clip終端が変わる条件。
5. IN / OUT設定、解除、総Frame縮小、Undo / Redo。
6. Clip移動・duration変更後のlast-clip再計算。
7. project / Album保存復元。
8. Export popupの開始 / 終了値が独立していること。
9. consoleの新規errorなし。

build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
