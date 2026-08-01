# 18. BONE・メッシュ・モーションパフォーム統合計画（上位提案）

更新日: 2026-07-27  
文書区分: **未実装上位提案書 / Phase 7以降の計画材料**  
最終調査・設計・実装判断担当想定: **CODEX**

> **文書の目的**  
> 本書は、TegakiにおけるBONE、CAF内部Part、TriangleMesh、SkinWeight、IK／親追従、伸縮、動的描画順、モーションパフォームを、単一の制作体験へ接続するための上位統合提案である。  
> 個別提案15・16・17を置き換えるものではなく、それぞれを下位設計資料として参照し、機能間の責任境界、評価順、データ所有、段階導入、調査Gateを定義する。  
> 本書は実装指示書ではない。CODEXは現行コードを再調査し、重複実装、保存正本、描画経路、History、性能、旧Project互換性を精査した上で、正式なPhase計画を作成する。

---

## 0. 統合計画を作る理由

BONE、Mesh、Motion Performを個別に導入すると、次の重複や衝突が起きやすい。

- BONEとMeshが別々に親子階層を保持する
- Clip MotionとBONE Motionが同じ位置・回転を重複所有する
- Mesh側とBONE側の双方がBinding正本を持つ
- Motion Performが完成PoseとIK Targetのどちらを記録するか不明になる
- CAF内部Part変形とMesh変形で二重に座標変換する
- preview、playback、onion、exportで異なる評価器を使う
- Draw OrderとFolder stack順が別々に変化する
- Setup変更でAnimation keyが無言破損する
- 既存WarpGrid、ControlMesh、Clip Motionを再実装する

そのため、個別提案を維持しつつ、最終到達像と共通契約を上位文書で整理する。

### 0.1 下位資料

本書は次を下位提案として参照する。

- `15_ボーン・CAF階層パーツ・動的描画順制御設計_改訂提案.md`
- `16_モーションパフォーム記録・タイムストローク再生設計_改訂版.md`
- `17_自動メッシュ・自由コントロールポイント・ストロークメッシュ設計_改訂版.md`

責任分担:

| 資料 | 主な責任 |
|---|---|
| 15 | CAF内部Part、BONE階層、Bind Pose、剛体変形、Draw Order、Render Island |
| 16 | pointer入力、相対時間、Frame resampling、Motion commit、History |
| 17 | TriangleMesh、Generator、Binding、SkinWeight、weight調整、Mesh描画 |
| 18（本書） | 各機能の接続、統合評価順、Quick Rig、IK／親追従、段階導入 |

下位資料と本書が衝突する場合、CODEXは現行正本と実コードを優先し、正式Phase計画に採用理由を記載する。

---

## 1. 名称と表記

### 1.1 BONE

正式表記:

- 英語・内部概念: **BONE**
- 日本語UI・説明: **ボーン**
- 旧表記: `BORN`

`BORN`は過去資料や会話上の表記揺れとして扱う。新しい型名、保存キー、UIラベル、イベント名には使用しない。

### 1.2 統合用語

| 名称 | 定義 |
|---|---|
| `RigDefinition` | Part、BONE、Bind Pose、Constraint、Binding参照等の静的設定 |
| `RigInstanceMotion` | ClipInstanceごとのBONE pose、target、constraint weight等の時間変化 |
| `Part` | CAF内部Folder等をアニメーション単位として参照する論理パーツ |
| `RenderIsland` | clippingやeffectの都合で分離変形・並べ替えできない最小描画単位 |
| `BONE` | 親子接続、軸、長さ、Bind Poseを持つ変形骨 |
| `Effector` | IKやPerformで直接操作する末端目標 |
| `Constraint` | IK、追従、固定、伸縮等の解決規則 |
| `TriangleMesh` | 任意頂点・UV・三角形indexを持つ描画トポロジー |
| `SkinWeight` | BONE等からMeshVertexへの影響率 |
| `Motion Perform` | pointer gestureを位置・target・pose等の時間キーへ変換する機能 |
| `Draw Order` | 時間によって変化するPart／RenderIslandの描画順 |
| `Quick Rig` | Mesh生成、BONE配置、初期weightを短い操作で構成する導線 |

