# TEGAKI × Callipeg
## コマ作画・露出・Onion・中割り支援UIの分析と段階導入計画

- 文書種別: 外部ツール分析／UI・機能リファレンス／将来設計メモ
- 主な読者: TEGAKIを調査・設計・実装するCodex／GPT、および開発者
- 対象: CallipegのSheet型コマアニメ、Timeline、露出編集、Onion Skin、Out of Pegs、Inbetween Assist、Linked Sheets、Cycles、Transformation Layer、選択・Gesture UI
- 軽く扱う対象: Color Picker、Floating Menu、Brush周辺、Import／Export
- 対象外: ToonSquid 2のBone、Mesh、Warp、Symbol等の詳細。これらは `TEGAKI_ToonSquid2_feature_UI_reference.md` を参照する
- 注意: 本文書は実装契約ではない。実装前に必ず現行の `AGENTS.md`、`TEGAKI.md`、`tegaki_work/PROGRESS.md`、現行Phase指示書、関連コードを確認すること
- 作成意図: Callipegの外観を模倣するのではなく、伝統的なコマ作画を中心に据えた操作契約をTEGAKIへ翻訳する

---

## 1. 結論

Callipegは、TEGAKI本体側のアニメーション設計において、非常に参考価値が高い。

ToonSquid 2が、

```text
素材
  +
Layer Property
  +
Transform
  +
Effect
  +
Bone / Mesh
  +
Symbol
```

を時間軸上で演出する方向に強いのに対し、Callipegは、

```text
一枚の絵
  ↓
SheetとしてTimelineへ置く
  ↓
露出時間を決める
  ↓
前後の絵をめくる
  ↓
Onionを調整する
  ↓
中割りを描く
```

という伝統的な作画工程をUIの中心に置いている。

この出発点はTEGAKIと近い。

Callipegから特に強く導入価値があるのは、次の機能・設計である。

1. **Sheet／CAFを作画単位として扱うTimeline**
2. **露出変更時のPush／Lock／Magnet**
3. **選択時だけ現れるContextual Action Panel**
4. **Timelineの非表示・通常・拡張という段階的表示**
5. **Frame、Sheet、Markerを選べるFlip**
6. **前後8枚を個別制御するOnion Skin Bar**
7. **Onionだけを一時移動するOut of Pegs**
8. **対応点から中割り位置・拡縮・回転・Arcを求めるInbetween Assist**
9. **内容を共有するLinked Sheets**
10. **Linked Sheetsを利用したLoop／Ping-pong／Random Cycle**
11. **Drawingと演算Transformを分けるTransformation Layer**
12. **非破壊Transformを新しいDrawingへFlattenする出口**
13. **ペン、指、Mouse／Keyboardの責務分離**
14. **Canvas集中時に必要機能だけを出すFloating Menu**
15. **Markers、IN／OUT、作画区間管理**

ただし、CallipegのGestureとIconをそのままコピーするべきではない。

Callipegはタブレット上でCanvas面積を最大化するために、次へ強く依存している。

- 指の本数
- Long Touch
- Double Tap
- Swipe方向
- Apple Pencilと指の区別
- 小さなIcon
- 現在Modeの記憶

TEGAKIはブラウザ、Mouse、Pen Tablet、Touchを含むため、同じ操作を次へ翻訳する必要がある。

```text
Visible Button
  +
Tooltip
  +
Keyboard Shortcut
  +
Right-click Menu
  +
Touch Gesture
```

推奨する最終像は次である。

```text
TEGAKIのCAF／整数Frame正本
    +
Callipeg型の作画Timeline操作
    +
Onion／Inbetween支援
    +
限定されたClip Motion
    +
必要ならBake
```

---

## 2. 本文書の情報源

本分析では、Callipeg公式の機能説明を中心に確認した。

主な資料:

- Introduction
- Features
- Interface
- Timeline
- Gestures on the Timeline
- Gestures on the Canvas
- Flip
- Drawing Layer
- Onion Skin
- Out of Pegs
- Inbetween Assist
- Linked Sheets
- Cycles
- Transformation Layer
- Selection
- Transformation
- Group Layer
- Markers
- Colors
- Floating Menu
- Import／Export関連資料

Callipeg公式ドキュメントでは、Callipegを伝統的な手描きアニメーションの基礎に着想を得た2Dアニメーションアプリとして説明している。

公式サイトは2026年時点で、問い合わせ対象OSとしてiOS、iPadOS、Android、Windows、macOSを列挙している。

ただし、操作説明の多くはApple PencilとTouchを中心に記述されているため、TEGAKIへの採用時にはDesktop向け再設計が必要である。

---

## 3. 総合評価

| 項目 | Callipegの完成度 | TEGAKI適合度 | 導入優先度 |
|---|---:|---:|---:|
| Sheet型Timeline | 9.5 / 10 | 10 / 10 | 最優先 |
| 露出編集 | 9.5 / 10 | 10 / 10 | 最優先 |
| Contextual Action Panel | 9.0 / 10 | 9.5 / 10 | 最優先 |
| Flip操作 | 9.0 / 10 | 9.5 / 10 | 高 |
| Onion Skin Bar | 9.5 / 10 | 9.5 / 10 | 高 |
| Out of Pegs | 9.0 / 10 | 9.0 / 10 | 高 |
| Inbetween Assist | 9.5 / 10 | 10 / 10 | 高 |
| Linked Sheets | 9.0 / 10 | 9.0 / 10 | 高 |
| Cycles | 9.0 / 10 | 9.0 / 10 | 高 |
| Transformation Layer | 8.5 / 10 | 8.5 / 10 | 中高 |
| Markers／IN／OUT | 8.5 / 10 | 8.5 / 10 | 中 |
| Gesture設計 | 9.0 / 10 | 6.5 / 10 | 翻訳必須 |
| Color／Floating UI | 8.5 / 10 | 8.0 / 10 | 付録 |
| Timeline情報密度 | 8.0 / 10 | 7.0 / 10 | 段階表示必須 |
| TEGAKI全体への参考価値 | — | 9.5 / 10 | 非常に高い |

---

# Part I: Callipegの基本思想

## 4. Sheetが中心である

CallipegのDrawing LayerにはSheetが並ぶ。

一つのSheetには一枚のDrawingがあり、Sheetは一つ以上のFrameを占有できる。

```text
Drawing Layer
  ├ Sheet A: Frame 1–3
  ├ Sheet B: Frame 4–5
  ├ Sheet C: Frame 6
  └ Sheet D: Frame 7–12
```

Sheetを伸ばすことは、絵を補間することではない。

同じ絵を表示する露出時間を増やすことである。

この考え方は、TEGAKIのCAFと非常に近い。

### TEGAKIへの対応

