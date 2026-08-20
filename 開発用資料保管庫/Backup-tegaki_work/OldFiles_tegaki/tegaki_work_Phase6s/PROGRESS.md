# Tegaki Progress

更新日: 2026-08-01

## 現在地

- Phase 5a〜6qを完了した。詳細記録は`開発用資料保管庫/Archive/`へ保存している。
- Phase 6gではQTP開閉用`Q`、既存Layer Transform経路の`V`、Plan Aの最小sidebar、tooltip撤去、icon比率、`square-dashed`選択iconを確定した。削除済み描画tool専用の到達不能handlerも残存監査で除去した。
- Phase 6hではBrowser 100%のまま主要UIを従来80%表示相当へ縮小し、Canvas / pointer座標を変えず、`pointer: coarse`だけ主要hit areaを従来寸法へ戻した。sidebar、Layer Panel、QTP、CAF、Animation Table、status、Resize、Settings、Layer Transformを固定入力で受入れた。
- QTPの選択tool表示、Animation Table表示中のPixel Selection変形preview、CAF化後にTableを閉じた状態の矩形overlayを、既存PixelSelection状態・selection event・working Layer adapterへ接続して修正した。preview / confirm / Table close後の位置は固定入力で一致し、Historyは1操作1件、console errorなしを確認した。
- 通常Layer / Table表示中CAF / Table閉鎖後CAFの選択系横断リファクタリングはproposal 14へ記録した。Raster確定位置、Undo / Redo、保存 / 再openの破損が再現しない限りRig系列を止めない。
- Phase 6i Gate 0では、CAF内部Layer / Folder IDをPart identityとして再利用し、表示親`parentLayerId`とrig親`parentPartId`を分離する`GO`判定を確定した。preview / exportは同じ純粋FK結果を使い、copy / pasteは共通ID mapで参照を再mapする。
- Phase 6jではoptional Part schema、validation、共通ID remap、root Motionと共有するtransform-track sampler、stateless rigid FKを実装した。Rigなし保存shape、Project / History round-trip、CAF copy、structured Bake、2段FK、random seekを固定入力で受入れた。
- Phase 6kでは一つのCAF内部Folder subtreeを一つのRenderIslandとして解決する共通render planを実装し、Pixi preview / playback / onionとCanvas compositor / Bake / exportへ同じworld matrixを接続した。clipping分断はRaster fallbackとし、negative bounds、root Motion / WARP順、Table開閉後のactive poseを固定入力とBrowserで受入れた。
- Phase 6lでは一つのFolder Partに限定し、選択CAFのAnimation Table子行、Folder Part登録、既存`rigMotion.partTracks`へのkey編集、Canvas handleを接続した。オーナー実機受入を得て`GO`でcloseした。
- Phase 6mではCAF内部Folder枠を通常Raster thumbnailから分離し、Animation Table Laneを26pxへ調整した。オーナー実機で受入済み。
- Phase 6nでは既存Rig正本へoptional Bone schema、validation、共有ID remap、3段のstateless FKを追加した。Project / CAF copy / Bake / random seekを固定入力で受入れ、`GO`でcloseした。
- Phase 6oでは一つのroot BONEを一つのFolder Partへ明示bindingし、inverse bind deltaを既存Folder RenderIslandへ接続した。preview / playback / onion / Bake / exportは同じplanを使い、通常描画とconsole errorなしをBrowserで確認した。
- Phase 6pでは一つのroot BONE + binding、Bone key、Canvas tip rotation、全Folder候補Lane、`RIG → MOTION → WARP`のRIG-first導線、CAF / Folder対象tab、単一Inspectorを実装しcloseした。
- Phase 6qではCAF + 全Folder PIVOT、遅延Rig登録、青Setup / 橙Motion、親BONE接続、nested剛体FKを共通render planへ接続し、オーナー実機でRigと親子Motionを受入れた。親dropdownを維持したまま、Canvas上のPIVOT長押し接続、接続線dragによる付け替え、空drop解除も同じ`parentBoneId` setterへ接続した。保存Bone長は維持し、表示stemだけを短縮した。
- Phase 6rは保存容量・KEY選択・tab復帰・通常Layer選択の安定化Sliceとしてcloseした。多数Folder / Layer / Motion keyで旧`Invalid string length` crashが再現しない状態を維持し、Motion / WARP / Bone / legacy Part KEYのCtrl/Cmd複数選択と一括drag、通常押下だけの一時表示、再Ctrl/Cmd click解除、設定済みLaneのlast-used tab復帰、PIVOT設定済み`✓`、Project採取前のV Layer Transform確定、同一Assetの内部Layer選択保持を完了した。CLIP MOTION内のnative `title` tooltipはFutaba paletteの`data-tooltip`へ統一し、pointerupでもKEY選択toggleをcommitしてCtrl/Cmd OFF後の◆表示を通常へ戻す。外部paste / Canvas resizeを含むV save / reopenは既知残存として後続検査へ引き継ぐ。
- 現行はPhase 6s Stage BとSOL review 2まで完了し、Stage CをLUNA MAXで開始できる。SOL review 1は`A`判定でraw Project JSONの不正な`folderDeformers` version / collection shape診断だけを補正した。Stage Bでは既存Part/Bone planを内包する`createFolderEffectRenderPlan()`を追加し、CPU compositorとPixi previewが`Folder subtree合成 → Folder WARP → Part/Bone matrix → Folder opacity/blend → root WARP → root Motion → Lane`を共有する。review 2ではFolder opacity / blend、root後段順、RenderTexture遅延破棄を追加監査し`A`判定とした。Stage Cの編集UI・overlay・新stateはまだ追加していない。
- proposalは現行10文書へ整理した。標準入口は`開発用資料保管庫/proposals/00_計画索引.md`。外部AI原案、レビュー、整理前長文、解決済み監査は`proposals/過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`へ原文保存している。

