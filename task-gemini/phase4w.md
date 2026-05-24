# Phase 4w — Auto Capture / Auto-Key MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4u_report.md`
5. `task-gemini/phase4v_report.md`
6. `tegaki_work/system/drawing/brush-core.js`
7. `tegaki_work/system/animation/animation-data-model.js`
8. `tegaki_work/ui/animation-table-popup.js`

## 背景

Phase 4v で、タイムライン上の ClipInstance はドラッグ移動できるようになった。

現状、セル/クリップへ描画内容を入れるには、ユーザーが `CAPTURE` ボタンを押す必要がある。

次は、アニメ作画の手数を減らすため、選択中Clipに対して描画終了後の状態を自動でキャプチャする `AUTO` / `AUTO KEY` を追加する。

## 目的

アニメテーブルに `AUTO` トグルを追加し、ON の時だけ、描画ストローク完了後に選択中Clipへ自動で Snapshot / ClipAsset を更新する。

これは「描いたら選択Clipに反映される」最小MVPであり、本格的なClip内部編集モードではない。

## 基本仕様

- アニメテーブルのヘッダーに `AUTO` または `AUTO KEY` トグルを追加する。
- 初期値は OFF。
- ON の時だけ、`drawing:stroke-completed` を受けて自動キャプチャする。
- 選択中Clipがない場合は何もしない。
- 選択中ClipがフォルダLane上にある場合は何もしない。
- 描画された実レイヤーと選択Clipの `sourceLayerId` が一致する場合だけキャプチャする。
- `assetId` / `DrawingSnapshot` / `rasterSnapshot` 互換フィールドを更新する。
- キャプチャ後、必要なら `render()` してプレビュー表示を更新する。

## 重要な制限

このPhaseでは、対象は通常のペン/消しゴム等のストローク完了に限定する。

以下は後続扱い。

- バケツ塗り後の自動キャプチャ。
- レイヤー貼り付け/削除/変形後の自動キャプチャ。
- Undo/Redo と Auto Capture の統合。
- Clip内部レイヤー編集モード。
- Preview ON中に選択Clipを直接編集する本格対応。
- 描画開始時に自動で空セルを作る Auto-Key。

理由:

`drawing:stroke-completed` は `brush-core.js` から既に発火しているため安全に拾える。一方、バケツ・変形・貼り付け等はイベント経路が違い、今回まとめて拾うと誤キャプチャや履歴汚染を起こしやすい。

## 既存イベント

`tegaki_work/system/drawing/brush-core.js` ではストローク完了時に以下が発火している。

```js
this.eventBus.emit('drawing:stroke-completed', {
    component: 'drawing',
    action: 'stroke-completed',
    ...
});
```

このイベントを `AnimationTablePopup` 側で購読する。

## 実装方針

### 1. capture処理を内部メソッドへ分ける

現在 `captureSelectedCel()` はボタン用の公開メソッドとして使われている。

Phase 4wでは、ボタンと自動キャプチャの両方から使える内部メソッドへ分ける。

候補:

```js
captureSelectedCel(options = {}) {
    this._captureSelectedClip(options);
}

_captureSelectedClip(options = {}) {
    const { silent = false, requireSourceLayerId = null } = options;
    ...
}
```

`requireSourceLayerId` が渡された場合:

- 選択ClipのLaneに紐づく `sourceLayerId || layerId` と一致する時だけキャプチャする。
- 一致しない場合は何もしない。

### 2. 既存ClipAssetを更新できるようにする

現状の `CAPTURE` は毎回新しい `DrawingSnapshotModel` と `ClipAssetModel` を追加している。

Auto Capture では連続ストロークごとにアセットが増えすぎるため、以下に寄せる。

- 選択Clipに `assetId` があり、対応する `ClipAsset` があり、`drawingSnapshotId` がある場合:
  - 既存 `DrawingSnapshotModel` の `width` / `height` / `pixels` / `updatedAt` を更新する。
- 既存Assetがない場合:
  - 従来どおり `DrawingSnapshotModel` と `ClipAssetModel` を新規作成して `clip.assetId` に紐づける。

これにより、同じClipを描き直すたびにClipAssetが無限増殖しにくくなる。

注意:

- Copy/Pasteで同じ `assetId` を共有しているClipがある場合、その絵も同時に変わる。これは「アセット参照」の正しい挙動だが、今回のレポートに必ず明記する。
- 後で「インスタンスを独立化して編集」する機能が必要になる。

### 3. Texture cache の破棄

Snapshotを更新したら、古いTexture cacheを破棄する。

既存 `this._snapshotTextureCache` は Snapshot オブジェクトをキーにしている。

更新対象の snapshot に対応する texture がある場合:

