# Tegaki Phase 5q CAF preview live stroke 診断報告書

対象: `tegaki_phase5q_caf_preview_external_review_request.md` への回答
調査方法: GitHub上の現行コード（`brush-core.js` / `animation-table-popup.js` / `layer-system.js` / `data-models.js` / `animation-data-model.js` / `timeline-ui.js` / `layer-panel-renderer.js`）を実際に取得し、関数単位で読み込んだうえでの診断。ローカル未commit差分は本文中の「要点」の記述をそのまま前提とした（実ファイルは読めていない）。
`task-codex/phase5q.md` はGitHub上に見つからず（404）、参照できていない。

> 表記ルール: 「事実」＝GitHub上のコードを直接読んで確認したこと。「推測」＝コードから論理的に導けるが、実行時ログでの確認が取れていないこと。両者を明示して区別する。

---

## 1. 最も疑わしい原因トップ3

### 原因1（最有力）: `ensureLayerRasterBoundsForRect()` によるRenderTexture差し替えと、overlay Sprite構築のタイミング競合

`BrushCore.startStroke()` は、ペン/消しゴム/エアブラシ/ぼかしの場合に必ず `_ensureLayerRasterFrameForStroke()` を呼び、内部で `LayerSystem.ensureLayerRasterBoundsForRect(activeLayer, {x:0,y:0,width:canvasWidth,height:canvasHeight}, {padding})` を実行する（事実）。これは「現在bounds ∪ Project frame」への拡張要求であり、対象Layerのraster boundsが既にcanvas全体をカバーしていれば `unchanged` 分岐で何もしないが、まだカバーしていなければ **新しい `RenderTexture` を生成し `layerData.renderTexture` を差し替え、旧RTを `destroy(true)` する**（事実、`layer-system.js` L2278-2378）。

一方、`AnimationTablePopup._handleBeforeStrokeStart()`（`drawing:before-stroke-start` に紐づく）は、`_ensureLayerRasterFrameForStroke()` が走る**前**に呼ばれると推測される（`before-stroke-start` の発火元は今回渡されたファイル群には含まれておらず未確認・推測）。このハンドラは `_keepDrawingPreviewWorkingLayerVisible()` → `_syncDrawingLiveStrokeOverlay()` を呼び、その場で overlay Sprite を `layerData.renderTexture` に対して生成する（事実、L820-910）。つまり **overlay Spriteが、まだ拡張されていない「旧RT」を参照して先に作られる可能性がある**。

overlayの再構築判定キー `_liveStrokeOverlayKey` は `clip.id + asset.id + layerData.id` のみで構成されており、RenderTextureオブジェクトの同一性を見ていない（事実、L855-863）。そのため上記のRT差し替えが起きても「作り直すべき変化」として検知されず、既存Spriteの `.texture` をその場で上書きするだけの経路（L880-882: `if (sprite.texture !== layerData.renderTexture) sprite.texture = layerData.renderTexture;`）に入る。この上書き自体は `drawing:stroke-started`（`_handleDrawingStarted`）や `drawing:stroke-updated`（`_handleDrawingUpdated`）のたびに実行されるため、**JS参照としては最終的に正しいRTに追いつくはず**である（事実ベースの推論）。

問題は、この「参照は追いつくが、実際の画面表示（`app.render()`）に反映されるタイミングが保証されていない」点にある。`_requestLiveCanvasRender()` は `requestAnimationFrame` でコアレシングされ、旧RTの `destroy(true)` とSprite上の `.texture` 差し替えが同一tick内で発生した直後に、PixiJSのバッチャー/GPUテクスチャキャッシュが古い状態を引きずる余地がある（相談者自身の疑問7と一致）。これは**推測**だが、症状（当たり外れがランダムに見える／CAF・Laneが複数あるときに悪化する）と整合性が高い。

**「複数CAF/Laneで悪化する」ことの説明**: 新しく選択されたCAFのworking Layerは raster bounds が未拡張であることが多く、そのCAFへの**最初のストローク**では必ずRT差し替えが発生する。同じCAF上で2画目以降を描く場合はbounds変化がないため差し替えが起きず、安定して見える。これはCAF/Laneを切り替えながら描くほど「外れ」を踏みやすいという報告内容と一致する（推測だが検証可能な仮説）。

### 原因2: stroke開始シーケンスの「表示→非表示」round tripが `drawing:before-stroke-start` と `drawing:stroke-started` の両方で二重に走っている

