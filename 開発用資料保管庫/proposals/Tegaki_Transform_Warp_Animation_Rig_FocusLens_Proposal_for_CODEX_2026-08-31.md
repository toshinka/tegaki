# Tegaki 次期UI/UX提案
## Layer Transform / Warp を「絵の共通変形語彙」にし、Animation・RIGへ段階的に昇格する導線
### — Horizontal Transfer / Focus Lens / Canvas-first Interaction Grammar —

更新日: 2026-08-31  
用途: CODEX / SOL / MAX 向け次期 Architecture / UX Gate 検討資料  
位置づけ: **提案・比較材料。現時点の実装契約ではない。**  
前提: 現行 Phase 9n の保存 schema / History / solver / selection authority を壊さず、次の大きなUI/UX検討順序を定める。

採用状況（2026-08-31）: Phase 9nはD3 minimal host-ownership checkpointでcloseし、`開発用資料保管庫/Archive/phase9n.md`へ移した。本提案を第一資料として`task-codex/phase9o.md`を立ち上げ、Stage A1でA Current / B CSP-like / C Procreate-like / D Tegaki hybridのproduction非接続比較fixtureとverifierを作成した。OwnerはGate 1=`GO — D: Tegaki hybrid`を選定。Stage B1で`BASIC / DISTORT / WARP`、preciseの`詳細`、runtime-only tight boundsのread-only 4 corner + rotate overlayをproductionへ限定接続し、技術proofを完了した。Owner production visual acceptanceとinteractive handleは未完了。以下の本文とA〜Dは再試行可能な比較原案として保持し、現行実装契約はPhase 9oを優先する。

---

# 0. Executive Summary

次の大きなUX整備では、Animation Tableや高度RIGをさらに磨き込む前に、既存 `V` の **Layer Transform** を Tegaki 全体の「変形の共通語彙」として刷新することを推奨する。

狙う学習曲線は次である。

```text
DRAW
  ↓
TRANSFORM
  移動 / 回転 / 拡縮 / Anchor
  Free / Distort / Perspective
  Warp Grid
  ↓
ANIMATE
  上と同じ変形を時間上へKey化
  ↓
必要になったら RIG
  Controller / Bone / Parent
  Deformer / AutoMesh / Rig Mesh
  Weight / Skin
```

つまり、

> **「アニメーションをするために特殊なRIGを最初に覚える」のではなく、普段の絵の変形操作に時間を与えるとアニメーションになり、その直接操作を何度も繰り返すのが大変になった時にRIGへ昇格する。**

この順序を Tegaki の基本思想候補とする。

現行 Phase 9n は方向を誤っているわけではない。むしろ、

- `Layer = 対象`
- `RIG = 時間に依存しない身体構造`
- `Animation Table = 時間変化`
- `Canvas = 直接操作`

という責務分離を確立し、未設定Laneからstatic RIG入口を撤去するところまで進んでいる。

したがって **Phase 9nは破棄しない**。

ただし現在は Stage D3 が `限定契約` であり、まだcheckpoint完了ではないため、

> **D3の「static RIG editor host ownership / return path」を最小限checkpoint化したところで Phase 9n をcloseし、現在の横長 RIG WORKSPACE のUIをこのPhase内で完成形まで磨き込まない**

ことを推奨する。

理由は、次Phaseで Transform / Warp の基本分類そのものを再定義すると、現在の

```text
RIG | MOTION | WARP
```

という上位分類や、`全体PIVOT` をRIG側に置く意味が変わる可能性が高いためである。

---

# 1. 現行 Phase 9n をどう扱うか

## 1.1 現時点の事実

2026-08-31のclose前時点で、現在`開発用資料保管庫/Archive/phase9n.md`に保存されたPhase 9nは、

> `ACTIVE — Gate 0=GO — D: Dedicated Right RIG + Motion handoff`

であり、Stage A / B / C1〜C6 / D1 / D2 はcheckpoint完了、Stage D3が現在の限定契約である。

Phase 9n自身がすでに以下を目的としている。

```text
Layer = 対象
RIG = 時間に依存しない身体構造
Animation Table = 時間変化
Canvas = 直接操作
```

またD1/D2では、

- Motionから直接AUTO GRIDする経路を撤去
- 未設定Laneの `+RIG / RIG設定` を撤去
- Lane clickをFrame / target選択に限定
- 右RIGからstatic setupへhandoff

まで進んでいる。

これは次のTransform-first構想と矛盾しない。むしろ必要な整理である。

