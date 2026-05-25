# Phase 4z1 — Playback Scope: All / Active Lane MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4z_report.md`
5. `tegaki_work/system/animation/animation-data-model.js`
6. `tegaki_work/ui/animation-table-popup.js`
7. `tegaki_work/system/layer-system.js`

## 重要な注意

- 過去にテンプレート文字列の閉じ忘れ、HTML重複、CSS注入ブロックの崩れで起動不能が複数回起きている。`animation-table-popup.js` を触る時は、変更範囲を小さくし、テンプレート文字列の開始/終了を必ず確認すること。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- `npm.cmd run build` が失敗した場合は、まず今回触った1ファイル内の構文崩れを疑い、関係ないファイルへ修正を広げない。
- `dist/` は成果物に含めない。

## 背景

Phase 4zまでで、ClipInstanceは作成時点から空ClipAssetを持てるようになった。

一方、表示/再生の概念はまだ整理途中である。

オーナーの現在の方針は以下。

- タイムラインのアクティブフレームを見る時は、そのフレーム上に存在する全Clipを表示する。
- 個別Clipをクリックした時は、そのClipだけを表示/編集対象として見たい。
- 再生ボタンの標準動作は、全Lane上のClipを合成再生する `All Preview`。
- ただし、アクティブなClipが属するLaneだけを確認する `Active Lane Preview` も必要。
- 将来は、雲Lane + 犬Laneだけを記録して再生するような `Lane Set` / `Playback Capture` が必要になるが、これはまだ実装しない。

Phase 4z1では、複数LaneセットやVirtual Layer Panelには踏み込まず、再生/表示スコープを `ALL` と `LANE` の2択で切り替えるMVPを作る。

## 目的

アニメテーブルのプレビューに、以下の2モードを追加する。

- `ALL`: 現在フレーム上の全Lane/全Clipを合成表示する。標準。
- `LANE`: アクティブLane上のClipだけを表示/再生する。

目的は以下。

- 全体再生と、特定レーンだけの確認を切り分ける。
- 後続の Solo/Mute、Lane Set、Playback Capture、Virtual Layer Panel の足場にする。
- 現行の「セルクリック時は選択Clipを見やすくする」挙動と、再生時の全体合成を混同しない。

## 今回やらないこと

- 複数Laneを選んで保存する `Lane Set` / `Playback Capture`。
- レイヤーパネルを仮想セルフォルダへ切り替える `Virtual Layer Panel`。
- ClipAssetフォルダ、Asset Library。
- Clip内部レイヤー編集。
- Export仕様変更。
- レイヤーパネルD&D改修。
- ペン操作向けD&Dの大幅作り直し。
- `CAPTURE` ボタンの全面改名。必要なら小さなtitle変更だけに留める。

## 基本仕様

### 1. Playback Scope状態

`AnimationTablePopup` に状態を追加する。

候補:

```js
this.playbackScope = 'all'; // 'all' | 'activeLane'
```

シリアライズ対象にする必要はない。UIセッション中の状態でよい。

### 2. アクティブLaneの決め方

`LANE` モードで表示対象にするLaneは、以下の優先順位で決める。

1. 選択Clipがある場合、そのClipが属するLane。
2. 選択Clipがない場合、現在のLayerSystemのアクティブレイヤーに対応するLane。
3. それでも決まらない場合は、安全のため `ALL` と同じ表示にfallback。

候補メソッド:

```js
_getActivePreviewLane() {
    if (this.selectedCelId) {
        const entry = this.model.findClipEntry(this.selectedCelId);
        if (entry?.lane) return entry.lane;
    }

    const activeLayer = this.layerSystem?.getActiveLayer?.();
    const activeLayerId = activeLayer?.id || activeLayer?.layerId;
    if (activeLayerId && this.model.getLaneForSourceLayer) {
        return this.model.getLaneForSourceLayer(activeLayerId);
    }

    return null;
}
```

実際のLayerSystem API名は必ず `rg` で確認すること。推測で存在しないAPIを呼ばない。

### 3. 表示フィルタ

`_renderFrameComposite(frameIndex, layers, options = {})` にLaneフィルタを渡せるようにする。

候補:

```js
_renderFrameComposite(frameIndex, layers, options = {}) {
    const laneFilter = options.laneFilter || null;
    for (const lane of this.model.tracks) {
        if (laneFilter && lane.id !== laneFilter.id) continue;
        ...
    }
}
```

注意:

- フォルダLaneや背景Laneの扱いは現行挙動を維持する。
- Preview Containerだけを対象にし、実レイヤーのRenderTextureや本来のvisibleを破壊しない。
- Snapshot未取得/Blankの扱いは現行Phase 4zの挙動を維持する。

### 4. 再生時