`_keepDrawingPreviewWorkingLayerVisible()` は
`_showSelectedClipWorkingLayers()`（全working Layerのvisible再計算＋`refreshClippingMasks()`によるクリッピングマスクSpriteの全再構築）
→ `_forceAnimationWorkingLayerVisible()`（対象Layerを一旦 `visible=true` に）
→ （overlay有効時のみ）`_syncDrawingLiveStrokeOverlay()`（対象Layerを再び `visible=false` に）
という順で実行される（事実、L808-818）。これが `_handleBeforeStrokeStart()`（L2451-2469）と `_handleDrawingStarted()`（L2471-2498）の**両方**でほぼ同一内容として呼ばれる。

ローカル差分の要点にある「`drawing:stroke-updated` では overlay同期のみ行い、working Layer本体を再可視化しない」という修正（move毎の点滅対策）は正しく機能していると読める（事実、L2500-2509は `_syncDrawingLiveStrokeOverlay` のみ呼んでいる）。しかし **stroke開始の瞬間だけは、可視化トグルが2セット連続で走る構造が残っている**。これ自体が直接「当たり外れ」を生むかは未検証だが、`refreshClippingMasks()` が毎回 `clearClippingMasks()` → 全クリッピングマスクSpriteの再生成を行う重い処理であること（事実、L1802-1841）と合わせて、ストローク開始直後の数フレームに余計な表示ツリー変化を持ち込んでいる可能性が高い（推測）。相談者の言う「Timeline側/Lane側どちらもガチャ状態になる」は、対象Layer単体だけでなく、クリッピング関係にある他Layerの見た目まで揺れることを示唆しており、この経路と矛盾しない。

### 原因3: `liveRenderRequests` と `liveRenderExecuted` の差は「正常なコアレシング」であり、誤診断のリスクがある

ログ例 (`liveRenderRequests: 107, liveRenderExecuted: 22`) は、`_requestLiveCanvasRender()` が `requestAnimationFrame` 単位で複数回のリクエストを1回にまとめているだけであり（事実、L676-722、`this.liveRenderFrameRequest !== null` の間は新規rAFを発行せずカウントのみ増やす）、**これ自体はバグの証拠ではない**。ただし、原因1のRT差し替えのようなオブジェクト同一性の変化がこのコアレシング窓の中で発生すると、「1回にまとめられた `app.render()` が、まとめられる前の中間状態（旧RTのまま）を描画してしまう」窓が生まれる可能性があり、原因1と複合したときに症状を悪化させる二次要因になり得る（推測）。単独では最有力原因ではないが、ログ解釈を誤らないために報告書に明記する。

---

## 2. それぞれの根拠（要約）

| 原因 | 根拠となる具体的コード箇所 |
|---|---|
| 原因1 | `layer-system.js` `ensureLayerRasterBoundsForRect()` L2278-2378（RT差し替え＋`oldRT.destroy(true)`）／`animation-table-popup.js` `_syncDrawingLiveStrokeOverlay()` L820-910（textureの遅延上書き）／`_liveStrokeOverlayKey` の構成要素 L855-863（RT同一性を見ていない） |
| 原因2 | `_keepDrawingPreviewWorkingLayerVisible()` L808-818／`_handleBeforeStrokeStart()` L2451-2469／`_handleDrawingStarted()` L2471-2498／`refreshClippingMasks()` L1802-1841（毎回全マスク再構築） |
| 原因3 | `_requestLiveCanvasRender()` L676-722（rAFコアレシングの実装そのもの） |

---

## 3. 現行コードで読むべき具体的な関数名

**brush-core.js**
- `startStroke()`（RT拡張と`drawing:stroke-started`発火順序の起点）
- `_ensureLayerRasterFrameForStroke()`
- `_renderRealtimePenSegment()`
- `_requestLiveCanvasRender()`
- `updateStroke()`（`drawing:stroke-updated` 発火位置）
- `finalizeStroke()`

**layer-system.js**
- `ensureLayerRasterBoundsForRect()`
- `refreshClippingMasks()`
- `createLayerRasterSnapshot()` / `restoreLayerRasterSnapshot()`

**animation-table-popup.js**
- `_handleBeforeStrokeStart()`
- `_handleDrawingStarted()`
- `_handleDrawingUpdated()`
- `_handleDrawingCompleted()` / `_handleDrawingCancelled()`
- `_syncDrawingLiveStrokeOverlay()`
- `_clearDrawingLiveStrokeOverlay()`
- `_keepDrawingPreviewWorkingLayerVisible()`
- `_showSelectedClipWorkingLayers()`
- `_forceAnimationWorkingLayerVisible()`
- `_ensurePreviewContainer()`
- `_applyVisibilityPreview()`

