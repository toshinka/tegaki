# Tegaki: 単一ラスター画像を複数PIVOT／ボーンで動かす自動メッシュリグ構想

**文書種別:** Codex向け調査・設計提案依頼書（実装契約ではない）  
**作成日:** 2026-08-04  
**対象:** Tegaki 現行リポジトリ  
**目的:** 現在の実装と技術方針を照合したうえで、実現可能性、採用方式、段階実装案、懸念点をCodexに再検討してもらう

---

## 0. Codexへの最初の指示

この文書は、外部検討をまとめた**調査の叩き台**であり、そのまま実装してよいPhase指示書ではない。

作業開始時は必ず、リポジトリ内の現行正本を次の順で読むこと。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 現在の `task-codex/` 指示書
5. 本件に関連する現行proposal、境界文書、実コード

その後、`rg` で以下を実検索し、存在するfile、class、event、payload、保存形式、History契約、描画経路と照合すること。

- `pivot`, `anchor`, `clip motion`, `transform`
- `control-mesh`, `warp-grid`, `deformer`, `rasterizer`, `topology`
- `ClipAsset`, `DrawingSnapshot`, `TimelineModel`, `working Layer`
- `RenderTexture`, `Mesh`, `MeshGeometry`, `Texture`
- project save / restore / export / History
- 通常LayerとCAF internal Layerのデータ境界

**注意:** URL索引や過去proposalのパス・記述が現行treeとずれている可能性がある。ファイル名や設計を推測せず、ローカルの実体を正本として報告すること。

この依頼の第一成果物はコードではなく、次を含む**再調査レポートと実装提案**とする。

- 現行コード上の差し込み位置
- 実現可能／不可能な範囲
- 推奨アルゴリズムと代替案
- 最小技術試作の仕様
- Phase分割
- 変更候補file一覧
- 受け入れ条件
- 既存機能への回帰リスク
- オーナー判断が必要な未決事項

主要な設計判断を行う前に、調査結果をオーナーへ提示すること。

---

## 1. 要望の背景

現在のCLIPMotionでは、基本的に1レイヤーに1つのPIVOT／アンカーを設定し、レイヤーまたはClip全体を位置・回転・拡縮する設計だと理解している。

一般的な腕リグでは、次のようにパーツを分離する。

```text
手レイヤー
前腕レイヤー
上腕・肩側レイヤー
```

それぞれへPIVOTを置き、親子関係またはボーンで接続する。この方式は制御しやすいが、描画済みの一枚絵を動かすためにレイヤー分けと隠れ部分の描き足しが必要になる。

今回検討したいのは、その「ズボラ版」である。

> 一枚のラスターLayerに複数のPIVOTを置き、肩・肘・手首などを指定するだけで、内部を自動メッシュ化し、ゴム人形のように曲げたり引っ張ったりできないか。

ユーザー体験としては簡単であることを優先する。

```text
Layerを選択
  ↓
クイックリグを開始
  ↓
肩・肘・手首などへPIVOTを打つ
  ↓
自動で対象領域とメッシュを生成
  ↓
関節または末端をドラッグして変形
```

ただし内部では、単純なLayer行列変形ではなく、画像の存在範囲、三角形メッシュ、ボーン階層、頂点ウェイト、UV、変形後の描画処理が必要になると考えられる。

---

## 2. 今回の暫定結論

### 2.1 主方式は「3点レール」ではなく「面メッシュ」

細長い線や帯だけなら、中心・外側・内側の3列を持つストローク／レールメッシュは有効である。しかし、腕にも幅、陰影、塗り、肩の丸み、肘周辺の面積がある。顔、胴体、服、複合キャラクターでは、3列だけでは面内のひずみを十分に分配できない。

したがって、一枚絵を強引に動かす本構想の基盤は次とするのが妥当と考える。

> **アルファ輪郭へ追従する外周 + 内部へ配置した頂点 + 三角形トポロジーを持つ、ToonSquid寄りのカスタム面メッシュ**

PIVOT列はメッシュの代わりではなく、ボーン生成、密度制御、ウェイト推定、関節位置の教師情報として使う。

### 2.2 レール方式は捨てず、局所補助へ回す

3点レール／ストロークメッシュは次へ限定して残す。

- 単独の主線
- 髪束、尻尾、触手、紐、細い袖、指
- 顔輪郭、口、目など、崩れが目につきやすい特徴線
- 面メッシュ内へ追加する「強制エッジ」または「特徴線制約」

つまり将来的な理想は、次のハイブリッドである。

```text
面の変形        : 輪郭追従の内部三角メッシュ
細長い部位      : ストリップ／3レールメッシュ
重要な主線      : 特徴線制約または局所補助レール
駆動            : 複数PIVOTから作るボーン階層
全体の移動      : 既存CLIPMotion
```

### 2.3 CLIPMotionとローカルメッシュ変形を分離する

既存CLIPMotionがClip／Layer全体のアフィン変形を担当しているなら、そこへ非線形メッシュ変形を直接混ぜない方がよい。

