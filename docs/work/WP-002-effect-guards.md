# WP-002 — effect排他の操作順と解除

## Goal

既存の「同RasterにLayer WARP/MotionとRig/Mesh/clippingを重複適用しない」契約を、操作順に依存させない。既存の競合状態から対象WARPを明示解除できるようにする。

## Scope

読む: [データ所有](../ARCHITECTURE.md#データの所有)、[F-002/F-003](../AUDIT.md)。
変更可: `animation-data-model.js`、`clip-layer-deformer.js`、`clip-layer-transform.js`（すべて`tegaki_work/system/animation/`）、新規`build/verify-effect-target-conflicts.mjs`、関連model verifier。
Rig solver、compositor、UI全面変更、保存field追加は禁止。関数追加前に既存target/validation helperを検索する。

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
