# Phase 6f: Motion / WARP Layer構造保持Bake・容量耐性

更新日: 2026-07-26

## 現在地

- Phase 6eはHistory上限を一律原因とせず、stroke・event queue・resource・heapを分離計測して完了した。重いCAFで緊急復旧Project exportが0.46〜2.01秒、全体heapが約2.4GBへ達した実測を容量gateへ引き継ぐ。
- thumbnail廃止後も緊急復旧Project export 0.48〜0.83秒、checkpoint全体1.90〜3.77秒、直後のpointer queue待ち0.64〜0.95秒が残った。pen / Airbrush確定は1ms未満のため描画tool最適化へ広げず、Project serialization / IndexedDB退避をPhase 6eの凍結監視項目とする。Phase 6fのpeak estimatorでは同じProject複製コストを一時保持量へ含める。
- 現行の非破壊Bakeは完成Clipを整数Frameごとのtight Raster 1枚へflattenし、新しい最上段Laneへ1 Frame CAF列として配置する。元Clipは非表示で保持し、Undo / Redoは1 Historyである。この軽量入口を壊さない。
- 現行実装は全Frameのpixel配列を`frames[]`へ蓄積してからimportする。Layer構造版へそのまま拡張すると`Frame数 × Layer数`を一括常駐させるため、実装前にpeak memoryと原子的rollbackの境界を固定する。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6e.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
9. `tegaki_work/ui/animation-table-popup.js`
10. `tegaki_work/system/animation/timeline-frame-compositor.js`
11. `tegaki_work/system/animation/animation-data-model.js`
12. `tegaki_work/system/animation/internal-layer-clipping-contract.js`
13. `tegaki_work/system/animation/caf-memory-profiler.js`
14. `tegaki_work/system/raster-snapshot-memory.js`
15. `tegaki_work/system/history.js`

## 目的

Motion / WARP結果を、現行の1 Frame 1 Raster Bakeに加えて、可能な構成ではCAF内部Layer / Folder構造を保持した編集可能なCAF列へ非破壊展開する。見た目一致を保証できない構成は黙って近似せず、理由を示して現行flatten Bakeへfallbackする。

## Slice 0: 契約・容量監査

1. 現行`_bakeSelectedWarpGridToCafs()`から、Frame sample、tight Raster保持、全Frame蓄積、import、元Clip非表示、最上段Lane、Historyの所有境界を図にせず短い監査表へ固定する。
2. `ClipAsset.internalLayers` / `DrawingSnapshot` / Folder parent / visibility / opacity / blend / clippingのclone経路を検索し、新しいLayer正本やBake専用snapshot schemaを作らず再利用可能な単位を決める。
3. Motion / WARPは内部Layer合成後の完成Clipへ作用する。各Layerを個別変形しても一致しない構成を、Folder clipping、非NORMAL blend、Folder group effect、半透明重なりから固定入力で分類する。
4. `Frame数 × 実効Layer数 × tight RGBA bytes`にHistory前後像、Snapshot metadata、preview texture、export中間複製を加えた保守的peak estimatorを純粋関数として先行する。
5. preflightは必要量と利用可能上限を返すだけにし、Slice 0では既定上限変更、tiled Raster、worker、WebGPU、IndexedDB streamingを実装しない。

### 監査結果

- 現行flatten BakeはFrameごとのtight RGBAを`frames[]`へ全件保持し、`importImageSequenceAsCafs()`が各bufferを`Uint8ClampedArray`へ再コピーする。import完了まで呼出側`frames[]`も生存するため、生成中は出力RGBA約2組と現在FrameのCanvas / readbackが並存する。
- Timeline History captureは`drawingSnapshots[].pixels`を参照共有するため、before / after stateが新出力pixelをさらに全コピーする経路ではない。ただしHistory commandがSnapshot graphを保持し、削除後のresource寿命を延ばす点はpeakへ含める。
- 緊急復旧exportは`DrawingSnapshot.serialize()`でRGBA typed arrayを通常配列へ展開する。Bake commit後のcheckpoint peakは生成中peakと別に見積り、実機値で展開係数を校正する。
- `importImageSequenceAsCafs()`はLane / Folder / Snapshot / Asset / Clipを直接modelへ追加し、失敗時はbefore stateへ復元、成功時だけ元Clip非表示と1 Timeline Historyを確定する。途中cancel入口はない。
- `bake-capacity-estimator.js`はFrame数、Raster Layerごとのtight byte、既存Snapshot / History / preview、Frame working copy、Project export展開係数から生成時／checkpoint時のpeakを別々に返す。現時点ではUIを止めず、固定入力用のpreflight正本とする。

## Slice 1: 既存schemaの静的sampleと逐次複製transaction

