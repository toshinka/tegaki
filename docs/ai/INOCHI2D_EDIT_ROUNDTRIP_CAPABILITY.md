# WP-019 — Inochi2D capability preflight

状態: Slice A 技術調査完了。Slice B は現行配布物/APIでは目標を満たせず、司令の次契約待ち。担当: TEGAKI｜実装 LUNA。
実行契約と完了条件は[WP-019](../work/WP-019-inochi-edit-roundtrip-proof.md)。本ファイルは限定調査の証拠を所有し、製品契約を所有しない。

## Initial facts supplied by Commander

2026-10-03に公式GitHub APIを承認付きnetwork経路で取得:
- `commits/main`: `ba2b1413c68d9f7bf575fef790ba0c35715558db`、commit date `2026-09-15T07:43:23Z`、message `Refactor deformation`。
- `releases/tags/nightly`: `target_commitish: v0_8`、published `2025-09-18T11:43:14Z`。
- `inochi2d-wasm-release.tar`: 3,276,800 bytes、https://github.com/Inochi2D/inochi2d/releases/download/nightly/inochi2d-wasm-release.tar
- `inochi2d-wasm-debug.tar`: 6,563,840 bytes（releaseで原因が読めない場合のみ）。
- `inochi2d-win32-release.tar`: 9,455,616 bytes（WASM不可の場合の比較候補。実行前に司令へ戻す）。

## 結果概要

Slice Aの取得・ソース追跡・instantiate probeは完了した。WASMはNode.js v22.17.0でcompile / instantiate / in_initまで成功。モデルfixtureはロードしておらず、Part編集、keyform評価、native保存・再読込、drawlist差分、画素、Browser、Project統合は未実測。

最も重要な差分は、nightly releaseページが指す歴史的タグと、現在配布されるWASMのビルド元が一致しない点。nightlyタグはv0.8.7だが、配布WASM assetは2026-10-02の成功したWASM release/upload jobと同時刻に更新され、jobのhead SHAは現行mainのba2b1413c68d9f7bf575fef790ba0c35715558db。WASMのAPI集合もmain v0.9.0と一致する。asset内部にbuild SHAは埋め込まれていないため、「このWASMはmain SHAから生成」とするのは日時・job・API世代に基づく強い推定であり、埋込みprovenanceによる直接証明ではない。

現行main v0.9.0にはparameter value setterと評価・drawlist取得経路、D内部のPart mesh setterとDataNode/INP2 serializer部品はある。一方で、公開C/WASM APIにはPart mesh setterとPuppet native save/serialize関数がなく、さらに現行ソースの1D parameter binding deserialize経路は無効化されている。したがって現配布物だけで「Raster Part meshとkeyformを編集し、編集後の評価をnative保存bytesから再現」の最終proofを行う経路は確認できなかった。

## 取得物とprovenance

観測時刻は2026-10-03T00:23:20Z。完全な取得metadataはtegaki_work/.cache/inochi-roundtrip/upstream-metadata.json、WASM moduleの一覧はwasm-inspection-summary.json、実行probeの結果はinstantiate-probe.jsonに保存した。取得元はすべてInochi2D公式GitHub repository / release / Actions。

- 現行main source: ba2b1413c68d9f7bf575fef790ba0c35715558db、commit date 2026-09-15T07:43:23Z、version v0.9.0。source archive 3,293,006 bytes、SHA-256 DEB46CAECC2DE437C108D25F7E4BA61FD0C1273B3F6CF9175AECA0A48FF4BB17。
- nightly release metadata: 公開日時2025-09-18T11:43:14Z、target_commitish v0_8。refs/tags/nightlyが指すcommitは66fa76834b28037db0c871c656563422f697879e（2025-09-18T11:42:13Z）、source version v0.8.7。tag source archive 77,309 bytes、SHA-256 79F1F51641380AC992B5ECCA2AB49245F111517CA4185CA832FFB0460F6CD4FB。
- nightly WASM asset: 3,276,800 bytes、SHA-256 D32DC0D463B0883E08CAD3A74D2A8F9FB85E09E5777DAAA6635BA9C407603B54。GitHub API digestは同じSHA-256。asset created_at / updated_atは2026-10-02T02:39:31Z。中のinochi2d.wasmは3,251,219 bytes、SHA-256 179521ABB9CEEEDC73C04693947C4CD47154679059DB71B09AD95D67530E28A2。
- 対応するActions run: 36956516866 / run 393、head branch main、head SHA ba2b1413c68d9f7bf575fef790ba0c35715558db。WASM release job、WASM debug job、release upload jobはsuccess。workflow全体のconclusionは別platform jobのfailure。参照: https://github.com/Inochi2D/inochi2d/actions/runs/36956516866
- assetの更新時刻とActions run、job成功、module API世代がそろうため、実際の配布物はmain v0.9.0世代と判定する。nightlyタグのv0.8.7を配布binaryのsourceと見なさない。
- 補助としてv0_8 branchのsource snapshotも取得したが、release tagのSHAではなく、v0.8.7 asset provenanceにも使っていない。比較の正本は上記main SHAとnightly tag SHA。

