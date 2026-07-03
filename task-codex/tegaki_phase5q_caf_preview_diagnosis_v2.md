# tegaki_phase5q_caf_preview_diagnosis_v2.md

対象: `phase5q_external_ai_failed_attempts_report.md` の分析、および次の一手の提案
前提コミット: `418f72913ece74db342380ef0058f8bb05a6f146`（GitHub上のコード。Attempt 1〜3のローカル差分はGitHub未反映のため未参照。差分は報告書中のコード片のみを根拠にしている）

---

## 結論

Attempt 1〜3（可視性フラグを外側から強制する系の修正）が**すべて無効**だったことは、非常に重要な手がかりです。これは「Layer/Sprite/previewChildのvisible/renderable/culledをどう操作しても症状が変わらない」ことを意味しており、**そもそも可視性の問題ではない**可能性が高いことを示しています。

コードを再度読み直した結果、これと矛盾しない、かつ症状の形（「描画中は見えず、pointerup で一気に確定した内容が現れる」）を可視性理論より正確に説明できる経路を見つけました。

**`BrushCore.finalizeStroke()` には、ストローク中にリアルタイム焼き込みが一度も成立しなかった場合（`hasRealtimeApplied === false`）、ストローク全体をpointerup時に一括で焼き込む フォールバック経路が存在します。** これは可視性・Container階層・クリッピングとは無関係に、「ストローク中は本当にまだ何も描かれていない」→「pointerupで初めて全部描かれる」という、報告されている症状そのものを説明します。Attempt 1〜3が効かなかったことと完全に整合します（見えていないのではなく、まだ存在していない）。

加えて、副次的ですが**独立した実バグ**として、ライブストローク専用に作られていたはずの `_applyDrawingVisibilityPreview()` が、PREVIEW ON中は条件式の不備で**絶対に呼ばれない**（デッドコード化している）ことも発見しました。これは今回の主症状の直接原因ではなさそうですが（Attempt 2でそちら側の再入も潰したのに無効だったため）、別途修正すべき実バグです。

---

## Attempt 1〜3が何を消去したか

| Attempt | 触った層 | 消去できる仮説 |
|---|---|---|
| 1 | `_applyVisibilityPreview()` のゼロ件分岐と `_restoreVisibility()` | 「popup側のプレビューstate machineが破壊的にvisibleを戻す」系の単純な仮説 |
| 2 | `render()` 中の `_applyVisibilityPreview()` 再入 | 「ストローク中にpopupのrender()がpreviewを再構築して隠す」系の仮説 |
| 3 | `strokePreview` / `penOpacityStrokePreview` 子要素のvisible強制 | 「previewGraphics/penOpacityStrokePreviewが何らかの理由で非表示になる」系の仮説 |

3つとも「**Pixiの表示ツリー側で何かがvisible=falseになっている**」という前提に基づく修正でした。これが全滅したということは、**表示ツリーはそもそも正しくvisible=trueのままだった**可能性が高く、問題は「見えるべきものが隠されている」ではなく「**見えるべきもの自体がまだレンダーターゲットに存在しない**」側にあると考えるのが自然です。

---

## 新しい根本原因候補（最有力）

### 候補F: `finalizeStroke()` のフォールバック一括焼き込みが常態化している

**ファイル**: `tegaki_work/system/drawing/brush-core.js`
**関数**: `finalizeStroke()`（1050行目〜）