参照:
- `開発用資料保管庫/Archive/phase9n.md`  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/%E9%96%8B%E7%99%BA%E7%94%A8%E8%B3%87%E6%96%99%E4%BF%9D%E7%AE%A1%E5%BA%AB/Archive/phase9n.md
- `tegaki_work/PROGRESS.md`  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/tegaki_work/PROGRESS.md

---

## 1.2 「今のPhaseを切り上げてよいか」

### 推奨

**YES。ただしD3を未完のまま捨てる意味ではない。**

D3で最低限以下だけ固定する。

1. static RIG editor は一つだけ
2. 右RIGはoverview / next action / handoff
3. 詳細authoringは既存single floating `RIG WORKSPACE`
4. right RIG → RIG WORKSPACE → Motion / close / reopen のreturn path
5. History / selection / save authorityを複製しない
6. Table closeとRIG WORKSPACE lifecycle完全分離は後続へ明示HOLD

ここまでBrowser / verifierでcheckpointしたら Phase 9n をcloseしてよい。

### この時点でcloseする理由

#### 1. Phase 9nのArchitecture Questionには答えが出ている

「RIGをAnimation Table、Layer Panel、別Panelのどこへ置くか」という問いは、

> **右RIG overview + single static authoring host + Motion handoff**

でほぼ回答済み。

ここから先はauthority問題より**interaction grammar / onboarding / visual hierarchy**の問題になる。

#### 2. 現RIG WORKSPACEを磨き込むと先行投資が無駄になる可能性がある

次のTransform-first案を採る場合、

- `全体PIVOT` はRIGからLayer Transformへ移る可能性
- WARPは「Animationの別種」から「Layerのanimatable deformation property」へ再分類される可能性
- `RIG / MOTION / WARP` のtop-level tabs自体を再検討する可能性

がある。

今このRibbonの配置・数値欄・横長構成を細部まで完成させると、次Phaseで作り直しやすい。

#### 3. Scopeを守った方がcheckpoint価値が高い

Phase 9nはすでに大量のverifierを積み上げている。

ここでTransform / Warp schema・Canvas handle・Timeline property projectionまで混ぜるより、

> **「RIG responsibility relocationまで正常」**

というclean checkpointを作ってから次へ進む方が、回帰時の切り分けが容易。

#### 4. Ownerの違和感は「9nの実装ミス」より「次のUX層が未設計」に近い

現状の右RIGとRIG WORKSPACEが分かりづらいのは事実だが、

> 「どこがstatic RIGを所有するか」

を整理するPhaseと、

> 「初心者が絵をどう動かし始めるか」

を設計するPhaseは分けた方がよい。

---

# 2. 次にLayer Transformを先行すべき理由

## 2.1 Transformは最も下位の共通語彙

既存V Transformは現在、

- X
- Y
- Rotation
- Scale

を中心とする機能である。

これを「数値を変える小Panel」ではなく、

> **選択した絵をCanvas上で直接、移動・回転・拡縮・歪み・Warpする標準ツール**

へ昇格させる。

この操作は、

- 通常Drawing
- CAF原画編集
- SVG
- Raster
- Animation
- 将来的なRIG

のすべてより下に存在できる。

したがって上位のAnimation Tableを先に完成させるより、先にこの語彙を定義した方が全体が安定する。

---

# 3. Horizontal Transfer — 他ツールの「見慣れた操作文法」を借りる

ここで言う水平思考は、

> 他ツールの見た目を模写することではなく、  
> **ユーザーが他アプリですでに学習済みの操作文法をTegakiへ移植すること**

と定義する。

Tegaki独自の配色、線幅、アイコン、densityは維持してよい。

一方、

- Bounding box
- 8方向handle
- Rotation handle
- Anchor / reference point
- corner distortion
- grid warp
- confirm / cancel
- canvas drag

のような一般化したinteraction grammarは、独自化する利益が少ない。

> 「CLIP STUDIO / Procreate / Photoshop系を触ったことがあれば、説明なしでもだいたい分かる」

ことを価値として扱う。

これは模倣ではなく、**Consistency with learned conventions**である。

---

# 4. 最も強い先例: Procreate Dreams

Procreate Dreamsは今回のTegaki案に非常に近い。

Drawing側のTransformに、

- Uniform
- Freeform
- Distort
- Warp

があり、Warpはmesh grid、Advanced Meshではより細かなgridを使う。

