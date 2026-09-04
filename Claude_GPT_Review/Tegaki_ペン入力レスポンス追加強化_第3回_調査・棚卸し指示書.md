# Tegaki ペン入力レスポンス追加強化 — 第3回 調査・棚卸し指示書

更新日: 2026-09-04  
対象: 現行ローカル `tegaki_work`  
担当: GEMINI  
Stage: 調査・計測・設計比較のみ  
Owner承認前のproduction実装: 禁止

---

## 0. このStageの目的

Tegakiでは、長時間描画時の性能劣化対策として、

- 通常Raster Brushの不要な `pathsData` 累積停止
- Pen / Eraserのdirty rect History
- History retained memory削減
- thumbnail更新のcoalesce
- dirty rect Historyの記録Layer ID基準でのUndo / Redo復元

まで実装済みであり、Owner実描画では現時点で明確な遅延は確認されていない。

したがって今回の目的は、

**「現在快適なPen入力を不用意に壊さず、さらに改善余地が本当に残っているかを実測・コード・Browser仕様の3面から確認すること」**

である。

このStageではproduction挙動を変更しない。

最終的に、

1. 本当に改善すべきボトルネックが残っているのか
2. 残っている場合、どこが最優先か
3. 各候補の期待効果・リスク・前提条件
4. 次回のproduction改修を実施する価値があるか

を判断できる調査報告を提出する。

---

# 1. 最重要原則

## 1.1 現在の「快適さ」を基準点として扱う

現在Owner実機では、

- 長時間描画による漸増遅延が大幅に改善
- Pen操作感は現時点で良好

と確認されている。

したがって、

「新しいAPIだから入れる」
「モダンだから置き換える」
「理論上速そうだから採用する」

という判断は禁止。

**改善量が実測できない変更はproduction候補へ昇格させない。**

## 1.2 調査Stageでproduction仕様を変更しない

禁止:

- `getPredictedEvents()` のproduction接続
- `pointerrawupdate` のproduction接続
- desynchronized canvasのproduction化
- Delegated Ink / `navigator.ink` のproduction接続
- Pixi Application / Ticker設定変更
- RenderTexture History方式変更
- Brush smoothing方式変更
- LazyBrush方式変更
- Stroke interpolation方式変更
- Pen rendering algorithm変更
- History schema変更
- Project / CAF / Motion / RIG / WARP schema変更
- PixiJS version変更
- dependency追加・更新
- unrelated refactor
- UI / QTP / Animation Table変更
- Git commit / push

調査用instrumentationを一時的に追加する場合も、production挙動を変えないこと。

最終報告時には、Owner承認がない限り調査用production差分を残さない。

## 1.3 現行ローカルworkspaceを正本とする

GitHub `main` よりローカルworkspaceが新しい可能性がある。

必ず現在のローカルソースを確認し、

- 未commitの修正
- dirty rect History Layer解決修正
- 最新のVerifier

を含む現在workspaceを調査対象とする。

Ownerの未commit変更をrevert / reset / checkout / cleanしてはならない。

## 1.4 Backupは今回非対象

以下のBackupは今回の調査には使用しない。

`D:\GitHub\tegaki\開発用資料保管庫\Backup-tegaki_work\tegaki_work_phase9o`

このディレクトリへ一切書き込まないこと。

今回の目的はphase比較ではないため、必要がない限り読み取りも不要。

---

# 2. 参考資料

まず以下を読む。

- `AGENTS.md`
- `TEGAKI.md`
- `tegaki_work/PROGRESS.md`
- `tegaki_work/NEXT_CHAT_HANDOFF.md`
- 現行Phase文書
- `system/drawing/pointer-handler.js`
- `system/drawing/drawing-engine.js`
- `system/drawing/brush-core.js`
- `system/drawing/stroke-renderer.js`
- `system/drawing/stroke-recorder.js`
- `system/drawing/pressure-handler.js`
- `system/drawing/brush-settings.js`
- `system/layer-system.js`
- `system/history.js`
- `core-initializer.js`
- `core-engine.js`
- `config.js`

