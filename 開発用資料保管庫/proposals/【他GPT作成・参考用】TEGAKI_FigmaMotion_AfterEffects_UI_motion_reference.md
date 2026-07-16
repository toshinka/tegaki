# TEGAKI × Figma Motion × After Effects
## 最新UI・Motion編集・文字アニメーション・再利用設計の分析と段階導入計画

- 文書種別: 外部ツール分析／UI・機能リファレンス／将来設計メモ
- 主な読者: TEGAKIを調査・設計・実装するCodex／GPT、および開発者
- 対象:
  - Figma Motionの最新UI、Timeline、Property Keyframe、Preset、Animated Component、Motion Variable、Export／Handoff
  - After EffectsのProperties Panel、Graph Editor、Text Animator、Expressions、Precomposition、Essential Properties、Responsive Design - Time、Shape Operator、Quick Apply、Proportional Scrubbing
  - TEGAKIへの段階的なUI・Motion機能導入
- 軽く扱う対象:
  - 3D Camera
  - 高度なComposite
  - Track Matte
  - Motion Graphics Templateの外部編集
- 対象外:
  - Callipegのコマ作画・露出・Onion詳細
  - ToonSquid 2のWarp、Mesh、Bone、IK詳細
- 関連文書:
  - `TEGAKI_Callipeg_feature_UI_reference.md`
  - `TEGAKI_ToonSquid2_feature_UI_reference.md`
  - `TEGAKI_animation_architecture_notes.md`
  - `TEGAKI_AI_engine_integration_plan.md`
- 注意:
  - 本文書は実装契約ではない
  - 実装前に現行の `AGENTS.md`、`TEGAKI.md`、`tegaki_work/PROGRESS.md`、現行Phase指示書、関連コードを確認する
  - Figma Motionは2026年7月時点でOpen Betaであり、仕様変更や性能問題があり得る
  - After Effectsは長年の機能蓄積と新UIが混在するため、機能をそのまま再現せずTEGAKI向けに縮約する

---

# 1. 結論

Figma MotionとAfter Effectsは競合する参考対象ではなく、異なる層で利用すべきである。

```text
Figma Motion
  = Motion制作へ入りやすい表面UI
  = 選択、Inspector、Key追加、Preset、再利用、Handoff

After Effects
  = Motionを深く調整する内部UI
  = Graph、Text Selector、Property連動、入れ子、時間保護、演算

Callipeg
  = コマ作画、CAF露出、Onion、中割り

ToonSquid 2
  = Warp、Mesh、Bone、IK、変形
```

TEGAKIへ最も筋よく導入する構成は次である。

```text
通常画面
  Figma Motion型
    ├ DRAW / ANIMATE / DEFORM
    ├ 左: Layer / Lane / Asset
    ├ 中央: Canvas
    ├ 右: Contextual Inspector
    └ 下: 必要時だけTimeline

高度Motion
  After Effects型を縮約
    ├ Value / Speed Graph
    ├ Text Animator
    ├ Exposed Properties
    ├ Protected Intro / Outro
    ├ Property Link
    └ Deep Preset

作画時間
  Callipeg型
    ├ CAF Exposure
    ├ Push / Lock
    ├ Flip
    ├ Onion
    └ Inbetween Assist

変形
  ToonSquid 2型
    ├ Warp
    ├ Mesh
    ├ Bone
    └ IK
```

最優先でTEGAKIへ取り込む候補:

1. **DRAW／ANIMATE／DEFORMの明示的モード**
2. **選択対象で変わる右Inspector**
3. **Property値横のKeyframe Diamond**
4. **Auto Keyの強い警告表示**
5. **Figma型Preset選択 + AE型の編集可能な内部構造**
6. **AE型Value Graph／Speed Graphの二層構造**
7. **AE型Text Animatorを簡略化した文字・単語・行Stagger**
8. **Essential Properties相当のClip公開Property**
9. **Responsive Design - Time相当のIntro／Middle／Outro**
10. **Pick Whip相当の制限付きProperty Link**
11. **Quick Apply／Command Palette**
12. **Contextual InspectorからTimelineのPropertyへRevealする導線**
13. **Preset、Motion Asset、Timing／EasingのProject共通化**
14. **Animationを動画だけでなく構造化JSONとして交換する設計**

---

# 2. 調査時点と情報源

## 2.1 Figma Motion

Figma Motionは2026年に公開されたFigma内蔵のMotion制作環境であり、2026年7月時点ではOpen Betaである。

公式資料から確認できる主な機能:

- Motionモード時に下部Timelineを表示
- Preset Animation
- Composite Animation Style
- Custom Keyframe
- Property欄横のKeyframe Diamond
- Auto Keyframe
- Timing Variable
- Easing Variable
- Animated Component
- Dev ModeでのAnimation確認
- CSS／JSON／ReactへのHandoff
- MP4、WebM、GIF、SVG Export

## 2.2 After Effects

After Effectsは長年のMotion Graphics機能を持つ一方、2026年時点ではProperties Panel、Quick Apply、Proportional Scrubbingなど、複雑なTimeline階層を避ける新しいUIも強化されている。

本書で重点的に確認した機能:

- Properties Panel
- Quick Set Anchor
- Timeline／Graph Editor
- Value Graph
- Speed Graph
- Keyframe Interpolation
- Text Animator／Range Selector／Wiggly Selector／Expression Selector
- Expressions／Pick Whip
- Precomposition／Nesting
- Essential Properties
- Responsive Design - Time
- Shape Operators
- Repeater／Wiggle Transform
- Time Remapping
- Quick Apply
- Proportional Scrubbing
- Workspaces／Stacked Panels
- Motion Graphics Template／Replaceable Media

---

# 3. 役割比較

| 領域 | Figma Motion | After Effects | TEGAKIでの役割 |
|---|---|---|---|
| 初見の分かりやすさ | 強い | 弱め | Figma型 |
| Propertyへの入口 | 強い | 2026年Properties Panelで改善 | 両者 |
| Keyframe追加 | 値横Diamond | Stopwatch／Properties | Figma型 |
| Auto Key警告 | 強い赤表示 | 状態はあるがUIが分散 | Figma型 |
| Preset発見性 | 強い | 検索前提 | Figma型 |
| Preset内部構造 | 比較的単純 | Key／Effect／Expressionを含められる | AE型 |
| Graph調整 | 基本的 | 非常に強い | AE型を簡略化 |
| 文字アニメ | 基本Layer Motion中心 | 非常に強い | AE型を簡略化 |
| Property連動 | Variable／Component中心 | Expression／Pick Whip | 制限付きAE型 |
| Asset再利用 | Animated Component | Precomp／Essential Properties／MOGRT | 両者 |
| 尺変更への耐性 | Component Duration中心 | Protected Region | AE型 |
| UI／WebデザインMotion | 非常に強い | 強いが重い | Figma型 |
| コマ作画 | 弱い | 弱い | Callipeg型 |
| Warp／Bone | 対象外 | Puppet等はあるが本書対象外 | ToonSquid型 |
| 外部コードHandoff | CSS／JSON／React／MCP | MOGRT／Script／Expression | Figma型JSON中心 |

