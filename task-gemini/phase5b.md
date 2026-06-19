# Phase 5b — CAF / Timeline共通Frame出力経路と履歴負荷整理

更新日: 2026-06-19

## 目的

既存のPNG / APNG / GIF出力機能を作り直さず、現在のTimelineModel、CAF、ClipAssetから同じFrame画像列を生成できる共通経路へ接続する。

あわせて、CAF数とDrawingSnapshot数の増加に比例して描画開始・終了が遅延する履歴経路を修正し、アニメ・通常Layer・Timeline操作を同じHistoryへ安全に記録できる土台を作る。

## 調査時点で判明していること

- APNG exporterとGIF exporterは既に存在し、export managerへ登録済み。
- 調査時点ではencoder本体が依存関係へ導入されていなかったため、既存exporterは実行時に停止していた。encoderの再実装ではなく、既存ライブラリを固定依存として接続する。
- 既存exporterは旧 `animationSystem.getAnimationData()`、`applyFrameToLayers()`、`currentFrameContainer` に依存している。
- 現在のCAF編集正本は `ui/animation-table-popup.js` とTimelineModel / ClipAsset側にあり、既存exporterへ接続されていない。
- QuickExportUIはExportPopupへの統合を理由に無効化済み。
- encoder不足に加え、中心課題はCAFから正しいFrame compositeを得る共通入力経路がないこと。
- CAF編集用 `isAnimationWorkingLayer` は選択CAFのライブ表示用ミラーであり、Frame compositorへ通常Layerとして含めてはならない。
- CAFを3枚程度作成して描画を重ねると、ペンダウン後の描画追従が遅れ、ペンを離してから描画されたように見える。
- 主因は `_captureInternalLayerHistoryState()` が描画開始・完了時に全ClipAssetと全DrawingSnapshotを `serialize()` し、RGBAを巨大な通常配列へ同期コピーすること。
- 400×400のSnapshotは1枚64万要素であり、CAF・内部Layer・履歴件数の増加に比例してCPU時間とメモリ使用量が増える。
- 描画更新時に置換前DrawingSnapshotが残り続ける経路もあり、長時間編集で負荷が増加する。
- 現在のHistoryは最大500件の件数制限のみで、Rasterデータの総メモリ量を制御していない。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `開発用資料保管庫/Archive/phase5a.md`
5. `開発用資料保管庫/proposals/01_描画・編集・出力.md`
6. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
7. export managerとPNG / APNG / GIF exporter
8. `tegaki_work/ui/animation-table-popup.js`
9. TimelineModel、ClipAsset、DrawingSnapshotの実装
10. `tegaki_work/system/history.js`
11. `tegaki_work/ui/settings-popup.js`

ファイル名は先に `rg` で確認し、同等のFrame compositorが既にないか検索する。

## Task 1 — 出力対象とFrame合成契約を確定

共通APIは、少なくとも次を入力として扱えること。

- TimelineModel。
- Frame indexまたはFrame範囲。
- 表示対象Lane / CAF。
- キャンバスサイズと背景設定。
- CAF、通常Layer、Backgroundの合成順。
- Frame durationまたはFPS。

出力はexporter固有形式ではなく、Canvas、ImageData、Blob等の中立的なFrame画像列とする。

設計上の条件:

- 画面表示用preview DOMをexporterが直接読み取らない。
- export中に現在Frame、選択CAF、Layer visibility、working Layerを恒久変更しない。
- export失敗・キャンセル時にも編集状態を復元する。
- 1つのFrame compositorを連番PNG、APNG、GIFが共有する。
- 通常の静止画PNG出力は既存挙動を維持する。

## Task 2 — CAF Frame compositorの実装

優先順:

1. 任意の1 FrameをCAF / Timeline正本から正しく合成する。
2. Frame範囲を順番に画像列へ変換する。
3. duration / FPSをmetadataとしてexporterへ渡す。
4. 長いanimationでUIを固めないためのyieldまたは進捗通知を設ける。