---

## 2. 最終的に目指す制作体験

### 2.1 基本体験

```text
キャラクターやパーツを描く
  ↓
CAF内Folderへ整理
  ↓
自動Mesh / Primitive Cage / Ribbonを生成
  ↓
BONEを配置
  ↓
自動SkinWeight
  ↓
キャンバス上で手・足・頭を動かす
  ↓
IK／追従／伸縮を含むBONE Poseを解決
  ↓
Meshが同時に変形
  ↓
必要な箇所だけweightを調整
  ↓
Motion Performで動きを時間へ記録
```

### 2.2 「すぐ動く」ことを優先する

単純な図形的キャラクターの場合、ユーザーが一からMesh頂点やweightを作らなくても、次だけで動かせる状態を目標とする。

1. Partを選択する
2. Auto MeshまたはPrimitive Cageを生成する
3. BONEを配置する
4. 自動weightを実行する
5. 手足をドラッグする
6. 必要に応じてstretchやfollowを切り替える
7. Motion Performで記録する

この導線により、カプセル、円、箱、帯状パーツを組み合わせた「ゴム人間」のようなキャラクターなら、短時間で走行・歩行・ジャンプ等の試作ができる状態を目指す。

### 2.3 精密調整も可能にする

自動生成は開始点であり、最終結果を固定しない。

ユーザーは必要に応じて次を調整できる。

- BONE位置
- 親子関係
- Bind Pose
- IK chain
- pin
- follow weight
- stretch可否
- stretch上限
- constraint有効区間
- SkinWeight
- ControlHandle
- Mesh topology
- Draw Order

---

## 3. 基本アーキテクチャ原則

### 3.1 静的定義と時間変化を分ける

第一候補:

```text
ClipAsset / CAF側
  RigDefinition
  PartDefinition
  BONE Definition
  Mesh Definition
  Bind Pose
  SkinWeight
  Draw Order基準
  Generator Metadata

ClipInstance側
  RigInstanceMotion
  BONE Pose Keys
  Effector Target Keys
  Constraint Weight Tracks
  Stretch Tracks
  Draw Order Keys
  ControlHandle Keys
```

これにより、同じCAFを複数ClipInstanceで利用しながら、Animationだけを個別に持てる。

ただし現行コードの所有関係が異なる場合、CODEXが既存正本へ合わせて再配置する。

### 3.2 UI階層を保存正本にしない

Timelineの疑似Sub-Track、BONE tree、Part treeは、正本データから生成するUI投影を第一候補とする。

UI表示都合の`parentId`をLane保存モデルへ直接追加し、Rig階層と重複させない。

### 3.3 SolverとMeshを分離する

BONE／Constraint側:

```text
入力:
  Bind Pose
  FK keys
  Effector targets
  constraint weights
  stretch policy

出力:
  EvaluatedBonePose[]
```

Mesh側:

```text
入力:
  Mesh Definition
  SkinWeight
  EvaluatedBonePose[]

出力:
  Deformed Mesh Vertices
```

Mesh evaluatorは、FK、IK、親追従などの解法を直接知らない。

### 3.4 単一評価結果を全経路で共有する

同一Frameについて、次が同じ評価結果を使う。

- Animation Table preview
- 通常Canvas
- playback
- onion
- thumbnail
- export
- 将来のBake

評価経路をUI別・export別に二重実装しない。

---

## 4. 統合評価パイプライン

第一候補の評価順:

