# WP-013 吹き出し（縦書き・フォント管理つき）

状態: TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。更新日: 2026-10-02。
Ownerは最終受入とpushの権限をClaudeにも付与済み（Ownerが明示的に撤回するまで有効）。

## Goal

漫画のセリフの吹き出しを、コマ割り・集中線と同じ流儀（漫画ツールのタブ + 純幾何 + キャンバス上の重ね表示 + 通常Rasterの1Undo追加 + 再編集）で作る。**日本語の縦書き必須**、フォントは端末のものに加えて取り込み＋フォルダ管理。

## 設計判断

| 論点 | 採用 | 理由 |
|---|---|---|
| 縦書きの実装 | ブラウザの組版（CSS `writing-mode: vertical-rl` / `text-combine-upright` / `line-break:strict`）を SVG `foreignObject` → Image → Canvas2D でRGBA化（`system/lettering-raster.js`） | Canvas2Dには縦書きが無く、約物の回転・縦用字形(vert)・縦中横・禁則を自前で作るのは非現実的。`data:`URLのSVGはcanvasを汚染せず`getImageData`できることを確認 |
| フォント | 端末のフォント（familyの実在判定のみ。許可不要）+ 取り込み（.ttf/.otf/.woff/.woff2）をIndexedDBへ。フォルダ（分類）で管理（新規/名前変更/削除/移動） | 源暎フォント系など巷のフォントはユーザーが取り込む。アプリはフォントを同梱・配布しない（ライセンスはユーザー確認）。取り込み時に`FontFace`で読み込めないファイルは保存しない |
| 取り込みフォントの描画 | SVG画像は文書のFontFaceが見えないため、`@font-face`をbase64で埋め込む（6MBのフォントで初回約0.9秒、以降キャッシュ）。プレビューの測定は文書側のFontFaceで行う | 取り込みフォントでも縦書きの組版をそのまま使える |
| 保存 | 編集中paramsはlocalStorage。確定Layerは通常Rasterで、再編集用に`layerData.balloon`（optional・sanitize済み）をProjectへ。フォントの実体はProjectに入れず、参照（family名 / 取り込みfontId）だけ | Raster/History/renderer/既存保存の正本は不変。別端末で開いてフォントが無ければ標準のゴシックで代替表示し通知 |
| 形 | 楕円 / 角丸 / 雲 / ギザギザ(seedで再現) + しっぽ（尖り=曲がり・幅つき / 丸=考え事の3つ丸） | 本体としっぽは「2×線幅で縁取り→塗りで内側を覆う」ので継ぎ目に線が出ない |
| 文字の収め方 | 形ごとの内側矩形（同心）へ、縦書きは高さ・横書きは幅で折り返し。`自動調整`で収まる最大サイズを二分探索 | 手でサイズを触ると自動調整は切れる |
| 配色 | 線 `#800000` / 塗り `#ffffee` / 文字 `#800000`（白・灰・黒を使わない） | ふたば配色 |

## ファイル

- `system/balloon-geometry.js` — pure幾何（形・しっぽ・文字領域・ハンドル・外接矩形・sanitize）。
- `system/balloon-raster.js` — 確定画素（本体+文字）。プレビューも同じ`paintBalloon`。
- `system/lettering-raster.js` — 縦/横書きの文字→画素（測定・埋め込み・縁取り）。
- `system/font-library.js` — 端末フォント判定 / 取り込み / フォルダ（IndexedDB）。
- `ui/balloon-popup.js`、`ui/balloon-overlay.js` — popupとキャンバス上の重ね表示（本体・文字・ハンドル。文字は3点の行列で貼るので回転/反転でも正しい）。
- 配線: `manga-tabs.js`（吹き出しタブ）/ `core-engine.js` / `ui-panels.js` / `config.js`（BALLOON_TOGGLE = Shift+B）/ `keyboard-handler.js` / `settings-popup.js` / `project-manager.js`。
- 検証: `build/verify-balloon.mjs`（harness domain `balloon`）。縦書き・フォント・IndexedDBはBrowserで確認。

## 操作

- 形（楕円/角丸/雲/ギザギザ）、しっぽ（あり/なし、尖り/丸、幅、曲がり）、線の太さ、線/塗りの色。
- プレビューまたはキャンバス上のハンドル: 中心=移動（しっぽの先端も一緒）、四隅=大きさ、先端=しっぽの向き。
- 文字: セリフ欄（改行で行を分ける）、縦書き/横書き、太字、フォント、サイズ（自動調整）、行間、字間、文字色、縁取り（幅/色）。
- フォント管理: フォルダの追加・名前変更・削除（中のフォントは未分類へ）、フォントファイルの取り込み（複数可）、フォントごとのフォルダ移動・削除。
- `新規レイヤーに適用`=Raster Layer「吹き出し」を追加（Undo 1回）。`レイヤーから再編集`→`既存の吹き出しを更新`で置換（Undo 1回）。

## 制約・次の候補

- 1枚のLayerに吹き出し1つ（複数をまとめて動かす機能は未対応）。文字だけ別Layerにする選択は未対応。
- ルビ、縦書き内の個別の傾け/拡大、文字の自由変形は未対応。長音「ー」や約物の字形はフォントの`vert`に依存。
- 枠線は本体としっぽの外周のみ（二重線・影・ふち取りの色分けなどは未対応）。
- 本体の回転、しっぽを複数、コマをまたぐ配置のクリッピングは未対応。
- キャンバス上の重ね表示はキャンバス外にもはみ出して見える（確定画素はキャンバス内のみ）。

## 完了条件と受入

- 自動: `node tegaki_work/build/development-harness.mjs test balloon`、`vite build`。
- Browser実操作（実施済み, Chromium headless）: Shift+Bで開閉 / 形の切替 / セリフ入力→縦書きの自動サイズ / 適用→Undo 1回→Redo / キャンバス上のしっぽ先端ドラッグ / 横書き切替→更新 / フォルダ作成→フォント取り込み→選択（フォルダ別optgroup）/ Project export→load往復 / 不正なフォントファイルの拒否。
- **Owner未確認**: 液タブでの操作感、既定値、実際のフォント（源暎フォント系など）での字形、Windowsの端末フォント一覧。
