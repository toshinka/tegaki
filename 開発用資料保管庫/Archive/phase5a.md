# Phase 5a — アニメ編集中の表示回帰修正と周辺UI整理

更新日: 2026-06-19

## 目的

新機能追加より先に、CAFを使った描画中の表示回帰を解消する。
同時に、アニメ未使用時にも表示されるFrame UIと、アニメテーブルのホイール操作を小さく整理する。

## 調査時点で判明していること

- Layer Panel / CAF内部カード / D&Dの共通化は完了済みで、本Phaseでは再設計しない。
- アニメテーブルを開き、同一Frameに複数CAFがある状態で描画すると、pointerdownからpointerupまで非アクティブCAFが一時的に消える。
- `ui/animation-table-popup.js` の `_applyVisibilityPreview()` は、管理対象Layerとanimation working Layerを一度非表示にし、Frame compositeを別Containerへ再構築する。
- `_renderFrameComposite()` と `_renderCelPreview()` はDrawingSnapshotを元に表示するため、ライブ描画中のworking Layerとsnapshot更新タイミングの境界が疑わしい。
- `ui/timeline-ui.js` のFrame indicatorはアニメ文脈がなくても生成され、`NO FRAME` を表示する。
- アニメテーブルにはズームボタンと `_adjustTimelineZoom()` があるが、ホイール操作契約は未整備。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_BOUNDARY.md`
5. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
6. `tegaki_work/ui/animation-table-popup.js`
7. `tegaki_work/ui/timeline-ui.js`
8. `tegaki_work/ui/layer-panel-renderer.js`
9. `tegaki_work/styles/main.css`

## Task 1 — 非アクティブCAF一時消失の原因確定と修正

### 再現条件

1. アニメテーブルを開く。
2. 同じFrameに表示対象CAFを2つ以上置く。
3. そのうち1つのCAF内部Layerへ描画する。
4. pointerdownからpointerupまで、他のCAFだけが消えるか確認する。

### 調査点

- `_applyVisibilityPreview()` が通常Layer、animation working Layer、preview Containerへ何を表示しているか。
- pointerdown / pointermove / pointerupで、active ClipAssetのDrawingSnapshotが更新される時点。
- `_renderFrameComposite()` の再実行条件と、非アクティブCAFのpreview Spriteが破棄・非表示になる時点。
- live drawing中だけactive working Layerを直接表示する設計なら、他CAFのsnapshot previewと共存できているか。
- Frame移動、CAF選択、visibility変更後にも同じ表示正本が維持されるか。

### 修正条件

- 同一Frameの表示対象CAFは、描画開始から終了まで消えない。
- active CAFのライブ描画は遅延なく見える。
- pointerup後に二重表示、濃度増加、残像が発生しない。
- Layer/CAFの永続的なvisibility値をpreview都合で破壊しない。
- Animation Tableを閉じた後、通常Layer表示へ完全に戻る。
- EventBusを追加・変更する場合は、同名イベントの送受信を全検索しpayloadを統一する。

## Task 2 — Frame indicatorの表示条件と寸法整理

- アニメ文脈がない通常Layer PanelではFrame indicator自体を非表示にする。
- アニメテーブルを開いた時、または有効なCAF/Frame文脈がある時だけ表示する。
- `NO FRAME` を通常作画中の常設表示として残さない。
- 表示時の横幅、右端余白、中央揃えをCAFパネルと視覚的に揃える。
- CAFカードの背景色やLayer Panel共通D&Dは変更しない。
- 見た目は `styles/main.css` のclassで管理し、大量のinline styleを追加しない。

## Task 3 — アニメテーブルのホイール操作契約

アニメテーブル内だけで次の操作を提供する。

- 通常ホイール: Lane領域の縦スクロール。
- `Shift + wheel`: Timelineの横スクロール。
- `Ctrl + wheel`: 既存のzoom段階を使ったTimeline zoom。
- ブラウザ全体やキャンバスのzoomへイベントを漏らさない。
- 入力欄、select、popup外では既存ホイール挙動を変えない。

現在Frameをホイールだけで切り替える操作は、誤操作リスクがあるため本Phaseでは追加しない。
必要なら後続Phaseで専用modifierとUXを決める。

### 追補操作

- Space+ドラッグ: Timeline viewportを縦横スクロール。
- Shift+Space+上下ドラッグ: Timeline zoom。上で拡大、下で縮小。
- zoom前後でドラッグ開始位置のFrameを同じ画面位置へ維持する。
- 同一FrameにCAFが複数ある場合、上下キーでLane表示順にCAF選択を移動する。
- 同一FrameのCAFが1件だけなら上下キーでは何も変更しない。
- 初回のLayer連動Laneは通常Layer名ではなく `Lane 1` と表示する。

## 変更範囲

主対象:

- `tegaki_work/ui/animation-table-popup.js`
- `tegaki_work/ui/timeline-ui.js`
- `tegaki_work/styles/main.css`

原因に必要な場合のみ:

- TimelineModel / ClipAsset / working Layer同期に直接関係する既存ファイル

## 対象外

- Layer Panel rendererやD&D engineの再統合。
- Lane / ClipAssetデータモデルの全面変更。
- APNG/GIF出力。
- 選択範囲、変形基盤、表示反転。
- WebGPU、SDF/MSDF、WebGL2 Mesh。

## 受け入れ条件

- 複数CAFを同一Frameへ置いて描画しても、非アクティブCAFが一時消失しない。
- 描画中とpointerup後で見た目が一致し、二重描画や残像がない。
- Animation Tableを閉じた通常状態ではFrame indicatorが表示されない。
- Animation Table内の縦・横スクロールとzoomが上記契約で動く。
- 通常Layer PanelとCAF内部Layer Panelの選択、表示、D&D、Undo/Redoに回帰がない。

## 検証

```powershell
node --check tegaki_work\ui\animation-table-popup.js
node --check tegaki_work\ui\timeline-ui.js
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` の生成差分を残さない。
実機では、通常作画、アニメ描画、Frame移動、CAF切替、テーブル開閉を一連で確認する。

## 完了報告

`tegaki_work/PROGRESS.md` へ以下だけを追記する。

- 原因。
- 修正した表示正本の境界。
- 実機確認項目と結果。
- Phase 5bへ持ち越す残件。
