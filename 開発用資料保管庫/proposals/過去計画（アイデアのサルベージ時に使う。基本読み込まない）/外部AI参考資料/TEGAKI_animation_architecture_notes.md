# TEGAKI アニメーション拡張構想  
## ToonSquid比較・素材再利用・Bone／変形・別動画ツール連携・Clip単位の時間密度

- 文書種別: 将来設計の検討メモ
- 主な読者: TEGAKIを調査・実装するCodex／GPT、および開発者
- 対象: ToonSquidとの比較、CAF／Clipの再利用、Bone、Warp／Mesh、選択・変形UI、別動画ツールとの分担、Clip Motionのサブフレーム評価
- 対象外: ベクターペンおよびベクター線・塗りの設計
- 注意: この文書は実装契約ではない。実装前に必ず現行コード、`AGENTS.md`、`TEGAKI.md`、`tegaki_work/PROGRESS.md`、現行Phase指示書と照合すること

---

## 1. 要約

TEGAKIの出発点は、昔ながらのパラパラ漫画型のコマアニメである。  
ToonSquidは手描きコマも扱うが、同時に、描画済み素材・アニメーションクリップ・レイヤー・プロパティを再利用し、Timeline上で変形・演出・合成する汎用アニメーション環境として設計されている。

したがって、TEGAKIをToonSquidと同一のデータモデルへ寄せすぎるべきではない。

推奨方針は次のとおり。

1. **CAFによる整数コマ作画をTEGAKIの正本として維持する。**
2. **Clip Motionは、CAFを置き換えるのではなく、ClipInstanceへ非破壊で重ねる。**
3. **素材の再利用は、画像やCAFの大量コピーではなく、AssetとInstanceの参照関係で実現する。**
4. **Bone、Warp、Meshは段階導入し、最終的にCAF列へBakeして手描き修正へ戻せるようにする。**
5. **TEGAKI内には作画に近い簡易変形を残し、複雑な合成・リタイミング・大量配置は将来の別動画ツールへ分離できるようにする。**
6. **再生・書き出しでは共通の出力時刻を使い、CAF内容の更新頻度とMotion演算の更新頻度を独立させる。**
7. **「人物は12fps、時計の針だけ滑らか」という表現は、Clipごとに異なる動画FPSを持たせるのではなく、内容とMotionのサンプリング規則を分けることで実現する。**

---

## 2. 現行TEGAKIで守るべき境界

現行のAI作業ガイドでは、以下が重要な前提になっている。

- 本番描画はPixiJS RenderTextureへのライブラスター焼き込み。
- 通常LayerとCAF内部Layerは、UIを共有してもデータ正本とHistoryを混同しない。
- CAF編集中のworking Layerは表示・入力用アダプターであり、保存正本ではない。
- Timeline側では `TimelineModel / ClipAsset / DrawingSnapshot` が保存正本。
- Layer PanelとCAFの共有は「1つのUI engine、2つのdata adapter」。
- WebGPU、SDF／MSDF、WebGL2 Mesh等は、正式Phaseまでは不用意に導入しない。
- 新規class、関数、EventBusイベントを作る前に既存実装を検索する。
- 外部の設計案を、そのまま実装契約として扱わない。

本構想も、この境界を崩さないことを前提とする。

特に重要なのは、**CAF内部の作画データ**と、**Timeline上に置かれたClipInstanceの演出データ**を分けることである。

```text
CAF / ClipAsset
  └ 描いた内容、内部Layer、DrawingSnapshot、露出構造

ClipInstance
  └ Timeline上での開始、長さ、位置、回転、拡縮、
     Motion、Loop、時間評価方式、変形設定

Working Layer
  └ 現在編集中のCAFを既存描画エンジンへ接続する一時アダプター
```

---

## 3. ToonSquidとの根本的な違い

### 3.1 ToonSquidの中心

ToonSquidでは、Animation Layerの中にDrawingがあり、Drawingの中にPixel、Vector、Path、Text、Symbol、Group等のLayerが入る。

さらに、LayerのTransform、各種プロパティ、Effect、Bone、Warp、Mesh等へKeyframeを設定できる。Animation ClipはAsset Libraryに保存でき、Symbol Layerから他のClipを参照して再生できる。

概念的には次のようになる。

```text
Scene / Animation Clip
  ├ Timeline Layer
  │   ├ Drawing
  │   │   ├ Pixel Layer
  │   │   ├ Path Layer
  │   │   ├ Symbol Layer → 別Animation Clipを参照
  │   │   └ Effect / Bone / Warp / Mesh
  │   └ Property Keyframes
  └ Camera / Audio / Transform hierarchy
```

ToonSquidは、手描きコマと、部品・素材を再利用したキーフレームアニメーションを、同じ汎用レイヤー体系で扱う。

### 3.2 TEGAKIの中心

TEGAKIの中心は、一枚ずつ描いたCAFをTimelineへ並べ、露出時間を決め、パラパラ漫画として再生することである。

```text
CAFを描く
  ↓
整数Project Frameへ配置
  ↓
露出時間を設定
  ↓
Onion Skinを見ながら次のCAFを描く
  ↓
コマアニメとして再生
```

