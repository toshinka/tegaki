# Phase 9j — Right Layer Panel Theme Surface / Static Authority Gate

作成日: 2026-08-26

状態: CLOSED — Gate 0=`GO — B: computed-equivalent theme bridge`、Gate 1=`GO — A: Current warm`、SOL final review=`A`

## 1. 目的

Phase 9h / 9iで受入れた左Sidebarの軽い浮遊railとbehaviorを基準に、右Layer Panelを将来のWarm / stronger shell / inverse themeで安全に比較できる構造へする。まず見た目を変えず、Layer / Folder / CAF cardの固定色・border・surfaceをJavaScriptのruntime geometryから分離し、theme token＋component stylesheetへ一正本化する。

本Phaseはdark mode採用Phaseではない。現在のFutaba light appearanceをcomputed-equivalent baselineとして固定してから、外周を濃くする案と反転案をfixture上だけで比較する。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9i.md`
7. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
8. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
9. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
10. `ClaudeReview/gui-skin-redesign-revision-2026-08-25.md`
11. `ClaudeReview/color-philosophy-background-panel-icon-balance.md`
12. `tegaki_work/index.html`
13. `tegaki_work/styles/main.css`
14. `tegaki_work/styles/components/sidebar-rail.css`
15. `tegaki_work/ui/dom-builder.js`
16. `tegaki_work/ui/layer-panel-renderer.js`

## 3. Stage A inventory / Gate 0

現行の右側surfaceは次へ分散している。

| surface | 現行正本 / 問題 |
|---|---|
| `.right-panel` / `.layer-panel-container` | geometryは`main.css`で妥当。外殻surfaceはtransparent |
| `.layer-controls-row` | static surface / shadowとlayoutが`main.css`で混在 |
| `.caf-simple-group / asset` |固定rgba / borderが`main.css`へ直書き |
| `.clip-layer-mirror-row` | card固定surface / state色が`main.css`へ直書き |
| `.legacy-layer-card-row` | CSS fallbackに加え、`_createLegacyLayerCardRowStyleState()`が固定hex / rgba / border幅をruntime styleへ注入 |
| row indent / width / D&D shift | Layer構造とgestureから決まるruntime geometry。JavaScriptに維持 |

比較:

- A Current scattered authority: 現状appearanceは維持するが、theme変更時にJSとCSSが分岐するため不採用。
- B computed-equivalent theme bridge: **GO**。固定appearanceをsemantic / component tokenと`layer-panel-surface.css`へ寄せ、JSはclass＋geometryだけを持つ。
- C immediate inverse / dark production skin: **HOLD**。Canvas背景、thumbnail、CAF hierarchy、active橙、右railとのcontrastを一度に変えるため、B後のfixture比較なしでは採用しない。

## 4. Stage B — 最初の限定Slice

1. `styles/main.css`の`:root`へLayer Panelのrole-based appearance tokenを追加する。名前は色名でなく`surface / folder / card / border / selected`の役割を示す。
2. `styles/components/layer-panel-surface.css`を追加し、right control rail、CAF group、mirror card、legacy Layer / Folder cardのstatic appearanceだけを所有する。
3. `_createLegacyLayerCardRowStyleState()`から固定色・borderを除去し、row width / indentだけを残す。Folder open / collapsed、selected / activeは既存classへ投影する。
4. 現行computed valueを変えない。left Sidebar、card寸法、thumbnail、action、D&D、scroll、normal / CAF adapter、History / save / Layer modelを変更しない。
5. Current warm / stronger outer shell / controlled inverseの三案はfixtureでだけ比較し、production theme selectorや保存flagを作らない。

## 5. Acceptance Criteria

- 通常Layer / Folder open・closed / Background / selected / active / hiddenと、CAF header / internal mirror cardがStage B前と同じappearance・寸法・順序を持つ。
- Layer cardのinline styleに固定hex / rgba / border幅が残らず、動的width / indentだけが残る。
- normal LayerとCAFは「1 UI engine / 2 data adapter」を維持し、folder nesting、thumbnail、visibility、clipping、D&D、rename、opacity wheelを変えない。
- component stylesheetは`index.html`で一度だけ、`main.css`後に読み込む。移行selectorをJS注入や別stylesheetへ重複させない。
- fixed verifier、全`build/verify-*.mjs`、build、Browser wide / narrow、Folder / CAF / D&D / action / console、生成物清掃を行う。

## 6. No-go

- production dark mode / theme picker / Project・localStorage保存flag。
- 左Sidebarのsurface、tool順、icon、role / ARIA、popup behaviorの再変更。
- Layer Panel DOM再構築、renderer統合、data adapter統合、class一括rename。
- card寸法、right rail tool順、Layer機能、D&D engine、History / save / model変更。
- Animation Table第2header rowのfooter移動、inline SVG一括集約、全popup skinの同時移行。
- neutral black / white / gray中心の新palette、全面glass化、全面反転。

## 7. 外部レビュー採否

- Claude改訂版の「token / Authority Mapは既に完成」「Layer Panelはfull inverseより既存semantic surfaceの限定展開を先行」を採用する。
- Claude配色考察の「Canvasと中心視Panelは淡色維持、周辺rail / 外周だけを一体で濃くする」「真黒や大面積maroonを避け、低彩度umberを比較する」を採用する。右railだけの先行濃色化は左右の文化を分断するため、本Phaseのproductionへ入れない。
- 半透明 / blurは狭さの緩和候補だが、背後依存、narrow体感、広範囲backdrop-filter負荷をfixtureと実制作で測るまで採用しない。
- Animation Table footer化とSVG集約は有効候補だが、wheel / selected context /巨大file変更を含むため本Phaseへ混ぜない。
- Web GPTの文書routing案は、`00_計画索引.md`の役割・読む場面・現行 / Archive分離ですでに実現済みと判定する。新しい管理層やproposal一括tag化は行わない。

## 8. model分担

- Gate 0、token命名、static / geometry境界、diff review、Browser比較、close: SOL / XHigh。
- Gate後に対象selectorとcomputed-equivalent値が固定されたCSS / JS限定Slice: LUNA / MAXへ委譲可。
- theme採用、dark / inverse判断、DOM / adapter / behavior判断が必要になった場合はLUNAで広げずSOLへ返す。

## 9. Stage B 実施結果（2026-08-26）

- `main.css`へ現行computed valueと等価な`--ui-layer-*` appearance tokenを追加した。
- `styles/components/layer-panel-surface.css`を新設し、right control rail、CAF group、internal mirror card、normal Layer / Folder card、selected / active surfaceのstatic ownerとした。
- `_createLegacyLayerCardRowStyleState()`から固定hex / rgba / borderを除去し、width / indentだけをruntime styleへ残した。Folder open / collapsedは既存`folderExpanded`からclassへ投影する。
- `build/phase9j-layer-panel-theme-surface-fixture.html`でCurrent warm / Stronger outer shell / Controlled inverseを同一DOM・token差だけで比較可能にした。productionはCurrent warmを維持し、B / C配色は未採用。
- `build/verify-layer-panel-theme-surface.mjs`を追加し、load順、token消費、static owner、runtime geometry、三案fixtureを固定した。
- Browserでnormal Layer、Folder追加・開閉、Layer→Folder D&D、wide / 700px narrow、horizontal overflowなし、inline styleがgeometry限定であることを確認した。
- Table表示後のCAF header / internal Folder / internal Layer、Folder開閉、CAF内部Layer追加、通常Layerから引き継いだdepth、console error 0件を確認した。

## 10. Gate 1 判定

- A Current warm: **GO — Phase 9j production**。既存の淡色Layer / Folder / CAF cardと左右railの文化を維持する。
- B Stronger outer shell: **NEXT GATE**。Claude配色考察とOwner方針に整合するが、右rail単独ではなく左Sidebar、右rail、外周背景を一体で比較する必要がある。
- C Controlled inverse: **HOLD**。中心視で扱うLayer / QTP / Animation Tableまで反転し、thumbnail / focus /長時間疲労の変数が多い。
- 次GateはCanvas色を固定し、Current / muted umber外周 / translucent umber外周を同一fixtureで比較する。production theme picker、保存flag、全面dark化は作らない。

## 11. Close記録（2026-08-27）

- 変更JSの`node --check`、全109 `build/verify-*.mjs`、`npm.cmd run build`を通過した。buildの大chunk warningは既知であり、本Phaseのstatic CSS境界とは分離する。
- Browserで通常Layer、Folder open / collapsed、Layer→Folder D&D、Table表示後のCAF header / internal mirror / Folder開閉 / internal Layer追加、wide / 700px narrow、console error 0件を確認した。
- production appearanceはCurrent warmのcomputed-equivalentを維持し、dark theme、theme picker、Project / localStorage保存flag、第二renderer / adapterを追加していない。
- SOL final review=`A`。Ownerの長時間制作比較をclose条件にせず、濃色外周の体感・透過率・負荷は次Phaseの比較GateとOwner確認へ分離する。