```text
Callipeg Sheet
  ≒ TEGAKI CAFを参照するClipInstance

Sheet Drawing
  ≒ ClipAsset / DrawingSnapshot

Sheet Duration
  ≒ ClipInstanceの整数Frame露出

Drawing Layer
  ≒ Lane
```

完全に同じではない。

TEGAKIでは、CAF内部に複数Layerを持つ可能性があり、ClipAssetとInstanceを分けている。

しかしUI上の作画単位としては、SheetをCAFカードまたはCAF Clipへ翻訳できる。

---

## 5. 作画と時間編集が同じ場所にある

Callipegでは、TimelineをDouble Tapするか、その場所で描き始めることでSheetを作れる。

新しいSheetの標準露出長も設定できる。

これは次の操作を一続きにする。

```text
このFrameで新しい絵を描きたい
  ↓
TimelineへSheetを作る
  ↓
そのままCanvasで描く
```

動画編集型Timelineのように、

```text
素材をImport
  ↓
Clipを配置
  ↓
編集
```

という順序を要求しない。

TEGAKIでは、この「描いた瞬間に時間軸へ存在する」感覚を維持するべきである。

---

## 6. Timelineを閉じてもFlipできる

CallipegのTimelineは画面下部にあり、高さ方向へ拡張できる。

完全に隠すこともできる。

Timelineを閉じると、Flip用の簡易Rulerが表示される。

この設計は、

```text
作画集中
  Timelineを隠す
  ただし前後確認は失わない

時間編集
  Timelineを開く
  Sheet露出を操作

詳細編集
  Timelineを大きくする
  複数Layerを操作
```

という段階を作る。

TEGAKIでは次の三状態が適している。

```text
Collapsed
  Canvas最大
  前後CAF
  Flip
  再生
  現在Frame／CAF名

Normal
  Lane
  CAF露出
  基本選択
  簡易Motion Badge

Expanded
  複数Lane
  Motion Track
  Curve
  Markers
  Group編集
```

この三状態は、Animation TableをPopupにするか常設するかという二択を避けられる。

---

# Part II: Timelineと露出編集

## 7. Frame表示と時間表示

CallipegではTimeline上部をFrame番号または時間表示にでき、Frame 0または1から数える設定も持つ。

TEGAKIでも内部正本は整数Frameでよいが、表示を選択可能にできる。

```text
Display Metric
  Frame
  Timecode
  Seconds
```

内部データを表示形式へ従属させない。

---

## 8. Thumbnail表示と性能

Callipegでは、一定解像度以下のShotでTimeline Thumbnailを表示でき、性能確保のため無効化できる。

TEGAKIでもThumbnailは便利だが、次を明示するべきである。

- Thumbnail ON／OFF
- Thumbnail Quality
- Selected only
- Current Lane only
- Idle時更新
- Cache容量
- 高負荷時の自動簡略化

Thumbnail生成が作画やScrubを阻害しないようにする。

---

## 9. 露出長の編集

Sheetを選択すると左右Handleが表示され、DragでSheet Durationを変更できる。

Callipegの優れた点は、単にClipを伸ばせることではなく、隣接Sheetや空白をどう扱うかをModeとして明示していることにある。

---

## 10. Push NeighborsとLock Neighbors

### Push Neighbors

Sheetを伸ばすと、後続Sheetを押し出す。

```text
Before
[A A][B B][C]

Aを2Frame伸ばす

After
[A A A A][B B][C]
```

### Lock Neighbors

後続Sheetの位置を固定する。

Sheetを伸ばした結果、空白を埋めるか、隣接Sheetとの境界で止めるか等の規則が必要になる。

```text
Before
[A A][B B][C]

Bの開始位置は固定
Aを伸ばす
  → 空白処理または上限処理
```

### TEGAKIへの名称案

```text
Ripple
  後続CAFを押し出す

Overwrite / Fixed
  後続CAFを固定する
```

ただし「Overwrite」は既存Drawingを破壊する印象がある。

TEGAKIでは次が分かりやすい。

```text
PUSH
LOCK
```

または、

```text
Ripple Edit
Fixed Edit
```

---

## 11. Magnetと空白処理

CallipegのMagnetは、Sheet同士だけでなく空白の挙動を変える。

- Magnet ONでSheetを伸ばすと、空白も押し出される
- Magnet OFFでSheetを伸ばすと、空白が埋められる
- Long Touchで空白除去や空白埋めを行える

これは、Timeline上の「何もない時間」を明確な編集対象として扱っている。

TEGAKIでは、空白を次のどちらとして扱うかを明示する必要がある。

```text
Empty Time
  何も表示しない

Previous Hold
  前CAFを表示し続ける
```

Callipeg型のSheet Timelineでは、空白は実際の空白として見える。

TEGAKIでCAF間を自動Holdする場合、見た目上の空白と再生結果が一致しなくなる可能性がある。

したがって、次を分ける。

```text
Clip Duration
  CAFが表示される範囲

Gap
  何も表示されない範囲
```

Gapを自動的に前CAF Holdへ変換しないほうが、Timelineの意味が明確になる。

---

## 12. 空白除去と空白埋め

CallipegのLong Touch操作はGesture依存だが、機能自体は有用である。

TEGAKIではContext MenuまたはAction Barへ置く。

```text
Close Gaps
  選択範囲の空白を詰める

Fill Gaps by Extending
  前後CAFの露出を伸ばして空白を埋める
```

この二つは同じ結果ではない。

```text
Close Gaps
  後続CAFの開始時刻が変わる

Fill Gaps
  後続CAFの開始時刻は変わらず、
  前CAFのDurationが増える
```

Undo上も別Commandとする。

---

## 13. Splitの二種類

Callipegでは、Drawing Sheet上をPencilで下方向へSliceすると、後半Sheetにも内容を残す。

上方向へSliceすると、後半を空Sheetにする。

これは非常に作画的な機能である。

### 内容を残すSplit

```text
[A A A A]
    ↓
[A A][A A]
```

同じ絵を二つの露出単位へ分ける。

### 空Sheetを作るSplit

```text
[A A A A]
    ↓
[A A][Blank Blank]
```

後半を中割りまたは次Drawingの作画場所にする。

### TEGAKIへの翻訳

Gestureはそのまま使わず、Actionを明示する。

```text
Split with Copy
Split with Blank
```

日本語UIなら、

```text
内容を残して分割
空CAFとして分割
```

Shortcutsも用意できる。

---

## 14. Contextual Action Panel

CallipegではSheetを選択するとAction Panelが現れる。

複数Sheet選択時には、選択に適した機能だけを表示する。

この設計はTEGAKIのUI密度を抑えるうえで重要である。

### 何も選択していない

- Play
- Add CAF
- Timeline表示
- Onion
- Marker
- Settings

### 単一CAF選択

- Duration
- Split
- Duplicate
- Linked Duplicate
- Delete
- Blank After
- Transform
- Properties

### 複数CAF選択

