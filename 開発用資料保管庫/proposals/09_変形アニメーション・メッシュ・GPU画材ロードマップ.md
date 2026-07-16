# 変形アニメーション・メッシュ・GPU画材ロードマップ

更新日: 2026-07-17

## 判断

- Phase 5wで既存 `ClipInstance.transform` / `transformKeyframes` のposition / scale / rotation / anchor、hold / linear、描画・複製・History経路を完成した。新しい運動正本は増やしていない。
- Phase 5xでAnimation編集設定と共通control配色、Phase 5yで単一Motion key clipboard、Phase 5z1でMotion key管理とcopy feedback、Phase 5z2でopacity、Phase 5z3でClip blend、Phase 5z4でAnimation Tableのポインター操作改善、Phase 5z5でcubic-bezier samplingとpreset UI、Phase 5z6で同じ正本を操作する小型Segment Easing Editorを完了した。Bone / constraint、mesh、physics、WebGPUは下記の段階順を維持する。
- Phase 5z1から5z8までの既存Motion / Resize正本を完了し、Phase 6でmesh / morph用deformer正本を初めて導入する。単なるMotion UI追加ではなく、固定4×4 Warp Gridの保存・samplingを最初のgateとする。
- Phase 6は固定4×4 Warp Grid v1、Bind / Animate、key時間drag、Project / export、非破壊Bakeまで完了した。Phase 6bではv1を黙って一般化せず、可変密度矩形Gridと任意Meshの間に互換gateを置く。
- opacityと色変化はtransform補間の安定後に追加する。色はsRGB/linear、alpha、blendとの関係を決めずに「グラデーション」として混ぜない。
- 密なmeshを手で打つLive2D型を最初の到達点にしない。ToonSquid系の少数control point、cage/lattice、自動weight生成を優先候補とする。
- 水彩・油彩はWebGPUへのrenderer置換ではなく、pigment / water / wetness / height等の永続状態を持つ別brush研究として扱う。

## 段階計画

### A. Clip transform keyframe基盤 — 優先度A / 難度 中

1. keyframe schemaを `frame + values + interpolation` に固定する。
2. position、scale、rotationを純粋関数でsamplingする。最初はhold / linearのみ。
3. Table preview、閉Table再生、onion、GIF/WEBP exportを同じsample結果へ接続する。
4. save/load、copy/paste、CAF Group、Undo/Redoでkeyframeを失わない。
5. 最小UIは選択CAFの現在Frameへkeyを置く操作と数値編集に限定する。
6. 回転中心はClipInstance単位のanchorを正本とし、Frame keyには含めない。Vキー変形は十字site、Clip Motionは将来Boneのrootを想起できるhead付き楔形siteとして表示を分け、座標変換ロジックだけを共用する。楔形は現段階ではUI表現でありBone正本を追加しない。Canvas外座標も許可し、中心のFrame別key化は軌跡・easing UIと合わせて別途判断する。中心移動だけでmotion keyを自動作成しない。
7. Frame keyの操作iconはTimeline上の丸markerと対応する単純なcircleとし、回転中心の楔形と視覚役割を分ける。checkは「完了」、flagは「範囲marker」と誤読しやすいため採用しない。
8. Canvas直接操作はVキー変形のgesture計算を共用し、Clip Motion active中だけ描画入力を一時停止する。drag=position、wheel=scale、Shift+wheel=rotationを候補とし、V変形とMOTIONは同時にactiveにしない。破壊的raster変形とClipInstance key更新のcommit先は分離する。
9. CAFでVキー変形中は合成previewを一時停止してworking Layer原画を表示する既存契約を維持する。全Frame共通の「原画編集mode」は新設せず、現在の編集対象と合成モーション一時非表示をUIで明示する。
10. Clip pivotの楔形表示はheadを中心、tailを向きの表示とし、UI上の0°は時計と同じ上向きにする。tailは現在Frameのsampled rotationへ追従するが、これは既存Rotationの可視化でありBone正本ではない。将来のBoneでは `restAngle / axis length` をRotation keyとは別parameterとして持ち、pivot編集時だけRotation入力の意味を差し替えない。