推奨する合成順の概念は次の通り。

```text
不変の元ラスター／DrawingSnapshot
  ↓
Mesh Rigのローカル非線形変形
  ↓
既存CLIPMotionの位置・回転・拡縮・不透明度
  ↓
既存compositor / preview / onion / export
```

UI上は同じ「動かす」機能に見せてもよいが、データ正本、History、保存、評価順序は分離する。

---

## 3. 参考ツールから読み取れること

## 3.1 ToonSquid: Mesh effect

ToonSquidのMesh effectは、Layer内容をカスタム三角メッシュへ対応づけ、頂点を手動またはbonesで動かす方式である。インポート画像から変形可能なキャラクターリグを作ることが代表用途として明記されている。

重要な特徴:

- Layer内容をカスタム三角メッシュへマッピングする
- 点を追加すると三角形が自動更新される
- メッシュの三角形が存在する領域だけが表示対象になる
- effects無効時はbind pose側のメッシュを編集する
- effects有効時は変形頂点にkeyframeを作る
- 細部や大きく変形する領域では小さい三角形を使い、変形の少ない単色領域では大きい三角形を使うことを推奨している

本件への示唆:

1. **均一格子より、変形量と絵の情報量に応じた可変密度が適する。**
2. **セットアップ状態とアニメ状態をUI・データ上で明確に分ける必要がある。**
3. **元画像を破壊せず、メッシュを非破壊Effectとして扱う思想が合う。**
4. 手動点追加・削除・移動は、自動生成が失敗した場合の修正手段として必要になる。

## 3.2 ToonSquid: Bones / binding / IK

ToonSquidでは、bonesがLayer、path control point、mesh control pointなどへbindingされる。Pixel layerはbone binding時に自動warpされるが、より正確に制御したい場合はcustom meshを使う。

重要な特徴:

- 1つのbones effect内で階層を作る
- bind poseを先に定義し、通常の編集ではkeyframeを作る
- 頂点への影響はboneとの距離、bone長、strengthなどで決まる
- rotation limit、independent rotation、IK target、stretch上限を持つ
- 腕なら上腕 → 前腕 → 手の階層を作る
- Pixel layerを細かく制御する場合はmesh頂点へbonesをbindする

本件への示唆:

- 「1 Layerに複数PIVOT」は、内部表現としては**複数boneを持つ1 rig**とするのが自然。
- 肩・肘・手首のPIVOT列から、親子boneとbind poseを自動作成できる。
- 末端ドラッグによる簡易IKは「すぐ動かせる」体験に有効。
- 初期版でもbone rotation limitとstretch可否をデータに持たせる余地は確保したい。

## 3.3 ToonSquid: Warp effect

Warp effectは16 control pointの固定格子でLayerを変形する。簡単な自由変形には向くが、輪郭へ追従せず、関節や細い形状に必要な局所密度を作りにくい。

本件への示唆:

- 既存Tegakiのwarp-gridが固定格子中心なら、それだけで最終形にするのは難しい。
- ただし、描画preview、UV補間、triangle rasterization、History、保存の基盤として再利用できる可能性がある。

## 3.4 OpenToonz: Plastic Tool

OpenToonz Plastic Toolは、一枚のdrawingのoutlineから三角形meshを作り、skeletonと組み合わせて変形する。単一drawingを動かすユースケースを公式に想定している。

本件への示唆:

- 「単一ラスター → 輪郭抽出 → 三角形mesh → skeleton」は既存実例がある。
- textureとmeshを別正本として保持し、mesh境界内でtextureを変形表示する設計が参考になる。

## 3.5 Live2D Cubism: Automatic Mesh / Stroke mesh-mapping

Live2Dは、自動メッシュと手動メッシュを併用する。自動生成が半透明ゴミに影響されるため、透明とみなすalpha閾値を調整できる。また、睫毛や口など詳細変形が必要な箇所は手動編集を推奨している。

Stroke mesh-mappingでは、ドラッグしたpathからmeshを作り、幅、繰り返し密度、幅方向の頂点数1・2・3を調整できる。

本件への示唆:

- alpha thresholdは必須設定候補。
- 全自動だけでなく、局所頂点追加、輪郭保護、特徴線追加が必要。
- 3点レールはLayer全体の基盤ではなく、主線・細帯・局所補強に向く。
- Live2D級の顔向き変更は、Layer分離、隠れ部分、パーツ別meshを前提とするため、本件の単一ラスター方式で同等品質を約束してはいけない。

## 3.6 Rive: raster mesh + bones

Riveもraster graphicへmeshを追加し、自然な変形にbonesを利用する。custom contour、forced edge、weight編集の概念がある。

本件への示唆:

- 自動mesh後に「輪郭／強制エッジ」を修正できる設計が有効。
- 内部特徴線を単なる画像解析結果ではなく、topology上のforced edgeとして扱う案がある。

## 3.7 研究例（参考。実装依存にはしない）

