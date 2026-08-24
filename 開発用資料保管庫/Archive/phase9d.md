# Phase 9d — QTP Canvas-first Surface / Component Style Boundary Gate

作成日: 2026-08-24

状態: CLOSED — Stage B完了、SOL final review=`A`。Owner制作確認は`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`へ分離

## 1. 目的

Phase 9cで選んだ`Warm Canvas-first` visual languageを、次の一componentとしてQTP Painter's Paletteへ段階適用できるか監査する。QTPのPalette、tool、6 Pen preset、Size / Opacity、Text utility、Help入口を同じ作業surfaceとして読みやすくしつつ、Canvas占有と通常描画の直接性を維持する。

このPhaseでは最初に`styles/main.css`と`ui/quick-access-popup.js`へ分散したQTP static appearance、runtime geometry、event / storage正本をinventoryし、抽出可能なstatic selectorだけを固定する。Gate 0前にproduction CSS / DOMを変更しない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9c.md`
7. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
8. `開発用資料保管庫/Archive/phase8l.md`
9. `開発用資料保管庫/Archive/phase8q.md`
10. `開発用資料保管庫/Archive/phase8r.md`
11. `開発用資料保管庫/Archive/phase8v.md`
12. `開発用資料保管庫/Archive/phase8w.md`
13. `開発用資料保管庫/Archive/phase8z.md`
14. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
15. `tegaki_work/styles/main.css`
16. `tegaki_work/ui/quick-access-popup.js`
17. `tegaki_work/build/phase9c-canvas-first-skin-baseline-fixture.html`

## 3. 維持するconcept

- Canvasと描画toolを第一水位にし、Palette / active tool / 6 Pen preset / Size / Opacityの直接操作を維持する。
- current / activeは橙、Setupは青、通常utilityはFutaba茶系surfaceとし、外観統一だけでsemantic色を増やさない。
- QTPを閉じた時、通常描画、shortcut、position preset、free drag、viewport clamp、保存x / yを変えない。
- Pen preset非対応toolのruntime退避、Text one-shot panel、read-only shortcut Help deckを別stateへ作り直さない。
- static appearanceはcomponent stylesheetへ置けるが、viewport計算、連続slider値、runtime custom property、event、storageはJavaScriptへ残す。

## 4. Stage A / Gate 0

次をread-only inventoryする。

1. QTP root / header / palette / tool / Pen preset / slider / Text utility / Help / Position deckのselector所有場所。
2. `styles/main.css`と`quick-access-popup.js` injected styleの重複selector、load順、詳細度。
3. runtime `left / top / width / height`、storage key、drag / clamp、tool切替、Text / Help開閉の正本。
4. wide / narrow / coarseのcomputed style、hit area、contrast、Canvas占有。
5. Phase 9c B fixtureとの差を、border競争、surface階層、type scale、spacingだけで分類する。

Gate 0では、最初に抽出・変更する一つのstatic selector群、対象file、Acceptance Criteria、Browser操作、停止条件を固定する。QTP全体の一括移動やDOM再構築が必要なら`HOLD`とし、より小さいselector群へ切り直す。

## 5. 初期Acceptance Criteria

- `Q`開閉、tool切替、6 preset、Size / Opacity、Text、Help、Position preset、drag / clamp、close / reopenが従来どおり動く。
- Canvas面積を増やすための密度整理でも、主要controlのhit areaとcoarse既定を縮めない。
- active/current/disabled/focus/hoverのcontrastをcomputed styleで確認し、黒・白・neutral grayへ落とさない。
- DOM、event、ARIA、localStorage、Project、History、brush engine、Text Raster正本を変更しない。
- production変更後は関連verifier、全`build/verify-*.mjs`、build、Browser wide / narrow / coarse相当、console、生成物清掃を行う。

## 6. No-go

- Gate 0前のproduction QTP変更。
- vertical text、Windows local font、再編集可能Text、font保存schema。
- Pen preset数 / 保存shape、shortcut割当、長押し、第二density mode、第二selection / History。
- Layer Panel、Animation Table、Rig / Mesh / WARPを同時にskin変更すること。
- `quick-access-popup.js`主要classの再構成、QTP DOM全置換、既存class一括rename。

## 7. model分担

- Stage A inventory、Gate 0、authority / load順 / selector境界、全diff review、close: SOL / XHigh。
- Gate後に対象CSS、selector、Acceptance Criteria、検証、停止条件が固定された一つのstatic style Sliceだけ: LUNA / MAXへ委譲可。
- DOM、event、storage、runtime geometryの判断が必要ならLUNAは変更せずSOLへ返す。

## 8. Stage A inventory / Gate 0結果（2026-08-24）

### selector / load順

| 領域 | 現行の正本 | 境界 |
|---|---|---|
| QTP root / header / Palette / tool / preset / slider / Help / Position | `ui/quick-access-popup.js` の`style[data-qa-popup-styles]` | `main.css`より後に注入される過渡static style。rootには固定skinとruntime寸法が同居する。 |
| Text utility | `styles/main.css` | `qa-text-raster-*`は既にCSS側。Text Raster event / HistoryはJSと`TextRasterService`のまま。 |
| tool通常 / hover / active | `main.css`とJS注入の両方 | 後段注入が勝つ過渡重複。今回の最初Sliceでは触らず、tool専用の次Gateで一正本化する。 |
| component stylesheet | `index.html`で`main.css` → `styles/components/*.css` | 新規QTP component CSSはこの順で読み、移行した同selectorをJS注入に残さない。 |

### runtime / behavior / storage正本

- `left / top`はQTP instanceが管理し、自由dragとPosition presetは共通`_clampPanelPosition()`を通ってlocalStorage `quick-access-position` の`{ x, y }`へ確定する。Preset ID、利き手、Project / Historyは保存しない。
- popup幅、padding、grid / preset / slider寸法は`main.css`の`--ui-qa-*`。normalは136px / grid 19px / preset 26px、coarseは170px / 24px / 32px。連続slider位置、color swatch、Help deck clampはJSへ残す。
- tool切替は既存`tool:select / tool:changed`とBrush settings、Presetは`tegaki-quick-access-tool-presets-v1`、Color slotは既存QTP localStorage key。Textは`TextRasterService.createTextLayer()`、Help / Position / Text panel openはruntime-only。
- `Q`開閉、pointerdown即時tool切替、slider / wheel、free drag、outside pointer / Escapeの契約はskinから分離して維持する。

### live表示とPhase 9c Bとの差

- 1280×720の実QTPは136×280px、document overflow 0。QTP幅はviewportの約10.6%。rootのFutaba淡色gradient / 11px radius / restrained shadowはB候補と既に近い。
- 差の第一点はheader下の常設borderと、rootの静的skin / geometryが同じJS ruleに混在すること。Palette / tool / preset / sliderは別の操作頻度とstateを持つため、同時抽出しない。
- narrow 480×800で開き直すと、共通`fadeIn` scale中の幅をclampに使い、最終幅136pxの右端が約14px欠ける既存不整合を検出した。Stage Aの前提補修として`offsetWidth / offsetHeight / offsetLeft / offsetTop`のlayout値でclampし、skin Sliceから分離する。

### Gate 0

`GO — A: QTP root / header static skin boundary`

Stage Bの最初Sliceは次に限定する。

- 対象: `#quick-access-popup.qa-popup`の固定色 / border / radius / shadow / backdrop / colorと、`.qa-header / .qa-header-title / .qa-header-main / .qa-header-sub`の固定appearance。
- 対象file: 新規`styles/components/quick-access-popup.css`、`index.html`のload順、`quick-access-popup.js`の同一static宣言だけを除去、限定verifier。
- 変更可: Phase 9c Bに合わせてheader下borderの競争を減らす。rootの現行restrained-depth、Futaba色、title / subの役割は維持する。
- 変更禁止: `position / z-index / width / min-width / max-width / padding / box-sizing / display / touch-action / cursor`、left / top、DOM / event / ARIA / storage、Palette / tool / preset / slider / Text / Help / Positionのselector。
- Browser: Q開閉、drag→close / reopen、Position preset、Help deck、Text open / close、wide 1280×720、narrow 480×800、coarse寸法契約、computed style、console。
- 停止条件: 同selectorの注入重複が残る、QTP寸法 / 位置が変わる、外観のためにDOM / stateを増やす、またはtool / preset重複まで触る場合は`HOLD`。

## 9. Stage A前提補修 / SOL review 1

- `_clampPanelPosition()`の幅 / 高さを`offsetWidth / offsetHeight`、`_clampCurrentPanelPosition()`の現在座標を`offsetLeft / offsetTop`から取得し、共通`fadeIn` transform中の`getBoundingClientRect()`による縮小値 / 座標driftを除外した。free drag、four-corner preset、`quick-access-position` `{ x, y }`は同じ正本のまま。
- Browser 480×800でQTP右端を480pxに収め、close / reopen 3回で`left=344 / top=420`のdrift 0を確認した。1280×720でPosition top-rightは`left=1132 / top=12 / right=1268`、Help 7行、Text open / close、再表示時のtransient panel close、console error / warning 0件を確認した。
- `node --check ui/quick-access-popup.js`、全103 verifier、Vite 8.0.16 production buildを通過し、`dist/` / `node_modules/.vite/`の生成差分を限定清掃した。

SOL review 1=`A`。この補修はStage Aのruntime境界修正として受け入れるが、Phase 9dはcloseしない。次はGate 0で固定したroot / header static styleの一Sliceだけを行う。

## 10. Stage B / SOL final review（2026-08-24）

- `styles/components/quick-access-popup.css`を新設し、`index.html`でshared tokenとAnimation Table component CSSの後へ一度だけ読み込んだ。QTP rootのborder / radius / background / shadow / backdrop / colorとheader main / subのtypographyだけを移し、JS注入から同一宣言を除去した。
- `position / z-index / width / min-width / max-width / padding / box-sizing / display / touch-action / cursor`、`left / top`、drag / clamp、DOM / event / ARIA / localStorageはJS側へ維持した。Palette / tool / preset / slider / Text / Help / Positionの未抽出selectorも変更していない。
- header下は`1px solid transparent`とし、280pxのlayout heightを保ったまま非active borderの競争だけを減らした。rootは136×280px、Futaba surface / radius / shadowを維持する。
- `verify-qtp-static-style-boundary.mjs`を追加し、既存`verify-ui-surface-token-bridge.mjs`を新しいstatic authorityへ同期した。全104 verifierとVite 8.0.16 production buildを通過し、`dist/` / `.vite/`の生成差分を限定清掃した。
- Browser 1280×720ではPosition右上が`left=1132 / top=12 / right=1268`、480×800ではfinal layoutが`left=344 / top=12 / right=480 / 136×280`、close / reopen 3回でdrift 0、document overflow 0を確認した。Q開閉、Help 7行、Text open / close、Pen / Eraser / preset、Position deck、console error / warning 0件を確認した。

SOL final review=`A`。root / header static skinの一正本化は採用し、Phase 9dを技術closeする。QTP color swatch / pressure / preset番号 / Text方向と、Animation Table play配置 / SCOPE / I/O / Timeline zoomは次の独立Gateへ残す。
