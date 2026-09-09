# Tegaki — 再開checkpoint

状態: WP-001 / WP-002 / WP-003 / WP-004 / WP-006 / WP-007 DONE（Owner操作感は未確認）。WP-005 ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING。WP-009 ACTIVE — TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。
更新日: 2026-09-09。現在の実HEAD: `2d6e461bf13a8bbc1d6b76cf2041b8684a63fb06`。開始時worktreeはclean。reset/clean/stashは行わず既存履歴を継承する。
現在地はこの文書だけが所有する。旧Phaseの自動継続指示より優先する。

## CURRENT OBJECTIVE

WP-005 Owner Acceptance ContinuationのA/B/Cを限定実施する。WARP gestureのrollback原因をdiagnostic traceとverifierで固定し、current evaluated Simple 4×4 WARPをBASIC authoring envelopeへ投影し、Layer Transform / Animation Tableへ可逆的なglass surface prototypeを適用する。WP-009の保存・History・KEY semantics、renderer、schema、Owner受入判定は変更しない。

## CURRENT SLICE — WP-005 Owner Acceptance Continuation (2026-09-09)

- 開始HEADは`2d6e461bf13a8bbc1d6b76cf2041b8684a63fb06`、開始時worktreeはclean。既存WP-009成果を保持して今回のWP-005限定差分を追補している。
- Aでは`LayerTransformWarpController`へ常時console出力を持たない任意trace hookを追加し、pointerdown/capture、各preview、pointerup/cancel/lost capture、session/frame/target状態をdiagnosticから観測できるようにした。normal gestureの最終preview保持、cancel/lostのgesture-local rollback、pointerup後のlate lost無効化、preview failure rollbackを`verify-layer-warp-gesture-retention.mjs`へ固定した。interactive WARP SVGとpoint hit targetだけへ`touch-action:none`を追加し、document/bodyへは広げていない。trusted physical pointercancelの頻度はBrowser/Owner確認待ちであり、terminal semanticsは維持する。
- Bでは保存正本を変更せず、current Clip/internal Layer/local Frameの`clip.layerDeformers`をsampleし、16点を`bindBounds`上へ展開したpure `layer-warp-authoring-envelope.js`をBASIC overlay boundsだけに接続した。current Simple 4×4が無い、unsupported、削除済みの場合はsource boundsへfallbackし、Motionは従来どおりenvelope後にforward適用する。`verify-layer-transform-basic-warp-envelope.mjs`でexpanded/compressed/interior protrusion/delete-restoreとtranslation/rotation/scale/flipを固定する。
- Cでは既存themeのalpha surfaceを再利用する小さなCSS token（surface alpha `.82`、backdrop `blur(3px)`）をLayer Transform outer panelとAnimation Tableへ適用し、子controlのopacityは1へ戻した。配置・縮小・dock・collapse、z-index、pointer ownership、schemaは変更しない。Browser G1/G2/G3と操作性能は後段で最小確認し、Owner判断へ分離する。
- A/Bの技術verifier、関連regression、harness、Vite buildはPASSしたため、WP-005を`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`へ戻した。全harnessは`169 selected / 0 failed`、transform `17/17`、warp `27/27`、animation `34/34`、ui `45/45`、project `9/9`、harness check `31 documents / 139 local links / 25 proposals / 8 packages`。distはbuild後にHEAD内容へ戻し、`git diff --exit-code -- tegaki_work/dist`は0。BrowserではChrome production `908×548`でG1 Layer TransformとG2 Animation Tableのglass surface・既存control可読性を確認した。空Raster fixtureのためG3同時表示、20 gesture、BASIC envelope実制作、trusted pointercancel/pen、console計測はOwner受入待ちであり、Owner ACCEPTED/DONEにはしない。WP-009は`ACTIVE — TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING`を維持する。

## CURRENT SLICE — WP-009 Layer Transform KEY management (2026-09-09)

- 開始時の実HEADは`09ab1c08ccc0f0defa457f1f228896949997fc9`で、作業開始時worktreeはcleanだった。添付指示の想定`33796efb...`とは異なるため、履歴を巻き戻さず現在HEADへ追補している。
- 新規`WP-009`として、保存schemaを増やさず既存`layerTransformTracks` / `layerDeformers`からBASIC/WARP bundleを導出するpure helper、panel component projection、Timeline square marker、空Frame限定のbundle D&Dを実装した。
- pending candidate中の削除/D&Dは暗黙confirm/cancelせず拒否する。stable panel deleteは既存History refresh/rebindへ接続し、Timeline D&Dはactive Layer Transform sessionでは安全側で拒否する。
- 新規verifierはmodel/panel/delete/D&Dを追加し、model/panel/D&D PASS。既存Transform 16/16、WARP 26/26、Animation 34/34、UI 45/45、Project 9/9、全harness 167 selected / 0 failed、`verify-github-url-index` 54 unique local targets、harness check、構文、Vite build、diff checkもPASSした。実Browserはmarker、component rows、stable D&D、active拒否、BASIC削除→WARP-only、Undo/Redo→BASIC+WARP復元まで確認済み。Owner操作感、Pixi/CPU画素、console/DPRの独立計測は未完了。
- WP-005の技術完了／Owner受入待ち状態、WP-003 cross-frame continuation、WP-007 terminal、既存Pixi/CPU preview policyは変更しない。

