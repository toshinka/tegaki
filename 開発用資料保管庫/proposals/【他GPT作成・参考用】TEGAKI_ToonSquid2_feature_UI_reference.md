# TEGAKI × ToonSquid 2
## アニメーション・変形・再利用UIの分析と段階導入計画

- 文書種別: 外部ツール分析／UI・機能リファレンス／将来設計メモ
- 主な読者: TEGAKIを調査・設計・実装するCodex／GPT、および開発者
- 対象: ToonSquid 2のアニメーション、変形、Bone、Mesh、Warp、Effect、Clip再利用、Timeline、選択UI
- 軽く扱う対象: カラーUI、Brush周辺、Quick Tool等
- 対象外: Callipegの詳細分析。Callipeg編は別冊とする
- 注意: 本文書は実装契約ではない。実装前に必ず現行の `AGENTS.md`、`TEGAKI.md`、`tegaki_work/PROGRESS.md`、現行Phase指示書、関連コードを確認すること
- 作成意図: ToonSquid 2を模倣するのではなく、TEGAKIのコマ作画中心の構造へ移植可能な設計要素を抽出する

---

## 1. 結論

ToonSquid 2の最も優れた点は、BoneやMeshといった個別機能の存在だけではない。

本質的には、次の要素を同じ編集環境へまとめている点にある。

```text
描画内容
  +
Layer Transform
  +
コントロールポイント
  +
Warp / Mesh
  +
Bone / IK
  +
Effect
  +
Keyframe
  +
Asset / Symbol
```

さらに、これらをCanvas上の直接操作、TimelineのProperty Track、Inspectorの数値操作で同期させている。

TEGAKIへ最も強く導入価値があるのは次の機能・設計である。

1. **Canvas上の選択と変形を統一したTransform Controller**
2. **非破壊ModifierとBakeの対**
3. **固定16点程度の簡易Warp**
4. **任意Control Pointと自動三角形化によるMesh**
5. **Bind PoseとAnimate Poseを分離したBone**
6. **BoneとLayer／Control PointのBinding**
7. **IK、Rotation Limit、Strength等の制約**
8. **Motion PathのCanvas直接編集**
9. **Group単位のTransform、Loop、Retime**
10. **ClipAssetとInstanceによる再利用**
11. **Noise、Spin、Orient Along Path等の簡易演算Modifier**
12. **Control Point単位のKeyframeとモーフィング**

ただし、TEGAKIの正本をToonSquid型の汎用Layer Scene Graphへ全面変更するべきではない。

推奨する方向は次のとおり。

```text
TEGAKIのCAF作画正本
    +
ClipInstance Motion
    +
限定されたModifier Chain
    +
Warp / Mesh / Bone
    +
CAF Frame列へのBake
```

---

## 2. 本文書の情報源と読み方

本分析では、次を中心に参照した。

### ユーザー指定資料

- あらみ氏 FANBOX  
  「iPadのアニメーション制作アプリ『ToonSquid』のコントロールポイントを使ってみよう」
- あらみ氏 X投稿  
  ToonSquidの機能・作例に関する投稿

指定FANBOX記事では、コントロールポイントを用いて円形を花形へ変形させるシェイプモーションが解説されている。ガイドを表示し、形を均等に変形する工程が含まれる。

同作者の公開投稿では、次の作例・注意点も確認できる。

- Path／ShapeのControl Pointを動かしたモーフィング
- Control Pointによる疑似立体表現
- 手描き画像へのMeshとBoneの適用
- Meshの流れとControl Point数が変形品質に影響すること
- キャラクターの揺れもの、歩行、尻尾等へのBone／IK利用
- Layer分け、Mesh割り、Bone階層の重要性

Xは表示環境により本文や動画の取得が不完全な場合があるため、本書では同作者の公開検索結果とToonSquid公式Handbookで機能仕様を照合した。

### ToonSquid公式

- ToonSquid 2.0 Update
- Effects
- Transform Tool
- Motion Path
- Morphing
- Mesh
- Warp
- Bones
- Group Layer
- Symbol Layer
- Keyframes
- Easing Curves
- Timeline
- Inspector
- Noise
- Spin
- Orient Along Motion Path
- Parallax

---

## 3. ToonSquid 2の設計上の特徴

ToonSquid 2は、単なるペイントアプリへBone機能を追加したものではない。

内部概念としては、Layerが時間変化するPropertyを持ち、そのLayerへ非破壊Effectを積み、必要に応じてGroup、Hierarchy、Symbolで再利用・親子化する構造である。

```text
Animation Clip / Scene
  ├ Animation Layer
  │   ├ Drawing
  │   │   ├ Pixel Layer
  │   │   ├ Vector Layer
  │   │   ├ Path Layer
  │   │   └ Group
  │   └ Drawing exposure
  ├ Group Layer
  ├ Symbol Layer → Asset LibraryのClipを参照
  ├ Camera
  ├ Audio / Video
  └ Property Tracks
       ├ Transform
       ├ Control Points
       ├ Effect Parameters
       └ Bone Parameters
```

ToonSquid 2.0では、Effectが非破壊でLayerへ適用され、EffectのPropertyもKeyframe化できる。

また、Effectの順序は原則として上から下へ評価され、個別に表示を無効化でき、最終的にはRasterizeできる。

この構造は、TEGAKIへ「Effect Stackを全部入れるべき」という意味ではない。

重要なのは次の設計原則である。

```text
元データを壊さない
  ↓
演算結果をPreviewする
  ↓
設定を後から変更できる
  ↓
必要ならBakeして通常作画へ戻す
```

---

## 4. 総合評価

