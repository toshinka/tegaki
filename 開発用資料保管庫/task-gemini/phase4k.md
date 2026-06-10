# Phase 4k — セル別RenderTexture Snapshot手動キャプチャMVP

## 概要

Phase 4i でセル有無による表示ON/OFFプレビュー、Phase 4j でセルの長さ変更と削除ができるようになった。
次は、セルごとに異なる描画内容を持てるようにするための最小実験を行う。

ただし RenderTexture snapshot は既存レイヤー内容を差し替える危険があるため、このPhaseでは **手動Capture + プレビュー限定復元** に絞る。
保存/ロード、Export、Album、Undo/Redo統合、自動キャプチャは扱わない。

## 重要な安全方針

- 既存 `LayerSystem.createLayerRasterSnapshot(layer)` と `restoreLayerRasterSnapshot(snapshot)` を優先利用する。
- `animationSystem.init()` と旧 `animation-system.js` には接続しない。
- プロジェクト保存形式は変更しない。
- Export/Albumへ接続しない。
- プレビュー終了時、必ず作業中レイヤーの元状態を戻す。
- Snapshot適用中に通常描画が混ざると危険なので、このPhaseでは「Capture/Previewの動作確認」を主目的にする。
- 自動保存・自動キャプチャ・フレーム移動時の暗黙保存はまだ行わない。

## 現在の前提

- `CelModel` は `id`, `layerId`, `startFrame`, `duration` を持つ。
- `TrackModel.getCelAtFrame(frameIndex)` で現在フレームのセルを取得できる。
- `AnimationTablePopup.selectedCelId` がある。
- `LayerSystem.createLayerRasterSnapshot(layer)` は履歴用のラスターsnapshotを作成できる。
- `LayerSystem.restoreLayerRasterSnapshot(snapshot)` は指定レイヤーへsnapshotを復元できる。
- Phase 4i の visibility preview は、`layer.visible` の一時切替に留めている。

## 目標

- 選択中セルに、現在の対応レイヤーの描画内容を手動でCaptureできる。
- Capture済みセルには、UI上で小さな印を表示する。
- 現在フレームにCapture済みセルがある場合、そのsnapshotをキャンバスにプレビュー表示できる。
- アニメテーブルを閉じる、または Snapshot Preview を解除した時、元のレイヤー内容へ戻る。
- Captureされていないセルは、従来どおり visibility preview のみで扱う。

## データモデル

### 1. CelModel拡張

`CelModel` に optional な `rasterSnapshot` を追加してよい。

```js
{
  id,
  layerId,
  startFrame,
  duration,
  rasterSnapshot: null | {
    layerId,
    width,
    height,
    pixels,
    pathsData,
    paths
  }
}
```

注意:
- このPhaseでは serialize に含めてもよいが、Project保存へ接続しないため永続化は期待しない。
- `pixels` は大きいので、ログに出さない。

## 実装範囲

### 1. 手動Capture UI

- アニメテーブルヘッダーに `CAPTURE` ボタンを追加する。
- 選択中セルがない場合は何もしない。
- 選択中セルの `layerId` から実レイヤーを探し、`createLayerRasterSnapshot(layer)` でsnapshotを作る。
- 成功したら `cel.rasterSnapshot = snapshot` とする。
- Capture後は `render()` して、セル上に印を出す。

### 2. Snapshot Preview

- Phase 4i の `PREVIEW` がONの時だけ、snapshot previewも動かす。
- 現在フレームにあるセルが `rasterSnapshot` を持つ場合、対応レイヤーへ `restoreLayerRasterSnapshot(cel.rasterSnapshot)` を適用してプレビューする。
- 初めてsnapshot previewを適用する前に、対象レイヤーの現在内容をbackup snapshotとして保存する。
- Preview解除/テーブルを閉じる時は、backup snapshotを復元して作業中レイヤー内容へ戻す。

### 3. 復元ガード

- backupは `layerId -> snapshot` のMapで管理する。
- レイヤーが削除されている場合はエラーにしない。
- 復元後、backup Mapをクリアする。
- 復元処理は `hide()` と PREVIEW OFF の両方で走る。
- `layer:panel-update-requested` は必要な時だけ発行する。

### 4. UI表示

- Capture済みセルに `.has-snapshot` などのクラスを付ける。
- 見た目は小さなドット、斜線、薄い枠など最小でよい。
- 大きなデザイン変更はしない。

## 禁止

- 自動キャプチャしない。
- フレーム移動時に現在セルを暗黙保存しない。
- 保存/ロード形式を変更しない。
- Export/Albumへ接続しない。
- Undo/Redo履歴へ統合しない。
- セル移動、複数選択、左端伸縮を混ぜない。
- レイヤーパネルD&Dを触らない。

## 完了条件

- [ ] 選択セルへ手動Captureできる。
- [ ] Capture済みセルにUI上の印が出る。
- [ ] 現在フレームがCapture済みセル上にある時、その描画内容がキャンバスにプレビュー表示される。
- [ ] PREVIEW OFF またはアニメテーブルを閉じると、Capture前/Preview前のレイヤー内容へ戻る。
- [ ] Captureされていないセルは従来の表示ON/OFF previewのまま動く。
- [ ] 通常描画、QAP、レイヤーパネル、アルバムに退行がない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4k_report.md` と `PROGRESS.md` を更新する。

