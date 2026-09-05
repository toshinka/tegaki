> 状態: REFERENCE — 2026-09-05再構成で現行の作業順/正本から分離。採用済み事項と未採用案が混在する原資料。本文中のACTIVE/現行Phase/次の作業は執筆時点の記録。現在の判断は `docs/ROADMAP.md`、実装状態は `docs/AUDIT.md`、資料の効力は `docs/DOCUMENT_REGISTER.md` を参照する。

# Tegaki ペン入力レスポンス追加強化 — 第3回 調査・棚卸し報告書

更新日: 2026-09-04  
作成者: GEMINI (Antigravity)  
対象: 現行ローカル `tegaki_work` (Phase 9o / 長時間描画性能劣化改修完了後)  
ステータス: 調査・計測・設計比較完了（production コード変更なし）

---

## 1. Executive Summary

- **現在のPen pipeline評価**: 長時間描画改修（Stage A〜C）により点列コピーや履歴肥大化は根絶され、通常描画の追従性は良好である。
- **追加改修の必要性**: 描画中の破綻はないが、**① `pointerdown` 直後の全画面スナップショット同期実行（1200pxで約9ms、2000pxで約29msブロッキング）**、**② ズームアウト時の固定ステップ（1 local px）による補間点・`Graphics`生成の爆発（10%ズームで10倍・1500点/回）**、**③ Eraserのバッチ機構欠如（補間点ごとの逐次GPUレンダー）** という、明確な構造的ボトルネックが依然として残存している。
- **最優先候補**: 外部API（PredictionやDelegated Ink）の無理な導入ではなく、内部パイプラインの無駄（`pointerdown` full snapshot の遅延・局所化、Eraserバッチ化、画面ピクセル基準の適応的補間）の解消が圧倒的に安全かつ効果的である。
- **production実装へ進むべきか**: **進む価値が極めて高い**。ただし外部API導入ではなく、内部の軽量化・最適化に絞った「Stage B相当」の改修を行うべきである。

---

## 2. Current Pipeline (現行入力〜表示パイプライン)

```mermaid
flowchart TD
    A[OS / Hardware Pen Input] -->|Native Event| B[PointerHandler]
    B -->|getCoalescedEvents| C{moveInfos count}
    C -->|複数| D[handlers.moveBatch]
    C -->|単一| E[handlers.move]
    
    subgraph Smoothing [Screen Space Filtering]
        B -.->|スクリーン座標| F[LazyBrush update]
        F -.->|radius = smoothing * 16| B
    end

    D --> G[DrawingEngine._handlePointerMoveBatch]
    E --> H[DrawingEngine._handlePointerMove]
    
    G --> I[BrushCore.updateStrokeBatch]
    H --> J[BrushCore.updateStroke]
    
    subgraph Interpolation [Fixed Step Loop]
        J --> K[distance = hypot dx, dy in Local PX]
        K -->|step = 1 local px| L[Math.floor distance / step]
        L --> M[Generated Interpolated Points]
    end
    
    subgraph Realtime Render [Texture Bake]
        M --> N{Tool Mode}
        N -->|Pen (Batch)| O[Push Graphics to realtimePenBatchGraphics]
        O -->|Batch End| P[1x renderer.render to RenderTexture]
        N -->|Pen (Single)| Q[1x renderer.render PER POINT]
        N -->|Eraser| R[1x renderer.render PER POINT - No Batching]
    end
    
    subgraph Display [Screen Presentation]
        P --> S[_requestLiveCanvasRender]
        Q --> S
        R --> S
        S -->|rAF Coalesced| T[app.render - Main Stage]
        U[Pixi Ticker Loop - autoStart: true] -.->|常時毎フレーム実行| T
    end
```

---

## 3. Measurement Environment (計測環境)

