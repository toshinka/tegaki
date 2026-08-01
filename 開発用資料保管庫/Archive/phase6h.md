# Phase 6h: Browser 100% UI密度監査・80%相当化

更新日: 2026-07-28

## 現在地

- Phase 6gでQuick Tool Panelを描画toolの主入口とするPlan Aを確定し、左sidebarをQ / Vを含む最小railへ整理した。完了記録は`開発用資料保管庫/Archive/phase6g.md`。
- オーナーは現在Browser 80%表示を常用している。本PhaseはBrowser倍率を100%へ戻したまま、sidebar、Layer Panel、popup、文字、余白を現状80%相当の視覚密度へ段階調整する。
- 次のキャラクターRig系列は、本Phase後にproposal 15のGate 0を行い、CAF内部Part / Folderの所有、親子transform、Animation Table子行投影をBONEより先に確定する。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6g.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
9. `tegaki_work/styles/main.css`
10. `tegaki_work/ui/dom-builder.js`
11. `tegaki_work/ui/layer-panel-renderer.js`
12. `tegaki_work/ui/quick-access-popup.js`
13. `tegaki_work/ui/animation-table-popup.js`

## 目的

Browser 100%時の主要UIを、オーナーが使ってきたBrowser 80%時と同程度の視覚密度へ整える。Canvasと入力座標をscaleせず、視覚寸法とpen / touchの操作面を分離し、共通CSS tokenから段階的に適用する。

## Slice 0: 固定入力監査

1. Browser 100%でsidebar、Layer Panel、Animation Table、QTP、主要popup、status、tooltip、formのcomputed size、font-size、padding、gap、icon寸法を採取する。
2. オーナーのBrowser 80%基準画像と同じviewport / panel状態を100%でも撮り、狭幅を含めて比較する。
3. `main.css`の既存CSS変数、共通button、form、popup、scrollbarを検索し、component固有px値と共有可能値を分類する。
4. CanvasのCSS size / backing store、pointer座標、popup配置、D&D hit test、devicePixelRatioへ影響しないことを固定入力で確認する。
5. visual boxとhit areaを同じ倍率で縮める箇所、視覚だけ縮めて操作面を維持する箇所を分け、Plan A / Bを記録する。

Slice 0成果物は、現行寸法表、80%相当の目標値、共通token候補、component固有値、hit area境界、最初の実装対象と停止条件とする。

### Slice 0監査結果

固定条件はBrowser viewport `1280×720`、Browser表示100%、`devicePixelRatio = 2.25`、`visualViewport.scale = 1`。CanvasはCSS `1280×720`、backing store `1280×720`で一致しており、UI密度変更のためにCanvas / DPR / pointer座標へ触る必要はない。

| component | 100%現行 | 80%相当目標 |
|---|---:|---:|
| sidebar外幅 | 44px | 35.2px |
| sidebar button | 38px | 30.4px |
| sidebar icon | 24px | 19.2px |
| Q / V文字 | 17px | 13.6px |
| right Layer Panel | 220px | 176px |
| Layer card | 160px × 約41.6px | 128px × 約33.2px |
| Layer thumbnail | 32px | 25.6px |
| Layer名 / meta | 11px / 10px | 8.8px / 8px |
| Layer操作button / icon | 38px / 20px | 30.4px / 16px |
| status文字 | 12px | 9.6px |
| QTP | 約170px × 315px | 約136px × 252px |
| QTP tool button / icon | 24px / 14px | 19.2px / 11.2px |
| Animation Table | 960px × 260px | 768px × 208px |
| Animation frame cell | 30px | 24px |
| Resize popup | 約518px × 415px | 約415px × 332px |
| Settings popup | 約358px × 436px | 約287px × 348px |
| Layer Transform panel | 約482px × 90px | 約385px × 72px |

監査所見:

- `:root`にはpalette変数だけがあり、共有するUI寸法tokenは未定義。Layer card内部には局所寸法変数があり、最初の再利用候補になる。
- sidebar、right panel、status、popupは固定pxが多い。QTPとAnimation Tableは既存JSが注入するCSS内にも寸法があるため、CSS変数参照へ段階接続し、一括移動や全style置換は行わない。
- responsive ruleは実質`prefers-reduced-motion`だけで、narrow viewportやcoarse pointer用の寸法overrideはない。
- ユーザー提供のBrowser 80% sidebar画像では、38px buttonが画面上約30px CSS相当となり、上表の0.8換算と整合する。
- 19〜30pxへ縮むcontrolはmouse / penでは従来80%時と同じ画面寸法だが、touch hit areaとしては小さい。defaultをcompact Plan Aとし、`pointer: coarse`で現行hit areaへ戻すPlan Bを最初の実機比較候補とする。

最初の実装候補:

