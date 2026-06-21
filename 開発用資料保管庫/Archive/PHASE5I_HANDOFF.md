# Phase 5i Handoff

更新日: 2026-06-21

## 完了状態

Phase 5i「通常・逆クリッピングの統合」は完了。
通常LayerとCAF internal Layerで3状態、History、合成、出力、保存復元を統合した。

## 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE5I_HANDOFF.md`
5. `task-codex/phase5i.md`
6. `tegaki_work/PHASE4Z_BOUNDARY.md`
7. `開発用資料保管庫/proposals/01_描画・編集・出力.md`

その後、次を確認する。

1. `tegaki_work/system/data-models.js`
2. `tegaki_work/system/layer-system.js`
3. `tegaki_work/ui/layer-panel-renderer.js`
4. `tegaki_work/system/animation/animation-data-model.js`
5. `tegaki_work/ui/animation-table-popup.js`
6. `tegaki_work/system/animation/timeline-frame-compositor.js`
7. `tegaki_work/system/project-manager.js`

## 現在状態

- Phase 5aからPhase 5hまで完了。
- Phase 5i指示書は `task-codex/phase5i.md`。
- Slice 1-5は完了。通常LayerとCAF internal Layerは `none / normal / inverse` の3状態。
- `system/clipping-mode.js` がmode正規化、cycle、旧boolean互換、固定alpha計算を持つ。
- 通常Layer card / 属性popupは3状態を循環し、1操作1 History commandでUndo / Redoできる。
- Pixi表示、pen preview、airbrush previewは同じinverse mask状態を使う。
- Pixi v8.17のmask解放と初回inverse bounds差は `LayerSystem._setClippingMask()` で局所補正した。
- 固定alphaはtarget 200、mask 255 / 128 / 0でnormal 200 / 100 / 0、inverse 0 / 100 / 200。
- node check、build、通常Layer cycle、Undo / Redo、属性popup、inverse描画、console error増加なしを確認済み。
- CAF mirror card / 属性popupは通常Layerと同じcycle、title、inverse classを使う。
- CAF mode変更は既存CAF専用History 1件でUndo / Redoする。
- working Layer同期はmodeと互換booleanを往復する。
- duplicate、internal clipboard、Folder clipboard、通常LayerからCAF作成はmodeを保持する。
- CAF previewはmask alpha乗算、inverseでは反転alpha乗算を使う。
- internal mergeとFrame compositorはnormal=`destination-in`、inverse=`destination-out`を使う。
- PNG/APNG/GIF等の共通frame列はTimeline Frame compositorを通る。
- 通常Layer project保存とCAF TimelineModel serializeはmodeと互換booleanを保持する。
- CAF / 通常LayerのAlbum projectData往復でinverse modeを復元確認済み。
- project restoreはinverse mask解除後に1描画フレームを挟み、旧Pixi命令参照を残さない。
- source非表示、source削除、D&D、selection、V変形、Undo / Redoを確認済み。
- PNG、APNG、GIF previewとAlbum往復を確認済み。
- build生成差分は除去済み。
- 既存worktreeにはPhase 5e以降の未commit差分があるため維持する。
- `Backup/` と `PastFiles/` は調査・編集しない。

## 将来の再開入口

逆クリッピングの再調査時は、`開発用資料保管庫/Archive/phase5i.md` と
`tegaki_work/system/clipping-mode.js` を入口にする。

## 守る境界

- 通常LayerとCAFはUI actionを共有してもHistory正本を分離する。
- mode更新は専用setterを通し、booleanとmodeを別々に変更しない。
- clipping source探索とFolder sibling規則を勝手に変更しない。
- source不在時は現行の安全な非表示を維持する。
- 独自SVG、inline色、component専用paletteを追加しない。
- 通常LayerとCAF modelの統合、BaseMask class化を行わない。
- debug log、build生成物を残さない。

## 検証の最低線

- clipping mode helperの固定入力確認。
- 変更JSの `node --check`。
- `npm.cmd run build`。
- 通常Layerの3状態cycle、描画preview、Undo / Redo。
- console新規errorなし。
- build後の `dist/` とVite cache差分除去。
