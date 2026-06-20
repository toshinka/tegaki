# Phase 5h Handoff

更新日: 2026-06-21

## 完了状態

Phase 5h「Raster変形の反復劣化低減」は完了。
固定Raster計測、通常Layer・pixel selectionの整数平行移動、最終回帰まで実施済み。

## 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `開発用資料保管庫/Archive/PHASE5H_HANDOFF.md`
5. `開発用資料保管庫/Archive/phase5h.md`
6. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
7. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`

その後、実装箇所として次を確認する。

1. `tegaki_work/system/layer-system.js`
2. `tegaki_work/system/layer-transform.js`
3. `tegaki_work/system/pixel-selection-system.js`
4. `tegaki_work/system/transform-math.js`

## 現在状態

- Phase 5aからPhase 5gまで完了。
- Phase 5gはairbrushの設定境界、stroke mask合成、始点dot、周期dabを修正済み。
- Phase 5h指示書は `開発用資料保管庫/Archive/phase5h.md`。
- 固定Raster計測では整数10pxの10往復はRGBA差分0、小数10.25pxは1623 channel変化、alpha差30104。
- `system/raster-translation.js` に純粋平行移動判定とRGBA整数shiftを追加した。
- 通常Layerの整数平行移動は非再サンプリング化済み。
- pixel selectionの整数平行移動も同じRGBA shiftへ接続済み。
- move-selectionとfloating pasteは既存source-over合成を維持する。
- path更新、History、clipping、thumbnail、座標cache境界を維持した。
- 回転・拡縮・flip・複合変形は現行1回bakeを維持した。
- 既存worktreeにはPhase 5eからPhase 5gまでの未commit差分と、オーナー側の画像資料変更がある。
- `git status --short --untracked-files=all` を最初に確認し、既存差分を維持する。
- `Backup/` と `PastFiles/` は調査・編集しない。

## コード上の入口

- `LayerSystem.confirmLayerTransform()` は純粋な移動をRGBA整数shiftへ分岐する。
- `LayerSystem.bakeTransform()` はLayer Containerを一時RenderTextureへ描画し、元RenderTextureへ書き戻す。
- `PixelSelectionSystem.confirmTransform()` は純粋な移動をRGBA整数shiftへ分岐する。
- 回転・拡縮・flipだけCanvas2D `drawImage()` fallbackを通る。
- `createLayerRasterSnapshot()` / `restoreLayerRasterSnapshot()` はHistoryとpixel比較の既存入口。
- `transform-math.js` はLayer全体とselectionの中心基準行列を共有している。

## 最終回帰

1. clipping LayerとFolder内Layerの通常V移動を確認した。
2. selectionの保存前auto-commitとAlbum保存・復元を確認した。
3. PNG preview前auto-commitとpreview生成を確認した。
4. zoom / H表示反転中のpreviewと確定位置を確認した。
5. CAF contextでselection変形と通常Layer V抑止の境界を確認した。

## 守る境界

- V開始、V confirm、Escape cancelの操作を変えない。
- 回転・拡縮・flipは現行1回bakeを維持する。
- Layer全体とselectionで別々のpixel shiftアルゴリズムを作らない。
- 通常Layer HistoryをCAF internal Layerへ接続しない。
- 永続transform state、原画像cache、保存形式変更へ広げない。
- LayerSystem全面再構成、History class化、Base transform class化を行わない。
- debug log、build生成物を残さない。

## 検証の最低線

- 変更JSの `node --check`。
- `npm.cmd run build`。
- 通常Layerの整数移動、cancel、Undo / Redo。
- 半透明edgeと1px線の往復移動。
- 回転・拡縮のfallback。
- console新規errorなし。
- build後の `dist/` とVite cache差分除去。
