# WP-008 — Progressive Controls Design / Audit Evidence

状態: **ACTIVE — ROUGH PRODUCT PASS / OWNER REVIEW**
Production実装: **限定rough prototype実装済み（最終GUI/Owner受入は未確定）**
監査baseline: `d7fce78abda96e550b1b03000903e9583c333582`  
監査日: 2026-09-08

## Latest implementation addendum — 2026-09-09

Owner-authorized process changeにより、旧監査の「production codeは変更しない」という時点判断を、architecture hard floorを固定した可逆rough product passへ更新した。focus lens仮説（BASIC＝placement/affine、WARP＝shape deformation）は維持し、BASIC/WARPを統合して比較不能にする変更は行っていない。

- BASIC Level 2は既存numeric/detail controlsのruntime整理だけ。ANIMATE pivot/anchor authorityは引き続きdisabled。
- WARP Level 2はPOINT/BRUSH。BRUSHは既存`warp-grid-brush.js`のMOVE/INFLATE/PINCHを同じSimple 4×4 Layer WARP transactionへ接続し、pointerup/explicit KEY/Escの境界はWP-003/WP-005へ委譲する。これはR2 pure algorithm reuse + R1 Layer session adapterの限定実装であり、Workspace UIやroot/Folder WARPの移植ではない。
- future MOTION/RIG staging、shared manipulator（BASIC bbox / WARP grid / RIG boneをmodeごとに交換する仮説）、BASIC default → WARP augmentationの仮説はdocsだけに保持する。保存schema、topology、cage、renderer、Historyの再設計は行わない。
- actual rough implementation resultは、progressive shell、inactive extension hiding、same-session tool switching、brush cursor/weight preview、MOVE/INFLATE/PINCHの技術verifier PASSまで。実Browser/Owner/Astraの最終判断は未実施であり、旧監査のUNDEFINED/decision holdを上書きしない。

## Scope and stop boundary

この資料は、既存WARP Workspaceの能力とLayer Transformへ接続する場合の境界を、現行production sourceからread-onlyで整理したものです。ここに記録した境界・保存schema・History・rendererの判断は維持し、WP-008カードの後続rough passが限定production UIを追加しても、この監査資料を新しい正本へ置き換えません。WP-005の可逆glass CSS prototypeは下記の別枠へ記録します。

WP-005はこの監査資料によってOwner受入済みにはなりません。今回のglass実験中は`ACTIVE — OWNER ACCEPTANCE BLOCKED`、A/B technical pass後は`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`へ戻す。WP-008は後続のOwner-authorized rough passを実施したため、現在は`ACTIVE — ROUGH PRODUCT PASS / OWNER REVIEW`である。

## Owner-authorized reversible visual prototype — glass surface (2026-09-09)

Ownerの「Canvasを見ながら長時間使うLayer Transform / Animation Tableが大きく遮蔽する」という観察に対し、配置を変える前に視覚遮蔽だけを切り分けるため、半透明surfaceのprototypeをWP-005限定で実施した。これはWP-008のprogressive controls本体、Level 2/3、mode hierarchy、popup placementの実装開始ではない。

- Existing Futaba UI glass languageを再利用し、`--ui-panel-glass-surface`（alpha `.82`）と`--ui-panel-glass-backdrop`（`blur(3px)`）だけを追加した。
- Layer Transform outer panelとAnimation Table main/header/viewportのbackground treatmentへ限定適用し、whole-panel `opacity`、配置変更、縮小、dock、auto-collapse、new settingは使わない。
- BASIC/WARP selector、KEY strip、Timeline numbers、markers、buttons、handles、feedbackはforeground opacity `1`と既存opaque control surfaceを維持する。backdrop-filter非対応時もsemi-transparent backgroundだけで成立する。
- BrowserでG1 Layer Transform、G2 Animation Table、G3 bothを同じCanvas fixtureで比較し、Canvas輪郭の認識、control/Timeline legibility、visual noise、drag/preview/scroll performanceを記録する。blurが負荷または可読性を損なう場合は`blur(0–2px)`へ下げる。

現時点の採用判断はBrowser/Owner比較後に行う。候補はKEEP / TUNE / REJECTであり、WP-008のvariable grid、Cage、Brush、pivot、schema、renderer authorityへ展開しない。

### Glass comparison result — Owner closure slice (2026-09-09)

- Owner指定の追加透過としてalpha `.82 → .72`を実Browserで比較し、backdrop `blur(3px)`は維持した。Chrome `152.0.7977.83` / `908×548` / DPR `2.0249998569488525`、console errors/warnings `0`。
- G1 Layer Transform、G2 Animation Table、G3 Bothの全てでCanvasの輪郭・位置・変形方向がpanel越しに認識でき、Layer Transform controls、Animation Table controls、Timeline marker、KEY rows、trashの可読性を保った。visual noiseは低く、WARP/BASIC/Timeline操作で明らかなlag/stutterは見なかった。
- 最終推奨alphaは`.72`、blurは`3px`、recommendationは`KEEP`。これはOwnerの「約10ポイント追加透過」を反映したCSS tokenの調整であり、opacity settingやplacement redesignではない。現在のWP-008 rough passはこのtokenを再利用するが、variable grid、Cage、pivot、schema、renderer authorityへ展開しない。

## Live source inventory