2026年の`SPRITETOMESH` preprintは、sprite maskを得た後、輪郭簡略化、内部視覚境界への点配置、Delaunay triangulation、maskによるtriangle filteringを組み合わせている。学習器へ頂点位置を直接予測させるより、「mask取得は学習、点配置はアルゴリズム」という分業を提案している。

本件では最初からAI segmentationを導入せずとも、透明Layerならalpha maskを直接使える。参考になるのは次の点である。

- 輪郭点だけでなく内部の視覚境界へ点を置く
- Delaunay後にmask外triangleを除去する
- 一意な正解がない頂点配置を完全AI任せにしない

`Bunraku`は単一イラストをLive2D形式へ分解・mesh化する研究だが、Layer分離と隠れ部分生成を含むため、本件の「分離せず素早く動かす」最小構想より大規模である。将来の自動パーツ分解の参考に留める。

---

## 4. 推奨する内部概念

名称は既存実装との衝突を調査して決めること。以下は説明用の仮称である。

### 4.1 MeshRigDefinition

bind poseと変形構造を保持する正本。

```js
{
  id,
  version,
  targetType,       // normalLayer / cafDrawing / clipAsset 等。現行境界に合わせる
  targetId,

  sourceRevision,   // 元ラスター更新検知
  sourceBounds,     // Layer local座標の保存矩形
  alphaThreshold,
  padding,

  components: [
    {
      id,
      contourLoops, // outer + holes
      vertexRange,
      indexRange
    }
  ],

  vertices: [
    {
      restX,
      restY,
      u,
      v,
      stiffness,
      flags
    }
  ],

  indices: [],      // triangle index

  bones: [
    {
      id,
      name,
      parentId,
      restStart,
      restEnd,
      strength,
      allowStretch,
      minRotation,
      maxRotation
    }
  ],

  weights: [
    // 1 vertexあたり最大2〜4 bone程度の疎な影響を検討
  ],

  featurePaths: [
    {
      id,
      type,         // contour / stroke / seam / rigidEdge
      vertexIds,
      strength
    }
  ],

  generationSettings: {
    densityPreset,
    jointDensity,
    curvatureDensity,
    minEdgeLength,
    maxEdgeLength
  }
}
```

### 4.2 MeshRigPose

frameまたはClip上の姿勢。全頂点座標を毎frame保存せず、bone transformや少数control pointを保存する。

```js
{
  rigId,
  frame,
  bones: {
    [boneId]: {
      rotation,
      translationX,
      translationY,
      scaleX,
      scaleY
    }
  },
  controls: {
    // 手動補正pointを採用する場合のみ
  }
}
```

### 4.3 Runtime deformation

```text
MeshRigDefinition.bind pose
+ MeshRigPose
  ↓
bone global transform計算
  ↓
vertex skinning
  ↓
必要なら局所rigidity補正
  ↓
triangle inversion / bounds検査
  ↓
Mesh geometry更新
  ↓
既存CLIPMotionを後段適用
```

---

## 5. 自動メッシュ生成の推奨パイプライン

## 5.1 対象領域の決定

最初から「これは腕である」という意味認識を必須にしない。

透明背景のLayerなら、次の順で対象領域を決められる。

1. Layerのalphaを取得する
2. `alpha >= threshold` をforegroundとする
3. connected componentを抽出する
4. 最初のPIVOTを含むcomponentを優先する
5. 複数componentへPIVOTが置かれた場合は、1 rig内の複数submeshとして保持する
6. 必要に応じてmaskを数px膨張させる

腕と胴体が同じ塗りで接続している場合、alphaだけでは境界が分からない。初期版では次の修正入口が必要になる。

- 現在のselectionを対象maskとして使う
- 境界を横切るcut lineを描く
- mask追加／削除brush
- PIVOTから一定距離またはbone周辺だけを候補にする

AIによる腕認識は将来案であり、最初の依存にしない。

## 5.2 輪郭抽出

候補:

- marching squares等でouter contourとholeを抽出
- 輪郭をRamer–Douglas–Peucker等で簡略化
- 高曲率部、細い首、関節近辺は簡略化を弱める
- 輪郭点が近すぎる箇所を統合
- self-intersectionと極小loopを除去

### 外周を画像より少し外へ出す案

ユーザー案として、画像輪郭ぴったりではなく、1〜数px外側へmesh boundaryを置きたい。

利点:

- アンチエイリアス端をmeshが切り落としにくい
- 変形時の輪郭欠けを減らせる
- texture samplingの余裕ができる

懸念:

- UV外参照、透明端の色滲み、texture clamp
- concave contourを単純offsetすると自己交差する
- 小さいパーツではpaddingが形状比率に対して大きすぎる

したがって固定値だけでなく、`min(数px, 局所幅の一定割合)`等を検討する。texture側にもtransparent padding／edge dilationが必要かを実測する。

## 5.3 内部頂点配置

全面一様格子ではなく、適応密度を推奨する。