| 項目 | ToonSquid 2の完成度 | TEGAKI適合度 | 導入優先度 |
|---|---:|---:|---:|
| Unified Transform Tool | 9.5 / 10 | 9.5 / 10 | 最優先 |
| Control Point Morphing | 9.0 / 10 | 6.5 / 10 | 中長期 |
| 16点Warp | 9.0 / 10 | 9.5 / 10 | 高 |
| Custom Mesh | 9.0 / 10 | 8.5 / 10 | 高 |
| Bone Rig | 9.0 / 10 | 8.5 / 10 | 高 |
| IK | 8.5 / 10 | 8.0 / 10 | 中高 |
| Effect Stack | 9.0 / 10 | 6.5 / 10 | 限定採用 |
| Group Transform／Loop | 9.0 / 10 | 9.0 / 10 | 高 |
| Symbol／Clip再利用 | 9.0 / 10 | 8.0 / 10 | 中高 |
| Motion Path | 9.0 / 10 | 9.0 / 10 | 高 |
| Noise／Spin等 | 8.5 / 10 | 9.0 / 10 | 高 |
| Parallax／Camera | 8.5 / 10 | 5.5 / 10 | 別動画寄り |
| Timeline Property Tracks | 9.0 / 10 | 6.5 / 10 | 限定採用 |
| UI密度 | 8.0 / 10 | 6.5 / 10 | 翻訳必須 |
| TEGAKI全体への参考価値 | — | 9.0 / 10 | 非常に高い |

---

# Part I: ToonSquid 2の主要機能

## 5. Control PointによるShape Morphing

### 5.1 機能の概要

ToonSquidのPath Layerは、各Control Pointの位置とBezier HandleをKeyframe化できる。

これにより、

```text
円
  ↓
花形
  ↓
四角形
  ↓
波打つ図形
```

のようなShape Morphingが可能になる。

ToonSquid 2では、Control Point PropertyをTimeline上で展開すると、個々のControl Pointを独立したPropertyとして扱える。

Canvas上で一つの点だけを動かした場合、その点にだけKeyframeが追加される。

### 5.2 FANBOX記事から読み取れる強み

指定記事の例は、円形を花形へ変形させる比較的単純なものだが、重要な操作思想が含まれている。

- 変形前後で同じControl Point構成を使う
- ガイドを表示して対称性を保つ
- Control Pointを意図した方向へ移動する
- 自動補間に任せつつ、形の設計は人間が行う
- 単純形状からでも有機的なMotionを作れる

これはMesh Morphとは少し異なる。

```text
Path Morph
  Shapeの境界自体を動かす

Mesh Warp
  既存画像を三角形またはGridで変形する
```

### 5.3 疑似立体表現

Control Pointを時間変化させると、実際には2D形状であっても、

- 奥側を細くする
- 手前側を広げる
- 一部を隠すように重ねる
- 曲面に見えるよう輪郭を変える

ことで疑似的な立体感を作れる。

ただし、これは本当の3D回転ではない。

人間が各Key Poseを設計し、形状補間を利用して立体的に見せる手法である。

### 5.4 ToonSquid 2の重要な制約

新しいPath Layerでは、Timelineを通じてSubpath数とControl Point数を維持する必要がある。

三角形から四角形へMorphする場合も、最初から4点を持ち、三角形側では2点を重ねるなどしてTopologyを固定する。

この制約は不便にも見えるが、次の利点がある。

- 点ごとのKeyframeを保持できる
- 点ごとに異なるEasingを設定できる
- 点の対応関係が明確
- 将来機能の基礎になる
- 補間結果が予測しやすい

### 5.5 TEGAKIへの適用

現時点でベクターペンを中心にしないなら、Path Morphをそのまま導入する優先度は高くない。

ただし、Control Point UIは次へ転用できる。

- Warp Point
- Mesh Point
- Motion Path Point
- Inbetween Guide Point
- Selection Transform Point
- Bone Weight補助点
- AI生成ガイドの対応点

つまり、TEGAKIが最初に真似るべきものは「Path Layer」より、

> Canvas上のControl Pointを選択し、Timeline上の時間変化と結びつける共通UI

である。

### 5.6 評価

| 観点 | 評価 |
|---|---|
| 表現力 | 高い |
| ラスターTEGAKIへの直接適合 | 中程度 |
| UI参考価値 | 非常に高い |
| 初期実装負荷 | 高い |
| 推奨 | Control Point基盤だけ先に共通化 |

---

## 6. Unified Transform Tool

### 6.1 ToonSquidの強み

ToonSquidのTransform Toolは次を兼ねる。

- Canvas上でLayerを直接選択
- Position変更
- Rotation変更
- Scale変更
- Pivot変更
- Uniform／Freeform
- Perspective
- Warp
- Motion Path編集
- 選択範囲の内容変形
- Effect選択時の専用編集

単なるBounding Boxではなく、選択対象に応じて操作内容が切り替わる共通Controllerである。

### 6.2 ToonSquid 2でのモード整理

以前のToonSquidには、Layer Transformを編集するか、Pixel／Path内容を編集するかを切り替えるボタンがあった。

このモードは混乱を生みやすかったため、ToonSquid 2では明示ボタンを減らし、Selectionの有無などから編集対象を決める方式へ整理された。

- Selectionなし: Layer Transform
- Selectionあり: Layer内容
- Transform Toolを再度押す: Layer全体を覆うSelectionを生成
- Pixel Layerでは自動判定設定もある

### 6.3 TEGAKIへそのまま入れる際の危険

自動判定だけに依存すると、TEGAKIでは次の混乱が起こり得る。