| 責務 | 現行source | 読み取れた境界 |
| --- | --- | --- |
| Simple Layer Transform WARP | `tegaki_work/ui/animation-table-popup.js`, `system/animation/layer-warp-edit-transaction.js`, `ui/layer-transform-warp-controller.js` | CAF ANIMATEのLayer WARPは`ClipInstance.layerDeformers`の対象internal Raster一枚、4×4/16点、明示KEY transactionを使う。 |
| Workspace WARP UI / gesture | `tegaki_work/ui/animation-table-popup.js`（WARP Workspace section）, `ui/warp-grid-overlay.js` | `point / select / grid / lens / brush`を一つのWorkspace overlayへ投影する。Layer Transform overlayとはsessionと保存先が異なる。 |
| Rect / radial / free topology | `system/animation/control-mesh-topology.js`, `control-mesh-deformer.js` | Rectは各軸2〜32、総点数256以下。RADIALは8〜64 segments、1〜16 rings、総点数256以下。FREEはDelaunay triangleを生成する。 |
| Fixed legacy WARP | `system/animation/warp-grid-deformer.js`, `warp-grid-topology.js` | `warp-grid`は固定4×4/16点の既存schema。Simple Layer WARPの候補と混同しない。 |
| Bind / cage math | `system/animation/warp-bind-frame-transform.js`, `warp-placement.js` | GRIDのBind点変形はcorner/edge/frame、LENSはkey内`placement`へ投影する。BASIC matrixを書き換える処理ではない。 |
| Brush math | `system/animation/warp-grid-brush.js` | screen point列からradius/hardness weightを作り、MOVE/INFLATE/PINCH/SMOOTHの次poseをpureに返す。 |
| Evaluation / pixel authority | `system/animation/folder-part-render-plan.js`, `timeline-frame-compositor.js`, `control-mesh-rasterizer.js`, `warp-grid-rasterizer.js` | CPU compositor / Bake / Exportがcanonical pixel authority。Pixi Meshはinteractive proxy。 |
| History / Project | `animation-table-popup.js`, `animation-data-model.js`, `history.js` | Workspace操作はClip model setterとTimeline Historyへ入り、Layer Transformは別bridge transactionを持つ。保存authorityをUI stateへ移さない。 |

## Existing capability map

| Capability | Current UI | Controller / gesture | Model / mutation | Preview | History | Project | Layer Transform reuse |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 4×4 Simple WARP | Layer Transform `WARP` tab、16点 overlay | `LayerTransformWarpController` | CAF ANIMATE: `ClipInstance.layerDeformers`; SOURCE: Raster bake | Layer Transform bridge + Pixi evaluated plan | pointermove 0、explicit confirm 1、cancel 0 | 既存Layer deformer roundtrip | **R1** for the existing Simple path |
| Variable rectangular GRID | Workspace `GRID POINTS`、columns/rows input（2〜32、最大256点） | Workspace point/grid overlay | `control-mesh` with `columns`, `rows`, `bindPoints`, `triangles`, `points`, `keyframes` | `warpGridOverlay` + control-mesh render plan | Workspace gesture end via `_recordTimelineHistory` | Existing Workspace model normalization is present; Layer Transform path is not proven | **R3** — adapter and Layer target authority required |
| RADIAL mesh | `RADIAL` button、16 segments×3 rings default | Same overlay, point mode | `control-mesh` with explicit points/triangles; columns/rows are null | Same control-mesh evaluator | Creation records a single Workspace History entry | Existing control-mesh shape; Layer Transform compatibility not proven | **R3/R5** — topology and key policy first |
| FREE mesh | Existing control-mesh creation path / topology helper | Point/select overlay | Delaunay triangles, explicit point order | Same control-mesh evaluator | Depends on Workspace gesture path | Existing control-mesh normalization; no Layer WARP authority | **R4** until Layer target and animation semantics are decided |
| GRID Bind frame move | `GRID` tool, FRAME/CORNER/EDGE modes | `warp-bind-frame-transform.js` plus rebase | Mutates deformer Bind points and rebases pose/key points in Project coordinates | Workspace overlay and CPU/Pixi evaluation | Gesture is committed through Workspace key/deformer path | Existing deformer schema can retain rebased points | **R3** — must not silently write BASIC matrix |
| GRID Bind rotate / scale | GRID frame handle, Shift drag/wheel | Workspace gesture + placement/bind helpers | Bind points or placement-derived points | Workspace overlay | Workspace transaction | Existing deformer/placement only | **R3** — cage authority is unresolved |
| LENS placement | `LENS` tool | Move/scale/rotate gesture | Current Warp key `placement` (`x/y/scale/rotation`) | Placement is consumed by sample/evaluator | Current key update path | Optional placement is normalized and retained | **R3** — Layer Transform transaction adapter required |
| Brush MOVE | `BRUSH` mode | `warp-grid-brush.js` weighted incremental delta | Current sampled/key points | Pixi proxy during pointermove; CPU final remains authority | Gesture end uses existing Workspace History boundary | Current deformer key path | **R3** — reuse algorithm, replace session/target adapter |
| Brush INFLATE / PINCH | Brush mode select | `inflateWarpGridBrushPoints`, signed amount | Current sampled/key points around start pivot | Same | Same | Same | **R3** — key topology and confirm semantics required |
| Brush SMOOTH | Brush mode select | `smoothWarpGridBrushPoints`, topology neighbors | Current sampled/key points | Same | Same | Same | **R3/R4** — quality and dense topology assumptions need evidence |
| BASIC numeric detail | Existing Layer Transform `詳細 — 数値で正確に調整` | Layer Transform BASIC controller | Layer Transform matrix / Motion track authority | Existing BASIC preview | Existing Transform bridge | Existing BASIC/SOURCE or Layer Motion authority | **R1/R2** for relocation only; do not duplicate matrix authority |

## Authority map

The following are separate authorities and must not be merged implicitly.

| State | Current authority | Required invariant for a future Layer Transform adapter |
| --- | --- | --- |
| BASIC position / rotation / scale / pivot | Layer Transform runtime and SOURCE or `layerTransformTracks` | BASIC controls may project into the existing transform transaction only. |
| Simple CAF ANIMATE WARP | `ClipInstance.layerDeformers.targets[].deformer` keyed by `internalLayerId` | `clipId + internalLayerId + localFrame` must remain the single target identity. |
| Workspace root WARP | `ClipInstance.deformer` | Do not retarget this root authority to a selected Layer Transform row. |
| Workspace Folder WARP | `ClipInstance.folderDeformers` keyed by `folderLayerId` | Folder subtree scope remains separate from internal Raster Layer WARP. |
| Control mesh topology | `control-mesh.bindPoints / triangles / columns / rows` | A topology change is a deformer generation change, not a BASIC matrix edit. |
| Cage / Bind frame | deformer Bind points and/or key `placement` | A future cage UI must declare whether it rebases Bind geometry or writes placement. |
| Brush pose | current deformer key points | Brush pointermove is preview; one confirm gesture owns one History entry. |
| Pixel output | CPU compositor / Bake / Export / Project canonical data | Pixi remains proxy; continuous CPU final rendering is not introduced by WP-008. |

