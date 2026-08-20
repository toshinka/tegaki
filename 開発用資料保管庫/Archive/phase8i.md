# Phase 8i — Raster Mesh Topology / Weight Authoring Boundary Gate

更新日: 2026-08-20
担当: SOL / XHigh（Mesh / Skin正本、History、STALE / regenerate、CPU / Pixi / export境界、Gate / review / close）。対象file・mutation・AC確定後の限定SliceだけLUNA / MAX候補
状態: CLOSED — Gate 0 / 1完了、Gate 1=`GO — B: 固定topology Weight brush`、SOL final review=`A`

## 1. Goal

一枚Raster人体で残る「意図しない部位への影響」「関節形状」「自動Meshが形に合わない箇所」を直す次のauthoring入口を選ぶ。Phase 8a〜8eのread-only WEIGHT、離散補正、Motion中診断、Canvas-first shellを維持し、次の三案を同じ固定fixtureで比較する。

- A: 既存vertex選択による離散Weight補正を制作向けに詰める。
- B: 既存Mesh頂点だけへ自由Weight brushを追加する。
- C: point追加・移動・triangle切断を行うManual Topology編集を先に開く。

実装より先に、既存Mesh vertexのidentity、SkinWeight再map、generator lineage、STALE、Undo / Redo、Project / CAF複製、CPU / Pixi / Bake / exportのauthorityを実コードから固定する。

## 2. Authority / preservation contract

- static正本は既存`ClipAsset.meshDefinitions / skinBindings / rigDefinition.bones`、Frame Poseは既存`ClipInstance.rigMotion.boneTracks`だけとする。
- Weight結果は既存`skinBindings[].vertexWeights`へ確定し、delta、override、Bone strength、Shape zone等の第二評価正本を作らない。
- topologyとweightを一gesture / 一modeへ混ぜない。Cを採る場合はvertex identityと全weight再mapがmutation前に証明できること。
- source Raster変更は既存`STALE`、明示再生成、補正済み破棄確認を維持する。手動結果を自動generatorが無言上書きしない。
- preview / playback / onion / random seek / Bake / GIF / APNG / Project reloadは既存一つのSkin evaluatorを共有する。

## 3. Gate 0 — read-only audit

1. `animation-data-model.js`のMesh / Skin normalize、validate、replace、duplicate remap、Project round-tripを列挙する。
2. Phase 8a / 8c overlayとcorrectionが頂点を何で識別し、selection / History / cancelをどう扱うか確認する。
3. AUTO GRID / SHAPE / LINE再生成時のvertex順、generator metadata、CURRENT / STALE、補正lineageを比較する。
4. CPU rasterizer、Pixi adapter、Bake / exportがvertices / indices / weightsをどの順で読むか固定する。PixiJS adapterを調査・変更する場合は公式v8.19 skillを追加で読む。
5. 一枚人体fixtureで、branch漏れはWeightだけ、輪郭不足はTopologyだけ、LBS collapseはsolver候補として原因を分離する。

## 4. Gate 1 — candidate decision

### A. Limited correction extension

既存`BONE ONLY / PARENT BLEND / NO INFLUENCE`とstable selectionを維持し、複数vertex gesture、joint band候補等の最小拡張だけを比較する。第二正本不要なら第一候補。

### B. Weight brush

既存頂点数とtrianglesを固定し、選択Boneへの加減算を既存最大2 influence、非負、normalizeへ1 gesture 1 Historyで確定する。cancel、pointer capture、再生成確認が一つのmutation planへ閉じる場合だけ`GO`。

### C. Manual Topology

point追加 / 移動 / triangle切断をWeight brushから分離する。vertex identity、UV、indices、全SkinWeight再map、triangle winding、STALE、CPU / Pixi / export一致を一度に証明できなければ`HOLD`。

## 5. Acceptance Criteria

- A / B / Cをowner、mutation、History、save、render、failure recoveryで比較し、一つだけを次Stageへ選ぶ。
- no-op History 0、実変更1 gesture 1 History、cancel非mutation、Undo / Redo、CAF複製、Project reloadを固定する。
- 最大2 influence、非負、normalize、対象外branch epsilon、不正triangle / index / NaN拒否を維持する。
- UIは既存Setup青RIG / WEIGHT advanced内へ限定し、常設MESH top-level tabや第二selection正本を増やさない。
- 実装時は変更JSの`node --check`、関連verifier、全`build/verify-*.mjs`、build、Browser、console確認、生成物清掃を行う。

