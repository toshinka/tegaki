# Phase 6m: CAF Folder枠・Animation Table Lane縦密度調整

更新日: 2026-07-29

## 現在地

- Phase 6lは`GO`で完了した。完了記録は`開発用資料保管庫/Archive/phase6l.md`。
- Folder Part登録、Plan A子行、Part key編集、Canvas handleは一つのFolder Partへ接続済み。
- オーナー実機では、CAF内部Folderのicon枠がRaster thumbnailと同じ寸法まで拡大し、Animation Table Laneもvisibility iconに対して上下余白が大きい。

## 目的

既存の80%相当UIとcoarse pointer契約を維持しながら、CAF内部Folder枠とAnimation Table Laneだけを分離して縦密度を整える。Rig・Timeline・Layerの正本やイベントは変更しない。

## 実装範囲

1. CAF内部Folderのthumbnail boxを通常Raster thumbnailから独立したCSS変数にする。
2. Folder iconと枠を縮小し、名称・clip・visibility actionの横幅を確保する。
3. `pointer: coarse`のLane行をvisibility icon基準で32pxから26pxへ縮め、celを18pxへ揃える。
4. Part子行は既存の`Lane - 4px`契約を維持し、Frame Gridとの行ずれを作らない。

## 維持する契約

- Layer Panel / CAFは一つのUI engineと二つのdata adapterを維持する。
- 通常Raster thumbnail、visibility / clipping actionのcoarse hit areaは縮小しない。
- Animation Tableのtrack行とtimeline行は同じ高さを使う。
- Lane / Timeline onionはdisplay-only。
- Part子行、Part key、Canvas handle、Clip Motion、WARP、Folder clippingの正本を変更しない。
- `A`、`Q`、`V`、`M`を含む既存shortcutを変更しない。

## このPhaseで行わないこと

- BONE、Mesh、SkinWeight、Perform、physics
- 複数 / nested Part、CAF内部FolderのLane化
- Layer Panel DOM / data adapterの再構成
- toolbar customization、Text、Pixel Selection横断リファクタリング

## 検証

- `npm.cmd run build`
- BrowserでCAF内部Folder枠、Folder名、visibility / clipping、Animation Table Lane、Part子行、Table開閉、console errorを確認する。
- 可能ならcoarse pointer実機で縦密度とhit areaを確認する。
- build後は`tegaki_work/dist/`生成差分を残さず、既存`tegaki_work/node_modules/.vite/`差分を維持する。

## 進捗（2026-07-29）

- 過大化の原因を`pointer: coarse`時の共通thumbnail 32pxとLane 32pxへの復帰と特定した。
- CAF内部Folder専用boxを24px、iconを18pxへ分離した。通常Raster thumbnailとaction hit areaは32px / 18pxを維持する。
- coarse Laneを26px、celを18pxへ調整した。通常pointer側は既存26px / 18pxのまま維持する。
- BrowserではCAF内部Folderを実際に追加し、通常pointer側の枠22px、名称省略なしを確認した。Lane track / Frame Gridは双方26px、visibility 15px、cel 18pxで整列した。
- Folder / Lane visibility切替、Table close / reopen、console errorなしを確認した。coarse側24px / 26pxの最終見た目はオーナー実機受入を残す。

## 次の入口

Browserとオーナー実機で表示を受け入れ、問題がなければPhase 6mをcloseする。次Phaseはproposal 15に従い、BONEの所有・schema・FK評価境界を先に監査し、Mesh / weight / IKを同時実装しない。

## 完了判定（2026-07-29）

- オーナー実機でCAF内部Folder枠を受入済み。Laneも将来のthumbnail表示余地を考慮して現行26pxを採用した。
- Phase 6mを`GO`でcloseする。次はBONE Gate 0をPhase 6nとして開始する。
