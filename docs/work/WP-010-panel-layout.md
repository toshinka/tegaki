# WP-010 コマ割りツール（Rough Product Pass）

状態: ROUGH PRODUCT PASS / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。更新日: 2026-10-01。

## Goal

クリスタ / メディバン / アルパカ系の「コマ割り」を、Tegakiの既存保存・History・renderer authorityを変えずに追加する。
OWNER BACKLOG 3（漫画用コマ割り＆編集）の第一段。低頻度だが操作は往復するため、常設パネルでなくpopupとする。

## 設計判断

| 論点 | 採用 | 理由 |
|---|---|---|
| 置き場所 | 左サイドバーのlauncher＋`Shift+K` | QTPは3400行でslot構造が筆専用。popup launcherは既存`resize`と同じ配線で最小。QTP/他へは配線1行で移せる |
| データ | 分割木(BSP)。コマ=凸四角形、間隔=全体param＋分割線ごとの上書き | 間隔スライダーを後から動かしても全コマを再導出できる。コマ割りの大半（縦横・段組み・斜め割り）を表現できる |
| 保存 | Projectへ**保存しない**。UI設定だけlocalStorage。確定時に通常Raster Layer「コマ枠」を1件のHistory(`raster-layer-create`)で作る | 新しい保存正本・schema変更を避ける（AGENTS: 重大判断点を作らない） |
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

## 未実装・次の候補（Ownerの優先順で）

1. キャンバス上へのライブ重ね表示（現在はpopup内プレビューと確定のみ）。
2. 確定したコマ枠をLayer mask / clipping / pixel selectionへ接続し、コマ内だけ描ける運用。
3. 作り直し: 確定済み「コマ枠」Layerから木を復元して再編集（保存正本の新設が必要なため重大判断点）。
4. ベクター枠線（Project保存）、コマごとの個別線幅、ふきだしのコマ跨ぎ。
5. 渦巻き型など木で表せない配置（凸多角形の自由編集）。

## 完了条件と受入

- 自動: `node tegaki_work/build/development-harness.mjs test panel-layout`、`vite build`。
- Browser実操作（実施済み, Chromium headless）: sidebar launcher / Shift+K / プリセット / 分割 / 線ドラッグ / 傾き / 適用でLayer追加 / Undo 1回で消える。
- **Owner未確認**: 液タブ操作感、popup位置・大きさ、既定値（余白40px・間隔16px・線4px）、アイコンの見え方、coarse pointer。