1. `:root`へsidebar / Layer Panel用の用途別density tokenを追加する。
2. sidebar外幅、button、icon、文字、gap、paddingを0.8相当へ接続する。
3. right Layer Panelの列幅、card、thumbnail、action、文字、操作列を同じtoken系列へ接続する。
4. `pointer: coarse`ではbutton hit areaだけ現行寸法へ戻し、icon / fontのcompact値は維持するPlan Bを比較する。
5. Canvas rect、pointer local座標、Layer D&D、Q / V、status、narrow viewportをBrowser受入してからQTP / Animation Table / popupへ広げる。

停止条件:

- Canvas rect / backing storeまたはpointer local座標が変わる。
- Layer card D&Dのdrop位置、inline name、visibility / clipping操作がずれる。
- compact値で文字判読、pen / touch hit、Q / V発見性が悪化し、coarse overrideでも解消しない。
- QTP / Animation TableのJS注入CSSを一括移動しないとtoken化できない。

## Slice 1: 共通密度tokenと最小適用

1. `main.css`の既存変数を優先し、必要最小限のUI density tokenを追加する。
2. 最初は左sidebarと右Layer Panel等、Canvas座標系から独立した常設UIに限定する。
3. icon、文字、padding、gapを段階調整し、pen / touchで必要な最小hit areaは別tokenまたは内側要素で維持する。
4. componentごとの近似色、独自scrollbar、JS inline styleを増やさない。
5. 実測で共通tokenが不自然なcomponentは無理に統一せず、用途別tokenへ分ける。

### Slice 1実装結果

- 80%相当値は端数を用途別に丸め、sidebarを35px、buttonを30px、iconを19px、Q / V文字を14pxへ接続した。
- right Layer Panelは表示列を通常132px、CAF 164px、scroll列14pxとし、cardを128px、thumbnailを26px、Layer操作buttonを30pxへ接続した。Slice 2bでCAF列だけ144pxへ追加調整した。
- Layer階層はrenderer既存の`--card-row-width` / `--card-row-margin-left`をそのまま使い、別のdepth / ownership正本を作らずcard幅だけcompact上限へ収めた。
- `pointer: coarse`ではrail / Layer操作buttonとcard行のhit areaを従来寸法へ戻し、compactなicon / fontを維持するPlan Bを追加した。実pen / touch端末での最終判定は残す。
- Browser 100%、viewport 1280×720、DPR 2.25でsidebar 35px、button 30px、Layer card 128px、thumbnail 26pxを確認した。CanvasはCSS / backing storeとも1280×720で不変。
- 通常LayerをFolderへD&Dし、子行が既存12px indent、116px幅で収まることを確認した。QTP再開、`A`でAnimation Table 960×260、QTPとの同時表示、`V`開始と`Esc`キャンセル、popup z-order、console errorなしを確認した。
- このSliceではQTP、Animation Table、status、各popup / form自体の密度は変更していない。

## Slice 2: popup / table / form展開

Slice 1のBrowser受入後に、QTP、Animation Table、各popup、status、tooltip、formへ順に広げる。一括置換は行わず、popup位置、stacking、scroll、drag、resizeをcomponentごとに確認する。

### Slice 2a実装結果: QTP

- `main.css`へQTP用途別density tokenを追加し、JS内の既存CSS注入をそのtokenへ接続した。Popup / EventBus / localStorageの既存状態経路は変更していない。
- QTPを170×約315pxから136×約261pxへ縮小し、palette / toolを24pxから19px、tool iconを14pxから11px、presetを24×40pxから19×32px、slider cardを156pxから124pxへ丸めた。
- `pointer: coarse`ではPopup幅、6列control、preset、slider button、close、主要palette button、slider handleのhit areaを従来寸法へ戻す。
- 実操作で、Pixel Selection自体はactiveでもQTPが直前のbrush表示へ戻る既存不整合を発見した。`_syncFromBrushSettings()`が既存PixelSelectionSystemのactive状態を先に参照し、`selection:tool-changed`を購読するよう修正した。新しいtool状態は追加していない。
- Browser 100%、1280×720、DPR 2.25で、選択Tool click、Q close / reopen、`M` ON / OFF、`P / E / B / G`同期、QTP drag位置の再open維持、color slot subpopup、Animation Tableとの同時表示、`V`開始 / `Esc`キャンセル、z-order、console errorなしを確認した。
- CanvasはCSS / backing storeとも1280×720で不変。`node --check ui/quick-access-popup.js`と`npm.cmd run build`は成功し、build生成`dist`差分は清掃した。

### Slice 2b実装結果: CAF / Animation Table