この単純さは欠点ではなく、TEGAKIの中核である。

### 3.3 同一エンジンへ無理に統合した場合の問題

ToonSquid型へ全面的に寄せると、次の問題が生じる。

- CAF内部の全Layerへ独立した時間軸を持たせる必要が出る。
- 通常Layer、CAF内部Layer、ClipInstance、Effect Layerの責務が混ざる。
- History、保存復元、D&D、選択状態が複雑化する。
- 「現在どのCAFを描いているのか」と「参照Instanceを演出しているのか」が分かりにくくなる。
- コマ作画に不要なInspector、Property Track、Effect Stackが常時UIを占有する。
- ToonSquid相当のSymbol、Scene Graph、Effect Stack、Cameraまで実装しないとモデルの一貫性が取れなくなる。

したがって、ToonSquidからは主に次を学ぶ。

- 選択と変形の操作契約
- Bind PoseとAnimation Poseの分離
- Warp／Meshの編集体験
- Clip再利用の考え方
- Keyframe、Easing、Motion Pathの見せ方
- 非破壊編集とBakeの境界

一方、内部の汎用レイヤー体系をそのまま移植しない。

---

## 4. 推奨するTEGAKIの三層モデル

TEGAKI内のアニメーションを、次の三層に分けると整理しやすい。

### 4.1 Exposure層

整数Project Frame上で、どのCAFを表示するかを扱う。

- CAFの配置
- CAFの露出時間
- CAFの複製
- CAF Group
- Onion Skin
- 手描き修正
- コマ送り
- Hold、Loop等の基本的な内容再生

### 4.2 Motion層

ClipInstance全体へ非破壊の演算を加える。

- Position
- Scale
- Rotation
- Anchor / Pivot
- Opacity
- Blend Strength
- Easing
- Motion Path
- サブフレーム評価
- 将来的な簡易Physics

### 4.3 Deformation層

Clipまたは素材の内部形状を変形する。

- Warp Grid
- Cage / Lattice
- Triangle Mesh
- Bone hierarchy
- Bone Weight
- IK
- Corrective Pose
- Bake to CAF Frames

```text
Exposure
  CAF内容を整数Frameで選ぶ
       +
Motion
  Clip全体のTransformを時間評価
       +
Deformation
  Warp / Bone / Meshを時間評価
       ↓
最終Composite
```

これらは同じ画面に存在できるが、保存データと編集モードを分ける。

---

## 5. 素材・キャラクター・アニメの再利用

### 5.1 鳥一羽を群れとして配置する例

一羽の羽ばたきCAF列を一度作成し、それを20羽へ増やす場合、元データを20個複製する必要はない。

```text
Bird ClipAsset
  └ 羽ばたき8コマ

Bird ClipInstance A
  ├ position: ...
  ├ scale: ...
  ├ start offset: ...
  └ playback speed: ...

Bird ClipInstance B
  ├ position: ...
  ├ scale: ...
  ├ start offset: ...
  └ playback speed: ...
```

各Instanceは同じClipAssetを参照し、次の値だけを個別に持つ。

- Position
- Scale
- Rotation
- Start Frame
- Phase Offset
- Playback Speed
- Loop Mode
- Opacity
- Z order
- Motion Path
- 必要なら乱数Seed

これにより、一羽を修正すると、参照している群れ全体へ更新を反映できる。

### 5.2 AssetとInstanceの区別

推奨する用語と責務は次のとおり。

```text
ClipAsset
  再利用可能な編集正本
  CAF列、DrawingSnapshot、内部Layer等を持つ

ClipInstance
  Timeline上の参照配置
  Motion、開始位置、長さ、Loop、変形等を持つ

Baked Clip
  演算結果を独立したCAF列へ確定したもの
  元Assetから切り離して手描き修正できる
```

「滑らかに動く」「別の開始位相で再生する」といった性質は、原則としてAssetではなくInstanceへ持たせる。

同じAssetを、ある場面では滑らかに動かし、別の場面では12fps刻みで動かせるためである。

Asset側にデフォルト値を持たせるのはよいが、Instanceで上書き可能にする。

### 5.3 AlbumとAsset Library

現在のAlbumが完成画像・完成アニメの保管を目的としている場合、編集可能素材の正本を同じデータ構造へ混ぜるべきではない。

推奨する分離は次のとおり。

```text
Album
  完成PNG、APNG、GIF、WebM等の閲覧・保管

Asset Library
  再編集可能なCAF、ClipAsset、CAF Group、キャラクター、ループ素材

Preset Library
  Motion、Warp、Bone Rig、Easing等の設定
```

UI上は似たカード一覧を共有できるが、保存形式と責務は分ける。

### 5.4 Scatter／群れ生成

将来的にはAsset Libraryから選んだClipAssetを複数配置する補助機能を追加できる。

```text
Scatter設定例

count: 20
area: 600 x 200
phaseRandom: 0..7 frames
scaleRandom: 0.8..1.2
speedRandom: 0.85..1.15
rotationRandom: -10..10 degrees
seed: 12345
```

