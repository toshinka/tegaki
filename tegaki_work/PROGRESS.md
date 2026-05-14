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

### 2026-05-14 GEMINI作業指示書に基づく改修
- **液タブペン入力改善**: `pointer-handler.js` に `raw pointerdown` ログを追加。また、ペン入力時に `button === 2` (右クリック) 扱いになってもブロックされないよう条件を緩和。
- **消しゴムのリアルタイム反映**: `brush-core.js` を修正し、消しゴム使用中のドラッグ時に短いセグメントを直接 `RenderTexture` に焼き込むように変更。これにより、マウスアップを待たずにリアルタイムで線が削れるようになりました。
- **サムネイル表示バグ修正**: `layer-panel-renderer.js` を修正。パネル再描画時に `ThumbnailSystem` のキャッシュを確認し、既に生成済みのサムネイル画像があれば即座に再挿入するように変更。
- **描画品質の統一と改善**: 
    - `stroke-renderer.js` において、プレビューと最終描画の `perfect-freehand` オプションを完全一致させました。
    - 鋭角での異常描画対策として、極端に近い点を除外するフィルタ (`MIN_DIST = 0.25`) を導入。
    - `RenderTexture` 生成時に `antialias: true` を設定する小規模な検証を導入（等倍解像度のまま品質向上を試行）。
- **描画パイプライン整理**: `stroke-renderer.js` から WebGL2 Mesh 経路を完全に排除し、`Graphics.poly` 経路へ一本化。

### 2026-05-14 Codex報告書に基づく一括修正
- **サムネイルイベント統一**: `thumbnail:layer-updated` のペイロードを `{ layerIndex, layerId, immediate }` のフラットな形式に統一。不整合による更新失敗を解消。
- **鋭角ペン描画修正**: `stroke-renderer.js` において、WebGL2 Mesh 経路を一時的に無効化。`Graphics.poly()` 経路に一本化することで、鋭角ストロークでの三角形アーティファクトを回避。
- **変形確定Bakeの徹底**: Vキー解除時やツール切り替え時に確実に `confirmLayerTransform` (Bake処理) が呼ばれるよう修正。描画再開時にコンテナの `scale` が常に 1 であることを担保。
- **液タブペンUI操作改善**: 
    - `quick-access-popup.js` の閉じるボタン・ツールボタンに `click` イベントを追加。
    - `layer-panel-renderer.js` の Sortable 設定を `forceFallback: true`, `fallbackTolerance: 3` に更新し、ペンでのドラッグ・クリック精度を向上。
- **液タブペン描画デバッグ**: `drawing-engine.js` に `pointerType === 'pen'` 時のブロック条件判定ログを追加。

### 2026-05-14 Phase 1c 追加修正
- **消しゴムプレビュー修正**: `renderPreview` で消しゴム時の描画を無効化。ドラッグ中の不要な軌跡を削除し、UXを向上。
- **レイヤー1消しゴム対応**: `CoreEngine` でのサブシステム初期化順序を修正。`LayerSystem.init` 前に `app` を確実に設定することで、初期レイヤーに対しても `RenderTexture` が正しく生成され、消しゴムが機能するよう改善。
- **変形ツール座標ズレ修正 (Bake実装)**: 変形確定時に `bakeTransform` を実行するように変更。変形後の内容を `RenderTexture` に直接書き込み、コンテナの `scale/rotation` を 1/0 にリセットすることで、その後の描画座標やブラシ太さのズレを解消。
- **Raster Sprite保護**: `safeRebuildLayer` において、`RenderTexture` を表示する `layerSprite` が破棄されないよう保護対象に追加。


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
