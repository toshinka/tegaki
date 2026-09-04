# Tegaki ペン入力レスポンス追加強化 — 第4回 改修実装指示書

更新日: 2026-09-04  
対象: 現行ローカル `tegaki_work`  
実装担当: GEMINI  
根拠資料: `Tegaki_ペン入力レスポンス追加強化_第3回_調査・棚卸し報告書.md`  
位置づけ: Production改修  
Owner実機Acceptance前のGit push: 禁止

---

# 0. 今回の目的

長時間描画性能改修後、Owner実描画では通常Penの追従性は現時点で良好である。

第3回調査では、その状態を壊さずに追加改善できる内部ボトルネックとして以下が確認された。

1. Pen / EraserのStroke開始時に行うfull raster snapshotが同期GPU→CPU readbackとなっている。
   - 1200×1200: 約9.24ms
   - 2000×2000: 約29.12ms

2. Penはcoalesced batch時だけGPU batchが効き、単発`pointermove`では補間点ごとにrenderされる。

3. EraserにはPen相当のbatch機構がなく、補間点ごとに`renderer.render()`が走る。

4. 固定`1 local px`補間により、ズームアウト時に補間点数が画面移動量以上に爆発する。
   - 10% zoom時、150 screen px移動で約1500点

5. Pen / Eraser hot pathでは多数の短命Pixi `Graphics`生成・破棄もCPU / GC負荷になる。

今回の目的は、外部Web APIを追加することではない。

**既存canonical stroke / History / Brush semanticsを変えず、内部パイプラインの同期readback・render call・短命object生成を減らすこと。**

---

# 1. 今回の設計判断

## 1.1 Production対象

今回Production実装候補とする。

### Stage A — Pen / Eraser pointerdown CPU readback除去
GPU側baseline RenderTextureを使用する。

### Stage B — Pen / Eraser realtime line batch統一
単発move / coalesced moveの両方でbatchする。
単にGPU render回数を減らすだけでなく、`Graphics`生成数もO(補間点数)からO(batch数)へ減らす。

### Stage C — 画面ピクセル基準の適応的補間
Stage B後の再計測で依然として有意な負荷が残る場合だけ実装する。

### Stage D — 半透明Pen scratch RenderTexture再利用
Stage A〜C後の実測でtexture allocation / destructionが有意な負荷と確認された場合だけ実装する。

---

## 1.2 今回Productionへ入れない

以下は今回採用しない。

- `getPredictedEvents()` のcanonical stroke接続
- display-only predicted tail
- `pointerrawupdate`
- `desynchronized: true`
- Delegated Ink / `navigator.ink`
- LazyBrush数学・既定値変更
- Pixi Ticker / autoStart変更
- idle render最適化
- UI/status pointermove整理
- Perfect-Freehand GPU化
- WebGPU化
- History limit変更
- PixiJS更新

理由:
第3回調査で、現状の主要ボトルネックは内部pipeline側に確認されている。
外部APIは今回のリスクに対して優先度が低い。

---

# 2. 最重要契約

以下は変更禁止。

- Project save schema
- CAF save schema
- Motion / RIG / WARP schema
- 1 gesture = 1 History
- Pen / Eraser Undo / Redo pixel correctness
- dirty rect History command semantics
- Historyの記録Layer ID契約
- Selection semantics
- Clipping semantics
- Brush pressure semantics
- Brush opacity semantics
- LazyBrush semantics
- Pen / Eraser stroke appearance
- Shift+drag直線
- Raster bounds semantics
- QTP
- Animation Table
- Layer Panel UI
- tool switching
- thumbnail policy
- Phase 9p以降のUI契約

今回の最適化によって描画結果が変わる場合は性能よりcorrectnessを優先する。

---

# 3. Scope Freeze

Productionで変更を許可する基本ファイル:

- `system/drawing/brush-core.js`
- `system/drawing/stroke-renderer.js`

Stage Cでpure helperが必要な場合のみ新規:

- `system/drawing/realtime-stroke-sampling.js`

Verifier:

- `build/verify-pen-responsiveness-enhancements.mjs`

必要な場合のみ既存:

- `build/verify-long-drawing-degradation-fix.mjs`

原則変更禁止:

- `drawing-engine.js`
- `pointer-handler.js`
- `layer-system.js`
- `history.js`
- `thumbnail-system.js`
- UI / CSS
- Project / CAF / Motion系

上記禁止ファイルの変更が本当に必要になった場合は、実装を続けず理由を報告してSTOPする。

---

# 4. Gate 0 — Baseline固定

Production変更前に現行local workspaceでbaselineを取得する。

少なくとも:

## 4.1 pointerdown

400×400 / 1200×1200 / 2000×2000で、

- `startStroke` total
- `createLayerRasterSnapshot`
- extract
- pixel copy
- unpremultiply

を計測。

## 4.2 realtime Pen

以下を記録:

- actual pointer samples
- coalesced samples
- generated interpolation points
- realtime line segments
- Pixi `Graphics` created
- `renderer.render()` count
- batch flush count
- updateStroke / updateStrokeBatch time

## 4.3 Eraser

Penと同じ項目。

## 4.4 Zoom

- 100%
- 50%
- 25%
- 10%

高速150 screen px相当移動を含める。

Baseline結果は最終報告でAfterと比較する。

---

# 5. Gate 0 Verifier

新規:

`build/verify-pen-responsiveness-enhancements.mjs`

を作成する。

Production変更前から書けるpure contractを先に固定する。

最低限:

1. batch lifecycle
2. batch nested handling
3. Pen / Eraser mode isolation
4. target layer固定
5. target RenderTexture固定
6. final endpoint保持
7. pressure保持
8. cancel cleanup
9. mode switch中の不正flush防止
10. scratch resource cleanup contract

Browser依存pixel parityは後段Gateで追加する。

---

# 6. Stage A — pointerdown full CPU snapshot除去

今回の最優先。

## 6.1 禁止される誤実装

以下は禁止。

「pointerdownでは何も保存せず、
pointerup後に現在RasterからbeforePatchを作る」

これでは変更前pixelを失っているためUndoが成立しない。

また、

「Stroke全体を一度別アルゴリズムで再計算してbeforeを推測する」

ことも禁止。

---

# 7. Stage A 正式方式 — GPU baseline scratch

通常Pen / Eraser、Selectionなし、Raster bounds安定時だけ使用する。

Stroke開始時:

1. 現在の対象Layer / layerId / rasterBounds / RenderTexture寸法を固定する。
2. History用full CPU `createLayerRasterSnapshot()`を呼ばない。
3. 同寸法のHistory baseline scratch RenderTextureを用意する。
4. 現在Layer RenderTextureをbaseline scratchへGPU→GPU copyする。
5. copyは`clear:true`でscratch全体を上書きする。
6. その後に通常Stroke realtime bakeを開始する。

GPU command順序により、

baseline copy
→ Stroke描画

の順序が保証される構造にする。

CPUへpixel readbackしてはならない。

---

# 8. History baseline scratchの再利用

baseline scratch RenderTextureを毎Strokeでnew/destroyしない。

BrushCore内部に最大1個のHistory baseline scratchを保持してよい。

条件:

- width一致
- height一致
- resolution一致

なら再利用。

一致しない場合:

1. 旧scratchをdestroy
2. 新規作成
3. clear + copy

とする。

ScratchはHistory command closureへ保持しない。

Historyへ残るのはbefore/after patch pixelだけ。

---

# 9. Stage A eligibility

GPU baseline pathを使用できるのは最低限:

- mode = `pen` または `eraser`
- normal Raster Layer
- `strokeTargetLayer`が確定
- Selection snapshot不要
- before時点でRaster boundsがStroke用frameをすでに包含している
- RenderTextureが存在
- rendererが使用可能

上記を満たさない場合は従来のfull CPU snapshotへfallbackする。

特に以下はfallback:

- Selectionあり
- Raster bounds拡張が必要
- baseline copy失敗
- dimensions不正
- unsupported mode
- target変更
- correctnessを保証できない状態

---

# 10. Raster bounds

今回のStage AでRaster bounds契約を変更しない。

Stroke開始時にbounds拡張が必要になる場合、