### A2. Motionの確定・時間操作 — Phase 5w後の候補 / 難度 中〜高

1. **Motionをコマへ展開（Bake Motion to CAF Frames）**
   - 元Clipを直接破壊せず、複製先へ整数Project Frameごとのcompositor sampleを焼き込み、1 Frame CAF列へ変換する明示操作とする。
   - 変換後は各コマへ通常のペン描画を加えられる状態にし、元の `transformKeyframes` を残す版と置換する版を分ける。最初は安全な「複製して展開」を既定候補とする。
   - Folder clipping、上側Lane前面、内部Layer、alpha、ClipAsset共有/複製、Undo/Redoを一括変換契約に含める。preview canvasの見た目だけをsnapshot化して正本構造を失う実装にはしない。
   - easingやsubframe motionを含む場合も、bake先はProjectの整数Frameへsampleする。別動画WEBUIとの交換時にも同じbake入口を再利用する。
2. **作画露出とMotion sample rateの分離**
   - 「Clip固有FPS」だけを追加しても、project playback/export FPSが低ければ表示は滑らかにならない。Project Frameを小数化せず、作画CAFは整数Frameでholdし、出力sample rateだけ高くした時にMotion transformをsubframe sampleする二段構造を候補とする。
   - 最初に `projectFrame -> time(seconds) -> motion local time` の丸め、loop端、GIF/WEBP等の出力FPS上限、onionと編集cursorは整数Frameのままかを契約する。
   - UI上の青系識別は「高FPSそのもの」ではなく、subframe Motion samplingが有効なClipの状態表示候補とする。既存の橙色選択・Lane前後関係を色だけで上書きせず、icon/patternも併用する。
3. **複数選択CAFのDURATION一括増減**
   - Ctrl選択中のCAFへ同じduration deltaを1 Historyで原子的に適用する操作を候補とする。Group全体の開始位置・間隔まで比例伸縮するretimingとは分け、Phase 5uの「Group時間比率伸縮は動画側」の境界を維持する。
   - 各Laneの衝突、Clip末端keyの追従、Project総Frames超過を事前検証し、1件でも成立しなければ全件を変更しない。
   - 総Frames不足時は無言で失敗・自動拡張せず、「FRAMESを増やす」導線を注釈popupに出す。将来は確認付きの総Frames拡張を別操作として検討する。
4. **Motion keyの個別copy / paste — Phase 5y**
   - CAF clipboardとは別のruntime Motion-key clipboardを持ち、`position / scale / rotation / interpolation` をコピーして貼付先の現在Clip-local Frameへ1 Historyで置く。コピー元Frame番号やClip IDを正本として貼らない。
   - 操作はheaderのcopy / paste buttonを正式入口とする。Motion popup側shortcutは既存CAF / Layer shortcutのdocument captureより後に届くためfocus次第で不安定になる。数値input内の文字copyも維持する必要があるため、`Ctrl/Cmd+C/V` は複数clipboardの優先順位を共通設計するまで棚上げし、global shortcutを追加しない。
   - 範囲外Frame、単Frame Clip、貼付先なし、read-only再生中はpasteを無効化し、複数key・範囲copyは軌跡/easing UIと同時に別契約化する。
   - copy完了feedbackはMotion / CAF / Layerで共通toastを使い、「Motion key」「CAF」「Layer」の種別と保持中件数だけを短時間表示する候補とする。左上への常設clipboard表示やthumbnail保持は画面占有・snapshot生成コストが高いため低優先度。元名や座標はcopy時点の説明値に留め、正本参照にしない。
5. **Motion keyの一括消去**
   - 選択Clipの `transformKeyframes` だけを1 Historyで空にする明示buttonは実装価値が高い。誤操作対策としてkeyが2件以上の時だけ有効化し、Clipの静的transform / anchor、描画、他CAFには触れない。将来の範囲選択削除とは別操作にする。