---

# Part I: Figma Motion

# 4. Motionモードと画面配置

Figma Motionでは、通常のDesignモードとMotionモードを切り替える。

Motionを有効にすると、画面下部へTimelineが現れる。

この構造の利点:

- Design作業中はTimelineがCanvasを圧迫しない
- Motion作業へ入ったことが明確
- Canvas、Layer、Propertyの配置を維持したまま時間UIを追加できる
- Motionを使わないユーザーへ複雑さを見せない

TEGAKIでは次の三Modeへ翻訳する。

```text
DRAW
  CAFのPixel内容を描く
  Onion／Flipを使う

ANIMATE
  CAF露出
  Clip Motion
  Cycle
  Text Motion
  Preset

DEFORM
  Warp
  Mesh
  Bone
  IK
```

Modeごとの基本配置:

```text
左
  Layer / Lane / Asset

中央
  Canvas / Direct Manipulation

右
  Contextual Inspector

下
  DRAW: Collapsed Flip / CAF Table
  ANIMATE: Timeline
  DEFORM: Timeline + Modifier / Rig Track
```

---

# 5. Property横のKeyframe Diamond

Figma Motionでは、Keyframe対応Propertyの値横にDiamondが表示される。

例:

```text
Position X    120   ◇
Position Y     80   ◆
Rotation       15   ◇
Opacity       100   ◇
```

このUIは非常に分かりやすい。

ユーザーはTimeline内でProperty Trackを探す必要がない。

操作:

1. Playheadを移動
2. 値横Diamondを押す
3. Property値を変更
4. Timelineへ対応Keyが生成される

TEGAKIへの対象:

- Clip Position
- Clip Scale
- Clip Rotation
- Anchor
- Opacity
- Blend Strength
- Spin Speed
- Noise Amount
- Text Property
- Warp Point
- Bone Rotation
- IK Blend

### 推奨状態

```text
◇
  Keyなし

◆
  現在時刻にKeyあり

◆ + 色違い
  PropertyにはKeyがあるが、現在時刻には無い

=
  Expression／Driverあり
```

Key、Static値、Driver値を視覚的に区別する。

---

# 6. Auto Keyframe

Figma MotionではAuto KeyをONにすると、CanvasやInspectorでの変更が自動的にKeyとして記録される。

意図しない変更も記録され得るため、Timeline上端とPlayheadが赤くなり、Canvas上にもAuto Key用Handleが現れる。

この強い警告はTEGAKIへ採用すべきである。

```text
AUTO KEY ON
━━━━━━━━━━━━━━━━ 赤いTimeline境界

Canvas左上
● RECORDING MOTION

Inspector
Property変更はKeyになります
```

TEGAKIでの安全策:

- DRAWモードへ移るとAuto Keyを自動解除
- Projectを開いた直後は必ずOFF
- Auto Key中のMode変更時に確認
- Undoで一回のDragを一件にまとめる
- Keyが追加されたPropertyを短時間Highlight
- Status Barへ追加Key数を表示

---

# 7. Preset Animation

Figma Motionでは、右SidebarからPresetを追加できる。

単独Animationだけでなく、複数PresetをまとめたComposite Animation Styleもある。

PresetはTimeline上で移動・Duration変更でき、選択後に個別設定を編集できる。

TEGAKIへ採用したい表面UI:

```text
ENTER
  Fade In
  Slide In
  Scale In
  Pop
  Bounce

LOOP
  Float
  Breathe
  Shake
  Flicker
  Spin

EXIT
  Fade Out
  Slide Out
  Shrink
  Drop

TEXT
  Typewriter
  Character Stagger
  Word Reveal
  Scramble
```

### Figma型の長所

- Preset名が人間の目的に近い
- Previewしながら選べる
- Timelineへ即配置される
- Duration Handleが見える
- Preset適用後に編集可能

### TEGAKIでの内部表現

Presetを一枚の不透明なEffectとして保存しない。

```text
Float Preset
  ├ Position Y Oscillation
  ├ Rotation Noise
  ├ Loop
  └ Ease In Out
```

PresetをModifier／Keyへ展開可能にする。

表面UIはFigma型、内部構造はAfter Effects型を採用する。

---

# 8. Composite Animation Style

複数Animationを一括適用する考え方は、TEGAKIのQuick Motionへ向く。

例:

```text
Soft Entrance
  ├ Opacity 0 → 1
  ├ Scale 0.95 → 1.0
  └ Position Y +12 → 0

Mechanical Alert
  ├ Opacity Blink
  ├ Rotation Step
  └ Scale Pulse
```

TEGAKIではComposite Presetに次を保存する。

- Modifier構成
- Keyframe相対時間
- Easing
- Sampling Mode
- Loop
- Parameter公開設定

適用時:

```text
Apply as Editable
Apply as Linked Preset
Bake Immediately
```

初期は `Apply as Editable` のみでよい。

---

# 9. Timing VariableとEasing Variable

FigmaではPresetのDelay／DurationへTiming Variableを、Animation間のEasingへEasing Variableを適用できる。

これによりMotion Systemを構築できる。

```text
duration.instant = 80ms
duration.fast = 140ms
duration.normal = 240ms
duration.slow = 500ms

ease.linear
ease.standard
ease.emphasized
ease.bouncy
```

TEGAKIではProject Motion Presetとして導入できる。

```text
Timing Preset
  Snappy
  Normal
  Soft
  Dramatic

Sampling Preset
  Hold
  Stepped 6fps
  Stepped 12fps
  Continuous

Easing Preset
  Linear
  Ease In
  Ease Out
  Ease In Out
  Back
  Elastic
```

用途:

- UIアニメーション
- Text
- Clip Motion
- Spin
- Noise
- Group Motion
- AI ResultのGuide Motion

---

# 10. Animated Component

Figma Motionで作ったAnimationはComponent化し、Libraryへ公開できる。

