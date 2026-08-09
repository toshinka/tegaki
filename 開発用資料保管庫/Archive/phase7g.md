# Phase 7g — WARP RADIAL topology generator

更新日: 2026-08-10
担当: Sol High / XHigh（Gate 0・review）、LUNA / MAX（GO後の限定runtime Stage候補）
状態: CLOSED（Stage A / B、SOL review 1 / 2=`A`、Owner実機受入完了）

## 1. Goal

WARP作成時に既存RECT Control Meshと並ぶ`RADIAL` topology候補を追加する。最初は円／楕円の外周ring、同心の中間ring、centerをdeterministic triangleへ接続するpure generatorだけを固定する。

RADIALはSELECTの円形marqueeや保存maskではなく、既存`control-mesh`が保存するBind point / triangle topologyである。triangle外のRasterを既存部分WARP合成で維持し、WARPをCanvas全体maskへ拡大しない。

## 2. 候補比較と選定

| 候補 | 判定理由 | 判定 |
|---|---|---|
| WARP RADIAL topology | 任意triangleのControl Mesh、CPU / Pixi adapter、部分領域合成を再利用でき、pure generatorから独立着手できる | **選定** |
| Auto Shape Mesh | 一枚絵変形の本命だがalpha輪郭、hole / island、LINE / FILL、STALE、Skin所有を先に比較する必要がある | Phase 7g後にSOL Gate 0 |
| Deformer SELECT Stage 2 | 現行矩形SELECTで最低限の複数点操作は成立済み | 後順位 |
| PIVOT key-drag接続 | 既存長押し／接続線dragと同じsetterへ到達済み | 独立小Phase候補 |
| Text / Graph / Camera / Folder group | 別正本または別UI境界が必要 | 継続候補 |

## 3. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase7f.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
9. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
10. `tegaki_work/system/animation/control-mesh-topology.js`
11. `tegaki_work/system/animation/control-mesh-deformer.js`
12. `tegaki_work/system/animation/control-mesh-rasterizer.js`
13. `tegaki_work/system/animation/warp-grid-rasterizer.js`
14. `tegaki_work/ui/animation-table-popup.js`

