# PROGRESS — 作業ログ

> GeminiとClaudeが引き継ぎに使う共有メモ。
> 作業後に必ずここを更新すること。最新が上、過去ログは末尾に蓄積。

---

## 現在のフェーズ

**Phase 1c — 液タブペン対応・消しゴム修正・サムネイル**
作業フォルダ：`tegaki_phase1a`

---

## フォルダ状態

| フォルダ | 状態 |
|---|---|
| `tegaki_phase0` | ✅ オリジナル保存。触らない |
| `tegaki_phase1a` | 🔧 現在の作業フォルダ。Phase 1c 実装・Pixi v8 modular API移行完了 |
| `PastFiles/` | 完了済みフェーズのアーカイブ置き場 |

---

## 直近の作業（最新が上）

### 2026-05-13 PixiJS v8 Modular API 移行完了
- **BlendMode エラー修正**: `stroke-renderer.js` で `PIXI.BlendMode` が undefined になる問題を、名前付きインポート (`import { BlendMode } from 'pixi.js'`) への変更で解決。
- **全主要ファイルの API 刷新**: `system/` および `ui/` 内の各ファイルにおいて `import * as PIXI` を廃止し、`Container`, `Graphics`, `Sprite`, `RenderTexture`, `Texture`, `Matrix`, `Mesh`, `Geometry` 等の個別インポートへ移行。
- **PIXI. プレフィックスの除去**: コード全体から `PIXI.` プレフィックスを削除し、PixiJS v8 の推奨される modular な記述方式に統一。
- **FillTool のモジュール化**: IIFE 形式だった `fill-tool.js` を ESM モジュールへ変換し、依存関係を整理。

### 2026-05-13 Phase 1c 基本実装完了
- **アーカイブ処理**: Phase 1bの成果物を `PastFiles/tegaki_phase1b1/` にバックアップ。
- **液タブペン座標修正**: `pointer-handler.js` の型補正を撤廃し、全デバイス共通の座標パスを確立。
- **消しゴム透明化**: `BlendMode.ERASE` を正式適用し、透明に消える挙動を実装。
- **サムネイルシステム修正**: 引数不整合の解消とアスペクト比計算の改善。

---

## 現在の既知バグ・課題

| 内容 | 場所 | 対応フェーズ |
|---|---|---|
| 一部UI（タイムライン等）のESM化未完了 | ui/ | 1d |
| 筆圧カーブの微調整 | pressure-handler.js | 1d |

---

## タスク進捗 (phase1c)

- [x] Phase 1b 成果物のアーカイブ保管
- [x] `pointerType` による座標分岐の撤廃
- [x] 消しゴムの透明消去実装 (`BlendMode.ERASE`)
- [x] PixiJS v8 Modular API 移行 (import { ... } from 'pixi.js')
- [x] サムネイル生成システムの修正
- [x] ストローク描画の `graphics.poly()` 統一

---

## Claudeへ

PixiJS v8 の modular API への移行を完了しました。
- `PIXI.BlendMode` 等のグローバル名前空間への依存を排除し、`import { BlendMode, ... } from 'pixi.js'` 形式に統一しました。
- これにより `stroke-renderer.js` 等で発生していた `undefined` エラーが解消され、描画が正常に動作することを確認しました。
- `fill-tool.js` も ESM 化し、システム全体のモジュール構造を強化しました。

引き続き `phase1c` の完了条件に基づき、液タブペンでの筆圧挙動などを確認していきます。

---

## 備考・決定事項メモ

- PixiJS v8 では名前付きインポートを推奨。
- 消しゴムは `blendMode = BlendMode.ERASE` + `fill({ color: 0xFFFFFF })`。

---

---
## 📁 過去ログアーカイブ
---

*(現時点では過去ログなし)*
