# Phase 7k — Text to Raster / QTP one-shot entry

更新日: 2026-08-11
担当: SOL / XHigh（Gate・review）、限定実装はLUNA / MAXまたはSOL
状態: OPEN（Gate 0=`GO`、Stage A / B完了、SOL review 1=`A`、Owner一括確認待ち）

> Phase 7i / 7jはOwner一括確認待ちのままOPENを維持する。本PhaseはMesh / Skin / WARP selectionへ依存せず、両Phaseをcloseした扱いにしない。

## 1. 目的

PC優先の最小Text入口として、QTPから入力した文字を既存の通常Raster Layerへ一回で確定する。確定後の正本はRaster pixelだけとし、Project / PSD / export / HistoryへText専用schemaや別評価経路を追加しない。

## 2. Gate 0結果

- `LayerSystem.createLayer()`と`restoreLayerRasterSnapshot()`で、可変boundsの通常Raster Layerを既存Project / PSD / exportへ載せられる。
- `HistoryManager.record()`を使い、`createLayer()`の履歴を一時抑止すれば「Layer作成 + pixel確定」を一つのUndo / Redoにできる。
- `CameraSystem.screenToCanvas()`はzoom / pan / view flipを含む表示座標からProject座標へ戻せる。画面中央を配置anchorにしても保存座標はProject座標だけになる。
- QTPは描画tool 6個のgridを持つ。Textはactive drawing toolにせず、gridを崩さないone-shot actionと小さい入力panelに分離できる。
- animation working LayerはCAF保存正本ではない。初版は通常Raster専用とし、active working Layerでは理由を表示して拒否する。

判定は`GO`。Canvas 2Dは文字glyphを一度Raster pixelへ変換する入力adapterだけに限定し、本番stroke rendererや保存正本にはしない。

## 3. Stage A — pure layout / Raster commit

- 文字列、generic font family、8〜256px、通常 / bold、現在のmain colorを正規化する。
- CRLFを正規化し、空文字、32行超、2000文字超、非finite size、safe texture上限超過を理由付きで拒否する。
- Canvas 2Dで一時ImageDataを生成し、透明paddingを含むtight boundsへ確定する。
- 現在のviewport中心をProject座標へ変換し、可能な場合はRaster全体がProject canvas内へ収まる位置へclampする。
- 新規通常Raster Layer、thumbnail、panel同期、`layer:content-changed`を既存LayerSystemへ接続し、作成とpixelを1 Historyにする。

## 4. Stage B — QTP限定UI

- 既存6-tool gridは変更せず、その下へ`T / TEXT TO RASTER`のone-shot入口を置く。
- textarea、generic family、font size、bold、現在色preview、確定 / cancel、理由表示だけを持つ。
- 通常Enterは改行、Ctrl / Cmd + Enterで確定する。Text入力中の通常shortcutへ伝播させない。
- 確定後は既存toolを切り替えず、QTPを開いたまま入力panelだけ閉じる。

## 5. 非対象

- 再編集可能Text Layer、Text専用Project / History / Recovery schema
- OS font directory走査、`queryLocalFonts()`、font file import、font bytes埋め込み
- font一覧永続化、font欠損再評価
- 縦書き、文字間隔、行間UI、outline、shadow、gradient、path text、rich text
- Canvas上のlive text box、selection handles、Layer Transformとの統合UI
- CAF / DrawingSnapshotへの直接Text確定、Animation Table内Text
- sidebar常設T、mobile最適化

## 6. 受入条件

- 日本語 / ASCII / 複数行を現在色で通常Raster Layerへ確定できる。
- zoom / pan / horizontal flip時も、確定物が実行時に見ている画面中央付近へ現れる。
- Undo一回でLayerごと消え、Redo一回で同じpixel / bounds / layer identityが戻る。
- Project save / reload、PNG / PSD exportで既存Rasterと同じ結果になる。
- CAF working Layer時はmutation / Historyなしで拒否理由を表示する。
- cancel、空文字、上限超過はLayer / Historyを増やさない。
- QTP reopen、既存tool、Q shortcut、Space pan、通常描画を壊さない。
- node check、関連verifier、全verifier、build、Browser実操作とconsole warning / error 0件を通過する。

## 7. 停止条件

- Text専用保存fieldがないと初版が成立しない。
- animation working Layerへ直接書かないと入口を作れない。
- Canvas 2Dのglyph rasterと確定後のRaster pixelが二重正本になる。
- Layer作成とpixel確定を一つの既存History commandへ閉じられない。
- QTP主要DOMの大幅置換、主要class再構成、EventBusの新しい正本が必要になる。

## 8. 実施結果（2026-08-11）

- pure normalizer / layout / placementとCanvas 2D input adapterを`text-rasterizer.js`へ分離し、generic font、size、bold、現在色、複数行、文字 / 行 / texture / pixel容量Gateを固定した。
- `LayerSystem.createRasterLayerFromSnapshot()`は既存`createLayer()`履歴を一時抑止し、tight bounds pixel確定とLayer作成を一つのHistoryへ記録する。Undo / Redoで同じLayer identity / pixel / boundsを再利用する。
- `CameraSystem.getViewportCenterCanvasPoint()`だけを公開し、zoom / pan / horizontal flipを含む画面中心をProject座標へ戻す。保存するのは確定済みRaster boundsだけである。
- QTPの6-tool gridを維持し、その下へone-shot T、textarea、Sans / Serif / Mono、8〜256px、bold、現在色、Ctrl / Cmd + Enter、cancel / reason表示を追加した。既存toolを切り替えない。
- Browserで日本語 + ASCIIの2行、Serif / Bold、画面中央配置、horizontal flip、Undo一回でLayer消去、Redo一回で復帰を確認した。Animation TableでCAF editing contextへ入った後は理由表示、History不変、Layer追加なしで拒否した。console warning / errorは0件。
- 全50 verifier、変更JS / mjsのnode check、`npm.cmd run build`を通過し、build / Vite生成差分は清掃した。SOL review 1判定は`A`。
- Ownerが後日まとめて確認するためOPENを維持する。通常制作Project、zoom / pan、Project reload / PSD / PNG、狭幅、pen / touchはOwner一括確認へ残す。
