# Manga Region Prompter - 改修完了報告書
## 内部整合性ブラッシュアップ ＆ LoRAスコープ診断版 (v3.7.6)

作成日: 2026-09-02  
対象環境: Zuntan03/EasyReforge 内 `stable-diffusion-webui-reForge`  
対象拡張: EasyReforge Manga Prompter (Manga Region Prompter / MRP)  
準拠指示書: `MRP_v3.7.6_内部整合性_LoRAスコープ診断_改修指示書.md`  
実装担当: Gemini Antigravity (Advanced Agentic Coding)

---

## 1. 改修の目的と背景

実機テストにおいて、MRP（Attention Couple方式）とコマ枠 ControlNet の併用により、多コマ時でも各領域へのキャラクター・オブジェクトの安定した分離描画が実証された。
本改修（v3.7.6）では、生成アルゴリズム本体を一切壊すことなく、以下の内部整合性および次フェーズ（LoRA実測テスト）に向けた準備を実施した：

1. **「コマ1（全体）」の残留表示バグの解消**: 分割・スライス後に元パネル名に「全体」が残る問題を解消。
2. **BREAKスロットの位置保持型パーサ**: 空スロットやLoRA除去後の空文字でスロット番号がずれる問題を解消。
3. **LoRAタグ除去前 Raw Prompt 保存 ＆ スコープ診断**: 各コマに書かれた `<lora:...>` を認識し、現行エンジンがグローバル適用であることを正しくログ・UIで診断・表示。
4. **サイドバー Preflight ステータス表示**: スロット数の一致・不一致をリアルタイムに視覚化。

---

## 2. 主な改修内容と技術的詳細

### ① メタデータ同期共通関数 `refreshPanelDerivedMetadata()` の実装（`manga_canvas.js`）
- パネル数が1かつ全面（0,0,1,1）の時のみ `コマ 1 (全体)` とし、それ以外（分割後・スライス後・部分矩形等）は必ず `コマ N`（重なり時は `(重なり)`）とする共通関数を新設。
- Reset, Split, Slice, DrawRect, Merge, Delete, Koma number swap, Preset load, Undo/Redo の全操作後に呼び出すことで、UIメタデータと実体矩形を完全同期。

### ② 位置保持型 BREAK スロットパーサの導入（`manga_prompter.py`, `manga_canvas.js`）
- `[c.strip() for c in re.split(...) if c.strip()]` や `.filter(c => c.length > 0)` による空chunk削除を廃止。
- `raw_slots = [c.strip() for c in re.split(r'\bBREAK\b', text)]` により空スロットも位置（Slot 0=STYLE, Slot 1=PAGE, Slot 2..=REGIONS）を完全に保持し、スロットズレを防止。

### ③ `before_process_batch()` による Extra Networks 適用前 Raw Prompt の保存 ＆ LoRAスコープ診断
- `before_process_batch()` で WebUI が LoRA タグを除去する前の Raw Prompt を取得し、各スロット内の `<lora:...>` を抽出。
- Region 内に LoRA が検出された場合、以下の診断ログを出力：
  ```text
  [MangaPrompter][LoRA Scope] Region 2 requested: ['<lora:CharacterA:0.8>']
    Current engine: GLOBAL extra-network activation
    Regional prompt: localized
    Regional UNet LoRA isolation: NOT ENABLED
  ```
- UI 上でも対象コマカード内に `⚠ LoRAタグ検出: <lora:...> (注意: LoRA本体は全体適用され、トリガー単語の局所化として動作します)` の警告を動的表示。

### ④ 軽量 Preflight ステータスバッジの追加
- サイドバー上部に `✓ 整合性OK (Nコマ / N+2スロット)` または `⚠ スロット数不一致 (必要:N+2 / 現在:M)` をリアルタイム表示。

---

## 3. 変更・維持ファイル一覧

| ファイルパス | 変更区分 | 内容 |
| :--- | :---: | :--- |
| `scripts/manga_prompter.py` | **変更** | `before_process_batch()` 実装、位置保持型パース、LoRAスコープ診断ログ |
| `javascript/manga_canvas.js` | **変更** | `refreshPanelDerivedMetadata()` 実装、位置保持型パース、Preflight & LoRA警告UI |
| `style.css` | **変更** | Preflightバッジ（`.manga-preflight-badge`）、LoRA警告（`.manga-lora-scope-warn`）スタイル |
| `docs/ARCHITECTURE_AND_KNOWLEDGE_BASE.md` | **更新** | v3.7.6 アーキテクチャ、LoRAスコープ診断設計の記録 |
| `GitHubURL_ERE.txt` | **更新** | 本改修完了報告書のRaw URLおよびリファレンス追記 |
| `scripts/manga_attention.py` | **維持** | Forge Couple v4.0.2 互換 Attention Hook (診断カウンター・Sentinel保持) |
| `scripts/manga_spatial_engine.py` | **維持** | 空間マスク生成エンジン (Exclusive vs Overlap) |

---

## 4. 同期およびミラーリング状況

以下の3箇所すべてにおいて完全同期（同一内容）を確認済み：
1. `e:\EasyReforgeExtension\`（開発ワークスペース）
2. `E:\EasyReforge\stable-diffusion-webui-reForge\extensions\easyreforge-manga-prompter\`（実機実行環境）
3. `D:\GitHub\tegaki\EasyReforgeExtension\`（GitHubリポジトリ連携ディレクトリ）