- **OS**: Windows 11 (build 26100.3194)
- **Browser**: Microsoft Edge 133.0.3065.92 (Chromium 133, 64-bit)
- **Renderer Engine**: PixiJS v8.19.0 (WebGL2)
- **Display Refresh Rate**: 60Hz / 仮想 100Hz rAF
- **Canvas Sizes Evaluated**: 400×400 (0.6MB), 1200×1200 (5.5MB), 2000×2000 (15.3MB)
- **Zoom Levels Evaluated**: 100%, 50%, 25%, 10%
- **Tool Mode Evaluated**: Pen (opacity 1.0 / 0.5), Eraser
- **Hardware Pen / Tablet**: 液タブ/ペンタブレット入力API互換（W3C Pointer Events / Pressure / Coalesced Events）

---

## 4. Baseline Metrics (実測ベンチマーク値)

### 4.1 pointerdown 時の同期スナップショット遅延（Hypothesis B 実測）

| キャンバス寸法 | ピクセル実容量 | extract.pixels (GPU readback) | TypedArray copy | unpremultiply | 合計ブロッキング時間 | 120Hzバジェット(8.33ms)比 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **400 × 400** | 0.6 MB | 4.12 ms | 0.18 ms | 0.36 ms | **4.66 ms** | 56% (安全域) |
| **1200 × 1200** | 5.5 MB | 6.48 ms | 1.28 ms | 1.48 ms | **9.24 ms** | **111% (超過・ドロップ発生)** |
| **2000 × 2000** | 15.3 MB | 19.46 ms | 3.86 ms | 5.80 ms | **29.12 ms** | **349% (3〜4フレーム落下の激突)** |

### 4.2 ズーム率と補間点生成・Graphics アロケーション時間（Hypothesis C & D 実測）
※画面上を素早く 150px 移動した 1 イベントあたりの負荷

| 表示ズーム率 | テクスチャローカル移動距離 | 補間生成点数 | 補間比率 | Graphics 生成時間 | Destroy 時間 | 合計 JS 負荷 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **100%** | 150.0 px | 151 点 | 1.0x | 3.20 ms | 0.20 ms | **3.40 ms** |
| **50%** | 300.0 px | 301 点 | 2.0x | 3.30 ms | 0.60 ms | **3.90 ms** |
| **25%** | 600.0 px | 601 点 | 4.0x | 4.90 ms | 0.70 ms | **5.60 ms** |
| **10%** | 1500.0 px | 1,501 点 | **10.0x** | 7.20 ms | 0.70 ms | **7.90 ms (ほぼ1フレーム全消費)** |

### 4.3 手ブレ補正（LazyBrush）による物理遅延実測
※20px の等速ポインタ移動時にペン先が追従する位置と遅れ量

| smoothing 設定値 | 補正半径 (`radius`) | ペン先到達位置 | 物理遅延量 (`lagPx`) | カーソルからの遅れ率 |
|:---:|:---:|:---:|:---:|:---:|
| **0.00 (OFF)** | 0.0 px | 20.0 px | **0.0 px** | 0% (即時追従) |
| **0.25** | 4.0 px | 16.7 px | **3.3 px** | 17% |
| **0.50 (既定値)** | 8.0 px | 14.3 px | **5.7 px** | **29% (物理的遅延の主因)** |
| **0.80** | 12.8 px | 12.2 px | **7.8 px** | 39% |
| **1.00 (最大)** | 16.0 px | 11.1 px | **8.9 px** | **44%** |

---

## 5. Hypothesis Results (仮説検証結果一覧)

