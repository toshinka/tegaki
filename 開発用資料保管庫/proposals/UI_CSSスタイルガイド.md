# Tegaki UI / CSS スタイルガイド

更新日: 2026-08-24

## 役割

新規UIと、変更対象componentの命名・配色・style責務を揃えるための基準。
全既存classを一括renameする辞書ではない。

更新は毎変更で強制せず、次のタイミングでまとめて行う。

- UI整理Phaseの完了時。
- 同じ不整合が複数componentで見つかった時。
- popup、Layer Panel、Timeline等の共通契約を変更した時。
- Phase 5eの定期監査時。

## 1. CSS class命名

原則はkebab-case。

```text
component:        .timeline-clip
element:          .popup-panel__body
variant:          .ui-icon-button--small
runtime state:    .is-active
runtime behavior: .is-dragging
```

- `--small` 等は恒常的なvariant。
- `.is-active` 等はJSが付け外す一時state。
- 既存の `.active`、`.selected` は互換性を保つ。新規componentでは `.is-*` を優先する。
- component固有名と汎用名を混ぜない。
- JSから渡すCSS custom propertyもkebab-caseにする。

## 2. 既存classの扱い

- `.caf-simple-header` 等の稼働中classを、名称だけを理由に一括renameしない。
- componentを実際に改修する時に、新classを追加して旧classをaliasとして残すか、全参照を同一作業内で更新する。
- CSS、querySelector、event delegation、test、drag ghostの参照を全検索する。
- 旧class削除は参照0件を確認してから行う。

## 3. 色

原則として `styles/main.css` の変数を使う。
色を決めてから近い変数を探すのではなく、実装前に既存変数と同用途componentを検索し、その定義から選ぶ。

```css
--futaba-maroon: #800000;
--futaba-light-maroon: #9c3835;
--futaba-medium: #b8706b;
--futaba-light-medium: #d4a8a0;
--futaba-cream: #f0e0d6;
--futaba-background: #ffffee;
--text-primary: #2c1810;
--text-secondary: #5d4037;
--text-inverse: #ffffff;
--active-border: #ff8c42;
```

- body text、label、button、select、option、disabled、placeholderもpalette対象。
- icon、記号、文字、背景へ `black` / `white` / `gray`、`#000` / `#fff`系、neutral grayを安易に追加することを禁止する。色未指定のnative buttonやUnicode記号がbrowser既定の黒へ戻る状態も修正対象。
- 基本はふたば茶系、active / currentは`--active-border`の橙。Setupの青、成功・接続の緑、警告・破壊の赤は意味が明確な場合だけ許可し、componentへの直書きではなく既存semantic変数または共通変数として追加する。
- `--text-inverse`は既存互換の限定token。新規icon / 記号の通常色には使わず、まず`--futaba-background` / `--futaba-cream`と栗茶の組み合わせを使う。
- SVGの`stroke` / `fill`、Unicode記号、hover / active / disabled、Chromiumの`-webkit-text-fill-color`までpalette内で明示する。
- 半透明色は既存paletteのRGBを基準にする。
- canvas / Pixiへ数値色が必要な場合だけJSでCSS変数を読む。DOM装飾のためだけに `getComputedStyle()` を増やさない。

## 4. 共通部品を先に参照する

見た目を追加する前に、少なくとも次を検索する。

```powershell
rg -n "対象component|--futaba-|ui-scrollbar|ui-icon-button|popup-panel" tegaki_work/styles/main.css tegaki_work/ui
```

- 既存のCSS変数、共通class、同用途componentを優先する。
- 共通定義がある場合、近似色や専用scrollbarをその場で作らない。
- 新しい共通値が必要な場合は、既存値で表現できない理由と使用予定componentを確認してから `:root` または共通classへ追加する。
- component固有値を追加する場合も、palette変数または既存共通値から組み立てる。

### 4A. Semantic Surface Token

既存`--futaba-*`はpalette正本、既存`--ui-*-size`等はcomponent寸法正本として維持する。その上へ、複数componentが同じ役割で使う場合だけ意味aliasを置く。