- CAF原画を動かしたのか
- ClipInstanceを動かしたのか
- Selection内のPixelを動かしたのか
- Warp Pointを動かしたのか
- Bind Poseを動かしたのか
- Animation Keyを作ったのか

したがって、ToonSquidの「ツール統合」は参考にするが、TEGAKIでは現在の編集対象を明示する。

```text
Transform: CAF Contents
Transform: Clip Instance
Transform: Selection
Transform: Warp Bind
Transform: Warp Animate
Transform: Bone Bind
Transform: Bone Animate
```

### 6.4 推奨UI

```text
Canvas
  Bounding Box / Handles / Pivot

Top HUD
  X / Y / Rotation / Scale
  Local / Global
  Snap
  Editing Context

Inspector
  正確な数値
  Reset
  Bake
  Modifier選択

Timeline
  対応Key
```

### 6.5 Pivot

ToonSquidではPivot編集を明示的に有効化する。

PivotはPosition、Rotation、Scaleの基準であり、Keyframe後に変更するとAnimation結果が変わるため、先に設定することが推奨されている。

TEGAKIでもPivotは通常Dragで誤って動かないよう、専用モードまたはUnlockが必要である。

---

## 7. 非破壊Effect System

### 7.1 ToonSquidの構造

EffectはLayerへ追加される。

- 後からPropertyを変更できる
- 個別に表示を切り替えられる
- Effect PropertyをKeyframe化できる
- 上から下への順序が結果に影響する
- Layer間でCopy／Pasteできる
- 最後にRasterizeできる
- Editor全体でFX表示を一時無効化できる

### 7.2 TEGAKIへ全部入れるべきではない

完全なEffect Stackは、次の負担を生む。

- Effectごとの保存形式
- Versioning
- Render順
- PreviewとExportの一致
- Cache
- GPU資源
- Effect間の組合せ
- History
- UIの高密度化

TEGAKI本体では、最初はEffectより **Modifier Chain** として限定するほうがよい。

```text
Clip Source
  ↓
Content Sampling
  ↓
Clip Motion
  ↓
Warp / Mesh / Bone
  ↓
Opacity / Blend
  ↓
Simple Procedural Modifier
  ↓
Composite
```

### 7.3 TEGAKI向けカテゴリ

#### Geometry Modifier

- Transform
- Perspective
- Warp
- Mesh
- Bone

#### Property Modifier

- Noise
- Spin
- Orient Along Path
- Opacity Pulse

#### Appearance Modifier

- Color Adjustment
- Blur
- Chroma Key
- Drop Shadow

Appearance Modifierは、TEGAKI本体より別動画ツール側へ置く選択肢が強い。

### 7.4 必須UI

- ModifierのON／OFF
- 適用順
- 選択
- Property表示
- Keyframe
- Reset
- Copy／Paste
- Bake
- Preview Quality

---

## 8. Warp Effect

### 8.1 ToonSquidの仕様

Warp Effectは16個のControl Pointを持つGridでLayer内容を変形する。

Control PointはKeyframe化できる。

Warp Effectを選択すると、Editorが自動的にTransform ToolのWarp Modeへ切り替わる。

### 8.2 筋の良さ

これは、ユーザーへTriangle Topologyを意識させずに、十分な自由度を与える。

```text
UI
  16 Control Points

内部
  Grid / Triangleによる変形
```

Face、髪、服、布、表情、小さな姿勢変化に適している。

### 8.3 TEGAKIへの導入優先度

非常に高い。

理由:

- ラスターCAFと相性がよい
- UIが理解しやすい
- Boneより独立して使える
- Meshより初期設定が軽い
- Point Keyframeの共通基盤を作れる
- Bakeして手描き修正へ戻せる

### 8.4 TEGAKI向け最小仕様

```text
Warp Modifier
  grid: 4 x 4
  bounds: Source Bounds
  bindPoints: 16
  animatedPoints: Track per point
  interpolation: Hold / Linear / Bezier
```

### 8.5 改良候補

- 3×3、4×4、5×5のPreset
- Bounds自動検出
- 外周Pin
- 対称編集
- 複数Point選択
- PointのReset
- Row／Column選択
- Point間隔の均等化
- Onion状態で前後Warp表示
- Bake

### 8.6 UIで真似るべき点

Effect選択後に専用ツールを別途探させず、Canvasが自動的にWarp編集状態へ移ること。

ただしTEGAKIでは、画面上に次を明示する。

```text
WARP: BIND
WARP: ANIMATE
```

---

## 9. Mesh Effect

### 9.1 ToonSquidの仕様

Mesh Effectでは、Layer内容をCustom Triangle Meshへ貼り付ける。

- CanvasをTapしてControl Point追加
- Point追加ごとにTriangleが自動更新
- TriangleをCutできる
- Pointを直接移動できる
- Boneで動かせる
- 手動Keyframeでも動かせる
- Bind状態とAnimation状態を切り替える

Mesh Triangleが存在する範囲だけLayer内容が表示される。

### 9.2 作者作例から読み取れる重要点

手描き画像へのBone適用では、Meshの品質が結果を大きく左右する。

- 曲がる場所に十分なPointを置く
- Pointの流れを身体・髪・布の流れに合わせる
- 不要な密度を増やしすぎない
- 関節周辺に必要な自由度を与える
- Bone配置だけでなくMesh割りを丁寧にする

つまり、Boneは魔法ではない。

```text
良い変形
  =
適切なMesh
  +
適切なBone
  +
適切なBinding
  +
適切なKey Pose
```

### 9.3 TEGAKIへの段階導入

