# Tegaki Progress

更新日: 2026-07-28

## 現在地

- Phase 5a〜6iを完了した。詳細記録は`開発用資料保管庫/Archive/`へ保存している。
- Phase 6gではQTP開閉用`Q`、既存Layer Transform経路の`V`、Plan Aの最小sidebar、tooltip撤去、icon比率、`square-dashed`選択iconを確定した。削除済み描画tool専用の到達不能handlerも残存監査で除去した。
- Phase 6hではBrowser 100%のまま主要UIを従来80%表示相当へ縮小し、Canvas / pointer座標を変えず、`pointer: coarse`だけ主要hit areaを従来寸法へ戻した。sidebar、Layer Panel、QTP、CAF、Animation Table、status、Resize、Settings、Layer Transformを固定入力で受入れた。
- QTPの選択tool表示、Animation Table表示中のPixel Selection変形preview、CAF化後にTableを閉じた状態の矩形overlayを、既存PixelSelection状態・selection event・working Layer adapterへ接続して修正した。preview / confirm / Table close後の位置は固定入力で一致し、Historyは1操作1件、console errorなしを確認した。
- 通常Layer / Table表示中CAF / Table閉鎖後CAFの選択系横断リファクタリングはproposal 14へ記録した。Raster確定位置、Undo / Redo、保存 / 再openの破損が再現しない限りRig系列を止めない。
- Phase 6i Gate 0では、CAF内部Layer / Folder IDをPart identityとして再利用し、表示親`parentLayerId`とrig親`parentPartId`を分離する`GO`判定を確定した。preview / exportは同じ純粋FK結果を使い、copy / pasteは共通ID mapで参照を再mapする。
- 現行はPhase 6j。指示書は`task-codex/phase6j.md`。optional Part schema、validation、共通ID remap、root Motionと共有するtransform-track sampler、stateless rigid FKを固定入力で成立させる。Pixi / Canvas描画、Animation Table子行、BONE UIはまだ実装しない。
- proposalは現行10文書へ整理した。標準入口は`開発用資料保管庫/proposals/00_計画索引.md`。外部AI原案、レビュー、整理前長文、解決済み監査は`proposals/過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`へ原文保存している。

## 完了基盤の要約

### Animation / CAF

- Lane / Timeline / CAF Group、複数選択、copy / paste、Folder clipping、Lane visibility、onion、preview / playback / export境界を段階実装した。
- Clip Motionは既存`ClipInstance.transform` / `transformKeyframes`を正本とし、position、scale、rotation、anchor、opacity、blend、HOLD / LINEAR / cubic-bezierを同じClip-local Frame契約でsampleする。
- Animation Tableは単押し`A`で開閉し、CLIP MOTIONは最後に閉じたMotion / WARP tabへ復帰する。

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

- sidebar / Layer Panel / QTP / CAF / Animation Tableのcompact表示はBrowser固定入力で成立した。実pen / touchのcoarse hit area、CAF内部Folder表示、オーナーの100%表示での視認性は実機受入を残す。
- 重いAnimation Projectでは、緊急復旧Project serialization / IndexedDB checkpointとpointer event queue待ちが重なる場合がある。pen / Airbrush確定自体は実測1ms未満だったため、描画結果やHistory上限を変更せず凍結監視する。
- 遅延またはcrashが再現した場合は、`TegakiPerf`のevent queue / handler、Long Task、Project export時間、heap、texture残留を同時採取し、AirbrushやHistory件数を先に原因と決めない。詳細は`開発用資料保管庫/Archive/phase6e.md`。
- WebGPU brush、SDF / MSDF、水彩・油彩、本格物理、真の無限Canvasは正式な研究Phaseまで凍結する。
- PSD全CAF一括export、通常LayerへのPSD import、再編集可能Text、Camera Track、Folder group完全合成は未実装proposalとして維持する。

## 次の入口

1. `AGENTS.md`
2. `TEGAKI.md`
3. 本書
4. `task-codex/phase6j.md`
5. `開発用資料保管庫/Archive/phase6i.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
9. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`

Phase 6jの最初の入口はSlice 0。Rig fieldなしのserialize / Motion sample、nested Folder、asset / subtree duplicateを固定入力化してから、optional schemaと共通ID remapへ進む。

## 資料

- Phase 6c完了: `開発用資料保管庫/Archive/phase6c.md`
- Phase 6d完了: `開発用資料保管庫/Archive/phase6d.md`
- Phase 6e完了: `開発用資料保管庫/Archive/phase6e.md`
- Phase 6f完了: `開発用資料保管庫/Archive/phase6f.md`
- Phase 6g完了: `開発用資料保管庫/Archive/phase6g.md`
- Phase 6h完了: `開発用資料保管庫/Archive/phase6h.md`
- Phase 6i完了: `開発用資料保管庫/Archive/phase6i.md`
- 整理前Progress全文: `開発用資料保管庫/Archive/PROGRESS_ARCHIVE_2026-07-28.md`
- 現行proposal索引: `開発用資料保管庫/proposals/00_計画索引.md`
- 現行Phase: `task-codex/phase6j.md`
