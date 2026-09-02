# EasyReforge Manga Prompter - v3.7.4 Regional Core 継続診断 + CSP参考コマ枠編集 改修完了報告書

作成日: 2026-09-02  
対象環境: Zuntan03/EasyReforge 内 `stable-diffusion-webui-reForge`  
対象拡張: EasyReforge Manga Prompter (Manga Region Prompter)  
準拠指示書: `EasyReforge_Manga_Prompter_v3.7.4_Core_and_CSP_Panel_Editor.md`  
実装担当: Gemini Antigravity (Advanced Agentic Coding)

---

## 1. 改修の目的と背景

前版（v3.7.3）の実生成実験において、以下の重要な事実と課題が確認された：

1. **確認できた成果**:
   - 上下2分割や重み付け（Region Weight）は極めて強く機能し、上段に赤いスポーツカー、下段に青りんごが狙い通りに描画された。
   - ControlNet 併用時も、コマ枠構造を保持しながら Manga Region Prompter が各コマの内容差を付与できることが実証された。
2. **残された課題**:
   - 左右分割（縦割り）において、左右に分離せず「車の上にりんごが乗る」ような1つの構図にまとまりやすい（semantic isolation の弱さ）。
   - コマ枠の編集操作において、スライス操作と選択操作が混同しやすく、直感的な比率調整や複数コマの一括調整がやりにくかった。

本改修（v3.7.4）では、**CLIP STUDIO PAINT（クリスタ）のコマ枠操作思想** を取り入れた高機能なコマ編集UIの確立と、**「Exclusive（コマ連結/くり抜き） vs Overlap（重なり許可/共存ブレンド）」** の2大領域関係モードを実装した。

---

## 2. 実施した主な改修内容

### ① 【バックエンド】Exclusive vs Overlap 領域関係モードの導入（`manga_spatial_engine.py`）
- `MangaSpatialEngine.generate_spatial_masks()` に `interactionMode` 判定を追加。
  - **`exclusive`（コマ連結・デフォルト）**: 従来の Z-Index くり抜きを行い、コマ同士の意味干渉を完全に防ぐ。
  - **`overlap`（重なり許可）**: Z-Index くり抜きを行わず、重なり領域で両方のコンディショニングを保持。Attention正規化（`mask / sum(mask)`）により、同一シーン内の人物近接や自然なブレンドを実現。
- サンプリング開始時の `[BRANCH MAP]` に現在の `MODE (EXCLUSIVE / OVERLAP)` および各コマの `rect` 情報を明示ログ出力。

### ② 【フロントエンド】クリスタ風 コマ枠編集エンジンの実装（`manga_canvas.js`）
1. **明示的なツールモードの分離**:
   - `🖱 選択・編集 (Select)`: コマ選択、共通境界ドラッグ、Overlap時のパネル移動＆8方向リサイズ。
   - `✂ スライス (Slice)`: 直線ドラッグによる枠線分割。ツール解除まで連続スライス可能。
   - `▭ 矩形コマ (DrawRect)`: ドラッグによる自由な四角形コマ作成。
2. **Liang-Barsky 矩形クリッピング交差判定（スライスの高精度化）**:
   - 直線ドラッグと各コマ矩形の交差量（Coverage）を計算。
   - `80% ルール`（選択中コマは 40% フォールバック）により、意図したコマだけを誤判定なく確実に切断。
   - ドラッグ中に切断対象コマをオレンジ色破線でプレビュー。
3. **境界グループ連動ドラッグ (Group Gutters)**:
   - 4〜6コマ配置において、同一線上にある共通境界（collinear shared gutters）をグループ化し、1回のドラッグで複数コマの境界を一括伸縮可能に。
4. **Overlap モードでの 8方向リサイズ ＆ パネル移動**:
   - Overlap モード選択時、選択中コマに 8個のリサイズハンドル（四隅・四辺）を表示し、自由な移動・重なり配置が可能に。
5. **UI の整理 ＆ カテゴリ化**:
   - [ツール] / [クイック] / [領域関係] / [テンプレート] の4グループにツールバーを整理。
   - 不要な「カットイン（入れ子）」固定ボタンを削除（矩形＋Overlapで完全代替）。

---

## 3. 変更・維持ファイル一覧

| ファイルパス | 変更区分 | 内容 |
| :--- | :---: | :--- |
| `scripts/manga_spatial_engine.py` | **変更** | `interactionMode`（`exclusive` vs `overlap`）対応、くり抜き分岐 |
| `scripts/manga_prompter.py` | **変更** | CSP風カテゴリ化ツールバーUI、`[BRANCH MAP]` へのMODEおよびrectログ出力 |
| `javascript/manga_canvas.js` | **変更** | Liang-Barskyスライスエンジン、Group Gutters、8方向ハンドル、ツールモード分離 |
| `style.css` | **変更** | ツールグループCSS、アクティブボタンスタイル（オレンジ/エメラルド）、高視認性スタイル |
| `docs/ARCHITECTURE_AND_KNOWLEDGE_BASE.md` | **更新** | v3.7.4 のアーキテクチャ・知見・新機能の記録 |
| `GitHubURL_ERE.txt` | **更新** | 本改修報告書のRaw URLおよびv3.7.4リファレンス追記 |
| `scripts/manga_attention.py` | **維持** | Forge Couple v4.0.2 互換 Attention Hook (診断カウンター・Sentinel保持) |

---

## 4. 同期およびミラーリング状況

以下の3箇所すべてにおいて完全同期（同一内容）を確認済み：
1. `e:\EasyReforgeExtension\`（開発ワークスペース）
2. `E:\EasyReforge\stable-diffusion-webui-reForge\extensions\easyreforge-manga-prompter\`（実機実行環境）
3. `D:\GitHub\tegaki\EasyReforgeExtension\`（GitHubリポジトリ連携ディレクトリ）