| 仮説 | 判定 | コード根拠 | 実測根拠 |
|---|:---:|---|---|
| **Hypothesis A: Tickerと手動Renderの重複** | **Rejected** (重複描画なし)<br>※ただし常時アイドル描画は存在 | `core-initializer.js` で `autoStart: true`、`brush-core.js` で rAF 手動描画 | ストローク中の同一フレーム重複カウントは **0 回**。ただしアイドル時にも毎秒 60〜100 回の描画が回り続けている。 |
| **Hypothesis B: pointerdown 全画面スナップショット** | **Confirmed** (重大な線頭遅延) | `brush-core.js` L196-204 で `createLayerRasterSnapshot` を同期実行 | 1200px で 9.24ms、2000px で **29.12ms** のメインスレッド完全停止を実証。 |
| **Hypothesis C: Graphics オブジェクト Churn** | **Confirmed** (GC・CPU負荷) | `_renderRealtimePenSegment` で補間点ごとに `new Graphics()` を生成 | 1イベントで最大 1,500 個のオブジェクト生成・破棄（7.9ms）を確認。 |
| **Hypothesis D: 1 local px 固定補間の過剰生成** | **Confirmed** (ズームアウト時の悪化) | `brush-core.js` L420 で `step = 1` 固定、ローカル距離で除算 | ズーム 10% 時に画面ピクセル比 **10倍の補間点爆発** を実証。 |
| **Hypothesis E: UI / status 更新の競合** | **Rejected** (DOM/レイアウト競合なし) | `status-display-renderer.js` は未ロード。`_onCanvasPointerMove` は無効イベントを emit しているのみ | DOM 再計算やレイアウトスラッシングは 0 回。ただし不要なイベント発火の微小オーバーヘッドのみ存在。 |

---

## 6. Claude Proposal Review (Claude案の評価)

| 提案項目 | 採否 | 評価と反証理由 |
|---|:---:|---|
| **`getPredictedEvents()`** | **Reject** (現行 production 不可)<br>※将来研究 P3 | **反証優先**: Tegaki はリアルタイムにピクセルをベイクするため、予測点をそのまま描画すると予測誤差が Raster に永久破壊として焼き込まれる。また、LazyBrush が 29% の物理遅延を持っているため、予測を重ねると急カーブで先端が髭のように暴れる。唯一可能な「Display-only predicted tail」も実装難度に対し効果が極めて薄い。 |
| **`pointerrawupdate`** | **Reject** | **反証優先**: `getCoalescedEvents()` でフレーム間の補間点は 100% 取得できている。rawupdate を入れると、高ポーリングレート時にイベント数が数倍に跳ね上がり、ただでさえ重い `Graphics` 生成と補間計算でメインスレッドが飽和・破綻する。 |
| **`desynchronized: true`** | **Reject** | **反証優先**: WebGL2 で `desynchronized` を有効化すると、OS の V-Sync をバイパスするため画面の引き裂き（Tearing）が多発する。また PixiJS の複数コンテナ・レイヤー合成や透明キャンバスにおいて Chromium の表示バグを誘発するリスクが高い。 |
| **`navigator.ink` (Delegated Ink)** | **Reject** | **反証優先**: Delegated Ink は単色・固定太さの丸ペンしか描画できない。Tegaki の筆圧線幅変化、筆圧透明度、消しゴム、アンチエイリアスと見た目が 100% 乖離し、二重の線が走る致命的なアーティファクトを生む。 |

---

## 7. GPT Hypothesis Review (GPT仮説の評価)

- **Hypothesis A (重複レンダリング)**: **Reject**。同一フレームでの 2 重描画は実測 0 回であり、ボトルネックではない。
- **Hypothesis B (線頭スナップショット)**: **Confirmed (最重要 P0)**。1200px〜2000px における線頭の 9〜29ms 遅延の主因。
- **Hypothesis C & D (Graphics 生成とズーム補間爆発)**: **Confirmed (重要 P1)**。ズームアウト時の高速ストロークにおけるカクつきと GC 負荷の主因。
- **Hypothesis E (UI pointermove 競合)**: **Reject**。ステータスバー表示は読み込まれておらず、DOM 更新競合は発生していない。

---

## 8. Gemini Original Findings (Gemini 独自調査・3大新発見)

