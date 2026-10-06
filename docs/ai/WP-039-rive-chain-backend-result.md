# WP-039 backend 限定結果

状態: IMPLEMENTED / PURE・OFFLINE HANDLER・OFFICIAL CLI REPRESENTATIVE VERIFIED。司令の実Browser/native/通常host統合へ引渡し。制作受入やCard closeを自己承認しない。

## 完成した接続

`chain-model.mjs`（pure ESM）が2..8連鎖骨、45点row-majorのjoint/角/warp/二骨weight、初期自動bind、preset、PNG置換比率移行、RML生成/解析を所有する。公開helperは`assertChain`、`createDefaultChain`、`createChainPreset`（arm3/snake6）、`createChainMesh`、`createChainWeights`、`resizeChain`。固定9×5/45 vertices/64 triangles、外周24点→内部21点のRML順とtriangle remapを用い、UVは原図を維持。endpoint/同骨weightは単一255へcanonical化。

骨のrest jointからlength/relative rotation/world Tendonを12桁で導出。Root→Joint2→Joint3…を親tipへ連鎖し、Tendon位置はjoint-image中央。全骨key15、全45vertex key24/25を一秒EndPoseへ出力し、描画/補間は既存公式runtimeだけ。source parserはRMLの骨・weight・trackから3桁chainを復元し、生成source全体との完全一致でhierarchy/bind/UV/topology/unknown属性/余分trackを拒否する。sourceに別joint metadataを追加しない。

modelはcreateSource/parse/snapshotへのbranchだけ。snapshotはsource由来rigMode=chain/legacy、chain、chain-grid、45/64、chain angle=angles[0]、chain meshWeights=null。legacy pivot source読込を維持。

serverは既存POST `/api/compile {chain,progress}` branchを追加し、省略したlegacy操作がchainを上書きしないよう409。入力不正はCLI前400、CLI失敗は422と良好scene保持。PNG置換はjoint/warpを比率移行しangle/weightを保持。promoteはchainでlegacy profile/weight assertを通さず、Save/Reopen/Cancel/起動の既存source+PNG pathを使用。rootはworkbench、旧editor.htmlとsecurity/bodylimit/nonce/protocolを維持。UI files、runtime/evaluator/SDK/bridge/製品renderer/Project/Historyを編集していない。

## 限定検証

```powershell
node --check tegaki_work/advanced/rive-editor/chain-model.mjs
node --check tegaki_work/advanced/rive-editor/model.mjs
node --check tegaki_work/advanced/rive-editor/server.mjs
node --check tegaki_work/build/verify-rive-chain-model.mjs
node tegaki_work/build/verify-rive-chain-model.mjs
git diff --check -- tegaki_work/advanced/rive-editor/model.mjs tegaki_work/advanced/rive-editor/server.mjs
```

構文4/4、新verifier **91 checks PASS**、diff check PASS。対象はstrict入力、45/64/UV/RML順、旧pivot source一例、折れ曲がり小数jointのcanonical往復、weight端/同骨、resize、source変異5件、offline実handlerと代表公式CLIだけ。骨数別native網羅・旧suite大量反復はしない。

offline実handlerはbuild/files/httpをfixtureへ置換。21不正chainを400へ拒否し、source/buildId/dirty/saved/buildCalls0/files0の不変を確認。successful chain compile/progress0.5、chainにlegacy操作409、CLI failure422保持、PNG resizeも確認。このfixtureをlive API/native描画PASSへ数えない。

固定CLI1.3.0/runtime2.44.0の既存hash gate PASS。専用`tegaki_work/.cache/rive-editor/wp039/backend/representative-chain/`で3骨、joint1=(117.123,83.456)、angles=[20,-35,25]、warp22=(12,-8)の一例だけ公式実行。

```text
rive.exe <representative-chain> --verify --format=json
rive.exe <representative-chain> --once --format=json
rive.exe inspect <representative-chain> --json
```

全command exit0/JSON success、inspect45 vertices/64 triangles。inspectの唯一のwarningは既存EndPose方式と共通の`no-default-state-machine`。既存RiveNativeRuntimeがEndPoseを明示取得してseekするため、state machine追加を行わない。CLI screenshotは実行しない。

代表source SHA256 `72725c0bcb12c74bd1941b0108e3e485c507ad50b1ed44d2c93e933c79417dbe`、PNG `9a4a425f8b517e97ea3b41b4f8a7ab0fd1117afa9170f96568a5de390604f538`、derived riv `d48a0437baedad741cf39f5a144e6020a55c4778f13af08d2d36372d852b62f5`。固定CLI exe `285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9`。runtime/archives含むgate hash、command全引数/JSON/stdout hashは`backend/chain-model-verification.json`。

## 変更量・境界・引渡し

main/`4760db9c16f2af50345916381d45559cec7b1733`、開始前全dirtyを保持。今回の編集前copyは`backend/baseline/`。そのcopyとの差分はmodel **+11/-4**、server **+28/-9**、新chain model219行、新verifier129行。model/serverに汎用class/自作evaluatorを増やさず、source branch・API promote/resize・static registrationに絞った。source file hashと同hashで成立した91checks/syntaxは`backend/final-source-receipt.json`。

通常live18729/18842への起動/停止/restart/API mutationなし。Browser操作なし。system install/cloud/login/追加agent/製品build/commit/pushなし。他者UI/共有docsや既存dirtyを巻き戻していない。API接続可能時点で司令へ通知済み、backendは凍結して統合へ返す。

実Browserの配置/raw/Apply/Discard・pose0/0.5/1描画差/rest原PNG形状・Save/Reopen新runtime再現・透明PNG/通常Raster/UndoRedo/実Project往復は司令担当で、このworkerではUNVERIFIED。性能/液タブ/GPU/Owner制作受入もUNVERIFIED。次Cardや追加engine調査へ自動進行しない。
