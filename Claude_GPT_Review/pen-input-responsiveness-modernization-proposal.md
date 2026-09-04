# Tegaki ペン入力レスポンス向上 改修提案書

更新日: 2026-09-03
作成: 外部AI（Web版Claude）
確認方法: `system/drawing/pointer-handler.js`、`system/drawing/brush-core.js`の実コード確認、およびMDN・WICG・Chromium/Microsoft公式資料の調査。実機での90Hz/120Hzタブレットによる計測は行っていない。
位置づけ: 実装契約ではなく、CODEXへの検討材料として提出する提案書。

---

## 1. 結論（先に）

Tegakiの現在のペン入力パイプラインは、既にかなりしっかりした基礎を持っている。`getCoalescedEvents()`による取りこぼし防止、筆圧・tiltX/tiltY・twistの取得、`requestAnimationFrame`への描画一本化、複数ストローク区間をまとめてGPUへ送るバッチ処理など、土台は良好である。

その上でさらに「レスポンスを良くする・気持ちよく描ける」を狙うなら、**予測描画（getPredictedEvents）・低遅延canvas（desynchronized）・OSコンポジタへの委譲（Delegated Ink Trail）という、Web標準側で段階的に用意されている3層の改善**が、現状まだ未着手のまま残っている。120Hz対応については、特別な対応コードを新設せずとも構造的には既に対応できる可能性が高く、実装より先に実機計測を行うべき段階だと考える。

---

## 2. 現状の実装評価

`system/drawing/pointer-handler.js`・`system/drawing/brush-core.js`を確認したところ、以下は既に実装されていた。

| 項目 | 状態 |
|---|---|
| `getCoalescedEvents()`によるフレーム間の入力取りこぼし防止 | 実装済み |
| 筆圧・tiltX・tiltY・twistの取得、補正カーブ設定 | 実装済み |
| 実描画の`requestAnimationFrame`への一本化（`_requestLiveCanvasRender`） | 実装済み。1フレーム内の重複描画要求を自動的に間引く |
| リアルタイムペン区間の描画バッチ化（`_renderRealtimePenSegment` / `_flushRealtimePenBatch`） | 実装済み。複数のストローク区切りを1回のGPU描画にまとめている |
| ストローク本体のGPU描画（PixiJS経由） | 実装済み |
| フレーム単位の性能計測フック（`_warnPerf`） | 実装済み |

一方、次の項目は現状のコードに見当たらなかった。

- `getPredictedEvents()`（未来側の予測入力）
- `pointerrawupdate`（`pointermove`より高頻度・低遅延なイベント）
- Desynchronized canvas / 低遅延レンダリングコンテキスト
- Delegated Ink Trail（`navigator.ink`）

---

## 3. 改修案

### 3.1 `getPredictedEvents()` — 未来側の予測入力を使う

Pointer Events仕様には、ブラウザ側が次に来るであろう座標を予測して返す`getPredictedEvents()`がある。実際の入力が届く前に予測位置まで先に描画しておくことで、体感的な遅延を縮める。Tegakiは過去分の取りこぼし防止（`getCoalescedEvents()`）は既に実装しているが、未来側の予測はまだ組み込まれていない。既存の`normalizeEvent`まわりの仕組みに、同様の機能検出パターンで追加できると考えられる。

- 難易度: 低
- 既存コードとの相性: 高い（`getCoalescedEvents`と同じ機能検出パターンを流用できる）

### 3.2 Desynchronized Canvas — 低遅延レンダリング経路

`getContext(..., { desynchronized: true })`のようなオプションにより、ブラウザの二重バッファリング処理の一部を経由しない、より直接的な描画経路を使える。副作用として画面の引き裂き（tearing）が起こり得るが、ペン入力主体のアプリケーションでは許容されることが多い。WICGの仕様書は、これを「土台としての改善」の1つに位置付けている。

- 難易度: 低〜中（tearing発生の実機検証が必要）

### 3.3 `pointerrawupdate` — より高頻度・低遅延なイベント

`pointermove`よりも高頻度に、かつ低遅延に発火するイベントで、予測・desynchronized処理と組み合わせて使うことが前提とされている。現状のコードは`pointermove`のみを使用している。

- 難易度: 低（3.1・3.2とセットで導入するのが自然）

### 3.4 Delegated Ink Trail（`navigator.ink`）— 最もモダンな選択肢

MDN公式の説明。

> The Ink API significantly reduces this latency by allowing browsers to bypass the JavaScript event loop entirely. Where possible, browsers will pass such rendering instructions directly to OS-level compositors.

出典: https://developer.mozilla.org/docs/Web/API/Ink_API

やっていることは、「JS側の描画が間に合っていない区間だけ、OSのコンポジタに“このスタイルで、ここから先を仮描画しておいて”と依頼する」という仕組みである。実装イメージ:

```js
const presenter = await navigator.ink.requestPresenter({ presentationArea: canvasElement });
canvasElement.addEventListener('pointermove', (evt) => {
    // 実際の描画をした直後に、次のフレームまでの「仮の続き」をOSへ委ねる
    presenter.updateInkTrailStartPoint(evt, { color: '...', diameter: brushSize });
});
```

WICGの提案仕様には、3.1〜3.4を段階的な改善として位置付ける記述がある。

> There are currently progressive enhancements available today, such as getPredictedEvents() and Desynchronized canvas, none of these take advantage of system compositors provided by the operating system to achieve better latency.

出典: https://wicg.github.io/ink-enhancement/