- Move
- Duplicate
- Linked Duplicate
- Cycle
- Reverse Order
- Group
- Delete
- Close Gaps
- Retime

### Cycle選択

- Loop
- Ping-pong
- Random
- Edit Source Timing
- Break Cycle
- Unlink

### Transformation選択

- Keyframe
- Previous／Next Key
- Curve
- Reset
- Flatten／Bake

常設Toolbarへ全機能を置かない。

---

## 15. 選択状態の可視化

Callipegでは選択中にTimeline上部のBarが色変化し、Linked Sheetは紫、Out of Pegs変更済みPegは橙等で識別される。

TEGAKIでも状態を見分ける必要がある。

ただし色だけに依存しない。

```text
Selected
  枠 + 背景 + Icon

Linked
  Chain Icon + Link番号

Cycle
  Repeat Icon + 範囲線

Motion
  Diamond Badge

Subframe Motion
  Wave / Smooth Badge

Out of Pegs
  Offset Icon

Source Editing
  SOURCE表示

Instance Editing
  INSTANCE表示
```

---

## 16. 複数選択

CallipegではDouble Tap後のDragで複数Sheetを複数Layerにわたり選択できる。

TEGAKIのDesktop UIでは次を併用する。

- Shift Click
- Ctrl／Cmd Click
- Marquee
- Timeline Drag Select
- Touch Double Tap + Drag
- Select All in Lane
- Select Range

選択モデルは、後のGroup、Cycle、Transform、Batch操作の基盤となる。

---

# Part III: FlipとScrub

## 17. Flipは単なるScrubではない

Callipegは、作画確認のための「めくり」を独立概念として扱う。

Flip対象を次から選べる。

- Frames
- Sheets
- Markers

### Frames

すべてのFrameを通る。

露出中は同じDrawingを繰り返し表示する。

### Sheets

Drawingが変わる位置だけを移動する。

作画比較に向く。

### Markers

重要Poseや区間だけを移動する。

### TEGAKIへの適用

```text
Flip Mode
  Frame
  CAF
  Marker
  Key Pose
```

TEGAKIでは通常のPlayback、Timeline Scrub、Flipを分離するべきである。

```text
Playback
  時間通りに再生

Scrub
  任意時間へ移動

Flip
  作画比較に適した単位で前後移動
```

---

## 18. Timelineを閉じてもFlipを残す

Collapsed状態では、Canvas横または下部へ小さなFlip Rulerを表示する。

必要要素:

- 前CAF
- 次CAF
- Current CAF番号
- Frame番号
- Marker表示
- Drag感度
- Flip Mode
- Loop区間

QuickToolPresetやColor UIと干渉しない配置が必要。

---

## 19. Pointer Typeの責務

CallipegではApple PencilのSingle TapでFrame移動できるが、指のSingle TapではPalm誤操作を避けるためFrameを変えない。

TEGAKIでは入力環境が多い。

推奨する初期契約:

### Pen

- Canvas: 描画
- Timeline Tap: Frame／CAF選択
- Timeline Drag: Scrub
- Pen Button: Eraser／Pan等を設定可能

### Mouse

- Left Click: 選択
- Drag: 操作
- Wheel: Zoom／Scroll
- Right Click: Context Menu
- Middle Drag／Space Drag: Pan

### Touch

- One Finger: UI操作またはFlip
- Two Fingers: Pan／Zoom
- Long Touch: Context Menu
- Palm rejectionはBrowser／OS能力に依存

### Keyboard

- Left／Right: Frame移動
- Shift + Left／Right: CAF移動
- Marker移動Shortcut
- Split
- Duplicate
- Blank
- Onion
- Play

ユーザーが入力Profileを変更できるとよい。

---

# Part IV: Onion Skin

## 20. Onion Skin Bar

CallipegのOnion Skin Barは、現在Frameを中心に前後のPegを並べる。

最大で前8枚、後8枚を個別に有効化できる。

各Pegには、

- ON／OFF
- Opacity
- 相対位置
- Sheetの有無
- Out of Pegs状態

が視覚化される。

これはSettings Popupで数値を変更するより、作画中の直接性が高い。

### TEGAKIへの基本構造

```text
[-8][-7][-6][-5][-4][-3][-2][-1] [NOW] [+1][+2][+3][+4][+5][+6][+7][+8]
```

各Cell:

- Enabled
- Opacity
- Source CAF
- Empty
- Offset Modified
- Color
- Front／Back

---

## 21. 距離ごとのOpacity

CallipegではPegをLong Touchして上下Dragすると、個別Opacityを変更できる。

Lockにより前側または後側の複数Opacityを一括変更できる。

TEGAKIでは、Gestureだけでなく次を用意する。

- Mouse Wheel over Peg
- Drag Slider
- Numeric Popup
- Linear Falloff
- Custom Falloff
- Link Previous
- Link Next

Preset例:

```text
Near Focus
  -1: 60%
  -2: 30%
  -3: 15%

Wide
  -1: 50%
  -2: 40%
  -3: 30%
  -4: 20%
```

---

## 22. Previous／Next Color

Callipegでは前後のOnion色をColor Wheelで変更できる。

TEGAKIでも、

- Previous Color
- Next Color
- Original Color
- Monochrome Tint
- Alpha only
- Blend Mode

を選択可能にする。

一方、色付き原画でTintすると見にくい場合がある。

次を用意できる。

```text
Tint Mode
Original Color
Luminance Tint
Alpha Outline
Difference
```

初期はTintとOriginalだけでもよい。

---

## 23. Front／Back Render Position

CallipegではOnionを現在Drawingの前または後へ描画できる。

TEGAKIでも有用である。

```text
Back
  Onion → Current Drawing

Front
  Current Drawing → Onion
```

通常はBackだが、線の重なり確認ではFrontが有効な場合がある。

Layer単位ではなく、Onion全体の設定から始めてよい。

---

## 24. Dynamic／Static Onion Bar

### Dynamic

現在位置に追従し、相対PegがTimeline上を移動する。

### Static

現在位置を中央に固定し、前後8Pegを常に同じ場所へ表示する。

Static Modeでは空Sheet位置も把握しやすい。

TEGAKIでは、Animation Tableの表示状態に応じて自動切替してもよい。

```text
Collapsed
  Static Compact

Normal
  Dynamic

Expanded
  Timeline統合表示
```

ただし自動切替はユーザーが予測できるようにする。

---

## 25. Scrub中のOnion

CallipegではScrub中にOnionを表示するか無効化するか設定できる。

TEGAKIでも性能と視認性のため必要。

```text
Onion During Scrub
  Off
  Nearest only
  Full
```

低性能環境ではNearest onlyが有効。

---

## 26. Loop Onion

Callipegの中心機能ではないが、TEGAKIのCycle機能にはLoop境界のOnionが重要である。

