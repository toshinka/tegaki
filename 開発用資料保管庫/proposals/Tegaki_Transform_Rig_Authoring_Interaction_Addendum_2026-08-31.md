> 状態: REFERENCE — 2026-09-05再構成で現行の作業順/正本から分離。採用済み事項と未採用案が混在する原資料。本文中のACTIVE/現行Phase/次の作業は執筆時点の記録。現在の判断は `docs/ROADMAP.md`、実装状態は `docs/AUDIT.md`、資料の効力は `docs/DOCUMENT_REGISTER.md` を参照する。

# Tegaki Transform / RIG Authoring Interaction Addendum
## 前提操作から高度Riggingまでを一本の学習線にするための追補
### — Input Grammar / Symbol Family / Root-first Rig / AutoMesh-first / Future Compatibility —

更新日: 2026-08-31  
用途: CODEX / SOL / MAX 向け追補設計資料  
前書: `Tegaki_Transform_Warp_Animation_Rig_FocusLens_Proposal_for_CODEX_2026-08-31.md`  
位置づけ: **Working Addendum。実装契約ではない。**  
目的: 前書で定義した `DRAW → TRANSFORM → ANIMATE → RIG → MESH/WEIGHT` の学習線を、Canvas操作・記号体系・Rig作成手順・AutoMesh・将来の高度変形まで具体化し、**現行実装のどこを恒久化し、どこを暫定足場として扱うべきか**を判断しやすくする。

採用状況（2026-08-31）: Phase 9o Gate 1=`GO — D: Tegaki hybrid`。Stage B1 / B2はOwner acceptance済み、Stage B3ではquiet rotation handle、visual / hit area分離、既存Anchor基準、History / save非所有をproductionへ限定接続した。side midpoint、bounds-center Origin、scrubbable numeric、symbol familyは後続の比較契約とし、Root-first RIG / AutoMesh-first / TEST POSE / Mesh品質は現Phaseへ混ぜず後続Gateへ保持する。現行実装契約は`task-codex/phase9o.md`を優先する。

追加改訂: `Tegaki_Transform_Rig_Authoring_Interaction_Addendum_REVISED_2026-08-31.md`のSection 37–63にInteraction Context、Instant Animation、Lazy Lane Disclosureを保持した。これらはAnimation Bridge前のArchitecture Gate候補であり、Phase 9o Stage B3へ一括接続しない。

---

# 0. Executive Summary

本追補の中心仮説は次の5点。

1. **Layer TransformをTegaki共通の直接操作文法にする。**
2. **Transform Origin / Rig Joint / Bone Controllerを同一のvisual familyで段階的に成長させる。**
3. **Rig authoringは「Rootを置く → Jointを伸ばす → 自動Mesh → 必要なら詳細」へ寄せる。**
4. **AutoMeshを第一水位、Guideを第二水位、Manual topologyを第三水位にする。**
5. **今のRIG WORKSPACEはauthority整理のhostとしては有効だが、最終UXとしては固定しない。**

Tegakiの長期的な操作体系を一文で表すと、

> **まず絵を直接動かす。  
> 同じ操作に時間を与える。  
> 反復が面倒になった時にRIGで関係性を作る。  
> 崩れ方まで制御したくなった時にMesh / Weightへ降りる。**

これを次期UI/UXの設計基準として扱う。

---

# 1. Status Legend

本書では各案に以下の状態を付ける。

## RECOMMEND

有力。次Gateで実際に比較または実装候補へ上げる価値が高い。

## COMPARE

方向は有力だが、fixture / Browser / Owner実使用で比較して決める。

## HOLD

将来候補。現Phase / 次の最小Phaseへ混ぜない。

## OBSERVATION

Owner実機・既存UI・他ツール調査から得た事実や懸念。解決方法はまだ固定しない。

---

# 2. 現行実装を「残すもの」と「暫定足場」に分ける

## RECOMMEND — 残すべき基盤

現行Phaseで以下の責務整理は継続してよい。

- Layer = 対象選択
- Right RIG = static rig overview / entry / handoff
- Animation Table = temporal editing
- Canvas = direct manipulation
- second Rig authorityを作らない
- static Rig editorはsingle host
- History / save / selection authorityを複製しない

これらはTransform-firstへ進んでも無駄にならない。

---

## RECOMMEND — 暫定hostとして残す

現行 `RIG WORKSPACE` は、

