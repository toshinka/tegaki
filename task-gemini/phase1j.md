# Phase 1j — AI向け構造整理と保守性マップ

> Phase 1i で Vパネル、反転、数値入力、レイヤー不透明度、コピー系の小型操作は概ね実装済み。
> Phase 1j は新機能を増やす前に、AI が読みやすく安全に改修できる土台を整える。

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
- レイヤーは `Container + Sprite(RenderTexture)`。
- `animationSystem.init()` は現行描画へ副作用が出るため使わない。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路は凍結継続。削除も復活もこのフェーズではしない。
- 無限キャンバス、囲い塗り、クリッピング、フォルダ、複数レイヤー選択などの本実装はしない。
- 大規模リネーム、ファイル移動、未接続ファイル削除は実装せず、提案と影響範囲の記録まで。

---

## 目的

1. AI が迷わないファイルツリー、責務、命名、依存関係の地図を作る。
2. ファイルヘッダーと実際の依存/EventBus/window登録のズレを直す。
3. 重複責務、古い命名、未接続ファイル、凍結ファイルを「今直す/後続/触らない」に分類する。
4. UI部品の閉じるボタンやレイヤーパネル操作など、低リスクな見た目不整合を棚卸しする。
5. 次の機能フェーズへ進む前に、Codex/Claude/Gemini が同じ構造認識を持てる状態にする。

---

## 優先タスク

### 1. 構造マップ作成

作成候補：

```text
tegaki_work/ARCHITECTURE.md
```

内容：

- 起動順序：`core-initializer.js` -> `core-engine.js` -> 各 system/ui。
- 描画経路：PointerEvent -> drawing/brush -> RenderTexture -> thumbnail/export/save。
- レイヤー経路：`layer-system.js`、`layer-transform.js`、`layer-panel-renderer.js`、`drawing-clipboard.js`。
- UI経路：`dom-builder.js`、`ui-panels.js`、各 popup、keyboard。
- 保存/出力経路：`project-manager.js`、`virtual-album.js`、`export-manager.js`、exporters。
- 凍結/参照扱い：WebGL2 / SDF / MSDF / animation 本体。
- 主要 EventBus 契約の一覧。payload は実コードから確認して書く。

注意：

- 推測で書かない。必ず `rg` と対象ファイル確認で裏を取る。
- 古い構想や `PastFiles` の内容を現行構造として書かない。
- 実装詳細を全部写すのではなく、AI が次に読むべき入口を示す。

### 2. ファイルヘッダー同期

優先対象：

- `tegaki_work/core-engine.js`
- `tegaki_work/system/layer-system.js`
- `tegaki_work/system/layer-transform.js`
- `tegaki_work/system/drawing/brush-core.js`
- `tegaki_work/system/drawing/drawing-engine.js`
- `tegaki_work/system/drawing/thumbnail-system.js`
- `tegaki_work/system/project-manager.js`
- `tegaki_work/system/export-manager.js`
- `tegaki_work/system/drawing-clipboard.js`
- `tegaki_work/ui/ui-panels.js`
- `tegaki_work/ui/layer-panel-renderer.js`
- `tegaki_work/ui/keyboard-handler.js`
- `tegaki_work/ui/dom-builder.js`

確認すること：

- 責務が現行実装と合っているか。
- 依存/被依存が大きくズレていないか。
- イベント発火/受信が古いままになっていないか。
- グローバル登録名が実コードと一致しているか。
- `ベクター`、`phase1a`、旧 `frame/cut` など、誤解を生む表記がないか。

実装してよいこと：

- コメント、ヘッダー、古い表記の修正。
- 明らかな typo、存在しないファイル名、存在しないイベント名の修正。

実装しないこと：

- 関数分割、イベント名変更、payload変更、ファイル移動、削除。

### 3. 命名・重複責務棚卸し

`PROGRESS.md` へ記録する分類：

- **今直せる**: コメント、ヘッダー、参照パス、古い表記。
- **Codex判断へ戻す**: ファイル移動、rename、責務分割、EventBus契約変更。
- **凍結維持**: WebGL2 / SDF / MSDF / animation 本体など、現行描画へ副作用が大きいもの。
- **後続機能フェーズ**: クリッピング、フォルダ、複数選択、囲い塗り、無限キャンバス。

見てほしい観点：

- `system/` と `ui/` に同じ操作責務が重複していないか。
- `window.*` 公開と ESM import が混在している箇所。
- `thumbnail`、`project`、`album`、`export` の責務境界。
- キーボードショートカットと UI ボタンの二重発火リスク。

### 4. 閉じるボタン・小UI棚卸し

オーナーメモ追加分のうち、Phase 1j では棚卸しまでを基本とする。

確認対象：

- レイヤーサムネイルの削除ボタンが見えないがクリック領域だけ残っている問題。
- popup の閉じるボタン有無、見た目、大/小サイズの統一候補。
- popup 外クリックで閉じる仕様と、明示 `X` ボタン追加の両立。
- レイヤー左右フリック削除、ピンチ操作などタッチ系要望の実装箇所候補。

実装してよいこと：

- 消えている削除ボタンの CSS 表示復旧など、明確で低リスクな見た目修正。
- 既存の閉じるボタン class がある場合の軽微な統一。

実装しないこと：

- 左右フリック削除。
- ピンチ操作。
- popup コンポーネントの大規模再設計。

### 5. Phase 1i 残件確認

短く確認する：

- V確定後サムネイルが即時更新されるか。
- V反転が即表示されるか。
- Shiftドラッグが拡縮/回転で排他になるか。
- History ステータスが破綻していないか。

問題が出た場合：

- 狭いバグなら直してよい。
- 原因が履歴/RenderTexture/座標に深く絡む場合は `PROGRESS.md` に戻す。

---

## 完了条件

- `tegaki_work/ARCHITECTURE.md` か同等の構造マップが作成されている。
- 主要ファイルのヘッダー/表記ズレが、低リスクな範囲で修正されている。
- 大規模リネーム/移動/削除候補が `PROGRESS.md` に分類されている。
- 閉じるボタン/レイヤー削除ボタン/タッチ系要望が、実装可否つきで整理されている。
- `npm.cmd run build` が成功する。
- 可能ならブラウザで起動と通常描画、Vパネル、サムネイル更新を確認する。
- `tegaki_work/PROGRESS.md` を更新する。

---

## PROGRESS 更新に書くこと

- 作成/更新したファイル。
- 構造マップの要点。
- ヘッダー同期したファイル。
- 今直した低リスク修正。
- Codex判断へ戻す候補。
- 実装しなかった要望と理由。
- `npm.cmd run build` 結果。
- ブラウザ確認結果。
- 残った問題。