```js
const hasRealtimeApplied =
    (mode === 'eraser' && this.realtimeEraserApplied) ||
    (mode === 'pen' && this.realtimePenApplied) ||          // ← penモードはこのフラグで判定
    ((mode === 'airbrush' || mode === 'airbrush-erase') && this.realtimeAirbrushApplied) ||
    (mode === 'blur' && this.realtimeBlurApplied);

...
const alreadyApplied = hasRealtimeApplied;
// 通常のペン/消しゴムはドラッグ中のライブ焼き込みを完成形にする。
// pointerup 後に別アルゴリズムで焼き直すと、線幅や軌跡が変わって描画体験が崩れる。
const shouldBakeFinal = !alreadyApplied;

const graphics = shouldBakeFinal
    ? await this.strokeRenderer.renderFinalStroke(strokeData, settings)   // ← ここでストローク全体を一括生成
    : null;
...
if (layerData?.renderTexture && shouldBakeFinal) {
    ...
    this.layerManager.app.renderer.render({
        container: renderContainer,
        target: layerData.renderTexture,   // ← 通常のrealtimeセグメントと同じrenderTextureへ、まとめて焼き込む
        clear: false
    });
}
```

`realtimePenApplied` は `_renderRealtimeStrokePoint()`（498行目）の中で、`mode === 'pen'` の分岐に入ったときだけ `true` になります。

```js
} else if (mode === 'pen') {
    if (distance <= 0) return;
    this._renderRealtimePenSegment(segmentPoints);
    this.realtimePenApplied = true;
}
```

つまり **`updateStroke()`（pointermoveのたびに呼ばれる）が一度もペンモードの実描画セグメントを焼き込まなかった場合、pointerup時に `renderFinalStroke()` でストローク全体を一括生成し、同じ `renderTexture` へ一回で焼き込みます。**

これは「ハズレ」の見た目（ストローク中は無反応、離した瞬間に線が一気に出る）と完全に一致し、かつ **Layer/Sprite/Containerのvisible状態が終始正しくても発生しうる**ため、Attempt 1〜3が無効だったことと矛盾しません。

**残る問い**: なぜ一部のストロークだけ `updateStroke()`（＝`_renderRealtimeStrokePoint`）がpenセグメントの実描画に一度も入らないのか。

現状コードを読む限り、`DrawingEngine._handlePointerMove()` → `brushCore.isActive()` → `updateStroke()` → `_renderRealtimeStrokePoint()` の経路は、AnimationTablePopup側の状態（`isPreviewActive` / `isDrawingPreviewSuspended` / working Layerの可視性など）を一切参照していません。ここは**popupのコードを直接読んでも原因を特定できない**領域であり、実機でのログ計測が必須です（後述の計測案を参照）。

考えられる机上の可能性（優先度順、いずれも未検証）:

1. `_handleBeforeStrokeStart()` / `_handleDrawingStarted()` 内の同期処理（`_applyVisibilityPreview()` や `refreshClippingMasks()` など、GPU `renderer.render()` を伴う重い処理を含む）が pointerdown ハンドラの中で数〜数十ms かかっており、その間にブラウザ側で最初の数回の pointermove がまとめて配信される（coalesced events）。`_handlePointerMoveBatch()` → `updateStrokeBatch()` の分岐に入った場合、`distance <= 0.5` の間引き判定（`_renderRealtimeStrokePoint` 503行目）により、密集した座標がまとめて「移動量ゼロ扱い」で捨てられ、実質的に最初の描画区間がスキップされる可能性がある。
2. `strokeTargetLayer` は正しく固定されているが、`coordinateSystem.worldToLocal()` が使う `activeLayer` の変換行列が、`_ensureLayerRasterFrameForStroke()`（`ensureLayerRasterBoundsForRect` 経由でLayerの `rasterBounds` / `layerSprite.position` を変更しうる）実行直後の一瞬だけズレており、`localX/localY` の差分計算が異常値（極端に大きい/小さい distance）になって、以後の `_renderRealtimeStrokePoint` の間引き判定を毎回外している。
3. `penOpacityState` 分岐（不透明度100%未満のとき有効）に本来入らないはずが、何らかの理由で `_shouldUsePenOpacityIsolation()` の判定がブレて `penOpacityState` が生成されず、かつ通常経路の `renderTarget` 解決にも失敗している。

いずれも「実機ログで `realtimePenApplied` の推移と `updateStroke()` の呼び出し回数を見る」以外に切り分ける方法がありません。

---