- CAF右パネルを用途別tokenへ接続し、CAF列164pxから144px、CAF見出し48pxから40px、CAF icon 30×24pxから24×19px、CAF名15pxから12px、Frame操作部30pxから24pxへ縮小した。Browser実測ではCAF右パネル208pxから188px、CAF title 48pxから40pxになった。
- Animation Tableの全体幅とCanvas座標は維持し、既定高さ260pxから240px、track列140pxから112px、frame cell 30pxから24px、header行24pxから20px、Lane行32pxから26px、Cel 22pxから18pxへ縮小した。frame表示は既存30pxを100%とするため、新既定は80%表示になる。
- 既存localStorage設定にはdensity versionを付け、旧既定の高さ260px / cell 30pxだけを240px / 24pxへ一度移行する。利用者が手動変更したpanel size / zoomは維持し、新しいTimeline状態正本は作っていない。
- `pointer: coarse`ではCAF icon / text / Frame操作、Animation header / Lane / Celを従来hit area相当へ戻す。mouse時のcompact値とpen / touch時の操作面を分離した。
- Browser 100%、1280×720、DPR 2.25で6 Laneを同時表示し、全Lane 26px、Lane visibility ON / OFF、A close / reopen、QTP同時表示、CAF内部LayerでV開始 / Escキャンセル、popup z-order、console errorなしを確認した。
- CAF見出し右端とvisibility buttonの間を8px確保し、CAF内部Layer行を126pxまで広げた。`レイヤー1`は既存9px文字のまま54px全幅を表示でき、文字縮小は不要だった。
- Animation Table表示中のPixel Selectionは、`V`が`keyboard:vkey-state-changed`を経由しないため、合成previewが再適用されてfloating spriteを隠していた。既存`selection:transform-started / ended`をAnimation Tableの既存transform preview停止・復帰経路へ接続し、新しい選択・Motion正本を追加せずライブ表示を復旧した。
- Browserで`M`選択後の`V`移動を確認し、`Esc`キャンセル、確定、Undo / Redo、`A` close / reopenの各状態が一致し、確定時のHistory追加が1件だけであることとconsole errorなしを確認した。
- `node --check`は変更中の全JSで成功し、`npm.cmd run build`も成功した。build生成`dist`差分は清掃し、稼働中dev server由来の`.vite/`差分は維持した。

### Slice 2c実装結果: status / Resize / Settings / Layer Transform

- status、Resize、Settings、Layer Transform用のdensity tokenを`main.css`へ追加し、Canvasやapp rootのscaleは行っていない。`pointer: coarse`では主要controlとpopup寸法を従来値へ戻す。
- Browser 100%、viewport 1158×720で、Resizeを520×約417pxから420×約356px、Settingsを360×約438pxから288×約355px、Layer Transformを約482×90pxから約386×72px、statusを12pxから10pxへ縮小した。
- Resize previewの上限はCSS tokenをJS計算から参照し、視覚寸法とpreview計算の固定値を分離しない。popup drag、対象 / fit切替、step操作、Settings tab、QTP / Animation Table / Settingsの同時表示とz-orderを確認した。
- compact Layer Transformで30px移動と`Esc`キャンセルを確認し、Historyを増やさず元位置へ戻った。consoleにerror / warnはない。
- CAF化後にTableを閉じるとPixel Selectionのstatusだけがactiveでも矩形overlayが出ない不整合を再現した。原因はselection可否がPopup visibilityへ依存していたことであり、選択中Clipとworking Layerの既存adapter対応をAnimation Tableから問い合わせるpublic predicateへ置換した。
- Table表示中の選択移動はpreview、確定、Table close後で同じ位置を固定入力確認し、報告された確定時の追加の下ずれは再現しなかった。将来の通常 / 開Table / 閉Table CAF状態共通化はproposal 14へ分離し、Phase 6hでは広い再構成を行っていない。

## 禁止事項

- `body`、app root、Canvas wrapperへの`transform: scale(0.8)`、CSS `zoom`、一括倍率指定を行わない。
- Canvas backing size、Project Canvas size、DPR、screen-to-local変換、pointer samplingをUI密度目的で変更しない。
- 既存のQTP / PopupManager / Layer Transform / Animation Table状態正本を複製しない。
- toolbar user customization、Text、Deformer SELECT、CAF内部階層Motion、BONE、Mesh、Perform、physics、WebGPUへ広げない。
- Folder clipping、working Layer、preview staging / container順、上側Lane前面、onion display-only、PSD record順、保存正本を変更しない。

## 最初の作業

Phase 6hはSlice 0〜2cを完了した。次はPhase 6iとしてproposal 15のGate 0を行い、CAF内部Part / Folderの所有、stable ID、History / copy / paste / save / load、評価順、Animation Table子行投影を固定してからBONE実装順を決める。Pixel Selectionの横断リファクタリングは、保存・確定位置の破損が再現しない限りRig系列を止めず後続候補として維持する。

## 検証

- 変更したJSがある場合は`node --check`。
- `npm.cmd run build`。
- Browser 100%でsidebar、Layer Panel、QTP、Animation Table、主要popup、status、form、tooltipの視認性と配置を確認する。
- QTP開閉とtool復帰、`P / E / B / G / M / Q / A / V`、Layer Transform、Layer Panel D&D、通常描画 / CAF描画、popup stacking、narrow viewport、console errorを確認する。
- 可能ならpen / touchでhit areaとCanvas座標ずれがないことを確認する。
- build後に`tegaki_work/dist/`の生成差分を残さない。稼働中dev server由来の`.vite/`既存差分は勝手に巻き戻さない。
