# PROGRESS — 作業ログ

> GeminiとClaudeが引き継ぎに使う共有メモ。
> 作業後に必ずここを更新すること。最新が上、過去ログは末尾に蓄積。

---

## 現在のフェーズ

**Phase 1c — 液タブペン対応・消しゴム修正・サムネイル**
作業フォルダ：`tegaki_phase1a` (→ `tegaki_work` へ改名予定)

---

## フォルダ状態

| フォルダ | 状態 |
|---|---|
| `tegaki_phase0` | ✅ オリジナル保存。触らない |
| `tegaki_phase1a` | 🔧 現在の作業フォルダ。Rasterレイヤー化・バグ修正完了 |
| `PastFiles/` | 完了済みフェーズのアーカイブ置き場 |

---

## 直近の作業（最新が上）

### 2026-05-14 Phase 1c 追加修正
- **消しゴムプレビュー修正**: `renderPreview` で消しゴム時の描画を無効化。ドラッグ中の不要な軌跡を削除し、UXを向上。
- **レイヤー1消しゴム対応**: `CoreEngine` でのサブシステム初期化順序を修正。`LayerSystem.init` 前に `app` を確実に設定することで、初期レイヤーに対しても `RenderTexture` が正しく生成され、消しゴムが機能するよう改善。
- **変形ツール座標ズレ修正 (Bake実装)**: 変形確定時に `bakeTransform` を実行するように変更。変形後の内容を `RenderTexture` に直接書き込み、コンテナの `scale/rotation` を 1/0 にリセットすることで、その後の描画座標やブラシ太さのズレを解消。
- **Raster Sprite保護**: `safeRebuildLayer` において、`RenderTexture` を表示する `layerSprite` が破棄されないよう保護対象に追加。

### 2026-05-14 Phase 1c 消しゴム修正 (最終)
- **消しゴム修正 (再修正)**: `RenderTexture` への焼き込み時に、`graphics.blendMode = 'erase'` だけでは不十分だった問題を修正。`Container` でラップし、そのコンテナに対して `blendMode = 'erase'` を指定して `renderer.render` することで、確実に透明消去ができるように修正しました。
- **描画色確認**: `stroke-renderer.js` が消しゴム時に `0xFFFFFF` (White) を使用していることを確認。焼き込みが失敗して「塗り」になっていたため Ivory 背景上で目立っていた問題を、透明消去の正常化により解決。

### 2026-05-13 Phase 1c 描画バグ修正 & Rasterレイヤー化
- **ラスターレイヤー実装**: 各レイヤーに `RenderTexture` を導入。ストローク確定時にテクスチャへ直接焼き込む方式へ移行。
- **消しゴム修正 (Bug 2)**: `renderer.render` を使用して `activeLayer.renderTexture` に対して描画する方式の基礎を実装。
- **ペン白い軌跡修正 (Bug 1)**: `renderPreview` 内のポリゴン塗りつぶし色が白 (`0xFFFFFF`) に固定されていたバグを修正。
- **プレビュー管理強化**: `BrushCore.startStroke` 時に既存のプレビューGraphicsを確実に破棄。
- **筆圧クランプ調整**: 最小筆圧比を `0.02` に設定。

### 2026-05-13 PixiJS v8 完全に文字列ベースの BlendMode へ移行
- **BlendMode 定数撤廃**: `'erase'` および `'normal'` という文字列リテラルを直接使用するように変更。

---

## 現在の既知バグ・課題

| 内容 | 場所 | 対応フェーズ |
|---|---|---|
| フォルダ名変更の反映 | (OS) | 作業中 |
| 一部UI（タイムライン等）のESM化未完了 | ui/ | 1d |

---

## タスク進捗 (phase1c)

- [x] `pointerType` による座標分岐の撤廃
- [x] 消しゴムの透明消去実装 (RenderTexture焼き込み方式)
- [x] ペンプレビューの白色化バグ修正
- [x] サムネイル生成システムの修正
- [x] ストローク描画の `graphics.poly()` 統一

---

## Claudeへ

描画システムのコアを「ベクター保持」から「ラスター焼き込み（RenderTexture）」へ移行しました。
- 各レイヤーが独自の `RenderTexture` を持つようになり、消しゴムは `'erase'` モードでそのテクスチャのピクセルを透明化します。
- 背景レイヤー（Ivory）は別のレイヤーとして管理されているため、消しゴムの影響を受けません。
- 描画中の「白い軌跡」バグも修正済みです。

※現在、`tegaki_phase1a` から `tegaki_work` へのフォルダ名変更を試みていますが、プロセスロックにより失敗しています。手動で変更が必要かもしれません。

---

## 備考・決定事項メモ

- 消しゴムは `renderer.render({ target: activeLayer.renderTexture, blendMode: 'erase' })`。
- レイヤーは `Container` 内に `Sprite(RenderTexture)` を持つ構造。

---

---
## 📁 過去ログアーカイブ
---

*(現時点では過去ログなし)*
