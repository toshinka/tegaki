# Phase 4u — Lane/ClipInstance 足場化MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4l_report.md`
4. `task-gemini/phase4n_preview_scope_note.md`
5. `task-gemini/phase4t_report.md`
6. `tegaki_work/system/animation/animation-data-model.js`
7. `tegaki_work/ui/animation-table-popup.js`

## 背景

Phase 4t までで、アニメテーブルは以下を持つようになった。

- セル配置
- duration 伸縮
- 再生ヘッド
- Preview Container による非破壊プレビュー
- ClipAsset / DrawingSnapshot 参照
- Copy / Paste
- Onion Skin

一方で、現状はまだ `TrackModel.layerId` が実レイヤーに直結しており、アニメテーブルのY軸が「レイヤーパネルの複製」のように見える。

長期方針は以下。

- タイムラインY軸は `Lane`。
- 時間軸上の配置物は `ClipInstance`。
- 描画正本は `ClipAsset`。
- `ClipAsset` は将来、内部レイヤー構造を持つ。
- レイヤーパネルは、通常ドキュメント表示と Clip 内部編集表示を将来切り替える。

Phase 4u では、見た目や操作を壊さず、コード上の足場を `Track = Layer` から `Lane + ClipInstance` へ一段寄せる。

## 目的

`TrackModel` / `CelModel` をいきなり全置換せず、互換を保ったまま以下の足場を入れる。

- `LaneModel` を導入する。
- `ClipInstanceModel` を導入する。
- 既存 `TrackModel` / `CelModel` は互換エイリアスとして残す。
- `layerId` 直結を `sourceLayerId` という暫定フィールドへ寄せる。
- UI側は内部的に `lane` / `clip` の名前を使い始める。
- 表示・操作の挙動は Phase 4t から変えない。

## 基本方針

### 1. 破壊的なリネームは禁止

このPhaseではファイル全体の大規模置換をしない。

やってよいこと:

- `LaneModel` / `ClipInstanceModel` クラス追加。
- `TrackModel extends LaneModel` / `CelModel extends ClipInstanceModel` のような互換構造。
- 既存 `tracks` / `cels` 配列名の維持。
- コメント・serialize・helper の拡張。
- UI内の局所変数を少しずつ `lane` / `clip` へ寄せる。

やらないこと:

- `tracks` を `lanes` へ全置換。
- `cels` を `clips` へ全置換。
- HTML/CSS の大規模組み替え。
- レイヤーパネルの仮想化。
- Clip内部レイヤー編集モード。

理由:

保存形式、UIイベント、既存テスト観点、Geminiの過去のテンプレート文字列事故を考えると、一括改称は危険。

### 2. 互換フィールドを残す

既存コードはまだ `track.layerId` と `cel.layerId` を参照している。

Phase 4u では以下のように互換を保つ。

- `LaneModel.sourceLayerId` を追加。
- `LaneModel.layerId` は互換 getter/setter または同期フィールドとして残す。
- `ClipInstanceModel.sourceLayerId` を追加。
- `ClipInstanceModel.layerId` は互換 getter/setter または同期フィールドとして残す。

推奨:

```js
this.sourceLayerId = options.sourceLayerId || options.layerId || null;
this.layerId = this.sourceLayerId; // backward compatibility
```

getter/setter にする場合は既存 serialize と代入が壊れないことを確認する。

### 3. serialize は互換形式を保つ

保存/読み込みの本格対応は後続だが、現時点の serialize は壊さない。

最低限、以下を含める。

- `sourceLayerId`
- `layerId` （互換）
- `assetId`
- `startFrame`
- `duration`
- `type`
- `name`
- `active`
- `cels`

将来用に `role` や `kind` を足す場合は任意。

### 4. syncWithLayers は「初期Lane同期」に格下げするコメントを強める

`TimelineModel.syncWithLayers()` はまだ必要。

ただし正本ではなく、現段階では通常レイヤーから暫定Laneを作る同期処理であることを明記する。

追加したい補助:

```js
getLaneForSourceLayer(sourceLayerId)
getLaneById(laneId)
getClipById(clipId)
findClipEntry(clipId)
```

既存 `AnimationTablePopup._findSelectedCelEntry()` は、可能なら `model.findClipEntry()` を使う。

### 5. UI表示名は小さく変更してよい

テーブル左上の `TRACKS` は `LANES` に変更してよい。

ただし CSS クラス名 `.anim-track-*` はこのPhaseでは維持してよい。

理由:

- CSS大規模改名は危険。
- 見た目上は「これはレイヤーではなくレーン」と伝わる方がよい。

### 6. フレーム/セル表示挙動は変えない

Phase 4t の挙動を維持する。

- フレームヘッダークリック/左右キー/再生: Frame Composite Preview。
- セルクリック: 選択セル単独表示。
- ONION: 現行通り。
- Snapshot 解決: `getSnapshotForCel()` 経由。
- Preview Container: 実レイヤー非破壊。

## 実装候補

### 1. `ClipInstanceModel` を追加

`CelModel` の実体を移す。

候補:

```js
export class ClipInstanceModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.sourceLayerId = options.sourceLayerId || options.layerId || null;
        this.layerId = this.sourceLayerId; // backward compatibility
        this.assetId = options.assetId || null;
        this.startFrame = options.startFrame || 0;
        this.duration = options.duration || 1;
        this.isKeyframe = options.isKeyframe !== false;
        this.rasterSnapshot = options.rasterSnapshot || null;
    }
}

export class CelModel extends ClipInstanceModel {}
```

