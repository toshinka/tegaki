# Phase 5x: Animation編集設定とUI control整理

更新日: 2026-07-13

## 目的

Phase 5wで安定したMotion正本へ機能追加を混ぜず、Animation Tableの編集補助設定と、form/controlに残る灰色・黒focus表現を既存ふたばカラーへ揃える。

## Slice 0: 右方向キーのCAF自動生成設定

状態: 完了（2026-07-13）

1. Animation Tableで右方向キーにより空Frameへ進む時のCAF自動生成を設定checkboxでON/OFFできるようにする。
2. 既定はONとし、従来操作を維持する。
3. OFF時はcurrent Frameだけを移動し、CAF、ClipAsset、DrawingSnapshot、Historyを作成しない。
4. 左方向キー、Frame header click、明示的CAF追加、通常Timeline操作は変更しない。

## Slice 1: 共通control配色監査

状態: 次の入口

- number input、select、option、slider、native spinner、▲▼buttonのfocus / selection / disabled色を検索する。
- `styles/main.css` の既存変数と共通classを優先し、component固有の近似色を増やさない。
- Motion、V panel、Animation Table、Settingsを先行し、全UI一括renameは行わない。

## 対象外

- opacity、色補間、easing curve、Motion bake、subframe sampling。
- Bone / Lane constraint、mesh、physics、WebGPU。
- Phase 5q以降のworking Layer、preview順、Lane前面、PSD、onion、Folder clipping契約。

## 検証

- 変更JSの `node --check`。
- 固定入力で設定既定ON、保存OFF、再読込OFFを確認する。
- BrowserでON時の空Frame CAF生成、Undo、OFF時のFrame移動のみ、設定再表示、console errorなしを確認する。
- `npm.cmd run build` 後、`dist/` と `node_modules/.vite/` の生成差分を残さない。
