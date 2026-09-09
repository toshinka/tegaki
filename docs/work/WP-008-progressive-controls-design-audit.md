# WP-008 — Progressive Controls Design / Audit Evidence

状態: **PLANNED — DESIGN / AUDIT FIRST**  
Production実装: **未開始**  
監査baseline: `d7fce78abda96e550b1b03000903e9583c333582`  
監査日: 2026-09-08

## Scope and stop boundary

この資料は、既存WARP Workspaceの能力とLayer Transformへ接続する場合の境界を、現行production sourceからread-onlyで整理したものです。WP-008のprogressive controls production code、保存schema、History、renderer、UI構造は変更していません。WP-005の可逆glass CSS prototypeだけは下記の別枠へ記録します。

WP-005はこの監査資料によってOwner受入済みにはなりません。今回のglass実験中は`ACTIVE — OWNER ACCEPTANCE BLOCKED`、A/B technical pass後は`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`へ戻す。WP-008自身は`PLANNED — DESIGN / AUDIT FIRST`を維持します。

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
- 最終推奨alphaは`.72`、blurは`3px`、recommendationは`KEEP`。これはOwnerの「約10ポイント追加透過」を反映したCSS tokenの調整であり、progressive-controls production開始、opacity setting、placement redesignではない。WP-008は`PLANNED — DESIGN / AUDIT FIRST`を維持する。

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