**未確認（今回渡されたファイルに含まれない）**
- `drawing:before-stroke-start` の実際の発火元（`core-engine.js` 等、pointerdownハンドラ側と推測）。これが `BrushCore.startStroke()` の**本当に前**で同期的に呼ばれているかどうかは、渡されたファイルだけでは断定できない。最優先で確認してほしい箇所。

---

## 4. 追加すべき最小診断ログ

修正の前に、まず原因1の仮説を実測で確認することを推奨する。すべて「ログ追加のみ」で構造変更を伴わない。

1. **RenderTextureに識別IDを振る**
   `WeakMap<RenderTexture, number>` とインクリメントカウンタを用意し、`ensureLayerRasterBoundsForRect()` が新規RTを作る箇所（L2344付近）で `oldRT`/`newRT` それぞれにIDを割り当ててログ出力する。
   ```js
   console.info('[Diag][RT-swap]', {
     layerId: layerData.id,
     oldRtId: getRtId(oldRT),
     newRtId: getRtId(newRT),
     strokeId: window.BrushCore?.strokeInputProfile?.id ?? null,
     t: performance.now()
   });
   ```

2. **overlay同期時のミスマッチ検出ログ**
   `_syncDrawingLiveStrokeOverlay()` の `if (sprite.texture !== layerData.renderTexture)` 分岐に、ミスマッチが起きた事実そのものをログする。
   ```js
   if (sprite.texture !== layerData.renderTexture) {
     console.warn('[Diag][overlay-texture-mismatch-fixed]', {
       layerId: id, spriteRtId: getRtId(sprite.texture), currentRtId: getRtId(layerData.renderTexture),
       t: performance.now()
     });
     sprite.texture = layerData.renderTexture;
   }
   ```

3. **実際にpaintされる瞬間のRT整合性チェック**
   `_requestLiveCanvasRender()` のrAFコールバック内（`app.render()` 実行の直前）で、`animationPreviewLiveStrokeContainer` 配下の各Spriteの `.texture` と、対応するworking Layerの現在の `layerData.renderTexture` が一致しているかをチェックし、不一致ならログする。これが「見えている当たり外れ」と直接対応するはずのログになる。

4. **既存の `strokeInputProfile.id` を全ログに共通タグとして使う**
   既にBrushCore側にstroke単位のID (`stroke_${Date.now()}_...`) が存在するため（事実、`startStroke()` 内）、上記1〜3のログすべてにこのIDを含め、1本のストロークの「before-stroke-start → RT差し替え有無 → stroke-started → overlay構築 → 各stroke-updatedでの同期 → 実paint」を時系列で追跡できるようにする。これにより「当たり」ストロークと「外れ」ストロークのログ列を並べて比較でき、原因1の仮説を定量的に確認できる。

---

## 5. 最小修正案

いずれも既存の overlay Sprite方式・Container構造を維持したままの局所パッチ。

### 修正A（最優先・原因1に直接対応）
overlay Spriteの**新規生成**（＝`layerData.renderTexture`への最初のbind）を `drawing:before-stroke-start` から行わず、必ず `drawing:stroke-started`（`_ensureLayerRasterFrameForStroke()` 実行後に発火することが確定している経路）に一本化する。

具体的には `_handleBeforeStrokeStart()` から `_keepDrawingPreviewWorkingLayerVisible(...)` の呼び出し（＝overlay構築を含む）を外し、`isDrawingPreviewSuspended = true` と `_applyVisibilityPreview()` の呼び出しのみ残す。overlay構築・working Layer非表示は `_handleDrawingStarted()` 側の1回に集約する。

これにより、overlay SpriteはRT拡張が確定した**後**の `layerData.renderTexture` のみを参照するようになり、原因1の競合窓がそもそも発生しなくなる。

### 修正B（防御的・原因1の残存リスクに対応）
`_syncDrawingLiveStrokeOverlay()` でテクスチャの不一致を検出して `sprite.texture` を差し替えた場合に限り、その場で1回だけ同期的な再描画（`this.layerSystem.app.renderer.render({ container: app.stage })` 相当、既存の `app.render()` 呼び出し規約に合わせる）を行い、次のrAFコアレシング待ちにせず即座に正しい状態を1枚描く。頻発しないパス（ミスマッチ検出時のみ）に限定することで負荷増を抑える。

