STATUS: REFERENCE
DATE: 2026-09-18

This is a Research Bank.
It is not an implementation Card.
It is not current product authority.
Current implementation state remains owned by STATUS / TECHNICAL / the current Work Package / production code.

---
# TEGAKI OSS / GUI / Interaction Research Handoff

**作成日:** 2026-09-18  
**用途:** 次チャットへの引き継ぎ用。  
**位置づけ:** これは実装指示書ではなく、ここまでの深掘り調査・仮説・未検証事項・次に絞って調査すべき論点をまとめた **Research Handoff / Material Bank**。  
**最終フロー:** このResearch Bank → 別チャットが整理・指示書化 → Codex Astraが取捨選択と境界判断 → bounded implementationへ落とす。

---

## 0. この調査の目的

TEGAKIを作る上で、既に存在するOSSや最近のブラウザEditorから「車輪」「シャシー」「完成車」を探し、車輪の再発明を避ける。

ただし目標は「既存EditorをそのままforkしてTEGAKIにする」ことではない。TEGAKI独自のGUI哲学・漫画/アニメ志向・ふたば由来の操作感を維持しつつ、以下を切り分ける。

- そのまま依存できる部品
- Adapter越しに使える部品
- コード移植できる部品
- Architectureだけ学ぶ対象
- GUI/導線だけ学ぶ対象
- 既にTEGAKI側が十分強く、置換する必要がない領域

「優秀なOSSだから採用」ではなく、**TEGAKIの既存authorityを壊さず果実だけ持ち込めるか**を最重要視する。

---

# 1. TEGAKI GUI哲学

## 1.1 思考の水平

ユーザーが定義した重要概念。

> 新しいツールを触った時、既知のツールとの差異が小さいほど「思考の水平」が保たれる。  
> 学習の坂や階段を登らせるなら、それに見合う果実が必要。

したがってTEGAKIの独自性は入口に置くのではなく、**深度方向に伸ばす**のが望ましい。

例:

- ペンは見ればペンと分かる
- 投げ縄は見れば投げ縄と分かる
- Layerは既知のLayer文法に沿う
- Transformは動画/画像Editorで一般的な文法に沿う
- 深掘りすると漫画向け機能、Rig、特殊Transform、AI連携などが出る

「普通に使えば普通」「掘るとTEGAKI固有」が基本思想。

## 1.2 意識のスコープ / レンズ効果

初期画面で全能力を見せない。

ユーザーが興味を持った対象に焦点を合わせると、そこだけ情報密度を上げる。

WeebPaintのToolbarで確認した例:

- 第一階層 = 道具の種類
- 選択時だけ第二階層 = Context Toolbar / Subtool
- 小さな三角などで「奥にもう一段ある」ことだけ示す
- Canvasを覆う巨大Inspectorをいきなり出さない

重要なのは単純な「隠す/開く」ではなく:

- 関連操作が近接している
- 何の詳細を見ているか見失わない
- 展開してもCanvas遮蔽が小さい
- 簡略状態でも奥の機能の存在が分かる
- 閉じれば粗い焦点へ戻れる
- Popover / Bottom Sheet / Context Inspector等を画面サイズに応じて変えられる

今後のGUI評価軸:

- 水平差
- 学習コストに対する果実
- 初期情報密度
- Lens depth
- 文脈連続性
- 遮蔽コスト
- 再定位コスト
- 周辺視野
- 操作距離
- 深度遷移

## 1.3 GUIの主な「先生」

コード流用元ではなく外から思想・導線を学ぶ対象。

- Adobe Fresco — 現代的なタブレット向け描画GUIの原点として重視
- CLIP STUDIO PAINT Simple Mode — Fresco系の文法をよく受け継ぐ
- ToonSquid 2
- Callipeg Studio
- Procreate Dreams 2
- LYRICA — 動画/DAW型のRight Inspector + Bottom Timelineの新しい参考対象

---

# 2. 超ロングパス: お絵かき掲示板へのOverlay統合

今は実装対象にしない。

想定:

```text
ふたば等の掲示板
   ↓
bookmarklet / Chrome Extension
   ↓
TEGAKIをfull-screen overlay / iframe表示
   ↓
描画
   ↓
PNGをpostMessage等で親へ戻す
   ↓
掲示板側の画像欄/canvasへ転写
```

旧Loaderでは既に:

- GitHub Pages等からHTML fetch
- full-screen iframe
- child → parent `postMessage`
- PNG Data URL
- 最大400×400への縮小
- 掲示板側canvasへ転写

が成立している。

今後はChrome ExtensionへTEGAKI本体を同梱し、GitHub runtime fetchの不安定さを消す案もある。

ただし **本体完成後の案件として凍結**。現在のEditor Architecture判断へ制約として持ち込まない。

---

# 3. 「車体カタログ」現状

## 3.1 Raster Paint完成車 / donor

### Klecks / Kleki OSS版
Repository: https://github.com/bitbof/klecks

- MIT
- standalone / embedの2ビルド
- drawing communityへの埋め込み用途を公式READMEが想定
- pressure / stabilizer / layers / selection / warp / perspective / smudge / filters / touch / history

