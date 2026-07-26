# 完了: Phase 6e - 長時間描画 / History・resource寿命監査

更新日: 2026-07-26

## 現在地

- Phase 6dは外部Project実保存・再読込とオーナー実機pen境界まで受入れ、完了記録を`開発用資料保管庫/Archive/phase6d.md`へ移した。
- Animation Tableを開かない通常描画でも、描画を続けると遅延またはcrashする実機報告がある。History上限到達が原因とはまだ断定しない。
- 現行Historyは件数と宣言`byteSize`の二上限で古いcommandを破棄する。通常strokeは前後Raster snapshotを保持するが、同時に累積`pathsData`をsnapshotへ複製し、その保持量は宣言`byteSize`へ含まれていない。
- Slice 0では挙動を変えず、History 499 / 500 / 501、byte上限、破棄理由、stroke snapshot / record / finalize時間、Rasterと`pathsData`保持量、利用可能なJS heapを観測可能にする。
- オーナー実機では500件を越えた直後の一律crashは再現していない。stroke密度、Airbrush、Raster変形、長時間のブラウザ／GPU状態を含む実制作条件の報告待ちとし、500件を原因または受入境界へ固定しない。
- 重めのアニメProjectへ新規CAFを作りAirbrushを重ねた際、History約10件でも約100件でも、時折入力結果が遅れてから一気に表示される。件数と遅延の相関は弱く、Project load直後だけにも限定されない。ブラウザ内の別tab／GPU資源競合、GC、stroke開始時のRaster readback・一時mask確保、Airbrushの短区間ごとの同期renderを分離して追う。
- Slice 1ではRaster snapshot共通estimatorを追加し、pixelだけでなく累積`pathsData` / legacy `paths`のpath数・point数もHistoryの推定byteへ含める。stroke、fill、selection、Layer / Folder transform、recenter、mergeの保持snapshotを同じ見積もりへ揃えた。
- Airbrush mask、pen opacity isolation、blur sourceの一時RenderTextureは開始前cleanup、確定後cleanup、cancel cleanupを持つ。debug sampleではactive数・寸法・推定byteを記録し、終了時に残存していないか実制作ログから比較できる。
- Pointer debugはhandler実行時間だけでなく、`performance.now() - PointerEvent.timeStamp`のevent queue待ちも記録する。Airbrushは開始時のRaster枠保証／mask準備時間と、stroke内のrender回数・dab数・1 render最大dab数を分離し、遅延後の一括反映が入力queue停滞かTegaki描画処理かを判別する。
- オーナー実測でPointer downはqueue待ち1185.2msに対してhandler 26.8ms、後続moveはqueue待ち906msに対してhandler 1.4msだった。今回捕捉した遅延はHistory件数や当該handler内のAirbrush処理を直接原因とせず、イベント受領前の停滞として扱う。debug有効時だけLong Tasks APIを監視し、警告直前の同一tab内50ms超taskを`recentLongTasks`へ関連付ける。
- Browserの400×400通常Layerへmouse penを1 stroke入力し、History 1 / 500、before snapshot 5.3ms、after snapshot 4.0ms、record 0.3ms、finalize 6.5ms、Raster 440×440、`pathsData` 1件 / 192点、console warning / errorなしを一行JSONで確認した。この単発値は性能受入値ではなく、長時間比較のbaselineとする。
- 通常History変更の1秒後に緊急復旧が全Layer / CAFをProject化していたため、重いProjectでは次の入力前にGPU readback、PNG化、Snapshot複製、preview生成を開始できた。自動退避はdebounce後のidle taskへ送り、stroke中は500ms後へ延期する。pagehide / hidden時の強制退避は従来どおり待たない。
- オーナーの重いAnimation CAF実測では、Airbrush開始0.1〜0.3ms・確定0.2〜0.7msに対し、緊急復旧はProject export 463.6〜2007.8ms、未使用thumbnail 2514.3〜2726.2ms、全体4378.9〜5698.4msだった。通常描画時の同処理は約38〜41msで、Airbrush固有処理よりProject規模依存の自動退避が主因候補である。新規checkpointは復元に未使用のthumbnailを生成せず`null`で互換shapeを維持する。実測heapは約2.4GBまで上昇しており、export中の一時複製とcrashの関係は未解決の容量懸念として残す。実エラーはfavicon 404だけで、`TegakiPerf`はdebug診断警告である。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6d.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `tegaki_work/system/history.js`
9. `tegaki_work/system/settings-manager.js`
10. `tegaki_work/system/drawing/brush-core.js`
11. `tegaki_work/system/layer-system.js`
12. `tegaki_work/system/animation/caf-memory-profiler.js`

