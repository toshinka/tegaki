# Tegaki UI Design Authority Map

更新日: 2026-08-29

## 1. 目的

見た目を変更する時に、palette、意味surface、component固有style、runtime geometry、behavior正本を混同しないための入口。完成skinを固定する文書ではない。外部toolを参考に色、枠、font、shapeを更新しても、制作頻度に基づく情報階層と既存操作正本を維持する。

### Attention / Intent Lens の正本経路

- 普遍理念は`TEGAKI.md`の「認知・注目・意志の焦点」。水平参照、attention budget、mode lens、Futaba文化、AIが追えるfile責務を定める。
- operational ruleは`開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`の`Attention Budget / Intent Lens`と`Timeline`。contrast、dark top / bottom、Lane濃淡、focus entry / exitを定める。
- Phase 9mの役割別priority watchlist、公式資料の鮮度、調査・比較matrixは`開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`を一正本とし、本書へ外部tool別の長い説明を複製しない。
- production authorityは引き続きcomponent CSS＋既存JavaScript / model。研究やfixtureのstateをProject / localStorageへ保存しない。

## 2. 所有場所

| 種類 | 正本 | 置くもの | 置かないもの |
|---|---|---|---|
| Palette | `styles/main.css`の`:root` `--futaba-*` | 製品palette、文字色、active橙 | component名や用途を色名へ埋め込んだtoken |
| Semantic surface | `styles/main.css`の`:root` `--ui-*` | rail / float / control / border / shadow / radiusの意味alias | 単一componentだけの寸法、保存state |
| Component static style | `styles/components/<component>.css` | 色、border、shadow、font、固定padding、固定variant、hover / focus / disabled / state class | model mutation、event、pointer座標、保存値 |
| Transitional injected style | 各UI classの`#*-styles` | 未抽出componentの既存static style、生成が必要な限定rule | 新しく整理済みcomponentと同じselectorの重複正本 |
| Runtime geometry | UI JavaScript | viewport計算の`left / top / width / height`、連続zoom値、gesture中の一時custom property | 固定色、固定font、固定border |
| Behavior / accessibility | UI JavaScript＋model | event、class / ARIA投影、History、save、close / reopen、keyboard / pointer契約 | skin都合の第二stateや第二保存schema |
| Concept fixture | `build/phase*-fixture.html`＋verifier | 情報階層、group、主要action、状態の読み分け | 将来skinを妨げるpixel完全一致 |

## 3. load順

1. `styles/main.css`: palette、semantic token、共通UI基盤。
2. `styles/components/*.css`: 明示的に抽出したcomponentのstatic appearance。
3. runtime `#*-styles`: まだ移していない既存styleと生成rule。

runtime注入が後になる間、抽出selectorはcomponent rootでscopeし、共有base ruleより責務を明確にする。`!important`やID詳細度で勝たせない。移行済みselectorをruntime注入へ重複させない。

## 4. Animation Table Playbackの不変コンセプト

- 再生 / 停止は最頻actionとして、panel幅が変わっても視覚中央の主actionにする。
- Animation Tableの主面はTimeline / Lane stackである。header / Bottom utilityは最小高に留め、主playの強調を専用行や縦積みで表さない。反転surface、glyph、位置で焦点を作り、標準幅のheaderは一行を維持する。
- Scope、Range source、Onion等の低頻度設定は、再生より強く見せない。
- Range sourceは通常controlであり、Setup青を使わない。
- 再生終端は現在値を全称表示し、同じbuttonの順送りで`TIMELINE → LAST CLIP → OUT MARKER`を既存Playback / History正本へ反映する。
- IN / OUTは`OUT MARKER`時だけ終端buttonの隣へ展開する。Playback Range全体はdesktop 80px / coarse 116pxの固定footprintとし、OUT summaryはvisibleにせずI / Oだけを見せる。三mode切替で後続controlを動かさず、title / ARIAとAnimation Table context限定のI / O shortcutを残す。非OUT時はmarker hitをhiddenにする。
- headerの選択肢を一度に晒しすぎず、current valueと機能ごとのprogressive exposureを使う。SCOPEの比較三択はFocus Deck、Playback Endの少数順序選択は直接cycleとする。
- Clip通常clickはselection / move / retimeを維持し、深いdetailを自動openしない。次Gateの第一候補はselected CAFの明示`FOCUS`から同じAnimation Tableをin-place `CLIP FOCUS`へ切り替え、breadcrumbでLane overviewへ戻す構成。Dope Sheet / Motion GraphはFocus内subviewとし、Owner比較前にproductionへ接続しない。
- top / Bottom dark surfaceとLane交互濃淡はfocus modeとは独立したappearance軸である。dark量や偶奇だけへ意味を置かず、current warm、Futaba-derived dark、uniform / zebra / semantic bandを同じstateで比較する。
- 色、枠、角丸、font、shadow、厳密なpixel寸法はskin変更対象であり、上記コンセプトとhit area / contrast / ARIAを満たす限り固定しない。