## 完了基盤の要約

### Animation / CAF

- Lane / Timeline / CAF Group、複数選択、copy / paste、Folder clipping、Lane visibility、onion、preview / playback / export境界を段階実装した。
- Clip Motionは既存`ClipInstance.transform` / `transformKeyframes`を正本とし、position、scale、rotation、anchor、opacity、blend、HOLD / LINEAR / cubic-bezierを同じClip-local Frame契約でsampleする。
- Animation Tableは単押し`A`で開閉する。CLIP MOTIONは未設定CAFの初回だけRIGへ入り、以後は最後に閉じたRIG / Motion / WARP tabへ復帰する。

### WARP

- 固定4×4 WARPと可変GRIDを維持する。
- GRIDは全Frame共通のBind Setupで、GRIDの移動・拡縮・回転だけではRasterを動かさない。
- POINT / BRUSHだけがFrame Poseを変形し、LENSはWarp key内placementを操作する。
- 元Rasterを保持し、Bind triangle領域だけをWarp結果へ差し替える部分合成をCPU / Pixiで共有する。
- 白mask、座標ずれ、透明境界、Raster外、部分重複、GRID / POINT / BRUSH、B / N、preview / playback / Bake / GIF / APNGは固定入力、Browser、オーナー実機で受入済み。
- 旧Project、key無しCAF、固定4×4 WARP、既存可変GRIDはoptional field欠損をidentityとして維持する。

### Bake / 容量

- flatten BakeとLayer構造保持Bakeを分離した。
- Bake結果は最上段の新Laneへ作り、元Clipを非表示で保持する。
- Layer構造保持Bakeは逐次生成、容量preflight、cancel、原子的rollback、1 Historyを維持する。
- 400×400、1 Raster Layer、240 Frame実測では処理完走後の同期checkpointに強いmemory pressureが出たため、校正済み安全上限を1GiBへ固定した。

## 維持する契約

- stroke中の選択CAFはworking Layerで表示する。
- previewは非表示stagingで完成後に一括交換する。
- preview container順は`background -> back preview -> currentFrameContainer -> front preview`。
- Animation Tableでは上側LaneをCanvas前面とする。
- Lane / Timeline onionはdisplay-only。Layer visibility、ClipAsset、DrawingSnapshot、History、保存画像、exportへ混ぜない。
- PSD recordは背面から前面。前面から背面で持つCAF internal Layerだけを反転する。
- CAF working Layerは表示・入力adapterであり、TimelineModel / ClipAsset / DrawingSnapshotが保存正本。
- Folder clipping、通常Layer / CAF内部Layerのdata adapter境界を維持する。
- 新しいMotion、mask、Mesh、physics正本を既存経路と並行して作らない。

## 既知残存と再開条件

