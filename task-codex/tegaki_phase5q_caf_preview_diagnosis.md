# tegaki_phase5q_caf_preview_diagnosis.md

対象コミット: `418f72913ece74db342380ef0058f8bb05a6f146`（および `main` HEAD、内容は同一だった）
読んだファイル:
- `tegaki_work/ui/animation-table-popup.js`（9559行、全文）
- `tegaki_work/system/drawing/drawing-engine.js`（全文）
- `tegaki_work/system/drawing/brush-core.js`（1700行中、stroke開始〜realtime焼き込み部分を精読）
- `tegaki_work/system/layer-system.js`（`refreshClippingMasks()` 周辺を精読）
- `AGENTS.md` / `PHASE4Z_BOUNDARY.md` / `開発用資料保管庫/Archive/phase5q.md` / `03_アニメーション・CAF・変形.md`

---

## 結論

「当たり／ハズレ」は乱数ではなく、**`AnimationTablePopup._applyVisibilityPreview()` が『合成する他コンテンツが1件もない』フレームで異常終了し、popup内部の合成state（`_visibilityPreviewApplied` / `_animationPreviewMode` / `_animationPreviewKey`）を中途半端な状態のまま残す**ことが根本原因です。

このstateは pointerdown 中に **2回**（`drawing:before-stroke-start` → `_handleBeforeStrokeStart()`、および `drawing:stroke-started` → `_handleDrawingStarted()`）参照・更新されますが、1回目の異常終了のさせ方（`_restoreVisibility()` の呼び方）によって2回目の挙動が変わるため、**その回のセル選択・フレーム内容で結果が固定される**（＝セル選択時点で当たり/ハズレが決まる）という報告内容と一致します。

「PREVIEW ONでのみ発生」「単独Lane CAFでも起きることがある」「他CAFのpreview合成は残る」という観察も、すべてこの1関数の分岐で説明がつきます。

---

## 根本原因候補

### 候補1（最有力・確度：高）: `_applyVisibilityPreview()` のゼロ件分岐が state を壊す

**ファイル**: `tegaki_work/ui/animation-table-popup.js`
**関数**: `_applyVisibilityPreview()`（該当箇所はファイル内 `_applyVisibilityPreview` 定義部、約330行目付近）

```js
const renderedCount = this._renderFrameComposite(currentFrame, layers, {
    filterIds,
    excludeClipIds: showSelectedWorkingLayer ? selectedEditClipIds : null,
    previewContainer: staging.back
});

if (renderedCount === 0 && onionRenderedCount === 0) {
    this._destroyAnimationPreviewStagingContainers(staging);
    this._restoreVisibility();
    return;                       // ← ここで抜けると以下が一切実行されない
}
...
this._hideTimelineLayersForPreview(layers, { preserveWorkingLayerIds: selectedWorkingLayerIds });
if (showSelectedWorkingLayer) this._showSelectedClipWorkingLayers();
this._animationPreviewMode = 'preview';
this._animationPreviewKey = previewKey;
this._drawingPreviewCompositeKey = null;
this._visibilityPreviewApplied = true;   // ← ここも実行されない
```

`showSelectedWorkingLayer` が true のとき（＝pen描画中で working Layer を表示させたいとき）、`excludeClipIds` に **今まさに描いている CAF 自身** が入るため、`_renderFrameComposite()` はそのセルを除外して集計します。**同一フレームに他のCAFが存在しない（単独Lane / 単独CAFのケースを含む）と `renderedCount` は必ず 0** になり、上記の早期returnに入ります。

この分岐は
- `_hideTimelineLayersForPreview()` を呼ばない
- `_showSelectedClipWorkingLayers()` を呼ばない（popup側の呼び出しはここでは行われない。ただし呼び出し元 `_handleBeforeStrokeStart` / `_handleDrawingStarted` 側で別途呼ばれるため、これ単体では致命傷にならない）
- `_visibilityPreviewApplied` / `_animationPreviewMode` / `_animationPreviewKey` を更新しない

代わりに `_restoreVisibility()` を呼びます。