```text
1. Project Frame → Clip-local Frame変換

2. Clip root Motion評価
   position / scale / rotation / anchor等

3. Rig Motion入力をsample
   FK pose keys
   Effector target keys
   constraint weights
   stretch tracks
   follow tracks

4. Constraint Solver
   pin
   FK/IK blend
   distributed follow
   stretch
   limits

5. EvaluatedBonePose生成

6. Part／RenderIslandの局所変形評価
   rigid transform
   ControlHandle
   BONE Skinning
   WarpGrid等

7. Part texture／RenderIslandを確定

8. Draw Order評価

9. CAF root transformを適用

10. 全体composite
```

この順序は候補であり、既存compositorのclipping、blend、RenderTexture境界をCODEXが調査して確定する。

### 4.1 Bind Poseと変形行列

BONEの基本候補:

```text
deformMatrix =
  poseWorldMatrix
  × inverse(bindWorldMatrix)
```

MeshVertexはSkinWeightに従って複数のdeformMatrixから影響を受ける。

Part剛体変形とMesh Skinningを同時に行う場合、二重変形を避けるため、どちらがroot transformを所有するかを明示する。

### 4.2 RenderIsland

clippingやgroup effectで結合されたPart群は、独立して並べ替えたり別のMesh変形を適用できない場合がある。

そのためDraw OrderやPart textureの単位は、常にFolder単体ではなくRenderIslandとなる可能性がある。

CODEXは現行`internal-layer-clipping-contract`等を調査し、最小分離単位を確定する。

---

## 5. BONE階層と操作方式

### 5.1 FK

親BONEの変形が子・孫へ伝播する通常の方式。

```text
肩
  └─ 上腕
       └─ 前腕
            └─ 手
```

肩を動かせば、上腕・前腕・手が追従する。

### 5.2 IK

手等のEffectorを動かし、肘・肩を逆算する。

```text
手をドラッグ
  ↓
手首target
  ↓
前腕・上腕を解く
  ↓
必要なら肩も動かす
```

「手を移動させると肩も動く」は、通常FKではなくIKまたは親方向へのdistributed followに属する。

### 5.3 Distributed Parent Follow

IKだけではなく、子側の移動量を祖先へ割合配分する候補。

例:

```text
手のtarget移動量:
  手首  100%
  肘     50%
  肩     20%
  胴体    5%
```

用途:

- 柔らかいゴム人間
- 全身を使った到達動作
- 髪や尾の逆方向引っ張り
- rigidな関節より弾力のある動き

候補パラメータ:

```text
followWeight
followFalloff
maxAncestorDepth
translationFollow
rotationFollow
scaleFollow
```

### 5.4 Pin

特定BONEまたはPartを固定する。

例:

- 足を地面へ固定
- 肩を固定して手だけ動かす
- 手を固定して身体を引き寄せる
- 胴体を固定して尾を動かす

### 5.5 Constraint Blend

FK、IK、follow等は排他的ではなく、Frameごとのweightでblendできる候補とする。

```text
fkWeight
ikWeight
followWeight
pinWeight
```

合計規則と解決順はCODEXが定義する。

---

## 6. Stretchと伸縮制約

### 6.1 基本モード候補

| モード | 挙動 |
|---|---|
| `FIXED_LENGTH` | BONE長を維持する |
| `LIMITED_STRETCH` | 上限内で伸縮する |
| `FREE_STRETCH` | targetまで自由に伸びる |
| `SQUASH_STRETCH` | 軸方向伸縮と直交方向補正を行う |
| `RUBBER` | chain全体へ伸びを分配する |

### 6.2 候補パラメータ

```text
stretchEnabled
stretchWeight
stretchMin
stretchMax
stretchDistribution
volumeCompensation
```

### 6.3 指定区間だけ伸ばす

時間Track候補:

```text
stretchWeightTrack
constraintActiveTrack
ikBlendTrack
followWeightTrack
```

例:

- Frame 0〜12: 固定長
- Frame 13〜20: 伸縮可
- Frame 21以降: 固定長へ戻す

補間方式はHOLDまたはLINEAR候補。意味が離散的な項目はHOLDを基本とする。

### 6.4 Meshとの関係

