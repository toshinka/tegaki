# WP-020 — 固定Inochi proof結果

状態: **BLOCKED**。write owner: TEGAKI｜実装 LUNA。
契約: [WP-020](../work/WP-020-rig-renewal-first-path.md)。この報告は実測範囲を超えて採用・Browser・製品統合を承認しない。

## 対象と固定入力

- 開始HEAD: `main / 386d71877bd6bd237416cca13f72c16be713e874`（Card baseline）。最終確認HEADは`main / 3d3920c6e2ed13d11f84d630412283c53aff67ec`。
- 開始時worktreeにはCommander/SOL所有の文書・style差分もあった。Slice Aでは触れず、最終HEADに含まれている。現在のdirty/untracked差分は本Sliceの指定4 fileだけ。
- 対象: `tegaki_work/advanced/inochi-proof/{README.md,roundtrip.d,run-proof.ps1}`。実装は headless proof 専用で、製品コード・旧RIG・Project schema・History・Rendererは変更していない。
- 固定Inochi2D source: [`66fa76834b28037db0c871c656563422f697879e`](https://github.com/Inochi2D/inochi2d/tree/66fa76834b28037db0c871c656563422f697879e)。取得URL: `https://github.com/Inochi2D/inochi2d/archive/66fa76834b28037db0c871c656563422f697879e.tar.gz`。Card指定のnightly source snapshotであり、公開v0.8.7 releaseと同一SHAではない。キャッシュsource archive SHA-256: `79F1F51641380AC992B5ECCA2AB49245F111517CA4185CA832FFB0460F6CD4FB`。
- Toolchain: 公式[LDC 1.43.0 Windows x64](https://github.com/ldc-developers/ldc/releases/tag/v1.43.0)。取得URL: `https://github.com/ldc-developers/ldc/releases/download/v1.43.0/ldc2-1.43.0-windows-x64.7z`。archive SHA-256: `60AE3D5E34287AA25433C7550520060A52F9F212E3D5FF6472A9067D8D17E47E`。実行した`ldc2.exe` SHA-256: `DC21284355D5CEF825024F093F75166E15847CFC9BA78DE9DCE9C7A972CF640E`。DUB 1.42.0も同梱版を絶対パスで呼び、PATH/システム環境は変更していない。
- 依存pin: 固定source内の`MapImpl.byValue()`に対し、registryが選択した`nulib 0.4.8`ではnative compileが失敗した。キャッシュ専用manifestを公式[nulib 0.3.12](https://github.com/Inochi2D/nulib/releases/tag/v0.3.12)に一度だけ固定し、compileを通した。exact constraint `==0.3.12`は[DUB仕様](https://dub.pm/dub-reference/build_settings/)に従う。

## 証拠

### PROVEN

- portable LDCでのnative compile/link smoke executableが起動した。
- proof driverは固定source・LDCでcompile/linkできた。最終生成exe SHA-256: `54E7543A3CC5BE28AE14B32607E95EC5CB928ADEAE69C8A0F69DB6D17EA27F92`。
- DUB lock: `tegaki_work/.cache/inochi-roundtrip/build-project/dub.selections.json`、SHA-256 `593A1B399EB0A4D6EACCE1FCAE0FBBCE27D8B11381CA0C85F4AADF7A53A92C70`。選択version: `imagefmt 2.1.2`, `inmath 1.3.2`, `inochi2d` local fixed path, `intel-intrinsics 1.14.10`, `nulib 0.3.12`, `numem 1.6.13`, `nusilly 1.0.0`, `silly 1.1.1`。
- `run-proof.ps1`のPowerShell AST parseが成功した。
- `node tegaki_work/build/development-harness.mjs check`が成功した: 55 documents、210 local links、25 proposals、11 packages。
- `git diff --check`はexit 0でwhitespace errorなし。working-copyのLFを次回Git操作でCRLFへ変換する旨の警告のみ。
- 切り分け実行ではnative root nodeのserializeは通り、次の`puppet.parameters.serialize()`で例外が発生した。proof driverの本実行もINP出力前に同じ例外で終了した。

### INFERRED

- 失敗経路は固定sourceの`Parameter.onSerialize` → deformation bindingの`values.serialize()` → `Deformation.onSerialize`。source `core/math/deform.d:238-240`は受け取った`JSONValue`をArrayとして初期化せずに`data ~= offset.serialize()`を実行する。generic serializer `core/format/serde/package.d:146-147`は未初期化`JSONValue obj`を渡している。実行時例外は`std.json.JSONException: JSONValue is not an array`。因果はsource traceからの推定で、engine修正は行っていない。

## 未到達・UNKNOWN

- proofは初期native INPを作る段階に到達できず、`fixture-original.inp`、edited INP、result JSONは生成されていない。
- native INP save/load、parameter 0/0.5/1 evaluation、keyform edit/withdrawal、destroy/reload、corrupt input rejectionは**UNKNOWN / 未実証**。
- pixels、WASM、Browser、Tegaki GUI/Project/History/save/exportとの接続、Owner acceptanceは**UNKNOWN / 未実施**。

## 実行結果と停止点

コマンド: `powershell -NoProfile -ExecutionPolicy Bypass -File tegaki_work/advanced/inochi-proof/run-proof.ps1`

- DUB build/link: **PASS**。`nulib 0.3.12`、固定source `66fa768...`、LDC 1.43.0、Windows x64。
- native run: **BLOCKED**。`std.json.JSONException@std\json.d(448): JSONValue is not an array`。exit code 1。失敗ログ、DUB selection、exeは無視cache `tegaki_work/.cache/inochi-roundtrip/`内。
- engine sourceや依存の別versionは変更していない。WP-020のengine修復禁止境界に達したので、このSliceはここでlead判断へ返す。

## HOLD / 次の判断

HOLD: Slice Aのsave/reload acceptance、Browser、製品接続をpass扱いにしない。次の一件は、固定sourceの`Deformation.onSerialize`配列初期化を別Cardで修正する承認をArchitecture leadへ返すこと。修正実装・Owner受入・Git pushは未実施。
