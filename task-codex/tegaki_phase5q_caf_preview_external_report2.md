# Tegaki Phase 5q CAF preview live stroke 診断報告書

作成日: 2026-07-03
対象: Animation Table PREVIEW 中、複数 CAF / Lane がある状態での live stroke 表示不安定化

## 0. 結論

現時点の本命は、BrushCore の realtime 焼き込みそのものではなく、AnimationTablePopup 側で「stroke 中に見せる表示面」が固定されていないことです。BrushCore ログが `outcome:"realtime"` で、`penRenderCalls` と `liveRenderExecuted` が増えているなら、GPU への書き込みと `app.render()` 呼び出しは少なくとも走っています。したがって診断対象は、RenderTexture への書き込み後に PixiJS の display tree 上でその texture が正しい Sprite として、正しい container order で、同一 frame 内に表示対象として残っているか、です。

`RenderTexture` を直接参照する overlay Sprite 方式は、このケースでは妥当です。ただし、妥当なのは「BrushCore が実際に更新している live display surface をすべて overlay に写す」場合だけです。現在の試行差分のように `layerData.renderTexture` だけを overlay Sprite に持たせる方式は、pen opacity isolation、airbrush preview、RenderTexture 再確保、clipping child、previewGraphics child のいずれかが絡むと live 面と表示面が分離します。

優先修正は、PREVIEW 中の stroke では「選択 CAF の現frame合成からの除外」「live overlay の生成」「元 working layer の非表示」を `drawing:stroke-started` で一度だけ確定し、`drawing:stroke-updated` では overlay の texture / position / alpha / blendMode / transient child だけを同期することです。`stroke-updated` で `_showSelectedClipWorkingLayers()` や `refreshClippingMasks()` を毎回通す構造は避けるべきです。

## 1. 事実と推測の分離

### 確認できた事実

- `brush-core.js` は `startStroke()` で `this.strokeTargetLayer = activeLayer` を保持しており、stroke 中の target layer drift を避ける方向になっています。
- `startStroke()` は `_ensureLayerRasterFrameForStroke(activeLayer, settings, currentMode)` を呼び、通常 Layer / CAF working Layer の raster bounds を stroke 前に広げる契約を持っています。
- animation working layer では `drawing:stroke-started` を `previewGraphics` 生成前に emit する分岐があります。
- pen の realtime path は `_renderRealtimePenSegment(points)` で `renderer.render({ container, target: renderTarget, clear:false })` を呼びます。
- pen opacity が 1 未満の場合、`renderTarget` は `activeLayer.layerData.renderTexture` ではなく `this.penOpacityState.texture` になります。
- `_beginPenOpacityStroke()` は `penOpacityStrokePreview` Sprite を working layer の child として追加します。
- `_requestLiveCanvasRender()` は `requestAnimationFrame` で `app.render()` または `app.renderer.render({ container: app.stage })` を呼びます。
- `animation-table-popup.js` の `_applyDrawingVisibilityPreview()` は選択CAFを live 描画対象として扱い、他の preview を staging container に入れ替え、`_hideTimelineLayersForPreview(... preserveWorkingLayerIds ...)` と `_showSelectedClipWorkingLayers()` を呼びます。
- `_showSelectedClipWorkingLayers()` は working layer の `visible` を直接変更し、`refreshClippingMasks()` も呼びます。
- `_keepDrawingPreviewWorkingLayerVisible()` は `_showSelectedClipWorkingLayers()`、`_forceAnimationWorkingLayerVisible()`、`_syncDrawingLiveStrokeOverlay()` を連続して呼ぶ構造になっています。
- `_syncDrawingLiveStrokeOverlay()` は overlay Sprite を `new Sprite(layerData.renderTexture)` で作り、`sprite.texture !== layerData.renderTexture` なら同期し、最後に `workingLayer.visible = false` にします。
- `LayerModel.initializeTexture()` は `RenderTexture.create()` と `new Sprite(this.renderTexture)` を作るため、RenderTexture 差し替え時には Sprite 側 texture 参照の再同期が必要です。

### 推測

- 「外れ回でも BrushCore ログは realtime」という症状から、失敗点は BrushCore の segment render ではなく、overlay / working layer / preview composite の表示経路の不一致である可能性が高いです。
- stroke 中の点滅は、同じ working layer を `_showSelectedClipWorkingLayers()` で可視化し、その直後に `_syncDrawingLiveStrokeOverlay()` で非表示にする visible toggle が主因の可能性が高いです。
- move ごとの可視化 toggle を止めると点滅が消えるが当たり外れが戻る、という観察は「overlay は必要だが、overlay が参照している live surface が不完全」という状態と整合します。
- pen opacity が 1 未満の設定で再現している場合、`layerData.renderTexture` overlay だけでは live stroke を表示できません。stroke 中の描画は一時 texture `penOpacityState.texture` と `penOpacityStrokePreview` Sprite に出ており、`layerData.renderTexture` へ反映されるのは commit 時です。

