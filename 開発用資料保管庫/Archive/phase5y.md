# Phase 5y: Motion key clipboard

更新日: 2026-07-13

## 完了内容

- CAF clipboardと分離したruntime Motion-key clipboardを追加した。
- payloadは `position / scale / rotation / interpolation` の値だけを持ち、source Clip ID / Frameを保持しない。
- CLIP MOTION headerの明示copy / paste buttonから、current Clip-local Frameへ1 Timeline Historyで追加・置換する。
- 範囲外、単Frame、貼付先なし、再生中のdisabled条件を追加した。
- Motion shortcutはCAF / Layer clipboardのdocument captureと数値input focusが競合するため採用せず、明示buttonを正式入口とした。

## 検証

- 固定入力でsource情報非保持、値clone、同Frame置換、元配列非破壊を確認した。
- Browserとオーナー実機でbutton copy / paste、別Frame置換、HOLD、720°、Undo / Redo、disabled状態を確認した。
- `node --check`、build、生成差分除去を完了した。

## 後続

- Motion key一括消去とcopy feedbackはPhase 5z1へ送る。
- opacity、離散blend、色補間は別Phaseで段階導入する。
