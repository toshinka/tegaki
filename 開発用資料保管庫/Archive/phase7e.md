# Phase 7e — WARP GRID Bind回転のProject座標補正

更新日: 2026-08-10
担当: Sol High / XHigh（Gate 0・review）、LUNA / MAX（GO後の限定Stage A候補）
状態: CLOSED（SOL review 1=`A`、Owner実機受入完了）

## 1. Goal

WARP `GRID` toolでBind枠を回転した時、非正方形の`bindBounds`でもProject座標上の辺長、角度、中心を維持し、正方形／長方形がshearしたように歪まないようにする。

本Phaseは報告済みの回転座標bugだけを修正する。Corner一頂点、EDGE二頂点、SHEAR、RECT / RADIAL切替、Auto Shape Mesh、PIVOT接続shortcutはproposalへ維持し、本Phaseへ混ぜない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase7d.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
9. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
10. `tegaki_work/system/animation/warp-placement.js`
11. `tegaki_work/system/animation/warp-grid-deformer.js`
12. `tegaki_work/system/animation/control-mesh-deformer.js`
13. `tegaki_work/ui/animation-table-popup.js`
14. `tegaki_work/ui/warp-grid-overlay.js`
15. `tegaki_work/build/verify-warp-placement.mjs`
16. `tegaki_work/build/verify-warp-bind-frame-rotation.mjs`
17. `tegaki_work/build/verify-warp-placement-preview.mjs`

通常作業では`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`、proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`を読まない。

## 3. SOL Gate 0結果: `GO`

### 現行経路

- LENS placementは`toWarpProject()`と`applyWarpPlacementToPoints()`を使い、Bind重心をpivotにProject座標でuniform scale / rotationしてから正規化座標へ戻す。
- GRID Bindのmove / uniform scale / rotationは`animation-table-popup.js`のgesture内で`startBindPoints`を直接更新し、`_rebaseWarpGridBindForGesture()`へ渡す。
- GRID Bind rotationだけは正規化座標のX/Yを同じ角度で直接回転している。`bindBounds.width !== bindBounds.height`では正規化→Project変換が非等方scaleになるため、Project座標ではshape-preserving rotationにならない。
- fixed 4×4と可変Control Meshは同じUI分岐とrebase adapterを通るため、一箇所の座標補正で共有できる。
- 数値監査では200×80 boundsを45°回転した時、現行normalized-space式はProject辺長200 / 80を約152.315 / 152.315へ変えた。既存`applyWarpPlacementToPoints()`は200 / 80を浮動小数epsilon内で維持した。

### 判定

- 新しい保存field、topology、placement modeは不要。
- 既存`warp-placement.js`のProject座標変換代数を再利用できる。
- pose keyを新規生成せず、既存`rebaseWarpGridBind()` / `rebaseControlMeshBind()`でBind変更前後の見た目を維持できる。
- CPU / Pixi / Bake / exportは保存済みBind / Poseを読む既存経路のままであり、renderer変更は不要。

よって限定Stage Aを`GO`とする。

## 4. Stage A — shape-preserving Bind rotation

### 対象

- `tegaki_work/system/animation/warp-placement.js`
- `tegaki_work/ui/animation-table-popup.js`
- `tegaki_work/build/verify-warp-placement.mjs`
- 必要なら専用`verify-warp-bind-frame-rotation.mjs`

### 実装契約

1. Bind pointを`bindBounds`でProject座標へ変換する。
2. Bind point群のProject座標重心をpivotとする。
3. gesture開始時の点を、開始角からのdelta angleで一度だけ回転する。pointermoveごとの累積回転はしない。
4. 回転後を同じ`bindBounds`で正規化座標へ戻す。
5. fixed 4×4 / Control Mesh、CAF root / Folder WARPで同じpure helperを使う。
6. 既存rebase、1 gesture = 1 History、pointercancel rollback、Undo / Redoを維持する。

既存`applyWarpPlacementToPoints()`をそのまま使うか、同じfileに用途名を明確にした薄いpure wrapperを置く。UI内へProject変換式を複製しない。

### 固定fixture

- bounds: 100×100、200×80、80×200、negative origin。
- angle: 0°、30°、45°、90°、-135°、連続drag。
- Project座標で全pointのpivot距離、四辺長、対角長、隣接辺内積が回転前後で一致する。
- rotation → inverse rotationで元pointへepsilon内で戻る。
- pose keyあり / なし、fixed 4×4 / 8×8 Control Mesh、CAF / Folder target。
- pointercancelはBind / Pose / Historyを変更しない。確定は1 History、Undo / Redoで完全復元する。

### Stage A実装結果（2026-08-09）

- `animation-table-popup.js`のGRID rotation / rotation-handleだけを、既存`applyWarpPlacementToPoints()`へ接続した。開始Bind点を`bindBounds`でProject座標へ移し、重心周りのdelta angleを適用してから正規化座標へ戻す。move / scale / LENS / POINT / BRUSHの経路は変更していない。
- 専用`verify-warp-bind-frame-rotation.mjs`を追加し、100×100、200×80、80×200、negative origin、0 / 30 / 45 / 90 / -135°、GRID 4×4 / Control Mesh 8×8、全点距離・内積、連続gesture、往復回転、逆変換、static Pose / key rebaseを固定した。旧normalized-space式が200×80・45°で辺長を約152.315へ変えることも回帰監査する。
- `node --check`、全37 verifier、`npm.cmd run build`は通過した。build生成差分は追跡基準へ戻し、`dist/` / `.vite/`へ残していない。
- Browserでは2 Frame CAFへ横長4×4 WARPを作成し、約45°／90°の連続rotation handle操作、Undo / Redo、Table close / reopen、console error 0件まで確認した。

Stage A完了時点ではコード・固定検証・SOL review 1=`A`まで完了し、Ownerの非正方形GRID実機受入をclose条件として維持した。

## 5. SOL review 1

- normalized座標でrotationを続けていない。
- LENS placementと別のProject変換代数を作っていない。
- bindBounds自体や保存schemaを変更していない。
- `rebaseWarpGridBind()` / `rebaseControlMeshBind()`のPose維持を壊していない。
- renderer、rasterizer、WARP anchor、Mesh Skinへ変更を広げていない。

判定`A`後だけBrowser受入へ進む。

### SOL review 1結果（2026-08-10）: `A`

- GRID rotationは`startBindPoints`を入力に毎回delta angleを適用し、pointermove累積式ではない。
- LENSと同じ`applyWarpPlacementToPoints()`を再利用し、UIへProject変換代数を複製していない。
- fixed 4×4 / Control Meshは既存の共通gesture分岐と型別rebase adapterだけを共有し、保存schema、renderer、rasterizerを変更していない。
- cancelは`startDeformer`を戻し、確定時だけ既存`_finishMotionGestureHistory()`へ一件記録する経路を維持している。

コードreview上の追加修正はない。専用verifierの契約不足だけを補強し、全37 verifierを再通過した。

## 6. Browser受入

- 正方形と縦長／横長GRIDをrotation handleで回し、形状とcell比率を維持する。
- 30°、45°、90°、往復回転、複数回gestureでshearが蓄積しない。
- GRID move / scale、LENS move / scale / rotation、POINT / SELECT / BRUSHを壊さない。
- CAF / Folder target、Motion、Rig、WARP anchor、playback / onion、random seek、Bake、GIF / APNGで一致する。
- Undo / Redo、Table close / reopen、Project save / reload、console errorなし。可能ならpen / touch。

### SOL Browser確認（2026-08-10）

- 横長Rasterへauto-fitした固定4×4 WARPをGRID toolで約45°、続けて約90°へ回転し、長短比と平行辺を維持してshearが蓄積しないことを確認した。
- 1 gestureごとにHistoryが5→6→7と一件ずつ増え、Ctrl+Z / Ctrl+Yで水平／回転状態を完全復元した。
- Table close / reopen後にCLIP MOTIONを開き直しても、縦向きのGRID BindとWARP targetを復元した。
- console error 0件。Folder target、可変Control Mesh実UI、Project save / reload、playback / onion、Bake / GIF / APNG、pen / touchは継続監視へ残す。

## 7. 非対象

- 一角だけを動かすfree quad。
- 二角 / EDGE連動、trapezoid、parallelogram、SHEAR mode。
- Shift / Ctrlの新shortcut割当。
- RECT / RADIAL、Circle / ellipse topology。
- Auto Contour、Auto Shape Mesh、SkinWeight、manual vertex editor。
- PIVOT親子接続UI、Attachment、physics、Text、Camera Track。

## 8. 停止条件

- Project座標回転だけでは再現が解消せず、overlay / coordinate-system / Camera matrix変更が同時に必要になる。
- rebase後に既存Pose keyを保てず、Topologyやkey migrationが必要になる。
- fixed 4×4とControl Meshで別実装が必要になる。
- CPU / Pixi / exportのどれかが別geometryを要求する。

該当時は実装を止め、SOL Gate 0へ戻す。Corner / Circle / Auto Shapeへ迂回しない。

## 9. 共通検証

```powershell
node --check tegaki_work/system/animation/warp-placement.js
node --check tegaki_work/ui/animation-table-popup.js
node --check tegaki_work/build/verify-warp-placement.mjs
Set-Location tegaki_work
npm.cmd run build
```

- Stage verifierと全`build/verify-*.mjs`。
- Browserで関連実操作とconsole error。
- build後に`git status --short --untracked-files=all`。
- `tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。