> static RIG editorを一つだけ持つためのhost

としては残してよい。

ただし以下は**最終UIとして担保しない**。

- 横長Ribbon
- X / Y / Rotation数値の常設
- BONE / AUTO GRID / AUTO SHAPE / AUTO LINEの横並び
- Parentの常時表示
- Diagnostic / Weight / Correct / Brush / Mesh Editの同時露出
- `RIG / MOTION / WARP` のtop-level分類

つまり、

> **host ownershipは残る可能性が高い。content hierarchyは作り直す可能性が高い。**

この区別を現Phase close時に明記する。

---

# 3. Tegaki共通 Input Grammar

## RECOMMEND

Layer Transformをpilotとして、Tegaki全体へ将来展開できる入力規格を定義する。

優先順位:

```text
1. Canvas direct manipulation
2. Keyboard / 左手deviceによる高速操作
3. Numeric scrubによる精密操作
4. Pen-only fallback
```

PC操作を第一にしつつ、

> **ペンだけでも最後まで到達できる**

ことを目標にする。

iPad型UIへ全面移行するのではなく、PC最優先の中にpen-friendlyな経路を持つ。

---

# 4. Numeric Fieldを共通部品へ

## RECOMMEND

現行Sliderの代替候補:

```text
X       ◀ [    10 px    ] ▶
Y       ◀ [    -9 px    ] ▶
回転    ◀ [     0°      ] ▶
拡縮    ◀ [    1.00×    ] ▶
```

中央の数値欄そのものを大きめの操作領域にする。

### 操作

- click → 直接数値入力
- horizontal drag → scrub
- wheel → 1 step
- keyboard ↑ / ↓ → 1 step
- modifier + wheel / arrow → large / fine step
- left/right button → penで微調整
- button hold → auto-repeat / optional acceleration

### 理由

4方向step buttonを常設するより、

> `◀ [scrubbable value] ▶`

の方が中央fieldを広く取れ、panel densityも下げられる。

大移動はscrub、微調整はarrow。

PCではmodifier / keyboardを使う。

---

## COMPARE — 大step button

以下は比較候補だが第一候補にはしない。

```text
≪  ◀ [10.0] ▶  ≫
```

理由:

- spaceを取る
- control countが増える
- scrub fieldがすでにcoarse adjustmentを担える
- modifier / long pressで代替可能

実使用で±10 / ±100の明示buttonが必要と判明した場合のみ復活。

---

# 5. Numeric Fieldを全UIへ機械適用しない

## RECOMMEND

共通規格は、

> **独立したNumeric Fieldが存在する場所**

へ適用する。

候補:

- Transform
- Motion
- Warp parameter
- Brush size
- Weight strength
- Easing parameter
- Mesh density

一方、Layer rowのopacity等は慎重に扱う。

Layer rowは将来的に、

- D&D
- swipe action
- selection
- visibility
- reorder

等と横gestureが競合する可能性がある。

### 原則

> 共通Componentは作る。全surfaceへの一括適用はしない。

---

# 6. Transform Handle Grammar

## RECOMMEND — Basic

Canvas上の基本形:

```text
          ○
          │
  ○────────────○
  │            │
  │     ⊕      │
  │            │
  ○────────────○
```

意味:

- corner = scale
- side midpoint = one-axis scale
- inside = move
- top handle / box外drag = rotate
- center = Transform Origin

これはCSP / Photoshop / Procreate系の学習済み操作文法へ寄せる。

---

# 7. 上部Rotation Handle

## RECOMMEND

削除より、

> **標準的なRotation Handleとして意味を固定して残す**

方を推奨。

PCでは、

- box外drag
- modifier
- shortcut

でも回転可能。

Pen-onlyでは、

- visible rotation handle

が重要なaffordanceになる。

### Visual

常時はややquiet。

- thin line
- small circle
- dark Futaba outline
- hover / selected / dragでorange

とする。

Orangeだけに識別を依存しない。

---

# 8. Transform Origin

## RECOMMEND

初期位置はCanvas中央ではなく、

> **選択object / visual boundsの中心**

とする。

Transform対象を移動してもoriginはそのobjectへ属する。

---

## RECOMMEND — Origin編集は別操作

通常時:

```text
⊕
```

は表示・回転基準。

誤操作を減らすため、常時dragで簡単に動く状態にしない。

例:

```text
[ Originを編集 ]
```