最初は一度だけ複数Instanceを生成する方式でよい。  
毎フレーム動的に個体を生成するParticle Systemへ直ちに発展させる必要はない。

---

## 6. Boneシステムの可能性

本書ではユーザー記述の「BORN」を、一般的な名称である **Bone** と表記する。

Boneは一つの機能ではなく、複数段階に分けて実装すべきである。

### 6.1 段階1: 剛体パーツの親子Transform

腕、前腕、手、頭、胴体等を別素材として扱い、親子関係で動かす。

```text
root
 └ torso
    ├ head
    ├ upperArm.L
    │  └ foreArm.L
    │     └ hand.L
    └ upperArm.R
       └ foreArm.R
          └ hand.R
```

各Boneまたは部品が持つ基本情報:

- parentId
- localPosition
- localRotation
- localScale
- length
- pivot
- rotationLimit
- bindTransform
- animationTrack

この段階では画像自体は曲がらない。  
切り絵アニメに近いが、比較的安全に実装できる。

### 6.2 段階2: IK

手先や足先のTargetを動かし、中間関節を追従させる。

最初は2 Bone IKで十分である。

```text
shoulder → elbow → handTarget
hip → knee → footTarget
```

必要な要素:

- Target
- Pole方向
- Bend方向
- Stretch許可
- Rotation Limit
- IK/FK切替は将来対応でもよい

### 6.3 段階3: Boneによる柔軟変形

ToonSquidでは、Pixel LayerはBoneによりWarpされ、カスタムMeshを加えた場合はMesh頂点をBoneへBindingできる。TEGAKIでもラスター素材を滑らかに曲げるには、Boneから制御点へのWeightが必要になる。

```text
Bone Transform
  ↓
各Control PointのWeight計算
  ↓
Warp / Mesh頂点を移動
  ↓
ラスター画像を再サンプリング
```

各頂点の変形は、概念的には次のようなLinear Blend Skinningで始められる。

```text
deformedVertex =
  Σ(weight[i] × boneMatrix[i] × bindVertex)
```

実装時は、Weightの正規化、Bind Poseの逆行列、座標系の扱いを明確にする。

### 6.4 Bind PoseとAnimation Pose

UI上で必ず分離する。

```text
Bind Pose
  骨の初期配置、長さ、親子関係、Weight、素材との対応を設定

Animation Pose
  Timeline上でBone TransformへKeyframeを設定
```

Bind Poseの変更とAnimation Keyの編集が同じモードに見えると、Rig全体を誤って破壊しやすい。

### 6.5 関節を綺麗に曲げるための要件

Boneを追加しただけでは、肘や膝は自動的に綺麗にならない。

必要になる可能性があるもの:

- 関節付近だけ細かいMesh
- Boneとの距離に基づく自動Weight
- Weightの局所化
- Weight Paintまたは数値調整
- 部品同士の重なり
- 体積補正
- Corrective Pose
- 曲げ角度に応じた補正Shape
- 最後の手描き修正

TEGAKIらしい解決は、完全なRigを目指すだけでなく、変形結果をCAF列へBakeし、肘や服の皺を手描きで直せるようにすることである。

### 6.6 推奨実装順

```text
1. 部品の親子Transform
2. Pivot編集
3. Rotation Limit
4. 2 Bone IK
5. Bind Pose / Animation PoseのUI分離
6. Boneと簡易Warp点のBinding
7. 自動Weight
8. Weight調整
9. Corrective Pose
10. CAF列へのBake
```

Bone、Mesh、Physics、AI補間を同一Phaseへ詰め込まない。

---

## 7. Warp、Cage、Triangle Mesh

### 7.1 ToonSquidの二種類の変形

ToonSquidには概ね次の二種類がある。

1. **Warp**  
   16個の制御点を持つ固定Gridを操作する簡易変形。

2. **Mesh**  
   ユーザーが制御点を追加し、内部で三角形分割を更新するカスタム変形。

Meshは細部を滑らかに曲げられるが、作成・編集・保存・Hit Testが複雑になる。

### 7.2 TEGAKIの初期実装として推奨する方式

最初は、Triangle Meshをユーザーへ直接編集させるより、固定または粗いWarp Gridを推奨する。

```text
ユーザーに見せるもの
  4 x 4 = 16個の制御点

内部レンダリング
  Gridを自動的に三角形へ分割
```

この方式では、ユーザーは三角形のTopologyを意識せずに変形できる。

### 7.3 データ例

```json
{
  "type": "warpGrid",
  "columns": 4,
  "rows": 4,
  "bindPoints": [
    {"x": 0.0, "y": 0.0},
    {"x": 0.333, "y": 0.0}
  ],
  "tracks": {
    "point:0": [
      {"time": 0.0, "x": 0.0, "y": 0.0},
      {"time": 1.0, "x": 0.1, "y": 0.0}
    ]
  }
}
```

座標をPixel固定にするか、Boundsに対する正規化座標にするかは設計判断が必要である。素材のリサイズ耐性を考えると、Bind Boundsに対する正規化座標が扱いやすい。

