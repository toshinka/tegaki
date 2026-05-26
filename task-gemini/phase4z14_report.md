# Phase 4z14 — Frame Asset Tree Helper (GEMINI報告)

## 1. 実施内容

### 🌳 `TimelineModel.getFrameAssetTree` の実装
- **`system/animation/animation-data-model.js`**
    - `TimelineModel` クラスに新ヘルパー `getFrameAssetTree(frameIndex, options)` を追加しました。
    - **機能概要**: 指定されたフレームに使用されている全てのクリップアセットを抽出し、CAF（フォルダ）階層に基づいたグループ構造と、フラットなリストの両方で返します。

### 📊 戻り値の構造
ヘルパーは以下の情報を返します：
- `frameIndex`: 対象のフレーム番号。
- `clips`: タイムラインの Y 軸順（重なり順）に並んだアセット情報のフラットリスト。
- `groups`: CAF（フォルダ）ごとにグループ化されたアセットリスト。
    - `Uncategorized`: フォルダ未指定のアセットをまとめる仮想グループ。
- `missingAssets`: アセット ID が未設定、または参照先のアセットが存在しない異常系クリップのリスト。

### 📋 抽出されるアセット情報
各アセットエントリには以下の詳細が含まれます：
- `clipId` / `laneId` / `laneName` / `laneIndex`: 配置場所の情報。
- `assetId` / `assetName` / `folderId`: アセット本体の属性。
- `internalLayerCount`: 全内部レイヤー数。
- `visibleInternalLayerCount`: 可視設定になっている内部レイヤー数。
- `isBlank`: スナップショットが「空（透明）」であるかどうかのフラグ。
- `startFrame` / `duration`: タイムライン上での配置期間。

## 2. 設計上の工夫

### ↕️ タイムライン Y 軸順の維持
- `this.tracks`（レーンの配列）をインデックス 0 から順に走査することで、タイムライン上の重なり順をそのまま維持しています。
- `groups` リストも、そのフォルダに属するアセットが最初に出現した Y 軸順で追加されるため、プレビューの重なりと整合性の高いツリーが得られます。

### 🛡️ 安全性と互換性
- **例外処理**: アセットが見つからない場合もエラーを投げず、`missingAssets` に記録して処理を継続します。
- **読み取り専用**: モデル内の実データは一切変更せず、既存の描画・編集・保存ロジックに影響を与えません。
- **Uncategorized の扱い**: フォルダ ID が `null` のアセット、および存在しない ID を参照しているアセットは、全て `Uncategorized` グループに集約されます。

## 3. 検証結果

- **ビルド確認**: `npm.cmd run build` 成功。
- **コードレベル確認**:
    - `this.tracks` の走査順序が UI のレーン順序（上から下）と一致していることを確認。
    - 内部レイヤー数や `isBlank` フラグが最新のデータモデル定義から正しく算出されることを確認。

## 4. 次フェーズへの展望 (以降)

1.  **Layer Panel CAF Header**: 今回のヘルパーを利用し、レイヤーパネルの上部に「現在のフレームで使われている素材」を読み取り専用で表示する。
2.  **Virtual Layer Panel**: タイムラインで選択中の「内部レイヤー」を、あたかも通常のレイヤーパネルのように操作可能にする。
3.  **Asset Thumbnail**: 内部レイヤーを合成したサムネイル画像をツリー表示に統合する。

## 5. Codex確認追記

- `getFrameAssetTree()` はUI非依存の純データヘルパーとして実装されており、既存PreviewやAsset Library操作へ副作用を出さない形になっています。
- 抽出順は `this.tracks` の配列順で、初期実装としてはタイムラインY軸順を優先する判断と一致しています。
- `assetId` 欠落/参照切れは `missingAssets` に入り、存在しない `folderId` はUncategorized扱いになるため、後続UI側で安全に扱えます。
- 次Phaseは、このヘルパーを使った読み取り専用のCAF表示に進められます。ただし、まだ `.layer-item` を流用せず、SortableJS対象外の専用DOM/classから始める必要があります。
