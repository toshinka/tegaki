# Phase 7m — Motion Graph Viewer

更新日: 2026-08-12
担当: SOL / XHigh（Gate・pure契約・review）、限定UI adapterはLUNA / MAXまたはSOL
状態: CLOSED（Gate 0=`GO`、Stage A / B完了、SOL review 2=`A`、2026-08-12 SOL技術close。Owner制作確認は別紙で追跡）

> 立案時点ではPhase 7i / 7j / 7k / 7lをOwner一括確認待ちとしていた。本Phaseは各Phaseの保存正本を変更せず、技術close後もOwner制作確認は別紙で追跡する。

## 1. 目的

既存`ClipInstance.transform / transformKeyframes`をClip全体で可視化するread-only `MOTION GRAPH`を追加する。Segment Easing Editorを置換せず、既存`sampleClipTransform()`の評価結果だけからruntime表示データを導出する。Graph専用key、dense sample列、channel track、zoom / pan / selectionをProjectへ保存しない。

## 2. Gate 0結果

- Motionの保存正本は既存`ClipInstance.transform / transformKeyframes`。一つの複合keyが全parameterと左区間の`interpolation / easing`を所有する。
- `sampleClipTransform()`はClip-local 0-based Frame、暗黙始点 / 終点、欠損parameter継承、HOLD / LINEAR / cubic-bezier、blendModeの左key HOLDを一元評価している。
- EASING CURVEは選択した左keyから次keyまでの`time → progress`編集面として成立済み。Motion GraphはClip全体の`Frame → parameter実値`表示面であり、同じSVG pathやcontrol handleを再利用しない。
- Animation Tableは選択Clip、current Frame、key marker、CLIP MOTION open / closeを既に持つ。Stage Bはread-only popupと既存selection / playback購読だけで接続できる見込み。
- duration上限240 Frameの現行契約なら、全Frameをruntime sampleしても保存容量やcompositor評価経路を増やさない。Graphのpixel座標や再sample cacheはUI寿命内だけに置ける。

判定は`GO`。最初にpure view modelと固定入力をSOLで確定し、DOM / SVG接続はStage Bへ分離する。

## 3. Stage A — read-only pure view model

1. 入力は`clip`、Timeline Frame、表示groupだけとし、既存`sampleClipTransform()`を各Clip-local Frameで呼ぶ。
2. `POSITION / SCALE / ROTATION / OPACITY / BLEND`を単位別groupとして返す。異なる単位を同じY軸へ重ねない。
3. Project表示Frameは1-based、内部FrameはClip-local 0-basedを併記する。
4. explicit key marker、暗黙boundary、左key所有segment metadata、Frame cursor、auto-fit range、BLEND mode runをruntime dataとして導出する。
5. rotationはradian正本をdegree表示へ変換するが、±180°や360°へ正規化せず、360°超のraw連続値を維持する。
6. clip / key / easingを変更せず、Graph固有配列をmodel、History、Projectへ書かない。

## 4. Stage B候補 — 限定UI adapter

- CLIP MOTIONのMotion側から`MOTION GRAPH`を開く。RIG / WARPやTable headerへ新しい大分類tabを増やさない。
- read-only SVGまたはCanvasでcurve、key marker、Frame cursor、group切替、auto fitを表示する。
- active channelは橙、同group channelはmaroon + 線種差、Setup青は使わない。
- 再生中はcursorとsample値だけ追従する。preview / playback / onion / Bake / exportの評価経路を変更しない。
- Easing Editorを開く場合は既存explicit left keyを選択するだけとし、Graphからkeyを追加・移動・削除しない。

## 5. 非対象

- Graph上のkey値drag、時間移動、box select、追加、削除。
- Motion Path、spatial tangent、Camera Track、WARP / Bone / Part parameter graph。
- parameter別easing、channel track schema、Bounce / Elastic / Loop、overshoot拡張。
- Graph sample / pixel point / range / selection / zoom / panの保存・History化。
- Segment Easing Editor、Timeline marker drag、Canvas Motion操作の置換。

## 6. 受入条件

- pure固定入力で既存samplerと全Frame一致し、HOLD / cubic / implicit boundary / 欠損値継承 / duplicate key / invalid keyを同じ規則で扱う。
- POSITION / SCALE / ROTATION / OPACITY / BLENDの単位、range、explicit marker、segment、cursor、mode runが決定的。
- 720°等のrotationを短い角度へwrapしない。
- 入力clipを変更せず、serialize shape、History、Project、preview / exportへ接続しない。
- Stage Bへ進む場合はBrowserでopen / close、Clip切替、random seek、playback cursor、Table close / reopen、narrow、console errorを確認する。
- 全verifier、変更JSの`node --check`、buildを通過し、生成差分を残さない。

## 7. 停止条件

- viewer成立に新しい保存track、Graph専用key、sampler分岐が必要になる。
- 既存複合keyをparameter別keyに見せないと表示できない。
- Easing Editorのmutation処理をGraphへ複製する必要がある。
- 240 Frameのruntime samplingが実測でUI操作を阻害し、別cache正本を要求する。

