# Tegaki UI / CSS スタイルガイド

更新日: 2026-08-29

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
- Phase 9k以降、dark floating railのproduction surfaceは既存Futaba palette（maroon / light-maroon / medium）から導出し、独立neutral gray / umberをproduction tokenにしない。現行値はlight-maroon 98→88% gradient、外側shadowなし。透過はrail backgroundだけへ限定し、glyph / SVGへ親opacityを掛けない。restingは淡色glyph、hoverはborderなしの小面積surface、active / popup-openは橙surface＋淡色glyph、enabled destructiveは不透明on-dark橙`#ffb87e`を第一案とし、focus-visibleはkeyboard位置を失わない範囲で別に残す。半透明railはart上で通常 / Setup / Motion / destructiveが最低3:1を満たす両端alphaをverifierで固定し、現行下端は88%を下限とする。
- 数値contrastは安全下限であり、知覚上の同じ強さを保証しない。同時対比により、同じ橙は暗色surround上で沈んで見え、同じgrayは淡色surround上で暗く・暗色surround上で明るく見えることがある。semantic色は実際のon-light / on-dark surfaceと明暗art上で比較し、必要なら役割を維持した別tokenへ分ける。錯視だけへstateを依存させず、surface / outline / icon shape / labelを併用し、自動art samplingや保存theme stateは別Gateまで導入しない。
- 個別panelのヘッダーへ準拠宣言を書かない。共通class / tokenを使っていることを実コードとverifierで確認する。

### 4B. Attention Budget / Intent Lens

- visual hierarchyは「強い順」だけでなく、現在taskへ必要な時だけ強くなる時間軸を持つ。resting / hover / selected / active / playing / warningを同一強度へしない。
- 注目度はcontrast比、色、面積、中央配置の単独値で決めない。taskとの関連、surround、選択履歴、scene内の位置、同時に強いsurfaceの数を同じfixtureで見る。WCAG contrastは可読性Gateであり、第一注目の指定ではない。
- 意志の拡散量は、常時見えるaction group数、高contrast面数、triggerから結果までの距離、同時window / mode数、戻る操作数、selectionとmode進入の兼用数で監査する。数値を疑似科学的な総合点へせず、同じtaskの比較表と実操作時間・誤操作で判断する。
- focus lensは`trigger / active context / detail / exit`を一組で見せる。通常clickがselection、drag、retimeを持つ対象では、同じclickへ深いmode進入を重ねない。明示context actionとkeyboard入口を第一候補とし、double click / double tapは補助入口に留める。
- mode切替は色だけで知らせず、mode名、対象名、breadcrumb / Back、ARIA、Escape契約を残す。強いdark frameをmode標識へ使う案も、文字と構造による表示を省略しない。
- 水平参照した外部toolの配置はそのまま移植せず、常設、選択後、mode内、popover内のどの深度へ置いたかを抽出する。Tegaki固有案は同じDOM / stateで比較し、人気と独自性のどちらも自動的な採用理由にしない。

### 4C. SVG iconの参照順序とcustom policy