## 目的

長時間描画の重化を、History件数、宣言byte、未計上snapshot metadata、stroke入力点、CPU確定時間、RenderTexture / heap寿命へ分解する。再現前にHistory classや描画pipelineを再設計せず、通常LayerとCAF working Layerの正本を混同しない。

## Slice 0

1. `HistoryManager`へ件数／byte上限のhit回数、破棄件数・byte、直近理由を小さな診断値として追加する。
2. `getUsage()`で`byteSize`未宣言command数を可視化し、「上限内表示だが実保持量は増える」経路を識別する。
3. 既存`TegakiStrokeInputProfiler`へ、debug時だけstroke開始／終了のHistory使用量、active Raster寸法、`pathsData`件数・point数、snapshot / record / finalize時間、利用可能なJS heapを記録する。確定ごとの比較に必要な値は`LongDrawingProfile`の一行JSONでも確認できる。
4. 純粋固定入力でHistory 499 / 500 / 501、byte破棄、最新command・Undo index、未計上entry数を固定する。
5. 計測値を得るまでは`pathsData`削除、History既定上限変更、RenderTexture再設計を行わない。

## Slice 1

1. `pathsData`はProject保存正本ではないが、strokeごとにlive Layerへ累積し、前後Raster snapshotへ全量`structuredClone`される。削除はまだ行わず、固定係数による軽量estimatorで保持量をbyte上限へ含める。
2. estimatorは実JS heapの厳密値ではない。pixel byteは実値、path metadataはpath / point数からの保守的推定値として分離表示し、件数上限だけに依存しない退避判断へ使う。
3. History `getUsage()`はcommand typeごとの件数・byte・未計上件数を返す。drawとtransform等を分離して、遅延が操作種別へ依存するか比較する。
4. Airbrush / pen opacity / blurの一時stroke textureをdebug sampleへ追加する。所有者とcleanupは変更せず、stroke終了後の残留だけを観測する。

## Slice 2

1. `EmergencyRecoveryStore`の通常checkpointはHistory変更debounce後に`requestIdleCallback`で開始し、未対応環境だけ短いtimerへfallbackする。
2. BrushCore / DrawingEngineがstroke中なら保存を開始せず、pendingを維持して再試行する。5秒の保存間隔内だった場合も次のHistory変更待ちにせず残り時間後へ予約する。
3. `pagehide` / hiddenの強制checkpointだけは描画中判定とidle待ちを省略し、復旧安全性を維持する。
4. Hospital復元は`projectData`だけを使うため、新規checkpointでは未使用thumbnailを生成せず互換フィールドを`null`で保存する。debug時はProject exportとcheckpoint全体の16ms超を`emergency-recovery.*`の`TegakiPerf`として既存profilerへ残す。描画結果、History正本、復元契約は変更しない。

## 維持する契約

- History commandは`{ name, do, undo, byteSize?, meta? }`を維持し、古いcommandから線形に破棄する。
- 最新commandが単体でbyte上限を超えても、その1件はUndo可能なまま残す。
- 通常LayerとCAF working LayerのHistory復元先を統合しない。
- mouse no-pressure、pen / eraser / airbrushの描画結果、stroke中working Layer表示、preview staging、Lane順、Folder clippingに触れない。
- 診断は`TEGAKI_CONFIG.debug`配下か明示APIだけに置き、本番常時consoleへ出さない。

