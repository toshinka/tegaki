# PROGRESS — 現在状態

更新日: 2026-06-20

> 現在状態、既知残存、次の入口だけを記録する。
> 詳細計画は `開発用資料保管庫/proposals/00_計画索引.md`、
> 完了文書は `開発用資料保管庫/Archive/` を参照する。

## 現在のPhase

Phase 5a、Phase 5b、Phase 5c、Phase 5dは完了。
次はPhase 5eの構造・UIスタイル整合監査。
新チャットは `tegaki_work/PHASE5E_HANDOFF.md` を入口とし、
最初のsliceはSettings / Export popupのUI / CSS監査とする。

## Phase 5d実装状態

### 矩形selection基盤

- `system/pixel-selection-system.js` を追加した。
- selection stateの正本は対象Layer ID、Layerローカルbounds、active、transform session状態とする。
- Mキーと左サイドバーから矩形選択へ切り替える。
- Ctrl+Aでアクティブ通常Raster Layerのキャンバス全域を選択する。
- 選択ツール中は通常strokeを開始しない。通常ツールへ戻すと選択入力を解除する。
- canvas外dragをRenderTexture範囲へclampする。
- SVG polygon overlayは描画pixelへ焼き込まず、pan / zoom / 表示反転 / Layer transform後に再投影する。
- Escape、Layer切替、対象Layer削除、canvas resizeで選択を失効する。
- animation working Layerでは選択を開始しない。

### 基本編集

- Delete / Backspaceでselection内pixelだけを消去する。
- Ctrl+Cはselection内pixelを専用clipboardへ保持する。
- Ctrl+Xはcopy後にselection内pixelを消去する。
- Ctrl+Vはclipboard pixelをfloating selectionとして生成する。
- selectionがある状態のVで選択pixelだけをfloating化し、drag移動する。V再入力で確定、Escapeで取消する。
- 既存Layer変形パネルをselection sessionへルーティングし、移動、scale、rotate、水平・垂直反転、resetを共用する。
- Layer全体変形とselection変形は `system/transform-math.js` の中心基準行列を共有する。
- 移動・貼り付け確定は前後Raster snapshotを1つのHistory commandとして保持する。
- Undo / Redo時はpixelとselection boundsを同時に復元する。
- selection削除は前後Raster snapshotを1つのHistory commandとして保持し、Undo / Redoできる。
- project保存、画像preview、download前に未確定floating selectionを自動commitする。
- Ctrl+Dでselectionを解除する。floating変形中は確定してから解除し、未確定pixelを失わない。
- selection保持中に通常ツールへ戻した場合、ペン、消しゴム、エアブラシ、ぼかし、バケツ、消しバケツ、投げ縄塗りの確定結果をselection範囲内へ制限する。
- バケツは探索開始点と探索領域自体をselection内へ限定し、selection外クリックでは何も変更しない。
- selection変形中のH / Shift+Hは水平 / 垂直反転へ優先ルーティングし、camera反転へ流さない。

### 自動確認

- 矩形drag位置とoverlay位置が一致する。
- H表示反転後にselection polygonが対象pixelへ追従する。
- selection削除 → Undoで対象pixelが復帰する。
- selection移動 → V確定 → Undo / Redoでpixelとselection boundsが追従する。
- selection移動中のEscapeで開始位置へ戻り、History件数が増えない。
- 変形パネルからscale、45度rotate、水平・垂直反転、resetがselection pixelだけへ反映される。
- selection変形確定後のUndo / Redoで変形前後を復元する。
- 出力preview開始時にfloating selectionが自動commitされ、Historyへ1件記録される。
- selectionを跨ぐペンstrokeは範囲内だけが残り、Undo対象も制限後Rasterになる。
- バケツはselection内だけを塗り、selection外クリックではHistoryが増えない。
- selection変形中のH / Shift+Hが水平 / 垂直反転となり、camera反転badgeが出ない。
- Ctrl+Dで通常selectionを履歴追加なしに解除する。
- 選択ツールから既存ペンモードへ戻した場合もselection入力が残留しない。
- `node --check` と `npm.cmd run build` 成功。`dist/`生成差分は除去済み。

### Phase 5d完了境界

- 通常Raster Layerの矩形pixel selection MVPは完了。
- 2026-06-20追補の描画制限、H系反転、Ctrl+D解除まで完了。
- CAF internal Layerは対象外。CAF History adapterとworking Layer同期を同時に設計する後続Phaseまで有効化しない。
- 自由投げ縄、色域選択、feather、perspective / mesh / warpは後続計画へ残す。
- Phase 5d指示書は `開発用資料保管庫/Archive/phase5d.md` へ移動した。

### ショートカット整理

- Layer全体変形の入口はV単独を維持する。
- Vを再入力すると従来通りconfirm、Escapeでcancelする。
- Ctrl+TはChromeの新規タブ予約、T単独は将来のText tool候補のため採用しない。
- 内部互換event名 `keyboard:vkey-state-changed` と既存state名は段階移行のため維持する。
- selectionが存在する時にLayer全体を誤変形しないよう、Vをselection側へ優先ルーティングする。
- Animation Tableの空セルに新規CAFを配置・既存CAFを削除する修飾をAlt+ClickからCtrl+Clickへ変更した。
- アニメ操作全体のCtrl化は通常編集shortcutと衝突するため、最後に操作した領域を正本とするcontext routing設計後に行う。
- Browser確認: Tは未割当、VでLayer変形開始・再入力で確定、Ctrl+ClickでCAF作成、Alt+Clickでは作成されない。

