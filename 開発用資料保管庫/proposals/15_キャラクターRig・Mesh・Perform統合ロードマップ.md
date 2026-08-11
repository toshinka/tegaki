# キャラクターRig・Mesh・Perform統合ロードマップ

更新日: 2026-08-11
区分: 未実装統合proposal / Phase化前の判断正本

## 0. 位置づけ

本書は、次を一つの将来系列として整理する現行正本である。

- CAF内部Partと親子Motion
- BONE / Bind Pose / FK / IK / Pin / Stretch
- 任意Triangle Mesh / ControlHandle / SkinWeight
- Quick Rig / Primitive Cage / Auto Contour / Ribbon
- Motion Perform / Time-Stroke
- 動的Draw Order / RenderIsland
- BONE Dynamics / Secondary Motion
- 単純Collider、将来のRigid Body / Contact Deformation

本書は実装指示書ではない。正式Phaseを開く前に、現行コードと保存正本をGate 0で監査する。

個別のGEMINI原案、Claudeレビュー、改訂版、上位統合案、Dynamics案は、情報を失わないよう次へ原文保存した。

`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/2026-07_AI提案原案/`

通常のPhase開始時は本書だけを読み、判断材料が不足した論点だけ原文へ戻る。

## 0.5 AI実装分担

本書からPhase化する際は、Sol High / XHighが現行コード照合とGate分解を行い、Luna MAXが明示された限定Stageを実装し、Sol High / XHighが最終レビューを行う。Phase指示書には、目的、現状、維持契約、非対象、変更ファイル、完了条件、停止条件、固定入力、レビュー項目を必ず記載する。Lunaは予想外の依存や正本重複を推測で埋めず停止報告し、Ownerは実機でGO / HOLDを決める。

## 1. 目標体験

```text
キャラクターをCAF内部Folder / Partへ整理
  ↓
必要ならPrimitive Cage / Triangle Meshを生成
  ↓
BONEを配置して自動weight
  ↓
手・足・頭・尾等をCanvas上で直接操作
  ↓
FK / IK / Follow / Stretchを評価
  ↓
PartまたはMeshが追従
  ↓
Motion Performで時間へ記録
  ↓
Draw OrderとSecondary Motionを加える
  ↓
preview / playback / onion / Bake / exportで同じ結果
```

「すぐ動かせる」と「後から精密調整できる」を両立する。自動生成は開始点であり、手動修正を無言で上書きしない。

## 2. 名称

- 正式表記は`BONE`、日本語UIは「ボーン」。`BORN`は過去資料の表記揺れとしてのみ扱う。
- `Part`: CAF内部Folder等を動かす論理単位。
- `RenderIsland`: clipping / group effectのため分離変形・並べ替えできない最小描画単位。
- `RigDefinition`: Part、BONE、Bind Pose、Constraint、Binding参照等の静的定義。
- `RigInstanceMotion`: ClipInstanceごとのPose、Effector、Constraint Weight等の時間変化。
- `TriangleMesh`: vertices、UV、triangle indexを持つ任意Mesh。
- `ControlHandle`: MeshVertexと別IDを持つ疎な操作点。
- `SkinWeight`: BONE等からMeshVertexへの影響率。
- `Motion Perform`: pointer gestureを既存Motion、Effector、Pose等のkeyへ変換する入力方式。

## 3. 変更しない基盤

- 通常LayerとCAF内部Layerの正本を混同しない。
- CAF編集はworking Layerを表示・入力adapterとして使い、TimelineModel / ClipAsset / DrawingSnapshotを保存正本とする。
- Clip root Motionは既存`ClipInstance.transformKeyframes`等を維持する。
- WARP GRIDのBind / Pose / LENS placementを別名で再実装しない。
- Folder clipping、上側Lane前面、preview container順、PSD record順、display-only onionを維持する。
- UI tree、Timeline子行、selection、solver cache、GPU bufferを保存正本にしない。
- key無し、Rig無し、Mesh無しの旧Projectは従来結果を維持する。

## 4. 所有モデルの第一候補

```text
ClipAsset / CAF
  parts[]
  renderIslands[]
  rigDefinition
    bones[]
    constraints[]
    effectors[]
  meshDefinitions[]
  skinBindings[]
  defaultDrawOrder[]
  generatorMetadata

ClipInstance
  rootMotion                 # 既存Motion
  rigMotion
    bonePoseTracks[]
    effectorTargetTracks[]
    constraintWeightTracks[]
    stretchTracks[]
    followTracks[]
  controlHandleTracks[]
  drawOrderTrack
  dynamicsTracks[]
```

これは仮称である。Gate 0で現行のClipAsset / ClipInstance / deformer所有と照合し、同じ関係をFolder、Lane、Rigへ重複保存しない。

静的定義と時間変化を分ける理由:

- 同じCAF素材を複数ClipInstanceへ配置できる。
- 各配置の演技を独立できる。
- Setup変更がAnimationへ与える影響を検出できる。
- UI階層を保存schemaへ直結させずに済む。

## 5. 統合評価順の第一候補

```text
1. Project Frame → Clip-local Frame
2. Clip root Motionをsample
3. Rig Motion入力をsample
4. Stateless Constraintを解く
   FK / IK / Pin / Follow / Stretch / Limit
5. 必要ならStateful Dynamicsを決定的に評価
6. EvaluatedBonePoseを生成
7. Part rigid transform / ControlHandle / Skinning / WARPを評価
8. Part textureまたはRenderIslandを確定
9. Draw Orderを評価
10. Clip root transformと全体composite
```

確定順ではない。Folder clippingとRenderIslandの現行評価を調べ、二重transformが起きない順へ調整する。

同一Frameの結果は次で共有する。

- 通常Canvas
- Animation Table preview
- playback
- onion
- thumbnail
- Bake
- export

UI別、export別のsolver / Mesh evaluatorを作らない。

## 6. CAF内部Partと階層UI

### データ境界

- CAF内部Folderへ再帰`TimelineModel`を持たせるmini CAFは第一候補にしない。
- 通常Folderへ`Motion Part`属性を明示付与し、Raster階層はそのまま維持する。
- parentは単一親forestを基本とし、循環を禁止する。
- Motion親子順と表示順を同一視しない。
- Part削除、parent欠損、属性解除時にtrackを無言削除しない。

