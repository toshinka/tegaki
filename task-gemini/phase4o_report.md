# Phase 4o — ClipAsset / DrawingSnapshot データモデル足場MVP (GEMINI報告)

## 1. 実施内容

### 🏗️ 新データモデルの定義
- **`system/animation/animation-data-model.js`**
    - `DrawingSnapshotModel`: 描画内容（ピクセルデータ、サイズ、作成/更新日時）を保持する最小単位を新設。
    - `ClipAssetModel`: クリップの「正本」となるアセットクラスを新設。名前、型（raster）、および `DrawingSnapshotModel` への参照 ID を保持します。将来の内部レイヤー構造の拡張場所を確保しました。
    - `TimelineModel`: 全アセットを管理する `clipAssets` および `drawingSnapshots` 配列を追加。
    - `CelModel`: 将来の ClipInstance 化を見据え、`assetId` プロパティを追加。

### 📸 Capture時のアセット生成ロジック
- **`ui/animation-table-popup.js`**
    - `captureSelectedCel()` を拡張し、手動キャプチャ時に以下の 3 ステップを自動実行するようにしました。
        1. レイヤーから生のスナップショットを生成。
        2. `DrawingSnapshotModel` を作成し、タイムラインの保管場所へ登録。
        3. `ClipAssetModel` を作成（上記スナップショットを参照）し、タイムラインの保管場所へ登録。
        4. 選択中のセル (`CelModel`) の `assetId` に新アセットを紐付け。

### 🔄 互換性とシリアライズ
- **暫定互換性の維持**: 現在のプレビューロジックが正常に動作し続けるよう、`CelModel.rasterSnapshot` も並行して更新されるようにしています。
- **シリアライズ対応**: `serialize()` メソッドを更新し、新設されたアセットおよびスナップショット群が正しくデータとして書き出されるようにしました。

## 2. 検証結果

### ✅ 動作確認
- **データ構造の確認**: `CAPTURE` 実行後、メモリ上の `TimelineModel` 内に `clipAssets` と `drawingSnapshots` が正しく蓄積されることを確認。
- **プレビューの維持**: 内部的に新モデルが生成されている間も、キャンバス上でのパラパラ再生（Frame Composite Preview）が以前と変わらず正常に機能することを確認。
- **操作の退行**: セル配置、選択、削除、duration変更、パネル移動などの既存機能に影響がないことを目視確認。
- **ビルド**: `npm.cmd run build` 成功。

### ⚠️ 未着手・制限事項
- **アセットの再利用**: 現在はキャプチャごとに新アセットが作られます。同一アセットを別フレームに配置する（インスタンス化）機能は次フェーズ以降。
- **プレビュー層の完全移行**: プレビューは依然として `cel.rasterSnapshot` を参照しています。データモデルが安定した後、`assetId -> drawingSnapshot` からの投影へ移行予定です。

## 3. 次フェーズへの提案 (Phase 4p)

1. **オニオンスキン基礎**: `animationPreviewContainer` を活用し、前後フレームの Snapshot を半透明で重ねて表示する。
2. **自動キャプチャ (Auto-Key)**: 描画終了時に、選択中のセルへ自動的に `CAPTURE` を実行する機能。
3. **アセットの使い回し**: 既存の `ClipAsset` を別のセルに割り当てる最小限の操作（コピー/ペースト等）。