InstanceはTimelineへ配置できるが、AnimationのDurationやPropertyそのものはMain Component側で編集する。

TEGAKIとの対応:

```text
Figma Main Animated Component
  ≒ ClipAsset / MotionAsset

Figma Component Instance
  ≒ ClipInstance
```

TEGAKI向け操作:

```text
Edit Source
Edit Instance
Make Independent
Expose Property
Bake
```

Instance側で上書きできるもの:

- Position
- Scale
- Rotation
- Start Time
- Phase
- Playback Rate
- Loop Mode
- Exposed Property

Source側でのみ変更するもの:

- CAF内容
- 内部Motion Track
- Modifier構成
- Default Duration
- 内部Text Layout

---

# 11. FigmaのHandoff

Figma MotionはDev ModeでAnimationを確認し、CSS、JSON、ReactへCopyできる。

TEGAKIが同じ形式をすべて出す必要はない。

重要なのは、

> Animationを完成動画だけでなく構造化データとして外部へ渡す

という思想である。

TEGAKIの候補:

```text
TEGAKI Motion JSON
Web Animations API JSON
CSS Keyframes
別動画ツール交換形式
```

対象:

- Clip Transform
- Text Animation
- UI Icon Motion
- Timing／Easing
- Preset
- Marker
- Protected Region

Warp／Mesh／Bone等、Web CSSで再現できないものはBakeまたは専用形式にする。

---

# 12. Figma Motionの限界

2026年7月時点ではOpen Betaであり、仕様変更や性能問題の可能性が公式に示されている。

また、TEGAKIの中心用途に対して次は不足する。

- CAF露出
- Onion Skin
- Flip
- 中割り
- Warp
- Mesh
- Bone
- IK
- 高度Text Selector
- 深いProperty Expression
- Speed Graph相当の精密編集

Figma Motionをアニメーション全体の唯一の参考にしない。

---

# Part II: After Effects

# 13. After Effectsの新旧UI

After Effectsは、Timeline内の階層を開き続ける古い操作が有名である。

しかし2026年時点では、Properties Panelが強化され、選択Layerに応じてTransform、Text、Shape、Essential Properties等を右側へContext表示できる。

さらに次が追加・強化されている。

- Quick Apply
- Proportional Scrubbing
- Quick Set Anchor
- PropertiesからTimelineへReveal
- Stacked Panel
- Custom Workspace

したがって、After Effectsを「古く複雑なUI」とだけ評価するのは不正確である。

TEGAKIでは、

```text
Figma Motionの単純さ
  +
AE 2026 Properties Panelの深さ
```

を参考にする。

---

# 14. Properties Panel

AEのProperties Panelは、選択したLayerの関連ControlをComposition横へ表示する。

Layer TransformはすべてのLayerで上部へ表示され、Text／Shape等では追加Propertyを表示する。

Timeline階層を開かずに操作でき、必要なPropertyをTimelineへRevealできる。

TEGAKIへ採用したい設計:

```text
右Inspector

COMMON
  Position
  Scale
  Rotation
  Anchor
  Opacity

CONTENT
  CAF / Text / Shape

MOTION
  Key
  Easing
  Sampling

MODIFIERS
  Spin
  Noise
  Warp
  Bone

INSTANCE
  Source
  Loop
  Phase
  Speed
```

### Reveal in Timeline

InspectorのPropertyをDouble ClickまたはMenuからTimelineへ表示する。

```text
Rotation
  [Show in Timeline]
```

これによりTimelineを常時全展開しない。

---

# 15. Quick Set Anchor

AE 2026 BetaのQuick Set Anchorは、Anchor Point Property横のPopoverから9点を選ぶ。

```text
┌───┬───┬───┐
│ TL│ TC│ TR│
├───┼───┼───┤
│ CL│ C │ CR│
├───┼───┼───┤
│ BL│ BC│ BR│
└───┴───┴───┘
```

TEGAKIへ非常に適する。

- Clip
- Text
- CAF
- Group
- Asset Instance

に共通で使える。

さらに:

- Custom Anchor
- Selection Center
- Visible Bounds
- Canvas Center
- Previous Anchor
- Reset

を追加できる。

---

# 16. Graph Editor

After EffectsのGraph Editorには大きく二種類ある。

## Value Graph

Property値の変化を見る。

```text
Rotation
0° → 90° → 45°
```

## Speed Graph

値の変化速度を見る。

```text
停止
  ↓ 加速
最高速
  ↓ 減速
停止
```

Motion Path上の点間隔でも速度を把握できる。

TEGAKIでは両方を同時に初期表示しない。

```text
BASIC
  Preset
  Easing Curve

ADVANCED
  Value Graph
  Speed Graph
```

### 初期実装

- Hold
- Linear
- Cubic Bezier
- Value Graph
- Fit Selected
- Tangent
- Key追加／削除

### 後期実装

- Speed Graph
- Incoming／Outgoing Influence
- Split Tangent
- Roving Key
- Multi Property Overlay
- Post Modifier Graph

---

# 17. TemporalとSpatialの分離

After Effectsは、時間方向のInterpolationと空間Pathを分ける。

```text
Temporal
  いつ、どの速度で進むか

Spatial
  どの軌道を通るか
```

TEGAKIでも明確に分ける。

```text
Motion Path
  Canvas上の軌道

Easing / Speed Graph
  Timeline上の時間変化
```

ユーザーがMotion Pathを曲げても速度が変わらない場合、または速度を変えてもPathが変わらないことを保証する。

---

# 18. Keyframe Interpolation

After EffectsのInterpolationには、Hold、Linear、Bezier、Auto Bezier、Continuous Bezier等がある。

TEGAKIで必要な最小集合:

```text
Hold
Linear
Bezier
```

UI上のPreset:

```text
Ease In
Ease Out
Ease In Out
```

内部的にはBezierへ変換する。

後から:

- Auto Smooth
- Continuous
- Broken Tangent
- Loop

を追加する。

---

# 19. Roving Keyframe

Roving Keyframeは中間Keyの時刻を固定せず、前後の移動が滑らかな速度になるよう時間位置を自動調整する。

TEGAKIでの用途:

- Motion Path上の複数中間点
- Camera Follow
- 鳥の飛行
- 車
- UI Iconの軌道

初期には不要だが、Advanced Motionで有用。

TEGAKI向け名称:

```text
Auto Timing
Distribute by Distance
```

専門語を前面に出さなくてもよい。

---

# 20. Proportional Scrubbing

