# Phase 8j — Fixed-topology Skin Weight Brush

更新日: 2026-08-20
担当: SOL / XHigh（weight transfer規則、History / gesture / STALE、UI境界、review / close）。pure planとfixtureが固定した限定SliceはLUNA / MAX候補
状態: CLOSED — Stage A / B、SOL final review=`A`。Owner制作確認は台帳へ分離

## 1. Goal

一枚RasterのAUTO GRID / AUTO SHAPEで、顔・反対肢への微小漏れや肘／膝の関節勾配を、Mesh topologyを変えずにCanvas上から調整できるようにする。

Phase 8cの離散`CORRECT`を安全なfallbackとして維持し、連続値brushは既存stable `vertexId`と`skinBindings[].vertexWeights`へ直接確定する。新しいWeight mask、delta、Shape zone、Bone strength、毎Frame deformation正本は作らない。

## 2. Authority / preservation contract

- static正本は既存`ClipAsset.meshDefinitions / skinBindings / rigDefinition.bones`、Frame Poseは既存`ClipInstance.rigMotion.boneTracks`だけとする。
- brush結果は既存`skinBindings[].vertexWeights`へ最大2、非負、合計1として確定する。対象vertexをrestへ戻す明示0だけは空influenceを許す。
- Mesh vertex数、`vertexId`、座標、triangles、generator source、Raster、Bone hierarchyをbrushで変更しない。
- AUTO GRID / AUTO SHAPEのCURRENT Meshだけを対象とし、STALE、AUTO LINE、manual Mesh、clipping、active Folder WARP / rigid競合は理由付きで拒否する。
- preview / playback / onion / random seek / Bake / GIF / APNG / Project reloadは既存`evaluateRasterBoneSkinning()`とrender planをそのまま共有する。

## 3. Stage A — pure brush plan

一Raster / 一Mesh / 選択Boneと、stable `vertexId`ごとの有限signed deltaを受けるpure planを追加する。

### 3.1 Weight transfer rule

- 現在influenceを正規化し、選択Boneの現在weightへdeltaを加えて0〜1へclampする。
- companionは現在の非選択influenceで最大weightの一つだけとし、同値は`boneId`順で決定する。
- target=1は選択Boneのみ、target=0はcompanionがあればcompanion 1、なければ空influenceとする。
- 0<target<1でcompanionが無いvertexは変更せず`companion-required`として返す。別Boneを選んでADDすれば既存ownerをcompanionとして安全にtransferできる。
- 出力順は選択Bone、companionの順へ固定し、最大2、非負、合計1、finiteをvalidateする。

### 3.2 Pure-plan acceptance

- 入力assetを変更しない。
- duplicate vertex update、未知vertex、非有限delta、未知Bone、unsupported generatorを全体rejectする。
- delta 0、clamp後同値、companion不足はHistory対象にせず、changed / skipped vertexを区別する。
- branch外vertexは入力に含まれない限りbyte-equivalent weightを維持する。
- generatorには再生成警告用lineageだけを残し、weight評価用の第二fieldを作らない。

## 4. Gate 1 — UI gesture readiness

Stage A後、次が一つのgesture planへ閉じる場合だけStage Bへ進む。

- Setup青RIG / WEIGHT advanced内の明示`BRUSH`。Motionではread-only WEIGHTを維持しmutationしない。
- pointerdown時のdiagnostic Frame頂点をgesture終了まで固定し、変形後にhit対象が逃げない。
- radius / strengthはruntime UI値。Projectへ保存しない。pen pressureは初期Sliceで使わない。
- pointer capture、Escape / pointercancel / target変更 / tab closeでgesture前assetへrollbackする。
- live previewはgesture前state + 累積sampleから毎回pure planを再計算し、pointerupの実変更だけ既存CAF asset History一件へ記録する。
- Space + drag、Bone PIVOT、通常描画、CORRECT vertex clickと同時activeにしない。

## 5. Stage B — limited production adapter

Gate 1=`GO`後だけUIへ接続する。既存WEIGHT heatmapを表示の正本とし、brush cursor / modeだけをruntime追加する。

再生成前確認は離散補正とbrush lineageの双方を対象とする。cancel / no-opはHistory 0、実strokeは長さやsample数にかかわらず1 Historyとする。

## 6. Acceptance Criteria

- 一枚人物Rasterで、選択Boneを腕へADDして顔・反対肢epsilon 0を維持でき、隣接Boneとの関節勾配を0〜1で調整できる。
- 最大2 influence、非負、合計1、NaN / unknown ID / duplicate update拒否。
- no-op History 0、実stroke 1 History、cancel rollback、Undo / Redo、CAF / Raster複製、Project reload一致。
- STALE / playback / unsupported generator / render conflictではmutation前に拒否し、理由と次操作を示す。
- preview / playback / onion / random seek / Bake / GIF / APNGが同じ`vertexWeights`を読む。
- CORRECT、WEIGHT、NAMES AUTO / ON、Bone group、Timeline wheel、Space + dragを壊さない。
- 変更JSの`node --check`、関連verifier、全`build/verify-*.mjs`、build、Browser、console、生成物清掃を行う。

## 7. Non-goals / stop conditions