## Grid, topology, and animation matrix

| Case | Existing Workspace | Layer Transform Simple path | Project / key compatibility for Layer Transform |
| --- | --- | --- | --- |
| 4×4 rect, 16 points | Supported | Supported and technically verified | **SUPPORTED** for current `layerDeformers` transaction |
| Rect 2×2 through 32×32, ≤256 points | Supported by control-mesh topology | Explicitly rejected by current Layer WARP entry as `advanced-layer-warp-required` | **UNDEFINED** for Layer target, key continuation, export and duplicate/remap |
| RADIAL 8–64 segments / 1–16 rings | Supported as explicit control mesh | Not accepted by Simple Layer WARP | **UNDEFINED** for Layer target and frame-key semantics |
| FREE Delaunay mesh | Supported as explicit control mesh | Not accepted by Simple Layer WARP | **UNDEFINED**; topology stability and key correspondence need a decision |
| Rebuild GRID while keys exist | Workspace blocks rebuild when current deformer has keys | Simple Layer WARP does not expose rebuild | **REJECTED** until a migration/key policy exists |
| Change topology between keyframes | No proven compatible Layer Transform path | Not exposed | **UNDEFINED**; do not add a selector before policy exists |
| Bind/cage change with existing keys | Workspace rebases points or writes placement according to tool | Simple Layer WARP has no cage authority | **UNDEFINED**; must be one declared deformer transaction |

`UNDEFINED` means the current source does not establish a safe contract. It is not permission to infer a migration or silently fall back to 4×4.

## Brush audit

Current brush input is pointer position in screen space, current sampled pose, radius, hardness (`strength` UI maps to hardness), and the selected mode. The pure algorithms return new point arrays; they do not write Project, History, or DOM state.

| Brush | Mutation | Radius / strength / falloff | Pressure | Simple 4×4 meaning | Cost / reuse note |
| --- | --- | --- | --- | --- | --- |
| MOVE | weighted point delta from incremental pointer movement | radius and hardness weight; smooth radial falloff | No pressure input observed in the current helper | Meaningful for 16 points, but coarse | Reuse `calculateWarpGridBrushWeights` + `translate...`; Layer transaction adapter needed |
| INFLATE | radial displacement from gesture-start pivot | radius, hardness, signed amount | No pressure input observed | Meaningful but coarse | Reuse `inflate...`; amount and terminal must be mapped to explicit key transaction |
| PINCH | same inflate function with negative amount | radius, hardness, signed amount | No pressure input observed | Meaningful but coarse | Same adapter and key policy as INFLATE |
| SMOOTH | neighbor-average displacement weighted by brush | radius/hardness plus drag-distance strength | No pressure input observed | Technically possible; quality depends on sparse topology | Requires stable neighbors and a declared topology policy |

The current brush path upserts the selected current-frame Warp key during preview and refreshes the interactive preview. It is therefore not safe to wire the helper directly to Layer Transform without mapping it to the existing `READY → pending → explicit KEY` contract.

## Cage / placement findings

The Workspace `GRID` tool treats the Bind frame as a deformer operation. FRAME movement/scale/rotation and CORNER/EDGE operations produce new Bind points, then `rebaseWarpGridBind` keeps Project-space pose/key geometry coherent. The `LENS` tool instead changes a key-local `placement` scalar (`x`, `y`, `scale`, `rotation`). Both are WARP deformer data; neither is the BASIC matrix.

This is a design hold. A Layer Transform cage cannot be allowed to create a second matrix authority or silently rewrite Layer Motion. The first implementation must choose exactly one of:

1. rebase the Layer WARP Bind points and all compatible keys;
2. write a Layer WARP key-local placement consumed by the existing evaluator; or
3. leave cage operations in the existing Workspace until a new authority contract is approved.

No choice is made in this slice.

## BASIC and progressive information architecture

The current product already exposes BASIC and WARP as the first level. The safe design constraints are:

- Level 1 always shows `BASIC | WARP`, current status, confirm/cancel, and the minimum ANIMATE KEY guide.
- Level 2 is mode-local: BASIC may expose position/rotation/scale/pivot; WARP may expose GRID/CAGE/BRUSH.
- Level 3 is local fine control: brush radius/strength/falloff or a similarly small set.
- Closing Level 2 returns to the current lightweight Simple surface.
- Advanced controls are not permanently expanded, and the inactive mode does not leave controls behind.
- The Animation Table may be open at the same time; Canvas direct manipulation remains primary.

The existing BASIC numeric detail is a relocation/IA question, not a reason to add a second transform model.

## Narrow viewport and animation constraints

The panel must coexist with the Animation Table without consuming the Canvas and Timeline hit area. Labels, mode switches, point handles, and confirm/cancel controls must keep usable hit targets at narrow width. A long inspector or always-open brush controls are not acceptable defaults.

For ANIMATE, all future WARP levels inherit the existing grammar:

```text
deform → explicit KEY confirm → panel / handles remain → prev/next or strip wheel → next Frame
```

Pending Frame movement remains explicitly rejected. There is no implicit commit, no brush-specific terminal, and no Export bypass.

## Reuse classification

- **R1:** current Simple 4×4 transaction, current Layer Transform overlay/controller, existing BASIC controls.
- **R2:** pure topology and brush math only after the Layer Transform adapter owns target/frame/key semantics.
- **R3:** Workspace overlay gesture/controller and deformer helpers that need a new `ClipInstance.layerDeformers` adapter, Layer Transform session, and key guide.
- **R4:** root Clip WARP, Folder WARP, arbitrary FREE topology, and any path that would retarget Layer Transform to a different authority without an approved adapter.
- **R5:** any design that requires a new schema, topology migration, BASIC/Cage dual authority, or renderer rewrite.

