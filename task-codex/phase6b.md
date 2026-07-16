# Phase 6b: Warp互換維持・Control Mesh移行gate

更新日: 2026-07-17

## 目的

Phase 6で固定したWarp Grid v1を壊さず、固定16点の簡易Warpと、自由なcontrol point / triangleを持つControl Meshを別機能として分離する。4×8 / 8×8等の格子はWarp v2ではなくControl Meshを新規作成するpresetとし、自由点追加も同じMesh topologyへ接続する。Shape Morph、親子Transform / Boneはさらに分離する。

Phase 6bの現在Sliceでは純粋Mesh topology、独立schema、CPU / Pixi adapter、矩形作成UIを順に接続する。Bone、physics、deform brush、WebGPU renderer既定化は同時に実装しない。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
9. `開発用資料保管庫/proposals/10_Motion_Graph・Easing・Motion_Path設計.md`
10. `tegaki_work/system/animation/warp-grid-deformer.js`
11. `tegaki_work/system/animation/warp-grid-rasterizer.js`
12. `tegaki_work/system/animation/timeline-frame-compositor.js`
13. `tegaki_work/ui/warp-grid-overlay.js`
14. `tegaki_work/ui/animation-table-popup.js`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/` は調査・編集しない。

## Slice 0 — 固定Warp v1 closeout回帰と前提監査

- Phase 6 Bake後のCAF列をProject serialize / restoreし、元非破壊Clipの非表示、baked Snapshot / Asset / Clip、Raster bounds、blend mode / strengthが欠落しないことを固定入力で確認する。
- baked列と元Warp Clipを同じ整数Frameでanimation exportへ通し、alpha、負origin、Clip Motion、Lane前面順、Folder clippingの評価差を調べる。差があれば任意Meshへ進まずPhase 6回帰として直す。
- `4 / 4×4 / 16点 / 18 triangle / 24線` のハードコード箇所を全列挙し、schema正本、pure topology、CPU rasterizer、Pixi adapter、DOM overlay、UI labelへ分類する。
- Phase 6 v1 Projectは読み書き結果を変えない。v1を可変Gridとして推測解釈したり、保存時に自動v2化したりしない。

## Slice 1 — Control Mesh topologyの純粋基盤

- 旧Warp Gridは固定4×4 / 16点の軽量互換機能として維持し、GRID RANGE / CAGEで基準Raster範囲を変えるUIは撤回する。通常のオレンジPOINTS編集だけを残す。
- `control-mesh-topology.js`をDOM / Pixi / Canvas / 保存schemaから独立させ、矩形密度presetと任意点の決定的triangulationを提供する。入力を変更せず、重複点、非finite、一直線、最大点数の失敗契約を固定する。
- 4×8 / 8×8等は新規Control Meshの初期配置presetとする。既存Warp Projectを読み込み時・保存時にMeshへ自動変換しない。
- 自由点追加は同じMesh pointsへ追加して全triangleを再生成する。点削除、edge split、穴、手動triangle、fold順はschema / rendererを固定した後の別gateとする。

## Slice 2 — 実制作UI gate

- Control Mesh作成時は`横点数 × 縦点数`の2つのnumber inputを主操作にし、各2〜32・総点数256以下を同じvalidatorへ通す。`8×8 / 16×16`を置く場合も正方形の補助presetだけとし、長方形は自由入力で作る。preset専用schemaやselect option列挙は作らない。
- 作成値は点数でありcell数ではないことをlabel / tooltipへ明記する。入力上wheelで1刻み、既存number inputと同じふたば色focusを使い、積が上限を超える間は作成buttonをdisabledにして`現在点数 / 256`を表示する。
- 別入口として自由点modeを選べるようにする。作成後のpoint追加は全key topologyを変えるため、明示rebuild transactionと1 Historyにする。
- Meshは`bindPoints / triangles / pose key points`を所有し、Warp Gridの`columns / rows`や16点keyへ代理保存しない。Bind編集とAnimate key編集を明示的に分ける。
- control point hit / drag / multi-select / snap / brush influenceは共通controller候補だが、Warp GridとControl Meshの保存schemaは共通化しない。
- 膨張・変形brushはcontrol pointへの一時的なfalloff操作として検討し、Raster brushやMotion X/Yへ代理書込みしない。
- Live2D Cubismの変形ブラシは、変形・膨張・整形が同じ分割点へ作用し、重み、円 / 正方形 / 線、サイズ、角度、硬さを入力設定として持つ。この考えだけを採用し、設定値やweight colorをProjectのdeformer schemaへ保存しない。
- ToonSquid型の少数点直接dragを既定操作として残し、Brushは明示modeへ切り替えた時だけ有効にする。暗黙のpoint / brush切替は行わない。
- 将来のBrush controllerはscreen-spaceのcenter / size / shape / angle / hardnessから各点のweightを計算し、Project座標deltaを現在poseへ適用する。膨張 / 収縮の中心はbrush中心だけでなく、影響点の加重重心`sum(weight * point) / sum(weight)`を候補とする。
- 整形brushのneighbor参照は矩形Grid topologyのedge adjacencyを使い、overlayやDOM順から近傍を推測しない。1 strokeはpointerdown前poseから計算し、pointerup 1 History、cancel時復元とする。
- CLIP MOTIONのMotion / Warp key切替、key横drag、CAF配置抑制はPhase 6契約を維持する。Property専用LaneはMotion Graph側の別gateとする。
- CLIP MOTIONはMotion / Warpを明示tabで切り替える。選択中の詳細だけを表示し、非選択側はtabのkey件数で存在を残す。inactive側の値を同時編集可能な薄色表示にはせず、既存の`_motionTimelineKeyKind`を表示focusとTimeline key drag対象の単一状態として共有する。
- WARP tabはDeformer未作成なら`横点数 × 縦点数`のControl Mesh作成と軽量4×4 Warpを選択表示し、暗黙作成しない。作成後は現在Frame keyを保証して即point editへ入る。Motionへ戻る、popupを閉じる、再生開始ではoverlayを終了する。tab iconはMotion / Warpで同寸法とし、inactive / disabled / tooltipもbrowser既定の白灰黒へ任せない。
- header actionは両tabで `現在key -> 前/次key -> 基準へreset -> copy/paste -> 全key削除` の順を共有する。前/次button上のwheelも同じkey navigationへ接続し、Frame移動だけではHistoryを作らない。Motion固有のCurve / Pivotは共通key操作の後、Warp固有のBind範囲調整 / Bake / Grid全削除は下段contextへ置く。
- WARP tab自身が作成・point edit開始を所有するため、重複するGrid ON/OFF iconや「編集終了」buttonは置かない。終了条件はtab切替、popup close、再生開始、現在key削除とする。固定Warpは現在FrameのPOINTS編集へ集中する。
- Warp overlayは通常のpose / point編集をふたば選択色の橙とmaroonで表示する。青いGRID RANGE / CAGE modeは撤回し、popup / button / tooltipのinactive色もふたばpalette契約を維持する。
- Mesh全体の位置・大きさ・回転は将来のBind全点選択変換とし、Motion transformへ重複保存しない。四隅操作が必要なら通常POINTS側のmulti-select / cage gestureとして検討し、別の描画制限range正本を作らない。
- 四角 / 円の範囲選択は、既存control pointsへ選択またはsoft weightを与えるruntime toolとして先に検討する。円形デフォーマTopologyそのものとは分け、選択形状をProject schemaへ保存しない。範囲を縮めて点を局所集中させる操作は可能だが点数は増えないため、局所解像度の増加を可変密度Gridの代替とはみなさない。
- Control Mesh導入後の下段tool switchは`POINT / SELECT / BRUSH`を明示し、暗黙切替しない。SELECTは複数点や四隅をまとめて操作するgestureであり、独立したCAGE正本を作らない。BrushはLive2D型の変形 / 膨張 / 絞り / 整形を同じcontrol pointsへ適用し、`B`保持dragによるscreen-space size変更を候補とする。stroke設定やweightをProject正本へ増やさず、pointerup時のposeだけをkeyへ確定する。

## Control Mesh schema / rendererへ進む条件

- 矩形presetと任意点triangulationが固定入力で決定的に動き、旧Warp表示・保存へ影響しない。
- `vertices / uv / triangles` の所有者、Bind / Animate key、Topology変更History、Raster bounds、Bake、Project互換を一つのschemaで説明できる。
- 自己交差、degenerate triangle、点削除、edge分割、穴、clippingの失敗契約を固定入力で扱える。
- CPU referenceを維持し、Pixi / 将来WebGPUは同一Topologyとsamplingのadapterに留められる。

## 分離する将来系列

- 平面上の時計盤と針のような親Warp + 子回転は、任意Meshではなく明示的な親子評価順 / Bone候補として扱う。
- Live2D風Shape MorphはRaster Warpとは別にoutline / vector path正本を必要とするため、Grid密度拡張へ混ぜない。
- Bone、IK、constraint、physics、Lane間parentingはPhase 6bの最初のSliceへ入れない。
- Layer Transformの破壊的Warpは、ClipInstance非破壊deformerと正本を共有せず、pure topology / rasterizerだけを再利用する別Phaseとする。

## 維持する契約

- 評価順は `ClipAsset内部Layer合成 -> Deformer -> Clip Motion -> Lane合成`。
- ClipAsset / DrawingSnapshotは元Raster正本、deformerはClipInstance正本。
- working Layer、preview staging交換、preview container順、上側Lane前面、PSD record順を変更しない。
- Lane / Timeline onionとoverlayはdisplay-only。保存画像、export、visibility、History正本へ混ぜない。
- keyなし / deformerなし旧Project、固定Warp v1 Projectは従来表示と一致する。

## 検証

- 変更JSの`node --check`。
- 4×4 topology完全一致、最小 / 最大候補Grid、duplicate / out-of-range key、hold / linear、negative originを固定入力で確認する。
- Project round-trip、History、CAF copy / paste、retiming、Bake、animation exportを確認する。
- `npm.cmd run build`。
- UI接続後はBrowserでpoint drag、Motion / Warp key drag、Undo / Redo、再生、onion、Project復元、export、console errorなしを確認する。
- build後に`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。