評価:
- 実運用歴が長い
- 完成度は候補中かなり高い
- ただしBrushやHistoryはアプリ側への結合も強い
- 「丸ごとfork」より、成熟したRaster実装の比較基準として重要

### WeebPaint
Repository: https://github.com/fangzhangmnm/weebpaint

- MIT
- 2026年活発開発
- Star等の外部評価はまだ非常に少ない
- AIコーディングを大規模に利用した新世代Editor
- pressure/stabilizer
- custom brush
- layers/groups/clipping/masks
- lasso/magic wand
- affine/projective transform
- line-art gap closing
- timelapse
- ORA/PSD
- PWA

重要性:
- 「成熟済み完成車」ではない
- しかし2026型Paint Architecture研究対象として非常に強い
- Input / Stroke / History / Selection / Fill / Transformの境界が比較的明確

特に重要:
- `stroke-smoother.ts`
- `stroke-session.ts`
- `pointer-route.ts`
- sparse tiled Selection
- Flat Coloring / Gap Closing
- Context Toolbar / Subtool Slot

### miniPaint
Repository: https://github.com/viliusle/miniPaint

- MIT
- Browser image editor
- Action / History / Core / Toolsの分離
- Transformや画像編集処理の教材として有力

特に:
- Undo/RedoをAction単位に整理
- 操作をbundle化
- 大型EditorのHistory organization研究に向く

### desuwa/tegaki
Repository: https://github.com/desuwa/tegaki

- MIT
- Oekaki専用
- 掲示板用途とTEGAKIの出自がかなり近い
- layer / pressure / replay / event recording / post callback

重要:
- Stroke/Event replay思想
- `.tgkr`等の再生系
- 「描画を画像だけでなくイベントとして保存」の教材

### ChickenPaint
Repository: https://github.com/thenickdude/chickenpaint

- GPLv3
- Oekaki系の成熟実装
- engine / GUI分離
- Brush / Layer / Blendの歴史的研究対象

TEGAKIへの直接コード移植はライセンス上慎重に扱う。基本はArchitecture/実装研究用。

### Photoshlopper
Repository: https://github.com/noisyloop/photoshlopper

- MIT
- 2026年開始
- まだ非常に若い
- React + TypeScript + WebGL2
- Brush / Selection / Float / History / compositor

特にBrushの独立性が高い。

`StrokeEngine`が概ね:

```text
begin(x,y,p)
moveTo(x,y,p)
bake(layerBefore, selectionMask)
```

に近く、Pointer/UIを知らない。

Klecksは「高機能・成熟度高・結合強め」、Photoshlopperは「若い・機能は狭い・独立性高」という対照。

---

# 4. Object / Transform / Timelineシャシー

## 4.1 mce / ModernCanvasEditor
Repository: https://github.com/qq15725/mce

- MIT
- Bring your own UI思想
- Selection / Transform / snapping / frame/artboard / pen / text / timeline / keyframe / easing / history / Yjs / collaboration / PSD等

注意:
- `mce`自体はVue 3を依存に持つ
- Raster Paintの土台ではない
- Object / Scene / Transform / Timeline向け

TEGAKI全体を置換する対象ではない。

研究用途:
- plugin境界
- Transform/Timelineの分離
- Keyframe popover
- Context Inspector
- Timelineを必要時だけ出すLens構造

## 4.2 modern-canvas
Repository: https://github.com/qq15725/modern-canvas

mce下層のRender/Scene系。よりheadlessに近いが、TEGAKI Raster authorityと直接置換するには重い。

## 4.3 HeadlessCanvas
Repository: https://github.com/elephancube/headlesscanvas-js

- MIT
- 2026年8月開始
- Preview段階
- Canvasには描画
- Selection/Resize/Rotation handlesをDOM overlayとして載せる
- UIは既定 / CSS変更 / 完全自作の3段階

重要な思想:

```text
TEGAKI GUI
   ↓
DOM overlay handles
   ↓
headless transform/control primitive
   ↓
Canvas
```

Lens哲学と非常に相性が良い。

ただしUndo / snapping / clipboard / freehand等はまだRoadmap側。今すぐ依存するより研究対象。

---

# 5. Animation / Timeline部品

## 5.1 Canvas Timeline
Repository: https://github.com/TechSquidTV/Canvas-Timeline

- MPL-2.0
- 2026年開始
- headless core + React + renderer等に分割
- playback / snapping / markers / clip/keyframe / selection / viewport

重要:
- Timelineだけ注文できる
- `previewEdit -> commitEdit / cancelEdit`
- Viewport Range Scrollbar

LYRICA型Scrollbarの参考として非常に重要。

## 5.2 Cutaway
Repository: https://github.com/S07K/cutaway

動画EditorだがArchitecture研究として重要。

```text
Domain (pure TS)
 ↓
Engines
 - timeline
 - animation
 - render
 - mask
 - effects
 - history
 ↓
Adapters
 ↓
React UI
```

重要原則:
- 時間をinteger Frameで保持
- Range `[start,end)`
- Propertyを最初から `Animatable<T>` として持つ

