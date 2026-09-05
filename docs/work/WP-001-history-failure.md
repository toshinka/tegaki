# WP-001 — History redo例外時のindex維持

## Goal

`command.do()`がthrowしても、既に適用済みのcommandをUndo対象から失わない。F-001の限定修正。

## Scope

読む: [Architecture History](../ARCHITECTURE.md#projecthistory外部出力)、[監査](../AUDIT.md)。
変更可: `tegaki_work/system/history.js`、新規`tegaki_work/build/verify-history-failure.mjs`、必要ならharnessのhistory suite。
通常Raster/CAF command形式、描画、Project、UIの変更は禁止。

## Contract

- indexは最後に正常適用したcommand位置。失敗したredoでは開始時indexを維持する。
- `isApplying`は成功/例外とも最後にfalseへ戻る。
- stack内容/byte制限/redo可能なcommandをこの失敗で失わない。
- doは一部mutation後にthrowし得る。index修正だけでcommand内部のatomic rollbackまで保証したと書かない。

## Tasks

1. 実HistoryManagerを使いA/B record→B undo→B.do throwを再現する。現在index=0→-1、期待0。
2. catch経路の二重減算を解消し、成功通知時の例外とcommand例外を区別してindexを保つ。
3. 初回redo/末尾redo/連続例外/例外後の再試行/通常Undo-Redoも固定する。
4. pushのredo枝破棄、composite補償/byteSizeは別課題として残す。

## Acceptance

- 失敗前後のindex、stack長、command identityが一致。
- Aは引き続きUndo可能、Bは再試行可能。
- 再試行成功後はindexが一つだけ進む。
- `isApplying`が残留せず、既存History limits試験も通る。

## Verification

```powershell
node --check tegaki_work/system/history.js
node tegaki_work/build/verify-history-failure.mjs
node tegaki_work/build/development-harness.mjs test history
```

製品JS変更なのでVite buildも実施。testのwindow shimは既存History verifierを参照し、production logicをtest内へ写さない。

## Stop

command内部rollback、非同期History、保存schema、複数command補償が必要と判断したら、この修正と分けleadへ根拠を返す。

## Completion

修正前失敗/修正後成功の出力、diff、既存limits、build、対象外変更なしをleadが確認。Owner視覚受入はこの非UI修正の必須条件ではない。

### 2026-09-06 実施結果 — DONE

- 対象commit: `9b6ea3c208bd924d21c9b018c78888432469b64a`。開始時worktree clean。再構成の読む順序・リンク・WP境界をレビューし、harness check成功。GITHUB.txtは案内に留めた。
- 修正前: `node tegaki_work/build/verify-history-failure.mjs`がexit 1、`failed redo must preserve the starting index`、actual=-1 / expected=0。
- 原因/修正: do前のindex加算と二重catch減算をやめ、do正常終了後だけ次indexを確定。成功後の通知例外ではindexを戻さない。redo内だけの変更で、stack/byte制限/command形式は不変。
- 修正後: 新規verifier成功。初回/中間/末尾、反復例外、以前のcommandのUndo、再試行、通常Undo/Redo、通知例外、部分mutationの非保証を実HistoryManagerで確認。
- `node --check tegaki_work/system/history.js`、history suite 5/5、全verifier 148/148、Vite build成功。buildは専用Temp出力、dist生成差分なし。既存util externalization/chunk警告は継続。
- read-only agentが呼び出し側/Raster Patchのindex依存と最終diffを確認し、主担当が統合。製品変更はhistory.js、新規検証はverify-history-failure.mjsのみ。文書は完了状態/既知残存の同期だけ。
- Browser/Owner実操作は今回未実施。本WPは非UIの同期例外経路をproduction classで検証し、視覚受入を必須にしていない。
- 残存別件: command途中のmutation rollback、push失敗時redo枝、composite補償/byteSize、非同期Historyは未修正。WP-002以降には未着手。
