# WP-023 — 個人開発用フォントの自動参照

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Ownerが外部接続の自動化と通常接続UIの非表示を指定。

## Goal

個人開発時は E:\Data\TegakiFonts の登録済み書体を接続操作なしで参照する。元実体はGit・公開buildへ含めない。

## Scope

Vite開発server限定のloopback bridge、FontLibraryの自動利用、接続行の非表示、検証。追加DL・公開用同梱選定・履歴書換えは別Slice。

## Contract

- backend worker WRITE: `tegaki_work/build/local-font-bridge.mjs`, `tegaki_work/vite.config.js`, `tegaki_work/system/font-library.js`, `tegaki_work/build/verify-local-font-bridge.mjs`。
- lead WRITE: UI、Browser検証、登録文書。他の既存差分を保持。
- bridgeはserveのみ、preview/buildへ登録しない。serverをloopbackへ制限。loopback remoteAddressとHost、同一Origin/Fetch metadataを検査し、CORS公開しない。外部サイトのfetch、非loopbackHost、任意path、未登録IDを拒否する。
- 固定rootのcatalogに登録済みfont/作者資料だけをID+種類で参照。実pathは正規化・realpathを検査しroot外/symlink逃走拒否。E全体のstatic公開やVite fs.allow拡張禁止。ブラウザへroot絶対pathを返さない。
- serveでのみ注入するruntime設定をFontLibraryが検出し、同一originのbridgeからFile相当を取得。SHA照合、lazy load、既存ID/import/cache/retryを保持。任意URLを登録できる仕組みにしない。
- 自動modeではmanual pickerよりbridgeを優先し、statusにautomatic:trueを返す。既存picker/IDB handle APIを将来公開版用に残す。通常接続行は非表示。ON/OFFは追加しない。
- Project/History/schema/renderer authority不変。

## Tasks

限定bridgeと自動readerを実装し、接続操作ゼロで一覧・見本・reloadが使えることを検証。

## Acceptance

元27書体を許可dialogなしでロード。公開build/previewにbridgeなし。未登録/path traversal/foreign origin/network host拒否。元fontはpublic/dist/Git treeへ追加しない。

## Verification

JS構文、bridge拒否fixtureと実HTTP、既存fonts関連verifier、build/harness、Chromiumで全27 decode・通常UI接続非表示・wheel/見本/reload・Apply。技術証拠とOwner制作受入を分離。

## Stop

広いlocal filesystem公開、保存正本変更、無監査font登録、commit/pushをしない。

## Completion

構文・fonts/balloon verifier・harness/build PASS。実Eの27書体をChromiumでpicker呼出0でdecode、wheel/keyboard/D&D/収納、文字確定とProject/History往復を確認。実HTTPの異origin/Host/未登録ID/path拒否、公開previewで実体と自動設定なし、LAN host指定起動失敗を確認。Vite preflightがpluginより前で応答するためserveのCORSを無効化。Owner制作受入は別判定。切替の応答改善は後続WP-024。