## Candidate implementation slices (proposal only)

| Slice | Scope | Gate |
| --- | --- | --- |
| S0 | Mode-local extension shell with no new mutation | GUI review; no production authority change |
| S1 | BASIC detail projection/relocation using existing transform transaction | BASIC authority and narrow layout review |
| S2 | WARP cage only if Bind-vs-placement authority is selected | Architecture decision; animation and Project roundtrip evidence |
| S3 | Variable GRID only after topology/key/migration policy | Schema/evaluator/Export/duplicate/retime review |
| S4 | Minimum brush set, likely MOVE first | explicit key transaction, History 1/0, preview cost, Owner workflow |
| S5 | Animation / Export / Save / Owner acceptance integration | all preceding gates and WP-005 acceptance |

These are not an authorization to implement. WP-008 remains audit-first.

## Decision holds

- **DG-1:** Owner/GUI chooses whether mode-local Level 2 is accordion, tray, popover, or another bounded form.
- **DG-2:** Architecture chooses whether variable topology, cage, and brush can use `layerDeformers` without a new authority.
- **DG-3:** Reuse is per capability; the Workspace is not transplanted wholesale.
- **DG-4:** Owner chooses the minimum brush set after seeing the narrow-screen interaction cost.
- **DG-5:** Features that do not fit Level 2/3 remain in the existing Workspace instead of expanding Layer Transform.

## Audit conclusion

Current evidence supports Simple 4×4 reuse and pure algorithm reuse as bounded future options. It does not support implementing variable topology, cage, or brush controls in Layer Transform yet. The next review should decide authority and UI hierarchy before any production change. No Astra consultation, schema migration, popup split, renderer change, or advanced WARP implementation was started in this slice.

## Unified WARP authoring gesture candidate — deferred

The WP-005 interaction-safety slice found that WARP Canvas body drag must remain inert while WARP mode owns the control-point gesture. A future unified authoring gesture may be useful, but no production choice is made here.

| Candidate | Body drag | Point drag | Main tradeoff |
| --- | --- | --- | --- |
| U1 | BASIC Layer Motion | WARP deformation | Discoverable direct manipulation, but same-Frame confirm and History ownership must represent two candidates. |
| U2 | Temporarily enter a BASIC submode | WARP deformation | Makes ownership explicit, but adds mode transition and pen/focus complexity. |
| U3 | Keep body inert in WARP | WARP deformation | Safest current ownership and terminal semantics, but body movement requires returning to BASIC. |

Open decisions for any future U1/U2 review are discoverability, accidental movement, BASIC/WARP status and key markers, one-versus-two History entries, Undo/Redo granularity, Escape, pending Frame movement, pen behavior, and continuous ANIMATE editing. The current production contract remains U3: `BASIC body → BASIC Motion`, `WARP body → no BASIC candidate`, `WARP point → WARP pending`.

## Animation Anchor / Pivot authority audit — read-only

The following answers are based on the existing Layer Motion and SOURCE implementations. They are design evidence, not permission to enable ANIMATE anchor editing.

| Question | Answer |
| --- | --- |
| Q1. Are `pivotX/pivotY` track-global? | **Yes.** `layerTransformTracks` stores them outside the per-Frame keyframe entries. |
| Q2. Is there a frame-local pivot schema for Layer Motion? | **No.** Layer Motion keyframes currently store x/y/scale/rotation. Generic clip transform keys with anchor fields are a separate authority and cannot be reused implicitly. |
| Q3. Would changing a track-global pivot affect existing sampled Frames? | **Yes.** The sampler carries the track pivot into `createAffineTransformMatrix`, so all Frames using that track can render differently. |
| Q4. Can existing keys be visually preserved by a safe rebase today? | **Not safely.** It would require transforming all compatible keyframes and declaring the pivot transaction boundary; no adopted production path exists. |
| Q5. Could that rebase be represented as one History entry? | **Potentially in a future design**, but the current Layer Motion transaction does not own a pivot-rebase command. |
| Q6. Do copy/paste, retime, and save/load preserve the current pivot? | **The current track-level value is cloned/serialized with `layerTransformTracks` and survives the existing paths.** Pivot-rebase semantics and a dedicated acceptance proof are not defined. |
| Q7. Should SOURCE Anchor and ANIMATE Layer Motion pivot share one UI? | **No decision to merge them.** They have different authority, scope, and History/evaluation semantics; presenting them as identical would be misleading until Architecture approves the contract. |

Current context projection deliberately sets `allowAnchorEdit: false` for CAF ANIMATE Layer Transform and for Layer WARP. SOURCE uses `TransformAnchorSite` and its existing rebase/History path. This slice records the boundary and does not change the flag, schema, evaluator, compositor, renderer, or save format.

## Pivot preset UX candidate — progressive disclosure only

Owner's proposal is retained as a candidate for GUI review:

- Keep the compact anchor/center-axis icon as the entry point.
- When the icon is **OFF**, do not show preset controls.
- When the icon is **ON**, reveal two small choices: `キャンバス中央` and `対象中央`. Accessible labels may be `中心軸をキャンバス中央へ` and `中心軸を対象中央へ`.
- The presets change the center-axis position only; they are not a Transform Reset and do not change x/y/rotation/scale or WARP points by implication.
- `対象中央` needs mode-specific copy/semantics: BASIC candidate is the Raster/content bounds center; WARP candidate is the current WARP bind bounds / deformation range center. This distinction must be visible before implementation.

Whether the compact controls sit above or below the BASIC/WARP selector, and whether icon-only or short text is best at narrow Animation Table widths, remains for Astra/Owner comparison. No production UI or ANIMATE anchor support is added in WP-008.

## Gemini 3.8 Reuse Inventory Slice (2026-09-17)

このセクションは、後続のAstra LOWによるWARP Tool Strip / SELECT / Brush / GUI rough integrationに先立ち、既存TEGAKI内に既に存在する再利用可能資産を整理・採掘した技術監査の記録である。
新たなproduction UI接続、controller新設、session新設、Project schema変更、History変更、重複数学helperの追加は一切行わず、既存の純粋計算（pure math）と現在の所有境界（authority）を明確に分離した。

