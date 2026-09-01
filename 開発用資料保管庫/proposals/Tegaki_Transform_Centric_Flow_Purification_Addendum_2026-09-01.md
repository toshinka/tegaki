# Tegaki 導線純化 追補提案
## Transform-Centric Authoring / Timeline Purification Architecture Gate
### — 「何を」「どう変形するか」「いつ記録するか」を分離する —

更新日: 2026-09-01  
用途: CODEX / SOL / MAX 向け Working Addendum  
位置づけ: **Phase 9oを中断する実装指示ではない。BASIC close後に優先比較する次Architecture Gateの予約資料。**

関連資料:
- `Tegaki_Transform_Warp_Animation_Rig_FocusLens_Proposal_for_CODEX_2026-08-31.md`
- `Tegaki_Transform_Rig_Authoring_Interaction_Addendum_REVISED_2026-08-31.md`
- `task-codex/phase9o.md`

---

# 0. 現在地 — GitHub確認結果

2026-09-01確認時点で、公開GitHubの進行は次の状態。

- Phase 9nはclose済み。
- 9nでは右RIGをoverview / next action / handoff、single floating windowをstatic authoring hostとして固定した。
- 同時に、現行RIG WORKSPACEのlayoutと`RIG / MOTION / WARP`上位分類は最終UXではないと明記済み。
- 現行Phase 9oは `Layer Transform Interaction Grammar / Focus Lens Gate`。
- Gate 1は `GO — D: Tegaki hybrid`。
- 第一水位は `BASIC / DISTORT / WARP`。
- Stage B1〜B3はOwner acceptance済み。
- Stage B4 Owner correction 2は技術proof完了、Owner再確認待ち。
- Phase 9o自身も、Interaction Context / Instant Animation / Lazy Lane Disclosure / RIG再設計を現在のBASIC Sliceへ並走させないと明記している。

したがって、本追補の役割は、

> **現在のBASIC実装を止めることではなく、BASIC close後に迷わないよう、次の「導線純化Gate」を先に明文化すること。**

---

# 1. Core Thesis

今回の上位整理は次の一文。

> **Layer Panelは「何を」、Transformは「どう変形するか」、Animation Tableは「いつ」を担当する。**

```text
WHAT
Layer Panel
対象 / 順序 / visibility / selection

HOW
Transform
Move / Rotate / Scale / Distort / Warp
Rig / Controller / Mesh / Weight

WHEN
Animation Table
Frame / Key / Timing / Easing
Lane / Playback / temporal hierarchy projection

EXECUTION
Canvas
直接操作
```

この責務分離を次Architecture Gateの第一仮説とする。

---

# 2. なぜ今この整理を先に渡すか

## RECOMMEND

Phase 9oでLayer TransformがTegaki全体の「絵を直接掴んで変形する共通語彙」になり始めた。

このまま進むと、従来RIG WORKSPACE / Animation Table側に存在した機能の一部は、

> 「Animation固有機能」

ではなく、

> **「絵がどう変形可能かを定義するstatic authoring」**

だったことが明確になる。

例:

```text
BONE追加
AUTO GRID
AUTO SHAPE
AUTO LINE
Parent
Mesh Edit
Weight
Correct
```

これらはFrameや時間位置そのものではない。

したがって、次の大きな整理では、

> **static spatial authoringをTransform familyへ寄せる**

案を比較する価値が高い。

---

# 3. Transformを「変形の正面玄関」にする

## RECOMMEND

イラスト編集でもAnimationでも、

> **絵の位置・形・変形構造を触るならTransformを通る**

という導線を第一仮説にする。

```text
Layerを選ぶ
↓
V / TRANSFORM
↓
BASIC
DISTORT
WARP
↓ 必要になったら
RIG
MESH
WEIGHT
```

Animation時も別のWarp editorやRig editorを新しく学習させず、

```text
Animation Table OPEN
↓
Transformで同じ操作
↓
現在Frameへ記録
```

