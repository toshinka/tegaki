# Phase 5k — 多枚数CAFのメモリ・VRAM安定化

更新日: 2026-06-27
状態: 完了

## 目的

多枚数アニメ作成中に、Frame / CAFが増えるほど重くなり、描画継続中にクラッシュする症状を計測で原因特定し、Tegakiの現行CAF構造を保ったままメインメモリ・GPU texture常駐量を制御する。

対象環境はリッチなデスクトップ構成を標準にする。オーナー環境はメインメモリ64GB、GPUはRTX4070無印。低性能PCへ過度に合わせず、アニメ制作では一定の負荷がある前提でよい。ただしブラウザアプリは64GB RAMと12GB級VRAMを無制限に使えるわけではないため、JS heap、TypedArray、WebGL texture、RenderTextureの常駐上限をアプリ側で持つ。

## 結論

Phase 5kでは、最初からIndexedDB退避、保存形式変更、WebGPU移行へ進まない。

実装結果として、CAF copy/paste時のクラッシュ主因はHistory内のpixel重複保持だった可能性が高い。Timeline Historyを保存serialize経路から切り離し、snapshot buffer参照共有、差分byte見積り、Texture cache LRU、History上限拡張を入れたことで、400x400 / 5 layer / 120F規模ではクラッシュ懸念は解消した。

未実装のcold frame退避は、Slice 1-4後もクラッシュまたは顕著な重化が残る場合だけの比較候補だったため、Phase 5kでは採用しない。次Phaseでは、Phase 5kで意図的に残したProject / Album / export時の大容量serialize負荷を扱う。

現在の一次容疑は次の重複常駐。

1. `DrawingSnapshotModel.pixels`
2. `ClipInstance.rasterSnapshot` 互換copy
3. CAF raster Historyのbefore / after snapshot
4. `AnimationTablePopup._snapshotTextureCache` 由来のPixi Texture
5. preview / thumbnail / temporary RenderTexture

まず「どこに何MB残っているか」をdebug時に可視化し、その後に明示的なTexture LRU、History予算、snapshot参照整理を入れる。RTX4070級でも、全FrameをGPU texture化して常駐させる設計にはしない。

追加観測:

- Animation Table表示後、複数CAF作成または描画のタイミングで、キャンバスが消える/どこかへ飛ぶように見える症状がある。
- Phase 5kではTexture cache破棄だけでなく、preview container、working Layer visibility、camera/canvas transform、表示中Spriteが参照中のTexture破棄を合わせて確認する。
- レイヤー1枚に数字を書いた程度のCAFをcopy/pasteし続けると、35frame前後で鈍化し、36frame前後でクラッシュする実測がある。複数Layerではより早く落ちる可能性がある。
- この症状は `TimelineModel.serialize()` がHistory用にも走り、`DrawingSnapshotModel.serialize()` の `Array.from(pixels)` で全snapshotをnumber配列化していたこと、さらにasset参照済みClipInstanceの互換 `rasterSnapshot` がpixel copyを重複保持していたことを優先容疑にする。
- Slice 3対策後、レイヤー2枚のCAF copy/pasteで240Fまで到達した。Historyはメモリ上限で強く剪定され、クラッシュ回避としては有効だが、Undo保持数が不足するためHistoryの実保持量をさらに削る。
- 参照共有と差分byte見積り後、レイヤー3枚のCAF copy/pasteで120Fまで到達し、全Undo後にRedoで同等地点へ戻れることを確認した。History表示は128/500程度まで残り、クラッシュ耐性とUndo保持の両方が改善した。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `開発用資料保管庫/Archive/phase5k.md`
5. `tegaki_work/PHASE4Z_BOUNDARY.md`
6. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
7. `開発用資料保管庫/proposals/05_長期研究_AI・WebGPU・物理.md`
8. `tegaki_work/system/animation/animation-data-model.js`
9. `tegaki_work/ui/animation-table-popup.js`
10. `tegaki_work/system/history.js`
11. `tegaki_work/system/drawing/thumbnail-system.js`
12. `tegaki_work/system/animation/timeline-frame-compositor.js`

