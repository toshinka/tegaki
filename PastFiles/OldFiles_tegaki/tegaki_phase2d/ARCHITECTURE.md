# TEGAKI ARCHITECTURE MAP

> Phase 1j: AI 向けの構造マップ。現行実装の責務境界とデータ経路を定義する。

---

## 1. 起動・初期化シーケンス

1.  **エントリーポイント**: `index.html` が `core-initializer.js` を読み込む。
2.  **基盤初期化**: `CoreInitializer.initialize()` が PixiJS `Application` を作成し、`CoreEngine` をインスタンス化。
3.  **サブシステム初期化**: `CoreEngine.initialize()` が以下の順序で各部を接続。
    - `DOMBuilder`: UI 構造（サイドバー、ステータスバー等）を構築。
    - `coordinateSystem`: 座標変換基盤。
    - `cameraSystem`: ズーム・パン・表示コンテナ管理。
    - `layerSystem`: レイヤー構造、RenderTexture 管理。
    - `thumbnailSystem`: サムネイル生成・キャッシュ。
    - `brushCore`: ストローク制御。
    - `drawingEngine`: PointerEvent 入口、座標変換の橋渡し。
    - `popupManager`: 設定、リサイズ、エクスポート等のポップアップ。
    - `uiController`: UI イベントの統合制御。
    - `keyboardHandler`: ショートカット検知。

---

## 2. 描画パイプライン (Raster-Bake)

現在の標準方式は「ストローク中の逐次焼き込み」方式。

1.  **Input**: `DrawingEngine` が `PointerHandler` 経由でブラウザイベントを受信。
2.  **Transform**: `coordinateSystem` により `Screen -> Canvas -> World -> Local(Layer)` へ変換。
3.  **Record**: `StrokeRecorder` が変換後の座標と筆圧を記録。
4.  **Live Bake**: `BrushCore` が `StrokeRenderer` を呼び出し、短い線分（セグメント）を生成。
    - 生成された `Graphics` を対象レイヤーの `RenderTexture` へ `renderer.render()` で焼き込む。
    - 消しゴムの場合は `blendMode = 'erase'` で焼き込む。
5.  **Finalize**: `pointerup` 時に `History` へ `record()`。Undo 用のスナップショットを保持。

---

## 3. レイヤー・変形・サムネイル

- **レイヤー構造**: `Pixi.Container` の中に `Pixi.Sprite` があり、その `texture` が `Pixi.RenderTexture`。
- **変形 (Vキー)**: `LayerTransform` が制御。
    - 変形中は `Container` の `position/scale/rotation` を変更。
    - 確定時に `layerSystem.bakeTransform()` が `RenderTexture` を新しく書き出し、コンテナの変形を 0/1 へリセットする。
- **サムネイル**: `thumbnailSystem` が `RenderTexture` から `extract.pixels()` で生データを取得し、Canvas 経由で PNG dataURL を生成。

---

## 4. 保存・エクスポート

- **プロジェクト保存**: `ProjectManager` が担当。
    - 全レイヤーのメタデータと画像を JSON にまとめ、ローカルファイルとして保存。
- **アルバム保管**: 現行UIでは `AlbumPopup` が担当し、`localStorage` の `tegaki_album` を正本にする。
    - 各スナップショットは `thumbnail` と `projectData` を持つ。
    - アルバムHTML書き出しは、サムネイル表示と `tegaki-album-data` JSONをHTML内に埋め込む。
    - `VirtualAlbum` は IndexedDB 版の未接続実装として残っているため、正本に切り替える場合は設計判断が必要。
- **画像出力**: `ExportManager` -> `PNGExporter`。全表示レイヤーを一時的な `RenderTexture` へレンダリングして PNG を抽出。

---

## 5. 凍結・未接続コンポーネント

以下の機能は Phase 1j 時点では「凍結」または「未接続」であり、現行描画への副作用を避けるため原則として変更しない。

- **WebGL2 / SDF / MSDF**: `system/drawing/webgl2/` 配下。
- **Animation 本体**: `system/animation-system.js` の `init()`。
    - `timeline-ui.js` は表示入口のみ接続。

---

## 6. 主要 EventBus 契約

- `tool:changed` / `tool:select`: ツール（pen, eraser, fill 等）の切り替え。
- `ui:sidebar:sync-tool`: ショートカット等で変わったツール状態をサイドバーへ同期。
- `brush:mode-changed`: brush core 側のモード変更通知。
- `brush:pressure-enabled-changed` / `brush:eraser-pressure-enabled-changed`: 筆圧状態の表示同期。
- `keyboard:vkey-state-changed`: Vキー変形モードの開始/終了。
- `layer:flip-by-key`: Vモード中の H / Shift+H によるアクティブレイヤー反転。
- `layer:flip-requested`: Vパネルの反転ボタンからの反転要求。
- `layer:activated`: アクティブレイヤーの変更。
- `layer:panel-update-requested`: レイヤーパネルの再描画要求。
- `layer:updated` / `layer:transform-updated`: レイヤー内容または変形状態の更新通知。
- `thumbnail:layer-updated`: サムネイル再生成要求。`immediate: true` の場合は即時生成。
- `thumbnail:updated`: サムネイル生成完了通知。
- `history:changed`: アンドゥスタックの状態変化。
- `canvas:pointerdown`: バケツツール等へのイベント通知。
- `ui:toggle-album` / `ui:toggle-export` / `ui:toggle-settings` / `ui:toggle-quick-access`: サイドバー/ショートカットからの popup 表示切替。

この一覧は「入口の地図」であり、全イベントの完全な仕様表ではない。
payload を変更する前には、必ず `rg "event-name"` で emit/on の両側を確認する。

---

## 7. 回転値の扱い

Vキー変形は一時変形であり、確定時に `RenderTexture` へ bake してコンテナの回転値を 0 に戻す。

将来のアニメトラックでは、回転値を `-180..180` や `-360..360` に丸めず、累積角度として保持する方針。
スライダー表示だけをループさせ、数値は 180、360、720 のように増え続ける設計を検討する。
大きな角度は数値直接入力、戻しすぎ対策はリセットボタンで扱う。

---

## 8. UIアイコン・小ボタン

Phase 1k での整理方針：

- **中央管理**: `ui/ui-icons.js` にアプリケーション全体の SVG アイコンを定義。
- **統一クラス**: アイコンボタンには `.ui-icon-button` クラスを適用し、ホバー等の見た目を統一。
- **サイズ管理**: `.ui-icon-button--small` (16px) / `--medium` (24px) でボタンサイズを管理。
- **閉じる/削除ボタン**: `.ui-close-button` を基本とし、`close` アイコンを共通使用。

---

*最終更新日: 2026-05-17 (Phase 2 handoff)*