```text
--ui-surface-rail
--ui-surface-float
--ui-surface-control
--ui-surface-control-hover
--ui-surface-control-active
--ui-border-subtle
--ui-border-focus
--ui-shadow-float
--ui-radius-panel
--ui-radius-control
--ui-opacity-disabled
```

- token名は色名でなく役割を表す。`blue-button`、`orange-action`等を作らない。
- Setup青 / Motion橙は既存semanticから派生させ、一般surfaceへ広げない。
- 最初は現行computed valueを変えないalias bridgeとしてsidebar / QTPへ接続し、visual redesignとtoken導入を同じ差分にしない。
- Phase 8l Stage Cの比較では完全borderlessを棄却し、QTP floating surfaceだけに弱い境界・gradient・shadowを残すrestrained-depthを採用した。通常controlはほぼ透明、hover / activeで面差を出し、sidebar railは現行restrained surfaceを維持する。この値を全popupへ一括横展開しない。
- QTPの静的CSSは現在JS注入と`main.css`に重複がある。全面移動は行わず、Phaseで触るruleだけ正本を一つへ寄せ、selector / injection順 / coarse media queryを固定verifierで確認する。
- Phase 9hではSidebar railのresting / hover / focus / active / disabledだけを`styles/components/sidebar-rail.css`へ抽出し、旧`ui-panels.js`注入styleを除去した。geometryとnormal 30px / coarse 38px hitは`main.css` token、state class / ARIAはJavaScriptを正本とする。panel close同期やelement roleをskin CSSへ持ち込まない。
- 個別panelのヘッダーへ準拠宣言を書かない。共通class / tokenを使っていることを実コードとverifierで確認する。

## 5. scrollbar

- scroll可能領域は原則 `.ui-scrollbar` を付ける。
- thumb、track、hover色をcomponent内へ重複定義しない。
- 幅や高さだけcomponent固有調整が必要な場合は、`.ui-scrollbar` を基底に限定的なoverrideを行う。
- Firefox用 `scrollbar-width` / `scrollbar-color` とWebKit用定義を片方だけ追加しない。
- Timeline等で既存専用定義がある場合は、Phase 5e監査時に共通classへ寄せられるか確認する。機能改修と無関係な一括置換はしない。

## 6. JSとCSSの責務

CSSへ置く:

- 色、border、shadow、font、固定padding。
- hover / focus / disabled / selected。
- 固定layoutとcomponent variant。
- show / hide、透過、選択、drag中などのclass state。

JSが扱ってよい:

- pointer位置へ追従する `left/top`。
- viewportから計算する幅・高さ。
- D&Dのreorder shift。
- Timeline zoom等の連続値。
- canvas / Pixiへ渡す数値色。

同じ値を複数elementへ繰り返し設定する場合はclassまたはCSS custom propertyへ移す。

## 7. popup

共通基底:

```html
<div class="popup-panel popup-panel--translucent">
  <button class="ui-close-button"></button>
  <div class="popup-title"></div>
  <div class="popup-content"></div>
</div>
```

- popupの最前面化はz-indexだけで判断せず、overlay mount先と祖先stacking contextを確認する。
- 共通overlay mount helperを使う。
- 固定装飾はCSS、drag後の動的位置はJS。
- BasePopup classは、複数popupに実在するlife-cycle重複を削減できる時だけ導入する。

## 8. button・form

- icon button: `.ui-icon-button` + size variant。
- close: `.ui-close-button`。
- runtime state: `.is-active`, `.is-disabled`。
- `button`, `input`, `select`, `option` は文字色と背景色を明示する。
- native disabledの既定色へ任せず、palette内の色とopacityを設定する。
- Chromium / WebKitがdisabled formへ独自色を再適用する箇所は、`color`だけでなく必要に応じて`-webkit-text-fill-color`もpalette値で指定する。
- focus-visibleは `--active-border` 等で判別できるようにする。

### Surfaceとhit area