## 独立して見つかった実バグ（副次的、今回の主症状ではない可能性が高いが要修正）

### `_applyDrawingVisibilityPreview()` が PREVIEW ON 中は絶対に呼ばれない

**ファイル**: `tegaki_work/ui/animation-table-popup.js`
**関数**: `render()` 内のプレビュー適用判定（6449行目付近）

```js
if (this.isLaneOnlySelected) {
    this._restoreVisibility();
} else if (this.isDrawingPreviewSuspended && !this.isPreviewActive) {   // ← !this.isPreviewActive が矛盾
    this._applyDrawingVisibilityPreview();
} else if (this.isClipEditModeActive || this.isTransformPreviewSuspended) {
    this._restoreVisibility();
} else if (this.isPreviewActive) {
    this._applyVisibilityPreview();
}
```

`_applyDrawingVisibilityPreview()`（592行目）は、コメントに **「Live stroke keeps only the selected CAF working layer visible. Rebuilding same-frame CAF preview while the pen is down can flash as each CAF texture updates.」** と明記されている、まさに「ライブストローク専用の、フレーム合成を毎回作り直さない軽量パス」です。しかし呼び出し条件が `isDrawingPreviewSuspended && !isPreviewActive` になっており、**PREVIEW ON中は `isPreviewActive === true` なので絶対にこの分岐に入らず**、代わりに一つ下の `else if (this.isPreviewActive) { this._applyVisibilityPreview(); }`（＝今回何度も調査した重い汎用パス）に必ず落ちます。

つまり **「軽量・毎回作り直さない」ために別途用意されていた専用ロジックが、ガード条件のtypoのような不備で永久に使われていない状態**です。これは今回の症状の直接原因ではなさそうです（Attempt 2で `_applyVisibilityPreview()` の再入自体は別途潰しても改善しなかったため）が、独立した実バグとして修正価値があります。おそらく本来の意図は

```js
} else if (this.isDrawingPreviewSuspended) {
    this._applyDrawingVisibilityPreview();
}
```

のように、`isPreviewActive` の有無に関わらず「ストローク中は専用の軽量パスを使う」だったと推測されます（`_applyDrawingVisibilityPreview()` 内部は `isPreviewActive` を条件に含んでいないため、呼び出し側だけの条件ミスに見えます）。

---

## 優先調査ポイント（更新版）

1. **`realtimePenApplied` が実際にストローク中に `true` になっているか**（候補F）。これが最優先。
2. `_renderRealtimeStrokePoint()` 内の `distance <= 0.5` 間引き判定が、ハズレ時のストローク開始直後に異常な `distance` 値（0付近に張り付く、または裏で座標が飛ぶ）を出していないか。
3. `updateStroke()` / `updateStrokeBatch()` が pointermove のたびに実際に呼ばれているか（呼ばれてはいるが中身がスキップされているのか、そもそも呼ばれていないのか、の切り分け）。
4. `_applyDrawingVisibilityPreview()` のガード条件修正（独立修正・今回症状への効果は未知数だが、いずれ直すべき）。
5. （保留）候補1・候補2（前回報告の `_restoreVisibility()` / クリッピング系）は、Attempt 1〜3により**単独では原因ではない**ことがほぼ確定。ただし候補Fの解決後も残存する副症状として再浮上する可能性はゼロではないため、完全に捨てず保留に留める。

---

## 最小修正案

現時点では**確証を持った修正案を出すのはまだ早い**と判断します。候補Fが正しければ修正対象は「なぜ realtime セグメントが焼き込まれないか」という**未特定の上流原因**であり、それを知らずに `finalizeStroke()` 側だけをいじる（例：`shouldBakeFinal` を常に false にする、等）のは、二重描画や線幅崩れ（コード中コメント「pointerup 後に別アルゴリズムで焼き直すと、線幅や軌跡が変わって描画体験が崩れる」）を引き起こすリスクが高く、推奨しません。

そのため、今回は**計測を先行させる**ことを提案します（下記）。