```text
Cycle末尾
  次としてCycle先頭を表示

Cycle先頭
  前としてCycle末尾を表示
```

これは歩行、羽ばたき、回転等の繋がり確認に有効。

Callipeg型のCycleとOnion Barを組み合わせて導入する価値が高い。

---

# Part V: Out of Pegs

## 27. 機能の意味

Out of Pegsは、前後のOnion DrawingだけをCanvas上で一時移動する機能である。

これは作画正本を変形する機能ではない。

目的は、

```text
位置が大きく移動した前後Pose
  ↓
比較しにくい
  ↓
Onionだけを重ねやすい場所へ移動
  ↓
形状差を確認して中割りを描く
```

ことである。

伝統的な紙アニメで、作画用紙をPegから外して位置をずらす行為に相当する。

---

## 28. Callipegの挙動

- Onion Skin Barから対象Pegを選ぶ
- 複数Pegを同時編集できる
- 変更済みPegは色で示される
- 変更は対応Sheetに関連づく
- 機能全体をON／OFFできる
- Reset Allできる
- Visible on Current Frame設定がある

---

## 29. TEGAKIへのデータ案

Out of PegsはDrawing正本に混ぜない。

候補:

```ts
interface OnionAdjustment {
  sourceAssetId: string;
  sourceDrawingFrame: number;
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  visibleWhenCurrent: boolean;
}
```

ただし「対応Sheetに関連づく」だけでは、同じSheetを複数箇所で参照した場合の意味が曖昧になる。

TEGAKIでは次のどちらかを選ぶ。

### Assetに関連づける

同じDrawingを使うすべてのInstanceで共通。

### Instanceに関連づける

Timeline上の配置ごとに異なる。

作画補助としてはInstance単位のほうが安全である。

```text
OnionAdjustment
  clipInstanceId
  sourceFrame
```

---

## 30. TEGAKI向け名称

「Out of Pegs」は伝統用語として意味があるが、一般ユーザーには分かりにくい。

候補:

- Onion Adjust
- Onion Offset
- Shift & Trace
- Onion位置合わせ
- 前後絵位置合わせ

UI上は、

```text
ONION ADJUST
```

とし、TooltipでOut of Pegs相当と説明してもよい。

---

## 31. 操作範囲

最小仕様:

- Position
- Reset
- Multiple Peg Select

拡張:

- Scale
- Rotation
- Flip
- Copy Adjustment
- Mirror Adjustment
- Previous／Next一括
- Save as Guide Preset

正本へBakeする必要はない。

ただし、Onion位置合わせを作画内容へ適用したい場合は、別Commandとして、

```text
Apply Onion Adjustment to Current CAF
```

を用意する可能性がある。

初期は見送る。

---

# Part VI: Inbetween Assist

## 32. なぜ重要か

Inbetween Assistは、Callipegの中でもTEGAKIへ特に相性がよい。

これは生成AIでも、画像Morphでもない。

前後のDrawing上へ対応点を置き、その関係から中間位置を計算し、Onion画像を作画しやすい位置へ自動配置する。

作画の主導権はユーザーに残る。

---

## 33. 1点モード

前後のOnionそれぞれに一点を置き、中割り上のDestinationを指定する。

この情報から主に平行移動を求める。

例:

```text
前Frameの手首
後Frameの手首
中割りで置きたい手首位置
```

Onion画像全体を、その点がDestinationへ一致するように配置できる。

---

## 34. 2点モード

前後のOnionそれぞれへ二点を置く。

二点間の関係から、

- Position
- Scale
- Rotation

を求められる。

例:

```text
肩
手首
```

を前後Frameで指定する。

中割り側でも二点を指定すると、腕の位置、長さ、角度へ合わせてOnionを配置できる。

---

## 35. Arc編集

Inbetween AssistのEdit Modeでは、直線補間だけでなくArcを設定できる。

矢印をDragしてArcの曲がりを調整する。

これは手や頭等が円弧運動する場合に重要である。

```text
直線補間
  A -------- B

Arc
      •
   /     \
  A       B
```

中割りは単純な座標平均ではない。

運動の軌跡を人間が指定できることが重要である。

---

## 36. Fraction Snap

CallipegではMagnetにより次へSnapできる。

- 1/2
- 1/3
- 1/4
- 2/3
- 3/4

これは均等中割りだけでなく、偏ったタイミングの作画ガイドに使える。

TEGAKIでは次を追加できる。

```text
1/2
1/3
2/3
1/4
2/4
3/4
Custom
```

Custom値はEasing Curveから取得することも考えられる。

---

## 37. TEGAKIへの実装案

```ts
interface InbetweenGuide {
  beforeClipId: string;
  afterClipId: string;
  mode: "onePoint" | "twoPoint";
  beforePoints: Point[];
  afterPoints: Point[];
  targetPoints: Point[];
  fraction: number;
  arc: {
    enabled: boolean;
    controlA?: Point;
    controlB?: Point;
  };
}
```

出力は新しいDrawingではなく、Display-only Transformである。

```text
Before Onion Transform
After Onion Transform
Guide Point
Motion Arc
```

ユーザーはその上へ現在CAFを描く。

---

## 38. Inbetween AssistとAI

将来AI中割りを使う場合も、Inbetween Assistは不要にならない。

対応点とArcはAIへのControl情報としても利用できる。

```text
Inbetween Guide
  ↓
Pose / Point Constraint
  ↓
AI生成候補
```

また、AI出力をガイドとして使う場合、対応点を使って位置合わせできる。

したがってInbetween Assistは、

- 手描き中割り
- 演算補助
- AI補助

の共通基盤になり得る。

---

## 39. 導入優先度

非常に高い。

BoneやMeshより実装範囲が小さく、TEGAKIの作画思想に直接貢献する。

推奨順:

```text
1. 1点Translation Guide
2. Fraction Snap
3. 2点Scale／Rotation Guide
4. Arc
5. Multiple Onion
6. Easing連携
7. AI Control連携
```

---

# Part VII: Linked SheetsとCycles

## 40. Linked Sheets

Linked Sheetsは同じPixel内容を共有するCloneである。

どれかを編集すると、関連するすべてのLinked Sheetへ反映される。

Callipegでは、

- Timeline上で紫表示
- Linked SheetであることをBottom Barへ表示
- 対応番号表示
- Link解除

を備える。

---

## 41. TEGAKIへの対応

TEGAKIでは、ClipAssetとClipInstanceの参照関係がLinked Sheetに近い。

```text
ClipAsset
  DrawingSnapshotの正本

ClipInstance A
  assetId = X

ClipInstance B
  assetId = X
```

両Instanceは同じAssetを参照する。

Source Assetを編集すると、両方へ反映される。

### 独立複製

```text
Duplicate Independent
  新しいClipAssetを作る

Duplicate Linked
  同じClipAssetを参照するInstanceを作る
```

