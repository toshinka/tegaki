# Phase 4a — アニメテーブル大改造の足場設計

## 概要

Phase 3m までで、Undo/Redo による描画劣化疑いは止血済み・現時点再現なしとなった。
次はオーナーのモチベーションが高い「動画ツール風アニメテーブル」へ進む。

ただし現行アニメ実装は、過去の `timeline-ui.js` / `animation-system.js` が残っている一方で、通常描画への副作用を避けるために本体接続が抑制されている。
Phase 4a では、ToonSquid 2 を主な参考にしつつ、Procreate Dreams 系の動画ツール感も意識し、いきなり全面実装せず「壊さず大改造するための足場」を作る。

## 現在わかっている前提

- `system/animation-system.js` はフレーム管理、再生、サムネイル生成の旧実装を持つ。
- `ui/timeline-ui.js` は旧タイムラインUIを持つが、ファイル冒頭の「Phase 4」は過去実装名であり、現在の正本上の Phase 4 とは一致しない。
- `core-engine.js` では `TimelineUI` を軽量再接続しているが、`animationSystem.init()` は呼んでいない。
- `core-engine.js` では `window.animationSystem = null` にしており、通常描画ではアニメ本体を有効化していない。
- `ExportManager` / `AlbumPopup` も現状は `animationSystem: null` で渡されている。
- レイヤーパネル上の `NO FRAME` 表示は旧アニメUIの名残であり、将来のレイヤー x 時間マトリクスでは別表示に置き換わる可能性がある。

## 目標

Phase 4a の目標は、アニメテーブル大改造のための安全な設計・最小足場を作ること。

- 現行アニメ実装を読んで、再利用する部分と捨てる部分を分ける。
- 新しいアニメテーブルのデータモデル案を作る。
- UI の最初の到達点を決める。
- 通常描画モードを壊さず、アニメモードを明示的にONにした時だけアニメ系状態へ入る方針を決める。
- 実装する場合は、まず「空のアニメテーブルパネル」または「設計に沿ったスケルトン」までに留める。
- 調査・設計の結果は、`PROGRESS.md` だけでなく `task-gemini/phase4a_report.md` へ報告書として残す。

## デザイン方針

### 主参考

- ToonSquid 2
  - レイヤーと時間が自然につながる構造。
  - タイムライン/トラックの視認性。
  - ペン操作でも触れる密度。

### 補助参考

- Procreate Dreams 系
  - 動画ツール的な流れ。
  - トラック、キーフレーム、再生、編集モードの気持ちよさ。

### Tegaki向け調整

- キャンバスを主役にする。
- 常時大きなパネルを出しっぱなしにしない。
- 液タブ + キーボードありを主対象にしつつ、キーボードなしでも最低限扱えるトップバー/アイコン導線を後続で検討する。
- アニメ操作は将来的に `Alt+` 系ショートカットまたはアニメ操作モードと相性良くする。
- 別タブ・別ウィンドウ化は長期候補として意識するが、Phase 4a では本実装しない。

## 優先順

### 1. 棚卸し

- [ ] `system/animation-system.js` の責務、データ、イベント、履歴接続を読む。
- [ ] `ui/timeline-ui.js` の DOM 構造、CSS注入、イベント購読、Sortable 使用箇所を読む。
- [ ] `core-engine.js` のアニメ接続抑制箇所を確認する。
- [ ] `export-manager.js` / exporter 群が animationSystem をどう期待しているか確認する。
- [ ] `project-manager.js` / `album-popup.js` の保存復元で、アニメ情報を扱っているか確認する。
- [ ] `keyboard-handler.js` / `ui-panels.js` のアニメショートカット・ボタン導線を確認する。

### 2. 新データモデル案

以下を混同しない構造を検討する。

- Frame: 静止画フレーム、または現在のカット単位。
- Track: 動画ツール風の横方向単位。
- Layer: 現在の描画レイヤー。
- Clip / Cel: トラック上に置かれる描画内容。
- Keyframe: 位置、回転、拡縮、不透明度などの時間変化。
- Easing: キーフレーム間補間。