WP-005のSimple 4x4 WARP UIは既存Layer Transform transactionへの技術接続を完了した。normal/CAF SOURCEはRaster bake、CAF ANIMATEは`ClipInstance.layerDeformers`を維持し、CPU compositor / SOURCE bake / Export / Project canonical dataをpixel authority、Pixiを同じ評価modelを使うinteractive GPU proxyとする。WP-007の未確定Layer Transform Export guardとHD-005 `MIXED`は維持し、Owner受入までpackage statusはACTIVEとする。

## CURRENT SLICE — WP-005 Final interaction safety / WARP body-drag isolation (2026-09-09)

- 原因は`LayerTransform._setupDragEvents()`のCanvas `pointerdown`が`isVKeyPressed`だけを条件にし、`transformMode === 'warp'`でもBASIC `onDragRequest`へ入っていたこと。WARP pointはoverlayのproduction controllerが別に所有するため、body dragだけが混在pendingを作れた。
- `tegaki_work/system/layer-transform.js`の入口条件へ既存mode stateの`this.transformMode === 'basic'`だけを追加した。WARP bodyはdrag開始・`preventDefault`・BASIC mutationを行わず、BASIC bodyとWARP pointのpointerup/cancel/lost captureは変更していない。document-wide pointer、panel/table/camera、schema、History、rendererは変更していない。
- 新規`build/verify-layer-transform-warp-body-drag-isolation.mjs`はproduction `LayerTransform` pointer listenerでBASIC body `onDragRequest`、WARP body無起動、production `LayerTransformWarpController` point preview、WARP body中のpending falseを確認した。結果PASS。
- 関連回帰はbody verifier、motion projection、cross-frame continuation、WARP re-entry、pointer terminal、harness check、transform `13/13`、warp `26/26`、animation `34/34`、ui `45/45`、project `9/9`がPASS。
- 実Browser（Chrome production localhost、CUA screenshot `908×548`、DPRは既存tab計測値`2.025`、console error/warn `0`）で、CAF ANIMATE `V → WARP`の空白body dragはstatus/History/pointsを変えず、WARP point dragは`WARP 未確定`へ進み、明示KEYで`WARP KEYED`・History `+1`・panel保持を確認した。BASICへ戻ったbody dragはpending previewを生成し、EscapeでHistoryを増やさず取消した。SOURCEではanchor iconが有効、CAF ANIMATEでは無効表示だった。
- 判定は技術`PASS`、Ownerの制作受入は未完了。実PNG download、trusted device pointercancel、全Owner操作感は自己承認せず、WP-005を`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`でGPT/Owner reviewへ返す。

## CURRENT SLICE — WP-005 BASIC/WARP authoring coordinate congruence (2026-09-09)

- 開始HEAD / 現在HEADはともに`7ba13ef753b8264d06759ec6ad39518187d805ef`。既存のcross-frame差分を巻き戻さず、`layer-system.js`、`animation-table-popup.js`、`layer-transform-warp-controller.js`と専用verifierだけを追補した。commitは作成していない。
- Owner報告の原因は、BASIC Layer Motion後もWARP overlayとpointer inverseがbindBoundsのMotion前座標を直接使い、現在FrameのLayer Motion affineを投影へ含めていなかったこと。結果としてRasterは移動/回転/拡縮後、16点と入力判定は変形前位置に残った。
- 修正はprojection境界だけに限定した。`LayerSystem.getLayerWarpAuthoringMotion()`がANIMATEでは現Frameの`clip.layerTransformTracks`をproduction adapter経由で取得し、transactionのClip/internal Layer/Frameが一致しない場合は古い行列を再利用せず`unavailable`を返す。controllerは`createCenteredTransformMatrix`でbindBounds world pointへforward affineを適用し、pointerは`screenClientToWorld → invertTransformMatrixPoint → bindBounds正規化`でMotion前WARP座標へ戻す。normal SOURCEは既存Layer Transform session/identity fallbackを維持する。
- `bindBounds`、WARP `points`、`layerTransformTracks`、`layerDeformers`はprojection中に変更しない。評価順`DrawingSnapshot → Layer WARP → Layer Motion`、既存authority、保存schema、CPU compositor、Pixi renderer、WARP entry guardは変更していない。projection-only Historyは`0`。
- 新規`build/verify-layer-transform-warp-motion-projection.mjs`はproduction controller / transform math / LayerSystemを実行し、identity、translation、rotation、scale、negative scale/flip、anchor付きcombined affineの6ケース×16点をforward/inverse roundtripで確認した。`verify-layer-transform-warp-motion-projection`、`verify-layer-transform-warp-reentry-congruence`、`verify-layer-transform-cross-frame-continuation`、`verify-layer-transform-warp-entry-guards`はPASS。
- 関連harnessはcheck `30 documents / 137 links / 25 proposals / 7 packages`、transform `13/13`、warp `25/25`、animation `34/34`、ui `45/45`、project `9/9`がPASS。変更fileの`node --check`、Vite build、`git diff --check`もPASS。build生成distはHEAD内容へ復元し、差分へ残していない。
- 実Browserの既存CAF確認では、viewport `908×548`、DPR `2.0249998569488525`、console error/warn `0`。同Frame BASIC translation/rotation/scale後のWARP overlayとvisible point hit、WARP KEY、F1→F2→F1を確認済み。今回のstrict current-Motion source追補後の最小再確認は、save/reopenした空のCAF snapshotでBASIC affine表示まで確認したが、Rasterが無くWARP入場を完走できなかったため、Owner受入の証拠には数えない。
- 既知の別論点として、ANIMATE WARP ready時のkey stripがBASIC KEYの存在と一致しない表示（`KEY未設定`）は今回直していない。Pixi/CPU pixel差、実PNG download、trusted pointercancel、Owner操作感も未受入である。判定は`PARTIAL / GPT review required`、WP-005は`ACTIVE — OWNER ACCEPTANCE BLOCKED`で停止する。