外部検討資料:

- `pen-input-responsiveness-modernization-proposal.md`
  - 外部AI Claudeによる検討
- 長時間描画性能劣化 第1回調査報告
- 長時間描画性能劣化 第2回改修指示書

外部AI資料は実装契約ではない。

**現行コードと実測を正本とする。**

---

# 3. 既知の現行構造

調査開始時に以下をコードで再確認すること。

現時点では概ね、

- `PointerHandler` が `getCoalescedEvents()` を利用
- coalesced pointを古い順に処理
- LazyBrushがスクリーン座標で状態を持って補正
- `DrawingEngine` がsingle / batch moveをBrushCoreへ渡す
- BrushCoreがPen / EraserをStroke中にRenderTextureへ逐次焼き込み
- Penのcoalesced batchでは複数GraphicsをまとめてGPU render
- canvas表示更新は `requestAnimationFrame` でcoalesce
- HistoryはPen / Eraserでdirty rect patchを保持
- Pen stroke開始時には依然としてbefore full raster snapshotを取得する経路がある
- normal Penのrealtime hot pathはPerfect-Freehandのfull stroke生成ではなく短いPixi Graphics segment中心

となっている。

誤っている点があれば報告で訂正する。

---

# 4. 外部AIから出ている候補

Claude案では以下が候補として挙げられている。

- `getPredictedEvents()`
- desynchronized canvas
- `pointerrawupdate`
- Delegated Ink Trail / `navigator.ink`
- 90Hz / 120Hz環境での実測

これらを肯定することが目的ではない。

必ず、

- 現行Browserでの対応状況
- Tegakiとの構造的相性
- 期待効果
- correctness risk
- fallback complexity
- 実装コスト

を独立に評価する。

---

# 5. GPT側から追加された主要仮説

以下も検証対象とする。

## Hypothesis A — Pixi自動Tickerと手動stage renderの重複

現行Pixi Applicationが通常Tickerで自動renderしている一方、BrushCoreにも

`requestAnimationFrame -> app.render()`

相当の手動表示更新がある。

このため描画中、

- Pixi ticker render
- BrushCore manual render

が同一display frame近辺で重複している可能性がある。

これはまだConfirmedではない。必ず実測する。

確認項目:

- Pixi ApplicationのTicker設定
- `autoStart`
- `sharedTicker`
- render plugin
- 実際の `app.render()` / renderer stage render回数
- 1秒あたりstage render回数
- display refresh rateとの比
- Stroke中 / idle時の差

60Hz環境で約60回/秒が期待されるところ、120回近く描画していないか等を調べる。

ただしinstrumentationによる測定誤差にも注意する。

## Hypothesis B — pointerdown full GPU→CPU snapshot

dirty rect HistoryでHistory保持量は改善したが、Stroke開始時にfull raster snapshotを取得する経路が残っている。

これは、

- GPU readback
- CPU pixel copy
- unpremultiply

をpointerdown直後に同期的に行う可能性がある。

確認:

- 400×400
- 1200×1200
- 2000×2000
- 最大に近い現実的サイズ

で、

`pointerdown -> Brush start ready`

までの時間を分解する。

特に、

- `createLayerRasterSnapshot`
- renderer extract
- TypedArray copy
- unpremultiply
- raster frame ensure
- Selectionあり / なし

を分ける。

Ownerが感じる「線頭の遅れ」と相関するか確認する。

## Hypothesis C — Graphics object allocation churn

現行Pen hot pathでは、

coalesced input
→ interpolation
→ 複数の短いsegment
→ segmentごとにPixi `Graphics`
→ batch Containerへ追加
→ render
→ destroy

という経路がある可能性が高い。

確認:

- pointer event数
- coalesced sample数
- generated interpolation point数
- Graphics生成数
- batch flush回数
- GPU render call数
- JS処理時間
- allocation / GC兆候

高速Stroke・縮小Canvas・高Hz環境で増加するか確認する。