TEGAKIの将来Schema設計の比較対象。

## 5.3 SpriteForge
Repository: https://github.com/Wilson-Cheng/SpriteForge

- MIT
- Bone / Mesh / Pose / Timeline / Keyframe / IK
- 非常に若い

Rigging capabilityの小型参照車。

## 5.4 Theatre.js
Repository: https://github.com/theatre-js/theatre

成熟したAnimation state / sequencing系。

注意:
- CoreとStudio UIでライセンス境界が異なる
- StudioはAGPL系のため、TEGAKIへの組み込みは要ライセンス精査

現状は設計研究優先。

## 5.5 mcut
Repository: https://github.com/mattppal/mcut

今回「操作感」研究で重要度上昇。

Timeline Clip Dragで:

- activation threshold
- stable scroller pointer capture
- `requestAnimationFrame` coalescing
- auto-scroll
- snap
- `buttons===0`保険
- Escape/blur/cancel rollback
- gesture単位Transaction

を実装。

依存候補というより、**Gesture grammarの教材**として非常に強い。

---

# 6. Raster Selectionの研究結果

現行TEGAKIのSelectionは基本的に矩形boundsが正本。

概念的に:

```text
state
 ├ active
 ├ layerId
 ├ scope
 ├ bounds {x,y,width,height}
 ├ mode: rectangle
 └ transformSessionActive
```

Copy / Delete / Transform / Brush制限 / Fill制限もbounds前提が強い。

外部実装は3流派。

### Klecks
Polygon/MultiPolygon寄り。

良い:
- Rectangle
- Lasso
- union/subtract

弱い:
- Magic Wand/alpha selectionでは最終的にRaster maskが必要

### Photoshlopper
Canvas全体と同サイズのgray8 mask。

単純だが:
- 4096² ≒ 16MB
- 8192² ≒ 67MB

Selectionだけでこのメモリになる。

### WeebPaint
sparse gray8 tiled mask。

- 必要領域だけTile保持
- immutable
- union/subtract/intersect/invert
- layer alpha → selection
- Magic Wand等

高性能だがTile Pool等との結合が強い。

### TEGAKI向けの有力中間案

まだ採用決定ではないが:

```text
SelectionState
 ├ bounds
 └ mask? : Uint8Array
```

Rectangle:
- `mask = null`
- bounds全部選択

Lasso/Magic Wand:
- tight bounding box
- bounds内だけlocal gray8 mask

これなら現在の矩形高速経路を残しつつ拡張可能。

既存の主なmask-aware化対象:
- `_extractRegion`
- `_clearRegion`
- `constrainLayerToSelection`
- `_startFloatingSession`
- `copySelection`
- `deleteSelection`

---

# 7. 漫画向けFill

現行TEGAKIにもGap Closeは存在する。

現行は概ね:

```text
Flood Fill
+
近傍gap pxに壁があれば壁扱い
+
dilation
+
underpaint dilation
```

WeebPaintはより本格的。

```text
RGBA line art
 ↓
二値化
 ↓
Exact Distance Transform
 ↓
線幅推定
 ↓
Endpoint / Keypoint検出
 ↓
近傍端点候補
 ↓
Hermite curveによる仮想Bridge
 ↓
交差/微小領域判定
 ↓
Connected Region Labeling
 ↓
Region map cache
```

アプリ層では `FlatColoringOracle` として:

```text
prepare = 高コスト
query   = 低コスト
```

に分離。

TEGAKIとの接続候補:

```text
TEGAKI FillTool
 ├ history
 ├ selection制限
 ├ reference all layers
 ├ Pixi焼き込み
 └ UI
       ↓

 Region Oracle
       ↓
 current BFS
 or
 WeebPaint line-art oracle
```

**FillToolを捨てず、「塗る領域を求める部分」だけ交換する**のが有力。

---

# 8. Brush

## 8.1 現行TEGAKI

すでに独自Brush pipelineが育っている。

概念的に:

```text
Pointer
 ↓
StrokeRecorder
 ↓
Pressure
 ↓
Adaptive interpolation
 ↓
StrokeRenderer
   ├ Pixi line
   ├ Perfect Freehand
   ├ Airbrush
   └ Blur
 ↓
RenderTexture
```

したがってBrush全面置換は優先度が低い。

## 8.2 Hokusai
Repository: https://github.com/reearth/hokusai

- MIT OR Apache-2.0
- Pure Rust
- WASM-ready
- MyPaint/libmypaint互換を狙う
- `.myb`
- pressure/speed/direction/tilt/random
- smudge
- colorize
- spectral mixing
- 64×64 tiles

重要な果実:

> MyPaint / Krita系の膨大なBrush資産をTEGAKIへ持ち込める可能性

TEGAKI向けに自然なのは全面置換ではなく:

```text
Brush Backend
 ├ TEGAKI Pen
 ├ current pixel/airbrush
 └ Natural Media
       ↓
     Hokusai WASM
```

課題: 標準WASM wrapperはCanvas全体RGBA化寄り。

有力案:

```text
Hokusai Core
 ↓
TEGAKI用WASM bridge
 ↓
dirty tiles only
 ↓
Pixi texture update
```

