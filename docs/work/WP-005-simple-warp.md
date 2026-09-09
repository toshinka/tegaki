# WP-005 — Simple 4x4 WARP UI

状態: ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING（2026-09-09）。今回のOwner Acceptance Continuation（WARP gesture retention / post-WARP BASIC envelope / reversible glass prototype）の技術sliceを完了した。開始HEAD: `2d6e461bf13a8bbc1d6b76cf2041b8684a63fb06`。

Layer TransformのBASIC/WARP切替、Simple 4x4の16点pointer adapter、normal/CAF SOURCEのRaster preview/bake、CAF ANIMATEの既存`layerDeformers` bridge接続を完了した。関連verifier・構文・Vite buildはPASSしている。normal SOURCEの実Browser操作、CAF ANIMATEの入場・preview・Esc・V確定・次Frame移動、Tableを閉じたCAF SOURCEのdrag・V確定、Table close rollback、pointer terminal、Pixi/CPU/export/save-reopenの技術証拠を確認した。trusted device pointercancelとOwner操作受入は未完了であり、Preview Equivalence Policyに従ってpackage statusはACTIVEとする。

## Owner Acceptance Continuation — gesture retention / BASIC envelope / glass prototype (2026-09-09)

### A. WARP gesture retention

`LayerTransformWarpController`へproductionの通常経路では無効な任意`onTrace` hookを追加した。hookはpointer identity、capture成否、normalized point、preview `ok/reason`、session point/change、overlay・transform session、Frame/internal Layerを受け取り、常時consoleへ出力しない。`pointerup`は最後のpreviewを保持し、`pointercancel`とpointerup前の`lostpointercapture`はgesture開始点へ戻し、pointerup後のlate lostは無視する既存契約を固定した。preview failureもrollback原因として残している。

interactive WARP overlayとpoint hit targetへだけ`touch-action:none`を追加した。document/bodyやCanvas全体のpointer policyは変更していない。`build/verify-layer-warp-gesture-retention.mjs`はdown→move A→move B→up、cancel/lost rollback、late lost retention、preview failure、trace順序、overlay再生成なし、CSS scopeを確認する。trusted physical pen/pointercancelの実頻度とOwnerの20 gesture受入はBrowser/Owner確認待ちであり、terminal semanticsを変更する判断はしていない。

### B. Post-WARP BASIC authoring envelope

`system/animation/layer-warp-authoring-envelope.js`のpure helperが、current evaluated Simple 4×4 WARPの`bindBounds`と16点をProject座標へ展開し、全点のmin/maxから表示用envelopeを作る。`LayerSystem._getLayerTransformWorldCorners()`はANIMATE Layer targetだけを`AnimationTablePopup` adapterへ問い合わせ、current Clip/internal Layer/local Frameを一致検証してからこのenvelopeを使う。WARPなし、unsupported、current sample不在、component delete後は従来source boundsへfallbackし、BASIC Motionは同じenvelopeへ従来どおりforward適用する。

`bindBounds`、WARP points、`layerTransformTracks`、`layerDeformers`、pivot、DrawingSnapshot、Project schema、CPU/Pixi rendererのauthorityは変更しない。`build/verify-layer-transform-basic-warp-envelope.mjs`でno-WARP、expanded、compressed、interior protrusion、translation/rotation/scale/flip、delete/restoreを確認する。

### C. Reversible glass surface prototype

既存themeのalpha surfaceを再利用する`--ui-panel-glass-surface`（alpha `.82`）と`--ui-panel-glass-backdrop`（`blur(3px)`）を追加し、Layer Transform outer surfaceとAnimation Table main surfaceへ限定適用した。Animation Tableのcanvas-context時にheader/viewport全体へ掛かっていた`opacity:.72`は除去し、foreground controlはopacity 1のまま保持する。配置、縮小、dock、auto-collapse、Timeline構造、z-index、pointer ownershipは変更していない。Browser G1/G2/G3、Canvas可視性、Timeline/KEY読解性、drag/preview/scroll性能、backdrop fallbackは技術確認とOwner受入を分離して記録する。

### Technical checkpoint / Browser boundary

- New verifiers: `verify-layer-warp-gesture-retention` PASS、`verify-layer-transform-basic-warp-envelope` PASS（production `LayerSystem` adapter boundary、16点 envelope、Motion corners、delete fallbackを含む）。
- Regression: harness check `31 documents / 139 local links / 25 proposals / 8 packages`; transform `17/17`; warp `27/27`; animation `34/34`; UI `45/45`; project `9/9`; all `169 selected / 0 failed`。Changed JS/MJS `node --check`、Vite production build、`git diff --check` PASS。Vite生成物はHEAD内容へ戻し、dist diffは0。
- Browser minimum: Chrome production `localhost:5173`, screenshot viewport `908×548`。G1 Layer Transform、G2 Animation Tableの配置維持、semi-transparent surface、foreground control/Timelineの可読性を確認した。現fixtureは空Rasterで、Layer TransformとAnimation Tableの同時表示（G3）、実WARP 20 gesture、BASIC envelope実制作、trusted physical pen/pointercancel、独立console計測は未確認。これらはOwner受入へ残し、technical passをOwner ACCEPTEDへ繰り上げない。

## BASIC + WARP authoring coordinate congruence (2026-09-09)

### Scope and cause

Owner報告の「BASICでLayer Motionを付けた後、WARPの16点とpointer hitだけが変形前に残る」を、保存値や評価順を変えずに修正した。原因は、WARP controllerが`bindBounds`と正規化点をMotion前worldへ戻さず直接overlay/inputへ使っていたことだった。

### Bounded implementation