または専用mode / iconを選んだ時だけdrag可能。

---

## RECOMMEND — 見た目とhit areaを分離

visual markerは小さくてよい。

一方input hit areaは透明に大きくする。

例:

- visual 12–16px
- hit area 24–32px以上

Penで掴みやすくしつつ、Canvas上の視覚ノイズを減らす。

---

# 9. Transform OriginとRIG symbolを同じ家系にする

## RECOMMEND

通常Transform:

```text
    ⊕
```

Rig Joint / Rotation Controller:

```text
    ⊕────────○
   root       tip
```

複数Joint:

```text
    ⊕────○────○
        elbow wrist
```

つまり、

> **Transform Originへ方向・長さ・親子関係が加わったものがRig Controller**

と認知できるvisual grammarを目指す。

### 重要

データモデルは同一化しない。

- Transform Origin = Layer Transformの基準点
- Rig Controller = hierarchy / influenceを持つRig object

見た目に血縁関係を持たせるだけ。

---

# 10. Bone Symbol比較

## Current refined

現状の「根元円＋尖ったBone」。

### 評価
**8.3 / 10**

### 長所
- Boneらしい
- 現行実装から近い
- 方向が分かる

### 弱点
- Transform Originとの連続性が弱い
- 小Canvasで少し重い
- pin / tear-dropにも見える

---

## Rotation Deformer / Lever

```text
⊕────────○
```

### 評価
**9.3 / 10**

### 長所
- 回転中心が明確
- Live2D / Rive / ToonSquid系と親和性
- 絵を隠しにくい
- Transform Originから自然に成長する

### 弱点
- 単独では「Bone」より「Controller」に見える

---

## Joint-chain hybrid

```text
⊕━━━━━━○
```

またはごく軽いtaper。

### 評価
**9.5 / 10**

### 長所
- Leverの軽さ
- Boneらしい方向性
- Origin familyとの連続性
- chainが読みやすい

### 弱点
- shaftを太くしすぎるとCanvasを隠す

---

## RECOMMEND

次fixtureでは、

1. Current refined
2. Lever
3. Joint-chain hybrid

の三案だけ比較する。

第一仮説: **Joint-chain hybrid**  
第二仮説: **Lever**

---

# 11. Boneではなく「Controller」として見る可能性

## COMPARE

表面語彙として `BONE` を残すか、

- Joint
- Controller
- Bone

へ役割分担するかは後続Gateで比較。

例:

```text
Joint = 接続点
Bone = Joint間のsegment
Controller = より一般的な操作主体
```

これなら将来、

- Rotation Controller
- Warp Controller
- Cage Controller

を一つのRig systemへ入れやすい。

ただし現時点で大規模renameはしない。

---

# 12. BASIC / DISTORT / WARP

## RECOMMEND

三水位自体は維持候補。

### BASIC
- Move
- Rotate
- Scale

### DISTORT
- 四隅
- Skew
- Perspective
- quadrilateral transform

### WARP
- grid / lattice
- nonlinear local deformation

### 認知上の階段

```text
四角全体を動かす
↓
四隅を個別に動かす
↓
中にもpointを増やして部分変形
```

非常に理解しやすい。

---

# 13. 平行四辺形・台形変形はWARPへ入れない

## RECOMMEND

四隅を個別に動かして、

- parallelogram
- trapezoid
- perspective-like shape

へする操作は `DISTORT` 側。

WARPは複数grid pointを使う非線形変形へ限定する。

これによりWARPが過剰な万能箱になるのを防ぐ。

---

# 14. 名称の比較

## COMPARE

現行候補:

```text
BASIC / DISTORT / WARP
```

は開発者視点では明瞭。

ユーザー向けでは以下も比較価値あり。

### Candidate A

```text
基本 / 四隅 / ワープ
```

初見に強い。

### Candidate B

```text
基本変形 / 歪み / ワープ
```

### Candidate C

```text
BASIC / CORNER / WARP
```

英語UIなら直観的。

### 現時点

`BASIC / DISTORT / WARP` を暫定維持してよい。

ただし選択時のhintを出す。

```text
BASIC
移動・回転・拡縮

DISTORT
四隅を動かして歪ませます

WARP
格子点を動かして部分変形します
```

---

# 15. Hoverだけに依存しないHelp

## RECOMMEND

説明水位:

1. label
2. selected contextual hint
3. mouse hover tooltip
4. `?` 詳細

