# Tegaki RIG / Motion 責務再配置 提案書
## Animation Table から RIG authoring を分離する Architecture Gate

更新日: 2026-08-30  
用途: CODEX 比較 fixture / Architecture Gate 用  
前提: 既存 Phase 8d / 9l の正本・History・save schema・solver を維持し、UI責務だけを比較する。

保管方針: Phase 9n Gate 0はDを第一採用したが、A / B / Cを削除しない。production評価で右dock切替に不満が出た場合、left配置を含む再比較の原案として本書へ戻る。現行の限定実装契約は`task-codex/phase9n.md`を優先する。

進捗: Stage A shared projection、Stage B read-only `LAYERS / RIG` shell、Stage C1 RIG対象登録は2026-08-30にcheckpoint完了。C1はFolder=`親子RIGを開始`、Raster=`全体PIVOTを開始`と結果の方法を明示し、既存adapterへ委譲した。次はStage C2 Raster method fork Gateとして、一枚Rasterの`曲げRIG / 全体PIVOT`入口を同じ右RIG面で分ける。新しいMesh / Bone mutationは同時実装しない。

---

## 0. 結論

第一候補は次の三分割。

1. **右 Layer Panel**  
   対象の選択、Layer/Folder構造、visibility、RIG状態 badge、RIG panel への入口。

2. **右 RIG Panel（新しい contextual inspector）**  
   時間に依存しない setup / authoring を担当。
   - 親子RIG
   - Raster 曲げRIG / 全体PIVOT
   - BONE作成 / hierarchy
   - Mesh生成 AUTO GRID / AUTO SHAPE / AUTO LINE
   - Mesh topology edit
   - Skin / Weight
   - Warp Bind / GRID setup
   - diagnostics / correction

3. **Animation Table**  
   時間に依存するものだけを担当。
   - playback
   - clip / frame / key
   - Bone / Part Motion key
   - easing / graph
   - WARP key / interpolation
   - Motion clipboard
   - time-range operations

要約すると、

> **Layer = 何を編集するか**  
> **RIG = どう動ける身体を作るか**  
> **Motion = いつ・どう動かすか**

とする。

現状のように Animation Table 内で「身体を作る操作」と「時間上で動かす操作」が混在するより、ユーザーのメンタルモデルと既存データモデルの双方に適合する。

---

# 1. なぜ今回このGateを立てる価値があるか

Tegaki は現状、RIG UI が既に二箇所へ分散している。

### Animation Table側

- Folder `+RIG`
- Raster `RIG設定`
- BONE追加
- AUTO GRID / SHAPE / LINE
- 全体PIVOT
- WEIGHT
- Motion
- WARP setup / key 操作

### 右Layer Panel側

- internal Layer / Folder のRIG badge
- Layer属性Popupの `+RIG`
- `ROOT BONEを作成`

ただし右Panel側のmutationは、現在もAnimation Tableのexternal adapterへ委譲される。

つまり現状は

> **表示入口は分散、操作意味も重複、authorityはAnimation Table寄り**

という中間状態。

このため「Animation TableのRIGボタン名を改善する」だけでは、長期的な責務問題は残る。

---

# 2. Tegakiのデータモデル自体が分離を支持している

Phase 8d の維持契約では、

- static正本: `ClipAsset.rigDefinition / meshDefinitions / skinBindings`
- Frame正本: `ClipInstance.rigMotion`

と既に分かれている。

これはUI設計へ翻訳すると、

### Static / object-space
- Boneを何本持つか
- 親子関係
- Mesh topology
- Skin binding
- Weight
- Bind pose
- Warp Bind GRID

### Temporal / time-space
- Frame NでBoneを何度回すか
- keyframe
- interpolation
- easing
- Warp key

である。

したがって、

> static authoring を Timeline UI の内部に置かなければならない技術的必然性はない。

むしろデータ構造とUI構造を一致させる方が説明しやすい。

---

# 3. 他ツールの比較

## Spine

Spineは明確に **Setup mode / Animate mode** を分ける。

- Setup: skeletonの作成・構成
- Animate: animationの作成、graph / dopesheet

これは今回のTegaki案に最も直接的な先例。

参考:
https://en.esotericsoftware.com/spine-ui

## Live2D Cubism

Cubismは **Modeling Mode / Animation Mode** を分ける。

Modeling側:
- Warp Deformer
- Rotation Deformer
- Auto Generation of Deformer
- Mesh Edit
- Automatic Mesh Generator

Animation側:
- modelを読み込む
- Timeline
- keyframe
- motion