## 次のgate

- Browserで400×400のpen / eraser / airbrushを通常LayerとCAF working Layerへ反復し、0 / 上限直前 / 到達 / 超過のsampleを比較する。
- 再現困難な遅延はHistory件数を受入軸にせず、`TegakiPerf`の`bottleneck: event-queue / handler`、`beforeSnapshotMs`、`ensureRasterFrameMs`、`airbrushBeginMs`、Airbrush render回数／dab数を同じstrokeで採取する。event queue側だけが伸びる場合は他tab・GC・ブラウザ／OS圧迫、handler側が伸びる場合はsnapshot・mask・dab render経路を優先する。
- `event-queue`警告に`recentLongTasks`が付けば同一tab内の長いtaskを先に追う。空配列のままqueue待ちだけが大きければ、別tab、共有GPU process、OS scheduling、入力driver、Long Tasks APIで観測できないGPU待ちを候補として残す。
- `recentLongTasks`と`emergency-recovery.export-project / total`の時刻が重なる場合は自動退避を第一候補とする。新規checkpointで`emergency-recovery.thumbnail`が出ないことを確認する。重ならない場合はCAF stroke完了時のworking Raster capture / History複製、通常UI thumbnail、preview更新を次に個別計測する。
- 重いCAFでProject export単体が1秒を越える場合は、保存正本を削らずに中間Project複製とPNG／Raster一時保持量を計測する別の容量gateへ送る。Airbrushのdab処理や将来WebGPU化とは分離し、実crashまたは同時刻のqueue停滞が再現するまで描画結果を変える最適化へ広げない。
- Airbrushのcoalesced入力batch化は有力な軽量化候補だが、spacing・flow・筆圧・重ね塗りの画素一致を固定できるまでは挙動を変更しない。
- `pathsData`の累積複製が支配的なら、Raster正本を維持したままbaked stroke metadataをHistoryまたはlive Layerから外せるか固定入力化する。古いruntime snapshotのmetadataを黙って削除しない。
- 共通estimator導入後も、`byteSize`未宣言の非Raster commandとJS / GPU実保持量の差を継続計測する。件数既定値は変更しない。
- RenderTexture、listener、pointer sample、thumbnail、CAF texture cacheが増え続ける場合は別々の所有者／破棄点を修正する。

## 検証

- `node tegaki_work/build/verify-history-limits.mjs`
- `node tegaki_work/build/verify-raster-snapshot-memory.mjs`
- `node tegaki_work/build/verify-emergency-recovery-scheduling.mjs`
- 変更JSの`node --check`、関連固定入力、`npm.cmd run build`。
- Browser実操作では入力遅延、stroke確定時間、History使用量、`pathsData`、heap、console / GPU errorを確認する。
- build後に`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。

## Closeout

- History 500件直後を一律crash原因とせず、件数・推定byte・path metadata・一時texture・event queue・Long Task・heapをdebug計測へ分離した。
- 重いAnimation CAFでAirbrush本体は開始／確定とも各1ms未満だった一方、緊急復旧Project exportと未使用thumbnail生成が4.38〜5.70秒を占めた。自動退避をidle開始へ変更し、復元に不要なthumbnail生成を廃止した。
- 実crashは未再現のためAirbrush描画結果、History既定上限、WebGPU化には進まない。Project exportの一時複製量とheap約2.4GBの実測はPhase 6fの容量preflightへ引き継ぎ、同時刻のqueue停滞またはcrash再現時に再開する。
- thumbnail廃止後の再測定でもProject export 476.8〜832.4ms、checkpoint全体1896.4〜3766.5msと、直後のpointer queue待ち642.4〜950.5msが残った。CAF pen / Airbrushの確定は0.3〜0.9ms、一時stroke textureは0件であり、描画tool固有ではなくProject全体serialization / IndexedDB退避の容量問題として凍結する。保存頻度や復旧保証を小改修で弱めず、Phase 6fのpeak memory監査後に共通serialization改善として再開する。