密度を上げる場所:

- PIVOT／関節周辺
- bone間の曲げ領域
- 輪郭の曲率が高い場所
- 細い首、手首、足首
- line artや色境界が集中する場所
- ユーザーが特徴線を描いた場所

密度を下げられる場所:

- 単色で広い面
- ほとんど変形しない領域
- boneから遠い固定領域

初期候補:

- jittered gridまたはPoisson disk sampling
- contourから一定距離ごとの内側ring
- bone周辺へ追加sample
- PIVOTを必ず頂点または近傍制約点として入れる

画像内容を使う場合は、alpha境界だけでなく、輝度・色・edge mapを「追加頂点候補」に使える。ただし陰影の細かいノイズへ過剰追従しないよう、初期版ではoptionalとする。

## 5.4 三角形分割

推奨候補はconstrained Delaunay triangulationである。

必要条件:

- outer contour edgeを保持する
- hole contourを保持する
- feature pathをforced edgeとして保持できる余地
- mask外へ出るtriangleを除去する
- 極端に細いtriangleを減らす
- 最小角、edge長、面積を検査する

単純Delaunay libraryは境界制約を直接扱わない場合がある。外周を含むpolygon triangulation、point insertion、edge recoveryをどう実現するかCodexに比較してほしい。

候補方式:

A. 既存のcontrol-mesh topology生成器を拡張  
B. polygon triangulation + 内部頂点挿入  
C. constrained Delaunay libraryを導入  
D. 初期試作だけ単純grid clipで実現し、最終方式を後決定

新依存追加は、bundle size、license、保守性、既存方針との整合を確認する。

## 5.5 disconnected islandとhole

添付参考画像のように頭、胴体、腕などが離れている場合、一枚のLayerでもalpha componentは複数になる。

**透明な空間を跨いで1枚の巨大triangle meshへ無理に接続しない**方がよい。

推奨:

```text
1 MeshRigDefinition
  ├─ component mesh A
  ├─ component mesh B
  └─ component mesh C
```

boneは複数componentへ影響可能だが、triangle topologyはcomponentごとに独立させる。これにより透明部分を横切る不要triangle、予期しない引っ張り、holeの塗り潰しを避ける。

ユーザーが離れたパーツを一体的に曲げたい場合は、bone bindingで動かし、mesh自体を透明gap越しに接続する必要はない。

---

## 6. ボーンとウェイト

## 6.1 PIVOT列からboneを生成する

ユーザーが肩、肘、手首の順に点を置いた場合:

```text
P0 shoulder
P1 elbow
P2 wrist
```

内部では:

```text
bone0: P0 -> P1
bone1: P1 -> P2, parent = bone0
```

手を別制御したい場合はP3を追加する。

PIVOTは「回転中心の点」だけでなく、bone chainを作るnodeとして解釈する。既存の単一anchorとの名称衝突を避けるため、UI名と内部名は調査後に決める。

## 6.2 初期ウェイト方式

最小版はbone segmentまでの距離で重みを作り、正規化する方式が現実的。

```text
rawWeight = strength / (distanceToBone + epsilon)^power
```

改善候補:

- bone方向の投影位置を考慮
- 関節の両側でsmoothstep blend
- mask内のgeodesic distanceを使い、透明gap越しの影響を減らす
- 1頂点の有効bone数を2〜4へ制限
- root固定領域へpin weight

初期版で高度なbiharmonic weightsを必須にする必要はない。ただし距離だけでは、隣接する別の腕、指、足などへ誤って影響する。そのためcomponent、mask geodesic、manual binding correctionのいずれかが必要になる。

## 6.3 変形方式

### 第1候補: Linear Blend Skinning (LBS)

利点:

- 実装が単純
- bone poseだけで再計算できる
- GPU／CPUどちらでも扱いやすい
- ToonSquid的な距離weightの試作に向く

欠点:

- 肘が潰れる
- 強い曲げで体積感が失われる
- candy-wrapper的な歪み
- triangle inversionを防がない

### 第2候補: LBS + 局所補正

初期実用案として有力。

- 関節周辺のrest edge lengthをある程度保つ
- cross-section幅を維持する
- stiffnessの高いtriangleは回転中心に近い剛体挙動へ寄せる
- 変形後に数iterationだけposition-based constraintを解く

### 将来候補: ARAP

As-Rigid-As-Possible deformationは、少数control pointから2D shapeを局所的に剛性維持しながら変形する代表的手法である。

利点:

- 面の潰れを抑えやすい
- stiffness mapと相性がよい
- bone以外のfree control point deformationにも使える

欠点:

- 反復solve、行列前計算、worker化などが必要
- drag中のリアルタイム性を要検証
- bone animationとARAP constraintの責務整理が必要

推奨は、最初からARAPへ飛ばず、LBSで技術境界を通した後、品質不足が実測された場合に局所補正またはARAPを比較すること。

## 6.4 関節とゴムのモード

