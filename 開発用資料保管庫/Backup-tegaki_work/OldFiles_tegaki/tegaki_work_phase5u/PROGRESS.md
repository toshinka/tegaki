# Tegaki Progress

更新日: 2026-07-11

## 現在地

- Phase 5aから5rまで完了。
- Phase 5rではLane visibilityの保存・preview/playback/export除外、閉Table Timeline onion、閉Table再生、Frame/Lane/CAF内部Layerの操作契約、PSDアクティブCAF初期選択を完了した。
- オーナー実機でLane visibility、PSD record順、通常再生のCanvas反映を確認済み。
- Phase 5sを完了。viewportの既存一経路を維持したまま、Lane並べ替えHistory、FPS連動の秒境界、compact Frame indicator、複数Laneを跨ぐドラッグ＆ドロップを確認した。
- Lane順変更はドラッグ＆ドロップ専用とし、余分な▲▼buttonを撤去した。`reorderLaneTo()` はLane D&Dの単一経路として維持する。
- Phase 5tを完了。Ctrl/Cmd複数選択、通常activeと選択集合の表示分離、相対Lane/frameを維持した原子的一括移動、衝突全体拒否、単一History Undo/Redoを実装した。
- オーナー実機で複数Laneを跨ぐ一括移動と、障害CAFがある場合に全件移動しないことを確認済み。
- Phase 5uを開始。複数CAF copy/pasteとCAF Groupを同じ相対配置payload・原子的一括配置へ載せる。最初に既存単体CAF clipboardのasset参照、History、save/load契約を監査する。
- Phase 5u Slice 0を完了。単体pasteはClipAsset/DrawingSnapshotを複製する独立コピーで、clipboardはruntime UI state、貼付け結果だけがproject保存対象となる契約を確認した。
- Slice 1で複数payload、相対Lane/frame paste、選択内Asset共有関係の維持、衝突/Lane不足の全体拒否、単一History Undo/Redoを実装した。単体paste回帰とproject round-trip確認が残る。
- Slice 2でTimeline直下のCAF Group、隣接連結判定、folder button、作成/解除、member click全体選択、History、保存復元を実装した。非連結選択はdisabled理由を表示する。
- 単体paste回帰、Group作成/解除/Undo/RedoはBrowser確認済み。Group paste時に新Group IDを払い出す処理を追加し、実操作確認が残る。
- オーナー実機でGroup移動・copy/pasteを確認済み。同一Lane連続Groupは外周破線へ統合し、Group中の個別retiming handle、↔、Duration ±を無効化した。
- Browserで中央memberからの一括D&D、Duration不変、中央member削除時の自動解除、Undo復元を確認した。Project保存は既存 `TimelineModel.serialize()` / constructor経路で `clipGroups` をround-tripする。
- CAF Groupの時間比率伸縮はTegaki側では原則実装しない。将来の別動画WEBUI側でkeyframe/retimingを正本にし、整数FrameへbakeしたCAF列を戻す長期案としてロードマップへ記録した。

## 維持する契約

- Animation Table上では上側LaneをCanvas前面とする。
- stroke中の選択CAFは実working Layerで表示し、他CAFとonionだけをsnapshot previewへ回す。
- previewは非表示stagingで完成させてから一括交換する。表示中containerを空にして順次addしない。
- PixiJS v8の `removeChildren()` 戻り順を再利用しない。移送前の `children.slice()` の順を維持する。
- preview container順は `background -> back preview -> currentFrameContainer -> front preview` とし、同じ親上の連続 `setChildIndex()` へ戻さない。
- Lane onion / Timeline onionはdisplay-only。Layer visibility、ClipAsset、DrawingSnapshot、History、保存画像、exportへ混ぜない。
- PSD recordは背面から前面。通常LayerSystemは配列順をそのまま、前面から背面で持つCAF internal Layerだけを反転する。
- CAF working Layerは表示・入力adapterであり、TimelineModel / ClipAsset / DrawingSnapshotが保存正本。

## 許容している残り

- CAF切替時に0.1秒未満の表示再構成が見える場合がある。stroke中の安定を崩してまで追わない。
- StrokeQualityFilter、墨・水彩的な蓄積、WebGPU brushは実機必要性と計測結果が出るまで保留。
- PSD全CAF一括export、通常LayerへのPSD import、CAF編集状態から通常モードへ戻す明示操作は未実装。

## 資料

- Phase 5q完了: `開発用資料保管庫/Archive/PHASE5Q_CLOSEOUT_2026-07-10.md`
- Phase 5q表示順の技術記録: `開発用資料保管庫/Archive/PHASE5Q_PREVIEW_ORDER_NOTES.md`
- Phase 5t完了: `開発用資料保管庫/Archive/PHASE5T_CLOSEOUT_2026-07-11.md`
- 旧Progress全文: `開発用資料保管庫/Archive/PROGRESS_ARCHIVE_2026-07-10.md`
- 現行ロードマップ: `開発用資料保管庫/proposals/00_計画索引.md`
