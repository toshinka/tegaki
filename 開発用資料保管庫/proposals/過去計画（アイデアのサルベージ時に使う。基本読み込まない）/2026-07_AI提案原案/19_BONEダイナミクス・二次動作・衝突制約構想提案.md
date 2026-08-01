# 19. BONEダイナミクス・二次動作・衝突制約構想提案

更新日: 2026-07-27  
文書区分: **未実装構想提案書 / Phase 7以降の計画材料**  
最終調査・設計・実装判断担当想定: **CODEX**

> **文書の目的**  
> 本書は、Tegakiにおいて髪、尾、衣服、触手、アクセサリー等へ、親の動きに遅れて追従する二次動作、重力、慣性、振り子運動、多段揺れ、接触回避、将来的な剛体衝突および接触変形を導入するための構想提案である。  
> BONE、Mesh、SkinWeight、IK、Motion Performを扱う既存統合提案へ接続しつつ、物理的な揺れと図形同士の本格的衝突を同一機能として扱わないことを基本原則とする。  
> 本書は実装指示書ではない。CODEXが現行コード、描画評価順、Frame seek、History、export、性能を調査し、正式なPhase計画を作るための材料とする。

---

## 0. 本書の位置付け

### 0.1 関連する上位・下位資料

本書は次の資料と接続する。

- `15_ボーン・CAF階層パーツ・動的描画順制御設計_改訂提案.md`
- `16_モーションパフォーム記録・タイムストローク再生設計_改訂版.md`
- `17_自動メッシュ・自由コントロールポイント・ストロークメッシュ設計_改訂版.md`
- `18_BONE・メッシュ・モーションパフォーム統合計画_上位提案.md`

責任分担:

| 資料 | 主な責任 |
|---|---|
| 15 | BONE階層、CAF内部Part、Bind Pose、Draw Order |
| 16 | pointer入力、相対時間、Motion記録、History |
| 17 | TriangleMesh、SkinWeight、ControlHandle、自動Mesh |
| 18 | BONE・Mesh・Performの統合評価順、IK、Quick Rig |
| 19（本書） | 二次動作、重力、振り子、多段揺れ、接触制約、物理衝突の段階分離 |

### 0.2 BONE表記

正式表記は`BONE`とする。

`BORN`は旧資料・会話上の表記揺れとして扱い、新しい保存キー、型名、UI名称には使用しない。

---

## 1. 機能を四段階へ分離する

「物理演算」または「当たり判定」という言葉には、異なる責務が含まれる。

本書では次の四段階へ分離する。

### 1.1 Secondary Motion / BONE Dynamics

親の移動や回転を入力として、子・孫BONEが遅れ、行き過ぎ、戻り、減衰する。

用途:

- 髪
- 尾
- スカート
- 袖
- リボン
- 耳
- 触角
- ネックレス
- 柔らかい手足
- ゴム状の身体

これは本書の最優先対象である。

### 1.2 Collision Constraint

物体同士の接触を検出し、重なりを解消する。

初期用途:

- 髪が頭や肩へ入り込まない
- 尾が胴体を突き抜けない
- 足が地面より下へ入らない
- スカートが脚を大きく貫通しない

反射や回転までを必須にせず、最初は「外へ押し戻す」制約として扱う。

### 1.3 Rigid Body Response

図形やPart同士が衝突し、跳ね返る、滑る、回転する。

用途:

- ボール
- 箱
- 小道具
- 落下物
- 地面との反射
- オブジェクト同士の衝突

Secondary Motionとは別システム候補とする。

### 1.4 Contact Deformation

接触した場所が潰れる、へこむ、押し広げられる。

用途:

- 柔らかい身体
- ゴム
- クッション
- 接触による局所変形
- 押しつぶし
- 衝撃波的変形

これはMesh Skinningや単純BONE変形より後の研究対象とする。

---

## 2. 優先順位

推奨順序:

```text
1. BONE Core
2. Mesh Skinning / SkinWeight
3. 最小IK / Pin / Stretch
4. BONE Dynamics / Secondary Motion
5. 単純Colliderによる接触回避
6. Motion Performとの統合
7. Dynamics Bake / 確定
8. Part単位Rigid Body
9. Contact Deformation
```