UIで必ず区別する。

---

## 42. SourceとInstanceの編集

Linked Sheet型機能を入れると、ユーザーが何を編集しているか分からなくなる危険がある。

TEGAKIでは次を表示する。

```text
EDIT SOURCE
  参照する全Instanceへ反映

EDIT INSTANCE
  Timing／Transformのみ変更

MAKE INDEPENDENT
  新しいAssetへ分離
```

Pixel編集は原則Source編集である。

Instance固有のPixel Overrideは初期には作らないほうがよい。

---

## 43. Cycles

Callipegでは、選択Sheet列からCycleを作る。

Cycleを伸ばすと、元Sheet列がLinked Sheetとして反復される。

Cycle Type:

- Loop
- Ping-pong
- Random

CycleをBreakしても、繰り返されたSheetのLinkは残る。

Cycleの元Timingを編集できる。

---

## 44. TEGAKI向けCycleモデル

```ts
interface DrawingCycle {
  sourceClipIds: string[];
  mode: "loop" | "pingPong" | "random";
  durationFrames: number;
  randomSeed?: number;
}
```

ただし、Timeline上へ繰り返しInstanceを実体展開する方式と、Runtimeで仮想評価する方式がある。

### 実体展開

利点:

- Timeline上で分かりやすい
- 各Instanceを選べる
- 既存モデルへ近い

欠点:

- Instance数が増える
- Cycle変更時の同期が複雑

### 仮想Cycle

利点:

- データが軽い
- Cycle編集が簡単
- Duration変更に強い

欠点:

- Timeline表示が特別になる
- Bakeや個別編集が必要

推奨:

初期はCallipegに近い実体展開でもよいが、長期的にはCycleInstanceとして保持し、UI上だけ繰返しを表示する方法がよい。

---

## 45. Random Cycle

Randomは面白いが、再現可能性が必要。

必ずSeedを保存する。

```text
mode: random
seed: 12345
```

Frameごとに毎回乱数を引くのではなく、Cycle生成時またはSampler上で決定的に評価する。

---

## 46. Cycle編集UI

必要な操作:

- Create Cycle
- Loop
- Ping-pong
- Random
- Edit Source Timing
- Change Duration
- Break Cycle
- Unlink
- Make Independent
- Bake
- Loop Onion

CycleのSource領域とRepeat領域を視覚的に分ける。

CallipegのWhite Dash相当として、TEGAKIでは次を使える。

```text
Source Range
  実線

Repeated Range
  Pattern背景
```

---

# Part VIII: Transformation Layer

## 47. Drawingと演算Transformを分ける

CallipegのTransformation Layerは、Drawing、Animation、Videoを子として参照し、Position、Scale、Rotation、Opacity等をKeyframe化する。

DrawingそのものへTransform Keyを混ぜず、親Layerとして適用する。

これはTEGAKIのClip Motion構想と近い。

---

## 48. Hierarchy

Transformation Layerの中へLayerをDragするとChildになる。

Transformation Layer自体も別Transformation LayerのChildになれる。

これは汎用的だが、TEGAKIへ無制限Hierarchyを入れると複雑になる。

推奨:

```text
ClipInstance
  └ Motion

ClipGroup
  └ Group Motion

最大2～3段
```

初期には深いHierarchyを禁止または警告してもよい。

---

## 49. Global PivotとMultiple Pivot

Callipegでは、複数Childを一つのPivotで動かすか、各ChildのPivotを個別に使うか選べる。

TEGAKIでも複数CAFまたは複数Layer Transformで有用。

```text
Group Pivot
  全体を一つの物体として回転

Individual Pivot
  各Childが自身の中心で回転
```

複数選択Transformにも応用できる。

---

## 50. Curve Mode

Transformation Layerを展開すると、Layer一覧の代わりにTransform値とCurveを表示する。

これはTimeline領域をContextに応じて切り替える設計である。

TEGAKIではExpanded Timeline内で、

```text
Exposure View
Motion View
Curve View
```

を切り替える。

すべてを同時表示しない。

---

## 51. Canvas操作からKeyframeを作る

Callipegでは、現在FrameでTransformation Boxを動かすと、変更したPropertyにKeyframeが作られる。

便利だが、Auto Keyの誤操作リスクがある。

TEGAKIでは明示的なAuto Key状態を表示する。

```text
AUTO KEY: ON
AUTO KEY: OFF
```

OFF時の挙動:

- 現在Keyを変更
- Static値を変更
- Key作成確認

どれにするかを先に定義する。

---

## 52. Keyの時間と値の分離操作

CallipegではGestureにより、Keyframeの時間だけ移動するか、値だけ変更するかを分けられる。

TEGAKI Desktopでは次へ翻訳する。

- Horizontal Drag: Time
- Vertical Drag: Value
- Shift: Axis Lock
- Alt: Duplicate
- Inspector: Numeric
- Context Menu: Move Time Only／Value Only

Gestureを隠し仕様にしない。

---

## 53. Flatten

CallipegのTransformation Layerは、変形結果を新しいDrawing LayerへFlattenし、元Layerを無効化して残せる。

これは非常に良い出口である。

TEGAKIでは、

```text
Bake Motion to CAF
```

とする。

Bake後:

- 新規CAF列を作る
- 元Clip／Motionを保持
- 元を非表示にする選択肢
- RangeとFPSを指定
- 1 History Transaction
- 元へ戻れる

---

## 54. ToonSquidとの違い

Callipeg Transformation Layerは、ToonSquid 2の汎用Effect／Property体系より限定的である。

しかし、TEGAKI本体にはこの限定性が合う。

```text
Callipeg型
  Drawing中心
  Transformを親Layerで追加
  Flatten可能

ToonSquid型
  多様なLayer PropertyとEffectを統合
```

TEGAKI本体ではCallipeg型を基礎にし、Warp／Bone等の高度変形はToonSquid編のModifier構想を接続するのがよい。

---

# Part IX: SelectionとTransformation

## 55. Quick Transform

CallipegではSelection後、自動でTransformation Toolへ切り替えるQuick Transformがある。

TEGAKIでも便利だが、自動切替は設定可能にする。

```text
After Selection
  Stay in Selection
  Switch to Transform
  Remember Last Choice
```

---

## 56. Transform Box

Callipegは8Handle、Rotation Bar、Gesture Transformを持つ。

TEGAKIで必要な基本機能:

- 8Handle
- Rotation Handle
- Pivot
- Uniform Scale
- Free Scale
- Flip
- Reset
- Numeric HUD
- Snap
- Canvas Pan Lock

通常Layer、CAF内容、ClipInstanceで可能な限り共通Gizmoを使う。

ただしEditing Contextは明示する。

---

## 57. Canvas NavigationとTransform Gestureの競合

CallipegではOptionにより、

- FingerでTransform
- FingerでPan／Zoomし、HandleだけでTransform