既存実装で代用できる場合は新規classを作らず再利用する。
新規moduleが必要な場合も、animation-table-popupのprivate DOM処理を複製せず、データから合成する小さい責務に限定する。

## Task 3 — 段階的なexporter接続

### 3-1. 連番PNGまたはFrame preview

最初に複数Frameを個別PNGとして確認できる経路を作り、Frame順、透明、背景、CAF重なりを検証する。

### 3-2. APNG

既存APNG encoderへ共通Frame画像列とdurationを渡す。
encoder自体の再実装は行わない。

### 3-3. GIF

既存GIF encoderへ同じFrame画像列を渡す。
GIF固有の色数、透明、delay丸めだけをadapter側で扱う。

## Task 4 — 軽量ループpreview

- ExportPopup内で指定範囲を小型previewとしてループ再生する。
- 200px前後を目安にアスペクト比を保持し、大きなRenderTextureを常時保持しない。
- 実出力と同じFrame compositorを使用し、preview専用の別合成を作らない。
- popupを閉じた時、再生timer、Canvas、Frame cacheを解放する。

## Task 5 — ExportPopupの入力整理

- CAF animationが存在する場合は、TimelineModel由来のFrame数とdurationを表示する。
- animationがない場合は静止画exportとして扱う。
- 旧animationSystemだけを前提にしたFrame件数判定を残さない。
- 旧データ互換が必要ならfallbackとして隔離し、新旧の正本を混在させない。

## Task 6 — CAF描画履歴の局所差分化

最優先の追補Taskとする。

### 現状の問題

- CAF内部Layerへ描画するたび、選択CAFだけでなく全CAF・全DrawingSnapshotを履歴用に複製している。
- `DrawingSnapshotModel.serialize()` がpixel bufferを通常配列へ変換するため、ペンダウン時に大きな同期処理が発生する。
- 履歴保存後も参照されなくなったDrawingSnapshotが残る場合があり、編集時間に比例して負荷が増える。
- animation working LayerはCAF専用履歴を使うにもかかわらず、通常Layer用のstroke開始Snapshotを余分に取得している。

### 修正契約

- CAF切替、Frame切替、Lane切替ではHistoryをリセットしない。
- CAF描画履歴は変更対象の次だけを保持する。
  - ClipAsset ID。
  - CAF / Clip ID。
  - 内部Layer ID。
  - 変更前後のDrawingSnapshot。
  - 必要最小限のLayer属性。
- 他CAF、他内部Layer、TimelineModel全体を描画1回ごとに複製しない。
- Pixel bufferは履歴保存時に通常配列へ展開せず、独立したTypedArrayとして保持する。
- Undo / Redo時は対象CAF、Frame、内部Layerを解決し、必要なら編集対象を自動復帰してからSnapshotを復元する。
- `isAnimationWorkingLayer` では通常Layer用のstroke履歴Snapshot取得を省略し、CAF履歴経路だけを使用する。
- Snapshot置換後、どのClipAsset / internal Layer / History commandからも参照されないDrawingSnapshotを回収する。
- 履歴が参照しているSnapshotは回収しない。
- Snapshot texture cacheは全破棄せず、変更・削除されたSnapshotだけを無効化できる構造を優先する。

### History操作分類

1. Raster差分履歴
   - 通常LayerまたはCAF内部Layerの変更前後Snapshotのみ。
   - 描画、消去、塗りつぶし、Raster確定。
2. Model差分履歴
   - CAF移動、duration、visibility、Lane移動等の変更前後値のみ。
3. Structure履歴
   - CAF削除、Layer追加・削除・結合、Folder構造変更等。
   - 復元に必要な部分構造だけを保持する。

本PhaseではCAF描画のRaster差分履歴を必須とする。
Timeline操作全体の完全差分化は、既存操作の回帰を避けるため段階導入でよい。ただし新規実装で全TimelineModel複製を増やさない。

## Task 7 — History容量制御と設定UI

左サイドバーの設定PopupにHistory設定を追加する。

### 設定項目

- 自動調整: 初期値ON。
- 履歴回数:
  - 50 / 100 / 250 / 500。