## 2. 最も疑わしい原因トップ3

### 1位: overlay Sprite が BrushCore の実 live surface を取りこぼしている

最も疑わしい原因です。現在の overlay は `layerData.renderTexture` を直接参照します。しかし BrushCore の pen path は常に `layerData.renderTexture` へ描くとは限りません。`_shouldUsePenOpacityIsolation()` が true のとき、`_renderRealtimePenSegment()` の `renderTarget` は `this.penOpacityState.texture` になります。その live texture は `penOpacityStrokePreview` Sprite として working layer child に追加されます。

この状態で AnimationTablePopup が元 working layer を `visible = false` にすると、`penOpacityStrokePreview` も一緒に見えなくなります。overlay 側が `layerData.renderTexture` しか表示していなければ、stroke 中の live stroke は overlay に出ません。pointerup 後に `_commitPenOpacityStroke()` が `penOpacityState.texture` を本体 RenderTexture へ合成して初めて表示されます。これは「stroke 中に表示されず、pointerup 後にまとめて表示される」症状と非常に強く一致します。

根拠になる関数:

- `BrushCore.startStroke()`
- `BrushCore._shouldUsePenOpacityIsolation()`
- `BrushCore._beginPenOpacityStroke()`
- `BrushCore._renderRealtimePenSegment()`
- `BrushCore._commitPenOpacityStroke()`
- `AnimationTablePopup._syncDrawingLiveStrokeOverlay()`
- `AnimationTablePopup._ensureWorkingLayerDisplaySurface()`

最小診断ログ:

```js
// BrushCore._renderRealtimePenSegment()
console.info('[TegakiLiveSurface:brush-render]', {
  strokeId: this.strokeInputProfile?.id,
  mode: this.getMode?.(),
  layerId: activeLayer?.layerData?.id,
  penOpacityIsolation: !!this.penOpacityState,
  renderTargetKind: this.penOpacityState ? 'penOpacityState.texture' : 'layerData.renderTexture',
  renderTargetSize: renderTarget ? { width: renderTarget.width, height: renderTarget.height } : null,
  layerTextureSize: activeLayer.layerData?.renderTexture
    ? { width: activeLayer.layerData.renderTexture.width, height: activeLayer.layerData.renderTexture.height }
    : null,
  previewSpriteParent: !!this.penOpacityState?.previewSprite?.parent,
  previewSpriteVisible: this.penOpacityState?.previewSprite?.visible ?? null
});
```

```js
// AnimationTablePopup._syncDrawingLiveStrokeOverlay()
console.info('[TegakiLiveSurface:overlay-sync]', {
  phase,
  layerId: layerData.id,
  overlayKey: this._liveStrokeOverlayKey,
  hasLayerRenderTexture: !!layerData.renderTexture,
  layerTextureSize: layerData.renderTexture
    ? { width: layerData.renderTexture.width, height: layerData.renderTexture.height }
    : null,
  copiedTransientChildren: [...(workingLayer.children || [])]
    .filter(child => child?.label === 'penOpacityStrokePreview' || child?.label === 'airbrushStrokePreview')
    .map(child => ({ label: child.label, visible: child.visible, alpha: child.alpha, hasTexture: !!child.texture })),
  workingLayerVisibleBefore,
  workingLayerVisibleAfter: workingLayer.visible,
  overlayContainerIndex: overlayContainer.parent?.getChildIndex?.(overlayContainer) ?? null
});
```

最小修正案:

- overlay を「layerData.renderTexture 1枚」ではなく「working layer の live display surface を複製表示する container」にする。
- 各 working layer について、少なくとも次の2層を overlay group に入れる。
  - base: `layerData.renderTexture` の Sprite。位置は `normalizeRasterBounds(layerData.rasterBounds)`。
  - transient: working layer child のうち `penOpacityStrokePreview`、`airbrushStrokePreview`、必要なら `strokePreview`。Sprite child なら同じ `texture` を参照する clone Sprite を overlay 側に作り、position / alpha / blendMode / visible を同期する。
- BrushCore 側から `drawing:stroke-started` / `drawing:stroke-updated` payload に `liveRenderTargetKind` を入れると診断しやすい。実装を小さくするなら、AnimationTablePopup 側で `workingLayer.children` を直接走査するだけでもよい。
- opacity 1.0 の pen だけを前提にしない。

副作用リスク:

- transient child を overlay に複製する際、clipping mask / inverse clipping を見落とすと clipping layer の表示が一時的に変わる。
- base RT と transient preview の両方を出すため、元 working layer が見えたままだと二重表示になる。overlay session 中は元 working layer を一度だけ非表示に固定する必要がある。
- `Graphics` child をそのまま clone できない場合がある。まずは `penOpacityStrokePreview` / `airbrushStrokePreview` の Sprite child 対応を優先し、Graphics preview は別ログで検出する。

