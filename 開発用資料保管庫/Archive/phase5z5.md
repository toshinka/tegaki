# Phase 5z5: Clip Motion easing sampling基盤

更新日: 2026-07-14

## 目的

Phase 5w〜5z4で安定した `ClipInstance.transform / transformKeyframes` を正本のまま維持し、linear区間へeasing curveを追加する。最初にschema、旧Project互換、純粋sampling、全read / write経路を固定し、波形・グラフ編集UIはその後へ分離する。

Phase 6はmesh / morph用deformer正本を初めて導入する大区切りとして予約し、easingやMotion UI追加だけで繰り上げない。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/00_計画索引.md`
6. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
7. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
8. `tegaki_work/system/animation/clip-transform-sampler.js`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/system/animation/motion-key-clipboard.js`
11. `tegaki_work/ui/animation-table-popup.js`
12. `tegaki_work/system/animation/timeline-frame-compositor.js`

## Slice 0: easing read / write監査と契約固定

1. `transformKeyframes` を生成・再構築・clone・serializeする全経路を検索する。
   - Project save / load、Timeline History、CAF単体・複数copy / paste、Group、Motion clipboard。
   - anchor rebase、retiming、終端key追従、Motion key追加・削除・一括消去。
2. easingは左keyから右keyまでの区間に属する。`hold` はeasingを評価せず、`linear` だけがeasing ratioを使う。
3. 初期schema候補を次で固定する。
   - `easing` 欠損または不正値: linear完全互換。
   - `easing: { type: 'cubic-bezier', x1, y1, x2, y2 }`。
   - `x1 / x2 / y1 / y2` は最初は0..1へ正規化し、overshoot / bounceは別Sliceにする。
   - 同じeasing ratioを `x / y / scaleX / scaleY / rotation / opacity / blendStrength` へ適用する。
   - `blendMode` は従来どおり左key HOLDで、easing対象外。
4. 暗黙のClip始点 / 終点keyはlinear easingとし、旧Project・key無しCAFの表示を変えない。
5. cubic-bezierの時間軸はxから進捗tを逆算し、Newton法だけに依存せず二分探索fallbackを持つ決定的な純粋関数とする。

## Slice 1: 純粋easing sampling

- easing評価を小さい純粋helperへ分離し、`clip-transform-sampler.js` のlinear ratio一箇所へ接続する。
- `hold / linear / easing` の分岐をparameterごとに重複させない。
- 0、1、区間中央、非対称curve、欠損、不正値、同Frame後勝ち、Clip範囲外を固定入力で確認する。
- opacity / blendStrengthは最終sampleも0..1を維持する。scale / rotationの負値・360°超契約は変えない。
- compositor、Table preview、閉Table再生、Timeline / Lane onion、animation exportは既存 `sampleClipTransform()` 経由のままにし、新しい評価器を重複実装しない。

## Slice 2: 保存・clipboard・History互換

- easing metadataがProject round-trip、CAF copy / paste、Group、Motion clipboard、Undo / Redo、anchor rebase、retimingで欠落しないようにする。
- Motion clipboardはschema versionを上げ、旧version貼付けではeasingを変更しない互換を優先する。
- easingだけの変更も1 Timeline Historyとし、描画SnapshotやClipAsset正本へ混ぜない。
- 旧Projectの `interpolation: 'linear' | 'hold'` だけのkeyを同じ見た目で復元する。

## Slice 3: 最小UI

- sampling / round-trip安定後に、CLIP MOTIONから現在key区間のcurveを選べる最小入口を追加する。
- 最初は `LINEAR / EASE IN / EASE OUT / EASE IN-OUT / HOLD` のpresetを候補とする。既存LINEAR / HOLDの意味を変えない。
- curve buttonから別の小型編集windowを開く構造を候補とし、Motion panelを横長に戻さない。
- graph / waveform editorを実装する場合も、表示UIとcubic-bezier正本を分離し、drag中previewとpointerup 1 Historyを維持する。
- tooltipで「左keyから次keyまでの速度変化」であることを明示する。

## 対象外

- spring / bounce / overshoot、parameter別curve、色補間、Perform記録、軌跡編集。
- MotionをCAF列へBake、subframe Motion sample rate、Clip固有FPS。
- Ctrl複数選択CAFのDURATION一括変更、Group比例retiming。
- mesh、cage、lattice、morph、Bone、constraint、physics、WebGPU。
- Layer Transformの破壊的Raster変形へのeasing導入。

## 維持する契約

- stroke中working Layer、preview staging交換、preview container順、上側Lane前面、PSD record順を変更しない。
- Lane / Timeline onionはdisplay-only。保存画像、export、Layer visibility、ClipAsset / DrawingSnapshot正本へ状態を混ぜない。
- Folder clippingとClip blendの合成順を変更しない。
- keyframe無し旧CAFは静的transformと完全一致させる。

## 検証

- 変更JSを `node --check` する。
- cubic-bezier評価とtransform samplingを固定入力で確認する。
- Project JSON、Motion clipboard、CAF / Group copy、anchor rebase、retiming、Undo / Redoをround-trip確認する。
- Browserでpreset変更、途中Frame、再生、Timeline / Lane onion、copy / paste、旧Project復元、console errorなしを確認する。
- `npm.cmd run build` 後、`tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。

## 最初の完了条件

- easing schema、左key区間、欠損 / 不正値fallback、curve範囲を決める。
- 全read / write経路とmetadata欠落箇所を列挙する。
- UIを追加する前に純粋cubic-bezier評価と旧linear完全互換を固定入力で証明する。

## 現在状態

- Slice 0〜3の最小preset UIまで実装済み。左key所有、hold無視、欠損 / 不正値linear、control point 0..1、Newton法と二分探索fallbackを固定した。
- Project save / load、Timeline History、CAF / Group copy、retimingは汎用key cloneでeasingを保持する。数値編集、Canvas gesture、anchor rebaseの明示再構築経路にも保持を追加した。
- Motion clipboardはv5でeasingを保持し、v1〜v4貼付けでは貼付先のeasingを変更しない。
- CLIP MOTIONの既存補間selectへ `LINEAR / EASE IN / EASE OUT / EASE IN-OUT / HOLD` を追加した。未知curveは `CUSTOM` と表示してmetadataを保持する。
- 固定入力でProject JSON、History相当の復元、CAF / Group clone、retiming終端key、preset / customを確認した。Browserでは中間Frame sample、preset Undo、Motion clipboard v5貼付け、横幅内の収まり、console errorなしを確認済み。
- 再生開始時のTimeline選択解除契約は維持し、Motion windowだけが再生開始時のClip IDを表示専用に追跡する。BrowserでF6 X=50.6449からF11 X=118.0511への数値追従とconsole errorなしを確認した。
- 最小preset、sampling、保存・clipboard・History互換の実装残件は解消。graph / waveform editor、overshoot / bounceは対象外の後続Phaseとする。
