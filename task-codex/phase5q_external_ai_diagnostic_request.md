# Tegaki Phase 5q 外部AI診断依頼書

この依頼は、GitHub上のコードだけを読める外部AI向けです。ローカル環境や実機には触れない前提で、Animation Table / CAF preview中の描画表示不安定を診断してください。

## 目的

TegakiのAnimation Tableを開き、PREVIEW ONの状態でCAFへペン描画すると、active CAFのlive stroke表示に「当たり / ハズレ」が出ます。

- 当たり: stroke中に線がリアルタイム表示される。
- ハズレ: stroke中はactive CAFの描画だけが見えず、pointerup後にまとめて表示される。
- 他CAFのpreview合成は表示され続けることが多い。
- PREVIEW OFFやAnimation Tableを閉じたLane onionでは、同種の問題が出にくい。
- active CAFをpreview合成にも残す案は、既存線が太る二重表示を戻したうえ、ハズレも残ったため不採用。

診断の主眼は、保存正本やexportではなく、PREVIEW ON中のdisplay-only合成とanimation working Layer表示の契約です。

## 現在の観察メモ

1. 複数Lane / 複数CAFで発生しやすいが、単独Lane CAFでも発生することがある。
2. セル選択時点で「当たり回 / ハズレ回」が決まるように見える。
3. 以前は全CAFが点滅 / 一部CAFが欠落していたが、現在は「active CAFだけstroke中に見えない」方向へ絞れている。
4. `drawing:before-stroke-start` でBrushCoreより前にAnimation Table側がworking Layerをactive化する対策は入っている。
5. BrushCoreはstroke開始時のLayerを `strokeTargetLayer` として保持し、move / realtime / finalizeで同じLayerへ描く対策が入っている。
6. 直近では、`refreshClippingMasks()` 後にPixi Container / 非clipping layerSpriteの表示面を正規化する対策を試している。
7. それでも、当たりが途中でハズレ化するように見える報告がある。

## 調べてほしいこと

次の観点で、コード上の根本原因候補を優先順位付きで出してください。

1. `animation-table-popup.js` のPREVIEW ON中の合成経路
   - `_applyVisibilityPreview()`
   - `_hideTimelineLayersForPreview()`
   - `_showSelectedClipWorkingLayers()`
   - `_ensureWorkingLayerDisplaySurface()`
   - `_handleBeforeStrokeStart()`
   - `_handleDrawingStarted()`
   - `_syncClipAssetToWorkingLayers()`
   - `_ensurePreviewContainer()`
2. `drawing-engine.js` と `brush-core.js` のstroke開始順
   - `drawing:before-stroke-start`
   - `drawing:stroke-started`
   - `strokeTargetLayer`
   - `previewGraphics`
3. `layer-system.js` の表示面更新
   - `refreshClippingMasks()`
   - `restoreLayerRasterSnapshot()`
   - `layerSprite.visible`
   - `renderable` / `culled`
   - `currentFrameContainer` とpreview containerの表示順
4. active CAFだけがstroke中に消える理由
   - preview合成からactive CAFを除外してworking Layerだけに任せる設計が正しいか。
   - working Layerが表示されない場合、Container / Sprite / mask / render order / event timingのどれが一番疑わしいか。
5. 最小修正候補
   - 1案ごとに、対象ファイル、対象関数、変更方針、リスク、確認方法を記載してください。
   - 大規模再設計ではなく、今の構造に沿った小さい修正案を優先してください。

## 禁止・避けたい案

以下は今回の診断対象外です。

- WebGPU化
- SDF / MSDF化
- WebGL2 Mesh化
- DPR 2倍化
- tiled canvas化
- ClipInstance transform / keyframe導入
- Lane完全独立化
- animation working Layer廃止
- 通常LayerSystemとTimelineModelの統合
- 保存正本、export、Undo/Redo、Layer visibility正本へdisplay-only previewを混ぜる案

## 期待する回答形式

最後に、ダウンロード可能なMarkdown報告書として出してください。

可能ならAIツールの「Artifact」「Canvas」「ファイル生成」機能で、次のファイル名のMarkdownを作成してください。

```text
tegaki_phase5q_caf_preview_diagnosis.md
```

ファイル生成機能がない場合は、回答末尾に次の形式でMarkdown本文を出してください。

```markdown
# tegaki_phase5q_caf_preview_diagnosis.md

## 結論

## 根本原因候補

## 優先調査ポイント

## 最小修正案

## リスク

## 追加で必要な情報
```

報告書には、必ず「読んだURL」「参照した関数名」「推奨する最小修正」「なぜその修正でactive CAF stroke表示の当たり外れが減ると考えるか」を含めてください。

## 参照URL

URL一覧は `task-codex/phase5q_external_ai_GitHubURL.txt` を参照してください。