### B. 表現parameter — 優先度B / 難度 中〜高

- opacityをAと同じscalar補間へ追加する。
- opacityは0..1のscalarとしてposition等と同じFrame / hold / linear契約へ載せ、compositor alpha、preview、onion、export、copy/paste、旧Project既定1を同時に揃える。最初の表現parameter候補として妥当だが、Phase 5yのpayloadへ後付けせずschema versionを上げる別Phaseにする。
- Phase 5z3でClip Motion blendを実装した。modeは `normal / add / subtract / multiply / overlay`（UIは省略せずOVERLAY）に限定し、mode自体はLINEAR選択時も左key HOLDの離散parameterとする。CAF内部Layer blendを先に完成Clipへ合成し、その一枚を下側LaneへClip blendする二段構造で、上書き優先関係にはしない。0..1 scalar `blendStrength` はClip全体opacityとschemaを分離し、指定blendで合成するClipのopacityとしてhold / linear samplingする。previewは完成ClipのPixi blend、Canvas/exportは同式のCPU pixel合成を用い、旧Project既定1、Motion clipboard v4とする。
- tint / color mixは色空間とalpha契約を固定し、静止画・animation export一致を先に試験する。
- 色変化とバケツのグラデーションは、sRGB↔linear変換、alpha補間、色stop評価の純粋utilityを共有できる可能性がある。一方、Motionは時間軸、バケツは空間軸なのでUI・History・描画処理は共用しない。バケツgradientの仕様が固まった段階で色評価utilityだけを切り出す。
- easing curve、Perform記録、軌跡編集は正本とsamplingが安定してから追加する。
- Phase 5z5のeasingは左key区間の `cubic-bezier(x1,y1,x2,y2)` を正本とし、各値0..1、欠損時linear、hold時無視、全round-trip、preset UIまで完了した。Phase 5z6で別windowの単一区間curve editor、2 handle、数値wheel / scrub、pointerup 1 History、再生read-onlyを追加し、オーナー実機確認を終えた。
- 複数keyを横断するLive2D型の実parameter graphはSegment Easing Editorを置換せず、`10_Motion_Graph・Easing・Motion_Path設計.md` のMotion Graphとして分ける。最初は同じ複合key / shared easingをread-only表示し、Canvas直接操作、数値 / marker、graphから同じ `transformKeyframes` を編集する。parameter別curve、途中点追加、overshoot / spring / bounceは段階gateを越えてから扱う。
- Perform記録は生pointer列を保存せず、key削減とUndo単位を定義する。

### C. 簡易warp / morph — 優先度B / 難度 高

