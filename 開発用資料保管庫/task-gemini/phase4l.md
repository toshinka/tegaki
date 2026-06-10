# Phase 4l — アニメテーブルの最終モデル整理と移行計画

## 目的

Phase 4k までで、現行レイヤーをトラックとして扱うアニメテーブルMVPが動いた。
ただし、オーナーの最終イメージは `Track = Layer` ではない。

このフェーズでは実装を大きく進めず、アニメテーブルの長期データモデルを整理し、今後の実装が `Track = Layer` に固定されないようにする。

## オーナーの最終イメージ

- アニメテーブルは二次元マトリクス。
- X 軸は時間・タイムスケール。
- Y 軸はセル/クリップを上下に並べるための表示階層・Laneであり、通常描画のレイヤー階層そのものではない。
- 各セル/クリップは独立した描画コンテナであり、その内部に個別のレイヤー構造を持つ。
- 将来的には「犬」「猫」などのクリップ素材を保管庫/ライブラリに保存し、タイムライン上へ何度も配置できる。
- 101匹ワンちゃんのように、多数の犬クリップを二次元マトリクス上に並べ、個別に操作・再生できる方向を目指す。
- 将来、各クリップ内部で物理演算・メッシュ・ボーン等のアニメーションを持てる余地を残す。

## 現状の暫定実装

- `TimelineModel.tracks` は `LayerSystem` の実レイヤー一覧と同期している。
- `TrackModel.layerId` は実レイヤーIDを指す。
- `CelModel.layerId` と `CelModel.rasterSnapshot` は、選択中レイヤーの RenderTexture Snapshot を保持する試作。
- Phase 4k の Snapshot プレビューは、実レイヤーへ一時的に復元して表示するMVP。

これらは実験として有効だが、最終仕様ではない。

## このフェーズでやること

1. `animation-data-model.js` と `animation-table-popup.js` を読み、現在どこが `Track = Layer` 前提になっているかを棚卸しする。
2. 将来モデル案を `task-gemini/phase4l_report.md` にまとめる。
3. 最低限、以下の用語を分けて定義する。
   - `Lane`: タイムライン上のY方向の行。表示順・整理・重なり順の単位。
   - `ClipInstance` または `Cel`: Lane上の時間範囲に配置されるインスタンス。
   - `ClipAsset` または `ClipDocument`: クリップ本体。内部レイヤー、描画Snapshot、将来の物理演算情報を持つ。
   - `DrawingSnapshot`: 現在の `rasterSnapshot` に相当する、描画内容の保存単位。
4. 現行モデルから将来モデルへの段階移行案を作る。
5. `PROGRESS.md` を更新する。

## このフェーズでやらないこと

- 大規模な実装変更。
- 保存形式の本格変更。
- Export連携。
- セル移動、コピー、複数選択。
- 物理演算、メッシュ、ボーン。
- 旧 `animation-system.js` の復活。
- `timeline-ui.js` の大改修。

## 移行案で必ず触れること

- 現行の `TrackModel.layerId` は、当面 `sourceLayerId` 的な暫定接続として扱う。
- 将来は `TrackModel` を `LaneModel` へ寄せるか、新規 `LaneModel` を追加する。
- `CelModel.rasterSnapshot` は将来 `clipAssetId` / `drawingSnapshotId` / `ClipDocument` へ移す候補。
- 現在の実レイヤー同期は「現在のキャンバス状態から仮クリップを作る入口」として残せるが、アニメテーブルの正本にしない。
- Procreate Dreams / ToonSquid 2 はUIや操作感の参考にするが、Tegakiでは「クリップ内部に独立レイヤーを持つ」方向を優先する。

## Geminiへの注意

- `animation-table-popup.js` のテンプレート文字列、CSS注入ブロック、閉じ括弧を壊さないこと。過去に `Expected a semicolon` が複数回出ている。
- 今回は設計整理が主目的。コードを触る場合はコメントや小さな命名補助に限定し、100行超の置換やDOM構造の大変更はしない。
- `npm.cmd run build` は、コードを変更した場合のみ実行する。ドキュメントだけなら不要。

## 完了条件

- `task-gemini/phase4l_report.md` が作成されている。
- 現行の `Track = Layer` 依存箇所が一覧化されている。
- 将来の Lane / ClipInstance / ClipAsset / DrawingSnapshot の関係が文章または簡単な図で説明されている。
- Phase 4m 以降で何を先に実装すべきか、2〜3案に分けて提案されている。
- `tegaki_work/PROGRESS.md` が更新されている。