を切り替える。

TEGAKIでもTouch環境では競合する。

推奨:

```text
Direct Touch Transform
  OFFが初期値

Handle Transform
  ON

Two Finger
  Pan / Zoom

Pen
  Draw or Handle
```

---

# Part X: Markersと区間管理

## 58. Markers

CallipegではTimeline上部にMarkerを置ける。

- 名前
- 色
- 移動
- 削除
- 常時Label表示
- Marker間Flip

TEGAKIでの用途:

- Key Pose
- Cut
- Timing Note
- Dialogue
- Impact
- AI生成区間
- Bake範囲
- Review Point

---

## 59. Mark IN／OUT

Mark IN／OUTはPlaybackとExport範囲を制限する。

TEGAKIでも重要。

用途:

- 一部分だけLoop Preview
- 選択区間だけExport
- Bake範囲
- AI連携範囲
- Onion／Flip範囲

単なるTimeline Selectionとは分ける。

---

## 60. Named Range

Callipegより一歩進め、TEGAKIではMarker PairをNamed Rangeにできる。

```text
Walk Cycle
  Frame 12–35

Turn Head
  Frame 40–52
```

ただし初期実装ではMark IN／OUTだけでよい。

---

# Part XI: Group LayerとLayer UI

## 61. Group Layer

CallipegのGroup LayerはLayerを入れ子にして整理し、まとめて表示・非表示できる。

TEGAKIのCAF内部FolderとTimeline Groupは責務を分ける。

```text
CAF Internal Folder
  一枚のCAF内部の作画Layer整理

Timeline Group
  複数Lane／Clipの時間・表示整理
```

UIが似ていても保存正本は混ぜない。

---

## 62. Layer Color

CallipegはLayer色をTimeline識別へ利用する。

TEGAKIでもLane、Group、Motion種別を色で見分けられる。

ただし色だけで意味を持たせない。

- Icon
- Label
- Pattern
- Border
- Color

を併用する。

---

## 63. Drawing Layer Menu

CallipegのDrawing Layerには、Opacity、Visibility、Lock、Blend Mode、Alpha Lock、Duplicate with Content、Duplicate without Content、Merge、Solo等がある。

TEGAKIのLayer Panelへ参考にできる。

しかし、アニメTimeline上のCAF操作と、CAF内部Layer操作を同じMenuへ混ぜない。

---

# Part XII: GestureとUI密度

## 64. CallipegのGestureが優れている点

- Canvas面積を維持できる
- Pencilを離さず操作できる
- Flipが高速
- Timeline Zoom／Panが直接的
- SelectionからActionへ移る距離が短い
- Floating Menuを手元へ置ける

---

## 65. Gestureの弱点

- 初見で発見しにくい
- 指の本数を覚える必要がある
- Desktopへ移植しにくい
- Long Touchに時間がかかる
- Palm Rejectionへ依存
- 誤操作時に原因が分かりにくい
- Accessibilityへ課題が出る
- Iconだけでは意味が伝わりにくい

---

## 66. TEGAKI向けの翻訳原則

各重要Actionに少なくとも二つの入口を持たせる。

例:

```text
Split with Blank

入口1
  Contextual Action Bar

入口2
  Keyboard Shortcut

入口3
  Pen Gesture
```

Gestureだけを唯一の入口にしない。

---

## 67. TooltipとShortcut表示

Icon Hover時:

```text
空CAFとして分割
Shortcut: Shift + S
Pen Gesture: 上方向Slice
```

のように表示できる。

設定画面にGesture一覧を用意する。

---

# Part XIII: Floating MenuとQuickToolPreset

## 68. Floating Menu

CallipegのFloating Menuは、Two Finger Long Touchで開き、Canvas上の任意位置へ移動できる。

内容を切り替えられる。

- Copy
- Cut
- Paste
- Clear
- Flip
- Color Wheel
- Color Sliders
- Palette

TEGAKIのQuickToolPresetへ参考になる。

---

## 69. TEGAKI向けQuick Palette

候補:

```text
Quick Palette
  ├ Brush Preset
  ├ Size
  ├ Opacity
  ├ Color Wheel
  ├ Recent Colors
  ├ Current Palette
  ├ Eraser
  ├ Flip
  ├ Previous／Next CAF
  └ Copy／Paste
```

すべてを一つへ詰め込まず、Mode切替する。

```text
TOOLS
COLORS
ANIMATION
```

---

## 70. Color UI

CallipegのColor Panelには、

- Wheel
- Triangle／Square切替
- RGB／HSV等のSliders
- Hex
- Color History
- Palette
- Palette Export
- Main Palette

がある。

TEGAKIへ採用価値が高いのは、

- Recent Colors
- Current Palette
- Wheel／Square切替
- Hex入力
- Floating化
- QuickToolPresetとの連携

である。

本冊子では付録扱いとし、アニメTimelineの改修と同時に実装しない。

---

# Part XIV: Import／Exportの示唆

## 71. Exposure Sheetの交換

CallipegはXDTS等を通じて、他ソフトへExposure情報を渡す経路を持つ。

TEGAKIの将来の別動画ツールや外部作画ツール連携でも、

```text
Frame画像
  +
Exposure情報
```

を分けて交換する考え方が有用。

---

## 72. JSON／OCA／PSD等

Callipegは複数形式を扱うが、TEGAKIが同じ数を追う必要はない。

優先:

1. TEGAKI独自Project
2. PNG連番
3. Exposure JSON
4. PSD
5. 動画
6. 別動画ツール交換形式

---

# Part XV: TEGAKIへの採用分類

## 73. そのままに近い形で採用する候補

### A1. Sheet／CAF露出Timeline

最優先。

### A2. Push／Lock／Gap処理

最優先。

### A3. Contextual Action Bar

最優先。

### A4. Frame／CAF／Marker Flip

高優先。

### A5. Onion Skin Bar

高優先。

### A6. Out of Pegs／Onion Adjust

高優先。

### A7. Inbetween Assist

高優先。

### A8. Mark IN／OUT

中高優先。

### A9. Split with Copy／Blank

高優先。

---

## 74. TEGAKI向けに翻訳して採用する候補

### B1. Linked Sheets

ClipAsset／Instance参照として実装。

### B2. Cycles

CycleInstanceまたはLinked Instance生成として実装。

### B3. Transformation Layer

Clip Motion／Group Motionとして実装。

### B4. Hierarchy

深さを制限したClip Groupへ翻訳。

### B5. Gesture

Button、Shortcut、Gestureの複数入口へ翻訳。

### B6. Floating Menu

QuickToolPreset／Quick Paletteへ翻訳。

---

## 75. 別動画ツール側へ置く候補

- 本格Video Track
- Audio編集
- 深いTransform Hierarchy
- Camera
- Complex Curve Editor
- Composite
- Final Editing