Microsoft Edge開発チームの実装例では、Ink APIが使えない環境では3.1〜3.3へ自動的にフォールバックする設計が推奨されている。

```js
try {
    let presenter = await navigator.ink.requestPresenter('delegated-ink-trail', canvas);
    if (presenter.expectedImprovement < minExpectedImprovement) throw new Error("改善見込みが小さいため見送り");
    // Ink APIを使う
} catch (e) {
    // desynchronized canvas + prediction + pointerrawupdate へフォールバック
}
```

出典: https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/WebInkEnhancement/explainer.md

**現状はChrome/Edge限定の実験的機能**である（MDNいわく"not Baseline"）。Firefox/SafariではAPI自体が存在しないため、必ずフォールバック込みで実装する必要がある。Tegaki側は既に`typeof e.getCoalescedEvents === 'function'`のような機能検出パターンを持っているため、同じ書き方で扱えるはずである。

- 難易度: 中（フォールバック設計込み）
- 前提条件: 3.1〜3.3のいずれかがフォールバック先として存在すること

---

## 4. 120Hz対応について

特別な「120Hz対応化」のコードを新設しなくても、現在の設計のままである程度自動的に恩恵を受けられる可能性が高い。MDN公式より。

> The frequency of calls to the callback function will generally match the display refresh rate. The most common refresh rate is 60Hz, though 75Hz, 120Hz, and 144Hz are also widely used.

出典: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame

Tegakiの描画は既に`requestAnimationFrame`に一本化されているため、タブレット・ブラウザ・OSが120Hzを正しく認識していれば、コールバック自体は自動的に120Hzで呼ばれる。**課題は「120Hzに対応させること」ではなく、「120Hzのフレーム予算（約8.3ms、60Hzなら約16.6ms）に、1フレームあたりの実際の描画処理が収まるかどうか」である。** 既に`_warnPerf('brush.renderRealtimePenSegment', ...)`のような計測フックが存在するため、実機の90Hz/120Hzタブレットで実測し、フレーム予算内に収まっているかを確認するのが次の一歩になる。

---

## 5. GPU利用の余地について

ストロークの実描画自体（`renderer.render({...})`）は、既にPixiJS経由でGPU側に十分乗っている。一方、ストロークの「形」を計算する部分（`perfect-freehand`ライブラリによる点列からなめらかな輪郭ポリゴンへの変換）は、性質上CPU側のJS計算である。1ストロークあたりの計算量としては比較的軽く、現時点でこれを問題視する具体的な兆候はコード上見当たらなかった。ボトルネック候補として頭には置きつつ、優先度は3章の各案より低いと考える。

---

## 6. 進め方の提案

1. **計測フェーズ**: 実機の90Hz/120Hzタブレットで、現状の`_warnPerf`計測を使い、1フレームあたりの描画コストを確認する（4章）。
2. **低リスク導入**: 3.1（getPredictedEvents）・3.3（pointerrawupdate）・3.2（desynchronized canvas）を、機能検出とフォールバックを伴う形で個別に導入する。
3. **Ink API導入**: 2.が安定した後、3.4（Delegated Ink Trail）をChrome/Edge向けの追加最適化として、2.の仕組みへのフォールバックを前提に導入する。

---

## 7. 優先順位まとめ

| # | 施策 | 現状 | 難易度 |
|---|---|---|---|
| 1 | `getPredictedEvents()` | 未実装 | 低 |
| 2 | Desynchronized canvas | 未実装 | 低〜中（tearingの検証要） |
| 3 | Delegated Ink Trail（`navigator.ink`） | 未実装 | 中（フォールバック設計込み） |
| 4 | `pointerrawupdate` | 未実装 | 低（3.2と併用が自然） |
| 5 | 120Hz対応 | 構造的には対応済み、要実測 | 実装より計測が先 |

---

## 8. 参考資料

- MDN — Ink API（概要・latency削減の仕組み）
  https://developer.mozilla.org/docs/Web/API/Ink_API
- MDN — DelegatedInkTrailPresenter
  https://developer.mozilla.org/docs/Web/API/DelegatedInkTrailPresenter
- MDN — InkPresenter
  https://developer.mozilla.org/docs/Web/API/InkPresenter
- WICG — Ink Enhancement 仕様書（getPredictedEvents / desynchronized canvasとの位置付け）
  https://wicg.github.io/ink-enhancement/
- WICG — ink-enhancement README（フォールバック実装例）
  https://github.com/WICG/ink-enhancement/blob/main/README.md
- Microsoft Edge Explainers — Web Ink Enhancement（実装例、expectedImprovementによる判定）
  https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/WebInkEnhancement/explainer.md
- Chromium blink-dev — Intent to Ship: Delegated Ink Trails
  https://groups.google.com/a/chromium.org/g/blink-dev/c/ZtqwKR_HIAE/m/t61vWodBBQAJ
- MDN — Window.requestAnimationFrame()（リフレッシュレート追従の仕様）
  https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame

---

## 9. 未検証・対象外

- 実機（90Hz/120Hz対応タブレット）での計測は行っていない。4章・5章の判断は公開資料とコード読解に基づく推定である。
- Desynchronized canvas導入時のtearing発生有無・程度は、実装前にモックアップでの確認が必要。
- Delegated Ink Trailのブラウザ対応状況は今後変化する可能性があるため、導入判断時に改めて最新の対応状況を確認することを推奨する。
- `perfect-freehand`のストローク形状計算コストの実測は行っていない。