```js
const oldTexture = this._snapshotTextureCache.get(snapshot);
if (oldTexture && !oldTexture.destroyed) {
    try { oldTexture.destroy(true); } catch (e) {}
}
this._snapshotTextureCache.delete(snapshot);
```

これをしないと、Auto Capture後も古い絵がプレビューに残る可能性がある。

### 4. AUTOトグル

`AnimationTablePopup` に状態を追加。

```js
this.isAutoCaptureActive = false;
```

ヘッダーの `PREVIEW` / `ONION` 付近にトグルを追加する。

候補:

```html
<label class="anim-preview-toggle" title="描画終了時に選択Clipへ自動キャプチャ">
  <input type="checkbox" id="anim-auto-capture-chk"> AUTO
</label>
```

change で `this.isAutoCaptureActive` を更新する。

### 5. drawing:stroke-completed を購読

`AnimationTablePopup` の初期化時に、以下を登録する。

```js
this.eventBus.on('drawing:stroke-completed', (data = {}) => {
    this._handleDrawingCompleted(data);
});
```

`_handleDrawingCompleted(data)` の条件:

- `this.isVisible` が true。
- `this.isAutoCaptureActive` が true。
- `this.selectedCelId` がある。
- `this.layerSystem` がある。
- 選択ClipのLaneが取得できる。
- 現在のアクティブ実レイヤーID、またはイベントpayload内のlayerIdが、選択Laneの `sourceLayerId || layerId` と一致する。

イベントpayloadに layerId がなければ、`layerSystem.getActiveLayerIndex()` と `getLayers()` からアクティブレイヤーIDを取ってよい。

一致確認後:

```js
this._captureSelectedClip({
    silent: true,
    requireSourceLayerId: activeLayerId
});
```

### 6. Preview ON中の扱い

現状、Preview ONでは管理対象実レイヤーが一時的に非表示になる。

Phase 4wでは、Preview ON中の描画体験まで解決しない。

安全策:

- Auto Capture は Preview ON/OFFに関係なく、アクティブ実レイヤーのSnapshotを取る。
- ただし実機で「Preview ON中に描いても見えない/描きにくい」場合は、レポートへ制限事項として書く。
- Preview ON中のClip内部編集UXは後続の `Clip Edit View` / `Virtual Layer Panel` で扱う。

## このPhaseでやらないこと

- 描画開始時に現在フレームへ自動でClipを作る。
- 空の現在フレームにAuto-Keyを打つ。
- バケツ塗りや貼り付けを拾う。
- Undo/Redoにアニメキャプチャ履歴を統合する。
- ClipAsset共有を自動で複製/独立化する。
- Clip内部レイヤー編集モード。
- Virtual Layer Panel。
- Preview ON中の本格的な編集導線整理。
- アニメ保存/読み込み形式の完成。

## 注意点

- `drawing:stroke-completed` のイベント名を変更しない。
- `brush-core.js` 側を無理に改修しない。イベントpayloadが足りなければ、まず `AnimationTablePopup` 側でアクティブレイヤーから解決する。
- `captureSelectedCel()` の既存手動ボタン挙動を壊さない。
- Snapshot更新時に Texture cache を破棄する。
- Auto Capture がOFFの時に勝手にキャプチャしない。
- 選択Clipと違う実レイヤーへ描いた時に誤キャプチャしない。
- `console.log` を残さない。
- `dist/` は作業対象にしない。

## 動作確認

最低限以下を確認する。

1. `npm.cmd run build` が成功する。
2. アニメテーブルに `AUTO` トグルが表示される。
3. AUTO OFF では、描画しても選択ClipのSnapshotは自動更新されない。
4. AUTO ON + 選択Clipあり + 対応レイヤーへ描画後、選択ClipにSnapshotが入る。
5. AUTO ON + 選択Clipなしでは何も起きない。
6. AUTO ON + 違う実レイヤーへ描いた場合、選択Clipは更新されない。
7. 手動 `CAPTURE` ボタンは従来通り動く。
8. COPY/PASTEで同じassetIdを共有したClipは、Auto Capture後に同じ絵を参照して表示される。
9. PREVIEW / ONION 表示がAuto Capture後に更新される。
10. 連続で数ストローク描いてもClipAssetが無制限に増えず、既存Snapshot更新が使われる。

## 完了条件

- [ ] `AUTO` / `AUTO KEY` トグルがある。
- [ ] `isAutoCaptureActive` 相当の状態がある。
- [ ] `drawing:stroke-completed` を購読している。
- [ ] 選択Clipと描画実レイヤーが一致した時だけ自動キャプチャする。
- [ ] 既存ClipAsset / DrawingSnapshot を更新できる。
- [ ] Texture cache を更新時に破棄している。
- [ ] 手動 `CAPTURE` が壊れていない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4w_report.md` を作成し、Auto Capture対象イベント・制限・ClipAsset共有時の挙動を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
