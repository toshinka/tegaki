# Phase 8e — Canvas-first Rig Workspace Stage 1 / Motion WEIGHT Projection

更新日: 2026-08-20
担当: SOL / XHigh（authority、visibility policy、Workspace境界、review / close）。限定projection / verifierが確定した後だけLUNA / MAX候補
状態: CLOSED — Gate 0=`GO`、Stage B、SOL final review=`A`。Owner制作確認は台帳へ分離

## 1. Goal

Phase 8dで選定した`B: Canvas-first Rig Workspaceの段階導入`を、保存正本やsolverを増やさず開始する。第一Sliceは、Skin接続済みBoneをMotionで動かしながら既存read-only WEIGHT診断を同じCanvas上で確認できるようにし、Setup tabへ強制移動しない表示projectionとする。

このSliceは本格Workspace shellの完成ではない。Motion / RIGを跨いで診断表示を維持できることを、既存popup内で先に証明し、その後だけCanvas占有を減らすshell抽出へ進む。

## 2. Authority

- static正本は既存`ClipAsset.rigDefinition / meshDefinitions / skinBindings`、Frame正本は既存`ClipInstance.rigMotion`。
- WEIGHT値は既存`skinBindings[].vertexWeights`、表示projectionは既存`raster-skin-weight-diagnostic.js`、Canvas描画は既存`rig-skin-weight-overlay.js`を唯一の入口とする。
- 選択Raster / Mesh / Bone、current Frame、RIG / Motion tabは既存runtime stateから読む。Workspace専用selection、Weight copy、History、保存flagを作らない。
- Motionで表示するWEIGHTはread-only。`CORRECT`、頂点選択、Weight mutation、Topology編集はRIG Setupだけに残す。

## 3. Stage A — visibility / interaction audit

1. 現在`WEIGHT確認`がRIGへ切り替える理由を、overlay visibility、selected Bone保持、Inspector render、Frame refresh、pointer participationごとに分解する。
2. `RIG tabでWEIGHT ON`と`Motion tabでWEIGHT表示`を同じruntime toggle / projectionで扱えるか固定し、第二overlayや第二診断modelを作らない。
3. 停止中のMotion Bone drag、数値scrub、Timeline seek / random seekごとに、現在FrameのPoseと同じ既存weightを表示する。Weight値自体はFrame keyで変化しないが、変形後Mesh上の表示位置はcurrent poseへ追従する。
4. overlayはpointer非参加を維持し、Bone drag、Canvas selection、Space + drag、Timeline wheelを妨げない。
5. playback / preview / onion / Bake / GIF / APNGには第一Sliceで表示を混ぜない。再生開始時の自動OFFまたは一時非表示と、停止後の復帰をpure visibility policyとして決める。

Gate 0の`GO`条件は、既存overlayを共有する一つのruntime visibility policyだけで成立し、save / History / solver / exportを変更しないこと。新しい診断正本、Motion専用Weight値、描画pipeline分岐が必要なら`HOLD / REPLAN`とする。

## 4. Stage B — limited production Slice

- 接続済みMotionに`WEIGHT表示`を置き、RIGへtab移動せず現在Boneのread-only heatmapをON / OFFできるようにする。
- 未接続Bone、Mesh STALE、target削除、Skinに正weightがない場合は非mutationで理由と`AUTO GRIDへ戻る`等の次操作を示す。
- ON中はMotionのSetup橙を維持し、WEIGHTはSetup青の補助状態としてlabel / icon / outlineを併用する。色だけを状態正本にしない。
- RIGへ戻った場合も同じruntime toggleを引き継ぐ。Table close / reopen、Project reloadでは既存契約どおりruntime OFFから始める。
- 第一SliceのOwner受入後だけ、Table / Inspectorを必要時だけ見せるCanvas-first shell、同名Bone経路、11 Bone密集表示、contrast監査を次Stageへ切る。

## 5. Non-goals

