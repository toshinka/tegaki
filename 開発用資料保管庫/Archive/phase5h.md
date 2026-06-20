# Phase 5h — Raster変形の反復劣化低減

更新日: 2026-06-21
状態: 完了

## 目的

VキーによるLayer全体変形とpixel selection変形で、純粋な平行移動までRenderTextureまたはCanvas2Dへ再描画され、
確定を繰り返すほど半透明境界や細線が劣化する問題を低減する。

最初の対象は通常Raster Layerと通常Layer上のpixel selectionとする。
回転・拡縮を含む一般アフィン変形の全面非破壊化や保存形式変更へ広げず、
整数平行移動をRGBA pixel shiftとして確定する経路を先に追加する。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `開発用資料保管庫/Archive/PHASE5H_HANDOFF.md`
5. `開発用資料保管庫/Archive/phase5h.md`
6. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
7. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
8. `tegaki_work/system/layer-system.js`
9. `tegaki_work/system/layer-transform.js`
10. `tegaki_work/system/pixel-selection-system.js`
11. `tegaki_work/system/transform-math.js`

## 現行コードで確認済みの原因候補

- `LayerSystem.confirmLayerTransform()` は純粋な移動でも `bakeTransform()` を呼ぶ。
- `bakeTransform()` は現在のLayer Containerを一時RenderTextureへ描画し、元RenderTextureへ書き戻す。
- `PixelSelectionSystem.confirmTransform()` は純粋な移動でも `_renderTransformedRegion()` のCanvas2D `drawImage()` を通る。
- Raster snapshotはextract、unpremultiply、Canvas texture化、RenderTexture復元を通るため、検証では移動前後のRGBA一致を実測する必要がある。
- 回転・拡縮は再サンプリングが必要だが、現行は1回のconfirmにつき1回のbakeに限定されている。

## 設計境界

### 維持するもの

- V単独で変形開始、V再入力でconfirm、Escapeでcancelする操作。
- Container / Sprite transformによるpreview。
- 1 confirmを1 History commandとして扱う契約。
- Layer全体とselectionで共有する `transform-math.js` の中心基準数学。
- clipping mask再構築、thumbnail更新、座標cache clear。
- 通常LayerとCAF内部LayerのHistory正本分離。
- 回転・拡縮・flipを含む変形の現行1回bake経路。

### 追加する境界

- transformが純粋な平行移動か判定する小さい共通helper。
- RGBA bufferを整数dx / dyで移動する副作用のないpixel helper。
- canvas外へ出たpixelは破棄し、空いた領域は透明化する規則。
- Layer全体とselectionが同じpixel shift実装を利用できる配置。

推奨配置:

```text
system/
  transform-math.js
  raster-translation.js
  layer-system.js
  pixel-selection-system.js
```

`raster-translation.js` はLayer、History、CAF、DOM、Pixi objectを所有しない。
入力buffer、width、height、dx、dyから新しいRGBA bufferを返す純粋処理に限定する。
実装前に同義helperを再検索し、既存処理へ安全に統合できる場合は新規fileを増やさない。

## Slice

### Slice 1 — 固定再現とpixel一致計測

- 不透明pixel、半透明pixel、1px線、soft edgeを含む固定Rasterを用意する。
- 同じ往復移動を10回以上確定し、現行経路のRGBA差分、alpha差分、非透明pixel数を測る。
- Layer全体変形とselection移動を別々に測る。
- `x / y` だけが変化し、rotation 0、scaleX / scaleY 1の条件を純粋平行移動として定義する。
- flipはscale符号が変わるため平行移動経路へ含めない。
- 診断helperを残す場合はdebug限定とし、通常consoleへ出さない。

実測結果:

- 64x48固定Rasterを右10px / 左10pxへ10往復した場合、Layer bakeとselection Canvas2Dの両方でRGBA差分0。
- 同じRasterを右10.25px / 左10.25pxへ10往復した場合、両経路で1623 channel変化、最大差142、alpha差合計30104、非透明pixel数547から1005。
- canvas端破棄を除けば整数移動自体は一致するため、純粋平行移動を確定時に整数化してRGBA shiftへ分離する。

### Slice 2 — 通常Layerの整数平行移動

- 純粋平行移動のconfirm時はx / yを整数pixelへ丸める。
- 開始時Raster snapshotのRGBAを整数dx / dyだけshiftし、一般bakeを通さず確定する。
- path情報が残るLayerは同じ整数移動をpath座標へ適用する。
- Container transformと内部transform stateを既定値へ戻す。
- clipping、thumbnail、座標cache、panel updateを現行confirmと同じ順序で更新する。
- before / after snapshotを既存 `layer-transform` History 1件へ記録する。
- Undo / Redo後もRGBAが開始時または移動後snapshotと一致することを確認する。
- 回転、拡縮、flip、複合変形は既存 `bakeTransform()` へフォールバックする。

実装状態:

- `system/raster-translation.js` に純粋平行移動判定と副作用のないRGBA整数shiftを追加した。
- 通常Layerの純粋平行移動は開始時Snapshotを整数shiftして確定する。
- path座標は丸め後の同じdx / dyで更新する。
- History、clipping mask、thumbnail、座標cache、panel更新は既存確定境界を維持する。
- 回転・拡縮・flip・複合変形は現行 `bakeTransform()` を維持する。

