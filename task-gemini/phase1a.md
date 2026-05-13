# Phase 1a — Vite環境構築・起動確認

> **このフェーズでやること：Viteを入れて起動できる状態にするだけ。**
> 描画の改善・バグ修正・リファクタは一切やらない。

---

## 完了条件

- [ ] `vite dev` を実行するとブラウザが開く
- [ ] キャンバスが表示される
- [ ] ペンで線が引ける（消しゴムバグはこのフェーズでは無視）
- [ ] コンソールに致命的エラーがない状態

これが確認できたらフェーズ完了。PROGRESS.mdを更新してオーナーに報告する。

---

## 作業手順

### Step 1：Vite環境を作る

`tegaki_phase1a` フォルダの中で以下を実行：

```bash
npm create vite@latest . -- --template vanilla
npm install
npm install pixi.js@8.17.0 perfect-freehand gsap
```

`npm create vite` で上書き確認が出たら「既存ファイルを残す」を選ぶこと。

### Step 2：index.htmlを修正する

viteのデフォルトindex.htmlではなく、既存の `index.html` をベースにする。
`<script>` タグの読み込みを `type="module"` 形式に変換する。

```html
<!-- 変更前（旧方式） -->
<script src="config.js"></script>
<script src="system/event-bus.js"></script>

<!-- 変更後（ESM方式） -->
<script type="module" src="core-initializer.js"></script>
```

エントリポイントは `core-initializer.js` 1本だけにする。

### Step 3：ファイルをESM形式に変換する

各ファイルの先頭に `export` を追加し、使う側で `import` する形に変換する。
**全ファイルを一度に変換しようとしない。** 依存関係の順番通りに進める：

1. `system/event-bus.js`
2. `config.js`
3. `coordinate-system.js`
4. `system/data-models.js`
5. 以降はcore-initializer.jsが要求するものを順次対応

エラーが出たら1ファイルずつ確認しながら進める。

### Step 4：起動確認

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開いてキャンバスが表示されることを確認。

---

## やってはいけないこと

- ペン・消しゴムの動作改善（次フェーズ）
- WebGL2の初期化順序の変更（次フェーズ）
- PixiJSのバージョン変更以外の機能追加
- perfect-freehandの組み込み（次フェーズ）
- ファイルの削除・統合（次フェーズ）
- `tegaki_phase0` フォルダへの一切の変更

---

## エラーが出た場合

- コンソールエラーはStack Traceの上位3〜5行だけを見る
- `Cannot find module` 系 → importパスの確認
- `is not a constructor` 系 → export形式の確認
- PixiJS関連エラー → v8.17.0のAPIドキュメントを確認（v7のAPIを混入させない）
- 解決できない場合はPROGRESS.mdにエラー内容を記録してClaudeに相談

---

## 完了時のPROGRESS.md更新内容

```
### YYYY-MM-DD Phase1a完了
- Vite環境構築完了
- 起動確認OK（vite dev → http://localhost:5173）
- 変換したファイル一覧：〇〇
- 残課題：〇〇
- 次フェーズ：phase1b（キャンバス・初期化整理）
```
