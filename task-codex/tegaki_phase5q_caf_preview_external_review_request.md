# Tegaki Phase 5q CAF preview live stroke diagnosis request

この文書は、Claude / GPT など外部AIへ渡すための診断依頼書です。
外部AIはローカル未commit差分を直接読めない前提なので、GitHub上の現行コードに加えて、下記の「ローカル未commit差分の要点」を必ず前提にしてください。

## 依頼の目的

Tegaki の Animation Table PREVIEW中、CAF / Lane が複数ある状態でペン描画すると、ストローク中のライブ表示が安定しません。

現在の症状は次の通りです。

- BrushCore側のログでは、当たり回 / 外れ回どちらも `outcome:"realtime"`。
- `penRenderCalls` は増えており、RenderTextureへのリアルタイム焼き込みは走っている。
- `liveRenderExecuted` も増えており、`app.render()` も呼ばれている。
- それでも画面上では、ストローク中に表示される回と、pointerup後にまとめて表示される回が混在する。
- 一時期、display-only overlay Spriteを使うと当たり外れは消えたが、stroke中に点滅した。
- moveごとのLayer本体可視化を止めると点滅は消えたが、当たり外れが復活した。
- Timeline側 / Lane側どちらも「ガチャ状態」になる。

この状態から、PixiJS表示tree / RenderTexture参照 / Animation Table preview契約 / working layer再利用まわりの設計上の見落としを診断してください。

## 重要な設計制約

以下は提案しないでください。

- WebGPU
- SDF / MSDF
- WebGL2 Mesh化
- DPR 2倍化
- tiled canvas
- ClipInstance transform / keyframe
- Lane完全独立化
- animation working Layer廃止
- 通常LayerSystemとTimelineModelの統合

今回ほしいのは、現行 PixiJS RenderTexture / Sprite / Container 構造の範囲での原因診断と、局所修正案です。

また、Lane onion / Timeline onion / previewは display-only であり、保存画像、export、Layer visibility正本、ClipAsset / DrawingSnapshot正本、Undo / Redo履歴に混ぜてはいけません。

## GitHubで読むべきファイル

Repository:

https://github.com/toshinka/tegaki

主に読むファイル:

- https://github.com/toshinka/tegaki/blob/main/tegaki_work/ui/animation-table-popup.js
- https://github.com/toshinka/tegaki/blob/main/tegaki_work/system/drawing/brush-core.js
- https://github.com/toshinka/tegaki/blob/main/tegaki_work/system/layer-system.js
- https://github.com/toshinka/tegaki/blob/main/tegaki_work/system/data-models.js
- https://github.com/toshinka/tegaki/blob/main/tegaki_work/system/animation/animation-data-model.js
- https://github.com/toshinka/tegaki/blob/main/tegaki_work/ui/timeline-ui.js
- https://github.com/toshinka/tegaki/blob/main/tegaki_work/ui/layer-panel-renderer.js

参考資料:

- https://github.com/toshinka/tegaki/blob/main/TEGAKI.md
- https://github.com/toshinka/tegaki/blob/main/AGENTS.md
- https://github.com/toshinka/tegaki/blob/main/tegaki_work/PROGRESS.md
- https://github.com/toshinka/tegaki/blob/main/task-codex/phase5q.md

## ローカル未commit差分の要点

現在ローカルでは、主に次の差分が入っています。GitHub上にはまだ反映されていない可能性があります。

### brush-core.js

- `startStroke()` で stroke開始時のactive layerを `this.strokeTargetLayer` に保持し、move / finalizeまで同じLayerへ描く。
- `drawing:stroke-started` を animation working Layerの場合はpreviewGraphics生成前にemitする。
- `drawing:stroke-updated` を animation working Layerのstroke中にemitする。
- `TEGAKI_CONFIG.debug` 時に `[TegakiRealtimeStroke:*]` を出す。
- `RenderTexture` 更新後に `app.render()` をrequestAnimationFrameで予約する `_requestLiveCanvasRender(reason)` を追加。
- Console上では外れ回でも以下のようなログになる。

```json
{
  "mode": "pen",
  "outcome": "realtime",
  "hasRealtimeApplied": true,
  "penRenderCalls": 107,
  "penRenderMissingTarget": 0,
  "penRenderMissingGraphics": 0,
  "liveRenderRequests": 107,
  "liveRenderExecuted": 22,
  "liveRenderFailures": 0,
  "liveRenderMethod": "app.render",
  "liveRenderReason": "realtime-pen"
}
```

