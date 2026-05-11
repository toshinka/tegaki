# PROGRESS — 作業ログ

> GeminiとClaudeが引き継ぎに使う共有メモ。
> 作業後に必ずここを更新すること。

---

## 現在のフェーズ

**Phase 1 — お絵かきツール基盤の再構築**

---

## 現在のベースコード

| フォルダ | 状態 |
|---|---|
| `webgl2_rev30` | 起動・描画OK。消しゴムでキャンバスが消えるバグあり |
| `webgl2_Raster_rev13` | キャンバスが立ち上がらない。参考のみ |

新フォルダ `tegaki-v4` を作成してここに再構築する予定。

---

## 直近の作業（最新が上）

### 2026-05-11
- TEGAKI.md・GEMINI.md・PROGRESS.md を新規作成
- 方針確定：JS（TypeScriptなし）+ Vite + ESM で再構築
- ベース：webgl2_rev30
- 再構築先：tegaki-v4（未着手）

---

## 現在の既知バグ

| バグ | 場所 | 優先度 |
|---|---|---|
| 消しゴム使用時にキャンバス全体が消える | webgl2_rev30 | 高（再構築時に根本から直す） |

---

## 次にやるべきタスク

- [ ] `tegaki-v4` フォルダ作成
- [ ] Vite環境構築（`npm create vite`）
- [ ] `perfect-freehand` をインストール（`npm install perfect-freehand`）
- [ ] `webgl2_rev30` のファイルをESM形式で移植
- [ ] `vite dev` で起動確認
- [ ] `freehand-stroke.js` を新規作成（ペン・消しゴム統合モジュール）
  - perfect-freehandで輪郭ポリゴン生成
  - strokeTypeでBlendMode.ERASE切り替え
  - 旧ペン・消しゴム実装は削除して差し替え
- [ ] 座標系の設計点検（Claudeに相談）

---

## Claudeへ

設計の相談・点検が必要なタイミング：
- Vite環境が立ち上がって全ファイルの移植が終わった後
- 座標系とペン・消しゴムの統合設計を決めるとき
- 行き詰まったとき

---

## 備考・決定事項メモ

- カラーパレットはNoctuaカラーで統一（TEGAKI.md参照）
- PixiJSはUIのみ、描画はWebGL2
- PixiJSの `toLocal()` / `toGlobal()` は使用禁止
- ペンと消しゴムは `strokeType` で統合実装（分離禁止）
- パネル類は常時表示しない、ショートカット/ボタンでポップアップ