伸縮時にMeshが軸方向へ伸びるだけでは、幅が細く見えることがある。

候補:

- Linear Blend Skinningのみ
- Ribbon専用幅保持
- volume compensation
- weight補正
- squash/stretch deformer
- ControlHandle補正

最初のMVPで完全な体積保持を保証しない。

---

## 7. Mesh生成とQuick Rig

### 7.1 共通Mesh Definition

複数generatorは同じMesh正本へ出力することを第一候補とする。

Generator候補:

- Manual Triangle Mesh
- Delaunay Cage
- Auto Contour Mesh
- Primitive Cage
- Ribbon Mesh
- Hybrid

### 7.2 Quick Rig優先候補

最短導線として、AutoContourよりPrimitive Cageを先に評価する価値がある。

理由:

- topologyが安定
- 計算が軽い
- BONE配置と対応しやすい
- 自動weightが作りやすい
- 図形キャラクターに適する
- source画像変更で壊れにくい

候補:

```text
Box
Rounded Box
Capsule
Strip
Radial
Limb
Tail/Hair Chain
Face Oval
```

### 7.3 AutoContour

不規則なPartではalpha輪郭からMeshを生成する。

ただし次を別処理として扱う。

```text
輪郭抽出
hole / island
簡略化
内部点生成
constrained triangulation
UV
validation
```

Marching Squaresだけで三角形Mesh生成が完了したとみなさない。

### 7.4 Ribbon

腕、脚、髪、尾、リボン等へGuideStrokeから生成する。

幅保持には中心線と法線だけでなく、join、cap、self-intersection、stretch時の幅補正が必要である。

---

## 8. SkinWeight

### 8.1 自動weight

候補方式:

- BONE segmentまでの距離
- nearest Bone
- topology-aware diffusion
- harmonic／heat系
- cage coordinates
- Ribbon専用割当
- Part hierarchy補助
- Hybrid

### 8.2 手動調整

必要機能候補:

- add
- subtract
- smooth
- normalize
- lock
- mirror
- selected component fill
- selected Bone regenerate
- reset
- influence表示

### 8.3 基本規則候補

```text
weight >= 0
sum(weights) = 1
最大影響数 = 調査後決定
0 weight時 = rest位置
```

### 8.4 Topology変更

Topology変更後にweightを無言再生成しない。

状態候補:

- `VALID`
- `STALE`
- `INVALID`

再生成時は、手動weight、Animation key、BONE参照が失われる可能性を表示する。

---

## 9. Motion Performの統合

Motion Performは、単にClip root位置を記録するだけでなく、将来はBONE EffectorやControlHandleへ接続できる。

### 9.1 記録対象候補

- Clip root position
- Part rigid transform
- BONE FK pose
- Effector target
- ControlHandle
- constraint weight
- Draw Order操作

最初のMVPはClip root positionに限定し、BONE統合後にEffector targetを追加する候補とする。

### 9.2 BONE Perform方式の複数案

#### 案A: Solver結果をPose KeyへBake

入力中にIK等を解き、各FrameのBONE poseを保存する。

利点:

- 再生時の計算が比較的単純
- 結果が固定される
- solver変更の影響を受けにくい

欠点:

- 大量キー
- IK targetを後から編集しにくい
- constraint意味が失われる

#### 案B: Effector Targetを保存

pointer軌跡をEffector target trackとして保存し、再生時にsolverがBONE poseを生成する。

利点:

- 非破壊
- target pathを編集しやすい
- IK／follow／stretchを後から調整できる

欠点:

- solver結果の決定性が必要
- 再生・export時の負荷
- solver変更で旧Project結果が変わる危険

#### 案C: Hybrid

Effector Targetを正本として保存し、必要時にPose Bakeを生成する。

利点:

- 編集性と固定結果の両方を持てる

欠点:

- TargetとBakeの二重状態管理
- invalidation契約が必要

CODEXは既存Motion modelと保存互換を調査し、採用方式を決定する。