- `LayerSystem.getLayerWarpAuthoringMotion()`を追加し、ANIMATEでは現在のLayer Transform transactionを`AnimationTablePopup`のproduction adapterへ渡す。
- adapterは現在Frameの`clip.layerTransformTracks`をsampleし、transactionのClip/internal Layer/Frameと一致しない場合は`layer-motion-frame-unavailable`を返す。古いFrameの行列へfallbackしない。
- `LayerTransformWarpController`はproduction `createCenteredTransformMatrix` / `applyTransformMatrix` / `invertTransformMatrixPoint`を使い、forwardは`WARP normalized → bindBounds world → current Layer Motion → screen`、inverseは`screen → world → inverse Motion → normalized`とした。
- `bindBounds`、WARP points、Motion tracks、deformers、History、保存schema、CPU/Pixi renderer、評価順、入口guardは変更していない。controllerはprojection-onlyでHistory `0`を保つ。

### Evidence

`build/verify-layer-transform-warp-motion-projection.mjs`はproduction controller/transform math/LayerSystemを実行し、identity、translation、rotation、scale、negative scale/flip、anchor付きcombined affineの6ケース×16点でforward/inverse roundtripをPASSした。関連production verifierは次のとおり。

- `verify-layer-transform-warp-motion-projection`: PASS
- `verify-layer-transform-warp-reentry-congruence`: PASS
- `verify-layer-transform-cross-frame-continuation`: PASS
- `verify-layer-transform-warp-entry-guards`: PASS
- harness: check `30/137/25/7`、transform `13/13`、warp `25/25`、animation `34/34`、ui `45/45`、project `9/9`
- changed JS/verifier `node --check`: PASS、Vite build: PASS、`git diff --check`: PASS。生成distはHEAD内容へ復元済み。

既存CAF Browser確認はChrome production IAB、viewport `908×548`、DPR `2.0249998569488525`、console error/warn `0`で、同Frame BASIC translation/rotation/scale後のWARP overlay、visible point hit、WARP KEY、F1→F2→F1を確認した。strict current-Motion source追補後の最小再確認は、save/reopen後に空のCAF snapshotでBASIC affine表示までとなり、Rasterが無くWARP入場を完走していない。これはOwner acceptanceへ算入しない。

### Boundary

ANIMATE WARP ready時のkey strip表示不一致（BASIC KEYがあっても`KEY未設定`と表示される既知UI論点）、Pixi/CPU pixel差、実PNG download、trusted pointercancel、Owner操作感は今回の対象外で未受入。判定は`PARTIAL / GPT review required`、WP-005は`ACTIVE — OWNER ACCEPTANCE BLOCKED`で停止する。

## Progress (2026-09-07)

- 実装差分: WARP tabを既存Layer Transform panelへ追加し、auto-fitされた4x4の16点とpointer gesture adapterを接続した。pointerdownでbaseline/capture、pointermoveでpreview、pointerupはgesture終了のみ、pointercancel/lost captureはgesture rollbackとしてsessionを継続する。
- normal SOURCE: 描画後にVで入場し、WARP表示（16点）・点ドラッグ・Esc取消・V確定をBrowserで確認した。変更確定はHistory `+1`、取消は`+0`、gesture中のpointerdown/upではHistoryを増やさない。確定後のUndo/Redoは各1回で元画像/変形画像へ戻る。変更中のBASIC切替はWARPに留まり、暗黙commitしない。console errorは確認されなかった。
- CAF ANIMATE: 2Frame CAFを実Browserで選択し、`ANIMATE · F1 READY`、4x4/16点表示、点drag後の`ANIMATE · F1 WARP KEYED`、Esc取消を確認した。確認時Historyは変化せず、V確定・Frame移動・Table close後の再現は未受入である。
- 追加修正: 初回WARP入場時の既存transform anchor初期化を先に行い、未変更BASIC sessionの誤検出でWARP entryが拒否される経路を除去した。source previewの比較基準は現在候補ではなくsession開始時baselineとしたため、移動して元へ戻す操作はno-opになる。bridge再描画中もWARP transactionが生きている間はoverlayを維持する。
- 追加追補: CAF ANIMATEのWARP bridge previewが予約する`AnimationTablePopup.render()`は、高度WARP GRID用判定に失敗すると共有`warpGridOverlay`をdeactivateしていた。`getLayerWarpEditSession()`とLayer Transformの`warp` modeが生きている間はcleanup対象から除外する局所guardを追加した。修正後の実Browserで、点drag後も16点と`ANIMATE · F1 WARP KEYED`が維持され、V確定でTableへ戻りHistoryが1件増え、次Frameへ移動できた。Tableを閉じたCAF SOURCEでも`SOURCE · WARP`のdrag→V確定を確認した。両方ともconsole errorは0件。IABではChrome version/DPRは取得できなかった。
- 技術確認: `test warp` 20/20、`test transform` 13/13、`test animation` 34/34、`test project` 9/9、専用WARP verifier 4件、harness check、構文確認、`git diff --check`をPASS。今回production JSは変更していないため、Vite production buildは前回のguard変更時PASSを継承し、再実行していない。Browser確認はOwner受入とは分離する。
- Table close terminal: 2Frame CAF ANIMATEで、元KEYなしの`pending→close`はHistoryをduration変更分から増やさず、close後overlayを0へ戻し、再open時に`F1 · KEY未設定`／`READY`へ戻った。元KEYありでは一度`History +1`で確定したF1のpointsを基準に別位置のpendingを作り、close後に元pointsと`WARP KEYED`を再現し、追加Historyを作らなかった。狭いIABではclose buttonのEnter起動、viewport 1280x720のIABでは同じpendingと実pointerup保持を確認した。model authority直読はBrowser隔離のため、`hide()`のcancel-before-hide順序を`verify-layer-transform-warp-ui.mjs`で固定し、既存transaction verifierと分離して記録した。
- Pointer terminal: `verify-layer-warp-pointer-terminal.mjs`でproduction `LayerTransformWarpController`をinstantiateし、Gesture Aのpointerup保持、Gesture Bのpointercancel rollback、capture loss rollback、pointerup後late loss保持、History/finish 0を固定した。`build/wp005-pointer-terminal-diagnostic.html`ではproduction `WarpGridOverlay`のDOM listenerへsynthetic `PointerEvent`をdispatchし、NORMAL SOURCE／CAF ANIMATEの両方で同じ結果をBrowser確認した。IAB診断はviewport 1280x720、DPR 2.25、console errors 0。trusted device由来のpointercancelは未検証として残す。
- Owner受入待ち: trusted device pointercancel、非4x4/排他対象のOwner実画面確認、Owner操作感、production UIからの実download。CPU/export/save-reopenと非4x4/排他対象の技術検証はFinal evidenceで完了している。

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