Astra裁定時の問い:

> `.myb ecosystem`という果実が、Rust/WASM dirty-tile bridgeのコストに見合うか

---

# 9. GUI Lensの「足回り」はWeb標準で買える

2026年現在:

- HTML Popover API
- CSS Anchor Positioning
- `position-try-fallbacks`

がかなり成熟。

つまり:

```text
[投げ縄▼]
   ↓
context tools
```

について、Escape / 外クリック / anchor追従 / viewport外flip等を全部自作する必要が減っている。

TEGAKIは見た目だけ独自化し、浮遊/追従/画面端回避はWeb Platformへ任せる方向が有力。

アクセシビリティやMenu state machineが必要なら: https://zagjs.com/

Zag.jsはframework-agnosticで、Popover/Menu/Dialog等のstate machineだけ借りられる。

---

# 10. LYRICAから得た新しいGUI論点

LYRICA: https://lyrica.jp/

2026-09-17にWindows版登場直後。

主な学び:

```text
中央 = visual result
右   = context/property editing
下   = temporal editing
```

これは動画/DAW型Editorの思考の水平と合う。

## 10.1 Transform Panelを右へ移す案

現行TEGAKIのTransform Panelは上部中央のFloating Window。

実装上:
- `position: fixed`
- 初期位置が上側
- Canvas状況を隠しやすい
- panel drag logicまでTransform側が管理

Transformのauthority自体はPanel位置と独立しているため、Right InspectorへprojectionすることはArchitecture全面改造ではない可能性が高い。

候補:

```text
Canvas                 Right Dock
                       ┌────────────┐
Transform Overlay ←→   │ TRANSFORM  │
                       │ X/Y        │
                       │ Scale      │
                       │ Rotation   │
                       │ Anchor     │
                       │ Warp       │
                       └────────────┘
```

---

# 11. ただしLayer / RIGと競合する

現行Layer Panelには既に:

```text
LAYERS | RIG
```

のContext Dock切替が存在。

単純に:

```text
LAYERS | TRANSFORM | RIG
```

にすると、Rig中にLayer hierarchyが消える問題が残る。

ここから出た研究案が **Hierarchy Spine + Context Inspector**。

---

# 12. Hierarchy Spine

自由Node Graphまで作ると重い。

代わりに:

```text
RIGHT DOCK

┌─────────────────────┐
│ HIERARCHY SPINE     │
│ ▾ Head              │
│   ├ Hair            │
│   ├ Eye L           │
│   ├ Eye R           │
│   └ ▾ Body          │
│       └ Arm         │
├─────────────────────┤
│ CONTEXT INSPECTOR   │
│ Transform / Rig /   │
│ Physics / etc.      │
└─────────────────────┘
```

Hierarchy Spineは通常Layer Panelの縮小コピーではない。

残す情報:
- thumbnail
- name
- indent
- parent/child
- rig/pivot状態
- 必要ならconnector

消す:
- Blend
- Opacity
- Clipping
- 通常Layer操作の細部

役割:

```text
Canvas      = 空間関係
Hierarchy   = 構造関係
Inspector   = 選択対象の詳細
Timeline    = 時間関係
```

Live2DのDeformer Palette等が参考になる。

---

# 13. Physicsも動画Editor型へ寄せられる

Physics値自体:

```text
Spring
Damping
Gravity
Delay
Preview
Bake
```

はRight Inspectorに置きやすい。

ただし:

```text
何が
 ↓
何に追従し
 ↓
何を駆動するか
```

はHierarchy/Constraint問題。

したがって:

```text
STATIC / RELATION
Hierarchy
Parent
Bone
Constraint
Physics dependency

↓

INSPECTOR
Transform
Constraint params
Physics params

↓

TEMPORAL
Timeline
Keys
Bake result
```

という3層分離が有力。

---

# 14. LYRICA型Timeline Overview

LYRICA画面下部のScrollbarは、Scrollbar + 全体Overviewのように見える。

ただし公式仕様として確認したわけではなく、スクリーンショットからの視覚的推定。

Laneをそのまま縮小すると多Laneで破綻。

TEGAKIなら:

```text
Temporal Overview Strip

0f                              240f
│░░████░░██░██████░░░██░░░░░│
       [====== viewport =====]
                ▲ playhead
```

のような**全Lane集約密度表示**がよい可能性。

## 14.1 Canvas TimelineのViewport Scrollbar

Canvas Timelineにはかなり近い既製primitiveがある。

- 全Timeline range
- visible range
- thumb drag = pan
- left/right handle = zoom

背景にTEGAKI独自のTemporal densityを描けば:

```text
|··██··████···██····|
     [==========]
       viewport
```

にできる。

この部分は車輪再発明をかなり避けられる。

---

# 15. 「気持ちいい操作」の調査結果

操作感はCSS animationだけではない。

優先度として:

```text
1. Continuity
   pointerを失わない

2. Latency
   追従が遅れない

3. Intent
   clickとdragを誤認しない

4. Magnetism
   snapが期待通り

5. Forgiveness
   hit areaが広い
   境界がガタつかない

6. Preview
   放す前に結果が分かる

7. Reversibility
   Escape/cancel
   1 gesture = 1 undo

8. Polish
   settle animation
   周囲の滑らかな移動
```

