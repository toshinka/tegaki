# codex-task-01 — 初回調査タスク（Gemini作業中に実施可能）

> **このタスクは読み取り専用。ファイルを一切編集しない。**
> Gemini CLIがPhase1cを作業中でも並行して実施できる。

---

## タスク1：GitHubURL.txt の漏れ確認

`tegaki_phase1a/` フォルダ内の全ファイルを走査して、
`tegaki_phase1a/GitHubURL.txt` に記載されていないファイルを洗い出す。

**確認手順：**
1. `tegaki_phase1a/` 以下の `.js` `.css` `.html` ファイルを全て列挙する
2. `tegaki_phase1a/GitHubURL.txt` の記載内容と突き合わせる
3. 漏れているファイルのパスを報告書に記載する

**除外してよいもの：**
- `node_modules/` 以下
- `dist/` 以下
- `.git/` 以下
- `vite.config.js`・`package.json`・`package-lock.json` 等のVite設定ファイル

---

## タスク2：ファイルヘッダーの書式点検

TEGAKI.mdに定められたヘッダー書式が各ファイルに記載されているか確認する。

**正しい書式（TEGAKI.md準拠）：**
```javascript
/**
 * ============================================================================
 * ファイル名:
 * 責務:
 * 依存:
 * 被依存:
 * 公開API:
 * イベント発火:
 * イベント受信:
 * グローバル登録:
 * 実装状態: 🆕新規 / ♻️移植 / 🔧改修
 * ============================================================================
 */
```

**確認対象ファイル（優先度高）：**
- `system/drawing/stroke-renderer.js`
- `system/drawing/brush-core.js`
- `system/drawing/drawing-engine.js`
- `coordinate-system.js`
- `system/camera-system.js`
- `core-engine.js`
- `core-initializer.js`

書式が欠けているフィールドや、内容が実態と乖離していそうな箇所を報告する。
（修正はしない。報告のみ）

---

## タスク3：pointer-handler.js の pointerType 分岐調査

Phase1cで修正予定のバグの事前調査。

`tegaki_phase1a/system/drawing/pointer-handler.js` を読んで以下を確認する：

1. `pointerType === 'mouse'` / `pointerType === 'pen'` / `pointerType === 'touch'` の分岐が存在するか
2. 分岐がある場合、それぞれのパスで座標変換の処理が異なっているか
3. `screenClientToCanvas()` の呼び出しがpointerTypeによって変わっているか

**報告書に含めること：**
- 分岐の有無
- 分岐がある場合は該当行番号と処理内容の差異
- Geminiへの修正提案（修正自体はしない）

---

## タスク4：フォールバック・レガシーコードの残存確認

TEGAKI.mdの「フォールバック禁止」ルールに違反するコードが残っていないか確認する。

**検索対象キーワード：**
- `Legacy` または `legacy`
- `fallback` または `Fallback`
- `try {` ブロックの中に描画処理が含まれているもの
- `catch` で別の描画処理に切り替えているもの

**確認対象ファイル：**
- `system/drawing/stroke-renderer.js`
- `system/drawing/brush-core.js`
- `system/drawing/drawing-engine.js`

残存している場合は該当ファイル・行番号・コード内容を報告する。

---

## 完了後の報告

CODEX.mdの「報告書の書式」に従って全タスクの結果をまとめて出力する。
報告書はオーナーがClaudeに転送する。
