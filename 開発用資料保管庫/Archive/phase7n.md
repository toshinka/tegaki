# Phase 7n — Resize Preview Direct Framing

更新日: 2026-08-12  
状態: CLOSED — Gate 0 `GO`、Stage A / B、SOL review 1=`A`、2026-08-12 SOL技術close。Owner制作確認は別紙で追跡

## 1. 目的

現行Resize Popupの「内容」modeで、preview上の中央dragによる自由配置とwheelによる拡縮を可能にする。数値slider、fit、align、既存Resize transactionは補助操作兼確定正本として維持する。

## 2. Gate 0

判定: `GO`

- View Cameraは編集表示だけ、Project Frame / ResizeはHistory対象のRaster確定、Animation Camera Trackは未実装の別正本として分離する。
- 直接操作のoffsetとpointer sessionはpopup runtimeだけに置き、Project / HistoryへUI stateを保存しない。
- 確定時は既存`_prepareContentResizePlan()`へ同じoffsetを渡し、通常Layer / CAF snapshot / path / anchorを既存一transactionで変換する。
- Canvas枠だけのresize、`両方`mode、Animation Camera Track、export compositor、View Cameraへ新しい分岐を追加しない。

## 3. Stage

### Stage A — pure framing helper

- fit / align / runtime offsetからcontent transformをpure導出する。
- preview pixel deltaをProject offsetへ変換する。
- wheel deltaを既存5〜800%の拡縮値へclampする。

### Stage B — Resize Popup限定adapter

- 「内容」modeかつRaster内容がある時だけpreview drag / wheelを有効にする。
- alignment button操作は該当軸の自由offsetを0へ戻す。
- popup reopenではoffsetを破棄し、保存stateを増やさない。
- Apply / Undo / Redoは既存Resize History commandを共有する。

## 4. 非対象

- frame edge / corner drag、aspect lock、trim
- `キャンバス` / `両方`modeの直接操作
- Animation Camera Lane / Camera Track / camera export sampling
- pen / touch専用gesture、pinch、慣性
- Resize PopupのDOM全面置換

## 5. 受入

- drag量がpreview scaleに依存せずProject offsetへ一致する。
- wheelと既存slider表示・Apply結果が一致する。
- align buttonで自由offsetを解除できる。
- Apply後のUndo / Redo、Project reload、通常Layer / CAF snapshotが既存transactionで一致する。
- popup close / reopenで自由offsetを持ち越さない。
- console errorなし、関連verifier、全verifier、buildを通過する。

## 6. 実装・検証結果

- `resize-direct-framing.js`へfit / align / runtime offset、preview delta、wheel scale clampのpure helperを追加した。
- Resize Popupの「内容」modeだけでpreview drag / wheelを有効化し、Applyは既存content resize planへoffsetを渡す。
- align buttonは該当軸のoffsetを解除し、「内容」から`キャンバス` / `両方`へ離れる時とpopup reopen時はruntime offsetを破棄する。
- SOL review 1では、`両方`modeへのoffset漏れを離脱時resetで修正し、pointer capture喪失時のsession解放を追加した。判定`A`。
- Browserで20px / 10pxのpreview drag、wheel `100% → 105%`、align解除、Apply 1 History、Undo / Redo、close / reopen、console warning / error 0件を確認した。
- 全55 verifierのnode check / 実行と`npm.cmd run build`を通過した。build warningは既存のag-psd `util` externalizationとchunk sizeだけ。

## 7. Owner確認

- 通常制作Projectで「内容」modeのdrag / wheel / align / Applyを軽量確認する。
- 必要ならCAF snapshotを含むProjectでUndo / Redoとreloadを確認する。
- mouseでの受入後もpen / touchは継続監視とし、Phase内でpinchや専用gestureへ広げない。

当初はOwner明示受入をclose条件としていたが、2026-08-12のOwner指示でSOL技術確認によるcloseへ改訂した。

## 8. Close判定

2026-08-12、SOLは「内容」mode限定、runtime offset、既存Resize transaction、mode離脱 / reopen reset、Browser結果を再監査し、追加修正なしでclose可能と判定した。CAF snapshotを含む制作Project、reload、pen / touchは`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`で追跡する。