### 1. Primary Capability Inventory (A to M)

既存WARP WorkspaceおよびLayer Transform関連sourceから採掘した13項目の詳細記録:

| # | Capability | Current Source File | Current UI Owner | Gesture / Controller Owner | Pure Helper Exists | DOM Dep | Canvas / Pixi Dep | Model Dep | History Dep | Project Dep | Coordinate Space | Mutation Target | Animation / Key Dep | 4×4 Compat | Reuse Class |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A** | **POINT edit** | `layer-transform-warp-controller.js`, `layer-warp-edit-transaction.js`, `animation-table-popup.js` | Layer Transform / Workspace | `LayerTransformWarpController` / `AnimationTablePopup` inline | **YES** (`transform-math.js`, `layer-warp-authoring-envelope.js`) | SVG point hit targets (`.warp-grid-overlay-point-hit`) | Pixi preview proxy (`previewLayerWarpEditSession`) | Layer WARP transaction session (ANIMATE: `ClipInstance.layerDeformers`) | pointermove 0, pointerup candidate保持(0), explicit confirm +1 | Project `layerDeformers` (ANIMATE) / Raster bake (SOURCE) | Screen -> World -> Inverse Motion -> normalized [0..1] in `bindBounds` | 16 control points | Current frame deformer key | **YES** (16点固定) | **R1** (production稼働中) |
| **B** | **rectangle selection** | `system/animation/warp-point-selection.js`, `animation-table-popup.js`, `warp-grid-overlay.js` | Workspace `AnimationTablePopup` (`tool = 'select'`) | `AnimationTablePopup` (`tool: 'select-marquee'`) | **YES** (`normalizeWarpPointSelectionRect`, `findWarpPointIndicesInRect`, `findWarpPointIndicesInShape`) | Canvas pointerdown/move/up, SVG marquee `<path>` | None (DOM SVG overlayのみ) | None (純粋runtime UI state) | **NONE** (History 0) | **NONE** (保存対象外) | Screen client space (px) 対 Screen-projected points | `this._warpSelectionMarquee`, `_warpPointSelection` | None | **YES** (任意の点列で動作) | **R2** (pure helper即時再利用可、UI/controller新設要) |
| **C** | **multi-point selection** | `system/animation/warp-point-selection.js`, `animation-table-popup.js`, `warp-grid-overlay.js` | Workspace `AnimationTablePopup` | `AnimationTablePopup` (`_setWarpPointSelection`) | **YES** (`mergeWarpPointSelection`) | SVG point class `.is-selected` | None | None (純粋runtime UI state) | **NONE** (History 0) | **NONE** (保存対象外) | Point index (`0..N-1`) | Controller runtime selection set (`Set<number>`) | None | **YES** (0..15) | **R2** (pure helper即時再利用可) |
| **D** | **selected-point translation** | `system/animation/warp-point-selection.js`, `animation-table-popup.js` | Workspace `AnimationTablePopup` | `AnimationTablePopup` (`tool: 'select-move'`) | **YES** (`translateWarpPointSelection`) | Canvas pointer drag, `setPointerCapture` | Workspaceはcel key更新経由、Layer Transformは`previewLayerWarpEditSession` | WorkspaceはCel key直書き、Layer Transformはsession points | WorkspaceはpointerupでHistory +1、Layer Transformはexplicit KEYで+1 | Points自体はdeformer保存、deltaは揮発 | Normalized [0..1] delta (`point - startPointer`) | Selected points array | Layer WARP transaction baseline | **YES** | **R2** (pure helper即時再利用可、History/terminal adapter要) |
| **E** | **selection clear** | `animation-table-popup.js` (`_clearWarpPointSelection`, Escape keydown) | Workspace `AnimationTablePopup` | `AnimationTablePopup` | **NO** (状態破棄のみでpure helper不要) | Overlay class除去、SVG marquee非表示 | None | None | **NONE** (History 0) | **NONE** | N/A | `this._warpPointSelection = null`, `_warpSelectionMarquee = null` | None | **YES** | **R1 / R2** (controller state reset) |
| **F** | **additive / subtractive selection** | `system/animation/warp-point-selection.js`, `animation-table-popup.js` | Workspace `AnimationTablePopup` | `AnimationTablePopup` (`additive = event.ctrlKey \|\| event.metaKey`) | **YES** (`mergeWarpPointSelection(..., 'toggle')`) | PointerEvent modifier read | None | None | **NONE** (History 0) | **NONE** | Indices | Selection set | None | **YES** | **R2** (toggle存在、strict subtractiveは未実装) |
| **G** | **BRUSH cursor** | `ui/warp-grid-overlay.js`, `system/animation/warp-grid-brush.js`, `layer-transform-warp-controller.js` | Layer Transform / Workspace | `LayerTransformWarpController` / `AnimationTablePopup` | **YES** (`calculateWarpGridBrushWeights`) | SVG `<circle>` (`.warp-grid-overlay-brush`, `.warp-grid-overlay-brush-weight`, etc.) | None (DOM SVG overlay) | None | **NONE** (History 0) | **NONE** | Screen client (px) | Controller `brushCursor` state | None | **YES** | **R1** (WP-008 rough passでoverlay配線済み) |
| **H** | **BRUSH MOVE** | `system/animation/warp-grid-brush.js`, `layer-transform-warp-controller.js`, `animation-table-popup.js` | Layer Transform / Workspace | `LayerTransformWarpController` / `AnimationTablePopup` | **YES** (`calculateWarpGridBrushWeights`, `translateWarpGridBrushPoints`) | Canvas pointerdown/move/up | Pixi interactive preview proxy | Layer WARP transaction session (ANIMATE: `layerDeformers`) | pointermove 0, pointerup candidate保持(0), explicit KEY +1 | Final deformer points | Screen delta -> Normalized WARP points | 16 control points | Transaction baseline | **YES** (粗いが動作) | **R2** (pure helper再利用可、gesture累積adapter修正要) |
| **I** | **BRUSH INFLATE** | `system/animation/warp-grid-brush.js`, `layer-transform-warp-controller.js`, `animation-table-popup.js` | Layer Transform / Workspace | `LayerTransformWarpController` / `AnimationTablePopup` | **YES** (`inflateWarpGridBrushPoints`) | Canvas pointerdown/move/up | Pixi interactive preview proxy | Layer WARP transaction session | pointermove 0, pointerup candidate保持(0), explicit KEY +1 | Final deformer points | Screen/Project distance -> Radial displacement from start pivot | 16 control points | Transaction baseline | **YES** (粗いが動作) | **R2** (pure helper再利用可、gesture累積adapter修正要) |
| **J** | **BRUSH PINCH** | `system/animation/warp-grid-brush.js`, `layer-transform-warp-controller.js`, `animation-table-popup.js` | Layer Transform / Workspace | `LayerTransformWarpController` / `AnimationTablePopup` | **YES** (`inflateWarpGridBrushPoints` with negative amount) | Canvas pointerdown/move/up | Pixi interactive preview proxy | Layer WARP transaction session | pointermove 0, pointerup candidate保持(0), explicit KEY +1 | Final deformer points | Radial displacement toward start pivot | 16 control points | Transaction baseline | **YES** | **R2** (INFLATEと同一adapter) |
| **K** | **BRUSH SMOOTH** | `system/animation/warp-grid-brush.js`, `animation-table-popup.js` | Workspace `AnimationTablePopup` | `AnimationTablePopup` (brush mode: `'smooth'`) | **YES** (`smoothWarpGridBrushPoints`) | Canvas pointerdown/move/up | Pixi interactive preview proxy | Cel key (Workspace) | pointerup History +1 (Workspace) | Deformer points | Topology neighbors averaging | Control points | Frame key | **POOR** (4×4で点崩壊リスク大) | **R3 / R4** (HOLD: 16点での品質/実用性不足) |
| **L** | **modifier key semantics** | `animation-table-popup.js` (lines 15861, 16271, 16723) | Workspace `AnimationTablePopup` | `AnimationTablePopup` | **NO** (controller inline event handling) | Keyboard / PointerEvent | None | None | None | None | Key state | Gesture mode / selection mode | None | **YES** | **R2** (Shift/Ctrl/Escapeの標準化が必要) |
| **M** | **Cage / Bind frame** | `system/animation/warp-bind-frame-transform.js`, `warp-placement.js`, `control-mesh-deformer.js` | Workspace `AnimationTablePopup` (`tool = 'grid' / 'lens'`) | `AnimationTablePopup` | **YES** (`transformWarpBindFramePoints`, `applyWarpPlacementToPoints`, `invertWarpPlacementPoint`) | SVG handles/stem in `WarpGridOverlay` | Evaluator consumes bindPoints/placement | Mutates deformer `bindPoints` + rebases keys, or mutates `placement` | Workspace History (`bind-transform` / `placement-transform`) | Deformer bindPoints / Key placement | Normalized [0..1] / Placement `{x, y, scale, rotation}` | Deformer Bind points or Key placement | Multi-frame rebase or frame placement | **YES** (4×4トポロジ対応) | **R3 / R4** (HOLD: Layer Transform権能未決定) |

