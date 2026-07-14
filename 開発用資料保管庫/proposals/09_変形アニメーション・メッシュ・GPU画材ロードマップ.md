# 変形アニメーション・メッシュ・GPU画材ロードマップ

更新日: 2026-07-14

## 判断

- Phase 5wで既存 `ClipInstance.transform` / `transformKeyframes` のposition / scale / rotation / anchor、hold / linear、描画・複製・History経路を完成した。新しい運動正本は増やしていない。
- Phase 5xでAnimation編集設定と共通control配色、Phase 5yで単一Motion key clipboard、Phase 5z1でMotion key管理とcopy feedback、Phase 5z2でopacity、Phase 5z3でClip blend、Phase 5z4でAnimation Tableのポインター操作改善、Phase 5z5でcubic-bezier samplingとpreset UI、Phase 5z6で同じ正本を操作する小型Segment Easing Editorを完了した。Bone / constraint、mesh、physics、WebGPUは下記の段階順を維持する。
- Phase 5y完了後はPhase 5z1から既存Motion正本の管理・表現parameterを小分けに拡張する。Phase 6はmesh / morph用deformer正本を初めて導入する大区切りの候補とし、単なるMotion UI追加で繰り上げない。
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

- 既存WebGL経路に対する画質または応答性の改善を固定入力で示せること。
- 保存、Album、Undo/Redo、CAF、animation exportで結果を失わないこと。
- device非対応時のfallbackが実用可能であること。
- GPU機能のためにLayer / ClipAsset / DrawingSnapshot正本を二重化しないこと。

## 別動画WEBUIとの境界

- 複雑なretiming、effect stack、compositingは将来の動画WEBUIが適する。
- Tegaki側はCAF / CAF Group、parameter track、stable asset idを交換できる正本を整える。
- 動画側clipからTegakiへ戻す場合は、可逆編集を保証できないeffectを整数FrameのCAF列へbakeする。