### 7.4 Triangle Meshへ進む場合

将来、任意点追加型Meshを導入する場合は、以下を分ける。

- Control Point
- Triangle Index
- UV / Bind Position
- Deformed Position
- Bone Weight
- Boundary
- Selection State
- Topology編集
- Animation Track

内部三角形分割にはDelaunay Triangulation等を検討できるが、正式Phaseで技術選定する。

現行ガイドでWebGL2 Mesh等が凍結されている間は、先行して大規模な描画基盤変更を行わない。

### 7.5 Bake

Warp／Meshは非破壊で保持しつつ、必要に応じて次へ変換できるようにする。

```text
Motion / Warp / Bone結果
  ↓ output sampling
整数CAF Frame列
  ↓
通常のペンで加筆修正
```

Bake時には次を明示する。

- 出力Frame範囲
- Bake FPS
- 元Clipを残すか
- 新しいCAF Groupとして作るか
- Alpha
- Bounds
- Transform適用済みか
- 元AssetとのLinkを維持するか、切るか

---

## 8. 選択・変形UIで参考にすべき点

ToonSquidから最も直接参考にしやすいのは、選択・変形の操作体系である。

ただし、TEGAKIでは編集対象を明確に区別する必要がある。

### 8.1 編集コンテキスト

```text
CAF Draw Mode
  CAFの絵をペンで編集する

Clip Transform Mode
  Timeline上のClipInstance全体を移動・回転・拡縮する

Warp Bind Mode
  Warpの初期Gridと適用範囲を設定する

Warp Animate Mode
  Warp点へKeyframeを設定する

Bone Bind Mode
  骨格、親子、長さ、Weightを設定する

Bone Animate Mode
  BoneへKeyframeを設定する

Asset Edit Mode
  参照元ClipAsset自体を編集する

Instance Edit Mode
  現在の配置だけを編集する
```

### 8.2 必要な操作契約

- Canvas上の直接Hit Test
- 選択対象の明確な枠表示
- Pivot / Anchorの直接移動
- Local / Global座標の切替
- 複数選択
- Shift等による追加選択
- 数値入力とCanvas操作の同期
- Bounds外のHandle操作
- Rotation Snap
- Scaleの縦横固定／解除
- Bind PoseとAnimation Poseの色分け
- Asset編集とInstance編集の色分け
- 一回のDragを一つのHistory transactionへまとめる
- Escapeで操作取消
- Transform確定前のPreviewと、保存正本の分離

### 8.3 「何を動かしているか」を常時表示する

同じTransform Handleでも意味が異なるため、CanvasまたはStatus表示に対象を出す。

```text
Editing: CAF Drawing
Editing: Clip Instance
Editing: Warp Point 5
Editing: Bone foreArm.L
Editing: Source Asset "Bird_01"
```

この表示は、複雑化した将来の事故防止に有効である。

---

## 9. 別動画ツールとの分担

### 9.1 別ツール化は妥当

将来、TEGAKIと連携可能な別ウィンドウの動画ツールを作る構想は、データモデル上もUI上も妥当である。

役割分担の基本は次のとおり。

```text
TEGAKI
  描く
  CAFを並べる
  露出を決める
  Onion Skin
  簡易Motion
  簡易Warp / Bone
  Bakeして加筆する

別動画ツール
  素材を多数配置する
  Clipを入れ子にする
  複雑なリタイミング
  Camera
  Audio
  Effect Stack
  Composite
  Particle / Scatter
  本格Bone / Mesh
  最終編集と書き出し
```

TEGAKIを簡易After EffectsやAviUtlへ変えるより、別ツール側を「素材を演出する場」とするほうが、TEGAKIの作画中心性を維持できる。

### 9.2 別ツールへ移す候補

- CAF Assetの大量Instance配置
- 複雑なMotion Path
- Time Remap
- Reverse
- Speed Ramp
- Nested Clip
- Camera
- Audio Track
- Effect Stack
- Mask / Matte
- 高度なComposite
- Particle / Scatter
- 本格的なBone Rig
- 複雑なTriangle Mesh
- 最終動画編集

### 9.3 TEGAKIに残す候補

- CAF作画
- CAF Group
- 整数Frame露出
- Onion Skin
- Clip単位の基本Transform
- Easing
- Motion Path
- Subframe Motion
- 16点程度の簡易Warp
- 簡易Bone
- Bake to CAF
- Asset Libraryへの登録

### 9.4 初期連携はファイル交換で十分

最初から別ウィンドウ間のリアルタイム同期を実装する必要はない。

推奨する段階:

```text
Phase 1
  TEGAKIから交換ファイルを書き出す
  別動画ツールで読み込む

Phase 2
  別動画ツールから動画またはCAF列を書き出す
  TEGAKIで読み込む

Phase 3
  ブラウザ内D&D

Phase 4
  Source Asset更新の再読込

Phase 5
  必要ならBroadcastChannel / postMessage等による連携
```

### 9.5 交換形式の案

拡張子例: `.tegclip` または `.tegscene`

実体はZIPパッケージでもよい。