### 9.3 相対時間

16の設計に従い、pointer入力は固定時計と組み合わせて相対時間へ正規化する。

```text
r = elapsed / total
```

各Clip-local Frame時刻で軌跡を評価する。

入力SampleをFrameへ直接丸めない。

### 9.4 Holdとconstraint

Effectorが停止する区間も記録する。

さらに将来は、Perform中のmodifier操作やUI状態から次を記録する案がある。

- IK weight
- stretch on/off
- follow強度
- pin切替

初期版では同時記録を避け、既存Trackの編集として分離してよい。

---

## 10. Draw Order

腕を身体の後ろから前へ回す等の動作には、Draw Order Trackが必要となる。

### 10.1 対象単位

Folder単体ではなく、RenderIsland単位を候補とする。

### 10.2 保存方式候補

```text
DrawOrderKey {
  frame
  orderedRenderIslandIds[]
  interpolation: HOLD
}
```

整数offset方式より、完全順序配列を初期候補とする。

### 10.3 BONE／Meshとの独立

Draw OrderはBONE階層やSkinWeightとは別のTrackとする。

BONEの親子関係を変更しても、描画順が自動で変化しない。

将来、姿勢から自動候補を提示することは可能だが、正本へ無言反映しない。

---

## 11. SetupとAnimate

### 11.1 Setup

編集候補:

- Part
- RenderIsland
- BONE
- parent
- Bind Pose
- Mesh topology
- ControlHandle
- SkinWeight
- Primitive／Generator
- constraint構成
- stretch policy
- Draw Order基準

### 11.2 Animate

編集候補:

- FK pose
- Effector target
- constraint weight
- stretch weight
- follow weight
- pin weight
- Draw Order
- ControlHandle pose
- Motion Perform

### 11.3 構造変更の制限

Animation keyが存在する状態で次を変更すると、既存Animationが無効化される可能性がある。

- BONE追加・削除
- 親変更
- Bind Pose変更
- Mesh Topology変更
- SkinWeight再生成
- RenderIsland構造変更

無言修復は禁止する。

候補対応:

- 変更を禁止
- key削除確認
- Rebind
- Migration preview
- 複製して新Rigを作成

---

## 12. データ所有候補

概念構造:

```text
ClipAsset / CAF
  parts[]
  renderIslands[]
  rigDefinition
    bones[]
    constraints[]
    effectors[]
  meshDefinitions[]
  skinBindings[]
  defaultDrawOrder[]
  generatorMetadata

ClipInstance
  rootMotion
  rigMotion
    bonePoseTracks[]
    effectorTargetTracks[]
    constraintWeightTracks[]
    stretchTracks[]
    followTracks[]
  meshPoseTracks[]
  drawOrderTrack
```

注意:

- 実際の型名・保存場所は仮称
- 既存ClipAsset／ClipInstance正本へ合わせる
- 同じ関係をLane、Folder、Rigで重複保存しない
- IDはstable IDとする
- copy/paste時に参照を再マップする

---

## 13. History

候補単位:

```text
1 BONE drag = 1 History
1 Effector drag = 1 History
1 Perform gesture = 1 History
1 weight brush gesture = 1 History
1 Topology操作 = 1 History
1 auto-generation = 1 History
1 rebind = 1 History
1 Draw Order変更 = 1 History
```

既存Timeline History、Project History、WarpGrid Historyを調査し、新しいHistory基盤を安易に作らない。

Capture中はProjectへ逐次commitせず、runtime preview後に一括commitする方式を優先する。

---

## 14. 保存・互換・決定性

### 14.1 保存するもの

- Rig定義
- Bind Pose
- Mesh vertices
- UV
- TriangleIndex
- SkinWeight
- Generator Metadata
- Motion keys
- Constraint tracks
- Draw Order

### 14.2 runtime限定

- Raw Perform Samples
- solver中間値
- deformed vertex cache
- GPU buffer
- overlay選択状態
- pointer capture
- preview override