Pen / touchではhoverが弱いため、

> tooltip only

にはしない。

---

# 16. Horizontal Research Map

他ツールを「どれか一つに寄せる」のではなく、得意領域別に借りる。

| Tool | Tegakiが主に借りる対象 |
|---|---|
| CLIP STUDIO PAINT | Transform / Distort / Mesh / Puppetの直接操作 |
| Procreate Dreams | Drawing TransformをそのままAnimationへ時間化 |
| Adobe Animate | Root-first / sequential Joint / Auto Mesh / easy rig onboarding |
| Live2D Cubism | ArtMesh / Deformer / AutoMesh / precise topology / high-end deformation |
| ToonSquid | Layer / Mesh / Bone bindingとCanvas-first authoring |
| Rive | Joint / Bone chainとrigid/mesh混在binding |
| Blender / Adobe系 | Numeric scrub / keyboard / mouse interaction grammar |

この役割分担は今後の調査でも維持する。

---

# 17. Adobe Animateを重要比較対象へ格上げ

## RECOMMEND

Adobe Animateは「最先端専業Rigging tool」という理由ではなく、

> **一般2D作画 / Timeline環境から、初心者をRiggingへ入れる設計**

としてTegakiとの類似度が高い。

### 2026-08-31 公式資料照合の注記

Adobe公式は2026-06-09更新ページでAnimateをmaintenance modeとし、新機能の追加予定がないと明記している。したがってAdobe Animateは「現在の最先端トレンド」の比較軸ではなく、**Root / Jointの連続配置、自動triangulated mesh、Hard / Soft、Freeze、density調整を一般2D制作者へ渡すonboarding pattern**の参照とする。衰退傾向や静かな製品状態は、長年磨かれた良い文法まで捨てる理由にはしない。外見や古い全体構造を模倣せず、使える部分をTegakiのFocus Lensと現代のpen / touch前提へ再構成する。新しさと現行支持の比較はCallipeg Studio / ToonSquid / Procreate Dreams / CSP Simple Mode等と分担するが、それらの多数派文法も絶対視しない。横断分析とOwner実使用でTegaki案が先行すると判断できる場合は、根拠を残して独自案を優先する。

特にModern Rigging / Asset Warpで参考になる点:

- 最初にRoot / Jointを置く
- jointを連続して伸ばす
- selected jointから次のjointがつながる
- Meshが自動生成される
- Canvas上で直接rigを作る
- Hard / Soft Bone
- Freeze Joint
- Mesh densityの自動設定 /調整
- 後からJointを追加できる

公式資料では、最初のjoint click時にtriangulated meshを自動生成し、選択中jointから次のjointへboneを連続追加する契約、Hard / Soft、Freeze joint、自動mesh densityと手動調整を確認した。

---

# 17.1 公式比較資料の照合結果（2026-08-31）

- CLIP STUDIO PAINTはinside drag=Move、corner=両軸Scale、midpoint=一軸Scale、上部rotator / box外drag=Rotate、Canvas reference point、Enter / Escapeを公式に持つ。Free Transform / Distort / Skew / Perspectiveとlattice Mesh / triangular Puppet Warpも別契約であり、BASIC → DISTORT → WARPの段階と整合する。
- Procreate公式はFreeform / Uniform / Distort / Warpを別modeとし、Distortを3D / tilt / angled effect、Warpをfold / wrapの非線形変形としている。
- Live2D公式はArtMeshをAuto Generationとpoint単位のManual Editに分け、opaque pixel境界、内外点間隔、alpha thresholdを自動生成の設定とする。AUTO優先とmanual後退の比較根拠として妥当。
- ToonSquid公式は選択中boneを新規boneのparentにし、Canvas配置時にhierarchyを連続構築する。Rive公式も連続clickでchild chainを作り、root boneだけがX / Yを持つ。Root-first / chain growthは複数toolに共通する学習済み文法と判定する。
- 以上はTegakiのHistory / save / authority契約を上書きする理由にはならない。現行Phaseではinteraction評価軸と後続fixture候補だけに使う。

参考:
- https://helpx.adobe.com/animate/using/character-rigging-in-animate.html
- https://helpx.adobe.com/animate/using/bone-tool-animation.html
- https://blog.technokids.com/animation/character-rigging-animation-with-adobe-animate/
- https://filmora.wondershare.com/animation-tips/adobe-animate-rigging.html

