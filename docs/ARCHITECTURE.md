# 現行Architecture

状態: CURRENT。2026-09-05監査。実装の存在と制約を記録し、目標構造は末尾で別に示す。
監査のcoverageと既知不具合は[AUDIT](AUDIT.md)。語彙は[VOCABULARY](VOCABULARY.md)。

## 起動と接続

`index.html → core-initializer.js → CoreEngine.initialize()`。
`core-engine.js`がLayerSystem、DrawingEngine、History、Project/Export、PopupManager、LayerPanelRenderer、KeyboardHandlerを接続する。
AnimationTablePopupを生成し、その同期Transform adapterをLayerSystemへ注入する。
`window.*`登録と旧AnimationSystem/TimelineUIは互換境界として残る。新しい機能所有者と誤認しない。

## データの所有

| データ | 現行の所有・保存場所 | runtime派生物・注意 |
|---|---|---|
| 通常Raster | LayerSystemのLayer / RenderTexture、ProjectのLayer画像・rasterBounds | Sprite/Containerは描画表現。path一覧が全Rasterの正本ではない |
| アニメ配置 | TimelineModel.tracks/cels = Lane/ClipInstance | 旧名を保存互換のため保持 |
| 再利用する原画 | ClipAsset.internalLayers + DrawingSnapshotのpixels/bounds | Assetを共有する複数ClipへSetup変更が及ぶ |
| CAF working Layer | 選択Assetを描画engineへ接続する表示・入力adapter | 保存正本にしない。Tableを閉じてもCAF編集が続く場合あり |
| CAF全体Motion | ClipInstance.transform / transformKeyframes | 全内部Layerへ同じroot変形 |
| 個別Raster Motion | ClipInstance.layerTransformTracks | internalLayerId/pivot/keyframes。選択行へroot keyをechoしない |
| root / Folder / Layer WARP | ClipInstance.deformer / folderDeformers / layerDeformers | 同じdeformer正規化/評価primitiveを再利用。対象範囲は別 |
| Rig Setup | ClipAsset.rigDefinition | Part/Bone/Bind/静的接続 |
| Rig演技 | ClipInstance.rigMotion | Frame Pose。UI treeやBone overlayが正本ではない |
| Mesh / Skin | ClipAsset.meshDefinitions / skinBindings | topology/UV/weightは静的。GPU buffer/評価頂点は保存しない |
| History | HistoryManagerの線形command列 | 通常Raster/CAFごとに異なるcommandが同じ時系列へ記録される |
| 再編集用ファイル | ProjectManagerがserializeしたProject JSON | runtime/HistoryのTypedArrayをJSON境界でencode |
| Album / Recovery | 各storageのIndexedDB | 作業Projectと別の保管・復帰境界。唯一のProject正本と説明しない |
| UI現在地 | selection、mode、popup位置等のruntime/既存設定 | UI stateを新しいProject fieldへ自動昇格しない |

## Drawing

入口: [drawing-engine.js](../tegaki_work/system/drawing/drawing-engine.js)、[pointer-handler.js](../tegaki_work/system/drawing/pointer-handler.js)、[brush-core.js](../tegaki_work/system/drawing/brush-core.js)。

Pointer/coalesced input → client/canvas/world/local計算 → 短線分 → RenderTextureへlive bake → stroke完了時History。
StrokeRecorderはlocal座標・筆圧等を記録する。pen/eraser、airbrush、blurの経路とcleanupは同一ではない。

現コードではDrawingEngineとBrushCoreが同じclient座標を別々に変換する箇所がある。
「変換済localへもう一度変換をかける」不具合と断定せず、重複計算/責務説明の負債として扱う。
一本化時はstroke target、camera変更、bounds拡張の意味を固定してから変更する。

通常pen/eraserは条件成立時dirty-rect patch History、bounds変更や非対応toolはfull snapshot fallback。
before snapshotはbounds拡張前に取る。animation working Layerはこの通常History入口から除外する。
patch保持量削減とUndo時readback削減は別で、後者は未達の箇所がある。

## LayerとCAF編集

入口: [layer-system.js](../tegaki_work/system/layer-system.js)、[animation-table-popup.js](../tegaki_work/ui/animation-table-popup.js)、[layer-panel-renderer.js](../tegaki_work/ui/layer-panel-renderer.js)。

LayerPanelRendererは共通UI、通常LayerとCAFは別data adapterという既存契約を維持する。
`getLayers()`は現在のFrame Containerの子であり、通常Layerだけを返すAPIではない。
内部Layer IDとworking Layer IDの対応を確認し、UIのactive indexを永続IDの代用品にしない。
背景は特別な不透明Layer。Lane/CAFへ変換しない。

表示階層のparentLayerIdとRigのparentPartId/parentBoneIdは別。
reparent、duplicate、deleteはAsset内部IDだけでなく全参照Clipの時間effectへ波及する。
このlifecycleに今回新たな排他・複製の穴を確認したため、機能を一般化する前に[WP-002](work/WP-002-effect-guards.md)で補修する。

## Transform session

