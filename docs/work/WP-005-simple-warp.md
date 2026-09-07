# WP-005 — Simple 4x4 WARP UI

状態: ACTIVE（2026-09-07）。現在の作業baseline HEAD: `0c93561eda44f1ebba9f2e882d916c305e1de8ab`。

現時点ではLayer TransformのBASIC/WARP切替、Simple 4x4の16点pointer adapter、normal/CAF SOURCEのRaster preview/bake、CAF ANIMATEの既存`layerDeformers` bridge接続まで実装した。関連verifier・構文・Vite buildはPASSしている。normal SOURCEの実Browser操作、CAF ANIMATEの入場・preview・Esc・V確定・次Frame移動、Tableを閉じたCAF SOURCEのdrag・V確定を限定確認した。Table close rollbackとpointer terminalの本Sliceは技術PASSだが、trusted device pointercancel、実Pixi画素、保存/再open、Owner操作受入は未完了である。

## Progress (2026-09-07)

- 実装差分: WARP tabを既存Layer Transform panelへ追加し、auto-fitされた4x4の16点とpointer gesture adapterを接続した。pointerdownでbaseline/capture、pointermoveでpreview、pointerupはgesture終了のみ、pointercancel/lost captureはgesture rollbackとしてsessionを継続する。
- normal SOURCE: 描画後にVで入場し、WARP表示（16点）・点ドラッグ・Esc取消・V確定をBrowserで確認した。変更確定はHistory `+1`、取消は`+0`、gesture中のpointerdown/upではHistoryを増やさない。確定後のUndo/Redoは各1回で元画像/変形画像へ戻る。変更中のBASIC切替はWARPに留まり、暗黙commitしない。console errorは確認されなかった。
- CAF ANIMATE: 2Frame CAFを実Browserで選択し、`ANIMATE · F1 READY`、4x4/16点表示、点drag後の`ANIMATE · F1 WARP KEYED`、Esc取消を確認した。確認時Historyは変化せず、V確定・Frame移動・Table close後の再現は未受入である。
- 追加修正: 初回WARP入場時の既存transform anchor初期化を先に行い、未変更BASIC sessionの誤検出でWARP entryが拒否される経路を除去した。source previewの比較基準は現在候補ではなくsession開始時baselineとしたため、移動して元へ戻す操作はno-opになる。bridge再描画中もWARP transactionが生きている間はoverlayを維持する。
- 追加追補: CAF ANIMATEのWARP bridge previewが予約する`AnimationTablePopup.render()`は、高度WARP GRID用判定に失敗すると共有`warpGridOverlay`をdeactivateしていた。`getLayerWarpEditSession()`とLayer Transformの`warp` modeが生きている間はcleanup対象から除外する局所guardを追加した。修正後の実Browserで、点drag後も16点と`ANIMATE · F1 WARP KEYED`が維持され、V確定でTableへ戻りHistoryが1件増え、次Frameへ移動できた。Tableを閉じたCAF SOURCEでも`SOURCE · WARP`のdrag→V確定を確認した。両方ともconsole errorは0件。IABではChrome version/DPRは取得できなかった。
- 技術確認: `test warp` 20/20、`test transform` 13/13、`test animation` 34/34、`test project` 9/9、専用WARP verifier 4件、harness check、構文確認、`git diff --check`をPASS。今回production JSは変更していないため、Vite production buildは前回のguard変更時PASSを継承し、再実行していない。Browser確認はOwner受入とは分離する。
- Table close terminal: 2Frame CAF ANIMATEで、元KEYなしの`pending→close`はHistoryをduration変更分から増やさず、close後overlayを0へ戻し、再open時に`F1 · KEY未設定`／`READY`へ戻った。元KEYありでは一度`History +1`で確定したF1のpointsを基準に別位置のpendingを作り、close後に元pointsと`WARP KEYED`を再現し、追加Historyを作らなかった。狭いIABではclose buttonのEnter起動、viewport 1280x720のIABでは同じpendingと実pointerup保持を確認した。model authority直読はBrowser隔離のため、`hide()`のcancel-before-hide順序を`verify-layer-transform-warp-ui.mjs`で固定し、既存transaction verifierと分離して記録した。
- Pointer terminal: `verify-layer-warp-pointer-terminal.mjs`でproduction `LayerTransformWarpController`をinstantiateし、Gesture Aのpointerup保持、Gesture Bのpointercancel rollback、capture loss rollback、pointerup後late loss保持、History/finish 0を固定した。`build/wp005-pointer-terminal-diagnostic.html`ではproduction `WarpGridOverlay`のDOM listenerへsynthetic `PointerEvent`をdispatchし、NORMAL SOURCE／CAF ANIMATEの両方で同じ結果をBrowser確認した。IAB診断はviewport 1280x720、DPR 2.25、console errors 0。trusted device由来のpointercancelは未検証として残す。
- 未完了: 実Pixi/CPU/export画素一致、save/reopen、非4x4/排他対象の実画面拒否、trusted device pointercancel、Owner操作受入。CAF SOURCEのdrag→Vは確認済みだが、DrawingSnapshotのsave/reopen往復と実画素比較は未確認。

