# Tegaki 次チャット引き継ぎ

更新日: 2026-08-30

状態: Phase 9mまでclose。現行Phase 9nはRIG / Motion Responsibility / Contextual Right RIG Inspector Gate。Gate 0=`GO — D: Dedicated Right RIG + Motion handoff`、Stage A / B / C1 / C2 / C3 / C4 / C5 / C6はcheckpoint完了。次はStage D Animation Table static RIG cleanup Gate。

## 1. 最初に読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `task-codex/phase9n.md`
6. `開発用資料保管庫/proposals/17_RIG・Motion責務再配置Architecture Gate.md`
7. `開発用資料保管庫/Archive/phase9m.md`
8. `開発用資料保管庫/Archive/phase9l.md`
9. `開発用資料保管庫/Archive/phase8d.md`
10. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
11. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
12. `tegaki_work/system/animation/rig-authoring-status-projection.js`
13. `tegaki_work/ui/layer-panel-renderer.js`
14. `tegaki_work/ui/animation-table-popup.js`

## 2. 作業開始時の確認

```powershell
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
```

- 既存差分を維持し、`restore` / `reset` / `checkout`で巻き戻さない。
- `Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。
- `dist/`と`node_modules/.vite/`は追跡済み基準を持つため、build生成差分だけを限定清掃する。

## 3. 現在地

- Phase 9mはOwnerがproduction実画面を受入れた。stable一行header、固定幅Playback Range、OUT限定I / O、borderless FPS / FRAMES / PREVIEW、Bottom Lucide COPY / DELETEを全118 verifier / build / Browser checkpoint、SOL final review=`A`でcloseし、`Archive/phase9m.md`へ移した。
- RIG入口は現在、Animation TableのFolder `+RIG` / Raster `RIG設定` / BONE / Mesh / Weight / WARPと、右Layer属性Popupの`+RIG` / `ROOT BONEを作成`へ分散している。右側mutationも実体はAnimation Table external adapterへ委譲される。
- static正本は`ClipAsset.rigDefinition / meshDefinitions / skinBindings`、temporal正本は`ClipInstance.rigMotion`。UIもこの分離へ合わせる。
- Gate 0はDを選定した。右Layer Panelは対象・構造・visibility・RIG状態・handoff。同じ右dockのRIG viewは親子 / 曲げ / 全体PIVOT / Bone / Mesh / Weight / WARP Bind。Animation Tableはplayback / Frame / key / easing / temporal WARP。Canvasは直接操作。
- 左RIG案はPlan Bとしてproposal 17へ保存した。right dock切替回数、Layer同時参照、narrowでの手の遮蔽が問題化した時に再比較する。A current / B Layer統合も削除しない。
- SpineのSetup / Animate、Live2DのModeling / Animation、ToonSquidのLayer→Inspector→Canvas→Timeline keyを2026-08-29に公式資料で再確認した。Adobe AnimateのTimeline parentingは`Layer = Timeline row`が一致する場合の反例として保持する。
- Stage Aは`system/animation/rig-authoring-status-projection.js`を新設し、`none / parent / bend / whole / conflict / stale`をpure導出する。Layer mirror badgeを従来の一律`RIG`から`親子 / 曲げ / 全体 / 要更新 / 競合`へ投影した。全119 verifier、対象JSの`node --check`、build、Browser whole / Table open・closed / 480×800 / console 0件、生成物清掃でcheckpoint完了。
- Stage Bは既存132px columnへCAF context限定の`LAYERS / RIG`を実装した。runtime-only view lens、共有`selectedCelId / selectedInternalLayerId`、対象 / kind / status / methodのread-only表示、RIG中のLayer rail非表示を固定し、全120 verifier / build、Browserのnormal非露出 / pointer・Enter・Space / Table close / 480×800 / console 0件でcheckpoint完了。
- Owner follow-upとして二軸ghostはOFF時からTimeline淡色 / Lane茶色、ON時は共通の枠なし橙surfaceへ整理した。CAF / Lane情報とAnimation Table本体の知覚的分断はproposal 14へ後続UI/UX Gateとして記録し、Phase 9nでは配置を動かさない。
- Stage C1はRIG未設定だけへSetup青actionを置き、Folder=`親子RIGを開始`、Raster=`全体PIVOTを開始`と方法を明示した。既存adapter委譲、1 History、Undo / Redo、Table閉鎖、480×800、console 0件を確認し、全121 verifier / buildでcheckpoint完了した。空Folderは既存model契約どおり登録可能で、新しい拒否を追加していない。
- Stage C2はRIG未設定Rasterへ`曲げRIG / 全体PIVOT`を二等分し、曲げを既存RIG Setupへ開く`changed: false` adapter、全体を既存1 History登録へ接続した。Table閉鎖からの復帰、Undo / Redo、480×800の非重複hit、console 0件、全122 verifier / buildでcheckpoint完了した。
- Stage C3はC1 / C2がRigid Part登録まででroot Bone未作成だったことを監査し、`parent / whole`かつPartあり・root BoneなしのFolder / Rasterへ共通`PIVOTを作成`を追加した。既存`registerInternalRootBoneFromExternal()`だけへ委譲し、描画済みは各1 History、空対象は`allowEmptyTarget`なしで`描画が必要`、接続後はactionを消す。全123 verifier / build、BrowserのFolder / Raster成功、空対象、Table閉鎖、Undo / Redo、480×800非重複、console 0件でcheckpoint完了した。
- Stage C4はRigid Partのbinding先BoneとRig全体ROOTを分離し、親接続後もPIVOT済み状態を維持するpure projectionへ補正した。右RIGには枠なし`PIVOT / PARENT`要約と、既存Animation Table RIG inspectorを開く無履歴`接続を編集`を追加した。全124 verifier / build、BrowserのFolder2→Folder1接続1 History、Undo / Redo、ROOT / linked、Table閉鎖、480×800非重複・横overflowなしでcheckpoint完了した。
- Stage C5はRaster曲げRIGへ枠なし`BONE / MESH / WEIGHT`進捗と状態別handoffを追加した。unbound Bone候補とSkin接続済みBoneをpure projectionで分離し、Mesh生成後にTable閉鎖handoffが失敗する既存resolverをRaster専用経路へ補正した。全125 verifier / build、BrowserのBONE / AUTO GRID各1 History、STALE、無履歴`Weightを確認 / Meshを更新`、480×800非重複・横overflowなし、Vite error overlayなしでcheckpoint完了した。
- Stage C6はMesh前unbound Boneを保存owner化せず、明示選択した`asset / Raster / Bone`三点だけのruntime focusで右RIGへ`曲げRIG 準備中 / BONE候補 / MESH未生成 / WEIGHT未接続`を投影した。Layer / CAF / Folder / Mesh生成で破棄し、別Rasterへglobal候補を自動継承しない。全126 verifier / build、Browserの複数Raster非漏出、元Raster非自動復帰、明示Bone復帰、Table閉鎖、RIG tab復帰、AUTO GRID 1 History、480×800 action非重複・document横overflow 0、console 0件でcheckpoint完了した。
- selection正本、History、save、solver / evaluator、ClipInstance.rigMotion、Table open / closed authorityは変更していない。runtime focusはProjectへ保存しない。
- Owner指示として、Phase 9n close時は`GitHubURL.txt`を外部Web AI向けRIG導線review indexへ再編集する。最終導線、D案と保留3案、再試行条件、実装・verifier・Browser acceptance、評価依頼論点へraw URLで到達できることをclose条件とする。

## 4. 次のtask

Phase 9n Stage Dとして、Animation Table内のstatic RIG Setup DOMを段階撤去できるかのGateを行う。

1. `animation-table-popup.js`のRIG tabを、static Setup、temporal Motion/key、Canvas direct manipulation、既存right handoffに分類し、DOM / event / adapter / reject / Historyの対応表を先に作る。
2. 右RIGで代替済みと実操作で確認できたcontrolだけを撤去候補とする。`BONE追加 / AUTO GRID / Weight / Mesh Edit / parent接続`を一括削除しない。
3. 最初のSliceはentry重複やread-only要約など、mutation authorityを動かさず撤去できる最小単位を選ぶ。Motion key、easing、temporal WARP、Canvas gestureは残す。
4. 右RIGから既存editorへ到達する`RIGを設定 >` handoffと、Table close / reopen、narrow、History、拒否理由を固定してから実装する。
5. Clip Focus、dark top / bottom、Lane濃淡、外枠削減、CAF / LaneとTableの分断改善を並走しない。
6. Phase close時の`GitHubURL.txt`外部Web AI向け再編集は`task-codex/phase9n.md`第13節に従う。Stage D途中ではclose扱いにしない。

## 5. model分担

- Stage D contract、static / temporal inventory、右経路parity、撤去単位、Gate / Phase判断、最終監査はSOL / MAX。
- 対象DOM / event / Acceptance Criteria固定後の限定removalだけLUNA / MAX候補。
- selection、mutation、History、schema判断へ触れる場合、LUNAは変更せずSOLへ返す。

## 6. 新チャットへ貼る文面

```text
D:\GitHub\tegaki の作業を継続してください。

