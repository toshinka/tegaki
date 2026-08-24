# Phase 8n — Animation Table Playback Glance Icon / Marker Semantics Gate

作成日: 2026-08-22

状態: CLOSE — Gate 1=`GO — B: icon＋現在値のHybrid semantic compact`、production限定接続、全89 verifier / build / Browser、SOL final review=`A`

## 1. 目的

Phase 8mでSCOPEをGlance / Choiceへ分けた後、Animation Table上段のSCOPE、LOOP、END、IN / OUT、onionを、状態の即読性を失わず省スペース化する。icon-only化や色だけの分類を目的にせず、文字・形・色・ARIAの役割を分け、初見と狭幅の認知負荷を比較する。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
6. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
7. `開発用資料保管庫/Archive/phase8m.md`
8. `tegaki_work/ui/animation-table-popup.js`
9. `tegaki_work/ui/ui-icons.js`
10. `tegaki_work/styles/main.css`

## 3. Owner提案

- SCOPEへLucide Monitor icon。
- LOOP ON / OFFへLucide Repeat / Repeat Off icon。
- IN / OUTを`I / O`へ短縮し、時間方向の色と文字抜きを併用する。
- onionの過去 / 未来も色付きsquare＋英字で分類する候補。

提供SVGはvisual proposalとして保持する。production採用時は`xmlns="http://www.w3.org/2000/svg"`へ正規化し、`UI_ICONS`へ一度だけ登録する。

## 4. Stage A live audit（2026-08-22）

- `timeline-ui.js`には既にRepeat相当SVGがinlineで存在するが、`UI_ICONS`にはMonitor / Repeat / Repeat Offがない。`monitorUp`はupload矢印を含み意味が違うため代用しない。
- Phase 8mのSCOPE閉状態は`ALL / LANE / SET`現在値をGlance layerで読む契約である。Monitorだけへ置換すると現在値を失うため、Monitorはcategory icon、現在値＋chevronはstate / Choice入口として残す。
- LOOPは現在`LOOP / STOP`文字、`playback.loop`、active class、titleで状態を示す。Repeat / Repeat Offは形で状態差を増やせるが、`aria-pressed`、状態title、active surfaceを併用し、色だけにしない。
- ENDは`T / C / O`の三modeを持つため、iconだけでは現在modeを符号化できない。少なくとも`END:C`またはcategory icon＋`C`を残す。
- IN / OUT markerは既にTimeline上でIN=`futaba-maroon`側、OUT=`active-border`側の位置semanticを持つ。一方、現行onionは前後を同数で切り替える単一toggleで、過去 / 未来を別々に操作する正本を持たない。onionの時間方向色をIN / OUTへそのまま流用すると「範囲marker」と「参照Frame」が衝突する。
- 文字抜きchipは面積削減に有効だが、`I / O`文字、左右位置、title / aria-label、active状態を併用する。新しい白直書きはせずpaletteのinverse tokenを使う。

## 5. Gate 1比較

比較fixture: `tegaki_work/build/phase8n-playback-glance-icon-fixture.html`

### A. Current text controls（比較基準）

`SCOPE: ALL / LOOP / END:C / IN / OUT / ghost 0`。状態名は明確だが、上段の横幅と常時文字量が大きい。

### B. Hybrid semantic compact（GO）

`Monitor + ALL + chevron`、Repeat / Repeat Off、`END:C`、maroon `I` / orange `O` chip、ghost＋countを組み合わせる。category iconと現在値、range markerとonionを別semanticに保ち、狭幅だけ`SCOPE:`語を視覚的に省略できる。

### C. Icon / color only（REJECT）

MonitorだけではALL / LANE / SETが読めず、Repeat Offの斜線、END mode、I / O、onion過去 / 未来を一度に学ぶ必要がある。色覚差、淡いCanvas、icon未学習時のfallbackも弱いためproduction第一案にしない。

Gate 1判定: `GO — B`。Owner提案と静的fixtureを基準にproduction対象を`ui-icons.js`とAnimation Table headerへ限定し、Ownerの深い制作確認は技術close条件から分離して確認台帳へ送る。

## 6. Acceptance Criteria

- SCOPE current value、LOOP state、END mode、IN / OUT marker有無、onion countがpopoverやtooltipを開かず読める。
- Monitor / Repeat系SVGは`UI_ICONS`へ集約し、component側へ重複inline SVGを増やさない。
- iconの`stroke / fill`は`currentColor`を使い、通常 / hover / active / disabled / focusでFutaba paletteを維持する。
- `aria-label / aria-pressed / title`を状態ごとに同期し、色だけで意味を伝えない。
- 既存ID、handler、`playback`正本、History、save / reload、Timeline marker、wheel三領域を変えない。
- 1280×720 / 720×720、keyboard、mouse、可能ならpen / touch、console errorを確認する。
- production JS変更時は`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`を通す。

## 7. No-go

- SCOPEの`ALL / LANE / SET`現在値を消すicon-only化。
- LOOP、IN / OUT、onionを色だけで区別すること。
- range markerとonion referenceへ同じ色semanticを無検査で割り当てること。
- END三mode、onion過去 / 未来の別設定、Playback Range popoverを本Sliceで再設計すること。
- Clip Action Panel、QTP Text、header DOM全面再構築、保存state追加。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 8. Production実装

- `UI_ICONS`へOwner提供のMonitor / Repeat / Repeat Offを正規化して一度だけ登録した。
- SCOPEはMonitorをcategory hintとして加え、`ALL / LANE / SET`現在値とchevronを維持した。狭幅時だけ`SCOPE:`語を視覚的に畳み、ARIA上の現在値は残す。
- LOOPはRepeat / Repeat Off、active surface、状態title、`aria-pressed`を`playback.loop`へ同期した。
- IN / OUTは`I / O`へ短縮し、未設定outline、設定済みsurface、現在Frameのactive ring、状態title / ARIAを既存markerへ同期した。
- onionは既存の前後共通count正本を維持し、ghost＋`0..4`を残した。過去 / 未来の別色・別設定は導入していない。
- Browserで保存済みパネル幅がviewport制約後の実表示幅より優先される狭幅判定漏れを検出し、`preferredWidth`と`renderedWidth`の小さい側で`is-narrow`を判定するよう限定補正した。

## 9. 検証 / SOL final review

- `node --check`: `ui/ui-icons.js`、`ui/animation-table-popup.js`、`build/verify-animation-table-playback-glance.mjs`。
- 関連verifierと全`build/verify-*.mjs` 89件を通過した。
- `npm.cmd run build`をVite 8.0.16 / PixiJS 8.19.0で通過し、生成`dist`差分を追跡済み基準へ戻した。
- BrowserではSCOPE Focus DeckのArrow / EnterとALL復帰、History不変、Loop ON / OFF、IN / OUT設定・解除とHistory、onion `0→1→2→3→4→0`、1280×720 / 720×720、狭幅overflowなし、console error / warning 0件を確認した。
- SOL final review=`A`。保存schema、Timeline marker正本、wheel三領域、Clip gesture、History adapterへの追加変更はない。

## 10. Close / 後続

2026-08-22に技術closeする。Owner制作確認では低height、長尺CAF、Panel重なり、mouse / pen / touch、Project close / reopen後の表示を確認し、問題時はPhase 8nを再OPENせずcomponent限定bug fixを立てる。

次Phase 8oは選択Clip Context Action Gate。現行top bar、選択時Action Panel、long press-onlyの三案を静的比較し、既存move / retime / multi-select / paste到達性を壊さないGateから始める。