TEGAKIは8の視覚演出は既に一定水準にある。

弱点候補は1〜7の一貫性。

---

# 16. 現行TEGAKI Layer D&Dは意外に強い

`layer-panel-renderer.js`の既存D&D:

- 3px threshold
- Pointer Capture
- Drag開始時geometry cache
- `translate3d` ghost
- before / after / inside
- 周辺Row shift preview
- Drop marker animation
- drop中のrender抑制

つまりLayer D&DはTimelineより進んでいる。

重要:

> 外部OSSだけを正解とせず、Layer D&Dの良い部分を共通Kernelへ昇格させる選択肢がある。

---

# 17. Animation Tableの現状

`ui/animation-table-popup.js`:

- GitHub tree metadata上で約 **1.22 MB**
- 多数のGesture stateを同一class内に保持

確認できた状態変数例:

```text
_boneCanvasGesture
_clipMoveMoved
_dragPointerId
_isClipMoving
_isDragging
_isResizing
_isRetiming
_laneReorderGesture
_layerTransformKeyBundleDrag
_motionCanvasGesture
_motionCurveGesture
_motionGraphGesture
_motionKeyDrag
_partCanvasGesture
_resizePointerId
_rigMeshVertexEditGesture
_rigPivotGesture
_rigSkinWeightBrushGesture
_timelineViewportGesture
_warpGridGesture
...
```

これは「ファイルが大きいから悪い」という話ではない。

ただしGesture lifecycleが増殖しており、Interaction層を分離する圧力がかなり高い。

---

# 18. 現行TEGAKI内に「良いGesture Kernelの芽」が既にある

特に `ui/layer-transform-warp-controller.js` は非常に重要。

これは:

> DOM gestureとLayerSystem transaction境界だけを接続し、Project / History / ClipInstance / Rasterの正本を所有しない

と明示されている。

WARP Gestureは:

- Pointer Capture
- pointerup = retain preview
- pointercancel = rollback current gesture
- lostpointercapture = rollback
- pointerup後のlate lostcaptureを無視
- Gesture terminalではHistoryを作らない
- Sessionのcommit/cancelは上位authorityへ任せる

テスト:
- `verify-layer-warp-pointer-terminal.mjs`
- `wp005-pointer-terminal-diagnostic.html`

まで存在する。

これは外部OSSを入れる前に、**TEGAKI自身が既に持つ良いInteraction grammar**として再利用候補。

---

# 19. 今回の分解調査: 4 Gesture

今回の最後の調査では:

1. Clip Move
2. Retime / Trim
3. Motion Key Drag
4. Viewport Pan / Zoom

を8段階へ分解中。

```text
Input
Threshold
Geometry
Preview
Snap
Commit/Cancel
History
AutoScroll
```

以下、現時点までにコードで確認できた内容。

---

# 20. Clip Move

## Input

`.anim-cel-block` pointerdown。

複数選択時はgroup move。

内部state:

```text
_clipMoveData = {
  clipId,
  startX,
  startY,
  sourceLaneId,
  sourceStartFrame,
  sourceLaneIndex,
  movableLaneIds,
  moveItems,
  isGroupMove,
  beforeState
}
```

## Threshold

```text
abs(dx) > 4 || abs(dy) > 4
```

でmove開始。

## Geometry / hit-test

PointerMoveのたびに:

```text
moving blockのpointerEventsを一時none
 ↓
document.elementFromPoint()
 ↓
timeline row探索
 ↓
getBoundingClientRect()
 ↓
frame = floor((clientX - rect.left) / cellWidth)
 ↓
querySelector(target frame slot)
```

## Preview

target slotへ:

- `move-target`
- `move-target-blocked`

classを付ける。

## Snap

現状確認範囲では基本的にFrame grid。外部Clip edge等への高度snap engineではない。

## Domain mutation

PointerMove中はClipそのものを移動せず、Drop slot preview中心。

PointerUpで:

- `model.moveClip`
- `model.moveClips`

を実行。

## History

PointerUp commit後:

- `caf-clip-move`
- `caf-clips-move`

として1 history。

## 20.1 Clip Moveの重要な終端問題

現コードでは:

```text
document.addEventListener('pointerup', _onClipMoveMouseUp)
document.addEventListener('pointercancel', _onClipMoveMouseUp)
```

で同じhandlerを使う。

さらに`_onClipMoveMouseUp(e)`は、`e.type === 'pointercancel'`を見ず、

```text
if (_clipMoveMoved) {
  target slotを求める
  moveClip() / moveClips()
  history
}
```

へ進む。

つまり **コード読解上はpointercancelでもDrop/Commitされ得る**。

これはかなり重要。

まだ実ブラウザ診断を作って再現確認していないため、最終的には **CODE-CONFIRMED RISK / RUNTIME-UNVERIFIED** と扱う。

---

# 21. Retime / Trim

## Input

Clip edge handle。

## Threshold

