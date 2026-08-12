# 変形アニメーション・メッシュ・GPU画材ロードマップ

更新日: 2026-08-11

## 本書の役割

現行のClip Motion / WARP / Bake基盤を、新しいRig、任意Mesh、GPU画材が重複実装しないための境界文書とする。完了Phaseの作業日誌は過去計画の整理前版と`Archive/`に保存し、本書には維持契約と次の分岐だけを置く。

## 確立済みの基盤

### Clip Motion

- 正本は既存`ClipInstance.transform` / `transformKeyframes`。
- position、scale、rotation、anchor、opacity、blend、HOLD / LINEAR / cubic-bezierを同じClip-local Frame契約でsampleする。
- Segment Easing Editorは区間進捗、Motion Graphはparameter実値、Motion PathはCanvas上のXY経路。UIごとに別keyやsample列を保存しない。

### WARP

- GRIDは全Frame共通のBind Setupであり、GRID移動・拡縮・回転だけではRasterを動かさない。
- POINT / BRUSHはFrameごとのPoseを編集する。
- LENS placementはWarp key内の省略可能な`x / y / scale / rotation`で、Bind SetupやClip Motionを置換しない。
- 元Rasterを維持し、Bind triangleだけをsourceから消去してdestination meshへsource-over差替えする。
- CPU reference rasterizerとPixi previewは同じgeometry / samplingを使う。
- 旧Project、key無しCAF、固定4×4 WARP、可変GRIDはoptional field欠損をidentityとして読む。

### Bake

- flatten Bakeは完成Clipを1 Frame 1 Rasterへ展開する軽量入口。
- Layer構造保持Bakeは内部Layer / Folderを複製し、既存Motion / WARP sampleを静的transformとFrame 0 keyへ畳み込む。
- どちらも新しい最上段Laneへ作り、元Clipを非表示で保持する。
- 構造保持Bakeは容量preflight、逐次生成、cancel、原子的rollback、1 Historyを維持する。
- 校正済み安全上限は1GiB。上限超過時は開始前に拒否し、flatten等の明示代替を残す。

## 次の分岐

### Motion編集UI

`10_Motion_Graph・Easing・Motion_Path設計.md`へ集約する。既存key正本を操作し、rendererやMotion modelを増やさない。

### Deformer SELECT

`14_UIツール導線・Text・階層Motion将来設計.md`へ集約する。selection shapeはruntime UIであり、WARP maskやMesh topologyにはしない。

Phase 7jではPhase 7bのRECTをCIRCLE / drag式POLY lassoへ拡張し、shape / path / indexをruntime UIだけに維持した。形状別分岐はscreen marquee / hitに限定し、既存Warp key / selection move / Historyを共有する。SELECT中`M` / active button再clickのshape巡回とBRUSH中`M`維持をSOL review 1=`A`で確認し、2026-08-12にSOL技術closeした。Owner制作確認は別紙で追跡し、soft weight、Mesh vertex選択、mask転用は未実装。

### 任意Triangle Mesh / BONE / Perform

`15_キャラクターRig・Mesh・Perform統合ロードマップ.md`を唯一の統合正本とする。

- WARP Grid schemaを任意Meshへ無理に一般化しない。
- 既存`control-mesh-*`をGate 0で監査し、利用可能なら再利用する。
- MeshVertex、ControlHandle、BONE、Binding、SkinWeightの所有を分離する。
- preview、playback、onion、Bake、exportで同じevaluatorを使う。
- Setup / Animate、Topology lock、stable ID、source STALE、再生成確認を必須とする。

### WebGPU / 水彩 / 油彩

`05_長期研究_AI・WebGPU・物理.md`へ隔離する。WARPや任意Meshの導入を理由にrenderer全体をWebGPU化しない。

### WARP Bind Frame / topology操作追補（Owner memo 2026-08-09）

WARPの枠操作と内部Pose編集を分ける。最初に現行GRID回転がProject座標で剛体回転になっているか監査し、正方形 / 長方形の辺長、対角長、中心、角度だけが変わりshearしないことを固定する。aspect比やnormalized座標の混在で形が歪む場合は新機能ではなく限定bug fixとして先に直す。