### 2.1 BONE Dynamicsを先にする理由

BONE Dynamicsは、髪や尾等のキャラクター表現へ直接効果がある。

また、次の基盤を先に整えられる。

- fixed timestep
- solver順序
- Reset
- random seek
- deterministic playback
- export再現
- Bake
- stateful constraint
- multi-chain評価
- gravity
- damping

これらは将来の衝突処理にも必要となる。

### 2.2 図形同士の本格衝突を後にする理由

剛体衝突には次が必要となる。

- velocity
- angular velocity
- mass
- inertia
- restitution
- friction
- penetration correction
- broad phase
- narrow phase
- solver iteration
- sleeping
- collision group
- fixed timestep
- continuous collision detection候補

BONE Dynamicsより責務が大きく、キャラクターの髪揺れには必須ではない。

---

## 3. 親子伝播と二次動作の違い

### 3.1 FK

親のtransformを子が即時継承する。

```text
頭を動かす
  ↓
髪の根元も即時に同じだけ動く
```

これは通常のBONE階層である。

### 3.2 Secondary Motion

親の変化を受けるが、子が遅れて追従する。

```text
頭を右へ動かす
  ↓
髪の根元は頭へ追従
  ↓
中間BONEは遅れる
  ↓
先端はさらに遅れる
  ↓
行き過ぎて戻る
  ↓
減衰して静止
```

### 3.3 逆方向の連動との違い

手を動かして肘や肩を動かすのは、IKやParent Follow等のconstraintである。

親を動かして髪や尾が揺れるのは、BONE Dynamicsである。

両者は同じBONE階層を利用できるが、solverの責務は分ける。

---

## 4. Stateless ConstraintとStateful Constraint

### 4.1 Stateless

現在Frameの入力だけで結果を計算できる。

候補:

- FK
- IK
- Pin
- Limit
- Stretch
- Parent Follow
- Aim
- Copy Transform

### 4.2 Stateful

過去Frameの速度や状態が必要となる。

候補:

- Inertia
- Spring
- Pendulum
- Gravity
- Wind
- Drag
- Collision Response
- Soft Body

### 4.3 区別が必要な理由

Statefulな物理は、Frame 30だけを直接評価しても結果が決まらない。

次の経路で同じ結果を出す必要がある。

- 順次再生
- Frame scrub
- random seek
- onion
- export
- thumbnail
- reload
- Undo / Redo

そのため、物理評価には独立した決定性契約が必要となる。

---

## 5. BONE Dynamicsの基本モデル

### 5.1 最小パラメータ候補

```text
enabled
mix
mass
stiffness
damping
gravityX
gravityY
windX
windY
inertia
angleLimitMin
angleLimitMax
translationLimit
```

### 5.2 解釈

| パラメータ | 意味 |
|---|---|
| `mix` | 手動Poseと物理Poseの混合率 |
| `mass` | 動きにくさ |
| `stiffness` | BindまたはAnimation Poseへ戻る強さ |
| `damping` | 揺れを減衰させる強さ |
| `gravity` | 下方向等へ引く外力 |
| `wind` | 横方向等の外力 |
| `inertia` | 親の加減速に対する遅れ |
| `angleLimit` | 曲がりすぎ防止 |
| `translationLimit` | 根元から離れすぎることを防ぐ |

### 5.3 基準Pose

物理BONEは完全に自由な粒子として動かすのではなく、基本Animation Poseへ戻ろうとする構造を第一候補とする。

```text
targetPose
  = FK / IK / 手動Animationの結果

dynamicPose
  = targetPose
    + inertia
    + gravity
    + spring response
```

これにより、手動アニメーションへ物理揺れを追加できる。

---

## 6. 多段Chain

### 6.1 Chain構造

例:

```text
髪Root
  └─ Hair01
       └─ Hair02
            └─ Hair03
                 └─ HairTip
```

各段で親の動きから遅れを受ける。

### 6.2 Chain preset候補

- Hair
- Tail
- Ribbon
- Cloth Edge
- Antenna
- Soft Limb
- Rubber Chain
- Necklace

### 6.3 Falloff

根元から先端へ物理影響を強くする候補:

```text
root mix = 0.1
middle mix = 0.5
tip mix = 1.0
```

候補パラメータ:

```text
chainFalloff
tipAmplification
rootLock
```

### 6.4 複数Chain

同一キャラクター内で複数Chainを評価できる。

例:

- 左髪
- 右髪
- 前髪
- 尾
- スカート左
- スカート右

Chain間の衝突は初期版では扱わない候補とする。

---

## 7. 振り子モード

### 7.1 用途

- イヤリング
- ネックレス
- 紐
- 振り子
- 垂れた髪束
- 看板
- 吊り下げ小物

### 7.2 基本契約

- 根元を固定
- 長さを維持
- 重力方向へ下がる
- 親移動で揺れる
- 減衰して停止
- 角度制限を持つ

### 7.3 単純化候補

初期版では2D平面の角度だけを解く。

```text
state:
  angle
  angularVelocity
```

位置はBONE長から再構成する。

これにより、translation自由度を持つSpringより安定しやすい。

---

## 8. Spring Chainモード

### 8.1 用途

- ゴム腕
- 触手
- 柔らかい尾
- 伸びる髪
- 弾む衣服
- 柔らかいアクセサリー

### 8.2 自由度候補

- rotation only
- translation only
- rotation + translation
- stretch
- squash/stretch

### 8.3 Stretchとの統合

18のStretch policyと接続する。

候補:

- `FIXED_LENGTH`
- `LIMITED_STRETCH`
- `FREE_STRETCH`
- `RUBBER`

Dynamic solverはFrameごとのstretch policyを受け取る。

---

## 9. Dynamicsの有効区間

### 9.1 Track候補

```text
dynamicsMixTrack
gravityWeightTrack
windWeightTrack
dampingTrack
stiffnessTrack
```

### 9.2 用途

- 一部区間だけ物理を有効にする
- 着地時だけ揺れを強くする
- 手動Animationへ戻す
- 水中や無重力を切り替える
- 急な動作だけ物理を強くする

### 9.3 補間

離散的なon/offはHOLD候補。

連続値はLINEARまたは既存Easing契約へ従う。

---

## 10. Resetと初期状態

### 10.1 Resetが必要な場面

- Playback開始
- Frame seek
- Project load
- Rig変更
- BONE削除
- Dynamics parameter変更
- Clip retiming
- Undo / Redo
- export開始
- Bake開始

### 10.2 初期化候補

```text
dynamicPose = targetPose
velocity = 0
angularVelocity = 0
```

### 10.3 Warm-up

Frame 0で急に重力が掛かると、最初に不自然な跳ねが起きる可能性がある。

候補:

- Frame 0を静止初期状態とする
- 数stepだけpre-rollする
- bind状態を重力平衡へ初期化する
- user指定pre-roll

MVPでは単純Resetを優先し、pre-rollは後続候補とする。

---

## 11. Fixed Timestep

### 11.1 必要性

画面描画FPSに物理stepを依存させると、端末性能で結果が変わる。

そのため候補として固定stepを用いる。

```text
physicsStep = 1 / projectFps
```

または内部substep:

```text
physicsStep = 1 / (projectFps * substeps)
```

### 11.2 Substep

高速移動や強いSpringで不安定になる場合、1Frame内で複数stepを実行する。

候補:

```text
substeps = 1, 2, 4
```

固定上限は性能計測後に決定する。

### 11.3 Clamp

極端なparameterによる発散を防ぐ候補:

- 最大速度
- 最大角速度
- 最大変位
- 最大伸長
- 最大solver iteration

---

## 12. Deterministic Evaluation

### 12.1 Random Seek

Frame Nへ直接移動した場合の候補方式:

#### 案A: Frame 0から再simulation

利点:

- 単純
- 結果が決定的

欠点:

- 長いClipで重い

#### 案B: Checkpoint Cache

一定Frameごとに物理stateを保存する。

利点:

- seekが速い

欠点:

- cache invalidation
- memory
- parameter変更時の破棄

#### 案C: Bake Cache

物理結果を一時的なFrame cacheへ保存する。

利点:

- 再生とscrubが軽い

欠点:

- source変更時の無効化
- Project正本との区別

#### 案D: 完全Pose Bake

物理結果をAnimation keyまたはFrameへ確定する。

利点:

- solver不要
- export安定

欠点:

- 非破壊編集性を失う
- 大量キー