#### 段階1

Warp Gridのみ。

#### 段階2

外周Cageと自動内部三角形。

#### 段階3

任意Point追加。

#### 段階4

Triangle Cut／Topology編集。

#### 段階5

Bone Binding。

### 9.4 UI上の改善案

ToonSquid方式に加え、TEGAKIでは次を検討する。

- Auto Mesh
- Silhouetteから外周Point生成
- 関節候補付近の自動細分化
- Mesh密度Preview
- Triangleの歪み警告
- 反転Triangle警告
- Pointの複数選択
- Mirror編集
- Pin Point
- Relax
- Even Spacing
- Bake Preview

### 9.5 最初から完全Meshを狙わない理由

Meshは描画だけでなく、次の基盤を要求する。

- UV
- Bind Position
- Triangle Index
- Deformed Position
- Hit Test
- Selection
- Keyframe
- Bone Weight
- Save／Load
- GPU Render
- Export
- Bake

したがって、正式Phaseで段階的に導入する。

---

## 10. Bone Rig

### 10.1 ToonSquidのBone Binding

Bones EffectはLayerまたはGroupへ適用できる。

Groupへ適用すると、原則としてGroup内のLayerがBoneへ自動Bindingされる。

必要なら、どのBoneがどのLayerへ作用するかを手動指定できる。

### 10.2 内容の種類による挙動

#### Vector／Path

BoneがPath Control Pointへ作用する。

#### Warp／Mesh付きLayer

BoneがWarp／Mesh Control Pointへ作用し、DeformerがLayer内容を変形する。

#### Pixel Layer

自動Warp相当で変形される。

より細かく制御したい場合はMeshを追加する。

#### Symbol／Text等

基本的にはLayer全体のPosition、Rotation、Scaleを制御する。

変形が必要ならMeshを追加する。

### 10.3 Bind PoseとAnimation Pose

ToonSquidは次を明確に分ける。

```text
FX OFF
  Bind Poseを編集

FX ON
  Bone Animationを編集
  Keyframeを挿入
```

このUIは概念として優れている。

しかし、FXボタンがBind／Animateを兼ねることは、TEGAKIでは少し分かりにくい可能性がある。

TEGAKIでは明示的にする。

```text
RIG SETUP
ANIMATE
```

### 10.4 Bone追加

Canvas上でDragしてBoneを追加する。

- Drag開始点がBase
- Drag終了点がTip
- 選択Boneが新規BoneのParentになる
- 選択解除してから追加すればRoot Bone

これはHierarchy作成を高速化する。

### 10.5 Bone編集

ToonSquidではBoneのどこをDragするかで操作が変わる。

- Base付近: Position
- Tip付近: Scale／Length
- その他: Rotation

誤操作防止のため、Position編集やScale編集を無効化できる。

TEGAKIでもBone Toolに次を持たせる価値がある。

```text
Position Lock
Length Lock
Rotation Lock
```

### 10.6 Bone Strength

Boneの影響は次で決まる。

- Control Point／LayerからBoneまでの距離
- Bind Pose上のBone Length
- Bone Strength

最初は距離ベースの自動Weightで十分である。

Weight Paintは後回しにできる。

### 10.7 Custom Binding

ToonSquidでは一つのBoneを複数LayerへBindingでき、一つのLayerを複数BoneへBindingできる。

自動Bindingと手動Bindingは表示上区別される。

TEGAKIでも、

```text
Auto
Manual
Unbound
```

を色または線種で区別する。

### 10.8 Bone Keyframe UI

選択中のBoneだけをTimelineへ展開し、そのBoneの編集だけにKeyframeを追加する。

Bone未選択時にはRig全体のPropertyを操作できる。

これはTimelineの混雑を抑える重要な仕組みである。

---

## 11. Bone ConstraintsとIK

### 11.1 Rotation Limit

Boneの正方向・負方向それぞれに回転制限を設定できる。

選択時にはCanvas上へ制限範囲が線で表示される。

TEGAKIへそのまま参考にできる。

### 11.2 Independent Rotation

Parentが回転してもChildのRotationを独立させる設定。

頭、目、装飾等で有用。

### 11.3 IK Target

Chain終端のBoneにIK Targetを指定すると、Targetの位置へ届くよう中間Boneを自動計算する。

```text
Upper Arm
  └ Forearm
      └ Hand
          → IK Target
```

Targetのみを動かして腕全体を制御できる。

### 11.4 IK実装上の注意

ToonSquid公式にも次の注意がある。

- IK Targetを制御対象Hierarchy内へ入れるとFeedback Loopになる
- IK Targetは通常Strength 0にする
- 各FrameのIK解は前Frameの解に依存しない
- 直線状のBind Poseでは別解へJumpしやすい
- Rotation Limitが解を悪化させることがある
- 手動Rotationで解の方向を誘導できる

TEGAKIでもIKを入れる際は、単にTargetだけ実装して終わりにしない。

必要なUI:

- Chain Preview
- Bend Direction
- Pole Vectorまたは初期曲げ方向
- Stretch Limit
- Feedback Loop警告
- Invalid Chain警告
- Solver失敗表示
- Bake

### 11.5 TEGAKIでの実装順

```text
1. FK親子Bone
2. Rotation Limit
3. 2 Bone IK
4. Bend Direction
5. Stretch
6. 複数Chain
7. Corrective Pose
```

---

## 12. Skinning Mode

ToonSquidのVector BoneにはSmoothとLocalizedがある。

### Smooth

Bezier Handleの角度を保ち、曲線の滑らかさを維持する。

### Localized