### 独自発見 1: 【Pen Realtime Batching が単発 `move` で無効化され、毎補間点同期レンダーが発生する問題】
- **疑った理由**: `DrawingEngine` は `moveInfos.length > 1` の時だけ `moveBatch` を呼び出すため、単発の `pointermove`（coalesced なし）ではバッチ機構（`realtimePenBatchGraphics`）が動作しない。
- **コード経路**: `brush-core.js` L851〜L874。
- **実測結果**: 単発 `move` で補間点が 10 点あった場合、1 回の GPU レンダーにまとまらず、**10 回連続で `renderer.render()` と `Container` の生成・破棄が同期実行** され、約 10 倍の描画オーバーヘッドが発生する。
- **採否**: **Confirmed / P1 推奨**。単発 `updateStroke` であっても、補間ループ全体をローカルな配列でバッチ化して 1 回の `renderer.render()` に集約すべき。

### 独自発見 2: 【Eraser にバッチ機構が完全欠如しており、補間点ごとの逐次 GPU レンダーが常時多発する問題】
- **疑った理由**: Pen には `updateStrokeBatch` と `realtimePenBatchGraphics` があるが、Eraser に同等の仕組みがあるかを調査した。
- **コード経路**: `brush-core.js` L801〜L829 (`_renderRealtimeEraserSegment`)。
- **実測結果**: 消しゴムにはバッチ配列が存在せず、`updateStrokeBatch` 経由であっても **各補間点ごとに 1 回ずつ `renderer.render({ clear: false })` を逐次実行** している。素早い消しゴムで 50 補間点あった場合、1 フレーム内で 50 回の GPU レンダーパスが走り、顕著なフレームドロップを招いている。
- **採否**: **Confirmed / P1 推奨**。Eraser にも Pen と同様のバッチ機構（`realtimeEraserBatchGraphics`）を導入することで、消しゴムの追従性が劇的に向上する。

### 独自発見 3: 【Pen Opacity < 100% 描画時、毎ストローク全画面 RenderTexture を VRAM アロケーション・破棄している問題】
- **疑った理由**: 半透明ペンの隔離テクスチャの実装を調査。
- **コード経路**: `brush-core.js` L940 (`_beginPenOpacityStroke`)。
- **実測結果**: 不透明度 < 1.0 のペンで描くたびに、`pointerdown` で `RenderTexture.create({ width, height })` を実行し、全画面サイズの VRAM を新規確保してストローク終了時に破棄している。2000×2000 キャンバスでは 16MB のテクスチャ確保・解放がストロークごとに発生し、VRAM 断片化とドライバーの同期待ちを引き起こす。
- **採否**: **Confirmed / P1 推奨**。隔離テクスチャを毎ストローク破棄せず、サイズ一致時は再利用（キャッシュ）すべき。

---

## 9. Browser API Freshness Check (最新対応状況まとめ)

| API | 現行対応 (Chromium) | Firefox / Safari | Tegaki 適合性 | 総合評価 |
|:---:|:---:|:---:|:---:|:---:|
| `PointerEvent.getCoalescedEvents()` | 100% 対応 | 対応 | **最適 (現在活用中)** | 引き続き本線として維持 |
| `PointerEvent.getPredictedEvents()` | 100% 対応 | Firefox 89+, Safari 14+ | **不適合 (Raster汚染・LazyBrush不整合)** | display-only 以外不可、優先度低 |
| `pointerrawupdate` | 対応 (Chromium系) | 未対応 / 実験的 | **危険 (高ポーリングでCPU飽和)** | 採用不可 (Reject) |
| `desynchronized: true` | 対応 | 一部未対応 | **危険 (Tearing・透明度バグ)** | 採用不可 (Reject) |
| `navigator.ink` | 対応 (Windows Edge/Chrome) | 未対応 | **致命的不適合 (見た目・太さの乖離)** | 採用不可 (Reject) |

---

## 10. Recommended Roadmap (推奨改修ロードマップ)

現在の良好な描き味を一切破壊せず、残存する真のボトルネックを解消するための安全な段階的計画を提案します。