- ClipAsset画像正本は変えず、ClipInstance側に非破壊deformer参照を持つ。
- 第一候補は少数点cageまたは粗いlattice。自動格子、自動weight、輪郭推定を手打ちmeshより優先する。
- morphはcontrol pointのkeyframe補間として実装し、Frameごとのraster複製を正本にしない。
- hit test、範囲外pixel、onion、export、低解像度preview、CPU fallbackをprototypeで評価する。
- Phase 6 Slice 0ではinline `ClipInstance.deformer` version 1として固定4×4、Bind Bounds基準の正規化16点、全点pose key、clip-local Frame、hold / linearを採用する。共有deformer collectionや任意Topologyは必要性が出るまで導入しない。
- static poseを暗黙の始点 / 終点とし、duplicate keyは末尾、Clip範囲外keyはsampling時に無視する。Slice 0は描画へ接続せず、Project / History / CAF clipboardのround-tripを先に固定する。
- Slice 1は固定4×4を18 triangleへ分割するCPU reference rendererを描画一致oracleとし、評価順を `ClipAsset合成 -> Warp -> Clip Motion` に固定する。非破壊編集の入口はCLIP MOTION、Layer TransformはRaster確定編集として分離する。Lucide `grid-3x3` はBind / Animate UIの候補とし、実UI契約確定前には追加しない。
- WebGPUは全面凍結を恒久条件とせず、CPU固定入力一致、device loss、WebGL fallback、readback / animation export境界、実測上の優位を満たす場合にPhase 6の正式Sliceとして採用できる。採用開始時に `TEGAKI.md` / `AGENTS.md` の凍結記述を同時更新し、CPU rendererをfallback兼比較oracleとして維持する。
- Phase 6 previewでは、完成ClipをRenderTextureへ一枚化してから固定16点 / 18 triangleへ渡すPixi Mesh adapterを採用した。これはCPU topology / samplingと一致するpreview限定adapterで、WebGPU renderer既定化ではない。CLIP MOTIONの `grid-3x3` を入口とし、Layer Transformへ非破壊deformer入口を重複させない。
- Phase 6 Slice 2の実制作評価では、四隅を台形・平行四辺形へ動かす疑似パースと内部点の局所変形が有効だった。将来は平面上の時計盤などをWarpした後、その内部要素を別Clip / Boneで回転させる「親deformer + 子transform」を検討する。単一4×4 poseへ透視投影や階層回転を暗黙に混ぜず、明示的な親子評価順を先に定義する。
- Live2D Cubismの変形ブラシに相当する膨張・収縮・なで変形、ToonSquid系Shape Morph、複数点範囲選択、soft falloffは固定4×4点編集が安定した後のAnimate tool候補とする。brush strokeそのものを保存せず、確定後のcontrol point poseを同じ`deformer.keyframes`へ書くことでsampling / History / export正本を増やさない。
- 標準Layer Transform側にも破壊的なGrid Warp需要があるが、CLIP MOTIONの非破壊deformer入口とは分離する。Phase 6のClip Warpが安定した後、同じCPU sampling / mesh topologyを再利用し、確定時にRasterへbakeする別操作として設計する。
- 外部参考3資料からは、ToonSquid系の「Canvas / 数値 / Timelineから同じcontrol point正本を操作する」考えと、Callipeg系の選択中modifierだけに操作を出すcontext actionを採用する。任意Mesh schemaやeffect stackは資料だけから導入せず、現行固定4×4契約を優先する。
- Phase 6のcontext actionは `WARP · ANIMATE`、現在Frameの`KEY / SAMPLED`、前後Warp key移動、Bind pose reset、現在key削除、Warp全削除に限定する。前後移動は空きCAF生成もHistory追加も行わず、変更操作だけを各1 Historyとする。Bind編集は`bindBounds / bindPoints`の再設定契約を確定する別Sliceまで自動解放しない。
- Figma Motion / AE 2026資料からは、Canvas直接操作と選択modifierのContextual Inspectorを併用する境界を採用する。現在の明示Warp keyが所有する次区間だけ`LINEAR / HOLD`を変更し、補間中の`SAMPLED` Frameから暗黙keyは作らない。Auto Key、Property全track、Preset、Text、Property Link、Value / Speed GraphはPhase 6へ混ぜない。
- control pointのDOM overlay / hit test / drag / multi-select / snap / 1 gesture 1 Historyは、Warp・将来Shape Morph・Boneで再利用できるcontroller候補とする。一方で保存正本、sampling、評価順は種類別に維持し、「共通UI engine」を「共通deformer schema」へ拡大解釈しない。

### D. Bone / 演算アニメ — 優先度C / 難度 高〜非常に高