1. 内部Layerを個別変形せず、整数Frameの既存Motion / WARP sampleを1 Frame Clipの静的transformとFrame 0 deformer keyへ畳み込む。LENS placementも既存key schemaへ格納し、新しい運動正本を作らない。
2. Frameごとに`duplicateClipAsset()`を使い、独立Snapshot / Assetと1 Frame Clipを逐次追加する。render surfaceや全Frame pixel配列は作らない。各Bake先を独立編集できることを優先し、source / Frame間でSnapshot IDを共有しない。
3. 例外時はBake前Timeline stateへ戻し、容量超過は開始前に止める。成功時だけ元Clipを非表示にし、専用最上段Laneの完成列を1 Historyで確定する。
4. 固定入力でMotion、固定4×4 WARP placement、可変Control Mesh、独立pixel buffer、Folder parent、名前・順・visibility・opacity・blend・clipping、Project JSON round-tripを確認した。Browserでは4 Frame構造保持Bake、最上段Lane、Undo / Redo、再生、console errorなしを確認した。

## 完了した残作業

1. 複合Folder構造保持BakeのProject JSONをBrowserの実file chooserから読み込み、`ProjectManager.loadProject()`経由で24 Frames、2 Lane、Motion / WARP key、Layer / Folder / Snapshotを復元した。
2. 400×400、1 Raster Layer、固定4×4 WARP、240 FramesのProjectを実file chooserから復元して構造保持Bakeを完走した。最上段Laneへ240個の1 Frame CAFを生成し、元Clipは下段で非表示、Historyは1件だけ増加、console warning / errorは0件だった。
3. 上記実測は保守的推定peak 1381MBに対し、処理時間230.7秒、`performance.memory`観測heap増加144MBだった。Bake直後の同期checkpoint serialization中にOS全体の強いmemory pressureも観測したため、構造化Bakeの校正済み安全上限を1GiBへ固定し、同じ400×400・1 Layer・240 Frame構成は今後開始前に拒否する。背景BrowserのFrame間yieldが実測時間を支配するため速度の代表値にはしない。worker / tiled Raster / WebGPUへは広げない。

## Slice 2: 実像回帰・中止・容量matrix

- 複合Folder、normal / inverse clipping、ADD / MULTIPLY / OVERLAY / SUBTRACT / SCREEN、半透明、hidden Layer、負originと欄外Rasterを同一固定入力へまとめた。4 FrameのMotion / WARP sample、Frameごとの独立Snapshot / Asset、独立編集、Project JSON round-tripを確認した。
- Browserで構造保持Bake前後の400×400実像を比較し、480,000 componentすべて差分0だった。現行flatten Bakeも同じ入力で差分0、最上段Lane、元Clip非表示、Undo復元を維持した。APNG / GIFは各4 Frame previewを生成し、console errorなしを確認した。
- Layer構造Bake中はbuttonを中止操作へ切り替え、Frame間でUIへ制御を返す。24 Frame処理を途中中止し、新Lane / Asset / Snapshotを残さず、History 26/500のまま、元CAF / WARPを維持することをBrowserで確認した。例外も同じ`beforeState`復元経路を通す。
- 容量固定入力を1 / 24 / 240 Frame、400×400 / 4096×4096、1 / 8 Raster Layerへ拡張した。2GiB budget例では400×400×8 Layer×24 Frameは許可し、同240 Frameと4096×4096×8 Layer×24 Frameは開始前拒否する。実Browserでは400×400×1 Layer×24 / 240 Frameを完走し、240 Frameで推定peak 1381MB、観測heap増加144MBを採取した。

## 維持する契約

- 現行flatten Bake、元Clip非表示保持、最上段Lane挿入、Clip Motion / WARPのsampling順を変更しない。
- `TimelineModel / ClipAsset / DrawingSnapshot`を保存正本とし、Bake専用の運動正本、mask正本、Layer schemaを重複実装しない。
- stroke中working Layer表示、preview staging交換、preview container順、上側Lane前面、PSD record順、onion display-only境界、Folder clipping契約に触れない。
- 旧Project、key無しCAF、固定4×4 Warp v1、可変GRID、LENS placementを変換しない。
- Airbrush / History既定値 / WebGPU brush最適化をPhase 6fへ混ぜない。

## 固定入力

- 通常Raster Layer 1枚。
- 複数Raster Layer、名前・順・visibility・opacity。
- Folderとnormal / inverse clipping。
- NORMAL / ADD / SUBTRACT / MULTIPLY / OVERLAYと半透明重なり。
- 欄外Raster、負origin、Canvas外へ出るMotion / WARP。
- Motionのみ、WARPのみ、Motion＋WARP。
- 1 / 24 / 240 Frame、小 / 大Canvas、少数 / 多数内部Layerのpreflight。
- 途中cancel、容量超過、生成途中例外、Undo / Redo、Project round-trip。

## 最初の作業

複合Folder実像と現行flatten回帰を先に閉じる。次にuser cancelと24 / 240 Frame容量実測を行い、固定入力と実機で一致した後にPhase 6f closeoutを判断する。

## 検証

- `node tegaki_work/build/verify-bake-capacity-estimator.mjs`
- `node tegaki_work/build/verify-clip-bake-sampler.mjs`
- `node tegaki_work/build/verify-structured-bake-model.mjs`
- 変更JSの`node --check`と純粋固定入力。
- `npm.cmd run build`。
- 実装SliceではBrowserでflatten Bake回帰、構造保持Bake、cancel、Undo / Redo、Project保存・再読込、preview / playback / export一致、console / GPU errorを確認する。
- build後に`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。
