# Gemini CLI 設定ファイル

> Gemini CLI が作業開始時に読む運用ルール。
> 技術方針の正本は `TEGAKI.md`。このファイルは「Gemini が何をどの順で読み、どこを作業し、どう報告するか」を定める。

---

## 作業開始前に必ず読むこと

1. `TEGAKI.md`  
   プロジェクト全体の方針、技術スタック、禁止事項、AI作業規律。

2. `tegaki_work/PROGRESS.md`  
   直近の作業状況、既知バグ、残タスク。古い `tegaki_phase1a` 表記が残っていても、現行作業対象は `tegaki_work/` と読み替える。

3. 今回の作業指示  
   作業の種類に応じて、以下のどちらかを読む。

---

## 作業指示ファイルの使い分け

### 大きい目的のある改修

大きいフェーズ、構造変更、機能追加、複数ファイルにまたがる改修では、`task-gemini/` 内の phase ファイルを使う。

例：

```text
task-gemini/phase1a.md
task-gemini/phase1b.md
task-gemini/phase1c.md
task-gemini/phase1d.md
task-gemini/phase1e.md
task-gemini/phase1f.md
task-gemini/phase1g.md
task-gemini/phase1h.md
task-gemini/phase1i.md
task-gemini/phase1j.md
task-gemini/phase1k.md
task-gemini/phase1l.md
task-gemini/phase1m.md
task-gemini/phase2.md
```

ルール：

- オーナーから指定された phase ファイルだけを読む。
- 指定されていない将来 phase を先読みして実装へ混ぜない。
- phase ファイルは「大きい目的・設計範囲・完了条件」を定めるものとして扱う。

### 細かい不具合修正・追修正

特定バグの切り分け、直近修正のやり直し、狭い範囲の修正では、ルートの `GEMINI作業指示書.txt` を使う。

ルール：

- `GEMINI作業指示書.txt` が今回の指示として渡された場合は、これを最優先する。
- 指示書は「現在の症状・原因候補・対象ファイル・受け入れ条件」を定める短期作業票として扱う。
- 指示書の内容が `TEGAKI.md` と矛盾する場合は、実装前にオーナーへ確認する。

---

## 現在の基本作業対象

```text
tegaki_work/
```

`PastFiles/` と `tegaki_phase0/` は参照・保存用。通常作業では編集しない。

ルート直下へ作業ログやコンソールログを新規作成しない。最新状態は `tegaki_work/` 内へ置く。

```text
tegaki_work/PROGRESS.md
tegaki_work/GitHubURL.txt
tegaki_work/TegakiConsole.txt
```

---

## Gemini の役割

Gemini は実装担当。

- `tegaki_work/` のファイル編集
- ビルド確認
- ブラウザ動作確認
- エラー修正
- `tegaki_work/PROGRESS.md` 更新

Claude と Codex は設計・調査・レビューの頭として並走する。
Claude は主に設計判断と GitHub 経由レビュー、Codex はローカル実ファイル調査と原因切り分けを担当する。

Gemini は、Claude / Codex から渡された指示書に従って実装する。
ただし、指示が現行コードや `TEGAKI.md` と矛盾する場合は、勝手に解釈して進めず、オーナーへ確認する。

---

## 実装前チェック

作業前に必ず行う。

1. 既存実装検索  
   新規クラス・関数・イベントを作る前に `rg` で同じ責務の既存実装を探す。

2. 対象ファイルのヘッダー確認  
   責務、依存、被依存、イベント、グローバル登録を読む。

3. EventBus 契約確認  
   `emit` / `on` を変更する前に、同じイベント名を全検索する。payload 形式を混在させない。

4. 設定値の参照元確認  
   色、サイズ、解像度、ブラシ補正、しきい値は `config.js`、settings、既存定数を優先する。

5. 受け入れ条件確認  
   何ができたら完了かを作業前に把握する。不明な場合はオーナーへ確認する。

## 破壊的編集の禁止

過去に `layer-panel-renderer.js` を丸ごと短縮版で上書きし、起動不能になった事故がある。再発防止として以下を守る。

- 既存 JS ファイルを `write_file` 相当で丸ごと置き換えない。編集は差分単位に限定する。
- 100 行を超える削除、主要クラスの再構成、DOM 構造の大幅置換は、実装前に Codex / オーナー判断へ戻す。
- 棚卸しや小修正の指示で、`timeline-ui.js`、`album-popup.js`、`dom-builder.js`、`ui-icons.js` など対象外ファイルへ作業範囲を広げない。
- UI 共通化の名目で、動作中のインラインスタイルや既存ロジックを一括で CSS へ移さない。
- `npm.cmd run build` が失敗した場合は、原因を 1 件に絞って報告する。推測で複数ファイルを連鎖修正しない。
- 作業後の差分で、指示対象外ファイルが含まれていたら、実装継続せず理由を報告する。

---

## 作業後のルール

- `npm.cmd run build` または `npm.cmd run dev` で確認する。
- 可能な範囲でブラウザ動作確認を行う。
- `tegaki_work/PROGRESS.md` を更新する。
- 変更ファイル、変更理由、確認コマンド、ブラウザ確認結果、残った問題を書く。
- Claude / Codex へ判断してほしい点があれば「Claudeへ」または「Codexへ」として記録する。
- 調査用 `console.log` は確認後に削除する。残す場合は目的と削除条件を書く。
- `dist/` などビルド生成物を、成果物として必要ない作業で差分に残さない。

---

## 大きな変更の前

以下に該当する場合は、実装前に方針を説明し、オーナーの確認を取る。

- 描画パイプラインを変える
- レイヤー構造を変える
- EventBus の主要 payload を変える
- 既存 API を削除する
- WebGL2 / SDF / MSDF 系の古いファイルを削除・大整理する
- Phase 1c で WebGPU / SDF / MSDF 系の描画・塗りつぶし経路を復活させる
- `TEGAKI.md` の禁止事項に触れる可能性がある

---

## このプロジェクトについて

オーナーはコーディング非経験者。
実装判断・コード生成・動作確認は Gemini が担うが、設計の相談・点検・行き詰まった判断は Claude / Codex と連携する。

目的は、ブラウザで動く液タブ向けのお絵かきツールを、可読性と保守性を保ちながら段階的に完成させること。