全4取得archiveの展開前にtar entryを列挙し、絶対path、drive path、親directory traversalを検査した。unsafe entryは0件。公式WASM tarは7 entries、main source archiveは191、nightly tag source archiveは100、v0_8 source snapshotは102。抽出物とprobeは専用cache内に置いた。cacheは.gitignore対象であり成果物にはstageしていない。

## 配布WASM probe

実行環境: Node.js v22.17.0、Node組込みnode:wasi。repo rootからの実行commandはnode .\tegaki_work\.cache\inochi-roundtrip\instantiate-probe.cjs。scriptはtegaki_work/.cache/inochi-roundtrip/instantiate-probe.cjs、logはinstantiate-probe.log。

- WebAssembly.Module.imports: 10 function imports、すべてwasi_snapshot_preview1（fd_close, fd_fdstat_get, fd_fdstat_set_flags, fd_prestat_get, fd_prestat_dir_name, fd_read, fd_seek, fd_write, path_open, proc_exit）。
- exports: 7,830 total、in_* API names 97。memoryと_startも公開。
- compile、WASI instantiate、in_initはPASS。初期化後memory 1,179,648 bytes。
- 存在する主要API: in_puppet_load_from_memory、in_puppet_update、in_puppet_draw、in_parameter_set_value、in_part_get_mesh、in_puppet_get_drawlist、in_drawlist_get_vertex_data、in_drawlist_get_index_data。
- exports中にin_part_set_mesh、in_mesh_*、in_puppet_serialize、save/writeに相当するPuppet出力APIはない。hasPartMeshSetter / hasMeshApi / hasPuppetSerialize / hasPuppetSaveはいずれもfalse。
- WASM配布tarにはC headerとJS wrapperが含まれない。main source archive内のinclude/inochi2d.hとweb/inochi2d-tsは調査した。TS wrapperはmemory load、parameter setter、update/draw等を包むが、Puppetのnative save methodを提供しない。
- instantiate/init成功はSDK起動確認のみ。モデルloadやnative roundtripの成功を意味しない。

## 編集・評価・保存API

証拠の基準ソースはmain SHA ba2b1413c68d9f7bf575fef790ba0c35715558db。下記のpath/lineはcache内の同commit sourceに対する行番号。

| 操作 | 公式main source上の経路 | 判定 |
|---|---|---|
| native INP load | include/inochi2d.h:420、source/inochi2d/cffi.d:277でin_puppet_load_from_memoryがPuppet.fromStreamを呼ぶ | C/WASM APIあり |
| parameter設定 | include/inochi2d.h:674、cffi.d:596-599でin_parameter_set_valueがdimensions個のfloatをcurrentValueへコピー。web/inochi2d-ts/src/inochi2d.ts:280-291にwrapper setterあり | C/WASM APIあり。ただしbinding評価成立は別問題 |
| update / draw | header:526,535、cffi.d:417,428 | C/WASM APIあり |
| drawlist観測 | headerのdrawlist query群、tech-docs/building-a-renderer.md:1-20 | APIあり。Host rendererが必要。CPU側drawlistは評価観測候補だが画素出力ではない |
| Part mesh読取 | header:1065、cffi.d:1114-1118のin_part_get_mesh | C/WASM getterあり |
| Part mesh変更 | source/inochi2d/nodes/visual/part.d:298-307にD-level Part.mesh setter | D内部setterあり。公開C/WASM setterなし |
| mesh配列 | source/inochi2d/core/mesh.d:416-437にverts / uvs / indicesとDataNode serialization | D内部型。in_mesh_* C/WASM APIなし |
| native serialize | source/inochi2d/puppet.d:237-242でPuppet.onSerialize(ref DataNode)。modules/inp/source/inp/format/package.d:101-132とmodules/inp/source/inp/format/inp2/writer.d:31-42にINP1/INP2 writer | D内部部品あり。Puppetをnative bytesへ保存するC/WASM APIなし |
| native reload | loaderでbytesをPuppetに読む入口あり | reload入口あり。保存後データからのroundtripは未実測 |

### Keyform/bindingの世代差

現行main v0.9.0の1D parameter実装はsource/inochi2d/param/parameters/param1d.d:31-57,190-203。定義のmin/max/default/pointsを保持し、evaluationはbindingsを走査する。ところがsource/inochi2d/param/parameters/package.d:75-96ではbinding serialization処理がコメントアウトされ、deserialize側はbinding復元helperを呼ぶ。source/inochi2d/param/bindings/package.d:44-66ではregistry/upgrade経路がコメントアウトされ、typed bindingがない場合は警告を出してnullを返す。

