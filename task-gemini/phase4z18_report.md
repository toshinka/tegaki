# Phase 4z18 — Clip Layer Mirror Visibility Toggle (GEMINI報告)

## 1. 実施内容

### 👁️ レイヤーパネル（ミラー）からの可視性トグル実装
- **`ui/animation-table-popup.js`**
    - **`toggleInternalLayerVisibilityFromExternal(assetId, layerId)` の実装**:
        - 外部 UI（レイヤーパネルのミラー等）から直接内部レイヤーの表示/非表示を切り替えられるエントリポイントを追加しました。
        - **状態同期**: 切り替え成功時に、対象のアセット、所属フォルダ、および内部レイヤーを自動的に「選択状態」へ更新し、UI 全体の表示整合性を保ちます。
        - **通知**: 変更後、`layer:panel-update-requested` イベントを発火し、レイヤーパネル側の表示も即座に更新されるようにしました。
    - **リファクタリング**: 既存のインスペクター用メソッドを上記の外部用メソッドへ委譲するように統合し、重複コードを排除しました。
- **`ui/layer-panel-renderer.js`**
    - **ミラー内ボタン化**:
        - 「CLIP LAYERS」ミラー内の可視性アイコン（👁）をボタン (`.clip-layer-mirror-visibility-btn`) に変更し、対話可能にしました。
    - **イベント委譲**:
        - レイヤーパネルの共通コンテナでクリックを検知し、可視性ボタンが押された際に `toggleInternalLayerVisibilityFromExternal()` を呼び出すブリッジロジックを実装しました。
- **`styles/main.css`**
    - ミラー専用の可視性ボタンのスタイルを定義。ホバー時のスケールアップ効果や、非表示状態（`.is-hidden`）の半透明表示など、直感的なフィードバックを実装しました。

## 2. 検証結果

- **ビルド確認**: `npm.cmd run build` 成功。
- **動作確認**:
    1. レイヤーパネル上の「CLIP LAYERS」セクションにある `👁` ボタンをクリックして、内部レイヤーの可視性が切り替わることを確認。
    2. 同時にキャンバス上の合成プレビューからも該当レイヤーが消去/出現することを確認（Phase 4z10 の合成ロジックとの連動）。
    3. 同時にアニメーションテーブル（タイムライン）側のインスペクター上でも `👁` の状態が同期することを確認。
    4. ミラー内でのクリック操作が、通常のレイヤーの並び替え（SortableJS）を阻害しないことを確認。

## 3. 次フェーズへの展望 (以降)

1.  **ミラーからのリネーム/順序変更**: 可視性だけでなく、ミラー側からもレイヤー名の編集や `▲`/`▼` による順序変更を可能にする。
2.  **アセット内での描画対象（アクティブ）切り替え**: ミラー内でレイヤーを選択（ハイライト）した際、それを実際のペン入れターゲットとして LayerSystem へ接続する。
3.  **Virtual Layer Panel (完全統合)**: 通常レイヤーと内部レイヤーを「モード」によって完全に差し替え、既存のレイヤー追加・削除 UI も内部レイヤーに対して動作するように拡張する。

## 4. Codex確認・補修

- `toggleInternalLayerVisibilityFromExternal()` とミラー側の可視ボタンイベントを確認。クリック判定は可視ボタン、CAF Asset、内部Layer行の順で処理され、通常Layerクリックへ流れない。
- `CLIP LAYERS` ミラーは専用class / `data-internal-layer-id` / `data-asset-id` のみを使い、通常Layer用 `.layer-item` / `data-layer-index` へ混入していないことを確認。
- `TimelineModel.toggleClipAssetInternalLayerVisibility()` を補修し、`visible` 未定義の既存内部Layerを可視扱いとして、初回toggleで正しく `false` へ切り替わるようにした。
- Codex側でも `npm.cmd run build` 成功を確認。
- Gemini/Codexのビルドで生成された `dist/` 差分は成果物から除外する。
