# Phase 4z12 — ClipAsset / Lane Migration Plan

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4n_preview_scope_note.md`
6. `task-gemini/phase4z3.md`
7. `task-gemini/phase4z10.md`
8. `task-gemini/phase4z10_report.md`
9. `task-gemini/phase4z11.md`
10. `task-gemini/phase4z11_report.md`
11. `tegaki_work/system/animation/animation-data-model.js`
12. `tegaki_work/ui/animation-table-popup.js`
13. `tegaki_work/system/layer-system.js`
14. `tegaki_work/ui/layer-panel-renderer.js`

## 重要な注意

- 今回は **設計棚卸しと移行計画作成だけ** を行う。
- 原則としてJS/CSSの実装変更はしない。
- 例外的に明らかな誤字やドキュメント追記が必要な場合も、まず報告書に書く。勝手に広範囲修正しない。
- LaneのY軸表示を `Lane1 / Lane2...` へ切り替える実装は今回しない。
- 通常Layer/通常FolderをClipAssetFolderへ一括変換する実装は今回しない。
- ClipAssetをTimelineセルへ配置する実装は今回しない。
- Virtual Layer Panelは今回しない。
- 内部Layerへの直接描画は今回しない。
- Asset/Folder D&Dは今回しない。
- `animation-table-popup.js` は肥大化しているため、今回の調査で問題を見つけても大規模修正へ進まない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z11までで、ClipAsset / ClipAssetFolder / ClipAsset内部Layer は以下の状態になった。

- ClipAssetFolderはAsset Library上で作成・リネーム・Asset移動できる。
- ClipAssetは内部Layerを持てる。
- 内部LayerはInspectorで追加・削除・リネーム・visible切替・順序変更できる。
- Previewでは内部Layerの合成表示ができる。

ただし、TimelineのY軸はまだ通常Layer由来の暫定Laneである。

現状のイメージ:

```text
Y軸:
通常Layer 1
通常Layer 2
通常Layer 3
```

長期到達点の候補:

```text
Y軸:
Lane 1

Lane 1 / Frame 1:
ClipAsset または ClipAssetFolder由来のClip
  - 内部Layer 1
  - 内部Layer 2
  - 内部Layer 3