### 2位: `_showSelectedClipWorkingLayers()` と overlay sync が同じ stroke move 内で visible を反転している

現在の `_keepDrawingPreviewWorkingLayerVisible()` は、まず `_showSelectedClipWorkingLayers()` で working layer を visible にし、次に `_forceAnimationWorkingLayerVisible()` を通し、最後に `_syncDrawingLiveStrokeOverlay()` で同じ working layer を `visible = false` にします。`_showSelectedClipWorkingLayers()` は `refreshClippingMasks()` も呼びます。つまり stroke update ごとに「表示する」「mask を更新する」「overlay に同期する」「元 layer を隠す」という display tree 変更が走ります。

この構造では、`app.render()` がどのタイミングで入るかにより、元 working layer が見える frame、overlay だけが見える frame、両方またはどちらも不安定な frame が混ざります。ユーザーの観察で「move ごとの Layer 本体可視化を止めると点滅は消えた」は、この原因と一致します。

根拠になる関数:

- `AnimationTablePopup._keepDrawingPreviewWorkingLayerVisible()`
- `AnimationTablePopup._showSelectedClipWorkingLayers()`
- `AnimationTablePopup._forceAnimationWorkingLayerVisible()`
- `AnimationTablePopup._syncDrawingLiveStrokeOverlay()`
- `LayerSystem.refreshClippingMasks()`

最小診断ログ:

```js
// AnimationTablePopup._keepDrawingPreviewWorkingLayerVisible()
console.info('[TegakiLiveStroke:visibility-chain]', {
  phase,
  layerId: targetLayerId,
  isDrawingPreviewSuspended: this.isDrawingPreviewSuspended,
  previewActive: this.isPreviewActive,
  beforeVisible: targetLayer?.visible,
  shown,
  forced,
  overlaySynced,
  afterVisible: targetLayer?.visible,
  calledShowSelectedClipWorkingLayers: true
});
```

最小修正案:

- `_showSelectedClipWorkingLayers()` を「working layer の一覧解決」と「実際の visible 書き換え」に分離する。
- live overlay session 中の `drawing:stroke-updated` では `_showSelectedClipWorkingLayers()` を呼ばない。
- `drawing:stroke-started` で一度だけ次の順に実行する。
  1. `isDrawingPreviewSuspended = true`
  2. 選択 CAF を現frame preview composite から除外した preview を作る
  3. overlay group を作る
  4. overlay の base / transient textures を同期する
  5. 元 working layer を `visible = false` に固定する
  6. `app.render()` を requestAnimationFrame で1回予約する
- `drawing:stroke-updated` では overlay group の参照と表示属性だけ同期する。元 working layer の visible は触らない。
- `drawing:stroke-completed` / `drawing:stroke-cancelled` で overlay を破棄し、元 working layer を戻し、通常 preview に復帰する。

副作用リスク:

- live overlay session 中に user が selectedCel / frame / lane を変えた場合、古い overlay が残る可能性がある。session key に `clipId`, `assetId`, `frameIndex`, `activeLaneId`, `workingLayerIds` を持ち、変化したら session を cancel して `_restoreVisibility()` へ逃がす。
- `refreshClippingMasks()` を move ごとに呼ばなくなるため、stroke 中に clipping 状態が変更された場合は即時反映されない。ただし stroke 中に clipping 設定を変える操作は通常発生しないので許容しやすい。

### 3位: preview key / container rebuild が stroke 中に混ざり、live overlay の親子順または寿命が揺れている

`_animationPreviewKey` と `_drawingPreviewCompositeKey` は preview 再構築の抑制に使われています。しかし stroke 中に frame / lane / onion / preview scope / selected entry が変化した扱いになると、`_applyVisibilityPreview()` または `_applyDrawingVisibilityPreview()` が container children を入れ替えます。live overlay が別 container で上にあっても、`_ensurePreviewContainer()` や `_clearAnimationPreviewContainer()` 系が走ると parent / child order が変わる可能性があります。

ユーザーの観察では Timeline 側 / Lane 側どちらも「ガチャ状態」になるとのことなので、単一 lane の z-index だけでなく、stroke 中に preview 管理 state が再評価されている可能性があります。ただし、これは 1位・2位に比べると二次要因と見ます。

根拠になる関数:

- `AnimationTablePopup._applyVisibilityPreview()`
- `AnimationTablePopup._applyDrawingVisibilityPreview()`
- `AnimationTablePopup._buildAnimationPreviewStateKey()`
- `AnimationTablePopup._buildDrawingPreviewCompositeKey()`
- `AnimationTablePopup._ensurePreviewContainer()`
- `AnimationTablePopup._replacePreviewContainerChildren()`
- `AnimationTablePopup._clearAnimationPreviewContainer()`
- `AnimationTablePopup.requestUpdate()`
- `AnimationTablePopup.render()`

