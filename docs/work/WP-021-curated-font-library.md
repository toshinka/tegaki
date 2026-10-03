# WP-021 選定フォントの取得・ライブラリ導入

状態: TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Owner依頼: 2026-10-03。最終制作受入・pushはOwner。

## Goal

先行8書体を取得し、公式条件と取得物のLICENSE/readmeを照合してTegakiの吹き出しから使えるようにする。個性のあるカワイイ/ポップ/クール/MV/手書き候補を独立read-onlyバッチで監査し、上位の許諾明確なものだけ追加取得・登録する。他は後でOwnerが選べる監査リストへ残す。かな専用は用途に応じて採用可能。

Ownerはこの依頼でフォント取得と製品導入を承認した。WP-013の「同梱しない」は当時の実装範囲であり、本Cardでは許諾を確認した選定フォントのみ同梱する。新しいProject保存正本は作らない。

## Scope

文字タブ移設、曲線上文字、エンベロープ/WARP、楕円/多角形ツールは別件。今回実装しない。導入当時の同梱/自動favoriteソート契約は、Owner案A承認後にWP-022の外部参照/任意表示ソートへ更新する。

## WRITE / ownership

- Parent: `tegaki_work/public/fonts/**`（catalog.json、元フォント、ライセンス）、取得/監査資料、Card/STATUS/登録簿、検証記録。
- Library worker: `tegaki_work/system/font-library.js`、`tegaki_work/ui/balloon-popup.js`、`tegaki_work/styles/components/panel-layout-popup.css` のフォントUI部分、新規 `tegaki_work/build/verify-curated-font-library.mjs`。
- Independent investigators: 指定候補のWeb読取りのみ、writeなし。同じfileへの並列writeなし。

開始HEAD `b7d7fddfa9f77ce1a8f2b703c03a7f6a2f330bd3` / main。既存QTP/STATUS/文書差分を保持。

## Contract

- `public/fonts/catalog.json`: `{version:1, primaryId, fonts:[...]}`。各rowは `id,label,family,file,ext,category,tags,comment,sourceUrl,licenseUrl,licenseFile,coverage,dakuten,sha256,size,version`。file/licenseFileはfonts配下の相対path。catalogを一度だけ取得し、フォント実体は選択/可視見本時だけロードする。
- 同梱rowは `bundled:true` とし、一覧でユーザー取り込みと区別する。既存 `fontKind:'imported'` / `fontId` 参照経路を使い、追加kindや保存schemaを作らない。ファイル参照は同一originのみ。実体はProject/History/環境スナップショットへ入れない。
- `ensureLoaded` / `getEmbedCss` は同梱と取り込みの両方に対応する。非同期ロードを重複させず、失敗でキャッシュを成功扱いしない。ユーザー取り込み/フォルダは既存互換を維持する。
- フォント選択UI: 同梱カテゴリ、短評、選択中のお手本、適用できる選択、favoriteチェックとfavorite優先の安定ソート、Primary指定。ユーザー短評を編集可能にし、調査短評とは分ける。表示中の選択見本のみ実体ロードし、全行のfontを一括ロードしない。スロットは今回未実装。
- favorite/Primary/ユーザー短評はブラウザのUI設定（localStorage）として保存し、取得したフォントやProjectの内容を変更しない。既存の作品/ユーザー設定を新しいPrimaryで無条件に上書きしない。保存設定がない初回の吹き出しでのみcatalog.primaryIdを既定選択する。
- 同梱フォントを取り込みフォルダへ移動/削除するUIは出さない。ライセンス/作者リンクを表示する。既存ユーザーfont操作を壊さない。
- 最小プレビューはかな/漢字混在。かな専用はcoverage表示で明示し、漢字対応を偽らない。濁点の作者説明・実体検査・Browser実測を別に記録する。
- パレット/semantic tokenは既存ふたば配色。DOMへのユーザー文字はescape/textContent。

## Tasks

一次許諾の監査、元実体/資料取得、metadata登録、既存吹き出しへの導入と検証。

## Acceptance

取得元/許諾と元実体の対応を保持し、既存fontId/Project参照で再編集できること。

## Verification

- JS構文、関連balloon verifier、新規の有意味なbehavior verifier、Vite build、文書link/diff check。
- 新verifierはメタデータ一覧だけで実体をfetchしないこと、同じfont並行loadが一件になること、失敗の再試行、favorite/Primary/短評のsanitize・安定ソート、取り込みとの共存を検証する。単なる実装文字列の照合にしない。
- Browser: 先行8書体と追加上位のロード、選択見本、favoriteソート・再読込、Primary、取り込み・フォルダ操作、縦/横の吹き出し確定・再編集・Undo/Redo・Project save/load。font欠落をfallback成功と混同しない。Owner液タブは別。
- LICENSE/readme/source/version/hashを保持。フォント改変・形式変換はこのCardで行わない。不要なウェイト/同じ役割の全variationを搭載しない。

## Stop

商用不可、必須SNS、許諾不明、実体とWeb規約の矛盾、配布休止は保留へ。生成物・秘密情報・第三者画像を成果へ混ぜない。
長時間担当は完了通知を優先し、巡回は10〜15分。親は独立作業を進め、同じ全文logを繰り返し読まない。画像hash/OCR等の機械抽出結果は再利用する。

## Completion

先行8＋追加19＝27書体を取得・同梱。Primary源暎アンチック。元実体decode NG 2件を除外し、その他の未取得候補を[監査記録](../ai/2026-10-03-curated-font-audit.md)へ残した。構文・curated/balloon verifier・harness・build PASS。Chromium Browserで全27実体、選択見本/設定保持、実確定/再編集/UndoRedo/Project export→load、本人import/folder、失敗表示/retry PASS。Owner液タブ/全字形/最終制作受入は未実施、pushなし。