公式:
https://help.procreate.com/dreams/handbook/draw-and-paint/transform

さらにAnimation側でも、

- Move & Scale
- Distort
- Warp

をそのままKeyframe / Performで時間記録できる。

公式:
https://help.procreate.com/dreams/handbook/interface-and-gestures/timeline
https://help.procreate.com/dreams/handbook/2.0/keyframes-and-performing/keyframes

ここから得るべき重要点は、

> **Drawing Transform と Animation Transform が別の操作言語になっていない**

ことである。

Tegakiでも、

```text
Drawing:
V → Warp → grid pointを動かす

Animation:
Frame 12 → 同じWarp gridを動かす → key
```

とできれば、Animation学習コストが大きく下がる。

---

# 5. CLIP STUDIO PAINTから借りるもの

CLIP STUDIO PAINTのTransformは、

- Move
- Scale / Rotate
- Free Transform
- Distort
- Skew
- Perspective
- Mesh Transformation
- Puppet Warp

まで同じTransform系列にある。

公式:
https://help.clip-studio.com/en-us/manual_en/360_transform/Types_of_transformations.htm

特にMesh Transformationは、

- 規則的なlattice grid
- horizontal / vertical point count
- grid point / guide line drag
- 複数grid point選択
- selected pointsのscale / rotate

という、初心者にも比較的読める直接変形になっている。

さらに現在のCSPにはPuppet Warpもあり、

- triangular mesh
- pinを置く
- pinを移動
- pinを回転
- pinで固定範囲を作る

という中間的な操作もある。

### Tegakiへの示唆

最初からBone / Rig Meshを要求せず、

```text
Basic Transform
    ↓
Warp Grid
    ↓
必要なら Pin / Puppet 的な軽量変形
    ↓
本格RIG
```

という段階も将来研究できる。

**Pin/Puppet Warpは今すぐ実装対象にはしないが、RIGへ入る前の中間層として有力な水平研究候補**として保存する。

---

# 6. Live2Dから借りるもの / 借りすぎないもの

Live2Dは、

- ArtMesh
- Warp Deformer
- Rotation Deformer
- Parameter / Keyform

を明確に分ける。

ArtMeshは画像に割り当てられるtriangle meshで、Automatic Mesh GeneratorとManual Editがある。

公式:
https://docs.live2d.com/en/cubism-editor-manual/mesh-edit/
https://docs.live2d.com/en/cubism-editor-manual/mesh-edit-manual/

Deformerは複数のArtMesh vertexや子要素をまとめて動かす上位構造。

公式:
https://docs.live2d.com/en/cubism-editor-manual/deformer/

Toolbarも、

- Automatic Mesh generator
- Create Warp Deformer
- Create Rotation Deformer
- Rotation Deformer Creation Tool

を別操作として持つ。

公式:
https://docs.live2d.com/en/cubism-editor-manual/toolbar/

### Tegakiへの示唆

Tegakiでも、

```text
Layer Warp Grid
≠
Rig Mesh
≠
Controller / Deformer
```

を同一語にしない。

#### Layer Warp Grid

ユーザーが直接格子を操作する変形。

#### Rig Mesh

Bone / Controller / Deformerから影響されるためのtopology。

#### Controller / Deformer

「一々全部の点を操作しなくても、まとめて追従させる」上位構造。

Live2D自身も、vertexを毎回一つずつ動かすのは時間がかかるためDeformerを使う、と説明している。

つまりRIG / Deformerは基本変形の代替ではなく、**直接操作の反復コストを抽象化する上位機能**と捉えられる。

---

# 7. ToonSquidから得られる補強

ToonSquidはLayerに対して、

- Warp
- Perspective
- Mesh
- Bones

をEffectとして追加できる。

公式:
https://toonsquid.com/handbook/effects/overview/

Mesh Effectは、Layer contentをcustom triangle meshへmapし、Boneでも手動でもanimate/deformできるものとしている。

さらにTransform Mesh Toolは、

- Effects無効: bind pose / mesh setup
- Effects有効: control point移動をkeyframe化

という同じ操作のsetup / animation切替を持つ。

公式:
https://toonsquid.com/handbook/effects/mesh/

Bonesは、

- 通常Transformを持つLayerならposition / rotation / scale全体を制御
- deformさせたい場合はMesh Effect等へbind

という構造。

公式:
https://toonsquid.com/handbook/effects/bones/

### Tegakiへの示唆

同じCanvas gestureを、

```text
Setup
Animation
```