最小診断ログ:

```js
console.info('[TegakiPreviewTree:mutation]', {
  reason,
  strokeActive: this._liveStrokeSession?.active === true,
  animationPreviewMode: this._animationPreviewMode,
  animationPreviewKey: this._animationPreviewKey,
  drawingPreviewCompositeKey: this._drawingPreviewCompositeKey,
  nextKey,
  backParent: !!this.animationPreviewBackContainer?.parent,
  frontParent: !!this.animationPreviewContainer?.parent,
  liveParent: !!this.animationPreviewLiveStrokeContainer?.parent,
  childOrder: this.layerSystem?.currentFrameContainer?.children?.map(child => child.label || child.name || child.layerData?.id)
});
```

最小修正案:

- live stroke session 中は `_drawingPreviewCompositeKey` を session start 時に固定する。
- `requestUpdate()` / `render()` が stroke 中に入っても、selected clip / frame / lane が変わっていない限り preview composite を再構築しない。
- `_ensurePreviewContainer()` は毎回 child index を正規化する。
  - background substitute
  - preview back container
  - preview front/onion container
  - live stroke overlay container
  - operation indicator / selection UI があるならそれより下か上かを明示
- `_clearAnimationPreviewContainer()` は live stroke session 中に `animationPreviewLiveStrokeContainer` を破棄しない。live overlay は `_clearDrawingLiveStrokeOverlay()` だけが所有する。

副作用リスク:

- stroke 中に preview scope を切り替えた場合、反映が stroke 完了まで遅れる。
- container order を強制正規化すると、他 UI overlay との前後関係が変わる可能性がある。最初に debug log で child order を確認してから固定する。

## 3. 具体的な回答

### Q1. `RenderTexture` を直接参照する overlay Sprite 方式は妥当か

妥当です。ただし「現在 stroke 中にユーザーへ見せるべき live surface」が本当にその `RenderTexture` である場合に限ります。通常 opacity 1.0 の pen / eraser で、BrushCore が `activeLayer.layerData.renderTexture` に直接 render しているなら、overlay Sprite が同じ RenderTexture を参照する設計は局所修正として適切です。

しかし、現在の BrushCore には pen opacity isolation があります。opacity が 1 未満なら live stroke は `penOpacityState.texture` と `penOpacityStrokePreview` Sprite に出ます。この場合、`layerData.renderTexture` だけを overlay しても live stroke は出ません。したがって overlay は「RenderTexture 直接参照方式」ではなく「working layer display surface 複製方式」に近づけるべきです。base は `layerData.renderTexture`、stroke 中の transient surface は `penOpacityStrokePreview.texture` などを同じ overlay group に載せます。

### Q2. overlay 作成タイミング、texture 再同期タイミング、元 working layer 非表示タイミング

推奨順序は次です。

1. `drawing:before-stroke-start`
   - 自動キャプチャ、履歴前状態、選択CAF保存など、stroke 前の準備だけに使う。
   - preview container の本格切り替えや overlay 作成はここでは行わない。
   - 理由: BrushCore の `_ensureLayerRasterFrameForStroke()` がこの後に RenderTexture / rasterBounds を変更する可能性があるため。

2. `BrushCore.startStroke()` 内部
   - active layer を `strokeTargetLayer` に固定。
   - `_ensureLayerRasterFrameForStroke()` で raster bounds を確定。
   - pen opacity isolation が必要なら `_beginPenOpacityStroke()` で transient texture / Sprite を作る。
   - animation working layer の場合、`drawing:stroke-started` を previewGraphics 生成前に emit。

3. `drawing:stroke-started`
   - AnimationTablePopup 側で live stroke session を開始。
   - 現frame preview composite から選択CAFを除外。
   - live overlay group を生成。
   - base `layerData.renderTexture` と transient child textures を同期。
   - 元 working layer をここで一度だけ `visible = false` にする。
   - overlay を最上位 live stroke container に置く。
   - UI 側で `requestAnimationFrame` render を1回予約。

4. `drawing:stroke-updated`
   - `_showSelectedClipWorkingLayers()` は呼ばない。
   - `refreshClippingMasks()` も原則呼ばない。
   - overlay group の texture / position / alpha / blendMode / transient child だけ同期。
   - RenderTexture が差し替わっていた場合は `sprite.texture = layerData.renderTexture` を即時更新。
   - UI 側で coalesced render を予約。