## COMPLETED

- 前回の文書/正本/語彙/ロードマップ/5 WPを継承。読む順序・対象scope・local link・harness依存を再レビューし、再構成上の阻害事項なし。
- [WP-001](work/WP-001-history-failure.md) DONE。実HistoryManagerで修正前のindex二重減算を再現（actual=-1 / expected=0）。
- redoのdo成功後だけindexを進める局所修正。実行失敗はindex不変、実行成功後の通知失敗は適用済みindexを保持、finallyでisApplying解除。
- 新規verifierは初回/中間/末尾、連続例外、以前のUndo、再試行、通知例外、部分mutationの限界を確認。
- History関連5/5、全verifier148/148、構文確認、Vite build成功。出力は専用Temp、dist変更なし。
- read-only agentの呼び出し側/Raster Patch/最終diffレビューを主担当が統合。コード変更は主担当だけが実施。
- WP-001製品差分はhistory.jsのredo内のみ。
- [WP-002](work/WP-002-effect-guards.md) DONE。モデルの共有Asset/Folder配下preflight、Motion/Rig/Mesh/clippingの指定追加順、既存WARP解除を補修。
- Owner許可でMotion bridge開始/previewの対象検査を追加し、model setter迂回を封鎖。UI構造/操作は不変。
- 修正前WARP→Rigの誤成功を基準commitの実modelで再現。修正後の拒否deep-equal、無関係target保持、解除、model往復・隔離caller/History試験が成功。
- 最終全149 verifier・構文・Vite build成功。製品変更はanimation-data-model.jsと限定popup検査、build出力はTemp、dist不変。

## CURRENT STATE

WP-001は非UI・同期例外経路を実production classで検証して完了。Browser/Owner実操作は今回未実施であり、受入済みとは記録しない。
WP-002は指定経路の技術完了。Browser実操作・実Pixi・本番History callback全体は未確認で、全機能受入とはしない。
WP-003はDONE。拒否時terminal、自動保存延期、Undo/Redo再同期の隔離回帰がpass。通常RasterのF1/F2継続、周期跨ぎ、History 1/0、Project保存往復をBrowser確認済み。描画直後の初回SOURCE Vも通常Recovery延期へ含め、Browserで維持を確認。Owner操作感の受入は未確認。WP-006もDONE。Folder自身のMotion schema、現行subtree評価、Folder専用V bridge、History/Undo/Redo、保存metadataと双方向effect排他を実装した。BrowserでTable展開後の2子Raster同時preview、KEY、次Frame継続を確認。CPU/export実画素とOwner受入は未確認。WP-004は監査DONE、WP-007は技術DONE、WP-005はSimple 4x4 WARP UIの技術作業を完了し、Ownerの実画面・実download・操作感受入が残る。旧9qはPAUSED。
WP-005は、関連verifier・harness・構文・Vite buildをPASS。normal SOURCEでの4x4/16点操作、CAF ANIMATEのpreview/KEY/terminal、Table close rollback、pointer terminal、Pixi/CPU/export画素・save/reopen・非4x4/排他対象の技術証拠を完了した。今回のcross-frame修正もBASIC/WARPのproduction methodとlocalhost UIで確認した。trusted OS pointercancel、Owner操作感、実Raster制作・実PNG downloadは未受入として残るため、WP-005は技術完了を維持しつつ`ACTIVE — OWNER ACCEPTANCE BLOCKED`で停止する。
WP-005のFinal technical evidence sliceはlive baseline `86803e1de0d649648c079b44e20389dc868981fd`から、隔離16x16非対称RasterのChrome診断（Chrome 152 / viewport `680x561` / DPR `2.25` / console errors 0）まで完走した。normal SOURCEのCPU preview/bake/exportは`0x17a134da`で一致し、Project save/reopenはPixi upload後のproduction canonical Raster `0x191a3ed6`とreload後Exportまで一致した（CPU入力`0x7de6acda`との差は半透明RGBの8bit premultiplied-alpha量子化）。CAF SOURCEはDrawingSnapshot/PNG/save-reopenが`0x17a134da`で一致。CAF ANIMATEはCPU/Export/save-reopen/F1→F2→F1が一致し、4x4/16点/target/frameのlayerDeformersも保持したが、Pixiは`0x63f4c1ac`で9px差（最大channel 102）。Layer WARP + MotionはCPU/Export `0x8525007f`、Pixi `0xf73d350c`で9px差（bboxの1px差を含む）。GPU MeshとCPU rasterizerの境界差を固定証拠として記録し、許容誤差やrenderer/schema変更は行わない。production入口guard verifierはnon-4x4/RIG/Mesh/Skin/clipping owner+sourceを全件明示拒否、effect/model mutation 0、History 0、session noneでPASS。よってこのsliceは`PARTIAL / GPT review required`で、WP-005はACTIVEのまま。Actual App UI、Owner受入、trusted device pointercancelは未確認。WP-007はproduction JS未変更のため`NOT RERUN — no relevant production change`を継承する。

### WP-005 / WP-003 Cross-frame Layer Transform continuation repair — 2026-09-09