## 6. Non-goals / stop conditions

- DQS、solver置換、stretch、physics、Attachment、複数Mesh自動分割、ControlHandle、WARPとの二重変形。
- Shape zone / Weight override / Bone strengthの新保存schema。
- global UI redesign、Animation Table dock、`animation-table-popup.js`の主要class再構成。
- Cのために既存Project weightを推測reindexする必要がある、またはCPU / Pixi / exportの別evaluatorが必要なら実装せず`HOLD / REPLAN`。

## 7. First work

SOL / XHighでGate 0をread-only実施し、比較表と最小Slice候補を本書へ追記する。Gate 1決定前にproduction mutation / UIを追加しない。

## 8. Source

- `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
- `開発用資料保管庫/Archive/phase8a.md`
- `開発用資料保管庫/Archive/phase8c.md`
- `開発用資料保管庫/Archive/phase8e.md`
- `開発用資料保管庫/Archive/phase8h.md`
- `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`

## 9. Gate 0 audit result

### 9.1 Mesh / Skin authorityとstable identity

- `ClipAssetModel`は`meshDefinitions`と`skinBindings`をnormalize / serializeし、Project round-tripでも同じoptional static Setupを維持する。Frame Poseは従来どおり`ClipInstance.rigMotion.boneTracks`だけが所有する。
- Mesh頂点は配列indexではなく非空・重複禁止の`vertexId`を保存identityとする。triangleと`vertexWeights`も同じ`vertexId`を参照し、描画時だけ保存vertex順からdense `triangleIndices`へ変換する。
- CAF全体複製とCAF内部Raster複製はmeshId / vertexId / Bone / Layer / Snapshotを同じID mapでremapする。Raster削除は対応Mesh / Skinを同時に除去し、Project load前には全参照をvalidateする。
- validationは非有限頂点、欠損 / 重複vertex、欠損triangle、退化triangle、dangling weight / Bone、負weight、0合計、上限超過を拒否する。現行schema上限は4 influenceだが、初期generatorと次Stageは最大2へ限定する。

### 9.2 correction / selection / History

- Phase 8cの離散補正は一Raster / 一Mesh / 一Boneとstable `vertexId`集合を受け、既存`skinBindings[].vertexWeights`を直接置換する。`BONE ONLY / PARENT BLEND / NO INFLUENCE`以外のdeltaやoverrideを保存しない。
- Canvas上の頂点選択はruntime `Set<vertexId>`だけで、target変更、mode終了、再生成時に破棄する。実変更だけ既存CAF asset History一件へ記録し、同値操作はHistory 0である。
- History snapshotは`asset.serialize()`を含むためMesh / Skin / generator lineageを一体でUndo / Redoする。復元時は当時CURRENTだったgenerator sourceだけを現Snapshotへrebaseし、別topologyへruntime選択を持ち越さない。

### 9.3 generator / CURRENT / STALE / regenerate

- AUTO GRID / AUTO SHAPE / AUTO LINEは生成ごとに新しいmeshId / vertexIdを作り、既存targetのMesh / Skinをvalidate後に原子的に置換する。異なる再生成間でvertexId対応を推測しない。
- generator sourceはsnapshotId、updatedAt、width / height、rasterBoundsのsignatureを持つ。Raster変更時はMesh / Skinを自動上書きせず`STALE`を表示し、明示再生成だけがtopology / weightを置換する。
- Phase 8c補正済みMeshは`weightCorrectionMode`をlineage markerとして持ち、再生成前に明示確認する。markerは描画正本ではなく、評価は常に確定済み`vertexWeights`だけを読む。

### 9.4 CPU / Pixi / Bake / export

- `evaluateRasterBoneSkinning()`が保存Mesh / Skinと既存Bone FKからFrame頂点を一度だけ導出する。`createRasterSkinRenderPlan()`は同じ結果をLayer単位へ配る。
- Pixi previewは同じFrame頂点と保存triangle順からv8.19 `MeshGeometry({ positions, uvs, indices })`を作り、CPU compositorは同じdeformerをpremultiplied triangle rasterizerへ渡す。Pixi側だけのweight evaluatorやtopologyはない。
- `TimelineFrameCompositor`はpreviewと同じSkin planをBakeへ使い、`ExportManager`は同compositorのFrame列をGIF / APNG等へ渡す。Project reload後も同じserialize / validate / evaluatorへ戻る。
- PixiJS公式v8.19 Mesh skillと照合し、options-object `MeshGeometry` / `Mesh`、`positions`、明示indicesの現行adapterはv8契約内である。今回Renderer / shader / buffer mutationは変更しない。

### 9.5 制作症状の原因分離

- 顔や反対肢が引かれるがtriangle輪郭は対象を覆っている場合はWeight問題であり、固定topology Weight編集で扱う。
- 輪郭外の余白が引かれる、肘内側へ必要vertexがない、triangleが部位境界を横断する場合はTopology問題であり、Weight brushだけで直したように見せない。
- weight 1の区間でも大角度で幅が潰れる場合はLBS solver特性であり、Topology / Weightと分離してDQS等の別Gateへ送る。

## 10. Candidate comparison / Gate 1

| 案 | owner / mutation | History / save | render / recovery | 判定 |
|---|---|---|---|---|
| A: 離散補正拡張 | 既存stable vertex集合へ3値を確定。安全だが0 / 0.5 / 1以外の細かな関節勾配を作れない | 既存1 action 1 History、第二正本0 | 全経路一致済み。制作fallbackとして維持 | `KEEP` |
| B: 固定topology Weight brush | 既存vertexIdへ選択Bone weightを加減し、trianglesは不変 | 既存`vertexWeights`へ最大2 normalized influenceを1 gesture 1 Historyで確定可能 | 既存evaluatorを無変更で共有。cancelはgesture前assetへrollback可能 | `GO` |
| C: Manual Topology | point追加 / 移動 / triangle切断に新規vertex weight、UV、winding、source lineageが同時に必要 | topologyと全weightのatomic History、再生成後対応を別途設計要 | 不正triangle拒否はあるがauthoring / recovery adapter未存在 | `HOLD` |

Gate 1判定は`GO — B: 固定topology Weight brush`とする。

- Aは削除せず、誤weightを明示3値で直せる安全なfallbackとして残す。
- Bは既存Meshのvertex数 / vertexId / trianglesを固定し、`skinBindings[].vertexWeights`だけを更新する。対象外branch、Mesh座標、Bone Pose、Raster、generator sourceを変更しない。
- CはWeight brushと同時実装しない。新規vertexの初期weight、triangle winding、manual / generated lineage、STALE / regenerate、CPU / Pixi一致を独立Phaseで証明してから再検討する。

## 11. Next bounded slice

次Phaseは固定topology Weight brushを二段に分ける。

1. pure plan: stable vertexIdごとの有限deltaを受け、選択Boneと既存最強companionだけへ最大2 normalized influenceを返す。入力を変更せず、invalid / no-op / changed vertexを固定fixtureで返す。
2. UI gesture: Setup青RIG / WEIGHT advanced内だけでbrushを明示ONにする。gesture開始時のFrame geometryを固定し、pointer capture、cancel rollback、実変更だけ1 History、STALE / playback / target変更拒否を接続する。

最初はAUTO GRIDとAUTO SHAPEのCURRENT Meshだけを対象とする。AUTO LINE、Manual Topology、Motion中mutation、pen pressure、smooth / blur、DQSは混ぜない。

## 12. Verification / SOL final review

- `verify-raster-bone-skinning.mjs`
- `verify-raster-skin-render-plan.mjs`
- `verify-skin-influence-correction.mjs`
- `verify-auto-shape-raster-bone-setup.mjs`
- `verify-line-ribbon-raster-bone-setup.mjs`
- `verify-raster-bone-auto-setup.mjs`

上記6 verifierは2026-08-20に再実行し全て通過した。Gateはread-only監査と文書化だけで、production JS / CSS / Project schema / rendererを変更していないためBrowser差分確認は不要と判定した。

SOL final review=`A`。stable identity、History / duplicate / removal、STALE / regenerate、CPU / Pixi / Bake / export境界を実コードとfixtureで照合し、Bだけを次Stageへ選定できた。Owner制作確認を要求するproduction変更は本Phaseにはない。