従来full snapshot経路へfallbackする。

「先にboundsを拡張してから、それをbefore状態として扱う」

という意味変更をOwner承認なしに行わない。

既存dirty rect Historyの

beforeBounds / afterBounds不一致 → full fallback

契約を維持する。

---

# 11. Stage A pointerup

dirty rect確定後:

## beforePatch

baseline scratch RenderTextureから、

`renderer.extract.pixels({ target, frame })`

でdirty rectだけを取得する。

full baseline extractは禁止。

## afterPatch

現行Layer RenderTextureから同じdirty rectだけを取得する。

## Pixel representation

before / afterとも必ず現行History snapshotと同じunpremultiply契約へ統一する。

beforeだけraw、
afterだけunpremultiplied、

のような非対称状態は禁止。

---

# 12. Stage A resource lifecycle

以下でHistory baseline scratchの「Stroke使用状態」を解除する。

- normal finalize
- cancel
- pointer cancel
- early return
- exception
- layer消失

ただし再利用可能なRenderTexture本体は保持してよい。

再利用textureに前Strokeのpixelが残っていても、
次Stroke開始時に必ず`clear:true` copyで全面上書きする。

BrushCoreを破棄する正式lifecycleが存在する場合、scratchもそこでdestroyする。

存在しない場合は勝手に新しいglobal unload設計を作らず、最終報告でresource lifetimeを説明する。

---

# 13. Stage A Gate

Browser / Pixi実機で検証。

## Pixel parity

同一before Layerに対し、

A:
従来full CPU baseline方式

B:
新GPU baseline方式

で同じStrokeを実行し、

- beforePatch
- afterPatch
- Undo後Layer
- Redo後Layer

をbyte-for-byte比較する。

対象:

- Pen opacity 1.0
- Eraser
- 半透明edgeを含む既存Layer
- clippingあり（eligibility上利用可能な場合）
- canvas端

## Fallback

- Selectionあり → 従来full path
- bounds expansion → 従来full path

を確認。

## Performance

eligible Pen / Eraserのpointerdownで、

`createLayerRasterSnapshot()` / full `extract.pixels()` が0回であること。

1200 / 2000pxで旧9〜29ms full CPU readbackがpointerdown hot pathから消えていること。

絶対0msを要求しない。

---

# 14. Stage B — Pen / Eraser realtime batch統一

Stage A Gate通過後だけ進む。

目的:

- 単発pointermove
- coalesced moveBatch

のどちらでも、

**1 input dispatch内のPen / Eraser realtime segmentを原則1回のGPU renderへ集約**

する。

---

# 15. Stage B — 単にContainerへ大量Graphicsを詰めない

現行Pen batchはGPU render callを減らしているが、
補間点ごとの`Graphics`生成は残る。

今回のStage Bでは、

「1500個のGraphicsを1 Containerへ入れて1回render」

だけで完了扱いにしない。

Graphics churnも削減する。

---

# 16. Stage B — StrokeRenderer batch API

`stroke-renderer.js`へ、

Pen / Eraserの複数segmentを1個のGraphicsへ構築できるAPIを追加する。

名称は現行命名に合わせてよい。

概念:

`renderLineSegmentsBatch(segments, settings, mode)`

segmentsには最低限:

- x0 / y0
- x1 / y1
- pressure0
- pressure1

または同等情報を持たせる。

各segmentのwidth / alpha計算は既存単発実装と同じ式を使用する。

Pen:

- pressure width
- pressure opacity
- base opacity
- cap
- join
- color

を維持。

Eraser:

- erase blend
- pressure width contract
- alpha contract

を維持。

1個のGraphics内で複数stroke instructionを構築し、
1 flushあたりGraphics生成を原則1個にする。

---

# 17. Sequential legacy parity fixture

Stage Bでは特に重要。

同じsegment列を、

A:
旧単発segment方式として別RenderTextureへ逐次render

B:
新batch Graphics方式で1回render

し、

最終pixel bufferを比較する。

最低限:

- Pen pressure off
- Pen pressure on
- Pen opacity 1.0
- Pen opacity < 1.0
- pressure opacity enabled
- Eraser pressure off
- Eraser pressure on
- segment overlap
- sharp turn
- repeated same location