「GPU draw callが少ない」だけで高速だと判断しない。

## Hypothesis D — 1 local pixel固定補間の過剰生成

現行BrushCoreのinterpolationが距離ベースで約1 local pixel stepの場合、Canvasを大きく縮小している時は、

1 screen pixelの移動
→ 多数local pixel移動

となり、大量の補間点を生成する可能性がある。

以下を比較:

- 100% zoom
- 50%
- 25%
- 10%
- 高速Stroke

測定:

- actual input samples
- generated interpolation samples
- generated / actual ratio
- updateStroke time
- Graphics count

描画品質とのトレードオフも報告する。

このStageでは補間方式を変更しない。

## Hypothesis E — UI / status更新のpointermove競合

DrawingEngineには描画用PointerHandlerとは別に、canvas `pointermove` から座標表示などをUIへ通知する経路がある。

描画中にもこの経路が動き、

- EventBus
- DOM text update
- layout / style recalc

等を起こしていないか確認する。

特に90 / 120Hz入力で無視できない割合になるか測る。

必要なら、

- idle hover
- drawing
- debug off

を比較する。

---

# 6. `getPredictedEvents()` の調査要件

特に重要。

単純に、

`predicted event -> updateStroke()`

へ流せると判断してはならない。

現行TegakiのPen / Eraserはrealtime RenderTextureへcanonical pixelsを焼き込むため、予測点を本描画へ流すと予測誤差がRasterへ残る。

さらにLazyBrushはstatefulであるため、予測点を通常LazyBrushへ流すとcanonical smoothing stateが未来へ進む可能性がある。

調査すること:

1. `getPredictedEvents()` の現行Browser対応
2. 返される予測点数・予測時間幅
3. pen / mouseでの差
4. pressure / tilt等の値品質
5. actual eventとの誤差
6. stationary / direction change / sharp turn時の誤差
7. LazyBrushとの相互作用
8. predicted pointをStrokeRecorderへ入れない構造
9. predicted pointをHistoryへ入れない構造
10. predicted pointをRenderTextureへ永久焼き込みしない構造

候補設計としては、

**display-only predicted tail**

を別preview surfaceへ一時描画し、次actual eventで完全破棄・再生成する方式を評価する。

この方式なら、

- canonical raster
- StrokeRecorder
- History
- LazyBrush canonical state

を汚染しない。

ただし実装はまだしない。

---

# 7. `pointerrawupdate` の調査要件

確認:

- 現在対象Browserでの対応
- Pointer Capture中の挙動
- `pointermove` / coalesced eventsとの重複
- raw sample frequency
- CPU負荷
- event queue delay
- pen pressure品質

特に、

`pointerrawupdate`
+
`pointermove.getCoalescedEvents()`

を両方処理すると同じ入力を二重処理する可能性を確認する。

「イベント数が多い = 低遅延」と結論しない。

現行coalesced inputでサンプル密度が既に十分ならRejectedでもよい。

---

# 8. desynchronized canvas の調査要件

TegakiはPixiJS v8系のWebGL rendererを使用している。

したがって2D canvas向けの単純な

`getContext('2d', { desynchronized: true })`

の話として扱わない。

確認:

- PixiJS現行versionでcustom WebGL contextを渡す正式手段
- WebGL / WebGL2 `desynchronized` context attribute対応
- current target browser support
- alpha / transparent canvasとの相互作用
- tearing
- overlay DOMとの相互作用
- preserveDrawingBuffer等の副作用
- Pixi renderer lifecycleへの影響
- context loss / recovery
- screenshot / extract / exportへの影響

production導入前に独立prototypeが必要か判定する。

---

# 9. Delegated Ink / navigator.ink の調査要件

最新仕様を必ず再確認する。

古いexplainerの記述をそのまま信用しない。

特に:

- Browser support
- secure context要件
- API shape
- `requestPresenter`
- `updateInkTrailStartPoint`
- styleで指定可能な情報
- `expectedImprovement` の現状
- deprecated / removed property