## Preview Parity Convergence Gate (2026-09-07)

### Motion-only baseline

baseline HEADは`061d9e93f6a3aecc9b55d148ed177190dfa67aef`。既存差分を保持し、production runtimeは変更していない。追加diagnosticは`build/wp005-preview-convergence-diagnostic.html`。

同じ16x16 asymmetric fixtureでLayer Motionだけを比較した。

| case | CPU | Pixi | diff / max | CPU bbox | Pixi bbox |
| --- | --- | --- | ---: | --- | --- |
| integer opaque | `0xf8d32585` | `0x4df056b3` | 3px / 255 | `{x:4,y:4,w:13,h:11}` | `{x:3,y:2,w:14,h:13}` |
| integer alpha | `0x2f2030ea` | `0x06e245ab` | 3px / 255 | `{x:4,y:4,w:13,h:11}` | `{x:3,y:2,w:14,h:13}` |
| subpixel opaque | `0x27ec05e7` | `0xfd6c1212` | 23px / 255 | `{x:4,y:4,w:14,h:12}` | `{x:3,y:2,w:15,h:14}` |
| subpixel alpha | `0x4e2ee189` | `0x86950156` | 23px / 255 | `{x:4,y:4,w:14,h:12}` | `{x:3,y:2,w:15,h:14}` |

integerの最初の差は`(3,2)`でCPU `[180,20,35,255]` / Pixi `[0,0,0,0]`。Motion-onlyにもopaque差があるため判定は`M1`であり、WARP Meshだけの問題（M0）ではない。

### CPU-reference prototypes

- WARP-only: CPU final `0x17a134da`、current production Mesh Pixi `0x63f4c1ac`（9px / max102）。CPU WARP surfaceをPixi Sprite化したprototypeは`0xe6d751d6`（7px / max102）。CPU/PixiのbboxとnonTransparentは一致し、残差は半透明RGBのupload canonicalization相当だった。
- WARP + Motion: CPU final `0x8525007f`、current Pixi `0xf73d350c`（9px / max196）。P1（CPU WARP surface → Pixi Motion）は`0xc90ee9b6`（7px / max196）で、Mesh由来の差は減るがbbox差が残った。
- P2（CPU compositorでWARP + Motionまでfinal surface → Pixi Sprite）は`0x734812cb`（4px / max102）。CPUとbbox/nonTransparentが一致し、代表差は`[181,20,34,207]`対`[180,20,34,207]`でalpha同値のRGB差だった。P2はgeometryを収束させるが、生成された半透明edgeのupload canonicalizationは残る。

### Performance evidence

warmup 3回後30サンプル。数値は`median / p95 / max`のmsで、正式なframe-time閾値は設定していない。`Texture.from`はdescriptor計測で、GPU uploadはrenderer.render時に発生する。

| size | CPU render | Canvas/ImageData | Texture.from | Pixi render | total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 344x135 | `13.4/15.4/17.7` | `0.2/0.4/0.5` | `0/0.1/0.2` | `0.3/0.5/0.5` | `14.1/16.1/18.4` |
| 512x512 | `76.5/81.7/89.9` | `0.6/0.8/2.3` | `0.1/0.1/0.2` | `0.3/0.4/0.5` | `77.4/83.2/92.7` |
| 1024x1024 | `284.4/294.8/306.4` | `1.5/3.6/6.0` | `0.1/0.1/0.1` | `0.3/0.5/0.5` | `286.5/299.9/310.5` |

512x512の30 update dragはtotal `73.0/83.8/85.0ms`、CPU `72.1/82.6/83.3ms`、Pixi render `0.2/0.4/0.4ms`。tracked Texture/RenderTexture balanceは`0/0`、console errors `0`、JS heapは`77,513,690→60,574,826` bytes（delta `-16,938,864`）だった。メモリ増加やtracked leakは見られないが、GC spike・正式性能閾値は判定していない。1920x1080はこの限定gateでは実行していない。

### Classification and stop

分類は`P-B`。Motion-onlyもM1で、WARP MeshとMotion GPU sampling双方に差がある。P2 full CPU-reference surface → Pixi Spriteでgeometryは収束し、残るのは半透明upload canonicalizationである。512x512以上はCPU renderが明確に重いため`P-D risk`を併記するが、性能仕様や許容閾値は決めない。CPU-reference previewをproductionへ導入せず、現行Pixi Meshを削除せず、許容誤差policy・schema・History・Layer WARPを変更しない。この差は2026-09-08のPreview Equivalence Policyでpreview implementation differenceとして分類し、WP-005のtechnical blockerから外す。WP-005は`TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`で停止する。

### Verification

full convergence Browser gateはChrome 152 / `680x561` / DPR `2.25` / console errors `0`。新規diagnostic module parse、既存harness/warp/animation verifier、`git diff --check`を実行する。Actual App UI、Owner操作感、trusted device pointercancelは未受入。