## 設計方針

### リッチPC前提

- 400px / 800pxの軽量用途だけでなく、1200px以上、100CAF以上も現実的な確認対象にする。
- ただし内部2倍解像度化や全Frame GPU texture常駐はしない。
- 履歴予算は低性能向けの128MB固定ではなく、64GB RAM環境で十分に使える設定へ拡張可能にする。
- ユーザーが明示的に上限を上げられるようにし、自動初期値は保守的にする。

### ブラウザ制約

- `performance.memory` はChromium系で使えるが非標準・非推奨・不完全な指標なので、debug補助に限定する。
- JS heapだけではVRAM / GPU texture使用量は見えない。Texture数、snapshot面積、RenderTexture作成数をアプリ側で推定する。
- OffscreenCanvasやWorkerはmain thread負荷の退避には使えるが、正本pixel copyを減らすものではない。
- IndexedDBは大容量構造化データやBlobの退避先として使えるが、hot pathの毎stroke同期には使わない。
- PixiJS v8のrenderer `preference` 既定はWebGL。Phase 5kではWebGPUへ切り替えない。

## メモリ目安

RGBA snapshot 1枚は `width * height * 4` byte。

```text
400 x 400   = 0.61 MB / snapshot
800 x 800   = 2.44 MB / snapshot
1200 x 1200 = 5.49 MB / snapshot
1920 x 1920 = 14.06 MB / snapshot
2560 x 2560 = 25.00 MB / snapshot
```

100 CAFで1枚ずつ保持すると、1200pxで約549MB、1920pxで約1.4GB、2560pxで約2.5GB。ここへHistory before / after、`rasterSnapshot`互換copy、Texture化、thumbnailが重なる。クラッシュ原因は「Frame枚数そのもの」ではなく、同じ画素を何重に常駐させているかで見る。

## Slice 1 — 計測基盤

debug時だけ有効な `CAFMemoryProfiler` 相当の入口を追加する。通常時はUIもログも出さない。

実装入口:

- `tegaki_work/system/animation/caf-memory-profiler.js`
- `AnimationTablePopup.getCafMemoryProfile(options)`
- `AnimationTablePopup.logCafMemoryProfile(options)`

通常は `TEGAKI_CONFIG.debug === true` の時だけ集計する。固定入力やブラウザ検証で明示的に呼ぶ場合は `{ force: true }` を渡す。最新Chromium系では `{ includeUserAgentSpecificMemory: true }` により `performance.measureUserAgentSpecificMemory()` をfeature detectして補助値として取得し、使えない場合はerror情報と `performance.memory` の範囲に留める。

集計するもの:

- `TimelineModel.drawingSnapshots.length`
- snapshot pixel総byte
- blank snapshot総byte
- ClipAsset / internal Layerから参照中のsnapshot数
- `ClipInstance.rasterSnapshot` 互換copyの推定byte
- History command件数、`byteSize`合計、CAF raster履歴の内訳
- `AnimationTablePopup` snapshot texture cacheの件数、推定pixel byte、作成回数、hit/miss、eviction数
- temporary RenderTexture作成箇所の推定byte
- `performance.memory` が使える場合のJS heap値

固定入力:

- Canvas 800 / 1200 / 1920
- CAF 10 / 30 / 60 / 100 / 180
- 1 CAF 1 raster Layer
- 1 CAF 3 internal raster Layer
- Historyなし / 20 strokes / 100 strokes
- Animation Table閉状態 / 開状態 / preview ON / onion ON

Slice 1の成果物は「クラッシュ前にどの値が一方向に増えるか」の表。対策実装へ進む前に、最低1回は現行の増え方を記録する。

## Slice 2 — Texture cacheを明示LRU化

現行の `_snapshotTextureCache` はWeakMapで列挙・破棄できないため、Phase 5kでは明示cacheへ置き換える。

実装状態:

- `_snapshotTextureCache` を `Map<snapshotKey, entry>` へ置き換えた。
- `TEGAKI_CONFIG.animation.snapshotTextureCache.maxEntries / maxBytes` を追加し、初期値を96件 / 512MBにした。
- entryは `{ texture, width, height, byteSize, lastUsed, sourceUpdatedAt }` を持ち、snapshot更新時はstaleとして破棄する。
- current frame、選択CAF、前後1frameのsnapshotをeviction優先度から保護する。ただし全entryが保護対象の場合は上限維持を優先する。
- Animation Tableを閉じた時、project load、ClipAsset削除、snapshot差し替え等の既存invalidation境界でTextureを破棄する。
- clipping合成後の一時snapshotはsource snapshot群のid/updatedAtから安定keyを作り、mask更新時に別entryとして扱う。
- 表示中Preview Spriteが参照中のTextureは即破棄せず、preview containerから外れた後に遅延破棄する。

方針:

- keyはsnapshot id。
- valueは `{ texture, width, height, byteSize, lastUsed, sourceUpdatedAt }`。
- 上限は件数と推定byteの両方。
- 破棄時は `texture.destroy(true)` 相当でGPU textureを解放する。ただしPixi API互換を確認し、共有textureを巻き込まない。
- currentFrame、表示中Frame、選択CAF、近傍Frameを優先して保持する。
- Animation Tableを閉じた時、project load時、ClipAsset削除時、snapshot差し替え時にevictする。

受け入れ:

- preview / thumbnail cache eviction後も再表示できる。
- console errorなし。
- Texture cache推定byteが設定上限付近で頭打ちになる。

## Slice 3 — snapshot重複の整理

保存形式を変えず、まずruntime重複を減らす。

実装状態:

- Project保存用の `TimelineModel.serialize()` は変更しない。
- Animation TableのTimeline History取得だけ専用runtime cloneへ変更し、`DrawingSnapshotModel.pixels` を `Array.from()` せず `Uint8ClampedArray` cloneで保持する。
- Timeline HistoryのDrawingSnapshot pixelsは既存snapshot bufferを参照共有する。CAF描画は既存snapshotを破壊的更新せず新snapshot追加で進むため、Project保存形式を変えずにHistoryの実保持量を下げる。
- Timeline History commandへ推定 `byteSize` を渡し、HistoryManagerの `maxMemoryBytes` で古い履歴が落ちるようにする。
- Timeline History commandの推定 `byteSize` はbefore / after全状態合算ではなく、追加・削除・pixel参照変更のあったsnapshot差分とassetなしrasterSnapshot fallback分だけを見る。
- Timeline History commandのmetaへbefore / after stateのsnapshot数・pixel参照byte・合計snapshot参照数を記録し、CAF memory profilerでHistory内の参照増加を追えるようにした。
- asset参照済みClipInstanceの互換 `rasterSnapshot` は、runtimeではpixelを持たない `{ drawingSnapshotId, width, height, pixels: null }` 形式へ寄せる。assetがない旧fallbackだけpixelを保持する。

確認・修正候補:

- 新規CAF作成時の `ClipInstance.rasterSnapshot` 互換copyが、`ClipAsset.drawingSnapshotId` / internal Layer snapshotと二重化していないか。
- `TimelineModel.getSnapshotForCel()` が参照できる場合は、runtimeではsnapshot id正本を優先する。
- `DrawingSnapshotModel.serialize()` の `Array.from(pixels)` は保存時に巨大配列化するため、Phase 5kでは計測だけ行い、保存高速化・Blob保存は別slice候補に分離する。
- `_collectUnreferencedDrawingSnapshots()` はHistory復元に必要なsnapshotを壊さない範囲で、参照されない正本だけ回収する。

受け入れ:

- project / Album保存復元、PNG / APNG / GIF export、Undo / Redoが維持される。
- 互換fieldを削除しない。削減する場合はruntime上の重複copyに限定する。

## Slice 4 — History予算のリッチPC対応

