# WP-020 — RIG刷新の最初の実行経路

状態: ACTIVE。発行: 2026-10-03。
Owner承認: 旧系を隔離し、新しい土台で制作動線を作る方向に必要な調査/改修を進める。既存RIGとの全面整合や自動移行を初期目標にしない。
開始: main / `386d71877bd6bd237416cca13f72c16be713e874`、worktree clean。
READ: AGENTS → STATUS → TECHNICAL → 本Card → ARCHITECTURE「Animation評価と出力」。LUNAだけWP-019 capability reportを既知証拠として読む。

## Goal

新しい土台で素材→編集→動き→保存/再読込→出力を通すため、最初にnative engineの編集/保存/再評価の実行物と、本体への最小接続位置を得る。新旧の完全互換比較に資源を使わない。

## Scope

LUNA（Slice A）のwrite ownerは以下だけ:
- `tegaki_work/advanced/inochi-proof/README.md`
- `tegaki_work/advanced/inochi-proof/roundtrip.d`
- `tegaki_work/advanced/inochi-proof/run-proof.ps1`
- `docs/ai/WP-020-inochi-proof-result.md`
- `tegaki_work/.cache/inochi-roundtrip/`（source/toolchain/dependencies/build/fixture/log等。ignored）

SOL（Slice B）のwrite ownerは `docs/ai/WP-020-rig-entry-boundary.md` だけ。独立したread-only調査。製品file変更禁止。
司令がCard/STATUS/TECHNICALの方針追補、登録簿、harness、案内を所有する。同じfile/modelへの並列write禁止。両担当は他者差分を巻き戻さない。

## Contract

- 旧・旧々RIGはこのCardで削除/整理/再実装しない。production import・Project schema・History authority・renderer authorityを変更しない。Advanced proofはproductionからimportされない独立実行物。
- 旧RIGとの比較は初期acceptanceに含めない。確認するのはnative loader/evaluator、編集意図、保存/再読込、失敗時の拒否。
- Inochi候補sourceを `66fa76834b28037db0c871c656563422f697879e` に固定。cache済みsource/archiveと取得hashを使う。これはnightly tag snapshotであり、公開v0.8.7 release tagと同一SHAとは扱わない。動的nightly binaryは使わない。
- 初回はheadless native実行を許容する。WASM/browser成立とは別判定。ネイティブ実行しか成立しない場合は、Browser接続費用をUNKNOWNとして返し、ブラウザ採用をPASSにしない。
- native D APIでmodelを生成/読込/評価/serializeする。JSON往復や独自変形計算だけを成功にしない。可能なら正式INP container save/loadまで行い、payloadのみの場合はその限定を明示する。
- Portable compilerは公式LDCのWindows archiveからcache内へ取得/展開し絶対pathで実行可。システムinstall、machine/user PATH変更、管理者installer禁止。DUB依存cacheも専用cacheへ設定し、公式DUB registryの必要依存だけ解決。source SHA/依存version/lock/toolchain版/取得URL/hash/commandsを記録。
- archiveは展開前に絶対path/drive/親traversalを検査。取得物/binary/generated fixtureはtracked成果へ混ぜない。ネットワーク失敗は通常の承認付き経路で公式取得を試してよい。
- engineのparameter/binding/evaluator本体を修復しない。bridgeはdriverから実在D APIを呼ぶ範囲。旧依存解決の不整合は根拠付きで一つの固定version修正まで許容し、連続修復へ広げない。

## Tasks

Slice A（LUNA）:
1. 固定sourceとportable compilerで一つのnative build経路を確保。repo package/lockを変更しない。
2. 1 Part、1 parameter、2 keyforms、通常blend、physics OFF、mask/composite無しの小fixtureを作る。評価はnative D engine。
3. 0 / 0.5 / 1で頂点等のnative出力を取得し、一つのkeyformまたはmeshを編集して保存する。
4. 元instanceを破棄し、新規instanceで保存データを読込。三点の編集後結果が再現され、元との意図した差があることを確認。編集撤回と破損入力拒否も確認。
5. 実行commandをrun-proof.ps1、driverをroundtrip.d、使い方と限定をREADMEに残す。必要ならbuild failureだけを報告し、架空のPASS出力を作らない。

