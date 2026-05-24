# Phase 4t — Animation Onion Skin MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4q.md`
5. `task-gemini/phase4q_report.md`
6. `task-gemini/phase4s_report.md`
7. `tegaki_work/ui/animation-table-popup.js`
8. `tegaki_work/system/animation/animation-data-model.js`

## 背景

Phase 4q で、プレビュー参照元は `assetId -> ClipAsset -> DrawingSnapshot` を正本に寄った。

Phase 4s で、通常アルバムは IndexedDB 正本になり、容量面の不安が減った。

保存系の寄り道は一区切りなので、アニメ制作支援へ戻る。

次は、現在フレームの前後を薄く表示する Onion Skin を追加する。これは自動キャプチャやLane化より前でも価値があり、既存の `animationPreviewContainer` と `getSnapshotForCel()` を使って小さく実装できる。

## 目的

アニメテーブルの PREVIEW 表示に、前後フレームの Snapshot を薄く重ねる Onion Skin MVP を追加する。

目的は「描き分け中に前後の動きを見ながら作業できる」こと。

## 基本仕様

- アニメテーブルのヘッダーに `ONION` トグルを追加する。
- 初期値は OFF。
- PREVIEW が OFF の場合、ONION は表示しない。
- 再生中は Onion Skin を表示しない。
- 現在フレームは従来通り通常表示。
- 前フレームは薄く表示。
- 次フレームも薄く表示。
- 前後フレームに Snapshot が無い場合は何も出さない。
- 実レイヤーの RenderTexture / visible / layerData は汚染しない。

## 表示方針

### Frame Composite Preview 時

フレームヘッダークリック、左右キー移動、選択解除状態では、現在フレームの全セル合成が正本。

この時の Onion Skin は以下。

- `currentFrame - 1` の全セル合成を薄く表示。
- `currentFrame + 1` の全セル合成を薄く表示。
- その上に現在フレームの全セル合成を通常表示。

表示順:

1. previous onion
2. next onion
3. current frame composite

### Selected Cel / Clip Solo Preview 時

セル選択中は、Phase 4n補足どおり選択セルだけを表示する。

この時の Onion Skin は、MVPでは「同じ track 上の前後セル」だけを対象にする。

- 選択セルの track を取得。
- 現在フレーム基準で `currentFrame - 1` / `currentFrame + 1` のセルを同じ track から探す。
- 見つかれば薄く表示。
- その上に選択セルを通常表示。

理由:

- セル編集中に全レーン合成の onion を出すと、編集対象を見失いやすい。
- 後続の Solo/Mute / Lane 化までは、選択 track 限定が安全。

## 実装方針

### 1. 状態を追加

`AnimationTablePopup` に以下を追加。

```js
this.isOnionSkinActive = false;
this.onionSkinPrevAlpha = 0.30;
this.onionSkinNextAlpha = 0.25;
```

色味を付ける場合は、前フレームを青系、次フレームを赤系などにしてよい。

候補:

```js
this.onionSkinPrevTint = 0x4f8cff;
this.onionSkinNextTint = 0xff8c42;
```

ただし tint が描画の見え方を悪くする場合は、alpha だけでもよい。

### 2. Header UI を追加

`PREVIEW` トグル付近に `ONION` checkbox を追加する。

候補:

```html
<label class="anim-preview-toggle" title="前後フレームを薄く表示">
  <input type="checkbox" id="anim-onion-chk"> ONION
</label>
```

ONION の change で `this.isOnionSkinActive` を更新し、`this.render()` を呼ぶ。

### 3. プレビュー描画を小さく分割する

現在の `_applyVisibilityPreview()` は現在フレームの合成表示を直接行っている。

Phase 4tでは、重複を避けるため以下の小メソッドへ分割する。

候補:

```js
_renderFrameComposite(frameIndex, layers, options = {})
_renderTrackCelAtFrame(track, frameIndex, layers, options = {})
_renderOnionSkins(currentFrame, layers)
```

`_renderCelPreview(track, cel, layers, options)` は既存利用し、`alpha` / `tint` / `isOnion` などを options で渡せるようにする。

例:

```js
this._renderCelPreview(track, cel, layers, {
  alpha: 0.3,
  tint: 0x4f8cff,
  allowSourceLayerFallback: false
});
```

`_renderCelPreview()` 側では、sourceLayer の opacity を継承した上で onion alpha を掛ける。

```js
const baseAlpha = sourceLayer?.layerData?.opacity ?? 1.0;
sprite.alpha = baseAlpha * (options.alpha ?? 1.0);
```

### 4. Snapshot 解決は getSnapshotForCel を使う

Onion Skin も必ず `this.model.getSnapshotForCel(cel)` 経由で表示する。

- `cel.rasterSnapshot` 直参照へ戻さない。
- Snapshot 本体へ Pixi Texture を混ぜない。
- 既存 `_snapshotTextureCache` を使う。

### 5. 再生中は出さない

`this.isPlaying` が true の間は Onion Skin を描画しない。

理由:

- 再生時は最終見えに近い Frame Composite Preview を優先する。
- Onion を出すと動き確認の邪魔になりやすい。

### 6. フレーム範囲外は無視

- `currentFrame - 1 < 0` の場合、previous は出さない。
- `currentFrame + 1 >= totalFrames` の場合、next は出さない。
- loop設定とは独立させる。MVPでは 1 と最終フレームをつなげない。

## このPhaseでやらないこと

- Onion Skin の詳細設定Popup。
- 前後2枚以上の複数枚 onion。
- Onion の色/濃度スライダー。
- レーン別 onion。
- Y軸方向の階層 onion / 近い階層ほど濃い表示。
- Solo/Mute。
- 自動キャプチャ。
- セルD&D移動。
- LaneModel化。
- Export への onion 反映。

## 注意点

- 実レイヤーを汚染しない。描画は `animationPreviewContainer` 上の一時 Sprite のみ。
- `animationPreviewContainer.removeChildren()` のタイミングを維持し、前回の onion が残らないようにする。
- `Snapshot` / `DrawingSnapshotModel` に Pixi Texture を生やさない。
- `Frame Composite Preview` と `Clip Solo Preview` の切り分けを壊さない。
- `animation-table-popup.js` のテンプレート文字列・CSS注入ブロックを壊さない。
- `dist/` の生成物は作業対象にしない。

## 動作確認

最低限以下を確認する。

1. ONION OFF では従来通りの表示。
2. ONION ON + PREVIEW ON で、現在フレームの前後フレームが薄く表示される。
3. フレーム1では previous が出ない。
4. 最終フレームでは next が出ない。
5. 再生中は Onion Skin が出ない。
6. セル選択中は、選択セルと同じ track の前後だけが薄く表示される。
7. PREVIEW OFF では Onion Skin も出ない。
8. 実レイヤーの表示状態が閉じる/preview off で復元される。

## 完了条件

- [ ] アニメテーブルに `ONION` トグルがある。
- [ ] ONION の状態が `AnimationTablePopup` 内で管理される。
- [ ] Frame Composite Preview 時に前後フレームが薄く表示される。
- [ ] Selected Cel 時は同一 track の前後セルだけが薄く表示される。
- [ ] 再生中は Onion Skin が表示されない。
- [ ] `getSnapshotForCel()` 経由で Snapshot を解決している。
- [ ] 実レイヤーを汚染しない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4t_report.md` を作成し、表示範囲・未実装設定・残課題を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
