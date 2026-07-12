# Phase 5j Handoff

更新日: 2026-06-21

## 次チャットの目的

Phase 5j「Timeline再生範囲・終端・ループ制御」を開始する。
最初のsliceは固定再生sequenceと、effective start / end境界の監査。

## 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE5J_HANDOFF.md`
5. `task-codex/phase5j.md`
6. `tegaki_work/PHASE4Z_BOUNDARY.md`
7. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`

その後:

1. `tegaki_work/system/animation/animation-data-model.js`
2. `tegaki_work/ui/animation-table-popup.js`
3. `tegaki_work/system/project-manager.js`
4. `tegaki_work/system/export-manager.js`

## 現在状態

- Phase 5aからPhase 5iまで完了。
- Phase 5iの未commit差分とArchive移動を維持する。
- `TimelineModel.playback` は `currentFrame` と `loop` をserializeする。
- `advanceFrame()` は総Frame末尾だけを終端にする。
- Animation Tableにplay buttonはあるが、loop・終端mode・IN/OUT UIはない。
- `ALL / LANE / SET` は再生対象Laneの既存正本。
- Export popupは独自の開始 / 終了Frame入力を持つ。
- `Backup/` と `PastFiles/` は調査・編集しない。

## 最初の実装単位

1. 固定Frame/CAF配置で現行再生sequenceを測る。
2. effective start / endを副作用なしで計算する契約を決める。
3. `TimelineModel.playback` の旧データcompatibilityを確認する。
4. 最初はmodel helperとloop OFF停止境界までに限定する。
5. marker UI、保存、Historyは後続sliceで接続する。

## 守る境界

- `ALL / LANE / SET` とIN/OUT時間範囲を混同しない。
- Export popupの範囲入力を自動変更しない。
- 修飾click shortcutを先に固定しない。
- Clip作成・削除、retime、Timeline pan、Shift操作を壊さない。
- Timeline DOM全面置換を行わない。
- playback設定はTimelineModel正本とし、通常Layerやworking Layerへ持たせない。
- debug log、build生成物を残さない。

## 検証の最低線

- 固定sequenceの期待値確認。
- 変更JSの `node --check`。
- `npm.cmd run build`。
- loop OFF停止、loop ON折り返し、手動Frame移動。
- console新規errorなし。
- `dist/` とVite cache差分除去。