```text
example.tegclip
├ manifest.json
├ thumbnail.webp
├ frames/
│  ├ 0001.png
│  ├ 0002.png
│  └ ...
├ editable/
│  ├ timeline.json
│  ├ assets.json
│  └ snapshots.json
└ audio/
```

`manifest.json`の候補:

- formatVersion
- applicationVersion
- assetId
- revision
- canvasWidth
- canvasHeight
- drawingFps
- durationSeconds
- frameCount
- alphaMode
- bounds
- anchor
- loopMode
- requiredFeatures
- sourceApplication
- checksum

### 9.6 戻し方を二種類に分ける

別動画ツールからTEGAKIへ戻すとき、完全な可逆性を常に保証しない。

```text
Editable Return
  TEGAKIが理解できるTransform、CAF、基本Motion等だけを戻す

Baked Return
  Warp、Bone、Blur、Composite等をRaster化し、CAF列として戻す
```

「編集可能性」と「見た目の完全保持」は別の要求である。

両方を常に満たそうとすると、TEGAKIと別動画ツールの機能を同一にする必要が生じる。

### 9.7 共有すべきもの

二つのアプリで同一のCanvas DOMやWebGL Contextを共有する必要はない。

共有すべきなのは、次の純粋な評価・描画モジュールである。

```text
tegaki-render-core
  ├ sampleCAFContent(time)
  ├ sampleClipMotion(time)
  ├ sampleWarp(time)
  ├ sampleBoneRig(time)
  ├ compositeScene(time)
  └ exportFrame(time)
```

各アプリは別Canvasを所有する。

```text
TEGAKI UI
  └ tegaki-render-core
       └ TEGAKI Canvas

Video UI
  └ tegaki-render-core
       └ Video Canvas
```

共有してはいけないもの:

- 現在の選択状態
- Popup状態
- Drawing pointer state
- CAF working Layer
- Undo / Redo stack
- UI専用Store
- 一方のアプリ固有のTimeline編集状態

---

## 10. Clipだけ滑らかに動く時間モデル

### 10.1 目的

例:

- キャラクターの手描きアニメは12fps。
- 時計の針だけ60fps相当で滑らかに回転する。
- 歩行の手足は12fpsだが、身体全体の横移動は滑らか。
- 手描きの炎は8fpsだが、発光量は連続変化。
- 通常世界は低FPSだが、異物だけ高密度に動く。

これは不整合ではなく、意図的な演出である。

### 10.2 重要な定義

最終動画ファイルの各場所が別々のFPSを持つわけではない。

最終出力は一つのFPSを持つ。  
各出力時刻に対し、要素ごとに別のサンプリング規則を使う。

```text
共通Output Time
  ├ CAF内容: 12fpsの整数コマをHold
  ├ Clip Motion: 毎出力サンプルで連続補間
  ├ Warp: 毎出力サンプルで連続補間
  └ 別Clip Motion: 6fps刻みでHold
```

したがって、「Clipが60fps」というUI表現は使えても、内部概念としては **Subframe Motion** または **Continuous Motion Sampling** のほうが正確である。

### 10.3 編集FPSと出力FPS

例:

```text
drawingFps = 12
outputFps = 60
```

1秒間にCAFは12回切り替わり、Rendererは60回サンプリングする。

```text
Output sample 0..4   → CAF frame 0
Output sample 5..9   → CAF frame 1
Output sample 10..14 → CAF frame 2
```

一方、時計の針のRotationは各出力時刻で再計算する。

### 10.4 時刻を秒で管理する

再生・書き出しの中心は、整数Frameではなく秒とする。

```js
const timeSeconds = outputFrame / outputFps;
const projectPosition = timeSeconds * drawingFps;
```

CAF内容:

```js
const drawingFrame = Math.floor(projectPosition);
const drawing = sampleCAFAtIntegerFrame(clip, drawingFrame);
```

Motion:

```js
const localTime = timeSeconds - clip.startTimeSeconds;
const motion = sampleClipMotion(clip, localTime);
```

最終描画:

```js
renderClip({
  drawing,
  motion,
  timeSeconds
});
```

### 10.5 内容とMotionのサンプリングを分離する

推奨するデータ構造:

```json
{
  "projectTime": {
    "drawingFps": 12,
    "previewFps": 60,
    "exportFps": 60
  },
  "clipInstance": {
    "contentSampling": {
      "mode": "hold",
      "sourceFps": 12,
      "loopMode": "once"
    },
    "motionSampling": {
      "mode": "continuous"
    }
  }
}
```

`motionSampling.mode` の候補:

```text
continuous
  出力時刻ごとに補間する

stepped
  指定したstepFpsの時刻へ量子化する

hold
  次のKeyまで前値を保持する
```

例:

```json
{
  "motionSampling": {
    "mode": "stepped",
    "stepFps": 6
  }
}
```

### 10.6 AssetではなくInstanceへ持たせる

同じ時計Assetを、

- 滑らかな秒針
- 1秒刻みの秒針
- 12fpsのぎこちない秒針
- 逆回転
- 停止

として使える必要がある。