唯一、**副作用がほぼゼロで独立して直してよい**のは `_applyDrawingVisibilityPreview()` のガード条件修正です。

**対象**: `tegaki_work/ui/animation-table-popup.js` の `render()` 内、6452行目
**変更**:
```js
- } else if (this.isDrawingPreviewSuspended && !this.isPreviewActive) {
+ } else if (this.isDrawingPreviewSuspended) {
      this._applyDrawingVisibilityPreview();
```
**リスク**: `_applyDrawingVisibilityPreview()` 自体は表示専用の副作用（`layer.visible`、preview container差し替え）のみで、`layerData` 正本・Undo/Redo・ClipAsset・DrawingSnapshotには触れていないことをコードから確認済み。ただし、この分岐に入る頻度が増えることで、`_drawingPreviewCompositeKey` のキャッシュ判定（609行目）が今回の主症状にどう影響するかは未検証のため、**この修正単体を先に適用し、症状が変わるかどうか（改善・悪化・無変化のいずれか）を観察するだけでも診断情報になります**。

---

## リスク

- 候補Fが正しい場合、真因は `brush-core.js` の realtime 焼き込み判定そのもの、または pointer イベント配信のタイミングにある可能性があり、**AnimationTablePopup側のコードだけをいくら直しても解決しない**可能性があります。今後の調査は `animation-table-popup.js` から `drawing-engine.js` / `brush-core.js` / `pointer-handler.js` 側へ主軸を移すことを推奨します。
- `_applyDrawingVisibilityPreview()` のガード修正は独立性が高いですが、`isDrawingPreviewSuspended` が真になる他の経路（Table を閉じた直後の後始末処理など）と干渉しないか、`isDrawingPreviewSuspended` の設定/解除箇所を一通り確認してから適用してください。
- 保存正本・export・Undo/Redo・Layer visibility正本には、今回検討した経路（`_applyVisibilityPreview`系、`_restoreVisibility`、`refreshClippingMasks`、`finalizeStroke`のrealtime判定）のいずれも触れていないことをコード上確認済みです。

---

## 推奨する計測（パッチより先に実施すべき）

`window.TEGAKI_CONFIG?.debug === true` の裏で、以下を追加することを提案します。ユーザー側の提案リストと重複する部分は統合し、**候補Fの検証に絞って優先順位を付け直しています**。

1. `BrushCore.updateStroke()` の先頭で、呼び出し回数をインクリメントするカウンタ（`this._debugMoveCallCount`）。
2. `BrushCore._renderRealtimeStrokePoint()` の `if (!force && distance <= 0.5) return;` の直前で、`mode`・`distance`・`this.lastRenderedLocalX/Y`・`localX/Y` をログ（間引かれて return するケースを可視化する）。
3. `BrushCore._renderRealtimePenSegment()` 内で、実際に `renderer.render()` を呼んだ回数（`this._debugRealtimeBakeCount`）。
4. `BrushCore.finalizeStroke()` の `shouldBakeFinal` 確定直後に、`hasRealtimeApplied` / `this._debugMoveCallCount` / `this._debugRealtimeBakeCount` をまとめてログ。

**期待する比較**:
- 「当たり」ストロークでは `_debugRealtimeBakeCount > 0` かつ `hasRealtimeApplied === true`。
- 「ハズレ」ストロークで `_debugMoveCallCount` が0または極端に少ない → pointermove配信自体の問題（ブラウザ/coalescing/イベントリスナー側）。
- 「ハズレ」ストロークで `_debugMoveCallCount` は十分あるが `_debugRealtimeBakeCount` が0 → `distance <= 0.5` 間引き判定または座標変換の異常。
- 「ハズレ」ストロークで両方とも十分な値だが、なお画面に出ない → 候補F自体が誤りで、可視性理論に立ち戻る必要がある（Attempt 1〜3が本当に正しく適用されていたかも再確認）。

この4パターンの切り分けができれば、次の修正は当てずっぽうではなく確証を持って行えます。