- 開始HEADは`925596b9d7fbd731290fe9869ea34a0006249130`。既存差分を保持し、WP-005/WP-003の対象fileだけを追補した。
- 原因は、Layer Transform session中のTimeline直接クリック（frame header、背景、cell、motion marker）が共通のFrame continuationを通らず、`model.setCurrentFrame()`へ直行していたこと。current Frameだけが進み、transaction、target IDs、active working Layer、panel/V/WARP stateが旧Frameへ残るため、次Frameの再編集やWARP guardの不整合を招いていた。
- `LayerSystem.moveLayerTransformTimelineFrameTo()`を追加し、同じClip内のstable sessionだけを一Frameずつ既存resume経路へ渡す。pending transform、session divergence、clip外、invalid frameはその場で拒否し、raw model frame writeへ落とさない。Popup側はprev/next、direct Timeline、motion marker、cellの全入口をこの境界へ寄せ、active transformがない場合だけ従来の通常移動を行う。
- `verify-layer-transform-cross-frame-continuation.mjs`は実production methodを使い、BASIC/WARPそれぞれでKEY confirm `+1`、direct F7相当のfresh rebind、既存destination key、pending navigation block、Esc後の通常移動、delta guardを確認した。結果はBASIC/WARPともPASS、frame move `+0`、pending `+0`。既存 transform 13、warp 24、animation 34、ui 45 verifier、harness check、Vite build、構文確認、`git diff --check`もPASS。
- 実production Browser（localhost:5173、production IAB、viewport `905×546`、DPR `2.025`）では、3Frame CAFでBASIC `F1 KEYED → F2 READY → direct F3 READY`、pending F3からの直接戻り拒否、Escape解除を確認した。WARPは`F3 KEYED → F2 READY → direct F1 READY → existing F3 KEYED`、panel/V/WARP/16点の維持を確認し、WARP pending中の直接Frame移動もF2に留まった。console error/warnは0件。
- 追加の7Frame CAFでは、実RasterのBASICを`F6 drag → explicit KEY → direct F7 drag → explicit KEY → F6/F7 revisit`で実施し、各confirmがHistory `+1`、両Frameの`KEY設定済み`、panel維持を確認した。WARPの実point dragは既存F3でのKEY確定とF3→F2→F1→F3再評価、pending blockまで確認し、F6/F7の別形状dragはOwner再確認へ残す。
- 追加Browser操作では、F6にBASIC keyがある状態でWARP 16点previewへ入場・point dragできたが、chip/key stripがWARP表記へ切り替わらず、explicit WARP confirmもHistoryを進めなかった。この同Frame BASIC+WARP UI状態は今回のcross-frame境界外で、WARP guardを弱めず別GPT/Owner確認事項として残す。
- これは技術Browser確認であり、Ownerの実Raster制作操作感・実PNG download・trusted pointercancelを代替しない。保存schema、History authority、CPU/Pixi renderer、WARP guard、Folder/RIG/Mesh/clippingは変更していない。WP-005は`ACTIVE — OWNER ACCEPTANCE BLOCKED`としてGPT/Owner reviewで停止する。

### WP-005 Owner Acceptance Fix Slice — ANIMATE WARP live preview (2026-09-08)

Owner報告のproduction再現では、CAF ANIMATE / internal Rasterの`V → WARP`中に16点グリッドだけが変形し、main canvasは元Rasterのまま残った。あわせてWARP候補が`KEYED`と表示され、WARP用の明示KEY確定controlが表示されない状態だった。原因は、WARP bridgeが既存`ClipInstance.layerDeformers`へ候補を投影しても、`isTransformPreviewSuspended`中の`render()`がworking Layer復元へ進み、既存Pixi previewを通さなかったこと、候補の`PREVIEW` actionを確定KEYと誤認していたこと、明示確定buttonが通常Layer Transform bridgeだけを扱っていたことである。

今回の限定修正では、activeなANIMATE Layer WARPだけを既存`_applyVisibilityPreview({ force: true })`へ通し、同じRenderPlan / sampled layerDeformers / Pixi Mesh proxyを使ってpointermove中のcanvasへ反映する。WARP projectionへ`keyGuide`を追加し、元KEYなしは`READY → 未確定`、元KEYありは`KEYED → KEYED · 未確定変更`とする。当時の明示buttonは既存V WARP terminal (`exitLayerMoveMode`)へ委譲していたが、このterminal意味論は後述の継続編集sliceで明示KEY confirmだけ変更した。Timelineのinternal Raster rowは候補中baseline deformerを読むため、新規候補だけではsolid markerを出さず、元KEYは残る。保存正本、CPU compositor、Export、History schema、Pixi/CPU parity policyは変更していない。

`verify-layer-transform-warp-animate-live-preview.mjs`を追加し、候補/確定/取消、status/keyGuide、既存Pixi preview経路、明示確定terminal、marker baselineを固定した。warp 22件、transform 13件、animation 34件、project 9件、構文、harness check、Vite production build、`git diff --check`はPASS。production UI（localhost:5173、viewport `905×609`、DPR `2.025`）では、CAFを2 Frameへ延長して`V → WARP`へ入り、`ANIMATE · F1 WARP READY`と16点表示、KEY strip（`F1 · KEY未設定`、未確定時は確定buttonとなる既存control）が表示され、console error/warnは0件だった。pointer drag・実確定・download・Owner操作感はこのturnでは未受入であり、Owner acceptance pendingを維持する。

### WP-005 Final Owner UX Fix — WARP KEY continuation / Frame step (2026-09-08)

