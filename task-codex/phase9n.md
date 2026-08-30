# Phase 9n — RIG / Motion Responsibility / Contextual Right RIG Inspector Gate

作成日: 2026-08-29
更新日: 2026-08-30

状態: ACTIVE — Gate 0=`GO — D: Dedicated Right RIG + Motion handoff`。Stage A / B / C1 checkpoint完了、次はStage C2 Raster method fork Gate

## 1. 目的

Animation Table、右Layer Panel、Canvasへ分散したRIG入口を、既存の保存・History・solver正本を変えずに再配置する。`Layer = 対象`、`RIG = 時間に依存しない身体構造`、`Animation Table = 時間変化`、`Canvas = 直接操作`へ責務を分ける。

一枚Rasterの曲げRIG / 全体PIVOTと、Folder配下の頭・体・腕等を親子で動かすRIGの入口を、選択対象に応じた右RIG Inspectorへ集約する。WARPはBind / topologyをRIG、key / interpolation / Frame poseをMotionへ分ける。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/proposals/17_RIG・Motion責務再配置Architecture Gate.md`
7. `開発用資料保管庫/Archive/phase9m.md`
8. `開発用資料保管庫/Archive/phase9l.md`
9. `開発用資料保管庫/Archive/phase8d.md`
10. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
11. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
12. `tegaki_work/system/animation/rig-authoring-status-projection.js`
13. `tegaki_work/ui/layer-panel-renderer.js`
14. `tegaki_work/ui/animation-table-popup.js`

## 3. 現行実装監査

- Animation TableがFolder `+RIG`、Raster `RIG設定`、BONE、AUTO GRID / SHAPE / LINE、MESH EDIT、WEIGHT、Motion、WARP setup / keyを同時に所有する巨大surfaceになっている。
- 右Layer属性Popupにも`+RIG`と`ROOT BONEを作成`があるが、mutationは`registerInternalRigPartFromExternal()`等でAnimation Tableへ委譲される。入口は二重だがauthorityはTable寄り。
- 右Panelは`right-panel > layer-panel-container`一つで、通常35px rail＋約132px contentのcontext dock。第二列を常設するとCanvasをさらに狭める。
- Phase 9lにより、Table visibilityとは独立したCAF editing contextと`selectedInternalLayerId`共有が既に成立している。RIG tabもTable open / closedへ依存させない。
- static正本は`ClipAsset.rigDefinition / meshDefinitions / skinBindings`、temporal正本は`ClipInstance.rigMotion`。UI分離は既存データ分離と一致する。

## 4. Gate 0比較と判定

| 案 | 配置 | 判定 |
|---|---|---|
| A Current | Animation Table内へRIG / Mesh / Motionを同居 | HOLD。既存fallbackとして保持 |
| B Layer-integrated | 各Layer card / 属性Popupへ全RIG操作 | HOLD。visibility等と専門操作が競合 |
| C Dedicated left | Animation Tableと同じ左launcher側にRIG surface | Plan Bとして保持。Setup / Motionの並びは説明しやすいが、対象Layerが右、編集面が左となり視線とpen移動が往復する |
| D Dedicated right + Motion handoff | 右の同一dockを`LAYERS / RIG`で切替、TableはMotion中心 | **GO** |

### Dを選ぶ根拠

- Layer選択、描画修正、Mesh / Weight再確認が同じobject contextで循環する。
- 左sidebarはpopup launcher / temporary modeの低幅railであり、専門Inspectorの恒常content ownerではない。
- SpineのSetup / Animate分離、Live2DのModeling / Animation分離、ToonSquidのLayer→Inspector→Canvas→Timeline key導線と整合する。
- Adobe AnimateのTimeline parentingは`Layer = Timeline row`が強く一致する場合の有効な反例だが、Tegakiのnormal Layer / CAF internal Layer / Table lane / mirror構造へ直輸入すると正本が曖昧になる。
- 右へ第二列を増やさず、同じ幅のcontentを切り替える。wide split / pinは実測後の将来候補。

公式資料確認日: 2026-08-29

- Spine UI: https://en.esotericsoftware.com/spine-ui
- Live2D Modeling Menu: https://docs.live2d.com/en/cubism-editor-manual/modeling-menu/
- Live2D Timeline: https://docs.live2d.com/en/cubism-editor-manual/timeline-basic-operation-timelinepalette/
- ToonSquid Inspector / Effects / Bones / Mesh: https://toonsquid.com/handbook/layers/inspector/ / https://toonsquid.com/handbook/effects/effects/ / https://toonsquid.com/handbook/effects/bones/ / https://toonsquid.com/handbook/effects/mesh/

## 5. 選ばなかった案の保管

- A / B / CとDの切替条件はproposal 17へ残し、実装済みDへ不満が出た場合の再比較元とする。
- C leftを再検討する条件は、right dock切替回数が多い、Canvas直操作中にLayer構造を同時参照できない、narrowでright dockが手を隠す等が実測された時。
- Bを再検討する場合もLayer Panelへ詳細を埋めず、status / handoff以上を増やす理由をfixtureで証明する。
- rejected案をArchiveへ隠さず、未実装の比較proposalとして保持する。production Phase指示書へはGO案だけを限定契約化する。

## 6. Stage A — shared status projection（checkpoint完了）

対象:

- `tegaki_work/system/animation/rig-authoring-status-projection.js`
- `tegaki_work/ui/layer-panel-renderer.js`
- `tegaki_work/styles/main.css`
- `tegaki_work/build/verify-rig-authoring-status-projection.mjs`

Acceptance Criteria:

- `none / parent / bend / whole / conflict / stale`をClipAsset static正本からpure導出する。
- DrawingSnapshot鮮度は既存Model adapterが導出し、projectionへ表示入力として渡す。第二Snapshot / Mesh正本を作らない。
- Folder Partは`親子`、Mesh Rasterは`曲げ`、Raster Partは`全体`として右Layer badgeに出す。
- conflict / staleは意味のある警告状態として区別し、色だけでなく文字とtooltipを持つ。
- selection、ClipInstance.rigMotion、History、save、solver / evaluator、Table open / closedを変更しない。

Checkpoint（2026-08-30）:

- projectionの6状態、背景拒否、root Bone / Skin binding、conflict優先、renderer / CSS接続を限定verifierで固定した。
- 全119 verifier、対象JSの`node --check`、production buildを通過し、build生成差分を清掃した。
- Browserで一枚Rasterの`全体PIVOT`を設定し、右badge=`全体` / `data-rig-status=whole` / tooltip、Table open / closedでの継続、480×800での右dock内収まり、console warning / error 0件を確認した。
- 追監査で、空Folderは既存model契約上も有効な将来のPart containerとして登録可能と確認した。Stage Aでは登録action自体を露出せず、対象を作らず状態だけ偽装する変更は入れていない。parent / bend / stale / conflictはpure fixtureで固定した。

## 7. Stage B — read-only RIG Panel shell（checkpoint完了）

- `right-panel`を二列にせず、CAF editing context時だけ同一dockへ`LAYERS / RIG`切替を出す。
- `selectedInternalLayerId`を共有し、第二selection stateを作らない。
- RIG headerはStage Aと同じprojectionを使う。最初は対象名、kind、status、method説明だけのread-only。
- Tableを閉じてもCAF contextがactiveならRIGを表示できる。
- normal drawing contextではRIG tabを露出しない。

限定契約（2026-08-30）:

- 対象は`ui/layer-panel-renderer.js`、`styles/components/layer-panel-surface.css`、新規限定verifierだけ。`dom-builder.js`とAnimation Table DOMは変更しない。
- `LayerPanelRenderer`へ保存しないview lens `layers | rig`だけを持たせる。target / asset / clipの第二stateは作らず、毎renderで`selectedCelId / selectedInternalLayerId`とClipAssetから再導出する。
- 132px content columnと右railのfootprintを維持する。RIG view中はLayer mutation railをaccessibility treeごと隠すが、列幅を畳んでCanvas上の位置を動かさない。
- switchはnative button＋`aria-pressed`、RIG bodyは`role=region`。対象未選択 / 対象外 / none / parent / bend / whole / stale / conflictを文字で読めるようにする。
- 外枠を増やさず、resting tabはquiet、active tabだけ橙surface / indicator、focus-visibleは橙outlineとする。Setup青はmutation actionがまだ無いため使わない。

Checkpoint（2026-08-30）:

- 既存132px content columnへCAF選択時だけ`LAYERS / RIG`を投影し、right Panel DOM ownerと172px footprintを増やしていない。
- RIG viewは`selectedCelId / selectedInternalLayerId`、ClipAsset、Stage A projectionから対象名 / kind / status / methodを毎renderで再導出する。view lensはruntime-onlyで、normal drawingへ戻ると`layers`へresetする。
- RIG view中のLayer mutation railは`visibility: hidden`でaccessibility treeから外し、列幅は維持する。`LAYERS`へ戻すと同じrailとinternal Layer mirrorを復帰する。
- 全120 verifier、対象JSの`node --check`、production buildを通過した。Browserでnormal drawing非露出、CAF pointer / Enter / Space往復、RIG未設定Raster、Table close後の継続、480×800で172px内、console warning / error 0件を確認した。

## 7.1 Stage C1 — RIG対象登録（checkpoint完了）

- Stage Bの`RIG 未設定`だけへ明示Setup actionを追加し、既存`registerInternalRigPartFromExternal(assetId, layerId)`を再利用する。
- 最初の一SliceはFolder / RasterをClipAssetの`parts[]`へ登録するsurfaceだけ。ROOT BONE、全体PIVOT、Mesh BONE、AUTO GRID / SHAPE / LINE、Weight、Mesh editはまだ移さない。
- 成功 / no-op / 対象外 / clipping・target rejectを既存adapter結果から表示し、右Panel側でClipAssetやHistoryを直接mutationしない。空Folderは既存model契約どおり登録可能で、新しい拒否条件を作らない。
- Setup青はこの明示mutation buttonだけへ使い、status、tab、read-only cardへ拡散しない。

Checkpoint（2026-08-30）:

- `RIG 未設定`かつeligibleな対象だけへSetup青actionを出し、Folder=`親子RIGを開始`、Raster=`全体PIVOTを開始`として結果の方法を明示した。Rasterの`曲げRIG`はまだ移管せず、現行Animation Table `RIG設定`へのhandoffを残す。
- clickはfreshなCAF / internal Layer一致を再確認し、既存`registerInternalRigPartFromExternal()`だけへ委譲する。右Panelは`rigDefinition` / Historyを直接変更しない。
- 全121 verifier、対象JSの`node --check`、production buildを通過した。BrowserでRaster登録、status `none -> whole`、History `0 -> 1`、Undo / Redo、Table閉鎖後継続、wide / 480×800、console warning / error 0件を確認した。

## 7.2 Stage C2 — Raster method fork Gate（次）

- 一枚Rasterの入口を`曲げRIG`と`全体PIVOT`へ明示分岐し、現在の汎用`RIG設定`とC1 actionの意味差を同じ右RIG面で読めるようにする。
- 最初は既存の曲げRIG setupを開くhandoff / adapterを監査し、新しいMesh / Bone / Weight mutationやmode flagを作らない。
- Folderの`親子RIG`、Rasterの`曲げRIG / 全体PIVOT`を同じ情報階層で比較し、選択後の戻り先、Table open / closed、空target、既存Rigありを固定してから一actionずつ移す。

## 8. 後続Stage

- Stage C: C1のRIG対象登録から、既存Animation Table external adapterを再利用してsetup mutationのsurfaceだけを右RIGへ一操作ずつ移す。model logicを一括移動しない。
- Stage D: 右経路がproductionで成立してからAnimation Table内のstatic RIG DOMを段階撤去し、Motionと`RIGを設定 >` handoffだけ残す。
- WARP: Bind / GRID / topology / child pivot bindingはRIG、key / interpolation / current Frame poseはAnimation Table。

## 9. 非対象 / STOP

- ClipAsset / ClipInstance / Project schema、History semantic、solver、Skin / Weight algorithm、WARP key schemaを変更しない。
- LayerSystemとCAF modelを統合しない。
- right Layer rendererやAnimation Tableを全面置換しない。
- 第二selection、第二Rig model、Table visibility依存のauthorityを作らない。
- right二列常設、width永続化、wide splitを同時実装しない。
- Clip Focus、dark top / bottom、Lane濃淡、Animation Table枠削減を本Phaseへ混ぜない。

## 10. 検証

```powershell
node tegaki_work/build/verify-rig-authoring-status-projection.mjs
node --check tegaki_work/system/animation/rig-authoring-status-projection.js
node --check tegaki_work/ui/layer-panel-renderer.js
Set-Location tegaki_work
npm.cmd run build
```

UI Sliceではnormal drawing / CAF、Folder parent / Raster bend / Raster whole / stale、Table open / closed、wide / narrow、console errorをBrowserで確認する。build後は生成`dist/`差分を残さない。

## 11. model分担

- Gate、left / right判断、projection contract、Phase closeはSOL / MAX。
- Stage B / C1はcheckpoint完了。Stage C2のRaster method fork、既存曲げRIG handoff、Phase判断はSOL / MAX。
- mutation、History、selection、schema判断が必要になったらLUNAは変更せずSOLへ返す。

## 12. Owner UI follow-up / 後続Gateへ保留

- 右Frame stripの二つのghostは、OFF時からTimeline=淡色、Lane=茶色として軸の違いを示し、ON時はどちらも枠なし橙surfaceへ上げる。onion state / wheel / click / ARIAは変更しない。
- `Frame + Timeline onion + Lane onion`、`CAF / Lane identity`、Animation Table本体が上下に分かれ、同じ時間文脈が別Panelに見える懸念を後続UI/UX Gateへ残す。Phase 9nではRIG責務再配置へ集中し、選択・Frame・Lane・Timelineの正本を統合しない。
- 後続Gateでは、同一alignment / connector band / context label / Table dock連続化をfixture比較し、右CAF情報をTimelineへ単純移設する案と、現行分離を保つ案の両方を保存する。