で再利用できる可能性がある。

そしてBoneは「変形機能そのもの」ではなく、

> Layer / Mesh / Warp control pointsをまとめて制御する上位Controller

として扱える。

---

# 8. 提案するTegakiの操作階層

## LEVEL 0 — DRAW

普通に描く。

Animation知識は不要。

## LEVEL 1 — TRANSFORM

Vキー。

最初の基本画面はCanvas direct manipulation。

### Basic
- Move
- Rotate
- Scale
- Anchor / Reference Point

### Free / Distort
- Free transform
- Skew
- Perspective / corner transform

### Warp
- Grid deformation
- grid point direct manipulation

このLEVELだけで「一枚絵をかなり動かす」ことが可能。

## LEVEL 2 — ANIMATE

同じTransformを時間上へ置く。

```text
Layer 1
▼ Transform
    Position
    Rotation
    Scale

▼ Warp
    Shape
```

Frameごとに値 / grid point shapeを変えれば補間される。

ユーザー視点では「普段の変形に時間を付けた」だけ。

## LEVEL 3 — RIG

直接操作を繰り返すことが大変になった時に入る。

例:
- 腕を毎Frame個別に動かすのが面倒
- 子Layerを親へ追従させたい
- 肩→肘→手首をまとめて操作したい
- 矩形 / 円弧 / Jointに沿ったcontrollerが欲しい

ここで、
- Parent hierarchy
- Bone / Joint
- Controller
- Deformer
を使う。

## LEVEL 4 — RIG MESH / AUTOMESH / WEIGHT

単純な親子 / controllerでは崩れ方を制御できなくなった時に入る。

- AutoMesh
- Manual Mesh
- Skin
- Weight
- Influence correction
- local deformation

ここで初めてLive2D ArtMeshに近い思考が必要になる。

---

# 9. Focus Lens — 「全部見せない」導線思想

Tegakiの今後のUIは、機能数を減らすより

> **現在の目的に関係する機能だけを前景化する**

方が適している。

これを本提案では **Focus Lens** と呼ぶ。

## 9.1 Transform Lens

Vを押した直後:

```text
TRANSFORM

[ BASIC ] [ DISTORT ] [ WARP ]
```

以上を主表示。

X / Y / Rotation / Scaleの数値欄を主役にしない。

Canvasに、
- bounding box
- handles
- rotate affordance
- anchor
を表示する。

## 9.2 Basic Lens

BASIC選択中:
- Move
- Rotate
- Scale

だけを認知対象にする。

Warp gridやRig Meshは出さない。

## 9.3 Warp Lens

WARPへ切り替えた時だけ、

```text
WARP GRID
3 × 3

[ Grid - ] [ Grid + ]
[ Reset ]
```

等を出す。

高度なInterpolation / edge behavior等は `詳細 >`。

## 9.4 Animation Lens

Animation Tableを開いた時、選択中Layerのanimatable propertyだけを第一水位へ出す。

最初からCAF内部の全Layer / Bone / Warp propertyを全面展開しない。

概念候補:

```text
ACTIVE
BRANCH
ALL
PIN
```

- ACTIVE: 選択中target/propertyのみ
- BRANCH: RIG選択なら親子branch
- ALL: 全体
- PIN: 比較したいpropertyを固定

これは大量Laneの「並び順を工夫して全部表示する」より強い。

## 9.5 Rig Lens

RIGを開いた時も、

```text
関節
変形範囲
Weight
Mesh Edit
Parent
Diagnostic
```

を最初から全表示しない。

例:

```text
1. Controllerを作る
2. 接続する
3. 必要なら変形範囲を作る
4. 必要ならWeightを調整
```

現在の進捗に応じて「次の一手」だけ強調する。

---

# 10. Focus Lensを支持するHMI / 認知原則

Nielsen Norman Groupの一般原則では、

- Recognition rather than Recall
- Progressive Disclosure
- Aesthetic / Minimalist Design
- Visibility of System Status

が長期的なheuristicとして整理されている。

公式:
https://www.nngroup.com/articles/ten-usability-heuristics/

Progressive Disclosureでは特に、frequent / primary featuresを最初に出すが、最初の画面へ選択肢を出しすぎないことが重要とされる。

公式:
https://www.nngroup.com/articles/progressive-disclosure/

Direct Manipulationも、visible objectへ直接働きかけ、即時feedbackを得るinteractionとして定義される。

公式:
https://www.nngroup.com/articles/direct-manipulation/