## Technical closure — Preview Equivalence Policy (2026-09-08)

### Authority decision

- **Pixel authority:** CPU compositor、normal/CAF SOURCE bake、Export、Projectのcanonical data。
- **Interactive preview:** Pixi GPU proxy。CPU authorityと同じevaluated model、target/frame、control points、topology、bind bounds、Layer WARP key sample、Layer Motion sample、transform matrix、effect evaluation order、visibility、opacity/blend authorityを使う。
- **Pixel equality:** CPU / Bake / Export / save-reopenのcanonical resultは一致させる。Pixi previewは同じmodel state・geometry・evaluation orderを使うが、GPU/CPU rasterizer、filtering、premultiplied-alpha由来のbyte差をpreview implementation differenceとして分離する。
- **Tolerance:** 数値epsilon、最大差、差pixel数などの固定許容閾値は導入しない。
- **Performance:** pointermove中の連続CPU final renderは採用せず、現行Pixi GPU proxyを維持する。CPU-reference prototypeは技術証拠としてのみ扱い、productionへ導入しない。
- **Persistence/output:** preview pixelを保存正本にしない。save/reopenとExportの検証はcanonical CPU/final dataで行う。

### Technical completion

既存のnormal SOURCE、CAF SOURCE、CAF ANIMATE、Simple 4x4、排他zero-mutation拒否、V History `1/0`、Timeline marker、pointer terminal、Table close rollback、Project save/reopen、CPU/export consistencyの証拠を技術PASSとして扱う。Pixi byte parityはtechnical blockerとして残さず、上記policyへ分類した。production runtime、保存schema、History契約、現行Pixi Meshは変更していない。

判定は`WP-005 TECHNICALLY COMPLETE`、package statusはOwner受入まで`ACTIVE`とする。trusted device由来のpointercancelはsynthetic DOM検証をtrusted PASSへ昇格せず、`NOT VERIFIED`のままOwner確認項目へ残す。

### Owner acceptance checklist

- **normal SOURCE:** WARP入場、16点drag、V、Undo、Redo、Esc cancel。
- **CAF SOURCE:** `SOURCE · WARP`、drag、V、CAF close/reopen後の結果維持。
- **CAF ANIMATE:** `READY`、drag、明示KEY confirm後の`KEYED`継続、F2/F1再現、V、Table close rollback。
- **Export:** pending WARPからExportが`pending-layer-transform`で止まり、V確定後またはEsc後に成功すること。
- **Actual output:** production UIからPNGを最低1回downloadすること。
- **Preview fidelity:** point drag中のPixi previewが制作判断を妨げるほどずれて見えないこと、V確定・再生・Exportの切替で実用上不自然な跳ねがないこと。問題があれば別WP候補として記録し、WP-005のauthority/schemaは再設計しない。

### Owner acceptance gate — 本体UIでの具体操作

専用diagnosticやmock UIではなく、通常のproduction相当アプリを開いて確認する。開始時にbrowser/version、viewport、DPR、console errorsを記録し、Ownerの操作感はCodexが代判定しない。

1. **normal SOURCE**
   - 隔離ProjectでL字・点・小矩形などの非対称Rasterを1つ描く。
   - `V` → `WARP` → 16点表示を確認し、1点を大きくdrag → pointerup → 別の点をdragする。
   - pointerupだけではsessionが閉じず、16点overlayが残ることを確認する。
   - `Esc`で開始時へ戻り、Historyが増えないことを確認する。
   - 別sessionで `V` → `WARP` → drag → `V`。Rasterへ確定し、Historyが`+1`、sessionが終了することを確認する。
   - `Undo` / `Redo`で変形前後へ戻ることを確認する。
   - Ownerは点を掴みやすいか、移動量が直感的か、previewが重くないか、V/Escが自然かを`OWNER ACCEPT`または`OWNER CONCERN`で記録する。

2. **CAF SOURCE**
   - CAFのinternal Rasterを選択し、`SOURCE · WARP` → 16点 → drag → `V`を実行する。
   - 対象internal Rasterだけが変形し、Historyが`+1`、working LayerだけでなくCAF原画へ反映されることを確認する。
   - Animation Tableを閉じていた場合は再open（またはCAF再選択）し、確定結果が維持されることを確認する。

3. **CAF ANIMATE（最低2 Frame）**
   - F1でinternal Rasterを選択し、`V` → `WARP`。表示が`ANIMATE · F1 READY`、16点表示になることを確認する。
   - drag後に`ANIMATE · F1 WARP 未確定`となり、drag中も16点overlayが消えないことを確認する。
   - 明示KEY confirmでHistoryが`+1`、F1 keyと単色丸markerが確定し、panel、V、WARP、16点が残って`KEYED`になることを確認する。
   - arrowまたはstrip wheelで`F2`へ移動し、F2で同じくdrag→明示KEY confirmを行う。`F2 → F1`でF1のWARP結果とmarkerを再現し、F1へ再入場せず既存WARPを表示することを確認する。
   - stable `KEYED`で`V`を押すとHistoryを増やさずpanelとoverlayだけが終了し、確定keyが残ることを確認する。

4. **Table close rollback**
   - F1 → `WARP` → drag → Table closeを1ケース実施する。
   - pending変更が取消され、History`+0`、overlay消失となることを確認する。
   - 再open後、元KEYなしなら`READY`/keyなし、元KEYありなら元KEYが保持されることを確認する。

5. **Export terminal**
   - pending WARP中に `drag` → `Export`。`pending-layer-transform`で停止し、session、変形候補、History、Frameが変わらないことを確認する。
   - confirm pathは `V` → `Export` が成功することを確認する。
   - cancel pathは別sessionで `drag` → `Export` block → `Esc` → `Export` が成功することを確認する。