## 8. Stage A結果 / SOL review 1

- `motion-graph-view-model.js`を追加し、既存`sampleClipTransform()`からduration全Frameのread-only sampleを導出するpure adapterを固定した。
- POSITION / SCALE / ROTATION / OPACITY / BLENDのgroup、単位別channel、auto-fit range、explicit key、implicit boundary、左key所有segment、cursor、BLEND mode runをruntime dataとして返す。
- rotationはradianからdegreeへ表示変換するだけでwrapせず、固定入力で`0 / 180 / 360 / 540 / 720°`を維持した。
- duplicate Frameは既存samplerと同じく配列末尾を優先し、範囲外keyを無視する。HOLD / cubic-bezier / 欠損parameter / 暗黙始終点は既存samplerの結果と全Frame一致した。
- constant curve、negative scale、Clip外cursor、1-based Project Frame、invalid group fallback、入力clip非mutationを固定した。
- `verify-motion-graph-view-model.mjs`、変更JSの`node --check`、全52 verifier、`npm.cmd run build`を通過し、`dist/` / `node_modules/.vite/`生成差分を残していない。

SOL review 1は`A`。Stage Bはこのpure APIだけを読む限定UI adapterとし、Graph編集、Motion Path、保存stateへ広げない。

## 9. Stage B結果 / LUNA実装

- CLIP MOTIONのMOTION側に`MOTION GRAPH`入口を追加し、POSITION / SCALE / ROTATION / OPACITY / BLENDをruntime groupとして切り替えられるread-only popupを接続した。
- 既存`createMotionGraphViewModel()`だけを読み、auto-fit range、channel path、explicit key marker、implicit boundary、project Frame軸、current cursor、現在値、BLEND modeをSVGへ描画する。Graph側にpointer編集、key追加・削除、History、保存stateは持たせていない。
- Tableのcurrent Frame / playback render同期からcursorとsampleを再計算し、Motion closeでGraphも閉じる。Graph group選択はUI runtimeのみでProjectへ保存しない。
- `verify-motion-graph-ui-adapter.mjs`を追加し、入口・window・5 group・同期経路・read-only境界・palette styleを固定した。変更JSの`node --check`、全53 verifier、`npm.cmd run build`を通過し、`dist/` / `node_modules/.vite/`生成差分を残していない。
- Browser smokeではduration 2 Frame CAFを作り、MOTION → CAF → Graph open、5 group切替、F2 seek、Table / Graph close-reopen、再生中のF1 → F2 cursor追従を確認し、fresh serverのconsole error / warningは0件だった。初期のGraph SVG label生成例外は`Node.append()`戻り値を使わない形へ修正済み。
- 継続LUNA Sliceでは、再生中にGraphを閉じた後も現在のplayback Clipをfallbackとして再openできるようにし、Graph入口の説明を共有Futaba tooltipへ保持した。Graph UIの保存・History・model mutationは増やしていない。
- 狭幅表示ではGraph windowを左右8px以上に収め、縦方向はpopup内scrollへ切り替える。既存のTable / Timeline wheel領域、Graph read-only境界、保存stateは変更しない。

LUNA実装と固定検証、SOL review 2=`A`まで完了。次はOwner一括確認で、duration 2 Frame以上のCAFでのopen / close、group切替、key marker / cursor、random seek / playback、Table close / reopen、narrow表示、console errorを確認する。Graph編集、Motion Path、保存state、preview / export評価経路の拡張は次Phaseまで行わない。

## 10. SOL review 2

- pure view modelは既存`sampleClipTransform()`との全Frame一致、duplicate / invalid key、暗黙始終点、720°rotation、入力非mutationを維持しており、保存・History・preview / exportへの新規接続はない。
- UI adapterで無効targetへ変わった後も古いGraphが残る状態を修正し、Graphを自動closeしてbuttonのactive / `aria-expanded`も解除する。
- Timeline cursorがClip外にある場合はclamp先を現在Frameとして表示せず、cursor線を隠して要求Frameを`OUT`、値を`OUT OF CLIP`と表示する。
- 狭幅・低いviewportでは初期`top: 24%`を含めて縦方向が収まる`max-height`へ補正し、共通`ui-scrollbar`を適用した。Graph runtime stateとdrag正本は増やしていない。
- 全53 verifier、変更JS / mjsの`node --check`、`npm.cmd run build`を通過した。Browserではduration 2 Frame CAF、5 group、無効target時の自動close、Graphの表示領域、共有tooltip、console error / warning 0件を確認した。

判定は`A`。当時はOwner一括確認待ちでOPENを維持したが、2026-08-12のOwner指示でSOL技術確認によるcloseへ改訂した。

## Close判定

2026-08-12、SOLはpure sampler一致、read-only UI、無効target / Clip外cursor、保存・History非接続を再監査し、追加修正なしでclose可能と判定した。Owner制作Projectでの長尺CAF / random seek / playback視認は`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`で追跡する。