Phase 9mまでclose済みです。現行Phase 9nはRIG / Motion Responsibility / Contextual Right RIG Inspector Gateです。Gate 0はD Dedicated Right RIG + Motion handoffを選定し、Stage A / B / C1 / C2 / C3 / C4 / C5 / C6はcheckpoint完了、次はStage D Animation Table static RIG cleanup Gateです。

最初にAGENTS.md、TEGAKI.md、tegaki_work/PROGRESS.md、tegaki_work/NEXT_CHAT_HANDOFF.md、task-codex/phase9n.md、開発用資料保管庫/proposals/17_RIG・Motion責務再配置Architecture Gate.md、Archive/phase9m.md、Archive/phase9l.md、Archive/phase8d.md、proposal 15 / 16、system/animation/rig-authoring-status-projection.js、ui/layer-panel-renderer.js、ui/animation-table-popup.jsを順に読んでください。

git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
を最初に確認し、既存変更をすべて維持してください。Backup/、PastFiles/、開発用資料保管庫/Backup-tegaki_work/は調査・編集しないでください。

責務はLayer=対象、右RIG同一dock=static構造、Animation Table=時間、Canvas=直接操作です。左RIG / Layer統合 / 現行Table案はproposal 17へ再試行候補として残しています。最初のtaskはAnimation Table RIG tabのstatic Setup / temporal Motion / Canvas gesture / right handoff inventoryです。右経路parityを確認できた一surfaceだけを撤去候補とし、BONE / Mesh / Weight / parent controlsを一括削除しないでください。保存owner、第二state、Mesh / Weight algorithm変更、Clip Focus、dark top / bottom、Lane濃淡、枠削減、CAF / LaneとTableの分断改善を並走しないでください。

次作業予告はPhase 9n Stage D Animation Table static RIG cleanup Gateです。inventory / parity / 撤去単位 / 最終監査はSOL / MAX、契約確定後の限定removalだけLUNA / MAX候補です。
```
