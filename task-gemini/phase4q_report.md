# Phase 4q — Preview参照元の ClipAsset 化MVP (GEMINI報告)

## 1. 実施内容

### 🏗️ 参照解決ロジックの実装 (TimelineModel)
- **`system/animation/animation-data-model.js`**
    - `TimelineModel` に以下の参照解決メソッドを追加しました。
        - `getClipAsset(assetId)`: IDから `ClipAssetModel` を取得。
        - `getDrawingSnapshot(snapshotId)`: IDから `DrawingSnapshotModel` を取得。
        - `getSnapshotForCel(cel)`: セルが持つ情報を元に、最適な描画スナップショットを解決。
    - **優先順位**: `assetId -> ClipAsset -> DrawingSnapshot` の順で解決を試み、見つからない場合のみ互換用の `cel.rasterSnapshot` (直接保持) を返します。

### 🔄 プレビュー表示の移行
- **`ui/animation-table-popup.js`**
    - `_renderCelPreview()` を改修し、Snapshot を直接参照するのではなく `this.model.getSnapshotForCel(cel)` を介して取得するように変更しました。
    - これにより、同一の `assetId` を参照する複数のセルが、共通のアセットデータを元にプレビュー表示される仕組みが「正本」となりました。

### 📋 COPY/PASTE の正式化
- コピーしたセルの `assetId` が貼り付け先でも正しく参照解決され、アセットを再利用したプレビューが行われることを確認しました。

## 2. 検証結果

### ✅ 動作確認
- **アセット経由の表示**: `CAPTURE` 実行後に生成された `ClipAsset` と `DrawingSnapshot` が、タイムラインプレビュー（パラパラ再生）のデータ元として正しく機能することを確認。
- **Fallback動作**: まだアセットが紐付いていない古い形式のセルや、アセット解決に失敗した場合も、`rasterSnapshot` フィールドによって表示が維持されることを確認。
- **COPY/PASTE連携**: セルを貼り付けた際、データ実体（Pixels）を増やさずに ID 参照だけで同じ絵が表示されることを確認。
- **ビルド**: `npm.cmd run build` 成功。

### ⚠️ 未着手・制限事項
- **ライブラリ管理**: アセットの実体は増えませんが、管理用の UI（アセット一覧など）はまだありません。
- **自動同期**: 描画内容の変更をアセットへ自動反映する機能は将来の課題です。

## 3. 次フェーズへの提案 (Phase 4r)

1. **オニオンスキン基礎**: `animationPreviewContainer` を活用し、前後フレームの Snapshot を半透明（かつ色味を変えて）表示する機能。
2. **自動キャプチャ (Auto-Key)**: 描画終了時に、選択中のセルへ Snapshot を自動的に書き込むオプション。
3. **セルのドラッグ移動 (Move)**: タイムライン上でのセルのドラッグによる位置変更の実装。
