# WP-022 — 外部フォントと場面別の一軸整理

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Ownerが案A実装を承認。WP-021の既存差分を保持。

接続操作・通常接続UIの後続変更は [WP-023](WP-023-font-auto-local.md)。以下のpicker契約は保持する公開版用APIの説明で、個人開発時は自動bridgeを優先する。

## Goal

元フォントと作者資料を E:\Data\TegakiFonts に保管し、アプリ内の表示フォルダ・手動順で選ぶ。漫画の場面を主分類とする。Project/History/rendererの保存契約と既存fontIdを維持。

## Scope

外部保管・一軸整理・選択操作のみ。大型Explorer、Windows物理移動、追加DL、WARPは対象外。

## Contract

- backend worker: `tegaki_work/system/font-library.js`, 新規 `system/font-organization.js`。UI workerと同じfileを編集しない。
- UI worker: `tegaki_work/ui/balloon-popup.js`, `styles/components/panel-layout-popup.css`, 必要なら新規 `ui/font-tree.js`。
- lead: catalog、移設/取得build scripts、検証、文書。Browserで見つかったtree keyboard競合に限り `ui/keyboard-handler.js` の入力focus guardを追加。既存QTP差分を編集しない。

FontLibraryの `initializeOrganization()` を非同期で待った後、`getOrganization(fontIds = [])` は同期で `{folders:[{id,label,parentId}], placements:{fontId:folderId|null}, orders:{"root"|"folder:ID":["folder:ID"|"font:ID"]}, favoriteFirst:boolean}` を返す。catalog.organizationを初期値とし、UI設定をlocalStorageへ保存。既存importのfolderIdは初回の種にする。

非同期初期化後、同期の `setFontFolder(id, folderId)`, `createOrganizationFolder(label, parentId=null)`, `renameOrganizationFolder(id,label)`, `deleteOrganizationFolder(id)`（子を親へ戻す）, `moveOrganizationNode(nodeKey,parentId,beforeKey=null)`, `setFavoriteFirst(bool)`。変更通知は既存onChange。循環・未知folder拒否。手動順を保持し、favoriteFirstは表示のみ。

`connectExternalDirectory()` はクリックからdirectory pickerを開いてhandleをIndexedDB保存。`getExternalStatus()` は非同期 `{connected, supported, name, permission}`。保存handleは自動requestPermissionせずqueryPermissionで検査。catalog rowは `external:true,file:"Library/ID/file.ttf",licenseFile:"Library/ID/..."`。既存ID/familyを保持しensureLoadedで元fileを読む。`readExternalFile(path)` はFileを返し、作者資料表示にも使用。公開URLへの実体fallbackはしない。importedの旧DB fontは維持。

## UI / Scope

閉じた選択欄上のwheelで前後選択、端で停止、ctrl-wheelは保持。名前は即時、実体previewは約120ms後に最後の選択のみ。開いたtreeでは通常scroll。独自treeの開閉、keyboard、D&D前後並べ替え/収納、収納先select、上下ボタン。favorite上位は任意toggle。folder作成/名称変更/削除は表示分類のみ。外部接続buttonと未接続案内。大型Explorer・Windows物理移動・追加DL・WARPは対象外。

## Tasks

backend/UIの限定Sliceを統合し、既存実体を外部へhash照合付きで移し、公開コピーを除去する。

## Acceptance

既存fontId/Project参照を維持。元実体はGit/build配布対象へ新規追加しない。表示整理は実ファイルを変更しない。

## Verification

純粋modelで順序、reload、cycle拒否、folder削除、favorite表示を検証。外部handleのpermission/欠落/retryと既存ID・importを検証。JS syntax、既存balloon verifier、build、実操作Browserでwheel/tree/収納と文字適用・Project往復を確認。E複製hash確認後に公開元fontを除去しbuild内binaryゼロを確認。実機picker/液タブ・Owner受入をheadless証拠と混同しない。commit/pushはOwner。

## Stop

Project/History/renderer保存正本の変更、物理実体の独自改変、未監査fontの自動導入を行わない。既存Git履歴の書換え/pushはOwnerへ返す。

## Completion

関連verifier/buildとChromium（全27decode、tree/wheel/D&D/収納、実Project/History、本人import）技術確認済み。公開元実体83ファイル・取得cache101ファイルはEへhash照合付きで移設。public/distの元fontゼロ。実E picker・OS再許可・液タブ・制作受入は未確認。[結果](../ai/2026-10-04-font-organization-result.md)。外部commit/push a78263dbの現行GitHub treeも元fontなし。9d8a9f5bの過去履歴には元fontが残り、履歴書換え/残る最終差分pushはOwnerへ返す。agentからcommit/pushなし。
