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
| `tegaki_phase1a` | 🔧 現在の作業フォルダ。Phase 1c 実装・Pixi v8 対応完了 |
| `PastFiles/` | 完了済みフェーズのアーカイブ置き場 |

---

## 直近の作業（最新が上）

### 2026-05-13 PixiJS v8 完全に文字列ベースの BlendMode へ移行
- **BlendMode 定数撤廃**: `stroke-renderer.js` から `BlendMode` のインポートを削除し、`'erase'` および `'normal'` という文字列リテラルを直接使用するように変更。
- **PixiJS v8 仕様準拠**: PixiJS v8 では `blendMode` に文字列を指定することが推奨されており、これにより `undefined` エラーを完全に防止。

### 2026-05-13 PixiJS v8 Modular API 移行完了
- **API 刷新**: `system/` および `ui/` 内の各ファイルにおいて名前付きインポートへ移行し、`PIXI.` プレフィックスを完全に除去。
- **FillTool のモジュール化**: `fill-tool.js` を ESM モジュールへ変換。

### 2026-05-13 Phase 1c 基本実装完了
- **アーカイブ処理**: Phase 1bの成果物を `PastFiles/tegaki_phase1b1/` にバックアップ。
- **液タブペン座標修正**: `pointer-handler.js` の型補正を撤廃。
- **消しゴム透明化**: 消しゴムを透明に消える挙動に修正。
- **サムネイルシステム修正**: 引数不整合の解消。

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
- [x] 消しゴムの透明消去実装 (`'erase'`)
- [x] PixiJS v8 完全対応 (Named Imports & String BlendModes)
- [x] サムネイル生成システムの修正
- [x] ストローク描画の `graphics.poly()` 統一

---

## Claudeへ

PixiJS v8 への対応をさらに強化しました。
- `BlendMode.ERASE` などの定数参照を廃止し、`'erase'` などの文字列リテラルを直接使用するようにしました。これによりインポートの不整合によるエラーのリスクがなくなりました。
- システム全体が PixiJS v8 のモダンな API 体系で動作しています。

引き続き `phase1c` の残りのタスク（筆圧挙動の確認など）を進めます。

---

## 備考・決定事項メモ

- PixiJS v8 では名前付きインポートを推奨。
- 消しゴムは `blendMode = 'erase'` + `fill({ color: 0xFFFFFF })`。

---

---
## 📁 過去ログアーカイブ
---

*(現時点では過去ログなし)*