つまり「変形可能なモデルを作る工程」と「そのモデルへ時間を与える工程」を分離している。

参考:
https://docs.live2d.com/en/cubism-editor-tutorials/animator/
https://docs.live2d.com/en/cubism-editor-manual/modeling-menu/
https://docs.live2d.com/en/cubism-editor-manual/timelinepalatte/

## ToonSquid

ToonSquidはBones / MeshをLayerへ付く **Effect** としてInspectorから追加する。

- Layerを選ぶ
- Inspector → Effects → Bones / Mesh
- canvas上でBone / Meshを編集
- animation時はkeyframeを生成

Tegakiでいう「Layerを対象にしてRIG authoringを右Inspectorへ出す」案に近い。

参考:
https://toonsquid.com/handbook/effects/effects/
https://toonsquid.com/handbook/effects/bones/
https://toonsquid.com/handbook/effects/mesh/

## Adobe Animate — 反例として重要

Adobe AnimateのLayer ParentingはTimeline上のLayer hierarchyに統合されている。

つまりRIGをTimelineへ置く設計自体が誤りではない。

ただしAdobe方式は

> Layer = Timeline row

が強く一致するアプリケーションなので成立しやすい。

Tegakiは現在、

- normal Layer
- CAF internal Layer
- Animation Table lane / clip
- Layer Panel mirror

が別責務になっている。

したがってAdobe型をそのまま採用すると、現在の「どのLayer representationが正本か」という問題を強める可能性がある。

参考:
https://helpx.adobe.com/animate/desktop/workspace-and-workflow/timeline.html

---

# 4. 比較すべき4案

## A — Current / Animation Table中心

Animation Table内:
- RIG
- Mesh
- Weight
- Warp
- Motion

右Layer Panel:
- selection / mirror / badge程度

### 利点
- 実装変更が最小
- Motionへ続く導線が短い
- 現在のauthorityと一致

### 欠点
- static setupとtime editingが混ざる
- Animation Tableが巨大化する
- Canvas面積をTimeline + setupが同時に奪う
- 描画修正→Mesh/Weight修正の往復が遠い
- 初心者が「RIGはAnimationの一種」と理解しやすい

---

## B — Layer PanelへRIG機能を直接統合

各Layer card / attribute popup内に
- RIG method
- Bone
- Mesh
- Weight
- Warp setup

を入れる。

### 利点
- 対象Layerとの対応が最も直接的
- 描画修正との往復が理解しやすい
- Layerを選択→RIG設定、というobject-centric flowになる

### 欠点
- Layer Panelが肥大化
- 一つのRIGがFolder配下の複数Layerを支配する場合、個々のLayer属性のように見えてしまう
- visibility / opacity / clipping と Weight / Mesh authoring の情報水位が競争する
- 通常描画ユーザーへ専門操作を露出しすぎる

### 判定

**RIG全機能をLayer Panelへ埋め込む案は非推奨。**

Layer Panelは「対象選択・状態・入口」までに留めた方がよい。

---

## C — Dedicated RIG Panel

右Sidebarへ独立した `RIG` panelを追加する。

Layer Panelとselectionは共有するが、RIG authoringは別surface。

### 利点
- object selectionとrig authoringが近い
- Timelineからstatic authoringを排除できる
- Canvas-firstにしやすい
- Mesh / Weight / Boneの専門UIを育てられる
- 通常Layer属性を汚さない

### 欠点
- 新しいpanel shellが必要
- Layer / RIG間のselection同期が必須
- panelを常設するとCanvas幅を奪う

### 判定

**第一候補。**

ただし「右へ第二列を常時追加」ではなく、既存右Sidebarのcontent modeとして追加する方がよい。

---

## D — Recommended hybrid

Cをベースに責務を明文化する。

### Layer Panel
- target selection
- Layer structure
- visibility
- clipping
- RIG badge
- `RIGを編集` handoff

### RIG Panel
- static rig authoring

### Animation Table
- temporal animation

これを第一候補とする。

---

# 5. 右Sidebarの具体案

## 通常Drawing mode

```text
RIGHT SIDEBAR

[ LAYERS ]

CAF / Layer list
...
```

RIG専門UIは出さない。

## CAF / Animation workspaceへ入る

```text
RIGHT SIDEBAR

[ LAYERS ] [ RIG ]

選択中CAF / Layer context
...
```

重要:

**RIG tabの出現条件を「Animation Tableが開いているか」に直接結び付けない。**

正しくは、

> animation / CAF editing context がactiveか

