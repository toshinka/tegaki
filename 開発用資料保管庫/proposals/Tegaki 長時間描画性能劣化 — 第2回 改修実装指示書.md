> 状態: REFERENCE — 2026-09-05再構成で現行の作業順/正本から分離。採用済み事項と未採用案が混在する原資料。本文中のACTIVE/現行Phase/次の作業は執筆時点の記録。現在の判断は `docs/ROADMAP.md`、実装状態は `docs/AUDIT.md`、資料の効力は `docs/DOCUMENT_REGISTER.md` を参照する。

# Tegaki 長時間描画性能劣化 — 第2回 改修実装指示書

対象: 現行 `main`  
実装担当: GEMINI  
根拠資料: `Tegaki_長時間描画性能劣化_第1回_調査・棚卸し報告書.md`

## 0. 今回の目的

長時間描画時に、通常Raster LayerへのPen / Eraser入力が次第に重くなる問題を修正する。

第1回調査で、以下はConfirmedとなった。

1. 現行Brushが`layerData.pathsData`へ全Stroke点列を累積している。
2. History snapshotごとにその全点列を`structuredClone()`している。
3. このためStroke数に比例してsnapshot生成時間が増加し、長時間では実質O(N²)的に悪化する。
4. 1200×1200ではfull Raster before/afterだけで1 Historyあたり約11.5MBとなり、256MB制限に約22件で到達する。
5. 以降はほぼ毎Strokeで巨大History entryの生成・破棄が発生する。
6. `History.clear()`だけでは重さは改善せず、新規空Layerでは即座に改善する。
7. 通常Brushの`isBaked: true`点列は、現行Raster描画・Undo/Redo・Project保存・Exportの正本ではない。

今回の改修では、

- Stage A: 不要な点列累積・cloneを通常Brushから除去
- Stage B: Pen / Eraser Historyをdirty rect patch方式へ限定移行
- Stage C: 描画由来thumbnail readbackをcoalesce

までをproductionへ実装する。

安全性を優先し、各Stageを独立Gateとして進めること。

---

# 1. 最重要原則

以下は変更してはならない。

- Project保存schema
- CAF保存schema
- Motion / RIG / WARP schema
- 現行Phase 9pの契約
- 1 gesture = 1 History
- Undo / Redoの見た目とRaster結果
- Pen / Eraserのリアルタイム描画方式
- Selection semantics
- Clipping semantics
- Raster bounds semantics
- Fill / Lasso FillのHistory方式
- Transform History方式
- PixiJS version
- History上限値を変更するだけの対症療法
- SSD / disk swap導入
- unrelated refactor

`maxSize=250`、`maxMemoryBytes=256MB`は今回変更しない。

今回の目的は「制限値を緩めること」ではなく、通常Stroke 1件のHistory自体を軽量化することである。

---

# 2. 正本確認

実装開始前に必ず以下を読むこと。

- `AGENTS.md`
- `TEGAKI.md`
- `tegaki_work/PROGRESS.md`
- 現行Phase 9p文書
- `system/history.js`
- `system/layer-system.js`
- `system/raster-snapshot-memory.js`
- `system/raster-bounds.js`
- `system/drawing/brush-core.js`
- `system/drawing/stroke-renderer.js`
- `system/drawing/stroke-recorder.js`
- `system/drawing/fill-tool.js`
- Pixel Selection関連
- Thumbnail生成関連

行番号は第1回報告書作成時点のものなので、現在コードを正本とすること。

---

# 3. Gate 0 — Regression fixtureを先に作る

production変更前に、今回守る契約を固定するverifierを追加する。

少なくとも以下を検証すること。

## 3.1 Modern Raster Stroke

通常Pen Strokeを複数回行っても、

- Raster pixelsは正しい
- Undoでbefore pixelsへ戻る
- Redoでafter pixelsへ戻る
- Historyは1 Stroke 1件
- 新規`pathsData`がStrokeごとに増殖しない

こと。

## 3.2 Legacy path preservation

テスト用Layerへ意図的に

- legacy `pathsData`
- legacy `paths`

を入れた状態から通常Pen Strokeを行う。