- interactive hit areaとvisible icon / borderを分離する。borderlessはhit areaを消す意味ではない。
- 通常時はpanel surfaceとspacingでgroupを示し、hover / active / selected / focus時だけcontrol surfaceを強める。
- Animation Tableのような常設headerでは、休止中の非破壊controlをtransparent border＋淡いsurface、hover / open / focus / activeをsemantic borderとする段階整理を許可する。ただしSelected Clip / Delete / close等のcontextual / destructive actionまで機械的にflat化せず、一componentのfixtureとhit area確認を通してから横展開する。
- desktopの最小targetは24×24 CSS pxを監査線とし、coarse pointerは既存38px rail / 24px QTPを下限として実pen / touchで比較する。見えるicon自体をtarget寸法へ拡大する必要はない。
- disabledはopacityだけへ依存せず、必要ならpalette tooltip / statusで理由を返す。
- 半透明はfloating palette / railへ限定し、input / tooltip / warning / modalは背景art上でも文字・iconが読める不透明度を持つ。

### hover説明

- 新規controlで視覚説明が必要な場合、配色できないnative `title`だけを正式表示にしない。`aria-label`を維持しつつ、palette準拠の共通tooltip classと`data-tooltip`を使う。
- tooltipは`--futaba-background`、`--futaba-maroon`、`--futaba-light-medium`を基準とし、黒背景・白文字・neutral grayを新設しない。
- 既存`title`の一括置換は専用UI監査で行う。機能Sliceでは変更対象controlと新設controlだけを移行する。

## 9. Layer Panel / CAF

- 共通card rendererとdata adapterの境界を維持する。
- 通常LayerとCAF内部Layerのclass差はvariantとして扱う。
- name、meta、thumbnail、action、folder line、D&D stateは共通部品を優先する。
- CAF containerとfolder cardの背景は同色に固定せず、階層が読める薄い差を許容する。
- D&Dのghost、drop line、押しのけanimationは共通engineと共通state classを使う。

## 10. Timeline

推奨語彙:

```text
.timeline-viewport
.timeline-lane
.timeline-clip
.timeline-playhead
.timeline-clip.is-selected
.timeline-viewport.is-panning
```

既存classを置換する際は、cell click、duration handle、Space drag、zoom、CAF D&Dのselectorを同時に確認する。

- Playback headerを省スペース化する場合も、category iconだけで現在値を隠さない。SCOPEは`Monitor＋ALL / LANE / SET`、LOOPはRepeat / Repeat Off＋surface / ARIA、三mode ENDは`END:T / C / O`等の現在値を残す。
- IN / OUT等のrange markerは文字、左右位置、設定済みsurface、現在Frame ring、title / ARIAを併用する。onion等の参照Frame設定と色semanticを混同せず、palette外の白直書きで文字抜きを作らない。
- 保存済みpopup希望幅とviewport制約後の実表示幅が異なる場合、responsive classは実表示幅も含めて判定する。視覚的に畳むlabelはARIAの現在値を失わせない。

## 11. 監査チェック

UI変更時:

- palette外の文字色がないか。
- 色とscrollbarを既存変数・共通classから選んだか。
- native form controlが黒文字へ戻っていないか。
- static styleをJSへ追加していないか。
- mount先が正しく、Sidebar / Layer Panelとの重なりが意図通りか。
- class名がkebab-caseか。
- runtime stateがvariantへ混ざっていないか。
- 旧class互換が必要か。
- browserでhover、disabled、drag、closeを確認したか。
- deformer overlayは役割を色で分ける。現在Frameのpose / point編集は`--deformer-pose-line / --deformer-pose-point`（ふたば橙・maroon）、全keyの基準範囲を再基準化するBind / `GRID RANGE`だけ`--deformer-bind-line / --deformer-bind-point`（青系）を使う。青緑を全Warp編集へ常用しない。Canvas overlayの青は基準範囲編集へ限定する一方、popup内では`RIG` / `MESH`のstatic Setup専用入口・生成actionに同じSetup青semanticを使ってよい。runtime Pose、一般操作、実行結果まで青へ広げず、popup、tooltip、disabled formを白黒灰へ戻す理由にも使わない。

## 関連文書

- `TEGAKI.md`
- `AGENTS.md`
- `開発用資料保管庫/Archive/06_構造改善・保守性.md`
- `開発用資料保管庫/Archive/phase5e.md`
- `開発用資料保管庫/Archive/PHASE5E_AUDIT.md`
