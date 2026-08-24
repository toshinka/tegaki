# Phase 8y — QTP Canonical Shortcut Hint Coverage

作成日: 2026-08-24

状態: CLOSED — SOL final review=`A`、Owner制作確認は台帳へ分離

## 1. 目的

Phase 8xで確定した`TEGAKI_KEYMAP`由来のread-only shortcut descriptorを、QTP内の既存global tool controlへ限定展開する。平常button面へkeyを常設せず、既存button操作のhover / keyboard focusで実行正本と一致する説明へ到達できる状態を作る。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase8x.md`
6. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
7. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
8. `tegaki_work/config.js`
9. `tegaki_work/ui/quick-access-popup.js`
10. `tegaki_work/styles/main.css`
11. `tegaki_work/build/verify-shortcut-learning-boundary.mjs`

## 3. 実装Slice

Phase 8xで受入れたQTP Penのpatternを、同じQTP tool surface内の次の既存buttonへだけ適用する。

| QTP control | canonical action |
|---|---|
| Pen | `TOOL_PEN`（実装済み基準） |
| Eraser | `TOOL_ERASER` |
| Airbrush / Blur | `TOOL_AIRBRUSH_BLUR_TOGGLE` |
| Fill | `TOOL_FILL` |
| Lasso Fill | `TOOL_LASSO_FILL` |
| Rect Selection | `TOOL_RECT_SELECTION` |
| Eyedropper | `TOOL_EYEDROPPER` |

- key / descriptionは`TEGAKI_KEYMAP.getShortcutDescriptor()`だけから取得する。
- `data-tooltip`と`aria-keyshortcuts`を同じdescriptorから生成し、対象buttonのhard-coded key付き`title`を残さない。
- 既存`.ui-help-tooltip`を再利用する。新しいtooltip engine、Popup、保存stateを作らない。
- repeated template attribute生成はQTP内の小さい表示helperへまとめてよいが、global UI基盤やcommand registryへ拡張しない。

## 4. Acceptance Criteria

- 対象7 controlの表示keyと`TEGAKI_KEYMAP.actions`が一致する。
- click / pointer action、tool切替、Fill参照strip、Preset section、active state、Q開閉を変更しない。
- 平常時にkey文字をbutton面へ追加せず、hover / keyboard focus時だけ既存Futaba tooltipで説明する。
- input / contenteditable guard、`KeyboardHandler`、shortcut割当、Project / History / save / localStorageを変更しない。
- Phase 8x verifierを拡張し、対象controlのaction mapping、hard-coded key付きtitle除去、対象外への展開なしを固定する。
- 変更JSの`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`、Browser実画面とconsole error確認を通過する。
- build後は追跡済み`dist` / `node_modules/.vite`を基準へ戻し、生成hash差分だけを限定削除する。

## 5. No-go / 停止条件

- shortcut再割当、custom keymap、command実行palette、Settings再構成、component-local commandのglobal昇格。
- QTP外のsidebar / Animation Table / RIG / WARPへ同時展開しない。
- touch長押し、通常tap二段化、Canvas gesture変更は行わない。
- action名、対応control、既存tooltipでは表現できない状態に遭遇した場合は推測実装せずSOLへ返す。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`を調査・編集しない。

## 6. model分担

対象file、action mapping、表示契約、Acceptance Criteriaが固定済みのため、production実装はLUNA / MAXに適する。採用前の全diff、全verifier / build、Browser、生成物、文書同期、closeはSOL / XHighが担当する。SOLのまま進める場合も本書の限定Sliceを越えない。

## 7. 実施結果

- QTPのEyedropper / Pen / Eraser / Airbrush / Fill / Lasso Fill / Rect Selectionを、`QA_SHORTCUT_ACTIONS`から`TEGAKI_KEYMAP.getShortcutDescriptor()`へ接続した。
- 対象7 buttonは同じdescriptorから`data-tooltip`と`aria-keyshortcuts`を生成し、外側buttonの重複native `title`を除去した。Fill参照strip固有の説明は維持した。
- shortcut割当、`KeyboardHandler`、既存pointer action、tool state、Preset、Project / History / saveは変更していない。
- `verify-shortcut-learning-boundary.mjs`は対象7 controlのmapping、canonical key、tooltip / ARIA、重複`title`なし、展開scopeを固定した。

## 8. 検証・判定

- 変更JS / mjsの`node --check`: PASS。
- 全`build/verify-*.mjs`: 99 / 99 PASS。
- `npm.cmd run build`: PASS。
- Browser: 対象7 controlのI / P / E / B / G / L / M、tooltip文、`aria-keyshortcuts`、外側`title`なしを照合した。Eraser → Fill → Penのpointer切替とactive stateを確認し、console error / warningは0件。
- build生成差分は追跡済み`dist` / `node_modules/.vite`を基準へ戻し、今回生成されたhash 5件だけを限定削除した。
- SOL final review: `A`。Phase 8yを技術closeする。mouse / pen / touch制作確認とtouch専用helpの要否はOwner確認台帳および次Phaseへ分離する。
