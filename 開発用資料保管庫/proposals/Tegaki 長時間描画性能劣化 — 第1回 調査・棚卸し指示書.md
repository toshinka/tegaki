> 状態: REFERENCE — 2026-09-05再構成で現行の作業順/正本から分離。採用済み事項と未採用案が混在する原資料。本文中のACTIVE/現行Phase/次の作業は執筆時点の記録。現在の判断は `docs/ROADMAP.md`、実装状態は `docs/AUDIT.md`、資料の効力は `docs/DOCUMENT_REGISTER.md` を参照する。

# Tegaki 長時間描画性能劣化 — 第1回 調査・棚卸し指示書

目的は改修ではありません。

Tegakiで、描画を長時間続けるほどペン入力・ストローク確定などが重くなる現象について、現行 `main` の実装を調査し、原因を数値とコード経路の両方から特定してください。

このStageではproduction挙動を変更しないでください。
dirty rect化、History schema変更、pathsData削除、上限値変更などの本実装はまだ行いません。

Ownerは、この調査結果を外部AIへ戻して再検討した後、第2回指示書で実装方針を確定します。

## 0. 最初に読むもの

添付されている `GitHubURL.txt` を入口にして、少なくとも以下を確認してください。

- `AGENTS.md`
- `TEGAKI.md`
- `tegaki_work/PROGRESS.md`
- 現行Phase文書
- `tegaki_work/system/history.js`
- `tegaki_work/system/layer-system.js`
- `tegaki_work/system/raster-snapshot-memory.js`
- `tegaki_work/system/raster-bounds.js`
- `tegaki_work/system/drawing/brush-core.js`
- `tegaki_work/system/drawing/stroke-recorder.js`
- `tegaki_work/system/drawing/fill-tool.js`

そのほか必要なファイルは自分で追跡してください。

古いproposalや外部AI文書より、現行 `main` のコードを正本として扱ってください。

## 1. こちらで既に確認している重要事項

現行コードでは、古い資料にある「History 500件」という状態から既に変更されています。

`HistoryManager` は現在、

- `maxSize = 250`
- `maxMemoryBytes = 256 * 1024 * 1024`
- `_enforceLimits()`
- `getUsage()`
- `limitDiagnostics`

を持っています。

したがって、「500を300へ減らせば解決」という前提では調査しないでください。

また、通常Strokeでは現在、

- Stroke開始時にbefore Raster snapshot
- Stroke終了時にafter Raster snapshot
- snapshot内でRenderTexture全体のpixel抽出
- pixel buffer copy / unpremultiply
- `pathsData`全体の`structuredClone`
- `paths`全体の`structuredClone`
- before/afterに対するmemory estimate
- History record

が行われていることを確認しています。

これを仮説として、実測で検証してください。

## 2. 特に確認してほしい仮説

仮説A:
毎Strokeの全Raster GPU→CPU readbackが大きな固定コストになっている。

仮説B:
`layerData.pathsData`が制作開始以降増え続け、snapshotの`structuredClone(pathsData)`がStroke数に比例して重くなっている。

仮説C:
`estimateRasterHistoryPairBytes()`も全path / pointを走査するため、Stroke数増加に応じて追加の線形コストを発生させている。

仮説D:
History上限超過時の`_enforceLimits()`、`shift()`、巨大snapshotの参照解放とGCが、周期的なfreeze / spikeを発生させている。

仮説E:
`history:changed`ごとの`getUsage()`など、History stack全走査も小さいながら累積コストになっている。

仮説F:
History entryを削除してもLayer本体の`pathsData`は残るため、History削除だけでは長時間描画の性能が回復しない。

仮説G:
Historyの256MB制限は`byteSize`申告済みcommandしか完全には把握しておらず、History全体の実メモリ量を保証していない。

仮説H:
Pen以外にもFill / Lasso Fill / Transform / Selection / CAF / Motion等で大きなsnapshotやstructured cloneをHistory commandが保持しており、`byteSize`未申告または過小評価のcommandが存在する可能性がある。

これらを肯定することが目的ではありません。
反証できるものは反証してください。

## 3. `pathsData` / `paths` の全利用箇所を棚卸しする

これは重要です。

Repository全体で、

`pathsData`
`paths`

のread / write / clone / serialize / restore箇所を検索し、用途を分類してください。

特に通常Raster Strokeで追加される

`isBaked: true`

のpathについて、

「pixelへ焼き込み済みなのに、point列を永続保持する必要が本当にあるのか」

を調査してください。

削除や変更はまだしないでください。

以下を明確にしてください。

- Rendering authorityとして必要か
- Undo / Redoだけに必要か
- Project save / reloadに必要か
- Exportに必要か
- Selection / Transformに必要か
- thumbnailに必要か
- legacy compatibilityだけか
- 現在実質未使用か

