# PROGRESS — 作業ログ

> GeminiとClaudeが引き継ぎに使う共有メモ。
> 作業後に必ずここを更新すること。最新が上、過去ログは末尾に蓄積。

---

## 現在のフェーズ

**Phase 1a — Vite環境構築・起動確認**
作業フォルダ：`tegaki_phase1a`

---

## フォルダ状態

| フォルダ | 状態 |
|---|---|
| `tegaki_phase0` | ✅ オリジナル保存。触らない |
| `tegaki_phase1a` | 🔧 現在の作業フォルダ。Vite/ESM移行完了、基本動作確認中 |
| `PastFiles/` | 完了済みフェーズのアーカイブ置き場 |

---

## 直近の作業（最新が上）

### 2026-05-12 Phase 1a ほぼ完了
- Vite環境構築完了（Vite 8.0.12, PixiJS 8.17.0）
- 全主要ファイルのESM化と移植完了
- **BrushCore二重初期化解消**: core-initializer.jsから削除、core-engine.jsに集約
- **UIパネル・ポップアップ復元**: DOMBuilderによる構築とPopupManagerへの登録完了
- **WebGL2座標変換バグ修正**: CameraSystemの画面サイズ取得をPixi v8仕様に修正、ストローク拒否を解消
- **WebGL2システム疎通確認**: 各ファイル（gl-stroke-processor等）の✅ログ出力を確認
- 変換したファイル一覧:
    - system: event-bus.js, config.js, coordinate-system.js, data-models.js, debug-utils.js, settings-manager.js, state-manager.js, camera-system.js, history.js, layer-system.js, layer-transform.js, popup-manager.js, batch-api.js, export-manager.js, animation-system.js, checker-utils.js
    - system/drawing: brush-settings.js, drawing-clipboard.js, brush-core.js, stroke-recorder.js, stroke-renderer.js, drawing-engine.js, thumbnail-system.js, pointer-handler.js
    - system/drawing/webgl2: webgl2-drawing-layer.js, gl-stroke-processor.js, gl-msdf-pipeline.js, gl-texture-bridge.js, gl-mask-layer.js
    - ui: dom-builder.js, slider-utils.js, ui-panels.js, keyboard-handler.js, settings-popup.js, quick-access-popup.js, resize-popup.js, album-popup.js
- 残課題:
    - 消しゴム使用時の描画（BlendMode.ERASE）の挙動確認
    - 一部UIコンポーネント（タイムライン等）のESM化未着手
- 次フェーズ: phase1b（キャンバス・初期化整理）

### 2026-05-12
- ベースをtegaki_rev0（→ tegaki_phase0にリネーム）にロールバック決定
- rev30系はPixiJS初期化順序破損・キャンバス消失バグあり → 破棄
- フォルダ運用ルール確定（phase0=オリジナル、phase1a〜=作業コピー）
- GEMINI.md・TEGAKI.md・PROGRESS.mdをphase構成に対応し更新
- GitHubURL.txtをphase1a対応に更新
- phases/phase1a.md を新規作成（Vite移植フェーズ指示書）

---

## 現在の既知バグ・課題

| 内容 | 場所 | 対応フェーズ |
|---|---|---|
| 消しゴム使用時にキャンバスが消える | phase0（既知） | 1c |
| PixiJS初期化順序破損（rev30系） | 破棄済み | — |

---

## タスク進捗 (phase1a)

- [x] `tegaki_phase1a` に Vite環境を構築
- [x] `npm install pixi.js@8.17.0 perfect-freehand gsap earcut` でライブラリ導入
- [x] 既存ファイルをVite/ESM形式に変換しながら移植
- [x] `vite dev` で起動・描画できることを確認
- [x] 座標変換・UI表示・ポップアップ登録の修正完了

---

## Claudeへ

Phase 1aの基本移植が完了しました。
- `core-engine.js` に全ての初期化と依存関係注入を集約しました。
- `CameraSystem` の画面サイズ取得バグを修正し、座標変換の不整合（Stroke rejected）を解消しました。
- ポップアップ類（Settings, QuickAccess, Resize, Export, Album）のESM化と登録を完了しました。
- 現在、キャンバス内での描画、移動、基本的なショートカット、UIパネルの表示が動作しています。

次のステップ `phase1b`（キャンバス・初期化のさらなる整理と安定化）の具体的な指示をお願いします。

---

## 備考・決定事項メモ

- PixiJSの `toLocal()` / `toGlobal()` は使用禁止（CoordinateSystemを手動実装）
- DPR=1固定
- WebGL2マスターレンダーループ（glRender→pixiRenderの順）

---

---
## 📁 過去ログアーカイブ
---

*(現時点では過去ログなし)*