- 履歴メモリ上限:
  - 128 / 256 / 512 / 1024MB。
- 現在値表示:
  - `履歴: 使用件数 / 上限件数`
  - `使用量: 推定MB / 上限MB`

### 自動設定の初期値

`navigator.deviceMemory` が利用可能なら参考値として使用する。

- 4GB以下: 100件 / 128MB。
- 8GB: 250件 / 256MB。
- 16GB以上: 500件 / 512MB。
- 取得不能: 250件 / 256MB。

手動変更後は手動設定を優先し、設定を既存SettingsManager / localStorage契約へ保存する。

### 容量制御

- 件数上限と推定メモリ上限の両方を適用する。
- 各History commandは概算保持byte数を申告できる契約を持つ。
- 連続stroke等は安全に統合できる場合だけcoalesceし、Raster command自体の保持量を先に抑える。
- 線形Undoの途中にあるRaster履歴だけを選択削除しない。後続Model操作との時系列が壊れるため、上限超過時は最古の連続した履歴区間を先頭から破棄する。
- 軽量なModel差分履歴を長く維持する最適化は、履歴順序とUndo整合を壊さない範囲に限定する。
- 破棄によって現在のHistory index、Undo / Redo可否、ステータス表示を壊さない。
- `performance.memory` は非標準のため必須条件にせず、commandが保持するTypedArray等から推定値を計算する。
- 端末自動設定は安全な初期値であり、根本的な全CAF複製の代替策にはしない。

## 対象外

- APNG/GIF encoderの全面書き直し。
- 動画codec、音声、MP4/WebM。
- TimelineModelやLaneモデルの全面再設計。
- Historyシステム全体の全面置換。
- Timeline全操作を一度に完全な差分commandへ移行すること。
- PSD入出力。
- export中だけ成立するDOM screenshot方式。

## 受け入れ条件

- CAFを含む2 Frame以上のanimationを連番PNGで正しい順序と見た目で出力できる。
- 同じFrame compositorをAPNGとGIFが使用する。
- 指定範囲をExportPopup内でアスペクト比を保ってループ確認できる。
- CAFの重なり、非表示状態、透明、Backgroundが画面上の意図と一致する。
- export前後で現在Frame、CAF選択、Layer選択、visibilityが変わらない。
- animationなしの静止画PNG出力に回帰がない。
- 旧animation dataを残す場合、そのfallback条件がコード上で明確。
- CAFが3枚以上ある状態でも、描画開始からstroke中の線がペンへ追従する。
- CAF描画1回の履歴取得量が、無関係なCAF数に比例して増えない。
- CAFを切り替えてもUndo履歴が維持され、Undo時に対象CAF / 内部Layerが正しく復元される。
- 使用されなくなったDrawingSnapshotが無制限に増加しない。
- Historyの件数・容量上限を設定Popupから確認・変更できる。
- 自動設定と手動設定の優先関係が明確である。

## 検証

- 2 Frame / 2 CAFの最小データ。
- 空Frameを含むデータ。
- 透明背景と不透明Background。
- 非表示CAFを含むデータ。
- 同一Frameで複数CAFが重なるデータ。
- export後に描画を継続できること。
- 同一CAFへ10回以上描画した後のstroke追従。
- 3 CAF以上を切り替えながら描画した後のstroke追従。
- CAF Aで描画、CAF Bへ切替、Undo / RedoしてCAF Aの内容と編集対象が復元されること。
- History上限到達後もUndo / Redo indexとステータス表示が一致すること。
- History設定の再起動後復元。

```powershell
node --check <変更したJSファイル>
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` の生成差分を残さない。

## 完了報告

`tegaki_work/PROGRESS.md` へ以下を記録する。

- 共通Frame compositorの配置と契約。
- 旧animationSystem fallbackの有無。
- APNG/GIFで共有できた範囲。
- CAF描画履歴をどの差分単位へ変更したか。
- DrawingSnapshot回収条件。
- History件数・メモリ上限と自動設定の契約。
- 未対応形式と既知制限。
