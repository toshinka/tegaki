# Phase 4y — Clip Asset Make Unique MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4w_report.md`
5. `task-gemini/phase4x_report.md`
6. `tegaki_work/system/animation/animation-data-model.js`
7. `tegaki_work/ui/animation-table-popup.js`

## 背景

Phase 4w / 4x で、選択ClipをEDITし、AUTOまたは手動CAPTUREでClipAssetへ描画内容を反映できるようになった。

一方で、COPY / PASTE は同じ `assetId` を共有する設計になっている。

これは「同じ絵を複数の場所で使い回す」には正しいが、貼り付けた片方だけを描き替えたい時に、共有元まで一緒に変わる。

アニメ制作では以下の両方が必要。

- 同じ素材を参照するインスタンス。
- このセルだけ独立した素材にして描き替える操作。

Phase 4y では、選択Clipの参照Assetを複製して独立化する `UNIQUE` 機能を追加する。

## 目的

選択Clipだけを共有Assetから切り離し、独立した `ClipAsset` / `DrawingSnapshot` を持たせる。

目的は以下。

- COPY / PASTE後に、片方だけ描き替えられるようにする。
- AUTO + EDIT で誤って共有Asset全体を更新する事故を減らす。
- 将来のアセットライブラリUIへ向けて「参照」と「独立化」の概念を明確にする。

## 基本仕様

- アニメテーブルヘッダーに `UNIQUE` ボタンを追加する。
- 選択Clipがない場合は何もしない、またはdisabledにする。
- 選択Clipに `assetId` がない場合は何もしない、またはCAPTUREを促すだけにする。
- 選択Clipの `assetId` がある場合:
  - 参照先 `ClipAsset` を複製する。
  - 参照先 `DrawingSnapshot` がある場合は複製する。
  - 選択Clipの `assetId` を新しいClipAssetのIDへ差し替える。
  - `rasterSnapshot` 互換フィールドも新しいSnapshot相当へ更新する。
- 実レイヤーのRenderTextureや表示状態は変更しない。
- 独立化後は選択状態を維持する。
- Preview / Onion は独立化後の参照で表示される。

## 用語

- `Shared Asset`
  - 複数Clipが同じ `assetId` を参照している状態。

- `Make Unique`
  - 選択Clipだけ新しい `ClipAsset` / `DrawingSnapshot` を参照するようにする操作。

## 実装方針

### 1. TimelineModelに参照数ヘルパーを追加

`animation-data-model.js` に以下を追加する。

候補:

```js
countAssetReferences(assetId) {
    if (!assetId) return 0;
    let count = 0;
    for (const lane of this.tracks) {
        count += lane.cels.filter(clip => clip.assetId === assetId).length;
    }
    return count;
}

isAssetShared(assetId) {
    return this.countAssetReferences(assetId) > 1;
}
```

これはUI表示にも使える。

### 2. TimelineModelに複製メソッドを追加

`makeClipAssetUnique(clipId)` を追加する。

戻り値例:

```js
{ ok: true, clip, asset, snapshot, wasShared }
{ ok: false, reason: 'not-found' | 'no-asset' | 'asset-not-found' | 'snapshot-not-found' }
```

処理方針:

1. `findClipEntry(clipId)` で対象Clipを取得。
2. `clip.assetId` がなければ `no-asset`。
3. `getClipAsset(clip.assetId)` で元Asset取得。
4. 元Assetの `drawingSnapshotId` から元Snapshot取得。
5. 元Snapshotがある場合、新しい `DrawingSnapshotModel` を作る。
   - `width`
   - `height`
   - `pixels`
   - `createdAt`
   - `updatedAt`
6. 新しい `ClipAssetModel` を作る。
   - `name`: 元Asset名 + ` copy` など。
   - `type`
   - `drawingSnapshotId`: 新SnapshotのID。
   - `internalLayers`: 将来用。MVPでは浅いコピーでよいが、コメントで将来要注意と書く。
7. `this.drawingSnapshots.push(newSnapshot)`。
8. `this.clipAssets.push(newAsset)`。
9. `clip.assetId = newAsset.id`。
10. `clip.rasterSnapshot` 互換フィールドを新Snapshot相当に更新する。

注意:

- `pixels` は配列/TypedArrayを必ずコピーする。参照共有しない。
- 元Snapshotがない場合は、元Assetだけ複製しても表示できないため、MVPでは失敗扱いでよい。