After Effects 2026のProportional Scrubbingは、複数Layerの選択Propertyを、選択順などに基づいて比例配分しながら調整する。

TEGAKIでの応用:

- 複数ClipのScaleを段階的に変更
- 群れのRotationを少しずつずらす
- 複数文字のOpacityを段階化
- Onion Opacityを連続的に調整
- Multiple Bone Strength
- Warp Pointの段階移動

候補UI:

```text
Multi Edit
  Same Value
  Add Delta
  Proportional
  Distribute
```

初期は `Same Value` と `Add Delta` だけでよい。

---

# 21. Quick Apply

After Effects 2026はQuick Applyから、Effect、Preset、Menu Commandを検索して即実行できる。

TEGAKIにはCommand Paletteとして採用価値が高い。

```text
Ctrl / Cmd + K

> 空CAFとして分割
> Warpを追加
> Spin Preset
> MotionをBake
> Loop Onion
> Textを追加
> Export WebM
```

対象:

- Command
- Tool
- Preset
- Modifier
- Panel
- Settings
- Recent Action

検索語Aliasを持たせる。

```text
中割り
Inbetween
Blank CAF
```

---

# 22. Text Animator

After EffectsのText Animatorは、Text Layer全体へ単純Transformを適用するだけではない。

Animator Property:

- Position
- Scale
- Rotation
- Opacity
- Fill
- Stroke
- Tracking
- Skew
- Blur
- Variable Font Axis等

Selector:

- Range
- Wiggly
- Expression

Selectorは、文字列のどこへ、どれだけEffectを適用するかを決める。

```text
Animator
  Position Y = 30
  Opacity = 0

Range Selector
  Start 0%
  End 100%
  Offsetを時間変化
```

これで文字を順次登場させられる。

---

# 23. TEGAKI向けTextClip

TEGAKIのText Clipは、通常のRaster CAFとは別Assetとして扱う。

```ts
interface TextClipAsset {
  text: string;
  fontFamily: string;
  fontWeight: number | string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  alignment: string;
  fill: string;
  stroke?: string;
  layoutBounds: Rect;
}
```

Text Motion:

```ts
interface TextAnimator {
  target: "all" | "line" | "word" | "character";
  properties: TextAnimatorProperty[];
  selector: TextSelector;
}
```

初期Selector:

```text
Whole
From Start
From End
Center Out
Random Seed
```

初期Property:

- Position
- Scale
- Rotation
- Opacity
- Tracking
- Fill Color

---

# 24. Text Preset

初期Preset:

```text
Typewriter
Character Fade
Character Rise
Word Reveal
Line Slide
Wave
Shake
Scramble
```

内部構造例:

```text
Character Rise
  target: character
  selector: fromStart
  positionY: 24 → 0
  opacity: 0 → 1
  stagger: 35ms
  easing: easeOut
```

After Effectsの全Selectorを再現しない。

Expression Selectorは後回しにする。

---

# 25. ExpressionsとPick Whip

After EffectsのExpressionはProperty間をコードで連動できる。

Pick Whipはコードを書かず、Propertyを別Propertyへ接続する入口になる。

例:

```text
Layer A Rotation
  ↓
Layer B Rotation

Slider
  ↓
複数LayerのScale

Audio Level
  ↓
Opacity
```

TEGAKIへJavaScript Expressionをそのまま導入するのは危険である。

理由:

- 保存互換
- セキュリティ
- 性能
- 無限参照
- Cycle
- Debug
- ユーザー支援
- Preview／Export一致

代わりに制限付きProperty Linkを導入する。

```text
Driver
  Source Property

Operation
  Copy
  Add
  Multiply
  Invert
  Remap
  Clamp
  Smooth
```

---

# 26. Property Link UI

AEのPick Whipを簡略化する。

```text
Rotation  [Link Icon]
```

Link IconをDragし、別PropertyへDropする。

またはDropdownから選択する。

```text
Driven Property
  Bird_02 > Rotation

Driver
  Bird_01 > Rotation

Operation
  Multiply 0.8
  Add 10°
```

必要な安全策:

- Cycle検出
- Invalid Reference
- Source削除時警告
- Bake Link
- Disable
- Show Dependency
- Maximum Depth

---

# 27. Noise／Wiggle

AEの代表的ExpressionであるWiggleは、Propertyへランダム変動を加える。

TEGAKIではコードではなくModifierとして実装する。

```text
Noise Modifier
  frequency
  amplitude
  seed
  smoothness
  samplingMode
  axes
```

対象:

- Position
- Rotation
- Scale
- Opacity
- Text Character
- Warp Point
- Camera相当

これまで検討した12fps／60fps混在とも接続する。

```text
Noise Sampling
  Continuous
  Stepped 12fps
  Stepped 6fps
  Hold
```

---

# 28. Expression結果のGraph

After EffectsはExpression適用前後のGraphを確認できる。

TEGAKIでもModifierやLink導入後、次を表示できるとよい。

```text
Base Value
Modifier Result
Final Value
```

ただし初期実装では負荷が高い。

後期のAdvanced Graph機能とする。

---

# 29. PrecompositionとNesting

After Effectsでは複数LayerをPrecomposeし、親Composition上では一つのLayerとして扱える。

これは素材再利用、Effect順序、Timeline整理へ使われる。

TEGAKIとの対応:

```text
Precomposition
  ≒ ClipAsset / CAF Group / Playback Group

Nested Composition Layer
  ≒ ClipInstance
```

ただしAEの深いNestingをそのまま導入しない。

推奨:

- 初期は1段
- 最大2～3段
- Cycle検出
- Source編集導線
- Breadcrumb
- Bake
- Dependency表示

---

# 30. Essential Properties

After EffectsのEssential Propertiesは、入れ子Composition内部のPropertyを親側へ公開する。

Source Compositionは同じまま、Instanceごとに値やKeyframeをOverrideできる。

TEGAKIのClipAsset再利用へ非常に有用。

例:

```text
Bird ClipAsset

内部
  CAF 8枚
  Wing Motion
  Body Bob
  Color Modifier

公開Property
  Wing Speed
  Body Bob Amount
  Body Color
  Direction
  Phase
```

Instance側では公開Propertyだけを表示する。

---

# 31. TEGAKIのExposed Property

```ts
interface ExposedProperty {
  id: string;
  sourcePath: string;
  displayName: string;
  type: "number" | "boolean" | "enum" | "color" | "text" | "asset";
  defaultValue: unknown;
  min?: number;
  max?: number;
  step?: number;
  group?: string;
}
```

Instance Override:

```ts
interface InstanceOverride {
  exposedPropertyId: string;
  value: unknown;
  keyframes?: MotionKey[];
}
```

UI:

```text
INSTANCE CONTROLS

Wing Speed       1.2x
Body Bob         35%
Direction        Right
Color            #88CFFF
```

内部Timelineを常時見せない。

---

# 32. Replaceable Media

AEのMotion Graphics Templateでは、画像や動画を置換可能なPropertyとして公開できる。

TEGAKIへの応用:

- ClipAsset内部のキャラクター画像を交換
- 顔差分を交換
- Textを交換
- Logoを交換
- 背景を交換
- AI生成結果を交換

```text
Exposed Asset Slot
  acceptedType
  expectedBounds
  anchor
  alphaRequired
```

別動画ツールとの連携にも有用。

---

# 33. Responsive Design - Time

After EffectsではProtected Regionを設定すると、Composition全体のDurationを変えても、保護されたIntro／Outroの時間を維持し、中間だけ伸縮できる。

```text
Intro   Hold / Loop   Outro
0.3s      可変        0.3s
```

TEGAKIに強く応用できる。

用途:

- Popup
- Title
- Notification
- Loop Character
- Loading
- UI Button
- Scene Transition
- ClipAsset

---

# 34. TEGAKIのProtected Time

```ts
interface ProtectedTimeRegion {
  start: number;
  end: number;
  type: "intro" | "outro" | "protected";
}
```

簡易UI:

```text
[ ENTER ][------- LOOP / HOLD -------][ EXIT ]
```

Clip Durationを伸ばすと:

- ENTER保持
- EXIT保持
- 中央のみ伸縮

中央Mode:

```text
Hold
Loop
Time Stretch
Blank
```

初期はEnter／Hold／Exitだけでも価値がある。

---

# 35. Time StretchとTime Remap

After EffectsはLayer全体の時間Stretchと、任意Keyで再生時刻を変えるTime Remapを持つ。

TEGAKI本体では複雑なTime Remapを急いで入れない。

候補:

```text
Playback Rate
Reverse
Freeze
Loop
Ping-pong
Protected Intro / Outro
```

複雑なSpeed Rampは別動画ツール寄り。

ただし、CAF GroupやAI生成動画GuideにはTime Remapが有用なため、将来の交換形式では表現できるようにする。

---

# 36. Shape Operators

After EffectsのShape Layerは、Pathへ非破壊なOperatorを追加できる。

例:

- Trim Paths
- Repeater
- Offset Paths
- Wiggle Paths
- Wiggle Transform
- Merge Paths
- Round Corners
- Twist

TEGAKIはベクター中心ではないため、そのままの優先度は高くない。

ただし考え方はModifier Chainへ使える。

---

# 37. Repeater

RepeaterはShapeを仮想複製し、各CopyへPosition、Scale、Rotation、Opacity等の段階変化を加える。

TEGAKIへの応用:

```text
Instance Repeater
  count
  positionStep
  rotationStep
  scaleStep
  opacityStart
  opacityEnd
```

用途:

- 鳥の群れ
- 残像
- 回転模様
- UI Dot
- 花弁
- Motion Trail

ClipAssetのInstance生成として実装できる。

---

# 38. RepeaterとNoiseの順序

AEではRepeaterとWiggle Transformの順序により、全Copyが同じ揺れになるか、各Copyが独立して揺れるかが変わる。

これはModifier順序の重要な例である。

```text
Noise → Repeater
  元を揺らしてから複製
  全Copyが同じ変化

Repeater → Noise per Instance
  複製後に個別変化
```

TEGAKIの群れ生成でも同様。

Modifier Chainは順序を明示する。

---

# 39. ParentingとNull Controller

After EffectsはLayer同士をParent／Child化できる。

Null Objectは表示されない制御用Layerとして利用される。

TEGAKIでの候補:

```text
Motion Controller
  表示内容なし
  Transform Trackを持つ
```

用途:

- 複数Clipの共通移動
- Camera Follow
- Pivot Controller
- IK Target
- Group Motion
- UI Layout Motion

ただし、Clip Groupで代替できる場合はNullを増やさない。

初期はGroup Motionを優先し、複雑な制御が必要になった時点でControllerを導入する。

---

# 40. Track MatteとMask

After EffectsのTrack Matteは別LayerのAlphaまたはLuminanceを利用して表示範囲を制御する。

TEGAKI本体での優先度は中以下だが、次には有用。

- Text内へ画像
- Transition
- AI生成キャラクターMask
- Clip Reveal
- Shadow
- 部分Effect

簡易版:

```text
Mask Source
  Current CAF Selection
  External Mask CAF
  Text Shape
```

本格版は別動画ツール側へ置く選択肢が強い。

---

# 41. WorkspacesとPanel配置

After EffectsはPanelをDock、Stack、Tab、Floating化し、Workspaceとして保存できる。

Figmaは固定配置を中心に簡潔さを維持する。

TEGAKIでは中間がよい。

固定Core:

```text
Canvas
Layer / Lane
Inspector
Timeline
```

可変Panel:

```text
Graph
Asset Library
Color
AI
Export
History
```

Workspace Preset:

```text
DRAW
ANIMATE
DEFORM
REVIEW
```

全面的な自由Dockは実装負荷が高い。

初期はPreset Layout + Panel表示切替に留める。

---

# 42. Stacked Panel

AEのStacked PanelはPanelを縦に畳み、一つだけ展開する。

TEGAKIの右Inspectorへ向く。

```text
TRANSFORM
MOTION
MODIFIERS
TEXT
SOURCE
EXPORT
```

Accordion方式にする。

選択対象で必要Sectionを上へ並べ替える。

---

# 43. PresetとAnimation Preset

After EffectsのAnimation Presetは、Keyframe、Effect、Expression等を一つに保存できる。

TEGAKIのPresetは次を含められる。

```text
Motion Key
Easing
Modifier
Property Link
Sampling
Loop
Exposed Property
```

Presetの互換性情報:

- requiredFeatures
- version
- supportedAssetTypes
- expectedBounds
- defaultDuration
- author
- preview

---

# 44. Motion Graphics Templateの示唆

After EffectsのMotion Graphics Templateは複雑なAnimation内部を隠し、必要Propertyだけを編集者へ公開する。

TEGAKIでは、別動画ツールへClipAssetを渡す際の思想として有用。

```text
TEGAKI Motion Package

内部
  CAF
  Motion
  Modifier
  Text
  Asset

公開
  Duration
  Text
  Color
  Speed
  Media Slot
```