このコード追跡から、current mainはnative data内のkeyform bindingを復元できず、keyform評価が成立しないと推定する（INP fixtureをruntime loadして測った事実ではない）。parameter value setterが存在することだけからkeyform対応を推論しない。

比較としてnightly tag source v0.8.7ではsource/inochi2d/core/puppet.d:804-817にPuppet.serialize()/deserialize()があり、core/param/package.d:265-339でbindingを保存・再構築し、core/param/binding.dにvalue/deformation binding実装がある。旧C APIのparameter setterはin_vec2_t値を受ける（source/inochi2d/cffi/puppet.d:366付近）。これは旧source世代のcapabilityであり、current nightly配布WASMへ適用できない。v0.8.7 sourceに一致する公式WASM assetはrelease assetsに見つからなかった。

## 実行案の比較と判定

1. 既存native payloadを外部編集して再ロード: meshやkeyform payloadのbinary構造を正確に保持・書換えするencoderが必要。current main WASM loaderはあるが、bindings deserializeが無効化されているため、keyform評価要件を満たせない。JSON.stringify/parseのみの代用は禁止。現状はproof経路として不成立。
2. upstream authoring setterからnative serializer: D内部にPart.mesh setter、Puppet DataNode serializer、INP writer部品があるが、公開mesh setterとPuppet-to-bytes APIがない。WASM配布物だけでは呼べない。また現行sourceのkeyform binding復元欠落が残るため、serialize側だけのwrapperでは成立しない。
3. 小bridge: C ABIのPart mesh setterとnative writerを追加するだけでは不十分。現行main世代で1D binding decode/evaluationも回復または追加し、対になるserializeを確認する必要がある。これは小さなAPI接着の範囲を越える可能性があり、Cardの「大幅upstream patchが必要なら停止」に該当する判断が必要。toolchainは導入していない。source workflowの候補commandはdub build --compiler=ldc2 --config=wasm --arch=wasm32-wasip2 --build=releaseだが、公式LDC SDKが必要で、現環境にdub/ldc2はない。

したがってSlice Bを現在の権限で開始しない。次のスコープ確定には、Commanderが (a) 現行mainに対するbinding復旧を許容するか、(b) 旧v0.8.7 sourceと一致する公式/再現可能なWASM buildを採用するか、(c) proof目標を変更するか、を選ぶ必要がある。Cardの最終目標を維持する場合、現状の公式配布WASMから単独で完成する経路は確認できなかった。

## Slice B契約へ引き継ぐ最小案

以下は提案のみ。ファイルは作成しておらず、司令が契約を確定するまで着手しない。

- fixture: 専用cache内のfixture-original.inp。1 Raster Partと1個の1D parameter/keyformを持つ小型native model。公式loaderが拒否しないことを先に確認。
- bridge source / build artifact: 導入世代を固定し、Part mesh set、Puppet DataNodeからINP2 bytesへのwrite、keyform binding load/evaluate/save経路が揃った場合のみ専用cache配下に限定する。
- driver: roundtrip-probe.cjs。native loader→Part mesh編集→parameter 0 / 0.5 / 1→update/draw→drawlistの頂点/indices記録→native bytes serialize→元instance破棄→新規instance load→同じ3値で再評価、を実行。
- fixture編集補助: 必要と契約で決まった場合のみedit-fixture.mjs。独自変形計算を実装せず、native loader/evaluatorが最終結果を所有する。
- result: roundtrip-result.jsonにcommand、runtime/source SHA、input/output hash、各parameter値でのdrawlist数値、reload後との比較、壊れたinput拒否結果を保存。画素一致やBrowser/Project統合とは別判定。

成功判定は、編集前後の意図したmesh/keyform差が確認できること、0/0.5/1の公式evaluator結果が得られること、保存bytesから新規instanceへ再読込後の3結果が再現されること、元へ戻す編集経路と壊れた入力の拒否が確認できること。runtime fixtureなしのsource推定、instantiate/initだけ、parameter setter単体をroundtrip passとしない。

## 判定と変更境界

- PROVEN: upstream archive/asset hashes、GitHub Actions job status、WASM imports/exports、Node instantiate/init、ソース上に記述されたAPI実装と未実装API。
- INFERRED: 配布WASMがmain SHA世代であること（asset更新時刻・Actions head SHA・成功したupload job・API世代から推定）、main v0.9.0でnative keyform binding復元ができないこと（sourceの未接続/コメントアウト経路から推定）。
- UNKNOWN / UNVERIFIED: native fixture load、parameter/keyform評価、Part mesh編集のWASM実行、serialize bytes、破棄後reload、評価一致、pixels、Browser、TEGAKI Project統合、Owner acceptance。
- 最終確認branch main、HEAD 2165a6010f2d64a100ee33efc927637af83c8cc1。production / schema / History / renderer fileは編集していない。変更対象はこのcapability reportのみ。cacheはignoredのまま。
- Owner acceptance、backend採用、Git pushは未実施・未承認。司令の監査とSlice B契約を待つ。