ANIMATE WARPの明示KEY confirmは、変更前には`exitLayerMoveMode({ cancelled: false })`へ入り、KEY commitと同時にpanel・V・WARP overlayを終了していた。今回、`LayerSystem._commitLayerWarpTimelineKeyAndContinue()`は既存`finishLayerWarpEditSession()`だけでWARP bridgeのHistoryを1件確定し、確定済み`ClipInstance.layerDeformers`をbaselineとして同Frameに新しいWARP sessionを開始する。明示confirm後はpanel、V、WARP mode、16点、Canvas結果を保持し、statusは`KEYED`、markerは確定modelだけを読む。VとEscの既存terminal意味論は変更していない。

stable WARP状態のprev/next/strip wheelは、WARP sessionをmutationなしで解放して既存WP-003のFrame moverを通し、移動先FrameのmodelからWARP sessionを開始する。pending中は移動を拒否し、暗黙commit/rollbackやHistory追加を行わない。Undo/Redoでは旧WARP bridgeをfinishせず所有権だけを放棄して、復元済みmodelからfresh sessionを開始するため、古いbaselineで復元結果を上書きしない。CPU final authority、Pixi proxy、schema、Export guardは変更していない。

新規`verify-layer-transform-warp-key-continuation.mjs`、更新したWARP live-preview verifierとWP-003 continuation verifierで、confirmのHistory `+1`、no-op `0`、fresh baseline、stable Frame step `0`、pending拒否、Undo/Redo refreshを固定した。harnessはwarp 23件、transform 13件、animation 34件、project 9件、harness check、構文、Vite build、`git diff --check`がPASS。実production UIでは新規3 Frame CAFで`F1 → F2 → F3 → F2 → F1`を確認し、各Frameでpanel・V・WARP選択・KEY stripを維持し、stable stateのV終了も従来どおり確認した。CUA操作にはCanvas point dragを注入する経路がないため、実Raster drag→明示confirmの全手順はOwner再確認項目として残す。WP-005は`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`を維持する。

### WP-005 Owner Acceptance Block — F1 re-entry after Esc (2026-09-08)

Chromeの通常production UI（`http://localhost:5173/`）で、CAF1・Layer 1・5FのF1を使用した。F1で`V → WARP`へ入り、画面上で見えるcontrol pointをdragすると`ANIMATE · F1 WARP 未確定`になり、CanvasのRaster変形と16点overlayを確認できた。明示KEY confirm後は`ANIMATE · F1 WARP KEYED`、F1 marker、panel/V/WARP維持、History `9/500 → 10/500`を確認した。

その後、別の見えるpointをdragして`ANIMATE · F1 WARP KEYED · 未確定変更`にし、Escを押した。Esc後はpanelが閉じ、Historyは`10/500`のまま、F1のWARP markerと確定visualは残った。ここまでは期待どおりだった。

同じF1へ再度`V → WARP`で入場したところ、期待する`KEYED`ではなく`ANIMATE · F1 READY`、KEY stripは`F1 · KEY未設定`になった。一方、Timelineには`Layer WARP key: Frame 1` markerが残り、16点は確定後の形ではなく矩形baselineを表示した。console error/warningはこのCUA確認では取得していない。

これはClosure Gateの「Esc後に直前の確定形へ戻る」「既存F1へ再入場するとKEYEDで確定WARPを再現する」に反するため、Owner Acceptanceを`ACTIVE — OWNER ACCEPTANCE BLOCKED`とする。production JS、保存schema、harness statusは変更していない。原因の追加調査・修正はGPT review待ちとし、WP-008やsession extractionへ進まない。

### WP-005 Re-entry Congruence Repair — 2026-09-08

前項のF1再入場症状を、active working Layerを意図的に別Rasterへずらしたproduction bridge/LayerSystem fixtureでP0〜P6再現した。最初の不整合は、選択中internal RasterのIDとactive working Layerから逆引きしたIDが異なり、markerは選択ID、WARP transactionはactive逆引きIDを読む経路分岐だった。

限定修正は`tegaki_work/ui/animation-table-popup.js`だけに行った。Layer TransformのANIMATE Layer開始時に選択internal Rasterからworking Layerを逆引きし、transaction target / preview target / `targetLayerIds` / active Layerを同じIDへ同期する。WARP markerとWARP bridgeのdeformer lookupは同じ`clip + internalLayerId + localFrame`経路を使用し、selectionとtransactionのIDが一致しない場合は開始を拒否する。保存schema、History、CPU/Pixi renderer、Folder/RIG/Mesh/clipping authorityは変更していない。

新規`build/verify-layer-transform-warp-reentry-congruence.mjs`は実production `LayerSystem.enterLayerMoveMode()` / `beginLayerWarpEditSession()`、production bridge/context、pure transactionを接続し、P0初期KEY、P1 preview、P2 explicit confirm、P3 second preview、P4 Esc rollback、P5 full teardown/V再入場、P6 WARP再入場を確認した。結果は、確定model key・marker target・active working Layer・fresh WARP baselineが全checkpointで`internal-a`に一致、History `+1`、Esc後追加`0`、P6 `hadExplicitKey=true`、確定A points維持だった。既存warp/transform/animation suitesとharness checkもPASSした。

これは隔離production verifierによる技術PASSであり、実Raster drag・実KEY操作・実PNG download・Owner操作感の受入を代替しない。WP-005は`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`へ戻す。次のOwner確認は、F1でKEY確定→別drag→Esc→同じF1へ`V → WARP`再入場し、`KEYED`、marker、確定形16点を確認することから開始する。

### WP-008 Design / Audit First evidence — 2026-09-08