## 5. Animation Tableの現行境界

- DOM、event、runtime state、History / save: `ui/animation-table-popup.js`。
- Playback static appearance: `styles/components/animation-table-playback.css`。
- palette / semantic token: `styles/main.css`。
- panel位置と寸法: JavaScriptの`_updatePanelPosition()`。
- Timeline連続寸法: `--anim-cell-width / --anim-cel-inset`と生成duration rule。
- Phase 9aのconcept proof: `build/phase9a-animation-table-playback-priority-fixture.html`。
- Phase 9cの三surface skin proof: `build/phase9c-canvas-first-skin-baseline-fixture.html`。Gate 1=`GO — B`だが、production適用はcomponent単位で行う。
- Animation Table Playbackの現行skinは、主playを第一header row内の通常28×24px / coarse 44×38px、通常時を栗色面＋Futaba背景色抜き、playingを橙面＋Futaba茶とする。低頻度Range群はrestrained surfaceを維持する。
- Phase 9eのvisual orderはCSS `order`だけで`FPS / FRAMES → SCOPE → Play → Range / Loop → PREVIEW → Onion`へ投影する。DOM順、ID、event、ARIA、playback model、wheel / dragは`animation-table-popup.js`から移さない。
- Phase 9fのAttention Hierarchyは、休止中SCOPE / PREVIEW / Onion / zoom / 非破壊補助actionをtransparent border＋淡いsurface、hover / open / focus / activeをsemantic borderとする。Selected Clip / Delete / closeはcontextual / destructive境界としてflat化しない。比較正本は`build/phase9f-animation-table-attention-hierarchy-fixture.html`、検証正本は`build/verify-animation-table-attention-hierarchy.mjs`。
- Phase 9mはPlayback header / Timeline content / Bottom utilityと低倍率Clip LODの責務比較Gate。A〜D一DOM fixtureのGate 0=`GO — C first / D staged HOLD`に従い、CだけをStage B productionへ接続した。既存utility actionのBottom投影、selected Clip single surface、resting Clip Futaba中間surface、47 / 33% visual handle LODを表示正本とする。SCOPE SET、wheel三領域、Clip body move / edge retime、History / save、33% zoom下限を維持し、Dの25% / major gridはgesture固定までHOLDする。
- Phase 9m Owner実画面の三行headerは、BrowserでTable幅760pxの`.is-narrow=true`と三cluster 100% wrap、762pxのclass解除 / 36px一行として再現した。compact static正本は620px以下の三列grid、leading / Play nowrap、必要時だけtrailing内部の局所wrapとする。760 / 762 / wideと620px OUT、460px通常は36px一行を維持し、Play / Stop hit、Playback End直接cycle、OUT限定I / O、wheel三領域を変更しない。Owner visual再確認まではPhaseをOPENとする。
- 選択CAFのinternal Folder / BONE / Motion trackはglobal Timelineの常設情報ではない。既定はLane / Clip概要、明示`Clip Focus`時だけ詳細adapterを投影する案を第一候補とし、collapseはFocus内の局所密度制御とする。UI modeをProject schemaへ保存せず、TimelineModel / ClipAsset / Historyの第二正本を作らない。

`animation-table-popup.js`全体を一度に分割しない。次に抽出するcomponentは、DOM / event / state selector、外部参照、load順、fixed fixtureを一Phaseで固定できる場合だけ選ぶ。

## QTP cell appearance

- root / header static appearanceと、Phase 9gのPalette color / tool / preset cell static appearanceは`styles/components/quick-access-popup.css`を正本とする。
- resting cellはtransparent border。Palette color cellだけcream / background近似色を失わない薄い内側contrastを持つ。selectedは橙ring、focus-visibleは2px橙outlineとする。
- Main / Sub swatch、slider、utility、Text / Help / Position deck、runtime geometry、event、ARIA、storage、Canvas inputは`quick-access-popup.js`側の既存正本を維持する。Phase 9g比較正本は`build/phase9g-qtp-attention-hierarchy-fixture.html`、検証正本は`build/verify-qtp-attention-hierarchy.mjs`。

## 6. QTPの現行境界