6. **実PNGとpreview fidelity**
   - production UIの通常ExportからPNGを1回downloadし、file生成・画像を開けること・Canvas内容が出ることを確認する。
   - CAF ANIMATE WARPで変形量が分かるdragを行い、drag中Pixi previewとV確定後/F1再評価結果を見比べる。
   - Ownerへの質問は「制作判断を妨げるほど見た目が跳ねる・ズレるか」の一つだけとし、`ACCEPT` / `CONCERN` / `NOT JUDGED`とコメントを記録する。数pxの技術値は判定基準にしない。

7. **任意の追加確認**
   - 実pen/deviceで自然なpointercancelを確認できた場合だけ`TRUSTED POINTERCANCEL VERIFIED`と記録する。確認できなければ`NOT VERIFIED`のままでよく、これだけでclosureをblockしない。
   - UI準備が容易なら非4x4またはRIG/Mesh/Skin/clippingの代表1〜2件で、WARPへ入れず変な16点overlayが出ないことを見る。複雑なfixtureは新規作成しない。

Owner ACCEPTの条件は、normal SOURCE、CAF SOURCE、CAF ANIMATE、Export block/retry、実PNG download、preview fidelityにblocking issueがないこと。機能バグ（overlay消失、V未確定、wrong layer、History`+2`、Table close残留、Export bypass、download失敗）があれば`OWNER ACCEPTANCE BLOCKED — BUG`として操作と再現を記録し、その場で大規模修正へ進まない。previewの見た目だけが問題なら`PREVIEW FIDELITY FOLLOW-UP REQUIRED`として別WP候補に止める。

## Re-entry Congruence Repair — 2026-09-08

### Cause and bounded fix

F1で一度確定したLayer WARPをEsc後に再入場すると、Timeline markerは残るのに`READY / KEY未設定`と矩形baselineになる症状を、選択internal Rasterとactive working Layerを意図的にずらしたproduction bridge fixtureで固定した。marker側は選択中internal Layer IDを読み、WARP開始側はactive working Layerから逆引きしたinternal Layer IDを読むため、同じClip / Frameでもdeformer lookupが分岐していた。

`tegaki_work/ui/animation-table-popup.js`の限定修正では、ANIMATE Layer開始時に選択internal Rasterからworking Layerを逆引きし、Layer Transform transaction、preview target、`targetLayerIds`、active Layerを同じIDへ揃える。WARP markerとbridgeのdeformer lookupは同じClip、internal Layer ID、Clip-local Frameを基準にし、state/context IDが不一致なら開始を拒否する。新しい保存正本、schema migration、History framework、CPU/Pixi renderer、Folder/RIG/Mesh/clipping authorityは追加していない。

### Evidence

新規`tegaki_work/build/verify-layer-transform-warp-reentry-congruence.mjs`は、production `LayerSystem.enterLayerMoveMode()` / `beginLayerWarpEditSession()`、production popup bridge/context、既存pure WARP transactionを実行する。P0〜P6は次の通り。

| checkpoint | 操作 | 技術結果 |
| --- | --- | --- |
| P0 | stale activeを残したV → WARP | selected `internal-a`へactive `working-a`を同期、既存F1 keyを読む |
| P1 | point drag A | 同じ`internal-a`へcandidateを投影 |
| P2 | explicit KEY confirm | History `+1`、同Frame fresh WARP、`hadExplicitKey=true` |
| P3 | second point drag B | committed Aをbaselineにpending B |
| P4 | Esc | B rollback、History追加`0`、A key/marker保持 |
| P5 | full teardown → stale active再設定 → V | 再び`working-a`へ同期 |
| P6 | WARP再入場 | `internal-a`、KEYED guide、A points baselineを再現 |

Verifier outputは全checkpointでmodel keyを保持し、transaction targetとmarker targetを一致させた。既存`test warp` 24件、`test transform` 13件、`test animation` 34件、harness check、構文、Vite production build、`git diff --check`もPASSした。Vite生成distは復元し、意図した差分だけを残している。

### Boundary

このVerifierはproduction class/methodとisolated hostを使う技術証拠であり、実Raster drag、実ブラウザでのF1再入場、実PNG download、Ownerの操作感を代替しない。Chrome production appは通常UIの起動とLayer Transform入口の表示までを確認したが、今回の再入場手順はOwner受入へ残す。WP-005は`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`を維持し、OwnerがF1 `KEYED → drag → Esc → V → WARP`で確定形を確認するまでcloseしない。

## WP-008 handoff boundary

WP-008のread-only成果は[progressive controls audit](WP-008-progressive-controls-design-audit.md)と[Astra/GUI handoff draft](../handoffs/WP-008-astra-progressive-controls-request.md)に分離した。可変GRID、RADIAL/FREE mesh、Bind/Cage、LENS、MOVE/INFLATE/PINCH/SMOOTH brushの現行Workspace能力と、Layer Transformへ再利用する場合のR1〜R5分類、authority、animation/export/saveの判断待ちを記録した。WP-005 Owner受入・GPT review前にWP-008 production implementationやschema変更へ進まない。

このclosure後はsession境界抽出、別WP、許容誤差policy、CPU continuous preview、Pixi renderer/schema変更へ進まず、GPT reviewとOwner acceptanceで停止する。

## Final Interaction Safety Slice — WARP Canvas drag isolation / Anchor audit — 2026-09-09

### Root cause and bounded fix

WARP mode中のCanvas空白領域dragがBASIC Layer Motionを生成する症状は、`tegaki_work/system/layer-transform.js`の`_setupDragEvents()`が`isVKeyPressed`と左buttonだけでBASIC body gestureを開始していたことが原因だった。WARP pointは`LayerTransformWarpController`と`WarpGridOverlay`が別のpointer pathで処理するため、point以外のCanvas面だけがBASIC `onDragRequest`へ落ち、BASIC/WARP pendingが混在し得た。