---

# 18. Root-first Rig Authoring

## RECOMMEND

初心者向けRIG作成を、

```text
RIG
[ ＋ ROOTを置く ]
```

から始める。

Canvas:

```text
体の動きの中心をクリック
```

Root設置。

次:

```text
[ ＋ 関節を追加 ]
```

RootからShoulderへdrag。

次はElbowへ。

```text
●────●────●
root shoulder elbow
```

### 利点

- 先にMesh generatorを理解しなくてよい
- Parent dropdownを毎回操作しなくてよい
- 親子関係がCanvas gestureから自然にできる
- 一つだけの簡単Rigから後でchainへ育てられる
- 最初に一枚Layerへ一Controllerしか想定しなくても拡張しやすい

---

# 19. 「最初は一Controller、後でchain化」を許す

## RECOMMEND

初回UIは一つのRotation Controllerでもよい。

ただしdata / UI architectureは、

> 後から同一Layerへ複数Jointを追加可能

な方向を閉ざさない。

例:

```text
初期
● ROOT
```

後で:

```text
● ROOT
 └─● shoulder
    └─● elbow
```

これにより最初の学習を簡単にしつつ、後の高機能化へ移行できる。

---

# 20. AutoMesh-first

## RECOMMEND

Rig Mesh生成は最初からgenerator名を選ばせない。

初期表示:

```text
MESH
AUTO ✓
```

Jointを作った時点で必要ならAutoMesh生成。

ユーザーは、

> 「Jointを置いたら曲げられるようになった」

と理解する。

---

# 21. Meshの三水位

## RECOMMEND

将来的なMesh authoring:

```text
AUTO
↓
GUIDE
↓
MANUAL
```

### AUTO

最初はこれだけ。

- one click
- sensible density
- contour-aware
- joint-aware
- transparent padding / image bounds考慮

### GUIDE

AutoMeshに少量の指示を与える。

候補:

- stroke along contour
- joint line
- density hotspot
- protect region
- edge guide

例:

> 頬線に沿って細かくする  
> 肘周辺のpointを増やす  
> 胴体への影響を少なくする

### MANUAL

- vertex
- triangle
- topology
- winding
- fine adjustment

高精度が必要な人だけ。

---

# 22. AutoMesh精度をManual機能数より優先する

## RECOMMEND

短中期では、

> Manual topologyの機能数を増やすより、AutoMeshの平均成功率を上げる

ことを優先候補にする。

理由:

- 初心者導線に直結
- Rig開始時の工程を一つ減らせる
- 後のWeight調整量も減る
- Live2D級のManual authoringは必要ユーザーが限定的
- Drawing→AnimationというTegakiの軽さを維持できる

---

# 23. Live2Dから借りる高度Mesh思想

## HOLD / FUTURE

Live2Dでは、

- Automatic Mesh Generator
- Manual point edit
- contour-sensitive dense mesh
- detailed facial topology
- Deformer hierarchy

が強い。

顔の横向きなど、

> 頬・口・目の周囲で局所的に大きく形状が変わる

場合は、均一gridよりArtMeshの方が強い。

Tegakiでも将来的に、

- contour-aware mesh
- feature-aware density
- local refinement
- stroke-guided mesh

を研究対象にできる。

ただしTransform / Root-first Rigの導線確立より先にやらない。

---

# 24. Hard / Softのような初心者向けWeight抽象化

## HOLD → 比較価値高

Adobe AnimateのHard / Soft Boneのように、

> Weight editorへ入る前の簡単な変形品質preset

を研究できる。

例:

```text
曲がり方

● しっかり
○ なめらか
```

内部では、

- rigid influence
- short joint blend
- wider blend

等へmapping。

### 目的

ユーザーに最初からWeight Brushを要求しない。

---

# 25. Freeze / Protect Region

## HOLD

Adobe AnimateのFreeze Jointや、Live2D / Weight authoringの考えから、

> 「ここは引っ張られたくない」

を簡単に指定するUXを研究。

例:

```text
[ この範囲を固定 ]
```

またはGuide Meshの一種として、

```text
PROTECT
```

をCanvasで塗る。

肘を曲げた時に胴体まで動く問題への初心者向け入口になり得る。

---

# 26. Warp GridとRig Meshを混同しない

## RECOMMEND

### Layer Warp Grid

ユーザーが直接格子を操作。

```text
Raster
↓
Warp Grid
↓
Timeline key
```

