# WP-002 — effect排他の操作順と解除

## Goal

既存の「同RasterにLayer WARP/MotionとRig/Mesh/clippingを重複適用しない」契約を、操作順に依存させない。既存の競合状態から対象WARPを明示解除できるようにする。

## Scope

読む: [データ所有](../ARCHITECTURE.md#データの所有)、[F-002/F-003](../AUDIT.md)。
変更可: `animation-data-model.js`、`clip-layer-deformer.js`、`clip-layer-transform.js`（すべて`tegaki_work/system/animation/`）、新規`build/verify-effect-target-conflicts.mjs`、関連model verifier。
Rig solver、compositor、UI全面変更、保存field追加は禁止。関数追加前に既存target/validation helperを検索する。

2026-09-06 Owner承認追補: `ui/animation-table-popup.js`のMotion編集開始・preview対象検査だけを追加対象とする。model setterを迂回するproduction直接代入経路を既存model検査へ接続する。UI構造・操作・WP-003の継続編集は変更しない。

## Contract

- Rig SetupはClipAsset、Layer effectはClipInstance。Assetへの登録preflightはそのAssetを参照する全Clipが対象。
- direct RasterだけでなくFolder祖先をPart化する場合も配下のeffectを確認。
- 拒否はmutation前、具体的reasonを返す。既存Rig/KEYを黙って削除/変換しない。
- 明示解除は追加と別の意味。競合を解消する対象の削除を、追加時の排他検査で禁止しない。
- Historyは既存callerが所有。model helperが新しくHistoryを記録しない。

## Tasks

1. WARP→Rig、Rig→WARP、Motion→Rig、Rig→Motion、共有Asset別Clip、Folder祖先のcase表を作る。
2. register/set双方のpreflightを既存helperへ集約または最小拡張する。対象の別名objectを作らない。
3. 既に競合したfixtureからWARPだけを解除できる経路を追加/補修する。
4. serialize/restoreと既存callerのUndo/Redoで同じIDとstateへ戻るか確認する。

## Acceptance

- 上記すべての追加順で無言の競合生成なし。拒否時Asset/Clipの内容がbyte-equivalentまたはdeep-equal。
- 同Assetの別Clipにeffectがある場合も見逃さない。
- unrelated Asset/Layerへ影響なし。
- 既存の競合WARPを明示解除可能、ほかのtrack/Setupは不変。
- legacy no-effect Project、既存Rig-only、Layer-effect-onlyの往復結果を維持。

## Verification

```powershell
node tegaki_work/build/verify-effect-target-conflicts.mjs
node tegaki_work/build/development-harness.mjs test animation
node tegaki_work/build/development-harness.mjs test warp
```

変更JSの構文/build。Browserでは同RasterのWARP/Motion設定後RIG登録を試し、拒否理由・History不変を確認する。Simple WARP UI未完なら既存model fixtureを使い、その限界を記録する。

## Stop

自動移行/自動削除が必要、重複effectを新しく許可、Rig/Layerの所有を変更したい場合は停止。HD-003のduplicate semanticsを同時に実装しない。

## Completion

operation-order表、実modelの回帰結果、拒否/解除/共有Asset、保存/History境界、diffをleadが監査。UI未確認があれば範囲を明示し全機能受入とはしない。

### 2026-09-06 結果 — DONE（指定経路の技術完了）

- 開始基準`9b6ea3c2`＋既存WP-001差分を保護。途中でOwner commitが進み、終盤HEADは`743ce53a`。未コミットの追補も成果に含むため、再開時にHEAD/statusを確認する。
- 基準commitの実modelをメモリ上へimportした再現: WARP→Rigがactual ok=true / expected=falseでassert失敗。作業ツリーを巻き戻さず比較した。

| 操作 | 結果 |
|---|---|
| WARP/Motion→Rig、Rig→WARP/Motion | direct Raster/Folder孫、同Clip/共有Asset別Clipで拒否、正本deep-equal |
| WARP/Motion→Mesh生成、Mesh→WARP/Motion | 登録前拒否。Mesh先行試験はtarget fixtureで、生成画素品質試験ではない |
| WARP/Motion→clipping、clipping→effect | owner/source/Folder継承で拒否。無関係な既存競合は別toggleを妨げない |
| 既存競合からWARP解除 | 指定targetだけ削除、他WARP/Motion/Rigは保持、反復解除可 |
| production Motion開始/preview | 共通preflightを実行し直接代入の迂回を封鎖。途中拒否は既存baseline復元へ |
| 保存/History | 実model serialize/constructor往復。実Rig登録caller抽出＋HistoryManager＋snapshot adapterで拒否時0件、成功/Undo/RedoのID/state一致 |

- 製品変更: `animation-data-model.js`とOwner承認の`animation-table-popup.js`の対象検査のみ。新規`verify-effect-target-conflicts.mjs`。保存field、Rig solver、compositor、UI構造、WP-003は変更なし。
- 構文確認成功、animation suite32/32、全149 verifier（warpを含む）成功、Vite build成功。buildは専用Temp、dist差分なし。既存util/chunk警告は継続。
- read-only agentが呼び出し側・最終diffをレビュー、主担当が採否と変更を統合。Browserの実画面/実Pixi・既存History callback全体は未実施。Simple WARP UI未完のためモデルfixtureと隔離caller検証を採用し、全機能受入とはしない。
- 別件: 並べ替え/reparentによるclipping source変更はAUDIT F-007へ記録。自動解除・自動移行・duplicate semanticsは導入しない。
