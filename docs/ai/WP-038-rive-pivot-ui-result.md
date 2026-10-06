# WP-038 — pivot authoring UI result

更新日: 2026-10-05。担当範囲はUI/controllerと純粋verifierに限定し、backend model/server、runtime、bone、playback、renderer、Project/History/save authorityは変更していない。

実装した接点:

- `tegaki_work/advanced/rive-editor/pivot-editor.js` に独立 `PivotEditorController` を追加。X/Y入力、中央へ戻す、配置モード、原PNG influence SVG内の独立marker/surface、Apply/Discard、raw値/field validity、stale/disposeをcallbackで接続した。
- `editor.js` にpivot snapshot (`pivot`, `pivotDraft`, `pivotEditPhase`, `placementMode`) 同期、`/api/compile`へのoptional `pivot` payload、draft中の既存操作lock、frame request拒否、Apply後のfresh native loadを接続した。
- `editor.html` に日本語label/testid付きのX/Y・配置・中央・適用・破棄と、weight point layerとは別のSVG layerを追加した。配置surfaceはmode OFFでpointer-inert、markerはnative canvas/PNGへ描画しない。
- `weight-editor.js` は `centerAtRotationPivot` の中央注記表示条件だけを同期した。quadはfalse、grid3はpivotが画像中央のときだけtrue。

純粋/controller検証:

```powershell
node --check tegaki_work/advanced/rive-editor/pivot-editor.js
node --check tegaki_work/advanced/rive-editor/editor.js
node --check tegaki_work/advanced/rive-editor/weight-editor.js
node tegaki_work/build/verify-rive-pivot-editor.mjs
git diff --check -- tegaki_work/advanced/rive-editor/editor.js tegaki_work/advanced/rive-editor/editor.html tegaki_work/advanced/rive-editor/weight-editor.js
```

`verify-rive-pivot-editor.mjs`: PASS、27 checks。focus/mode選択のみdraft 0、raw `5`/空欄保持、weight/bone owner拒否、invalid Applyのcallback 0、Discardのcompile 0、valid Applyのcallback 1、delayed responseのdispose stale、独立SVG marker/surface、SVG `hidden`属性の可視化、CTM優先の非正方形/padded viewBox投影、letterbox fallback、snapshot wiringを確認した。生成記録は `tegaki_work/.cache/rive-editor/wp038/ui/wp038-pivot-ui-verification.json`。

行数は `pivot-editor.js` 580、`editor.js` 1338、`editor.html` 278、`weight-editor.js` 516、`verify-rive-pivot-editor.mjs` 270（2026-10-05時点）。

未確認: trusted Browserの実操作、native official CLIのpivot compile/save/reopen/画素比較、通常host Raster/History/Project往復、GPU/液タブ性能、Owner制作受入。製品buildは司令統合後に一回実行するため、この担当では未実施。既存18729/Owner5174の停止・再起動・API mutation、commit/pushは行っていない。