- Clip Motionの単一anchorは将来Boneのroot候補だが、単一pivotだけでBoneとは呼ばない。複数joint、rest pose、親子空間、weight/deformerが揃う段階で別のRig正本を導入する。
- Lane縦順をそのままBone親子順にはしない。最初の実証は、子Lane/Clipが親Laneの評価済みtransformから `position / rotation / scale` をchannel別ON/OFF・weight付きで参照する明示constraintとする。
- 参照関係は循環禁止DAGとし、同Frameに親CAFがない場合の挙動を `rest / hold / disabled` のどれかへ固定する。複数CAF、Group、Folderを跨ぐ暗黙継承は行わない。
- constraint計算は `static transform -> keyframe sample -> parent constraint -> deformer/physics` の一方向へ限定し、export、onion、previewで同じ評価器を使う。物理演算結果は再現可能なparameter trackへ記録し、確定時にkeyへbakeできるようにする。
- Bone設定時の影響Lane表示はLane onionの描画色・display-only containerを再利用候補とするが、Lane onionのON/OFF stateをRig選択正本へ流用しない。親、子、影響weightを別の一時overlayとして示す。
- Live2D的な変形にはBone階層だけでなくCのcage/latticeとweightが必要。第一段階は剛体的な親子transform、第二段階で少数control pointへのweight付与、第三段階でphysicsとする。
- BoneはCのcontrol pointへweightで作用させる。meshと別の画像正本を持たない。
- physicsや自動追従の出力先はparameter trackとし、確定時にkeyframeへbakeできるようにする。
- Live2D的な細密rigより、少数bone + 自動weight + 制約presetを先に評価する。
- AI補間、physics、mesh、boneを同一Phaseへ入れない。

### E. WebGPU brush研究 — 優先度C / 難度 高

1. 現行airbrushの帯状化、dab間隔、alpha蓄積、large brush時のframe timeを固定入力で測る。
2. 独立prototypeで「大径soft dabの蓄積」1 workloadだけをWebGLとWebGPUで比較する。
3. readback、RenderTexture相当、save/export、device loss、WebGL fallback、二重保守コストを測る。
4. 優位性が確認できた場合だけ、本体renderer更新とは別Phaseで限定導入する。

### F. 水彩・油彩 — 優先度C / 難度 非常に高

- 水彩候補: pigment量、水分、紙texture、拡散、乾燥、edge darkening。
- 油彩候補: pigment混色、厚み/height、stroke方向、impasto lighting。
- HistoryとCAF snapshotにsimulation stateを持つか、確定rasterへbakeするかが最大の契約点。
- 最初は小Canvas、単一Layer、確定時bakeの実験に限定し、通常penを置換しない。

## 採否gate