---

### 2. Reuse Classification Summary

- **R1 (Reuse As-Is in Layer Transform):**
  - POINT edit gesture and overlay projection (`LayerTransformWarpController`, `WarpGridOverlay`, `layer-warp-edit-transaction.js`).
  - Brush cursor & weight field overlay rendering (`WarpGridOverlay.prototype._brushCursor`, `_brushWeightField`).
  - Selection clear on tool switch or Escape (`_clearWarpPointSelection` semantics).
- **R2 (Reuse Pure Algorithm / Helper with New UI / Controller Adapter):**
  - Rectangle / circle / polyline selection geometry: `system/animation/warp-point-selection.js` (`normalizeWarpPointSelectionRect`, `findWarpPointIndicesInShape`).
  - Multi-point selection state management: `mergeWarpPointSelection` (replace / toggle modes).
  - Selected-point translation: `translateWarpPointSelection(points, selectedIndices, delta)`.
  - Brush math: `system/animation/warp-grid-brush.js` (`calculateWarpGridBrushWeights`, `translateWarpGridBrushPoints`, `inflateWarpGridBrushPoints`).
  - Modifier semantics: Ctrl/Cmd for toggle selection, Shift for constraint/mode switch, Escape for rollback/clear.
- **R3 (Adapter Required / Substantial Architectural Gap):**
  - Brush SMOOTH: `smoothWarpGridBrushPoints` requires `neighbors` table. On Simple 4×4, 16-point smoothing flattens internal mesh toward boundaries immediately, offering minimal workflow value.
  - LENS Placement: `warp-placement.js` requires key-local placement schema not yet adopted for `layerDeformers`.
- **R4 (Current Authority Incompatible / Unresolved Authority):**
  - Cage / Bind frame transform: `warp-bind-frame-transform.js`. Mutating Bind points requires multi-frame key rebase (`rebaseWarpGridBind`), which has no transaction contract in Layer Transform. Mutating placement requires new schema. Mutating BASIC matrix violates transform isolation.
  - Arbitrary FREE / RADIAL mesh topology.
- **R5 (Redesign Required):**
  - Variable grid density switching across existing animated keyframes.

---

### 3. Safe Pure Candidates vs Unsafe Candidates

#### Safe Pure Candidates (DO NOT RE-IMPLEMENT — ALREADY EXIST)
1. `system/animation/warp-point-selection.js`:
   - `normalizeWarpPointSelectionRect(start, end)`
   - `normalizeWarpPointSelectionCircle(start, end)`
   - `normalizeWarpPointSelectionPolyline(points, minDistance)`
   - `findWarpPointIndicesInRect(points, rect)`
   - `findWarpPointIndicesInCircle(points, circle)`
   - `findWarpPointIndicesInPolyline(points, polyline)`
   - `findWarpPointIndicesInShape(points, shape)`
   - `mergeWarpPointSelection(currentIndices, hitIndices, mode, pointCount)`
   - `translateWarpPointSelection(points, selectedIndices, delta)`