TEGAKI本体には必要最小限だけ残す。

---

## 76. 当面見送る候補

- Callipeg UIのIcon配置コピー
- 指の本数だけに依存する操作
- Apple Pencil前提の唯一操作
- Drawing LayerとTimeline Laneの完全統合
- 無制限Hierarchy
- 全Import／Export互換
- Timelineへ全情報を常時表示
- Linked SheetのPixel Override
- Random Cycleの非決定評価

---

# Part XVI: 推奨するTEGAKI UI

## 77. Timeline三状態

```text
Collapsed
  Flip Ruler
  Current CAF
  Previous / Next
  Play

Normal
  CAF Exposure
  Lane Header
  Context Action
  Onion Bar

Expanded
  Multiple Lane
  Markers
  Motion
  Curve
  Cycle Source
```

---

## 78. Context Bar

画面下またはTimeline上部へ配置する。

選択対象に応じて内容を切り替える。

Actionの並びは頻度順とする。

Secondary ActionはMenuへ入れる。

---

## 79. CAF表示

CAF Clipに表示する候補:

- Thumbnail
- CAF番号
- Duration
- Linked Icon
- Cycle Icon
- Motion Badge
- Onion Adjustment
- Locked
- Modified
- Source／Instance

Zoom Out時はIconを減らす。

---

## 80. Onion Bar配置

通常はTimeline上部またはCanvas下へ横並び。

Collapsed時は小型化する。

Inbetween AssistとOut of Pegsの入口を同じBarへ置くと、Callipeg同様に作画支援機能を集約できる。

---

## 81. Editing Context表示

```text
DRAW
TIMING
ONION ADJUST
INBETWEEN GUIDE
MOTION
SOURCE
INSTANCE
```

Canvas左上とStatus Barへ表示する。

---

# Part XVII: 段階的リファクタリング

## 82. Phase CP-0: 現行監査

コード変更なし。

確認:

- TimelineModel
- CAF／ClipAsset／ClipInstance
- Lane
- Selection
- Animation Table
- Onion
- Flip／Scrub
- History
- Project Save
- EventBus
- Thumbnail
- Layer Panel
- Pointer Handler
- Keyboard Handler
- Coordinate System

成果物:

- 現行操作State一覧
- Timeline Command一覧
- Gap／Hold規則
- Selection正本
- UI一時State
- History粒度
- Save対象
- Conflict一覧

---

## 83. Phase CP-1: SelectionとContextual Action

- 単一CAF選択
- 複数CAF選択
- Range選択
- Lane横断選択
- Contextual Action Bar
- Selection Status
- 一操作一History
- Context Menu
- Keyboard Shortcut

Timeline見た目の大改修はまだ行わない。

---

## 84. Phase CP-2: Timeline Shell

- Collapsed／Normal／Expanded
- Resize
- Timeline Zoom
- Horizontal Pan
- Lane Header固定
- Current Frame Focus
- Fit Selection
- Fit Content
- Thumbnail設定
- Performance Mode

---

## 85. Phase CP-3: Exposure Editing

- Duration Handle
- Push
- Lock
- Gap定義
- Close Gaps
- Fill Gaps
- Split with Copy
- Split with Blank
- Blank CAF Insert
- Move Range
- Reverse Order

---

## 86. Phase CP-4: FlipとMarkers

- Frame Flip
- CAF Flip
- Marker Flip
- Sensitivity
- Direction
- Collapsed Flip Ruler
- Marker
- Mark IN／OUT
- Playback Range
- Export Range

---

## 87. Phase CP-5: Onion Skin Bar

- 前後8Peg
- ON／OFF
- Opacity
- Previous／Next Color
- Dynamic／Static
- Front／Back
- Scrub Mode
- Lock Sliders
- Empty表示
- Performance Cache

---

## 88. Phase CP-6: Onion Adjust

- Peg選択
- Position
- Multi Peg
- Reset
- Instance単位保存
- Visible when Current
- Enable／Disable
- History
- Project Save
- Export対象外

その後Scale／Rotation／Flipを追加。

---

## 89. Phase CP-7: Inbetween Assist

- 1点Guide
- Fraction
- 2点Guide
- Scale／Rotation
- Arc
- Point再編集
- Multiple Guide
- Save／Load
- Onion統合
- AI Controlへの将来拡張

---

## 90. Phase CP-8: Linked CAF

- ClipAsset参照監査
- Duplicate Linked
- Duplicate Independent
- Linked表示
- Source編集
- Make Independent
- Link解除
- Source削除安全処理
- Save／Migration

---

## 91. Phase CP-9: Cycles

- Cycle作成
- Loop
- Ping-pong
- Random + Seed
- Source Range表示
- Repeat Range表示
- Timing編集
- Break
- Unlink
- Bake
- Loop Onion

---

## 92. Phase CP-10: Transformation Layer相当

- Clip Motion
- Group Motion
- Transform Box
- Pivot
- Auto Key
- Curve View
- Previous／Next Key
- Global／Individual Pivot
- Bake to CAF
- Hierarchy Depth制限

ToonSquid編のUnified Transform設計と統合する。

---

## 93. Phase CP-11: Quick Palette

別Phaseで実施。

- Floating
- Tools／Colors／Animation Tab
- Recent Colors
- Palette
- Flip
- Previous／Next CAF
- QuickToolPreset

---

# Part XVIII: 受け入れテスト

## 94. Timeline

- Timelineを閉じてもCAF Flipできる
- Normal／Expanded切替でCurrent Frameを失わない
- Zoom／Pan後も選択が維持される
- Thumbnail OFFでも操作できる
- 高負荷時に作画が止まらない

---

## 95. Exposure

- Pushで後続CAFが正しく移動する
- Lockで後続CAFが移動しない
- Gap規則がPreviewとExportで一致する
- Split with Copyで同じAsset参照になるか、独立Copyになるかが仕様通り
- Split with Blankで空CAFが作られる
- Undo一回で戻る
- Save／Load後にTimingが一致する

---

## 96. Selection

- 単一／複数／Range選択が安定
- 選択対象に応じてAction Barが変わる
- Hidden Laneの選択が残らない
- Linked CAFを編集する前に影響範囲が分かる
- Colorだけで選択状態を伝えない

---

## 97. Onion

- 前後8Pegが正しいCAFを参照
- Empty位置が明示される
- Opacity Linkが機能する
- Front／Backが正しく描画される
- Scrub中の設定が守られる
- OnionがExportへ混入しない
- Timeline OnionとLane Onionの正本を混同しない

---

## 98. Onion Adjust

- Drawing正本を変更しない
- PegごとのOffsetが保存される
- Multiple Peg編集がUndoできる
- Disable時に通常Onionへ戻る
- Reset Allが一操作で戻せる
- Linked CAFでもInstanceごとに安全に管理できる

---

