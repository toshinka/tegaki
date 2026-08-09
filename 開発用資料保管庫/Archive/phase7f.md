# Phase 7f — WARP Bind FRAME / CORNER / EDGE操作分離

更新日: 2026-08-10
担当: Sol High / XHigh（Gate 0・review）、LUNA / MAX（GO後の限定Stage候補）
状態: CLOSED（Stage A / B、SOL review 1 / 2=`A`、Owner実機受入完了）

## 1. Goal

WARPの全Frame共通Bind SetupとFrame-local Pose編集を操作上も明確に分離し、`GRID` tool内で次の三つを明示的に選べるようにする。

- `FRAME`: 現行の枠内move、四隅uniform scale、rotation handleを維持する。
- `CORNER`: 一つのcornerだけをdragし、反対cornerと他のcornerを固定したまま内部点をtopology比率で補間する。
- `EDGE`: 一つのedgeの両端を同じdeltaでdragし、反対edgeを固定してtrapezoid / parallelogramを作る。

`GRID`は全keyの基準範囲を再基準化するBind Setup操作なので、tool buttonとFRAME submodeは既存`--deformer-bind-line / --deformer-bind-point`の青系semanticを使う。WARP全体、LENS、POINT、SELECT、BRUSHまで青へ変えない。

## 2. 候補比較と選定

| 候補 | 今選ぶ理由 / 後順位理由 | 判定 |
|---|---|---|
| WARP FRAME / CORNER / EDGE | Phase 7eのProject-space rotationと既存rebase / Historyを直接再利用でき、Ownerの一点／二点操作とGRID青表示へ最短で応える | **選定** |
| Deformer SELECT Stage 2 | runtime選択shape拡張で安全だが、現行矩形SELECTで最低限の複数点操作は成立済み | 後順位 |
| PIVOT key-drag接続 | 既存長押し／接続線dragですでに到達可能 | 独立小Phase候補 |
| Auto Shape Mesh | 一枚絵animationの本命だがgenerator、LINE / FILL、STALE、Mesh UIのGateが必要 | WARP Frame後にSOL Gate 0 |
| RADIAL WARP | topology変更と既存key破棄確認が必要 | FRAME操作後 |
| Text / Graph / Camera / Folder group | 有用だが今回のOwner確認からの連続性が低い、または別正本のGateが必要 | 継続候補 |

## 3. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase7e.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
9. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
10. `tegaki_work/system/animation/warp-placement.js`
11. `tegaki_work/system/animation/warp-grid-deformer.js`
12. `tegaki_work/system/animation/control-mesh-deformer.js`
13. `tegaki_work/ui/animation-table-popup.js`
14. `tegaki_work/ui/warp-grid-overlay.js`
15. `tegaki_work/styles/main.css`
16. `tegaki_work/build/verify-warp-bind-frame-rotation.mjs`