したがって、時間評価規則はClipAssetへ固定せず、ClipInstanceへ持たせる。

```text
ClipAsset
  時計の盤面と針の画像

ClipInstance A
  continuous

ClipInstance B
  stepped 1fps

ClipInstance C
  stepped 12fps
```

Asset側に推奨デフォルトを持たせるのは可。

### 10.7 Keyframeの配置は整数Frameから開始できる

編集UIを60個の細かいマスへ変更する必要はない。

```text
Frame 1  : rotation = 0°
Frame 13 : rotation = 360°
```

編集上は12fpsの整数FrameへKeyを置き、再生時には間を60fps相当で補間する。

必要になった場合だけ、サブフレーム位置を編集可能にする。

```text
通常Scrub
  整数Project FrameへSnap

修飾キー付きScrub
  Subframe確認

再生・Export
  Output Timeで連続評価
```

### 10.8 Onion Skin

Onion Skinは原則として整数CAF Frameを対象にする。

60fps分のOnionを重ねると密集して見にくくなる。

Motionの途中状態を確認する機能は、Onion Skinではなく次で補う。

- Motion Path
- Ghost Preview
- 一時的なSubframe Scrub
- 前後1サンプルだけのMotion Ghost
- Graph Editor

### 10.9 Preview

`requestAnimationFrame`の呼出回数をFrame番号として使わない。

経過時間から状態を評価する。

```js
function preview(nowMs) {
  const timeSeconds = (nowMs - startMs) / 1000;
  renderAtTime(timeSeconds);
  requestAnimationFrame(preview);
}
```

処理落ち時は表示サンプルを飛ばし、時間そのものを遅らせない。

### 10.10 Export

すべての出力形式で、同じ `renderAtTime(timeSeconds)` を使う。

```js
for (let i = 0; i < outputFrameCount; i++) {
  const timeSeconds = i / outputFps;
  const frame = renderAtTime(timeSeconds);
  encoder.add(frame);
}
```

PreviewとExportで別々のMotion評価を行わない。

推奨:

- WebM / MP4: 60fps出力に適する。
- APNG: 可能だがFrame数と容量が増える。
- GIF: 時間精度、容量、色数に制約があるため警告を検討する。

### 10.11 Cache

12fps CAFを60fps出力する場合、同じCAF内容を5回再構築する必要はない。

```text
CAF合成結果
  integer drawingFrame単位でCache

Motion / Warp / Bone
  output sampleごとに評価

Final Composite
  output sampleごとに実行
```

時計の例:

```text
時計盤Raster
  Cache

針Raster
  Cache

針のRotation Matrix
  毎sample更新
```

### 10.12 最小仕様

初期実装としては次で十分である。

```text
Project
  drawingFps: 12
  outputFps: 12 / 24 / 30 / 60

CAF
  整数Project Frameで切替
  中間はHold

ClipInstance
  subframeMotion: ON / OFF

ON
  position / scale / rotation / opacityを連続補間

OFF
  Motion値も整数Project Frameへ量子化
```

概念的な評価:

```js
const motionSamplePosition = clip.subframeMotion
  ? projectPosition
  : Math.floor(projectPosition);
```

その後、`stepped 6fps`、`stepped 8fps`、`continuous`等へ拡張する。

---

## 11. データモデル案

以下は概念案であり、既存classへ直ちに追加する契約ではない。

```ts
type SamplingMode = "continuous" | "stepped" | "hold";

interface ProjectTimeConfig {
  drawingFps: number;
  previewFps: number;
  exportFps: number;
}

interface ContentSampling {
  mode: "hold" | "loop" | "pingPong" | "once";
  sourceFps?: number;
  frameOffset?: number;
}

interface MotionSampling {
  mode: SamplingMode;
  stepFps?: number;
}

interface ClipInstance {
  id: string;
  assetId: string;

  startFrame: number;
  durationFrames: number;

  contentSampling: ContentSampling;
  motionSampling: MotionSampling;

  anchor: { x: number; y: number };
  motionTracks: MotionTrack[];
  deformerId?: string;
  boneRigId?: string;
}

interface MotionTrack {
  property:
    | "positionX"
    | "positionY"
    | "scaleX"
    | "scaleY"
    | "rotation"
    | "opacity"
    | "blendStrength";
  keys: MotionKey[];
}

interface MotionKey {
  time: number;
  value: number;
  interpolation: "hold" | "linear" | "bezier";
  easing?: [number, number, number, number];
}
```

時間をFrame単位で保存するか秒単位で保存するかは、既存モデルとの互換性を見て決める。

候補:

1. **整数Project Frame + 小数Subframe**
2. **秒**
3. **整数Tick**

長期的には整数Tickが安全だが、初期実装では既存Frame座標を維持し、小数評価をRuntimeだけに限定する方法もある。

重要なのは、Preview、Timeline、Onion、Exportが同じ時間変換関数を使うことである。

---

## 12. 共通Samplerの設計

時間評価は副作用のない純粋関数へ寄せる。