5. `drawing:stroke-completed` / `drawing:stroke-cancelled`
   - overlay を破棄。
   - 元 working layer visibility を restore。
   - selected CAF を保存 / restore したうえで通常 preview に戻す。
   - `cancelled` 時は BrushCore 側が texture を戻した後の表示を正とする。

### Q3. `drawing:before-stroke-start` と `drawing:stroke-started` のどちらで preview を切り替えるべきか

preview の本格切り替えは `drawing:stroke-started` です。

理由は、`before-stroke-start` 時点では active layer の raster expansion、RenderTexture 再確保、pen opacity isolation 用 transient texture の生成がまだ確定していない可能性が高いためです。ここで overlay を作ると、作成直後に `layerData.renderTexture` / `rasterBounds` / `layerSprite` が差し替わり、overlay が古い texture や古い position を参照する余地が残ります。

`before-stroke-start` は、保存・履歴・auto capture・preview rebuild 抑制フラグの予約に限定するのがよいです。実際の display tree 切り替えは `stroke-started` に寄せます。

### Q4. `app.render()` は BrushCore 側で呼び続けるべきか、AnimationTablePopup 側へ寄せるべきか

設計上は AnimationTablePopup 側へ寄せる方がよいです。理由は、BrushCore は RenderTexture へ描いたことは知っていますが、その RenderTexture を「どの Sprite / container / overlay で見せるべきか」は知りません。PREVIEW 中の live stroke は AnimationTablePopup が display-only 契約を管理しているため、overlay 同期後に AnimationTablePopup が render を予約する方が race を減らせます。

ただし最小修正としては、BrushCore の `_requestLiveCanvasRender()` をすぐ削除しなくてよいです。通常 layer の realtime 表示や既存挙動への影響を避けるため、次の段階的整理を推奨します。

- 短期: BrushCore の `app.render()` は残す。AnimationTablePopup も overlay sync 後に coalesced render を予約する。二重 requestAnimationFrame は coalesce されるなら許容。
- 中期: `drawing:stroke-updated` payload に `requiresDisplayRender: true` / `renderReason` を入れ、AnimationTablePopup が live preview session 中だけ render を所有する。
- 長期: BrushCore は「texture が更新された」イベントだけ emit し、UI / canvas host が render scheduling を担当する。ただし今回の局所修正ではここまで広げない。

## 4. 追加すべき最小診断ログ一覧

### A. BrushCore: stroke start 後の target 確定ログ

場所: `startStroke()` の `_ensureLayerRasterFrameForStroke()` 後、`drawing:stroke-started` emit 直前。

```js
console.info('[TegakiLiveStroke:start-target]', {
  strokeId: this.strokeInputProfile?.id,
  mode: currentMode,
  layerId: activeLayer.layerData?.id,
  isAnimationWorkingLayer: activeLayer.layerData?.isAnimationWorkingLayer === true,
  rasterBounds: this._getLayerRasterBounds(activeLayer),
  renderTextureSize: activeLayer.layerData?.renderTexture
    ? { width: activeLayer.layerData.renderTexture.width, height: activeLayer.layerData.renderTexture.height }
    : null,
  penOpacityIsolation: !!this.penOpacityState,
  penOpacityTextureSize: this.penOpacityState?.texture
    ? { width: this.penOpacityState.texture.width, height: this.penOpacityState.texture.height }
    : null,
  previewSpriteParent: !!this.penOpacityState?.previewSprite?.parent
});
```

### B. BrushCore: realtime render target ログ

場所: `_renderRealtimePenSegment()` / `_renderRealtimeEraserSegment()`。

```js
console.info('[TegakiLiveStroke:rt-write]', {
  strokeId: this.strokeInputProfile?.id,
  mode: this.getMode?.(),
  layerId: activeLayer?.layerData?.id,
  targetKind: this.penOpacityState ? 'penOpacityState.texture' : 'layerData.renderTexture',
  hasLayerTexture: !!activeLayer?.layerData?.renderTexture,
  hasTarget: !!renderTarget,
  points: points?.length || 0,
  liveRenderPending: this.liveRenderFrameRequest !== null
});
```

### C. AnimationTablePopup: overlay sync ログ

場所: `_syncDrawingLiveStrokeOverlay()` の入り口、overlayEntries 作成後、各 sprite 同期後。

```js
console.info('[TegakiLiveStroke:overlay-sync]', {
  phase,
  selectedCelId: this.selectedCelId,
  currentFrame: this.model?.playback?.currentFrame,
  overlayKey,
  targetLayerId: layerId,
  entryCount: overlayEntries.length,
  layerEntries: overlayEntries.map(({ workingLayer, layerData }) => ({
    id: layerData.id,
    workingVisible: workingLayer.visible,
    layerTextureSize: layerData.renderTexture
      ? { width: layerData.renderTexture.width, height: layerData.renderTexture.height }
      : null,
    rasterBounds: layerData.rasterBounds,
    transientChildren: [...(workingLayer.children || [])]
      .filter(child => child?.label === 'penOpacityStrokePreview' || child?.label === 'airbrushStrokePreview' || child?.label === 'strokePreview')
      .map(child => ({ label: child.label, visible: child.visible, alpha: child.alpha, blendMode: child.blendMode, hasTexture: !!child.texture }))
  }))
});
```