### 14.3 決定性

次が同じProject／Frameで同じ結果を返す必要がある。

- ランダムアクセスseek
- 順次再生
- onion
- export
- reload
- Undo→Redo

solverやtriangulatorのライブラリ更新で旧Projectの結果が変わらないよう、確定Topologyと必要な設定を保存する。

---

## 15. 性能方針

最初から固定上限を決めず、計測で決定する。

計測候補:

- Part数
- BONE数
- constraint数
- MeshVertex数
- Triangle数
- 1頂点のinfluence数
- Clip Frame数
- Perform key数
- onion枚数
- preview FPS
- CPU export時間
- save容量
- History容量
- mobile browser
- 344×135
- 400×400
- high-DPI

最適化候補:

- Part texture cache
- Mesh evaluator cache
- Bind matrix cache
- unchanged Frame bypass
- Rig未使用legacy path
- Draw Order未使用legacy path
- tight bounds
- GPU buffer reuse
- lazy weight visualization

正しさを確認する前に、大規模な抽象化や最適化を行わない。

---

## 16. CODEX Gate 0統合調査

正式Phase計画前に、CODEXは次を回収する。

### 16.1 正本

- `AGENTS.md`
- `TEGAKI.md`
- `PROGRESS.md`
- `ARCHITECTURE.md`
- `PHASE4Z_BOUNDARY.md`
- 15・16・17改訂版
- Motion Graph／Easing関連資料

### 16.2 BONE／CAF

1. ClipAsset／ClipInstanceの現行所有関係
2. CAF内部Folderのstable ID
3. Folder clipping／blendの評価順
4. RenderIsland相当の既存概念
5. Clip root Motionの評価式
6. anchor／pivotの座標契約
7. hierarchyを保存できる正本
8. Timeline疑似Sub-Trackの実現可能性

### 16.3 Mesh

1. `control-mesh-topology.js`の実装内容
2. `control-mesh-deformer.js`の実装内容
3. WarpGridとの重複
4. UV正本
5. CPU／GPU backend
6. export経路
7. Topology保存
8. Weight／Bindingの既存有無
9. source revision追跡
10. multi-frame CAF対応

### 16.4 Motion Perform

1. pointer capture
2. coalesced event
3. fixed clock候補
4. screen→world変換
5. runtime preview
6. Motion key schema
7. Timeline History
8. Easing所有
9. Clip retiming
10. playback／onion／export sampler共有

### 16.5 Solver

1. 既存transform math
2. hierarchy matrix評価
3. cyclic reference検出
4. IK library／既存実装の有無
5. affine matrix blend方式
6. deterministic solver条件
7. stretchの座標契約
8. Frame seek時の状態依存有無

### 16.6 出力

Gate 0成果物:

- 現行構造図
- 重複候補一覧
- 利用可能module一覧
- 不足契約一覧
- 本書との差分
- リスク表
- Prototype候補
- 正式Phase分割案
- `GO / REVISE / STOP`

---

## 17. Phase候補

以下は確定順序ではない。CODEXが依存関係と既存実装を調査して組み替える。

### Phase Candidate A: Rig Core

- Part／Rig定義
- Bind Pose
- 単一親Forest
- rigid FK
- EvaluatedBonePose
- Setup／Animate分離
- save/load
- History
- legacy bypass

到達点:

> Meshなしでも、CAF内部PartをBONE階層で剛体変形できる。

### Phase Candidate B: TriangleMesh Core

- 固定Mesh proof
- Manual Mesh
- stable ID
- UV
- GPU preview
- CPU/export
- save/load
- Topology lock

到達点:

> BONEなしでも、TriangleMeshを非破壊変形して全描画経路で一致できる。

### Phase Candidate C: BONE Skinning

- Bind／inverse bind
- SkinWeight
- BONE pose入力
- Mesh deformation
- auto weight prototype
- manual weight
- save/load
- History

到達点:

> BONEを曲げるとMeshが同時に変形し、weightを調整できる。

