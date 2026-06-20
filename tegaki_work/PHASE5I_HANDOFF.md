# Phase 5i Handoff

更新日: 2026-06-21

## 次チャットの目的

Phase 5i「通常・逆クリッピングの統合」のSlice 3へ進む。
CAF internal Layerへ通常Layerと同じ3状態契約を接続し、
CAF専用Historyとworking Layer同期を維持する。

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
- Slice 1-2は完了。通常Layerは `none / normal / inverse` の3状態。
- `system/clipping-mode.js` がmode正規化、cycle、旧boolean互換、固定alpha計算を持つ。
- 通常Layer card / 属性popupは3状態を循環し、1操作1 History commandでUndo / Redoできる。
- Pixi表示、pen preview、airbrush previewは同じinverse mask状態を使う。
- Pixi v8.17のmask解放と初回inverse bounds差は `LayerSystem._setClippingMask()` で局所補正した。
- 固定alphaはtarget 200、mask 255 / 128 / 0でnormal 200 / 100 / 0、inverse 0 / 100 / 200。
- node check、build、通常Layer cycle、Undo / Redo、属性popup、inverse描画、console error増加なしを確認済み。
- CAF internal Layer、project / Album保存、Frame compositorは未接続。
- CAF preview / merge / Frame compositorはCanvas2D合成経路を持つ。
- 既存worktreeにはPhase 5e以降の未commit差分があるため維持する。
- `Backup/` と `PastFiles/` は調査・編集しない。

## 最初の判断

1. `ClipAssetInternalLayerModel` へ共通helperを接続する。
2. CAF card / 属性popupのadapterを3状態cycleへ変更する。
3. CAF専用Historyでbefore / after modeを復元する。
4. working Layer同期時にmodeと互換booleanを同時に往復する。
5. project / Album保存、preview / compositorはSlice 4まで広げない。

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
