# PHASE4A_HANDOFF — アニメテーブル大改造の足場設計

## 読む順番

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `task-gemini/phase4a.md`
5. `オーナーの実装したいことメモ.txt`

## 現在位置

- Phase 3m は完了扱い。
- Undo/Redo黒色化疑いは `layer-system.js` の履歴snapshot経路で止血済み。
- オーナー実機確認では、Undo/Redo繰り返しによる黒色化は現時点で再現なし。
- QAP未表示時の `[` / `]` プリセットショートカット例外も修正済み。
- `PastFiles/tegaki_phase3m/` へアーカイブ済み。

## Phase 4a の狙い

動画ツール風のアニメテーブル大改造へ進む。
参考は ToonSquid 2 を主、Procreate Dreams 系を補助。

ただし Phase 4a では、いきなりUIを全面実装しない。
まずは現行アニメ実装を壊さず棚卸しし、新しいアニメテーブルのデータモデルと最小MVPを決める。

## 現行アニメ実装の重要注意点

- `tegaki_work/system/animation-system.js` は旧アニメ本体を持つ。
- `tegaki_work/ui/timeline-ui.js` は旧タイムラインUIを持つ。
- `core-engine.js` では `TimelineUI` は軽量再接続しているが、`animationSystem.init()` は呼んでいない。
- `core-engine.js` では `window.animationSystem = null` としている。
- `ExportManager` と `AlbumPopup` も現状は `animationSystem: null` で渡されている。
- これは通常描画への副作用を避けるための抑制なので、安易に戻さない。

## 最初に決めること

- 現行 `Frame` 中心実装をどこまで再利用するか。
- 新しい概念を `Frame / Track / Layer / Clip / Keyframe / Easing` にどう分けるか。
- レイヤー x 時間マトリクスの最初のMVPをどこまでにするか。
- 既存レイヤーパネル右側UIと新アニメテーブルをどう共存させるか。
- アニメモードを明示的にONにした時だけ、アニメ用状態へ入る設計にするか。

## 混ぜないこと

- 独自D&D本実装。
- 無限キャンバス。
- 物理演算。
- WebGPU。
- 保存形式とExport経路の大改造。
- QAPツール別パネル化。
- トップバー本実装。

これらは重要だが、Phase 4a ではアニメテーブルの足場設計から分離する。
