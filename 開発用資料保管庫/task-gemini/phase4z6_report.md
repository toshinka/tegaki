# Phase 4z6 — ClipAsset Internal Layer Data Foundation (GEMINI報告)

## 1. 実施内容

### 🏗️ クリップ内部レイヤーのデータ構造導入
- **`system/animation/animation-data-model.js`**
    - **`ClipAssetInternalLayerModel` クラスの追加**: 名前、表示状態、不透明度、合成モード、スナップショットID、親子関係、背景フラグを持つレイヤーモデルを定義しました。
    - **`ClipAssetModel` の拡張**: `internalLayers` を単なる配列から `ClipAssetInternalLayerModel` インスタンスの配列として扱うよう変更し、シリアライズに対応させました。
    - **`TimelineModel` の拡張**:
        - `createClipAssetInternalLayer(options)`: 内部レイヤー作成ヘルパー。
        - `ensureClipAssetInternalLayer(assetId, options)`: 指定アセットに最低1つの内部レイヤーがあることを保証するヘルパー。
    - **アセット生成パスの更新**:
        - `createBlankClipAsset`: 作成時に自動的に「Layer 1」を追加するようにしました。
        - `makeClipAssetUnique`: 独立化（複製）時に内部レイヤーをディープコピーし、新しいIDと複製後のスナップショットIDを割り当てるようにしました。

### 🎨 UI との連動
- **`ui/animation-table-popup.js`**
    - `_captureSelectedClip` / `_ensureInitialClipAssetSeed`: キャプチャや自動シードによるアセット生成時にも、初期内部レイヤーを正しく構成するようにしました。
    - **Asset Library の改善**: 各アセットに内部レイヤーの数（例: `L:1`）を表示するようにし、データ構造の変化を視覚化しました。

### 🔄 互換性の維持
- 内部レイヤー情報を持たない古いデータ（既存アセット）を読み込んだ際も、参照時に自動的に補完・整合性を確保する仕組みを導入しました。

## 2. 検証結果

- **ビルド確認**: `npm.cmd run build` 成功。
- **データ整合性**:
    1. セル作成（Blank Asset） -> ライブラリに `L:1` と表示されることを確認。
    2. UNIQUE実行 -> 複製先も `L:1` を維持し、内部IDが新規発行されていることをコードレベルで想定。
    3. シリアライズ -> 保存データに `internalLayers` の詳細が含まれることを確認。

## 3. 次フェーズへの展望 (以降)

1.  **Clip 内部レイヤー編集 UI**: アセットを選択した際、その内部レイヤーを一覧・編集（表示切り替え、名前変更、追加・削除）できるパネルの実装。
2.  **マルチレイヤーキャプチャ**: 複数の実レイヤーを、1つのアセット内の複数の内部レイヤーとして一括記録する機能。
3.  **Virtual Layer Panel**: タイムラインで選択中のクリップの「内部」だけを、あたかも通常のレイヤーパネルのように操作できる仕組み。
4.  **アセットサムネイル**: 内部レイヤーを合成した結果のプレビュー画像表示。
