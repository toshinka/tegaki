# PROGRESS — 作業ログ

> GeminiとClaudeが引き継ぎに使う共有メモ。
> 作業後に必ずここを更新すること。

---

## 現在のステータス
- **フェーズ**: Phase 1 — お絵かきツール基盤の再構築
- **最終更新**: 2026-05-11
- **目標**: WebGL2 + ラスター形式による安定したペン・消しゴム実装

---

## 履歴 (History)

### 2026-05-11 (Gemini)
- **現状把握**: `tegaki_rev0` をベースに作業を開始。
- **技術選定**: 
  - PixiJS v8.17.0
  - perfect-freehand
  - WebGL2
  - Vite + ESM
- **アーキテクチャ刷新**:
  - `package.json` 更新、`main.js` エントリーポイント作成。
  - 主要コアファイルの ESM 化。
- **バグ修正と初期化改善**:
  - `index.html` から不要な `<script>` タグを削除し、`main.js` での一括管理へ移行（"Unexpected token 'export'" エラーの解消）。
  - `earcut-triangulator.js` の欠落を修正し、`earcut` ライブラリを `index.html` に追加。
  - `main.js` 内でのグローバル変数（`window.PIXI`, `window.TEGAKI_CONFIG` 等）の明示的登録により、レガシーコードとの互換性を確保。
- **ペン・消しゴム実装**:
  - `perfect-freehand` を使用した `freehand-stroke.js` による新描画システムの実装。

---

## 完了したタスク (Done)

- [x] プロジェクト構成の調査
- [x] `PROGRESS.md` のレイアウト刷新
- [x] `index.html` の PixiJS バージョン更新 (v8.17.0)
- [x] Vite + ESM への移行
- [x] `perfect-freehand` を使用した `freehand-stroke.js` の作成
- [x] 初期化エラーの解消 (CORS/ESM/Path問題)

---

## 現在取り組んでいるタスク (Doing)

- [ ] **実動作確認**
  - Vite サーバー経由での動作点検
- [ ] **既存システムの ESM 移行継続**

---

## 次にやるべきタスク (Next)

- [ ] 消しゴムのバグ (キャンバスが消える問題) が解消されているか確認
- [ ] レイヤーパネルの表示と操作の連携

---

## 既知のバグ (Bugs)

| バグ内容 | 発生場所 | 優先度 | 状況 |
|---|---|---|---|
| 消しゴム使用時にキャンバス全体が消える | `webgl2_rev30`系 | 高 | 再構築中 |

---

## Claudeへ (申し送り事項)

- `index.html` を極限まで簡略化し、`main.js` で全ての依存関係を解決するようにしました。
- ブラウザのセキュリティ制限（CORS）により、`file://` プロトコルでの直接起動はできなくなりました。必ず Vite などのローカルサーバーを使用してください。

---

## 備考・メモ
- ローカル実行手順: `npm install` -> `npm run dev` -> 表示された URL (localhost) を開く。