---

# Part III: Figma MotionとAfter Effectsの統合案

# 45. 表面UI

表面はFigma Motion型を採用する。

```text
DRAW / ANIMATE / DEFORM

左
  Layer
  Lane
  Asset

中央
  Canvas

右
  Contextual Inspector
  Property横Key Diamond

下
  Timeline
```

---

# 46. 高度UI

高度編集を開いたときだけAE型を表示する。

```text
Graph Editor
Text Animator
Property Link
Essential Controls
Protected Time
Modifier Order
```

通常ユーザーへ常時見せない。

---

# 47. Inspectorの構造

```text
HEADER
  Selected: Bird_01
  Context: INSTANCE
  Source: BirdAsset

TRANSFORM
  Position      ◇
  Scale         ◇
  Rotation      ◆
  Anchor        ◇
  Opacity       ◇

TIMING
  Start
  Duration
  Sampling
  Loop

ANIMATIONS
  Float
  Spin
  + Add

INSTANCE CONTROLS
  Wing Speed
  Color

ADVANCED
  Show in Timeline
  Open Graph
  Edit Source
  Bake
```

---

# 48. Popover／Panel／Modalの責務

## Popover

短い選択:

- Easing
- Preset
- Anchor 9点
- Color
- Blend
- Snap
- Loop Mode
- Sampling Mode

## Inspector Panel

持続的な編集:

- Transform
- Motion
- Text
- Modifier
- Exposed Properties
- Asset情報

## Bottom Panel

時間:

- Timeline
- Graph
- Text Stagger
- Keyframe

## Modal

不可逆または大規模処理:

- Bake
- Export
- Project Resize
- Asset削除
- Migration
- AI Runtime設定

---

# 49. TEGAKI自体のUIアニメーション

Figma Motionの研究を、TEGAKI内で作る作品だけでなく、TEGAKIアプリ自体のUIへ適用できる。

ただし制作ツールのUIは、派手に動かさない。

推奨:

```text
Popover
  100–160ms
  Fade + small scale

Inspector Section
  120–180ms
  Height / opacity

Timeline Expand
  160–220ms
  Canvas位置を急変させない

Modal
  Fade
  過度なBounceなし
```

原則:

- 描画Stroke中はUI Layoutを動かさない
- Reduced Motionを尊重
- Pointer入力中はTransitionを簡略化
- Timeline Scrub時にPanel Animationを止める
- Tool位置をAnimationで移動させない

---

# 50. TextClipの初期仕様

```text
TextClip
  Text
  Font
  Size
  Weight
  Line Height
  Letter Spacing
  Alignment
  Fill
  Stroke
  Shadow
```

Motion:

```text
Layer Motion
  Position
  Scale
  Rotation
  Opacity

Text Animator
  Character / Word / Line
  Stagger
  Position
  Scale
  Rotation
  Opacity
  Tracking
```

最初はCanvas TextをLive編集し、Export時Raster化してもよい。

Font保存・配布・Browser差異は別途設計する。

---

# 51. Motion Assetの初期仕様

```ts
interface MotionAsset {
  id: string;
  name: string;
  duration: number;
  tracks: MotionTrack[];
  modifiers: ModifierConfig[];
  exposedProperties: ExposedProperty[];
  protectedRegions: ProtectedTimeRegion[];
  version: number;
}
```

ClipAssetへ直接統合するか、MotionAssetを別参照にするかは現行モデル監査後に決める。

---

# 52. Property Linkの初期仕様

```ts
interface PropertyLink {
  sourceObjectId: string;
  sourceProperty: string;
  targetObjectId: string;
  targetProperty: string;
  operation: "copy" | "add" | "multiply" | "invert" | "remap";
  amount?: number;
  offset?: number;
  clamp?: [number, number];
}
```

Expression文字列は保存しない。

---

# 53. Protected Timeの初期仕様

```ts
interface ResponsiveTime {
  introFrames: number;
  outroFrames: number;
  middleMode: "hold" | "loop" | "stretch";
}
```

初期UI:

```text
[INTRO][---------MIDDLE---------][OUTRO]
```

---

# 54. Graph Editorの段階仕様

## Level 0

- Easing Preset
- Hold
- Linear

## Level 1

- Cubic Bezier Editor
- Value Graph
- Key選択
- Tangent

## Level 2

- Speed Graph
- Influence
- Split Tangent
- Multiple Property

## Level 3

- Modifier Result
- Driver Result
- Roving Key
- Post Expression相当

---

# 55. Presetの二層構造

## Simple Card

```text
Float
Shake
Pop In
Typewriter
```

## Expanded Structure

```text
Float
  Position Y Oscillation
  Rotation Noise
  Loop
  Ease
```

ユーザーはSimpleだけでも使える。

Codex／開発者はExpanded構造を保存正本として扱う。

---

# 56. 参照ツールの分担

| TEGAKI機能 | 主参考 |
|---|---|
| アプリShell | Figma |
| Contextual Inspector | Figma + AE 2026 |
| Property Key UI | Figma |
| Auto Key警告 | Figma |
| Command Palette | AE Quick Apply + Figma Actions |
| Basic Preset | Figma |
| Deep Preset | AE |
| Value／Speed Graph | AE |
| Text Animator | AE |
| Exposed Property | AE Essential Properties + Figma Component |
| Protected Intro／Outro | AE |
| Property Link | AE Pick Whip |
| Asset Instance | Figma Component + AE Precomp |
| CAF Exposure | Callipeg |
| Onion／Flip | Callipeg |
| Warp／Mesh／Bone | ToonSquid |
| Bake | Callipeg + ToonSquid + AE Pre-render思想 |

---

# Part IV: 導入分類

# 57. 最優先で採用

1. DRAW／ANIMATE／DEFORM
2. Contextual Inspector
3. Property横Key Diamond
4. Auto Key警告
5. InspectorからTimelineへReveal
6. Preset Card
7. Command Palette
8. Quick Set Anchor
9. Timelineの展開／縮小
10. Project共通Timing／Easing Preset

---

# 58. 中期で採用

1. Value Graph
2. TextClip
3. Character／Word／Line Stagger
4. Exposed Property
5. Protected Intro／Outro
6. Deep Preset
7. Property Link
8. Repeater
9. Proportional Multi Edit
10. Motion JSON Export

---

# 59. 長期で採用

1. Speed Graph
2. Roving Key
3. Advanced Text Selector
4. Modifier Result Graph
5. Deep Nesting
6. Replaceable Media Slot
7. Responsive Time複数Region
8. Data-driven Motion
9. Track Matte
10. Workspace保存