2. `system/animation/warp-grid-brush.js`:
   - `calculateWarpGridBrushWeights(points, options)`
   - `translateWarpGridBrushPoints(points, weights, delta)`
   - `calculateWarpGridWeightedCentroid(points, weights, fallback)`
   - `inflateWarpGridBrushPoints(points, weights, options)`
   - `smoothWarpGridBrushPoints(points, weights, neighbors, strength)`
3. `system/animation/warp-bind-frame-transform.js`:
   - `transformWarpBindFramePoints(options)`
4. `system/animation/warp-placement.js`:
   - `normalizeWarpPlacement(value)`
   - `interpolateWarpPlacement(left, right, ratio)`
   - `applyWarpPlacementToPoints(points, bindPoints, bindBounds, value)`
   - `invertWarpPlacementPoint(point, bindPoints, bindBounds, value)`

> [!IMPORTANT]
> 上記のpure helper群は完全に純粋（pure）であり、DOM、Pixi、History、Project、TimelineModelへの依存を持たない。
> これらを複製した`layer-transform-xxx-helper.js`等の作成は「重複数学（duplicate math）」として厳禁とする。

#### Unsafe Candidates (MUST NOT WIRE TO PRODUCTION YET)
- Cage / Bind Frame editing in Layer Transform: 会話・設計上「バウンディングボックスで変形したい」という要望が出やすいが、Bind pointsの書換え・再基準化（rebase）は全キーフレームへの波及破壊を招く。
- Variable Grid Density: 4×4以外の分割数は`advanced-layer-warp-required`として現行Layer WARP入口で意図的にブロックされている。
- Brush SMOOTH: 16点グリッドでは三角形の潰れや極端な平坦化を招き実用性が低い。

---

### 4. Selection Findings

1. **Selection State Authority:**
   - 既存Workspaceにおけるselection (`this._warpPointSelection`) は、`AnimationTablePopup` のインスタンスに保持される完全な **runtime transient UI state** である。
   - Projectファイル（JSON）、Cel/Clipモデル、`layerDeformers`、HistoryManagerのいずれにも保存されない。
   - 将来Layer TransformへSELECTを導入する場合も、同様に **`LayerTransformWarpController` 内のruntime-only state（例: `selectedPointIndices: Set<number>`）** として扱うべきであり、新たなProject schemaや永続モデルを設けてはならない。
2. **Rectangle Selection:**
   - `WarpGridOverlay` には既にSVG `<path class="warp-grid-overlay-selection-marquee">` が備わっており、`getSelectionMarquee()` を通じて描画可能。
   - 矩形判定はスクリーン空間で行われ、`findWarpPointIndicesInRect` で完全に動作する。
3. **Multi-Selection & Move:**
   - 単一点dragと複数点dragの差異:
     - 単一点drag: pointerdownされた点indexの座標のみを直接更新。
     - 複数点drag: `translateWarpPointSelection(startPoints, selectedIndices, delta)` により、選択された全点に同一のnormalized deltaを一括適用。
4. **Modifier Semantics:**
   - Workspaceでは `event.ctrlKey || event.metaKey` で `'toggle'`（反転追加/除外）を行っている。
   - 一般的なグラフィックソフトの文脈（Shift=追加、Ctrl/Cmd=反転、Alt=除外）との整合性はAstra/GUI reviewで標準化の余地があるが、アルゴリズム上は `mergeWarpPointSelection` で即座に対応可能。

---

### 5. Brush Findings & Root Cause Analysis

以前のWP-008 rough passにおいて「Layer Transformでの変形ブラシの挙動がWorkspaceと比べて不自然・ぎこちない」と報告された現象について、WorkspaceとLayerTransformWarpControllerの実装差異を突き止め記録する。

1. **MOVE Brush — 累積方式の決定的不一致:**
   - **Workspaceの実装 (`animation-table-popup.js:16422-16440`):**
     - pointermoveのたびに「現在の最新ポインタ位置」において「現在のメッシュ点」との距離から動的に `movingWeights` を再計算。
     - 前回イベントからの増分差分 `incrementalDelta = { x: point.x - lastPointer.x, y: point.y - lastPointer.y }` を `translateWarpGridBrushPoints(currentPoints, movingWeights, incrementalDelta)` で逐次適用。
     - 結果: ブラシを動かすと、ブラシ通過点にある格子点が吸い寄せられるように自然に引きずられる（dragging feel）。
   - **LayerTransformWarpController rough passの実装 (`layer-transform-warp-controller.js:318-326`):**
     - gesture開始時の `startScreenPoints` に対し、開始位置からの総移動量 `center - startClient` を一括適用。
     - 結果: ブラシをドラッグすると、通過点ではなく「開始時にブラシ範囲内にあった点」だけが開始点からの総ベクトルで硬直的に移動し、不自然な跳ねや歪みが生じていた。
2. **INFLATE / PINCH Brush — 変形量計算の決定的不一致:**
   - **Workspaceの実装 (`animation-table-popup.js:16394-16407`):**
     - gesture開始位置 `warpGesture.startPointer` を固定 `pivot` とする。
     - 開始位置からのドラッグ距離 `distance = Math.hypot(delta.x, delta.y)` を変形量 `amount` とする。
     - 結果: ドラッグ距離に応じて徐々に膨らむ/萎む自然な直感操作。
   - **LayerTransformWarpController rough passの実装 (`layer-transform-warp-controller.js:328-336`):**
     - `pivot` を現在ポインタ位置 `center`（動くポインタ）にしてしまっていた。
     - 変形量 `amount` をドラッグ距離ではなく `sign * radius * strength * 0.45` という固定値にしていた。
     - 結果: マウスを少し動かした瞬間から一定の固定変形量が加わり、さらにpivotが追従するためメッシュが崩壊しやすかった。