- 既存iconは `UI_ICONS`、`開発用資料保管庫/資料_svg`、公式Lucideの順に検索する。
- 完全一致がない場合だけLucide風のcustom SVGを許可する。customは公式Lucideと称せず、`viewBox="0 0 24 24"`、`currentColor`、`fill="none"`、round cap / join、strokeを揃え、通常 / hover / active / disabledのpalette・state・ARIA / titleを明示する。
- 再利用するcustom iconはinline複製せず `UI_ICONS` へ集約し、利用箇所は共通icon classで寸法・strokeを管理する。

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
- popupをfocus lensとして使う場合、元のoverviewを保持できる利点と、Canvas上のwindow競合、triggerからdetailへの視線移動、popup stacking、close後のfocus復帰をin-place mode / split viewと比較する。別windowであること自体を明示性の根拠にしない。

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
- Phase 9mのSelected Clip contextでは、Timeline本体の橙single surfaceがselectionの主表示であることを前提に、Bottom projectionの重複外枠 / shadow / Duration separatorを除いた。contextは低差Futaba面＋4px橙dot、子actionはresting transparent / hover面 / focus-visible 2px橙outline、Deleteは栗色textで維持する。これは「新しいほど枠なし」という一般則ではなく、同じstateを示す枠の重複だけを落としたcomponent判断である。Timeline cell / grid、focus、selected、D&D等の構造・状態境界は別のborder inventoryで判定する。
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
- Phase 9j以降、right control rail、CAF group、mirror card、normal Layer / Folder card、selected / activeのstatic appearanceは`styles/components/layer-panel-surface.css`を正本とする。paletteと現行appearance値は`main.css`の`--ui-layer-*`、rowのruntime inline styleはwidth / indentだけを持つ。
- theme比較は同じDOM / class / data adapterへtokenだけを差し替える。Layer renderer、Project / localStorage theme flag、appearance専用model stateを増やさない。
- Canvasと中心視Panelを淡色に保ったまま外周を濃くする案は、左Sidebar / 右rail / 外周背景を一体で比較する。右rail単独の反転、大面積maroon / pure black、広範囲blurをcomponent移行のついでに入れない。
- CAF / Layer Panelの情報量を減らす場合はappearance変更の続きとしてDOMやadapterを削らない。CAF identity / current contextをLayer Panelへどこまで残すか、CAF順序・階層をAnimation Tableへ寄せるか、CAF間cut / copy / pasteをどう明示するかを同じfixtureで比較し、`1 UI engine / 2 data adapter`と保存正本を維持した別Gateで扱う。
- Phase 9m Owner follow-up以降のcompact baselineはvisual row 30px、thumbnail hit 20px、内側content 16px相当、名称gap 5px。thumbnail上下の橙余白とFolder縦線の3px insetを確保し、背景rowを含む同一context内で高さを揃える。active rowのthumbnail contentは`--ui-layer-surface-thumb-protect`を`content-box`へ限定して橙の色被りを避ける。coarse hit areaはcontent寸法へ縮めず外側hit box / media ruleで維持する。
- current targetの橙surfaceはrow外周へ連続させ、thumbnail contentだけを2px insetの磨りガラスcontent-boxで保護する。選択面積が大きいLayer rowではactive orangeを54%まで透過し、元Raster / Folder情報と実際のCanvas / 周辺surface上で知覚contrastを確認する。
- Frame control、CAF identity、internal Layer / Folder、背景は同じ`--ui-layer-context-*` surface / backdrop-filterを使う二段stackとして扱い、dark operation rail導入後はLayer context shadowを足さない。Timeline frame / onionのbehavior所有は`TimelineUI`に残す。
- Table表示中のright-panel D&D入口を置く場合も、clip mirror adapterから既存Animation Table mutation / History正本を呼ぶ。Layer Panel専用の並べ替えmodelや保存stateを作らない。

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
- top header / Bottom utilityのdark化は、Timelineを上下から挟んで主面を狭く見せる危険と、transport / context境界を明示する利点を分けて比較する。`current warm / dark top / dark bottom / dark bothまたはFocus時だけ`をFutaba-derived surfaceで一DOM比較し、neutral black、全面dark、色だけのmode表示をproductionへ直入れしない。
- Lane交互濃淡は長い横行追跡を助ける可能性がある一方、実験上の速度改善は強くなく、偶奇へ存在しない意味を感じさせ得る。`均一＋subtle divider / 低差Futaba zebra / Folder・group等のsemantic band`を比較し、selected / current / hidden / onion / drop targetの意味surfaceが必ず上位に読めることをGateにする。偶奇を保存stateやLane identityにしない。
- Clip通常clickはselection / move / retimeの入口として維持し、深い編集を自動openしない。第一候補はselected CAFだけに現れる明示`FOCUS` action＋keyboard入口から、同じAnimation Table bodyを`Lane overview → Clip Focus`へin-place切替し、breadcrumbで戻る構成。Dope Sheet / Motion GraphはFocus内subviewとし、別Timeline / selection / History / saveを作らない。
- Clip Focusの比較には、`A current auto detail / B anchored window / C in-place Table mode / D split overview＋detail`を含める。Cを第一候補とするが、Owner visual、wide / narrow、mouse / pen / touch、close / reopen、誤進入、戻りやすさを固定fixtureで比較するまでproduction採用しない。

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