### D. AnimationTablePopup: preview tree mutation ログ

場所: `_ensurePreviewContainer()`、`_replacePreviewContainerChildren()`、`_clearAnimationPreviewContainer()`、`_applyVisibilityPreview()`、`_applyDrawingVisibilityPreview()`。

```js
console.info('[TegakiPreviewTree:mutation]', {
  reason,
  liveStrokeActive: this._liveStrokeSession?.active === true,
  isDrawingPreviewSuspended: this.isDrawingPreviewSuspended,
  animationPreviewMode: this._animationPreviewMode,
  animationPreviewKey: this._animationPreviewKey,
  drawingPreviewCompositeKey: this._drawingPreviewCompositeKey,
  childOrder: this.layerSystem?.currentFrameContainer?.children?.map((child, index) => ({
    index,
    label: child.label || child.name || child.layerData?.id || null,
    visible: child.visible
  }))
});
```

## 5. 最小修正案

### Patch 1: live stroke session を導入する

AnimationTablePopup に次を追加します。

```js
this._liveStrokeSession = null;
this._liveStrokeRenderRequest = null;
```

session の shape は次程度で十分です。

```js
{
  active: true,
  strokeId,
  clipId,
  assetId,
  frameIndex,
  layerIds: new Set([...]),
  startedAt: performance.now()
}
```

`drawing:stroke-started` で session を開始し、`drawing:stroke-completed` / `drawing:stroke-cancelled` で終了します。session 中に `clipId`, `frameIndex`, `assetId`, `layerIds` が変わったら、overlay を破棄して安全側に倒します。

### Patch 2: `_showSelectedClipWorkingLayers()` を move loop から外す

現状の `_keepDrawingPreviewWorkingLayerVisible()` は live overlay session 中に次のような形へ変えます。

```js
_keepDrawingPreviewWorkingLayerVisible(layerId = null) {
  if (!this.layerSystem) return false;

  const targetLayerId = layerId || this.layerSystem.getActiveLayer?.()?.layerData?.id || null;
  if (!targetLayerId || !this._isAnimationWorkingLayerId(targetLayerId)) return false;

  if (this._liveStrokeSession?.active === true && this.isPreviewActive === true) {
    const synced = this._syncDrawingLiveStrokeOverlay(targetLayerId, { phase: 'update' });
    this._requestLiveStrokeRender('stroke-updated-overlay-sync');
    return synced;
  }

  const shown = this._showSelectedClipWorkingLayers();
  const forced = this._forceAnimationWorkingLayerVisible(targetLayerId);
  return forced || shown;
}
```

`_showSelectedClipWorkingLayers()` 自体は stroke start 時の初期化・通常 preview 復帰時にだけ使います。

### Patch 3: overlay を group 化し、transient child を拾う

現在の `_liveStrokeOverlaySprites` は layer id -> Sprite ですが、layer id -> Container に変更した方が安全です。

```js
this._liveStrokeOverlayGroups = new Map(); // layerData.id -> Container
```

各 group には最低限次を入れます。

```txt
overlayGroup
  baseSprite: layerData.renderTexture
  transientSprite(s): penOpacityStrokePreview.texture / airbrushStrokePreview.texture
```

baseSprite は常に `layerData.renderTexture` を参照します。transientSprite は workingLayer.children から以下を拾います。

- `penOpacityStrokePreview`
- `airbrushStrokePreview`
- 必要なら `strokePreview`。ただし Graphics の clone は別扱い。

Sprite child の同期項目:

- `texture`
- `position`
- `scale`
- `rotation`
- `alpha`
- `blendMode`
- `visible`
- `renderable`
- `mask` または clipping 相当

最初の局所修正では、`penOpacityStrokePreview` の同期だけでも効果確認価値があります。これで opacity < 1 の pen が pointerup まで出ない問題を切り分けられます。

### Patch 4: 元 working layer 非表示を一度だけにする

`_syncDrawingLiveStrokeOverlay()` の末尾で毎回 `workingLayer.visible = false` するのではなく、session start 時に `_hideLiveStrokeSourceLayers()` を一度だけ呼びます。

```js
_beginDrawingLiveStrokeOverlaySession(data) {
  this.isDrawingPreviewSuspended = true;
  this._applyDrawingVisibilityPreview({ force: true });
  this._syncDrawingLiveStrokeOverlay(data?.data?.layerId, { phase: 'start' });
  this._hideLiveStrokeSourceLayers();
  this._requestLiveStrokeRender('stroke-started-overlay-ready');
}
```