- 固定Warp Grid v1はProject JSON round-tripとanimation export previewを既存Timeline / compositor経路で通過した。Project reset / restore時は保存外のpoint-edit runtimeを終了し、復元Clipへ旧overlay状態を再接続しない。
- 次のBind編集では`bindBounds / bindPoints`変更時に既存keyを同じ見た目へrebaseするか、明示的にkeyを初期化するかを先に固定する。暗黙の半変換は採用しない。
- 固定GridではBind変更自体がtextureの基準三角形を変えるため、全画像の完全不変は保証しない。既存poseは旧BindからのProject座標px差分を新Bindへ移し、変形量とHOLD / LINEAR metadataを維持する。現在Raster boundsへのrefitは実装済みで、任意Bind点編集は専用modeと警告を伴う後続UIとする。
- 任意Bind点編集は`WARP · BIND`専用modeとして実装した。Animate key編集と同時には有効にせず、SAMPLED Frameでもkeyを生成しない。全poseのpx差分rebaseとpointerup 1 Historyを共通契約とし、Bind後続は非破壊Bakeへ進める。
- 非破壊Bakeは元Warp Clipを非表示で保持し、整数Frameごとにtight DrawingSnapshot、新ClipAsset、duration 1 CAFを生成する。評価はexport compositorのClip単体経路を再利用し、blend mode / strengthはRasterへ潰さずbaked Clipへ残す。Project / export round-trip確認後に固定Warp v1の完了gateとする。
- Phase 6bでは、Bake列の保存 / export回帰を先に閉じた後、固定Gridのpoint / cell / triangle / overlay edge生成をDOMやrendererから独立した矩形Grid topology helperへ寄せる。4×4入力はv1とbyte / index単位で一致させる。
- 固定16点Warpは軽量な簡易変形としてv1互換を維持する。4×8 / 8×8等の密度presetと自由control point追加は、Warp v2ではなく新しいControl Meshを作る入口へ統合する。v1 Projectを読込時・保存時に自動変換しない。
- 変形ブラシはLive2D Cubismを参考に、変形 / 膨張 / 整形、weight、shape、size、angle、hardnessを持つ明示入力modeとして検討する。brush設定やweight配列は保存正本にせず、現在poseの複数control pointへdeltaを生成するruntime controllerとする。直接point dragは併存させる。
- 膨張 / 収縮はbrush centerまたは影響点の加重重心をpivot候補とし、整形はpure topologyのedge adjacencyを参照する。1 stroke 1 History、cancel復元、zoomに依存しない座標変換を導入条件とする。
- ToonSquid系control point操作はControl Meshの自由点追加と自動triangleを中核にする。疑似立体は少数点を輪郭・稜線へ配置して作り、格子範囲の変更で代用しない。4 corner cageが必要なら通常POINTSのmulti-select gestureとして再検討する。
- 矩形Control Meshの作成UIは`横点数 × 縦点数`の自由入力を正本にする。補助presetを置く場合は`8×8 / 16×16`等の正方形だけとし、長方形presetを列挙しない。値はcell数ではなくcontrol point数、各軸2〜32、総点数256以下とする。
- Phase 6bで8×8初期値の`横点数 × 縦点数`入力、総点数表示、256点超過disabled、軽量4×4 Warpの別入口まで実装した。矩形Meshは独自`bindPoints / triangles / keyframes`へ保存し、旧Warpを自動変換しない。次は自由点の追加/削除、Topology変更の全key整合、1 History transactionを同じ作成面へ追加する。
- Mesh全体の位置・大きさ・回転はMotion X / Y / Scale / Rotationへ代理書込みせず、Bind側の全点選択変換候補とする。別の`bindTransform`保存schemaは必要性が証明されるまで追加しない。
- CLIP MOTIONのMotion / Warpはheader key actionを共通順序にする。`current key / previous / next / reset / copy / paste / clear keys`を上段へ置き、Motion固有Curve / PivotとWarp固有Bind / Bake / Grid removeを後段へ分離する。前後button上のwheelはFrame移動だけを行いHistoryを作らない。WARP tabがGrid作成とpoint edit開始を所有するため、重複Grid toggle / edit-end buttonは置かない。
- Control Meshの将来toolは`POINT / SELECT / BRUSH`を明示切替する。通常のpose / point編集はふたば橙を維持し、BRUSHは変形 / 膨張 / 絞り / 整形をtopology adjacencyへ適用する。`B`保持dragによるscreen-space brush size変更を候補とし、tool stateやweightは保存せず確定poseだけをMesh keyへ残す。
- 四角 / 円の範囲選択はcontrol pointsのmulti-select / soft weight UIとして扱い、描画範囲やDeformer topologyそのものにしない。局所解像度はMesh point追加で増やす。
- 親Warp内の時計針回転はTopology密度では解決しないため、親deformer + 子Clip transform / Bone評価順の別gateとする。Shape Morph、deform brush、Layer Transform破壊的WarpもPhase 6b Slice 0へ混ぜない。

- 既存WebGL経路に対する画質または応答性の改善を固定入力で示せること。
- 保存、Album、Undo/Redo、CAF、animation exportで結果を失わないこと。
- device非対応時のfallbackが実用可能であること。
- GPU機能のためにLayer / ClipAsset / DrawingSnapshot正本を二重化しないこと。

## 別動画WEBUIとの境界

- 複雑なretiming、effect stack、compositingは将来の動画WEBUIが適する。
- Tegaki側はCAF / CAF Group、parameter track、stable asset idを交換できる正本を整える。
- 動画側clipからTegakiへ戻す場合は、可逆編集を保証できないeffectを整数FrameのCAF列へbakeする。
