# CLAUDE_HANDOFF.md — 新Claudeチャット引き継ぎ用

> このファイルは、これまでのClaudeチャット文脈を知らない新しいClaudeへ渡すための引き継ぎ資料。
> 新チャットでは、まずこのファイルを読み、続けて `TEGAKI.md` と `tegaki_work/PROGRESS.md` を読むこと。

---

## オーナーからClaudeへ

ブラウザで動くお絵かきツール `TEGAKI` を個人開発しています。
オーナーはコーディング初心者で、実装・調査・設計整理は AI に任せています。

Claude には、GitHub 経由でコードを読んでもらい、設計判断・問題整理・Gemini への作業指示書作成・レビューをお願いしています。
ローカルファイルの直接編集と実行は主に Gemini CLI が担当します。

今回、Claude 側のチャットが長くなり上限に近いため、新しいClaudeチャットへ引き継ぎます。

---

## 現在のプロジェクト状態

**現在の作業対象：`tegaki_work/`**

`tegaki_phase1a` という古い名称が一部ドキュメントやログに残っていますが、現行の作業フォルダは `tegaki_work/` です。
`tegaki_phase0` と `PastFiles/` は参照・保存用で、通常作業では触りません。

**現在のフェーズ：Phase 1c**

主なテーマ：

- 液タブペン入力対応
- 消しゴムの透明リアルタイム消去
- レイヤーサムネイルの安定表示
- 描画中プレビューと確定後ストロークの差異縮小
- 高速・鋭角ストロークの三角形ノイズ対策
- V キー変形後の bake と座標・ブラシサイズ維持

---

## AI 体制：Claude と Codex のダブルコンダクター

このプロジェクトでは、Claude と Codex が「頭」として並走し、Gemini CLI が実装作業を担う形にしています。

| 担当 | 主な役割 |
|---|---|
| **Claude** | 設計統括、方針判断、GitHub経由レビュー、Gemini作業指示書の作成、迷った時の設計相談 |
| **Codex** | ローカル実ファイル調査、原因切り分け、実装前後レビュー、Geminiへの具体的な修正順整理 |
| **Gemini CLI** | `tegaki_work/` の実装、ファイル編集、ビルド、ブラウザ動作確認、`PROGRESS.md` 更新 |
| **オーナー** | 最終判断、AI間の受け渡し、必要なファイル共有、アーカイブ判断 |

Claude と Codex はダブルコンダクターです。
片方が上限や待機で動けない時は、もう片方が調査・整理・指示作成を進めます。
ただし、最終的な設計方針は `TEGAKI.md` を優先し、矛盾がある場合はオーナーに確認してください。

---

## 最初に読むファイル

新しいClaudeは、以下の順で読んでください。

1. `CLAUDE_HANDOFF.md`  
   このファイル。現状の要約。

2. `TEGAKI.md`  
   現行の絶対方針。技術スタック、禁止事項、AI作業規律、役割分担が書かれています。

3. `tegaki_work/PROGRESS.md`  
   Geminiの作業ログ。ただし一部に古い `tegaki_phase1a` 表記が残っているので、作業対象は `tegaki_work/` と読み替えてください。

4. `GEMINI作業指示書.txt`  
   Codex が 2026-05-15 に作成した、次に Gemini が実装すべき追修正指示書。

5. `Codex報告書_1.txt`  
   2026-05-14 時点のCodex調査報告。初期原因分析として有用ですが、その後のGemini実装で一部状況は変わっています。

6. `tegaki_work/GitHubURL.txt`  
   Claude が GitHub raw URL でコードを読むための一覧。ただし古い・誤ったパスが一部残っている可能性があります。実在確認を優先してください。

---

## 現行技術スタック

```text
言語:         JavaScript
モジュール:   ESM import/export
ビルド:       Vite
実行環境:     Chrome 最新
描画基盤:     PixiJS v8.17.0
レイヤー:     PixiJS Container + Sprite(RenderTexture)
ストローク:   perfect-freehand -> PixiJS Graphics.poly -> RenderTexture 焼き込み
UI:           DOM + PixiJS + lucide-static
アニメ:       GSAP
並び替え:     SortableJS
```

重要：

- 現フェーズでは WebGL2 Mesh 経路は復活させない。
- `perfect-freehand` は現行採用。
- `Pixi.Graphics.poly()` は現フェーズの安定経路として採用。
- `RenderTexture` へのラスター焼き込みが基本。
- DPR は 1 倍固定。内部 2 倍化や `resolution: 2` は採用しない。

---

## 旧資料の扱い

`計画書/` フォルダ内の資料は古いものが多いです。
技術方針としてそのまま採用しないでください。

現行と矛盾するため採用しない代表例：

- Vite 禁止
- ESM 禁止
- file:// 直開き前提
- perfect-freehand 禁止
- Pixi.Graphics 本番使用禁止
- WebGL2 フレームバッファ直描画を現フェーズで必須にする方針

ただし、以下の作業規律は `TEGAKI.md` に現行ルールとして取り込み済みです。

- DRY/SOLID
- ファイルヘッダーによる依存関係の明示
- 座標変換の単一責務化
- `toLocal()` / `toGlobal()` 依存禁止
- EventBus payload の形式統一
- 過剰ログ削除
- 既存実装検索
- AI設定ファイル同期
- 色・UI 方針

