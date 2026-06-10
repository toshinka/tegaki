# Phase 4q — Preview参照元の ClipAsset 化MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4o_report.md`
4. `task-gemini/phase4p_report.md`
5. `task-gemini/phase4n_preview_scope_note.md`

## 目的

Phase 4o で `ClipAsset` / `DrawingSnapshot` の足場を作り、Phase 4p で同一 `assetId` を複数セルから参照できることを確認した。

ただしプレビュー表示はまだ主に `CelModel.rasterSnapshot` を直接見ている。
Phase 4q では、プレビュー参照元を `assetId -> ClipAsset -> DrawingSnapshot` へ寄せる。

目的は、`Cel` を「描画データ本体」ではなく「ClipAssetへの参照」に近づけること。

## 実装方針

### 1. TimelineModel に参照解決メソッドを追加

`animation-data-model.js` の `TimelineModel` に、以下のような小さな参照解決メソッドを追加する。

候補:

```js
getClipAsset(assetId)
getDrawingSnapshot(snapshotId)
getSnapshotForCel(cel)
```

`getSnapshotForCel(cel)` は以下の順で解決する。

1. `cel.assetId` がある場合、対応する `ClipAsset` を探す。
2. `ClipAsset.drawingSnapshotId` から `DrawingSnapshot` を探す。
3. 見つかれば、それを返す。
4. 見つからない場合だけ、互換用に `cel.rasterSnapshot` を返す。

### 2. AnimationTablePopup のプレビューを assetId 経由へ寄せる

`AnimationTablePopup._renderCelPreview()` で、直接 `cel.rasterSnapshot` を見る前に、`this.model.getSnapshotForCel(cel)` を使う。

- asset経由で見つかる場合は `DrawingSnapshotModel` を表示する。
- fallbackとして `cel.rasterSnapshot` を使う。
- `rasterSnapshot._pixiTexture` のように Snapshot 本体へ Pixi Texture を混ぜない。
- 既存の `_snapshotTextureCache` を維持する。

### 3. Capture時の互換フィールドはまだ残す

`captureSelectedCel()` は、Phase 4qでは大きく変えない。

- `assetId` 生成は維持。
- `rasterSnapshot` 互換フィールドも維持。

ただしプレビューがasset経由で表示できることを確認する。

### 4. Copy/Pasteは assetId を主役にする

Phase 4pのCOPY/PASTEは `assetId` を保持している。
Phase 4qでは、貼り付け先セルが `assetId` 経由で表示できることを確認する。

`rasterSnapshot` 参照は互換用に残してもよいが、表示確認では `assetId` 経由が動いていることを `phase4q_report.md` に明記する。

## このPhaseでやらないこと

- `rasterSnapshot` フィールド削除。
- 保存/ロードUI変更。
- Export。
- セルD&D。
- ライブラリ/保管庫UI。
- ClipAsset名編集。
- 未使用Asset削除/GC。
- オニオンスキン。
- Solo/Mute。
- セルフォルダ / Virtual Layer Panel。
- LaneModel化。

## 注意点

- 既存のプレビュー挙動を大きく変えない。
- `DrawingSnapshotModel` はserialize対象なので、Pixi Textureなど非シリアライズ物を混ぜない。
- `Ctrl+C` / `Ctrl+V` は既存レイヤー操作なので触らない。
- `animation-table-popup.js` のテンプレート文字列・CSS注入ブロックを壊さない。
- ビルド後に `dist/` の生成物が差分化しても、コミット対象にしない。

## 完了条件

- [ ] `TimelineModel.getClipAsset()` 相当の参照解決がある。
- [ ] `TimelineModel.getDrawingSnapshot()` 相当の参照解決がある。
- [ ] `TimelineModel.getSnapshotForCel()` 相当の参照解決がある。
- [ ] プレビュー表示が `assetId -> ClipAsset -> DrawingSnapshot` 経由で動く。
- [ ] `cel.rasterSnapshot` は fallback として残る。
- [ ] COPY/PASTEしたセルが同じ `assetId` 経由で表示される。
- [ ] 既存のCapture、セル選択、削除、duration変更、COPY/PASTEが退行しない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4q_report.md` を作成し、asset経由表示に寄せた範囲と残課題を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