通常作業では`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`、proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`を読まない。

## 4. SOL Gate 0結果: `GO`

### 現行コード監査

- fixed 4×4とrect Control Meshは`columns / rows`とrow-major `bindPoints`を持ち、四corner indexを既存overlayとgestureが共有している。
- GRID gestureは`startBindPoints`と`startDeformer`を保持し、確定時だけ既存Historyへ一件、cancel / lost capture / Escape時は開始deformerへ戻す。
- Bind変更後のstatic Poseと全keyは、`rebaseWarpGridBind()` / `rebaseControlMeshBind()`がProject px offsetを維持する。
- overlayには四corner handleとrotation handleがあり、EDGE用midpoint handleだけが未実装。
- free Control Meshは`columns / rows=null`で現行FRAME handle自体が出ないため、本Phaseでも対象外として明示拒否できる。
- `UI_CSSスタイルガイド.md`はBind / GRID RANGEだけ青系、Frame Pose / point編集は橙・maroonと既に定義している。

### 判定

- 新しい保存field、key、topology、renderer変更は不要。
- CORNER / EDGEの選択modeはAnimation Tableのruntime UI stateだけでよい。
- row / column比率によるweighted deltaをpure helper化し、既存rebase adapterへ渡せる。
- Shift / Ctrlへ新しい意味を割り当てず、button / touchで同じ操作へ到達できる。

よって限定Stage A / Bを`GO`とする。

## 5. Stage A — pure Bind Frame transform

### 対象候補

- 新規`tegaki_work/system/animation/warp-bind-frame-transform.js`
- 新規`tegaki_work/build/verify-warp-bind-frame-transform.mjs`

### 契約

1. 入力はnormalized `bindPoints`、`bindBounds`、`columns`、`rows`、mode、corner / edge index、Project drag deltaとし、DOM / Canvas / modelへ依存しない。既存`warp-placement.js`のProject変換、または同じ式を共有する薄いhelperを使い、出力は既存rebaseへ渡せるnormalized点列とする。
2. `CORNER`は選択cornerのdeltaを、row / columnのbilinear weightで全点へ配る。選択cornerだけweight 1、他三cornerは0。
3. `EDGE`は選択edgeの両cornerを同じdeltaで動かし、反対edgeを固定する。edgeから反対edgeへlinear weightで内部点へ配る。
4. 入力配列を変更せず、点数不一致、2未満dimension、free topology、非finite値、範囲外indexは理由付き結果または`null`で拒否する。
5. helperは保存、History、rebaseを行わない。

### 固定fixture

- fixed 4×4、rect Control Mesh 2×2 / 8×8、100×100 / 240×80 / 80×240 / negative origin。
- 0° / 45° / 90°回転済みBindへProject drag deltaを与え、corner / edge / opposite edge / interior weightを固定する。
- corner一往復、edge一往復、連続gesture、入力非変更。
- `rebaseWarpGridBind()` / `rebaseControlMeshBind()`後もstatic Pose / 全keyのProject offsetとplacementを維持する。

### Stage A実装結果（2026-08-10）

- `warp-bind-frame-transform.js`を追加し、normalized Bind点へProject drag deltaを`bindBounds`で正規化して配るpure helperを実装した。corner順はTL / TR / BR / BL、edge順はTOP / RIGHT / BOTTOM / LEFTで固定した。
- CORNERはbilinear weight、EDGEは選択edgeから反対edgeへのlinear weightだけを使い、現在の歪んだpoint座標をweight正本にしない。
- `verify-warp-bind-frame-transform.mjs`でfixed 4×4、rect Control Mesh 2×2 / 8×8、正方形／横長／縦長／負origin、0° / 45° / 90°回転済みBind、全corner / edge、往復／連続gesture、入力非変更、45°BindのPose / key rebase、free topology／不正入力拒否を固定した。

## 6. SOL review 1

- Project dragをnormalized-space rotationへ戻していない。
- topology比率と現在のpoint座標を混同していない。
- fixed / Control Meshで別solverを作っていない。
- free topologyや不正dimensionを暗黙fallbackしていない。
- schema、renderer、rasterizer、WARP anchor、Mesh Skinへ変更を広げていない。

判定`A`後だけStage Bへ進む。

### SOL review 1結果（2026-08-10）: `A`

- Project deltaを`width / height`で別々に正規化し、非正方形boundsでもProject px移動量を維持する。
- weightはrow-majorの`u / v`だけから決まり、回転・歪み後の現在座標へ依存しない。
- fixed / Control Meshは同じhelperと既存type別rebase adapterを共有し、保存schema、renderer、rasterizerを変更しない。
- code review上の修正はなく、Pose / key rebase fixtureだけを45°回転済みBindへ補強した。

## 7. Stage B — runtime mode / overlay / UI adapter

### 対象候補

- `tegaki_work/ui/animation-table-popup.js`
- `tegaki_work/ui/warp-grid-overlay.js`
- `tegaki_work/styles/main.css`
- 必要ならUI契約verifier。

### 契約

1. `GRID` active時だけ`FRAME / CORNER / EDGE` segmented controlを表示する。初期値とtool再入時は`FRAME`。
2. modeはruntimeだけに置き、Project / History / Clip / Deformerへ保存しない。
3. `FRAME`は現行move / uniform scale / rotationの挙動と保存結果を変更しない。
4. `CORNER`は四corner handle、`EDGE`は四edge midpoint handleだけをhit targetにする。枠内dragやrotation handleへ暗黙転用しない。
5. pointermoveはgesture開始時の`startBindPoints`へpure helperのdeltaを一度だけ適用し、既存rebase adapterへ渡す。
6. pointerupは1 History、pointercancel / lost capture / EscapeはBind / Pose / Historyを完全復元する。
7. `GRID`とBind submodeの通常・hover・active・focusは既存`--deformer-bind-line / --deformer-bind-point`を使い、raw colorを追加しない。disabledは共通paletteを維持する。
8. Shift / Ctrl shortcutは本Phaseで追加しない。mouse / pen / touchがbutton経由で同じmodeへ到達する。

### Stage B実装結果（2026-08-10）

- `GRID`時だけ`FRAME / CORNER / EDGE` segmented controlを表示し、modeを`AnimationTablePopup`のruntime stateだけに保持した。POINT等からGRIDへ再入するとFRAMEへ戻る。
- CORNERは既存四corner handle、EDGEは新しい四edge midpoint handleだけを表示・hit対象にし、選択mode以外のhandle、rotation、枠内moveを開始しない。
- pointermoveはgesture開始時のBindとProject pointerからdeltaを一度だけ評価してStage A helperへ渡し、既存rebase、History、cancel経路を維持した。
- GRID buttonとBind submodeへ既存deformer Bind青変数を適用し、LENS / POINT / SELECT / BRUSHの橙・maroon semanticは変更していない。
- Browser reviewでSVGの`hidden` propertyが属性表示へ反映されないことを検出し、`hidden`属性と明示CSSへ限定修正した。
- 隣接監査でShift + wheel回転だけが旧normalized式を残していたため、Phase 7eと同じ`applyWarpPlacementToPoints()`へ統一した。通常wheel scaleは現行挙動を維持し、CORNER / EDGE中はFRAME wheel操作を開始しない。

### SOL review 2結果（2026-08-10）: `A`

- runtime mode、handle表示、hit test、pure helperのhandle順が一致する。
- pointermoveは`startBindPoints` / `startDeformer`から非累積で評価し、pointerupだけが既存1 Historyを確定する。
- 新しい保存field、EventBus、renderer、topology、modifier shortcut、raw colorは追加していない。
- Browserで発見したSVG表示不整合の限定修正後、追加のcode review修正はない。

## 8. SOL review 2 / Browser受入

- 正方形、横長、縦長、回転済みGRIDでFRAME / CORNER / EDGEが表示どおり動く。
- CORNERで一cornerだけ、EDGEで一edgeの二cornerだけが直接移動し、内部点が滑らかに追従する。
- parallelogram / trapezoidを作成後もPOINT / SELECT / BRUSH、LENS、WARP anchorが同じBind / Poseを読む。
- fixed 4×4 / Control Mesh、CAF / Folder target、Motion、Rig、2-Bone IKを確認する。
- Undo / Redo、cancel、Table close / reopen、Project save / reload、random seek、playback / onion、Bake / GIF / APNG、console errorなし。可能ならpen / touch。

### SOL Browser確認（2026-08-10）

- 横長Rasterへauto-fitしたrect Control Mesh 8×8で、GRID / FRAME / CORNER / EDGEが既存Bind青semanticで表示されることを確認した。active GRID / FRAMEは`--deformer-bind-point`相当の`rgb(49, 92, 150)`。
- CORNERで右上だけを`+30, -22`へ移し、他三cornerを固定したまま内部列がbilinear追従した。Historyは6→7の一件、Undo / Redoで完全復元した。
- EDGEで右edge両端を同じ`+25, +12`へ移し、左edgeを固定したまま内部列がlinear追従した。Historyは7→8の一件、Undo / Redoで完全復元した。
- CORNER中はedge handle、EDGE中はcorner / rotation handleが`hidden`かつ`display:none`となり、表示とhit対象が一致した。
- POINTからGRIDへ戻すとFRAMEへ復帰し、Motion close / reopen後もBind形状とFRAME modeを維持した。console error 0件。
- fixed 4×4、Folder target、Project save / reload、random seek、playback / onion、Bake / GIF / APNG、Shift + wheel実modifier、pen / touchはOwner確認と継続監視へ残す。

## 9. 非対象

- Shift / Ctrlの新shortcut割当。
- free Control Meshのframe推定。
- 任意四角形のperspective / homography補正。
- RADIAL / Circle / ellipse topology。
- topology変更、既存key破棄、Auto Shape WARP / Auto Shape Mesh。
- Mesh vertex editor、SkinWeight、Attachment、physics、Text、Camera Track。

## 10. 停止条件

- row / column weightだけでは既存Bindの連続変形を説明できず、保存済みrest coordinatesが必要になる。
- corner / edge変形後にtriangle反転を防ぐため、solverやconstraint正本が必要になる。
- rebaseで既存Pose keyを維持できない。
- fixed 4×4とControl Meshで別の保存shapeが必要になる。
- CPU / Pixi / exportが別geometryを要求する。

該当時は実装を止め、SOL Gate 0へ戻す。RADIAL、Auto Shape、Mesh editorへ迂回しない。

## 11. 共通検証

```powershell
node --check tegaki_work/system/animation/warp-bind-frame-transform.js
node --check tegaki_work/ui/animation-table-popup.js
node --check tegaki_work/ui/warp-grid-overlay.js
node --check tegaki_work/build/verify-warp-bind-frame-transform.mjs
Set-Location tegaki_work
npm.cmd run build
```

- Stage verifierと全`build/verify-*.mjs`。
- Browserで関連実操作とconsole error。
- build後に`git status --short --untracked-files=all`。
- `tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。