`pathsData`を差分化・compact化・破棄できるかどうかを、第2回設計判断に使える形で報告してください。

## 4. History producerを全棚卸しする

`historyManager.push`
`historyManager.record`
`History.push`
`History.record`

等の全producerを検索してください。

各commandについて、

- command名 / meta.type
- 保持するデータ
- `byteSize`申告の有無
- structuredCloneの有無
- Raster snapshot保持の有無
- before / after二重保持の有無
- 大規模配列をclosureから参照していないか
- composite時にmemory accountingされているか

を表にしてください。

特に「256MB上限に計上されない大容量command」がないか確認してください。

## 5. 長時間描画を実測する

可能なら既存の

`window.TegakiStrokeInputProfiler`

を利用してください。

productionコードを改造する前に既存instrumentationを優先してください。

最低限、同じLayer・同程度のStrokeを繰り返し、

Stroke数の増加に対して以下がどう変化するか記録してください。

- beforeSnapshotMs
- afterSnapshotMs
- finalizeMs
- historyRecordMs
- History entries
- History estimated bytes
- History eviction回数
- evicted entries / bytes
- Layer pathCount
- Layer pointCount
- estimatedPathMetadataBytes
- JS heap（取得可能なBrowserのみ）
- LongTask
- Raster width / height

さらに現在instrumentationで個別計測されていない場合は、
一時的な調査用計測として

`estimateRasterHistoryPairBytes()`

そのものの所要時間も測ってください。

調査用変更を行った場合は、production仕様変更と混同しないこと。
最終的に調査用変更を残す必要がなければrevertしてください。

## 6. 原因分離テスト

以下の比較は特に重要です。

A:
長時間描画後、そのまま同じLayerへ描く。

B:
長時間描画後に `History.clear()` だけ行い、同じLayerへ描く。

C:
長時間描画後、新しい空Layerを作り、そこへ描く。

Bで重さがあまり改善せず、Cで改善するなら、
History stack件数そのものよりLayer側`pathsData`等の累積状態が主因である可能性が高くなります。

逆にHistory eviction発生時だけ大きなLongTaskが出るなら、削除・GC側の寄与も評価してください。

可能なら、canvasサイズを変えた比較も行い、
snapshot時間がpixel数におおむね比例するか確認してください。

## 7. dirty rect案の実現可能性だけ調査する

まだ実装しないでください。

PixiJS 8.19.0の`renderer.extract.pixels()`が`frame`指定による部分抽出を利用できるか、Tegakiの現在のRenderTexture / rasterBounds座標系で安全に使えるか確認してください。

さらに、部分Historyへ移行するとした場合に必要になるものを洗い出してください。

特に、

- Pen
- Eraser
- Airbrush
- Airbrush erase
- Blur
- Selectionあり
- Clippingあり
- Raster bounds拡張
- Fill
- Lasso fill

についてdirty rectの算出方法・必要padding・Undo/Redo上の問題を整理してください。

dirty rectのpixel patchだけでは現在の`rasterBounds`復元契約が変わる可能性があるため、
beforeBounds / afterBoundsをどう扱う必要があるかも報告してください。

## 8. 代替案も比較する

dirty rectだけに結論を固定しないでください。

少なくとも概念上、

- full snapshot維持＋pathsDataだけ差分化
- dirty rect pixel patch
- adjacent History snapshot共有
- Stroke前snapshotのcache / reuse
- baked pathsDataのcompact化
- History commandへのdispose/release hook
- History stackのbyte totalを増分管理
- Array shiftを避けるdeque / ring構造
- full-stateが必要な操作だけ従来snapshot

を比較してください。

ただしこのStageでは実装しません。

## 9. 最終報告

最後に、

「原因候補」ではなく、

確度を付けた原因ランキング

として報告してください。

各原因について

Confirmed
Highly likely
Possible
Rejected

のいずれかを付け、コード根拠と実測根拠を分けて記載してください。

さらに、

最小リスクで最も効果が大きい改修順

を提案してください。

例としては

Stage A: 計測・memory accountingの正確化
Stage B: pathsData肥大化対策
Stage C: Pen限定dirty rect History
Stage D: Eraser / Airbrush等へ展開

のような分割が考えられますが、これは仮案です。
調査結果から変更して構いません。

## 禁止事項

この調査Stageでは、Owner承認なしに以下を行わないでください。

- History schemaの本変更
- Project保存schema変更
- Undo / Redo semantics変更
- History件数やmemory上限だけを変更して「修正」とする
- pathsDataを削除する
- dirty rectをproductionへ接続する
- PixiJS version変更
- unrelated refactor
- 現行Phase 9pの契約変更

調査結果・計測結果・対象ファイル一覧・推奨改修順を報告したところで停止してください。

コード実装へ進まないでください。
