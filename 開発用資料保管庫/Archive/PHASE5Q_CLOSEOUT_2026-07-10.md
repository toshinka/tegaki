# Phase 5q Closeout

完了日: 2026-07-10

## 完了

- Table閉状態のLane onion。
- Timeline onionのghost icon、前後同数0から4フレーム、標準的な前後色。
- PREVIEW / onion / CAF working Layerの表示経路整理。
- Animation Table展開中のstroke点滅、非表示、遅延表示の解消。
- Animation Table上側Laneを前面にする合成順の固定。
- PSDをCLIP STUDIOで開いた時のLayer / Folder逆順の解消。
- folder選択時の配下合成、Shift+上下によるCAF移動などPhase中に確認された周辺操作。

## 主因

- Pixi preview containerの並べ替えが冪等でなく、同じ親上の連続 `setChildIndex()` とpreview再構築で順序が変動していた。
- PixiJS v8の `removeChildren()` 戻り値をそのまま再追加すると、元のchild順と逆になる。
- 通常LayerSystemとCAF internal Layerでは配列の前後契約が異なり、PSD record順を一律reverseしていた。

## 再発防止

- stroke中の選択CAFは実working Layerで表示する。
- previewはstagingで完成後に一括交換する。
- child移送は削除前の `children.slice()` を使う。
- preview containerの安定順序を変えない。
- Lane順、Pixi child順、PSD record順を同じreverse規則で処理しない。
- CAF切替時のごく短い再構成よりstroke中安定を優先する。

## 確認

- オーナー実機でstroke中の点滅・非表示が解消。
- Lane 1 / 2 / 3の表示順がidle / stroke中とも安定。
- PSD Layer / Folder順がCLIP STUDIOでTegakiと一致。
- 変更JSの `node --check` と `npm.cmd run build` は実施済み。

詳細は `PHASE5Q_PREVIEW_ORDER_NOTES.md` と `phase5q.md` を参照する。
