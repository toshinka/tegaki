# Phase 6g: UIツール導線・Quick Tool Panel / sidebar整理（完了）

更新日: 2026-07-28

## 現在地

- Phase 6fはMotion / WARPの現行flatten Bakeを維持したまま、CAF内部Layer / Folder構造を保持する逐次Bake、原子的cancel / rollback、容量preflightを完了した。外部Project実再読込と400×400・1 Layer・240 Frame実測まで通過し、記録を`開発用資料保管庫/Archive/phase6f.md`へ移した。
- 左sidebarにはPen / Eraser / Spray / Fill / Selection等の入口が残る一方、Quick Tool Panelにも同じ描画toolがある。重複を一度に削除せず、QTPを確実に開閉・復帰できる入口とLayer Transform入口を先に固定する。
- Text、WARP control pointの複数選択はproposal 14、CAF内部階層Motionのデータと評価順はproposal 15の後続Phaseであり、本Phaseへ混ぜない。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6f.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
9. `tegaki_work/ui/dom-builder.js`
10. `tegaki_work/ui/ui-panels.js`
11. `tegaki_work/ui/quick-access-popup.js`
12. `tegaki_work/ui/keyboard-handler.js`
13. `tegaki_work/system/layer-transform.js`
14. `tegaki_work/styles/main.css`

## 目的

Quick Tool Panelを描画toolの主入口として使えるようにし、左sidebarへQTP開閉用`Q`とLayer Transform入口を追加する。shortcut、現在tool表示、pen / touch操作、popup lifecycleを壊さないことを確認した後、QTPと重複するsidebar描画tool iconを段階的に整理する。

## Slice 0: 既存導線監査

1. sidebar / QTP / keyboardからPen、Eraser、Spray、Fill、Selection、Layer Transformへ入るeventとtool復帰経路を全検索する。
2. QTPの開閉正本を`PopupManager` / `UIPanels.toggleQuickAccessPopup()`へ寄せ、別のpopup stateを作らない。
3. Layer Transformは既存`V` shortcut、selection transform、CAF working adapter、Folder全子孫previewを再利用し、新しいtransform正本を作らない。
4. sidebar iconを削除する前に、QTPを閉じた状態、別popup表示中、Animation Table開閉中、pen / touchでの復帰を固定入力化する。

### Slice 0監査結果

- `Q`は既存`KeyQ -> QUICK_ACCESS_TOGGLE -> QuickAccessPopup.toggle()`を通り、popup正本は`PopupManager`登録instanceにある。sidebar表示は`popup:shown` / `popup:hidden`から導出し、新しい開閉stateを持たない。
- `V`は既存`KeyboardHandler`の開始可否、`keyboard:vkey-state-changed`、`LayerSystem` / `LayerTransform`、selection transformを通る。button用に同じtoggle関数を公開しただけで、transform正本を増やさない。
- 通常Layer、子Rasterを持つFolder、CAF working Layer / CAF内部Folder、selection transformは既存経路を共有する。空Folderと背景Layerは開始不可のまま維持する。
- QTPはbody mount、Animation Tableもbody mountで、既存stackingはQTP `z-index: 2600`、Animation Table `2000`、right panel `1000`。同時表示時もQTPを前面に維持する。

## Slice 1: Q / Layer Transform入口

1. 左sidebarへQTP開閉用の明示`Q` buttonを追加する。既存QTP toggleと同じ経路を使用し、popup重複生成や独自shortcut stateを持たない。
2. Layer Transform用buttonを追加し、既存`V`入口と同じ開始可否・確定 / cancel境界へ接続する。
3. QTP内で選択したtool、keyboard shortcutで選択したtool、sidebarから開始したLayer Transformのactive表示を同期する。
4. 既存のAlbum / import / export / resize / Animation Table / settings入口は維持する。

### Slice 1実装結果

- 左sidebarへnative buttonの`Q` / `V`入口を追加し、popup / transform eventからactive表示と`aria-pressed`を同期した。
- QTP内tool選択後の再open、`P / E / B / G / M / Q / A / V`、通常LayerとCAF内部Layer / Folderのtransform開始・確定・cancel、selection transform、Animation Table同時表示、popup stacking、console errorなしをBrowserで確認した。
- 既存のPen / Eraser / Spray / Fill / Selection iconは残した。実ペン・タッチ端末で発見性と操作回数を確認してからPlan A継続かPlan Bを決める。

## Slice 2: sidebar段階縮小

1. QTPと重複する描画tool iconは、Q入口、tool復帰、shortcut、touch導線の実機確認後にまとめてではなく段階削除する。
2. Pen `P`、Eraser `E`、Spray `B`、Fill `G`、Selection `M`、Animation Table `A`、Settings `S`の既存shortcutを維持する。
3. sidebar縮小後も現在tool、QTP active preset、status表示、popup stackingを一致させる。

### Slice 2実装結果

- オーナー実機でshortcutとQTP展開に問題がなく、左sidebarの重複描画toolが不要と確認されたためPlan Aを採用した。
- Pen / Eraser / Spray / Fill / Selectionのsidebar iconを削除し、描画tool入口をQTPへ集約した。shortcutとstatus表示のevent経路は変更していない。
- sidebarはnative `title`を廃止した後もcustom tooltipが小popupとして視界を遮ったため、sidebarだけtooltip表示を削除した。各入口の`aria-label`、Q / V表記、shortcutは維持する。
- 38pxのtouch hit areaは維持し、Lucide SVGを24px、Q / V文字を17pxへ揃えて、iconとbutton面の視覚比率を改善した。
- QTPの矩形選択iconを単純な`square-dashed`へ変更した。色は固定値ではなく既存`currentColor`を通してふたば色を維持する。

## 維持する契約

- 通常Layer / CAF working Layerの描画正本、History、Layer Transform、selection transformを変更しない。
- stroke中working Layer表示、preview staging交換、preview container順、上側Lane前面、PSD record順、onion display-only、Folder clippingへ触れない。
- WARP mask / placement / brush、Motion / WARP Bake、容量gateへ触れない。
- Text、Deformer SELECT、階層Motion、Bone、physics、WebGPUを実装しない。
- CSSは既存変数と共通button / tooltipを再利用し、黒・白・灰の直書きやcomponent専用近似色を増やさない。

## 完了判定

- Slice 0〜2とPlan Aのsidebar縮小を完了した。
- 削除済みsidebar描画tool専用の到達不能handlerも残存監査で除去し、Q / V、resize、Animation Table、Library、import / export、Settingsのdispatchを維持した。
- BrowserでQTP開閉、矩形選択後の再open、Layer Transform開始 / 確定、console errorなしを再確認した。
- toolbar user customizationへは広げず、Browser 100%で現状80%相当のUI密度を目指すPhase 6hへ引き継ぐ。

## 検証

- 変更JSの`node --check`。
- `npm.cmd run build`。
- BrowserでQTPの開閉、tool選択と復帰、keyboard shortcut、Layer Transform開始 / 確定 / cancel、通常Layer / CAF / Folder、Animation Table開閉、popup stacking、console errorを確認する。
- build後に`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。