- point追加 / 移動、triangle切断、UV編集、複数Mesh自動分割、AUTO LINE brush。
- smooth / blur、範囲塗りつぶし、pen pressure、Motion中authoring、Weight animation。
- DQS、solver置換、stretch、physics、Attachment、WARPとの二重変形。
- companion自動推測に新しいzone / chain保存が必要、または既存`vertexWeights`以外の評価正本が必要なら`HOLD / REPLAN`。

## 8. First work

SOL / XHighでStage Aのpure transfer plan APIとfixtureを固定する。対象fileは新規pure helper、一つのmodel adapter、専用verifierまでとし、Gate 1前にpointer / DOM / CSSへ接続しない。

## 9. Source

- `開発用資料保管庫/Archive/phase8i.md`
- `開発用資料保管庫/Archive/phase8c.md`
- `tegaki_work/system/animation/skin-influence-correction.js`
- `tegaki_work/system/animation/raster-bone-skinning.js`
- `tegaki_work/ui/rig-skin-weight-overlay.js`
- `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`

## 10. Stage A結果（2026-08-20）

- `system/animation/skin-weight-brush.js`へpure `createSkinWeightBrushPlan()`を追加した。
- AUTO GRID / AUTO SHAPEだけを受け、stable `vertexId`ごとの有限signed deltaを既存`vertexWeights`へ最大2 influenceで確定する。
- companionは現在最大の非選択Bone、同値は`boneId`順。途中weightでcompanionが無い頂点は`companion-required`としてskipする。
- `TimelineModel.applyClipAssetRasterSkinWeightBrush()`はCURRENTだけを通し、STALEをmutation前に`mesh-stale`で拒否する。
- 専用verifierでpure非破壊、ADD / SUBTRACT / clamp / explicit rest、multi-vertex、duplicate / unknown / NaN拒否、AUTO GRID / AUTO SHAPE、最大2 / 合計1、STALE、CAF複製、Project round-tripを確認した。

## 11. Gate 1判定

判定: **GO**

- 既存Motion Canvas gesture入口にSpace+Drag譲渡、pointer capture、pointercancel / lost capture、Escape、History終了処理がある。
- WEIGHT overlayは表示正本のまま維持し、brush hitはCanvas gesture側でpointerdown時のdiagnostic頂点を固定できる。
- gesture前asset + 累積sampleからpure planを再計算し、live preview中に第二weight正本を保存せず、pointerupの実変更だけCAF asset History一件へ閉じられる。
- UIはRIG Setup内だけへ置き、MotionのWEIGHTはread-onlyを維持する。CORRECT / PIVOT / WARP / Space panとは同時activeにしない。

## 12. Stage B結果（2026-08-20）

- Setup青RIGの既存WEIGHT内へruntime `BRUSH`、`ADD / SUB`、radius、strengthを追加した。MotionのWEIGHTはread-onlyのままである。
- pointerdown時のdiagnostic頂点をscreen座標で固定し、gesture前asset + 累積sampleからpure planを再計算する。live preview以外の第二weight正本は作らない。
- pointerupの実変更だけ`caf-raster-skin-weight-brush` History一件へ確定する。no-op、Escape、pointercancel、lost capture、target変更、Table close、sample失敗はgesture前へrollbackする。
- AUTO GRID / AUTO SHAPEのCURRENT Meshだけを受ける。STALE、AUTO LINE、playback、active Folder WARP / rigid競合はmutation前に既存status / render planで拒否する。
- brush lineageはgeneratorの再生成警告用markerだけとし、評価は従来どおり既存`skinBindings[].vertexWeights`を読む。GRID / SHAPE表示には`· WEIGHT`を付ける。
- CORRECTとBRUSHは相互排他、Space + dragはgesture未開始なら通常Cameraへ譲渡する。cursorはscreen-space SVGでProject / Historyへ保存しない。

## 13. Verification / SOL final review

- `node --check`: `animation-table-popup.js`、`rig-skin-weight-overlay.js`、`animation-data-model.js`、新規pure helper 2本を通過。
- 専用verifier 3本と関連Skin / Overlay verifierを通過。全`build/verify-*.mjs`は83 / 83通過。
- `npm.cmd run build`通過。追跡済み`dist/`基準を個別復元し、新規hash assetだけを個別削除した。`dist/` / `node_modules/.vite/`に生成差分なし。
- Browserで空の一枚Rasterから`RIG設定 → BONE追加 → AUTO GRID`、2 Bone化、BRUSH ADD / SUB、`GRID 6×6 · WEIGHT`表示、strokeごとのHistory一件、Undo / Redoを確認した。操作中に画面上の例外表示はなかった。
- SOL final review判定: **A**。保存schema、Mesh topology、Skin evaluator、Motion mutationを増やさず、Phase 8iで選定した固定topology Weight brushへ閉じている。

## 14. Close / Owner backlog

2026-08-20に技術closeする。Owner制作Projectでの顔・反対肢漏れ補正、長いstroke、cancel、CAF複製、Project reload、preview / playback / onion / random seek / Bake / GIF / APNG、pen / touch、consoleは`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`へ分離する。問題が見つかった場合はPhase 8jを暗黙に再OPENせず、Raster / generator / Bone / vertex / strokeを固定した限定bug fix Gateを立てる。