- `FRAME`の通常操作は中心移動、uniform scale、shape-preserving rotation。回転handleはBind枠全体を一つのaffine matrixで動かし、control pointを順次回転して誤差を蓄積しない。
- 変形枠の追加modeは、`CORNER`一頂点、`EDGE`二頂点、`SHEAR`平行四辺形を分ける。一頂点だけ動かす一般quadと、二点を連動させる台形 / 平行四辺形を同じ名前で曖昧にしない。
- Shift / Ctrlはdesktopのaccelerator候補に留め、handle選択時の状態表示またはmode切替を正本にする。現行Shift drag / Shift wheel、複数選択、Camera操作との競合を監査し、touchでも同じ操作へ到達できることをGateにする。
- `RECT`に加えて`RADIAL` topology generatorを候補とする。Circle / ellipseの境界ring、必要な中間ring、center / interior点をtriangle接続し、円外は元Rasterを維持する。これはSELECTの円形marqueeや保存maskとは別物で、WARP Bind topologyの種類である。
- 旧fixed 4×4 / rect Control Meshはそのまま読み、既存ProjectをCircleへ遡及変換しない。RECT / RADIAL間の変更はTopology変更として既存keyの破棄preview、confirm、Undoを必須にする。
- Auto Shape Meshとcontent-fit WARPは同じ輪郭解析を再利用できるが、Skin MeshとWARP Poseを暗黙共有しない。まずgenerator出力を共通pure dataとして比較し、所有、stable ID、再生成、二重変形を説明できた場合だけstatic topology参照共有をGate化する。

推奨Phase順は、`回転不変性の固定fixture → FRAME / CORNER / EDGE操作 → RADIAL topology → Auto Shape foundation`。一度にschema、UI、rasterizerを変更しない。Phase 7e / 7f / 7gはOwner受入でcloseした。Phase 7hもalpha island / outer / hole、interior-support FILL、topology検査付き輪郭削減、透明側guard、256 vertex budgetを既存Mesh / SkinとSetup青RIGの`AUTO SHAPE`へ限定接続し、SOL review 1〜5=`A`とOwner軽量実機受入でcloseした。Phase 7iはLINE / Ribbonのpure centerline、`left / center / right`三列topology、2〜3 direct-chain BONEのlongitudinal weight / LBS proofをStage A〜Cで固定し、Stage Dで既存Model / Setup青RIGへ明示`AUTO LINE`を限定接続してSOL review 1〜4=`A`を通過した。外部UI reviewの限定採用と100頂点超の一時preview Mesh batch固定を含め、全49 verifier、build、Browserの切替 / Undo / Redo / 拒否非mutation / console warning・error 0件を確認し、2026-08-12にSOL技術closeした。WARP PoseとBone Poseは統合していない。独立するPhase 7jはruntime Deformer SELECT shapeだけを拡張し、Mesh / Skin正本へ接続していない。

## 追加候補とPlan B

| 論点 | 第一候補 | Plan Bと切替条件 |
|---|---|---|
| WARP初期Bind | Phase 6uで新規GRIDをcontent tight boundsへauto-fit済み | Canvas全体が必要な場合は明示選択とし、既存GRIDへ遡及しない |
| WARP境界 | 現行triangle境界と透明samplingを維持 | 境界の視覚破綻が固定入力で再現した場合だけedge lock / guard ringを検討。保存maskは増やさない |
| 任意Mesh開始点 | 固定Triangle proof | 既存Control MeshがCPU / exportまで十分なら、そのmodelを最小拡張する |
| Mesh操作 | sparse ControlHandle + BONEを目標 | 精密編集が必要ならDirect Vertexを併設。どちらも同じMesh Definitionを操作する |
| GPU backend | 現行Pixi / WebGL + CPU reference | 計測優位とfallbackが揃った限定adapterだけWebGPUへ切替 |

## 共通受入gate

- 同じFrameのpreview / playback / onion / thumbnail / Bake / exportが同じsample結果を使う。
- 負origin、欄外Raster、透明境界、Raster外、部分重複、複数Lane、Folder clippingで一致する。
- pointercancel / lost captureで変更を残さない。
- 1 gesture = 1 History。
- save / reload / copy / paste / Undo / Redoでstable IDと結果を維持する。
- 新機能未使用Projectのpixelを変えない。
- runtime cache、GPU resource、raw pointer sampleをProject正本にしない。
- 新しいmask、Motion、Mesh、physics正本を既存経路と並行して作らない。

## 停止条件

- CPUとpreviewで別の座標基準が必要になる。
- exportだけ別solver / evaluatorを持つ。
- Topology変更が既存Animationを無言破壊する。
- clipping / blendのRenderIsland境界を説明できない。
- 容量preflightなしに全Frame / 全Layer / 全Vertexを一括常駐する。
- 旧Project fallbackが新機能の初期化に依存する。

該当時は機能を小さいPhaseへ戻し、現行Motion / WARP / Bake基盤を優先して維持する。