WP-008はproduction実装へ進めず、[WP-008 progressive controls audit](work/WP-008-progressive-controls-design-audit.md)と[Astra/GUI handoff draft](handoffs/WP-008-astra-progressive-controls-request.md)を追加した。現行Workspaceの可変GRID、RADIAL/FREE mesh、Bind/Cage、LENS placement、MOVE/INFLATE/PINCH/SMOOTH brushを、既存Layer Transformの4×4 `layerDeformers` authorityと分離して記録した。variable topology、cage authority、brushのLayer transaction接続、GUI Level 1/2/3は判断待ちであり、schema/history/renderer変更、Astra consultation、production UI変更は開始していない。WP-008は`PLANNED — DESIGN / AUDIT FIRST`のまま保持する。

### WP-005 Pixi / CPU WARP parity root-cause slice (2026-09-07)

- baseline HEADは`0c93561eda44f1ebba9f2e882d916c305e1de8ab`。既存差分を保持し、production JSは変更していない。`build/wp005-pixi-cpu-parity-diagnostic.html`だけを追加した。
- 固定16x16非対称fixtureをChrome 152（viewport `680x561`、DPR `2.25`、console errors `0`）で実行した。CPU authorityは`warpRgbaWithControlMesh` / `TimelineFrameCompositor`、Pixi側はproduction `AnimationTablePopup._renderInternalLayerPreviewGroup` / `_createDeformerPreviewNode`である。
- NO WARPはopaqueがCPU/Pixiとも`0x74a8cbf3`で完全一致。alphaは1px、最大差2（`[177,17,36,121]`対`[179,19,36,121]`）だけで、既存の8bit premultiplied-alpha upload canonicalization（`EXPECTED GPU CANONICALIZATION`）として扱う。IDENTITY WARPもopaqueは完全一致し、alpha差はNO WARPと同一で追加差なし。
- INTEGER WARPはopaque CPU `0xc01acf0b` / Pixi `0x0cc4933f`、10px差・最大255。alpha CPU `0x42f427ae` / Pixi `0xe9338617`、10px差・最大255。SUBPIXEL WARPはopaque CPU `0x17a134da` / Pixi `0x63f4c1ac`、9px差・最大102。alpha CPU `0x7f8ca105` / Pixi `0xdd315d85`、9px差・最大232。各差は最初のpixelから全て`triangle interior`（integer 10/10、subpixel 9/9）で、external boundary / internal shared edgeへの集中ではない。
- 最初のdeformed divergenceはINTEGER `(x=1,y=1)`、CPU `[180,18,37,194]`、Pixi `[180,20,35,195]`、triangle `1` indices `[0,5,4]`、UV `[(0,0),(0.333333,0.333333),(0,0.333333)]`、CPU barycentric `[0.71875,0.236842,0.044408]`、source coordinate `(1.263158,1.5)`。SUBPIXELは同pixelでCPU `[177,17,36,121]` / Pixi `[179,19,36,121]`、source `(0.974026,1.5)`。
- CPU/Pixiのindices・vertex ordering・18 triangle topology（16 vertices）は一致し、`triangulationMatch=true`。実Texture stateは`scaleMode=linear`、`antialias=false`、`wrapMode=clamp-to-edge`、`resolution=1`、`alphaMode=premultiply-alpha-on-upload`、source 18x18（1px padded）である。UV 0、±0.5 texelの診断候補を比較したが、offset 0がidentity mappingを保持し、INTEGER/SUBPIXELとも候補中最小差だった。production UV変更で一致する証拠はない。
- WARP + Layer Motion代表はCPU `0x8525007f` / Pixi `0xf73d350c`、9px差・最大196、diff bboxは`{x:3,y:2,width:9,height:9}`。WARP-only差が残るためMotion行列の修正へ展開していない。
- 分類は`G (C + A)`。`C`はCPUの明示premultiplied bilinear + byte rounding / CPU triangle bakeとPixi GPU linear Mesh sampling・source-overの実装差、`A`はNO WARP alphaのupload canonicalizationである。UV half-texel、topology mismatch、edge coverage単独の根拠は得られなかった。許容誤差・production UV/renderer/schema変更は行っていない。WP-005は`ACTIVE / GPT review required`で停止する。

### WP-005 Preview Parity Convergence Gate (2026-09-07)