で判定する。

Animation Tableを閉じてもRIG Panelを使えるようにする。

理由:
- Canvasを広くしてBone / Weight / Meshを編集したい
- 描画修正しながらRIG調整したい
- Phase 9lは既に「Table closeでもCAF editing contextを失わない」ことを固定している

Animation Table openは、
「Animation workspaceへ入る一つの入口」
であって、RIG Panelのdata authority条件ではない。

---

# 6. sidebarは「伸ばす」より「切り替える」を標準にする

第一案では、右側へ

```text
Layer Panel | Rig Panel
```

の二列を常時追加しない。

1280×720 / pen / touchではCanvasが狭くなる。

推奨:

```text
┌──────────────┐
│ LAYERS | RIG │
├──────────────┤
│              │
│ current view │
│              │
└──────────────┘
```

同一幅・同一dockでcontentを切り替える。

### Wide optional

十分な横幅がある場合のみ、

```text
[Layers] [Rig Inspector]
```

のpin / split viewを将来候補にしてよい。

ただし初回Gateでは不要。

---

# 7. Layer Panelに残すRIG情報

Phase 9lで右Panelは「現在targetを見失わない」役割を強めた。

ここにRIGの詳細操作まで入れず、次だけを残す。

```text
Character.png
[ RIG: 曲げ ]        [編集 >]
```

または

```text
Head Folder
[ RIG: 親子 ]        [編集 >]
```

未設定:

```text
Character.png
[ RIG 未設定 ]       [設定 >]
```

押すと同じselectedInternalLayerIdを保持したままRIG tabへ切り替える。

RIG badge自体を意味のあるstatusへ昇格する。

---

# 8. RIG Panelの情報階層

## Header

```text
RIG
Character.png
Raster
```

Layer Panelのtargetと同期。

## Method

未設定Raster:

```text
どう動かしますか？

[ 曲げて動かす ]
 BONE + MESH

[ 一枚全体を動かす ]
 PIVOT / 変形なし
```

Folder:

```text
親子RIG
パーツ全体を親子で動かす
[ 作成 ]
```

## Setup

曲げRIG:

```text
BONES
[ + BONE ]

MESH
[ AUTO GRID ]
生成方法 >
  AUTO SHAPE
  AUTO LINE

SKIN
CURRENT
[ WEIGHT ]

MESH
[ EDIT ]
```

### Advanced

診断 / correctionはaccordion等の第二水位。

---

# 9. WARPはSetupとMotionへ二分する

「WARPを全部RIG Panelへ移す」は行わない。

現行WARPにはstaticとtemporalが同居している。

## RIG Panelへ

- Warp作成
- GRID Bind
- Bind frame
- Refit bind
- topology / static control lattice
- child pivot binding configuration

現コードでもGRIDは「全Frame共通のGRID Bind枠」。

## Animation Tableへ

- WARP KEY
- prev / next key
- copy / paste / clear key
- interpolation
- 現在FrameのLens transform
- time-dependent warp pose

つまり、

> **Warp bodyを作る = RIG**
> **Warp bodyを時間上で変形する = Motion**

とする。

---

# 10. 描画修正時に右RIGが有利な理由

ユーザー仮説の通り、大きな利点がある。

例:

```text
腕の絵を修正
  ↓
Layer Panelで Arm を選択
  ↓
Canvasで描き直す
  ↓
RIG tab
  ↓
AUTO GRID再生成 / MESH EDIT / WEIGHT確認
```

この往復ではTimeline上のframe位置より

> 「どの絵を修正しているか」

の方が主要context。

Layer selectionとRig Inspectorが同じ右side contextを共有すると、対象を見失いにくい。

特に今後

- manual mesh
- auto mesh
- shape generator
- weight brush
- topology
- deformer

が増えるほど、Animation Tableよりobject-centric Inspectorの方が拡張しやすい。

---

# 11. Motion側からRIGを完全に消さない

Animation TableからRIGの**編集UI**は外すが、handoffは残す。

例:

```text
Arm Bone Motion
RIG未接続
[ RIGを設定 > ]
```

押す:

- selected CAF保持
- selected target保持
- current frame保持
- 右SidebarをRIG tabへ切替
- 必要なstepへfocus

完了後:

```text
[ Motionへ戻る ]
```

あるいはAnimation Table側の選択がそのまま生きているので、RIG tabを閉じるだけ。

これにより分離しても行き止まりを作らない。

---

# 12. 既存Phase 8d / 9lとの整合

## Phase 8d

既に