その後、

- Stroke
- Undo
- Redo

を行っても既存legacy collectionが勝手に空配列へ置換されないこと。

これは重要。

「pathsDataは不要」という調査結果を理由に、generic snapshot / restore全体から無条件削除してはならない。

## 3.3 Pixel parity

Undo / Redo前後でRaster pixel bufferを比較し、期待するbefore / afterとbyte単位で一致すること。

目視だけで合格にしない。

---

# 4. Stage A — Modern Brushから不要なpath蓄積とcloneを除去

最優先で実装する。

## 4.1 `brush-core.js`

現在の通常Raster Stroke終了時に行っている、

`layerData.pathsData.push(pathData)`

相当のmodern baked Stroke点列の永続蓄積を停止する。

現行BrushはRenderTextureへすでにRaster bakeしており、`isBaked: true`点列を描画正本として使用していない。

ただし、

- `layer:path-added` event
- thumbnail更新通知
- Stroke完了通知

など別の契約まで消してはならない。

「pathDataを保存しなくなること」と「Stroke完了eventを出さなくなること」は別問題である。

## 4.2 generic snapshotを全面変更しない

`createLayerRasterSnapshot()`を単純に

`pathsData: []`
`paths: []`

へ変更してはならない。

Fill / Transform / legacy compatibility等の既存callerを巻き込むためである。

代わりにoptionsを追加する。

概念例:

`createLayerRasterSnapshot(layer, { includePathCollections: false })`

defaultは現行互換の`true`とする。

同様にrestore側も、

`restoreLayerRasterSnapshot(snapshot, { restorePathCollections: false })`

相当の明示的optionを導入する。

defaultは必ず現行互換。

通常Brush Historyだけがpixel-only snapshotを使用する。

## 4.3 absent fieldを空配列扱いしない

特に注意すること。

snapshotに`pathsData`が存在しない場合、

restore時に

`layerData.pathsData = []`

としてはいけない。

`restorePathCollections:false`の場合は、

- `layerData.pathsData`
- `layerData.paths`

へ一切触れない。

`normalizeRasterSnapshot()`等がmissing collectionを自動的に空配列へ正規化している場合も、この契約を壊さないように処理する。

## 4.4 Selection snapshot

現在Brush開始時snapshotが、

- History用
- Selection制限用

を兼用している箇所を確認する。

Selection側がpixels / boundsしか利用していないことをコード上で再確認できた場合はpixel-only snapshotを共有してよい。

もしpath collectionsへ依存する箇所が残っている場合は無理に共有せず、正しさを優先する。

## 4.5 History diagnostics

現在`pathCount` / `pointCount`等をHistory metaへ記録している場合、そのconsumerを検索する。

consumerがdebug用途だけなら、

- `strokePointCount`
- `retainedPathPointCount`

等へ意味を明確化してよい。

ただし、診断数字を維持するためだけにStroke全点列をHistoryへ保持してはならない。

---

# 5. Stage A Gate

ここで一度必ず検証する。

最低200〜400 Stroke相当のfixture / benchmarkで、

- `layerData.pathsData`が新規Stroke数に比例して増えない
- snapshot時のpath clone時間がStroke数に比例して増えない
- 1 Stroke目と400 Stroke目でpath metadata処理時間が概ね一定
- Undo / Redo pixel parity
- Project save / reload
- Fill
- Transform
- Selection
- legacy path preservation
- 全既存verifier
- production build

を確認する。

Stage AでRegressionが出た場合、Stage Bへ進まない。

---

# 6. Stage B — Pen / Eraser限定 dirty rect History

ここがHistoryメモリ問題の本丸。

ただし、第1実装では安全性のため

「Stroke開始時full before snapshot自体を完全廃止」

までは行わない。

## 6.1 基本方式

Pen / Eraser Stroke開始時:

1. 現行同様、変更前Rasterを取得する。
2. ただしpixel-onlyとしpath collectionsはcloneしない。
3. このfull before snapshotはHistoryへ永久保持するものではなく、一時baselineとする。

Stroke終了時:

1. `strokeData.points`からStroke影響範囲を計算する。
2. dirty rectを確定する。
3. full before baselineからdirty rect部分だけをcropして`beforePatch`を作る。
4. 現在のRenderTextureからdirty rect部分だけを`extract.pixels({ frame })`して`afterPatch`を作る。
5. History commandには`beforePatch` / `afterPatch`だけを保持する。
6. full before baselineへの参照をHistory closureへ残さない。

これにより、

- pointerdown full readbackは一旦残る
- pointerup full readbackは消える
- History retained memoryはdirty rectだけになる

という安全な第1段階とする。

---

# 7. dirty rect計算

対象はまず

- Pen
- Eraser

だけ。

Airbrush / Blur / Fill / Lasso Fillは今回のdirty rect production対象外とする。

## 7.1 座標

Stroke点列と、

`layerData.rasterBounds`

の座標系を混同しないこと。

dirty rectはまずProject / Layer local座標で求め、その後Raster Texture local座標へ変換して`frame`を渡す。

概念:

`localRasterX = projectX - rasterBounds.x`
`localRasterY = projectY - rasterBounds.y`

必ずtexture boundsへclampする。

## 7.2 Padding

固定値を報告書から盲目的にコピーしない。

現行`stroke-renderer.js`の実際のPen / Eraser width計算、

- pressure
- cap
- join
- interpolation
- anti-aliasing
- opacity isolation

を確認し、実際の最大描画半径を包含するpaddingを求める。

性能よりpixel correctnessを優先する。

不明な場合は少し広い矩形を採用する。

dirty rectが多少大きくても問題ない。
1pxでも描画が欠ける方が問題である。

---

# 8. Raster bounds変更時はfull fallback

重要。

現行BrushではStroke開始時にRaster boundsをProject frameへ拡張することがある。

このため、

`beforeBounds !== afterBounds`

となるStrokeが存在する。

このケースをdirty rect第1版で無理に扱わない。

以下の場合は既存full pixel snapshot Historyへfallbackすること。

- before / after rasterBoundsが一致しない
- patch boundsが不正
- frame extract失敗
- RenderTexture寸法が期待と一致しない
- unsupported mode
- correctnessを保証できない特殊ケース

fallbackもpixel-only snapshotを使える場合は使い、不要なpaths cloneは復活させない。

通常Strokeの大半では、一度Raster frameが安定すればpatch modeへ入るはずである。

---

# 9. Patch snapshot構造

第二のProject保存schemaを作るのではない。

これはruntime History command内部だけの形式とする。

概念例:

```js
{
    layerId,
    rect: { x, y, width, height }, // Project座標で統一してもよい
    rasterBounds,
    pixels
}
```

History commandには、

- beforePatch
- afterPatch
- beforeBounds
- afterBounds
- mode

程度を保持する。

Project serializationへ混ぜない。

---

# 10. beforePatch生成

beforeはすでにStroke開始時full baselineをCPU側に持っている。

GPUへ再度問い合わせない。

full baselineのpixel bufferから、dirty rectに対応する行をrow copyしてbeforePatchを作る。

このcrop処理はpure helper化し、fixtureで検証すること。

例えば新規pure moduleを作るなら責務は、

- rect normalize
- clamp
- coordinate conversion
- pixel crop
- byte size算出

程度へ限定する。

Pixi renderer依存処理までpure helperへ混ぜない。

---

# 11. afterPatch生成

afterはPixiJS v8.19.0の

`renderer.extract.pixels({ target, frame })`

を使用する。

全RenderTextureのpixelを読み出してからJavaScript側でcropする方式にしてはいけない。

それではGPU readback削減にならない。

`frame`が本当にdirty rect相当だけを返しているか、

- width
- height
- `pixels.byteLength`

をfixture / Browserで確認する。

---

# 12. Patch Undo / Redo

最初から高度なGPU部分書き戻しを実装しなくてよい。

透明pixelを含む正確なpartial overwriteはblendの罠があるため、第1版ではcorrectness優先とする。

推奨する安全経路:

Undo / Redo時だけ、