### Phase 7d完了 — 表示階層とRIGの分離・Rig Part安全Gate（制作要望 2026-08-09）

Owner相談後にGate 0を改訂し`GO`とした。表示階層、Rigグラフ、描画所属を分離し、Folder Partに加えてCAF直下Raster一枚をRoot Raster Partとして扱う。唯一のgeneric Rig Part plan、pure reparent Gate、D&D / 上下移動接続、Folder無し`+RIG`、Setup青のderived chipまで実装し、SOL review 1 / 2 / finalはいずれも`A`。Owner受入後にcloseし、実装契約と結果は`開発用資料保管庫/Archive/phase7d.md`へ移した。

- 表示親`parentLayerId`とRig親`parentPartId` / `parentBoneId`は別正本である。表示階層移動を理由にRig親子リンクを自動削除、暗黙再接続、表示親へ同期しない。
- Folder Partは最も近い登録Partへ排他的に割り当てたsubtree、Root Raster Partは`parentLayerId == null`のRaster一枚だけを描画所属とする。`partId`は既存internal Layer IDを使い、target kindを保存しない。
- Folder内の通常RasterはFolder Partの描画内容であり個別Rigノードへ自動登録しない。初期PhaseではFolder内Rasterの独立Rigid Partと、同じRasterへのRigid + Mesh / Skin同時適用を拒否する。
- 同じ表示親の前後並べ替えは許可する。reparentは移動前後の有効Part owner、Folder WARP owner、clipping contractを比較し、同じならdisplay-only移動として許可、変わる場合だけ理由付きで拒否する。
- 後続で必要性が確認できた場合だけ、明示操作として`表示階層だけ移動`、`RIGを解除して移動`、`移動後にRig親を再指定`を比較する。各操作は参照先、Motion key、Mesh / WARP bindingへの影響をpreviewし、1 Historyで確定／cancelできることをGateにする。
- Layer Panelの所属表示は単独の`R`を避ける。Rotation、Raster、Resize等と区別できる、Setup青の連結node icon + 小型`RIG` chipを第一案とし、色だけに依存せず`data-tooltip`で`RIG設定済み: Part / Bone / Anchor`等の内訳を示す。black / white / neutral grayとnative `title`は使わない。
- Folder Part、Root Raster Part、内部Raster Mesh、WARP anchorで保存正本を統合しない。badgeは既存正本から導出する表示であり、新しい`isRigged` flag、`rigGroupId`、自動Folder wrapperを保存しない。
- Folder / Root Raster共通RenderPlan、pure reparent Gate、限定UIをSOL final review=`A`とOwner受入でcloseした。詳細は`開発用資料保管庫/Archive/phase7d.md`。

受入れ固定入力は、Folder無しのCAF直下Raster RIG、Folder / Root Rasterの独立root tree、同一親内の上下移動、owner不変のdisplay-only reparent、owner変更の理由付き拒否、Undo / Redo、save / reload、CAF copy、通常／Animation Table表示／Table閉鎖後のPanel順とactive対象、preview / playback / onion / Bake / export一致とする。

### UI Plan A — Animation Table子行

- 親CAF行を開閉し、選択ClipのPart / BONE trackを子行として投影する。
- 既存TimelineとFrameを共有し、子Timelineを新設しない。
- 小さなRigでは位置関係が分かりやすく、Motion key編集と近い。

### UI Plan B — Rig Inspector / Tree

- Part / BONE / Constraintの構造を専用Inspectorへ表示し、Timelineは選択trackだけを見せる。
- 次の場合にPlan Bを採用または併用する。
  - 子行が多くTimelineの縦領域を圧迫する。
  - SetupとAnimateの切替が分かりにくい。
  - BONE parent変更、weight、Collider等がTimeline行に収まらない。

UIはデータ正本から投影するため、Plan AからPlan Bへ切り替えても保存schemaを変えない。

## 7. BONEとConstraint

### 最初の範囲

- Bind Pose
- rigid FK
- parent → child / grandchild継承
- position / rotation / optional scale
- cyclic hierarchy拒否
- save / reload / copy / paste / History

Meshを必須にしない。これによりCAF内部Partの剛体変形だけで所有境界とUIを検証できる。

### Phase 6qで確定した操作役割

- CAF内部Folderは構造と対象名、既存Part identityの入口として残すが、Motion Inspectorへ`FOLDER / BONE`の二択は出さない。
- 現行Motion主操作はBONE PoseのX / Y / Scale / Rotation。Folder Part trackは旧Project互換schemaとして維持し、新規主導線からは増やさない。
- RIGはPIVOT位置、初期角度、`parentBoneId`を編集する。親Motionは子孫へ剛体FK伝播し、末端操作は親へ逆流しない。
- 四隅を動かす平行四辺形 / 自由変形はWARP GRIDの役割。Motion、Folder transform、Pixel Selectionへ別々の正本を作らない。通常Rasterの四隅変形を将来追加する場合は、WARPと共用できる座標代数をGateで比較する。
- 末端HANDを動かしてARM1 / ARM2を解く操作はEffector + IK。伸縮は`off / limited / free`とweightを明示し、剛体FKの暗黙挙動にしない。

### 後続Constraint

- Effectorと2-Bone IK
- Pin
- Distributed Parent Follow
- angle / translation limit
- fixed / limited / free stretch
- constraint weight track

「手を動かすと肩も動く」はFKではなくIKまたはdistributed followとして扱う。

Stretch候補:

| mode | 意味 |
|---|---|
| `FIXED_LENGTH` | 長さを維持 |
| `LIMITED_STRETCH` | 上限内で伸縮 |
| `FREE_STRETCH` | targetまで伸縮 |
| `SQUASH_STRETCH` | 軸伸縮と幅補正 |
| `RUBBER` | chain全体へ伸びを分配 |

最初から全modeを実装しない。固定長と限定伸縮から始める。

## 8. Triangle MeshとControl

### 概念分離

- MeshVertexは描画topology。
- ControlHandleは操作点。
- BONEはconstraint / solver入力。
- Binding / SkinWeightは両者の関係。

これらを一つのpoint配列へ畳み込まない。

### 生成方式