入口条件へ`this.transformMode === 'basic'`を追加する一行の修正に閉じた。これによりBASIC body dragは従来どおり動作し、WARP body dragはgesture開始・`preventDefault`・BASIC mutationを行わない。WARP pointのpreview、pointerup、pointercancel、lostpointercapture、forward/inverse Motion projection、panel/table/camera入力は変更していない。WARP body dragをBASIC Motionとして正式採用する統合仕様や、mixed History commandは今回の対象外である。

### Verifier and Browser evidence

新規`tegaki_work/build/verify-layer-transform-warp-body-drag-isolation.mjs`は、production `LayerTransform._setupDragEvents()`へfake Canvasだけを接続し、BASIC body dragの`onDragRequest`、WARP body dragの無起動、production `LayerTransformWarpController`のWARP point previewを確認した。WARP body経路では`dragPointerId`が設定されず、fake `getLayerMoveCommitState().hasPendingTransform`もfalseのまま、point経路はpreviewだけを実行する。結果はPASS。

近隣回帰としてmotion projection（6 affine cases × 16 points）、cross-frame continuation、WARP re-entry congruence、pointer terminalもPASS。harnessはcheck `30 documents / 137 links / 25 proposals / 7 packages`、transform `13/13`、warp `26/26`、animation `34/34`、ui `45/45`、project `9/9`がPASSした。変更JS/verifierの構文確認、Vite production build、`git diff --check`も完了し、生成dist差分は残していない。

Chrome production UI（localhost:5173、CUA screenshot `908×548`、DPR `2.025`、console error/warn `0`）では、CAF ANIMATEの`V → WARP`で空白body dragを行ってもRaster全体、WARP points、status、Historyは変わらなかった。その後のcontrol-point dragは`ANIMATE · F1 WARP 未確定`へ進み、明示KEYで`WARP KEYED`、Timeline WARP marker、panel/V/WARP保持、History `+1`を確認した。BASICへ戻ったbody dragはpending previewを生成し、EscapeでHistory追加なく取消した。SOURCEのanchor iconは有効表示、CAF ANIMATEでは無効表示だった。実PNG download、trusted device pointercancel、Ownerの制作操作感は未受入である。

### Anchor / pivot design boundary

現行ANIMATE Layer Motionの`layerTransformTracks.pivotX/pivotY`はtrack-globalで、Frame keyはx/y/scale/rotationのみを持つ。既存のframe-local pivot schemaはなく、sampler/compositorはtrack pivotを全FrameのAffine matrixへ使うため、pivot変更は既存全keyの見た目へ影響する。見た目を維持する一括rebaseは全keyのx/y等を補正する新しいtransactionが必要で、現在のLayer Motion transaction・History・再評価境界から安全に導けない。copy/paste、retime、save/loadはtrack pivotを保持する既存serializationを使うが、pivot rebase semanticsは未定義である。従ってANIMATEの`allowAnchorEdit`を有効化せず、SOURCE anchorとANIMATE pivotを同じ編集UIへ昇格しない。

Ownerのpivot preset案（中心軸アイコンON時だけ`キャンバス中央` / `対象中央`を表示）はWP-008の設計材料へ移した。これはTransform全体Resetではなく中心軸だけの候補であり、BASICの対象中央はcontent bounds、WARPの対象中央はcurrent bind bounds / WARP範囲という意味差を明示する。表示位置、icon/text、open direction、narrow layoutはAstra/Owner判断待ちで、production実装は行わない。

### Boundary

このsliceはWARP body gestureのownershipを既存mode文法へ戻す局所修正であり、BASIC/WARP統合gesture、ANIMATE anchor、pivot schema、Layer Motion authority、WARP schema、evaluation order、CPU/Pixi renderer、History framework、WP-008 production implementationを変更していない。技術証拠はPASSだが、Owner ACCEPTED / DONEには昇格せず、WP-005は`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`でGPT reviewへ返す。

## Owner Acceptance Fix Slice — ANIMATE WARP Live Preview + Explicit Confirm (2026-09-08)

### Reopen reason

Ownerのproduction再現で、CAF ANIMATE / internal Rasterの`V → WARP`中に16点グリッドは動くがmain canvasのRasterが変形しなかった。statusは候補段階でも`KEYED`になり、明示KEY確定controlは見えなかった。これはPreview Equivalence Policyのbyte差ではなく、interactive previewが表示されないUI/runtime不具合なので、Owner acceptanceを一時的にblockedとして技術再開した。

### Cause and bounded fix

- `_previewLayerWarpBridge()`は既存の`ClipInstance.layerDeformers`へ候補を投影して`render()`を予約するが、`isTransformPreviewSuspended`中の通常`render()`はworking Layerを復元していた。そのため、既存のPixi RenderPlan / Mesh deformer previewがmain canvasへ届かなかった。
- 候補の`PREVIEW` actionを`hasExplicitKey`へ使っていたため、元KEYなしでも`KEYED`表示になっていた。WARP transaction自身の`hadExplicitKey`を正本にし、`keyGuide.pending`を分けた。
  - 当時のWARP明示確定buttonは既存V WARP terminalへ委譲していた。このterminal意味論は後述のFinal Owner UX Fixで、明示KEY confirmだけcommit-and-continueへ変更した。基底Layer Transform bridgeはno-opで解放され、History二重化を作らない。