再生ボタンで進む表示は、`playbackScope` に従う。

- `ALL`: 全Lane合成。
- `LANE`: Active Laneだけ。

再生開始時に選択Clipを消すかどうかは現行挙動を優先する。
ただし、`LANE` モードで選択Clipを基準にしている場合、再生開始時に選択を消すとActive Laneが失われる可能性がある。

推奨:

- `LANE` モードでは、再生開始時に `this.activePlaybackLaneId` のような一時値へLane IDを固定してから再生する。
- 再生停止時はその一時値をクリアする。

候補:

```js
this.activePlaybackLaneId = null;
```

再生中のLane判定:

1. `activePlaybackLaneId` があればそのLane。
2. なければ `_getActivePreviewLane()`。

### 5. フレームヘッダークリック/左右キー移動

フレームヘッダークリックや左右キー移動時も、`playbackScope` を反映する。

- `ALL`: 全Lane合成。
- `LANE`: Active Laneだけ。

ただし、セルクリック直後の選択Clip単独表示は現行の編集補助として残してよい。

整理:

- フレーム番号を見る操作: Scopeに従う。
- 再生: Scopeに従う。
- Clipをクリックする操作: 選択Clipを明確に見せる現行挙動を維持。
- EDIT: 選択Clipのソース実レイヤー編集を維持。

### 6. Onion Skin

ONIONが有効な場合もScopeを尊重する。

- `ALL`: 前後フレームの全Laneをオニオン表示。
- `LANE`: Active Laneだけをオニオン表示。

選択Clip中の集中モードが既にある場合は壊さない。
大きく競合する場合は、今回は `LANE` モード時だけ `_renderOnionSkins` にLaneフィルタを渡す程度でよい。

### 7. UI

アニメテーブルのヘッダーに、小さな切替UIを追加する。

表示案:

```text
SCOPE: ALL | LANE
```

推奨:

- 既存の `PREVIEW / ONION / AUTO / EDIT` 付近に置く。
- `ALL` と `LANE` はボタンまたはselectでよい。
- 現在選択中のモードが分かるように `.active` 相当を付ける。
- インラインstyleは使わない。必要CSSはCSSブロック内のクラスへ追加する。

注意:

- ヘッダードラッグとScopeボタン操作が競合しないよう、既存のドラッグ除外判定にボタン/入力を含める。

### 8. ステータス/デバッグ

必要ならステータス文字列に `Preview: ALL` / `Preview: LANE` 相当を出してよい。
ただし、`console.log` は残さない。

## 実装候補

### A. ヘルパーを追加

`AnimationTablePopup` に以下のような小メソッドを追加する。

```js
_getLaneById(laneId) { ... }
_getActivePreviewLane() { ... }
_getPreviewLaneFilter() { ... }
```

`_getPreviewLaneFilter()` は、`this.playbackScope === 'activeLane'` の時だけLaneを返す。

### B. 描画入口でフィルタ適用

`_updatePreview()` またはそれに相当する描画入口で、Scopeを判断して `_renderFrameComposite` / `_renderOnionSkins` へ渡す。

候補:

```js
const laneFilter = this._getPreviewLaneFilter();
this._renderFrameComposite(currentFrame, layers, { laneFilter });
```

### C. 再生開始時にLane固定

`play()` に入る時、`activeLane` モードならLaneを確定する。

```js
if (this.playbackScope === 'activeLane') {
    this.activePlaybackLaneId = this._getActivePreviewLane()?.id || null;
}
```

`stop()` でクリア。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- アニメテーブルで `SCOPE: ALL` を選ぶと、現在フレーム上の全Clipが合成表示される。
- `SCOPE: LANE` を選ぶと、アクティブClipまたはアクティブレイヤーに対応するLaneだけが表示される。
- `LANE` モードで再生すると、そのLaneだけが再生される。
- `ALL` モードに戻すと、従来どおり全体合成再生になる。
- フレームヘッダークリック、左右キー移動、再生でScopeが反映される。
- Clipクリック時の選択表示、EDIT、AUTO、UNIQUE、COPY/PASTE、D&D移動、Duration変更を壊さない。
- Preview OFF時は、現行どおり通常レイヤー表示へ戻る。
- `dist/` の差分を成果物に含めない。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z1_report.md`

報告書には以下を必ず書く。

- 実装したScope UI。
- `ALL` と `LANE` の判定方法。
- 再生時にActive Laneをどう固定したか。
- Onion Skinへの影響。
- 手元確認した操作。
- `npm.cmd run build` の結果。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z1 完了ログを追記する。

最低限、以下を書く。

- Phase 4z1 の目的。
- 変更ファイル。
- ビルド結果。
- 残った課題があれば、後続Phase向けに短く列挙。