### Tegakiへの翻訳

- `X 212 / Y 206 / Rotation -90`を読むよりCanvasで掴む
- `AUTO GRID / SHAPE / LINE`を覚えるより「曲がる範囲を作る」
- `RIG未設定`を警告のように見せるより「必要ならRIG」
- WarpをAnimation専用機能として覚え直させず、Drawing時と同じ操作を使う
- 高度機能は必要になった時にだけ展開する

---

# 11. 次期 Layer Transform の推奨Canvas Grammar

## 11.1 Basic Transform

CLIP STUDIO / Procreate系で学習済みの形を大胆に採用する。

```text
        rotate
          ○
          │
  ○──────○──────○
  │             │
  ○      +      ○
  │   anchor    │
  ○──────○──────○
```

想定:
- corner = scale
- side midpoint = one-axis scale
- inside drag = move
- rotate handle / outside = rotate
- center `+` = Anchor
- Shift / modifier = snapping等

Tegakiの配色 / line weight / touch sizeに適合させる。

## 11.2 Distort

四隅を個別に動かす。

必要なら、
- Free
- Skew
- Perspective
をsecondary modeとして出す。

最初から全種類をbutton rowに並べない。

## 11.3 Warp Grid

CLIP STUDIO / Procreate型の規則的latticeを第一候補。

理由:
- ArtMeshより初心者が理解しやすい
- direct manipulation
- topologyが規則的で補間を説明しやすい
- 「今風のTransformにWarpもある」という期待に合う

初期gridは少なめ。例 `3 × 3`。

詳細が欲しい場合のみ増やす。

---

# 12. SVGも同じCanvas Grammarへ寄せる

可能な範囲で、

- Raster
- SVG
- その他transformable object

へ同じbounding box / handle / anchorを使う。

内部実装が違っていても、同じ操作が可能ならUIを変えない。

ただしSVG path node編集は別モード。

```text
Transform object
≠
Edit vector path
```

を保つ。

---

# 13. StaticとTemporalを明確に分ける

## 13.1 Basic Transform

### static setup候補
- Anchor / pivot

### temporal
- Position
- Rotation
- Scale

初期段階ではAnchor自体をkeyframe化しないことを推奨。

Anchorを途中で変えると、同じRotationでもvisual positionが飛びやすく、補償規則が必要になるため。

## 13.2 Warp

### static
- grid topology
- horizontal / vertical divisions
- bind/base shape

### temporal
- grid point positions / warp shape

例:

```text
Warp Grid = 3×3      static

Frame 1  shape A
Frame 12 shape B
Frame 24 shape C
```

途中Frameを補間。

初期段階ではtopology mismatchを同一track上で許さない。

---

# 14. Animation Tableの再分類候補

Transform-firstを採る場合、最終的に

```text
RIG | MOTION | WARP
```

をtop-level semanticとして固定しない方がよい。

WARPは「時間の種類」というより **animatable deformation property** になる。

将来候補:

```text
Layer 1
▼ Transform
   Position
   Rotation
   Scale
▼ Warp
   Shape

Arm Rig
▼ shoulder
   Rotation
▼ elbow
   Rotation
▼ wrist
   Rotation
```

つまりAnimation Tableは、

> **時間によって変化するpropertyを見る場所**

へ純化する。

---

# 15. 「全体PIVOT」の再評価

Transform-firstを採ると、

> 一枚Rasterを変形せず移動・回転・拡縮したい

という用途をRIGへ置く必要が薄くなる。

これは通常のLayer Transformで成立する。

したがって将来Gateでは、

### Current

```text
RIG
├ 曲げRIG
└ 全体PIVOT
```

### Candidate

```text
Layer Transform
└ Move / Rotate / Scale / Anchor

RIG
└ 複数Controller / hierarchy / deformation binding
```

を比較する。

**今すぐ既存 `全体PIVOT` data modelを削除・migrationしない。**

まずUI/interaction上の役割重複を比較し、既存保存データ互換を維持したままpresentationを整理する。

---

# 16. RIGの意味を「上級化」に戻す

Transform-firstにするとRIGは必須設定でなくなる。

右RIGで、

```text
RIG未設定
```

とエラー風に出すより、

```text
RIGなし
このLayerはTransform / Warpだけで動かせます。

複数の関節や親子追従が必要なら
[ RIGを追加 ]
```

の方が正確。

これにより、

- 単純オブジェクト
- 背景小物
- ちょっとした髪揺れ
- 一回だけの歪み

