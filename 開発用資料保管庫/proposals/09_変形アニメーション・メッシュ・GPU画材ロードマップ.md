# 変形アニメーション・メッシュ・GPU画材ロードマップ

更新日: 2026-07-13

## 判断

- Phase 5wで既存 `ClipInstance.transform` / `transformKeyframes` のposition / scale / rotation / anchor、hold / linear、描画・複製・History経路を完成した。新しい運動正本は増やしていない。
- 現行Phase 5xではAnimation編集設定と共通control配色を整理する。opacity、easing、Bone / constraint、mesh、physics、WebGPUは下記の段階順を維持し、5xへ混ぜない。
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
8. MOTION外に残るnumber input、select、slider、▲▼buttonの灰色・黒focus枠は、Phase 5xの共通form/controlふたばカラー監査でまとめて修正する。
9. Canvas直接操作はVキー変形のgesture計算を共用し、Clip Motion active中だけ描画入力を一時停止する。drag=position、wheel=scale、Shift+wheel=rotationを候補とし、V変形とMOTIONは同時にactiveにしない。破壊的raster変形とClipInstance key更新のcommit先は分離する。
10. CAFでVキー変形中は合成previewを一時停止してworking Layer原画を表示する既存契約を維持する。全Frame共通の「原画編集mode」は新設せず、現在の編集対象と合成モーション一時非表示をUIで明示する。

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

### B. 表現parameter — 優先度B / 難度 中〜高

- opacityをAと同じscalar補間へ追加する。
- tint / color mixは色空間とalpha契約を固定し、静止画・animation export一致を先に試験する。
- easing curve、Perform記録、軌跡編集は正本とsamplingが安定してから追加する。
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
