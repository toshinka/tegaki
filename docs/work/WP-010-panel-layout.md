# WP-010 コマ割りツール（Rough Product Pass）

状態: PHASE 1-2 TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。更新日: 2026-10-01。
Ownerは今回に限り最終受入とpushの権限をClaudeにも付与済み（Ownerが明示的に撤回するまで有効）。

## Goal

クリスタ / メディバン / アルパカ系の「コマ割り」を、Tegakiの既存保存・History・renderer authorityを変えずに追加する。
OWNER BACKLOG 3（漫画用コマ割り＆編集）の第一段。低頻度だが操作は往復するため、常設パネルでなくpopupとする。

## 設計判断

| 論点 | 採用 | 理由 |
|---|---|---|
| 置き場所 | 左サイドバーのlauncher＋`Shift+K` | QTPは3400行でslot構造が筆専用。popup launcherは既存`resize`と同じ配線で最小。QTP/他へは配線1行で移せる |
| データ | 分割木(BSP)。コマ=凸四角形、間隔=全体param＋分割線ごとの上書き | 間隔スライダーを後から動かしても全コマを再導出できる。コマ割りの大半（縦横・段組み・斜め割り）を表現できる |
| 保存 | 編集中の木はlocalStorage(UI設定)。確定したLayerは通常Raster Layerで、再編集用に`layerData.panelLayout`(optional)を持ちProject JSONへ旧版互換のoptional fieldとして保存。画素は派生物で「更新」で再生成。Raster/History/rendererの正本は変えない | 再編集とvector保存の要望を、既存の保存・load・Undo契約を壊さずに満たす。loadは`sanitizePanelLayoutData`で検証し、壊れたdataは無視して画素だけ読む |
| 描画 | popupプレビューはCanvas2D。確定時のみCanvas2D→RGBA→`createRasterLayerFromSnapshot` | 本番strokeへCanvas2Dを混ぜない契約を守る。生成は既存CPU compositor/exportと同じ用途 |
| 操作 | プリセット / 上下・左右分割 / 結合 / 分割線ドラッグ / 傾き / 線ごとの間隔 / 裁ち落とし / 余白・間隔・線幅・色 | クリスタの「コマ枠フォルダー」基本操作から頻度の高いものだけ |

## ファイル

- `tegaki_work/system/panel-layout.js` — pure幾何（木編集、解決、ヒットテスト、プリセット）。
- `tegaki_work/system/panel-layout-raster.js` — 枠線のRGBA生成。
- `tegaki_work/ui/panel-layout-popup.js`、`styles/components/panel-layout-popup.css` — popup。
- 配線: `dom-builder.js`(sidebar) / `ui-panels.js` / `core-engine.js` / `config.js`(PANEL_LAYOUT_TOGGLE) / `keyboard-handler.js` / `ui-icons.js`(`panelLayout`)。
- 検証: `build/verify-panel-layout.mjs`（harness domain `panel-layout`）。

## アイコン

`panelLayout`はLucide系に漫画コマ割りの適合がないため創作。規約: viewBox 24、`stroke="currentColor"`、stroke-width 1.5、round cap/join、fill none（既存`UI_ICONS`と同じ）。

## Phase 2（実装済み）

1. **キャンバス重ね表示**: `ui/panel-layout-overlay.js`。分割線・コマ外周・選択コマの頂点だけがpointerを受け、コマ内側は透過して描画を奪わない。popup表示中は外クリックでも閉じない(`panelLayout`をkeep-open化)。
2. **コマ内クリッピング**: 出力「白コマ＋クリッピング」で `コマ白` / `コマ内描画(clipping)` / `コマ枠` の3Layerを1回のUndoで追加(`HistoryManager.mergeLastCommands`)。既存clippingを使うため、コマの外へ描いてもはみ出さない。ふきだしのコマ跨ぎは、枠より上の通常Layerへ描けばそのまま可能。
3. **再編集**: 「レイヤーから再編集」で`panelLayout`を読み込み、「既存のコマ枠を更新」で枠/白Layerの画素とdataを置換(Undo 1回)。`コマ内描画`の絵は保持。
4. **vector保存**: 3.のとおりProjectへ保存・復元（save→loadで確認）。個別線幅(コマごと)も保持。
5. **自由配置**: 選択コマの4頂点をドラッグして変形(渦巻き型など)。`頂点を元に戻す`あり。

## 制約・次の候補

- pixel selectionは矩形のみのため、「コマ形状を選択範囲にする」は未対応（clippingで代替）。多角形選択の基盤ができたら接続。
- 分割木＋頂点オフセットは凸四角形のコマのみ。凹多角形・円形コマは未対応。
- Layer複製/Blockコピーは`panelLayout`を引き継がない（複製は通常Rasterとして扱われる）。必要になれば`createLayerBlockPayload`へ追加。
- 更新は同groupのLayerを対象にする。groupのLayerをユーザーが削除済みの場合は更新を拒否して再編集状態を解除する。

## 完了条件と受入

- 自動: `node tegaki_work/build/development-harness.mjs test panel-layout`、`vite build`。
- Browser実操作（実施済み, Chromium headless）: sidebar launcher / Shift+K / プリセット / 分割 / 線ドラッグ(popup・キャンバス上) / 頂点ドラッグ / 傾き / 白コマ＋クリッピング3Layer追加→Undo 1回で全消去→Redo / 更新→Undo / Project export→load往復でpanelLayout復元。
- **Owner未確認**: 液タブ操作感、popup位置・大きさ、既定値（余白40px・間隔16px・線4px）、アイコンの見え方、coarse pointer。