## 12. 実装報告形式

- pure helper、runtime mode、overlay、UI semantic、verifier。
- FRAME既存互換、CORNER / EDGE weightの根拠。
- fixed / Control Mesh、CAF / Folder WARP共有根拠。
- History / cancel / Undo / Redo、preview / export一致。
- node check、全verifier、build、Browser、console結果。
- 残作業と次に適するモデル。

## 13. Close判定（2026-08-10）

- OwnerがGRID回転、青semantic、FRAME / CORNER / EDGEの軽量実機確認を完了し、受入を明示した。
- Stage A / B、SOL review 1 / 2はいずれも`A`。pure Project delta、runtime mode、handle排他表示、既存rebase / Historyを受入れた。
- node check、全38 verifier、build、横長8×8 Control MeshのCORNER / EDGE、Undo / Redo、Motion再開、console error 0件を通過した。
- `dist/` / `.vite/`生成差分は清掃し、stale `index.lock`は稼働Git process不在を確認して削除した。
- fixed 4×4、Folder target、Project reload、random seek、playback / onion、Bake / GIF / APNG、Shift + wheel実modifier、pen / touchは継続監視とするが、共通pure helper、既存sample / rebase / renderer経路の固定検証を満たすためPhase 7fを再openしない。

次PhaseはWARP `RADIAL` topology generatorをPhase 7gとして開始する。Auto Shape Mesh、SkinWeight、輪郭解析、既存keyの破棄UIは混ぜない。