- active ANIMATE Layer WARPだけ`_applyVisibilityPreview({ force: true })`を使う。PREVIEW toggleがOFFでも編集対象のlive visualを表示するが、CPU連続preview・保存正本・Export authorityは変更しない。
- Timelineのinternal Raster rowはpending中にbaseline `layerDeformers`を読む。元KEYは残し、新規候補だけではsolid markerを表示しない。確定後はmodelの既存keyframeからsolid markerを表示する。

### Verification and current status

`build/verify-layer-transform-warp-animate-live-preview.mjs`を追加し、WARP候補の`READY → 未確定`、既存KEYの`KEYED → KEYED · 未確定変更`、cancel/confirmのtransaction、Pixi preview分岐、Vと同じexplicit terminal、Timeline marker baselineを隔離検証した。関連suiteはwarp 22件、transform 13件、animation 34件、project 9件が全件PASS。構文、harness check、Vite production build、`git diff --check`もPASS。生成`dist`はHEAD内容へ戻している。

production UI（localhost:5173、viewport `905×609`、DPR `2.025`）では、CAFを2 Frameへ延長してLayerを選択し、`V → WARP`で`ANIMATE · F1 WARP READY`、16点、`F1 · KEY未設定`のKEY strip、console error/warn 0件を確認した。pointer dragでmain canvasが追従すること、pointerup保持、明示button/VのHistory +1、Esc/table close rollback、既存KEY再編集、Export block/retry、PNG download、Owner操作感は未受入である。したがってWP-005は`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`へ戻し、Owner確認後にのみ受入を更新する。

## Final Owner UX Fix — WARP KEY continuation / Frame step alignment (2026-09-08)

### Bounded contract

- **明示KEY confirm:** pending WARPを既存WARP bridgeでcurrent FrameへHistory `+1`だけ確定し、panel、V、WARP、16点、Canvas結果を維持する。同Frameの新しいstable WARP sessionは確定済み`ClipInstance.layerDeformers`をbaselineとする。
- **V / Esc:** 既存terminalを維持する。stable VはHistory `0`で終了し、pending Vは既存どおり確定して終了、Escはcandidateだけをrollbackして終了する。
- **Frame step:** stable WARPは既存WP-003 moverを通ってprev/next/strip wheelで移動し、target Frameのmodelからfresh WARP sessionを開始する。pending中はFrame、candidate、History、overlayを変えず拒否する。
- **Undo / Redo:** old WARP bridgeをfinishせずabandonして復元済みmodelからfresh sessionを開始する。復元済みkeyへold baselineを戻さない。

### Implementation and evidence

`system/layer-system.js`へWARP専用のresume、commit-and-continue、stable Frame-step、History refresh helperを追加した。`ui/animation-table-popup.js`はWARP HistoryのUndo/Redo時だけbridge所有権をabandonするadapterを追加した。新しい保存writer、History command、schema、CPU/Pixi authority、Export guardは追加・変更していない。

`verify-layer-transform-warp-key-continuation.mjs`は、confirm `+1` / no-op `0`、fresh baseline後のEsc、stable step `0`、pending step拒否、Undo/Redo refreshをproduction methodから隔離実行する。更新したlive-preview verifierとWP-003 continuation verifierも通過した。harnessはwarp 23件、transform 13件、animation 34件、project 9件、harness check、構文、Vite build、`git diff --check`がPASS。

実production UIでは、新規3 Frame CAFで`F1 → F2 → F3 → F2 → F1`を実行し、各Frameでpanel、V、WARP選択、KEY stripを維持した。stable WARPのV終了も従来どおり確認した。CUAのBrowser入力にはCanvas point dragを注入する経路がないため、実Rasterをdragして明示KEY confirmする連続flowはOwner recheckへ残す。Owner受入前の状態は`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`である。

## Owner Acceptance Block — F1 re-entry after Esc (2026-09-08)

Chromeの通常production UI（`http://localhost:5173/`）で、CAF1・Layer 1・5FのF1を使用した。F1で`V → WARP`へ入り、画面上で見えるcontrol pointをdragすると`ANIMATE · F1 WARP 未確定`になり、CanvasのRaster変形と16点overlayを確認できた。明示KEY confirm後は`ANIMATE · F1 WARP KEYED`、F1 marker、panel/V/WARP維持、History `9/500 → 10/500`を確認した。

別の見えるpointをdragして`ANIMATE · F1 WARP KEYED · 未確定変更`にし、Escを押すと、panelが閉じ、Historyは`10/500`のまま、F1 markerと確定visualが残った。しかし同じF1へ再度`V → WARP`で入場すると、期待する`KEYED`ではなく`ANIMATE · F1 READY`、KEY stripは`F1 · KEY未設定`になった。Timelineには`Layer WARP key: Frame 1` markerが残る一方、16点は確定後の形ではなく矩形baselineを表示した。console error/warningはこのCUA確認では取得していない。

これは最新確定keyの再評価・status・marker・control-point stateが分離するblocking bugである。production JS、保存schema、harness statusは変更せず、WP-005を`ACTIVE — OWNER ACCEPTANCE BLOCKED`としてGPT reviewへ返す。原因調査・修正、WP-008、session extractionはこのgateで開始しない。

## WP-005 / WP-003 Cross-frame continuation repair — 2026-09-09

### Cause and bounded fix

Layer Transform session中のTimeline直接クリックが共通のcontinuationを通らず、`model.setCurrentFrame()`だけを更新していた。current Frameとtransaction/target/working Layer/panelのFrameが分離し、KEY確定後に次Frameを編集できない、またはWARP guardが旧Frameを読む症状につながっていた。

`tegaki_work/system/layer-system.js`に`moveLayerTransformTimelineFrameTo()`を追加し、同じClip内のstable BASIC/WARP sessionを一Frameずつ既存resume経路へ通す。pending transform、session divergence、clip外、invalid frameは拒否する。`tegaki_work/ui/animation-table-popup.js`ではprev/next、Timeline header/background/cell、motion markerをactive timeline transform時にこの境界へ寄せ、pending時に通常のraw frame moveへfall-throughしない。