ユーザー意図には「ゴム人形」の伸縮が含まれる。一方、通常の腕はbone長を維持した方が自然である。

将来的に次を分けるとよい。

- **Joint mode:** bone長固定、通常の関節
- **Rubber mode:** stretch許可、最大伸長率あり
- **Free mode:** control pointを直接動かす

初期版はJoint modeを基本とし、boneごとの`allowStretch`または`maxStretch`をデータに持たせる余地だけ確保する。

## 6.5 IK

末端PIVOTをドラッグして肩・肘を自動追従させる簡易IKは、ユーザー体験に合う。

腕・脚の2 bone chainなら解析的2D IKまたはFABRIKで十分。初期Phaseに入れるかは、まずFK変形とmesh品質を成立させてから判断する。

---

## 7. 線画をどう扱うか

## 7.1 単一ラスターの限界

線と塗りが同一textureに焼かれている場合、面meshは両方を同じUVで運ぶ。これだけでも軽い変形には使えるが、強い曲げでは次が起きる。

- 線幅の不均一
- 肘内側で線が潰れる
- 主線が折れる
- 顔輪郭や口の印象が崩れる
- triangle境界で局所的に傾きが変わる

単一ラスターから線と塗りを完全に分離し、Live2D級に主線を維持することは初期要件にしない。

## 7.2 特徴線制約

現実的な補助機能として、ユーザーが重要線を一筆でなぞる方式を提案する。

```text
特徴線をなぞる
  ↓
pathをresample
  ↓
近傍meshへ頂点追加またはsnap
  ↓
pathに沿うforced edgeを作る
  ↓
滑らかさ／長さ維持constraintを付ける
```

対象:

- 顔外周
- 口
- 目の縁
- 腕の外輪郭
- 髪束
- 服の縫い目

これは線Layerと塗りLayerの分離をユーザーへ要求せず、内部だけ「線的特徴」を別扱いする方法である。

## 7.3 ストロークメタデータの将来利用

Tegakiの描画時にstroke point、pressure等を既に記録しているなら、将来的に「リグ対応strokeだけ」中心線と幅を保持する案がある。

ただし標準ラスター描画を全面vector化してはいけない。既存描画パイプラインとTEGAKI方針を維持し、必要なstrokeだけ補助geometryを持つ設計とする。

---

## 8. 最大の技術的制約

## 8.1 自己交差と前後関係

一枚のtriangle meshは、基本的に固定されたtriangle draw orderを持つ。腕をU字に曲げ、前腕が上腕の前へ回り込む場合、単純meshでは次を正しく表現できない。

- どちらが手前かの切り替え
- 関節の隠れ部分
- 自己交差部分の輪郭
- 裏面に隠れていたpixelの生成

初期版では次のどれかが必要。

- 強い自己交差を制限する
- triangle inversion前にclampする
- 警告表示を出す
- 手動で前後を切り替えられるsubmeshを将来用意する

将来案:

- 1 Layerを内部だけ仮想submeshへ分割
- 上腕／前腕／手などへoverlap marginを持たせる
- submesh単位でz-orderを切り替える
- 隠れ部分は元画像に存在しないため、stretch fillまたは手動描き足しを必要とする

**「Layer分け不要」は、奥行き情報や隠れ絵まで自動的に得られることを意味しない。**

## 8.2 triangle inversion

強い変形でtriangle面積が0以下になると、textureが反転または欠落する。

必要な検査:

```text
signedArea(rest) と signedArea(deformed) の符号
minimum area
minimum angle
edge stretch ratio
```

drag中に:

- clamp
- 赤色警告
- poseを最後のvalid状態へ戻す
- 局所solveで押し戻す

のどれを採用するか検討する。

## 8.3 seamとtexture bleed

隣接triangleが別々にrasterizeされる場合、sampling、precision、antialiasの違いで隙間が出る可能性がある。

検証項目:

- PixiJS Meshでの共有頂点とindex buffer
- premultiplied alpha
- texture filtering
- UV padding
- edge dilation
- RenderTexture snapshotのscale mode
- export時とpreview時のrenderer差

## 8.4 元ラスター編集によるrig失効

rig作成後にLayerへ描き足すと、source bounds、alpha contour、texture内容が変わる。

候補契約:

1. **Texture-only update:** topology内に収まる描き足しは同じUVで反映
2. **Bounds expansion:** sourceBounds変化時にUV／mesh boundsを拡張
3. **Topology stale:** alphaがmesh外へ大きく増えたら「mesh更新が必要」
4. **Regenerate:** boneとfeature pathを維持し、meshだけ再生成

`sourceRevision`またはsnapshot hashで検知する。黙ってmeshを自動修復し、poseやHistoryを壊す設計は避ける。

---

## 9. Tegakiの技術方針との整合

Codexは以下を現行`TEGAKI.md`と実コードで再確認すること。

### 9.1 ラスター正本を維持する

