# Manga Region Prompter - 改修完了報告書
## 最終整合性ブラッシュアップ / Slot契約の完全統一版 (v3.7.7)

作成日: 2026-09-02  
対象環境: Zuntan03/EasyReforge 内 `stable-diffusion-webui-reForge`  
対象拡張: EasyReforge Manga Prompter (Manga Region Prompter / MRP)  
基準コミット: `c122650` (v3.7.6)  
準拠指示書: `MRP_v3.7.7_最終整合性ブラッシュアップ_改修指示書.md`  
実装担当: Gemini Antigravity (Advanced Agentic Coding)

---

## 1. 改修の目的と背景

v3.7.6 までの実機テストにより、MRPの Attention Couple 方式とコマ枠 ControlNet の併用による安定した多コマ領域分離が実証された。
本改修（v3.7.7）では、**Attention Hook および Spatial Engine の生成コアを完全に凍結** した上で、v3.7.6 で定めた内部契約の「最後のわずかな不一致・漏れ」を解消し、次工程（Prompt Order Test / LoRA実測 / 漫画テンプレート整備）へ進むための最終整合性を確立した。

---

## 2. 実施した主な改修内容

### ① 「テンプレ枠を挿入」処理の空スロット保持への統一（`manga_canvas.js`）
- `window.mangaPrompterInsertTemplateToMainPrompt` 内に残っていた `.filter(c => c.length > 0)` を完全撤廃。
- `parseMainPrompt()` と同様に `rawSlots = curVal.split(/\bBREAK\b/i).map(c => c.trim())` で空スロットを厳格に保持。
- STYLE スロットが空の場合でも、PAGE スロット（`2koma` 等）が STYLE へ昇格したり、後続のコマ本文が左詰めされて位置契約が壊れるバグを未然に防止。

### ② `koma N:` ラベルとスロット位置の Source of Truth の完全統一（`manga_canvas.js`, `manga_prompter.py`）
- **Source of Truth を「BREAKスロット位置（N+2 slots）」へ一本化**:
  - `Slot 0 = STYLE`
  - `Slot 1 = PAGE`
  - `Slot 2 = logical koma 1`
  - `Slot 3 = logical koma 2`
  - `Slot 4 = logical koma 3` ...
- `koma N:` / `[コマN]` ラベルは **mapping 命令ではなく、人間向けアノテーション 兼 診断用ラベル** として定義。
- **JavaScript 側 (`parseMainPrompt`)**:
  - 常にスロット位置をキーとして `regions[expectedKoma]` に登録。
  - ラベルに書かれた番号 `declaredKoma` とスロット位置 `expectedKoma` が異なる場合、`labelDiagnostics` に記録し、UI カード上に警告を表示（※スロット位置順に従い「コマN」として適用される旨を明示）。
- **Python 側 (`after_extra_networks_activate`)**:
  - ラベルとスロット位置が異なる場合、コンソールログに `[MangaPrompter][WARN] Region label mismatch: slot expects koma {expected_koma}, declared koma {declared_koma}. Slot position is authoritative.` を出力。
  - バックエンドでの mapping もスロット位置基準で厳密に実行（勝手な chunk 並べ替えやラベル書き換えは行わない）。

### ③ Preflight ステータス表示の強化
- スロット数チェック（`actual === expected`）に加え、ラベル不一致診断（`labelDiagnostics`）をリアルタイムに視覚化：
  - `✓ 整合性OK (Nコマ / N+2スロット)`
  - `⚠ ラベル不一致あり (M箇所 - スロット位置順で適用)`
  - `⚠ スロット数不一致 (必要:N+2 / 現在:M)`

---

## 3. 変更・維持ファイル一覧

| ファイルパス | 変更区分 | 内容 |
| :--- | :---: | :--- |
| `scripts/manga_prompter.py` | **変更** | スロット位置の厳格な authoritative mapping、ラベル不一致 WARN 出力 |
| `javascript/manga_canvas.js` | **変更** | テンプレ挿入の空スロット保持化、ラベル不一致診断、Preflight 強化 |
| `style.css` | **変更** | ラベル不一致警告（`.manga-label-mismatch-warn`）のスタイル追加 |
| `docs/ARCHITECTURE_AND_KNOWLEDGE_BASE.md` | **更新** | v3.7.7 確定仕様および生成コア凍結の記録 |
| `GitHubURL_ERE.txt` | **更新** | 本改修完了報告書のRaw URLおよびリファレンス追記 |
| `scripts/manga_attention.py` | **凍結・維持** | Forge Couple v4.0.2 互換 Attention Hook (一切の改変なし) |
| `scripts/manga_spatial_engine.py` | **凍結・維持** | 空間マスク生成エンジン (Exclusive vs Overlap, 一切の改変なし) |

---

## 4. 同期およびミラーリング状況

以下の3箇所すべてにおいて完全同期（同一内容）を確認済み：
1. `e:\EasyReforgeExtension\`（開発ワークスペース）
2. `E:\EasyReforge\stable-diffusion-webui-reForge\extensions\easyreforge-manga-prompter\`（実機実行環境）
3. `D:\GitHub\tegaki\EasyReforgeExtension\`（GitHubリポジトリ連携ディレクトリ）