### Evidence

- `tegaki_work/build/verify-layer-transform-cross-frame-continuation.mjs`は実production methodでBASIC/WARPを確認し、KEY confirm `+1`、direct destination fresh rebind、existing destination key、pending block、Esc後通常移動、frame move `0`をPASSした。
- 関連 transform 13、warp 24、animation 34、ui 45 verifier、harness check、Vite production build、変更JS構文、`git diff --check`はPASS。生成distはHEADへ復元した。
- 既存`verify-layer-transform-warp-reentry-congruence.mjs`はP0-P6をPASSし、project suite 9/9もPASSした。Undo/Redoのbridge refreshとProject roundtripは既存経路の回帰として確認済みだが、この限定sliceでF6/F7二keyを作った後の実save/reopen操作は追加実施していない。
- localhost production Browser（viewport `905×546`、DPR `2.025`、console error/warn 0）では、BASICの`F1 KEYED → F2 READY → direct F3 READY`、pending direct move拒否、Escapeを確認した。WARPの`F3 KEYED → F2 READY → direct F1 READY → existing F3 KEYED`、panel/V/WARP/16点維持、WARP pending direct move拒否も確認した。
- 追加7Frame CAFのproduction UIでは、実Raster BASICをF6/F7で別々にdrag・explicit KEY確定し、各History `+1`、F6/F7の`KEY設定済み`再訪、panel維持を確認した。WARPは既存F3の実point KEY確定とF3→F2→F1→F3再評価、pending direct move拒否まで確認し、F6/F7の別形状dragはOwner/GPT再確認へ残す。
- 追加Browser操作では、F6にBASIC keyが既にある状態でもWARPの16点previewへ入場できたが、point drag後のchip/key stripが`ANIMATE · F6 KEYED` / `F6 · KEY確定`（WARP表記なし）のまま、WARP explicit confirmでHistoryが進まなかった。この同Frame BASIC+WARP UI状態はcross-frame修正の対象外として変更せず、別のGPT/Owner確認事項へ記録する。WARP guardを弱める対応はしていない。

### Boundary

今回の変更はcross-frame navigation boundaryとその限定verifierだけで、保存schema、History authority、CPU/Pixi renderer、WARP guard、Folder/RIG/Mesh/clippingを変更していない。Browser確認は技術的なproduction UI証拠であり、Ownerの実Raster制作操作感、実PNG download、trusted device pointercancelを代替しない。WP-005は`ACTIVE — OWNER ACCEPTANCE BLOCKED`のままGPT/Owner reviewへ返す。

## Goal

旧Phase 9q A〜Dのmodel/Project/render/transaction資産を使い、Layer Transform WARPをCanvas直接操作へ接続する。

## Scope

読む: [Transformと評価順](../ARCHITECTURE.md)、[旧9q](../../task-codex/phase9q.md)のA〜D証拠とE条件。
候補変更file: `system/layer-transform.js`、`system/layer-system.js`、`ui/warp-grid-overlay.js`または既存BASIC overlayの隣接adapter、`ui/animation-table-popup.js`のLayer WARP bridge/marker、対象CSS/verifier。
READY化時に新規overlayの要否と正確なwrite範囲をleadが固定する。

## Contract

SOURCEはRaster bake、ANIMATEはClipInstance.layerDeformers。Simpleは4x4、非4x4を暗黙変換しない。
入場keyなし、previewは同じbaseline、確定History 1、cancel/no-opは0。
root/Folder WARP、Rig/Mesh/Skin/clipping排他を維持する。CPU final authorityとPixi GPU proxyは同じevaluated model / topology / effect orderを使うが、byte parityを要求しない。

## Tasks

1. WP-002/003、WP-004、WP-007の前提を保持したまま、Simple 4x4 UIと既存transactionの限定接続を実装・検証する。
2. WARP tab、auto-fit 16点、pen hit、BASICとのmode移行を接続。
3. pointerupはgesture終了、cancel/capture喪失は定義済みgesture rollback、session継続を検証。
4. 同FrameのLayer Motion/WARPは単色丸一個、pending色も共用。
5. V close/Escape/Frame移動/Table close/save/export terminalを確認。

## Acceptance

（technical closure: Preview Equivalence Policyに基づく受入条件）

- normal SOURCE、CAF SOURCE、CAF ANIMATEの対象と保存先が一致。
- 対象Rasterのみ変形し、旧非4x4、排他対象を明示拒否。
- CPU compositor / SOURCE bake / Export / Project save-reopenのcanonical pixel resultが一致する。
- Pixi interactive previewは同じevaluated model、topology、transform data、effect orderingを使うGPU proxyとし、GPU/CPU rasterizer間のbyte完全一致を必須にしない。
- 入場/無変更/取消のHistory 0、実変更確定1、Timeline marker契約、terminal契約を満たす。
- 数値epsilonや固定pixel許容閾値を受入条件に導入しない。

## Verification

`test warp`、`test transform`、構文/build、Browser 16点操作と実Pixi画素比較。
node配線testだけでproduction完成とはしない。

## Stop

新しいWARP保存model、永続SOURCE effect stack、static RIG移設、任意Mesh編集は対象外。
前提が未完なので、このカードを読んだworkerが直ちに実装を始めない。

## Completion

技術検証とPreview Equivalence Policyの文書化は完了し、WP-005は`TECHNICALLY COMPLETE`とする。Ownerの制作受入（通常SOURCE / CAF SOURCE / CAF ANIMATE / Export / 実download / preview fidelity）が完了するまでpackage statusは`ACTIVE`を維持する。旧9qを形式だけcloseしない。