- Mesh contour最適化、control point追加・移動、triangle切断、Weight brush、DQS、stretch、複数Mesh自動分割。
- 新しいWorkspace保存state、Panel位置schema、Rig / Mesh / Weight / selection / History正本。
- Animation Table / `animation-table-popup.js`の全面dock、一括分割、主要DOMの100行超置換。
- playback / onion / export出力への診断overlay混入、GPU Skin、WebGPU renderer、physics、Attachment、Text、Video編集。

## 6. Acceptance Criteria

- Skin接続済みBoneをMotionで選び、tabを変えず`WEIGHT表示`をONにできる。
- Bone drag、数値scrub、Frame±1 / random seekで、選択Boneとcurrent poseを維持したheatmapが追従する。
- overlay ONでもBone / key操作、Space + drag、Timeline wheel、Undo / Redoのmutation / History件数が変わらない。
- playback開始時のvisibility契約、停止後復帰、Table close / reopen、target / source削除、Project reload runtime OFFが決定的である。
- RIGの既存`WEIGHT` / `CORRECT`、Motion key、preview / playback / onion / Bake / GIF / APNGの評価結果を変えない。
- 1280×720 / narrowでCanvas可視面とSetup青 / Motion橙を確認し、console warning / error 0件。可能ならpen / touchも確認する。

## 7. Verification

- pure visibility policy / projection verifierを先行する。
- 変更JS / mjsへ`node --check`。
- 関連verifierと全`build/verify-*.mjs`。
- `npm.cmd run build`。
- BrowserでRIG Setup → AUTO GRID → Motion → WEIGHT ON → Bone drag / seek → playback → close / reopenを実操作し、console errorを確認する。
- build後は`dist/`と`node_modules/.vite/`の生成差分だけを清掃し、追跡済み基準を維持する。

## 8. Result / SOL final review

- Gate 0は`GO`。RIG / Motionで既存diagnostic target、`rig-skin-weight-overlay.js`、一つのruntime requestを共有し、第二Weight / selection / renderer /保存stateを追加せず成立した。
- pure `rig-skin-weight-visibility.js`で、停止中のRIG / Motion表示、Motion read-only、RIGだけのCORRECT、再生中一時非表示を固定した。
- MotionにSetup青`WEIGHT表示 / WEIGHT ON`を追加し、RIG tabへの強制移動を除去した。Motion数値scrub / Bone gestureのpreview refreshでoverlay geometryもinvalidateし、current poseへ追従させた。
- 変更JS / mjsの`node --check`、関連verifier、全79 `build/verify-*.mjs`、`npm.cmd run build`を通過した。build生成assetは追跡済み基準を復元し、個別清掃した。
- Browser 1280×720で一枚Rasterを描画し、CAF 2 Frame、BONE、AUTO GRID 4×8、Motion、`WEIGHT表示`、X数値変形、再生中の一時非表示、F1復帰後の`WEIGHT ON`復帰を実操作した。Motion tab維持、console error / warning 0件を確認した。
- SOL final reviewは`A`。Ownerの深い制作Project、Bone drag / random seek / Space + drag、Table close / reopen、source / target削除、Project reload、narrow、pen / touchは`OWNER_VERIFICATION_BACKLOG.md`へ残し、技術closeを妨げない。
- 形状追従Mesh最適化、point追加 / triangle切断、自由Weight paintは別Gateを維持する。次PhaseはCanvas-first shellの可逆な表示境界を先に固定し、Topology / Weight編集を混ぜない。

## 9. Stop conditions

- Motion表示のためにWeight、selection、Mesh pose、Historyを複製保存する必要がある。
- overlay共有ではなく第二Canvas rendererやexport分岐が必要になる。
- RIG / Motion tab、Animation Table、Layer Panelの主要DOM再構成が第一Sliceの前提になる。
- Weight編集、Topology、Bone solver、GUI全面改修へ範囲が広がる。

## 10. Source

- `開発用資料保管庫/Archive/phase8d.md`
- `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
- `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
- `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
