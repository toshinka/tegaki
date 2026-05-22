# Phase 3m — Undo/Redo描画劣化の調査と止血（完了）

## 概要

Phase 3l までで、QAP の色操作（スポイト、カラーサークル、メイン/サブカラー）は一通り実用化した。
次は大きなアニメテーブル改修へ進む前に、描画の信頼性を点検する。

オーナーの実機メモとして「描く手数が増えると主線が黒ずむ / Undo・Redo時に値が変わる可能性」がある。
このフェーズでは、Undo/Redo や履歴復元で線の色・不透明度・alpha が劣化していないかを調査し、原因が狭ければ止血修正する。

目的は「履歴で絵が変わらない」ことを確認すること。
大規模な描画エンジン再設計は行わない。

## 優先順

### 1. 現状調査

- [x] `history.js` の command 記録/undo/redo 経路を確認する。
- [x] `brush-core.js` のペン/消しゴム/エアブラシ/ぼかしの履歴記録経路を確認する。
- [x] `layer-system.js` の `createLayerRasterSnapshot()` / `restoreLayerRasterSnapshot()` を確認する。
- [x] `project-manager.js` やサムネイル更新が履歴復元に余計な描画を重ねていないか確認する。

観点:

- RenderTexture を snapshot するときに premultiplied alpha や透明ピクセルが変化していないか。
- 復元時に `clear` せず上描きしていないか。
- live 焼き込み済みのストロークを final stroke でもう一度焼いていないか。
- `pathsData` とラスター復元が二重に作用していないか。

### 2. 最小再現手順の作成

- [ ] 新規レイヤーに同じ色・同じ不透明度で数本線を描く。
- [ ] Undo / Redo を複数回繰り返す。
- [ ] 色・濃度・alpha が変わるかを確認する。
- [ ] 可能なら `renderer.extract.pixels()` などで、Undo前/Redo後の同一座標ピクセル値を比較する。

注意:

- 実機の見た目確認が必要な場合は、Codex/Gemini側ではビルド確認とコード調査までで止め、オーナー確認へ回す。
- 一時ログを入れる場合は `TEGAKI_CONFIG.debug` が true の時だけ出す。

### 3. 止血修正

原因が狭い場合のみ修正する。

2026-05-22 Codex実施:

- `project-manager.js` / `export-manager.js` のアルバム・書き出し経路は `_unpremultiplyCanvas()` 済みであることを確認。
- Undo/Redo の履歴復元は `layer-system.js` の `extract.pixels()` snapshot 経路が中心だったため、`createLayerRasterSnapshot()` に `_unpremultiplyPixelBuffer()` を追加し、半透明RGBをストレートアルファ相当に戻してから履歴へ保存する止血修正を実施。
- `restoreLayerRasterSnapshot()` は `clear:true` で対象 RenderTexture を戻しており、上描き復元ではないことを確認。
- `HistoryManager.isApplying` と `historyManager.record()` により Undo/Redo 適用中の再記録は抑止されていることを確認。

候補:

- [x] 復元前に対象 RenderTexture を明示 clear してから snapshot を描き戻す。
- [x] snapshot 作成/復元で alpha / premultiplied alpha が変化しない経路へ寄せる。
- [x] live 焼き込み済みのペン/消しゴム/エアブラシが、finalize で二重焼き込みされないことを再確認する。
- [x] Undo/Redo適用中に履歴を再記録しない guard を確認する。

### 4. 後続へ回す項目

- レイヤーパネル/アルバムの独自D&D本実装。
- 無限キャンバス。
- アニメテーブル大改修。
- WebGPU / SDF / MSDF / JFA 系の復活。

これらは重要だが、履歴で描画が変わる疑いが残る状態で進めると後から切り分けが難しくなる。

## 確認事項

- [x] `npm.cmd run build` が成功する。
- [x] ペン描画後の Undo / Redo で、見た目の濃度や色が変わらない。
- [ ] 消しゴム、エアブラシ、ぼかしで退行がない。
- [ ] レイヤーサムネイルと履歴カウントが破綻しない。
- [x] 修正した場合は `PROGRESS.md` に原因と止血範囲を書く。

2026-05-22 オーナー確認:

- アンドゥ・リドゥ繰り返しテストで黒色化は現時点で見られない。
- 追加の描画不具合が実際に出た場合に、その時点で再調査・改修する。
- Phase 3m はこの止血範囲で完了扱い。

## 禁止事項

- 大規模な描画エンジン再設計をしない。
- WebGPU / SDF / MSDF / JFA 経路へ触れない。
- 保存形式、履歴形式、レイヤー構造を不用意に変更しない。
- 推測で複数ファイルを連鎖修正しない。原因を1件ずつ切り分ける。
