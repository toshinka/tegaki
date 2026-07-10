# Phase 5t - CAF複数選択と一括移動

状態: 2026-07-11完了。現行指示書からArchiveへ移動。

## 目的

Animation Table上で複数CAFを選択し、ClipAsset・DrawingSnapshot・CAF内部Layer・保存形式を変えずに一括移動へ接続する。

## 維持した契約

- Phase 5q/5rのpreview staging、container順、上側LaneがCanvas前面、PSD record順を変更しない。
- CAF / ClipInstanceの作成、削除、Frame/Lane移動はAnimation Tableだけが正本。
- `selectedCelId` は現在の編集対象を示す単体stateとして維持する。`selectedCelIds` はUI stateであり、保存・export・onion・Playback Scopeへ混ぜない。
- 単体clip drag、retiming、Space pan、Shift+Space zoom、Ctrl+click空セル作成を維持する。

## Slice 1 - Ctrl/Cmd+click複数選択

- 通常clickは単体active、Ctrl/Cmd+clickは既存CAFを加算・解除する。
- 空セルのCtrl/Cmd+clickは新規CAF作成、削除は既存Delete操作へ分離する。
- 通常activeは橙面、2件以上の選択集合は茶系面、主選択は二重リングで示す。
- ハンドル判定より複数選択を優先し、修飾キー押しっぱなしでも二重反転しない。

## Slice 2 - 原子的一括移動

- 選択CAFの相対Lane/frame差をdrag開始時に固定する。
- 選択CAF同士の相対配置を許可し、非選択CAFとの重なり、Lane/frame範囲外、duration終端超過は全体拒否する。
- 部分移動と暗黙の押し出しを行わない。単体dragだけは従来の押し出し契約を維持する。
- 一括移動を1つのTimeline Historyとし、Undo/Redo後も選択集合と主選択を復元する。

## 検証

- `node --check ui/animation-table-popup.js`
- `node --check system/animation/animation-data-model.js`
- モデル単体で正常な複数移動、衝突時false、拒否後の全CAF位置不変を確認。
- Browserで複数Lane・複数Frameを跨ぐ一括drag、Undo/Redo、選択維持、console errorなしを確認。
- オーナー実機で複数Lane移動と、障害CAFがある場合の全体拒否を確認。
- `npm.cmd run build` 成功後、`dist/` と `node_modules/.vite/` の生成差分を清掃。

