# Phase 5l — 大容量CAFの保存・復元・Export安定化

更新日: 2026-06-27
状態: 開始

## 目的

Phase 5kで多枚数CAF作成中のruntimeクラッシュ懸念は大きく低減した。次は、大容量CAFをProject保存、Album保存、Project復元、Exportへ通した時に、保存serialize、JSON化、thumbnail/preview生成、復元時working Layer再構築がボトルネックまたは破損源にならないかを確認し、必要な範囲で改善する。

Phase 5lの主対象は「作成中の安定性」ではなく「保存・復元・出力境界の安定性」。Phase 5kで意図的に残した `DrawingSnapshotModel.serialize()` の `Array.from(pixels)` と、`ProjectManager.exportProject()` のCAF payload生成を最初の調査入口にする。

追加観測:

- 肥大化したアニメは、保存時にディレイしたり、時にはクラッシュすることがあった。Phase 5lではこの症状をProject保存/Album保存のserialize・JSON化負荷として優先確認する。
- Album表示で `Album 801.6 MB (25件) / ブラウザ 120.4 MB / 10.12 GB` のような状態が観測された。これは「ブラウザquota超過」ではなく、Tegaki側が保持しているAlbum payload概算が大きいという意味で読む。実使用量に余裕があっても、Album一覧で全snapshotの `projectData` を読み込む・JSON化する・JS heapへ展開することは、通常描画中のGCや保存時クラッシュに影響し得る。
- 単にAlbum内で通常作品とCAFをタブ分けしても、巨大CAF本体をIndexedDBへ入れ続ける限り負荷源は残る。Phase 5lでは、大容量CAFを「Album本体へ保管する」から「外部ファイル保存を標準とし、Albumは参照カード/最近使った一覧へ寄せる」方向へ計画を更新する。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `task-codex/phase5l.md`
5. `開発用資料保管庫/Archive/phase5k.md`
6. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
7. `開発用資料保管庫/proposals/05_長期研究_AI・WebGPU・物理.md`
8. `tegaki_work/system/project-manager.js`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/ui/album-popup.js`
11. `tegaki_work/ui/export-popup.js`
12. `tegaki_work/system/export-manager.js`
13. `tegaki_work/system/album-storage.js`
14. `tegaki_work/core-engine.js`
15. `tegaki_work/system/keyboard-shortcut-manager.js`

## 境界

やること:

- 大容量CAFのProject保存/復元、Album保存/復元、PNG/APNG/GIF export前後の負荷と破損を確認する。
- `TimelineModel.serialize()` と `DrawingSnapshotModel.serialize()` の保存時コストを計測する。
- 保存形式を変えずにできる軽量化、進捗表示、保存前未確定状態commit、不要重複の削減を優先する。
- Album一覧を軽量化し、通常表示時に全snapshotの巨大 `projectData` を常駐/JSON化しない。
- CAFを含むProjectは、最新Chromium向けのFile System Access APIを第一候補として、外部ファイルへ保存・上書きできる導線を作る。
- Ctrl+Sは、CAF/Animation Tableを含むProjectでは外部ファイル保存を優先し、保存済みhandleがある場合は上書き保存と短いtoast表示で済ませる。
- Albumは通常作品の軽量保管を維持しつつ、CAFについてはthumbnail、タイトル、更新日時、保存先handle/参照情報だけを持つ「参照カード」へ段階移行する。
- 破損やクラッシュの原因が保存payloadサイズにある場合は、互換を壊さない段階移行案を実装する。

やらないこと:

- WebGPU有効化。
- Project保存形式の全面変更。
- LayerSystemとTimelineModelの統合。
- CAF internal Layerへの通常Layer History接続。
- 無限キャンバス / tile方式の本格導入。
- Chromium以外のブラウザ互換を優先すること。Phase 5lでは最新Chromium系へ寄せてよい。
- CAF保存のためにAlbum IndexedDBへ巨大projectDataを追加し続けること。

設計判断:

- `Album xxx MB` はTegaki側の概算payloadであり、`navigator.storage.estimate()` のusage/quotaとは一致しない。表示上は両者を混同しない文言にする。
- 大容量CAFの標準保存先は、ブラウザ内部Albumではなくユーザー指定のファイルシステムとする。
- 通常作品は従来Album保存を維持してよい。ただしAlbum一覧は軽量metadata読み込みを優先し、詳細projectDataは復元時だけ読む。
- File System Access APIが使えない環境では、従来のdownload保存へfallbackする。fallback時も再exportを避け、capture済みprojectDataを再利用する。
- 外部ファイル保存はProject JSON互換を維持する。保存形式の全面Blob化や差分保存は後続Phase候補に留める。

## Slice 1 — 固定入力で保存payloadと時間を測る

最初のsliceは実装より計測を優先する。

実装状態:

- `ProjectManager.exportProject({ profile: true })` で、Project保存形式を変えずに非列挙の `__exportProfile` を返すようにした。
- `ProjectManager.profileProjectExport()` を追加し、ダウンロードせずに `exportProject` と `JSON.stringify(projectData)` まで計測できるようにした。
- Project保存時のanimation serializeは `TimelineModel.serialize()` 一括呼び出しではなく、同じpayload形状をProjectManager側で組み立て、DrawingSnapshot serialize中に短いyieldを挟むようにした。
- profileへ `animationSerializeYields` を追加し、保存ディレイ緩和のために何回ブラウザへ制御を返したか確認できる。
- `TEGAKI_CONFIG.debug === true` の時だけ、Project保存とAlbum snapshot保存のprofileをconsoleへ出す。
- Album snapshot側はprojectDataサイズ、thumbnail文字数、project export時間、thumbnail生成時間、JSON.stringify時間をdebug時だけ集計する。
- Album popupへ保存領域表示を追加し、Album内概算サイズ、件数、ブラウザorigin全体の `navigator.storage.estimate()` 使用量/上限を見えるようにした。
- Album保存前のProject payload概算が100MB以上の場合は、Album保存かファイル保存かを確認する。ファイル保存はcapture済み `projectData` を再利用し、再exportによる二重負荷を避ける。

固定入力:

- 400x400 / 120F / 5 internal raster Layer
- 800x800 / 60F / 3 internal raster Layer
- 1200x1200 / 30F / 3 internal raster Layer
- 可能なら 1200x1200 / 100F / 1 internal raster Layer

計測対象:

- `ProjectManager.exportProject()` 全体時間
- `TimelineModel.serialize()` 時間
- `DrawingSnapshotModel.serialize()` のsnapshot数、pixel総byte、`Array.from(pixels)`後の概算要素数
- `JSON.stringify(projectData)` 時間と文字列長
- Album保存時のprojectDataサイズとthumbnailサイズ
- loadProject後のCAF DOM、working Layer、selected clip/internal Layer復元
- Export前後のcurrentFrame、selected layer、preview/onion、working Layerの破損有無

受け入れ:

- Project保存/Album保存/Project復元/export前後でCAF内容が保持される。
- 保存・復元中にconsole errorを出さない。
- どの処理が支配的か説明できる。
- 計測用ログを残す場合は `TEGAKI_CONFIG.debug` 配下に限定する。

## Slice 2 — 保存互換を維持した軽量化

Slice 1の結果と実機報告から、Album常駐payloadの軽量化を優先する。

実装状態:

- `AlbumStorage` をversion 2へ更新し、既存 `snapshots` storeとは別に `snapshotMetadata` storeを追加した。
- metadataにはid、order、timestamp、thumbnail、currentFrame、projectData有無、thumbnail/project/合計概算byteを保存する。
- 既存Albumは初回だけ `snapshots` からmetadataをバックフィルする。
- Album popupの初期表示、通常一覧、選択、削除、並べ替え、保存領域表示はmetadata/thumbnailだけを読む。
- 復元とAlbum HTML export時だけ、選択IDから本体snapshot/projectDataを読む。
- Album保存領域表示を `Album概算` に変更し、Tegaki側payload概算とブラウザorigin usage/quotaを混同しないようにした。
- 新規保存、import、delete、sortはmetadata storeも同期する。

候補:

- `albumStorage.getAllSnapshots()` とは別に、一覧用metadata/thumbnailだけを返すAPIを追加する。
- Album popupの通常表示では、全snapshotの `projectData` を読み込まない。
- 保存領域表示は、一覧用metadataに保存済みsizeを持たせ、表示のたびに全projectDataを `JSON.stringify()` しない。
- 既存snapshotは互換のため読めるようにするが、次回保存/並べ替え/移行時にmetadataを補完する。
- 復元時だけ指定snapshotのprojectDataを読むAPIを追加する。
- batch delete、sort、import/exportでmetadataとprojectDataの対応を壊さない。

受け入れ:

- Album popupを開いても、巨大CAF projectDataを全件JS heapへ展開しない。
- Album件数、thumbnail、選択、削除、並べ替えが維持される。
- 既存Albumデータを読める。
- 通常作品のAlbum保存/復元は従来通り動く。
- 大容量CAFの保存領域表示が、概算payloadとブラウザusage/quotaを混同しない。

## Slice 3 — CAF外部ファイル保存とCtrl+S導線

CAF/Animation Tableを含むProjectでは、Album保存ではなく外部ファイル保存を標準にする。

実装状態:

- `ProjectManager.quickSave()` を追加し、現在ProjectにCAF/animation dataがある場合だけ外部Project保存を処理する。
- Ctrl+Sは先に `ProjectManager.quickSave()` を呼び、CAF/animation dataがなければ従来どおりAlbum quick saveへfallbackする。
- 最新Chromium系で `showSaveFilePicker()` が使える場合、初回Ctrl+Sで保存先を選択し、以後は保持した `FileSystemFileHandle` へ上書き保存する。
- 保存先handle取得は重いProject export前に行い、ユーザー操作のtransient activationを失いにくくした。
- File System Access APIが使えない環境では、従来download保存へfallbackする。
- 保存完了は `project-save-toast` の短い表示にした。
- ショートカット説明は「現在の状態を保存」へ変更した。

実装候補:

- `ProjectManager` に保存先handleを保持する軽量stateを追加する。
- `saveProjectDataToFile(projectData)` を拡張し、File System Access APIが使える場合は `showSaveFilePicker()` と `FileSystemFileHandle.createWritable()` で保存する。
- 初回保存は保存先選択、2回目以降は同じhandleへ上書き保存する。
- handleが失効した場合は再選択へfallbackする。
- File System Access APIが使えない場合は従来download保存へfallbackする。
- Ctrl+SはProject内にCAF/animation dataがある場合、外部ファイル保存を優先する。
- 保存完了はalertではなく短いtoast/status表示にする。
- 設定で「Ctrl+S時に毎回別名保存」または「上書き保存」を選べる余地を残す。初期実装は上書き優先でよい。
- AlbumでCAFを保存する場合は、巨大projectData本体ではなく、thumbnail、タイトル、更新日時、保存先参照を持つカードに寄せる。

受け入れ:

- CAFを含むProjectでCtrl+Sし、初回は保存先を選べる。
- 2回目以降のCtrl+Sは同じ保存先へ上書きされ、短い「保存しました」表示で完了する。
- 保存直前に未確定selection / working Layerがcommitされる。
- 保存後に描画、Frame移動、Undo/Redoが壊れない。
- File System Access API不可環境ではdownload fallbackが動く。
- Album保存へ逃がした場合でも、大容量CAFを無警告でIndexedDBへ積み増さない。

## Slice 4 — Album参照カード化と既存データ移行方針

Slice 2-3の後、CAF Albumの扱いを整理する。

実装状態:

- CAF/animation dataを含むProjectでAlbum保存ボタンを押した場合、AlbumへprojectData本体を保存せず、先に外部Project保存を行う。
- File System Access APIで保存先handleを保持できた場合だけ、Albumにはthumbnail、timestamp、fileName、fileHandle要約を持つ参照カードを保存する。
- download fallbackしかできない場合は、読み戻せない参照カードを作らず、外部ファイル保存だけで完了する。
- Album metadataへ `projectReference` 要約を追加し、参照カードをFILEバッジ付きで表示する。
- 参照カード復元時は保存先fileHandleからProject JSONを読み、`ProjectManager.loadProject()` へ渡す。
- Album importでTegaki Project JSONを選んだ場合はAlbumへ追加せず、Album popupを閉じて直接 `ProjectManager.loadProject()` へ渡す。
- Project JSON import後はfile名を現在保存先表示へ反映する。ただしfile input経由ではFileSystemFileHandleを得られないため、次回Ctrl+Sでは保存先選択が必要。
- Album popupへ現在のProject保存先表示と保存先再選択ボタンを追加した。

実装候補:

- Albumに通常作品タブ/CAF参照タブを追加する場合は、データ実体も分ける。見た目だけのタブ分けで巨大projectDataを同じ一覧へ常駐させない。
- CAF参照カードは、projectData本体を持たず、thumbnail、name、updatedAt、frame/layer概要、fileHandle参照可否、fallback file nameを表示する。
- 既存の巨大CAF snapshotは削除しない。ユーザー操作で外部ファイルへ退避し、退避成功後にAlbum内projectDataを軽量参照へ置換できる導線を検討する。
- ブラウザがfileHandleを永続復元できない/権限が切れた場合は、カードからファイル再選択できるようにする。

保存形式の全面変更、Blob化、差分保存、クラウド同期はPhase 5lでは採用判断までに留める。

## 検証

```powershell
node --check tegaki_work/system/project-manager.js
node --check tegaki_work/system/animation/animation-data-model.js
node --check tegaki_work/ui/album-popup.js
node --check tegaki_work/ui/export-popup.js
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
