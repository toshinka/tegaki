# WP-020 — 固定Inochi proof結果

状態: **BLOCKED — Slice A2で次のnative JSON例外**。write owner: TEGAKI｜実装 LUNA。
契約: [WP-020](../work/WP-020-rig-renewal-first-path.md)。この報告は実測範囲を超えて採用・Browser・製品統合を承認しない。

## 対象と固定入力

- Slice A開始HEAD: `main / 386d71877bd6bd237416cca13f72c16be713e874`。Slice A2開始HEAD: `main / 3d3920c6e2ed13d11f84d630412283c53aff67ec`。最終確認HEAD: `main / 3d7851c6986554f416b02635d6b91b4846215aa5`。
- A2作業中にHEADが進み、最終HEADには`deformation-json-array.patch`だけを追加するcommitが存在する。この実行からcommit/pushはしていない。Commander/SOL所有の文書・style差分は触れず保持した。
- 対象: `tegaki_work/advanced/inochi-proof/{README.md,roundtrip.d,run-proof.ps1}`。実装は headless proof 専用で、製品コード・旧RIG・Project schema・History・Rendererは変更していない。
- 固定Inochi2D source: [`66fa76834b28037db0c871c656563422f697879e`](https://github.com/Inochi2D/inochi2d/tree/66fa76834b28037db0c871c656563422f697879e)。取得URL: `https://github.com/Inochi2D/inochi2d/archive/66fa76834b28037db0c871c656563422f697879e.tar.gz`。Card指定のnightly source snapshotであり、公開v0.8.7 releaseと同一SHAではない。キャッシュsource archive SHA-256: `79F1F51641380AC992B5ECCA2AB49245F111517CA4185CA832FFB0460F6CD4FB`。
- Toolchain: 公式[LDC 1.43.0 Windows x64](https://github.com/ldc-developers/ldc/releases/tag/v1.43.0)。取得URL: `https://github.com/ldc-developers/ldc/releases/download/v1.43.0/ldc2-1.43.0-windows-x64.7z`。archive SHA-256: `60AE3D5E34287AA25433C7550520060A52F9F212E3D5FF6472A9067D8D17E47E`。実行した`ldc2.exe` SHA-256: `DC21284355D5CEF825024F093F75166E15847CFC9BA78DE9DCE9C7A972CF640E`。DUB 1.42.0も同梱版を絶対パスで呼び、PATH/システム環境は変更していない。
- 依存pin: 固定source内の`MapImpl.byValue()`に対し、registryが選択した`nulib 0.4.8`ではnative compileが失敗した。キャッシュ専用manifestを公式[nulib 0.3.12](https://github.com/Inochi2D/nulib/releases/tag/v0.3.12)に一度だけ固定し、compileを通した。exact constraint `==0.3.12`は[DUB仕様](https://dub.pm/dub-reference/build_settings/)に従う。
- Slice A2 patch: tracked [`deformation-json-array.patch`](../../tegaki_work/advanced/inochi-proof/deformation-json-array.patch)は`Deformation.onSerialize`冒頭へ`data = JSONValue.emptyArray;`を一行追加。base file SHA-256 `E424BE9DE5C8C3795FD18C91E6A5D17C2F87C2C84766E99191C5ECFF34CAF026`、patch SHA-256 `E943091A9A362E7A14E382EBD367CFA865F1CC5CA3DD8C306F1F68E5A902C711`、patched file SHA-256 `F5FB290794F848AA75DA0486E0BA0C89C6F17F58D6F9AD08B17B85DC8DB29C8B`。source archiveは変更なし。
- DUB lock: `tegaki_work/.cache/inochi-roundtrip/build-project/dub.selections.json`、SHA-256 `593A1B399EB0A4D6EACCE1FCAE0FBBCE27D8B11381CA0C85F4AADF7A53A92C70`。A1と同一の`imagefmt 2.1.2`, `inmath 1.3.2`, `inochi2d` fixed local path, `intel-intrinsics 1.14.10`, `nulib 0.3.12`, `numem 1.6.13`, `nusilly 1.0.0`, `silly 1.1.1`。
- A1失敗ログは`tegaki_work/.cache/inochi-roundtrip/run-proof-slice-a-first-failure.log`へ保持、SHA-256 `3044FED17A70DE445A196A91596E4C139D259E1583724CB93CC92C9E752CDE84`。A2失敗ログは`run-proof-slice-a2-failure.log`、SHA-256 `9BE8977ADF4BDA91DBB78B335D140D31A11C85BE82F48689009627CE367F8EDD`。

## 証拠

### PROVEN

- portable LDCでのnative compile/link smoke executableが起動した。
- A2 proof driverは固定source・tracked patch・LDCでcompile/linkできた。exe SHA-256 `D587E9D158A1225C351F04CA01268FCC2A7CD3ADC85B2AAAFB68509B363B96E5`。
- DUB lock: `tegaki_work/.cache/inochi-roundtrip/build-project/dub.selections.json`、SHA-256 `593A1B399EB0A4D6EACCE1FCAE0FBBCE27D8B11381CA0C85F4AADF7A53A92C70`。選択version: `imagefmt 2.1.2`, `inmath 1.3.2`, `inochi2d` local fixed path, `intel-intrinsics 1.14.10`, `nulib 0.3.12`, `numem 1.6.13`, `nusilly 1.0.0`, `silly 1.1.1`。
- `run-proof.ps1`のPowerShell AST parseが成功した。
- `node tegaki_work/build/development-harness.mjs check`が成功した: 55 documents、211 local links、25 proposals、11 packages。
- `git diff --check`はexit 0でwhitespace errorなし。working-copyのLFを次回Git操作でCRLFへ変換する旨の警告のみ。
- A2 driverのnative empty `Deformation` serializeは`JSONType.array`かつlength 0を確認し、ログにPASSを記録した。
- A1切り分けではnative root nodeのserializeは通り、次の`puppet.parameters.serialize()`で例外が発生した。

### INFERRED

- A1の例外原因は固定source `core/math/deform.d:238-240`で未初期化JSON destinationへoffsetを追加し、generic serializer `core/format/serde/package.d:146-147`が未初期化`JSONValue obj`を渡していたこと。A2の一行patchとempty-Deformation確認により、その限定ケースは通過した。
- A2でも`std.json.JSONException: JSONValue is not an array`が発生した。出力は初期fixture生成/INP writerへ入る前段で停止した。A2ログに正確なengine callsiteはなく、次のJSON不正箇所は**UNKNOWN**。Stop条件に従い追加trace・修正は行っていない。

## 未到達・UNKNOWN

- A2はempty-Deformation check後、初期fixture生成中に停止。`fixture-original.inp`、`fixture-edited.inp`、`roundtrip-result.json`は生成されていない。driverにはsource provenance出力項目を実装したが、result JSONは未到達なので作成していない。
- native INP save/load、parameter 0/0.5/1 evaluation、keyform edit/withdrawal、destroy/reload、corrupt input rejectionは**UNKNOWN / 未実証**。
- pixels、WASM、Browser、Tegaki GUI/Project/History/save/exportとの接続、Owner acceptanceは**UNKNOWN / 未実施**。

## 実行結果と停止点

### Slice A1

コマンド: `powershell -NoProfile -ExecutionPolicy Bypass -File tegaki_work/advanced/inochi-proof/run-proof.ps1`

- DUB build/link: **PASS**。`nulib 0.3.12`、固定source `66fa768...`、LDC 1.43.0、Windows x64。
- native run: **BLOCKED**。`std.json.JSONException@std\json.d(448): JSONValue is not an array`。exit code 1。A1ログは指定のhashでcache内に保全。

### Slice A2 — 一行patch再試行（実行は1回のみ）

同じコマンドを、base source file SHA・tracked patch SHA・source archive SHA・A1ログSHA・DUB lock SHAを確認して実行した。runnerはbase hashから一行patchを適用し、修正済みhashを照合した。

- runner hash guards / patch apply: **PASS**。この実行のbase hash一致とpatch適用は実測。unknown source拒否は実装したが、unknown状態を使ったruntime試験は行っていない。
- DUB build/link: **PASS**。LDC 1.43.0、DUB 1.42.0、Windows x64。同一DUB lock。
- native empty `Deformation` JSON array確認: **PASS**。
- native fixture path: **BLOCKED**。同じ`JSONValue is not an array`、exit code 1。A2ログSHA-256 `9BE8977ADF4BDA91DBB78B335D140D31A11C85BE82F48689009627CE367F8EDD`。
- PowerShell AST parse、開発harness check、`git diff --check`はPASS。diff checkはLF→CRLF変換warningのみ。

## HOLD / 次の判断

HOLD: native INP save/load、0/0.5/1評価、edit/withdrawal、destroy/reload、corrupt rejection、Browser、texture/pixel proof、製品接続をpass扱いにしない。次のsource errorでA2 Stop条件に達した。次の一件はArchitecture leadが別の限定診断Cardを出すか判断すること。追加patch/評価器修復・Owner受入・Git pushは未実施。
