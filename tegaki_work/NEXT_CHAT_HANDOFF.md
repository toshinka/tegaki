# Tegaki 次チャット引き継ぎ

更新日: 2026-08-30

状態: Phase 9mまでclose。現行Phase 9nはRIG / Motion Responsibility / Contextual Right RIG Inspector Gate。Gate 0=`GO — D: Dedicated Right RIG + Motion handoff`、Stage A / B / C1はcheckpoint完了。次はStage C2 Raster method fork Gate。

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
- selection、History、save、solver / evaluator、ClipInstance.rigMotion、Table open / closed authorityは変更していない。

## 4. 次のtask

Phase 9n Stage C2として、一枚Rasterの`曲げRIG / 全体PIVOT`入口を同じ右RIG面で明示分岐するGateを行う。

1. 既存Animation TableのRaster `RIG設定`が開く曲げRIG setup経路、C1の全体PIVOT登録経路、既存external adapterを先に監査する。
2. RIG未設定Rasterに`曲げRIG / 全体PIVOT`の二方法と結果を同じ情報階層で示し、汎用`RIG`一語へ戻さない。Folderは`親子RIG`の一経路を維持する。
3. 最初のproduction Sliceは既存曲げsetupを開くhandoff / adapterまで。新しいMesh / Bone / Weight mutation、mode flag、第二selectionを作らない。
4. Table open / closed、wide / 480、戻り先、空target、既存whole / bend / stale / conflict、console 0件を固定する。
5. Animation Table内static RIG DOM削除、Clip Focus、dark top / bottom、Lane濃淡、外枠削減はPhase 9nと並走しない。

## 5. model分担

- Stage C2 contract、Gate / Phase判断、最終監査はSOL / MAX。
- 既存曲げRIG handoff / adapterとAcceptance Criteriaを固定後の一action接続だけLUNA / MAX候補。
- selection、mutation、History、schema判断へ触れる場合、LUNAは変更せずSOLへ返す。

## 6. 新チャットへ貼る文面

```text
D:\GitHub\tegaki の作業を継続してください。

Phase 9mまでclose済みです。現行Phase 9nはRIG / Motion Responsibility / Contextual Right RIG Inspector Gateです。Gate 0はD Dedicated Right RIG + Motion handoffを選定し、Stage A / B / C1はcheckpoint完了、次はStage C2 Raster method fork Gateです。

最初にAGENTS.md、TEGAKI.md、tegaki_work/PROGRESS.md、tegaki_work/NEXT_CHAT_HANDOFF.md、task-codex/phase9n.md、開発用資料保管庫/proposals/17_RIG・Motion責務再配置Architecture Gate.md、Archive/phase9m.md、Archive/phase9l.md、Archive/phase8d.md、proposal 15 / 16、system/animation/rig-authoring-status-projection.js、ui/layer-panel-renderer.js、ui/animation-table-popup.jsを順に読んでください。

git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
を最初に確認し、既存変更をすべて維持してください。Backup/、PastFiles/、開発用資料保管庫/Backup-tegaki_work/は調査・編集しないでください。

責務はLayer=対象、右RIG同一dock=static構造、Animation Table=時間、Canvas=直接操作です。左RIG / Layer統合 / 現行Table案はproposal 17へ再試行候補として残しています。最初のtaskは一枚Rasterの曲げRIG / 全体PIVOT入口を同じ右RIG面で明示分岐するGateです。最初は既存曲げRIG setupを開くhandoff / adapterを監査し、新しいMesh / Bone / Weight mutation、Animation Table内static RIG DOM削除、Clip Focus、dark top / bottom、Lane濃淡、枠削減を並走しないでください。

次作業予告はPhase 9n Stage C2 Raster method fork Gateです。contract / 最終監査はSOL / MAX、契約確定後の既存曲げRIG handoff接続だけLUNA / MAX候補です。
```
