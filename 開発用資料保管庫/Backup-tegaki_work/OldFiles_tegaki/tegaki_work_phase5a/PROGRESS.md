# PROGRESS — 現在状態

更新日: 2026-06-19

> 現在状態だけを記録する正本。
> 詳細計画は `開発用資料保管庫/proposals/00_計画索引.md` から読む。
> 過去ログと完了文書は `開発用資料保管庫/Archive/` に退避。

---

## 現在のPhase

Phase 5aは追補を含め完了し、指示書を `開発用資料保管庫/Archive/phase5a.md` へ退避した。
次回はPhase 5bのCAF / Timeline共通Frame出力経路と履歴負荷整理を開始する。

### Phase 5a完了 — アニメ編集中の表示回帰と周辺UI

- 原因:
  - `drawing:stroke-started` 時に合成preview全体を解除していたため、選択CAFのworking Layerだけが残り、同一Frameの他CAFがpointerupまで消えていた。
- 修正:
  - 描画中は選択CAFだけをFrame compositeから除外する。
  - 同一Frameの他CAFはsnapshot previewへ残し、選択CAFのworking Layerだけをライブ表示する。
  - stroke完了・cancel時に通常のFrame compositeへ戻す。
  - Animation Tableを閉じている間はLayer PanelのFrame indicatorを非表示にした。
  - Frame indicatorをCAF枠とほぼ同じ幅へ揃え、右側の余白を縮小した。
  - Animation Table内へ通常ホイールの縦スクロール、Shift+ホイールの横スクロール、Ctrl+ホイールのTimeline zoomを接続した。
  - Phase 5a追補として、キャンバス操作と同じSpace+ドラッグでTimeline viewportを縦横スクロールできるようにした。
  - Shift+Space+上下ドラッグでTimelineを段階zoomし、ドラッグ開始位置のFrameが画面上の同じ位置に残るようscroll位置を補正した。
  - CAF本体、durationハンドル、ボタン、入力欄から始めたドラッグは既存操作を優先する。
  - 同一FrameにCAFが複数ある場合、上下キーでLane表示順にCAF選択を切り替える。CAFが1件だけなら何も変更しない。
  - 初回のLayer連動Laneは通常Layer名を表示名に使わず、`Lane 1` と表示する。旧自動名 `レイヤー1` も未編集なら正規化する。
- 自動確認:
  - 同一Frameへ2 CAFを配置し、両方へ描画した後も両方の描画が残る。
  - Frame indicatorはAnimation Table開閉に追従し、CAF枠幅約197pxに対して約198px。
  - 通常ホイールでLane領域が縦スクロールする。
  - zoomボタンと共通のzoom処理が動作する。
  - 同一Frameへ2 CAFを置き、上キーで上Lane、下キーで下LaneのCAFへ選択が移る。
  - CAFが1件だけのFrameでは下キーを押しても選択が変化しない。
  - 初回表示のアニメテーブルとCAFヘッダーがともに `Lane 1` になる。
  - Browser Console errorなし。
- 実機確認:
  - マウス/ペンを押している最中も非アクティブCAFが消えない。
  - Shift/Ctrl修飾ホイールとSpace系修飾ドラッグを含め追補確認完了。
  - 受け入れ条件と追補項目に既知残存なし。

### 次回Phase 5b — CAF / Timeline共通Frame出力経路と履歴負荷整理

- `system/animation/timeline-frame-compositor.js` を追加。
  - TimelineModel / ClipAsset / DrawingSnapshotからCanvas Frame列を生成する。
  - CAF内部Layer、Folder可視性、opacity、blend、clipping、Clip transform、通常Layer、Backgroundを合成する。
  - UI preview DOM、現在Frame、CAF選択、Layer選択、visibilityを変更しない。
- ExportManager:
  - TimelineModelを正本としてFrame数、FPS、Frame範囲を取得する。
  - 連番PNG、APNG、GIFが同じCanvas Frame列を共有する。
  - TimelineModelにCAFがない場合だけ旧animationSystemへfallbackする。
- ExportPopup:
  - Timeline由来のFrame数とFPSを表示する。
  - 開始/終了Frameを指定できる。
  - APNG/GIF previewは同じcompositorを約200pxで実行し、画像側のloop再生を利用する。
- encoder:
  - 未導入だった `upng-js` と `gif.js` を固定依存として追加。
  - GIF workerもVite assetとして同梱し、CDNへ依存しない通常経路にした。