とする。

---

# 4. Transformへ統合しても「全部見せない」

## RECOMMEND

RIG WORKSPACEをそのままTransform panelへ移植してはいけない。

統合の目的は「巨大なTransform panelを作る」ことではない。

Focus Lensを維持する。

第一水位:

```text
TRANSFORM

[ BASIC ] [ DISTORT ] [ WARP ]
```

通常ユーザーはここで完結。

必要になった時だけ、

```text
> 高度な変形
```

を開く。

例:

```text
高度な変形

RIG
[ ROOTを置く ]

MESH
AUTO ✓

> Influence
> Mesh詳細
```

さらに上級者だけ、

```text
> Weight
> Manual Mesh
> Diagnostics
```

へ降りる。

---

# 5. Transform Familyの長期構造候補

```text
TRANSFORM
│
├ BASIC
│   ├ Move
│   ├ Rotate
│   ├ Scale
│   └ Origin / Anchor
│
├ DISTORT
│   ├ Corner
│   ├ Skew
│   └ Perspective-like
│
├ WARP
│   ├ Simple Grid
│   └ Local deformation
│
└ ADVANCED
    ├ RIG
    │   ├ Root
    │   ├ Joint
    │   ├ Parent
    │   └ Controller
    │
    ├ MESH
    │   ├ AUTO
    │   ├ GUIDE
    │   └ MANUAL
    │
    └ INFLUENCE
        ├ Auto
        ├ Preset
        └ Weight
```

これは最終UIを今決めるものではない。

> **機能の所属を考えるためのsemantic map**

として使う。

---

# 6. Animation Tableを「時間」に純化する

## RECOMMEND

Animation Tableは、

> **何をどう変形するかを選ぶ場所**

ではなく、

> **いつ変化するかを見る / 記録する場所**

へ寄せる。

長期的な責務候補:

```text
Animation Table

Frame
Key
Duration
Timing
Interpolation
Easing
Playback

ACTIVE / KEYED / BRANCH / ALL / PIN
```

Canvasで、

- Move
- Rotate
- Scale
- Distort
- Warp
- Rig Controller

を操作すると、ANIMATE contextなら現在FrameへKeyが記録される。

---

# 7. Static Setup と Temporal Record を分離する

## RECOMMEND

同じ機能名でも、staticとtemporalを分ける。

### Warp

```text
Transform
Warp topology / base setup
        ↓
Animation Table
Warp shape keys
```

### Rig

```text
Transform
Root / Joint / Parent / Mesh / Weight
        ↓
Animation Table
Joint pose / Controller keys
```

### Basic Transform

```text
Transform
Origin / base state
        ↓
Animation Table
Position / Rotation / Scale keys
```

Animation Tableへstatic authoring toolを複製しない。

---

# 8. Right Layer PanelのRIG tabは再評価対象

## COMPARE

Phase 9nで右RIG tabを作った判断自体は正しかった。

当時のArchitecture Questionは、

> static RIGをAnimation Tableから外せるか

だった。

9nはその責務分離を成功させた。

しかしPhase 9o以後、

> **static spatial authoring全体をTransformへ集約する**

上位案が見えてきた。

その場合、

```text
LAYERS | RIG
```

という独立入口は重複する可能性がある。

---

# 9. Right RIGを「消す」ではなく三案比較する

次Gateでは以下を比較する。

## A — Current 9n Architecture

```text
Layer Panel
[ LAYERS | RIG ]

Transform
Basic / Distort / Warp

Animation Table
Timeline
```

### 長所
- static Rigの所在が明示的
- 9nの既存成果をそのまま使える

### 懸念
- 「絵を曲げたい」時の入口がTransform / RIGへ分岐する
- spatial authoringの正面玄関が二つになる

## B — Full Transform Integration

```text
Layer Panel
LAYERS only

Transform
Basic / Distort / Warp / Rig / Mesh / Weight

Animation Table
Timeline only
```