### 3. rasterSnapshot互換フィールド

`clip.rasterSnapshot` は古い直接参照用の互換フィールド。

Make Unique後は、以下の形式で新しいオブジェクトを持たせる。

```js
clip.rasterSnapshot = {
    width: newSnapshot.width,
    height: newSnapshot.height,
    pixels: newSnapshot.pixels
};
```

`newSnapshot.pixels` が配列なら、ここもコピーしてよい。

### 4. Texture cache

Make Uniqueは新Snapshotを作るため、通常は既存cache破棄不要。

ただし、念のため選択Clipの旧 `rasterSnapshot` が `_snapshotTextureCache` にある場合は、破棄してよい。

`DrawingSnapshotModel` は新しいオブジェクトなので、プレビュー時は新Textureが生成される。

### 5. UIにUNIQUEボタン追加

`CAPTURE` / `COPY` / `PASTE` 付近に `UNIQUE` ボタンを追加する。

候補:

```html
<button id="anim-unique-btn" class="anim-action-btn" title="選択Clipだけ独立したAssetにする">UNIQUE</button>
```

クリック時:

```js
this.makeSelectedClipUnique();
```

### 6. UI状態

選択Clipがない場合はdisabledにしてよい。

さらに余力があれば、共有Assetかどうかを視覚表示する。

MVPで許可:

- 共有中のClipブロックに `.shared-asset` クラスを付ける。
- 小さなリンク風マークを表示する。

ただし、見た目変更は最小限でよい。今回の主目的は `UNIQUE` 操作。

### 7. AnimationTablePopupのメソッド

候補:

```js
makeSelectedClipUnique() {
    if (!this.selectedCelId) return;
    const result = this.model.makeClipAssetUnique(this.selectedCelId);
    if (!result.ok) return;
    this.selectedCelId = result.clip.id;
    this.render();
}
```

プレビュー中なら `render()` で表示更新する。

EDIT中なら、そのままEDIT状態を維持してよい。

## このPhaseでやらないこと

- アセットライブラリUI。
- 共有Asset一覧表示。
- 「このAssetを参照するClip一覧」表示。
- UNIQUEのUndo/Redo統合。
- 複数Clip一括UNIQUE。
- Altドラッグで自動UNIQUEコピー。
- Clip内部レイヤーのディープコピー。
- Virtual Layer Panel。
- 保存/読み込みの完全検証。

## 注意点

- `pixels` を参照共有しない。必ずコピーする。
- 元Assetを破壊しない。
- 他Clipの `assetId` を変更しない。
- 選択Clipの `assetId` だけ変更する。
- 手動CAPTURE / AUTO / EDIT の既存挙動を壊さない。
- `console.log` を残さない。
- `dist/` は作業対象にしない。
- `animation-table-popup.js` のテンプレート文字列・CSS注入ブロックの閉じ忘れに注意する。

## 動作確認

最低限以下を確認する。

1. `npm.cmd run build` が成功する。
2. `UNIQUE` ボタンが表示される。
3. ClipをCOPY/PASTEして同じAssetを共有できる。
4. 片方のClipを選択して `UNIQUE` を押すと、そのClipだけ新しい `assetId` になる。
5. UNIQUE後に選択ClipをEDIT + AUTOで描き替えても、共有元Clipの表示は変わらない。
6. UNIQUE前に描き替えると、共有Clipも同じ絵に変わることを確認する。
7. UNIQUE後も duration / startFrame / lane / selected状態が維持される。
8. PREVIEW / ONION / EDIT / AUTO が壊れていない。
9. 選択Clipがない状態でUNIQUEを押しても壊れない。
10. assetIdがないClipでUNIQUEを押しても壊れない。

## 完了条件

- [ ] `TimelineModel.countAssetReferences()` または同等の参照数ヘルパーがある。
- [ ] `TimelineModel.makeClipAssetUnique()` または同等の独立化メソッドがある。
- [ ] `UNIQUE` ボタンがある。
- [ ] 選択Clipだけ新しい `assetId` に差し替えられる。
- [ ] DrawingSnapshotの `pixels` が参照共有されない。
- [ ] UNIQUE後に選択Clipだけ描き替えられる。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4y_report.md` を作成し、共有Assetの挙動、UNIQUEの制限、未対応のUndo/RedoやAsset Libraryを書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