- baseline HEADは`061d9e93f6a3aecc9b55d148ed177190dfa67aef`。既存差分を保持し、production runtimeは変更していない。`build/wp005-preview-convergence-diagnostic.html`を追加した。
- Motion-onlyを同じ16x16 fixtureで実行した。integer opaqueはCPU `0xf8d32585` / Pixi `0x4df056b3`、3px差・最大255、CPU bbox `{x:4,y:4,width:13,height:11}` / Pixi bbox `{x:3,y:2,width:14,height:13}`。integer alphaはCPU `0x2f2030ea` / Pixi `0x06e245ab`、3px差・最大255。同じくsubpixel opaqueはCPU `0x27ec05e7` / Pixi `0xfd6c1212`、23px差・最大255、subpixel alphaはCPU `0x4e2ee189` / Pixi `0x86950156`、23px差・最大255。Motion-onlyも差があるため判定は`M1`である。
- WARP-onlyのCPU finalは`0x17a134da`。current Mesh Pixiは`0x63f4c1ac`、9px差・最大102。CPU WARP surfaceをSprite化したprototypeは`0xe6d751d6`、7px差・最大102で、bbox/nonTransparentはCPUと一致し、残差は半透明RGBのupload canonicalization相当だった。
- WARP + MotionのCPU finalは`0x8525007f`。current Pixiは`0xf73d350c`、9px差・最大196。P1（CPU WARP surface → Pixi Motion）は`0xc90ee9b6`、7px差・最大196でMesh差は縮むがbbox差が残った。P2（CPU compositorでWARP + Motionまでfinal surface → Pixi Sprite）は`0x734812cb`、4px差・最大102。P2はCPUとbbox/nonTransparentが一致し、代表差 `[181,20,34,207]`対`[180,20,34,207]`のようにalpha同値のRGB差で、geometry差ではなくupload canonicalizationとして分離できた。
- 性能は正式閾値を設けず実測だけ記録した。warmup 3回後30サンプル、CPU render / Canvas ImageData / Texture.from descriptor / Pixi render / total（ms）は、344x135が`13.4/15.4/17.7`、`0.2/0.4/0.5`、`0/0.1/0.2`、`0.3/0.5/0.5`、`14.1/16.1/18.4`（median/p95/max）。512x512は`76.5/81.7/89.9`、`0.6/0.8/2.3`、`0.1/0.1/0.2`、`0.3/0.4/0.5`、`77.4/83.2/92.7`。1024x1024は`284.4/294.8/306.4`、`1.5/3.6/6.0`、`0.1/0.1/0.1`、`0.3/0.5/0.5`、`286.5/299.9/310.5`。Texture.fromはdescriptor計測で、実GPU uploadはrenderer.render時に発生する。
- 512x512の30更新dragはtotal median/p95/max `73.0/83.8/85.0ms`、CPU `72.1/82.6/83.3ms`、Pixi render `0.2/0.4/0.4ms`。tracked Texture/RenderTexture balanceはともに`0`、console errors `0`、JS heapは`77,513,690→60,574,826` bytes（delta `-16,938,864`）で増加しなかった。GCや正式frame-time閾値は判定していない。
- 最終分類は`P-B`（Motion-onlyも差があるためWARP MeshとMotion GPU sampling双方に共通するpreview差。P2 full CPU-reference surfaceでgeometryは収束）で、性能面は512以上で明確に重いため`P-D risk`を併記する。CPU-reference方式をproductionへ導入せず、Pixi Mesh削除・許容誤差policy・schema変更は行っていない。この差は2026-09-08のPreview Equivalence Policyでpreview implementation differenceとして分類し、WP-005のtechnical blockerから外す。WP-005は`TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`で停止する。

### WP-005 Technical Closure — Preview Equivalence Policy (2026-09-08)

- **Pixel authority:** CPU compositor、SOURCE bake、Export、Project canonical data。CPU / Bake / Export / save-reopenのcanonical pixel resultを一致させる。
- **Interactive preview:** Pixi GPU proxy。同じevaluated model、target/frame、control points、topology、bind bounds、Layer WARP / Motion sample、transform matrix、effect evaluation order、visibility、opacity/blend authorityを使う。GPU/CPU rasterizer、filtering、premultiplied-alpha由来のbyte差はpreview implementation differenceとして分類する。
- **Policy:** 数値epsilon、最大差、差pixel数などの固定許容閾値は導入しない。pointermove中の連続CPU final renderも採用せず、現行Pixi GPU proxyを維持する。preview pixelを保存正本にしない。
- **Technical status:** Simple 4x4、normal/CAF SOURCE、CAF ANIMATE、排他zero-mutation拒否、History `1/0`、Timeline marker、pointer terminal、Table close rollback、Project save/reopen、CPU/export consistencyを技術PASSとして扱う。WP-005は`TECHNICALLY COMPLETE`、package statusは`ACTIVE`、Owner受入はPENDING。
- **Owner checklist:** normal SOURCE（WARP/16点drag/V/Undo/Redo/Esc）、CAF SOURCE（drag/V/close-reopen）、CAF ANIMATE（READY/drag/KEYED/V/F2/F1/Table close）、pending WARPのExport block→VまたはEsc→成功、production UIからPNGを最低1回download、preview fidelity確認。
- **具体操作:** 本体UIの起動情報、各SOURCE/CAF操作順、Table close rollback、Export block/retry、実PNG確認、Ownerの`ACCEPT / CONCERN / NOT JUDGED`記録は[WP-005 Owner acceptance gate](work/WP-005-simple-warp.md)に固定した。
- **Trusted input:** synthetic DOM pointercancelはPASSだがtrusted device由来は`NOT VERIFIED`。Owner受入時に確認できる場合だけ補完し、technical completionは戻さない。
- **Production:** runtime JS、保存schema、History契約、Pixi Meshは変更していない。今回の作業後はsession境界抽出・別WP・renderer/schema変更へ進まず、GPT reviewとOwner acceptanceで停止する。
WP-004 Slice 1〜3で、Layer Motionだけのunsupported planがCPU compositorで拒否されず描画まで進むF-003をproduction consumer＋fake Canvasで確定し、`none/ready`だけを通す限定修正を適用した。実BrowserのHTMLCanvas/PNGでready Layer/Folder Motionのhash・bbox一致とunsupportedの描画前拒否、Selection/SOURCE/CAF SOURCE/ANIMATEのfixture terminal差を確認し、HD-005をMIXEDで確定した。WP-007ではExportManager共通guard、Export toolbar/popup preflight、zero-mutation verifier、Browser Canvas診断を追加した。
WP-007は`pending-layer-transform`でSOURCE / CAF SOURCE / ANIMATE Layer / ANIMATE FolderのExport・Preview・Sequence・Blob入口を明示停止する。Chrome 152のCanvas診断はviewport 1280x720、DPR 2.25、consoleErrors 0でPASS。隔離実UIではSOURCEのblock→V/Esc→Preview、ANIMATE Layerのblock→V→Preview、通常Folder SOURCEのblock→V→Previewを確認し、FolderのAnimation Context target表示まで確認したがFolder自身ANIMATE VとCAF SOURCE UIは未受入として残す。
全体監査は[AUDIT](AUDIT.md)、正本配置は[登録簿](DOCUMENT_REGISTER.md)、仕様/将来の順序は[ROADMAP](ROADMAP.md)。

