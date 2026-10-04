# WP-024 — フォント比較と応答改善

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Ownerがホイール切替の応答改善と右側見本pageを指定。

## Goal

読み込み済み書体を即座に比較し、左の吹き出し編集を保ったまま右pageでフォントを選ぶ。

## Scope

runtime先読み/cache、見本表示、右比較page。実体移設/追加DL/Project schema/renderer組版方式の変更は行わない。

## Contract

- UI worker WRITE: `tegaki_work/ui/balloon-popup.js`, `tegaki_work/ui/font-tree.js`, `tegaki_work/ui/font-comparison.js`（必要なら新規）, `tegaki_work/styles/components/panel-layout-popup.css`。既存dirty font-treeを保持。
- lead WRITE: `system/font-library.js`, `system/lettering-raster.js`、限定verifier/Browser、文書。並列同file write禁止。
- worker handoff後のBrowserで判明した配置/scroll/async統合修正はleadが担当。blur親から比較paneを既存overlay rootへ出し、関連CSSと `ui/keyboard-handler.js` の比較focus guardを限定変更する。
- backend追加API `getLoadedFont(id)` は同期entry|null（読み取り用）、`warmFonts(ids,{concurrency=2,shouldContinue=()=>true})` は非同期、ensureLoaded共有、queue停止可能、連続先読みは最大2。font取得は現在のlocal bridge/importedルートを維持。新しい永続cache/ON-OFFなし。
- 左page/既存編集を保つ。現在の閉じた選択欄のwheel維持。隣に窓SVGの比較button（label/tooltip/aria-expanded）を置き右page開閉。▼の狭いtreeも残してよい。大画面では右隣、狭い画面ではviewport内に収まる下段または専用panel。popup drag/D&D/keyboardを維持。
- 右pageには現行の分類treeと見本一覧。treeフォルダ選択でその配下を表示、rootは全書体。名前、Aあ1、小見本、短評を比較できる。favorite★は別に保つ。sampleが未loadなら未読込表示、実際に使っていないfamilyでロード済みと偽らない。漢字を必須にしない。
- hover/focusは右page見本だけを一時表示、params/selected font/保存/Historyを変えない。click/Enterで選択固定し左と同期、pageを閉じない。mouseleaveは固定selectionの表示へ戻す。wheelは既存通り選択する。
- getLoadedFontがあれば見本は待機120msを挟まず即表示。未読込は短いcoalescing、成功した見本を毎回文字placeholderへ戻さない。見える書体・wheel前後少数だけwarm、hidden pageで全27先読みしない。tokenでstale更新を拒否。
- 作者資料の取得はdetailsを開くまで待つ（開いた場合は既存表示を維持）。leadは資料のmemory cacheを追加。Canvas文字生成は選択が落ち着いてから、hoverでは呼ばない。schedule時にstale jobを無効にする。必要ならwheel操作時だけ文字生成を240msに遅延（Apply/Updateは現在値を確実にflush）。
- canonical SVG foreignObject文字組版とfont埋込みは維持。leadは同一requestの小さなruntime raster cacheを追加し、他者が画素配列を変更してもcacheが壊れないようにする。
- UI非同期のold snapshotが手動順を戻さないことを確認。Project/History authority不変。

## Tasks

計測根拠で先読みとwarm見本を改善し、比較pageを統合する。

### Owner確認後の限定調整（2026-10-04）

Ownerが比較pageの実装を確認。leadが `ui/font-comparison.js` の分類treeに共通 `ui-scrollbar` を適用し、`ui/balloon-popup.js` の既存フォント情報cardをnative details化する。開閉状態は既存UI設定にbooleanを追加して保持、選択/収納/メモ/比較/文字確定とProject schemaは不変。CSSは共通detailsの装飾を再利用する。Browserで共通配色・開閉/keyboard/reload/選択切替を確認、構文/関連verifier/build。大きな吹き出しpreviewの削除・開閉は意見を求められた別件として調査のみ。

## Acceptance

Ownerの追加指示（2026-10-04）でフォント情報と大きな吹き出しpreviewの両方を開閉式にする。leadが `ui/balloon-popup.js` のpreviewと操作hintを共通native detailsへ包み、既存UI設定に `previewOpen` を保存。初回はCanvas overlay ONなら閉、OFFなら開。overlay toggleは折畳みの外に残す。閉じたpreviewの再描画を省き、Canvas overlayの更新は維持。開いた瞬間に現在値を描画。summary keyboardは局所でCanvasへの伝播を止める。Browserで両独立開閉/記憶/Canvas操作/preview操作と最新値反映、構文/balloon/shortcut/buildを確認。Project/History authorityは不変。

warm見本に強制120ms待機なし、再選択でfont HTTP再取得なし。右pageでtree・文字見本比較、hoverでparams不変、clickで固定、閉じても選択維持、viewport overflowなし。Apply/Update/Project/History互換。

## Verification

syntax、fonts/balloon/lettering verifier、harness/build。Chromiumでcold/warm比較、request回数、hover/commit/tree/keyboard、large/narrow viewport、実画素とProject/Historyを検証。

## Stop

Canvas2D独自縦組版、font改変、Git実体再導入、大型Explorer、保存正本変更、commit/push禁止。

## Completion

技術検証完了。warm DOM見本の同期反映は実Chromiumで約2〜5ms（旧127ms固定待機）、同一文字画像再利用0.1ms。左幅不変、右pageのhover不変/click固定、folder filter、keyboard/開閉、1600/900/430/360px viewport、ツリーAあ1、font再取得ゼロを確認。実E全27decode、既存D&D/収納/favorite/手動順reload、文字確定/更新/UndoRedo/実Project往復PASS。初期化projectionをatomicにして、old refresh拒否の実Browser fixtureも確認。構文・fonts/balloon/shortcut verifier・harness/build PASS。Owner制作/液タブ受入は未実施。[結果](../ai/2026-10-04-font-comparison-result.md)。元fontはE、Git実体追加なし、agent commit/pushなし。
