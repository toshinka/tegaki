# Phase 5x 完了記録

更新日: 2026-07-13

## 完了内容

- 右方向キーで空Frameへ進む際のCAF自動生成を設定で無効化可能にした。既定ONと旧操作を維持し、OFF時はFrame移動だけを行う。
- Motion / Layer Transform header action、Animation Table、Settings、Animation Libraryのform / button / disabled / blank表示を既存ふたばpaletteへ揃えた。
- Clip MotionとV変形のShift+dragを共通純粋helperへ接続し、横drag=rotation、縦drag=uniform scaleへ統一した。
- Clip pivotはheadを中心、0°tailを上向きとし、楔形だけをsampled rotationへ追従させた。操作説明は回転の影響を受けず水平表示する。

## 検証

- 設定ON/OFF、保存、Undo、Motion / V header外観、pivot方向、key追加削除、Shift+drag固定入力を確認した。
- Browserで回転siteと水平説明、Animation Libraryのblank / disabled / add button配色、console errorなしを確認した。
- 変更JSの `node --check`、`npm.cmd run build` を通し、生成差分を清掃した。

## 次の入口

- Phase 5yはMotion key 1件のcopy / pasteを、CAF clipboardと分離したruntime clipboardへ載せる。
- Bake Motion、subframe sampling、複数CAF Duration、opacity / easing、Bone / meshはPhase 5yの最初のSliceへ混ぜない。
