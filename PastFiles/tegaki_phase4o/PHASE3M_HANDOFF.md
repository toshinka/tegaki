# PHASE3M_HANDOFF — 新チャット引き継ぎ

## 読む順番

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `task-gemini/phase3m.md`
5. 必要に応じて `tegaki_work/NOTES.md`

## 現在位置

- Phase 3l まで完了。
- QAP の色操作は、スポイト、カラーサークル、メイン/サブカラー、`X` 入れ替えまで実装済み。
- Codex追補修でスポイト復帰、サブカラー初期値をアイボリー寄りへ変更済み。
- 次は Phase 3m「Undo/Redo描画劣化の調査と止血」。

## Phase 3m の狙い

アニメテーブル大改修や無限キャンバスなどの大きな実装へ進む前に、履歴復元で描画が劣化しないか確認する。

疑い:

- 描く手数が増えると主線が黒ずむ。
- Undo / Redo 後に色、濃度、alpha が変わる可能性がある。

最初に見るファイル:

- `tegaki_work/system/history.js`
- `tegaki_work/system/drawing/brush-core.js`
- `tegaki_work/system/layer-system.js`
- 必要に応じて `tegaki_work/system/project-manager.js`

重点:

- `createLayerRasterSnapshot()` / `restoreLayerRasterSnapshot()` の RenderTexture 復元経路。
- live 焼き込み済みストロークの二重焼き込みが起きていないか。
- premultiplied alpha / clear / restore の扱い。
- Undo/Redo適用中に履歴を再記録していないか。

## 後続候補

Phase 3m 後の候補は以下。

1. レイヤー/アルバムの独自D&D再設計。
2. 無限キャンバス。
3. アニメテーブル大改修。
4. 色管理の追加拡張（リアルパレット、色履歴、カラースロット登録）。

ただし、描画履歴の劣化疑いが残る状態でアニメテーブルへ進むと切り分けが難しくなるため、Phase 3mを先に行う。

## 注意

- `PastFiles/` は参照専用。編集しない。
- `dist/` はビルド生成物なので、作業差分に残さない。
- WebGPU / SDF / MSDF / JFA は凍結中。Phase 3mでは触らない。
- 推測で複数ファイルを連鎖修正しない。原因を1件ずつ切り分ける。