CODEXはClip長、性能、既存cache経路を調査して決定する。

### 12.2 Solver Version

solver実装変更で旧Projectの結果が変わる可能性がある。

候補:

```text
dynamicsSolverVersion
```

旧version互換を維持するか、Bakeを推奨するかをPhase計画で決める。

---

## 13. 接触制約

### 13.1 最初は単純Collider

候補:

- Circle
- Capsule
- Segment
- Ground Line
- Box

用途:

- 頭
- 肩
- 胴体
- 脚
- 地面

### 13.2 Mesh輪郭との直接衝突を避ける

初期版でTriangleMesh同士の正確な接触を扱うと、処理が大きくなる。

まずはBONEやPartに単純Colliderを付ける。

```text
BONE / Part
  └─ Collider
```

### 13.3 反応候補

最小:

```text
penetration detection
  ↓
outside projection
```

追加候補:

- 法線方向速度を減衰
- 接線方向へ滑る
- friction
- bounce

MVPは押し戻しまでを第一候補とする。

### 13.4 Collision Group

候補:

```text
group
mask
selfCollision
```

例:

- HairはHeadとShoulderへ当たる
- Hair同士は当たらない
- TailはBodyへ当たる
- FootはGroundへ当たる

---

## 14. Rigid Body Physics

### 14.1 対象

キャラクター内部の髪揺れではなく、シーン内オブジェクト向けとする。

例:

- ボール
- 石
- 箱
- 小道具
- 落下物

### 14.2 必要要素

```text
position
rotation
linearVelocity
angularVelocity
mass
inertia
restitution
friction
shape
collisionGroup
```

### 14.3 BONEとの接続候補

- BONEへRigid Bodyを付ける
- Rigid Body結果をBONE Poseへ変換する
- Pin／JointでBONEへ接続する
- AnimationとPhysicsをmixする

これはSecondary Motion完成後の独立Phase候補とする。

---

## 15. 接触変形

### 15.1 BONE Skinningだけでは不足

BONEを曲げてMeshが変形する処理は、接触点の局所的なへこみを表現しない。

### 15.2 候補方式

- Contact Deformer
- Local ControlHandle Push
- Shape Matching
- Position Based Dynamics
- Soft Body
- Squash Impulse
- Normal-direction displacement

### 15.3 初期代替

本格Soft Bodyの前に、接触時だけ補助ControlHandleを押す簡易方式も考えられる。

```text
contact point
  ↓
nearest handles
  ↓
temporary displacement
  ↓
spring return
```

ただし保存正本、determinism、Mesh inversionへの対策が必要となる。

---

## 16. Motion Performとの統合

### 16.1 Dynamicsを直接記録しない案

Motion PerformでEffectorや親BONEの動きを記録し、髪等は再生時にDynamicsで生成する。

利点:

- 非破壊
- parameterを後から調整可能
- 少ないキー

欠点:

- solver versionで結果が変わる
- export時にsimulationが必要

### 16.2 Dynamics結果をBakeする案

Motion PerformとDynamicsを再生し、最終PoseをBONE keyへBakeする。

利点:

- 結果固定
- solver不要

欠点:

- 大量キー
- 後調整しにくい

### 16.3 Hybrid

- source Motionを保持
- Dynamics cacheを持つ
- 確定時だけBake

最終方式はCODEXが既存Motion modelと性能を調査して決定する。

---

## 17. UI構想

### 17.1 Dynamics Setup

候補UI:

- Dynamics ON/OFF
- mode preset
- stiffness
- damping
- mass
- gravity
- wind
- inertia
- angle limit
- stretch
- mix
- chain falloff
- reset
- preview

### 17.2 Preset

- Hair Soft
- Hair Heavy
- Tail
- Ribbon
- Cloth Edge
- Antenna
- Pendulum
- Rubber Limb
- Necklace

Presetはparameter初期値であり、別の保存正本を作らない。

### 17.3 Collider表示

- outline
- selected
- collision normal
- contact point
- penetration
- group color

通常描画へ混ぜず、display-only overlayとする。

### 17.4 Simulation Preview

候補:

- Play
- Pause
- Reset
- Step
- Gravity toggle
- Collision toggle
- Before / After
- Bake preview

---

## 18. データ所有候補