- DOM、event、ARIA、tool / preset / slider / Text / Help / Position state: `ui/quick-access-popup.js`。
- Palette / semantic surface / QTP寸法token: `styles/main.css`の`:root`と`--ui-qa-*`。
- QTP root / header static appearance: `styles/components/quick-access-popup.css`。
- Text utility static appearance: `styles/main.css`の`qa-text-raster-*`。
- Palette / tool / preset / slider / Help / Position等の未抽出static appearance: `quick-access-popup.js`の`style[data-qa-popup-styles]`に過渡配置されている。
- Position保存正本: localStorage `quick-access-position` の`{ x, y }`。free drag / four-corner preset / reopen clampは共通する。共通fadeInのtransformに影響されないlayout寸法 / 座標でclampする。
- Phase 9d: rootの固定skinとheader appearanceだけをcomponent stylesheetへ抽出した。geometry / behavior宣言とPalette / tool / preset / slider / Text / Help / Position selectorは混ぜていない。header下は1pxのlayout edgeを保ったtransparent borderとし、非active境界の競争だけを減らした。

## 7. Sidebar railの現行境界

- DOM、tool順、element role、ARIA、click delegation、popup / mode state: `ui/dom-builder.js`と`ui/ui-panels.js`。
- Palette / semantic surface / 30px・coarse 38px寸法token: `styles/main.css`の`:root`。
- rail geometry、icon / text寸法、separator: `styles/main.css`。
- resting / hover / focus / active / disabled static appearance: `styles/components/sidebar-rail.css`。
- Phase 9h比較正本は`build/phase9h-sidebar-rail-attention-hierarchy-fixture.html`、検証正本は`build/verify-sidebar-rail-attention-hierarchy.mjs`。Phase 9kではrestをFutaba light-maroon 98→88% gradient rail、外側shadowなし、hoverをborderなしの淡色overlay、popup-open / pressedを橙surface＋淡色glyphへ接続した。pointer / pen起動後のfocus解放とkeyboard起動時のfocus維持は`ui-panels.js`のbehavior正本であり、CSSへ持ち込まない。
- Phase 9iでSidebar 8入口を6 popup launcher / 1 one-shot command / 1 temporary modeへ分類した。popupは`aria-expanded`、Vだけ`aria-pressed`、Importは状態属性なしとし、既存popup visibility eventからopen状態を投影する。CSSへ第二stateを作らない。

## 8. Right Layer Panelの現行境界

