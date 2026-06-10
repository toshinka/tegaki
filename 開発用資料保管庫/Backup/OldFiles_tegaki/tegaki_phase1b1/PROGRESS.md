# PROGRESS — 作業ログ

> GeminiとClaudeが引き継ぎに使う共有メモ。
> 作業後に必ずここを更新すること。最新が上、過去ログは末尾に蓄積。

---

## 現在のフェーズ

**Phase 1b — コア整理・レイヤー復元・ペン完成**
作業フォルダ：`tegaki_phase1a`

---

## フォルダ状態

| フォルダ | 状態 |
|---|---|
| `tegaki_phase0` | ✅ オリジナル保存。触らない |
| `tegaki_phase1a` | 🔧 現在の作業フォルダ。Vite/ESM移行完了、Phase 1b完了 |
| `PastFiles/` | 完了済みフェーズのアーカイブ置き場 |

---

## 直近の作業（最新が上）

### 2026-05-12 Phase 1b 修正パッチ適用
- **layer-panel-renderer.jsのバグ修正**: `createLayerElement` 内の `folderDiv` 参照を `layerDiv` に修正（ReferenceError解消）
- **stroke-renderer.jsの描画改善**: `perfect-freehand` の描画ロジックに `graphics.poly()` を導入。`closePath()` による始点→終点の斜め三角形バグを解消

### 2026-05-12 Phase 1b完了
- **BrushCore二重初期化の解消**: `core-engine.js`での初期化順序を厳格化し、警告を解消
- **レイヤー構造の復元**: `LayerPanelRenderer`をESM化して統合。起動時に初期レイヤーが表示されるよう修正
- **perfect-freehandの正式接続**: `stroke-renderer.js`で直接インポートし、プレビュー・本描画の両方で使用
- **消しゴムの完全移行**: プレビューを含め `blendMode = 'erase'` に統一
- **レガシーコードの削除**: `_renderFinalStrokeLegacy` を削除し、ポリゴン描画へ一本化
- **UIコンポーネントのESM化**: `SettingsPopup`, `QuickAccessPopup`, `ResizePopup`, `ExportPopup`, `AlbumPopup`, `LayerPanelRenderer` をESM化

### 2026-05-12 Phase 1a完了
- Vite環境構築完了（Vite 8.0.12, PixiJS 8.17.0）
- 各種サブシステムのESM移行と `core-engine.js` への統合
- `CameraSystem` の画面サイズ取得バグ修正による座標変換の正常化

---

## 現在の既知バグ・課題

| 内容 | 場所 | 対応フェーズ |
|---|---|---|
| 消しゴム使用時にキャンバスが消える | phase0（既知） | 1c |
| 筆圧・サイズ・消しゴム品質のさらなる調整 | drawing/ | 1c |

---

## タスク進捗 (phase1b)

- [x] BrushCore二重初期化の解消
- [x] レイヤーパネルへのレイヤー表示復元
- [x] perfect-freehandによるポリゴン描画の正式採用
- [x] 消しゴムのBlendMode.ERASE統一
- [x] フォールバックコード（Legacy描画）の削除
- [x] レイヤーパネルRendererの変数スコープ修正
- [x] ストローク描画の三角形アーティファクト解消

---

## Claudeへ

Phase 1bの最終調整が完了しました。
- `layer-panel-renderer.js` の `ReferenceError` を修正し、レイヤーパネルが正常に機能することを確認しました。
- `stroke-renderer.js` において、`graphics.poly()` を用いたポリゴン描画へ切り替えました。これにより、ペン描画時に混入していた不自然な三角形の線が消え、描画品質が大幅に改善されました。

次のステップ `phase1c`（消しゴムによるキャンバス消失バグの修正、およびストローク品質のさらなる向上）の指示をお願いします。

---

## 備考・決定事項メモ

- PixiJSの `toLocal()` / `toGlobal()` は使用禁止
- DPR=1固定
- 消しゴムは `blendMode = 'erase'` を使用

---

---
## 📁 過去ログアーカイブ
---

*(現時点では過去ログなし)*