現コードではPointerDown直後にretiming stateへ入り、Moveごとにdelta frame計算。

## Domain mutation

Clip Moveと違い、PointerMove中に:

```text
_applyRetimingWithPush()
```

を直接呼ぶ。

これは:

- clip start
- duration
- 隣接clip
- transform keys
- layer transform tracks
- folder transform tracks
- deformers
- rigMotion

まで実際に書き換える。

そのため開始時に`laneSnapshot`を保持。

## Preview

実体modelをlive mutationし、`render()`で追従。

## History

終了時に:

```text
caf-clip-retime
```

を1 history化。

## 21.1 Retimeの重要な終端問題

こちらも:

```text
pointerup     -> _onRetimingMouseUp
pointercancel -> _onRetimingMouseUp
```

同一handler。

しかもhandlerはevent typeを見ず、startFrameChanged / durationChangedならHistoryを作る。

`laneSnapshot`はMove計算失敗時のrestoreには使われるが、`pointercancel`専用rollbackには現状使われていない。

したがってコード読解上:

> **pointercancelでも現在のretime結果を保持し、History化する可能性が高い。**

これはWARPのcancel rollback policyと非対称。

runtime verificationが次の最優先候補。

---

# 22. Motion Key Drag

Motion / Warp / Rig key markerに複数実装がある。

共通的に:

- pointerdown
- 3px threshold
- target frame算出
- collision plan
- CSS preview
- pointerupでdomain commit

を行う。

## 良い点

`_planMotionTimelineKeyMove()`は比較的pure plannerに近い。

- selected key group
- allowed delta
- clip duration clamp
- target frame collision

を先に計画する。

これは共通Kernel化しやすい良い境界。

## commit

`_moveMotionTimelineKeySelection()`が:

- transformKeyframes
- warp keyframes
- bone/part rig motion

を変更しHistory化。

## 22.1 Motion Key Dragの終端問題

一部drag handlerは:

```text
if (gesture.moved) {
    _moveMotionTimelineKeySelection(...)
}
else if (upEvent.type === 'pointerup') {
    click commit
}
else if (upEvent.type === 'pointercancel') {
    selection rollback
}
```

となっている。

つまり **`gesture.moved`がtrueならevent typeより先にcommit branchへ入る**。

したがってコード読解上:

> moved後の`pointercancel`がKey moveをcommitする可能性がある。

未移動pointercancelだけはpending selectionを戻す。

これもruntime testが必要。

---

# 23. Layer Transform Key Bundle Drag

こちらは同じAnimation Table内でも挙動が少し良い。

終了処理で:

```text
gesture.moved
AND
endEvent.type === 'pointerup'
```

の場合だけdomain moveをcommit。

pointercancelではcommitしない。

Move中はDrop previewだけ。

つまり **同じファイル内でCancel policyが統一されていない**。

この非対称性自体がGesture Kernel抽出の強い根拠になる。

---

# 24. Viewport Pan / Zoom

現状:

- Pointer Captureあり
- 4px threshold
- pan
- vertical drag zoom
- anchor位置を維持したZoom
- pointercancelはgesture終了

こちらはProject/Historyを変えないruntime UI stateなので、pointercancelで現在view位置を保持すること自体は必ずしも問題ではない。

ただし:
- lostpointercapture policy
- `buttons===0` guard
- rAF coalescing

等はまだTimeline共通文法として揃っていない。

---

# 25. 重要な発見: Gesture terminal policyが機能ごとにバラバラ

現時点の比較:

| Gesture | pointerup | pointercancel | lost capture |
|---|---|---|---|
| WARP point | retain | rollback | rollback |
| WARP brush | retain | rollback | rollback |
| Layer Transform key bundle | commit | no commit | 未確認 |
| Clip Move | commit | **commit risk** | 未確認 |
| Retime | commit | **retain/history risk** | 未確認 |
| Motion Key Drag | commit | **moved時commit risk** | 未確認 |
| Viewport | retain UI state | end | 未確認 |

この不統一は「気持ちよさ」だけでなく安全性/Undo予測可能性にも効く。

---

# 26. 次に作るべき共通Gesture Kernelの最小責務

巨大万能libraryにはしない。

共通化候補:

```text
GestureSession
────────────────────────
pointerId
target
startClient
activation threshold

set/release pointer capture
lost capture handling
buttons===0 fallback

RAF coalescing

terminal:
 - pointerup
 - pointercancel
 - lostcapture
 - Escape
 - blur

optional auto-scroll hook

callbacks:
 - onActivate
 - onFrame
 - onCommit
 - onCancel
────────────────────────
```

**Kernelへ入れないもの:**

- Frame snapの意味
- Layer before/after/insideの意味
- Transform axis snap
- Timeline collision
- History payload
- Project mutation

これらはDomain Adapter側。

---

# 27. TEGAKI向けの候補contract

まだ実装案ではなく、研究上の形。

```js
createGestureSession({
  pointerEvent,
  threshold: 4,

  onActivate(ctx) {},
  onFrame(ctx) {},

  onCommit(ctx) {},
  onCancel(ctx, reason) {},

  autoScroll: optionalAdapter
})
```