`createId()` は既存の `crypto.randomUUID` 分岐が重複しているため、小さなローカル関数として切り出してよい。

### 2. `LaneModel` を追加

`TrackModel` の実体を移す。

候補:

```js
export class LaneModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.sourceLayerId = options.sourceLayerId || options.layerId || null;
        this.layerId = this.sourceLayerId; // backward compatibility
        this.name = options.name || 'Lane';
        this.type = options.type || 'raster';
        this.cels = (options.cels || options.clips || []).map(clip => new ClipInstanceModel(clip));
        this.active = options.active === true;
    }
}

export class TrackModel extends LaneModel {}
```

既存メソッドは `LaneModel` 側へ置く。

- `getCelAtFrame`
- `addCel`
- `canPlaceCel`
- `setCelDuration`
- `removeCelAtFrame`
- `toggleCelAtFrame`
- `serialize`

メソッド名は互換のため `Cel` のままでよい。

### 3. `TimelineModel` に補助メソッドを追加

候補:

```js
getLaneById(laneId)
getLaneForSourceLayer(sourceLayerId)
getClipById(clipId)
findClipEntry(clipId)
```

`findClipEntry()` の戻り値は以下。

```js
{ lane, track: lane, clip, cel: clip }
```

互換のため `track` / `cel` も含める。

### 4. `syncWithLayers()` の作成部分を `sourceLayerId` 寄りにする

既存:

```js
const existingTrack = this.tracks.find(t => t.layerId === layerData.id);
```

候補:

```js
const existingLane = this.getLaneForSourceLayer(layerData.id);
```

新規作成時:

```js
return new LaneModel({
    sourceLayerId: layerData.id,
    layerId: layerData.id,
    name: layerData.name,
    type: layerData.isFolder ? 'folder' : 'raster',
    active: layerData.id === activeLayerId
});
```

### 5. `AnimationTablePopup` の局所利用を補助メソッドへ寄せる

最低限:

- `_findSelectedCelEntry()` は `this.model.findClipEntry(this.selectedCelId)` を使う。
- `pasteCopiedCel()` の `this.model.tracks.find(t => t.layerId === activeLayer.layerData.id)` は `getLaneForSourceLayer()` を使う。
- `captureSelectedCel()` は `targetTrack.layerId` だけでなく `targetTrack.sourceLayerId` を優先して実レイヤーを探す。
- `_renderCelPreview()` は `track.sourceLayerId || track.layerId` で sourceLayer を探す。

変数名を `lane` / `clip` に寄せるのは、読みにくくならない範囲でよい。

### 6. グローバル登録

下位互換のため既存登録は残す。

追加:

```js
window.LaneModel = LaneModel;
window.ClipInstanceModel = ClipInstanceModel;
```

既存:

```js
window.CelModel = CelModel;
window.TrackModel = TrackModel;
```

も維持する。

## このPhaseでやらないこと

- レイヤーパネルを仮想レイヤーパネルへ切り替える。
- Frame番号クリック時にレイヤーパネルへセルフォルダを表示する。
- ClipAsset内部レイヤーを実装する。
- セルをダブルクリックして内部編集モードへ入る。
- Laneの追加/削除/並べ替えUI。
- Lane Solo / Mute。
- セルD&D移動。
- 自動キャプチャ。
- アニメ保存/読み込み形式の完成。
- CSSクラス `.anim-track-*` の全改名。
- `tracks` / `cels` 配列名の全改名。

## 注意点

- `animation-table-popup.js` は過去にテンプレート文字列の閉じ忘れで起動不能になっている。HTMLテンプレートとCSSブロックを触る場合は、対応するバッククォート・閉じタグを必ず確認する。
- JSファイル全体の置換は禁止。必要箇所の差分編集にする。
- `dist/` は作業対象にしない。
- `console.log` を残さない。必要なら `console.warn` も最小限にする。
- `npm.cmd run build` が失敗した場合、まず1件目の構文エラーだけを直す。推測で複数ファイルを広げない。
- 実レイヤーの `RenderTexture` / `visible` / `layerData` を汚染しない方針は維持する。

## 動作確認

最低限以下を確認する。

1. `npm.cmd run build` が成功する。
2. アニメテーブルが開く。
3. 左上表示が `LANES` になる場合、レイアウトが崩れない。
4. 既存レイヤーがLaneとして表示される。
5. レイヤー追加/削除/リネーム/移動後、Lane表示が従来通り追従する。
6. セル追加/削除/選択が従来通り動く。
7. duration伸縮が従来通り動く。
8. CAPTURE で Snapshot / ClipAsset が紐付く。
9. COPY / PASTE が従来通り動く。
10. PREVIEW / ONION が Phase 4t と同じ挙動を保つ。
11. パネルを閉じる/Preview OFF で実レイヤー表示が復元される。

## 完了条件

- [ ] `LaneModel` が追加されている。
- [ ] `ClipInstanceModel` が追加されている。
- [ ] `TrackModel` / `CelModel` の互換が維持されている。
- [ ] `sourceLayerId` が追加され、既存 `layerId` との互換が維持されている。
- [ ] `TimelineModel` に `getLaneForSourceLayer()` / `findClipEntry()` などの補助メソッドがある。
- [ ] `AnimationTablePopup` の主要な layer 参照が `sourceLayerId || layerId` または補助メソッド経由になっている。
- [ ] Phase 4t のプレビュー/オニオンスキン挙動が壊れていない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4u_report.md` を作成し、互換維持箇所・まだ残る `Track = Layer` 暫定箇所・次にやるべきことを書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