1. 現在Layerのpixel-only full snapshotを取得
2. CPU上でpatch pixelsを対象rectへrow copy
3. 既存のfull Raster restore経路へ渡す
4. `restorePathCollections:false`

とする。

Undo / Redo時にはfull readbackが1回発生してよい。

今回最適化したいのは「描いている最中の毎Stroke」であり、Undo/Redoの極限最適化ではない。

まずpixel exactを保証する。

将来的に安全なdirect GPU patch restoreを別Gateで検討できる。

---

# 13. Patch Historyの重要なメモリ条件

patch modeが成立したStrokeでは、History commandのclosureから、

- full before snapshot
- full after snapshot

を参照してはならない。

ローカル変数として一時生成していても、commandの`do` / `undo` closureから参照されれば256MB問題は解決しない。

DevTools / diagnosticsでHistory command 1件の`byteSize`が、

`dirtyWidth * dirtyHeight * 4 * 2`

を中心とする値になっていることを確認する。

---

# 14. History byteSize

patch Historyではfull snapshot用の

`estimateRasterHistoryPairBytes()`

をそのまま使わない。

patch retained memoryだけを申告する。

最低限、

- `beforePatch.pixels.byteLength`
- `afterPatch.pixels.byteLength`
- 小さな固定metadata estimate

を合計する。

これにより256MB limitが実態に近く働くようにする。

History制限ロジックそのものは今回変更しない。

---

# 15. Stage B Gate

以下をBrowser / verifierで確認する。

## 通常Pen

- Stroke
- Undo
- Redo
- 連続Undo
- 連続Redo
- Undo後に新StrokeしてRedo branch破棄
- Dot
- Short stroke
- Long stroke
- 筆圧あり
- 筆圧なし
- opacity < 1
- clippingあり
- selectionあり

## Eraser

同様に確認。

透明pixelへ戻すUndoもpixel exactで確認する。

## Bounds

- 初回Raster bounds拡張Stroke → full fallback
- bounds安定後Stroke → patch mode
- canvas端
- rasterBoundsが負座標を持つケース

を確認。

## 他機能

以下は従来full Historyのまま壊れていないこと。

- Fill
- Eraser Fill
- Lasso Fill
- Blur
- Airbrush
- Transform
- Selection Transform
- Layer merge
- Image import
- CAF

---

# 16. 性能Acceptance

1200×1200程度のRaster Layerへ典型的なPen Strokeを多数描く。

絶対ms値はPC / GPUに依存するため、固定時間だけで合否を決めない。

次を合格条件とする。

## A. O(N)悪化の消滅

1 Stroke目と400 Stroke目で、

pathsData clone由来の処理時間が増加しないこと。

400 Stroke目だから47ms増える、という旧挙動が消えていること。

## B. History retained bytes

典型的な小〜中StrokeのHistory byteSizeが、

canvas全面サイズではなくdirty rect面積に比例すること。

## C. History保持件数

典型的な小〜中Strokeを続けた際、

1200×1200だから22件前後で必ず256MBへ到達する旧挙動が消えていること。

通常Stroke中心なら200件以上保持できる状態を目標とする。

最終的には`maxSize=250`側へ先に当たることが望ましい。

長大Strokeなどdirty rectが大きい場合に件数が自然に減るのは正常。

## D. GC

23 Stroke目以降に毎Stroke巨大full Historyをevictする旧挙動がなくなっていること。

---

# 17. Stage C — 描画Thumbnail readbackのcoalesce

Stage A / Bが完全に通った後だけ行う。

現在のthumbnail更新経路を再調査し、

通常描画Stroke完了直後に毎回full `extract.pixels()`しているなら、

「描画由来のthumbnail更新」だけを短時間coalesceする。

## 要件

- 連続描画中に毎Stroke full readbackしない
- 最後のStrokeから約100〜150ms程度静止したら更新
- 同じLayerへの連続requestは一つへまとめる
- Layer切替など必要な場面では最終thumbnailが欠落しない
- Import / Transform等の既存immediate更新を無条件で遅延させない
- sidebar / Layer Panel表示結果を変えない

特にBrush側が現在

`immediate: true`

を出している場合、その意味とconsumerを確認してから限定変更する。