```js
_restoreVisibility() {
    if (this.animationPreviewContainer) this._clearAnimationPreviewContainer();
    this._setPreviewBackgroundSubstitute(false);

    if (!this._visibilityPreviewApplied || !this.layerSystem) return;   // ← ここがstate依存の分岐点

    const layers = this.layerSystem.getLayers() || [];
    this._backupSnapshots.clear();
    layers.forEach(layer => {
        if (layer.layerData) layer.visible = layer.layerData.visible;   // ← 全Layerのvisibleを強制上書き
    });
    this._visibilityPreviewApplied = false;
    this.eventBus.emit('layer:panel-update-requested');
}
```

**ここが「当たり／ハズレ」を生む本体です。** `_restoreVisibility()` の破壊的なリセット（`layer.visible = layer.layerData.visible` を全Layerに対して実行）が走るかどうかは、**呼ばれた瞬間の `this._visibilityPreviewApplied` が true かどうか**にのみ依存します。

pointerdown中の実際のイベント順序を追うと：

1. `drawing:before-stroke-start`（`drawing-engine.js` の `_handlePointerDown` から、`brushCore.startStroke()` より前に発火）
   → `_handleBeforeStrokeStart()` が `_animationPreviewKey = null` にリセットしたうえで `_applyVisibilityPreview()` を呼ぶ。
   → このとき `_visibilityPreviewApplied` は（Table表示中の通常プレビューにより）**true** であることが多い。
   → renderedCount=0 のケースでは `_restoreVisibility()` が **フル実行**され、全Layerの `visible` が `layerData.visible` に巻き戻され、`_visibilityPreviewApplied = false` になる。
   → その後 `_handleBeforeStrokeStart()` は続けて `_showSelectedClipWorkingLayers()` / `activeLayer.visible = true` / `refreshClippingMasks()` を呼ぶため、**ここまでは辻褄が合う**。

2. `brushCore.startStroke()` 内で `activeLayer.layerData.isAnimationWorkingLayer === true` のとき、`previewGraphics` 生成より前に `drawing:stroke-started` を発火（`brush-core.js` 266〜269行目）。
   → `_handleDrawingStarted()` が呼ばれる。

```js
_handleDrawingStarted(data = {}) {
    ...
    if (this.isVisible && this.isPreviewActive) {
        const previewAlreadyPrepared = this.isDrawingPreviewSuspended === true
            && this._visibilityPreviewApplied === true      // ← 1.で false にされている
            && this._animationPreviewMode === 'preview';
        this.isDrawingPreviewSuspended = true;
        if (!previewAlreadyPrepared) {
            this._applyVisibilityPreview();                  // ← 再度呼ばれる
        }
        this._showSelectedClipWorkingLayers();
        this._forceAnimationWorkingLayerVisible(layerId);
    }
}
```

`_visibilityPreviewApplied` が 1. の時点で false にされているため `previewAlreadyPrepared` は false になり、`_applyVisibilityPreview()` が**もう一度**呼ばれます。フレーム内容は変わっていないので、ここでも `renderedCount === 0` となり同じ早期returnに入りますが、今回は `_restoreVisibility()` に入った時点で `_visibilityPreviewApplied` が既に false なので、**ガードで即return（全Layerのvisible上書きは走らない）**。

この後 `_showSelectedClipWorkingLayers()` と `_forceAnimationWorkingLayerVisible()` が実行されるため、理屈上はここで working Layer が可視化されるはずですが、**この2回の `_applyVisibilityPreview()` 呼び出しの間に `_restoreVisibility()` が1回だけ全Layerの `visible` を巻き戻す**という非対称な副作用が発生しており、これが後続の `refreshClippingMasks()`（候補2参照）や、同フレームで発火する他のイベントハンドラ（`layer:panel-update-requested` など、`_restoreVisibility()` が無条件でemitする）と組み合わさることで、**同一操作でも実行順・タイミングにより最終的な可視状態が変わる**という不安定さを生んでいます。

「セル選択時点で当たり／ハズレが決まる」という報告は、この分岐に入るかどうか（＝そのフレームに他の可視コンテンツがあるか）が **セル選択とアクティブLane設定の組み合わせで決定される**ことと完全に一致します。「レイヤーフォルダのアクティブを別に移すと抽選再開」も、選択が変わることで `filterIds` / `selectedEntry` / フレーム内容の組み合わせが変わり、`renderedCount` の0/非0が再判定されることと一致します。

