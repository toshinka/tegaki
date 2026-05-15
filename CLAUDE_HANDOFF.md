# CLAUDE_HANDOFF.md — 新Claudeチャット引き継ぎ用

> このファイルは、新しい Claude チャットへ渡すための現状整理。
> まずこのファイルを読み、続けて `TEGAKI.md`、`tegaki_work/PROGRESS.md`、現在の作業指示書を読むこと。

---

## オーナーからClaudeへ

ブラウザで動くお絵かきツール `TEGAKI` を個人開発しています。
オーナーはコーディング初心者で、実装・調査・設計整理は AI に任せています。

Claude には、GitHub 経由でコードを読んでもらい、設計判断・問題整理・Gemini への作業指示書作成・レビューをお願いしています。
ローカルの実ファイル調査と軽微な直接修正は Codex も担当します。
Gemini CLI は主な実装担当です。

---

## AI体制

Claude と Codex はダブルコンダクターです。
片方が上限や待機で止まっている時は、もう片方が調査・整理・指示作成・小修正を進めます。

| 担当 | 主な役割 |
|---|---|
| Claude | 設計統括、方針判断、GitHub経由レビュー、Gemini作業指示書作成 |
| Codex | ローカル調査、原因切り分け、小さな直接修正、実装前後レビュー、文書同期 |
| Gemini CLI | `tegaki_work/` の実装、ビルド、ブラウザ確認、`PROGRESS.md` 更新 |
| オーナー | 実機確認、最終判断、AI間の受け渡し |

大きな構造変更は Claude/Codex のどちらかが整理してから Gemini に渡す。
小さい不具合潰しは `GEMINI作業指示書.txt` 系で十分です。

---

## 最初に読むファイル

1. `TEGAKI.md`
   - 技術方針の正本。古い資料より優先。

2. `tegaki_work/PROGRESS.md`
   - 最新作業ログ。Gemini の「修正済み」は実機未確認の場合があるため、オーナー報告と照合する。

3. `GEMINI作業指示書_Claude版.txt`
   - 2026-05-16 時点で Claude が作成した v8 指示書。

4. `tegaki_work/TegakiConsole.txt`
   - 実機ログ。pointer / thumbnail / Pixi warning の確認に使う。

5. `GEMINI.md` / `CODEX.md`
   - AI ごとの作業ルール。

6. `tegaki_work/GitHubURL.txt`
   - GitHub raw URL 一覧。ただし古いパスや typo が混じる可能性あり。実在確認を優先。

---

## 現在の作業対象

```text
tegaki_work/
```

`tegaki_phase0/` と `PastFiles/` は参照・保存用。
古い `tegaki_phase1a` 表記は、原則 `tegaki_work/` に読み替える。

---

## 現在のフェーズ

**Phase 1c — 液タブペン対応・消しゴム修正・サムネイル・描線安定化**

現在の描画方針：

- レイヤーは `RenderTexture`。
- ペン/消しゴムはライブラスター寄りにし、ドラッグ中に短い線分を `RenderTexture` へ焼き込む。
- `perfect-freehand` は補助/旧経路として扱う。離した瞬間に線が丸まる感触はデフォルトにしない。
- DPR は 1 倍固定。`resolution: 2` は採用しない。
- WebGL2 Mesh 経路は Phase 1c では復活させない。

---

## 2026-05-16 時点の重要状況

### 1. 液タブペン

`TegakiConsole.txt` では `pointerType:"pen"`、`buttons:1`、`pressure` 付きイベントが `DrawingEngine Pen Down` まで到達している。
つまり「ブラウザ/DOMに届かない」段階は越えている可能性が高い。

まだ実機で描けない場合は、次を見る。

- `pointer-handler.js` から `drawing-engine.js` への info 変換
- `button/buttons` 判定
- active layer / render target / local座標の範囲
- リサイズ後に 400x400 までしか描けない問題との関連

### 2. サムネイル

通常レイヤーのサムネイルが透明または黒/灰色に見える問題が継続。
Claude版 v8 指示で `extract.pixels(new Sprite(sourceRT))` にしたが、中心1点ログだけでは線を見落とす。

Codex が 2026-05-16 に追加整理した点：

- サムネイル抽出元サイズを `sourceRT.width/height` に合わせる。
- `nonTransparentPixels` と `maxAlpha` をログに出す。
- `RenderTexture` からの抽出が本当に空か、中心点が透明なだけかを判別しやすくする。

### 3. リサイズ後の描画範囲

オーナー報告：

- キャンバス見た目は 800x600 等へ広がる。
- しかし実際に描ける範囲が左上 0,0 から 400x400 までに見える。

調査観点：

- `layer-system.js` の `resizeLayerTextures()`
- `layerData.renderTexture` と `layerData.layerSprite.texture` の差し替え
- `window.TEGAKI_CONFIG.canvas.width/height`
- coordinate-system / drawing-engine の bounds 判定
- thumbnail-system の抽出元サイズ

Pixi warning `clear() called with no buffers in bitmask` は、Codex が `clear: true, clearColor: [0,0,0,0]` へ整理済み。

### 4. バケツ

Claude版 v8 で `fill-tool.js` は `RenderTexture` 焼き込み方式へ移行。
`layerSprite` を破棄しない方向は正しい。
実機確認でレイヤー消失が再発する場合は、fill後の `renderTexture` と `layerSprite.texture` を確認する。

### 5. ログ

pointer / thumbnail の診断ログが多い。
Phase 1c の実機確認中は残してよいが、原因確定後は削減する。

---

## Claudeに見てほしい設計論点

1. リサイズ後に 400x400 までしか描けない原因が、描画範囲判定・RenderTexture・座標変換のどこにあるか。
2. サムネイル抽出を `thumbnail-system.js` に一本化できているか。
3. ライブラスター方式を Phase 1c の標準として固定してよいか。
4. `getCoalescedEvents()` の扱いで、tablet event の button/buttons/pressure 情報が欠落しないか。
5. 旧 perfect-freehand / WebGL2 / SDF / MSDF 系の迷いを、いつ整理対象にするか。

---

## 旧資料の扱い

`計画書/` は古い資料です。
DRY/SOLID、ファイルヘッダー、座標変換単一責務、EventBus契約、ログ管理などの作業規律は有用。
一方、Vite禁止、ESM禁止、file://前提、Pixi Graphics禁止、perfect-freehand禁止、WebGL2必須は現行方針では採用しません。

迷ったら `TEGAKI.md` を優先してください。

---

## 新しいClaudeへの最初の返答例

```text
状況を把握しました。
現在の作業対象は tegaki_work、フェーズは Phase 1c です。
次に TEGAKI.md、tegaki_work/PROGRESS.md、GEMINI作業指示書_Claude版.txt、TegakiConsole.txt を確認し、リサイズ後の描画範囲・サムネイル・液タブ入力を中心に見ます。
```

---

*最終更新: 2026-05-16*