### Rig Mesh

Controller / Bone / Deformerから影響を受ける内部構造。

```text
Raster
↓
Rig Mesh
↓
Controller
↓
Weight
```

両方がgrid / meshに見えても目的は違う。

UI名称・icon・説明を分ける。

---

# 27. WARPがMeshを持つ時の将来像

## HOLD

Layer Warpの単純regular gridから始める。

将来、

```text
Simple Grid
↓
Adaptive Grid
↓
ArtMesh-like topology
```

へ高度化する可能性を持つ。

重要なのは最初から一つの巨大Mesh systemへ統合しないこと。

まず、

> **普通のWarpを普通に使える**

ことを優先。

---

# 28. TEST POSE

## HOLD / RECOMMEND FOR FUTURE GATE

RIG作成中に、

```text
[ TEST ]
```

を押してCanvas上で自由に動かす。

状態:

```text
TEST POSE
Timelineには記録されません
[ RESET ]
```

### 目的

- jointを置いた直後に結果確認
- AutoMeshの品質確認
- Weight leakage確認
- Parent関係確認

### 初期契約候補

- runtime-only
- saveしない
- Historyへ正式Motionとして積まない
- Timeline key 0
- reset可能

将来的に、

```text
[ この姿勢をMotionへKey化 ]
```

を比較。

---

# 29. Focus LensとしてのRig Authoring

## RECOMMEND

Rig Workspaceを最初から全機能表にしない。

未設定:

```text
RIG
[ ROOTを置く ]
```

Root後:

```text
ROOT ✓
[ 関節を追加 ]
[ TEST ]
```

Joint後:

```text
JOINT 3
MESH AUTO ✓
[ TEST ]

> Mesh
> Influence
> Parent
```

問題が起きた時だけ:

```text
> Mesh
> Weight
> Diagnostics
```

を開く。

ユーザーに「工程表を読む」ことを要求しない。

---

# 30. 将来のAnimation Focus Lens

## RECOMMEND FOR FUTURE

Rig hierarchyができた後もAnimation Tableで全Laneを自動展開しない。

候補:

```text
ACTIVE
BRANCH
ALL
PIN
```

### ACTIVE
現在Canvas / RIG / Layerで選択中のControllerだけ。

### BRANCH
親 + 選択 + 子孫。

表示順:

```text
parent
 └ child
    └ grandchild
```

### ALL
CAF全体。

### PIN
比較したいtargetを明示追加。

### 重要

保存されたLayer順 / lane orderをRig parent変更のたびに書き換えない。

Rig graphから**表示projection**だけを作る。

---

# 31. 先の見通しから見た現行設計の担保

以下は将来も残る可能性が高い。

## HIGH CONFIDENCE

- Canvas-first direct manipulation
- Right Layer / RIG context
- static vs temporal separation
- single authority
- History 1 gesture 1 transaction
- selection sync
- Focus Lens
- numeric scrub
- Auto-first / advanced-later
- Rig as optional escalation

---

以下は暫定であり、磨き込みすぎない。

## LOW / MEDIUM CONFIDENCE

- 現RIG WORKSPACE横長layout
- `RIG / MOTION / WARP` tabs
- `全体PIVOT` のRIG所属
- BONE / AUTO GRID / SHAPE / LINEの露出順
- Parent常設
- Slider主体Transform UI
- Current Bone glyph
- all-lanes-first Timeline

---

# 32. 次Phaseへ渡す推奨順序

## Phase 1
現Phase 9nをminimal clean checkpointでclose。

## Phase 2
Layer Transform Interaction Grammar。

- Basic
- Distort
- Warp
- Canvas handles
- Origin
- Numeric field

## Phase 3
Drawing-side Warp Foundation。

## Phase 4
Transform / Warp Animation Bridge。

## Phase 5
Animation Property / Focus Lens。

## Phase 6
Root-first RIG Authoring。

- symbol family
- Root
- Joint chain
- AutoMesh
- Test

## Phase 7
Mesh Quality Escalation。

- AutoMesh quality
- Guide
- Manual
- Weight presets
- detailed Weight

---

# 33. 次提案書へ統合する候補

CODEXの実装がもう少し進んだ時点で、前書＋本Addendumから次の項目を正式Gateへ昇格する。

### Strong candidates

