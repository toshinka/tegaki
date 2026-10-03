# Inochi2D fixed-source native proof

WP-020 Slice A uses this isolated, headless D executable. Production Tegaki code does not import it.

## Run

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tegaki_work/advanced/inochi-proof/run-proof.ps1
```

The script calls the cached official LDC 1.43.0 and bundled DUB by absolute path. DUB's home and package/build cache stay under the ignored proof cache. The script does not change machine or user `PATH` and does not install a system toolchain.

The cache-only DUB manifest pins `nulib` 0.3.12 using DUB's documented exact-version constraint. The fixed Inochi2D source calls `MapImpl.byValue()`: selected `nulib` 0.4.8 fails to compile that call, while the official 0.3.12 package exposes it. This is the one dependency compatibility pin for this proof.

## Driver scope

`roundtrip.d` is written to build a fixture with one normal-blend Part, one 1D parameter, and two deformation keyforms, then exercise the native INP writer/loader, evaluation at 0 / 0.5 / 1, keyform editing and withdrawal, destruction/reload, and corrupt-header rejection. These are intended checks; see the result report for the checks the current engine run actually reached.

The current fixed-source run compiles and links the driver, then stops while serializing the deformation parameter. It reports `std.json.JSONException: JSONValue is not an array`. The fixed engine's `Deformation.onSerialize` appends offsets to an uninitialized JSON value. No engine source was changed to bypass or repair that failure.

## Outputs and limits

On a successful run, fixture files, build artifacts, DUB dependencies/selection, logs, and `roundtrip-result.json` remain under `tegaki_work/.cache/inochi-roundtrip` and are ignored. The current failed run did not emit fixture files or a result JSON.

This proof is headless. It cannot establish rendered pixels, WASM, Browser, or connection to Tegaki GUI, Project, History, save, or export.
