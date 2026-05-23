# Phase 4o — ClipAsset / DrawingSnapshot データモデル足場MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4l_report.md`
4. `task-gemini/phase4n_preview_scope_note.md`

特に `phase4n_preview_scope_note.md` の「表示は後で Virtual Layer Panel / Solo / Mute として設計する」方針を踏まえること。

## 目的

Phase 4n までで、アニメテーブルは以下を確認できた。

- セル配置
- duration 変更
- 手動 Capture
- 非破壊プレビューContainer
- 再生中のFrame Composite Preview
- セル選択中の単独確認

ただし現在は、`CelModel.rasterSnapshot` が直接描画内容を持っている。
このまま表示UIやセルフォルダを詰めると、後で `ClipAsset` / 内部レイヤー化の時に作り直しが増える。

Phase 4o では、見た目の追加改修を止め、まず `ClipAsset` と `DrawingSnapshot` のデータモデル足場を作る。

## 長期方針

- `Lane`: タイムライン上のY方向の行。
- `ClipInstance`: Lane上の時間範囲に配置されるセル/クリップ。
- `ClipAsset`: クリップ本体。将来、内部レイヤー構造・内部タイムライン・物理演算を持つ。
- `DrawingSnapshot`: 描画内容の最小保存単位。

今回のMVPでは、まだ本格的な内部レイヤーは作らない。
`CelModel.rasterSnapshot` をすぐ消すのではなく、将来 `ClipAsset` へ移すための橋を作る。

## 実装方針

### 1. データモデルに ClipAsset / DrawingSnapshot を追加

`tegaki_work/system/animation/animation-data-model.js` に、小さく以下のクラスを追加する。

候補:

- `DrawingSnapshotModel`
- `ClipAssetModel`

初期フィールド例:

```js
DrawingSnapshotModel {
  id,
  width,
  height,
  pixels,
  createdAt,
  updatedAt
}

ClipAssetModel {
  id,
  name,
  type: 'raster',
  drawingSnapshotId,
  internalLayers: [],
  createdAt,
  updatedAt
}
```

`pixels` は現行 `rasterSnapshot` と互換のデータを受けられる形にする。
ただし Pixi Texture などの非シリアライズ可能オブジェクトは絶対に入れない。

### 2. TimelineModel に asset/snapshot 保管場所を追加

`TimelineModel` に以下のような保管場所を追加する。

- `clipAssets`
- `drawingSnapshots`

配列でも `Map` でもよいが、serializeしやすい構造を優先する。
MVPでは配列でよい。

### 3. CelModel に assetId を追加

`CelModel` に `assetId` を追加する。

- 現行の `rasterSnapshot` は互換用に残す。
- `assetId` がある場合は、将来そちらを正本にする。
- コメントで `rasterSnapshot` は暫定互換フィールドと明記する。

### 4. Capture時に ClipAsset / DrawingSnapshot も作る

`AnimationTablePopup.captureSelectedCel()` で Snapshot を作成した時、可能なら以下を行う。

- `DrawingSnapshotModel` 相当のデータを `TimelineModel.drawingSnapshots` に追加。
- `ClipAssetModel` 相当のデータを `TimelineModel.clipAssets` に追加。
- 選択中 `CelModel.assetId` に作成した `ClipAsset` の id を入れる。
- 互換のため、`CelModel.rasterSnapshot` も今は残してよい。

このPhaseではプレビュー表示を大きく書き換えない。
プレビューは引き続き `cel.rasterSnapshot` を使ってよい。
余裕があれば、`assetId -> drawingSnapshot` からプレビューする補助メソッドを追加してもよいが、無理に切り替えない。

### 5. serializeを壊さない

既存の `serialize()` に、以下が出るようにする。

- `CelModel.assetId`
- `TimelineModel.clipAssets`
- `TimelineModel.drawingSnapshots`

ただし保存/ロードUIやExportは今回触らない。

## 表示まわりの扱い

このPhaseでは、以下はやらない。

- セルフォルダ表示。
- レイヤーパネルを現在フレームの仮想レイヤー表示へ切り替える。
- Y軸方向オニオンスキン。
- レーン濃淡表示。
- Solo/Mute。
- 選択セル表示UIの大改修。

理由:

これらは `Lane` と `ClipAsset` の置き場所ができてからの方が二度手間が少ない。
今は表示の不足をメモに残し、データモデルを先に進める。

## このPhaseでやらないこと

- `LaneModel` への本格改称。
- `TrackModel.layerId` の削除。
- レイヤーパネルの内部レイヤー切り替え。
- 保存/ロードUIの変更。
- Export実装。
- オニオンスキン。
- Solo/Mute。
- セルD&D移動/コピー。
- 物理演算、メッシュ、ボーン。
- 旧 `animation-system.js` の復活。

## 注意点

- `animation-table-popup.js` のテンプレート文字列・CSS注入ブロックを壊さない。
- 大きなDOM置換や100行超の一括削除は避ける。
- `rasterSnapshot._pixiTexture` のように Snapshot 本体へ Pixi Texture を混ぜない。
- 既存のプレビュー挙動を大きく変えない。
- ビルド後に `dist/` の生成物が差分化しても、コミット対象にしない。

## 完了条件

- [ ] `DrawingSnapshotModel` 相当のデータ構造が追加されている。
- [ ] `ClipAssetModel` 相当のデータ構造が追加されている。
- [ ] `TimelineModel` が `clipAssets` / `drawingSnapshots` を保持できる。
- [ ] `CelModel` が `assetId` を持てる。
- [ ] Capture時に `assetId` がセルへ設定される。
- [ ] 既存の `rasterSnapshot` プレビューは退行しない。
- [ ] 既存のセル配置、選択、削除、duration変更、Captureが退行しない。
- [ ] `serialize()` が新フィールドを含む。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4o_report.md` を作成し、今回どこまで `ClipAsset` 化したか、残課題を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