| 方式 | 適性 | 注意 |
|---|---|---|
| Manual Triangle | 最小proof、精密修正 | 頂点操作が多い |
| Delaunay / Free Points | 不規則なcage | 輪郭外triangle、hole / island |
| Primitive Cage | Box、Capsule、Strip、Radial | 規則的形状向け |
| Auto Contour | alpha輪郭の不規則Part | 輪郭抽出だけでMesh完成としない |
| Ribbon / GuideStroke | 腕、脚、髪、尾、線 | join、cap、self-intersection、幅保持 |
| Hybrid | 用途別に併用 | UIと再生成規則が増える |

### RIG自動Mesh案（Owner memo 2026-07-30）

- RIGのadvanced setupから、点数 / 粗さを指定して選択PartのMesh候補を生成する。PIVOT配置と同じ初期導線を塞がないよう、標準表示へ常設しない。
- Layer用途は`AUTO / LINE / FILL`の明示metadata候補とする。AUTO判定は初期候補を提案してもよいが、線画 / 塗りの保存正本をRaster解析結果だけで無言決定しない。
- LINEは中心線と内外輪郭の3列を基本候補とし、Ribbon topologyと幅方向weightで曲げ時の線痩せ / 膨張を抑える。
- FILLはalpha輪郭、hole / islandを保った内部点 + triangle充填を基本とし、Poisson / 六角格子 / radial等を固定入力で比較する。雪結晶状や蜂の巣状の配置はgenerator候補であり、保存schemaを分岐させない。
- 自動生成後は`VALID / STALE / INVALID`を維持し、source変更で手動topology / weightを無言上書きしない。
- 静的な影響範囲とSkinWeightの正本はRIGへ置く。MOTIONはFrame Poseと必要ならconstraint strengthだけ、WARPはPose変形だけを扱い、同じ「重さ」を三箇所へ重複保存しない。
- 自動Mesh、SkinWeight、関節周辺の曲げ伝播は将来Phase。現行の剛体PIVOT / FK proofへ暗黙実装しない。

### 一枚RasterのAuto Shape Mesh追補（Owner memo 2026-08-09）

今回の「一枚の人物・髪・手足をLayer分割せず、複数PIVOTで簡易Animationする」要望は、上記`AUTO / LINE / FILL`案とPhase 6v〜6yの一Raster・複数Mesh BONE基盤を発展させるものとする。別種のLive2D風deformer配列を新設せず、static Setupは既存`ClipAsset.meshDefinitions / skinBindings / rigDefinition.bones`、Frame Poseは既存`ClipInstance.rigMotion.boneTracks`を正本とする。

- 第一入口はRaster対象の`AUTO SHAPE`。alpha実内容から外周guard、silhouette / 主線support、内部supportを生成し、manual頂点編集は失敗箇所を直すadvanced fallbackとする。
- 塗り形状は、透明側のguard ring、alpha輪郭ring、内部点を基本とし、hole / 複数islandを保持する。細長い腕・脚・髪・線画は既存LINE案の中心線 + 内外輪郭、または線幅を挟むpaired edgeを比較する。
- 一枚Rasterのalphaだけでは「主線」と「塗り境界」を常に判別できない。自動分類を保存決定にせず、`AUTO / LINE / FILL`候補を提示し、誤判定時は切替・局所修正できることを受入条件にする。
- 主線上の一点列だけでは曲げ時の線幅を保証できない。線痩せ / 膨張を抑えるには線の両側support、幅方向weight、細長すぎるtriangleの抑止を固定入力で比較する。
- generatorはdeterministicとし、最大vertex / triangle、最小角、重複点、self-intersection、triangle反転、透明paddingを検査する。source描画変更後は`STALE`とし、手動Topology / Weightを無言再生成しない。
- UI第一候補はCLIP MOTION内のSetup青`MESH` tab。`RIG`と同じSetup群として、`AUTO SHAPE`、`LINE / FILL`、粗さ、再生成、advanced頂点編集を置く。狭幅 / touchで4 tabが過密なら、RIG対象Inspector内の青い`MESH Setup` submodeをPlan Bとする。
- 多数PIVOTは既存複数Mesh BONEとauto weightを使い、最初から自由ControlHandleとBoneを混在させない。BONEだけでは足りない局所変形が実制作で確認された後にSparse ControlHandleを開く。
- content-fit MeshによりWARP品質が上がる可能性はあるが、Skin MeshをWARPが暗黙共有して二重変形させない。まず同じAuto Shape generatorから各正本向けtopology候補を生成し、将来共有する場合もstatic topology参照とWARP Pose / Bone Poseを分離する。

最初の正式Phaseは、人物全身より先に「一枚の太い腕または髪束、2〜3 BONE、LINE / FILL各一fixture」でAuto Shape生成、auto weight、曲げ時の輪郭・線幅、手動修正、STALE、CPU / Pixi / Bake一致を比較する。

Phase 7gのWARP RADIALはOwner受入でcloseした。Phase 7hはAuto ShapeのSOL Gate 0として、Stage AでRaster alphaを4-connected island、outer / hole loop、Project座標へ変換し、Stage Bでcontour-only Earcut、contour + interior support、rect Gridを比較した。Stage Cはtopology検査付き輪郭削減、outer / hole透明側guard、boundary / guard / interiorの256 vertex budget、Stage Dは既存Mesh / Skin shape、最大2 distance weight、generator metadata、STALEを返すpure factoryを固定した。Stage Eは既存Model setter / validator / render boundary rollbackとSetup青RIGへ`AUTO SHAPE`を限定接続し、`AUTO GRID`共存、CURRENT / STALE、明示再生成、一操作一History、CAF / Raster複製、Project round-trip、Mesh Bone Motionを通過した。SOL review 1〜5=`A`とOwner軽量実機受入でcloseした。WARP Pose / Skin Bone Pose、Mesh topology / weightを共有しない。

