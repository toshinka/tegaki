# Phase 8x — Shortcut Learning / Command Discoverability Gate

作成日: 2026-08-24

状態: CLOSED — Gate 1=`GO — B: Canonical contextual shortcut hints`、SOL final review=`A`

## 1. 目的

Phase 8l〜8wで視界深度とQTP / Animation Tableの平常密度を整理した次の一角として、初心者が操作の文脈内でshortcutを学べ、慣れた後はUIの情報量を増やさずkeyboardへ移行できる導線を比較する。新しいcommandやshortcutは作らず、既存の実行正本と表示説明の不一致をまず止める。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase8l.md`
6. `開発用資料保管庫/Archive/phase8m.md`
7. `開発用資料保管庫/Archive/phase8w.md`
8. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
9. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
10. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
11. `tegaki_work/config.js`
12. `tegaki_work/ui/keyboard-handler.js`
13. `tegaki_work/ui/settings-popup.js`
14. `tegaki_work/ui/ui-panels.js`
15. `tegaki_work/ui/quick-access-popup.js`
16. `tegaki_work/ui/animation-table-popup.js`
17. `tegaki_work/styles/main.css`

## 3. Stage A authority監査

- Global shortcutの実行正本は`TEGAKI_KEYMAP.actions` / `getAction()`と`KeyboardHandler`のcontext routingである。`getShortcutList()`も既存するため、表示のために別のkey一覧を手書きしない。
- Settingsの「ショートカット」tabは現在static DOMで、例えばPen表示`B`と`TEGAKI_KEYMAP`の`P`が一致しない。表示層の不一致であり、shortcut自体をこのPhaseで変更する理由にしない。
- Animation Table / WARPにはcomponent-localのcontext shortcutがあり、すべてが`TEGAKI_KEYMAP.actions`には無い。Global actionとlocal commandを混合せず、既存handlerからread-onlyに説明を投影できる単一descriptor境界が必要かをGateで判定する。
- `ui-help-tooltip` / `data-tooltip`とSettings helpは既存だが、shortcut学習の共通契約にはなっていない。hoverだけに依存せず、keyboard focus、pen / touch長押し、ARIAを同じfixtureで比較する。
- 自動学習履歴、利用回数、オンボーディング進行はProject / History / localStorageへ追加しない。

## 4. Gate 1で比較する案

### A. Current Settings-only list

平常UIは最少のままだが、操作中のcontrolとショートカットtabが離れ、static複製のdriftを防げない。Rollback比較案とする。

### B. Canonical contextual shortcut hints

現在のcontrolのhover / focus / touch説明に、実行正本と同じaction descriptorから小さい`kbd`表示を付ける。Settings helpも同じdescriptorから生成し、current contextで無効なcommandは常時推奨しない。平常のbutton面にkeyを常設しない。第一候補。

### C. Shortcut / command deck

`?`やSettings入口からcurrent contextのcommand一覧をFocus Deckで出す。比較はしやすいが、command palette、検索、実行機能まで広げると新しいUI正本と記憶対象を増やす。Bで学習できない場合の比較対象に留める。

比較fixture: `tegaki_work/build/phase8x-shortcut-learning-fixture.html`

Gate 1=`GO — B`。AはSettingsのstatic複製と実行正本のdriftを解消できず、Cは学習のために新しいdeck入口 / Popup stack / 閉じ方を覚える負担が先に増える。Bは従来controlを一操作のまま維持し、既存tooltip / Settings表示だけを実行正本由来のdescriptorへ揃えられる。CはBでcurrent contextの一覧性が不足した場合のrollback比較へ留める。

## 5. Acceptance Criteria

- 既存shortcut、context routing、tool / popup / Animation Tableのhandler、input focus guardを変更しない。
- Global shortcut表示は`TEGAKI_KEYMAP`から導出し、Settings / tooltipにkey文字列を二重手書きしない。Local commandは実handlerと対応付けられる限定descriptorだけを許す。
- 平常UIの視界密度を戻さず、shortcutを知らない利用者も従来button操作を維持できる。
- hover無しでもkeyboard focus / pen / touchから同等の説明へ到達できる。
- Tooltip / deckはFutaba paletteとsemantic tokenを使い、既存PopupManagerのstack / Escape / outside pointerを乱さない。
- Project / History / save schema / localStorageに学習stateを追加しない。

## 6. No-go

- shortcut再割当、custom keymap UI、command検索 / 実行palette、利用回数telemetry、自動coach mark、強制tutorial。
- QTP / sidebar / Animation Table / SettingsのDOM一括再構成、component単位横展開の同時実装。
- 新しいProject field、History、学習進行保存。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 7. model分担

shortcut authority、global / component-local context、progressive disclosure、touch到達性はArchitecture判断のためSOL / XHighがStage A、Gate選定、closeを担当する。Gate後、一つのdescriptor adapter、一つの表示surface、既存tooltip / Settings DOMへの投影だけに固定できればLUNA / MAXへ限定委譲可能。shortcut変更、context routing、PopupManager、保存stateの判断が必要な場合はLUNAは変更せずSOLへ返す。

## 8. Stage A完了とproduction Slice

1. `TEGAKI_KEYMAP.actions` / `getShortcutList()`、`KeyboardHandler`のcontext routing、Settings static help、Animation Table / WARPのlocal keydownをread-only監査した。SettingsのPen `B`学習表示と実行正本`P`の不一致を表示driftとして分離した。
2. A / B / Cの固定fixtureでCanvas / QTP / Animation、hover / focus / touch helpを比較し、Gate 1=`GO — B`とした。
3. Stage Bでは`TEGAKI_KEYMAP.getShortcutDescriptor(actionName)`を表示専用adapterとして追加し、`getShortcutList()`も同adapterから導出した。`actions`、`getAction()`、`KeyboardHandler`、shortcut割当は変更していない。
4. Settingsのstatic shortcut行を全global descriptorのcategory別projectionへ置き換え、Pen `B`という表示driftを実行正本どおり`P`へ修正した。新しいactionがcategory外へ増えた場合はverifierが未投影として停止する。
5. 最初のcontextual hintはQTPのPen button一つだけへ限定し、既存`.ui-help-tooltip`で`ペンツール · P`、`aria-keyshortcuts="P"`を同descriptorから投影した。button面へのkey常設、native titleとの二重表示、他controlへの同時横展開は行っていない。
6. Touch helpは通常tapの二段化やCanvas gestureとの競合がない明示契約をSOLで決めるまでproductionへ入れない。component-local commandもglobal actionへ昇格させず後続Gateへ分離する。

## 9. Stage A検証

- BrowserでfixtureのCanvas / QTP / Animation切替、hover / focus / touch help表示、1280×720 / 720×720を確認した。wide / narrowとも横overflowなし、console error / warning 0件。
- fixtureは比較専用で、shortcut handler、Settings DOM、tooltip、Project / History / localStorageは変更していない。

## 10. Stage B / C検証とclose

- `node --check`は`config.js`、`settings-popup.js`、`quick-access-popup.js`、`verify-shortcut-learning-boundary.mjs`を通過した。
- `verify-shortcut-learning-boundary.mjs`でPenの既存実行`KeyP`、descriptor `P`、Settings全global action一回投影、stale Pen `B`除去、QTP Pen一control限定を固定した。
- 全99 `build/verify-*.mjs`、`npm.cmd run build`を通過した。build警告は既存`ag-psd` browser externalizeとchunk sizeだけである。
- Browser実画面でSettings shortcut tabのPen `P`とcategory別全一覧、QTP Penのhover表示`ペンツール · P`、`aria-keyshortcuts="P"`、平常button面の非増量を確認した。console error / warningは0件。
- build / dev後は追跡済み`dist` / `node_modules/.vite`をGit基準へ復元し、新規hash asset 5件だけを削除した。両pathはclean、`.git/index.lock`は存在しない。
- SOL final review=`A`。実行正本、handler、Project / History / save、PopupManagerへ変更がなく、Gateと最初のproduction proofを完了したため技術closeする。Ownerのfocus / pen / touch確認と、他control / component-local commandへの展開は確認台帳・後続Phaseへ分離する。
