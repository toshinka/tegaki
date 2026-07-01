# Phase 5q - Animation Tableを閉じた時のLane表示モード

## 背景

Phase 5pまでで、CAF内部Layer / Folder、PSD import、Album active-caf import、欄外Raster保持、Layer Panel操作は通常/CAFの互換が大きく改善された。
一方、Animation Tableを閉じると、現在Frameの文脈を確認しながら描く入口が弱い。

現行のAnimation Table previewは、Tableを開いている間は同一Frameの他CAFを合成previewとして表示できる。
次のsliceでは、このpreview系を保存正本へ混ぜずに、Tableを閉じた状態でも現在Frame / Lane関係を把握できる表示専用モードとして整理する。

## 目的

- Animation Tableを閉じた状態でも、現在Frameの参照表示を選べるようにする。
- 初期MVPは「Lane onion」。
  - 選択中CAF / Layerは通常どおり編集対象として表示する。
  - 同一Frameの別Lane / 別CAFは低opacityの参照表示として出す。
- 時間方向の前後Frame onion skinと、同一Frameの別Lane参照を別stateとして扱う。
- 表示modeは保存画像、export、Layer visibility、ClipAsset / DrawingSnapshot正本を変更しない。

## 非目標

- Export compositorの出力結果変更。
- Project保存形式の大きなmigration。
- ClipInstance transform / keyframe実装。
- Lane完全独立化やworking Layer廃止。
- WebGPU、SDF/MSDF、WebGL2 Mesh、DPR 2倍化、tiled canvas。
- 通常LayerSystemとTimelineModelの統合。
- フォルダ単位clippingやフォルダblend再設計。

## 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `task-codex/phase5q.md`
5. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
6. `tegaki_work/PHASE4Z_BOUNDARY.md`
7. `tegaki_work/ui/animation-table-popup.js`
8. `tegaki_work/ui/timeline-ui.js`
9. `tegaki_work/ui/layer-panel-renderer.js`
10. `tegaki_work/system/animation/animation-data-model.js`
11. `tegaki_work/system/layer-system.js`

## 現行観測メモ

- `AnimationTablePopup` は `isPreviewActive` と `isOnionSkinActive` を持つ。
- Table表示中は `_updateAnimationPreview()` / `_updateVisibilityOnlyPreview()` から、前後Frame onionと同一Frame composite previewを描画している。
- Tableを閉じる `hide()` では `_restoreVisibility()` と `_invalidateSnapshotTextureCache()` が走るため、閉じた後に参照表示を残すには専用stateと描画寿命の整理が必要。
- `timeline-ui.js` はLayer PanelのFrame indicatorを橋渡しする既存入口を持つ。

## 不変条件

- Display-only modeはUndo / Redo履歴を消費しない。
- Layer / Folder / CAFの `visible`、`opacity`、`blendMode`、`clipping` 正本を書き換えない。
- editing targetは現在選択中CAF / internal Layerのまま維持する。
- animation working Layerは描画adapterであり、Lane onion表示の保存正本にしない。
- 表示用Container / Sprite / Textureは共有しない。必要なら表示先ごとに生成し、破棄境界を明示する。
- Preview / onion / export compositorの共通化は歓迎するが、export結果を変えない。
- Animation Tableを再度開いた時、既存のPREVIEW / ONION toggle状態と矛盾しない。

## Slice 1 - 監査と最小表示契約

1. Animation Tableを開いた状態のpreview描画経路を列挙する。
2. Tableを閉じる時に消えるもの、残してはいけないもの、残してよいものを分類する。
3. Lane onion用state名と描画入口を決める。
   - 例: `laneReferenceMode: 'active-only' | 'lane-onion'`
   - ただし既存名・保存契約に合わせること。
4. 低opacity参照表示の対象を固定する。
   - MVPは「現在Frameの選択中Lane以外のCAF」または「現在Frameの同Lane以外」から、現行modelで安全な方を選ぶ。
5. 監査結果を短く `PROGRESS.md` へ追記してから実装へ進む。

## Slice 2 - Lane onion MVP

- Tableを閉じた状態で、現在Frameの別CAFを低opacityで表示する。
- 表示切替UIはLayer PanelのFrame表示領域、またはAnimation Table閉状態で自然に見える小型buttonへ置く。
- 大型top barは作らない。
- iconは既存Lucide利用を優先し、CSSは `styles/main.css` の変数を使う。
- 低opacity値はまず固定値でよい。設定popup追加は後続。

## Slice 3 - 回帰確認

- 通常描画、CAF描画、PSD由来CAF、Album active-caf import後のCAFで描画できる。
- Animation Table open / closeを繰り返しても、参照表示が二重化しない。
- Table open中のPREVIEW / ONIONとTable closed中のLane onionが混線しない。
- Undo / Redoで参照表示stateが履歴に混ざらない。
- GIF / APNG / PNG / PSD exportの合成結果が参照表示の影響を受けない。
- 保存復元後、Project正本のLayer visibilityやCAF internal visibilityが変わっていない。

## 検証

変更したJS:

```powershell
node --check <変更したJSファイル>
```

build:

```powershell
Set-Location tegaki_work
npm.cmd run build
```

実機確認:

- 通常Layer描画。
- Animation Tableを開く、CAFを2つ以上作る、別Laneまたは別CAFへ絵を置く。
- Tableを閉じ、Lane onion表示をON/OFFする。
- CAF working Layer描画、Undo / Redo、保存復元。
- Export preview / PNG / GIF / APNGの出力にLane onionが混入しない。
- console errorなし。

build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