通常作業では`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`、proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`を読まない。

## 4. SOL Gate 0結果: `GO`

### 現行コード監査

- `control-mesh`は`columns / rows=null`のfree topologyと明示`triangles`を既に保存・normalize・sampleする。
- CPU / Pixiは`deformer.triangles`を同じtriangle adapterへ渡し、rect専用rasterizerを要求しない。
- overlayはfree topologyで`createControlMeshEdges()`を使い、POINT / SELECTはpoint配列を直接編集できる。
- RECT GRIDのFRAME / CORNER / EDGEはrow / column topology専用なので、RADIALへ暗黙適用しない。
- Auto Shapeに必要なalpha contour、hole / island、source STALE、SkinWeightはRADIAL generatorには不要である。

### 判定

- Stage Aは`control-mesh-topology.js`のpure generatorと専用verifierだけを変更する。
- center + ring-major pointsと明示triangleを返し、Delaunay結果やbrowser順へ依存しない。
- generator metadata、保存field、renderer、UI、History、既存deformerは変更しない。
- Stage A review `A`後にだけ、新規作成時のRADIAL入口とControl Mesh factoryをStage Bとして再監査する。

よってStage Aを`GO`とする。

## 5. Stage A — pure RADIAL topology

### 対象

- `tegaki_work/system/animation/control-mesh-topology.js`
- 新規`tegaki_work/build/verify-radial-control-mesh-topology.mjs`

### 契約

1. 入力は`segments`と`rings`。centerは`(0.5, 0.5)`、外周半径はnormalized `0.5`とする。
2. point順はcenter、内側から外側へのring-major、各ringはtopからclockwiseに固定する。
3. center fanと隣接ring間のquad二分割triangleを明示生成し、全triangleの向きと順序を決定的にする。
4. point数は`1 + segments * rings`、triangle数は`segments * (2 * rings - 1)`。既存Control Mesh上限256点を超える入力は拒否する。
5. 入力を変更せず、非整数、segments 8未満、rings 1未満、上限超過は`null`で拒否する。
6. RECT generator、Delaunay、保存schema、DOM、Canvasへ依存しない。

### fixture

- segments 8 / 16 / 32、rings 1 / 2 / 4、上限境界。
- center、各ring半径、outer circle、negative / duplicate / nonfiniteなし。
- point / triangle数、全point参照、重複triangleなし、非zero面積、同一入力の完全一致。
- `normalizeControlMeshDeformer()`、Pixi render dataが明示triangleを受理する。
- 既存RECT 2×2 / 4×8 / 8×8、free Delaunay出力が不変。

## 6. SOL review 1

- ring順、triangle winding、seam接続に例外がない。
- renderer側でRADIAL専用triangleを再生成していない。
- free Control MeshとRADIALを保存fieldで暗黙判別していない。
- 円外維持を新しいmask schemaで実現しようとしていない。
- Auto Shape、輪郭、hole / island、SkinWeightへ変更を広げていない。

### 判定: `A`

- `createRadialControlMeshPreset()`は同一入力で完全一致し、center fan、ring band、seamを含む全triangleが同じ向きになる。
- 最大256点、有限点、重複点、全point参照、triangle重複を専用verifierで固定した。
- 既存RECT / free Delaunay、Control Mesh normalize、Pixi triangle adapterの出力を変更していない。
- 保存field、renderer、Auto Shape、輪郭解析へ変更を広げていない。

## 7. Stage B — 新規作成入口

- RECT作成と並ぶ明示`RADIAL` buttonを追加し、初期presetを16 segments × 3 rings（49 points / 80 triangles）に固定した。
- 既存deformerがある場合はbuttonをdisabledにし、呼出側でも理由付きで拒否する。既存keyの暗黙破棄、RECT / RADIAL変換は行わない。
- 保存は既存`control-mesh`の`columns / rows=null`、`bindPoints / points / triangles / keyframes`だけを使い、新しい`topologyType`やRADIAL保存flagを追加していない。
- 作成は既存CAF / Folder target support、alpha実内容bounds、target setter、History、edit modeへ接続した。1回の作成を1 Historyとして記録する。
- 作成後はPOINTへ入り、POINT / SELECTを編集入口とする。free topologyではFRAME / CORNER / EDGEをdisabledにし、存在しない矩形Bind枠を推定しない。
- buttonは既存deformer Bind青semanticを使い、WARP Pose tool全体を青へ変更していない。

## 8. SOL review 2 / Browser確認

### 判定: `A`

- 新規factoryはpure generator出力を既存Control Mesh normalizeへ渡すだけで、保存・sample・CPU / Pixi描画にRADIAL分岐を追加していない。
- 横長RasterへRADIALを作成し、`GRID FREE · 49 points`、POINT初期選択、円／楕円外Raster維持を確認した。
- center付近のPOINT dragはHistory 6→7、矩形SELECTの選択点一括dragは7→8の各1件。Ctrl+Z / Ctrl+Yで7 / 8へ戻った。
- GRID toolへ切り替えた時、FRAME / CORNER / EDGEは表示されるがdisabledで、free topologyへ矩形handleを適用しない。
- Motion close / reopen後も`GRID FREE · 49 points · 1 keys`と変形を維持した。console errorは0件。
- 変更34 JS / mjsの`node --check`、全39 verifier、`npm.cmd run build`を通過し、`dist/` / `.vite/`生成差分を清掃した。

Owner軽量実機では、RADIAL作成、POINT / SELECT、Undo / Redo、Table close / reopenと見た目を確認する。Project save / reload、Folder target、random seek、playback / onion、Bake / GIF / APNG、BRUSH、pen / touchは継続監視とする。

## 9. 非対象

- 既存RECT / fixed 4×4のRADIAL遡及変換。
- 既存key破棄preview / confirm UI。
- Circle / ellipseの任意aspect編集、RADIAL frame handle。
- Auto contour、hole / island、guard ring、Auto Shape WARP / Mesh。
- Mesh SkinWeight、BONE、Attachment、physics、Text、Camera。

## 10. 停止条件

- 明示triangleを既存Control Mesh normalize / rendererが保持できない。
- 円外Raster維持に新しい保存maskが必要になる。
- topology kindを保存しないとProject reload後に正しくsample / renderできない。
- Stage Aだけで既存RECT / free topology出力が変わる。

該当時は実装を止め、SOL Gate 0へ戻す。Auto Shapeへ迂回しない。

## 11. 共通検証

```powershell
node --check tegaki_work/system/animation/control-mesh-topology.js
node --check tegaki_work/build/verify-radial-control-mesh-topology.mjs
Set-Location tegaki_work
npm.cmd run build
```

- 専用verifierと全`build/verify-*.mjs`。
- Stage B以降はBrowser実操作とconsole error。
- build後に`git status --short --untracked-files=all`。
- `dist/`と`node_modules/.vite/`の生成差分を残さない。

## 12. Close条件

- OwnerがRADIALの軽量実機確認を受入れる。
- 受入後だけ本書を`開発用資料保管庫/Archive/phase7g.md`へ移し、`PROGRESS.md`とproposal 00 / 01 / 09 / 15を同期する。
- 次PhaseはAuto Shape WARP / Meshの輪郭解析・所有境界をSOL Gate 0で比較する。受入前にAuto Shape、SkinWeight、既存key変換へ進まない。

## 13. Close判定（2026-08-10）

- OwnerがRADIAL作成、POINT / SELECT変形、Undo / Redo、Table close / reopenと表示を実機確認し、受入を明示した。
- Stage A / B、SOL review 1 / 2はいずれも`A`。既存free Control Mesh保存shape、明示triangle、新規作成限定、既存WARP拒否を受入れた。
- 変更34 JS / mjsの`node --check`、全39 verifier、build、Browser実操作、console error 0件を通過した。
- Project reload、Folder target、random seek、playback / onion、Bake / GIF / APNG、BRUSH、pen / touchは継続監視とするが、既存normalize / sample / CPU / Pixi adapterを共有するためPhase 7gを再openしない。
- 次PhaseはAuto Shape WARP / Meshの所有、輪郭解析、LINE / FILL、STALE境界をPhase 7hのSOL Gate 0で比較する。
