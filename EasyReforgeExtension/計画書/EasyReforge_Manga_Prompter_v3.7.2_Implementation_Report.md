# EasyReforge Manga Prompter - v3.7.2 GLOBAL 分離版 改修完了報告書

作成日: 2026-09-02  
対象環境: Zuntan03/EasyReforge 内 `stable-diffusion-webui-reForge`  
対象拡張: EasyReforge Manga Prompter (Manga Region Prompter)  
準拠指示書: `EasyReforge_Manga_Prompter_v3.7.2_GLOBAL_Split.md`  
実装担当: Gemini Antigravity (Advanced Agentic Coding)

---

## 1. 改修の目的と背景

前版（v3.7.1）において、Forge公式の `ModelPatcher` フック（`set_model_attn2_patch` / `set_model_attn2_output_patch`）およびライフサイクル（`after_extra_networks_activate`）が正常に接続され、Attention Hookの実行が確認された。
しかし、実生成において以下の課題が残っていた：

- **課題1**: `3koma, manga page` などのページ全体構造タグが各コマの先頭に prefix されていたため、各コマの狭い空間マスク内で「漫画全体」を描こうとして被写体（足や顔など）が重複・混乱していた。
- **課題2**: WebUI本体が計算する main conditioning に各コマのプロンプト本文（`koma 1: ...`, `koma 2: ...`）が残っていたため、全画面への被写体漏れ（リーク）が発生していた。

本改修（v3.7.2）では、これらのプロンプト役割混線を根本解決するため、**「PAGE STRUCTURE と GLOBAL STYLE の分離（N+2 chunk構造）」** および **「WebUI main conditioning からの Region 本文除去」** を実装した。

---

## 2. 実施した主な改修内容

### ① 【プロンプト構造】5 chunk (N + 2 構造) の確立
3コマ生成の場合、メインプロンプトを以下の 5 chunk に厳格に定義・解析する仕組みを導入：

```text
chunk 0: PAGE STRUCTURE (3koma, manga page, comic strip, comic panel)
BREAK
chunk 1: GLOBAL STYLE (masterpiece, best quality, monochrome, manga ink, clean lineart)
BREAK
chunk 2: REGION 1 (koma 1: close-up, 1girl, standing)
BREAK
chunk 3: REGION 2 (koma 2: wide shot, sky, ocean)
BREAK
chunk 4: REGION 3 (koma 3: medium shot, 1boy, sitting)
```

### ② 【バックエンド】`manga_prompter.py` の改修
1. **Main Conditioning の縮小（全画面漏れ遮断）**:
   - `after_extra_networks_activate()` において、WebUIがコンディショニングを計算する直前の `kwargs["prompts"][0]` を `f"{page_text}, {style_text}"`（全体構造＋全体画風のみ）に縮小。
   - 各コマの個別被写体がメインブランチ経由で全画面に漏洩するのを完全に防止。
2. **各コマの Region Conditioning 生成**:
   - `page_text`（`3koma` 等）を各コマに注入する処理を完全撤廃。
   - `resolved_region_text = f"{style_text}, {clean_region}"` として、画風＋被写体のみを独立エンコードして各コマの空間マスクへ流し込むように変更。
3. **Chunk 数の厳密検証（fail-closed）**:
   - `expected_chunks = num_panels + 2`（3コマなら5 chunk）。
   - 不一致時は勝手な推測をせず、明確なエラーログを出して regional patch を適用しない安全設計を維持。
4. **Base Style Weight のバイパス**:
   - `base_mask` は強制的に `empty_tensor`（ゼロ）とし、UI上のスライダーは非活性化（`interactive=False`）。

### ③ 【フロントエンド UI】`manga_canvas.js` の改修
1. **情報パネルの2分割表示**:
   - 右サイドバーの全体表示を **`🧭 [ページ構造 - 第1chunk]`** と **`🎨 [全体画風・品質 - 第2chunk]`** に分割。
2. **リアルタイム解析の更新**:
   - `parseMainPrompt()` で `chunk 0 = page`, `chunk 1 = style`, `chunk 2.. = regions` をリアルタイム抽出。
3. **テンプレート挿入機能の更新**:
   - **「📝 メインプロンプト欄にテンプレ枠を挿入」** ボタンを押した際、現在のコマ数に応じた 5 chunk（N + 2 構造）が自動生成されるように改修。

---

## 3. 変更・維持ファイル一覧

| ファイルパス | 変更区分 | 内容 |
| :--- | :---: | :--- |
| `scripts/manga_prompter.py` | **変更** | GLOBAL Split (N+2 chunk)、main conditioning縮小、prefix処理 |
| `javascript/manga_canvas.js` | **変更** | N+2 chunk リアルタイムパース、サイドバー2段表示、新テンプレ挿入 |
| `docs/ARCHITECTURE_AND_KNOWLEDGE_BASE.md` | **更新** | v3.7.2 のアーキテクチャ・知見・文法の記録 |
| `GitHubURL_ERE.txt` | **更新** | 本改修報告書のRaw URLおよびv3.7.2リファレンス追記 |
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

## 5. 今後のルーチンワーク規定
以後の改修においても、以下のワークフローを標準ルーチンとして徹底する：
1. **指示書に基づく改修実施・動作確認**
2. **`計画書/` 配下へ改修完了報告書（Implementation Report）の作成・保存**
3. **`GitHubURL_ERE.txt` への最新Raw URLおよびドキュメント追記**
4. **実機（Forge extensions）および GitHub（`D:\GitHub\tegaki\...`）への3箇所完全ミラーリング**