- 元LayerはPixiJS RenderTextureへ焼かれたラスター正本
- rigは元pixelを毎dragで再焼き込みしない
- previewは非破壊
- bakeが必要でも明示操作で一度だけ
- 保存・復元・exportで同じ評価結果を得る

### 9.2 通常LayerとCAFを安易に統合しない

通常LayerとCAF internal LayerはUIを共有できても、正本、History、復元先が異なる。

本件では最低でも次を明示する。

- rig definitionの所有者は誰か
- pose keyframeの所有者は誰か
- normal Layerへ付けたrigとCAF DrawingSnapshotへ付けたrigは同じdata adapterか
- working Layerへ一時的に付けるのか、ClipAsset／DrawingSnapshot側へ保存するのか
- Frame切替時のruntime geometry更新

### 9.3 既存変形との合成順

VキーLayer変形、CLIPMotion、camera、folder/group transform、inverse clipping、onion、exportとの順序を図示すること。

### 9.4 History

現行command契約へ合わせる。

候補History単位:

- rig作成／削除
- bind pose変更
- bone追加／削除／親子変更
- mesh regenerate
- vertex／feature path編集
- pose keyframe変更
- mask編集

大きなtexture snapshotを毎pose操作で複製しない。rig定義とpose差分のbyteSizeを計測する。

### 9.5 凍結方針

`TEGAKI.md`にWebGPU、SDF/MSDF、WebGL2 Meshの新規採用凍結がある。

ここでいう「WebGL2 Mesh」が、過去の独自実験moduleだけを指すのか、PixiJS標準`Mesh`／`MeshGeometry`の新規利用も禁止するのかをCodexが現行文書、既存実装、オーナー意図から確認すること。

勝手に新しいWebGL shader pipelineを追加しない。

優先順位:

1. 既存`control-mesh-*`、`warp-grid-*`の再利用可否を調査
2. PixiJS標準機能だけで成立するか確認
3. CPU topology生成 + 既存renderer経路の可能性
4. 方針に抵触する場合は、必要性と代替不能性を先に報告

---

## 10. UI案

UIはキャンバスを主役にし、大きな常設windowを増やさない。

### 10.1 最小操作

```text
Layer選択
→ QAPまたは変形系入口から「クイックリグ」
→ PIVOTを順に打つ
→ Enterまたは確定
→ 自動mesh生成
→ 末端または関節をdrag
```

### 10.2 Setup / Animateの分離

ToonSquidのbind pose／animation分離は事故防止に有効。

- **SETUP:** PIVOT、bone、mask、mesh、weight、feature lineを編集
- **ANIMATE:** pose／keyframeを編集

既存Tegakiのモード設計に合わせ、名称と切替UIを提案すること。

### 10.3 自動生成失敗時の修正

最小限必要な候補:

- 対象mask追加／削除
- cut line
- mesh point追加／削除／移動
- mesh表示ON/OFF
- density preset
- alpha threshold
- regenerate

後続候補:

- feature lineを一筆で追加
- rigidity brush
- weight binding correction
- submesh分割
- z-order切替

### 10.4 表示

- boneとPIVOTは常時見せず、rig tool中だけ表示
- mesh線はtoggle
- invalid triangleは警告色
- sourceとdeformed poseを切り替え可能
- meshがstaleになった場合は黙って直さず明示表示

---

## 11. 推奨する段階実装

Codexは現行Phaseとの相性を見て組み替えてよい。ただし一度に全部実装しない。

## Spike 0: 現行実装監査

コード変更なし、または調査用branchのみ。

確認事項:

- 既存PIVOT／anchor／CLIPMotionのdata model
- `control-mesh-deformer`等の実在と現状
- 任意三角形topologyを扱えるか
- previewとexportのrender path
- project保存schema
- normal Layer／CAFのattachment point
- PixiJS Mesh利用の方針可否
- sourceBounds、無限canvas、raster snapshotとの関係

成果物:

- file/class/event図
- 方式比較
- 推奨差し込み点
- 実装前の未決事項

## Spike 1: 手動meshによる静的技術試作

対象を限定する。

- 通常の透明Raster Layer 1枚
- 保存、History、CAF、Timelineは対象外
- 手動または固定fixtureのtriangle mesh
- 2〜3 bones
- LBSでpreview
- 元Rasterは不変
- 90度程度の腕曲げを確認

目的:

- rendererでseamなく表示できるか
- UV、座標系、RenderTextureとの接続
- drag中の性能
- triangle inversion検知

この段階でrenderer基盤が成立しないなら、自動meshへ進まない。

## Spike 2: alpha輪郭から自動mesh

- alpha threshold
- connected component
- outer contour + hole
- contour simplification
- interior sampling
- triangulation
- mesh quality validation
- density preset

PIVOT列からjoint周辺の密度を上げる。

## Slice 1: 非破壊RigDefinition

- rig作成／削除
- setup mode
- source revision
- project save／restore
- History
- mesh regenerate
- normal Layer限定

## Slice 2: bone poseと操作

