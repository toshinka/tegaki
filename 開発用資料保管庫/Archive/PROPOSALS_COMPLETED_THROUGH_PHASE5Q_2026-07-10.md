# 実装済み計画まとめ Phase 5qまで

更新日: 2026-07-10

## 描画・編集

- LazyBrush、筆圧補正、coalesced events、描き始めpressure spike対策。
- airbrushのalpha mask蓄積、spacing / flow整理。
- selection、Folder単位copy/cut/paste、composite History。
- clipping / inverse clipping、CAF内部Layer対応。
- 整数平行移動の非再sampling確定、VキーLayer全体変形。
- Project frame固定 + 可変Raster boundsによる欄外pixel保持。
- 外部画像clipboard / file import。

## Animation / CAF

- Lane、ClipInstance、ClipAsset、DrawingSnapshot、CAF internal Layer / Folder。
- Animation Table、CAF copy/paste、保存復元、Album往復。
- loop、終了基準、IN / OUT、playback scope。
- 多Frame CAFのcache / snapshot / History負荷対策。
- Table閉状態のLane onion、Timeline onion。
- preview合成順とstroke中working Layer表示の安定化。

## Save / export

- IndexedDB Album、checkpoint、HTML / JSON互換。
- PNG、GIF、APNG、WebP等の既存export経路。
- 通常Layer / Folderおよびactive CAFのPSD export。
- active CAFへのPSD Layer / Folder importとasset scoped History。
- CLIP STUDIOと一致するPSD Layer / Folder順。

## UI

- 通常Layer / CAF internal Layerの共通card rendererとdata adapter分離。
- Folder内結合、CAF keyboard移動、共有ghost icon。
- Phaseごとの詳細は `開発用資料保管庫/Archive/phase5a.md` から `phase5q.md` を参照する。