globalなthumbnail policyを雑に変えない。

---

# 18. 今回やらない最適化

以下は今回のproduction対象外。

## after→next before snapshot cache

前Stroke afterを次Stroke beforeとして再利用する案は有望だが、

- Layer切替
- Undo / Redo
- Fill
- Transform
- Selection
- Import
- 外部mutation
- CAF handoff

などcache invalidation設計が必要になる。

Stage A/B/Cの結果を計測してから別Gateとする。

## direct GPU patch restore

Undo/Redo高速化のためのpartial GPU uploadも別Gate。

## History deque / ring

現状の`shift()`配列操作自体は主因ではないため対象外。

## layer-delete disposal

`layer-delete`の未申告RenderTexture保持は別の実在問題だが、長時間Pen性能問題と混ぜない。

別のMemory Accounting / Resource Disposal Gateとして後続提案に分離する。

---

# 19. Report上の補足修正

第1回報告書では、

「`getUsage()`は外部から明示的に呼ばれない限り走らない」

という記述があるが、現行`history.js`では`_notifyHistoryChanged()`内から`getUsage()`を呼んでいる。

したがって厳密には毎History changed時にもusage集計がある。

ただし現在stack件数が小さく、今回確認された主要遅延と比較すると優先度は低い。

今回これを主目的として変更しないこと。

---

# 20. 必須Verifier

今回用の新規verifierを追加する。

少なくとも以下を固定する。

1. Modern baked Strokeが`pathsData`を増殖させない
2. pixel-only snapshotがlegacy path collectionを破壊しない
3. dirty rect算出
4. Project→Raster local座標変換
5. snapshot crop
6. patch byte length
7. Pen patch Undo / Redo pixel parity
8. Eraser patch Undo / Redo pixel parity
9. rasterBounds変更時full fallback
10. unsupported mode full fallback
11. 1 gesture 1 History
12. patch History commandがfull before snapshotを保持しない
13. typical patch `byteSize`がfull canvas pairより十分小さい
14. legacy generic snapshot callerの従来挙動維持

既存全verifierも通す。

---

# 21. Browser確認

可能なBrowser環境で最低限、

- 通常Penで実際に絵を描く
- 200回以上のStroke
- Undo / Redo
- Eraser
- Selection付きPen
- Clipping付きPen
- opacity Pen
- Layer切替
- Fill
- Transform
- save / reload
- console error 0

を確認する。

`window.TegakiStrokeInputProfiler`やHistory diagnosticsが利用できるなら再利用する。

改修前後の、

- History entries
- History bytes
- eviction count
- beforeSnapshotMs
- afterSnapshot / afterPatch時間
- historyRecordMs
- finalizeMs
- LongTask

を比較する。

---

# 22. 完了報告

最後に以下を報告する。

## Changed files

変更した全ファイルと責務。

## Stage A

- pathsData増殖がどう消えたか
- legacy互換をどう守ったか
- 400 Stroke時の比較

## Stage B

- dirty rectの計算方法
- padding根拠
- full fallback条件
- patch History構造
- Undo / Redo方式
- History 1件あたりの実測byteSize
- 1200×1200での保持件数

## Stage C

- thumbnailの旧readback頻度
- 新coalesce方式
- 描画burstで何回readbackされたか

## Tests

- 新規verifier
- 全既存verifier
- production build
- Browser確認
- console

## Remaining risks

特に、

- Airbrush / Blur dirty rect
- before baseline cache
- direct patch restore
- layer-delete resource disposal

を後続候補として明記する。

---

# 23. Stop条件

以下の場合は無理に修正を続行しない。

- pixel parityを保証できない
- legacy pathsが破壊される
- Selection / Clipping semanticsが変わる
- rasterBounds変更Strokeを安全にpatch化できない
- Project save schema変更が必要になる
- Phase 9pへ影響する

その場合はfull fallbackを選ぶ。

「すべてdirty rect化すること」より、

「安全な通常Pen / Eraserだけ確実に軽量化すること」

を優先する。

Stage A → Stage B → Stage Cの順にGateを通し、最終報告を提出したところで停止すること。