## 99. Inbetween Assist

- 1点でTranslation Guideが生成
- 2点でScale／Rotationが反映
- Fraction Snapが正しい
- Arc変更でGuideが更新
- Pointを再編集できる
- CAF内容を変更しない
- Preview／Save／Loadが一致する

---

## 100. Linked CAF／Cycle

- Source編集がすべてのLinked Instanceへ反映
- Make Independent後は反映されない
- Cycle Source Timing変更がRepeatへ反映
- Ping-pong順が正しい
- RandomがSeedで再現可能
- BreakとUnlinkが別Command
- Bake結果がPreviewと一致

---

## 101. Transformation

- Clip MotionがCAF Pixelを破壊しない
- Auto Key状態が明示される
- Canvas操作とCurveが同期
- Global／Individual Pivotが正しい
- Flatten／Bake後に手描き修正できる
- 元Motionを残せる
- PreviewとExportが一致

---

# Part XIX: 非目標

初期リファクタリングでは次を行わない。

- Callipeg Clone
- Callipeg Project互換
- Gestureだけの操作体系
- Drawing LayerとCAF内部Layerの正本統合
- 無制限Transform Hierarchy
- Video／Audio Editor化
- 全Export形式対応
- Timeline UIの一括置換
- OnionをDrawingへBake
- Inbetween画像の自動生成
- Cycleの非決定Random
- Linked CAFの複雑な部分Override
- CallipegとToonSquidの全機能同時導入
- Bone／MeshとTimeline全面改修の同時実施
- AI生成とInbetween Assistの同時実施

---

# Part XX: Codex／GPTへの作業指針

この文書を読んだAIは、Callipegの機能名だけを見て実装を開始しないこと。

実装前に次を確認する。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 現行Phase指示書
5. `animation-system.js`
6. `timeline-ui.js`
7. `timeline-thumbnail-utils.js`
8. `data-models.js`
9. `history.js`
10. `event-bus.js`
11. `project-manager.js`
12. `layer-system.js`
13. `pointer-handler.js`
14. `keyboard-handler.js`
15. Onion関連実装
16. Export関連実装

提案時には次を明記する。

- Sheet／CAF対応
- ClipAssetとClipInstanceの責務
- GapとHoldの規則
- Selection正本
- UI一時State
- Linked参照
- Cycle正本
- Onion Adjustment保存先
- Inbetween Guide保存先
- History Transaction
- Preview／Export一致
- Cache無効化
- Versioning
- Migration
- Failure時Rollback
- 現行Phaseとの衝突
- 対象外ファイル

本文中のInterface名、Phase名、UI名は概念例であり、既存実装を検索してから命名すること。

---

# Part XXI: 未決事項

1. CAF間のGapを完全透明にするか、前CAF Holdを許すか。
2. Split with CopyがLinked参照を作るか、独立Assetを作るか。
3. Onion AdjustをAsset、Instance、Laneのどこへ保存するか。
4. Visible on Current Frame相当を導入するか。
5. Onion AdjustにScale／Rotationを最初から入れるか。
6. Inbetween AssistのGuideをProjectへ保存するか、一時Stateとするか。
7. Cycleを実体Instance列で持つか、仮想Cycleで持つか。
8. Random CycleをTEGAKI本体へ入れるか。
9. Linked CAFのSource編集UIをどこへ置くか。
10. Timeline Collapsed時の最低限UI。
11. Action BarをTimeline内、Canvas下、右Panelのどこへ置くか。
12. Touch Gestureの既定値。
13. Pen Timeline TapをFrame選択に使うか。
14. MarkerをProject全体、Lane、Clipのどの単位へ持つか。
15. Mark IN／OUTをPlaybackとExportで共有するか。
16. Auto Keyの既定値。
17. Transformation Layer相当をClip Motionへ統合するか、別Trackとして見せるか。
18. Global／Individual Pivotを複数選択Transformへ適用するか。
19. Quick PaletteをDOM PopupとCanvas Overlayのどちらで作るか。
20. Callipeg型のTimeline Thumbnailをどこまで採用するか。

---

# 102. 最終提案

Callipegから学ぶべき中心は、機能数ではない。

最も重要なのは次の一連の操作である。

```text
絵を描く
  ↓
Sheet／CAFとして時間軸へ存在する
  ↓
露出を調整する
  ↓
前後をFlipする
  ↓
Onionを直接調整する
  ↓
中割りの位置をGuideする
  ↓
Linked／Cycleで作画を再利用する
  ↓
必要な場合だけTransformを重ねる
  ↓
最後はDrawingへ戻せる
```

TEGAKIへ導入する優先順位としては、次を推奨する。

```text
1. SelectionとContextual Action
2. Timeline三状態
3. Exposure Push／Lock／Gap
4. Frame／CAF／Marker Flip
5. Onion Skin Bar
6. Out of Pegs／Onion Adjust
7. Inbetween Assist
8. Linked CAF
9. Cycles
10. Transformation Layer相当
11. Quick Palette
```

ToonSquid 2編が「演算変形と素材演出」の参考資料であるのに対し、Callipeg編は「コマを描く人間の手と時間軸をどう接続するか」の参考資料である。

TEGAKI本体のリファクタリングでは、Callipeg編を先に作画Timelineの基準として使い、その上へToonSquid 2編のTransform、Warp、Mesh、Bone、Modifierを段階的に接続する構成が最も筋がよい。

---

# 参考URL

## Callipeg公式

- Callipeg  
  https://callipeg.com/
- Introduction  
  https://callipeg.com/learn-introduction/
- Features  
  https://callipeg.com/features/
- Interface  
  https://callipeg.com/learn-interface/
- Timeline  
  https://callipeg.com/learn-timeline/
- Gestures on the Timeline  
  https://callipeg.com/learn-gestures-timeline/
- Gestures on the Canvas  
  https://callipeg.com/learn-gestures-canvas/
- Flip  
  https://callipeg.com/learn-flip/
- Drawing Layer  
  https://callipeg.com/learn-drawing-layer/
- Onion Skin  
  https://callipeg.com/learn-onion-skin/
- Out of Pegs  
  https://callipeg.com/learn-out-of-pegs/
- Inbetween Assist  
  https://callipeg.com/learn-inbetween-assist/
- Linked Sheets  
  https://callipeg.com/learn-linked-sheets/
- Cycles  
  https://callipeg.com/learn-cycles/
- Transformation Layer  
  https://callipeg.com/learn-transformation-layer/
- Selection  
  https://callipeg.com/learn-selection/
- Transformation  
  https://callipeg.com/learn-transformation/
- Group Layer  
  https://callipeg.com/learn-group-layer/
- Markers  
  https://callipeg.com/learn-markers/
- Colors  
  https://callipeg.com/learn-colors/
- Floating Menu  
  https://callipeg.com/learn-floating-menu/
