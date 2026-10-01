# WP-011 集中線ツール

状態: TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。更新日: 2026-10-02。
Ownerは最終受入とpushの権限をClaudeにも付与済み（Ownerが明示的に撤回するまで有効）。

## Goal

OWNER BACKLOG 1「集中線ツール（特に要望強）」。集中線 / ウニフラ / ベタ放射を、popupで調整しながらキャンバス上で確認し、確定でRaster Layerを1Undoで追加する。コマ割り（WP-010）と同じ流儀（popup + 純幾何 + 重ね表示 + 通常Rasterの1Undo追加 + 再編集）に揃える。

## 設計判断

| 論点 | 採用 | 理由 |
|---|---|---|
| 生成方式 | 描画engineでなく、確定時に一括生成（定規の吸着方式とは別） | 絵として整った線を1操作で。描画engineへCanvas2Dを混ぜない契約は守り、確定時の画素生成だけCanvas2D（コマ割りと同じ） |
| モデル | 中心 + 内側楕円（抜け）+ 本数。線は台形ポリゴン（太い側/尖る側を`direction`で反転）。乱数は`seed`のみから決定 | 同じseedなら同じ絵（再抽選・再編集・保存復元が安定）。ウニフラは`direction:'out'`+有限長で同じ仕組み |
| 保存 | 編集中のparamsはlocalStorage（UI設定）。確定Layerは通常Rasterで、再編集用に`layerData.focusLines`（optional）をProject JSONへ保存。画素は派生物で「更新」で再生成 | Raster/History/rendererの正本は不変。loadは`sanitizeFocusLinesData`で検証し、壊れたdataは無視して画素だけ読む |
| 操作 | プリセット5種 / 向き / 本数・太さ・尖らせ・抜け横縦・長さ・ばらつき / 色 / 中心（中央・定規の中心）/ 再抽選。ホイール増減・ダブルクリック直接入力（`ui/numeric-field.js`） | 定規の放射線の中心を流用できる。数値操作の流儀はコマ割りと共通 |
| 置き場所 | 左サイドバー + `Shift+F` | コマ割り（Shift+K）と同じ配線 |

## ファイル

- `system/focus-lines.js` — pure幾何（params正規化、sanitize、線ポリゴン生成、ハンドル）。
- `system/focus-lines-raster.js` — 確定用のRGBA生成。
- `ui/focus-lines-popup.js`、`ui/focus-lines-overlay.js` — popupとキャンバス上のSVG重ね表示（中心 / 抜けの横・縦ハンドル。コマ内側と同様、線自体は入力を奪わない）。見た目のclassは`styles/components/panel-layout-popup.css`と共通。
- 配線: `dom-builder.js` / `ui-panels.js` / `popup-manager.js` / `core-engine.js` / `config.js`（FOCUS_LINES_TOGGLE）/ `keyboard-handler.js` / `settings-popup.js` / `ui-icons.js`（`focusLines`、Lucide系に適合がないため創作。viewBox 24・stroke 1.5・round）/ `project-manager.js`。
- 検証: `build/verify-focus-lines.mjs`（harness domain `focus-lines`）。

## 操作

- 向き: `中心へ尖る`（集中線。外が太く中心側が尖る）/ `外へ尖る`（ウニフラ。抜けの縁が太く外へ尖る）。
- 長さ: 0=キャンバスの最遠隅を越えるまで（集中線向き）、値を入れると中心からその長さ（ウニフラ向き）。
- `尖らせ`100%で先が完全に尖る。`角度/長さばらつき`で不規則さ。`再抽選`で配り直し。
- 抜けの楕円は、プレビュー/キャンバス上のハンドル（右=横、下=縦）をドラッグ。中心は丸ハンドルまたはプレビューのクリック。
- `新規レイヤーに適用`=Raster Layer「集中線」を追加（Undo 1回）。`レイヤーから再編集`→`既存の集中線を更新`=同じLayerの画素とparamsを置換（Undo 1回）。

## 修正（ついで）

- `keyboard-handler.js`のF1〜F12抑止が`e.key.startsWith('F')`だったため、`Shift+F`の `F` まで握りつぶしていた。`/^F\d{1,2}$/`に限定。

## 制約・次の候補

- 線は直線の台形のみ。流線（平行）、先が丸い線、線の途中の欠け、複数中心は未対応。
- 画素はキャンバス全体の1枚（大きなキャンバスでは1枚分のメモリ）。必要なら外接矩形へ縮める。
- キャンバス上の重ね表示は線がキャンバス外にも描かれる（確定画素はキャンバス内のみ）。
- 色は1色（既定 futaba-maroon `#800000`）。コマ内クリッピングとの連携（選択コマの中だけに集中線）は未対応。

## 完了条件と受入

- 自動: `node tegaki_work/build/development-harness.mjs test focus-lines`、`vite build`。
- Browser実操作（実施済み, Chromium headless）: launcher / Shift+F / 適用→Undo 1回→Redo / プリセット / 数値の直接入力とホイール / キャンバス上の中心ドラッグ / 更新→Undo / Project export→load往復。
- **Owner未確認**: 液タブでの操作感、既定値、プリセットの見た目、popupの位置・大きさ。
