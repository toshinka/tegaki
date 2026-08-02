# Tegaki Goal Ledger

更新日: 2026-08-02  
Goal正本: `task-codex/goal-next-checkpoint.md`

> [!NOTE]
> Gate 0後、OwnerのGoal指示により上限をPhase 6v〜6yの連続実装まで拡張した。
> 2026-08-02に全PhaseをSOL最終判定`A`でcloseした。以下のGate 0記録は判断履歴として残す。

## 最終checkpoint

- Phase 6v: optional static Mesh / SkinWeight、validation / remap / round-trip、pure inverse-bind LBSを完了。
- Phase 6w: 一つの非clipped RasterのPixi / CPU共通render proofを完了。
- Phase 6x: 一Raster / 複数Mesh BONEのRIG / MOTION authoringを完了。
- Phase 6y: Alpha-fit Grid、最大2 distance weight、STALE / explicit regenerateを完了。
- 全29 verifier、変更JS / mjs `node --check`、build、Browser軽量確認、console errorなし、生成物清掃を完了。
- 現行Phaseなし。次GoalのOwner指示待ち。

## 現在のcheckpoint

Phase 6s〜6uの既存責務系列はclose済み。再実装せず証拠化してスキップする。
次の新責務は、Owner追加要望を含む「一つのCAF内部Rasterへ複数BONE PIVOTを置き、
同一RasterのTriangle MeshをBone回転へ追従させる」系列である。

このGoalの実装上限に従い、製品schema / UIへ着手する前のGate 0、固定入力案、Phase分割まで完了した。
Gate判定は設計`GO`、製品実装は新しいoptional保存正本が必要なためGoal停止条件に従い`STOP`。

## 進捗台帳

| 項目 | 状態 | 根拠となるコード | 検証 | 残作業 | 判断 |
| --- | --- | --- | --- | --- | --- |
| Folder別WARP保存・sample・RenderIsland・Project | `VERIFIED_IMPLEMENTED` | `clip-deformer.js`、`folder-part-render-plan.js`、`timeline-frame-compositor.js` | `verify-folder-deformer-model`、`verify-folder-deformer-render-plan`、`verify-folder-deformer-project-roundtrip`、`verify-structured-bake-model` | nested target / clipping splitは別Gate | Phase 6s成果をスキップ |
| 固定長2-Bone IK Pose Bake | `VERIFIED_IMPLEMENTED` | `two-bone-ik.js`、`part-rig.js`、`animation-table-popup.js` | `verify-two-bone-ik`、`verify-two-bone-ik-authoring`、`verify-two-bone-ik-stage-c`、Owner実機 | runtime target / stretch / limitは別責務 | Phase 6t成果をスキップ |
| WARP GRID alpha bounds auto-fit | `VERIFIED_IMPLEMENTED` | `fitWarpGridBindBoundsToContent()`、`AnimationTablePopup`既存target adapter | `verify-warp-grid-auto-fit`、Stage A Browser smoke | 既存GRIDの暗黙refitは行わない | Phase 6u Stage Aをスキップ |
| WARP triangle point-map | `VERIFIED_IMPLEMENTED` | `warp-triangle-point-map.js`、`warp-grid-rasterizer.js`共有barycentric / epsilon | `verify-warp-point-map`、`verify-warp-placement-rasterizer` | 保存Constraintへの接続なし | Phase 6u Stage Bをスキップ |
| Folder WARP anchor → 子PIVOT追従 | `DEFERRED_BY_GATE` | sourceは`ClipInstance.folderDeformers`、Rigは`ClipAsset.rigDefinition` | Phase 6u Gate 1 `HOLD` | 所有、評価pass、cycle、remap / validation | Mesh Gateへ混ぜない |
| 可変Control Meshによる直接Pose変形 | `VERIFIED_IMPLEMENTED` | `control-mesh-topology.js`、`control-mesh-deformer.js`、`control-mesh-rasterizer.js` | placement / preview / CPU / Bake verifier | Bone Skinning正本ではない | topology / Raster adapterだけ再利用 |
| 一つのRasterに複数PIVOT / BONE | `NOT_IMPLEMENTED` | 現行`registerRootBoneRigidBinding()`は一つのFolder Partへ一つのrigid bindingを作る | 同一Raster・複数Bone fixtureなし | Raster target、Bone登録導線、static ownership | 次Gate 0の中心 |
| Triangle Mesh + SkinWeight + BONE Skinning | `NOT_IMPLEMENTED` | proposal 15のみ。`meshDefinitions` / `skinBindings`は実コードに存在しない | verifierなし | schema、validation、remap、CPU / Pixi共通評価 | 新しい保存正本が必要 |
| alpha内容からの自動Mesh生成 | `NOT_IMPLEMENTED` | alpha tight bounds cacheとrect / Delaunay topologyは別々に存在 | generator fixtureなし | contour / grid方式、密度、上限、再生成境界 | Mesh schema確定後の限定Stage |
| 線画 / 塗り別の高度な自動Mesh | `DEFERRED_BY_GATE` | proposal 15の将来案 | なし | 線中心・内外点、領域塗り、品質評価 | 初期MVPへ混ぜない |