## IMPORTANT DECISIONS

- Owner指示によりWP-002まで順次実施。保存正本、Layer/CAF境界、History command形式、byte/count制限は変更しない。
- indexの修復とcommand内のatomic rollbackを区別する。通知失敗で成功済みcommandを未適用扱いにしない。
- GITHUB.txtは案内。正本はAGENTS / docs / 対象WP / 現行コード。旧Phaseや外部レビュー文を直接実装契約にしない。
- 自前Markdownはdocs、root AGENTSはAI入口。既存構造の段階抽出は提案であり、大規模移行や保存schema変更は未承認。
- HD-005はMIXED。Selectionは既存auto commitを維持し、SOURCE / CAF SOURCE / ANIMATE Layer / ANIMATE Folderは未確定Layer TransformをExport前に明示停止する。Project Saveは変更しない。
- WP-007のblockはsession、model、History、frame、selection、preview candidateを変更せず、V確定またはEscキャンセル後の再試行を要求する。Preview一時samplingは採用しない。

## OPEN QUESTIONS

- WP-001範囲内の既知残存なし。範囲外: do途中mutationのrollback、push失敗前のredo枝破棄、composite補償/byteSize、非同期History。
- WP-002の指定登録/解除経路は修正済み。別件F-007: 並べ替え/reparentでclipping sourceが変化し競合する可能性は未修正・全経路未再現。
- WP-003: toolbar残留、自動保存によるV終了、Undo/Redo後のprojection不一致を補修。forced/manual saveは現行terminalを維持。詳細・検証結果はカード。
- Owner補足の「描画直後だけSOURCE Vが閉じる」は、描画後に予約された通常RecoveryがSOURCE sessionを延期しない経路と一致。activeなSOURCE/Timeline双方を延期する追補を適用し、forced/manual保存は維持。
- WP-004: CPU拒否抜けは限定修正済み。実Browser/Canvasのready Layer/Folder Motionとunsupported拒否、save/export terminal差を監査し、HD-005をMIXEDで確定してDONE。
- WP-007: manager/UI共通guard、zero-mutation verifier、Canvas/PNG、sequence/download境界、SOURCEとANIMATE Layerの隔離実UIを確認して技術DONE。CAF SOURCE UI、Folder自身V UI、Owner操作感は未受入。
- Animation Contextの右Layer PanelでCAF `clip-layer-mirror` rowを選択できない症状は、Owner実確認で解消済み。WP-004では追加調査・追加修正を行わない。
- 全solver/codec/長時間pen/全GPU/全Archiveの全面再調査は行わない。必要な対象だけ限定追加する。

## HUMAN DECISION NEEDED

OwnerはFolder自身のKEYを選択。個別Raster KEY展開や暗黙Rig登録をせず、[WP-006](work/WP-006-folder-transform-key.md)の`folderTransformTracks`として実装済み。

HD-005はLead決定済み（MIXED）で、[WP-007](work/WP-007-export-terminal-guard.md)へ実装した。残るのはOwnerの制作操作感受入のみ。

[HD-001〜004](ROADMAP.md#human-decisions): 大規模移行方式、static RIG host、内部Layer複製時の時間effect継承、永続非破壊SOURCE。
既存不具合の限定補修を妨げないが、未採用案を実装契約へ昇格しない。今回これらの結論は変更していない。

## NEXT

1. GPT reviewとOwner受入待ち。今回固定したPixi/CPU Mesh差とnormal SOURCEのCPU入力→Pixi canonical量子化差はPreview Equivalence Policyへ分類済みで、renderer変更・比較基準の数値epsilon・後続WPへは広げない。
2. trusted device由来のpointercancelは別途実操作が必要ならOwner受入時に補完する。今回のsynthetic DOM PASSをtrusted PASSへ昇格しない。
3. Owner受入（normal/CAF SOURCE/ANIMATE、Export操作感、実download）を技術passと分けて実施する。編集session境界抽出、Layer Panel、F-007、HD-001〜004、広範囲の再監査へ展開しない。

## RISKS / BLOCKERS

- commandの一部mutation後throwは画像/モデルが部分変更のまま残り得る。本WPのindex修正はそれを巻き戻さない。
- 既存verifier＋WP-007限定Verifier、Canvas診断、Vite buildは実機/Owner制作受入の代用ではない。buildの既存util externalization/大きなchunk警告は継続。
- WP-005 Final evidenceのPixi/CPU差は、半透明境界のWebGL Mesh samplingとCPU triangle rasterizerの差（9px、最大channel 102/196）として固定した。normal SOURCEのraw CPU bakeとProject reloadの差はPixi 8bit premultiplied-alpha量子化で、save/reopenのproduction canonical同士は一致する。Preview Equivalence Policyにより数値許容誤差・renderer/schema変更は導入せず、technical blockerから外した。
- mainの未push変更はWeb AIから不可視。Ownerがpush/対象SHAを指定する。公開先との一致は今回確認していない。
- Backup/PastFiles/別project、Owner差分、依存packageは対象外。