現行Phase 7iはLINE / Ribbonを選定し、Stage A〜DとSOL review 1〜4=`A`で、一つのholeなしalpha islandからdeterministic open centerline、均等station、cap、alpha境界rayによる`left / center / right`三列topologyをpure生成し、既存Model / Setup青RIGへ明示`AUTO LINE`だけを限定接続した。2〜3 direct-chain BONE midpointをcenterline長手距離へ射影し、同一station三列へ同じ最大2 linear influenceを与える。既存inverse-bind LBSで0° / 45° / 90°、幅ratio、triangle / outline、random seek、Project shape、CURRENT / STALE、複製source rebaseを固定した。外部Claude案から安定group、Setup青、表示辞書、option再構築抑制を採用し、mode別message scopeと100頂点超の一時preview MeshのPixiJS resource寿命競合を限定修正した。全49 verifier、build、BrowserのGRID / SHAPE切替、Undo / Redo、LINE拒否非mutation、console warning / error 0件を通過した。LINE / FILLは自動分類せず、WARP / Skin Poseを共有しない。次はOwnerが成功LINEを軽量実機受入し、明示受入後にcloseする。

並行Phase 7jのRECT / CIRCLE / POLYはWARP control pointのruntime selectionだけを拡張する。Mesh vertex、SkinWeight、ControlHandleの選択UIへ暗黙転用せず、本書のmanual Mesh編集とは別Gateを維持する。Phase 7i / 7jともOwnerの一括確認前にcloseしない。

### 第一候補

1. 既存`control-mesh-*`監査
2. 固定Triangle proof
3. Manual Triangle Setup / Pose
4. Sparse ControlHandleまたはBONE Skinning
5. Primitive Cage
6. Auto Contour / Ribbon

Primitive CageをQuick Rigの最初にする理由は、topologyが安定し、BONE配置とweight生成が容易で、source変更に比較的強いため。

### Plan B

- 既存Control Meshが保存、CPU、Pixi、exportを満たすなら、それを最小拡張して固定proofを兼ねる。
- 直接頂点編集が実制作で十分ならSparse Handleを後回しにする。
- 不規則な有機形状が主用途ならPrimitiveよりAuto Contourを先にprototype比較する。
- 細長い線画で線痩せが主要問題ならRibbonを独立generatorとして先行する。

## 9. Binding / SkinWeight

基本候補:

```text
weight >= 0
sum(weights) = 1
stable Bone / Vertex ID
0 weight時はrest位置
最大influence数は計測で決定
```

自動weight候補:

- bone segment距離
- nearest BONE
- topology-aware diffusion
- harmonic / heat系
- cage coordinates
- Ribbon専用割当

手動調整候補:

- add / subtract / smooth
- normalize / lock
- mirror
- component fill
- selected BONE regenerate
- reset

1 weight brush gesture = 1 History。自動再生成で手動weightを無言破棄しない。

## 10. Setup / AnimateとTopology変更

Setup:

- Part、BONE、parent、Bind Pose
- Mesh topology、ControlHandle、SkinWeight
- Constraint構成、generator、基準Draw Order

Animate:

- Bone Pose、Effector Target
- Constraint / Stretch / Follow weight
- ControlHandle Pose
- Draw Order
- Motion Perform

Animation keyが存在する状態でBONE、parent、Bind Pose、Topology、Weight、RenderIslandを変える場合は無言修復しない。

選択肢:

- 変更を拒否
- key削除確認
- Rebind preview
- 複製して新Rigを作る
- stable IDを使った限定migration

Mesh状態は`VALID / STALE / INVALID`を候補とし、source変更後の無言再生成を禁止する。

## 11. Motion Perform / Time-Stroke

### 最初の入力契約

- fixed clockとpointer sampleを使い、device Hzへ結果を依存させない。
- raw sampleをProject Frameへ直接丸めず、相対時間`r = elapsed / total`へ正規化する。
- screen座標をMotionの`x / y`へ直接保存せず、既存screen → world → local変換とgrab offsetを使う。
- pointer停止区間をHoldとして保持する。
- capture中はProjectへ逐次commitせず、runtime preview後に1 gesture = 1 Historyで確定する。
- cancel / lost captureで変更を残さない。

### 最初の対象

Clip root positionを第一候補とする。既存Motion keyへ接続し、Perform専用Motion正本を作らない。

### BONE統合案

| 案 | 保存 | 長所 | 短所 | 切替条件 |
|---|---|---|---|---|
| A Pose Bake | 各Frame Bone Pose | 結果固定、再生が単純 | key増加、IK再編集しにくい | solver version互換が難しい時 |
| B Effector Target | target track | 非破壊、Constraintを後調整 | solver決定性と実行負荷 | random seek / export一致が成立する時 |
| C Hybrid | target正本 + 明示Bake | 編集性と固定結果 | invalidationが複雑 | A/B双方が実制作で必要と確認された時 |

最初はDense composite keyを許し、自動簡略化を必須にしない。必要になった場合は時間パラメータ付きXY誤差で簡略化し、元sampleとの差を計測する。X / Yを独立RDPして軌跡を壊さない。

## 12. Draw Order / RenderIsland

腕を身体の後ろから前へ回す等のため、Motion transformと別のHOLD trackを候補とする。

第一候補:

```text
DrawOrderKey {
  frame
  orderedRenderIslandIds[]
  interpolation: HOLD
}
```

Plan B:

- relative offset
- group / island orderだけを保存
- constraint-based order

完全順序配列が大き過ぎる、またはcopy / paste時のID再mapが不安定な場合にPlan Bを評価する。Folder clippingで分離できない単位を無視してPartだけを並べ替えない。

## 13. BONE Dynamics / Secondary Motion

本格的な剛体衝突より先に、髪、尾、衣服、リボン、アクセサリーの二次動作を扱う。

### StatelessとStatefulを分ける

Stateless:

- FK / IK / Pin / Limit / Stretch / Follow

Stateful:

- inertia / spring / pendulum / gravity / wind / drag / collision response

Stateful評価は過去Frameに依存するため、random seek、onion、export、reloadで同じ結果を得る独立gateを持つ。

### 最小MVP

```text
1 root BONE
3 child BONE chain
rotation-only pendulum
gravity
stiffness
damping
angle limit
fixed timestep
reset
playback / random seek / export一致
```

### seek方式の複数案