### animation-table-popup.js

現在の重要な試行差分です。

1. PREVIEW中のstrokeでは、選択CAFを現在Frame preview合成から除外し、選択CAF working Layerまたはoverlayでライブ描画を見せる。
2. preview合成は `animationPreviewBackContainer` に現在Frameの他CAFをdisplay-only合成する。
3. `animationPreviewContainer` はfront / onion系のdisplay-only表示に使う。
4. 新たに `animationPreviewLiveStrokeContainer` を追加し、`animationPreviewContainer` より上に置いた。
5. `animationPreviewLiveStrokeContainer` には、選択CAFのworking layer `layerData.renderTexture` を直接参照する `Sprite` を置く。
6. overlay表示中は、元working Layer本体を `visible = false` にして二重表示を避ける。
7. stroke完了 / cancel / `_restoreVisibility()` でoverlayを破棄し、通常previewへ戻す。
8. `drawing:stroke-updated` では現在、working Layer本体を再可視化せず、overlay Spriteのtexture / position / alpha / blendModeだけ同期する。

この試行の結果:

- overlayを入れると当たり外れは一度消えた。
- ただしstroke中に点滅した。
- moveごとの可視化トグルを止めると点滅は消えた。
- しかし当たり外れが復活した。

## 現在疑っている箇所

以下のどれが本命か、または別の見落としがあるか診断してください。

1. `animationPreviewLiveStrokeContainer` のSpriteが参照しているRenderTextureと、BrushCoreが実際に焼き込むRenderTextureがstroke中にズレる。
2. `LayerSystem.expandLayerRasterToBounds()` または `restoreLayerRasterSnapshot()` が `layerData.renderTexture` / `layerData.layerSprite.texture` を差し替えるタイミングで、overlay Spriteのtexture同期が遅れる。
3. `drawing:before-stroke-start`、`drawing:stroke-started`、`drawing:stroke-updated` の順序が、preview構築 / raster拡張 / overlay作成に対して非対称。
4. `currentFrameContainer` / `animationPreviewBackContainer` / `animationPreviewContainer` / `animationPreviewLiveStrokeContainer` のchild indexが、renderやtable rerenderで揺れている。
5. `_showSelectedClipWorkingLayers()` / `_forceAnimationWorkingLayerVisible()` / `refreshClippingMasks()` が、overlay表示中にも元working Layerの状態を動かし、結果として表示面が揺れる。
6. previewの`_animationPreviewKey` / `_drawingPreviewCompositeKey` が同一stroke内で変化し、preview containerの再構築が挟まっている。
7. PixiJS RenderTextureを同時に「source texture」と「render target」として扱う瞬間があり、見えているSprite更新がフレーム遅延または未定義的になる。

## 期待する回答

回答は、次の形式のMarkdown報告書として出してください。
ファイル名は `tegaki_phase5q_caf_preview_external_report.md` としてください。
ユーザーがダウンロードまたはコピーできる形で出してください。

報告書に含めてほしい内容:

1. 最も疑わしい原因トップ3
2. それぞれの根拠
3. 現行コードで読むべき具体的な関数名
4. 追加すべき最小診断ログ
5. 最小修正案
6. 修正案の副作用リスク
7. 「やってはいけない」対応
8. Codexへ渡す実装指示文

特に、次の問いへ答えてください。

- `RenderTexture`を直接参照するoverlay Sprite方式は、このケースで妥当か。
- 妥当なら、overlay作成タイミング、texture再同期タイミング、元working Layer非表示タイミングはどう整理すべきか。
- 妥当でないなら、PREVIEW中のlive strokeを現行構造でどう見せるべきか。
- `drawing:before-stroke-start` と `drawing:stroke-started` のどちらでpreviewを切り替えるべきか。
- `app.render()` をBrushCore側で呼ぶ設計は続けるべきか、AnimationTablePopup側へ寄せるべきか。

## 回答時の注意

- 外部AIはローカル実行できないため、推測と事実を分けてください。
- 「コードを全部書き換える」提案ではなく、既存構造に対する局所パッチ案を優先してください。
- 保存・export・Undo/Redoに混入する案は不可です。
- UI見た目の大改修ではなく、stroke中のpreview表示安定化に絞ってください。