- 自動確認:
  - APNG 24 Frame preview、APNG 1-2 Frame範囲preview、GIF 24 Frame previewが生成される。
  - Browser Consoleに新規errorなし。
  - `npm.cmd run build` 成功。
- 実機確認待ち:
  - 2 Frame / 2 CAF、CAF重なり、非表示CAF、空Frame、透明/不透明Backgroundの出力見た目。
  - 出力後も選択状態と描画継続に変化がないこと。
- 実機追修正:
  - CAF編集用 `isAnimationWorkingLayer` が通常Layerとして全Frameへ重なり、最後に編集したCAFが空Frameを含む全出力へ残る問題を修正した。
  - 左サイドバー起点のAlbum / Export / Resize / Settingsが `canvas-area` のstacking contextに閉じ込められ、子側のz-indexを上げてもSidebar / Layer Panelへ勝てない問題を修正した。
  - 共通overlay mount helperを追加し、対象popupとLayer transform panelを `main-layout` 直下へ配置する。背景透明度は従来値を維持する。
- 開始時の最優先追補:
  - CAF数増加後に描画がペンへ追従しなくなる原因は、描画開始・完了時に全ClipAsset / 全DrawingSnapshotを履歴用へ同期複製する経路。
  - CAF描画履歴を対象CAF / 内部Layer / 前後Snapshot単位へ縮小する。
  - 未参照DrawingSnapshotを回収し、animation working Layerの通常Layer用履歴取得を省略する。
  - Settings PopupへHistory件数、推定メモリ上限、自動調整、現在使用量を追加する。

### Phase 4z26完了状態

- 通常Layer/FolderとCAF内部Layer/Folderは共通DOM rendererを使用。
- 選択、名前変更、表示、クリッピング、Folder開閉は共通event delegationとadapterを使用。
- Pointer D&D、ghost、drop判定、押しのけanimationは共通engineを使用。
- LayerSystemとClipAsset内部モデル、History、working Layer同期はadapter境界で分離。
- Albumの通常Layer/FolderとCAF保存・復元を接続済み。

## 残存

Layer Panel統合作業としての既知残存はない。追加修正は実機回帰が出た場合に限定する。

意図的に残す差:

- 通常カードとCAFカードの幅、depth、背景等のvariant表示。
- Backgroundは通常Layer Panel専用。
- データ正本とHistoryはLayerSystem / ClipAssetで分離。

## 次期Phase

調査結果から、次の4 Phaseへ分割した。

1. `開発用資料保管庫/Archive/phase5a.md`（完了）
   - アニメ描画中の非アクティブCAF一時消失。
   - アニメ未使用時のFrame indicator非表示。
   - アニメテーブルのホイール操作。
2. `task-gemini/phase5b.md`
   - CAF / Timeline共通Frame compositor。
   - 既存APNG/GIF exporterの新Timeline接続。
3. `task-gemini/phase5c.md`
   - 現在表示中心を保つキャンバスビュー反転。
   - Vキー変形のラスター確定・履歴監査。
   - 将来selectionと共有するtransform session境界。
4. `task-gemini/phase5d.md`
   - 矩形pixel selection MVP。
   - Layer全体変形と共通基盤を使うselection変形。

Phase 5aは完了。次回は `task-gemini/phase5b.md` から開始する。5dは5c完了を前提とする。

独立候補:

- エアブラシ重ね塗りの黒ずみ・モアレ調査。

詳細は以下を参照:

- `開発用資料保管庫/proposals/01_描画・編集・出力.md`
- `開発用資料保管庫/proposals/02_UI・操作・カラー・アルバム.md`
- `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`

## 現在の重要境界

- `tegaki_work/PHASE4Z_BOUNDARY.md` をCAF / Lane / Layer Panel責務の正本として維持する。
- CAF自体、ClipInstance、Frame/Lane移動はアニメテーブル正本。
- Layer Panelは通常Layer/FolderとCAF内部Layer/Folderの表示・編集入口。
- WebGPU、SDF/MSDF、WebGL2 Meshは正式Phaseまで凍結。

## 検証

```powershell
node --check tegaki_work\ui\layer-panel-renderer.js
node --check tegaki_work\ui\animation-table-popup.js
node --check tegaki_work\system\layer-system.js
node --check tegaki_work\system\project-manager.js
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` 差分を残さない。