```ts
interface SampleContext {
  timeSeconds: number;
  drawingFps: number;
  outputFps: number;
}

interface ClipSample {
  assetId: string;
  drawingFrame: number;
  transform: TransformValue;
  opacity: number;
  warp?: WarpSample;
  bones?: BoneSample;
}
```

```js
function sampleClipInstance(clip, context) {
  const projectPosition = context.timeSeconds * context.drawingFps;

  const drawingFrame = sampleContentFrame(
    clip.contentSampling,
    projectPosition,
    clip
  );

  const motionPosition = sampleMotionPosition(
    clip.motionSampling,
    projectPosition,
    context
  );

  return {
    assetId: clip.assetId,
    drawingFrame,
    transform: sampleTransformTracks(clip.motionTracks, motionPosition),
    warp: sampleWarp(clip, motionPosition),
    bones: sampleBones(clip, motionPosition)
  };
}
```

同じSamplerを使用する場所:

- 通常Preview
- Animation Table preview
- Motion Path
- Graph表示
- Onion補助表示
- Thumbnail
- APNG
- GIF
- WebM
- MP4
- Bake to CAF
- 将来の別動画ツール

SamplerにDOM操作、選択変更、History記録を入れない。

---

## 13. 実装Phase案

### Phase A: 時間モデルとSubframe Motion

- `drawingFps` と `outputFps` を分離。
- 秒からProject Positionへの共通変換。
- ClipInstanceの `subframeMotion`。
- Position、Scale、Rotation、Opacityだけを対象。
- PreviewとExportを同じSamplerへ寄せる。
- CAF内容は整数Frame Holdのまま。
- Cache確認。
- 保存復元。
- Undo / Redo。
- 12fps人物 + 滑らかな時計針の検証Scene。

### Phase B: Asset参照

- ClipAssetとClipInstanceの参照境界を監査。
- Asset Libraryの最小UI。
- 同じAssetを複数Instance配置。
- InstanceごとのPhase Offset、Loop、Transform。
- Source Asset変更の反映。
- Instanceの「独立化」または「Bake」。

### Phase C: 選択・変形UI整理

- Canvas Hit Test。
- ClipInstanceの直接選択。
- Pivot移動。
- Local / Global。
- 複数選択。
- History transaction。
- Asset編集とInstance編集の表示分離。

### Phase D: 簡易Warp

- 固定4x4 Grid。
- Bind状態。
- Warp点移動。
- Warp Keyframe。
- Render cacheとの統合。
- CAF列へのBake。
- Triangle Meshは内部自動生成に限定。

### Phase E: 剛体Bone

- Bone hierarchy。
- Bind Pose。
- Animation Pose。
- Parent Transform。
- Rotation Limit。
- 2 Bone IK。
- 部品素材の親子変形。
- Bake。

### Phase F: Bone Deformation

- Warp点へのBone Binding。
- 自動Weight。
- Weight編集。
- 関節テスト。
- Corrective Poseの検討。
- パフォーマンス計測。

### Phase G: 別動画ツール交換形式

- `.tegclip` manifest。
- TEGAKI Export。
- 別ツールImport。
- Baked Return。
- Editable Return。
- その後にD&Dやウィンドウ間通信を検討。

---

## 14. 受け入れテスト例

### 14.1 混在時間密度

- Project drawingFps = 12。
- Export FPS = 60。
- 人物CAFは12fpsで5サンプルずつHoldされる。
- 時計針は毎出力サンプルでRotationが変わる。
- PreviewとExportの見た目が一致する。
- Subframe Motion OFFでは時計針も12fps刻みになる。
- 保存復元後に設定が維持される。

### 14.2 Asset再利用

- 一羽の鳥Assetを20Instance配置できる。
- InstanceごとにPosition、Scale、Phaseが異なる。
- 元Assetの一コマを修正すると全Instanceへ反映される。
- 一つのInstanceだけBakeして独立修正できる。
- 元Asset削除時に参照切れを安全に扱う。

### 14.3 Warp

- 4x4 Gridを表示できる。
- Drag中に滑らかにPreviewされる。
- Undo一回で一回のDragが戻る。
- Bind状態とAnimation状態を混同しない。
- Bake後のCAFを通常ペンで編集できる。

### 14.4 Bone

- 親Boneを回転すると子が追従する。
- Bind Pose変更が既存Animation Keyを不意に上書きしない。
- IK Targetで肘または膝が安定して曲がる。
- Rotation Limitを越えない。
- Bake結果とPreviewが一致する。

---

## 15. 非目標

初期Phaseでは、以下を同時に狙わない。

- ToonSquidの全Layer体系の再現
- 全CAF内部Layerの全Property Keyframe化
- 完全なScene Graph
- 本格After Effects互換
- Live2D互換
- 高度なParticle System
- 本格的な3D
- 複雑なPhysics
- AI中割りとBone／Meshの同時導入
- リアルタイムの別ウィンドウ共同編集
- すべての外部動画ツールとの完全可逆交換
- WebGPU／WebGL2 Mesh基盤の先行置換
- ベクターペン設計

---

## 16. Codex／GPTへの作業指針