---

# 60. 別動画ツールへ置く候補

- 複雑なTime Remap
- Camera
- 3D Layer
- Light
- Track Matteの高度利用
- Appearance Effect Stack
- Motion Graphics Templateの外部編集
- Data-driven Graph
- Audio-driven Motion
- 高度Composite
- Deep Precomposition

---

# 61. 当面見送る

- JavaScript Expressionを直接実行
- AE互換Expression
- AE Project互換
- Figma File互換
- 全Text Animator Property
- 全Shape Operator
- 全Panel Docking
- 無制限Nesting
- UIを常時AE密度にする
- Motion ModeとDRAW正本の統合
- Presetを不透明なBlack Boxとして保存

---

# Part V: 段階的リファクタリング

# 62. Phase FM-AE-0: 監査

コード変更なし。

確認:

- 現行Popup
- Layer Panel
- Animation Table
- Clip Motion
- Transform
- EventBus
- History
- Project Save
- Inspector相当
- Shortcut
- Export
- Asset Library
- Text機能の有無
- Motion Graph提案
- Modifier提案

成果物:

- UI責務Map
- Property一覧
- Keyframe対応候補
- Popup分類
- Timeline表示状態
- Motion正本
- Source／Instance境界
- Conflict一覧

---

# 63. Phase FM-AE-1: UI Shell

- DRAW／ANIMATE／DEFORM
- 右Contextual Inspector
- Timeline表示切替
- Panel Accordion
- Canvas領域維持
- Selected Context表示
- Reduced Motion
- Layout保存

---

# 64. Phase FM-AE-2: Property Key UI

- Diamond
- Current Key状態
- Has Track状態
- Add／Delete Key
- InspectorからReveal
- Previous／Next Key
- Auto Key
- 赤い警告
- History
- Save／Load

---

# 65. Phase FM-AE-3: Preset

- Preset Browser
- Preview
- Enter／Loop／Exit／Text
- Apply as Editable
- Duration Handle
- Timing／Easing Preset
- Versioning
- Import／Export

---

# 66. Phase FM-AE-4: Command Palette

- Command検索
- Preset検索
- Modifier検索
- Tool検索
- Recent
- Alias
- Keyboard
- Context Filter

---

# 67. Phase FM-AE-5: Basic Graph

- Cubic Bezier
- Value Graph
- Hold／Linear
- Fit
- Key選択同期
- Tangent
- Numeric
- Preview／Export一致

---

# 68. Phase FM-AE-6: TextClip

- Text Asset
- Canvas編集
- Font／Size／Layout
- Layer Motion
- Typewriter
- Character Fade
- Character Rise
- Word Reveal
- Stagger
- Raster Export
- Save／Load

---

# 69. Phase FM-AE-7: Exposed Property

- ClipAsset公開Property
- Instance Override
- Inspector表示
- Text／Color／Number／Boolean／Enum
- Keyframe Override
- Make Independent
- Source変更同期
- Migration

---

# 70. Phase FM-AE-8: Protected Time

- Intro
- Middle
- Outro
- Hold／Loop／Stretch
- Duration Drag
- Visual Region
- Bake
- Save／Load

---

# 71. Phase FM-AE-9: Property Link

- Link Icon
- Source選択
- Copy／Add／Multiply
- Cycle検出
- Dependency表示
- Disable
- Bake
- Save／Load

---

# 72. Phase FM-AE-10: Advanced Graph

- Speed Graph
- Influence
- Split Tangent
- Multiple Property
- Roving Key
- Modifier Result
- Driver Result

---

# 73. Phase FM-AE-11: Repeater／Deep Preset

- Repeater
- Per Instance Offset
- Per Instance Noise
- Seed
- Deep Preset
- Exposed Parameter
- Bake to Instances／CAF

---

# Part VI: 受け入れテスト

# 74. UI Shell

- DRAWでは高度Timelineを隠せる
- ANIMATEへ移っても選択を失わない
- DEFORMへ移ってもCAF正本を変更しない
- Inspectorは選択対象に同期
- Canvas描画中にPanelが勝手に開閉しない
- Reduced Motionが有効

---

# 75. Keyframe UI

- Diamond状態が正しい
- Auto Key追加が明示される
- DRAWへ戻るとAuto Keyが安全に扱われる
- Inspector値とTimeline Keyが一致
- Undo一回でDrag一回が戻る
- Save／Load後にTrackが一致

---

# 76. Preset

- Preset適用後に内部Key／Modifierを編集できる
- Duration変更が正しく反映
- Version不一致を検出
- PreviewとExportが一致
- Preset削除で既存Clipが壊れない
- Linked PresetとEditable Copyを区別

---

# 77. Graph

- Value GraphとCanvasが同期
- Hold／Linear／Bezierが正しい
- Easing PresetがCurveへ展開
- Motion Pathと時間Graphが独立
- Speed Graph導入後も旧Projectが再生可能

---

# 78. Text

- Character／Word／Line対象が正しい
- Stagger順が正しい
- RandomはSeedで再現
- Font不在時のFallback
- Export時のLayout一致
- Text編集後にMotionを維持
- CAFへBake可能

---

# 79. Essential Controls

- Source Clipは一つ
- InstanceごとにOverride可能
- Source変更が未Override値へ反映
- Override解除でSource値へ戻る
- Source削除時に警告
- Make Independentが正しい
- Exposed Propertyだけを通常Inspectorへ表示

---

# 80. Responsive Time

- Intro／Outro時間を保持
- Middleだけ伸縮
- Loop境界が正しい
- Durationが短すぎる場合に警告
- Bake結果とPreviewが一致
- Export形式ごとに同じ結果

---

# 81. Property Link

- Link先削除時に安全
- Cycleを拒否
- Copy／Add／Multiplyが正しい
- Sampling Modeが明確
- Preview／Export一致
- Bake後はLinkから独立

---

# Part VII: 非目標

初期Phaseでは次を行わない。

- Figma Motion Clone
- After Effects Clone
- JavaScript Expression Runtime
- 全Panel自由Dock
- 全Graph機能
- 全Text Selector
- AE Project Import
- Figma File Import
- 3D／Camera／Light
- 高度Track Matte
- Motion Graphics Template完全互換
- Data-driven Motion
- Deep Nesting
- CAF TimelineのFigma化
- OnionのAE化
- Warp／Boneの本書内同時実装

---

# Part VIII: Codex／GPTへの作業指針