## Gate 0判定

- Plan A: ClipAsset static Mesh / SkinWeightと既存ClipInstance Bone Poseを分離する。`GO`。
- Plan B: 既存Control Mesh / WARP PoseをBoneで書き換える。正本重複のため不採用。
- Phase 6v: static schema、validation / remap / round-trip、pure 2D LBS、固定入力だけ。
- Phase 6w: 一つの非clipped RasterへCPU / Pixi共通描画proof。
- Phase 6x: 一枚Raster上の複数PIVOT authoring。
- Phase 6y: alpha-fit deterministic Gridと初期distance weight。
- Goal判定: 新保存正本を開く前の安全地点へ到達。製品実装は開始せず停止する。

## 現行構造の証拠

- `ClipAsset.internalLayers[]`と`DrawingSnapshot`が一枚Rasterの保存正本。
- `ClipAsset.rigDefinition`がPart / Bone / rigid bindingのstatic Setup正本。
- `ClipInstance.rigMotion`がBone Pose keyの時間変化正本。
- `ClipInstance.deformer` / `folderDeformers`はFrame Poseを持つWARP正本であり、static Skin Meshへ流用しない。
- `createTriangleMeshData()` / `warpRgbaWithTriangles()`は任意triangleのPixi data / CPU reference adapterとして再利用可能。
- `createRectGridTopology()` / `triangulateControlMeshPoints()`はpure topology生成器として再利用可能。
- `evaluateRigidBones()`のcurrent / bind world matrixから、vertexごとのinverse-bind Skinning代数を構成できる。

## 完了して検証済み／スキップ

- Phase 6s Folder WARP、Phase 6t IK、Phase 6u auto-fit / point-mapは再実装しない。
- 直近のコード変更後に全26 verifier、変更JS / mjsの`node --check`、`npm.cmd run build`が成功した。
- Stage AのBrowser smokeとOwner軽操作確認を維持し、文書だけの変更を理由に同じ実操作を反復しない。

## 変更したファイル

- `task-codex/GOAL_LEDGER.md`
- `task-codex/phase6v.md`
- `tegaki_work/PROGRESS.md`
- `開発用資料保管庫/proposals/00_計画索引.md`
- `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
- `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`

## 実行済み検証

- Phase 6u close時: 全26 `build/verify*.mjs`成功。
- Phase 6u close時: 関連JS / mjs `node --check`成功。
- Phase 6u close時: `npm.cmd run build`成功（既知のag-psd externalize / chunk警告のみ）。
- Phase 6u close時: `dist/`、`node_modules/.vite/`生成差分なし、`.git/index.lock`なし。
- Goal Gate 0文書更新後: `git diff --check`成功（既存working copyのLF→CRLF予告のみ）。コード変更なしのためnode check / verifier / buildは再実行していない。

## 未検証項目

- 一枚Rasterへ複数Boneを置くstatic model。
- linear blend skinningのidentity / parent-child回転 / weight正規化 / zero-weight境界。
- auto meshのalpha bounds、密度、point / triangle上限、determinism。
- per-Raster Meshをclipping前後のどこで評価するか。
- CPU / Pixi / preview / onion / Bake / exportの同一Mesh sample。

固定入力案と各未検証項目の受入境界は`task-codex/phase6v.md`へ移した。Phase 6v開始指示前には実装しない。

## blocker / risk

- 現行コードにMesh / SkinWeight保存shapeがなく、新しいoptional static正本が必要。
- Control MeshをそのままSkin Mesh正本にするとClipInstance PoseとClipAsset Setupが重複する。
- Raster単位Meshは現行Folder RenderIslandより細かく、clipping owner / sourceの評価順を明文化する必要がある。
- topology再生成が既存Animationやweightを無言破壊しないよう、生成後は明示操作まで固定する必要がある。

## 次の一手

1. Ownerの開始指示を待つ。
2. 開始後は`task-codex/phase6v.md`のStage AだけをLUNA MAXで実装する。
3. SOL XHighがstatic ownership、validation / remap、inverse-bind行列順、固定入力、旧Project互換をreviewする。
4. Phase 6v close後にだけPhase 6wの描画proofへ進む。