を確認。

Pixel Exactが成立しないケースでは、
理由を調査して新方式をproduction接続しない。

---

# 18. BrushCore batch lifecycle

Pen / Eraser共通のbatch lifecycleへ整理する。

概念責務:

- begin
- queue segment
- flush
- cancel / cleanup

単発`updateStroke()`:

1. 外側batchが存在しなければlocal batch開始
2. interpolation loop全体でsegment queue
3. 最後に1回flush

`updateStrokeBatch()`:

1. outer batch開始
2. 複数infoを処理
3. 内部`updateStroke()`では個別flushしない
4. 最後に1回flush

nested batchで二重flushしない。

---

# 19. Render target固定

Stroke中のbatch targetはStroke開始時のtargetへ固定する。

Pen:

- normal → active Layer RenderTexture
- opacity isolation → isolation RenderTexture

Eraser:

- Stroke target Layer RenderTexture

途中で現在active layerを再解決して別Layerへ描かない。

既存の`strokeTargetLayer`契約を使用する。

---

# 20. Batch error handling

flush中に例外が起きても、

- Graphics
- Container
- queue
- batch flag

が残らないようfinallyでcleanupする。

途中まで描画された場合のStroke cancel semanticsを勝手に変更しない。

---

# 21. Stage B profiler

最低限以下を追加または既存profileへ記録:

- lineBatchSegments
- lineBatchFlushes
- realtimeGraphicsCreated
- rendererRenderCalls

debug限定でよい。

Production console spamは禁止。

---

# 22. Stage B Acceptance

## Single move

10補間segmentなら、

旧:
約10 render calls / 約10 Graphics

新:
原則1 render call / 1 Graphics

となること。

## Coalesced batch

複数input info + interpolation全体でも、
原則1 flushへまとまること。

## Eraser

Penと同等にbatchされること。

## Pixel

旧逐次方式とnew batch方式でBrowser pixel parity。

---

# 23. Stage B後 再計測Gate

ここで必ず一度停止して内部判定する。

100 / 50 / 25 / 10% zoomで、

- interpolation points
- Graphics count
- render calls
- updateStroke time
- updateStrokeBatch time
- p95
- p99

を再計測。

Stage Cへ進む条件:

以下のどちらかを満たす場合。

A:
10% zoom高速Strokeでrealtime updateのp95が4msを明確に超える。

または

B:
生成補間点がscreen-space移動量に対して3倍以上の過剰状態を維持している。

どちらも満たさず、
Owner向けに十分な余裕がある場合はStage Cを実装せず報告してよい。

---

# 24. Stage C — 適応的補間

条件を満たした場合だけ実装。

目的:

ズームアウト時だけ補間密度をscreen-space基準へ近づける。

100%付近の現行挙動を可能な限り維持する。

---

# 25. `getZoom()`を仮定しない

報告書にある

`coordinateSystem.getZoom()`

をそのまま存在すると仮定しない。

現行コードのauthoritative transform APIを確認する。

より安全な候補は、

「現在と前回のfiltered client座標距離」
と
「対応するlocal座標距離」

から、

local units per screen pixel

を求める方式。

概念:

screenDistance = hypot(
    currentClientX - lastClientX,
    currentClientY - lastClientY
)

localDistance = hypot(
    currentLocalX - lastLocalX,
    currentLocalY - lastLocalY
)

localPerScreenPx =
    localDistance / max(screenDistance, epsilon)

これによりcamera zoom / rotation等へ暗黙に追従できる。

ただし現行座標系を確認してから採用する。

---

# 26. Stage C sampling contract

目標:

約1 screen pxあたり1補間segment相当。

ただし極端な値を防ぐため安全clampを入れる。

初期案:

- minimum local step = 1
- maximum local step = 16

とし、実測で調整してよい。

重要:

- final endpointは必ず入れる
- coalesced actual sampleは削除しない
- StrokeRecorderのactual event順を壊さない
- pressure interpolationを維持
- dot semanticsを変えない
- Shift直線を変えない

---

# 27. Pressure変化