### 長所
- WHAT / HOW / WHENが最も純粋
- 入口が一つ
- Animation Tableを時間へ純化できる

### 懸念
- Rig hierarchyの一覧性がTransform内で不足する可能性
- Transform panel肥大化の危険
- Rig state discoverabilityを別途用意する必要

## C — Hybrid Badge + Transform Authoring

```text
Layer Panel
LAYERS

arm.png      [RIG 3]

Transform
actual Rig authoring

Animation Table
Timeline
```

Layer Panelには、

- RIG badge
- Joint数
- status
- quick handoff

だけ残す。

Rig hierarchy / authoring本体はTransformへ。

### 長所
- Rigの存在はLayerから確認できる
- authoring入口をTransformへ一本化
- Right RIG tabそのものは不要にできる可能性
- Transform肥大化はFocus Lensで制御できる

### 懸念
- badge / quick handoffの情報量調整が必要

---

# 10. 現時点の第一仮説

## RECOMMEND — C first, B second

第一候補:

> **C — Layer PanelはRIG状態だけを示し、authoringはTransformへ統合**

第二候補:

> B — 完全Transform統合

理由:

RIGという状態の存在はLayer単位で確認できた方が便利。

ただし、

> Rigを作る / 編集するための独立RIG tab

までLayer Panelへ持つ必要はない可能性が高い。

---

# 11. 「RIG tab不要」はPhase 9n失敗を意味しない

## IMPORTANT

9nで得た成果は保持する。

9nが固定したのは、

- staticとtemporalの分離
- single static authoring authority
- right RIG overview / handoff
- History / schema / solverを複製しない

というArchitecture。

次Gateで再評価するのは、

> **そのstatic authorityをどのsurfaceから見せるか**

である。

したがって、

```text
Right RIG tab
→ Transform Advanced / RIG
```

へpresentationが変わっても、9nの責務整理はそのまま生きる。

---

# 12. Current RIG WORKSPACEから移す候補

## Static Spatial Authoring — Transform側候補

```text
ROOT / BONE追加
Joint追加
Parent
Auto Grid
Auto Shape
Auto Line
Rig Mesh
Mesh regeneration
Weight / Influence
Correction
Mesh Edit
Diagnostics
```

ただし一括移植しない。

Root-first / AutoMesh-first / progressive disclosureへ再構成する。

---

# 13. Animation Tableに残す候補

## Temporal Authoring

```text
Frame
Key
Transform key
Warp shape key
Controller / Bone pose key
Easing
Duration
Playback
Onion / Preview
Range
Lane projection
Key selection
Key move / copy / delete
Graph / Curveへのhandoff
```

Motionは「mode」より、

> **時間変化している結果の総称**

へ後退させる。

---

# 14. Motion buttonの意味

## RECOMMEND

将来的にMotion buttonを残す場合、

> Animation開始ボタンにしない。

Animationは、

```text
Animation Table open
↓
Transform
↓
Key
```

で開始。

Motion buttonは、

```text
[ Motion 3 ]
```

のように、

> existing temporal contentを展開するFocus Lens

とする。

---

# 15. Animation Tableの階層は「表示projection」

## RECOMMEND

Rig hierarchyそのものの正本はTransform / Rig graph側。

Animation Tableでは、

```text
shoulder
 └ elbow
    └ wrist
```

を時間編集用にprojectionする。

Rig parent変更によって、

- Layer order
- saved lane order

を勝手に書き換えない。

```text
Rig Graph
      ↓
Timeline Projection
```

とする。

---

# 16. Lazy Lane Disclosureと相性が良い

Transform-centric案は前追補のLazy Lane Disclosureと整合する。

Animation Tableを開いた直後:

```text
CAF

ACTIVE
current layer
```

のみ。

Transformで動かすと、

```text
current layer
  Rotation ◆──◆
```

がmaterialize。

Rig Controllerを選べば、

```text
ACTIVE
elbow
```