## 現在Slice完了条件

- Phase 6 Bake列の保存 / export回帰がない、または原因がPhase 6回帰として修正されている。
- 固定4×4前提の一覧がschema / pure logic / adapter / UIへ分類されている。
- 固定WarpとControl Meshの責務境界、v1互換、Mesh用pure topology入口が確定している。

## Slice 0開始時監査

- schema正本: `warp-grid-deformer.js` がversion 1、columns / rows=4、point count=16を受理条件として持つ。これはv1互換のため変更せず残す。
- pure topology: `warp-grid-rasterizer.js` のtriangle生成は既にcolumns / rows定数からcellを走査するが、module内privateでCPU / Pixiだけが利用している。Phase 6bの最初の抽出候補とする。
- overlay adapter: `warp-grid-overlay.js` は16点をliteral loopしている。topology edgeはoverlay側で別生成しているため、pure helperのconsumerへ変更する候補。
- UI mutation: `animation-table-popup.js` にpoint index上限16、pose length 16、`16 bind points`表示が残る。schema判定とUI labelを混同せず分類して置換する。
- `TimelineFrameCompositor`内の16はsurface上限16MPでありGrid point数ではない。数値検索だけでGrid前提として変更しない。
- pure topology入口として`warp-grid-topology.js`を追加し、row-major point metadata、normalized座標、overlay edge、edge adjacency、triangleを一度だけ生成する。固定4×4 v1 schemaは変更せず、deformer既定点、CPU / Pixi indices、DOM overlayが同じtopologyを参照する。
- GRID RANGE / CAGEは実機評価で描画制限に見え、自由点Meshへの入口にもならないため撤回する。固定Warp UIはPOINTS専用へ戻し、旧Warp schema / sampling / exportは変更しない。
- `control-mesh-topology.js`を新設し、矩形presetと任意点Delaunayを保存・描画へ未接続の純粋gateとして検証する。次は新しいControl Mesh schemaを設計してからrenderer / UIへ進む。
- `control-mesh-deformer.js`へ旧Warpと分離したversion 1 schemaを追加する。矩形作成は同じ`横点数 × 縦点数`validatorからbindPoints / trianglesを作り、自由点作成も同じschemaへ正規化する。UIへ表示する前にround-tripとCPU rendererを接続する。
- `control-mesh-rasterizer.js`、`clip-deformer.js`を追加し、Timeline compositor / Pixi preview / overlay / key操作をtype dispatcherへ接続した。旧Warp schemaを変更せず、Meshは独自trianglesとpoint数を使う。
- WARP tab未作成時に8×8初期値の自由入力UIと4×4 Warp互換入口を表示する。4×8固定入力は32点・42 triangle・73 edge、Browserは32点/73辺、popup close後overlay 0、console errorなし。次は自由点追加/削除とTopology変更1 Historyを実装する。