へ不要なRiggingを強制しない。

---

# 17. RIGへ昇格する自然な瞬間

### 単純
「腕Layerを一回回したい」
→ Transform

### 少し変形
「一枚絵の腕を少し曲げたい」
→ Warp / 将来Pin

### 繰り返し
「肩・肘・手首を何回も動かしたい」
→ RIGを勧める

### 追従
「前腕を動かしたら手も付いてきてほしい」
→ Parent / Controller

### 変形品質
「肘を曲げると胴体まで引っ張られる」
→ Rig Mesh / Weight

この順序なら、各高度機能の必要性をユーザー自身が理解してから出会える。

---

# 18. 「Horizontal Respect」の設計ルール

## 借りてよい
- interaction pattern
- handle placement convention
- selection grammar
- confirm / cancel flow
- terminology where generic
- progressive hierarchy
- direct manipulation model

## Tegaki固有にする
- color
- typography
- icon drawing
- panel skin
- density
- shortcut体系
- saved model
- affordanceの組合せ
- touch / pen optimization

## 避ける
- pixel-perfect visual copy
- product固有branding
- product固有asset / artwork
- 内部data modelまで無批判に模倣

目的は、

> **既存の学習資産を尊重しながら、Tegakiの目的に合う操作へ再構成すること。**

---

# 19. 次Phaseの推奨構成

## Phase A — Layer Transform Interaction Grammar Gate

### Stage 0: inventory

現行Vの
- data model
- History
- Raster / SVG差
- CAF原画 / normal drawing差
- Canvas transform overlay
- existing Motion bridge

を監査。

### Stage A1: fixture comparison

#### Current
現行slider中心。

#### A — CSP-like
bounding box + rotate + anchor + mode strip。

#### B — Procreate-like
Uniform / Freeform / Distort / Warp。

#### C — Tegaki hybrid
Canvas handlesを標準化し、
`BASIC / DISTORT / WARP`
の三水位。

推奨仮説: **C**

## Phase B — Basic Transform production

まず
- move
- rotate
- scale
- anchor
のみ。

現行schema / Historyを最大限再利用。

sliderは `詳細` へ退避。

## Phase C — Layer Warp Foundation

Drawing側へWarp Gridを導入。

このPhaseではまだTimeline Keyへ接続しない。

固定:
- topology
- History
- Undo / Redo
- source edit
- Raster
- SVG対応可否
- export
- save/reopen

## Phase D — Transform Animation Bridge

Basic Transform / WarpをAnimation Tableへ接続。

同じCanvas operationを時間文脈で使う。

ここで初めて、
- Transform key
- Warp shape key
- interpolation
- easing
- frame navigation
へ接続。

## Phase E — Animation Table Property / Focus Lens Gate

Transform-firstを前提に、
- ACTIVE
- BRANCH
- ALL
- PIN
を比較。

`RIG / MOTION / WARP` top-level分類も再評価。

## Phase F — Advanced RIG Authoring Gate

ここで改めて、
- Controller
- Bone
- Parent
- Deformer
- AutoMesh
- Weight
- Skin
- Test Pose
を設計。

Transform / Warpで足りない理由が明確になった状態から設計できる。

---

# 20. 現行 RIG WORKSPACE の扱い

Phase 9n D3ではexisting floating editorを一つのstatic RIG authoring hostとして維持してよい。

ただしclose時に、

> **RIG WORKSPACEの現行横長content hierarchy / 数値欄 / button density / tabsはUX最終受入ではない**

と明記する。

特に以下は後続Gate。

- X / Y / Rotation数値常設
- BONE / AUTO GRID / SHAPE / LINEの横並び
- parent常設
- Diagnostic / Weight / Correct / Brush / Mesh Editの同時露出
- RIG / MOTION / WARP tab semantic
- floating横長 vs vertical inspector
- TEST POSE

**Host ownershipを確定することと、現在のhost layoutを採用することを混同しない。**

---

# 21. TEST POSEは後続有力候補として保持

RIGを作った直後に「ちゃんと曲がるか」を確認したい要求は強い。

ただしMotion mini-editorとWarp mini-editorをRIGへ複製しない。

将来候補:

```text
[ TEST ]

TEST POSE
Timelineには記録されません

[ RESET ]
```

Controller / Bone / WarpをCanvasで動かすが、

- ClipInstance.rigMotionへ書かない
- Timeline keyを作らない
- saveしないruntime pose

