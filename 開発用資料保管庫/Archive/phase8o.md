# Phase 8o — Animation Table Selected Clip Context Action Gate

作成日: 2026-08-22

状態: CLOSE — Gate 1=`GO — B: header内Selected Clip Action strip`、production限定接続、全90 verifier / build / Browser、SOL final review=`A`

## 1. 目的

Animation Tableのcopy / paste / group / deleteを常時top barへ並べる情報量を減らしつつ、選択Clipとの因果、初心者の発見性、mouse / pen / touch / keyboardの到達性を維持する。選択時Action Panelを第一案として比較し、long pressは既存Clip move / retimeと競合しない補助入口に限定する。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
6. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
7. `開発用資料保管庫/Archive/phase8m.md`
8. `開発用資料保管庫/Archive/phase8n.md`
9. `tegaki_work/ui/animation-table-popup.js`
10. `tegaki_work/build/verify-animation-table-header-layout.mjs`

## 3. Stage A — 最初の監査

- `selectedCelId / selectedCelIds`、group展開、Lane / empty cell選択を、表示projectionとaction authorityに分けて記録する。
- 既存`#anim-copy-btn`、`#anim-paste-btn`、`#anim-group-btn`、`#anim-delete-active-btn`のhandler、disabled / hidden条件、History名、keyboard shortcutを全検索する。
- Clip本体のpointerdown、4px超move threshold、左右retime handle、Ctrl / Cmd multi-select、pointercancel / lost capture、Space + drag、右clickを実測する。
- Pasteは選択Clipだけに従属しないため、clipboardあり＋空cell / current Frameでも到達できる既存入口を別に維持できるか確認する。
- production mutation前に、1280×720 / 720×720の同一fixtureで下記三案を比較する。

### Stage A live audit結果（2026-08-22）

- Copyは`selectedCelId`必須で、複数選択は`_getSelectedCelIds()`へ展開する。実行前にworking Layerを選択Clipへ保存し、既存CAF clipboardへ写す。
- Pasteは選択Clip必須ではない。CAF / Pixel Selection / Layer block / CAF内部Layer clipboardのうち最新を選び、現在Frame / Laneの空きへ貼るため、Selected Clip Actionへ完全移動できない。
- Groupは2件以上の隣接選択または既存Group全選択だけを既存Modelへ渡す。単独選択時はhidden、既存Group時はUngroupへ反転する。
- Delete buttonはClipだけでなくLane-only選択も`deleteActiveSelection()`から処理するdual authorityである。選択Action stripへ移すのはDelete Clipだけとし、Lane delete入口を同時に消さない。
- Ctrl / Cmd multi-selectは細いClipのretime handleより先に解決される。通常pointerdownはClipを即時activateしてmove sessionを開始し、`abs(dx) > 4 || abs(dy) > 4`で実moveへ移る。左右handleと単Frame pen外周 / 下gripはretimeを優先する。
- keyboardはTable表示中のCtrl / Cmd+C/V、Animation contextのAlt+C/V、Alt+Delete / Backspaceを既存関数へ接続する。Action Panelをkeyboard唯一入口にしない。
- 第一production候補はClip近傍floatingではなくheader内の選択時strip。選択対象名＋Copy / Group / Delete Clipを表示し、PasteとLane deleteは別contextとして残す。Clip DOM直下へpointerdown中にpanelを挿入しない。

比較fixture: `tegaki_work/build/phase8o-selected-clip-action-fixture.html`

## 4. Gate 1比較

### A. Current top bar

既存四actionを常時表示する比較基準。発見性は高いが、対象未選択時もContext actionがGlance layerへ露出する。

### B. Selected Clip Action Panel（第一案）

通常選択後だけ、headerまたは選択Clipと空間関係が読める位置へCopy / Group / Deleteを表示する。Pasteはclipboard / current Frame contextの別入口を残す。標準button / menu semantics、Escape、focus復帰、outside closeを維持する。

### C. Long press only（REJECT候補）

pen / touchでClip move開始との時間・距離競合があり、初心者へ入口が見えない。Bが成立した後の補助入口としてのみ再評価する。

Gate 1暫定判定: `GO — B`。1280×720では三案を同時比較、720×720では一列へ折り返し、横overflowとconsole error / warningがないことをBrowserで確認した。production mutationはOwner visualまたは次回SOLのcomponent固定review後に行い、旧top barを先に削除しない。