| 案 | 長所 | 短所 | 採用条件 |
|---|---|---|---|
| Frame 0から再simulation | 単純、決定的 | 長Clipで重い | MVPと短Clip |
| Checkpoint Cache | seekが速い | memory / invalidation | 長Clip実測で必要になった時 |
| Runtime Bake Cache | 再生が軽い | source revision管理 | preview負荷が支配的な時 |
| 完全Pose Bake | 結果固定 | 非破壊性とkey量 | export固定やsolver更新対策 |

固定stepはProject FPSまたは明示substepを基準とし、画面FPSへ依存させない。solver version保存の要否をPhaseで判断する。

### Collider以降

最初のCollider候補はCircle、Capsule、Segment、Ground、Box。反応はpenetrationを外へ押し戻すconstraintから始める。

Rigid Bodyの反射、摩擦、回転、sleeping、broad / narrow phaseは独立Phase。接触Mesh変形、Soft Body、PBDは研究Phaseへ送る。

## 14. モダンUIの方向

- Canvasを主役にし、選択中の対象に必要なcontrolだけをContextual Inspectorへ出す。
- SetupとAnimateは色だけでなくlabel、icon、状態文で区別する。
- Part / BONE / Mesh / Weight / Dynamicsの全panelを同時常設しない。
- direct manipulationを主にし、数値編集とtreeを補助にする。
- desktopはhover説明とshortcut、touchは長押し説明と十分なhit areaを持つ。
- overlayはdisplay-only。通常描画、export、Projectへ混ぜない。
- advanced項目は折りたたむが、現在有効なconstraint / physicsは隠さずchip等で示す。
- CLIP MOTIONは`RIG → MOTION → WARP`を標準順とする。未設定CAFの初回だけRIGへ案内し、再openでは最後の作業tabを尊重する。
- `CAF / Folder`対象は横tabとホイールに加えてCanvas上のPIVOT選択で切り替える。RIGでは位置関係を読むため全PIVOTとFolder名tagを同時表示するが、parameter行は選択対象一件だけをContextual Inspectorへ表示する。
- CAF共通PIVOT、Folder / BONEのBind SetupはRIG、時間変化するClip / Part / Bone keyはMOTIONへ分離する。RIG PIVOTはactiveを青 / 水色、inactiveを薄いクリーム内側 + 栗茶輪郭としてSetup modeを示し、中心dragで位置、尻尾drag / wheelで初期角度を操作する。MOTIONの選択BONEは橙の中心 + 楔を維持し、中心dragで移動、楔dragで回転する。WARPはPhase 6sでCAF全体とstable Folder targetを同じdeformer契約へ接続済み。
- PIVOT接続線は装飾ではなく`parentBoneId`の表示・編集結果とする。rigid FKでは親の移動・回転が子孫へ伝播し、子操作は親へ逆流しない。「手を動かして腕を追従」「腕を伸縮」「先端だけ変形」はIK / Stretch / Meshへ分離する。
- PIVOTからkey併用dragで破線previewを伸ばし、別PIVOTへdropして親子接続する操作をshortcut候補とする。既存の長押し接続と接続線dragを置換せず、同じ`parentBoneId` setter、cycle検査、1 Historyへ接続する。使用keyはWARP / selection / Camera shortcut監査後に決め、touchは長押し、Escape / pointercancelはnon-mutationとする。

### Folder別WARP GRID実装境界（Phase 6s完了）

- 現行`ClipInstance.deformer`はCAF全体一件の正本であり、対象tabをFolderへ切り替えるだけでは複数Folderの同時WARPを保持できない。単一deformerへ一個の`targetInternalLayerId`を足す案は、髪と衣服等を同時に揺らせないため採用しない。
- 第一候補は、root互換の`deformer`を維持しつつ、optionalなFolder target collectionから既存`clip-deformer` / GRID topology / sampler / rasterizerを再利用する。collection自体へ別の変形アルゴリズムを作らない。
- targetはCAF内部Folderのstable ID。copy / pasteでは既存internal Layer ID mapでremapし、削除・重複・Raster target・clipping分断をvalidationで拒否する。
- 評価順は`Folder subtree合成 → Folder-local WARP → Bone / Part world matrix → CAF合成 → 既存CAF root WARP → root Motion`を第一候補とする。これにより髪の揺れを頭BONEへ追従させつつ、旧CAF全体WARPを維持する。
- Pixi previewだけの実装は禁止し、CPU compositor / Bake / export / onion / Project round-tripを同じsample結果で通す。Folder RenderIslandをoffscreen化できない、nested exclusive islandやFolder clippingが分断される場合は`REVISE`とする。
- UIはWARP tabでもCAF / Folder対象tabを有効にし、選択Folderのkeyだけを子Laneへ投影する。未設定targetは明示的な「GRID作成」から開始し、別FolderのGRIDを無言共有しない。

UI候補:

1. 上部Contextual Inspector + Canvas handle + Animation Table子行
2. 左右どちらかのRig Inspector + Canvas handle + 選択trackだけTimeline表示
3. 狭幅 / touchでは下部sheetへInspectorを移す

第一候補は1。Rig規模とUI密度の実測で2または併用へ切り替える。保存schemaはUI配置から独立させる。

## 15. Gate 0 — 正式Phase前の実コード監査

必ず確認する。

### 正本

- ClipAsset / ClipInstance / TimelineModelの所有
- CAF内部Folder stable ID
- Motion / WARP / deformer key schema
- History、copy / paste、save / load

### 描画

- Folder clipping / blendとRenderIsland相当
- working Layer / preview / compositor / export評価順
- `control-mesh-topology.js` / `control-mesh-deformer.js`の利用可能範囲
- CPU / Pixi / UV / bounds / cache / dispose

### 入力と時間

- pointer capture / coalesced event / fixed clock
- screen → world → Clip local変換
- Clip retimingとFrame sampler
- playback / onion / thumbnail / exportのsample共有

### Solver / Dynamics

- transform math、angle wrapping、inverse bind
- hierarchy cycle検出
- random seek、fixed timestep、cache基盤
- Project切替とdispose

Gate成果物:

- 現行構造図
- 再利用module一覧
- 重複候補一覧
- 不足契約とrisk
- Plan A / B比較
- 最小prototype
- Phase分割案
- `GO / REVISE / STOP`

### Phase 6i Gate 0結果

判定は`GO`。現行実コードから次を確定した。