Adapter例:

```text
ClipMoveAdapter
 - geometry cache
 - frame/lane resolve
 - canMove plan
 - drop preview
 - commit move

RetimeAdapter
 - lane snapshot
 - preview retime
 - cancel restore
 - commit history

KeyDragAdapter
 - selected keys
 - plan move
 - marker preview
 - commit keys

LayerDnDAdapter
 - row geometry
 - before/after/inside
 - reorder/reparent
```

---

# 28. 外部Gesture部品の位置づけ

## mcut
最も参考になるTimeline Gesture grammar。

## Canvas Timeline
Preview/Commit/Cancelの分離、snap、viewport。

## WeebPaint
`pointer-gesture.ts`, `drag-value.ts`など小型Interaction helper。

## Interact.js
https://github.com/taye/interact.js

- MIT
- Drag / Resize / Snap / AutoScroll / Inertia / Touch

有力用途:
- Floating panel
- panel resize
- generic slider/scrubber

Timeline domain gesture全面置換には向かない。

## SortableJS
既にTEGAKI dependencyに存在。

- AutoScroll
- swap detection
- reorder animation
- touch
- nested

Layer Panel側はまずこれとの比較価値が高い。

## Atlassian Pragmatic Drag and Drop
https://github.com/atlassian/pragmatic-drag-and-drop

- Apache-2.0
- Vanilla/framework independent
- Tree D&D
- before/after/combine
- auto-expand
- auto-scroll

Hierarchy SpineのD&D足回り候補。

## Headless Tree
https://github.com/lukasbach/headless-tree

- MIT
- Tree selection / D&D / rename / search / keyboard D&D

ただしTree state ownershipまで持つため、TEGAKI authorityとの二重化に注意。

---

# 29. 今すぐ置換優先度が低い領域

調査開始時より評価が変わった。

現行TEGAKIにはすでに十分強い車輪がある。

### History
既にCommand型 + memory quota等が育っている。

### Transform authority
Floating selection / preview / history / animation bridgeまである。

### Animation model
Motion Graph / Transform Key / Rig Motion等がかなり成長。

### Emergency Recovery
IndexedDB checkpoint等が既に存在。

### Basic Pen/Input
独自pipelineが育っている。

ここへ外部OSSを丸ごと入れると、果実よりauthority衝突の方が大きくなる可能性が高い。

---

# 30. 今後の高優先Research Bank

現時点では外部車輪の果実が大きい順に:

### A. Gesture / Drag Interaction Core
最優先。

理由:
- Layer
- Timeline clip
- trim
- key
- rig
- sliders

全体の「触った気持ちよさ」に横断的に効く。

### B. Arbitrary Selection Mask
`bounds + local mask`中間設計。

### C. Advanced Line-art Fill
WeebPaint FlatColoringOracle。

### D. Natural Media Brush Backend
Hokusai / `.myb`。

### E. Contextual / Lens UI primitives
Popover / Anchor / Context Inspector / Right Dock。

---

# 31. 次チャットで最初に続けるべき絞り込み調査

## 31.1 Timeline terminal audit

最優先。

対象:
- Clip Move
- Retime
- Motion Key Drag
- Layer Transform Key Bundle
- Viewport gesture

確認項目:
- pointerup
- pointercancel
- lostpointercapture
- window blur
- Escape
- `buttons===0`

やること:
- repo内の既存verify有無確認
- 小さいdiagnostic追加を検討
- WARPのpointer terminal verifierを模範にする
- cancel時にdomain mutationが残るか実ブラウザで確認

特に現在のコード読解では:

- Clip Move pointercancel commit risk
- Retime pointercancel retain/history risk
- Motion Key moved pointercancel commit risk

が見えている。

## 31.2 PointerMove performance profiling

推測で終わらせない。

計測対象:
- Clip Move
- Retime
- Key Drag

見るもの:
- 60Hz / 120Hz pointer
- `document.elementFromPoint`
- `getBoundingClientRect`
- `querySelector`
- `this.render()`
- layout/reflow
- GC
- frame miss

結果を見て:
- rAF coalescing
- geometry cache
- render分離
- CSS preview化

のどれが必要か判断。

## 31.3 Existing WARP gesture grammarの抽出可能性

外部library導入より先に、`LayerTransformWarpController`から:

- pointer capture
- cancel
- lost capture
- preview/retain
- terminal ownership

だけを小さなshared primitiveへ抽出できるか調べる。

目的: **TEGAKI自身の成功パターンをTimelineへ横展開できるか**。

## 31.4 AutoScroll / Snap

比較対象:
- mcut
- Canvas Timeline
- SortableJS
- Pragmatic D&D

特に:
- Timeline端のAutoScroll
- Layer list端のAutoScroll
- Clip edge snap
- playhead/key snap
- frame grid snap
- lane境界hysteresis

## 31.5 Right Dock prototypeの前提調査

まだ大改造しない。

比較すべき3案:

```text
A. 現行Floating Transform

B. 排他的Right Context
   Layers | Transform | Rig

C. Hierarchy Spine + Context Inspector
   hierarchy常時小さく残す
   下だけTransform/Rig/Physics切替
```