### 修正C（原因2に対応）
`_handleDrawingStarted()` 内で、直前の `_handleBeforeStrokeStart()` により既に `isDrawingPreviewSuspended === true` かつ同一 `layerId` でのvisibility準備が完了している場合、`_showSelectedClipWorkingLayers()`（＝`refreshClippingMasks()`の全再構築を含む）の再実行をスキップするガードを追加する。

### 修正D（検証用・恒久修正ではない）
CAF/内部Layer選択直後（ストローク開始より前）に、working Layerのraster boundsを一度だけcanvas全体へ事前拡張しておく処置を一時的に入れ、`_ensureLayerRasterFrameForStroke()` が常に `unchanged` 分岐を通るようにする。これで症状が消えれば原因1が根本原因であることの強い裏付けになる（本採用するかは副作用リスク次第）。

---

## 6. 修正案の副作用リスク

- **修正A**: `_handleBeforeStrokeStart()` が担っていた「stroke開始前のクリッピングマスク先行更新」が1回減る。`drawing:stroke-started` がpreviewGraphics生成前後どちらで発火するか（`emitStrokeStartedBeforePreview`分岐）によって、overlay構築が想定より遅れるケースがないか要確認。
- **修正B**: イベントハンドラ内での同期的 `renderer.render()` 呼び出しはrAF間引きの効果を部分的に打ち消すため、ミスマッチ検出時のみに限定しないとCPU/GPU負荷が上がる。
- **修正C**: スキップ条件を誤ると、CAF切り替え直後にoverlay対象Layerが一瞬もvisibleにならず、他Layerとの重なり順や透過表示が一瞬崩れる可能性がある。
- **修正D**: raster boundsを常に全キャンバスへ事前拡張すると、絵の小さいLayerでも常にcanvasサイズ分のRenderTextureをGPUメモリ上に確保することになる。CAF/Lane数が多いプロジェクトではメモリ消費増になりうるため、あくまで仮説検証用の一時措置と位置づけるべき。

---

## 7. 「やってはいけない」対応

- RenderTextureをsource textureとrender targetとして同一フレーム内で使い回す設計自体を、WebGPU化・SDF/MSDF化・WebGL2 Mesh化など大規模刷新で回避しようとすること（依頼の制約に反し、かつ根本原因の切り分けを妨げる）。
- overlay Sprite方式を放棄し、working Layer本体をpointermoveごとに直接visible切り替えする方式へ戻すこと（既に点滅の原因として特定済みであり、後退になる）。
- `_liveStrokeOverlayKey` の再構築条件を「毎回強制rebuild」に変更すること（Sprite/Texture生成コストが増え、ストローク中のパフォーマンスが悪化する）。
- 今回の修正をsave・export・Undo/Redo・ClipAsset/DrawingSnapshot正本の経路に混入させること。修正A〜Cはいずれも display-only の preview/overlay 経路に閉じており、この制約を超えないこと。

---

## 8. Codexへ渡す実装指示文