### 候補2（副次的・確度：中）: `refreshClippingMasks()` のクリップソース判定が working Layer の一時的な可視状態に依存する

**ファイル**: `tegaki_work/system/layer-system.js`
**関数**: `refreshClippingMasks()`（1802行目）/ `_findClippingSourceLayer()`（1903行目）

```js
_findClippingSourceLayer(layer, layers = this.getLayers()) {
    ...
    for (let index = layerIndex - 1; index >= 0; index--) {
        const candidate = layers[index];
        const data = candidate?.layerData;
        ...
        if (data.visible === false || candidate.visible === false) return null;  // ← ここ
        if (!data.renderTexture) return null;
        return candidate;
    }
}
```

```js
if (!sourceLayer?.layerData?.renderTexture) {
    data.layerSprite.visible = false;   // ← クリップ元が見つからないとスプライトを強制非表示
    data.effectiveClippingSourceId = null;
    continue;
}
```

かつ `animation-table-popup.js` の `_ensureWorkingLayerDisplaySurface()`:

```js
if (sprite) {
    if (layer.layerData.clipping !== true) {
        sprite.visible = true;   // ← clipping中のLayerには sprite.visible を強制しない
    }
    ...
}
```

つまり、**クリッピング設定された working Layer（色レイヤーが線レイヤーにクリップする構成など）は、`refreshClippingMasks()` がクリップ元を見失った瞬間に `layerSprite.visible = false` にされ、以後どの `_ensureWorkingLayerDisplaySurface()` 呼び出しもそれを明示的には直しません**（コンテナ自体の `layer.visible` は true でも、内部の `layerSprite.visible` が false のまま）。

候補1の異常系（`_restoreVisibility()` による全Layer一括リセットや、2回連続の `_applyVisibilityPreview()` 呼び出し）の最中は、working Layer 同士の可視状態が一瞬ズレるタイミングが生じます。`refreshClippingMasks()` はこの一瞬の状態でクリップ元探索を行うため、クリップ設定のあるCAF内部Layerで描画している場合、この副次的経路が「見えない」を確定させている可能性が高いです（非クリップ構成でも候補1単独で説明可能ですが、クリップ構成の方が再現しやすいと推測されます）。

---

## 優先調査ポイント

優先度順。

1. **`_applyVisibilityPreview()` の `renderedCount === 0 && onionRenderedCount === 0` 分岐**（候補1）。ここが唯一、`_visibilityPreviewApplied` を「巻き戻すが再構築しない」形で終了する場所。
2. **`_restoreVisibility()` のガード `if (!this._visibilityPreviewApplied ...)`**。この関数が「破壊的リセットを実行したかどうか」を外から知る手段が現状ないため、`_handleBeforeStrokeStart` → `_handleDrawingStarted` の2段イベントの間で非対称な副作用が起きる。
3. **`_handleDrawingStarted()` の `previewAlreadyPrepared` 判定**。`_visibilityPreviewApplied` が「実際にpreviewが構築済みか」ではなく「直前に何が起きたか」を表す壊れやすいフラグになっている。
4. **`refreshClippingMasks()` の `_findClippingSourceLayer()` とその呼び出しタイミング**。working Layerのクリップ元判定に使う `candidate.visible` / `data.visible` が、候補1の異常系のあいだ一時的にズレていないか（ログで実測が必要）。
5. `_ensureWorkingLayerDisplaySurface()` が clipping Layer に対して `sprite.visible` を明示しない設計（意図的か、抜けか）の確認。

---

## 最小修正案

### 修正案A（候補1に対する直接修正・最優先）

**対象ファイル**: `tegaki_work/ui/animation-table-popup.js`
**対象関数**: `_applyVisibilityPreview()`

**方針**: `renderedCount === 0 && onionRenderedCount === 0` の分岐でも、「他に合成すべきものが無いだけで、選択中CAFのworking Layer表示は成立させる」という契約を明示的に満たすようにする。具体的には、この分岐でも
- `_hideTimelineLayersForPreview(layers, { preserveWorkingLayerIds: selectedWorkingLayerIds })` を呼ぶ
- `showSelectedWorkingLayer` が true なら `_showSelectedClipWorkingLayers()` を呼ぶ
- `_animationPreviewMode` / `_animationPreviewKey` / `_visibilityPreviewApplied` を通常成功時と同様に更新する（空の staging を back/front に適用するだけでよい）