Astraへ渡す前に、authorityを変えずUI projectionだけでfixture比較できるか調べる。

## 31.6 Temporal Overview Strip

Canvas TimelineのRange Scrollbarを詳しく読む。

TEGAKIでは:
- Lane mini-mapにしない
- 時間密度だけ集約
- viewport handle
- playhead
- clip/key activity

を同じ薄いstripへ載せる可能性を検討。

---

# 32. Astraへ渡す時の重要注意

このResearch Bankをそのまま「全部やれ」にしない。

AstraへはCapability単位で狭く渡す。

例:

```text
Gesture Terminal Consistency
- current facts
- code references
- external patterns
- 3 options
- one decision requested
```

または:

```text
Right Dock Architecture
- Floating
- Exclusive context
- Hierarchy + Inspector
- constraints
- no implementation
- choose one next experiment
```

同時に:
- GUI全面改修
- History全面改修
- Timeline全面置換
- Rig全面再設計

を一枚のCardへ入れない。

---

# 33. 現在の最重要結論

最初の問い:

> 2026年は「車輪の再発明をしなくてよい状態」になっているか？

現時点の答えは:

**かなりYes。ただし完成車を1台買う時代というより、足回り・トランスミッション・計器・Timeline・Gesture・Brush Engineを部品単位で注文できる時代になっている。**

一方、TEGAKIは既に独自車体がかなり育っている。

したがって今後の方針は:

```text
TEGAKIのauthorityを維持
        ↓
不足Capabilityだけ外部車輪を比較
        ↓
Adapter / Algorithm / Primitiveとして導入
        ↓
GUIはTEGAKIの哲学で再構成
```

が最も自然。

---

# 34. 次チャットへの開始指示

この文書を読んだ次チャットでは、まず新規候補探索へ広げすぎず、以下を完了する。

1. **Timeline terminal audit**
   - Clip Move
   - Retime
   - Motion Key Drag
   - Layer Transform Key Bundle
   - Viewport
2. pointercancel / lostpointercaptureのruntime verifierの必要性を判断
3. GestureSession最小contractを、現行WARP + Layer D&D + mcut + Canvas Timelineの4者比較で確定
4. その結果を「実装指示」ではなくResearch Bankへ追記
5. その後、Right Dock / Hierarchy Spineへ戻る

まだAstraへ最終Cardを作る段階ではない。

特に、**Animation Table全体のリファクタリングを先に始めないこと**。

まずGesture lifecycleを切り出せるかを調べ、同じauthority・同じ見た目のまま一部Gestureだけ移せる小さな実験単位を見つける。

---

# 35. 主要Source

Primary repositories:

- Klecks — https://github.com/bitbof/klecks
- WeebPaint — https://github.com/fangzhangmnm/weebpaint
- miniPaint — https://github.com/viliusle/miniPaint
- desuwa/tegaki — https://github.com/desuwa/tegaki
- ChickenPaint — https://github.com/thenickdude/chickenpaint
- Graphite — https://github.com/GraphiteEditor/Graphite
- mce — https://github.com/qq15725/mce
- modern-canvas — https://github.com/qq15725/modern-canvas
- HeadlessCanvas — https://github.com/elephancube/headlesscanvas-js
- Photoshlopper — https://github.com/noisyloop/photoshlopper
- Canvas Timeline — https://github.com/TechSquidTV/Canvas-Timeline
- Cutaway — https://github.com/S07K/cutaway
- SpriteForge — https://github.com/Wilson-Cheng/SpriteForge
- Hokusai — https://github.com/reearth/hokusai
- mcut — https://github.com/mattppal/mcut
- Interact.js — https://github.com/taye/interact.js
- Pragmatic Drag and Drop — https://github.com/atlassian/pragmatic-drag-and-drop
- Headless Tree — https://github.com/lukasbach/headless-tree
- SortableJS — https://github.com/SortableJS/Sortable

Official/reference sites:

- LYRICA — https://lyrica.jp/
- Canvas Timeline — https://canvastimeline.com/
- Zag.js — https://zagjs.com/
- MDN Popover API — https://developer.mozilla.org/en-US/docs/Web/API/Popover_API

---

# 36. Research confidence labels

今後も以下を区別すること。

**PROVEN / CODE-CONFIRMED**  
Repository codeまたは公式documentで直接確認。

**RUNTIME-UNVERIFIED**  
コード上はそう見えるが、Browserで再現test未実施。

**DESIGN INFERENCE**  
複数実装からTEGAKI向けに推論した設計候補。

**REFERENCE ONLY**  
コード導入ではなくGUI/Architecture学習対象。

この区別を崩さない。

---

# 37. 現在の未完了調査

チャット上限により、以下の確認を始めたところで中断。

- `Clip Move / Retime / Motion Key Drag / Viewport`について
  - pointercancel既存verify検索
  - lostpointercapture既存verify検索
  - Timeline専用pointer terminal diagnostic有無確認

コード読解では問題候補が明確になっているが、**runtime verifierの有無と実動作確認までは未完了**。

次チャットはここから再開する。
