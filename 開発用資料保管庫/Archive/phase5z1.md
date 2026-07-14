# Phase 5z1: Motion key管理とclipboard feedback

更新日: 2026-07-13

## 完了内容

- 選択Clipに2件以上あるMotion keyを1 Timeline Historyで一括消去するheader buttonを追加した。
- 静的transform、anchor、描画、他CAF、Motion clipboardを維持し、再生中は無効化した。
- Motion / CAF / Layer copyで共通利用する短時間feedback toastを追加した。
- toastは種別と件数だけを表示し、payloadやProject正本へ表示用metadataを追加しない。
- Project保存通知も同じtoast helperとふたばpaletteへ統合した。

## 検証

- Browserで3 Motion keyの一括消去、Undo / Redo、再生中disabledを確認した。
- Browserで `CAFをコピー`、`Motion keyをコピー`、1.6秒後の自動消去、ARIA statusを確認した。
- Layer / CAF複数件の文言は固定入力で確認した。
- `node --check`、build、console errorなし、生成差分除去を完了した。

## 後続

- opacity keyframe契約はPhase 5z2へ送る。
- 離散blend、色補間、easingはopacity後の独立Phaseとする。
