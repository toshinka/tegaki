# D&D Phase 0 — Codex止血修正結果

## 目的

Claude調査で指摘された `LayerPanelRenderer.render()` ごとの SortableJS 破棄・再生成を、独自D&D実装へ進む前の低リスク止血として修正した。

## 変更内容

対象ファイル:

- `tegaki_work/ui/layer-panel-renderer.js`

実施内容:

- `render()` 末尾の `initializeSortable()` 呼び出しを、`this.sortable` が未作成の場合だけに制限。
- `initializeSortable()` 冒頭で、既存 Sortable インスタンスがある場合は即 return するよう変更。
- Sortable ドラッグ中に `requestUpdate()` が呼ばれた場合、即時 `render()` せず `_pendingUpdateAfterDrag` として保留。
- `onEnd` の `_findFolderDropTarget()` 再呼び出しを撤去。
- フォルダ投入先は `onMove` 中に保存した `_dragFolderTargetId` のみ採用。
- ドロップ終了後にドラッグ状態を解除し、保留された更新があれば `requestUpdate()` で処理。

## 期待する効果

- レイヤー表示切替、名前変更、クリッピング変更、サムネイル更新などの `render()` 契機で Sortable が破棄されにくくなる。
- ドラッグ中のパネル再描画でドラッグが中断される可能性を下げる。
- ドロップ時点でDOMが動いた後の座標再判定を避け、フォルダ投入先のブレを減らす。

## 確認済み

- `npm.cmd run build` 成功。
- 生成された `dist` 差分は作業差分から除外済み。

## オーナー実機確認待ち

以下を確認する。

- レイヤー同階層の上下移動が以前より軽いか。
- フォルダ投入が以前より安定するか。
- ペン操作でドラッグが途中中断しにくくなったか。
- フォルダ外出しや背景レイヤー付近のガードに退行がないか。

## オーナー実機確認結果

- 2026-05-21: 操作感に目立つ変化はなし。
- Phase 0 の止血修正だけでは、旧型に近い快適なD&D感触までは改善しないと判断。
- 後続で本格的に扱う場合は、`tegaki_work/NOTES.md` にある通り `PastFiles/OldFiles/v8.13_anime14` 周辺の旧実装を参照しつつ、独自Pointer Events D&D案へ進む。

## 次の判断

- 今回のD&D Phase 0はここで終了。
- 独自Pointer Events D&Dは後続大Phaseへ温存する。
- Phase 3i ではD&Dを触らず、スポイトMVPとQAP/カラー導線整理へ進む。