Control PointとHandleをより局所的に変形し、隣接Shape間の隙間を抑えられる。

一方で、滑らかな接続が崩れる場合がある。

これはTEGAKIのラスター変形へそのまま移植する機能ではないが、設計上の示唆がある。

> 変形の滑らかさと、境界の密着は常に同じ目的ではない。

ラスターMeshでも、

- Smooth Weight
- Localized Weight
- Rigid Region

のPresetを持つ価値がある。

---

## 13. Group Layer

### 13.1 Group Transform

ToonSquid 2ではGroup自体にTransformがあり、内部LayerをまとめてPosition、Rotation、Scaleできる。

TEGAKIではCAF GroupまたはClip Groupへ適用可能。

### 13.2 Group Loop

複数Drawingを選び、Loop Drawingsを実行すると、Loop設定付きGroupが自動作成される。

Symbolへ移さなくても、Main Timeline上でDrawingを編集し続けられることが利点である。

### 13.3 Group Retime

Groupの開始・終了FrameをTimelineで変更できる。

内部内容はGroup Local Timeで再生される。

### 13.4 TEGAKIへの適用

TEGAKIでは、Groupを二種類へ分ける可能性がある。

```text
CAF Edit Group
  選択、移動、複製の操作単位

Playback Group
  Local Time、Loop、Phase、Transformを持つ再生単位
```

初期は同じUIでも、保存責務を明確にする。

### 13.5 優先機能

- Group Transform
- Loop
- Ping-pong
- Phase Offset
- Local Duration
- Bake
- Group Collapse
- Source編集へ戻る

---

## 14. Symbol LayerとClip再利用

### 14.1 ToonSquidのSymbol

Symbol LayerはAsset Library内のAnimation Clipを参照し、そのClip内容をTimeline上で再生する。

Instanceごとに次を持つ。

- Transform
- Clip参照
- Loop Mode
- Normal／Boomerang
- Time Offset
- Own Frame Rate
- Audio Mute

### 14.2 異なるFrame Rate

Symbolは、参照Clip固有のFrame Rateで再生するか、親TimelineのFrame Rateへ合わせるかを選べる。

これは、以前検討したTEGAKIの

```text
CAF内容: 12fps Hold
Motion: 60fps Continuous
```

とは同じではないが、時間評価を要素ごとに分ける先行例である。

### 14.3 TEGAKIへの翻訳

```text
ClipAsset
  CAF列の正本

ClipInstance
  assetId
  transform
  loopMode
  phaseOffset
  playbackRate
  contentSampling
  motionSampling
```

### 14.4 鳥の群れ

羽ばたきClipAssetを複数Instance配置し、各InstanceのPhase、Position、Scale、Speedを変えれば群れを作れる。

初期実装では深いNested Symbolを導入せず、一段のAsset参照で十分である。

### 14.5 編集導線

ToonSquidはSymbolをDouble Tapして参照Clipを開ける。

TEGAKIでも次を用意する。

```text
Edit Instance
Edit Source
Make Independent
Bake
```

---

## 15. Motion Path

ToonSquidではPositionに複数Keyframeがあると、Pivotの移動軌跡がCanvasへ表示される。

軌跡はBezier CurveとしてCanvas上で直接編集できる。

### TEGAKIへの適用

優先度は高い。

- Key Point選択
- Tangent Handle
- Curve／Linear切替
- Point追加
- Point削除
- Snap
- Path表示切替
- 速度表示
- Orient Along Path

Timeline上のEasingと、Canvas上の空間Pathを明確に分ける。

```text
Motion Path
  空間上の形

Easing
  時間上の進み方
```

---

## 16. Orient Along Motion Path

Layerの進行方向に応じてRotationを自動計算するEffect。

手動Rotationは自動Rotationへ加算できる。

TEGAKIでは、鳥、車、魚、矢印、カメラ追従物等に有用。

Modifierとして実装しやすい。

```text
Auto Orient
  enabled
  angleOffset
  smoothing
  flipCorrection
```

優先度は高い。

---

## 17. Noise Effect

Noiseはランダム信号をLayer Propertyへ適用する。

- Replace
- Add
- Multiply
- Min
- Max
- Seed

例:

- Position Jitter
- Rotation Jitter
- Opacity Flicker
- Scale Pulse

TEGAKIの「手描きの時間と演算の時間のミスマッチ」を強化できる。

例:

```text
人物: 12fps手描き
光: Continuous Opacity Noise
カメラ: 8fps Position Noise
時計: Continuous Rotation
```

### TEGAKI向け追加設定

- Continuous
- Stepped FPS
- Hold
- Smooth Noise
- Random per Loop
- Fixed Seed

Noiseは比較的小規模な実装で大きな表現効果があるため、WarpやBoneより前に追加する選択肢もある。

---

## 18. Spin Effect

Pivot周りへ一定速度でRotationを加える。

SpeedをKeyframe化できる。

時計、車輪、扇風機、回転物、魔法陣等に有用。

通常Rotation Keyを大量に打つ必要がなくなる。

TEGAKIではClip Motion Modifierとして実装しやすい。

```text
Spin
  rotationsPerSecond
  phase
  samplingMode
```

---

## 19. Parallax

Camera移動に応じてLayerのPosition Offsetを自動計算し、疑似的な奥行きを作る。

TEGAKI本体へ入れる優先度は中以下。

理由:

- Camera Systemが必要
- Scene全体の座標系が必要
- Background Layer構造が必要
- 別動画ツールとの責務が重なる

ただし簡易版として、

```text
Parallax Group
  depth
  referenceCameraMotion
```

をClip Groupへ適用する可能性はある。

