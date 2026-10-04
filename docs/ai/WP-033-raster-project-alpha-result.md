# WP-033 — 通常Rasterの半透明PNG Project往復 修正結果

## 判定

限定したProject export PNG採取の技術修正を完了した。一般Rasterも、文字・吹き出し・コマと同じ`LayerSystem.createLayerRasterSnapshot()`のcanonical straight-alpha pixelsを一度だけ読み、Canvas2D `putImageData()`→PNG dataURLへ渡す。既存のProject schema、load、renderer、History、SOURCE authorityは変更していない。

- START / FINAL: `main` / `871c51ed850f436aa0d49deb049bf7276c3a9655`。既存dirty/untrackedを保持し、commit/pushは行っていない。
- WRITE: `tegaki_work/system/project-manager.js`のexportProject PNG採取block、限定verifier、専用report/cacheのみ。
- server、SDK、API、process lifecycle、Browser、Project native操作は行っていない。司令の実Project/native確認へ返す。

## 実装

`exportProject()`の通常Raster PNG採取を次へ統一した。

1. `createLayerRasterSnapshot(layer, { includePathCollections: false })`を一度だけ呼ぶ。
2. snapshotの`width`/`height`/`pixels`をCanvas2Dへ`ImageData`として投入する。
3. `canvas.toDataURL('image/png')`で既存`image` fieldへ保存する。

旧通常Raster branchの`renderer.extract.canvas()`と`_unpremultiplyCanvas()`の二度目の処理は削除した。既存文字/吹き出し/コマのmetadata branch、folder/background除外、bounds、load経路は触れていない。

## Verification

| 種別 | 結果 |
|---|---|
| `node --check`（`project-manager.js` / 新verifier） | PASS |
| `verify-project-raster-alpha-save.mjs` | **PASS (12 checks)**。実`ProjectManager.exportProject()`呼出しでcanonical snapshot一回、`includePathCollections:false`、二度目のextract/unpremultiplyなしを確認 |
| `verify-imported-raster-offcanvas-roundtrip.mjs` | PASS（T1–T6 deterministic） |
| `verify-project-imported-raster-transform-roundtrip.mjs` | PASS（safe texture size skip warningは既存境界） |
| `verify-project-json-compaction.mjs` | PASS |
| `verify-folder-deformer-project-roundtrip.mjs` | PASS |
| `git diff --check`（対象tracked block） | PASS |

### 限定fixtureの値

- Raster: `3×1`、bounds `{x:7,y:9,width:3,height:1}`。
- RGBA alpha: `1 / 128 / 255`（低alpha / 半透明 / opaque）。
- canonical RGBA SHA-256: `3c32f25085904254c1cf695cc65169a6e6d459c5990d7b3cedc3f82a76a4a2a3`。
- folderはimageを持たず、backgroundは通常Raster image採取から除外。

結果は[専用cache](../../tegaki_work/.cache/rive-editor/wp033-raster-alpha-save.json)に保存した。cacheのnative欄はdeterministic function testのみのため`UNVERIFIED`であり、司令の実Project export/load・画素一致・Owner受入を代替しない。

## 未測定 / 司令境界

- 固定native/実Projectでの新Raster追加、Project export/load、Export画素一致、Undo/Redo、元絵/History保持は司令のBrowser/native確認待ち。
- 旧Project、bounds外、DPR、Owner制作受入はこのworkerでは判定していない。