### 18.1 RigDefinition側

```text
DynamicsDefinition {
  dynamicsId
  targetBoneIds[]
  mode
  parameters
  chainSettings
  colliderRefs[]
  solverVersion
}
```

### 18.2 ClipInstance側

```text
DynamicsTracks {
  mixTrack
  gravityWeightTrack
  windWeightTrack
  stiffnessTrack
  dampingTrack
}
```

### 18.3 Collider

```text
ColliderDefinition {
  colliderId
  ownerType
  ownerId
  shapeType
  localTransform
  shapeParameters
  group
  mask
}
```

### 18.4 Runtime限定

```text
DynamicsRuntimeState {
  positions
  rotations
  velocities
  angularVelocities
  lastEvaluatedFrame
  cacheRevision
}
```

Runtime stateをProject正本へ無条件保存しない。

---

## 19. History

候補:

```text
1 parameter drag = 1 History
1 collider drag = 1 History
1 preset apply = 1 History
1 chain assignment = 1 History
1 Bake = 1 History
```

Playback中のsimulation stepごとにHistoryを積まない。

Physics cacheはHistory正本にしない。

---

## 20. CODEX調査Gate

正式Phase計画前に次を確認する。

### 20.1 現行BONE／Constraint

1. BONE Coreの実装有無
2. hierarchy matrix評価
3. Bind Pose
4. IK／Pin／Stretchの計画または実装
5. constraint評価順
6. Rig Motion保存位置
7. Frame sampler

### 20.2 Runtime

1. project FPS
2. playback tick
3. requestAnimationFrame依存
4. random seek
5. onion Frame評価
6. export Frame評価
7. thumbnail評価
8. cache基盤
9. Project切替時dispose

### 20.3 Math

1. transform-math再利用
2. angle wrapping
3. matrix decomposition
4. inverse bind
5. affine blend
6. numerical stability
7. fixed timestep helper
8. solver iteration

### 20.4 Collider

1. bounds helper
2. raster bounds
3. Part bounds
4. circle／capsule hit test既存実装
5. selection hit testとの再利用可否
6. Camera座標変換
7. overlay

### 20.5 保存・History

1. optional schema追加
2. solver version保存
3. copy/paste ID再マップ
4. Undo／Redo
5. Clip retiming
6. Project migration
7. Bake保存形式

### 20.6 性能

1. chain数
2. BONE数
3. substep数
4. collider数
5. seek時間
6. export時間
7. mobile browser
8. 344×135
9. 400×400
10. high-DPI

Gate成果物:

- 現行構造図
- stateful評価の既存経路
- cache候補
- fixed timestep候補
- solver候補比較
- collider候補
- Phase分割
- `GO / REVISE / STOP`

---

## 21. Phase候補

### Phase Candidate A: Single Pendulum

- 1 BONE
- root固定
- angle
- angular velocity
- gravity
- stiffness
- damping
- fixed timestep
- reset
- preview
- export一致

到達点:

> イヤリング等を決定的に揺らせる。

### Phase Candidate B: Multi-BONE Chain

- 親子chain
- chain falloff
- angle limit
- root lock
- multi-chain
- save/load
- History
- random seek

到達点:

> 髪や尾を多段階で揺らせる。

### Phase Candidate C: Spring / Rubber

- translation
- stretch
- limited stretch
- rubber distribution
- squash/stretch候補
- Mesh Skinning接続

到達点:

> 柔らかい腕、触手、ゴム状パーツを表現できる。

### Phase Candidate D: Collider Constraint

- Circle
- Capsule
- Ground
- penetration projection
- group／mask
- contact overlay

到達点:

> 髪や尾が身体や地面を大きく突き抜けない。

### Phase Candidate E: Dynamics Track

- mix
- gravity
- wind
- stiffness
- damping
- Frame区間
- HOLD／LINEAR
- Motion Perform再生との統合

到達点:

> 区間ごとに物理の強さを変えられる。

### Phase Candidate F: Dynamics Bake

- source Motion
- simulation
- Pose Bake
- before／after
- 1 History
- key simplification候補
- source保持

到達点:

> 物理結果を確定Animationへ変換できる。

### Independent Phase: Rigid Body

- object velocity
- collision response
- restitution
- friction
- rotation
- sleeping
- scene physics