本格版は別動画ツール寄り。

---

## 20. Loop Keyframes

複数Keyframeを選択し、Loopを指定すると、次のKeyframeまで選択区間が繰り返される。

複数PropertyをまとめてLoopする場合、Cycle終端を揃えるため不足Keyが自動追加される。

TEGAKIでは有用。

- 反復回転
- 揺れ
- 呼吸
- 光
- 表情
- 小刻みなMovement

ただし、CAF CycleとProperty Key Loopを別概念にする。

```text
CAF Cycle
  Drawing内容の繰返し

Motion Loop
  Property値の繰返し
```

---

## 21. Easing Curves

ToonSquidには、

- Linear
- Polynomial
- Bounce
- Elastic
- Exponential
- Sine
- Circular
- Back
- Hold
- Loop
- Custom

等がある。

TEGAKIで全Presetを急いで実装する必要はない。

推奨初期セット:

- Hold
- Linear
- Ease In
- Ease Out
- Ease In Out
- Custom Cubic Bezier
- Loop

その後:

- Back
- Elastic
- Bounce

重要なのは、左側Keyが次区間のEasingを所有する等、区間所有ルールを明確にすること。

---

## 22. Onion Skin関連

ToonSquid 2では、Onion Skinは選択Animation Layerだけを標準対象とする。

必要なLayerは個別に有効化できる。

またLoop Onion Skinがあり、Loop末尾で先頭Drawing、先頭で末尾Drawingを表示できる。

### TEGAKIへの適用

- 選択Lane優先
- 他Laneは個別ON
- Loop境界Onion
- Motion適用前／後の表示選択
- Warp／Bone適用前後のGhost

Loop OnionはTEGAKIのCAF Cycleへ強く適合する。

---

## 23. FullscreenとUI密度

ToonSquid 2にはUIを全て隠すFullscreen Modeがある。

TEGAKIでも次の状態が考えられる。

```text
Draw Focus
  Canvas最大
  QuickToolPreset
  Color
  最低限のFlip

Animation
  Timeline表示

Rig / Motion
  Inspector、Timeline、Gizmo表示
```

全機能を常時見せず、作業状態ごとに情報密度を切り替える。

---

# Part II: TEGAKIへ導入するもの

## 24. そのままに近い形で採用する候補

### A1. Transform Gizmo

- Canvas直接選択
- Move
- Rotate
- Scale
- Pivot
- Snap
- Numeric HUD

### A2. Motion Path

- Canvas上のBezier編集
- 表示切替
- Key選択同期

### A3. 4×4 Warp

- 16 Point
- Bind／Animate
- Keyframe
- Bake

### A4. Simple Procedural Modifiers

- Spin
- Noise
- Orient Along Path

### A5. Group Transform／Loop

- Group Local Transform
- Loop
- Ping-pong
- Phase
- Bake

### A6. Loop Onion

CAF Cycleの先頭・末尾をまたぐOnion。

---

## 25. TEGAKI向けに翻訳して採用する候補

### B1. Effect Stack

完全なEffect Stackではなく限定Modifier Chain。

### B2. Bone

最初は剛体Hierarchy、その後Warp／Mesh Binding。

### B3. Mesh

Warp Gridから段階的に任意Meshへ拡張。

### B4. Symbol

深いNested Symbolではなく、一段ClipAsset参照。

### B5. Control Point Morph

Path Layerではなく、Warp／Mesh／Guide Point基盤として導入。

### B6. Auto Mode Switching

完全自動ではなく、明示状態を伴うContext Switching。

---

## 26. 別動画ツールへ置く候補

- Camera
- 本格Parallax
- 汎用Appearance Effect Stack
- 複雑なChroma Key
- Audio編集
- Video編集
- Deep Nested Clip
- 複雑なComposite
- 大量のEffect
- Final Color Correction

---

## 27. 当面見送る候補

- 全Layer Propertyの完全Keyframe化
- ToonSquid型Scene Graphへの全面移行
- Vector Control Point Morphの完全再現
- Vector Group体系
- SVG Animation
- 無制限のEffect組合せ
- Automatic Pixel Edit Modeの不透明な自動判定
- 高度なIK Solver
- Weight Paintを含む本格Rig Editor
- すべての機能を一つのTimelineへ展開

---

# Part III: TEGAKI向けUI設計

## 28. 編集Context

TEGAKIでは常に「現在何を編集しているか」を明示する。

```text
DRAW
  CAFのPixel内容

INSTANCE
  ClipInstance Transform

MOTION
  Motion Key / Path

WARP BIND
  Warp初期形状

WARP ANIMATE
  Warp Point Key

MESH BIND
  Mesh Topology / UV

MESH ANIMATE
  Mesh Point Key

RIG SETUP
  Bone / Hierarchy / Binding

RIG ANIMATE
  Bone Key / IK
```

### 表示場所

- Canvas左上Status
- Timeline Header
- Inspector Title
- Gizmo色または線種

色だけに依存せず、文字とIconを併用する。

---

## 29. 共通Control Point Controller

Control Pointには複数種類がある。

```text
MotionPathPoint
WarpPoint
MeshPoint
BoneBase
BoneTip
IKTarget
GuidePoint
```

選択、Drag、複数選択、Snap、Keyframe、Historyを共通化する。

```ts
interface EditableControlPoint {
  id: string;
  kind: string;
  position: Point;
  selectable: boolean;
  keyframeable: boolean;
  locked: boolean;
}
```

実際の保存正本は種類ごとに異なってよい。

UI Controllerだけを共通化する。

---

## 30. Inspector

選択対象に応じて内容を切り替える。

