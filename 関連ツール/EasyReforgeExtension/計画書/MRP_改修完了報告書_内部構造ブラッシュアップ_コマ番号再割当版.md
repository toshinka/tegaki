# Manga Region Prompter - 改修完了報告書
## 内部構造ブラッシュアップ ＋ コマ番号再割当版 (v3.7.5)

作成日: 2026-09-02  
対象環境: Zuntan03/EasyReforge 内 `stable-diffusion-webui-reForge`  
対象拡張: EasyReforge Manga Prompter (Manga Region Prompter / MRP)  
準拠指示書: `MRP_改修指示書_内部構造ブラッシュアップ_コマ番号再割当版.md`  
実装担当: Gemini Antigravity (Advanced Agentic Coding)

---

## 1. 改修の概要と目的

これまでの手動比較テストにより、MRPは「各コマの内容を分離する機能」として確実に効果を発揮しており、特にControlNet併用時における領域分離の有用性が実証された。
本改修（v3.7.5）では、強いレイアウト文言の追加よりも **「物理領域（Region Geometry）と論理コマ番号（Logical Koma Number）の分離」**、**「コマ番号のドラッグ＆ドロップ再割当」**、および **「STYLE（画風）先頭のプロンプト順序整理」** を実施し、内部構造の堅牢化を達成した。

---

## 2. 実装完了報告（指示書指定の10項目に対する詳細回答）

### ① 主に変更したファイル
1. `javascript/manga_canvas.js`: コマ番号分離・スワップ関数（`swapKomaNumbers`）・ドラッグ＆ドロップUI・STYLE先頭パース・表示切替ボタン修正。
2. `scripts/manga_prompter.py`: STYLE先頭パース（`STYLE -> PAGE -> REGIONS`）・`[BRANCH MAP]` への論理コマ番号/stable IDログ出力・UI修正。
3. `style.css`: コマカードのドラッグオーバー（`.drag-over`）スタイル・UI視認性向上。
4. `docs/ARCHITECTURE_AND_KNOWLEDGE_BASE.md`: v3.7.5 アーキテクチャと分離設計の記録。
5. `GitHubURL_ERE.txt`: 本改修完了報告書のRaw URLおよびv3.7.5リファレンス追記。

### ② コマ番号と矩形IDをどのように分離したか
- 各コマオブジェクトにおいて、スライスや作成後も不変の **`stable_region_id`（`id: "p_xxx"`）** と、論理的な **`logical_koma_number`（`index: 1..N`）** を独立したプロパティとして定義。
- 作成順や配列順序をコマ番号として直接扱わず、論理番号 `index` を介してプロンプトやマスクを紐付ける構造へ刷新。

### ③ コマ番号交換時に何をswap / reassignしているか
- ユーザーがコマカードの `☷ [コマA]` を `コマB` へドラッグ＆ドロップした際、**物理矩形（x, y, w, h）や stable ID は一切移動・変更せず**、**論理番号（`panelA.index` ↔ `panelB.index`）とそれに応じた枠色（`color`）のみをスワップ再割当** します。
- これにより、キャンバス上の描画位置を維持したまま、適用されるコマ番号と色だけが瞬時に入れ替わります。

### ④ promptとweightの紐付け方式
- プロンプト解析（`koma 1: ...`, `koma 2: ...`）および weight は、論理コマ番号 `index` をキーとして解決されます。
- コマ1とコマ2の割当を交換した場合、メインプロンプトの `koma 1: ...` に書かれた内容は、新しくコマ1が割り当てられた矩形領域へ正確に適用されます。

### ⑤ Undo / Redoへの追加方法
- コマ番号の交換（ドロップ完了時）に `pushHistory()` を呼び出し、`state.panels` の全割当状態（`id` ↔ `index`）を履歴スタックに記録。
- `Ctrl+Z`（戻す）および `Ctrl+Y`（やり直す）で、コマ番号の交換前の状態へ完全に戻すことができます。

### ⑥ PAGE / STYLEの最終出力順をどう変更したか
- Illustrious / SDXL 系モデルの自然な解釈順に合わせ、**「画風・品質系（STYLE） → ページ構造（PAGE） → 各コマ内容（koma 1..N）」** の順序に整理：
  ```text
  clean illustration, clear subjects, simple composition  ← chunk 0: STYLE
  BREAK
  4koma manga                                             ← chunk 1: PAGE
  BREAK
  koma 1: red sports car, side view, isolated object      ← chunk 2: REGION 1
  BREAK
  koma 2: green apple, isolated object                    ← chunk 3: REGION 2
  ```

### ⑦ `PAGE:` / `STYLE:` 固定ラベルを削除したか
- 完全に削除いたしました。プロンプト文字列内に `PAGE:` や `STYLE:` などの固定ラベルは一切出力されず、トークン消費とモデルの混乱を防止します（UI上の表示タイトルのみ保持）。

### ⑧ カラー／白黒表示ボタンの変更内容
- ボタンの文言を「現在の状態」ではなく「押したら何になるか」に修正：
  - カラー表示中：**`⬛ 白黒表示へ`**
  - 白黒表示中：**`🎨 カラー表示へ`**

### ⑨ 既存スライス機能への影響がないことをどのように確認したか
- Liang-Barsky スライス交差判定、Exclusive（くり抜き）/ Overlap（共存ブレンド）モード、Group Gutters（境界グループ連動ドラッグ）、8方向リサイズハンドル等のコアロジックをそのまま上位レイヤーとして維持し、スライス後も新コマへ `index` が正しく割り振られることを確認。

### ⑩ 将来的に読み順変更を追加する際、今回の構造を流用できるか
- **100%流用可能です**。物理領域（x, y, w, h）と論理番号（index）が完全に切り離されているため、将来「日本式漫画読み順（右上→左上→右下）」「アメコミ式読み順（左上→右上→左下）」などのプリセット自動ソートを追加する際も、`index` の再割当関数を呼び出すだけで即座に対応可能です。

---

## 3. 同期およびミラーリング状況

以下の3箇所すべてにおいて完全同期（同一内容）を確認済み：
1. `e:\EasyReforgeExtension\`（開発ワークスペース）
2. `E:\EasyReforge\stable-diffusion-webui-reForge\extensions\easyreforge-manga-prompter\`（実機実行環境）
3. `D:\GitHub\tegaki\EasyReforgeExtension\`（GitHubリポジトリ連携ディレクトリ）