3. **Astraへの重要警告:**
   - `warp-grid-brush.js` の数学自体には何の問題もない。
   - 不自然さの原因は **Controller側のジェスチャ累積・パラメータ供給方法（gesture semantics）の欠落** である。
   - 後続AstraがLayer TransformへBrushを再配線する際は、Workspaceのイベント累積文法（MOVEは最新ポインタ位置でのincrementalDelta、INFLATE/PINCHは開始pivotとドラッグ距離amount）を正確に移植する必要がある。

---

### 6. Cage / Bind Frame Findings

1. **Current Workspace Authority:**
   - Workspaceの `GRID` ツールは、変形対象の「Bind基準枠」そのものを操作する。
   - 四隅ドラッグ、回転ハンドル、エッジ拡縮で `bindPoints` が変化すると、既存の各フレームの変形結果がProject空間でズレないよう `rebaseWarpGridBind` / `rebaseControlMeshBind` を呼び出して全ポーズキーを再計算・更新する。
   - `LENS` ツールは各フレームのキーに `{ x, y, scale, rotation }` の `placement` を書き込む。
2. **Why Production Implementation is HOLD:**
   - Layer Transformは「現在の1フレームのレイヤー変形」を即座にプレビュー・確定する編集面である。
   - もしLayer TransformにCageを導入してBind pointsを書き換えた場合、他の全アニメーションFrameのキーを再基準化（rebase）する大規模トランザクションが必要となるが、Layer TransformのHistory/Transaction境界にはそのような全キー一括更新権限が存在しない。
   - 逆に「Cageで動かしたらBASICのLayer Motion行列を書き換える」ようにすると、BASICとWARPの責任境界が破壊され、二重マトリクス問題が発生する。
   - したがって、Cage / Bind frameは **HARD HOLD** とし、Astraによる可逆プロトタイプでも実装してはならない。

---

### 7. Decision Holds

- **DH-1 (Cage Authority):** Bind枠再基準化（全キー波及）、Key Placement（schema拡張要）、BASIC Matrix（責任混同）のいずれも現行契約で安全に導入できないため保留。
- **DH-2 (Selection Tool UI Placement):** SELECTを独立Tool（POINT / SELECT / BRUSH）とするか、POINT時の修飾操作（ドラッグで矩形選択、Shiftクリックで複数選択）とするかのUX決定待ち。
- **DH-3 (Brush SMOOTH Exclusion):** 4×4トポロジにおけるSMOOTHは点収束リスクが高いためLayer Transformスコープから除外（HOLD）。
- **DH-4 (Selection Persistence Exclusion):** selectionは常にruntime transient UI stateに限定し、Project JSONやdeformerモデルへ永続化しないことを固定。

---

### 8. Recommendation for Astra

- **SAFE TO USE (即座に再利用してよいもの):**
  - `system/animation/warp-point-selection.js` 内の全pure関数（矩形/円/線分内外判定、選択マージ、選択点平行移動）。
  - `system/animation/warp-grid-brush.js` 内のMOVE / INFLATE / PINCH計算。
  - `WarpGridOverlay` の既存セレクションマーキー描画機能 (`getSelectionMarquee`) および選択点ハイライト (`.is-selected`)。
- **NEEDS ADAPTER (Astraが接続・修正すべきもの):**
  - `LayerTransformWarpController` にruntimeの `selectedIndices` （SetまたはArray）を持たせ、複数点ドラッグ時に `translateWarpPointSelection` を通すadapter。
  - `LayerTransformWarpController` のBrushジェスチャ累積をWorkspace文法（MOVE: incremental delta on moving weights、INFLATE/PINCH: drag distance from start pivot）へ修正するadapter。
- **DO NOT TOUCH YET (絶対に触ってはならないもの):**
  - Cage / Bind frame transform。
  - 可変GRID密度（Grid Density: 6×6, 8×8等）。
  - Brush SMOOTH。
  - Project schema, HistoryManager command structure, Pixi/CPU evaluation order。
- **BEST NEXT ROUGH IMPLEMENTATION:**
  - Layer TransformのWARP Level 2において、POINT選択中に「空白ドラッグで矩形選択マーキー」「選択点の1つをドラッグで選択群の一括移動」「Escapeまたは余白クリックで選択解除」を行える軽量なSELECT/POINT統合プロトタイプの作成。
  - 並行して、BRUSH MOVE/INFLATEのジェスチャ累積ロジックをWorkspace同等に修正し、自然なストローク操作感を回復させること。

---

### Handoff summary for GPT / Astra

- **CURRENT:** WP-008は可逆rough prototype実装済み（BASIC detail整理、WARP POINT/BRUSH粗実装）。技術検証PASS、Owner/Astra review待ち。
- **SAFE REUSE:** `warp-point-selection.js`（矩形/自由選択判定・マージ・一括移動）および `warp-grid-brush.js`（重み・移動・膨張計算）は完全pure資産であり即再利用可能。
- **NOT SAFE:** Cage / Bind frame操作（全キーrebaseまたはschema変更が必要）、可変Grid Density（schema/評価互換性未解決）、Brush SMOOTH（16点では破綻）。
- **OPTIONAL PURE PARTS:** 既存pure helperが既に完全に抽出・テスト済みであるため、今回のGeminiスライスでの新規コード作成は **NONE — AUDIT ONLY** とした（重複数学の禁止契約を遵守）。
- **SELECTION AUTHORITY:** selection状態はProjectやHistoryに保存しない純粋なruntime UI stateであることを確認。
- **BRUSH CAUSE IDENTIFIED:** 前回rough passでのブラシ不自然さはアルゴリズムではなく、Controller側のジェスチャ累積方式（MOVEの総差分vs逐次増分、INFLATEの固定値vsドラッグ距離）に起因することを特定。
- **NEXT ASTRA INPUT:** (1) `warp-point-selection.js` を用いた複数点選択＆移動のController接続、(2) Brushジェスチャ累積ロジックのWorkspace同等修正、(3) Tool Strip / SelectorのGUI整理。
- **HARD HOLDS:** Cage / Bind frame、可変トポロジ、Project schema変更、History体系変更、レンダラー変更はすべてHARD HOLD。