を現行資料で確認する。

Tegaki固有の問題:

- LazyBrushでtipがraw pointerより遅れる
- pressureで線幅が変わる
- opacity
- clipping
- selection
- eraser
- airbrush
- blur
- camera transform

との見た目差を評価する。

Delegated Inkはcanonical drawingではなく、一時的なlatency hidingであることを前提にする。

---

# 10. 90Hz / 120Hz / 高refresh rate計測

可能なら実機で行う。

実機がない場合は、

「実機検証できなかった」

ことを明記し、Browser rAF cadence / synthetic inputだけで断定しない。

計測:

- actual `requestAnimationFrame` interval
- average / p95 / p99
- dropped frame
- long task
- event queue delay
- pointer handler time
- BrushCore update time
- render segment time
- batch flush time
- main stage render time
- pointerdown snapshot time
- pointerup finalize time

Frame budget:

- 60Hz ≈ 16.7ms
- 90Hz ≈ 11.1ms
- 120Hz ≈ 8.3ms
- 144Hz ≈ 6.9ms

ただし単発最大値だけでなく、p95 / p99と連続Stroke時の分布を見る。

---

# 11. Input-to-display latencyを可能な範囲で分解する

単なる関数処理時間だけでなく、

`PointerEvent timestamp`
→ handler開始
→ Brush update
→ RenderTexture書込
→ stage render request
→ actual stage render

までを可能な範囲で追跡する。

最低限:

- event queue delay
- handler duration
- brush duration
- render request waiting time
- render execution duration

を区別する。

可能であればPerformance TimelineやDevTools traceも使う。

「JS処理は1msだから遅延1ms」とは判断しない。

---

# 12. Gemini独自調査 — 必須

ここは重要。

GPT / Claudeが提示した仮説を検証するだけでは不十分。

GEMINI自身のコード読解・Browser知識・Profiler結果から、

**最低3個の独自仮説候補**

を追加して評価すること。

候補は同意する必要はない。

例:

- Pointer Captureとraw event scheduling
- GPU command submission / flush
- Pixi Graphics build cost
- Container destroy cost
- JS object allocation
- EventBus競合
- Settings read頻度
- coordinate transform
- clipping mask
- opacity isolation RenderTexture
- selection constrain
- browser compositor
- high-DPI / DPR policy
- OS pen sampling
- Windows Ink
- Canvas overlay
- GC
- battery / power mode
- Chromium scheduling
- Pixi renderer setting

など。

ただし、外部AIが言っていないことを無理に3件作るのではなく、コード・trace・仕様から意味のあるものを出す。

各独自仮説に、

- なぜ疑ったか
- どのコード経路か
- どう測ったか
- 結果
- 採否

を付ける。

---

# 13. 反証優先

以下を義務付ける。

Claude / GPTの提案に対し、

「なぜ効かない可能性があるか」

を先に考える。

例えば:

- Prediction: 既にLazyBrushの遅延が支配的なら意味が薄い
- rawupdate: coalesced eventsで十分ならCPU負荷だけ増える
- desynchronized: tearingやPixi初期化リスクが利益を上回る
- Delegated Ink: Tegakiのbrush appearanceと一致しない
- manual render重複: Pixi側が実際にはauto renderしていない可能性
- GPU baseline: GPU→GPU copy自体が同期を起こす可能性

など。

Confirmed / Rejectedを明確にする。

---

# 14. テストシナリオ

最低限以下を分ける。

## A. Pen基本

- opacity 100%
- pressure off
- 1 layer
- selectionなし
- clippingなし

## B. Pen pressure

- pressure on
- slow stroke
- fast stroke

## C. Pen opacity < 100%

opacity isolation RenderTexture経路。

## D. Eraser

Penとの差を見る。

## E. Canvas zoom

- 100%
- 50%
- 25%
- 10%

## F. Canvas size

- 400×400
- 1200×1200
- 2000×2000付近

## G. Layer conditions

- normal
- clipping
- selectionあり

