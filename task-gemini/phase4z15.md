# Phase 4z15 — Layer Panel CAF Readonly Header

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4z13_report.md`
6. `task-gemini/phase4z14.md`
7. `task-gemini/phase4z14_report.md`
8. `tegaki_work/system/animation/animation-data-model.js`
9. `tegaki_work/ui/animation-table-popup.js`
10. `tegaki_work/ui/layer-panel-renderer.js`
11. `tegaki_work/core-engine.js`

## 重要な注意

- 今回は **読み取り専用CAFヘッダーをレイヤーパネル上部に表示する最小実装** だけを行う。
- CAF表示に `.layer-item` class を使わない。
- CAF表示をSortableJSの対象にしない。
- 通常Layer/通常FolderのDOM構造を変更しない。
- LayerSystemへCAFやClipAssetを投入しない。
- 通常フォルダの `parentId` / `children` にClipAssetやInternalLayer IDを混ぜない。
- Virtual Layer Panel、内部Layerへの直接描画、Timeline Y軸変更、Laneデータモデル変更はしない。
- D&D、保存/復元形式、Export連携は変更しない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z14で、現在FrameのClipAsset/CAF構造を返す `TimelineModel.getFrameAssetTree(frameIndex, options)` が追加された。

次の安全な実装は、レイヤーパネル本体へ混ぜる前に、パネル上部へ読み取り専用のCAFヘッダーを表示すること。

このヘッダーは、最終UIではなく、CAF相当の上位概念をレイヤーパネル側へ出すための最初の表示骨格である。

## 目的

レイヤーパネル上部に、現在Frameで使われているCAF/ClipAssetの概要を読み取り専用で表示する。

目的は以下。

- `getFrameAssetTree()` の結果をUIで確認できる。
- CAFと通常Folderを混同しない専用DOM/classを作る。
- 後続のCAF行表示やVirtual Layer Panelの前に、安全な表示骨格を作る。
- 通常レイヤー操作、D&D、サムネイル、opacity、clippingを壊さない。

## 今回やること

### 1. AnimationTablePopupインスタンスの取得経路を確認する

`layer-panel-renderer.js` から `getFrameAssetTree()` を呼ぶには、アニメテーブルの `model` へアクセスする必要がある。

作業前に以下を確認する。

- `core-engine.js` の `popupManager.register('animationTable', AnimationTablePopup, ...)`
- `ui-panels.js` や `timeline-ui.js` で `popupManager.get('animationTable')` を使っている箇所
- `window` に `animationTablePopup` 相当が登録されているか

推奨:

- 既存の安全な参照経路があればそれを使う。
- 参照経路がなければ、今回は `window.popupManager?.get?.('animationTable')` など既存グローバルから辿れるか確認する。
- 新しいグローバル登録を増やす場合は最小限にし、報告書に理由を書く。

注意:

- 取得できない場合は、CAFヘッダーを空表示または非表示にして通常レイヤーパネルを壊さない。

### 2. `LayerPanelRenderer.render()` の先頭にCAFヘッダー描画を追加

`render(layers, activeIndex, animationSystem = null)` は `this.container.innerHTML = ''` で毎回再描画している。

通常レイヤー行をappendする前に、CAFヘッダーをappendする。

候補:

```js
const cafHeader = this.createCafReadonlyHeader();
if (cafHeader) {
    this.container.appendChild(cafHeader);
}
```

メソッド名候補:

```js
createCafReadonlyHeader()
_getFrameAssetTreeForLayerPanel()
```

### 3. 専用DOM/classを使う

CAFヘッダーに `.layer-item` を使わない。

候補class:

- `.caf-readonly-header`
- `.caf-readonly-title`
- `.caf-readonly-group`
- `.caf-readonly-asset`
- `.caf-readonly-badge`

HTML構造の例:

```html
<div class="caf-readonly-header" aria-label="Frame assets">
  <div class="caf-readonly-title">FRAME ASSETS</div>
  <div class="caf-readonly-group">
    <span class="caf-readonly-badge">CAF</span>
    <span class="caf-readonly-name">Dog</span>
    <span class="caf-readonly-count">2</span>
  </div>
