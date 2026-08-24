# Phase 8l — UI Surface Constitution / Semantic Token Boundary Gate

更新日: 2026-08-22
担当: SOL / XHigh（UI正本、Surface語彙、QTP / sidebar境界、Stage / Gate判定）。値とAcceptance Criteriaが固定したtoken bridgeだけLUNA / MAX候補
状態: CLOSED — Stage A〜C完了、Gate 1=`GO — A: computed-equivalent Semantic Token Bridge`、SOL review 1 / 2=`A`、restrained-depth限定反映とOwner visual受入を完了

## 1. Goal

今後のRig / Motion / Camera等を旧skin前提で二重実装しないため、全面リスキンより先に、既存Futaba paletteとcomponent寸法tokenの上へ意味surface層を置く。最初のproduction対象はQTP / sidebarのcomputed valueを変えないtoken bridgeだけとし、見た目の候補比較、Preset配置、density、Animation Table展開を分離する。

## 2. Authority / Source

- `TEGAKI.md`
- `tegaki_work/PROGRESS.md`
- `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
- `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
- `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
- `ClaudeReview/gui-skin-redesign-concretization-proposal.md`（外部原案。実装契約ではない）
- `開発用資料保管庫/Archive/17_UI操作文法・QTP_PainterPalette・Surface階層_外部提案.md`（外部原案の履歴）
- `tegaki_work/styles/main.css`
- `tegaki_work/ui/quick-access-popup.js`
- `tegaki_work/ui/dom-builder.js`
- `tegaki_work/ui/ui-icons.js`

## 3. 維持する契約

- Canvas First、progressive disclosure、半透明popup、`Q` / `V` / `H`、Space + drag、Animation Table wheel三領域を変えない。
- QTPのtool / brush / color / preset正本、`quick-access-position`、close / reopen、PopupManager、Project / History / save schemaを変えない。
- `--futaba-*`をpalette正本として維持し、Setup青 / Motion橙を一般buttonへ広げない。
- visual iconとhit areaを分離し、mouse / pen / coarse pointerの既存targetを縮めない。
- static CSSを新たにJSへ増やさない。現行QTPのCSS全面移動は別Stageとし、触るruleだけを意味tokenへ接続する。

## 4. Stage A — live audit（2026-08-22）

- `main.css`は163 CSS変数を持つ。paletteとcomponent寸法は既にtoken化されているが、汎用`surface / radius / opacity / shadow`層はない。
- 共通`.popup-panel / .ui-close-button / .ui-icon-button / .ui-scrollbar`は存在するが採用は部分的。QTPはshared close buttonを使う一方、外殻とcontrol surfaceは固有ruleである。
- `quick-access-popup.js`は2,748行、直書きSVG 0件、`UI_ICONS`利用、localStorage `quick-access-position`で自由x / yを保存する。約700行の静的CSSをJS注入し、`main.css`にも`.qa-tool-button`旧ruleが残るため、selector / injection順を変えない監査が必要。
- sidebarは30px control / coarse 38px、QTP gridは19px / coarse 24px。token bridgeで寸法を変えない。
- `ui-icons.js`は43 SVG。辞書外直書きはAnimation Table 37、Timeline 6、DOM Builder 4、Transform Anchor 1の計48件。外部レビューの旧46件を正本にせず、Animation Tableを触るPhaseで段階集約する。
- sidebar / QTPは既にtranslucency、blur、shadowを持つ。今回の課題は見た目をゼロから作ることではなく、同じ役割へ同じ意味名を与え、次のprototype差分を小さくすることである。

## 5. Candidate / Gate 1

- A: 現行computed valueとselector順を変えないSemantic Token Bridge。
- B: QTPを即borderless / restrained-depthへ変更。
- C: QTP全CSSをJSから`main.css`へ一括移動し、共通controlを全面適用。
- D: Preset配置 / FULL-COMPACT-HIDDEN / dockを同時追加。

判定: `GO — A`。

BはAの後にCurrent / borderless / restrained-depthをOwner比較する別Stage。Cは2,748行classと既存CSS重複を一括で触るためHOLD。Dはvisual prototype受入後にPreset → densityの順で分離する。

## 6. Stage B — token bridge

対象:

- `tegaki_work/styles/main.css`
- `tegaki_work/ui/quick-access-popup.js`
- `tegaki_work/build/verify-ui-surface-token-bridge.mjs`

実装:

1. `--ui-surface-* / --ui-border-* / --ui-radius-* / --ui-shadow-* / --ui-opacity-*`を既存Futaba値の意味aliasとして`:root`へ置く。
2. sidebar外殻とQTP外殻 / tool controlの既存値だけをaliasへ接続する。値、DOM、class、event、position保存、coarse寸法は変更しない。
3. verifierでtoken定義 / 利用、QTP位置正本、UI_ICONS、coarse token、旧selector維持を固定する。

## 7. Acceptance Criteria

- before / afterでsidebar / QTPのbackground、border、radius、shadow、tool control通常 / hover / activeのcomputed valueが一致する。
- QTP open / drag / close / reopen、`Q` shortcut、tool切替、pen / eraser、size / opacity、color、presetが従来通り。
- QTPの保存位置と画面内clampを維持し、Project / History差分を作らない。
- 1280×720 / 720×720、mouse / coarse fixture、console error 0件。
- 変更JSの`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`を通過し、build生成差分を清掃する。

## 8. No-go

- 全面リスキン、全面glass化、Futaba palette置換、dark mode。
- QTP DOM再構築、Animation Table二段化、Dock、常設Inspector。
- Preset位置、density state、Simple / Expert二重UI、自由custom rail。
- Animation Tableの直書きSVG 37件を同時移行。
- popup / selection / tool / History / Projectの第二正本。

## 9. 次Stage候補

Stage Bのcomputed-equivalent bridgeをSOLが受入れた後、QTP / sidebarだけでCurrent / borderless / restrained-depthを比較する。Stage Cでrestrained-depthを選定した。Ownerがvisual prototypeを受入れる前にPreset / density / Layer Panelへ横展開せず、Animation Tableの情報露出は別Architecture Gateとして静的比較から始める。

## 10. Stage B result / SOL review 1（2026-08-22）

- `main.css`へ既存Futaba値の意味aliasを追加し、sidebar外殻を`surface / border / radius / shadow / backdrop` tokenへ接続した。
- `quick-access-popup.js`はQTP外殻とtool controlの通常 / hover / activeだけを同じtokenへ接続した。DOM、event、tool state、19px / coarse 24px、自由位置保存は変更していない。
- 新規`verify-ui-surface-token-bridge.mjs`でaliasのexact value、sidebar / QTP利用、coarse寸法、`quick-access-position` save / load、`UI_ICONS`、QTP直書きSVG 0件を固定した。
- Browserでtoken解決後のcomputed background / border / radius / shadow / backdropが既存値と一致すること、QTP drag、close / reopen後の位置保持、消しゴム→ペン切替、History 0件、console error / warning 0件を確認した。
- 変更JS / mjsの`node --check`、全87 verifier、Vite 8.0.16 production buildを通過し、`dist/` / `.vite/`のbuild生成差分を追跡済み基準へ戻して新規asset 5件だけを削除した。

判定: `A`。Stage Bはcomputed-equivalent bridgeとして受入れる。Phase 8lはcloseせず、次StageでCurrent / borderless / restrained-depthの固定fixture比較とOwner visual選択を行う。見た目変更、Preset、density、Layer Panel / Animation Table横展開はまだ開始しない。

## 11. Owner feedback / Animation Table exposure Gate（2026-08-22）

OwnerはPhase 7l二段headerを仮設として受入れた一方、SCOPE / LOOP / END / IN / OUTとClip actionの常時露出は初見の情報過多になり得ると指摘した。現行実装を監査すると、Clip本体pointerdownは即move、左右端はretime、Ctrl / Cmdはmulti-selectへ入るため、long press actionを現在のproduction gestureへ足すのはHOLDとする。

後続Architecture Gateの第一案:

- SCOPE: 現在値一button＋anchored Focus Deck。単純な順送りだけにはしない。
- LOOP: 常時状態を読めるtoggleを維持し、詳細をsecondary popoverへ送る。
- END / IN / OUT: Timeline markerを維持したPlayback Range choiceへまとめる比較案。
- Clip action: 通常選択時だけAction Panelを表示し、long press / right-clickは補助入口候補。Pasteの空cell / current Frame経路は別に維持する。

Callipegのselection Action Panel、Frescoのselected-frame action、ToonSquidのpersistent playback toolbar＋selected Drawing affordanceと照合し、詳細を`proposal 14`へ正本化した。Phase 8lのproduction対象は引き続きQTP / sidebar Surfaceだけとし、Animation Tableのstate / event / DOMはこのStageで変更しない。

## 12. Stage C result / SOL review 2（2026-08-22）

- `Current / borderless / restrained-depth`を同一QTP fixtureで比較した。完全borderlessは淡いCanvas背景でpopup境界が消え、floating surfaceとCanvasの前後関係が弱くなるため棄却した。
- restrained-depthを選定し、QTP外殻は弱い茶border、淡いgradient、抑えたshadowを維持する。通常tool cellはほぼ透明、hover / activeだけsurface・境界・shadowを強める。sidebarは現行restrained railを維持した。
- `main.css`と`quick-access-popup.js`に重複していた`.qa-tool-button`の通常 / hover / activeを同じsemantic tokenへ接続し、読込順による旧Futaba surfaceの上書きを解消した。DOM、event、Q shortcut、tool state、19px / coarse 24px、position保存、Project / Historyは変更していない。
- verifierはtoken exact valueに加え、後段shared QTP ruleも同じtokenを使うこと、3px state borderでhit areaを縮めないこと、temporary prototype CSSが残らないことを固定した。
- Browser 1280×720でQTP open / close / reopen、消しゴム→ペン、History 0件、console error 0件とrestrained-depth表示を確認した。今回のBrowser surfaceではviewportを720×720へ変更できなかったため、coarse 24px契約はverifierで固定し、narrow / pen / touch実機はOwner visual確認へ残す。
- 変更8 JS / mjsの`node --check`、全87 verifier、Vite 8.0.16 production buildを通過し、`dist/` / `.vite/`の追跡済み基準を復元して新規build asset 5件だけを削除した。

判定: `A`。Stage Cのproduction差分は限定Surface変更として受入れる。Phase 8lはOwner visual確認までOPENを維持し、Preset / density / Layer Panel / Animation Table production横展開は開始しない。

## 13. Owner visual acceptance / close（2026-08-22）

Ownerはrestrained-depth反映後のQTPを実機で確認し、Stage Cの限定Surface変更を受入れた。`TEXT TO RASTER`の占有、展開panelのFONT / SIZE表示、将来の縦書き・Windows local font導線については、現行Stageの不具合として戻さず`proposal 14`のText再設計Gateへ分離する。Owner自身が「今回は配置変更不要」と明示しているため、Phase 8l productionへ追加変更しない。

判定: `A / CLOSE`。Phase 8lを技術・visualともcloseする。Preset、density、Layer Panel、Text配置、Animation Table情報露出はそれぞれ別Gateで扱い、QTP restrained-depthを暗黙に全面横展開しない。
