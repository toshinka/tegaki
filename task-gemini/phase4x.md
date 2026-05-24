# Phase 4x — Clip Edit Mode MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4u_report.md`
5. `task-gemini/phase4v_report.md`
6. `task-gemini/phase4w_report.md`
7. `tegaki_work/system/animation/animation-data-model.js`
8. `tegaki_work/ui/animation-table-popup.js`

## 背景

Phase 4w で `AUTO` トグルが入り、描画終了時に選択ClipへSnapshotを自動更新できるようになった。

ただし現状は、`PREVIEW` ON のままアニメテーブルを開いて作画すると、管理対象の実レイヤーを一時的に非表示にし、プレビューContainer上のSnapshotを表示する構造になっている。

そのため、作画中は実レイヤーのライブ描画が見えにくく、ペンを離した瞬間にAuto CaptureされたSnapshotへ切り替わる体感になりやすい。

これはAuto Capture単体の問題ではなく、`Frame Composite Preview` と `Clip Edit View` がまだ同じ画面状態に混ざっていることが原因。

Phase 4xでは、いきなりVirtual Layer PanelやClip内部レイヤーへ進まず、まず「選択Clipを編集している時はPREVIEW合成を一時停止し、実レイヤーを普通に描ける」状態を作る。

## 目的

選択Clipを編集するための `EDIT` モードMVPを追加する。

目的は以下。

- 作画中は実レイヤーのライブ描画をそのまま見えるようにする。
- AUTO Capture と組み合わせて、ペンを離したら選択ClipのSnapshotへ反映する。
- PREVIEW合成確認とClip編集状態を明確に分ける。
- 将来の Clip内部レイヤー / Virtual Layer Panel へ進むための足場を作る。

## 基本仕様

- アニメテーブルのヘッダーに `EDIT` トグルまたはボタンを追加する。
- 初期値は OFF。
- 選択Clipがある時だけ `EDIT` に入れる。
- `EDIT` ON 中は、タイムラインPreview Containerによる合成表示を一時停止する。
- `EDIT` ON 中は、実レイヤーの visibility を復元し、通常描画が見える状態にする。
- `AUTO` ON の場合、描画終了時に選択ClipへSnapshotを更新する。
- `EDIT` OFF に戻したら、ユーザーが元々 `PREVIEW` ON にしていた場合はPreview表示へ戻す。
- 再生中に `EDIT` に入る場合は再生を停止する。

## 用語

- `Frame Composite Preview`
  - 現在フレーム上の全ClipをプレビューContainerで合成して見る状態。
  - 再生、左右キー、フレームヘッダークリック時の標準表示。

- `Clip Edit Mode`
  - 選択Clipに対応する実レイヤーを通常描画し、その結果をAuto Captureや手動CaptureでClipAssetへ反映する暫定編集状態。
  - このPhaseでは、まだClipAsset内部レイヤーは作らない。

## 実装方針

### 1. 状態を追加

`AnimationTablePopup` に以下を追加する。

```js
this.isClipEditModeActive = false;
this._previewBeforeClipEdit = null;
```

`_previewBeforeClipEdit` は、EDIT開始前にPREVIEWがONだったかどうかを覚えるために使う。

### 2. EDIT UI を追加

ヘッダーの `AUTO` 付近に `EDIT` ボタンまたはチェックボックスを追加する。

候補:

```html
<label class="anim-preview-toggle" title="選択Clipを実レイヤーで編集">
  <input type="checkbox" id="anim-clip-edit-chk" ${this.isClipEditModeActive ? 'checked' : ''}> EDIT
</label>
```

選択Clipがない時は disabled 表示にしてよい。

### 3. EDIT開始/終了メソッドを作る

候補:

```js
enterClipEditMode()
exitClipEditMode(options = {})
```

`enterClipEditMode()`:

- `selectedCelId` がない場合は何もしない。
- `model.findClipEntry(selectedCelId)` が取れない場合は何もしない。
- 再生中なら停止する。
- `_previewBeforeClipEdit = this.isPreviewActive` を保存する。
- `isClipEditModeActive = true`。
- `_restoreVisibility()` を呼び、プレビューContainerを空にして実レイヤー表示を戻す。
- 必要なら `render()` する。

`exitClipEditMode()`:

- `isClipEditModeActive = false`。
- `_previewBeforeClipEdit` が true なら、`isPreviewActive = true` のまま `render()` でPreviewを戻す。
- `_previewBeforeClipEdit` が false なら、PreviewはOFFのままにする。
- `_previewBeforeClipEdit = null`。

注意:

- `isPreviewActive` 自体を勝手に false へ書き換えるかどうかは慎重にする。
- UI上のPREVIEWチェック状態と内部状態がズレないようにする。
- 簡単にするなら、EDIT開始時に `isPreviewActive` は保持したまま、`render()` 内で `isClipEditModeActive` の時だけ `_applyVisibilityPreview()` を呼ばない実装でもよい。

### 4. render内のPreview適用条件を分ける

