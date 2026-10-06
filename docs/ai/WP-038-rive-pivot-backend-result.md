# WP-038 backend 限定結果

状態: IMPLEMENTED / PURE・OFFLINE FIXTURE・OFFICIAL CLI VERIFIED。Browser/native描画、通常host、Owner制作受入はこのworkerではUNVERIFIED。Cardをcloseしない。

## Scopeと基準

開始checkoutは`D:\GitHub\tegaki`、main/`4760db9c16f2af50345916381d45559cec7b1733`。AGENTS→STATUS→TECHNICAL→WP-038→対象headerとWP035 Slice A calibrationを確認。既存dirtyを保持し、編集前model/serverを`tegaki_work/.cache/rive-editor/wp038/backend/baseline/`へ保存した。320×200、300×180、321×201、1×1 × quad/grid3 × 30/56/-90/90°の32件sourceを編集前に採取し、bytes/hash回帰を検証。verifierにも採取済み32hashを固定し、baseline cacheの有無に依存せず回帰を検査できる。

WRITEはpivot-model.mjs、model.mjs、server.mjs、新verifier、本結果、専用backend cacheだけ。稼働18729/Owner5174へ起動・停止・再起動・API mutationなし、Browser操作なし、SDK/CLI/runtime/evaluator本体patchなし、製品buildなし、commit/pushなし。UI/rootdocs/共通filesは編集していない。

## 実装

- pure ESM `pivot-model.mjs`を42行で追加。`assertPivot(value,width,height)`、`defaultPivot(width,height)`、`scalePivot(pivot,oldWidth,oldHeight,newWidth,newHeight)`。undefinedだけ中央既定。明示null/空文字/string/型違い/片軸欠落/非finite/範囲外を拒否、閉区間と3桁丸め後の再範囲検査を行う。
- quad/grid3 sourceの2生成関数へpivotを接続。Root x=`pivot.x-W/2`、y=`pivot.y`、RootTendon tx=`pivot.x-W`、ty=`pivot.y-H/2`、EndTendon tx=`pivot.x-W/2`、ty=`pivot.y-H/2`。両骨長W/2、Root rotation0、End30°rest matrix、image/mesh/UV/triangles/weightsを維持。中央default32bytes一致。
- parserはsource内のRoot位置からpivotを導出し、Root/End identity・固定長・rest/frame0・Skin identity・Tendon数/順/骨ID/行列/位置を照合。不一致はparse前半でnull。Root内直接End一件とImage→Mesh→Skin→RootTendon/EndTendon階層を確認し、Root/End未知attributeを拒否する限定grammar。一般XMLparserへ拡張していない。
- `snapshot.pivot`はsourceだけから導出し、stateに別pivot正本を置かない。`centerAtRotationPivot`はgrid3の原PNG中央とpivotが一致するときだけtrue。保存metadataへpivot追加なし。
- compileの`body.pivot`省略はcurrentSource由来を維持。角/weights/profile編集も同じsource生成経路。PNG置換は旧source pivotの正規化比率を新寸法へ移す。static tableへ`/pivot-model.mjs`、`/pivot-editor.js`を追加。Origin/nonce/body limit/save/reopen/cancel/security/lifecycleを維持。

編集前保存copyに対する今回worker差分はmodel `+89/-13`、server `+17/-11`、pure helper42行。source生成接続は2templateの引数・safePivot・Root位置・2Tendon位置だけ（各6変更後行）、server接続はimport/compile/PNG置換/snapshot固定true撤去/static/error分類の限定箇所。parser契約照合は約70行、汎用runtime/evaluator橋渡しは0。新verifierは285行。GitのHEAD差分には先行WP034/035dirtyが含まれるため、今回量の基準に使っていない。

## 実行commandと証拠

```powershell
node --check tegaki_work/advanced/rive-editor/pivot-model.mjs
node --check tegaki_work/advanced/rive-editor/model.mjs
node --check tegaki_work/advanced/rive-editor/server.mjs
node --check tegaki_work/build/verify-rive-pivot-model.mjs
node tegaki_work/build/verify-rive-pivot-model.mjs
node tegaki_work/.cache/rive-editor/wp038/backend/legacy-model-scoped.mjs
node tegaki_work/.cache/rive-editor/wp038/backend/legacy-weights-scoped.mjs
node tegaki_work/.cache/rive-editor/wp038/backend/legacy-grid-scoped.mjs
git diff --check -- tegaki_work/advanced/rive-editor/model.mjs tegaki_work/advanced/rive-editor/server.mjs
```

新verifier **247 checks PASS**。32旧source bytes/hash、原点/端/小数、25悪性source変異（Mesh直下Skinのwrapper拒否を含む）、strict pivotを確認。実server handler bodyをofflineで捕捉し、build/files/httpをfixtureに置き換えて17不正pivotを400へ分類、source/buildId/dirty/savedとbuildCalls0/files0を確認。Origin/nonce403、pivot省略保持、角/weight/profile保持、PNG比率移行、CLI rejection422/internal exception500と良好state保持も確認。この証拠はlive API操作ではない。

既存model verifierは全model処理のcache/import/rootだけを独立化してPASS。weightsはpacking/source/既存draft controllerの限定46 checks、gridはprofile/source/旧quad互換の限定37 checks PASS。適応scriptとoriginal/output hash・変更理由は`backend/legacy-adaptation-receipt.json`、結果は`legacy-*/`内。旧verifier全体のUI/static/Browser/native節のPASSを主張しない。

新verifierは固定CLI1.3.0/runtime2.44.0の既存`verifyFixedCache` hash gateを使用し、専用cacheで7projectを公式`--verify --format=json`→`--once --format=json`→`inspect <project> --json`。全21commands exit0/JSON success、inspect topology一致。全引数/JSON/stdout hashは`backend/pivot-model-verification.json`、stdout/stderr/source/PNG/rivは`backend/official-cli/<name>/`。

CLI executable SHA256: `285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9`。runtime canvas module `8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9`、wasm `A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74`、fallback `A365794008237E20B9CA922291FD8B1B966C174AC21A8DA7B48C34F2D83F93A5`。archivesも既存fixed gateで一致。

移動中心(102.123,63.456)/grid3/56°のsource SHA256 `c617c4108a63fc4878be4e8b9fec7d7bd641a050a4cd46f2ff917b04db0b5b83`、PNG `9a4a425f8b517e97ea3b41b4f8a7ab0fd1117afa9170f96568a5de390604f538`、derived riv `0ad672a7c151bf7a94e711faf153ed8f29e364c80265cf0a8155f5f5963af670`。別directory/new CLIのmoved-reloadと全3hash一致。これは公式再buildのbytes一致であり、新official Web runtimeのRGBA一致は司令へ返す。

## 未実測と引渡し

rest/progress0 native画素不変、56°/progress1 native差、Center weight差、透明1xPNG、Save→旧Web instance破棄→Reopen/new runtime同progress RGBA、配置mode/数値UI/360px/stale/dispose、通常Raster/History/ProjectManager/export/load、性能/液タブ/Owner制作受入はこのworkerではUNVERIFIED。CLI screenshotは実行していない。独立actual server/Browser/製品build/通常host監査は司令担当。backend API準備完了を司令へ先行通知済み。
