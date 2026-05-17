# Phase 1k — UI部品・アイコン共通化

> Phase 1j で構造マップと小UI補修は完了扱い。
> Phase 1k は新機能追加ではなく、閉じる/削除/複製/ダウンロードなどの小アイコンとボタン見た目を、AI が迷わず再利用できる形へ整理する。

---

## 作業対象

```text
tegaki_work/
```

`PastFiles/` と `tegaki_phase0/` は参照のみ。通常作業では編集しない。
`dist/` は成果物として必要ない限り差分に残さない。

---

## 前提

- 標準描画は PixiJS v8.17.0 + RenderTexture へのライブラスター焼き込み。
- Phase 1k では描画、履歴、保存、レイヤー構造、アニメ本体の挙動を変えない。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路は凍結継続。削除も復活もしない。
- `animationSystem.init()` は有効化しない。
- 大規模リネーム、ファイル移動、EventBus payload 変更、UI全面再設計は行わない。

---

## 目的

1. SVGアイコン定義の置き場を明確にする。
2. close / trash / duplicate / download / upload など再利用頻度の高いアイコンを単一ソース化する。
3. `.ui-close-button` / `.ui-icon-button` / サイズ修飾子など、共通CSSで見た目を管理する。
4. popup、Qパネル、レイヤーパネル、アルバムカードなどで同じ意味のボタンが別デザインになる問題を減らす。
5. 次のレイヤー機能・アニメUI機能へ進む前に、小UIの増殖を抑える。

---

## 優先タスク

### 1. アイコン定義の整理方針

現状確認：

- `tegaki_work/ui/dom-builder.js` に `ICONS` がある。
- `layer-panel-renderer.js`、`album-popup.js`、`timeline-ui.js`、`quick-access-popup.js` などにも inline SVG が残っている。

初回作業で行うこと：

- 新規候補 `tegaki_work/ui/ui-icons.js` を作るか、既存 `DOMBuilder.ICONS` を短期の正本にするかを判断する。
- 判断基準：
  - 低リスクで移せるなら `ui-icons.js` を作る。
  - import 連鎖や初期化順に不安があるなら、Phase 1k 初回では `DOMBuilder.ICONS` を正本として明記し、次回移行候補にする。

推奨：

- `ui-icons.js` を作り、`export const UI_ICONS = { ... }` と `export function getIcon(name)` 程度の薄い入口にする。
- ただし全アイコンを一気に移さない。まず close / trash / duplicate / download / upload / plus / folder 程度に限定する。

### 2. 共通ボタンクラス整理

現状の土台：

- `.ui-close-button`
- `.ui-close-button--small`
- `.ui-close-button--medium`
- `.popup-close-btn`
- `.quick-access-close-btn`
- `.layer-delete-button`

初回作業で行うこと：

- close 系は上記クラスを維持しつつ、重複CSSがないか確認する。
- 汎用アイコンボタン用に `.ui-icon-button`、`.ui-icon-button--small`、`.ui-icon-button--medium` を追加するか検討する。
- 既存の挙動を変えずに、見た目だけを共通化する。

注意：

- レイヤー削除ボタンは小さく、popup閉じボタンは中サイズ。サイズ差は残してよい。
- テキスト付きボタンを無理にアイコン化しない。
- カードやpopupのレイアウトを大きく変えない。

### 3. 低リスク移行対象

優先して見てよいファイル：

- `tegaki_work/ui/dom-builder.js`
- `tegaki_work/ui/ui-panels.js`
- `tegaki_work/ui/layer-panel-renderer.js`
- `tegaki_work/ui/quick-access-popup.js`
- `tegaki_work/ui/album-popup.js`
- `tegaki_work/styles/main.css`

低リスクなら移行してよいもの：

- close SVG
- trash SVG
- duplicate SVG
- download/upload SVG
- plus/folder SVG

一旦触らないもの：

- `timeline-ui.js` の旧アニメUI内 inline SVG。現行方針ではアニメ本体が未接続で、後続の動画ツール風UIへ作り直す可能性が高いため。
- WebGPU / SDF / MSDF / WebGL2 関連。
- 描画ロジック、履歴ロジック、保存フォーマット。

### 4. ドキュメント更新

作業後に更新する：

- `tegaki_work/PROGRESS.md`
- 必要なら `tegaki_work/ARCHITECTURE.md`
- 必要なら `tegaki_work/NOTES.md`

記録すること：

- アイコン定義の正本をどこにしたか。
- どのファイルの inline SVG を共通化したか。
- 故意に残した inline SVG と、その理由。
- build 結果。
- ブラウザで確認した UI。

---

## 完了条件

- `npm.cmd run build` が成功する。
- popup / Qパネル / レイヤーパネルの close/delete 系が同じ close SVG を使っている。
- close/delete の見た目が small / medium のサイズ差だけで管理されている。
- 新しいアイコン追加時に「どこへ足すべきか」が `ARCHITECTURE.md` または `PROGRESS.md` から分かる。
- `dist/` 差分を成果物として残さない。

---

## Codex判断へ戻す条件

- import 循環や初期化順の問題で `ui-icons.js` 化が不安定になる。
- `timeline-ui.js` や旧アニメUIの全面整理が必要になる。
- DOM構造の大幅変更が必要になる。
- CSSの全面再設計が必要になる。
- ボタン操作の挙動変更が必要になる。