```

つまり、これまで通常Layer 1〜3に分かれていた「犬の主線・表情・塗り」などは、将来的には `犬` というClipAssetまたはClipAssetFolder配下の内部Layer群として扱い、Timeline上では1つのClipInstanceとして配置する方向を検討する。

この移行は、データモデル、Preview、編集対象、通常レイヤーパネル、保存/復元に波及するため、Gemini Flashでいきなり実装しない。

Phase 4z12では、実装前の設計棚卸しを行い、次に小さく実装できるPhaseへ分解する。

## 目的

現在の `Lane = 通常Layer由来` の暫定構造から、`Lane = 時間軸上の配置行`、`ClipAsset = 中身を持つ素材`、`ClipAssetInternalLayer = 素材内部の作画レイヤー` へ移行するための計画を作る。

目的は以下。

- 現在コード上でLaneが通常Layerに依存している箇所を洗い出す。
- Timeline Y軸を `Lane1 / Lane2...` 表示へ変える場合の影響範囲を整理する。
- ClipAssetFolder / ClipAsset / 内部LayerをTimelineへどう表示・配置するべきか案を作る。
- 「次に実装してよい最小Phase」を候補化する。
- 危険な一括移行を避ける。

## 今回やること

### 1. Laneと通常Layerの依存箇所を棚卸しする

以下を中心に読む。

- `animation-data-model.js`
  - `LaneModel`
  - `ClipInstanceModel`
  - `TimelineModel.syncWithLayers()`
  - `getLaneForSourceLayer()`
  - `moveClip()`
  - `serialize()`
- `animation-table-popup.js`
  - Lane/Track表示生成
  - `_ensureInitialClipAssetSeed()`
  - `_captureSelectedClip()`
  - `_renderFrameComposite()`
  - `_renderCelPreview()`
  - Preview / Onion / Scope ALL/LANE/SET
- `layer-system.js`
- `layer-panel-renderer.js`

報告書に以下を書く。

- Laneが `sourceLayerId` / `layerId` に依存している箇所。
- 表示名が通常Layer名由来になっている箇所。
- PreviewがsourceLayerのopacity/blendMode/visibleに依存している箇所。
- CAPTURE/AUTO/EDITが通常Layer前提になっている箇所。

### 2. 将来のY軸表示案を整理する

次の2案を比較する。

#### 案A: 既存Laneを徐々に独立化

- 既存 `LaneModel.sourceLayerId` を当面残す。
- 表示名だけ `Lane 1` などへ切り替える。
- ClipAsset配置やPreviewは段階的にsourceLayer依存を減らす。

#### 案B: 新しい独立Laneを追加

- 通常Layer同期Laneとは別に、ClipAsset用の独立Laneを追加する。
- 新しいLaneだけ `sourceLayerId` を持たない。
- 旧Laneは互換/移行用として残す。

報告書に以下を書く。

- それぞれの利点。
- それぞれの危険。
- Geminiが実装してよい小さな範囲。
- Codex判断へ戻すべき範囲。

### 3. ClipAssetFolder / ClipAsset / ClipInstance の関係案を書く

以下の用語を混同しないように整理する。

- ClipAssetFolder: 保管庫/分類単位。例: 犬、猫、背景素材。
- ClipAsset: Timelineへ配置できる素材本体。内部Layerを持つ。
- ClipInstance: Timeline上の配置。Frame / duration / laneを持つ。
- ClipAssetInternalLayer: ClipAsset内部の作画Layer。線画/塗り/影など。
- Lane: Timeline上の縦方向の配置行。通常Layerそのものではない。

報告書に、以下の対応表を書く。

```text
概念 | 現状 | 将来候補 | 実装リスク
```

### 4. 最小実装Phase候補を3つ出す

次に進む実装候補を3つ出す。

候補例:

1. `Phase 4z13 — Lane Display Label MVP`
   - Y軸表示だけ `Lane 1` 形式にする。
   - データ構造はまだ変えない。

2. `Phase 4z13 — ClipAsset Assignment Shelf`
   - Asset Libraryで選択したClipAssetを、選択中Clipへ割り当てる最小操作を作る。
   - TimelineへD&D配置はしない。

3. `Phase 4z13 — Virtual Layer Panel Inventory`
   - 通常レイヤーパネルをClipAsset内部Layerへ切り替えるための接続点だけ棚卸しする。

Geminiは候補を出すだけで、実装しない。

### 5. 危険箇所と禁止すべき一括変更を書く

報告書に、次に絶対やらない方がよいことを書く。

例:

- `syncWithLayers()` を丸ごと書き換える。
- 通常レイヤーパネルをいきなりClipAsset内部Layer表示へ差し替える。
- 既存Clipの `sourceLayerId` を一括削除する。
- 保存形式を一気に変更する。
- D&DをTimeline / Asset Library / Layer Panelへ同時に入れる。

## 今回作る成果物

以下の報告書を作成する。

- `task-gemini/phase4z12_report.md`

この報告書は、次のCodex判断に使う設計メモであり、実装完了報告ではない。

報告書の推奨構成:

```md
# Phase 4z12 — ClipAsset / Lane Migration Plan (GEMINI報告)

## 1. 現状の依存関係

## 2. 将来構造案

## 3. 案A / 案B 比較

## 4. 次の小Phase候補

## 5. 危険箇所・禁止すべき一括変更

## 6. Codexに判断してほしい点
```

## 今回やらないこと

- JS/CSSの実装変更。
- Timeline Y軸表示変更。
- Laneデータモデル変更。
- `syncWithLayers()` の改修。
- ClipAssetをTimelineへ配置する処理。
- ClipAssetFolderをTimeline上へ表示する処理。
- Virtual Layer Panel。
- 内部Layerへの直接描画。
- 保存/復元形式の変更。
- Export連携。
- D&D追加。

## 受け入れ条件

- `task-gemini/phase4z12_report.md` が作成される。
- Laneと通常Layerの依存箇所が具体的な関数名/メソッド名つきで列挙されている。
- Y軸表示を `Lane1 / Lane2...` へ変える場合の影響範囲が書かれている。
- ClipAssetFolder / ClipAsset / ClipInstance / ClipAssetInternalLayer / Lane の関係が整理されている。
- 次の実装候補が3つ以上あり、それぞれリスクと完了条件が書かれている。
- 危険な一括変更が明記されている。
- `tegaki_work/PROGRESS.md` の最上部にPhase 4z12の棚卸し完了ログが追記される。
- コード変更をしていないこと。もし必要に迫られて変更した場合は、その理由と変更ファイルを明記すること。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z12 棚卸し完了ログを追記する。

最低限、以下を書く。

- Phase 4z12 の目的。
- 読んだ主なファイル。
- 作成した報告書。
- 次の小Phase候補。
- Codexに判断してほしい点。

