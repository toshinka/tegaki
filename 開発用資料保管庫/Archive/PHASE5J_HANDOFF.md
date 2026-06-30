# Phase 5j Handoff

更新日: 2026-06-27

> 2026-06-27にPhase 5jは完了。本文は修正前の引き継ぎ記録としてArchiveへ保持する。

## 次チャットの目的

別AIが部分実装したPhase 5jを監査結果に沿って修正し、完了条件まで進める。
最初のsliceはplayback scope接続とmarker正規化境界の修正。

## 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE5J_HANDOFF.md`
5. `tegaki_work/PHASE5J_AUDIT.md`
6. `task-codex/phase5j.md`
7. `tegaki_work/PHASE4Z_BOUNDARY.md`
8. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`

その後:

1. `tegaki_work/system/animation/animation-data-model.js`
2. `tegaki_work/ui/animation-table-popup.js`
3. `tegaki_work/system/project-manager.js`
4. `tegaki_work/system/export-manager.js`

## 現在状態

- Phase 5aからPhase 5iまで完了。既存の未commit差分を維持する。
- `TimelineModel.playback` へ `endMode / inFrame / outFrame` が追加済み。
- `getPlaybackRange()` と範囲対応 `advanceFrame()` が追加済み。
- project / Album保存は既存TimelineModel serialize経路を利用できる。
- rulerにmarker class / badgeを生成する入口はある。
- `play()` は `advanceFrame()` を引数なしで呼ぶため、LANE / SETのlast-clip終端が実再生へ反映されない。
- `clampPlaybackSettings()` は定義のみでconstructor、総Frame変更、History / project復元へ未接続。
- loop、終端mode、IN / OUT設定・解除UIとHistory commandは未実装。
- marker CSSは未実装で、render内に未使用のrange計算がある。
- Browserで追加controlが0件、既存Animation Tableのconsole新規errorなしを確認済み。
- `Backup/`、`PastFiles/`、`Backup-tegaki_work/` は調査・編集しない。

## 最初の実装単位

1. 総Frame 12、IN=2、OUT=8、Lane A終端3、Lane B終端8の固定入力を再利用する。
2. 再生開始時にALL / LANE / SETから対象Lane ID集合を固定する。
3. 同じ集合をpreviewとlast-clip range計算へ渡す。
4. currentFrameが範囲外ならtimer開始前にeffective startへ移動し、renderとFrame eventを1回行う。
5. playback正規化をconstructor、総Frame変更、History復元、project復元へ接続する。
6. このsliceではUI buttonとmarker dragを追加しない。

修正後、model helper単体だけでなく `AnimationTablePopup.play()` 経由のsequenceを確認する。

## 守る境界

- `ALL / LANE / SET` とIN/OUT時間範囲を混同しない。
- 再生中にscope対象を暗黙変更しない。
- Export popupの範囲入力を自動変更しない。
- 修飾click shortcutを先に固定しない。
- Clip作成・削除、retime、Timeline pan、Shift操作を壊さない。
- Timeline DOM全面置換を行わない。
- playback設定はTimelineModel正本とし、通常Layerやworking Layerへ持たせない。
- Phase 5i inverse clippingをPixiJS v8.19の未確認APIへ置き換えない。
- PixiJS更新やWebGPU有効化をPhase 5jへ混ぜない。
- debug log、build生成物を残さない。

## 検証の最低線

- ALL / LANE / SETごとの固定sequence確認。
- 変更JSの `node --check`。
- `npm.cmd run build`。
- loop OFF停止、loop ON折り返し、範囲外からの再生開始、手動Frame移動。
- console新規errorなし。
- `dist/` とVite cache差分除去。