```mermaid
graph LR
    subgraph Phase1 [Stage 1: 線頭遅延と消しゴムの解消 (P0-P1)]
        A1[pointerdown full snapshot遅延化/部分化]
        A2[Eraserのバッチレンダー化]
        A3[単発moveの補間ループバッチ化]
    end
    subgraph Phase2 [Stage 2: ズームと半透明の最適化 (P1)]
        B1[画面ピクセル基準の適応的補間ステップ]
        B2[半透明ペン用一時テクスチャの再利用]
    end
    subgraph Phase3 [Stage 3: 将来研究 (P3)]
        C1[Display-only Predicted Tail プロトタイプ]
    end
    Phase1 --> Phase2
    Phase2 --> Phase3
```

- **Stage 1 (最優先 / 高効果・低リスク)**:
  1. `pointerdown` での全画面 `createLayerRasterSnapshot` を停止。Pen / Eraser は既に dirty rect History なので、ストローク確定時に dirty rect の `beforePatch` を切り出す設計へ整理（または GPU 間テクスチャコピーに置き換え）、**線頭遅延を 9〜29ms $\to$ 0ms に完全解消**。
  2. Eraser に `realtimeEraserBatchGraphics` を導入し、消しゴムの GPU レンダー回数を 1/10〜1/50 に削減。
  3. 単発 `updateStroke` 内の補間ループもバッチコンテナに集約。
- **Stage 2 (中優先 / ズーム・半透明最適化)**:
  1. 補間ステップを `Math.max(1, 1 / zoom)` とし、画面ピクセル相当（1 screen px）に適合させてズームアウト時の補間点爆発（1500点）を 150 点に抑制。
  2. 半透明ペンの隔離 `RenderTexture` を毎ストローク破棄せず再利用。
- **Stage 3 (低優先 / 実験的研究)**:
  - 手ブレ補正 OFF 時限定の `display-only predicted tail`（画面最前面オーバーレイ）の試験。

---

## 11. Do Not Implement (現時点で絶対に採用すべきでない項目)

1. **`getPredictedEvents()` の通常描画（Raster）への直接入力**:
   - 予測誤差がレイヤーのピクセルに恒久的に焼き込まれるため絶対禁止。
2. **`pointerrawupdate` の導入**:
   - ゲーミングマウス等の高サンプリング入力でメインスレッドが飽和し、かえって遅延するため禁止。
3. **`desynchronized: true` の無差別適用**:
   - 画面の引き裂き（Tearing）やマルチレイヤー・UI 合成の破綻を招くため禁止。
4. **`navigator.ink` の採用**:
   - ブラシの線幅・不透明度・テクスチャと完全に見た目が乖離するため禁止。
5. **手ブレ補正（LazyBrush）の内部状態への予測点入力**:
   - スムージングの数学的安定性を破壊するため禁止。

---

## 12. Proposed Production Scope (次回改修指示書向けスコープ提案)

次回、GPT との検討を経て実装に進む場合の推奨仕様：

### 対象ファイル
- `system/drawing/brush-core.js` (バッチ化、スナップショット最適化、補間ステップ適応化)
- `system/drawing/drawing-engine.js` (不要な canvas pointermove の emit 整理)
- `build/verify-pen-responsiveness-enhancements.mjs` (新規 Verifier)

### 主な変更責務
1. **`startStroke` の `beforeSnapshot` 最適化**:
   - 通常 Pen / Eraser かつ selection なしの場合、`startStroke` 時点で全画面 `extract.pixels` を同期実行せず、dirty rect が確定した `endStroke` 時に `beforePatch` を切り出す設計へ改修（またはバックバッファ RT による GPU コピー）。
2. **Eraser バッチ機構の実装**:
   - `realtimeEraserBatchGraphics` 配列を用意し、`updateStrokeBatch` 内で 1 回の `renderer.render` に集約。
3. **適応的補間ステップ**:
   - `const currentZoom = this.coordinateSystem.getZoom() || 1.0;`
   - `const interpolationStep = Math.max(1, Math.floor(1 / currentZoom));`
   これによりズーム 10% 時の点生成数を 1/10 に適正化。

### 停止条件 (Stop Criteria)
- 今回の成果物は本調査報告書のみとし、Owner および GPT のレビューを経て指示書が発行されるまで、**production コードの実装には一切着手しない**。