- sidebar / Layer Panel / QTP / CAF / Animation Tableのcompact表示はBrowser固定入力とオーナー実機で成立した。実pen / touchのcoarse hit areaは継続監視する。
- 重いAnimation Projectでは、緊急復旧Project serialization / IndexedDB checkpointとpointer event queue待ちが重なる場合がある。pen / Airbrush確定自体は実測1ms未満だったため、描画結果やHistory上限を変更せず凍結監視する。
- 複数Motion / WARP Projectの`JSON.stringify`失敗は、保存先への書き込み前に発生する。OneDriveだけを原因とせず、Phase 6rでSnapshot参照数、decoded pixel bytes、JSON長、serialize時間を採取した。初回native pickerはDownloadsを開始位置のhintとするが、既存handleとOS / browserのfolder選択を上書きしない。
- 通常modeでLayer Panel選択とV変形Rasterが食い違う例、Table表示有無でFolder / Layer card順が揺れる例はPhase 6rで限定修正した。外部paste / Canvas resizeを含むV save / reopenだけは後続の固定入力へ残し、保存round-trip受入れ前に横断リファクタリングへ広げない。
- Browserで再現したTable閉鎖後のCAF内部Layer selection / working adapterずれは、同じAssetに存在する`selectedInternalLayerId`をFrame同期で保持して修正した。通常 / Table表示 / Table閉鎖後のV確定・EscapeとPanel順は一致した。
- Folder別WARPの保存正本とCPU / Pixi共通評価はSOL review 2まで完了したが、CAF / Folder対象切替、GRID作成、key編集、overlayは未実装。Stage Cは既存対象tab、`_getWarpGridEditState()`、既存WARP Inspector / overlay / Timeline Historyをtarget-awareにするだけに限定し、別popupや別deformer正本を作らない。target配下に別Part / 別Folder WARP targetがあるnested非線形境界とcross-boundary clippingは初期Sliceで明示unsupportedとする。
- V保存ずれは全Layer一律ではなく、Canvas resizeを挟んだ外部clipboard貼付Rasterが候補。配置を保持する貼付例もあるため、Slice 3で`外部paste → resize → V → save/reopen`を固定入力にしてから限定修正する。
- 添付画像のBrowser file chooser投入はネイティブchooser待ちで完了しなかったため、実機のOS clipboard / file chooser入力へ委譲する。`ImageImporter`のresize前後snapshot、working Layer capture、ProjectManagerのtransform commit待ちはコード監査済みで、現時点では追加修正を入れない。
- 末端の手から前腕・上腕を追従させる操作は、現行FKの逆流ではなくIK targetとして計画する。第一段はrigid Folderのrotation-only 2-Bone IK、伸縮と周辺画素の曲げはrotation limit / chain参加 / Mesh・weightと分離し、Folder別WARPより後のPhase候補とする。
- 遅延またはcrashが再現した場合は、`TegakiPerf`のevent queue / handler、Long Task、Project export時間、heap、texture残留を同時採取し、AirbrushやHistory件数を先に原因と決めない。詳細は`開発用資料保管庫/Archive/phase6e.md`。
- WebGPU brush、SDF / MSDF、水彩・油彩、本格物理、真の無限Canvasは正式な研究Phaseまで凍結する。
- PSD全CAF一括export、通常LayerへのPSD import、再編集可能Text、Camera Track、Folder group完全合成は未実装proposalとして維持する。

## 次の入口

1. `AGENTS.md`
2. `TEGAKI.md`
3. 本書
4. `task-codex/phase6s.md`
5. `開発用資料保管庫/Archive/phase6q.md`
6. `開発用資料保管庫/Archive/phase6p.md`
7. `開発用資料保管庫/proposals/00_計画索引.md`
8. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
9. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
10. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`

Phase 6rは上記の安定化Sliceとしてcloseした。Phase 6s Gate 0、SOL review 1 / 2はGO、Stage Bまで完了。次の入口は`task-codex/phase6s.md`のStage Cで、既存CAF / Folder対象tabとWARP編集経路だけをLUNA MAXへ渡す。完了後はSOL review 3とオーナー実機判定へ戻し、IK / Stretch / Meshはそれより後とする。

## 資料

- Phase 6c完了: `開発用資料保管庫/Archive/phase6c.md`
- Phase 6d完了: `開発用資料保管庫/Archive/phase6d.md`
- Phase 6e完了: `開発用資料保管庫/Archive/phase6e.md`
- Phase 6f完了: `開発用資料保管庫/Archive/phase6f.md`
- Phase 6g完了: `開発用資料保管庫/Archive/phase6g.md`
- Phase 6h完了: `開発用資料保管庫/Archive/phase6h.md`
- Phase 6i完了: `開発用資料保管庫/Archive/phase6i.md`
- Phase 6j完了: `開発用資料保管庫/Archive/phase6j.md`
- Phase 6k完了: `開発用資料保管庫/Archive/phase6k.md`
- Phase 6l完了: `開発用資料保管庫/Archive/phase6l.md`
- Phase 6m完了: `開発用資料保管庫/Archive/phase6m.md`
- Phase 6n完了: `開発用資料保管庫/Archive/phase6n.md`
- Phase 6o完了: `開発用資料保管庫/Archive/phase6o.md`
- Phase 6p完了: `開発用資料保管庫/Archive/phase6p.md`
- Phase 6q完了: `開発用資料保管庫/Archive/phase6q.md`
- Phase 6r完了: `開発用資料保管庫/Archive/phase6r.md`
- 整理前Progress全文: `開発用資料保管庫/Archive/PROGRESS_ARCHIVE_2026-07-28.md`
- 現行proposal索引: `開発用資料保管庫/proposals/00_計画索引.md`
- 現行Phase: `task-codex/phase6s.md`