とする。

さらに将来、

```text
[ この姿勢をMotionへKey化 ]
```

を研究できる。

Phase 9n / Transform Phaseには混ぜない。

---

# 22. Performanceメモ — Table close後の描画遅延

Owner実機で、

> Animation Tableを閉じた後の描画に遅延

が観測されている。

本提案とは別issueとして残す。

単純CAFでも再現するなら、大規模Project serialization問題と同一原因と決めつけない。

後続performance probe候補:

```text
Table open
→ close
→ first pointerdown
→ first rendered stroke
```

計測:
- close handler duration
- overlay cleanup
- preview cleanup
- checkpoint / serialization
- first pointer event
- first draw commit

Phase 9nのUX Gateへ混ぜず、再現fixtureを作る。

---

# 23. 次Phaseに入る前のSTOP条件

Transform refreshへ移る前に最低限確認:

- [x] Phase 9n D3 host ownership checkpoint
- [x] right RIG → RIG WORKSPACE → close/reopen
- [x] Motion return
- [x] Table closedからRIG entry
- [x] History不変handoff
- [x] second editorなし
- [x] verifier / build green
- [x] 現RIG WORKSPACE UIは「後続UX未受入」と明記

これを満たしたら9n close。

---

# 24. Transform Phaseでやらないこと

最初のTransform Gateへ同時に混ぜない。

- RIG data model統合
- 全体PIVOT migration
- Skin solver変更
- AutoMesh algorithm改善
- Weight algorithm改善
- TEST POSE
- Pin/Puppet Warp本実装
- Animation Table全置換
- SVG path editor
- camera / 3D transform
- perspective 3D model

まず「普通の絵を普通に掴んで変形できる」ことを完成させる。

---

# 25. Acceptance Criteria — Transform Foundation

## Discoverability
- [ ] Vを押すと「絵を変形するツール」と視覚だけで推測できる。
- [ ] 初見で数値sliderを触らなくてもmove / rotate / scaleできる。
- [ ] AnchorがCanvas上で見える。
- [ ] WARPを選んだ時だけgridが見える。
- [ ] Rig MeshとWarp Gridを同じ言葉で説明しない。

## Familiarity
- [ ] Bounding box / handleは既存画像編集ツール経験者が推測可能。
- [ ] Confirm / Cancel / Resetが明示。
- [ ] icon-onlyへ依存しない。
- [ ] pen / touch hit targetを検証。

## Focus
- [ ] BASIC時にWarp / Rig advanced controlを露出しない。
- [ ] WARP時に必要なgrid controlだけ前景化。
- [ ] precise numeric controlはsecondary disclosure。
- [ ] inactive / disabled buttonの大量常設を避ける。

## Architecture
- [ ] Transform staticとAnimation keyを分離。
- [ ] Warp topologyとWarp shape keyを分離。
- [ ] Anchor animationは初期対象外。
- [ ] second transform modelを作らない。
- [ ] History semanticを固定。

---

# 26. Browser / Owner比較タスク

## Task 1
「この絵を少し右へ動かして30度回す」

見るもの:
- first click
- sliderを探すか
- Canvasだけで完了できるか

## Task 2
「顔だけ少し横へ歪ませる」

期待:
- Transform → Distort / Warp

RIGへ行かない。

## Task 3
「髪を少し揺れた形にする」

Drawing:
- Warpで形を作れるか

Animation bridge後:
- 別Frameで同じWarpを変えられるか

## Task 4
「腕を肩→肘→手首で何度も動かしたい」

ここで初めて、

> RIGを使うと楽になる

と自然に理解できるか。

---

# 27. 最終提案

現在のTegakiは、RIG / Motionの責務を整理するPhaseまで来た。

次の大きな改善を

> 「さらにRIGを分かりやすくする」

だけに限定すると、初心者にとっての最初の一歩を依然RIG側へ置くことになる。

より広い水平思考で見ると、

- CLIP STUDIO PAINT
- Procreate Dreams
- ToonSquid
- Live2D Cubism

の各ツールから、別々の強みを借りられる。

### CLIP STUDIOから
見慣れたTransform / Mesh / PuppetのCanvas grammar。

### Procreate Dreamsから
Drawing TransformとAnimation Transformを同じ語彙にする思想。

### ToonSquidから
LayerのWarp / Meshを手でもBoneでもanimateできる段階構造。

### Live2Dから
直接vertex編集 → ArtMesh → Deformerという高度化の分離。