- DOM / tool配置: `ui/dom-builder.js`。通常Layer / CAFの描画・event・D&D・adapter: `ui/layer-panel-renderer.js`。
- column / card寸法、scroll、runtime layout: `styles/main.css`の`--ui-layer-*`寸法tokenと既存layout rule。
- right control rail、CAF group、mirror card、normal Layer / Folder card、selected / activeのstatic appearance: `styles/components/layer-panel-surface.css`。
- paletteと現行computed-equivalent appearance token: `styles/main.css`の`:root` `--ui-layer-surface-* / --ui-layer-border-* / --ui-layer-text / --ui-layer-shadow-*`。
- Layer rowのruntime inline styleはwidth / indentだけとし、固定色・borderを入れない。Folder open / collapsed、selected / active / hiddenは既存classをappearanceへ投影する。
- Phase 9j比較正本は`build/phase9j-layer-panel-theme-surface-fixture.html`、検証正本は`build/verify-layer-panel-theme-surface.mjs`。Layer / Folder / CAF cardはCurrent warmを維持する。
- Phase 9kはGate 0=`GO — D: Floating dark rails`、Owner visual受入、SOL final review=`A`でcloseした。比較正本は`build/phase9k-integrated-outer-shell-fixture.html`、fixture検証は`build/verify-integrated-outer-shell-fixture.mjs`、production検証は`build/verify-integrated-outer-shell-production.mjs`。左右rail surface / glyph / hover / active / Setup / Motion / destructiveは`styles/main.css`の`--ui-rail-*`、左の消費は`sidebar-rail.css`、右operation railの消費は`layer-panel-surface.css`を正本とする。production dark surfaceは独立gray / umberでなく`--futaba-light-maroon` 98→88% gradientから導出し、shadowはなし、hoverはborderなし、activeは橙surface＋淡色glyph、enabled trashは不透明on-dark橙`#ffb87e`に限定する。下端alphaは明るいartを含むsemantic contrast 3:1を守る88%を下限とする。同じ数値色の知覚差はactual surrounding surfaceで確認し、色だけへstateを依存させない。Canvas、workspace背景、QTP、Layer / CAF card、Animation Table contentは淡色warmを維持する。Settings rail切替と自動art samplingは凍結し、theme state / 保存flag、production Table footer、CAF card責務簡素化は追加しない。
- normal Layer / CAFは「1 UI engine / 2 data adapter」を維持する。themeのために第二renderer、Project / localStorage theme flag、appearance都合のmodel stateを作らない。
- Phase 9lはGate 0=`GO — D: Flat CAF context＋unified layer list`、SOL final review=`A`でcloseした。比較正本は`build/phase9l-right-layer-caf-focus-fixture.html`、fixture検証は`build/verify-right-layer-caf-focus-fixture.mjs`、production検証は`build/verify-right-layer-caf-focus-production.mjs`。右Panelは既存`selectedCelId / selectedAssetId / selectedInternalLayerId`から選択CAF一件とinternal Layer / Folderを投影し、current targetを橙surface一件で示す。CAF asset列挙とinternal Layer Pointer D&Dは右Panelから外し、Animation TableのCAF管理 / D&D正本へ寄せる。通常Layer D&D、Table内移動、TimelineModel / ClipAsset / DrawingSnapshot、History / saveを変更しない。
- Phase 9m Owner follow-up Stage 0 compact refinementは、Frame / CAF context / internal Layer / Folder / 背景を128px幅へ揃え、Frame＋CAF contextだけを上下接続した一つの`--ui-layer-context-*`磨りガラスsurfaceとして読む。DOM / state正本は統合せず、right-panel全幅は172px、rowは28px、thumbnailは20px hit内を1px insetした18px content-box、meta/name gapは0px、row列間は3px、clip / visibility actionはresting outlineなしを正本とする。current targetはrow全体の54%橙surface、thumbnailは`--ui-layer-surface-thumb-protect`で保護し、階層線は上下3px insetする。Frame移動とTimeline / Lane onionは`TimelineUI.createLayerPanelFrameIndicator()`所有、Table表示中D&Dは既存clip mirror adapter入口だけとし、mutation / History / save正本を動かさない。通常Folder / CAF内部Folderのicon投影は現存し、内容合成Folder / CAF thumbnailは既存内容から導出する将来Gateとして保存bitmap / flagを追加しない。固定検証は`build/verify-layer-panel-frosted-focus-followup.mjs`。
- Phase 9m Stage A比較正本は`build/phase9m-animation-table-utility-lod-fixture.html`、検証正本は`build/verify-animation-table-utility-lod-fixture.mjs`。一つのheader / utility / Lane / Clip DOMで1280 / 720 / 420、120 / 50 / 33 / 25%、selected / unselected、single / multiを切り替える。visual handleと8px logical edge hitを分離し、fixture stateをproductionへ持ち込まない。
- Phase 9m Stage B static appearance正本は`styles/components/animation-table-utility-lod.css`、DOM / event / ARIA正本は既存`ui/animation-table-popup.js`、固定検証は`build/verify-animation-table-utility-lod-production.mjs`。既存第二header rowをmount時にTimeline後へ移し、closeを第一行へ戻すが、button ID / listener / disabled・hidden projectionは再作成しない。headerとBottomは同じzoom handler、Timeline gridは既存Frame wheel authorityを維持する。play中心、620px compact境界、三列grid / trailing局所wrap、420px幅、34px Bottom、Clip surface、visual handle LODだけをcomponent CSSが所有する。
- Selected Clip contextのstatic appearanceも`styles/components/animation-table-utility-lod.css`を正本とする。Timelineのprimary selected Clipをselectionの主surfaceとし、Bottom projectionは低差Futaba面＋4px橙dot、outer border / shadowなし、Duration separatorなし、child actionはresting transparent / hover surface / focus-visible 2px橙outlineとする。COPY / DELETEは中央`UI_ICONS.duplicate / trash`の22×18px icon buttonで可視textを増やさず、件数・shortcut・destructive意味はtitle / ARIAへ残す。Deleteのmutation意味、button ID / listener / hidden・disabled投影、Duration / clipboard / delete action authorityは`ui/animation-table-popup.js`の既存経路を維持する。固定検証は`build/verify-animation-table-selected-clip-actions.mjs`。

## 9. 変更時チェック

1. 変更対象がpalette、semantic、component static、runtime geometry、behaviorのどれかを先に宣言する。
2. `rg`で同selector、class mutation、event、verifierを全検索する。
3. 見た目変更でmodel / History / saveを増やさない。
4. wide / narrow / coarse相当、hover / focus / disabled / active、close / reopenを確認する。
5. 概念fixtureは情報階層を検査し、特定skinの色・枠だけを恒久契約にしない。