```text
Clip選択
  Transform
  Sampling
  Loop
  Modifiers

Warp選択
  Grid
  Point Position
  Interpolation
  Reset

Mesh選択
  Point
  Triangle
  Pin
  Binding

Bone選択
  Name
  Parent
  Strength
  Rotation Limit
  IK Target

Effect選択
  Enabled
  Parameters
  Keyframes
  Bake
```

ToonSquid同様、選択対象とProperty表示を同期する。

---

## 31. Timeline

TEGAKIでは全Propertyを常時展開しない。

```text
Collapsed Clip Row
  CAF Exposure
  Motion Key Summary
  Modifier Badge

Expanded Clip Row
  Position
  Rotation
  Scale
  Opacity

Selected Modifier
  対象ModifierのPropertyだけ表示
```

Boneも選択Boneだけを展開する。

これによりTimeline密度を抑える。

---

## 32. Non-destructiveとBake

全Modifierには出口としてBakeを用意する。

```text
Source CAF
  +
Motion
  +
Warp
  +
Bone
  ↓
Bake at FPS
  ↓
新規CAF Frame列
```

Bake Dialog:

- 範囲
- FPS
- Bounds
- Alpha
- 元Clipを保持
- 新規CAF Group
- Source Link
- Motion Sampling
- Overwrite禁止
- Undo単位

---

# Part IV: 段階的リファクタリング

## 33. Phase TS-0: 監査

コード変更なし。

確認対象:

- 現行Selection
- Layer Transform
- CAF Transform
- Clip Motion
- Timeline
- Inspector相当UI
- EventBus
- History
- Project Save
- Preview／Export
- Coordinate System
- Render Cache

成果物:

- 編集対象一覧
- 正本一覧
- 一時State一覧
- Transform経路
- Keyframe経路
- Conflict一覧

---

## 34. Phase TS-1: Unified Selection and Transform

- Canvas Hit Test
- ClipInstance選択
- CAF Content選択との区別
- 共通Bounding Box
- Pivot
- Snap
- Numeric HUD
- Editing Context表示
- Drag一回を一Historyへまとめる

このPhaseでWarpやBoneは実装しない。

---

## 35. Phase TS-2: Modifier基盤

- Clip Modifier List
- Enabled
- Order
- Selection
- Property表示
- 保存復元
- Preview／Export共通評価
- Bake APIの枠
- Versioning

最初のModifier:

- Motion
- Spin
- Noise
- Orient Along Path

---

## 36. Phase TS-3: Warp

- 4×4 Grid
- Bind Points
- Animate Points
- Keyframe
- Multi Select
- Reset
- Preview
- Export
- Bake
- History
- Cache

---

## 37. Phase TS-4: Motion Path

Warpより前後してよい。

- Bezier Path
- Key Point
- Tangent
- Spatial Path
- Easingとの分離
- Orient Along Path
- Show／Hide
- Path Sampling

---

## 38. Phase TS-5: Asset Instance and Group Loop

- ClipAsset参照
- ClipInstance
- Loop
- Ping-pong
- Phase
- Playback Rate
- Group Transform
- Edit Source
- Make Independent
- Bake

---

## 39. Phase TS-6: Mesh Bind

- Add Point
- Auto Triangulation
- Cut Triangle
- Bind Position
- Deformed Position
- UV
- Point Selection
- Save／Load
- GPU Render
- Warning表示

Animationはまだ最小限でもよい。

---

## 40. Phase TS-7: Mesh Animation

- Point Keyframe
- Interpolation
- Multi Select
- Relax
- Pin
- Bake
- Preview Quality
- Cache

---

## 41. Phase TS-8: Rigid Bone

- Bone追加
- Hierarchy
- Parent Transform
- Rotation
- Position Lock
- Length Lock
- Rotation Limit
- Bind／Animate
- Layer部品の剛体Binding

---

## 42. Phase TS-9: Bone Deformation

- Bone Strength
- Auto Weight
- Warp Point Binding
- Mesh Point Binding
- Custom Layer Binding
- Binding表示
- Weight Preset
- Bake

---

## 43. Phase TS-10: IK

- 2 Bone IK
- Target
- Bend Direction
- Stretch Limit
- Rotation Limit
- Invalid Chain警告
- Feedback Loop警告
- Bake

---

## 44. Phase TS-11: Advanced Modifiers

必要性を確認して追加。

- Color Adjustment
- Blur
- Drop Shadow
- Chroma Key
- Parallax

Appearance系は別動画ツールへ回す判断も可能。

---

# Part V: 受け入れテスト

## 45. Transform

- CAF内容とClipInstance Transformを誤操作しない
- Editing Contextが常時分かる
- Pivotが保存復元される
- SnapがPreviewとExportへ影響しない
- Drag一回がUndo一回で戻る

## 46. Warp

- 16 Pointが安定して表示される
- Bind PointとAnimation Pointを混同しない
- Keyframe補間がPreviewとExportで一致
- Point複数選択ができる
- Bake後のCAFを通常ペンで編集できる

## 47. Mesh

- Point追加でTriangleが更新される
- Triangle反転時に警告
- Mesh外の扱いが定義されている
- Bind状態を変更してもSource Rasterを失わない
- ExportとPreviewが一致する

## 48. Bone

- Parent移動がChildへ伝播
- Selected BoneだけにKeyが追加
- Rotation Limitが視覚化される
- Custom Bindingが保存される
- IK TargetがLayerへ直接影響しない設定が可能
- Invalid Chainが検出される
- Bakeできる

## 49. Asset／Group