- CAF内部Layer / Folderのstable `id`をPart identityとして再利用する。別の同義Part IDは作らない。
- 表示親`parentLayerId`、配列の表示順、clipping source、rig親`parentPartId`を分離する。
- 静的`rigDefinition`はClipAsset、時間変化する`rigMotion`はClipInstanceへ置く第一候補を維持する。
- asset / subtree複製とCAF pasteは共通ID mapで静的参照とmotion参照を同時に再mapする。
- Part pose / rigid FKは純粋評価器を一つだけ持ち、Pixi previewとCanvas compositorへ同じmatrixを渡す。
- 初期Part境界はclipping owner / sourceを分断しない。RenderIsland自動化とDraw Orderは後続へ送る。
- UIは選択CAFだけをAnimation Table子行へ投影するPlan Aを先行し、縦占有、名称幅、Setup操作、touch誤操作の実測でPlan Bへ切り替える。

Phase 6jでoptional Part schema / validation / ID remap / pure rigid FK、Phase 6kで一つのFolder Partのpreview / compositor / Bake / export接続、Phase 6lでPlan A子行、Folder Part登録、既存Part trackへのkey入力、Canvas handle、Phase 6mでFolder枠とLane縦密度、Phase 6nでoptional Bone schema、共有Rig ID remap、3段の純粋FK、Phase 6oで一つのroot BONE → 一つのFolder Partの明示bindingとinverse bind delta接続、Phase 6pでroot BONE作成・Pose key・RIG-first・対象tab・Setup / Animate分離、Phase 6qでCAF + 全Folder PIVOT、Canvas選択、遅延Rig登録、nested Folderの排他的RenderIsland、child Bone binding、parent Bone接続、剛体FK authoringを完了した。Phase 6rでは保存容量、KEY複数選択、tab復帰、通常Layer選択を安定化し、Phase 6sではFolder別WARP GRIDを共通RenderIsland / Project / Bake / exportへ接続した。Phase 6tでは保存targetを増やさず既存Bone Poseへ確定する固定長2-Bone IKを完了した。Phase 6uではWARP GRID初期auto-fitとRaster共有point-mapを完了し、保存anchor ConstraintはGate 1 `HOLD`で後続候補へ送った。Motion主UIはBONEへ一本化し、Folder Part trackは旧Project互換schemaとしてのみ維持する。詳細は`開発用資料保管庫/Archive/phase6i.md`〜`phase6u.md`を正本とする。

### Phase 6v Gate 0結果 — 一枚Raster / 複数BONE / Skin Mesh

制作要望は、一枚の腕Rasterへ肩・肘・手首等の任意数PIVOTを置き、親子Boneの回転へTriangle Meshを追従させ、
三枚の剛体Folderへ分割しなくてもゴム状に曲げられること。Gate 0判定は`GO`とする。

- `ClipAsset.internalLayers[]` / DrawingSnapshotはRaster正本、`rigDefinition.bones[]`はstatic Bind Bone、
  `ClipInstance.rigMotion.boneTracks[]`はFrame Poseとして維持する。
- 新しいMesh topology / SkinWeightはClipAssetのoptional static Setup正本とし、`rigidBindings`、
  `ClipInstance.deformer` / `folderDeformers`、Control Mesh Poseへ重複保存しない。
- Boneごとに`currentWorld * inverse(bindWorld)`を一度求め、bind vertexをweight付きで合成するpure evaluatorを一つ持つ。
  Frameごとの頂点、UI selection、GPU buffer、alpha scan cacheをProjectへ保存しない。
- 既存`control-mesh-topology.js`のrect / Delaunayと`warp-grid-rasterizer.js`のtriangle adapterは再利用候補だが、
  static Skin Meshの正本にはしない。
- Raster Meshは後続描画proofで各Rasterへclipping前に適用する候補。最初はclipping owner / sourceへ参加しない
  一Rasterに限定し、unsupportedを無言fallbackしない。
- 自動Meshの第一候補は既存alpha content boundsへfitするdeterministic `Alpha-fit Grid`。
  これはAuto Contourではなく、輪郭 / hole / islandとLINE向け3列Ribbonは別generatorへ分離する。
- 自動weightの第一候補はBone segment距離による最大2 influence。生成確定後はstatic Setupとして固定し、
  Raster変更時は`STALE`表示だけを行い、明示操作なしにtopology / weightを再生成しない。

Plan Bの「既存Control Mesh PoseをBoneから書き換える」は、Asset SetupとInstance Pose、手動WARP keyを二重所有するため
採用しない。ToonSquidのBone / MeshもBind PoseとAnimate Poseを分け、Mesh control pointをBoneへbindする構成であり、
Tegakiでは現行正本へ合わせて同じ概念分離だけを採る。

Phase分割は、6v static schema / pure LBS、6w fixed Raster render proof、6x one Raster / multi-PIVOT authoring、
6y Alpha-fit Grid / auto distance weightの順で実施し、2026-08-02にSOL最終判定`A`でcloseした。

- static Mesh / SkinWeightは`ClipAsset.meshDefinitions / skinBindings`、Bind Boneは既存`rigDefinition.bones`、
  Frame Poseは既存`ClipInstance.rigMotion.boneTracks`だけが所有する。
- preview / playback / onionとCPU compositor / Bake / exportは同じinverse-bind LBS評価済み頂点を使う。
- RIG / MOTIONのRaster targetはPart / rigid bindingを増やさず、複数Mesh BONE、既存parent接続、既存Bone keyへ接続した。
- Alpha-fit Gridはwide 8×4、tall 4×8、square 6×6、最大2 distance influence。Raster変更時は`STALE`表示のみで、明示再生成までstatic Setupを維持する。
- clipping参加Rasterとactive Folder WARP / rigid RenderIslandの同時適用、manual weight、Auto Contour、LINE Ribbon、Mesh Bone IKは後続Gateへ残した。

## 16. Phase候補

順序はGate 0で確定する。

### Candidate A — Rig Core

- Part / RigDefinition
- Bind Pose
- rigid FK
- Setup / Animate
- save / load / History

到達点: MeshなしでCAF内部Partを親子変形できる。

### Candidate B — Triangle Mesh Core

- fixed triangle proof
- Manual Mesh
- UV / stable ID / topology lock
- CPU / preview / export一致

