# WP-022 — 外部フォントと場面別の一軸整理

状態: ACTIVE / Ownerが案A実装を承認。WP-021の既存差分を保持。

## Goal

元フォントと作者資料を E:\Data\TegakiFonts に保管し、アプリ内の表示フォルダ・手動順で選ぶ。漫画の場面を主分類とする。Project/History/rendererの保存契約と既存fontIdを維持。

## Ownership / API

- backend worker: `tegaki_work/system/font-library.js`, 新規 `system/font-organization.js`。UI workerと同じfileを編集しない。
- UI worker: `tegaki_work/ui/balloon-popup.js`, `styles/components/panel-layout-popup.css`, 必要なら新規 `ui/font-tree.js`。
- lead: catalog、移設/取得build scripts、検証、文書。既存QTP差分を編集しない。

`getOrganization(fontIds = [])` は `{folders:[{id,label,parentId}], placements:{fontId:folderId|null}, orders:{parentId:["folder:ID"|"font:ID"]}, favoriteFirst:boolean}` を返す。rootのorders keyは `root`。catalog.organizationを初期値とし、UI設定をlocalStorageへ保存。既存importのfolderIdは初回の種にする。

非同期初期化後、同期の `setFontFolder(id, folderId)`, `createOrganizationFolder(label, parentId=null)`, `renameOrganizationFolder(id,label)`, `deleteOrganizationFolder(id)`（子を親へ戻す）, `moveOrganizationNode(nodeKey,parentId,beforeKey=null)`, `setFavoriteFirst(bool)`。変更通知は既存onChange。循環・未知folder拒否。手動順を保持し、favoriteFirstは表示のみ。

`connectExternalDirectory()` はクリックからdirectory pickerを開いてhandleをIndexedDB保存。`getExternalStatus()` は非同期 `{connected, supported, name, permission}`。保存handleは自動requestPermissionせずqueryPermissionで検査。catalog rowは `external:true,file:"Library/ID/file.ttf",licenseFile:"Library/ID/..."`。既存ID/familyを保持しensureLoadedで元fileを読む。`readExternalFile(path)` はFileを返し、作者資料表示にも使用。公開URLへの実体fallbackはしない。importedの旧DB fontは維持。

## UI / Scope

閉じた選択欄上のwheelで前後選択、端で停止、ctrl-wheelは保持。名前は即時、実体previewは約120ms後に最後の選択のみ。開いたtreeでは通常scroll。独自treeの開閉、keyboard、D&D前後並べ替え/収納、収納先select、上下ボタン。favorite上位は任意toggle。folder作成/名称変更/削除は表示分類のみ。外部接続buttonと未接続案内。大型Explorer・Windows物理移動・追加DL・WARPは対象外。

## Verification / Acceptance

純粋modelで順序、reload、cycle拒否、folder削除、favorite表示を検証。外部handleのpermission/欠落/retryと既存ID・importを検証。JS syntax、既存balloon verifier、build、実操作Browserでwheel/tree/収納と文字適用・Project往復を確認。E複製hash確認後に公開元fontを除去しbuild内binaryゼロを確認。実機picker/液タブ・Owner受入をheadless証拠と混同しない。commit/pushはOwner。