- 一つの羽ばたきAssetを複数Instance配置
- Phase、Scale、Speedを個別設定
- Source変更がInstanceへ反映
- Make Independentが機能
- Group LoopがMain Timeline上で編集可能
- 異なるSamplingが保存される

---

# Part VI: 非目標

初期リファクタリングでは次を行わない。

- ToonSquidのClone
- ToonSquid Project互換
- 全Effect互換
- 全Layerの全Property Track化
- Vector Layer体系の全面導入
- Path Morphの完全実装
- Audio／Video Editor化
- Camera／Composite中心化
- Deep Nested Symbol
- 3D化
- PhysicsとBoneの同時導入
- AI生成とRigの同時導入
- 大規模DOM／Classの一括置換
- 現行CAF保存正本の破壊

---

# Part VII: Codex／GPTへの指示

この文書を読んだAIは、機能名だけを見て実装を開始しないこと。

実装前に次を確認する。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 現行Phase指示書
5. `animation-system.js`
6. `data-models.js`
7. `layer-transform.js`
8. `coordinate-system.js`
9. `history.js`
10. Export経路
11. Project Save／Load
12. EventBus
13. WebGL2関連の現行境界

提案時には次を明記する。

- 保存正本
- UI一時State
- ClipAssetとClipInstanceの責務
- Bind PoseとAnimate Poseの責務
- Timeline Keyの所有者
- Preview／Export／Bakeの共通Sampler
- History Transaction
- Cache無効化
- Versioning
- Migration
- Failure時のRollback
- 対象外ファイル
- 現行Phaseとの衝突

本文中のInterface名、Phase名、JSON名は概念例であり、既存実装を検索してから命名すること。

---

# Part VIII: 軽い周辺UI参考

本冊子の中心ではないが、ToonSquidの周辺UIから次を参考にできる。

## 50. Fullscreen

Canvas集中Mode。

## 51. Slider数値入力

Sliderだけでなく、数値部分を押して直接入力。

## 52. Color Picker

- Wheel
- Value
- Palette
- Recent Colors
- Primary／Secondary
- Floating Picker

TEGAKIのQuickToolPresetへは、

```text
Brush
Size
Opacity
Blend
Color
Eraser
```

をまとめる案がある。

ただし、アニメーション・変形のリファクタリングとは別Phaseで扱う。

## 53. Drag and Drop Import

Asset、画像、ClipのImport導線として参考にする。

---

# 54. 最終提案

TEGAKIがToonSquid 2から学ぶべき中心は、BoneやMeshの完成形だけではない。

最も重要なのは次の連続性である。

```text
対象をCanvasで選ぶ
  ↓
適切なTransform／Control Point UIへ切り替わる
  ↓
Inspectorに対象Propertyが出る
  ↓
Timelineに必要なKeyだけ出る
  ↓
非破壊でPreviewされる
  ↓
必要ならBakeできる
```

TEGAKIで段階導入する順序としては、次を推奨する。

```text
1. SelectionとTransformの統一
2. Modifier基盤
3. Motion Path
4. Spin／Noise／Orient
5. 4×4 Warp
6. ClipAsset／Instance／Group Loop
7. Mesh
8. Rigid Bone
9. Bone Deformation
10. IK
11. Appearance Effect
```

この順序なら、ToonSquid 2の魅力を取り入れながら、TEGAKIのCAF中心の設計を壊さずに進められる。

---

# 参考URL

## 指定資料

- FANBOX記事  
  https://arami.fanbox.cc/posts/11309050
- X投稿  
  https://x.com/Yu_Arami/status/2019240071015329821

## 同作者の関連公開投稿

- Shape Motion／Control Point解説  
  https://x.com/Yu_Arami/status/2030198237077065760
- MeshとBoneによる揺れもの  
  https://x.com/Yu_Arami/status/2018833389269500289
- 手描き画像へのMesh適用例  
  https://x.com/Yu_Arami/status/2011936533444772069
- BoneとMeshの注意点  
  https://x.com/Yu_Arami/status/1991066008594043276
- 疑似立体Control Point作例  
  https://x.com/Yu_Arami/status/2044351816633401676

## ToonSquid公式

- ToonSquid 2.0  
  https://toonsquid.com/updates/ToonSquid-2/
- Effects  
  https://toonsquid.com/handbook/effects/effects/
- Transform Tool  
  https://toonsquid.com/handbook/transform/transform_tool/
- Transform Properties  
  https://toonsquid.com/handbook/transform/transform_properties/
- Motion Path  
  https://toonsquid.com/handbook/transform/motion_path/
- Morphing  
  https://toonsquid.com/handbook/path/morphing/
- Path Tool  
  https://toonsquid.com/handbook/path/path_tool/
- Warp  
  https://toonsquid.com/handbook/effects/warp/
- Mesh  
  https://toonsquid.com/handbook/effects/mesh/
- Bones  
  https://toonsquid.com/handbook/effects/bones/
- Group Layer  
  https://toonsquid.com/handbook/layers/group/
- Symbol Layer  
  https://toonsquid.com/handbook/symbols/symbol_layer/
- Keyframes  
  https://toonsquid.com/handbook/keyframes/keyframes/
- Easing Curves  
  https://toonsquid.com/handbook/keyframes/easing_curves/
- Timeline  
  https://toonsquid.com/handbook/interface/timeline/
- Noise  
  https://toonsquid.com/handbook/effects/noise/
- Spin  
  https://toonsquid.com/handbook/effects/spin/
- Orient Along Motion Path  
  https://toonsquid.com/handbook/effects/orient_along_motion_path/
- Parallax  
  https://toonsquid.com/handbook/effects/parallax/