### Candidate C — BONE Skinning

- inverse bind
- SkinWeight
- auto distance weight
- manual smooth

### Candidate D — IK / Follow / Stretch

- Effector、2-Bone IK、Pin
- distributed follow
- fixed / limited stretch

#### Phase 6t第一境界（Gate 0 2026-08-01）

- 第一実装はproposal上の`A Pose Bake`。末端Bone rootをtargetとし、直上のparent / grandparent二本のrotation結果だけを既存`rigMotion.boneTracks`へ保存する。
- segment長は現在評価した`root -> joint -> effector`のBone root間距離。PIVOT表示用`bone.length`を親子距離の正本へ変更しない。
- CanvasからCAF Project座標への変換、Bone key setter、Timeline History、Motion PIVOT、`evaluateRigidBones()`と共通RenderIslandを再利用する。
- IK authoring toggleがoffの時は現行FK操作を維持する。unreachable targetは固定長clampし、scaleやFolder Part trackを変更しない。
- Effector target track、runtime Constraint、rotation limit、chain参加、stretch、Mesh / weightはPose Bakeの実制作評価後に独立Gateで判断する。

#### ToonSquid公式仕様から採る境界（調査 2026-08-01）

- [Bones handbook](https://toonsquid.com/handbook/effects/bones/)は、親から子へ伝える通常操作をFK、末端のIK targetからchainの位置・回転を解く操作をIKとして明確に分離している。Tegakiも現在のrigid FKを壊さず、末端PIVOTを動かす`IK target mode`を別constraintとして追加する。
- 最初の実装候補はMesh不要のrotation-only 2-Bone IK。手targetのX / Yから前腕・上腕の角度だけを解き、segment長は評価済みBone root間距離へ固定する。表示用`bone.length`は使わない。肩より上をchainへ含めるかは`chain length`またはancestor参加toggleで明示し、分岐Boneを無言で巻き込まない。
- [ToonSquidのIK](https://toonsquid.com/handbook/effects/bones/#inverse-kinematics-ik)にあるrotation limit、Ignored by IK、Max IK Stretching相当は一つのcheckboxへ混ぜない。Tegakiでは`FK / IK`、回転範囲、ancestor参加、`fixed / limited stretch`を独立parameterとし、stretch 0を既定とする。
- rigid Folderだけでも2-Bone IKの回転追従は実装可能。腕の伸縮や周辺画素の滑らかな曲げは別段階であり、[Mesh handbook](https://toonsquid.com/handbook/effects/mesh/)のようなtriangle control点とBone binding / weightの正本が確定してから有効化する。自動MeshをIK開始条件にはしない。
- UI第一候補はMotion tabで末端Boneへ`IK target`chipを付け、Canvas上の末端PIVOT dragをtarget X / Y keyへ記録する。RIG tabはchain、親、Bone length、rotation limit、stretch上限のstatic Setupだけを所有する。
- 評価順は`sample FK key → IK target keyをsample → rotation limit付き2-Bone solve → optional limited scale → Bone world matrix → rigid Folder / 将来Skinning`。preview / random seek / Bake / exportは同じ純粋solverを使う。

#### WARP GRID初期bounds auto-fit（Phase 6u Gate 0 2026-08-01）

- 新規GRIDの初期中心と大きさはCanvas全体ではなく、選択CAFまたはFolder subtreeのeffective-visible Rasterについてalpha実内容をunionしたProject boundsから決める。
- tight boundsへ各軸5%または4 Project pxの大きい方を余白として足す。negative boundsはCanvasへclampせず、空対象だけ保存Raster bounds、最後にCanvas boundsへfallbackする。
- fixed 4x4 WARPと可変Control Mesh、新規作成と明示refitは同じpure helperを使う。既存GRIDを開いただけでBindやkeyを変更しない。
- alpha scanは既存`calculateOpaqueRasterBounds()`とsnapshot bounds cacheを再利用する。Folder / ClipAssetへauto-fit boundsを保存せず、別cacheや第二正本を作らない。
- Stage Bでは既存topology / placement / triangle判定を共有するpure point-mapを固定し、次のanchor ConstraintがRaster pathと異なる近似式を持たないようにする。
- Phase 6uはSOL review 2判定`A`でStage A / Bをcloseした（2026-08-01）。`fitWarpGridBindBoundsToContent()`、新規作成 / 明示refit接続、fixed / Control Mesh共通verifier、surface上限超過拒否、AnimationTablePopup adapter経由のCAF / Folder分離・hidden・clipping fixtureを受入れた。`warp-triangle-point-map.js`へRasterと共有するbarycentric / epsilonとBind Project点→Pose Project点のpure mapを置き、既存topology / placement、保存triangle順、明示失敗理由を固定した。`warp-grid-rasterizer.js`のpixel coverage / premultiplied合成は変更していない。全26 verifier、node --check、build、Stage A Browser smoke、生成物清掃を通過した。
- WARP anchor ConstraintのSOL Gate 1はPhase 6uでは`HOLD`とし、保存shapeを追加せずcloseした。Phase 7cでstatic relationを`ClipAsset.rigDefinition`、Frame poseを既存`ClipInstance.folderDeformers`へ分離し、direct-child限定の一方向評価と共通ID remapを実装した。Stage A / B、LUNA限定修正、SOL review 5=`A`、Owner軽量実機受入を完了し、2026-08-09にcloseした。

#### WARP anchorから子PIVOTを追従させる案（制作要望 2026-08-01）

- 例: 前腕Folderの手首をFolder WARPで曲げた時、HANDのPIVOTとHAND配下も変形後の手首位置へ追従させる。
- これはPIVOT overlayだけを動かす表示optionではない。playback / onion / Bake / export / reloadで同じ結果が必要なため、将来は保存可能な`WARP anchor constraint`として扱う。
- sourceはstable Folder IDと、そのFolder WARPのBind領域内に置く一つのProject座標anchor。destinationはsource Folder Partのrigid binding Boneに対するdirect-child BONEとし、単なる`parentBoneId`や静的Bind Poseへ混ぜない。
- ClipごとにFolder deformer topologyが異なり得るため、triangle index / barycentric weightはAssetへ保存しない。各Frameは既存deformer sampling、placement、`warp-triangle-point-map.js`から決定的に派生し、Raster用とは別の近似式や第二WARP正本を作らない。
- 第一評価候補は`Folder WARPをsample → anchorのdeformed local point → source側の既存Part/Bone world → downstream child PIVOT constraint → child Bone/FK → RenderIsland`。sourceとdestinationが相互依存するcycle、子孫WARPから祖先PIVOTへ戻る参照、unsupported nested targetは明示拒否する。
- UI第一候補はWARP tabの選択Folderで`子PIVOT追従`を有効にし、Canvas上でanchorと対象PIVOTを接続する導線。checkboxだけで暗黙に最寄りPIVOTへ接続せず、対象名と接続線を表示する。
- Gate 0では既存`resolveWarpPlacementGeometry()`、rect / Control Mesh topology、CPU / Pixi経路から共有できるpure point-mapを特定する。既存private barycentric代数を別moduleへ複製しない。
- Phase 6tのPose Bake IKへ混ぜない。Phase 7cのproofは一つのFolder WARP anchorから直下の一つの子PIVOTへ限定し、History、copy / paste ID remap、random seek、save / reload、Bake / export一致を固定した。詳細は`開発用資料保管庫/Archive/phase7c.md`。

#### Attachment / Space Switchと「手放す」Frame（制作要望 2026-08-01）

- 腕を回すIKと、ボールが手へ付いてくる関係は別責務。IKは腕chainを解き、ボールはHAND BONE / PIVOTをtargetにしたAttachment / Follow constraintで追従させる。
- 長期的にスマートな方式は、ボールを最初から別CAF / 別Laneへ置き、`targetId + maintain-world offset + weight / enabled track`を一つのConstraint正本として持つSpace Switch。キャラクターCAF全体をrelease地点で複製しない。
- release Frameでは、直前までのattached world poseを同FrameのボールMotion keyへ一度確定してからweightを`1 → 0`へ切り替える`手放す`commandを用意する。これにより位置跳びを防ぎ、そのFrame以後はボール独自の軌道・回転・伸縮を編集できる。
- 最初のMVPは一target、HOLD型`attached / free`、maintain-worldだけでよい。複数target間のblend、連続weight、軌道生成、物理投球は後続Gateへ分離する。
- 現行Phase 6tの`IK追従`はruntime authoring toggleで、結果はBone Pose keyへBake済みである。したがって現行方式では「release FrameでIK toggleをoffにする」保存操作は不要。将来Effector Target方式を採用した場合だけ、IK constraint weightのkey化を別に検討する。
- 現機能での制作回避策は、ボールだけを別CAF / Laneにし、release FrameでボールClipをsplitまたは複製して後半を独立Motionにする方法。短編では成立するが、release前の追従修正、retime、再利用で二重編集になるため恒久仕様にはしない。

### Candidate E — Quick Rig

- Primitive Cage
- BONE preset
- auto weight
- source STALE / regenerate確認

### Candidate F — Motion Perform

- Clip root capture
- BONE Effectorへ拡張
- Hold / cancel / History / export一致

### Candidate G — Draw Order

- RenderIsland
- HOLD order track
- clipping安全性

### Candidate H — Dynamics

- rotation-only pendulum
- multi-chain
- seek / export決定性
- 後続でsimple Collider

Auto Contour、Ribbon、Rigid Body、Contact Deformationは独立candidateまたは研究へ分離する。

## 17. 容量・性能

計測項目:

- Part / BONE / Constraint / Chain / Collider数
- MeshVertex / Triangle / influence数
- Frame / key / raw sample数
- onion数とpreview FPS
- CPU export時間
- Project / History byte
- checkpoint / cache / GPU resource peak
- 400×400、大Canvas、high-DPI、mobile

原則:

- 全Frameのdeformed vertexやsolver stateを無制限常駐しない。
- cacheはrevisionと上限を持ち、Project切替でdisposeする。
- Perform raw sampleとsimulation stepをProject / Historyへ積まない。
- 自動生成、Rebind、Bakeは容量preflightとcancel / rollbackを持つ。
- 正しさを固定する前に抽象化やGPU最適化を広げない。

## 18. 共通受入条件

- Rig / Mesh未使用Projectのpixelが変わらない。
- optional schema欠損を安全に読める。
- cyclic hierarchy、dangling ID、invalid topologyを無言修復しない。
- Bind PoseとAnimate Poseを分離する。
- preview / playback / onion / Bake / export / reloadが一致する。
- random seekと順次再生が一致する。
- GPU / CPU差が許容範囲内。
- Topology / Weight再生成でAnimationや手動修正を無言破棄しない。
- 1 gesture = 1 History。
- cancelで正本、cache、Historyへ残さない。
- copy / paste時にstable ID参照を再mapする。
- clipping / RenderIsland / Draw Orderを壊さない。

## 19. 停止・再設計条件

- Clip MotionとRig Motionが同じtransformを重複所有する。
- BONEとMeshがBinding正本を別々に持つ。
- existing Control Meshと新Triangle Meshが同じ責務を重複する。
- previewとexportでsolver / evaluatorが分裂する。
- random seek結果を固定できない。
- topology変更を安全に扱えない。
- SkinWeightを保存・Undoできない。
- RenderIslandを確定できずclippingが壊れる。
- Performが実用不能なkey量になる。
- Dynamicsが画面FPSへ依存する。
- cache invalidationや容量上限を定義できない。
- GPU backendがfallbackなしで必須になる。

停止時の縮退案:

- rigid Part FKのみ
- fixed Triangle / Direct Vertexのみ
- Primitive Cageのみ
- 2-Bone IKのみ
- Stretch / Draw Order / Dynamicsを後送り
- Motion PerformをClip root限定
- DynamicsをBake専用または単一振り子限定
- ColliderをGroundだけに限定

## 20. 原案からの統合方針

- 個別案の長所、懸念、代替は本書の第一候補 / Plan B / 切替条件へ移した。
- 数式、細かなschema候補、レビュー指摘、tool比較は原文へ残した。
- 原案のPhase番号やmodule名は現行実コード照合前の仮案として扱う。
- 本書へない案を原文から復活させる場合は、重複正本を作らない理由と停止条件をPhase指示書へ書く。
