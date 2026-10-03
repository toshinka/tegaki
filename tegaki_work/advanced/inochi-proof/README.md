# Inochi2D fixed-source native proof

WP-020 Slice A uses this isolated, headless D executable. Production Tegaki code does not import it.

## Run

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tegaki_work/advanced/inochi-proof/run-proof.ps1
```

The script calls the cached official LDC 1.43.0 and bundled DUB by absolute path. DUB's home and package/build cache stay under the ignored proof cache. The script does not change machine or user `PATH` and does not install a system toolchain.

The cache-only DUB manifest pins `nulib` 0.3.12 using DUB's documented exact-version constraint. The fixed Inochi2D source calls `MapImpl.byValue()`: selected `nulib` 0.4.8 fails to compile that call, while the official 0.3.12 package exposes it. This is the one dependency compatibility pin for this proof.

## Slice A2 source patch

The first Slice A attempt compiled and linked, then stopped with `std.json.JSONException: JSONValue is not an array` while serializing deformation keyforms. Its original cache log is retained as `tegaki_work/.cache/inochi-roundtrip/run-proof-slice-a-first-failure.log`.

The only engine-source exception is the tracked one-line patch in `deformation-json-array.patch`: initialize `Deformation.onSerialize`'s JSON destination to `JSONValue.emptyArray`. Provenance: archive SHA-256 `79F1F51641380AC992B5ECCA2AB49245F111517CA4185CA832FFB0460F6CD4FB`; base file SHA-256 `E424BE9DE5C8C3795FD18C91E6A5D17C2F87C2C84766E99191C5ECFF34CAF026`; patch SHA-256 `E943091A9A362E7A14E382EBD367CFA865F1CC5CA3DD8C306F1F68E5A902C711`; patched file SHA-256 `F5FB290794F848AA75DA0486E0BA0C89C6F17F58D6F9AD08B17B85DC8DB29C8B`. The source archive stays unchanged. The runner checks these values, the previous failure-log SHA, and the existing DUB lock SHA. It applies the patch to the extracted cache source when the base file hash matches, accepts that exact patched hash on a subsequent invocation, and refuses all unknown file hashes.

## Driver scope

`roundtrip.d` first checks that a native empty `Deformation` serializes to an empty JSON array. It then builds a fixture with one normal-blend Part, one 1D parameter, and two deformation keyforms, and exercises the native INP writer/loader, evaluation at 0 / 0.5 / 1, keyform editing and withdrawal, destruction/reload, and corrupt-header rejection. See the result report and cache log for the checks the A2 run actually reached.

When a run reaches the result writer, the JSON records the fixed source base SHA, the one tracked patch and its hash, the patched source file hash, and the preserved Slice A failure log. The fixture has no texture; evaluated native vertices do not prove Raster texture or pixel output.

The A2 retry verified and applied the one-line patch, built and linked, and passed the native empty-Deformation serialization check. It then stopped with `std.json.JSONException: JSONValue is not an array` during initial fixture generation. The original and edited INP files and result JSON were not emitted; the A2 log is preserved at `tegaki_work/.cache/inochi-roundtrip/run-proof-slice-a2-failure.log`.

## Outputs and limits

Fixture files, build artifacts, DUB dependencies/selection, logs, and `roundtrip-result.json` remain under `tegaki_work/.cache/inochi-roundtrip` and are ignored. The first Slice A failure log remains available at `run-proof-slice-a-first-failure.log` with SHA-256 `3044FED17A70DE445A196A91596E4C139D259E1583724CB93CC92C9E752CDE84`.

This proof is headless. It cannot establish rendered pixels, WASM, Browser, or connection to Tegaki GUI, Project, History, save, or export.