## Phase 5c実装状態

### キャンバス表示反転

- 既存のH / Shift+Hによるcamera水平・垂直反転経路を監査した。
- 反転後のwheel zoom、Space+Shift拡縮、`setZoom()`が負scaleを失う問題を修正した。
- horizontal / vertical flip stateを保ったままscale magnitudeだけを更新する。
- flip、zoom、rotation前後でキャンバス中心の画面位置を維持する。
- 反転中の描画座標はpointer位置と一致し、解除後はLayer内容を変更せず反対側へ戻る。
- 反転中badgeをFutaba paletteへ統一した。

### VキーLayer変形

- 通常Raster Layerのpreview、RenderTexture bake、変形後の描画継続を確認した。
- Escapeで開始時transformへ戻すcancel sessionを追加した。cancelはRasterとHistoryを変更しない。
- canvas dragへpointer capture / cancel処理を追加した。
- Undo時に変形前Snapshotへpreview transformを再適用していたため見た目が戻らない問題を修正した。
- confirm後にclipping maskを再構築する。
- direct数値入力のinline配色をCSS classと既存palette参照へ移した。
- 共有境界を `TRANSFORM_SESSION_BOUNDARY.md` に記録した。

### 自動確認

- H反転中の描画とwheel zoom、H再入力による表示復帰。
- V preview → Escapeで元位置へ復帰し、History件数が増えない。
- V confirm → Undoで元位置、Redoで変形後位置へ復帰。
- V confirm後も通常strokeを追加できる。
- Browser上の新規console errorなし。
- `npm.cmd run build` 成功。

### 実機確認

- 反復変形のRaster劣化を除き、表示反転とV変形の実機確認完了。
- V変形を反復確定した際のRaster劣化。現行はconfirmごとに1回再サンプリングするため、非破壊化は後続設計候補。

Phase 5c指示書は `開発用資料保管庫/Archive/phase5c.md` へ移動した。

## Phase 5b完了

### Frame出力

- `system/animation/timeline-frame-compositor.js` を追加。
- TimelineModel / ClipAsset / DrawingSnapshotからFrame画像列を生成する。
- 連番PNG、APNG、GIF、Export previewが同じcompositorを共有する。
- export中に現在Frame、CAF選択、Layer選択、visibilityを恒久変更しない。
- animation working Layerを通常Layerとして全Frameへ重ねない。
- 空Frameと最終CAF残置を含む出力回帰を修正済み。

### popup stacking

- Album / Export / Resize / SettingsとLayer transform panelを共通overlay rootへmountする。
- `canvas-area` のstacking contextに閉じ込められる問題を解消した。
- 透過・ぼかしの既存デザインを維持する。

### CAF描画履歴

- 描画開始時の全ClipAsset / 全DrawingSnapshot serializeを廃止。
- 対象CAF / internal Layer / 前後DrawingSnapshotだけをTypedArrayで保持する。
- animation working Layerの通常Layer用stroke snapshot取得を省略する。
- CAF切替後のUndo / Redoで対象CAF、Frame、internal Layerへ編集文脈を復帰する。
- 参照されないDrawingSnapshotを回収する。

### History容量

- commandへ `byteSize` 契約を追加。
- 件数上限と推定メモリ上限を適用する。
- Settingsへ自動調整、50/100/250/500件、128/256/512/1024MB、現在使用量を追加した。
- `navigator.deviceMemory` を安全な初期値の参考にし、手動設定をlocalStorageへ保存する。
- History欄のcheckbox、select、option、使用量表示をFutaba paletteへ統一した。

### 確認

- オーナー実機: Frame preview / download成功、最終CAF残置なし、CAF増加後の描画遅延なし。
- ブラウザ: CAF A描画 → CAF B切替 → Undo / RedoでCAF AとFrame 1へ復帰し、描画が消去・再表示される。
- ブラウザ: History使用量表示は `--futaba-maroon`。
- `npm.cmd run build` 成功。

Phase 5b指示書は `開発用資料保管庫/Archive/phase5b.md` へ移動した。

## 既知残存

- Phase 5bの既知残存なし。
- Layer Panel / CAF共通UI、Pointer D&D、押しのけ表示の既知残存なし。
- V変形を複数回確定した際のRaster再サンプリング劣化。
- Phase 5dの既知残存なし。
- 追加修正は実機回帰が出た場合に限定する。

意図的に維持する差:

- 通常LayerとCAF cardの幅、depth、背景等のvariant。
- Backgroundは通常Layer Panel専用。
- data正本とHistory復元先はLayerSystem / ClipAssetで分離。

## 次の入口

### Phase 5e

- 機能Phaseを止める全面リファクタリングではない。
- EventBus、global、History、popup、UI/CSSをsubsystem単位で監査する。
- 全件定数化、全class rename、BasePopup / IDrawingTarget / HistoryCommand classの先行導入は行わない。

## 現在の重要境界

- `tegaki_work/PHASE4Z_BOUNDARY.md` をCAF / Lane / Layer Panel責務の正本として維持する。
- CAF、ClipInstance、Frame / Lane移動はAnimation Table正本。
- Layer Panelは通常Layer / FolderとCAF internal Layer / Folderの編集入口。
- animation working Layerは描画adapterであり保存正本ではない。
- WebGPU、SDF/MSDF、WebGL2 Meshは正式Phaseまで凍結。

## 検証

```powershell
node --check <変更したJSファイル>
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` 差分を残さない。