空間距離が短くてもpressure変化が大きい場合、
幅変化を潰さないようにする。

必要なら、

spatial subdivision

に加えて、

pressure delta subdivision

を採用する。

ただし既存描画結果との差が大きくなる場合はStage Cをrevertする。

閾値を魔法数で決める場合、
根拠とfixtureを最終報告へ書く。

---

# 28. Stage C pure helper

sampling calculationは可能なら、

`system/drawing/realtime-stroke-sampling.js`

へpure functionとして分離する。

DOM / Pixi依存を入れない。

Verifierで、

- 100%
- 50%
- 25%
- 10%
- 5%
- zero movement
- pressure-only change

をテストする。

---

# 29. Stage C visual Gate

Stage Cはpixel exactを期待しない。
sampling数が変わるためである。

代わりに以下を確認:

- 線の連続性
- gap 0
- endpoint一致
- sharp turnの欠けなし
- pressure widthの不自然な段差なし
- 100% zoomで旧挙動と実質同等
- 10% zoomで150 screen px移動が約150〜200 segment程度へ抑制

Owner実機確認前に「描き味改善」と断定しない。

---

# 30. Stage D — 半透明Pen scratch texture再利用

Stage A〜C後に再計測する。

以下を計測:

- `RenderTexture.create`
- clear
- destroy
- pointerdown total
- finalize total
- GPU / driver stall兆候

Pen opacity < 1.0でtexture create/destroyが有意な負荷であると確認できた場合だけ実装。

単に「16MB確保しているから遅いはず」で採用しない。

---

# 31. Stage Dを実装する場合

Pen opacity isolation用RenderTextureを最大1個cacheする。

条件:

- width
- height
- resolution

一致時だけ再利用。

Stroke開始時に透明clearする。

サイズ不一致時:

- old destroy
- new create

Stroke終了時:

- preview Sprite等は破棄
- cached RenderTexture自体は保持

ただしProject / canvas resize時のlifecycleを確認し、
恒久的VRAM leakにならないこと。

Memoryを無制限にpoolしない。

1 textureのみ。

---

# 32. Stage D Acceptance

- opacity 0.5の連続StrokeでRenderTexture.createが毎Stroke発生しない
- final pixelsが旧方式と一致
- clear漏れによる前Stroke残像0
- canvas resize後正常
- layer switch正常
- clipping正常
- Undo / Redo正常

---

# 33. 今回触らないもの

## Pixi idle ticker

第3回調査では同一frame二重renderはRejected。

idle時の常時renderは存在するが、
今回のPen latency問題とは分離する。

Ticker設定を変更しない。

将来のbattery / GPU idle最適化Gateへ送る。

## UI mouse move

DOM layout競合はRejected。
今回触らない。

## LazyBrush

既定smoothing 0.5で意図的な追従遅れがあるが、
これはユーザー設定された手ブレ補正の仕様。

性能bugとして変更しない。

---

# 34. 必須Browserテスト

最低限:

## Pen

- opacity 1.0
- opacity 0.5
- pressure on / off
- pressure opacity
- dot
- short
- long
- fast zigzag
- sharp turn

## Eraser

- pressure on / off
- long fast stroke

## Zoom

- 100%
- 50%
- 25%
- 10%

## Layer

- normal
- Layer A描画 → Layer B active → Undo / Redo
- clipping
- selection

## Bounds

- bounds stable
- bounds expansion fallback

## History

- Undo
- Redo
- multi Undo
- branch truncate

## Save

- Project save / reload

Console error 0。

---

# 35. Verifier要件

新規`verify-pen-responsiveness-enhancements.mjs`に最低限:

1. Stage A eligibility
2. Stage A fallback
3. GPU baseline lifecycle state
4. missing target安全return
5. batch begin / queue / flush
6. nested batch
7. Pen single move flush 1
8. Pen moveBatch flush 1
9. Eraser single move flush 1
10. Eraser moveBatch flush 1
11. batch target固定
12. cancel cleanup
13. Graphics count contract
14. sampling pure helper
15. endpoint preservation
16. pressure preservation
17. zero movement
18. max clamp
19. opacity cache lifecycle（Stage D実施時）

