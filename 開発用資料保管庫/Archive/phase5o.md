# Phase 5o — 画像import / クリップボード画像貼り付け

更新日: 2026-06-28

## 完了メモ

- `system/image-importer.js` を追加し、外部画像BlobをアクティブRaster Layerへ中央貼り付けできるようにした。
- 対応形式はPNG / JPEG / WebP / GIF / BMPのブラウザデコード可能な画像。PSD読み込み、複数Layer import、配置変形UI、新規Layer自動作成は未実装。
- 画像がキャンバスより大きい場合だけ、アスペクト比を維持してキャンバス内へ縮小する。小さい画像は等倍で中央へ貼る。
- 左サイドバーへ「画像をアクティブレイヤーへ読み込み」ボタンを追加し、file inputから同じ貼り付け経路へ流す。
- `Ctrl+V` は既存の内部Layer / selection / CAF clipboardを優先し、内部clipboardが無い場合だけOS / ブラウザの画像clipboardを読む。
- 通常Raster Layerでは `image-import-to-layer` として通常Historyへ記録する。
- CAF working Layerでは通常Layer Historyへ記録せず、既存の `drawing:stroke-started` / `drawing:stroke-completed` 経路を使ってCAF raster Historyへ記録する。

## 対象

- 外部画像ファイルをアクティブRaster Layerへ貼り付ける。
- OS / ブラウザclipboard内の画像Blobを `Ctrl+V` でアクティブRaster Layerへ貼り付ける。
- 通常Layer / CAF working LayerのUndo / Redo。
- 既存のLayer / CAF / Folder clipboard契約を壊さないこと。

## 対象外

- PSD読み込み。
- 画像を新規Layerとして追加するimport。
- 複数画像一括import。
- 貼り付け直後の移動・拡縮・回転UI。
- ClipInstance transform / keyframe / easing。
- 保存形式変更、History形式変更、LayerSystem / TimelineModel / CAF History再構成。
- WebGPU、SDF/MSDF、WebGL2 Mesh。

## 検証

- Browserで通常Layer上の画像clipboard `Ctrl+V` を確認した。Historyは0/500から1/500へ増え、中央へ画像が貼り付いた。
- 通常Layer上の画像貼り付け後、Undoで0/500、Redoで1/500へ戻ることを確認した。
- BrowserでAnimation Table / CAF working Layer上の画像clipboard `Ctrl+V` を確認した。Historyは0/500から1/500へ増え、working LayerとCAF card thumbnailへ反映された。
- CAF working Layer上の画像貼り付け後、Undoで0/500、Redoで1/500へ戻ることを確認した。Frame 1維持。
- 画像import用サイドバーボタンとhidden file inputの存在を確認した。
- Browser console errorなし。