- Canvas-first `BASIC / DISTORT / WARP`
- `◀ [scrubbable numeric] ▶`
- bounds-center Transform Origin
- Transform Origin / Rig Joint symbol family
- Root-first Joint authoring
- AutoMesh-first
- Focus Lens
- RIG optional escalation

### Compare before contract

- Bone glyph
- BASIC / DISTORT / WARP naming
- Origin color
- Rig Controller terminology
- Guide Mesh grammar
- Hard / Soft preset
- TEST POSE

### Keep on HOLD

- Full ArtMesh-grade manual topology
- advanced Puppet pin
- topology animation
- animated Anchor
- arbitrary Warp topology switching
- full Rig data-model unification

---

# 34. Short Instruction for CODEX

本書を実装指示として一括採用しないこと。

現時点では、

1. 現Phaseのauthority整理をclean checkpointまで終える。
2. current RIG Workspaceを最終UIとして固定しない。
3. Transformを次の共通interaction grammar候補として扱う。
4. 現行設計で将来も残る基盤と、暫定presentationを分ける。
5. Root-first / AutoMesh-firstを次のRig UX比較候補として保存する。
6. Bone symbolはCurrent / Lever / Joint-chainで比較する。
7. Transform Originとのsymbol continuityを評価軸へ入れる。
8. Numeric scrub fieldはLayer Transformからpilotする。
9. AutoMesh品質をManual topology機能数より優先候補とする。
10. Focus Lensを「全部を並べるより、現在必要なものだけを見せる」共通原則として維持する。

---

# 35. Design Thesis

本追補の思想を最後に要約する。

> **Tegakiは、Drawing・Transform・Animation・Riggingを別々の専門世界として学ばせない。**

> **同じ絵を掴む操作がTransformになり、時間を与えるとAnimationになり、関係性を追加するとRigになる。**

> **高度機能は最初から露出せず、直接操作で困った時に次の抽象化を提示する。**

> **他ツールからは外見ではなく、ユーザーがすでに身につけた操作習慣を借りる。**

> **現在の実装は、将来残るauthority / History / selection基盤と、後で置き換え得るpresentationを明確に分けて進める。**

これを、前書の `Transform-first / Focus Lens` を具体化する追補方針とする。

---

# 36. Reference Map

## Adobe Animate
- Modern Rigging / Asset Warp  
  https://helpx.adobe.com/animate/using/character-rigging-in-animate.html
- Bone Tool / Armature  
  https://helpx.adobe.com/animate/using/bone-tool-animation.html
- TechnoKids rig tutorial  
  https://blog.technokids.com/animation/character-rigging-animation-with-adobe-animate/
- Filmora Adobe Animate rig overview  
  https://filmora.wondershare.com/animation-tips/adobe-animate-rigging.html

## Live2D Cubism
- Mesh Edit / Auto Mesh  
  https://docs.live2d.com/cubism-editor-manual/mesh-edit/
- Manual Mesh Edit  
  https://docs.live2d.com/en/cubism-editor-manual/mesh-edit-manual/
- Deformer  
  https://docs.live2d.com/en/cubism-editor-manual/deformer/
- Rotation Deformer  
  https://docs.live2d.com/cubism-editor-manual/making-and-rotation-of-rotationdeformer/

## CLIP STUDIO PAINT
- Transform types  
  https://help.clip-studio.com/en-us/manual_en/360_transform/Types_of_transformations.htm
- Bounding-box Transform  
  https://help.clip-studio.com/en-us/manual_en/360_transform/Transform_using_the_bounding_box.htm

## Procreate / Dreams
- Procreate Transform  
  https://help.procreate.com/procreate/handbook/transform
- Dreams Transform  
  https://help.procreate.com/dreams/handbook/draw-and-paint/transform

## ToonSquid
- Bones  
  https://toonsquid.com/handbook/effects/bones/
- Mesh  
  https://toonsquid.com/handbook/effects/mesh/

## Rive
- Bones  
  https://rive.app/docs/editor/manipulating-shapes/bones

## Blender
- Numeric Fields  
  https://docs.blender.org/manual/en/latest/interface/controls/buttons/fields.html

## HMI / UX
- Nielsen Norman Group — Direct Manipulation  
  https://www.nngroup.com/articles/direct-manipulation/
- Progressive Disclosure  
  https://www.nngroup.com/articles/progressive-disclosure/
- Recognition vs Recall  
  https://www.nngroup.com/articles/recognition-and-recall/
