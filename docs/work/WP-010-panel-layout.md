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
5. **頂点ドラッグ**: 頂点は「分割線の端」または「外周」に紐づく。分割線の端を動かすとその線の傾きが変わり、**隣のコマは設定の間隔を保って追従**する（コマ単位の自由変形はしない）。外周頂点は全コマが追従。`外周を戻す`あり。

## Phase 3（実装済み）

- **ふたば配色**: 線の既定 `#800000`(futaba-maroon)、コマ下地の既定 `#f0e0d6`(futaba-cream)。旧既定(黒/白)で保存された設定は新既定へ移行。popup・重ね表示とも白/灰/黒を使わない。popupの縦scrollbarは共通`ui-scrollbar`(maroon)。`scrollbar-width: thin`だけで色指定がなく既定の灰色になっていた共通CSS 8箇所にも同色を指定。
- **コマの削除/復活**: 描かず空白にし、番号も飛ばす（`結合`は隣が広がる別操作）。
- **整列**: 小さな傾き→0、素直な分割比(1/2,1/3,2/3,1/4,3/4,1/5…)へスナップ、別々の列でほぼ同じ高さ/位置の分割線を揃える。ドラッグ中も他の線へ吸着（Alt押下で無効）。
- **フォルダ収納**: 「白コマ＋クリッピング」は `コマ割り` フォルダ(`コマ枠`/`コマ内描画`/`コマ白`)に入る。フォルダも`panelLayout`(role: folder)を持ち、Undo 1回で全て消える。
- **日本式の番号**: 右上=1。分割木を、横割りは上→下、縦割りは右→左の順にたどって割り振る（右列が縦に2コマ・左が1コマなら 右上1・右下2・左3）。popupプレビューとキャンバス上に薄く表示。

## 制約・次の候補

- pixel selectionは矩形のみのため、「コマ形状を選択範囲にする」は未対応（clippingで代替）。多角形選択の基盤ができたら接続。
- 分割木は凸四角形のコマのみ。凹多角形・円形コマ、渦巻き型(風車)配置は未対応。
- Layer複製/Blockコピーは`panelLayout`を引き継がない（複製は通常Rasterとして扱われる）。必要になれば`createLayerBlockPayload`へ追加。
- 更新は同groupのLayerを対象にする。groupのLayerをユーザーが削除済みの場合は更新を拒否して再編集状態を解除する。

## 完了条件と受入

- 自動: `node tegaki_work/build/development-harness.mjs test panel-layout`、`vite build`。
- Browser実操作（実施済み, Chromium headless）: sidebar launcher / Shift+K / プリセット / 分割 / 線ドラッグ(popup・キャンバス上) / 頂点ドラッグ / 傾き / 白コマ＋クリッピング3Layer追加→Undo 1回で全消去→Redo / 更新→Undo / Project export→load往復でpanelLayout復元。
- **Owner未確認**: 液タブ操作感、popup位置・大きさ、既定値（余白40px・間隔16px・線4px）、アイコンの見え方、coarse pointer。
