# Phase 5c — キャンバス表示反転と変形基盤監査

更新日: 2026-06-19

## 目的

現在の表示中心を保ったキャンバスビュー反転を追加する。
同時に、VキーのLayer変形を選択範囲へ拡張する前提として、preview、確定、履歴、ラスター焼き込みの境界を監査し、必要最小限の共通化を行う。

## 調査時点で判明していること

- `system/layer-transform.js` にVキー変形がある。
- Vキー変形はアニメLayer文脈では抑止されている。
- Vキー変形確定後、Canvas表示、Space+drag、Frame移動後の表示更新、通常描画のCanvas反映が止まり、Layer Panelのthumbnailだけ更新される場合がある既知報告がある。
- previewはContainer transformを使う一方、確定時はpath座標変換と再構築を行う経路があり、現在のラスター内容すべてが同じ規則で一度だけ焼き込まれるか確認が必要。
- キャンバス表示反転はLayer内容の変形とは別機能であり、camera/view stateに置くべき。
- pixel selection systemはまだ存在しない。Phase 5dでVキー変形と統合するため、ここで二重の変形engineを作らない。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
5. `tegaki_work/system/layer-transform.js`
6. camera / viewport / pan / zoom関連実装
7. `tegaki_work/system/layer-system.js`
8. History、RenderTexture、path再構築に関係する実装
9. transform UIを生成するDOM / CSS

## Task 1 — Vキー変形の実態監査

次の対象ごとに、previewと確定後の結果を表にして確認する。

- 通常Raster Layer。
- path情報があるLayer。
- path情報がない既存pixelだけのLayer。
- clip / clippingを使うLayer。
- Folder内Layer。
- CAF internal Layer。
- Undo / Redo後。

確認点:

- 変形確定後もCanvas描画、Space+drag、Frame移動、通常strokeの表示更新が継続するか。
- transform確定で画像が一度だけresampleされるか。
- pathだけが動き、既存pixelが取り残される経路がないか。
- preview解除時に元Container transformが完全復元されるか。
- cancel、Layer切替、popup開閉、履歴移動でsessionが残らないか。
- transform中の描画入力が抑止されるか。
- CAF文脈を抑止している理由が現行設計でも妥当か。

重大な欠落が見つかった場合は、表示反転より先に原因と修正範囲を報告する。
主要classの100行超再構成が必要なら実装を止め、設計案を提示する。

## Task 2 — Transform session境界の整理

Phase 5dから再利用できる最小単位を定義する。

必要な責務:

- 対象: Layer全体、将来のselection bounds / mask。
- 開始時snapshot。
- preview transform。
- confirm時のラスター焼き込み。
- cancel時復元。
- Undo / Redo用の1操作化。
- pointer captureと入力抑止。

条件:

- 既存VキーUIを壊さない。
- 全Layer変形とselection変形で別々の数学・履歴処理を持たせない。
- まだselection mask自体は実装しない。
- 既存classから安全に切り出せない場合は、API境界だけ明文化してPhase 5dへ渡す。

## Task 3 — キャンバスビュー左右反転

Layer pixelを変更しない表示専用の左右反転を追加する。

挙動:

- 現在viewportの見えている中心を保持して反転する。
- zoom率とpan位置を不必要にリセットしない。
- 描画座標、pointer座標、スポイト座標が見た目と一致する。
- 保存画像、export、thumbnail、Layer内容には反転を焼き込まない。
- もう一度実行すると元の表示へ戻る。
- 現在反転中であることをUIで判別できる。

配置:

- camera / viewport stateへ実装する。
- VキーLayer変形のflip操作とは別command、別stateにする。
- shortcutを追加する場合は既存割当を全検索し、入力欄では発火させない。

## Task 4 — 必要な小修正

監査で明確になった局所的不具合のみ修正する。
selection実装へ踏み込む変更、LayerSystem全面再構成、CAF data model変更は行わない。

## 対象外

- 矩形・投げ縄・自動選択。
- selection copy/paste。
- perspective、mesh、warp。
- WebGPU、SDF/MSDF、WebGL2 Mesh。
- animation Frame間transform補間。

## 受け入れ条件

- 表示反転前後で現在見ている中心が維持される。
- 反転中も描画、スポイト、pan、zoomの座標が一致する。
- export結果は表示反転の影響を受けない。
- Vキー変形のconfirm / cancel / Undo / Redoが監査対象で一貫する。
- Vキー変形確定後もCanvas表示、pan、Frame移動、通常描画が停止しない。
- Layer全体と将来selectionが共有するtransform session境界がコードまたは文書で明確。
- 変形確定時のresample回数とpath/pixelの扱いが完了報告に記載される。

## 検証

```powershell
node --check tegaki_work\system\layer-transform.js
node --check <cameraまたはviewportの変更ファイル>
Set-Location tegaki_work
npm.cmd run build
```

実機ではキャンバス端、拡大状態、移動後、反転状態での描画座標を確認する。
build後は `tegaki_work/dist/` の生成差分を残さない。

## 完了報告

`tegaki_work/PROGRESS.md` へ以下を記録する。

- 変形対象別の監査結果。
- 修正した不整合。
- transform sessionの再利用境界。
- Phase 5dでselectionへ接続する際の制約。
