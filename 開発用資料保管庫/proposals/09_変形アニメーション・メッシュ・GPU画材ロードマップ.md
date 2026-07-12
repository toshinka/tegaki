# 変形アニメーション・メッシュ・GPU画材ロードマップ

更新日: 2026-07-13

## 判断

- 次に着手するのはWebGPUやmeshではなく、既存 `ClipInstance.transform` / `transformKeyframes` を完成させるPhase 5wとする。
- 現在はposition / scale / rotation / anchorの静的保存・複製枠と描画経路がある一方、keyframeの形状、補間、Frame描画への適用が未契約である。新しい正本を増やさず、この空白を埋める。
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

