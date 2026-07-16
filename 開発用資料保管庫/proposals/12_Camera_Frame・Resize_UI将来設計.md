# Camera Frame・Resize直接操作UI・Animation Camera Track将来設計

更新日: 2026-07-15

## 位置づけ

本書はPhase 7以降の棚上げ案である。Phase 6ではmesh / morph deformer正本を優先し、本書の大幅UI変更やCamera Trackを混ぜない。

Phase 5z8では保存Raster、Project frame geometry、Camera viewを分離できる内部契約まで整える。直接操作UIとanimation cameraは、その契約の上に別責務として載せる。

## 分離する三つの概念

1. **View Camera**
   - 編集画面のpan / zoom / rotation。表示専用で、Project保存画像やanimation exportへ作用しない。
2. **Project Frame / Resize**
   - PNG等の出力枠寸法と、必要に応じた保存内容の明示的Affine変換。History対象。
3. **Animation Camera Track**
   - 全Lane合成後のsceneを非破壊で移動・拡縮・回転して最終frameへcropするanimation正本。View CameraやRaster Resizeとは共有しない。

現在のResize「内容」はpixelを実変換するため、Animation Cameraの代用品にしない。

## 将来のResize Popup案

- popupとpreviewを正方形基調で拡大し、横長作品もpreview枠内へ収める。
- preview中央dragを内容のframing移動、wheelを接写 / ロングショット相当のscale操作とする。数値・sliderは補助操作にする。
- frame四辺dragでwidth / heightを変更する。corner dragまたは「縦横比を維持」checkでaspect lockする。
- 「内容も一緒に変形」checkを設け、OFFはProject frameだけ、ONはframeと内容のAffine変換とする。破壊的trimは別commandのままにする。
- width / height / scaleのnumber表示には既存の共通wheel number bindingを使う。横drag scrubを加える場合も同じ正規化・History commitへ接続する。
- tab切替を廃止できるかは実機prototypeで比較する。Canvas / 内容 / 両方の意味が直接操作とcheckだけで明確にならない場合は、現行modeを補助表示として残す。
- pen操作時のedge hit area、minimum frame size、preview外drag、zoom上限、aspect lock中の基準辺を先に固定する。

## Animation Camera Track案

- Projectに最大一つの特別なCamera Laneを置く案を第一候補とする。通常CAF Laneとは異なり、ClipAsset / DrawingSnapshotを所有しない。
- parameterはposition X/Y、scale、rotationを先行し、frame size animation、opacity、blendは混ぜない。
- Clip Motionと同様のkeyframe / easing primitiveを共用しても、保存正本は専用 `CameraTrack` とする。Clip transformへ架空Clipを作らない。
- compositor順は `全Lane合成 → Camera Track sample → Project frameへ最終crop → export` とする。
- Camera Lane選択中はCanvas上にframe枠と中心handleを出し、通常描画入力を奪わない明示modeを設ける。
- Camera Trackがない旧Projectはidentity cameraとして完全互換にする。
- 複数Camera、cut切替、被写界深度、3D camera、physics追従は後続候補とする。

## Phase 5z8で先に整えてよい内部境界

- `CameraSystem.resizeCanvas()`からProject frame mutationとView Camera再中心化を分離する。
- frame / contentのAffine計算、preview座標変換、number wheel正規化をpure helperまたは既存共通bindingへ寄せる。
- Resize Historyをframe / bounds / anchor metadataとpixel変換Historyに分ける。

ただし将来UIを見越したDOM全面置換、Camera Lane model、export camera samplingはPhase 5z8へ先行実装しない。

## 検証入口

- 横長、縦長、正方形、frame外Rasterでpreview direct manipulationを比較する。
- mouse / pen / touchで中央dragとedge dragの誤判定を計測する。
- View Camera、Resize、Animation CameraのUndo / save / export境界が交差しないことを固定入力にする。
- Camera Track導入時はTable preview、閉Table再生、GIF / APNG / WebMのframe hash / bboxを比較する。