- FK
- rotation limit
- optional stretch
- pose History
- invalid triangle制限
- 簡易IKは別Sliceでもよい

## Slice 3: CAF／CLIPMotion接続

- pose keyframe正本
- HOLD / LINEAR等の補間
- preview、playback、onion、export一致
- Frame切替
- Clip copy/paste
- 保存容量とruntime cache

## Slice 4: 品質補強

- feature line
- forced edge
- rigidity／局所constraint
- weight修正
- geodesic influence
- adaptive remesh

## Slice 5: 強い曲げと内部submesh

- self-overlap警告または制御
- virtual submesh
- z-order切替
- overlap margin
- 手／前腕／上腕の内部セグメント化

## Slice 6: ストロークメッシュ

- 新規strokeの中心線／幅メタデータ利用
- 3点レール／strip mesh
- 面meshとのhybrid binding

---

## 12. 最小技術試作の受け入れ条件案

Codexは実装可能な数値へ調整してよい。

### 12.1 機能

- 透明背景の腕状ラスター1枚を対象にできる
- 肩・肘・手首の3点から2 bone chainを作れる
- 末端またはbone回転で面全体が変形する
- 元のRaster／RenderTextureは変形dragで破壊されない
- source poseへ完全に戻せる
- triangle反転を検知できる

### 12.2 見た目

- 45度、90度の曲げで明白なtriangle gapが出ない
- 輪郭pixelが大きく欠けない
- 関節以外の広い面が不必要に崩れない
- 複数alpha islandが透明gapを跨ぐtriangleで接続されない
- holeが塗り潰されない

### 12.3 性能

最低限次を測る。

- 400×400の小画像
- 2048×2048程度の画像
- 250 / 500 / 1000 / 2000 vertices相当
- pointermove中のframe time
- mesh生成時間
- save size
- History byteSize

固定した「十分速い」という記述ではなく、計測値を報告する。

### 12.4 回帰

- 通常描画
- 消しゴム
- Layer transform
- CAF working Layer
- clipping
- onion
- save／restore
- export
- Undo／Redo

本件に接続した経路だけでなく、通常LayerとCAFの境界を実操作確認する。

---

## 13. Codexに比較してほしい方式

少なくとも次を比較し、採否理由を記すこと。

| 方式 | 長所 | 短所 | 初期採用候補 |
|---|---|---|---|
| 固定Warp Grid | 既存再利用しやすい可能性 | 輪郭非追従、局所密度不足 | renderer spike用 |
| 輪郭追従Triangle Mesh + LBS | 汎用、boneと相性 | 肘潰れ、weight調整 | 第一候補 |
| Triangle Mesh + ARAP | 面を保ちやすい | solveが複雑 | 後続比較 |
| 3 Rail / Strip Mesh | 線・帯に強い | 面積のある複合画像に不足 | 補助／特化 |
| Layer分割Rig | 品質とz-orderに強い | 準備が重い | 本格モード／従来方式 |
| AI segmentation + auto rig | 一枚絵から高度自動化 | 重い、不確実、依存増大 | 将来研究 |

---

## 14. Codexが回答すべき未決事項

1. 現在の「1 Layer 1 PIVOT」はどのdata model、class、event、保存schemaに存在するか。
2. 既存CLIPMotionはLayer、ClipInstance、ClipAssetのどこへ属するか。
3. `control-mesh-deformer`と`control-mesh-topology`は任意triangle meshか、規則gridか。
4. `warp-grid-rasterizer`のtexture samplingは任意topologyへ転用可能か。
5. 現行rendererでPixiJS `Mesh` / `MeshGeometry`を使ってよいか。凍結方針との関係は何か。
6. 元Rasterを不変に保ったまま、preview、onion、exportへ同じmesh評価を入れられるか。
7. rig definitionの所有者はLayer、ClipAsset、DrawingSnapshotのどれが妥当か。
8. 同一Layer内の複数alpha islandとholeを現行raster boundsから取得できるか。
9. source Layerへ描き足した場合、どのrevision／eventでrig staleを検出できるか。
10. Historyでmesh topology全体を毎回複製せず、差分またはimmutable definition交換にできるか。
11. project save migrationはどこへ置くか。
12. frameごとに頂点を保存せずbone poseだけを保存する設計で、既存Timeline補間へ接続できるか。
13. 既存Vキーtransformとrig setup操作のショートカット／mode競合はないか。
14. alpha mask読み出しにGPU readbackが必要か。生成時だけなら許容可能か。
15. mesh生成をmain threadで行うか、Web Workerへ分離するか。
16. 自動mesh library導入が必要か。既存依存だけで成立するか。
17. reference画像のような複数パーツ集合を「1 Layer・複数component mesh・1 rig」で扱えるか。
18. 初期版で明示的に禁止／制限する変形範囲は何か。

---

## 15. Codexから期待する提案形式

以下の順で回答してほしい。

### A. 現行コード調査結果

- 関連file
- class / function
- event / payload
- data ownership
- render path
- save / History path
- 再利用可能な既存module
- 想定と異なっていた点