次回SOL component固定reviewで、Copy / Group / Delete Clipを選択時header stripへ投影し、PasteとLane deleteを既存contextへ残す境界を確定した。旧buttonとhandlerはDOMから削除せず、選択中だけ重複表示を抑える。

## 5. Acceptance Criteria

- selection解除、multi-select、group、Lane切替、Table close / reopenでAction Panelがstale対象へ残らない。
- copy / group / deleteは既存関数とHistory境界をそのまま呼び、新しいclipboard / selection / save stateを作らない。
- PasteをAction Panelへ完全吸収せず、選択Clipがない時の既存到達経路を最低一つ維持する。
- click選択がmove / retimeへ化けず、dragはAction Panel openによって妨げられない。
- keyboard focus、Escape、outside pointer、mouse / pen / touch、1280×720 / 720×720、console errorを確認する。
- production JS変更時は`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`を通す。

## 6. No-go

- long pressを唯一の入口にすること。
- top bar actionをGate前に削除すること。
- Animation Table header / timeline DOMの全面再構築。
- selection、clipboard、History、Project保存schemaの新設・複製。
- Clip move / retime / multi-select thresholdの同時変更。
- Playback Range、QTP Text、Mesh / Rig、Dock / Simple-Expert UIへの拡張。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 7. 停止条件 / model分担

Stage Aのauthority / gesture境界と静的fixture、Gate判定はSOL / XHighが担当する。Gate後に対象DOM、既存handler、Acceptance Criteriaが一箇所へ限定できた場合のみLUNA / MAXへproduction Sliceを委譲できる。gesture競合、Paste非選択経路、selection authorityの新判断が必要ならLUNAは変更せずSOLへ返す。

## 8. Production実装

- 選択中だけheader内へ対象名 / Frameまたは選択数と`COPY / GROUP / DELETE`を表示する`Selected Clip Action strip`を追加した。
- Copyは既存`copySelectedCel()`、Group / Ungroupは既存`toggleSelectedClipGroup()`、DeleteはClip限定の既存`deleteSelectedClips()`を呼ぶ。clipboard、selection、History、Project保存stateは追加していない。
- Pasteは従来`#anim-paste-btn`と`pasteBestClipboardAtCurrentCell()`を維持し、空Frame / current Laneから到達できる。Lane-only選択時は従来`#anim-delete-active-btn`と`deleteActiveSelection()`を維持する。
- 旧Copy / Group / dual Delete buttonはDOMとhandlerを残し、Clip選択中だけ重複表示をCSSで抑えた。選択解除時はstripを隠し、stale targetを残さない。
- 単一選択ではGroupを隠し、複数選択時だけ既存eligibilityを投影する。Group済み全選択では`UNGROUP`へ反転する。
- Clip本体DOM、retime handle、Ctrl / Cmd multi-select、4px超move threshold、Space + dragへ変更していない。long press入口も追加していない。

## 9. 検証 / SOL final review

- `node --check`: `ui/animation-table-popup.js`、`build/verify-animation-table-selected-clip-actions.mjs`。
- 関連verifierと全`build/verify-*.mjs` 90件を通過した。
- `npm.cmd run build`をVite 8.0.16 / PixiJS 8.19.0で通過し、生成`dist`差分を追跡済み基準へ戻した。
- Browserで単一選択→Copy、空FrameでPasteだけが到達可能、複数選択→Group / Ungroup、Delete Clip、Lane選択解除、Table close / reopenを確認した。680px panel実resizeでも`is-narrow`、折返し、対象label、COPY / DELETEのoverflowなしを確認した。
- console error / warningは0件。SOL final review=`A`。既存Paste / Lane delete authority、History、save、Clip move / retime thresholdに追加変更はない。

## 10. Close / 後続

2026-08-22に技術closeする。Owner制作確認では長尺CAF、多数Lane、長いAsset名、Group / Ungroup、mouse / pen / touch、Panel重なり、Project close / reopenを確認し、問題時はPhase 8oを再OPENせずAnimation Table Selected Clip Action限定bug fixを立てる。

次Phase 8pはPlayback Range Choice Gate。`END:T / C / O`と`I / O`をGlance layerへ常時並べる現行、anchored Range popover、Timeline marker近接操作を比較し、LOOP / SCOPE / marker正本を変えないGateから始める。
