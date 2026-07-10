# Phase 5t 完了記録 - CAF複数選択と一括移動

完了日: 2026-07-11

## 実装

- `selectedCelIds` をAnimation Table内のUI stateとして追加し、`selectedCelId` はworking Layer同期対象の単体stateとして維持した。
- Ctrl/Cmd+clickによる加算・解除、通常activeと複数選択の表示分離、修飾キー押しっぱなし時の安定した判定を実装した。
- `TimelineModel.canMoveClips()` / `moveClips()` で全配置を事前検証し、複数CAFを原子的に確定する。
- 相対Lane/frame差を維持し、衝突・範囲外・duration終端超過では全体を拒否する。
- 一括移動を単一Timeline Historyとし、Undo/Redoで複数選択集合も復元する。

## 受入確認

- 複数CAF選択と選択表示: オーナー確認済み。
- 複数Laneを跨ぐ一括移動: オーナー確認済み。
- 障害CAFがある場合の全体拒否: オーナー確認済み。
- Browserで一括移動、Undo/Redo、console errorなしを確認済み。
- 構文確認とproduction buildを通し、生成差分を清掃済み。

## 維持した境界

- ClipAsset、DrawingSnapshot、CAF内部Layer、保存形式は変更しない。
- preview compositor、Lane visibility、Playback Scope、onion、PSD順へ複数選択stateを混ぜない。
- 単体dragの既存押し出し契約を変更しない。

