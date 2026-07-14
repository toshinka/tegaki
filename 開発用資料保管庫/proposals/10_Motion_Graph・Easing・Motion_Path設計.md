# Motion Graph・Easing・Motion Path設計

更新日: 2026-07-14

## 結論

Phase 5z6の `EASING CURVE` は完成扱いとし、置換しない。これはToonSquid型の「左keyが次keyまでの区間速度を所有するSegment Easing Editor」である。

ユーザー案のLive2D型graphは別責務とする。こちらはClip全体を横断して、Frameに対するparameter実値を表示・編集する `MOTION GRAPH` / `VALUE GRAPH` である。両者は同じ `ClipInstance.transform / transformKeyframes` を見るが、別の保存正本を作らない。

- `EASING CURVE`: 1区間の時間進捗から補間率への写像を編集する。
- `MOTION GRAPH`: Clip全体のFrameから実parameter値への変化を表示・編集する。
- `MOTION PATH`: Canvas上のXY空間経路を表示・編集する。時間graphとは別物とする。

公式資料でも、ToonSquidのeasingは各keyから次keyへの補間挙動、Live2D CubismのGraph Editorはparameter変化を可視化する編集面として分かれている。

- ToonSquid: <https://toonsquid.com/handbook/keyframes/easing_curves/>
- Live2D Cubism: <https://docs.live2d.com/en/cubism-editor-manual/grapheditor/>

## 現行正本との境界

現行TegakiのMotion keyは、property別trackではなく次をまとめて持つ複合keyである。

- 連続値: `x / y / scaleX / scaleY / rotation / opacity / blendStrength`
- 区間metadata: 左key所有の `interpolation / easing`
- 離散値: `blendMode`
- Clip単位: `anchorX / anchorY`

したがって初期Motion Graphは `LINKED EASE` と明示し、各parameterが独立したeasingを持つように見せない。`graphPoints`、dense sample列、UI固有curve配列をProjectへ保存しない。Canvas操作、CLIP MOTION数値欄、Timeline上の丸marker、Motion Graphは、すべて既存keyを読むadapterとする。再生・onion・exportは引き続き `sampleClipTransform()` だけを使う。

## 編集面の共存

1. Canvas直接操作
   - drag / wheel / Shift操作で選択Frameの複合keyを編集する。
2. 数値・marker操作
   - CLIP MOTIONの値とTimeline上の丸markerで正確なFrame/valueを扱う。
3. Segment Easing Editor
   - 選択した左keyの右区間だけを0..1 graphで編集する。
4. Motion Graph
   - Clip全体のparameter実値とFrame cursorを表示し、後続で既存keyの値を編集する。
5. Motion Path
   - Canvas上のXY軌跡を扱う。時間easing handleやGraphの接線を流用しない。

## parameter表示

単位の異なるparameterを一つのY軸へ無理に重ねず、group切替を基本とする。

| Group | 表示 | 保存単位 | 補間 |
|---|---|---|---|
| POSITION | X / Y | px | 連続 |
| SCALE | X / Y | 倍率 | 連続、負値は反転 |
| ROTATION | Rotation | radian、UIはdegree | 連続、360度超をunwrap表示 |
| OPACITY | Opacity | 0..1、UIは% | 連続、最終値clamp |
| BLEND | Strength + Mode row | 0..1 + enum | Strength連続、Modeは左key HOLD |

初期版はactive curveを橙、同groupの他curveをmaroonと線種差で示す。3本以上を同時表示する段階では、色だけに依存せずlabel、線種、中央管理のsemantic graph colorを併用する。

## 段階計画

### P0: Phase 5z6 closeoutと用語固定 — 完了

- 5z6を `Segment Easing Editor` と定義する。
- graphの0..1はparameter実値ではなく `Time / Progress` とする。
- terminal keyは右区間がないためread-only理由を表示する。
- HOLDはcurveを評価しない。

### P1: Motion Graph Viewer — 優先度A / 難度 中

- 既存keyとsamplerからClip全体の実値curveをread-only表示する。
- UIはProject Frame 1-based、内部はClip-local 0-basedを維持する。
- group切替、Frame cursor、zoom / pan、auto fitを先行する。
- 再生中はread-onlyでcursorとsample値だけ追従する。
- 表示用dense sampleはruntimeだけに置き、保存しない。
- 選択segmentのEasing Editorを開く導線を置く。
- compositor、export、onionの評価経路は変更しない。

### P2: ToonSquid型preset拡張 — 優先度A / 難度 中