必要ならBRANCH。

全CAF子Laneを最初から表示しない。

---

# 17. Interaction Contextとの接続

TransformがDrawing / Animation双方の共通toolになるほど、

> **現在Transformがどこへ書き込むか**

の明示が重要になる。

Top Bar候補:

```text
SOURCE
```

```text
ANIMATE · F12
```

```text
RIG · SETUP
```

```text
TEST POSE · 未記録
```

Transform UIを一本化する代わりに、

> **Edit Targetを明示する。**

これがmode error対策になる。

---

# 18. Transform-firstでもSourceとAnimation正本は統合しない

## IMPORTANT

UIが同じでもdata authorityは分離する。

Phase 9oの既存境界を維持する。

```text
Drawing static transform
≠
ClipInstance.transformKeyframes
```

同様に、

```text
Layer Warp base / topology
≠
Warp temporal key
```

```text
Rig definition / Mesh / binding
≠
Rig Motion key
```

同じCanvas grammarを共有しても、保存正本を混ぜない。

---

# 19. Phase 9oの現在作業への影響

## DO NOW

現在B4 Owner correction 2の確認を完了する。

- content-center Anchor
- 一本線Scale
- last-touched handle priority
- flip後の再展開
- Anchor追従
- preview quality

BASIC close条件を決める。

現在のTransform overlay / geometry / History境界は将来も高確率で使うため、ここは進めてよい。

## DO NOT NOW

この追補を理由にPhase 9oへ以下を並走させない。

- Right RIG tab削除
- RIG WORKSPACE移植
- Animation Table全面変更
- Auto Key
- Lazy Lane
- Root-first Rig
- AutoMesh改修
- Project schema migration
- Motion data migration

現Phase scopeを守る。

---

# 20. BASIC close後の次Gate候補

## Architecture Gate — Spatial Authoring Ownership

問い:

> **Static spatial authoringの正面玄関をTransformへ一本化するか。**

比較:

```text
A Current Right RIG
B Full Transform Integration
C Layer RIG badge + Transform Authoring
```

評価軸:

- 初見で「絵を曲げたい」時に迷わない
- RIGを知らなくてもTransformから開始できる
- Layer Panelが対象選択に集中できる
- Animation Tableが時間編集に集中できる
- Rig状態のdiscoverability
- Rig hierarchyの一覧性
- Transform panelの注意量
- mobile/narrow width
- pen操作
- existing authority再利用
- second editorを作らない
- History / save boundary不変

---

# 21. Architecture GateのAcceptance Task

## Task A — 単純Animation

「このLayerをF12で右へ動かす」

期待:

```text
Animation Table open
→ F12
→ V Transform
→ Move
→ Play
```

RIG / Motion mode不要。

## Task B — 一枚絵のWarp

「髪を少し曲げて揺らす」

期待:

```text
Transform
→ WARP
→ shape

Animation Table open
→ frame
→ same WARP
→ key
```

別Warp Workspaceを理解しなくてよい。

## Task C — 複数関節

「肩・肘・手首を繰り返し動かす」

期待:

```text
Transform
→ Advanced
→ RIG
→ ROOT
→ Joint
→ AutoMesh
```

ここで初めてRIGへ進む。

## Task D — Rig Animation

「肘をF12で曲げる」

期待:

```text
Animation Table open
→ elbowを選択
→ Canvas Transform / Controller drag
→ F12 key
```

Rig setup editorとMotion modeを往復しない。

---

# 22. 将来のPanel責務

## Layer Panel

```text
Layer / Folder / CAF
Selection
Visibility
Order
Hierarchy
Clipping
RIG status badge optional
```

## Transform

```text
Basic
Distort
Warp
Rig
Mesh
Influence
```

## Animation Table

```text
Frame
Timing
Key
Lane
Easing
Playback
Temporal projection
```

## Canvas

```text
Direct manipulation
```

この4surfaceを基準にする。

---