現状:

```js
if (this.isPreviewActive) {
    this._applyVisibilityPreview();
} else {
    this._restoreVisibility();
}
```

候補:

```js
if (this.isClipEditModeActive) {
    this._restoreVisibility();
} else if (this.isPreviewActive) {
    this._applyVisibilityPreview();
} else {
    this._restoreVisibility();
}
```

これにより、EDIT中はPREVIEWチェックがONでも実レイヤー描画を優先できる。

### 5. 選択Clip変更時の扱い

Clip選択が変わった時:

- EDIT中であれば、編集対象が変わったことを許可してよい。
- ただしフォルダLaneや存在しないClipになった場合はEDITを解除する。

フレームヘッダークリックや左右キーで `selectedCelId = null` になる場合:

- EDIT中なら `exitClipEditMode()` する。

セル削除で選択Clipが消えた場合:

- EDIT中なら `exitClipEditMode()` する。

### 6. 実レイヤー選択同期はMVPでは任意

理想は、EDIT開始時に選択Clipの `sourceLayerId` に対応する実レイヤーをアクティブ化すること。

ただし `LayerSystem` の安全な公開メソッドが不明な場合、このPhaseでは無理に実装しない。

実装する場合:

- まず `rg` で `setActiveLayer` / `activateLayer` / `selectLayer` 等を検索する。
- 既存の安全なメソッドがある場合だけ使う。
- 無理に `activeIndex` を直接書き換えない。

MVPでは、Auto Capture側の既存ガードにより、選択ClipのLaneと描画実レイヤーが一致した時だけ更新されればよい。

### 7. AUTOとの関係

EDITとAUTOは別トグル。

- EDIT ON + AUTO ON:
  - 作画中は実レイヤーが見える。
  - ペンを離すと選択Clipへ自動キャプチャされる。
- EDIT ON + AUTO OFF:
  - 作画は見える。
  - ユーザーが手動 `CAPTURE` した時だけClipへ反映する。
- EDIT OFF + PREVIEW ON:
  - 従来通りFrame Composite Preview / Clip Solo Preview。

### 8. 視覚表示

EDIT中であることが分かるように、以下のどちらかを入れる。

- `EDIT` トグルを強調表示。
- パネルヘッダーへ `.editing` クラスを付ける。
- 選択Clipへ `editing` クラスを追加する。

MVPでは大きなデザイン変更は不要。

## このPhaseでやらないこと

- ClipAsset内部レイヤー構造の実装。
- Virtual Layer Panel。
- Frame番号クリック時のセルフォルダ表示。
- Preview ON中に全体合成を見ながら同時にClip内部を直接編集する高度UX。
- バケツ/貼り付け/変形のAuto Capture対応。
- Undo/Redoへのアニメ操作統合。
- タイムラインD&Dのペン操作改善。
- durationハンドル大型化。
- 複数Clip選択。
- Assetユニーク化。

## 注意点

- `PREVIEW` の状態と `EDIT` の状態がUI上で矛盾しないようにする。
- EDIT解除後、元々PREVIEW ONだった場合はPreviewへ戻れること。
- EDIT中にプレビューContainerの古いSpriteが残らないよう `_restoreVisibility()` を呼ぶ。
- `drawing:stroke-completed` のイベント名や `brush-core.js` を変更しない。
- `console.log` を残さない。
- `dist/` は作業対象にしない。
- `animation-table-popup.js` のテンプレート文字列、CSS注入ブロックの閉じ忘れに注意する。

## 動作確認

最低限以下を確認する。

1. `npm.cmd run build` が成功する。
2. アニメテーブルに `EDIT` が表示される。
3. 選択Clipがない時はEDITに入れない、または入っても即解除される。
4. PREVIEW ON中にEDIT ONへ入ると、実レイヤー描画が見える状態になる。
5. EDIT ON + AUTO ONで描画すると、ペンを離した後に選択ClipのSnapshotが更新される。
6. EDIT ON + AUTO OFFでは、描画後に自動更新されず、手動CAPTUREで更新できる。
7. EDIT OFFに戻すと、元々PREVIEW ONだった場合はPreview表示へ戻る。
8. フレームヘッダークリックなどで選択解除した場合、EDIT状態が解除される。
9. 再生中にEDITへ入る場合、再生が停止する。
10. PREVIEW / ONION / AUTO の既存挙動が壊れていない。

## 完了条件

- [ ] `EDIT` UIがある。
- [ ] `isClipEditModeActive` 相当の状態がある。
- [ ] EDIT中は `_applyVisibilityPreview()` ではなく実レイヤー表示が優先される。
- [ ] EDIT解除後にPREVIEW状態が復帰する。
- [ ] EDIT + AUTO の組み合わせで選択ClipへSnapshot更新できる。
- [ ] 選択解除やClip削除時にEDITが残留しない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4x_report.md` を作成し、PREVIEW/EDIT/AUTOの関係、未対応のVirtual Layer Panel、残る入力UX課題を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