現行Historyは`byteSize`上限を持つが、自動初期値は64GB環境に対して控えめ。

実装状態:

- CAF raster履歴が必ず正確な`byteSize`を申告することを確認する。
- 400x400、レイヤー5枚、単純な数字、120FのCAF copy/pasteでHistory使用量が約374MB / 512MB、履歴135 / 500程度になる実測がある。
- SettingsのHistory上限選択肢を128MB / 256MB / 512MB / 1GB / 2GB / 4GB / 8GB / 12GB / 16GBへ拡張した。
- 自動調整は`navigator.deviceMemory`とChromium系の`performance.memory.jsHeapSizeLimit`を補助的に見て、最大4GBまで上げる。
- 手動選択では16GBまで許可する。これは64GB RAM級のリッチPC向けで、ユーザーが明示的に選ぶ前提にする。
- 既定値は安全側に置きつつ、CAF作画量が増える環境では自動でも512MB固定に留めない。
- SettingsのHistory使用量表示は80%以上で「高め」、95%以上で「上限付近」を表示し、高上限設定時も使用率を把握しやすくする。
- 古い履歴破棄時にsnapshot / texture cacheへeviction通知できるか確認する。

受け入れ:

- Undo / Redo順を壊さず、上限超過時に古い履歴から破棄される。
- History使用量表示と実byte集計が一致する。

## Slice 5 — cold frame退避の比較

Slice 1-4後も多枚数でクラッシュまたは顕著な重化が残る場合だけ実施する。

比較候補:

- IndexedDB / Blob: 非アクティブCAFのpixel退避。描画中CAFには使わない。
- Worker + OffscreenCanvas: thumbnail生成、snapshot encode、export前処理をmain thread外へ逃がす。
- PNG / WebP / raw RGBA Blob: 速度、容量、復元コストを固定入力で比較する。

このsliceで本採用まで進める必要はない。採用判断に足る測定値を出すことを目的にする。

## 対象外

- WebGPU有効化。
- PixiJS更新。
- WebGL2 Mesh / SDF / MSDF復活。
- 保存形式の全面変更。
- LayerSystemとTimelineModelの統合。
- CAF internal Layerへの通常Layer History接続。
- 無限キャンバス / tile方式の本格導入。
- 低性能PC向けの過度な縮小設計。

## 受け入れ条件

- 固定入力で、CAF枚数・Canvasサイズ・History件数ごとの概算MBを確認できる。
- 現行のクラッシュまたは重化が、snapshot bytes、History bytes、Texture cache、RenderTexture、JS heapのどれと相関するか説明できる。
- Texture cacheが明示上限でevictされ、Animation Table開閉やFrame移動で一方向に増え続けない。
- 100 CAF / 1200px以上を最低確認対象にする。可能なら180 CAFも確認する。
- cache eviction後も、現在Frame表示、CAF preview、Undo / Redo、project / Album保存復元、export結果が壊れない。
- debug logは通常時に出ない。
- `dist/` とVite cache差分を残さない。

## 検証

```powershell
node --check tegaki_work/system/animation/caf-memory-profiler.js
node --check tegaki_work/system/animation/animation-data-model.js
node --check tegaki_work/ui/animation-table-popup.js
node --check tegaki_work/system/history.js
Set-Location tegaki_work
npm.cmd run build
```

Browser:

1. 固定入力でCAF 10 / 30 / 60 / 100 / 180を作成または疑似生成。
2. 各CAFへ短いstrokeを追加し、History使用量、snapshot総byte、Texture cache byteを確認。
3. Animation Table閉 / 開 / preview ON / onion ONで比較する。
4. Frame移動、CAF選択、Layer Panel同期。
5. Undo / Redo、Clip削除、CAF削除、project / Album保存復元。
6. preview / thumbnail cache eviction後の再表示。
7. Animation Table表示後に複数CAF作成・描画を行い、キャンバスが消える/飛ぶ症状が再現するか確認する。
8. console新規errorなし。

build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
