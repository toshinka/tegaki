# Phase 4p — ClipAsset 再利用MVP（セルコピー/ペースト）

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4o_report.md`
4. `task-gemini/phase4n_preview_scope_note.md`

## 目的

Phase 4o で、`DrawingSnapshotModel` / `ClipAssetModel` / `CelModel.assetId` / `TimelineModel.clipAssets` / `TimelineModel.drawingSnapshots` の足場ができた。

Phase 4p では、1つの `ClipAsset` を複数のセルから参照できることを確認するため、選択セルのコピー/ペーストMVPを作る。

ここでの目的は「同じ犬セルを別フレーム/別レーンへ置ける」ための最小実験。
大きなD&DやライブラリUIはまだ作らない。

## 実装方針

### 1. AnimationTablePopup内にコピー用バッファを持つ

`AnimationTablePopup` に、選択セルの参照情報を一時保持するバッファを追加する。

候補:

```js
this._copiedCelRef = null;
```

保持する情報:

- `assetId`
- `rasterSnapshot`（現行プレビュー互換用）
- `duration`

`ClipAsset` と `DrawingSnapshot` 自体は複製しない。
既存assetを参照するセルを作る。

### 2. Copy / Paste ボタンを追加する

アニメテーブルヘッダーに小さく以下を追加する。

- `COPY`
- `PASTE`

既存ヘッダーを大きく作り替えない。
アイコン化は後続でよい。

`COPY`:

- `selectedCelId` がある時だけ有効。
- 選択セルの `assetId` / `rasterSnapshot` / `duration` を `_copiedCelRef` に入れる。

`PASTE`:

- 貼り付け先は現在フレーム `model.playback.currentFrame` と現在アクティブトラックを基本にする。
- アクティブトラックがフォルダなら何もしない。
- すでにその範囲にセルがある場合は、上書きせず何もしない。
- 新しい `CelModel` を作成し、同じ `assetId` を参照させる。
- `rasterSnapshot` は互換プレビュー用に同じ参照を入れてよい。

### 3. キーボードショートカット

このPhaseでは、`Ctrl+C` / `Ctrl+V` は使わない。
既存のレイヤーコピー/貼り付けと衝突するため。

ボタン操作だけでよい。

### 4. プレビュー

貼り付けたセルは、元セルと同じ `assetId` / `rasterSnapshot` を参照するため、既存プレビューで同じ絵が表示されること。

プレビュー経路を `assetId -> DrawingSnapshot` へ本格移行するのは後続でよい。

### 5. 削除時の扱い

セルを削除しても、`ClipAsset` / `DrawingSnapshot` は削除しない。
参照カウントや未使用アセット掃除は後続。

## このPhaseでやらないこと

- セルD&D移動。
- Altドラッグコピー。
- 複数選択。
- ライブラリ/保管庫UI。
- `ClipAsset` の削除・GC。
- `assetId -> DrawingSnapshot` プレビューへの完全移行。
- 保存/ロードUI変更。
- Export。
- Solo/Mute。
- オニオンスキン。
- セルフォルダ / Virtual Layer Panel。

## 注意点

- `Ctrl+C` / `Ctrl+V` は既存レイヤー操作なので触らない。
- 既存のセル選択・削除・duration変更・Captureを退行させない。
- `rasterSnapshot._pixiTexture` のように Snapshot 本体へ Pixi Texture を混ぜない。
- `animation-table-popup.js` のテンプレート文字列・CSS注入ブロックを壊さない。
- ビルド後に `dist/` の生成物が差分化しても、コミット対象にしない。

## 完了条件

- [ ] 選択セルを `COPY` できる。
- [ ] 現在フレーム/アクティブトラックへ `PASTE` できる。
- [ ] 貼り付けセルは元セルと同じ `assetId` を参照する。
- [ ] 貼り付けセルは既存プレビューで同じ絵として表示される。
- [ ] 既存セルと重なる場所には貼り付けない。
- [ ] フォルダトラックには貼り付けない。
- [ ] セル削除で `ClipAsset` / `DrawingSnapshot` を消さない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4p_report.md` を作成し、再利用できた範囲と残課題を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
