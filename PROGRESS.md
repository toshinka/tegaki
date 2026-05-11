# PROGRESS — 作業ログ

> GeminiとClaudeが引き継ぎに使う共有メモ。
> 作業後に必ずここを更新すること。最新が上、過去ログは末尾に蓄積。

---

## 現在のフェーズ

**Phase 1a — Vite環境構築・起動確認**
作業フォルダ：`tegaki_phase1a`

---

## フォルダ状態

| フォルダ | 状態 |
|---|---|
| `tegaki_phase0` | ✅ オリジナル保存。触らない |
| `tegaki_phase1a` | 🔧 現在の作業フォルダ。phase0と同内容からスタート |
| `PastFiles/` | 完了済みフェーズのアーカイブ置き場 |

---

## 直近の作業（最新が上）

### 2026-05-12
- ベースをtegaki_rev0（→ tegaki_phase0にリネーム）にロールバック決定
- rev30系はPixiJS初期化順序破損・キャンバス消失バグあり → 破棄
- フォルダ運用ルール確定（phase0=オリジナル、phase1a〜=作業コピー）
- GEMINI.md・TEGAKI.md・PROGRESS.mdをphase構成に対応し更新
- GitHubURL.txtをphase1a対応に更新
- phases/phase1a.md を新規作成（Vite移植フェーズ指示書）
- phases/phase0.md は今回は作成しない（phase0は触らないため不要と判断）

### 2026-05-11
- TEGAKI.md・GEMINI.md・PROGRESS.md を新規作成
- 方針確定：JS（TypeScriptなし）+ Vite + ESM で再構築
- perfect-freehand + BlendMode.ERASE をペン・消しゴム方針として採用
- PixiJS v8.17.0対応・UI参考アプリ追記
- 命名規則・グローバル登録・レンダーループ・ハルシネーション対策を追記

---

## 現在の既知バグ・課題

| 内容 | 場所 | 対応フェーズ |
|---|---|---|
| 消しゴム使用時にキャンバスが消える | phase0（既知） | 1c |
| PixiJS初期化順序破損（rev30系） | 破棄済み | — |

---

## 次にやるべきタスク（phase1a）

- [ ] `tegaki_phase1a` に `npm create vite` でVite環境を構築
- [ ] `npm install pixi.js@8.17.0 perfect-freehand gsap` でライブラリ導入
- [ ] 既存ファイルをVite/ESM形式に変換しながら移植
- [ ] `vite dev` で起動・描画できることを確認
- [ ] 完了後にClaudeへ報告→phase1b指示書作成へ

---

## Claudeへ

phase1a完了後：
- ファイル構成とコンソールログをここに貼ること
- 座標系・初期化順序の点検をClaudeに依頼
- phase1b（キャンバス・初期化整理）の指示書作成を依頼

---

## 備考・決定事項メモ

- PixiJSの `toLocal()` / `toGlobal()` は使用禁止
- ペンと消しゴムは `strokeType` + `BlendMode.ERASE` で統合実装
- DPR=1固定
- WebGL2マスターレンダーループ（glRender→pixiRenderの順）
- パネル類は常時表示しない、ショートカット/ボタンでポップアップ

---

---
## 📁 過去ログアーカイブ
---

*(現時点では過去ログなし。フェーズ完了のたびに上記ログをここに移動する)*