### Research Phase: Contact Deformation

- contact handle
- local deformation
- soft body
- PBD
- shape matching

---

## 22. 最小MVP候補

```text
1 Head BONE
3 Hair BONE chain
rotation-only pendulum
gravity
stiffness
damping
angle limit
fixed timestep
Frame 0 reset
Frame N seek
save/load
playback/onion/export一致
```

このMVPでは次を扱わない。

- collision
- stretch
- wind
- translation spring
- self collision
- Rigid Body
- Soft Body
- Bake
- automatic presets

最初に決定的な多段揺れを成立させる。

---

## 23. 受け入れ条件

### 23.1 Determinism

- 順次再生とrandom seekが一致する
- playbackとexportが一致する
- onionが同じ結果を使う
- reload後も同じ結果
- 端末FPSで結果が変わらない
- Reset後に同じ結果

### 23.2 Chain

- 親移動で子・孫が遅れて動く
- root固定を維持
- angle limitを超えない
- 発散しない
- chain削除でstateを残さない
- 複数chainが相互汚染しない

### 23.3 Mesh

- BONE Dynamics結果へSkinWeightで追従する
- Mesh inversionを監視する
- stretch無効時に長さを維持
- weight変更後にcacheを更新
- GPU／CPU結果が一致

### 23.4 Collider

- penetrationを解消する
- group／maskを守る
- Collider未使用時にlegacy結果を維持
- contact表示をProjectへ保存しない
- collider削除後に参照を残さない

### 23.5 History・保存

- parameter操作をUndo／Redoできる
- simulation stepをHistoryへ積まない
- runtime stateを正本へしない
- solver versionを必要に応じて保存
- copy/pasteでID参照を再マップ

### 23.6 性能

- 長いClipのseek時間を計測
- chain数増加時のFPSを計測
- substep上限を定義
- cacheが無制限に増えない
- Project切替でsimulationを停止
- export中にUI simulationと競合しない

---

## 24. 停止・再設計条件

次の場合、CODEXは実装を停止して計画を修正する。

- Frame seekで結果を再現できない
- exportとpreviewが一致しない
- solverが画面FPSへ依存する
- stateful constraintを既存samplerへ接続できない
- BONE DynamicsとIKが同じposeを競合所有する
- Mesh Skinningの評価順を確定できない
- long ClipのFrame 0再simulationが実用不能
- cache invalidationを安全に行えない
- collider処理がRenderIslandやclippingを壊す
- solver parameter変更で旧Project結果が無言変化する
- mobile browserで最低限の性能を満たせない

代替候補:

- DynamicsをBake専用にする
- playback時のみ有効にする
- 単一振り子だけ提供する
- rotation-only chainへ限定する
- random seek時にpre-bake cacheを必須にする
- ColliderをGroundだけに限定する
- Rigid Bodyを独立実験moduleへ送る

---

## 25. 最終提言

Tegakiでは、図形同士の本格的な衝突や接触変形より先に、BONE Dynamicsによる多段揺れを実装する価値が高い。

推奨する最初の到達点は次である。

> 親BONEが動くと、子・孫BONEが重力、慣性、復元力、減衰に従って遅れて揺れ、MeshがSkinWeightを通じて追従する。結果はrandom seek、playback、onion、exportで一致する。

次の到達点は次である。

> Circle、Capsule、Ground等の単純Colliderを使い、髪、尾、衣服が身体や地面を大きく突き抜けないようにする。

図形同士の反射、摩擦、回転、接触変形は、Secondary Motionと接触制約が安定した後の独立Phaseへ送る。

---

## 26. 関連資料

- `AGENTS.md`
- `TEGAKI.md`
- `tegaki_work/PROGRESS.md`
- `tegaki_work/ARCHITECTURE.md`
- `tegaki_work/PHASE4Z_BOUNDARY.md`
- `15_ボーン・CAF階層パーツ・動的描画順制御設計_改訂提案.md`
- `16_モーションパフォーム記録・タイムストローク再生設計_改訂版.md`
- `17_自動メッシュ・自由コントロールポイント・ストロークメッシュ設計_改訂版.md`
- `18_BONE・メッシュ・モーションパフォーム統合計画_上位提案.md`
