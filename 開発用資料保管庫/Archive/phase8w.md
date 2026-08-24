# Phase 8w — QTP Overall Density / Progressive Exposure Gate

作成日: 2026-08-22

状態: CLOSED — Gate 1=`GO — B: Relevance-only preset collapse`、production限定接続、全98 verifier / build / Browser、SOL final review=`A`

## 1. 目的

QTPを通常描画のPainter's Paletteとして一操作で使える現行導線を維持しながら、COLOR、6 tool、6 Pen preset、SIZE、OPACITY、Text utilityを常時すべて見せる密度が適切かを比較する。単純な全面縮小や第二UIを作らず、制作中のcurrent actionと低頻度設定の視界深度を一段ずつ評価する。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase8l.md`
6. `開発用資料保管庫/Archive/phase8q.md`
7. `開発用資料保管庫/Archive/phase8r.md`
8. `開発用資料保管庫/Archive/phase8v.md`
9. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
10. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
11. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
12. `tegaki_work/ui/quick-access-popup.js`
13. `tegaki_work/styles/main.css`

## 3. Stage A authority監査

- QTPのtool / color / Pen preset / SIZE / OPACITY / Text正本、既存DOM ID / handler、shortcut `Q`は変更しない。Densityはruntime表示とCSS tokenの比較に限定する。
- 現行QTPは通常136px、coarse pointer 170px。visual寸法とhit areaを分離し、Canvas / pointer座標やbody全体scaleへ広げない。
- Phase 8qのText utilityはpersistent tool列から分離済み、Phase 8rの6 Pen presetは直接選択を維持したcompact ring＋active summary、Phase 8vのPosition deckはheader限定のtransient commandである。この三契約を巻き戻さない。
- FULL / COMPACT / HIDDENを採る場合も、Project / Historyへ保存しない。明示modeを保存する必要性はGateで先に判断し、production前にlocalStorage境界を固定する。

## 4. Gate 1で比較する案

### A. Current single density

全機能が一画面で読め、状態追加がない。小さいQTPでもCOLOR / tool / preset / sliderの情報が連続し、初心者には一度に見える量が多い。

### B. Context-progressive single palette

current toolで必要なsettingを主面に保ち、非対応toolのPen preset / brush settingはsummaryまたは一時deckへ退避する。QTPは一つ、直接tool切替とcurrent値は常時維持する。

### C. Explicit FULL / COMPACT mode

利用者が密度を選べるが、mode入口、保存、復帰、説明を増やし、同じ機能に二つの常設配置を持つ。初期候補にはせず、Bで必要情報を失う場合の比較対象とする。

比較fixture: `tegaki_work/build/phase8w-qtp-progressive-density-fixture.html`

Gate 1=`GO — B`。Pen / Eraser / Airbrushは現行6 presetの直接選択とactive summaryを維持し、Preset非対応のFill / Lasso Fill / Selectionだけsectionをruntime退避する。FULL / COMPACT mode、保存state、第二QTPを作らない。Aはrollback案、Cは現状の問題量に対してmode入口・保存・復帰説明が重いため不採用。

## 5. Acceptance Criteria

- QTPのtool / color / preset / size / opacity / Text正本、既存ID / event / shortcutを維持する。
- current toolと現在値を平常視界から失わず、低頻度情報だけを段階露出する。
- 6 Pen presetの一操作直接選択、Text utility、Position deck、自由drag / x-y保存を維持する。
- normal / coarseでvisual寸法とhit areaを分離し、Canvas / pointer座標、sidebar、Animation Tableを変更しない。
- Gate前にproduction DOM / CSSを変更しない。

## 6. No-go

- body / app全体scale、QTP全面DOM再構築、Simple / Expert二重UI、Dock、自由tool並べ替え。
- brush parameter再設計、Text vertical / local font、sidebar / Animation Table / Layer Panelの同時変更。
- 新しいProject field、History、保存schema。mode保存が必要ならGateを止めて別途境界判断する。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 7. model分担

情報深度、current action、QTPの一体性、mode stateの要否はArchitecture判断のためSOL / XHighがGate選定とcloseを担当する。Gate後、対象section、既存ID、表示条件、CSS token、Acceptance Criteriaが一つの限定Sliceへ固定できた場合だけLUNA / MAXへ委譲可能。二つのUI、保存mode、tool authorityの判断が必要ならLUNAは変更せずSOLへ返す。

## 8. Production実装

- 既存Preset sectionへ一意IDを付け、従来の`_getPresetToolKey()` / `isPresetEnabled`から`hidden`と`aria-hidden`を投影した。
- Pen / Eraser / Airbrushでは6 slot、active / focus summary、click / storageを変更せず表示する。
- Fill / Lasso Fill / Selectionでは無効な6 slotと`not used`だけを退避する。既存の各slot disabled契約は維持し、再びPen系へ戻ると同じsectionを表示する。
- COLOR、tool grid、SIZE、OPACITY、Text utility、Position deck、自由drag / x-y保存、Q shortcutは変更していない。
- FULL / COMPACT state、Project / History、localStorage keyを追加していない。

## 9. 検証 / Close

- `node --check ui/quick-access-popup.js`、QTP Progressive Density / Position / Preset Density / Text Entry verifierを通過した。
- 全`build/verify-*.mjs`は98件通過した。
- `npm.cmd run build`はVite 8.0.16 / PixiJS 8.19.0で成功した。既知の`util` externalizeとchunk size warningのみ。
- BrowserでPen / Eraser / AirbrushのPreset表示、Fill / Lasso Fill / Selectionの退避、Text / Position維持、console error / warning 0件を確認した。固定fixtureで136px / coarse 170pxを比較した。
- `npm.cmd run build`後、追跡済み`dist`基準を復元し、生成された5 fileだけを削除した。`tegaki_work/dist` / `node_modules/.vite`に生成差分がないこと、`.git/index.lock`が残っていないことを2026-08-24に確認した。
- SOL final review=`A`で2026-08-24に技術closeする。Owner制作確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離し、問題時は本Phaseを暗黙に再OPENせずQTP Progressive Density限定bug fixを立てる。