## Final technical evidence slice (2026-09-07)

- このSliceのlive baselineは`86803e1de0d649648c079b44e20389dc868981fd`、開始時worktreeはclean。既存WARP/UI/terminal差分を保持し、production JSは変更していない。

- `build/wp005-final-evidence-diagnostic.html`を追加し、固定16x16非対称Rasterをproduction `warpRgbaWithControlMesh`、`TimelineFrameCompositor`、`ExportManager`、`ProjectManager`、`AnimationTablePopup._renderInternalLayerPreviewGroup`へ接続した。Chrome 152、viewport `680x561`、DPR `2.25`、console errors `0`。
- normal SOURCEのCPU preview / bake / PNG exportは一致した。hash `0x17a134da`、nonTransparent `18`、bbox `{x:1,y:1,width:14,height:13}`。Project save/reopenは、Pixiへ一度uploadしたproduction canonical Rasterでは `0x191a3ed6 → 0x191a3ed6`、reload後Exportも同hashで一致した。CPU入力そのものは `0x7de6acda`から`0x191a3ed6`へ変わり、半透明RGBの8bit premultiplied-alpha量子化（代表 `[179,19,36,121] → [177,17,36,121]`）を固定fixtureで確認した。保存schemaやrendererは変更していない。
- CAF SOURCEのDrawingSnapshot / CPU preview / PNG export / Project reloadはすべて hash `0x17a134da`で一致した。DrawingSnapshotはProject load後も同じCanvas評価結果を返した。
- CAF ANIMATEのCPU compositor / PNG exportは hash `0x17a134da`で一致し、save/reopen後も同hash、`F1 → F2 → F1`は各 `0x17a134da`を再現した。`ClipInstance.layerDeformers`はbefore/afterで`internal-raster`、`control-mesh`、4x4、frame `0`、16点が一致した。
- CAF ANIMATEのproduction Pixi previewは描画まで成功したが、unpremultiply後hash `0x63f4c1ac`でCPUとの差が残った。差は9px、diff bbox `{x:1,y:1,width:9,height:9}`、最大channel差102、最初の差 `[177,17,36,121]`対`[179,19,36,121]`。半透明境界を含むWebGL Mesh samplingとCPU triangle rasterizerの差として記録し、許容誤差を独断で導入していない。
- Layer WARP + Layer Motionはproductionの評価順`DrawingSnapshot → Layer WARP → Layer Motion`を通り、CPU / PNG exportは hash `0x8525007f`で一致した。Pixiは hash `0xf73d350c`、9px差、diff bbox `{x:3,y:2,width:9,height:9}`、最大channel差196（Pixi bbox `{x:3,y:2,width:14,height:13}`、CPU bbox `{x:4,y:2,width:13,height:13}`）。同じくGPU Mesh / Canvas変換境界の差であり、renderer再設計は今回の範囲外。
- `build/verify-layer-transform-warp-entry-guards.mjs`を追加した。実production `AnimationTablePopup._projectLayerWarpBridgeStart`と`LayerSystem.beginLayerWarpEditSession`を同一fixtureへ接続し、non-4x4=`advanced-layer-warp-required`、RIG=`layer-deformer-rig-overlap`、Mesh/Skin=`layer-deformer-mesh-overlap`、clipping owner/source=`layer-deformer-clipping-overlap`を全件、effect/model mutation `0`、History `0`、session `none`で固定した。既存deformerも保持した。
- このSliceの判定は`PARTIAL / GPT review required`。Pixi/CPU境界差とCPU入力対production canonical save差の扱いは、renderer/schema変更を伴うため今回独断で修正しない。WP-005は`ACTIVE`のまま、Owner ACCEPTEDへ進めない。WP-007はproduction JS未変更のため`NOT RERUN — no relevant production change`を継承する。trusted device pointercancelとActual App UI/Owner操作感も未確認のまま。