入口: [layer-transform.js](../tegaki_work/system/layer-transform.js)、LayerSystem、[transform-edit-context.js](../tegaki_work/system/animation/transform-edit-context.js)、[transform-edit-transaction.js](../tegaki_work/system/animation/transform-edit-transaction.js)。

| context | preview/commit所有 | commit結果 |
|---|---|---|
| 通常Raster SOURCE | LayerSystem | 1回Raster bake、通常History |
| CAF原画 SOURCE | LayerSystem表示 + PopupのCAF source同期 | Asset/Snapshot、CAF History |
| Table表示中のANIMATE | LayerSystem入力 + Popup同期adapter | ClipInstanceの対象KEY、Timeline History |
| pixel selection | PixelSelectionSystem floating session | 選択Raster合成、既存History |

ANIMATE入場だけではKEYを作らない。固定baselineからpreviewし、変更あり確定はHistory 1件、cancel/no-opは0件。
通常Frame変更/Table closeと、KEY stripの明示的連続編集はterminalが異なるため混同しない。
既存KEY stripの再入場失敗は未解決。Panel visibility、Keyboard V、Camera V、session identityの同期を[WP-003](work/WP-003-key-continuation.md)で検証する。

WARP Simple 4x4はmodel/Project/CPU/Pixi側配線/transactionまで存在し、UIは旧9q Task Eが未完。
SOURCEのbakeとANIMATEのlayerDeformersを同じ保存処理へまとめない。

## Animation評価と出力

入口: [animation-data-model.js](../tegaki_work/system/animation/animation-data-model.js)、[folder-part-render-plan.js](../tegaki_work/system/animation/folder-part-render-plan.js)、[timeline-frame-compositor.js](../tegaki_work/system/animation/timeline-frame-compositor.js)。

現在の対象Raster経路:

```text
DrawingSnapshot
  → Layer WARP → Layer Motion
  → Folder単位合成/WARP・適用可能なRig/Skin plan
  → root WARP → root Motion → Lane合成 → Project frame出力
```

上図は任意effectを同時に重ねられる宣言ではない。対象の重複/clipping/RenderIsland制約をrender planが判定する。
Rig/Mesh/Skinは別の評価入力を持ち、同じRasterのLayer Motion/WARPと自由に合成できない。
CPUとPixiは同じplan/evaluatorを参照するが、別consumerであり、文字列配線検査だけでは画素一致を保証しない。
Layer Motionだけのunsupported planの拒否がCPU側で抜ける箇所は[WP-004](work/WP-004-output-terminal.md)へ。

## Project・History・外部出力

入口: [project-manager.js](../tegaki_work/system/project-manager.js)、[history.js](../tegaki_work/system/history.js)、[export-manager.js](../tegaki_work/system/export-manager.js)。

- Project saveは未確定selection/Transformを既存terminalへ通して採取する。無変更saveでSnapshot IDを更新しない。
- loadは旧Folder構造補完、optional Rig/Mesh/WARPの検証、mask解除後のLayer交換を持つ。トップschemaの完全な事前検証・atomic loadまで保証されていない。
- Project全体loadでのHistory clearと、Frame/CAF切替で履歴を保つことを区別する。
- exportはTimelineModelを使うcompositor経路と旧AnimationSystem fallbackを持つ。
- Project saveとExportの未確定Transform終端が同じかは未検証。現在同一契約とは記さない。
- History commandは `{ name, do, undo, byteSize?, meta? }`。失敗時redo indexの二重減算は[WP-001](work/WP-001-history-failure.md)へ。

## UI / CSS / event

palette/semantic tokenは`styles/main.css`、抽出済み静的styleは`styles/components/`。
未抽出injected styleは残っている。component CSSとの二重宣言を増やさず、runtime座標/寸法だけJSに置く。
詳細の現行style所有は[UI map](UI_DESIGN_AUTHORITY_MAP.md)、規約は[Style Guide](../開発用資料保管庫/proposals/UI_CSSスタイルガイド.md)。
EventBusは通知と既存互換を担う。同名eventの送受信/payloadを変更時に検索する。
全caller一覧を手動文書化しない。KEY terminal等、順序が重要な処理は同期adapterの契約と実操作を確認する。

## ゼロベース構造との比較（提案、未実行）

| 案 | 利点 | 費用・危険 | 判断 |
|---|---|---|---|
| 現状維持＋文書のみ | 最小の移行費用 | 24,330行PopupがUI/編集/History/previewを跨ぎ探索負荷が残る | 当面の停止点として可、長期の解決には不足 |
| 既存model/evaluatorを維持した段階抽出 | 保存・バグ修正資産を再利用、薄い変更ごとに比較可能 | facade越しの互換期間とcharacterizationが必要 | 推奨。最初は一つの編集session境界だけ設計 |
| 全面rewrite | command/model/viewを最初から整列可能 | 入力品質、旧Project、mask、出力、操作習慣を再証明する費用が大きい | 比較候補として保持、採用根拠は現時点で不足 |

理想は「domain data/evaluator → 編集command/session → renderer/storage adapter → UI projection」。
既存のpure helper群は既にこの方向の資産。全module再配置や共通Base class新設は先行しない。
新しいデータ所有を作る必要性と移行方式は[HD-001](ROADMAP.md#human-decisions)でレビューする。