`stroke-updated` では working layer visible を触りません。`stroke-completed` / `stroke-cancelled` で restore します。

### Patch 5: preview container order を固定する

`_ensurePreviewContainer()` の最後に、parent が存在する container だけを対象に child index を正規化します。

擬似コード:

```js
_normalizePreviewContainerOrder() {
  const root = this.layerSystem?.currentFrameContainer;
  if (!root) return;

  const ordered = [
    this.animationPreviewBackgroundContainer,
    this.animationPreviewBackContainer,
    this.animationPreviewContainer,
    this.animationPreviewLiveStrokeContainer
  ].filter(Boolean);

  for (const child of ordered) {
    if (child.parent !== root) root.addChild(child);
  }

  // addChild は末尾へ送るので、順に呼ぶだけでも order は安定する。
  ordered.forEach(child => root.addChild(child));
}
```

ただし operation indicator や selection overlay が同じ root にいる場合は、その前後関係を確認してから固定してください。

### Patch 6: render scheduling は UI 側にも置く

AnimationTablePopup に coalesced render を追加します。

```js
_requestLiveStrokeRender(reason = 'live-stroke') {
  if (this._liveStrokeRenderRequest !== null) return;
  const app = this.layerSystem?.app || window.app;
  if (!app?.renderer || typeof requestAnimationFrame !== 'function') return;

  this._liveStrokeRenderRequest = requestAnimationFrame(() => {
    this._liveStrokeRenderRequest = null;
    try {
      if (typeof app.render === 'function') app.render();
      else app.renderer.render({ container: app.stage });
    } catch (error) {
      if (window.TEGAKI_CONFIG?.debug) {
        console.warn('[AnimationTablePopup] live stroke render failed', { reason, error });
      }
    }
  });
}
```

BrushCore の `_requestLiveCanvasRender()` は短期では残してよいです。UI 側 render の目的は、overlay 同期後の frame を確実に作ることです。

## 6. 修正案の副作用リスク

1. pen opacity preview の二重表示
   - base `layerData.renderTexture` と `penOpacityStrokePreview.texture` を overlay に出し、元 working layer も visible だと二重表示になります。元 working layer は session start で一度だけ非表示にする必要があります。

2. clipping / inverse clipping の再現漏れ
   - working layer child の mask を overlay clone にそのまま移せない場合があります。まずは clipping なしで再現テストし、その後 clipping layer で検証してください。

3. layer order 反転
   - `_syncDrawingLiveStrokeOverlay()` は `overlayEntries.length - 1` から逆順 loop しています。既存の layer order 契約と一致しているか確認が必要です。ログに index と internalLayerId を出してください。

4. stroke 中の UI 操作反映遅延
   - live stroke session 中に preview rebuild を抑制すると、lane filter / onion / preview scope 切り替えが stroke 完了まで遅れる可能性があります。stroke 中のUI変更は cancel or defer でよいです。

5. app.render の二重予約
   - BrushCore と AnimationTablePopup の両方が render を予約すると frame request が増えます。ただし coalescing が入っていれば実害は小さいです。安定後に所有者を UI 側へ寄せます。

## 7. やってはいけない対応

- Lane onion / Timeline onion / preview のために `LayerModel.visible` や ClipAsset / DrawingSnapshot の正本を書き換えない。
- preview / onion / live overlay を保存画像、export、Undo / Redo 履歴に混ぜない。
- stroke move ごとに現在 frame の全CAF preview composite を再生成しない。
- stroke move ごとに `_showSelectedClipWorkingLayers()` と `refreshClippingMasks()` を通して元 working layer の visible を反転しない。
- `layerData.renderTexture` を AnimationTablePopup 側で勝手に作り直さない。RenderTexture の作成・拡張・復元は LayerSystem / BrushCore の契約内に留める。
- `RenderTexture` を同一 render call 内で source と target の両方にしない。BrushCore の segment render は Graphics-only container を target に焼くので比較的安全だが、preview composite で同じ RT を読みながら同じ RT へ書く形は避ける。
- WebGPU、SDF / MSDF、WebGL2 Mesh化、DPR 2倍化、tiled canvas、Lane 完全独立化、animation working Layer 廃止、通常 LayerSystem と TimelineModel の統合に逃げない。
- `app.render()` の回数だけ増やして原因を隠さない。表示面が違えば render 回数を増やしても pointerup まで出ません。

## 8. Codexへ渡す実装指示文

以下をそのまま Codex へ渡せます。