この文書を読んだAIは、直ちに実装を開始せず、次の順で確認すること。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 現行 `task-codex/phase*.md`
5. 指示書から参照された境界文書
6. 関係する既存class、EventBusイベント、保存形式、History経路
7. 本文書

実装提案を作る際は、次を明記する。

- 現在の保存正本は何か。
- working Layerへ何を持たせるか。
- ClipAssetとClipInstanceのどちらへ保存するか。
- Preview、Export、Bakeが同じSamplerを使うか。
- History transactionの単位。
- 保存形式のVersioning。
- 既存ProjectのMigration。
- 通常LayerとCAF内部Layerの境界。
- Performance Cacheの無効化条件。
- 対象外ファイルを変更しないこと。
- 現行Phaseと衝突しないこと。

新規classやEventを提案する前に、必ず `rg` 等で既存実装を検索する。

この文書にあるinterface名やJSON名は概念例であり、既存名と重複・矛盾する場合は既存設計を優先する。

---

## 17. 未決事項

実装Phase化の前に、次を決める必要がある。

1. Projectの時間正本をFrame、秒、Tickのどれにするか。
2. `drawingFps` と既存FPS設定の互換性。
3. Preview FPSを固定値にするか、Display refreshへ追従させるか。
4. Motion Keyを当初からSubframeへ置けるようにするか。
5. Warp座標をPixel、正規化座標、Local Boundsのどれにするか。
6. Asset LibraryをProject内だけにするか、IndexedDBで横断共有するか。
7. Asset修正をInstanceへ即時反映するか、Revision確認を挟むか。
8. Bake後に元AssetとのLinkを残すか。
9. Bone RigをAssetへ持たせるか、Instance上書きを許可するか。
10. 別動画ツールの交換形式を公開仕様にするか。
11. GIFやAPNGでSubframe Motionをどう制限・警告するか。
12. ScatterをTEGAKIに入れるか、別動画ツール専用にするか。

---

## 18. 設計上の最終判断

TEGAKIは、ToonSquidと同じアプリを目指す必要はない。

TEGAKIに適した方向は次である。

```text
手描きCAFが正本
  +
ClipInstanceの非破壊Motion
  +
簡易Warp / Bone
  +
必要ならCAF列へBake
  +
高度な演出は別動画ツールへ渡せる
```

特に、低FPSの手描き部分と、連続演算されるMotionを同じ画面へ混在させる機能は、単なる高FPS対応ではない。

```text
描いた時間
  と
演算された時間
```

を意図的にずらし、そのミスマッチを表現へ使う機能である。

これはToonSquidの模倣ではなく、パラパラ漫画を出発点とするTEGAKI独自のアニメーション思想になり得る。

---

## 参考資料

### TEGAKI

- `AGENTS.md`  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/AGENTS.md
- `TEGAKI.md`  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/TEGAKI.md
- `tegaki_work/PROGRESS.md`  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/tegaki_work/PROGRESS.md
- 短中期ロードマップ  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/%E9%96%8B%E7%99%BA%E7%94%A8%E8%B3%87%E6%96%99%E4%BF%9D%E7%AE%A1%E5%BA%AB/proposals/01_%E7%9F%AD%E4%B8%AD%E6%9C%9F%E3%83%AD%E3%83%BC%E3%83%89%E3%83%9E%E3%83%83%E3%83%97.md
- 変形アニメーション・メッシュ・GPU画材ロードマップ  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/%E9%96%8B%E7%99%BA%E7%94%A8%E8%B3%87%E6%96%99%E4%BF%9D%E7%AE%A1%E5%BA%AB/proposals/09_%E5%A4%89%E5%BD%A2%E3%82%A2%E3%83%8B%E3%83%A1%E3%83%BC%E3%82%B7%E3%83%A5%E3%83%BBGPU%E7%94%BB%E6%9D%90%E3%83%AD%E3%83%BC%E3%83%89%E3%83%9E%E3%83%83%E3%83%97.md
- Motion Graph・Easing・Motion Path設計  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/%E9%96%8B%E7%99%BA%E7%94%A8%E8%B3%87%E6%96%99%E4%BF%9D%E7%AE%A1%E5%BA%AB/proposals/10_Motion_Graph%E3%83%BBEasing%E3%83%BBMotion_Path%E8%A8%AD%E8%A8%88.md

### ToonSquid公式Handbook

- Animation Layer  
  https://toonsquid.com/handbook/layers/animation/
- Drawings  
  https://toonsquid.com/handbook/layers/drawings/
- Timeline  
  https://toonsquid.com/handbook/interface/timeline/
- Symbol Layer  
  https://toonsquid.com/handbook/symbols/symbol_layer/
- Animation Clips  
  https://toonsquid.com/handbook/symbols/animation_clips/
- Keyframes  
  https://toonsquid.com/handbook/keyframes/keyframes/
- Bones  
  https://toonsquid.com/handbook/effects/bones/
- Mesh  
  https://toonsquid.com/handbook/effects/mesh/
- Warp  
  https://toonsquid.com/handbook/effects/warp/
- Transform Tool  
  https://toonsquid.com/handbook/transform/transform_tool/
