# Phase 8m — Animation Table Progressive Exposure Architecture Gate

作成日: 2026-08-22

状態: CLOSE — SOL final review=`A`、Ownerの後続icon圧縮提案はPhase 8nへ分離

## 1. 目的

Phase 7lの二段headerが維持する機能順序とwheel三領域を壊さず、Animation Tableを初見で読む時の情報量を`Glance / Choice / Context action`へ段階化する。機能削除や全面リデザインではなく、現在値を即読でき、必要時だけ選択肢を比較できる入口を一つずつ検証する。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
6. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
7. `開発用資料保管庫/Archive/phase8l.md`
8. `tegaki_work/ui/animation-table-popup.js`
9. `tegaki_work/styles/main.css`
10. `tegaki_work/ui/ui-icons.js`

## 3. 維持する既存契約

- header上段のFPS / FRAMES、SCOPE、LOOP / END / IN / OUT、PREVIEW / onion / Playと、下段のTimeline zoom / LIB、DURATION、CLIP MOTION、copy / paste / group / delete、closeのstate・eventを維持する。
- Timeline header / grid / Linesのwheel三領域、Clip move / retime、Ctrl / Cmd multi-select、pointercancel、keyboard、History、save / reload、playback評価を変えない。
- SCOPEは既存`ALL / LANE / SET` setterを正本とし、表示用の第二stateを作らない。
- PasteはClip選択時actionだけへ閉じず、空cell / current Frameから実行できる既存経路を維持する。

## 4. Stage A live audit（2026-08-22）

- 現行二段headerのDOM順、SCOPE三button、LOOP / END / IN / OUT、Clip action群とそれぞれのhandlerを再監査した。常時露出を減らすためにstate、History、Timeline modelを変更する必要はない。
- Clip本体pointerdownは即move、左右端はretime、Ctrl / Cmdはmulti-selectへ入る。long pressを唯一のcontext action入口にするとmouse / pen / touchの既存gestureと競合するため、Stage Aでは採用しない。
- 最初からSCOPE、Playback Range、Clip Action Panelを同時変更すると、情報量改善とgesture回帰の因果を分離できない。最初のproduction候補はSCOPE一箇所へ限定する。

## 5. Gate 1比較

### A. SCOPE current-state + anchored Focus Deck（GO）

`SCOPE: ALL ▾`のように現在値一buttonをGlance layerへ残し、click / Enterで`ALL / LANE / SET`と短い説明を持つChoice layerを開く。通常menu semantics、Escape、矢印key、Enter / Space、外側click close、pointer targetを維持し、選択肢の面積と説明量だけを比較fixtureで強める。

### B. SCOPE + Clip Action Panel同時導入（HOLD）

Context actionまで同時に触るとClip selection / move / retime / Paste経路の監査範囲が広がる。Aの受入後に別Sliceで比較する。

### C. header全面再構築 / long-press-only（REJECT）

既存DOMとgesture契約を一度に置換し、初見情報量の改善と機能回帰を切り分けられないため採用しない。

判定: `GO — A`。次Stageはproduction mutation前に`Current / compact current-state / Focus Deck`の同一fixture静的比較を作り、keyboard / mouse / pen・touchのclose規則を先に固定する。

## 6. Stage B / Gate 2静的比較（2026-08-22）

- `tegaki_work/build/phase8m-scope-focus-deck-fixture.html`へCurrent、compact current-state、anchored Focus Deckを同一条件で置き、1280×720と720×720で比較した。
- Currentは三状態を常時比較できる一方でheaderの初見情報量を減らせない。compact単独は現在値を即読できるが、状態の意味を記憶していない利用者へ説明を届けられない。
- Focus Deckは閉状態をcompactと同じGlance layerに保ち、開いた時だけ三候補と一行説明をChoice layerへ出せる。標準menu順、同面積、anchored placementを維持するため、独自modalや順送りより学習転移を損なわない。