- 固定cubicで表現できるSoft / Strong Ease、Sine相当、Circular相当から追加する。
- preset名を正本にせず、既存 `cubic-bezier` 4値へ確定する。
- selected keyまたは複数選択keyへの適用を1 Timeline Historyにする。
- Easing copy / pasteはMotion値clipboardと分け、値を上書きしないtagged payloadにする。
- Bounce / Elastic / Loopを単一cubicとして偽装しない。

### P3: 既存keyのGraph編集 — 優先度A / 難度 高

- 既存点の値drag、Frame選択、数値欄、Canvas直接操作を同じmutation入口へ寄せる。
- pointerdownでbefore、pointermoveでlive preview、pointerupでHistory 1件、cancel / Escapeで復元する。
- 初期の複数選択はpreset適用とdeleteに限定する。
- keyの時間移動は隣接keyを越えない。衝突merge、box scale、順序反転は別gateとする。
- selection、visible channel、zoom / panはruntime UI stateとし、Project / Historyへ入れない。

### P4: Graph上の途中点追加 — 優先度B / 難度 高

空白clickでkeyを単純追加してはいけない。現行は複合keyのため、対象外parameterの区間まで分断し、見た目を変える。

安全な点追加は同一History内で次を行う。

1. 挿入Frameで既存segmentをsampleし、全連続parameterと左側 `blendMode` をmaterializeする。
2. 挿入時間比 `r` をBezier parameter `t` とみなさず、現行samplerと同じNewton法 + 二分探索で `x(t) = r` を解く。solverを別実装せず既存pure helperから共用可能な形へ切り出す。
3. 得た `t` で元cubicをDe Casteljau分割し、左curveは終点 `(r, y(t))`、右curveは始点 `(r, y(t))` を基準に、それぞれlocal time / local valueの0..1座標へ再正規化する。0幅または0 value spanで正規化不能なら無言近似せず追加を中止する。
4. 既存左keyと新keyへ左右のeasingを設定する。
5. active parameterだけ、ユーザーが指定した値へ変更する。
6. 他parameterが挿入前後で同じsampleになることを、挿入Frameだけでなく左右区間の複数固定比で証明する。
7. 暗黙始点 / 終点では境界keyも同じtransactionでmaterializeする。
8. HOLD区間は左右ともHOLDを継承する。

ペン主体では空白tap即追加より明示 `ADD POINT` modeを優先する。通常tapは選択、通常空白dragはpanまたはbox selectとする。

### P5: Overshoot / Back — 優先度B / 難度 中〜高

- `x1 / x2` は0..1を維持し、`y1 / y2` だけ範囲外を許可する。
- UIには `ALLOW OVERSHOOT` を明示する。
- position / scale / rotationはraw eased ratio、opacity / blendStrengthは最終値をclampする。
- 現行0..1 Projectは完全一致させる。

### P6: parameter別segment easing — 優先度C / 難度 非常に高

実制作で必要性を確認してからschema監査する。別track正本は作らず、既存keyへのoptional metadataを候補とする。

```js
channelSegments: {
  x: { interpolation, easing },
  opacity: { interpolation, easing }
}
```

- 既存flat値とglobal `interpolation / easing` をfallbackにする。
- `blendMode` は対象外。
- 旧Projectはglobal easingだけで従来通りにする。
- clipboard、retiming、History、全sampling経路を同時監査する。

### P7: Bounce / Elastic / Loop — 優先度C / 難度 高

- Bounce / Elasticはpiecewiseまたはspring評価、あるいはkeysへのBakeを先に決める。
- 複合keyのままparameter別振動を入れない。
- Loopは過去key反復であり、単一区間cubicとは別契約にする。

### P8: Motion Path — 別系列 / 難度 高

- Motion Graphは `time -> x/y`、Motion PathはCanvas上のXY空間経路、Easingは経路上を進む速度と分離する。
- 将来のspatial tangentは既存keyのx/yを正本とし、`spatialIn / spatialOut` 等のschema監査を別途行う。

## History・複数選択契約

- 1 drag = 1 Timeline History。
- 1 point追加 / 削除 = 1 History。
- N keyへのpreset / easing paste = 1原子的History。
- 1件でも不正Frame、terminal、read-onlyなら一括変更しない。
- viewport、channel表示、selectionはHistory対象外。
- Undo / Redo後は存在しない `clipId + localFrame` のruntime selectionを除去する。
- 複数keyのtime moveは同Frame衝突、順序反転、Clip端、retimingを決めるまで保留する。

## Phase 6との境界

Motion Graphは既存transform keyの編集UIなので5z系で扱える。Phase 6はmesh / morph用deformer正本を初めて導入する大区切りとして予約し、Motion Graphだけで繰り上げない。Live2D的なparameter graphを入れても、mesh、deformer、Bone、physics正本を同時導入しない。