```
Tegaki Phase 5q: CAF preview live stroke 安定化パッチ（display-only領域限定）

前提:
- 対象は animation-table-popup.js / brush-core.js / layer-system.js のみ。
- WebGPU / SDF・MSDF / WebGL2 Mesh化 / DPR2倍化 / tiled canvas / ClipInstance transform/keyframe /
  Lane完全独立化 / animation working Layer廃止 / 通常LayerSystemとTimelineModelの統合は禁止。
- save / export / Undo・Redo履歴 / ClipAsset・DrawingSnapshot正本には一切触れないこと。
  すべて animationPreviewLiveStrokeContainer 配下の display-only 処理に閉じること。

Step 1（診断ログ追加。まずこれだけをコミットし、実機で当たり外れログを収集する）:
1. RenderTexture に WeakMap ベースの短い識別IDを振るユーティリティを追加する。
2. layer-system.js の ensureLayerRasterBoundsForRect() 内、RT差し替え発生箇所（changed:true の分岐）で、
   layerId / oldRtId / newRtId / 現在の strokeInputProfile.id / performance.now() を console.info で出力する。
3. animation-table-popup.js の _syncDrawingLiveStrokeOverlay() 内、
   `sprite.texture !== layerData.renderTexture` が真になった瞬間に console.warn で
   layerId / 直前のspriteRtId / 現在のrtId / performance.now() を出力する。
4. brush-core.js の _requestLiveCanvasRender() の rAF コールバック内、実際に app.render() を呼ぶ直前に、
   animationPreviewLiveStrokeContainer 配下の各 Sprite の texture と、対応する working Layer の
   layerData.renderTexture が一致しているかを確認し、不一致なら console.warn で報告する。

Step 2（Step 1のログで原因1の仮説が確認できた場合のみ実施）:
1. animation-table-popup.js の _handleBeforeStrokeStart() から、overlay構築を伴う
   _keepDrawingPreviewWorkingLayerVisible(...) の呼び出しを削除する。
   isDrawingPreviewSuspended = true と _applyVisibilityPreview() の呼び出しはそのまま残す。
2. overlay Sprite の新規生成・working Layer の非表示化は _handleDrawingStarted() 側の
   _keepDrawingPreviewWorkingLayerVisible(...) 呼び出し1本に集約する
   （drawing:stroke-started は _ensureLayerRasterFrameForStroke() の後に発火することが
   brush-core.js の startStroke() 実装上確定しているため、ここでのoverlay構築は常に
   拡張後の最終 RenderTexture を参照する）。
3. _syncDrawingLiveStrokeOverlay() 内でテクスチャ不一致を検出して sprite.texture を
   差し替えた場合に限り、その場で1回だけ即時再描画をトリガーする分岐を追加する
   （rAFコアレシング待ちにしない。頻発しない経路であることをコメントで明記する）。
4. _handleDrawingStarted() 内で、直前の _handleBeforeStrokeStart() により
   同一 layerId・同一 isDrawingPreviewSuspended 状態が既に整っている場合は、
   _showSelectedClipWorkingLayers()（refreshClippingMasksの全再構築を含む）の
   重複実行をスキップするガードを追加する。

受け入れ条件:
- 複数CAF/Laneを切り替えながら連続でペンストロークした際、ストローク中に描画内容が
  リアルタイムに追従し、pointerup後にまとめて表示される「外れ」パターンが解消されること。
- 通常Layerでの描画、save/export、Undo/Redoの挙動に変化がないこと。
- Step 1のログが本番相当のデバッグビルドで出力されないこと（TEGAKI_CONFIG.debug 配下に収める）。
```

---

## 依頼書の個別質問への回答

- **`RenderTexture`を直接参照するoverlay Sprite方式は妥当か**
  妥当と考える。問題は方式そのものではなく、「overlay Spriteをいつ最初に構築するか」が `_ensureLayerRasterFrameForStroke()` によるRenderTexture差し替えより前になり得る、というタイミングの非対称性にある。

- **妥当なら、overlay作成/texture再同期/元Layer非表示のタイミングはどう整理すべきか**
  overlay Sprite の**新規生成**（＝最初のtexture bind）は必ず `drawing:stroke-started`（RT拡張が確定した後）で行う。`drawing:before-stroke-start` ではvisibility状態（`isDrawingPreviewSuspended` 等）の準備のみに留め、textureを保持するSpriteの生成・更新はしない。texture再同期は現状通り `drawing:stroke-updated` 毎でよいが、不一致検出時は次のpaintを待たず即時反映させる。元working Layerの非表示化は、overlay構築が成功した直後の1回に絞り、`drawing:before-stroke-start` 側では行わない。

- **妥当でないなら、現行構造でどう見せるべきか**
  該当なし（上記の通り妥当と判断）。

- **`drawing:before-stroke-start` と `drawing:stroke-started` のどちらでpreviewを切り替えるべきか**
  texture参照を伴うoverlay構築は `drawing:stroke-started` 側に一本化すべき。`drawing:before-stroke-start` は「これからstrokeが始まる」ことの通知としてvisibility準備にのみ使う。

- **`app.render()` をBrushCore側で呼ぶ設計は続けるべきか、AnimationTablePopup側へ寄せるべきか**
  BrushCore側を維持すべきと考える。RenderTextureへの実際のピクセル書き込みを行っている当事者がBrushCoreであり、「焼き込みが完了した瞬間」を最も正確に知っているのもBrushCoreである。AnimationTablePopup側に描画責務を移すと、overlay同期の完了とpaint依頼が別モジュール・別イベントに分散し、今回問題になっている非対称性がむしろ増える可能性が高い。ただし、修正Bのように「overlay同期が完了したことを確認してから即時paintする」ための小さな同期ポイントを設けることは有効。
