# EasyReforge Manga Prompter - v3.7.3 Global Effect / Base Branch 復活 改修完了報告書

作成日: 2026-09-02  
対象環境: Zuntan03/EasyReforge 内 `stable-diffusion-webui-reForge`  
対象拡張: EasyReforge Manga Prompter (Manga Region Prompter)  
準拠指示書: `EasyReforge_Manga_Prompter_v3.7.3_Global_Effect_Oracle.md`  
実装担当: Gemini Antigravity (Advanced Agentic Coding)

---

## 1. 改修の目的と背景

前版（v3.7.2）において、有効化（Enable）をONにすると画像が大きく変化することが確認されたものの、**漫画のコマ枠が消失して1枚絵の足元（standing）になる** という重大な構図破壊が発生していた。

### 【原因の特定】
- v3.7.2 では `base_mask = 0` と設定していたため、WebUI Main Conditioning（`PAGE + STYLE`）を渡しても、Attention Hook 内での寄与が完全にゼロ（0）になっていた。
- その結果、各コマのプロンプト（特に第1コマの `close up, 1girl, standing`）が画面全体を支配し、コマ割りが消えて1枚絵の足が出力されていた。

本改修（v3.7.3）では、Forge Couple v4.0.2 の設計思想に基づき、**「Global Effect を独立した `cond_1 + mask_1`（全画面 * global_weight）として明示注入する機構」** を導入し、全体構造と各コマの被写体を確実に協調動作させる。

---

## 2. 実施した主な改修内容

### ① 【バックエンド】Global Effect 独立 Branch の実装（`manga_prompter.py`）
1. **Global Effect Branch（`cond_1`, `mask_1`）**:
   - `fc_args["cond_1"]`: `PAGE STRUCTURE, GLOBAL STYLE` の独立コンディショニング。
   - `fc_args["mask_1"]`: `torch.ones((1, H, W)) * global_effect_weight`（全画面マスク）。
2. **Canvas Regions（`cond_2..`, `mask_2..`）**:
   - `fc_args[f"cond_{i+2}"]`: 各コマの `GLOBAL STYLE, clean_region`。
   - `fc_args[f"mask_{i+2}"]`: 各コマの空間マスク `* region_weight`。
3. **正規化による比率制御**:
   - `global_effect_weight = 0.25` の場合、各コマ領域内では「全体効果 約20% ＋ コマ固有内容 約80%」となり、全体のコマ割り・画風を維持しながら各コマの内容を強く描き分ける。
4. **Branch Mapping ログの出力**:
   - サンプリング開始前に `[MangaPrompter][BRANCH MAP]` をコンソールへ出力し、各 Branch のプロンプトとマスクの割り当てを完全可視化。

### ② 【UI ＆ テンプレート】Diagnostic Oracle テンプレートへの刷新
1. **スライダーの再定義**:
   - `ページ全体効果 (Global Effect Weight)`（0.0〜1.0, 初期値 0.25）。
2. **Diagnostic Template の導入（`manga_canvas.js`）**:
   - モデル記憶の `3koma` レイアウトへの偏りを排除し、純粋な領域分離をテストするため、デフォルト PAGE を `multiple scene composition`、STYLE を `clean illustration, clear subjects, simple composition` に更新。

---

## 3. 変更・維持ファイル一覧

| ファイルパス | 変更区分 | 内容 |
| :--- | :---: | :--- |
| `scripts/manga_prompter.py` | **変更** | Global Effect (`cond_1`, `mask_1`) 注入、Branch Map ログ出力、UI スライダー再定義 |
| `javascript/manga_canvas.js` | **変更** | Diagnostic Template (multiple scene composition)、プレースホルダー更新 |
| `docs/ARCHITECTURE_AND_KNOWLEDGE_BASE.md` | **更新** | v3.7.3 Global Effect アーキテクチャの記録 |
| `GitHubURL_ERE.txt` | **更新** | 本改修報告書のRaw URLおよびv3.7.3リファレンス追記 |
| `scripts/manga_attention.py` | **維持** | Forge Couple v4.0.2 互換 Attention Hook (診断カウンター・Sentinel保持) |
| `scripts/manga_spatial_engine.py` | **維持** | Z-Indexくり抜き対応 空間マスク生成エンジン |
| `style.css` | **維持** | reForge ネイティブ準拠 高視認性スタイルシート |

---

## 4. 同期およびミラーリング状況

以下の3箇所すべてにおいて完全同期（同一内容）を確認済み：
1. `e:\EasyReforgeExtension\`（開発ワークスペース）
2. `E:\EasyReforge\stable-diffusion-webui-reForge\extensions\easyreforge-manga-prompter\`（実機実行環境）
3. `D:\GitHub\tegaki\EasyReforgeExtension\`（GitHubリポジトリ連携ディレクトリ）

---

## 5. 段階Oracle検証方針（指示書 Section 20〜24）
まずは以下の **Stage 1（2領域 Oracle）** からテストを開始し、左右のプロンプト分離を確認する：

- **Stage 1 (2領域)**:
  ```text
  multiple scene composition
  BREAK
  clean illustration, clear subjects, simple composition
  BREAK
  koma 1: huge bright red sports car, side view
  BREAK
  koma 2: blue ocean, open sea, horizon, no vehicle
  ```
- **Stage 1A (Swap Test)**: コマ1とコマ2のプロンプトを入れ替え、描画内容が左右反転するか確認。
- **Stage 1B (Single Change)**: コマ1だけ `giant green apple` に変更し、コマ1のみ変化するか確認。