## 10. 実装報告形式

- 変更したpure helper、UI adapter、verifier。
- normalized-space bugとProject-space補正の根拠。
- fixed / Control Mesh、root / Folder WARPの共有根拠。
- History / cancel / Undo / Redo、preview / export一致。
- node check、全verifier、build、Browser、console結果。
- 残作業と次に適するモデル。

## 11. Close判定（2026-08-10）

- Ownerが非正方形GRIDの回転で形状が崩れないことを実機確認し、受入を明示した。
- SOL review 1=`A`。コードreview上の追加修正はなく、専用verifierだけを契約どおり8×8 Control Mesh、全点距離・内積、連続gesture、Pose / key rebaseまで補強した。
- 正しいpathでのnode check、全37 verifier、build、横長4×4 WARPの約45°／90°Browser回転、Undo / Redo、Table close / reopen、console error 0件を通過した。
- `dist/` / `.vite/`生成差分は清掃し、終了済みGit processが残した`index.lock`も存在確認後に削除した。
- Folder / Control Mesh深い実UI、Project reload、playback / onion、Bake / GIF / APNG、pen / touchは継続監視とするが、Project-space変換と共通sample / rebase経路の固定検証を満たすためPhase 7eを再openしない。

次PhaseはWARP Bind Setupの`FRAME / CORNER / EDGE`操作分離をPhase 7fとして開始し、GRID toolのSetup青semanticを同じ境界で扱う。RADIAL、Auto Shape Mesh、modifier shortcutは混ぜない。