### Phase Candidate D: Quick Rig Generators

- Primitive Cage
- AutoContour
- Ribbon
- generator metadata
- source STALE
- auto Bone候補
- auto weight

到達点:

> 自動生成とBONE配置から短時間で動かし始められる。

### Phase Candidate E: IK／Parent Follow／Stretch

- Effector
- 2-Bone IK
- chain IK候補
- distributed parent follow
- pin
- stretch modes
- constraint weight tracks
- Frame区間制御

到達点:

> 手を動かすと肘・肩まで追従し、固定長／限定伸縮／ゴム伸縮を選べる。

### Phase Candidate F: BONE Motion Perform

- Effector Perform
- relative time
- fixed-clock capture
- target trackまたはpose bake
- Hold
- 1 gesture = 1 History
- preview／playback／export一致

到達点:

> キャンバス上で手足を演技させ、その動きを時間へ記録できる。

### Phase Candidate G: Draw Order／RenderIsland

- RenderIsland
- Draw Order Track
- clipping制約
- HOLD key
- preview
- export

到達点:

> 腕等を身体の後ろから前へ時間で移動できる。

### Phase Candidate H: Quick Rubber Character

- Part preset
- Primitive Cage preset
- BONE preset
- auto weight
- IK target
- limited stretch
- basic run／walk試作

到達点:

> 単純な図形キャラクターを短い操作で走らせられる。

---

## 18. 最小統合MVP候補

全機能を最初から統合しない。

最小統合候補:

```text
単一CAF
3 Part
3〜5 BONE
Primitive Cage
自動distance weight
2-Bone IK
固定長 / limited stretch
Effector drag
非記録preview
save/load
GPU preview / CPU export一致
```

次の段階:

```text
Effector Motion Perform
constraint weight track
manual weight smooth
Draw Order
```

このMVPで検証するもの:

- データ所有
- evaluator順
- solver決定性
- Skinning品質
- History
- save/load
- preview/export一致
- 操作感
- 性能

---

## 19. 複数案を残す主要論点

CODEXが最終判断するまで、次は複数案を維持してよい。

### 19.1 Mesh制御

- Direct MeshVertex
- Sparse ControlHandle
- BONE Skinning
- Cage
- Hybrid

### 19.2 Auto Mesh

- Primitive first
- Alpha contour first
- GuideStroke first
- 用途別併存

### 19.3 BONE操作記録

- Pose Bake
- Effector Target Track
- Hybrid

### 19.4 親追従

- IKのみ
- distributed follow
- full-body IK
- constraint stack
- 用途別solver

### 19.5 Stretch

- Bone scale
- segment length
- Ribbon伸縮
- Mesh deformer補正
- Hybrid

### 19.6 描画順

- 完全順序配列
- offset
- group／island order
- constraint-based order

複数案を残す場合も、保存正本を重複させないことを条件とする。

---

## 20. 受け入れ条件

### 20.1 互換

- Rig未使用Projectの描画結果を変えない
- Mesh未使用Projectの描画結果を変えない
- 旧Projectを読み込める
- optional schemaで拡張できる
- save/loadで結果が変わらない

### 20.2 BONE

- cyclic hierarchyを禁止
- Bind PoseとAnimate Poseを分離
- random seekと順次再生が一致
- deleted parentを無言修復しない
- FK／IK／followの評価順を明示
- pinとstretchが決定的
- constraint有効区間を再現できる

### 20.3 Mesh

- stable Vertex ID
- stable TriangleIndex
- weight規則が明確
- Topology変更でAnimationを無言破壊しない
- GPU／CPU結果が許容差内
- source変更時にSTALEを表示
- auto regenerateを無言実行しない

### 20.4 Perform

- pointer停止中のHoldを記録
- device Hzに依存しない
- pointerdown時にジャンプしない
- cancelで変更を残さない
- 1 gesture = 1 History
- target／poseの保存方式を明示
- playback／exportが一致