Browser fixtureでは:

20. legacy sequential Pen vs batch Pen pixel parity
21. legacy sequential Eraser vs batch Eraser pixel parity
22. GPU baseline vs legacy CPU baseline Undo / Redo parity

を固定。

---

# 36. 性能Acceptance

絶対msだけで合否を決めない。

## Stage A

eligible Pen / Eraser pointerdownでfull CPU `extract.pixels()` 0回。

旧1200 / 2000 full snapshot blockingがhot pathから消える。

## Stage B

Pen / Eraserともに、

render call countが補間点数に比例しない。

原則1 input dispatch = 1 flush。

Graphics生成数も補間点数に比例しない。

## Stage C

実施した場合、

10% zoomで補間点数が旧約1500からscreen-space相当へ大幅削減。

100% zoomの描画感・軌跡を維持。

## Stage D

実施した場合、

opacity<1 Strokeでfull-size temporary RenderTextureのnew/destroyが毎Stroke発生しない。

---

# 37. 全Verifier / Build

各Stage Gateで:

- 新規Verifier
- `verify-long-drawing-degradation-fix.mjs`
- 全既存primary verifier
- `node --check`
- `npm run build`

を通す。

Stage A失敗 → Bへ進まない。
Stage B失敗 → Cへ進まない。
Stage C visual regression → Cだけrevert。
Stage D不明瞭 → 実装しない。

---

# 38. Git / Workspace

Ownerの未commit local変更を保護する。

禁止:

- git reset
- git checkout .
- git clean
- stash popによる上書き
- unrelated formatting
- backup上書き
- Git push

変更ファイルを明示し、
想定外差分が出たらSTOP。

Owner実機Acceptance前にpushしない。

---

# 39. 最終報告

以下を提出。

## Changed Files

ファイルごとの責務。

## Stage A

- GPU baseline方式
- eligibility
- fallback
- scratch lifecycle
- pointerdown Before / After metrics
- 400 / 1200 / 2000

## Stage B

- single move batching
- moveBatch batching
- Eraser batching
- Graphics削減方式
- sequential vs batch pixel parity
- render call Before / After
- Graphics count Before / After

## Stage C

- 実装した / しなかった
- Gate判断
- sampling式
- zoom別点数
- visual確認

## Stage D

- 実装した / しなかった
- allocation実測
- cache lifecycle

## Browser

全確認項目。

## Tests

- new verifier
- existing verifiers
- build
- console

## Remaining Candidates

- display-only prediction
- idle Pixi ticker
- Delegated Ink
- rawupdate
- desynchronized

は今回未採用として残す。

---

# 40. Owner Acceptanceへ残す項目

GEMINIのBrowser / Headless確認だけで最終closeしない。

Ownerが実機で最低限:

1. 普通のPen
2. 高速Stroke
3. 10% zoom
4. Eraser高速Stroke
5. opacity 0.5 Pen
6. 1200px以上Canvas
7. Layer切替後Undo / Redo

を触る。

特にOwnerが90 / 120Hz環境を持つ場合は、
そこで初めて高refresh-rateの最終体感判定を行う。

---

# 41. Stop条件

以下なら無理に続行しない。

- pixel parityが崩れる
- Undo / Redo semanticsが変わる
- Layer誤更新が起きる
- Selection semanticsへ波及
- Clipping semanticsへ波及
- Raster bounds意味が変わる
- pressure線幅が変わる
- 半透明Pen appearanceが変わる
- Stage Cで描き味が変わる
- scratch texture lifecycleが安全に設計できない
- Scope外ファイル変更が必要

そのStageをfallback / revertし、
前Stageまでの安全な改善だけを残す。

---

# 42. 最終ゴール

今回の成功条件は、

「最新Web APIを導入した」

ではない。

**現在すでに快適なPenを維持しながら、内部の明確な同期・render・allocation無駄だけを削り、1200〜2000px / zoom-out / Eraserでさらに余裕を増やすこと。**

Stage A → Gate → Stage B → Gate → 条件付きStage C → 条件付きStage Dの順に進める。

完了報告を提出したところで停止し、
Owner実機Acceptance前にGit pushしないこと。
