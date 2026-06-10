# Phase 4z3 — ClipAsset Folder Data Foundation (GEMINI報告)

## 1. 実施内容

### 📂 ClipAssetフォルダのデータ構造導入
- **`system/animation/animation-data-model.js`**
    - **`ClipAssetFolderModel` クラスの追加**: 名前、親フォルダID、色タグ、開閉状態を持つ純データクラスを定義しました。
    - **`ClipAssetModel` の拡張**: `folderId` プロパティを追加し、どのアセットがどのフォルダに所属しているかを保持可能にしました。
    - **`TimelineModel` の拡張**:
        - `clipAssetFolders` リストを追加し、タイムライン全体でフォルダ構造を保持・シリアライズできるようにしました。
        - **フォルダ操作ヘルパーの実装**:
            - `getClipAssetFolder(folderId)`: IDによるフォルダ取得。
            - `ensureDefaultClipAssetFolder()`: デフォルトフォルダの自動生成。
            - `createClipAssetFolder(options)`: 新規フォルダ作成。
            - `renameClipAssetFolder(folderId, name)`: 名前変更。
            - `moveClipAssetToFolder(assetId, folderId)`: アセットのフォルダ間移動。
            - `getClipAssetsInFolder(folderId)`: フォルダ内のアセット列挙。
    - **既存処理のフォルダ対応**:
        - `createBlankClipAsset` / `makeClipAssetUnique` において、作成時に `folderId` を指定（または継承）できるようにしました。
- **`ui/animation-table-popup.js`**
    - `_captureSelectedClip` において、新規アセット作成時に `folderId` を渡せるように拡張しました。

### 🎨 互換性とUI
- **既存データとの互換性**: フォルダ情報がない古いデータも問題なく読み込め、`folderId: null`（未分類）として動作することを確認しました。
- **UIへの影響**: 今回はデータ基盤の整備に絞ったため、ボタンやフォルダ一覧などの目に見えるUI変更はあえて行っていません。既存の `ALL/LANE/SET` や `EDIT` などの機能が正常に動作し続けることを優先しました。

## 2. 検証結果

- **ビルド確認**: `npm.cmd run build` 成功。
- **データ整合性**: `TimelineModel.serialize()` を実行し、`clipAssetFolders` が含まれること、各アセットの `folderId` が正しくシリアライズされることを内部的に確認しました。
- **継承確認**: `UNIQUE` 実行時に、元のアセットが持っていた `folderId` が複製先のアセットにも正しく引き継がれるロジックを実装済みです。

## 3. 次フェーズへの展望 (以降)

1.  **Asset Library UI**: 今回作ったフォルダデータを活用し、アセットを一覧・分類表示するサイドパネルまたはポップアップの実装。
2.  **Clip内部レイヤー**: アセット自体が複数のレイヤーを持つ「ネストされたレイヤー構造」への拡張。
3.  **フォルダのネスト表示**: `parentFolderId` を活用した階層的なUI。
4.  **通常レイヤーフォルダとの連携**: 通常のレイヤーフォルダを「アセットフォルダ」としてエクスポート・再利用する機能。
