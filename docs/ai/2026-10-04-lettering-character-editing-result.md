# WP-028 — 文字別編集・書体集約・第二フチ取りの実装記録

2026-10-04、main/f245c354。VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。[Card](../work/WP-028-lettering-character-editing.md)が限定実装の契約。既存dirtyと独立WP-026を保持。commit/pushなし、Owner制作受入は未。

## 実装

- 書式/配置/変形/文字別の4tab。共通本文・標準書体・基本サイズと固定footerを維持。字間/行送り/配置線/位置・回転・拡縮は配置へ。
- FontComparisonの見本比較/情報・整理。既存情報DOMを移してイベントを保持。全体/選択文字の適用先表示、情報だけD&D、キーボードtab移動、狭い画面で独立scroll。
- 第一フチと第二フチの色・幅。第二は第一の外へ追加する片側厚さ。全glyphの外線→内線→fillをSVGとCPUへ共通反映し、overlayもrenderer SVGを使用。
- 先頭/中央/末尾の倍率profileとadvance補正、行ごとにprofile再開。旧末尾サイズは従来通り利用可能。
- UTF-16 grapheme範囲の文字別font/色/size/回転/拡縮/接線・法線offset/局所warp。合字と結合字はclusterで選択、書体境界は再組版。beforeinputとIME開始時の位置から指定を追従。
- 外向き膨らみpreset、9点の枠外drag。文字V操作はLayer Vsessionを開始せず、wheel/Shift wheel/矢印/H反転/Shift方向dragを文字へ。Spaceはカメラ優先。文字別のdragはrendererのoffset基底を使い縦書きの向きも補正。
- optional version-1 paramsへ追加し、通常Raster/画素fingerprint/Project/History/確定出力を維持。選択・輪郭cache・font実体は保存しない。未指定属性の旧SVG/CPU画素が一致。

## 検証

純粋model/geometry/renderer/adapter、grapheme/IME範囲、実OS fontの合字/結合字/サロゲート、第二フチのCPU複合色/輪郭/bounds、旧画素一致を確認。実OS fontは検証で読み取るだけでコピー/公開なし。

構文9files、editable-lettering 8件、fonts 6件、balloon 1件、Project 10件、shortcut-learning-boundary、harness check（74 documents / 292 local links / 19 packages）、Vite build PASS。既存util/module externalizeとchunk-size警告あり。

専用Browser fixtures `build/wp028-lettering-browser.html`、`wp027-lettering-workflow-browser.html`、`wp025-lettering-browser.html`は製品engine/通常CanvasでPASS。WP027 fixtureは変更された情報DOMの所在と配置tabだけ追従した。

- 曲線「ゴゴゴ」の中央だけ書体/色/回転/局所変形。第一5px＋第二3pxから全stroke11pxを生成し、SVG/overlayへ反映。
- 先頭挿入/削除、合成CompositionEventで途中「あ」→結合字「あ゙」に変えても指定を追従。多行縦書きの3点profile、縦書き文字のCanvas横12px移動が一致。
- 枠外9点drag、V wheel拡縮/Shift wheel回転/反転、Shift横pointer drag回転、Space優先。cameraの実scale/position/rotationとKeyboardHandler V状態を検査して二重操作なし。
- 一Layer/一Historyで追加、更新、各Undo/Redo、ProjectManagerの実export/loadとPNG画素一致。取消/手描き後拒否/未対応font失敗/変更なし確定/IMEとrepeatによる確定抑止/確定中追加入力の回帰もPASS。
- 1280×720、360×640/400で固定footer可視。情報page末尾のPrimaryへ独立scrollで到達。
- loaded fontのensureLoaded再利用8回は中央値0.00ms、最大0.00〜0.30ms。これはメモリ再利用の測定で、cold取得や全組版の時間ではない。

別の製品tabでも実locator/native keyで編集し、選択文字のF910適用、標準書体不変、比較ArrowRightで情報pageへ移動、適用対象表示、native V＋Canvas wheelでscaleX=1.05、native Ctrl+Enterで閉じてHistory=1を確認した。画面画像はworkspace外のvisualizations内へ保存（`wp028-character-editing.png` / `wp028-font-information.png`）。

吹き出しtabでも実locatorで「情報」を開き、源暎アンチックの移設済み情報・収納先が表示され、ArrowLeftで見本比較へ戻ることを確認した。

合成DOMイベントの再現と実操作を区別し、実IME機器・液タブ操作感・制作受入は未。

追加で実行した既存`verify-touch-shortcut-help-gate.mjs`はQTP help toggleのsource regex（60行目）で失敗。今回未編集の`quick-access-popup.js`を調べ、HEAD版でも同regexがfalseであることを確認した。これは今回の文字実装のPASSへ含めず、既存検査の不一致として残す。

## 制約

曲線/warp/第二フチ/文字別書体は輪郭を取得できる取り込みTTF/OTFが対象。端末書体の単純文字は旧経路を維持し、未対応の複合編集は明示エラー。WOFF/WOFF2・正式Vector Layer・CAF/Anime・RIGへ拡張していない。局所warpはpreset/強さで操作し、9点の直接操作は全体変形。
