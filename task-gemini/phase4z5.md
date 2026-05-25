# Phase 4z5 — Initial ClipAsset Auto-Seed MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4z4_report.md`
5. `tegaki_work/system/animation/animation-data-model.js`
6. `tegaki_work/ui/animation-table-popup.js`
7. `tegaki_work/system/layer-system.js`

## 重要な注意

- 今回は「アニメモードへ入った時に、既存の描画状態をFrame 1 / Lane 1のClipAssetとして自動Seedする」MVPである。
- 背景レイヤーは共有のキャンバス下地であり、絵としての背景ではない。ClipAsset内部へコピーしない。
- 「絵としての背景」は、ユーザーが通常レイヤーとして描いたものだけをClipAsset対象にする。
- Asset Libraryの完成UI、Clip内部レイヤー本実装、Virtual Layer Panelは今回しない。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- `animation-table-popup.js` は肥大化しているため、テンプレート文字列やCSSブロックを崩さない。
- `npm.cmd run build` が失敗した場合、今回触った箇所を優先して確認し、関係ない修正に広げない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z4でAsset Libraryの骨格が見えるようになった。

次に必要なのは、1レーンだけでパラパラ漫画やストーリーボードを描く時、ユーザーがAsset LibraryやCAPTUREを意識しなくても自然にClipAsset化される導線である。

現在の理想:

- アニメテーブルを開いた時点で、Frame 1 / Lane 1 にClipInstanceがある。
- そのClipInstanceはClipAssetを参照する。
- 既に通常レイヤーに描かれている絵は、そのClipAssetのSnapshotとして反映される。
- 次のコマを描きたい時は、Frame 2をクリックすると新しいClipInstance / ClipAssetが作られ、そこで2コマ目を描ける。

ただし、背景レイヤーは扱いを分ける。

## 背景レイヤーの哲学

Tegakiの背景レイヤーは、見えやすくするためのツール側キャンバス下地である。

- 透明キャンバスを見やすくするための装置。
- Pixiの `backgroundGraphics` を持つ特殊レイヤー。
- ユーザーが意図して描いた「絵の背景」とは別物。

そのため、ClipAssetの内部描画データへは含めない。

将来「絵としての背景」を作りたい場合は、通常レイヤーで背景を描き、その通常レイヤー/ClipAssetとして扱う。

## 目的

アニメテーブル表示時、既存の通常レイヤー描画から最初のClipAssetを自動生成する。

目的は以下。

- アニメモード開始直後からFrame 1に絵が見える。
- 初回作業で `CAPTURE` を押す必要を減らす。
- 1レーンのパラパラ漫画/ストーリーボードを軽く始められる。
- 内部的にはClipAsset/ClipInstanceモデルへ寄せる。

## 今回やること

### 1. 初期Seed済みフラグ

`AnimationTablePopup` にセッション内フラグを追加する。

候補:

```js
this.initialClipAssetSeeded = false;
```

保存対象にしなくてよい。

### 2. アニメテーブル表示時に初期Seedを試す

`show()` 後、または初回 `render()` 前後で以下を実行する。

候補:

```js
this._ensureInitialClipAssetSeed();
```

条件:

- まだ `initialClipAssetSeeded` が false。
- `layerSystem` がある。
- `model.tracks` がLayerSystemと同期済み。
- Frame 0（表示上Frame 1）に、通常LaneのClipがまだない。
- 通常レイヤーが少なくとも1つある。

注意:

- 背景レイヤーとフォルダLaneは対象外。
- 既にユーザーがClipを配置している場合は勝手に追加しない。
- 既存データ読み込み時にClipがある場合も勝手に追加しない。

### 3. Seed対象Lane

MVPでは、最上位またはアクティブな通常Laneを1つ選ぶ。

推奨:

1. アクティブな通常レイヤーに対応するLane。
2. なければ最初に見つかる通常Lane。

通常Lane条件:

- `lane.type !== 'folder'`
- 対応するLayerが `!layerData.isBackground`
- 対応するLayerが `!layerData.isFolder`

### 4. 現在描画のSnapshot化

対象Laneに対応する実LayerからSnapshotを作る。

既存の `layerSystem.createLayerRasterSnapshot(layer)` があるなら使う。

候補:

```js
const snapshotData = this.layerSystem.createLayerRasterSnapshot(sourceLayer);
```

Snapshotが取れない場合は空Assetでよい。

### 5. ClipAsset / ClipInstance作成

Frame 0にClipを作る。

候補:

```js
const blankOrCaptured = ...
const asset = new ClipAssetModel(...)
const clip = lane.addCel({
    sourceLayerId: lane.sourceLayerId,
    layerId: lane.layerId,
    assetId: asset.id,
    startFrame: 0,
    duration: 1,
    rasterSnapshot: ...
});
```

ただし、既存 `createBlankClipAsset()` を使える場合は活用してよい。

CAPTURE済みに近い状態にする場合:

- `DrawingSnapshotModel.isBlank = false`
- `ClipAssetModel.drawingSnapshotId` を設定
- `clip.rasterSnapshot` 互換も設定

空レイヤーの場合:

- `isBlank = true`
- 白丸アイコンは出ない

### 6. 背景共有の扱い

初期Seed時に背景レイヤーをClipAssetへ含めない。

確認:

- `layerData.isBackground === true` は対象外。
- `backgroundGraphics` / `backgroundColor` はSnapshot化しない。

Preview合成時は、これまで通りツール背景や通常背景表示に任せる。

### 7. 次フレーム作成との関係

既存の空スロットクリックで新規ClipAssetを作る処理は維持する。

Frame 2をクリックした場合:

- 新規ClipInstance / ClipAssetが作られる。
- 最初は空Assetでよい。
- EDIT/AUTOやCAPTUREでそのFrameの絵が入る。

今回、Frame 2クリック時にFrame 1内容を自動コピーする必要はない。

### 8. Asset Library反映

初期Seedで作ったClipAssetはAsset Libraryに表示されること。

Asset名候補:

- `Frame 1 Asset`
- `${lane.name} Frame 1`

未分類でよい。

### 9. CAPTUREの扱い

初期Seedにより、Frame 1は「CAPTUREを押したような状態」に近くなる。

ただし、現行 `CAPTURE` ボタン自体は今回消さない。

将来、名称を `SNAPSHOT` / `UPDATE CLIP` 等へ変更する可能性があるが、今回は触らない。

## 今回やらないこと

- ClipAsset内部レイヤーの実装。
- 複数通常レイヤーを1つのClipAsset内部レイヤーとして保存する処理。
- Frame 2作成時に前Frameを複製する機能。
- 背景レイヤーをClipAssetへ含めること。
- Asset LibraryでのD&D配置。
- Asset/Folderリネーム・削除UI。
- Virtual Layer Panel。
- レイヤーパネル切替。
- CAPTURE/AUTO/EDITの正式整理。

## 将来メモ

最終形では、ClipAssetは内部レイヤー構造を持つ。

その時は、Frame 1のClipAsset内部に通常レイヤー相当の内部Layerが入り、ツール背景は共有背景として別扱いになる。

今回のMVPでは、内部レイヤー構造はまだ作らず、現在のSnapshot方式で「初期ClipAssetがある」状態だけを作る。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- アニメテーブルを開いた時、通常レイヤーに描画があればFrame 1 / 対象LaneにClipが自動作成される。
- そのClipはClipAssetを参照している。
- Preview ON時、Frame 1でその絵が表示される。
- 背景レイヤーはClipAssetへ含まれない。
- 既にFrame 1にClipがある場合、重複作成しない。
- フォルダLaneや背景LaneにClipを作らない。
- Asset Libraryに初期SeedされたAssetが表示される。
- 既存のPreview、ALL/LANE/SET、ONION、EDIT、AUTO、CAPTURE、UNIQUE、COPY/PASTE、D&D移動、Duration変更を壊さない。
- `dist/` の差分を成果物に含めない。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z5_report.md`

報告書には以下を必ず書く。

- 初期Seedの実行タイミング。
- Seed対象Laneの選び方。
- 背景レイヤーを除外した方法。
- 初期Assetの作成方法。
- 重複作成防止条件。
- Asset Libraryへの反映確認。
- 手元確認した操作。
- `npm.cmd run build` の結果。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z5 完了ログを追記する。

最低限、以下を書く。

- Phase 4z5 の目的。
- 変更ファイル。
- ビルド結果。
- 残った課題があれば、後続Phase向けに短く列挙。
