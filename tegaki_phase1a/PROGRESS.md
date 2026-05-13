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
| `tegaki_phase1a` | 🔧 現在の作業フォルダ。Phase 1c 基本実装完了 |
| `PastFiles/` | 完了済みフェーズのアーカイブ置き場 |

---

## 直近の作業（最新が上）

### 2026-05-13 Phase 1c 基本実装完了
- **アーカイブ処理**: Phase 1bの成果物を `PastFiles/tegaki_phase1b1/` にバックアップし、`GitHubURL_Phase1b.txt` としてURLリストをリネーム・更新。
- **液タブペン座標修正**: `pointer-handler.js` の型補正ヒューリスティックを撤廃し、全ポインター型で同一の座標変換パスを通るよう簡略化。
- **消しゴム透明化**: `stroke-renderer.js` で `PIXI.BlendMode.ERASE` を正式適用。プレビューおよび最終描画で背景や下レイヤーが正しく透けるよう修正。
- **サムネイルシステム修正**: `thumbnail-system.js` と `layer-panel-renderer.js` の引数ミスマッチを解消。
- **描画品質改善**: `perfect-freehand` の出力を `graphics.poly()` で描画する方式に統一し、ストローク内の不要な線を完全に除去。

### 2026-05-12 Phase 1b 修正パッチ適用
- **layer-panel-renderer.jsのバグ修正**: `ReferenceError` 解消。
- **stroke-renderer.jsの描画改善**: `graphics.poly()` 導入により始点→終点の斜め線バグを解消。

### 2026-05-12 Phase 1b完了
- **BrushCore二重初期化の解消**: 初期化順序の厳格化。
- **レイヤー構造の復元**: `LayerPanelRenderer` 統合。

---

## 現在の既知バグ・課題

| 内容 | 場所 | 対応フェーズ |
|---|---|---|
| 一部UI（タイムライン等）のESM化未完了 | ui/ | 1d |
| 筆圧カーブの微調整 | pressure-handler.js | 1c/1d |

---

## タスク進捗 (phase1c)

- [x] Phase 1b 成果物のアーカイブ保管 (`PastFiles/tegaki_phase1b1/`)
- [x] `pointerType` による座標分岐の撤廃と簡略化
- [x] 消しゴムの透明消去実装 (`BlendMode.ERASE`)
- [x] サムネイル生成システムの引数・呼び出し修正
- [x] ストローク描画の `graphics.poly()` 統一

---

## Claudeへ

Phase 1c の主要な修正が完了しました。
- 座標変換の分岐をなくし、`pointer-handler.js` をシンプルにしました。これにより液タブペンでの「キャンバス外判定」が解消される見込みです。
- 消しゴムは `PIXI.BlendMode.ERASE` を使用し、期待通り「透明に消える」動作になっています。
- サムネイル生成の不整合を修正しました。
- アーカイブ手順に従い、Phase 1bの状態を `PastFiles` に保存しました。

動作確認後、問題があれば詳細を指示してください。

---

## 備考・決定事項メモ

- 消しゴムは `blendMode = PIXI.BlendMode.ERASE` + `fill({ color: 0xFFFFFF })` で実装。
- 座標系は常に `clientX/Y` をベースに `getBoundingClientRect()` で逆算。

---

---
## 📁 過去ログアーカイブ
---

*(現時点では過去ログなし)*
