# 変形アニメーション・メッシュ・GPU画材ロードマップ

更新日: 2026-07-28

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

### 任意Triangle Mesh / BONE / Perform

`15_キャラクターRig・Mesh・Perform統合ロードマップ.md`を唯一の統合正本とする。

- WARP Grid schemaを任意Meshへ無理に一般化しない。
- 既存`control-mesh-*`をGate 0で監査し、利用可能なら再利用する。
- MeshVertex、ControlHandle、BONE、Binding、SkinWeightの所有を分離する。
- preview、playback、onion、Bake、exportで同じevaluatorを使う。
- Setup / Animate、Topology lock、stable ID、source STALE、再生成確認を必須とする。

### WebGPU / 水彩 / 油彩

`05_長期研究_AI・WebGPU・物理.md`へ隔離する。WARPや任意Meshの導入を理由にrenderer全体をWebGPU化しない。

## 追加候補とPlan B

| 論点 | 第一候補 | Plan Bと切替条件 |
|---|---|---|
| WARP初期Bind | 新規GRIDはProject Canvas枠 | content tight boundsが実制作で多数必要なら明示`Fit to Content`を追加。既存GRIDへ遡及しない |
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