これらをTegakiへそのまま複製するのではなく、

> **「絵を触る」→「時間を付ける」→「関係性を作る」**

という一本の導線へ再構成する。

Tegakiの次期UX思想候補を次の一文で表す。

> **普通の絵の操作が、そのままアニメーションの操作になる。  
> RIGは最初の入口ではなく、直接操作を構造化して楽にする次の段階である。**

Focus Lensはその導線を支える。

> **今必要なものだけを見せ、必要性を理解した時に次の水位を開く。**

この二つを次期UI/UXの中心仮説として、Phase 9n close後にLayer Transform Architecture / Interaction Gateを先行することを推奨する。

---

# 28. CODEX向け短縮指示

1. Phase 9nはD3 minimal host-ownership checkpointまで完了させる。
2. 現RIG WORKSPACE layoutをPhase 9nの最終UXとして磨き込まない。
3. D3後にPhase 9nをclean closeする。
4. 次は `Layer Transform Interaction Grammar Gate` を立てる。
5. Current / CSP-like / Procreate-like / Tegaki hybrid をfixture比較する。
6. 第一候補はCanvas-first `BASIC / DISTORT / WARP`。
7. slider / exact numericはsecondary inspectorへ下げる。
8. Drawing Warpを先に作り、Timeline animationは別Stage。
9. Layer Warp GridとRig Meshを別概念として固定する。
10. Transform → Animate → Rig → Mesh/Weight のskill ladderを守る。
11. Animation Tableの `RIG / MOTION / WARP`分類はTransform bridge後に再評価する。
12. 全体PIVOTのRIG所属も後続Gateで再評価し、今はdata migrationしない。
13. Focus Lensとして現在必要なproperty / branchだけを前景化する。
14. TEST POSE / Puppet Pin / advanced deformerは別研究候補としてHOLDする。

---

# 29. 参考資料

## Tegaki 現行
- Phase 9n完了記録 — RIG / Motion Responsibility / Contextual Right RIG Inspector Gate  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/%E9%96%8B%E7%99%BA%E7%94%A8%E8%B3%87%E6%96%99%E4%BF%9D%E7%AE%A1%E5%BA%AB/Archive/phase9n.md
- PROGRESS  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/tegaki_work/PROGRESS.md
- Phase 8d — Canvas-first Architecture / RIG onboarding  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/%E9%96%8B%E7%99%BA%E7%94%A8%E8%B3%87%E6%96%99%E4%BF%9D%E7%AE%A1%E5%BA%AB/Archive/phase8d.md

## Procreate Dreams
- Transform  
  https://help.procreate.com/dreams/handbook/draw-and-paint/transform
- Timeline / Perform / Keyframe  
  https://help.procreate.com/dreams/handbook/interface-and-gestures/timeline
- Keyframes  
  https://help.procreate.com/dreams/handbook/2.0/keyframes-and-performing/keyframes

## CLIP STUDIO PAINT
- Types of transformations  
  https://help.clip-studio.com/en-us/manual_en/360_transform/Types_of_transformations.htm
- Mesh / Puppet Warp settings  
  https://help.clip-studio.com/en-us/manual_en/810_subtools/M.htm

## Live2D Cubism
- Automatic Mesh generator  
  https://docs.live2d.com/en/cubism-editor-manual/mesh-edit/
- Manual Mesh Edit  
  https://docs.live2d.com/en/cubism-editor-manual/mesh-edit-manual/
- About Deformers  
  https://docs.live2d.com/en/cubism-editor-manual/deformer/
- Toolbar / Deformer creation tools  
  https://docs.live2d.com/en/cubism-editor-manual/toolbar/
- Live2D glossary — ArtMesh / Deformer / Parameter  
  https://docs.live2d.com/en/cubism-editor-manual/glossary/

## ToonSquid
- Effects overview  
  https://toonsquid.com/handbook/effects/overview/
- Mesh  
  https://toonsquid.com/handbook/effects/mesh/
- Bones  
  https://toonsquid.com/handbook/effects/bones/

## HMI / Cognitive UX
- Nielsen Norman Group — 10 Usability Heuristics  
  https://www.nngroup.com/articles/ten-usability-heuristics/
- Progressive Disclosure  
  https://www.nngroup.com/articles/progressive-disclosure/
- Recognition vs. Recall  
  https://www.nngroup.com/articles/recognition-and-recall/
- Direct Manipulation  
  https://www.nngroup.com/articles/direct-manipulation/