---

## 現在残っている主要問題

Codex が `GEMINI作業指示書.txt` に整理済みです。
Claude がレビューする場合は、特に以下の設計妥当性を見てください。

### 1. 液タブペン描画がまだ止まる可能性

`pointer-handler.js` 側では `pointerType === 'pen'` の `button === 2` を通すよう修正済み。
しかし `drawing-engine.js` 側で `info.button === 2` をまだ return している可能性があります。

設計判断：

- マウス右クリックは描画しない。
- 液タブペンが `button: 2` として来る場合は描画を許可する。

### 2. 消しゴムのリアルタイム消去が効かない

Gemini はリアルタイム消しゴムを実装したと報告しましたが、Codex調査では、リアルタイム用に `renderPreview(... mode:'eraser')` を呼んでおり、`stroke-renderer.js` 側で eraser preview は空を返すため、実際には何も焼き込めていない可能性が高いです。

設計判断：

- eraser preview は表示しなくてよい。
- ただしリアルタイム消去用の Graphics は別途生成し、`RenderTexture` に `'erase'` で実焼き込みする必要があります。

### 3. サムネイルが崩れる

画像資料：

- `画像資料/1.描画すると-から□のサムネイル.png`
- `画像資料/2.新規レイヤー作成後階層移動すると最初のサムネイルが太る.png`

Codex調査では、`createThumbnail()` で設定した `width/height/border/overflow` が、呼び出し側の `style.cssText = ...` で上書きされて消えることが原因候補です。

設計判断：

- 外枠は `64px x 44px` 固定。
- 中の画像だけ `object-fit: contain` で収める。
- `_updateSingleThumbnail()` で外枠サイズを可変にしない。

### 4. 描線が離した後に丸まる

現状の `perfect-freehand` options は、デフォルトとして `smoothing: 0.4`、`streamline: 0.3` が強すぎる可能性があります。
ユーザーは、細かい絵で線が勝手に補正される感触を強く嫌っています。

設計判断：

- デフォルトはリニア寄り。
- 補正は設定スライダーで上げた時だけ効くべき。
- `streamline` はデフォルト 0 付近が望ましい。

### 5. 高速ストロークの三角ノイズ

WebGL2 Mesh 経路は止めたが、まだ高速入力で三角ノイズが出るとのこと。
`MIN_DIST = 0.25` は近接点対策であり、高速時の異常輪郭対策としては不足している可能性があります。

設計判断：

- `getStroke()` 後の outline bounds を検査する。
- 異常に大きい polygon は採用せず、丸線 fallback へ切り替える。
- WebGL2 Mesh 経路は復活させない。

---

## Claudeに特に見てほしい設計論点

1. `Graphics.poly()` 経路を Phase 1c の正式安定経路として固定してよいか。
2. 消しゴムのリアルタイム焼き込みと undo 用 stroke 記録をどう両立するか。
3. `RenderTexture` レイヤーと `Container` 変形の責務をどう分けるか。
4. サムネイル生成を `thumbnail-system.js` に一本化し、DOM表示を `layer-panel-renderer.js` に限定できているか。
5. `settings-manager.js` の smoothing 設定を `stroke-renderer.js` に接続すべきか。
6. 旧 WebGL2 / SDF / MSDF 系ファイルをいつ整理対象にするか。現フェーズでは安易に削除しないが、迷いの元になっています。

---

## コードを読む時の注意

- `GitHubURL.txt` は便利ですが、古いパスや typo が混じっている可能性があります。
- 存在しないURLを前提に判断しないでください。
- GitHub raw で読めない場合は、オーナーに該当ファイルを渡してもらうか、Codex にローカル調査を依頼してください。
- `tegaki_work/PROGRESS.md` には「修正済み」と書かれていても、オーナーの実機確認で未解決のものがあります。実機報告を優先してください。

---

## カラーパレット

```text
Maroon:   #800000  アクティブペン色
Stiletto: #9c3836
Contessa: #b8706b
Eunry:    #d4a8a1  パネル背景
Bizarre:  #f0e0d6  背景レイヤー0
Ivory:    #ffffee  ページ・キャンバス系背景
Accent:   #ff8c42  アクティブ強調
```

安易な黒・白・グレーへ逃げない。
アイコンは原則 `lucide-static` を使う。

---

## 新しいClaudeへの最初の返答例

新チャットでこのファイルを読んだら、まず次のように返してください。

```text
状況を把握しました。
現在の作業対象は tegaki_work、フェーズは Phase 1c です。
次に TEGAKI.md、tegaki_work/PROGRESS.md、GEMINI作業指示書.txt を読み、Geminiの次作業またはCodex調査結果の設計レビューから始めます。
```

---

## 直近の実務上の次手

1. Gemini に `GEMINI作業指示書.txt` を渡して追修正させる。
2. Gemini完了後、オーナーが実機で液タブ・消しゴム・サムネイル・高速線を確認する。
3. Codex がローカル差分を再調査する。
4. Claude が設計面から「このまま Phase 1c 完了でよいか」「Phase 1d に進む前に整理すべきか」を判断する。

---

*最終更新：2026-05-15*