この文書を読んだAIは、UI名やAfter Effectsの機能名だけを見て実装を開始しないこと。

実装前に確認する。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 現行Phase指示書
5. `animation-system.js`
6. `data-models.js`
7. `timeline-ui.js`
8. Motion Graph関連資料
9. `layer-transform.js`
10. `history.js`
11. `event-bus.js`
12. Project Save／Load
13. Export
14. Popup／Panel管理
15. Keyboard Shortcut
16. Asset／Album
17. Text描画経路

提案時に明記する。

- 保存正本
- Inspector一時State
- Keyframe Track所有者
- ClipAsset／ClipInstance
- Presetの展開方式
- Auto KeyのHistory
- Graph Sampler
- Exposed PropertyのOverride
- Protected Time評価
- Property Link依存Graph
- Cycle検出
- Preview／Export／Bake共通Sampler
- Versioning
- Migration
- Cache
- Rollback
- 対象外ファイル
- 現行Phaseとの衝突

本文中のInterface名、Phase名、Property名は概念例であり、既存実装を検索してから命名すること。

---

# Part IX: 未決事項

1. DRAW／ANIMATE／DEFORMを上部Tab、Tool、Workspaceのどれにするか。
2. Inspectorを常設するか、選択時だけ開くか。
3. Property Key Diamondを既存UIへどう追加するか。
4. Auto KeyをMode変更時に自動OFFするか。
5. PresetをKey／Modifierへ完全展開するか、参照を残すか。
6. Timing／Easing VariableをProject共通にするか。
7. MotionAssetをClipAsset内部へ持つか別Assetにするか。
8. TextClipの正本をDOM Text、Canvas Raster、Vector Pathのどれにするか。
9. FontをProjectへ埋め込まずどう再現するか。
10. Character Staggerを出力FPSへどう量子化するか。
11. Value GraphとSpeed Graphを同じPanelへ置くか。
12. Exposed PropertyのKeyframe Overrideを許可するか。
13. Protected Regionを複数許可するか。
14. MiddleのStretchをCAFへ適用するか。
15. Property Linkの許可Propertyをどこまで広げるか。
16. Repeaterを仮想Instanceにするか実体展開するか。
17. Quick Applyと既存Shortcut Helpを統合するか。
18. UI Popup AnimationのDurationを設定可能にするか。
19. Motion JSONを公開仕様にするか。
20. CSS／Web Animations API ExportをTEGAKI本体に置くか別動画ツールへ置くか。
21. AE型Workspace保存を導入するか。
22. Advanced Motionを通常ユーザーへどこまで見せるか。

---

# 82. 最終提案

Figma Motionから学ぶべき中心:

```text
分かりやすいMode
Contextual Inspector
Property横Keyframe
Auto Key警告
Preset
Animated Component
Motion Variable
Handoff
```

After Effectsから学ぶべき中心:

```text
Value / Speed Graph
Text Animator
Expressionの考え方
Precomposition
Essential Properties
Protected Time
Shape Operator
Deep Preset
Quick Apply
Proportional Scrubbing
```

TEGAKIへ採用する最も安全な順序:

```text
1. UI Shell
2. Contextual Inspector
3. Property Key
4. Auto Key
5. Preset
6. Command Palette
7. Basic Graph
8. TextClip
9. Exposed Property
10. Protected Time
11. Property Link
12. Advanced Graph
13. Repeater
```

最終的な設計原則:

> 表面はFigma Motionのように入りやすくし、深部はAfter Effectsの成熟したMotion編集を縮約して用意する。  
> ただし、作画時間はCallipeg、変形はToonSquid 2、保存正本はTEGAKIのCAF構造を維持する。

---

# 参考URL

## Figma公式

- Explore Figma Motion  
  https://help.figma.com/hc/en-us/articles/41274629073303-Explore-Figma-Motion
- Add, select, and delete keyframes  
  https://help.figma.com/hc/en-us/articles/41307938657559-Add-select-and-delete-keyframes
- Quickly add motion with preset animations  
  https://help.figma.com/hc/en-us/articles/41307886266135-Quickly-add-motion-with-preset-animations
- Create and use animated components  
  https://help.figma.com/hc/en-us/articles/41307940738967-Create-and-use-animated-components
- Apply variables to designs  
  https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs
- Export animations from Figma  
  https://help.figma.com/hc/en-us/articles/41307983648407-Export-animations-from-Figma
- What's new from Config 2026  
  https://help.figma.com/hc/en-us/articles/39582753756695-What-s-new-from-Config-2026

## Adobe After Effects公式

- Properties Panel  
  https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animate-using-the-properties-panel/properties-panel.html
- Animation basics  
  https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-basics/animation-basics.html
- Keyframe interpolation  
  https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-keyframes/keyframe-interpolation.html
- Control speed between keyframes  
  https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/speed-between-keyframes/speed.html
- Editing, moving, and copying keyframes  
  https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-keyframes/editing-moving-copying-keyframes.html
- Text animation  
  https://helpx.adobe.com/after-effects/desktop/animating-text/text-animation/animating-text.html
- Expression basics  
  https://helpx.adobe.com/after-effects/desktop/work-with-expressions/expression-basics/expression-basics.html
- Expression examples  
  https://helpx.adobe.com/after-effects/desktop/work-with-expressions/expression-examples/expression-examples.html
- Precomposing and nesting  
  https://helpx.adobe.com/after-effects/desktop/work-with-compositions/precomposing-and-nesting/precomposing-nesting-pre-rendering.html
- Essential Properties  
  https://helpx.adobe.com/after-effects/desktop/motion-graphics/essential-properties/essential-properties.html
- Responsive Design - Time  
  https://helpx.adobe.com/after-effects/desktop/motion-graphics/add-responsive-design/responsive-design.html
- Shape attributes and path operations  
  https://helpx.adobe.com/after-effects/desktop/drawing-painting-and-paths/shapes-and-shape-attributes/shape-attributes-paint-operations-path.html
- Time stretching and time remapping  
  https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/time-stretching-and-time-remapping/time-stretching-time-remapping.html
- Proportional Scrubbing  
  https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-keyframes/proportional-scrubbing-in-timeline.html
- Quick Apply  
  https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-keyframes/quick-apply.html
- Workspaces, panels, and viewers  
  https://helpx.adobe.com/after-effects/desktop/get-started/get-familiar-with-the-interface/workspaces-panels-viewers.html
- What's new in After Effects  
  https://helpx.adobe.com/after-effects/desktop/what-s-new/whats-new.html