## H. Stroke patterns

- dot
- short stroke
- long stroke
- fast zigzag
- sharp direction change
- continuous repeated strokes

---

# 15. 診断用コードの扱い

既存の

`window.TegakiStrokeInputProfiler`

等を優先する。

追加instrumentationが必要な場合:

- debug flag下だけ
- production behavior不変
- 最小範囲
- 一時変更

とする。

調査後はOwner承認なしにproduction instrumentationを残さない。

新しいdiagnostic scriptを作る場合は、`build/` 等の適切な場所に限定し、最終報告で残す必要性を説明する。

---

# 16. 各候補の評価表

以下の候補を最低限比較する。

1. 現状維持
2. Pixi/manual stage render重複解消
3. pointerdown full snapshot改善
4. Graphics allocation削減
5. interpolation改善
6. UI pointermove競合削減
7. display-only `getPredictedEvents()`
8. `pointerrawupdate`
9. desynchronized WebGL
10. Delegated Ink

各項目:

- 現在のボトルネック寄与
- Expected latency reduction
- CPU効果
- GPU効果
- Memory効果
- Visual correctness risk
- History risk
- Browser compatibility
- Complexity
- Testability
- Rollback ease
- 推奨度

を記載。

---

# 17. 優先順位判定

単純に「速くなる順」ではなく、

`expected benefit / implementation risk`

で評価する。

推奨ランク:

- P0: 早急に直すべき明確な無駄
- P1: 小さなリスクで効果が高い
- P2: prototypeする価値あり
- P3: 将来候補
- Reject: 現状では採用不要

とする。

---

# 18. Stop条件

以下の場合、production実装へ進まず報告して停止。

- 現状で120Hz frame budgetに十分収まる
- 改善候補の実測効果が小さい
- Browser差が大きすぎる
- Pixel correctnessを崩す
- LazyBrush semanticsを変える必要がある
- History / Selection / Clipping契約へ波及する
- Pixi renderer再初期化が必要
- Project / save schema変更が必要
- OS / Browser限定効果しかない
- Owner実機がないと採否不能

「今は変えない」が最良なら、その結論でよい。

---

# 19. 最終報告フォーマット

以下の順で提出する。

## 1. Executive Summary

3〜10行。

- 現在のPen pipeline評価
- 追加改修の必要性
- 最優先候補
- production実装へ進むべきか

## 2. Current Pipeline

input → filtering → recording → realtime render → stage display
を簡潔に図示。

## 3. Measurement Environment

- OS
- Browser
- Browser version
- display Hz
- pen hardware
- canvas size
- zoom
- debug state

未確認項目も書く。

## 4. Baseline Metrics

表で提示。

## 5. Hypothesis Results

各仮説を:

- Confirmed
- Highly Likely
- Possible
- Rejected

で判定。

コード根拠と実測根拠を分ける。

## 6. Claude Proposal Review

- Agree
- Modify
- Reject

を項目ごとに明記。

## 7. GPT Hypothesis Review

同様に明記。

## 8. Gemini Original Findings

最低3件の独自視点。

## 9. Browser API Freshness Check

- `getPredictedEvents`
- `pointerrawupdate`
- desynchronized
- navigator.ink

の現行対応と注意点。

## 10. Recommended Roadmap

例:

- Stage A: measurement only
- Stage B: internal low-risk optimization
- Stage C: prediction prototype
- Stage D: Chromium-only optional enhancement

実測に応じて変更してよい。

## 11. Do Not Implement

現時点で採用すべきでないもの。

## 12. Proposed Production Scope

次回GPTが改修指示書を作れる粒度で、

- 対象file
- 変更責務
- acceptance
- fallback
- verifier

を提案。

ただし実装しない。

---

# 20. 今回の最終ゴール

この調査の成果物はコードではない。

**次のGPT検討で、安全なproduction改修指示書を作れるだけの測定・反証・設計情報**

である。

最終報告を提出したら停止すること。

Owner承認なしに次Stageの実装へ進まないこと。
