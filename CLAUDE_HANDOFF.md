# CLAUDE_HANDOFF.md — 別チャット引き継ぎ用

> このファイルは「このClaudeチャットの文脈を知らない別のClaude」に渡すためのもの。
> 冒頭からここを読めば状況を把握できる。

---

## あなたに頼みたいこと（オーナーより）

ブラウザで動くお絵かきツールを自分で開発しています。
コーディングは非経験者で、実装はAI（Gemini CLI・Claude）が担っています。
GeminiがローカルのPCでファイルを直接編集し、ClaudeはGitHubのURL経由でコードを読んで設計相談・点検・次フェーズ指示書の作成をしています。

---

## プロジェクトの現在地

**フェーズ：Phase 1a — Vite環境構築・起動確認（作業中）**

- Geminiが `tegaki_phase1a` フォルダでVite移植作業を進めていた
- 本日Geminiの無料枠（1日1,000リクエスト）を使い切って作業停止
- 明日Geminiを再起動して続きを進める予定

---

## フォルダ構成

```
tegaki/
├── GEMINI.md              ← Gemini CLIが自動読み込み。フェーズ参照先が書いてある
├── TEGAKI.md              ← プロジェクト全体の方針・技術スタック・禁止事項（本体）
├── PROGRESS.md            ← 作業ログ・現在地・既知バグ・次タスク
├── GitHubURL.txt          ← ClaudeがGitHub経由でコード読む用のURL一覧
├── phases/
│   └── phase1a.md         ← 現在アクティブなフェーズ指示書
├── tegaki_phase0/         ← オリジナル保存。絶対に触らない
├── tegaki_phase1a/        ← Geminiが作業するフォルダ（現在アクティブ）
└── PastFiles/             ← 完了済みフェーズのアーカイブ
```

---

## Claudeの役割分担

| 担当 | 内容 |
|---|---|
| **Gemini CLI** | ローカルファイルの実装・実行確認・エラー修正 |
| **Claude** | 設計相談・コードレビュー・次フェーズ指示書の作成 |
| **オーナー** | フォルダのコピー・アーカイブ・最終確認 |

---

## 技術スタック（重要）

```
言語:           JavaScript（TypeScript不使用）
ビルド:         Vite（ホットリロードのみ）
モジュール:     ESM（import/export）
描画:           WebGL2
UI:             PixiJS v8.17.0
ペン輪郭:       perfect-freehand
イベント:       EventBus（component:action形式）
アニメ:         GSAP
```

**主な禁止事項**
- PixiJSの `toLocal()` / `toGlobal()` 使用禁止
- 消しゴムの「白塗り」実装禁止（`BlendMode.ERASE` を使う）
- ペンと消しゴムの分離実装禁止（`strokeType` で統合）
- TypeScript・Babel・複雑なbundler設定
- DPR=1固定（Retina対応しない）

---

## 開発目標（フェーズ別）

| フェーズ | 内容 | 状態 |
|---|---|---|
| **1a** | Vite移植・起動確認 | 🔧 進行中 |
| **1b** | キャンバス・WebGL2・PixiJS初期化の整理 | 未着手 |
| **1c** | ペン単体（固定サイズで描ける） | 未着手 |
| **1d** | 消しゴム（BlendMode.ERASE） | 未着手 |
| **1e** | 筆圧・サイズ調整 | 未着手 |
| **2** | GIFアニメ（コマ別時間設定） | 未着手 |
| **3** | 動画ツール（物理演算・メッシュ変形・ボーン） | 未着手 |

---

## ベースコードの経緯（重要）

- 元々 `webgl2_rev30` で作業していたが、PixiJS初期化破損・キャンバス消失バグが発生
- `tegaki_rev0`（= `tegaki_phase0`）にロールバック
- `tegaki_phase0` は「ペンで描けるが消しゴムにバグあり」の動作確認済みベース
- コンソールログは `TegakiConsole.txt` に保存済み（GitHubURL.txtと同じフォルダ）

---

## カラーパレット

```
Maroon:   #800000  アクティブペン色（デフォルト）
Stiletto: #9c3836
Contessa: #b8706b
Eunry:    #d4a8a1  パネル背景
Bizarre:  #f0e0d6  背景レイヤー0デフォルト色
Ivory:    #ffffee  キャンバス背景
Accent:   #ff8c42  橙色（アクティブ強調）
```

---

## UIの参考アプリ

| アプリ | 参照する要素 |
|---|---|
| Adobe Fresco | 全体の第一印象・ツール配置感 |
| ToonSquid 2 | 動画編集テーブル・タイムライン |
| Procreate Dreams | アニメーションUX・レイヤー×時間マトリクス |
| はっちゃん | キャンバス優先・余計なものを置かない潔さ |

---

## GitHubのコードを読むには

`GitHubURL.txt` に全ファイルのURLが一覧になっています。
「GitHubURL.txtを渡すので全ファイルを読んでください」とオーナーに依頼してください。

---

## 新しいClaudeへのお願い

1. このファイルを読んだら「状況を把握しました」と伝えてください
2. `TEGAKI.md` と `PROGRESS.md` もあれば渡してもらって読んでください
3. 次にやることはGeminiの作業完了を待ってから「phase1b.md」を作成することです
4. コードの設計判断・行き詰まり相談はいつでも受け付けてください

---

*作成：2026年5月12日*
