# Phase 5i — 通常・逆クリッピングの統合

更新日: 2026-06-21
状態: 完了

## 目的

通常Raster LayerとCAF internal Layerのクリッピング操作を
`なし -> 通常クリップ -> 逆クリップ -> なし` の3状態へ拡張する。

Layer Panelの共通UI engineを維持しつつ、通常LayerとCAFでdata adapter、
History正本、保存復元先を分離する。
画面表示だけでなく、描画preview、thumbnail、Album、project保存、
PNG/APNG/GIF等のFrame合成まで同じ結果に揃える。

## 採用理由

- 既存の通常Layer / CAF共通カードにclipping adapterが存在する。
- PixiJS v8.17.0は `setMask({ mask, inverse })` を正式に持つ。
- CAFとFrame compositorには既にCanvas2Dのclipping合成経路がある。
- 大型UIや保存形式全面変更なしに、小さい互換migrationとして実装できる。

外部画像貼り付けはOS clipboard権限と既存Ctrl+V routingの設計が先に必要、
Timeline再生範囲はmarker UIと保存範囲の判断が必要なため、Phase 5iには含めない。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE5I_HANDOFF.md`
5. `task-codex/phase5i.md`
6. `tegaki_work/PHASE4Z_BOUNDARY.md`
7. `開発用資料保管庫/proposals/01_描画・編集・出力.md`
8. `tegaki_work/system/data-models.js`
9. `tegaki_work/system/layer-system.js`
10. `tegaki_work/ui/layer-panel-renderer.js`
11. `tegaki_work/system/animation/animation-data-model.js`
12. `tegaki_work/ui/animation-table-popup.js`
13. `tegaki_work/system/animation/timeline-frame-compositor.js`
14. `tegaki_work/system/project-manager.js`

## 現行コードで確認済みの境界

- 通常Layerは `layerData.clipping` booleanと `LayerSystem.refreshClippingMasks()` を使用する。
- CAF internal Layerも `clipping` booleanをserializeし、専用Historyを持つ。
- Layer Panelは通常Layer / CAFで共通のclipping actionをdata adapterへ渡す。
- 通常Layerのclipping変更は現状History command化されていない。
- Pixi表示はSprite mask、CAF preview / merge / Frame compositorはCanvas2D合成を使う。
- 旧project、Album、clipboard payload、CAF serializeはboolean `clipping` を保持する。

## データ契約

正規mode:

```text
none
normal
inverse
```

- 新規の共通helperでmodeの正規化、循環、判定を行う。
- `clippingMode` を正規状態とする。
- 既存互換の `clipping` booleanは `clippingMode !== 'none'` と同期する。
- 旧データで `clippingMode` が無く `clipping === true` の場合は `normal` として読む。
- 不正modeは黙ってinverse等へ補正せず、`none` または旧boolean互換へ正規化する。
- mode更新は専用setterを通し、`clipping` と `clippingMode` を別々に変更しない。

推奨配置:

```text
system/clipping-mode.js
```

このhelperはPixi object、DOM、History、CAF modelを所有しない。

## Slice

### Slice 1 — 固定入力とmode正規化

- 不透明mask、半透明edge、透明mask、空maskを含む固定Rasterを用意する。
- 通常クリップと逆クリップの期待alphaを固定する。
- normal: `targetAlpha * maskAlpha`
- inverse: `targetAlpha * (1 - maskAlpha)`
- `none / normal / inverse` のnormalize、cycle、legacy boolean変換を純粋helperへ実装する。
- 通常LayerとCAFで別々のmode helperを作らない。
- 有効なsourceが存在しない場合は、現行の安全動作を維持して対象Layerを非表示にする。

### Slice 2 — 通常Layer表示・描画・History

- `LayerModel` へ `clippingMode` を追加し、旧booleanを同期する。
- Layer Panel操作を `none -> normal -> inverse -> none` へ変更する。
- 通常Layerのmode変更を既存History契約1件でUndo / Redo可能にする。
- EventBus payloadへ `clipping`, `clippingMode`, `inverse` を同時に通知する。
- `refreshClippingMasks()` は `setMask({ mask, inverse })` を使う。
- layerSprite、path graphics、pen preview、airbrush previewが同じinverse状態を使う。
- clipping source探索、Folder sibling境界、非表示source時の扱いは現行規則を維持する。
- clipping maskの再構築、transform、描画再開、thumbnailを確認する。

実装済み:

- `system/clipping-mode.js` に3状態、旧boolean互換、固定alpha計算を集約した。
- 通常Layer card / 属性popupを3状態cycleへ変更した。
- 通常Layerのmode変更を `layer-clipping-mode` 1 History commandへ接続した。
- Pixi Sprite mask、pen preview、airbrush previewへinverse状態を反映した。
- Pixi v8.17のmask解放と初回inverse bounds差を局所補正した。
- 固定alpha、node check、build、通常Layer 3状態、Undo / Redo、描画、console error増加なしを確認した。

### Slice 3 — CAF internal Layerと共通Layer Panel

- `ClipAssetInternalLayerModel` へ同じ `clippingMode` 契約を追加する。
- CAF clipping toggleを3状態cycleへ変更する。
- CAF専用Historyでmodeのbefore / afterを復元する。
- working Layer同期時に `clippingMode` と互換booleanを往復する。
- Layer Panel cardと属性popupは通常Layer / CAFで同じ状態名とtitleを使う。
- `is-clipping` に加え、逆状態を識別できる互換classを局所追加する。
- iconは既存Lucide資産を検索して再利用し、独自SVGやinline色を追加しない。

実装済み:

- `ClipAssetInternalLayerModel` へ共通helperによる `clippingMode` 契約を追加した。
- CAF mirror cardと属性popupを通常Layerと同じ3状態cycleへ変更した。
- 既存CAF専用History snapshotでmodeのbefore / afterを復元する。
- working Layer同期と逆方向同期でmodeと互換booleanを同時に更新する。
- duplicate、internal clipboard、Folder clipboard、通常LayerからCAF作成でmodeを保持する。
- BrowserでCAF 3状態、1操作1履歴、Undo / Redo、属性popup同期、console errorなしを確認した。

### Slice 4 — CAF preview・合成・保存互換

- CAF previewの固定threshold処理をalpha乗算へ揃える。
- normalはmask alpha、inverseは反転mask alphaを適用する。
- internal Layer mergeはnormalで`destination-in`、inverseで`destination-out`を使う。
- Timeline Frame compositor、APNG/GIF/連番PNG、Export previewを同じmodeで合成する。
- project、Album、TimelineModel、clipboard、Folder->CAF変換、duplicateへmodeを保持する。
- 旧boolean project / Album / CAFデータをnormalとして復元する。
- 新規保存データは `clippingMode` と互換booleanを保持する。
- 保存形式versionの全面変更は行わない。

実装済み:

- CAF previewの128 thresholdを廃止し、mask alphaの乗算・反転乗算へ変更した。
- source不在、非表示source、空maskではclip対象を透明にする安全動作へ揃えた。
- internal Layer mergeはnormal=`destination-in`、inverse=`destination-out`を使う。
- Timeline Frame compositorとPNG/APNG/GIF等の共通frame列へ同じmodeを接続した。
- 通常Layer project保存へ `clippingMode` と互換booleanを保持し、旧booleanをnormalとして復元する。
- CAFはTimelineModel serialize経路でmodeを保持し、Album projectData往復でも復元する。
- inverse mask付きLayerを置換するproject restoreでは、mask解除後に1描画フレームを挟んで旧Pixi描画命令を解放する。
- Browserでnormal / inverse preview差、PNG preview、internal merge、CAF / 通常LayerのAlbum往復を確認した。

### Slice 5 — UI・最終回帰

- 通常LayerとCAF cardで3状態cycle、title、active表示を確認する。
- 属性popupからも同じcycleとHistoryになることを確認する。
- clipping sourceがRaster / Folder内siblingの場合を確認する。
- 半透明edge、空mask、非表示source、source削除、並べ替えを確認する。
- 描画preview、selection、V変形、Undo / Redo後にmaskが残留しないことを確認する。
- Album保存復元、PNG preview、APNG/GIF Frame合成を確認する。
- 通常Layer HistoryとCAF Historyが混ざらないことを確認する。
- `PROGRESS.md`、proposal、要望メモを同期し、本書をArchiveへ移す。

実施済み:

- 通常Layerのsource非表示、source削除、Undo、D&D後のsource再計算を確認した。
- inverse LayerでselectionとV操作後もmodeとmask再構築を維持した。
- 通常Layer HistoryとCAF専用Historyが各既存command境界で分離されることを確認した。
- 固定半透明alpha、空mask、source不在時の透明化を確認した。
- PNG、2フレームAPNG、GIF previewを確認した。
- 通常Layer / CAFのAlbum保存復元でinverse modeを維持した。
- `node --check`、`npm.cmd run build`、ブラウザ回帰を通過した。
- 新規console error、debug log、`dist/`、Vite cache差分を残していない。

## UI状態

| mode | title | 互換boolean | 表示 |
| --- | --- | --- | --- |
| `none` | クリッピング未使用 | `false` | 通常 |
| `normal` | クリッピングON | `true` | 通常クリップ active |
| `inverse` | 逆クリッピングON | `true` | 逆クリップ active |

色は既存CSS変数を使う。
逆状態はtitleだけに依存せず、iconまたは既存paletteによる状態差を持たせる。

## 受け入れ条件

- 通常Layer / CAF internal Layerで3状態が同じ順序で循環する。
- normalはsource alpha内、inverseはsource alpha外だけを表示する。
- 半透明mask edgeが画面、CAF preview、PNG/APNG/GIFで一致する。
- 描画中previewとpointerup後Rasterのclipping結果が一致する。
- mode変更は通常Layer / CAFそれぞれ1 History commandでUndo / Redoできる。
- Folder内sibling、非表示source、source削除、並べ替え後に誤sourceを参照しない。
- 旧boolean保存データは通常クリップとして復元する。
- Album / project / CAF / clipboard往復でinverse modeを失わない。
- CAF data正本と通常Layer Historyを混同しない。
- 新規console error、debug log、`dist/`、Vite cache差分を残さない。

## 対象外

- Layer mask編集UI、mask thumbnail、複数mask stack。
- luminance mask、channel mask、feather。
- clipping sourceを任意選択するUI。
- 通常LayerとCAF modelの統合。
- BaseMask class、HistoryCommand class等の先行抽象化。
- Canvas2Dを本番stroke描画へ導入すること。
- WebGPU、SDF / MSDF、WebGL2 Mesh。

## 検証

```powershell
node --check tegaki_work/system/clipping-mode.js
node --check tegaki_work/system/data-models.js
node --check tegaki_work/system/layer-system.js
node --check tegaki_work/system/drawing/brush-core.js
node --check tegaki_work/system/animation/animation-data-model.js
node --check tegaki_work/ui/animation-table-popup.js
node --check tegaki_work/ui/layer-panel-renderer.js
node --check tegaki_work/system/animation/timeline-frame-compositor.js
node --check tegaki_work/system/project-manager.js
Set-Location tegaki_work
npm.cmd run build
```

Browser:

1. 通常Layerでnone / normal / inverseを循環する。
2. 半透明mask edgeへ描画し、previewと確定結果を比較する。
3. mode変更をUndo / Redoする。
4. Folder内Layer、source非表示、source削除、D&D後を確認する。
5. CAF internal Layerで同じcycleとCAF Historyを確認する。
6. Album保存復元と旧booleanデータ復元を確認する。
7. PNG preview、APNG/GIF Frame出力を確認する。
8. consoleの新規errorを確認する。

build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