</div>
```

注意:

- `data-layer-index` を付けない。
- `data-is-folder` を付けない。
- `.layer-item` / `.folder-item` を付けない。
- click / drag / SortableJS操作は付けない。

### 4. 表示内容

`getFrameAssetTree()` の `groups` を使う。

最小表示:

- title: `FRAME ASSETS`
- groupごとに:
  - `CAF` badge
  - folderName
  - clips.length
- group内のClipAsset名は、スペースが許せば最大2〜3件だけ小さく表示してよい。

例:

```text
FRAME ASSETS
[CAF] Dog 2
  Run, Face
[CAF] Uncategorized 1
  Sketch
```

表示対象がない場合:

- ヘッダーごと非表示でよい。
- あるいは `FRAME ASSETS - none` を薄く表示してもよい。
- 推奨は、初期MVPでは「何もなければ非表示」。

### 5. 視覚区別

通常Folderと混同しないようにする。

候補:

- 通常Folderより濃い背景色。
- `CAF` badgeを付ける。
- 左線を太めにする。
- 通常レイヤー行より少し小さい読み取り専用パネルにする。

注意:

- 既存パレットから大きく外しすぎない。
- ただし通常Folderとの差が分かることを優先する。
- UIが大きくなりすぎてレイヤー一覧を圧迫しないようにする。

### 6. CSSの置き場所

既存の方針に従い、JSの大量inline styleは禁止。

ただし `layer-panel-renderer.js` が既に一部inline styleを持っているため、今回のCAFヘッダーは以下のどちらかで安全に行う。

- 既存のCSS注入/スタイル管理箇所があればそこへclassを追加する。
- 適切なCSSファイルがある場合はそこへclassを追加する。

作業前にCSSの置き場所を確認し、報告書に書く。

大量の `element.style.xxx` は追加しない。

### 7. 更新タイミング

既存の `animation:frame-changed` では `requestUpdate()` が呼ばれている。

今回のヘッダーは `render()` 内で毎回 `getFrameAssetTree()` を読むため、以下の既存更新で追従するはず。

- animation frame change
- layer panel update request
- layer create/delete

追加で必要なイベントがある場合だけ、最小限にする。

Asset LibraryでAssetのfolder移動や内部Layer変更をした時に即時反映が必要なら、既存の `render()` 呼び出しや `layer:panel-update-requested` が使えるか確認する。

新イベントを増やす場合は、報告書に理由を書く。

## 今回やらないこと

- CAF行を通常レイヤー一覧へ混ぜる。
- CAF/ClipAsset/InternalLayerをクリック可能にする。
- CAF/ClipAsset/InternalLayerのD&D。
- Virtual Layer Panel。
- 内部Layerへの直接描画。
- Timeline Y軸表示変更。
- Laneデータモデル変更。
- ClipAssetをTimelineへ配置するUI。
- 保存/復元形式変更。
- Export連携。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- レイヤーパネル上部に、現在FrameのCAF/ClipAsset概要が読み取り専用で表示される。
- `getFrameAssetTree()` の `groups` を使っている。
- 表示順は `getFrameAssetTree()` の順序、つまりTimeline Y軸順に従う。
- CAFヘッダーに `.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` を使わない。
- CAFヘッダーはSortableJS D&D対象にならない。
- 通常Layer/通常Folderの選択、可視性、opacity、clipping、D&D、サムネイルが壊れない。
- CAF/ClipAssetがないFrameでは通常レイヤーパネルが壊れない。
- `dist/` の差分を成果物に含めない。
- `task-gemini/phase4z15_report.md` を作成する。
- `tegaki_work/PROGRESS.md` を更新する。

## 確認手順

最低限、以下を確認する。

1. `npm.cmd run build`
2. アニメテーブルを開き、Frame 1にClipAssetがある状態にする。
3. レイヤーパネル上部に `FRAME ASSETS` / `CAF` 表示が出ることを確認する。
4. Frameを切り替えて、表示が更新されることを確認する。
5. ClipAssetがないFrameでエラーが出ないことを確認する。
6. 通常Layer/通常Folderの選択・開閉・D&Dが従来通り動くことを確認する。
7. Consoleにエラーがないことを確認する。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z15_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- AnimationTablePopup / TimelineModel への参照経路。
- 追加したCAFヘッダーDOM/class。
- SortableJS対象外にした方法。
- 表示内容と空Frame時の扱い。
- 確認した操作。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z15 完了ログを追記する。

最低限、以下を書く。

- Phase 4z15 の目的。
- 変更ファイル。
- CAFヘッダー表示の内容。
- SortableJS対象外であること。
- ビルド結果。
- 後続Phaseへ残すこと。

