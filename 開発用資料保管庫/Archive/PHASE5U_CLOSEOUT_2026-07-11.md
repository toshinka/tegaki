# Phase 5u Closeout

更新日: 2026-07-11

## 完了

- 複数CAFの相対Lane/frame copy/paste、Asset共有関係を保った独立複製、衝突/Lane不足の全体拒否、単一Historyを実装した。
- CAF Groupの連結判定、作成/解除、保存復元、member削除時reconcile、複数Lane移動、copy/pasteを実装した。
- 同一Lane連続Groupの外周表示、選択表示、Group中の個別retiming無効化を実装した。
- オーナー実機で複数CAF copy、Group移動、Group copy/paste、障害CAFがある場合の全体拒否を確認した。
- Group時間比率伸縮はTegaki側では原則実装せず、将来の別動画WEBUI側retiming案へ送った。

## 次Phase

`task-codex/phase5v.md` でFolder clippingを優先する。Folder blend完全合成は低優先度で棚上げする。