## Pixi / CPU parity root-cause slice (2026-09-07)

### Scope and evidence

- baseline HEADは`0c93561eda44f1ebba9f2e882d916c305e1de8ab`。既存差分を保持し、production JSは変更していない。追加物は`build/wp005-pixi-cpu-parity-diagnostic.html`のみ。
- 固定16x16非対称fixtureをChrome 152（viewport `680x561`、DPR `2.25`、console errors `0`）で比較した。CPU authorityは`warpRgbaWithControlMesh` / `TimelineFrameCompositor`、Pixi proxyはproduction `AnimationTablePopup._renderInternalLayerPreviewGroup` / `_createDeformerPreviewNode`。
- NO WARP opaqueはCPU/Pixiとも`0x74a8cbf3`で完全一致。NO WARP alphaは1px、最大差2（`[177,17,36,121]`対`[179,19,36,121]`）。これは`EXPECTED GPU CANONICALIZATION`として扱い、保存形式や通常Raster pipelineは変更しない。IDENTITY WARP opaqueは完全一致、alpha差はNO WARPと同一である。

### Case matrix

| case | CPU | Pixi | diff | max | diff location |
| --- | --- | --- | ---: | ---: | --- |
| INTEGER WARP / opaque | `0xc01acf0b` | `0x0cc4933f` | 10px | 255 | triangle interior 10/10 |
| INTEGER WARP / alpha | `0x42f427ae` | `0xe9338617` | 10px | 255 | triangle interior 10/10 |
| SUBPIXEL WARP / opaque | `0x17a134da` | `0x63f4c1ac` | 9px | 102 | triangle interior 9/9 |
| SUBPIXEL WARP / alpha | `0x7f8ca105` | `0xdd315d85` | 9px | 232 | triangle interior 9/9 |
| SUBPIXEL WARP + Layer Motion / opaque | `0x8525007f` | `0xf73d350c` | 9px | 196 | triangle interior 9/9 |

最初のdeformed divergenceはINTEGER `(x=1,y=1)`、CPU `[180,18,37,194]`、Pixi `[180,20,35,195]`、triangle `1` indices `[0,5,4]`、UV `[(0,0),(0.333333,0.333333),(0,0.333333)]`、CPU barycentric `[0.71875,0.236842,0.044408]`、source coordinate `(1.263158,1.5)`。SUBPIXELは同pixelでCPU `[177,17,36,121]` / Pixi `[179,19,36,121]`、source `(0.974026,1.5)`。Layer Motion代表のdiff bboxは`{x:3,y:2,width:9,height:9}`であり、WARP-only差が残るためMotion行列は変更していない。

### Geometry / UV / texture findings