注意:

- Phase 4a では物理演算やWebGPUへ進まない。
- 将来の物理演算に備え、データは Pixi Container / RenderTexture / window 直結にしすぎない。
- まずは通常のラスターレイヤーと相性がよい形を優先する。
- `Track = Layer 1枚に対応` は最初のMVPとしては許容するが、将来 `Track` と `Layer` が完全同義でなくなる余地を残す。
- `Cel` は RenderTexture そのものだけを永続データとして持たせない。将来的に raster snapshot / image data / asset id へ落とせる設計にする。

### 3. UIスケッチ

- [ ] レイヤー x 時間マトリクス案を文章で整理する。
- [ ] 最初のMVPで見せる列/行/ボタンを決める。
- [ ] `NO FRAME` 表示をどう扱うか決める。
- [ ] 既存右レイヤーパネルとの干渉を整理する。
- [ ] パネルの表示位置、初期サイズ、折りたたみ導線を決める。

### 4. 最小実装候補

Phase 4aでコードを触る場合は、以下のいずれかに限定する。

- 新規 `ui/animation-table-popup.js` などの空パネル/スケルトンを追加する。
- 新規 `system/animation/animation-data-model.js` など、純粋データモデルだけを追加する。
- 既存 `timeline-ui.js` を壊さず、現行の表示入口から新旧どちらを使うか選べる小さな分岐を作る。
- 既存アニメ本体を通常描画へ強制接続しない。

### Gemini実装時の承認条件

`task-gemini/phase4a_report.md` の ToonSquid 2 風 Track / Cel / Timeline 方針は承認済み。
ただし Phase 4a で進めてよいのは、次の範囲まで。

- 空のアニメテーブルパネル、純粋データモデル、またはその両方。
- `animationSystem.init()` を復活させずに成立する足場。
- 通常描画、QAP、レイヤーパネルへ影響しない小さな接続。
- `npm.cmd run build` で確認できる範囲。

`phase4a_report.md` の「Codex への作業依頼案」にある以下は、Phase 4a では未着手または設計整理までに留める。

- `system/animation-system.js` の新モデル全面移行。
- `core-engine.js` のアニメ本体クリーン初期化・本格再接続。
- `ui/timeline-ui.js` の廃止と新UIへの完全移行。

## 禁止事項

- いきなり `animation-system.js` を全面置換しない。
- `timeline-ui.js` を大幅短縮・丸ごと上書きしない。
- `core-engine.js` で `animationSystem.init()` を安易に復活させない。
- 通常描画の `layerSystem.currentFrameContainer` をアニメ用フレームへ勝手に差し替えない。
- 保存形式、アルバム形式、Export 経路を同時に大改造しない。
- WebGPU / 物理演算 / メッシュ変形へ踏み込まない。
- レイヤーD&Dや無限キャンバスを混ぜない。

## 完了条件

- [ ] 現行アニメ実装の再利用/破棄方針が整理されている。
- [ ] ToonSquid 2 風テーブルに向けたデータモデル案がある。
- [ ] 調査・設計結果が `task-gemini/phase4a_report.md` に残っている。
- [ ] Phase 4b で実装する最小MVPが明確になっている。
- [ ] コードを触った場合は `npm.cmd run build` が成功する。
- [ ] 通常描画、QAP、レイヤーパネルに退行がない。
- [ ] `PROGRESS.md` に Phase 4a の判断と次フェーズ案が記録されている。

## Codex / Gemini 分担目安

- Codex:
  - 最初の設計判断。
  - `core-engine.js` / `animation-system.js` / `timeline-ui.js` の接続方針整理。
  - 重要な小改修や新規足場作成。
- Gemini:
  - 現行ファイルの棚卸し。
  - 既存イベント・保存経路・UI構造の調査。
  - Codex が作った方針に沿う小さな実装補助。
- Claude:
  - GitHub経由での設計レビュー、ToonSquid風UI案のセカンドオピニオン。