> Canvas-first Rig Workspace shellを段階導入

を採用している。

今回のDedicated RIG Panelは、この抽象方針を

> **右Sidebarのcontextual RIG inspector**

として具体化する案と解釈できる。

新しい思想への方針転換ではない。

## Phase 9l

既に

- 右Panelは選択CAF一件とinternal Layer listを投影
- current targetを一義に見せる
- Table closeでもCAF context継続
- data model / mutation authorityを二重化しない

を固定している。

したがってRIG Panelも

- selectedInternalLayerIdを共有
- 第二selection stateを作らない
- 第二Rig modelを作らない
- Animation Table open/closedをauthority切替に使わない

ことが必須。

---

# 13. CODEX Gate案

## Gate 0 — static comparison only

同一stateで次を比較。

### A Current
Animation Table内RIG。

### B Layer-integrated
Layer Panel内部へRIG controls。

### C Dedicated Right RIG
Layers / RIG tab切替。

### D Dedicated Right RIG + Motion handoff
Cに加えてAnimation TableはMotion専用化し、
`RIGを設定 >` handoffだけ残す。

推奨: **D**

---

# 14. Fixture state

最低限:

1. one Raster / no rig
2. one Raster / mesh rig
3. one Raster / whole pivot
4. Folder with 3 child layers / parent rig
5. 11 Bone dense rig
6. mesh stale after drawing edit
7. weight correction required
8. WARP bind + multiple warp keys

Layout:

- 1280×720
- wide
- narrow
- Table open
- Table closed
- Layer tab
- RIG tab

---

# 15. 評価軸

## Cognitive

- 「絵を作る場所」「身体を作る場所」「動きを付ける場所」が説明できるか
- static / temporalの区別が予測できるか
- 現在対象を見失わないか
- mode errorが減るか

## Interaction

- draw → rig → draw の往復距離
- rig → motion の往復距離
- wrong surface click
- panel switching回数
- canvas visible area
- pen/touch target size

## Architecture

- second selection state 0
- second Rig authority 0
- save schema変更 0
- History semantic変更 0
- evaluator変更 0

---

# 16. Production移行案

## Stage A — projection

- RIG status projectionをpure化
- `none / parent / bend / whole / conflict / stale`
- Layer Panel badgeとRIG Panel headerが同じprojectionを使う

## Stage B — RIG Panel shell

- Right sidebarへ `LAYERS / RIG`
- selectedInternalLayerId共有
- read-only stateから開始
- Table open/closed independent

Phase 9nでproduction checkpoint済み。runtime-only view lens、既存`selectedCelId / selectedInternalLayerId`共有、normal drawing非露出、172px footprint維持を固定した。

## Stage C — setup mutation移管

UI surfaceだけ移す。

mutation implementationは既存adapterを再利用。

- add bone
- auto grid
- whole pivot
- weight
- mesh edit

`animation-table-popup.js`からmodel logicを一括移動しない。

## Stage D — Animation Table cleanup

RIG setup DOMを削るのは最後。

先にproductionでRIG panel経路を成立させてから、

- RIG target setup controls
- static mesh controls
- static weight controls

を段階的に撤去。

Motion handoffのみ残す。

---

# 17. STOP条件

今回同時にやらない。

- ClipAsset schema変更
- LayerSystemとCAF model統合
- Bone solver変更
- Skin algorithm変更
- Weight algorithm変更
- Warp key schema変更
- Animation Table全面再設計
- Right Layer Panel renderer全面置換
- Sidebar width永続化の新save state

---

# 18. 最終提案

現行案の「Animation Table内でRIG入口を改善」は、
短期修正としては成立する。

しかし中長期のTegakiでは、

- Bone
- Mesh
- Auto Mesh
- Shape
- Weight
- Warp Bind
- Manual Topology

が増えるほどAnimation Tableは「Timeline」ではなく「Animation全部入りPanel」になってしまう。

Tegakiの今後を考えると、

> **Animation Table = 時間**
>
> **Right RIG Panel = 構造**
>
> **Layer Panel = 対象**
>
> **Canvas = 直接操作**

という4面の責務分離の方が拡張性が高い。

特に右RIG Panelは、Phase 8dのCanvas-first方針とPhase 9lの右Panel context統一を同時に活かせる。

したがって次Gateでは、
従来の「RIGボタン名比較」を一旦下位問題へ置き、

> **RIG authoring responsibility: Animation Table / Layer Panel / Dedicated Right RIG**

のArchitecture Gateを先に比較することを推奨する。