を行い、`_restoreVisibility()` を呼ぶルート自体をやめる（「合成対象が無い」ことと「プレビュー表示状態を解除する」ことは別の概念のため、分けて扱う）。

**リスク**: この分岐は「Table を開いた直後に何も描いていない状態」等、正常系でも通る可能性があるため、`_hideTimelineLayersForPreview` / `_showSelectedClipWorkingLayers` を無条件に呼んでも既存の合成契約（保存正本・Undo/Redo・Layer visibility正本を書き換えない）を壊さないか確認が必要。ただしこれらの関数はいずれも表示専用の副作用（`layer.visible` 等のPixi側プロパティ操作のみ）であり、`layerData` の正本値やHistoryには触れていないことをコードから確認済み。

**確認方法**: 単独Lane・単独CAFのセルを選択し、PREVIEW ONでpenストロークを複数回（Undo無しで10回程度）繰り返し、毎回リアルタイムに線が見えることを確認する。次に多Lane構成で、対象フレームの他Laneセルを意図的に空にした状態でも同様に確認する。

### 修正案B（候補2に対する保険的修正）

**対象ファイル**: `tegaki_work/system/layer-system.js`
**対象関数**: `refreshClippingMasks()` / `_findClippingSourceLayer()`

**方針**: `_findClippingSourceLayer()` の可視判定を `candidate.visible`（Pixi側の実表示状態）ではなく、`data.visible` のみ、または `_ensureWorkingLayerDisplaySurface()` が使っているのと同じ判定基準に統一する。あるいは、animation working Layer 同士のクリップ判定については、`AnimationTablePopup._showSelectedClipWorkingLayers()` が全working Layerの可視状態を確定させた**直後にのみ** `refreshClippingMasks()` を呼ぶよう呼び出し順序を固定し、途中経過の状態で呼ばれないようにする。

**リスク**: `refreshClippingMasks()` は通常Layer側でも18箇所から呼ばれている共通関数のため、判定基準を変えると通常のLayer Panelクリッピング機能に影響する可能性がある。working Layer専用の分岐を追加する場合は影響範囲をclipping関連の既存テストケース（PSD importなど）で確認する必要がある。

**確認方法**: クリップ設定されたCAF内部Layer（色レイヤーが線レイヤーにクリップする構成）でストロークし、修正案Aと同様の繰り返しテストを行う。

---

## リスク

- 修正案Aは `_applyVisibilityPreview()` の中核分岐を変更するため、Table閉時のLane onion（`laneReferenceMode`）や再生中（`isPlaying`）など、他の呼び出し経路（`_applyDrawingVisibilityPreview()` / `_applyTimelineOnionOnlyPreview()` / `_updateLaneReferencePreview()`）との整合を崩さないよう、変更範囲を `_applyVisibilityPreview()` 単体に限定すべき。
- `_restoreVisibility()` を呼ばなくなることで、他の呼び出し元（`hide()` や `exitClipEditMode()` など、Table全体を閉じる／編集終了する経路）が期待している「全Layer visible をモデル値に戻す」動作に影響しないよう、**このメソッド自体は変更せず、`_applyVisibilityPreview()` からの呼び出しをやめるだけ**にとどめるのが安全。
- 修正案Bは影響範囲が広いため、まず修正案Aのみで症状が解消するか確認し、解消しない場合にのみ着手することを推奨。

---

## 追加で必要な情報

- 実機での再現時に、`window.TEGAKI_CONFIG.debug = true` を有効にした状態で、`_applyVisibilityPreview()` の `renderedCount` / `onionRenderedCount` と `_visibilityPreviewApplied` の値をストローク開始のたびにログ出力し、「ハズレ」発生時に実際にゼロ件分岐へ入っているかを実測で確認することを推奨します（今回はコード読解のみで、実機ログとの突き合わせは行っていません）。
- 描画中の working Layer が clipping 設定されているケースとされていないケースで、当たり/ハズレの発生率に差があるかどうかのデータがあると、候補1単独か候補1+候補2の複合かを切り分けやすくなります。