# 23. 命名について

## HOLD / COMPARE

`Layer Transform` の中にRig / Meshまで入ると、

> Transformという名称が狭いのではないか

という疑問は将来あり得る。

ただし今は変更しない。

理由:

- desktop graphics toolで既知語
- `V Transform`がすでにTegakiの入口
- BASIC / DISTORT / WARPとの親和性が高い
- 早期renameは学習線を揺らす

まずTransform familyとして成立するかを検証し、必要なら後で大分類名称だけ比較する。

---

# 24. Current / Future Confidence Map

## HIGH CONFIDENCE — 今の実装を担保してよい

- Layer TransformをCanvas-first共通語彙へする
- BASIC overlay / handle grammar
- static / temporal data authority分離
- single History authority
- single static Rig authority
- Layer Warp Grid ≠ Rig Mesh
- Canvas direct manipulation
- Focus Lens
- visible/hit-area分離
- content-center Anchor方向

## MEDIUM CONFIDENCE — 次Gateで比較

- Right RIG tabを残すか
- RIG authoringをTransformへ統合するか
- Layer rowのRIG badge
- Advanced Transform disclosure
- Motion buttonの最終役割
- Interaction Context表示
- Animation Table open = ANIMATE
- Lazy Lane materialization

## LOW CONFIDENCE — 今磨き込まない

- 現RIG WORKSPACE横長layout
- `RIG / MOTION / WARP` top-level tabs
- static setupをAnimation Table内に置く導線
- all child lanes default open
- current Bone glyph final形
- Manual Mesh中心のonboarding

---

# 25. CODEX Short Instruction

1. Phase 9o B4 Owner correction 2を現在のscopeで完了する。
2. BASIC closeまではRIG / Animation Bridgeを並走させない。
3. ただし次Gateを `Spatial Authoring Ownership / Transform Integration` として予約する。
4. GateではA Current Right RIG / B Full Transform / C Badge + Transform Authoringを比較する。
5. 第一仮説はC、第二仮説はB。
6. Phase 9nで得たstatic / temporal separationとsingle authorityは維持する。
7. Right RIG presentationを変更しても9nのauthority成果を捨てない。
8. static Rig / Mesh / Weight authoringはTransform familyへ寄せる案を優先比較する。
9. Animation TableはFrame / Key / Timing / Laneへ純化する。
10. Motion buttonをAnimation開始条件にしない。
11. Rig hierarchyはTimelineにprojectionしても、TimelineをRig graph正本にしない。
12. Transform UI統合時もstatic dataとtemporal key dataを統合しない。
13. Focus LensでAdvanced Rig / Mesh / Weightを段階開示する。
14. Layer PanelはWHAT、TransformはHOW、Animation TableはWHENという評価軸を使う。
15. この追補は一括実装契約ではなく、BASIC close後のArchitecture Gate資料として扱う。

---

# 26. Design Thesis

Tegakiの導線を最も短くすると、

```text
Layerを選ぶ
↓
Transformで動かす
↓
Animation Tableを開けば、その変形が時間へ記録される
↓
直接操作が面倒になったらTransform内でRIGを追加する
```

となる。

この設計では、

> **Drawing用の変形、Animation用の変形、Rig用の変形を別々の入口として学ばせない。**

Spatial manipulationはTransformへ集約する。

Animation Tableは、

> **その操作をいつ記録するか**

だけを担当する。

Layer Panelは、

> **何を操作するか**

だけを担当する。

最終的な原則:

> **WHAT = Layer  
> HOW = Transform  
> WHEN = Animation Table  
> DO = Canvas**

この純化が、今後のTegaki UI/UX Architectureを評価する基準候補である。

---

# 27. Current GitHub References

- Phase 9o  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/task-codex/phase9o.md

- PROGRESS  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/tegaki_work/PROGRESS.md

- Phase 9n close結果はPROGRESSおよびPhase 9o冒頭の継承条件を参照。