### 20.5 Draw Order

- clipping関係を壊さない
- RenderIsland単位を守る
- 同値sortへ依存しない
- HOLDで評価
- 旧Projectは従来順を維持

### 20.6 Quick Rig

- 自動生成結果を手動修正できる
- generator失敗を隠さない
- hole／island／thin lineの未対応を明示
- 自動weightを手動修正できる
- 再生成で手動修正を無言破棄しない

---

## 21. 停止・再設計条件

次の場合、CODEXは統合実装を停止し、Phase分割またはデータ設計を修正する。

- Clip MotionとRig Motionが同じtransformを重複所有する
- BONE側とMesh側でBinding正本が重複する
- existing ControlMeshとTriangleMeshが重複する
- preview／playback／exportでsolverまたはMesh evaluatorが分裂する
- random seekで結果が変わる
- solverが前Frame状態へ依存する
- Topology変更を安全に扱えない
- SkinWeightを保存・Undoできない
- RenderIslandを確定できずclippingが壊れる
- Effector Target保存で旧Project結果を固定できない
- Pose Bakeが大量キーで実用不能になる
- 自動生成が既存Animationを無言破壊する
- 独自WebGL2凍結moduleの解除が必須になる
- mobile browserで最低限の性能を満たせない

代替候補:

- rigid Part BONEのみ
- Primitive Cageのみ
- Direct MeshVertexのみ
- 2-Bone IKのみ
- stretchなし
- Motion PerformをClip root限定
- Draw Orderを後続Phaseへ送る
- AutoContourをoffline generatorへ限定
- Pose Bakeのみ
- Target Trackのみ

---

## 22. 推奨する正式Phase計画の作り方

CODEXが正式計画を作る際は、機能名だけでPhaseを分けず、各Sliceに次を記載する。

1. 解決する具体的問題
2. 変更する正本
3. runtime限定状態
4. 既存module再利用箇所
5. 新規module追加理由
6. 描画評価順
7. History単位
8. save/load
9. copy/paste
10. old Project fallback
11. preview/playback/onion/export一致
12. 性能計測
13. 受け入れ条件
14. 停止条件
15. 次Sliceへ進むGate

各Sliceは単独で動作確認可能にし、UIだけ、schemaだけ、backendだけを長期間未接続で先行させない。

---

## 23. 統合計画の最終提言

15・16・17は個別提案として残し、本書を上位のNorth Starとして利用するのが妥当である。

理由:

- 個別機能の詳細を失わない
- CODEXがPhaseを組み替えやすい
- BONE、Mesh、Performの重複正本を防ぎやすい
- Quick Rigという最終利用体験から逆算できる
- IK、親追従、伸縮、weightを後付けではなく接続要件として扱える
- 実コード調査で一部案が不採用になっても、他案へ切り替えられる

最終的な到達像は次である。

> CAF内のパーツへ初期MeshまたはPrimitive Cageを自動生成し、BONEを配置すると自動SkinWeightが作られる。ユーザーは手足やEffectorを直接動かし、必要に応じて親追従、IK、固定長、限定伸縮、ゴム伸縮を選択できる。MeshはBONEに追従し、weightを手動調整できる。Motion Performによって動きを時間へ記録し、Draw Orderを含めてpreview、playback、onion、exportで同じ結果を得る。

---

## 24. 関連資料

- `AGENTS.md`
- `TEGAKI.md`
- `tegaki_work/PROGRESS.md`
- `tegaki_work/ARCHITECTURE.md`
- `tegaki_work/PHASE4Z_BOUNDARY.md`
- `15_ボーン・CAF階層パーツ・動的描画順制御設計_改訂提案.md`
- `16_モーションパフォーム記録・タイムストローク再生設計_改訂版.md`
- `17_自動メッシュ・自由コントロールポイント・ストロークメッシュ設計_改訂版.md`
- `09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
- `10_Motion_Graph・Easing・Motion_Path設計.md`