### B. 推奨アーキテクチャ

- データモデル
- 座標系
- bind pose / pose
- mesh generation
- bone weighting
- deformation
- rendering
- CLIPMotionとの合成順
- normal Layer / CAF境界

### C. 方式比較と採択理由

- 第一候補
- 第二候補
- 棄却候補
- 既存方針に抵触する点

### D. 最小Spike

- 対象
- 対象外
- 変更file
- acceptance criteria
- 計測項目
- 失敗時の撤退条件

### E. Phase案

各Phaseについて:

- 目的
- 変更file
- 新規file
- event / schema変更
- History
- save migration
- test
- 完了条件

### F. リスク

- renderer
- topology
- visual quality
- memory
- performance
- save compatibility
- CAF boundary
- UI complexity
- future extensibility

### G. オーナーへ確認する質問

実装前に判断が必要なものだけを、選択肢と推奨を添えて列挙する。

---

## 16. 現時点の推奨判断

Codexの実コード調査前の暫定判断は次の通り。

1. **ToonSquid寄りの面メッシュを基盤にする。**
2. **PIVOTは複数bone chainを作る入力として扱う。**
3. **3点レールは線・帯・特徴線補強へ限定する。**
4. **元Rasterは不変、meshは非破壊Effectとして保持する。**
5. **CLIPMotion全体変形とmesh rig局所変形を別データにする。**
6. **最初は通常Layer・手動mesh・LBSのrenderer spikeから始める。**
7. **自動alpha meshはrenderer成立後に追加する。**
8. **強い自己交差、奥行き順、隠れ部分生成は初期版の対象外にする。**
9. **自動生成には必ず手動修正入口を用意する。**
10. **既存control-mesh／warp-grid資産を調べ、凍結方針を破らず再利用する。**

ただし、既存moduleがすでに任意control mesh、triangle rasterization、保存を十分に持っている場合は、上記Phaseを短縮できる。逆に既存moduleが固定gridの実験段階で、現行方針により利用不能なら、機能全体の時期を後ろへ置く判断もあり得る。

---

## 17. 参考資料

### Tegaki

- AGENTS.md  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/AGENTS.md
- TEGAKI.md  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/TEGAKI.md
- PROGRESS.md  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/tegaki_work/PROGRESS.md
- ARCHITECTURE.md  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/tegaki_work/ARCHITECTURE.md

リポジトリ内のproposalやfile pathは移動している可能性があるため、ローカルtreeを検索すること。

### ToonSquid公式

- Mesh effect  
  https://toonsquid.com/handbook/effects/mesh/
- Bones effect  
  https://toonsquid.com/handbook/effects/bones/
- Animate With Bones  
  https://toonsquid.com/handbook/guides/animate_with_bones/
- Warp effect  
  https://toonsquid.com/handbook/effects/warp/
- Effects（非破壊Effectの説明）  
  https://toonsquid.com/handbook/effects/effects/

### Live2D公式

- Automatic Mesh Generator  
  https://docs.live2d.com/en/cubism-editor-manual/mesh-edit/
- Edit Mesh Manually / Stroke mesh-mapping  
  https://docs.live2d.com/en/cubism-editor-manual/mesh-edit-manual/

### OpenToonz公式ドキュメント

- Plastic Tool  
  https://opentoonz.readthedocs.io/en/latest/create_animations_using_plastic_tool.html

### Rive公式

- Meshes  
  https://rive.app/docs/editor/manipulating-shapes/meshes
- Bones  
  https://rive.app/docs/editor/manipulating-shapes/bones

### PixiJS公式

- Mesh guide  
  https://pixijs.com/8.x/guides/components/scene-objects/mesh

### 研究参考

- Igarashi et al., As-Rigid-As-Possible Shape Manipulation  
  https://www-ui.is.s.u-tokyo.ac.jp/~takeo/research/rigid/index.html
- SPRITETOMESH: Automatic Mesh Generation for 2D Skeletal Animation  
  https://arxiv.org/abs/2602.21153
- Bunraku: Turning a Single Illustration into an Editable Live2D Character  
  https://arxiv.org/abs/2607.27348

---

## 18. 添付参考画像の意図

この文書と併せて、会話内の以下の参考画像をCodexへ見せること。

1. **腕の概念図**  
   一枚の腕へ複数PIVOTを置き、肩・肘・手首を曲げる発想。
2. **3点レールの概念図**  
   中心・外側・内側の点列を三角形で接続する細帯用mesh。
3. **全面三角メッシュの参考画像**  
   複数パーツが一枚画像に集合した状態でも、輪郭と内部へ多数の三角形を配置し、面として変形へ耐えさせる発想。

第三画像の重要点は、キャラクターを意味認識して自動分割することではない。まずalpha componentごとに輪郭追従meshを作り、内部へ適応的に点を置き、必要なら1つのbone rigから複数componentを駆動することである。

---

**End of request**
