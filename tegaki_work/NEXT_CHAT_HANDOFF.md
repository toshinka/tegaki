# Tegaki 次チャット引き継ぎ

更新日: 2026-08-31

状態: Phase 9nまでclose。現行Phase 9oはGate 1=`GO — D: Tegaki hybrid`。Stage B1 BASIC shell + read-only overlayは技術proof完了、Owner production visual acceptance待ち。

## 1. 最初に読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `task-codex/phase9o.md`
6. `開発用資料保管庫/proposals/Tegaki_Transform_Warp_Animation_Rig_FocusLens_Proposal_for_CODEX_2026-08-31.md`
7. `開発用資料保管庫/Archive/phase9n.md`
8. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
9. `tegaki_work/system/layer-transform.js`
10. `tegaki_work/system/transform-math.js`
11. `tegaki_work/system/transform-overlay-geometry.js`
12. `tegaki_work/ui/layer-transform-basic-overlay.js`
13. `tegaki_work/styles/components/layer-transform-basic.css`
14. `tegaki_work/system/layer-system.js`
15. `tegaki_work/ui/transform-anchor-site.js`
16. `tegaki_work/ui/dom-builder.js`
17. `tegaki_work/build/verify-phase9o-basic-transform-production.mjs`

## 2. 作業開始時の確認

```powershell
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
```

既存差分を維持する。`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。

## 3. 現在地

- Phase 9nはright RIGをoverview / next action / handoff、既存single floating windowをmode別`RIG WORKSPACE / CLIP MOTION / WARP WORKSPACE`とするhost ownershipをD3で固定してcloseした。
- 全129 verifier、build、right RIGからのopen、RIG / Motion / Warp往復、close / reopen、Table closed再入場、History不変、480×800横overflow 0、console warning / error 0件を通過した。
- current RIG WORKSPACEの横長layout、数値欄、button density、`RIG / MOTION / WARP`上位tab、floating / vertical inspector選択は最終UX受入ではない。Table closeとのlifecycle分離、TEST POSEもHOLD。
- Owner方針により、次はRIGをさらに磨く前に既存`V` Layer Transformを「絵の共通変形語彙」へできるか比較する。
- skill ladderは`DRAW → TRANSFORM → ANIMATE → RIG → RIG MESH / WEIGHT`。RIGは最初の入口ではなく、反復する直接操作を構造化する上位段階とする。
- Stage 0では既存Vのnormal Raster / Folder / CAF working Layer / selection、Pixi preview、Raster bake、path / clipping、通常 / CAF History、save前commit、Clip Motion bridgeをinventoryした。
- 現行VはCanvas drag=Move、Shift+横drag=Rotate、Shift+縦drag=Uniform Scale、Canvas Anchor site、floating X / Y / Rotation / Scale sliderを持つ。bounding box / 8方向handle / Distort / Drawing Warp Gridはまだ無い。
- 明示的SVG object Layer authorityは確認できない。SVG対応を前提にせず、import後Raster / path metadataの実態をfixtureで明示する。
- Stage A1比較fixture `tegaki_work/build/phase9o-layer-transform-interaction-grammar-fixture.html`と固定verifierを追加した。A Current / B CSP-like / C Procreate-like / D Tegaki hybridを同じ絵・課題・Canvas面積で比較できる。
- Browserではdefault 1280×720で4案同列、480×800で一列stack、横overflow 0、C DISTORT / D WARP / D詳細の表示同期、console 0件を確認した。全130 verifier、buildを通過し、生成物差分は残していない。
- Ownerが第一候補Dを選定し、Gate 1=`GO — D: Tegaki hybrid`。A / B / CはDへの不満時に同じ比較条件へ戻れる再試行案としてfixtureとPhase書へ保持した。
- Stage B1はproduction panelを`BASIC / DISTORT / WARP`とpreciseの`詳細`に整理し、BASICだけをactive、DISTORT / WARPはdisabledとした。Raster alphaのruntime-only tight bounds、既存matrix、coordinate systemからpointer非参加の4 corner + rotate overlayを接続し、既存Anchor siteを維持した。
- Browser 1280×720でMove preview、`詳細`、Escape cancel、V confirm、Undo / Redo後のbounds復元とHistory 1→2、480×800初期起動でbox / 4 corner / rotate / Anchor / 210px panel、横overflow 0、console 0件を確認した。途中viewport resizeでCanvasごと位置を維持するのは既存camera挙動で、overlay独自のずれではない。

## 4. 次のtask

Phase 9o Stage B1のOwner production visual acceptance。

1. `V`でBASICへ入った時、絵がpanelより主役に見え、content-tight box / 4 corner / rotate / Anchorの役割と優先度が過剰でないかを見る。
2. preciseの`詳細`は初期closed、DISTORT / WARPは後続としてdisabled。初心者と熟練者の注意をBASICに集められるかを見る。
3. A / B / Cは再試行候補として保持。Dの実画面に不満があれば同一fixtureの比較条件へ戻る。
4. Owner acceptance後の次Sliceはinteractive Uniform Scale handleだけ。Rotate / Anchor gesture、DISTORT / WARP、Drawing Warp、Timeline key、RIG再配置を並走しない。

## 5. model分担

- interaction grammar、Focus Lens、比較軸、Gate判定はSOL / MAX。
- pure geometry / fixtureの契約が確定した一つの限定SliceだけLUNA / MAX候補。
- History、CAF adapter、save、schema、Warp topology、RIG境界判断をLUNAへ委譲しない。

## 6. 新チャットへ貼る文面

```text
D:\GitHub\tegaki の作業を継続してください。

Phase 9nまでclose済みです。現行Phase 9oはGate 1=`GO — D: Tegaki hybrid`です。Stage B1 BASIC shell + read-only overlayは技術proof完了、Owner production visual acceptance待ちです。

最初にAGENTS.md、TEGAKI.md、tegaki_work/PROGRESS.md、tegaki_work/NEXT_CHAT_HANDOFF.md、task-codex/phase9o.md、開発用資料保管庫/proposals/Tegaki_Transform_Warp_Animation_Rig_FocusLens_Proposal_for_CODEX_2026-08-31.md、Archive/phase9n.md、tegaki_work/TRANSFORM_SESSION_BOUNDARY.md、system/layer-transform.js、system/transform-math.js、system/transform-overlay-geometry.js、ui/layer-transform-basic-overlay.js、styles/components/layer-transform-basic.css、system/layer-system.js、ui/transform-anchor-site.js、ui/dom-builder.js、build/verify-phase9o-basic-transform-production.mjsを順に読んでください。

git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
を最初に確認し、既存変更をすべて維持してください。Backup/、PastFiles/、開発用資料保管庫/Backup-tegaki_work/は調査・編集しないでください。

中心仮説はDRAW → TRANSFORM → ANIMATE → RIG → RIG MESH / WEIGHTです。OwnerがD Tegaki hybridを選び、productionにBASIC shell、preciseの詳細開示、runtime-only tight boundsのread-only 4 corner + rotate overlayを接続しました。DISTORT / WARPはdisabledで、既存Move / Shift Rotate / Scale、Anchor、confirm / cancel / Reset、History / save境界は維持しています。次はOwner production visual acceptanceです。A / B / Cは不満時の再試行fixtureとして保持し、Drawing Warp、Timeline key、Anchor animation、RIG再配置を並走しないでください。

次作業予告はPhase 9o Stage B1 Owner production visual acceptanceです。承認後はinteactive Uniform Scale handleの一Slice、作業担当はSOL / MAXです。
```