```md
Tegaki Phase 5q の Animation Table PREVIEW live stroke 安定化を、既存 PixiJS RenderTexture / Sprite / Container 構造の範囲で局所修正してください。

目的:
- PREVIEW 中、複数 CAF / Lane がある状態で選択 CAF の animation working layer へ pen 描画したとき、stroke 中の live 表示を安定させる。
- 保存画像、export、Layer visibility 正本、ClipAsset / DrawingSnapshot 正本、Undo / Redo へ preview / onion / overlay 状態を混ぜない。

最重要方針:
1. `drawing:before-stroke-start` では preview overlay を作らない。ここは auto capture / 履歴前状態 / 保存準備だけに限定する。
2. preview の live stroke mode 切り替えは `drawing:stroke-started` で行う。理由は BrushCore が `_ensureLayerRasterFrameForStroke()` と pen opacity isolation の transient texture 作成を終えた後に overlay を作る必要があるため。
3. live stroke session を AnimationTablePopup に追加し、session 中は selected clip / frame / asset / workingLayerIds を固定する。session 中にこれらが変化したら安全に cancel / restore する。
4. `drawing:stroke-updated` では `_showSelectedClipWorkingLayers()` と `refreshClippingMasks()` を呼ばない。move ごとに元 working layer を visible=true -> false へ反転させない。
5. live overlay は `layerData.renderTexture` だけではなく、working layer の transient display surface も複製表示する。最低限 `penOpacityStrokePreview` Sprite を overlay group に複製し、同じ texture / position / alpha / blendMode / visible を同期する。
6. 元 working layer は live overlay 作成後、session start で一度だけ `visible=false` に固定する。stroke update では visible を触らない。stroke completed / cancelled で restore する。
7. `animationPreviewLiveStrokeContainer` は `animationPreviewBackContainer` / `animationPreviewContainer` より上に固定する。`_ensurePreviewContainer()` の最後で container order を正規化する。ただし selection / operation indicator との前後関係は既存挙動を壊さないように確認する。
8. AnimationTablePopup 側に `_requestLiveStrokeRender(reason)` を追加し、overlay sync 後に requestAnimationFrame で `app.render()` または `app.renderer.render({ container: app.stage })` を coalesced 実行する。BrushCore 側の `_requestLiveCanvasRender()` は短期では削除しない。

実装対象関数:
- `tegaki_work/ui/animation-table-popup.js`
  - `_handleDrawingStarted(data)`
  - `_handleDrawingUpdated(data)`
  - `_handleDrawingCompleted(data)`
  - `_handleDrawingCancelled()`
  - `_applyDrawingVisibilityPreview()`
  - `_keepDrawingPreviewWorkingLayerVisible(layerId)`
  - `_syncDrawingLiveStrokeOverlay(layerId, options)`
  - `_clearDrawingLiveStrokeOverlay(options)`
  - `_ensurePreviewContainer()`
  - 必要なら `_showSelectedClipWorkingLayers()` を「解決」と「visible変更」に分離
- `tegaki_work/system/drawing/brush-core.js`
  - `startStroke()` の `drawing:stroke-started` payload に diagnostic fields を追加
  - `_renderRealtimePenSegment(points)` に debug log を追加
  - 可能なら `renderTargetKind: 'layerData.renderTexture' | 'penOpacityState.texture'` を payload / debug に含める

受け入れ条件:
- opacity 1.0 pen で stroke 中に毎回 live 表示される。
- opacity < 1.0 pen でも pointerup 前に live 表示される。
- move ごとの点滅が発生しない。
- pointerup 後、overlay が消え、通常 preview に戻る。
- selected CAF が current frame composite と overlay / working layer の両方で二重表示されない。
- Lane onion / Timeline onion / preview が保存、export、Undo/Redo、ClipAsset 正本、DrawingSnapshot 正本に混入しない。

追加ログ:
- `[TegakiLiveStroke:start-target]`
- `[TegakiLiveStroke:rt-write]`
- `[TegakiLiveStroke:overlay-sync]`
- `[TegakiPreviewTree:mutation]`

禁止:
- WebGPU / SDF / MSDF / WebGL2 Mesh化 / DPR 2倍化 / tiled canvas / Lane 完全独立化 / animation working Layer 廃止 / 通常 LayerSystem と TimelineModel の統合は行わない。
- stroke move ごとに current frame 全CAF preview composite を再構築しない。
- preview / onion / overlay のために LayerModel.visible や ClipAsset / DrawingSnapshot の正本を変更しない。
```

## 9. 最終優先順位

1. opacity < 1.0 pen で再現確認し、`penOpacityStrokePreview` を overlay に複製する。これで pointerup 後表示化の大部分を切り分けられます。
2. `_keepDrawingPreviewWorkingLayerVisible()` から live session 中の `_showSelectedClipWorkingLayers()` 呼び出しを外し、move ごとの visible toggle を消す。
3. container order と preview key の session freeze を入れる。
4. render scheduling を AnimationTablePopup 側に寄せる。