Slice B（SOL）:
現在の `animation-data-model.js`、`part-rig.js`、`rig-static-authoring.js`、`rig-workspace-focus-shell.js`、`rig-part-projection.js`、`folder-part-render-plan.js` とUI呼出元を限定追跡する。旧々のBackup/PastFilesは探索しない。独立の新RIG入口を後段で置く位置、残す操作の意味、GUI内部で作り直すべきmutation、History/保存/出力の最小接点をfile/API付きで返す。網羅的graph、全呼出元一覧、旧実装の全acceptance比較は不要。次の一件のexact file diff案を一つ出し、実装しない。

## Acceptance

Slice A: 実在native evaluatorによる編集前後差、保存→新規instanceの評価再現、撤回、破損拒否を証拠化。buildに阻まれた場合は入力/最初の原因/試した一経路/必要な追加責任を報告する。
Slice B: 本体の次の限定改修を発行できる接点mapと一つのdiff案。維持対象は良い操作の意味であり、旧GUI内部コードの維持自体を目標にしない。

## Verification

runtimeは一つのfixtureに限定。上流の全unit test、新旧RIG全面比較、製品の全suiteは行わない。変更したPowerShellのparse、D compile/実行、docs harness、diff check。production不変のため製品build/Browserを実施済みにしない。
必要なfixture/logはcache、結果reportはPROVEN / INFERRED / UNKNOWNで分ける。司令は結果のcommandを限定再実行して監査する。

## Stop

compiler/linker/system SDKのsystem install、engine本体修復、二つ目のbuild platform/engine候補、production保存正本変更、別project探索、対象file追加は司令へ根拠を返す。一経路の最初のbuild失敗を診断し、依存固定修正一回後も失敗なら打ち切る。長期toolchain探索をしない。

## Completion

### Slice A2 — serializer配列初期化の限定修正（司令確定、2026-10-03）

Slice Aはbuild/link成功、初期INPのkeyform serializeで`JSONValue is not an array`によりBLOCKED。司令も実行で同例外を再現し、`core/math/deform.d`の`onSerialize(ref JSONValue data)`に配列初期化が無いことと、generic serializerが未初期化JSONValueを渡すことを確認した。評価器・補間・binding生成/読込の変更ではないため、必要改修を進めるOwner承認内で以下の例外だけを確定する。

LUNAの追加write owner: `tegaki_work/advanced/inochi-proof/deformation-json-array.patch`。既存3files/result report/cacheも引き続き担当。source archiveは保持し、cacheの固定sourceの`source/inochi2d/core/math/deform.d`の当該関数先頭に`data = JSONValue.emptyArray;`を一行だけ追加する。上流修正はこの一件のみ。修正前file SHA256: `E424BE9DE5C8C3795FD18C91E6A5D17C2F87C2C84766E99191C5ECFF34CAF026`。

runnerは未修正/修正済みsource hashを照合し、不明なsourceには適用せず拒否。tracked patchと適用位置/前後hashを残し、base SHAに対するpatched buildであることをREADME/result JSON/reportに明示する。driver headerのno repairsはA2の一行例外を反映する。既知失敗の記録を上書きして消さない。

固定source、依存lock、同じplatform/fixtureでbuild/runを一回再試行。native serializerの空のDeformationが空配列になることも限定確認する。編集/保存/新規instanceの再評価、撤回、破損header拒否は当初Acceptanceのまま。epsilonはdriverのfloat比較用であり製品pixel一致を意味しない。fixtureはtexture無しのPartなので、数値proofとRaster/texture/画素の実証を区別する。

次のengine/source不具合が出た場合は停止して報告。評価器本体修復、patch追加、platform切替、Browser/製品統合へ自動継続しない。productionと他者CSS差分は保持。

START/FINAL HEAD、変更file、commands、成功範囲/未実測、残る自作量、次の一件だけを返す。worker報告だけでcloseしない。Owner受入/採用/pushは自己承認しない。新規chat/agentを作らず、既存担当として作業する。司令の巡回は15分ごと、変化無しの通知をしない。