- CPU/Pixiのindices・vertex ordering・18 triangle topology（16 vertices）は一致し、`triangulationMatch=true`。差pixelはexternal boundaryまたはinternal shared edgeへ集中せず、全てtriangle interiorに分類された。
- 実Texture stateは`scaleMode=linear`、`antialias=false`、`wrapMode=clamp-to-edge`、`resolution=1`、`alphaMode=premultiply-alpha-on-upload`、source 18x18（1px padded）。
- 診断限定でUV offset `0`、`±0.5 texel`の9候補を比較した。offset `0`がidentity mappingを保持し、INTEGER/SUBPIXELとも候補中最小差だった。half-texel変更が一致を作る証拠はない。

### Classification and decision

分類は`G (C + A)`。`C`はCPUの明示premultiplied bilinear + byte rounding / CPU triangle bakeとPixi GPU linear Mesh sampling・source-overの実装差、`A`はNO WARP alphaのupload canonicalizationである。UV half-texel、topology mismatch、edge coverage単独の根拠は得られなかった。許容誤差・production UV/renderer/schema変更は行わず、WP-005を`ACTIVE / GPT review required`で停止する。次の修正を行うには、CPU authorityを維持したままPixi proxyの完全一致方式（GPU samplingのbyte parity、またはpreview equivalence policy）についてArchitecture Leadの判断が必要である。

### Verification

診断BrowserはChrome 152 / `680x561` / DPR `2.25` / console errors `0`。production runtimeは未変更のため、既存のharness・warp・animation verifierの再実行結果は前回PASSを継承し、今回の限定変更では`git diff --check`と診断ページ実行を追加確認する。Actual App UI、Owner操作感、trusted device pointercancelはこのsliceの対象外で未受入。

## Goal

旧Phase 9q A〜Dのmodel/Project/render/transaction資産を使い、Layer Transform WARPをCanvas直接操作へ接続する。

## Scope

読む: [Transformと評価順](../ARCHITECTURE.md)、[旧9q](../../task-codex/phase9q.md)のA〜D証拠とE条件。
候補変更file: `system/layer-transform.js`、`system/layer-system.js`、`ui/warp-grid-overlay.js`または既存BASIC overlayの隣接adapter、`ui/animation-table-popup.js`のLayer WARP bridge/marker、対象CSS/verifier。
READY化時に新規overlayの要否と正確なwrite範囲をleadが固定する。

## Contract

SOURCEはRaster bake、ANIMATEはClipInstance.layerDeformers。Simpleは4x4、非4x4を暗黙変換しない。
入場keyなし、previewは同じbaseline、確定History 1、cancel/no-opは0。
root/Folder WARP、Rig/Mesh/Skin/clipping排他とCPU/Pixi一致を維持する。

## Tasks

1. WP-002/003、WP-004、WP-007の前提を保持したまま、Simple 4x4 UIと既存transactionの限定接続を実装・検証する。
2. WARP tab、auto-fit 16点、pen hit、BASICとのmode移行を接続。
3. pointerupはgesture終了、cancel/capture喪失は定義済みgesture rollback、session継続を検証。
4. 同FrameのLayer Motion/WARPは単色丸一個、pending色も共用。
5. V close/Escape/Frame移動/Table close/save/export terminalを確認。

## Acceptance

- normal SOURCE、CAF SOURCE、CAF ANIMATEの対象と保存先が一致。
- 対象Rasterのみ変形し、旧非4x4、排他対象を明示拒否。
- preview/CPU/Bake/exportの固定入力結果一致とUndo/Redo/save/reopenが通る。
- 入場/無変更/取消のHistory 0、実変更確定1、丸KEY一個。

## Verification

`test warp`、`test transform`、構文/build、Browser 16点操作と実Pixi画素比較。
node配線testだけでproduction完成とはしない。

## Stop

新しいWARP保存model、永続SOURCE effect stack、static RIG移設、任意Mesh編集は対象外。
前提が未完なので、このカードを読んだworkerが直ちに実装を始めない。

## Completion

上記技術検証とOwner操作受入を記録してからDONEへ更新する。旧9qを形式だけcloseしない。