### Slice 3 — pixel selectionの整数平行移動

- selection transformがx / yのみの場合、Canvas2D `drawImage()` を通さず元regionを整数座標へ配置する。
- move-selectionでは切り取った元領域をbase snapshotへ合成する。
- pasteではclipboard regionを同じpixel配置helperで合成する。
- 半透明pixelが既存pixelへ重なる場合は現行source-over結果を維持する。
- 移動先が透明領域の場合、元RGBAを変化させない。
- selection boundsを整数座標へ更新する。
- confirm / cancel / Undo / Redo、Ctrl+Dやsave前auto-commitの現行規則を維持する。
- 回転、拡縮、flipは現行 `_renderTransformedRegion()` へフォールバックする。

実装状態:

- 純粋平行移動はselection regionをCanvas寸法のRGBA bufferへ配置し、`translateRgbaPixels()` で整数shiftする。
- move-selectionは切り取り済みbase snapshot、pasteは未変更base snapshotへ既存 `_blendRegion()` でsource-over合成する。
- selection boundsは丸め後の整数dx / dyへ同期する。
- canvas外pixel破棄、透明領域補完、cancel、Undo / Redoの既存規則を維持する。
- 回転・拡縮・flipはCanvas2D `_renderTransformedRegion()` へ残す。
- Browserで既存stroke上への移動合成、cancel、Undo / Redo、canvas端、回転・拡縮fallback、console errorなしを確認した。

### Slice 4 — 一般変形の回帰と責務整理

- 回転・拡縮が1 confirmにつき1回だけ再サンプリングされることを再確認する。
- Layer全体とselectionの純粋移動判定が重複した場合だけ共通helperへ寄せる。
- `LayerSystem` 全体、`PixelSelectionSystem` 全体、History classの再設計は行わない。
- 原画像cache、遅延bake、永続transform stateが必要かは計測結果をproposalへ記録し、このPhaseでは導入しない。

### Slice 5 — 保存・CAF・最終回帰

- 通常Layerの移動、cancel、Undo / Redo、保存・復元、画像出力を確認する。
- selection移動、paste、cancel、Undo / Redo、save前auto-commitを確認する。
- clipping Layer、Folder内Layer、canvas端、pan / zoom / H表示反転中を確認する。
- Animation Table表示中はLayer全体変形の現行抑止を維持する。
- CAF working Layer / internal Layerへ通常Layer Historyを誤接続しない。
- `PROGRESS.md`、transform proposal、handoffを同期する。
- 完了時は本書を `開発用資料保管庫/Archive/phase5h.md` へ移す。

実装・検証結果:

- clipping LayerとFolder内Layerの整数移動でclippingと階層を維持した。
- H表示反転中とzoom中もpreview位置と確定結果が一致した。
- Album保存前の未確定selectionはHistory 1件で自動commitされた。
- Album復元後もFolder階層、clipping ON、Raster内容を維持した。
- PNG preview前の未確定selectionもHistory 1件で自動commitされ、previewを生成した。
- Animation Table表示中はselection変形をCAF経路へ同期し、selection解除後の通常Layer V変形を抑止した。
- Browser consoleの新規errorなし。
- `node --check` と `npm.cmd run build` 成功。
- `dist/` とVite cacheの生成差分は除去した。

## 受け入れ条件

- 純粋な整数平行移動を往復しても、canvas内に残るRGBAがpixel単位で一致する。
- 半透明境界と1px線が往復移動だけで劣化しない。
- Layer全体とselectionの移動で、canvas外破棄と透明領域補完が一致する。
- 回転・拡縮・flipは現行の1回bake結果から悪化しない。
- confirm / cancel / Undo / Redoでpixel欠落、二重表示、transform残留がない。
- clipping、thumbnail、保存、export、通常描画再開に回帰がない。
- CAF data正本と通常Layer Historyを混同しない。
- debug log、`dist/`、Vite cache差分を残さない。

## 対象外

- 永続的な非破壊transform state。
- 原画像cacheを保存形式へ追加すること。
- 回転・拡縮の新しい補間filterや高品質resampler。
- perspective、mesh、warp、keyframe transform。
- CAF internal LayerへのLayerSystem History接続。
- WebGPU、SDF / MSDF、WebGL2 Mesh。
- Layer transform UIの全面変更。

## 検証

```powershell
node --check tegaki_work/system/transform-math.js
node --check tegaki_work/system/raster-translation.js
node --check tegaki_work/system/layer-system.js
node --check tegaki_work/system/pixel-selection-system.js
Set-Location tegaki_work
npm.cmd run build
```

Browser:

1. 固定Rasterを右10px、左10pxへ10往復し、見た目とRGBA一致を確認する。
2. selectionを同じ条件で往復し、選択外pixelが不変であることを確認する。
3. 半透明pixelを既存pixelへ重ねた時だけsource-overされることを確認する。
4. canvas端から外へ移動し、Undo / Redoで復元できることを確認する。
5. 回転、拡縮、flip、cancelを確認する。
6. clipping Layer、Folder内Layer、保存・復元、PNG previewを確認する。
7. consoleの新規errorを確認する。

build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