Gate 2判定: `GO — A: anchored Focus Deckをproductionへ一component限定接続する`。

## 7. Stage C production限定実装（2026-08-22）

- 上段のSCOPE三button常時露出を、現在値が読める`SCOPE: ALL / LANE / SET ▾`一buttonへ置き換えた。開いたFocus Deck内では既存`anim-scope-all-btn / lane-btn / set-btn` IDと`playbackScope` setterをそのまま使用し、第二state・保存flag・History経路を作っていない。
- `menu / menuitemradio`、`aria-expanded / checked`、選択項目への初期focus、Arrow Up / Down、Home / End、Enter / Space確定、Escape、Tab、再click、focusout、外側pointer closeを固定した。Space確定はTimeline / Canvas shortcutより先に処理する。
- Futaba paletteと既存semantic surface / border / shadow tokenだけで、opaqueなanchored panelと狭幅一列表示を追加した。LOOP / END / IN / OUT、下段Clip action、Timeline wheel三領域、Clip move / retime / selection、Paste経路は変更していない。
- verifierは`verify-animation-table-scope-focus-deck.mjs`を追加し、`verify-animation-table-header-layout.mjs`をprogressive SCOPEへ同期した。
- Browser 1280×720 / 720×720でmouse / keyboard、History `0/500`、outside close、console warning / error 0件を確認した。pen / touch制作確認はOwner visual確認と同時に行えるが、pointer専用の第二経路は追加していない。
- `node --check`、全88 `build/verify-*.mjs`、Vite 8.0.16 production buildを通過し、追跡済み`dist`基準と生成assetを限定清掃した。

## 8. Acceptance Criteria

- production変更前に三案を同一1280×720 / narrow fixtureで比較できる。
- 現在SCOPEがpopoverを開かず読め、候補を一度に比較できる。順送りだけにしない。
- 既存SCOPE setter、selected Lane / SET guard、History 0、Project保存shape不変を維持する。
- Escape、矢印key、Enter / Space、外側click、再click、focus returnを固定する。
- Timeline wheel三領域、Clip move / retime / selection、Paste経路、playbackへ影響しない。
- Browserで対象操作、narrow、console errorを確認する。production JS変更時は`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`を通す。

## 9. No-go

- header全体のDOM置換、Animation Table常設dock、Simple / Expert二重UI。
- long press / right-clickを唯一のClip action入口にすること。
- Playback Range、Clip Action Panel、QTP Text再設計を最初のSliceへ混ぜること。
- Timeline / History / Project / selectionの第二正本、新規保存flag。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 10. Close判定（2026-08-22）

- SOLは全diff、runtime-only open state、既存SCOPE setter / ID、Timeline shortcut優先順、全88 verifier、production build、Browser 1280 / narrow、History 0、console 0件を再監査し、final review=`A`とした。
- OwnerはSCOPEへMonitor、LOOPへRepeat / Repeat Off、IN / OUTへ`I / O`と時間方向色を使う後続案を提示し、「後で行ってもよい」として現Sliceのblockerにはしなかった。SCOPE current valueを失うicon-only化、色だけの状態伝達、onion色とrange marker色の混同は別Gateで比較する。
- standing permissionに基づきPhase 8mを技術closeする。pen / touch、低height、制作Projectでのpopup重なりはOwner確認台帳へ分離し、問題時はPhase 8mを再OPENせず限定bug fix Gateを立てる。

## 11. 次作業

SOL / XHighでAnimation Table Playback Glance Icon / Marker Semantics Gateを立ち上げる。Monitorはcategory iconに留めて`ALL / LANE / SET`現在値を残す案、Repeat / Repeat Off、`I / O` marker chip、onionの過去 / 未来色とrange marker色の役割分離を同一fixtureで比較する。production変更はOwner visual比較後の一component限定Sliceとし、Clip Action Panel、Playback Range Choice、QTP Textを同時に触らない。
