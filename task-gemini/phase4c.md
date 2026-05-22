# Phase 4c — アニメテーブルのセル配置MVP

## 概要

Phase 4a で新アニメテーブルの足場、Phase 4b で実レイヤー同期が入った。
Phase 4c では、まだ描画内容や保存形式へ踏み込まず、テーブル上に「セルが置かれている」状態だけを扱えるようにする。

目的は、ToonSquid 2 風の `Track x Frame` マトリクス上で、将来の描画セル・ラスタースナップショット・再生制御へ進む前に、UI とデータモデルの最小往復を成立させること。

## 現在の前提

- `system/animation/animation-data-model.js` には `TimelineModel` / `TrackModel` / `CelModel` がある。
- `TimelineModel.syncWithLayers(layers, activeIndex)` により、アニメトラックは `LayerSystem` の実レイヤーと同期する。
- `ui/animation-table-popup.js` は `LayerSystem` と同期したトラック一覧、24フレーム固定グリッド、現在フレーム表示を持つ。
- `core-engine.js` では `animationSystem.init()` はまだ呼ばない。通常描画への副作用を避けるため、この方針を維持する。
- 旧 `timeline-ui.js` は新テーブルへの導線として触るだけで、Phase 4c でも大改造しない。

## 目標

- グリッドセルをクリックすると、そのトラック・フレームに `CelModel` が作成される。
- 既にセルがある場所をクリックすると、MVPでは削除または選択のどちらか一方を実装する。
- セルは `track.cels` に保持し、UI上では矩形または小さなマークとして表示する。
- `CelModel` は描画内容をまだ持たず、`layerId` / `trackId` / `startFrame` / `duration` / `id` 程度に留める。
- 現在フレームのハイライトは維持する。

## 実装範囲

### 1. データモデル

- `CelModel` に必要なら `trackId` を追加する。
- `TrackModel` に以下のような小さな操作APIを追加してよい。
  - `getCelAtFrame(frameIndex)`
  - `addCel(options)`
  - `removeCel(celId)` または `removeCelAtFrame(frameIndex)`
  - `toggleCelAtFrame(frameIndex)`
- `duration` はまず `1` 固定でよい。
- セルの重なり、伸縮、ドラッグ移動、複数選択は Phase 4c では不要。

### 2. UI

- `animation-table-popup.js` の各 `.anim-cell-slot` に `data-track-id` と `data-frame-index` を付ける。
- セルが存在するスロットには `.has-cel` などのクラスを付ける。
- クリックでセルを追加/削除できるようにする。
- 表示はシンプルでよいが、現在フレーム列とセル表示が見分けられる配色にする。
- JS側で大量の inline style を書かず、CSSクラスで見た目を制御する。

### 3. レイヤー同期との整合

- `syncWithLayers()` 後も、同じ `layerId` のトラックに置いた `cels` は維持する。
- レイヤー削除で対応トラックが消える場合、そのトラック上のセルは消えてよい。
- レイヤーリネームや並び替えではセルが消えないこと。

### 4. 報告

- 作業後に `task-gemini/phase4c_report.md` を作成する。
- `tegaki_work/PROGRESS.md` に実施内容、確認結果、未着手範囲を追記する。

## 禁止事項

- `animationSystem.init()` を復活させない。
- 旧 `animation-system.js` の本格再接続へ進まない。
- 保存/ロード、アルバム、Export、RenderTexture snapshot へ触らない。
- 旧 `timeline-ui.js` を大改造・廃止しない。
- セルのドラッグ移動、伸縮、複製、再生制御へ踏み込まない。
- レイヤーD&D、無限キャンバス、物理演算、WebGPUへ進まない。

## 完了条件

- [ ] 新アニメテーブル上で、任意のトラック・フレームにセルを追加できる。
- [ ] セルがある場所がUI上で判別できる。
- [ ] レイヤーリネーム・並び替え後も、同じレイヤーのセルが維持される。
- [ ] レイヤー削除時に対応セルが破綻しない。
- [ ] 通常描画、QAP、レイヤーパネルに退行がない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4c_report.md` と `PROGRESS.md` が更新されている。

