# Tegaki UI Design Authority Map

更新日: 2026-08-24

## 1. 目的

見た目を変更する時に、palette、意味surface、component固有style、runtime geometry、behavior正本を混同しないための入口。完成skinを固定する文書ではない。外部toolを参考に色、枠、font、shapeを更新しても、制作頻度に基づく情報階層と既存操作正本を維持する。

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
- Scope、Range source、Onion等の低頻度設定は、再生より強く見せない。
- Range sourceは通常controlであり、Setup青を使わない。
- IN / OUTは未設定でも存在が分かり、設定後は文字とFrame値を別階層で読める。
- headerの選択肢を一度に晒しすぎず、current valueとFocus Deckでprogressive exposureする。
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
- Phase 9h比較正本は`build/phase9h-sidebar-rail-attention-hierarchy-fixture.html`、検証正本は`build/verify-sidebar-rail-attention-hierarchy.mjs`。Gate 0=`GO — B: Quiet Resting＋Hover Surface＋Active Ring`。
- Animation Table内部×後のA stale active、Q / Vと他入口のelement role / ARIA差はbehavior問題としてPhase 9iへ分離する。CSSへ第二stateを作らない。

## 8. 変更時チェック

1. 変更対象がpalette、semantic、component static、runtime geometry、behaviorのどれかを先に宣言する。
2. `rg`で同selector、class mutation、event、verifierを全検索する。
3. 見た目変更でmodel / History / saveを増やさない。
4. wide / narrow / coarse相当、hover / focus / disabled / active、close / reopenを確認する。
5. 概念fixtureは情報階層を検査し、特定skinの色・枠だけを恒久契約にしない。
