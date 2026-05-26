# Phase 4z10 — ClipAsset Internal Layer Composite Preview Foundation (GEMINI報告)

## 1. 実施内容

### 🏗️ 内部レイヤー合成プレビューの基盤実装
- **`system/animation/animation-data-model.js`**
    - `TimelineModel.getPreviewInternalLayersForCel(cel)` を追加しました。
    - クリップが参照しているアセットの内部レイヤーから、描画対象（raster かつ Snapshotあり）を抽出・解決するヘルパーです。
    - 内部レイヤーが空の場合の自動補完機能も備えています。
- **`ui/animation-table-popup.js`**
    - **`_renderClipAssetInternalLayerPreview()` の実装**:
        - 解決された内部レイヤーを背面から前面（配列の末尾から先頭）の順で合成描画するロジックを実装しました。
        - **可視性 (`visible`)**: `false` のレイヤーは描画をスキップ。
        - **不透明度 (`opacity`)**: 実レイヤーの透明度と内部レイヤーの透明度を掛け合わせて反映。
        - **合成モード (`blendMode`)**: 内部レイヤーの設定を優先し、PixiJS の Sprite に適用。
    - **`_renderCelPreview()` の分岐**:
        - 内部レイヤーが存在する場合は合成プレビューを優先し、存在しない場合や失敗した場合は従来の単一 Snapshot プレビューへフォールバックする安全な構成にしました。

### 🎨 レイヤー順序の解釈
- Inspector 上で「上にあるレイヤー」が「前面」に見えるよう、描画時は配列を逆順（末尾 -> 先頭）に処理する仕様としました。これにより、一般的なペイントソフトと同様の感覚でレイヤー構成を確認できます。

## 2. 検証結果

- **ビルド確認**: `npm.cmd run build` 成功。
- **動作確認**:
    1. 既存のクリップ（Auto Seed 等）が従来通りプレビューされることを確認。
    2. 内部レイヤーを追加し、複数枚が重なって表示されることを確認。
    3. 内部レイヤーの `visible` を Inspector で切り替え、キャンバス上のプレビューが即座に同期することを確認。
    4. 内部レイヤーの順序を入れ替えた際、重なり順が正しく変化することを確認。

## 3. 次フェーズへの展望 (以降)

1.  **内部レイヤー編集の本格化**: 内部レイヤーごとの `opacity` / `blendMode` を UI から変更できるスライダーやセレクトボックスの実装。
2.  **Virtual Layer Panel**: メインのレイヤーパネルの描画対象を、タイムラインで選択中の「内部レイヤー」へ動的に切り替える仕組み。これにより、アセット内部への直接描き込みが可能になります。
3.  **合成プレビューの最適化**: 毎回 Sprite を生成するのではなく、アセットが更新されたタイミングで RenderTarget 等へ焼き込みを行い、キャッシュする処理の検討。

## 4. Codex確認追記

- `getPreviewInternalLayersForCel()` のPreview対象抽出を、`drawingSnapshotId` の有無だけでなく実Snapshot取得まで確認する形に補修しました。
- これにより、内部Layerが壊れたSnapshot参照だけを持つ場合でも、空Previewで止まらず従来の単一Snapshot Previewへfallbackできます。
- Codex側でも `npm.cmd run build` 成功を確認しました。
