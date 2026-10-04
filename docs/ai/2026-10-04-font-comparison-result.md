# フォント比較と応答改善

状態: REFERENCE。実行契約は [WP-024](../work/WP-024-font-comparison.md)、現在地はSTATUS。

## 計測と方針

実Eの27書体をChromiumで計測。cold取得+SHA+FontFaceは最大170ms（851手書き雑28.6MB）、既にロード済みのensureLoadedは0〜0.1ms。warm DOM見本にも120msの固定待機があり約127ms、起動中の文字生成と競合したF910は697ms。毎回Webから再DLしている現象ではない。

Git同梱へ戻さず、FontFace memoryの再利用、見える書体/前後の限定先読み、見本の即時更新を行う。作者資料は展開時に読む。見本hoverは確定paramsや文字画像生成を変更しない。

SVG foreignObjectによる縦/横組版と実体CSS埋込みは維持。同一文字設定のruntime raster cacheは3件・最大32MiB、返却画素はコピー。FontLibraryのCSS文字列は1回生成、作者資料cacheは最大32件・各1MiB以下、再接続時に破棄。新しい永続cacheなし。

## 検証

- warm APIの並列上限2/foreground共有/既読再取得なし/cancel、作者資料dedupe/上限、raster cache画素変異防止/書体CSS変更/evictionを限定verifierで確認。
- 実Chromiumの文字画像（F910/レゲエ、縦/横）で初回84〜170ms、同一request再利用0.1ms。全4例の画素配列一致、非透明字形を確認。
- warm DOM見本の反映処理は実Chromiumで約2〜5ms、状態loaded/familyを同期反映（旧127ms待機）。同一sessionでfont HTTP重複0。coldの初回解析は引き続き必要。
- 比較pageは窓SVGbuttonで開閉。既存左幅180pxの選択欄は開閉前後不変。hoverでparams/localStorage/lettering token不変、click/Enterで選択固定、Escape/再openで選択維持。漫画folderの配下抽出を確認。
- Aあ1とかな主体の短い見本を各書体で表示。元の一軸treeにもAあ1を追加、favoriteは別marker。visible rows/cardとwheel前後のみ先読み、合計並列2、閉じたpageのqueueは停止。
- 初回Browserでblur親（backdrop-filter）が固定paneの包含blockになり位置ずれ/横scrollを発見。既存overlay rootへpaneを移しCSSとfocus guardを調整。幅1600では右640px、900では右508px、430/360では画面内panel。全例でpane/scroll regionがviewport内、left幅はlarge時不変。PNGを目視確認。
- 旧reloadテストの順不一致は初期化途中でfontだけ公開するprojection raceと特定。font+organizationを揃えてatomicに反映、古いrefreshを拒否。実Browserの遅延/逆順fixtureと全27のreload/手動順がPASS。
- 実E全27decode/picker0、既存wheel/keyboard/native D&D/収納/favorite/manual order、Apply/Update/UndoRedo/実Project export-loadを最終統合で確認。構文・fonts5/balloon/shortcut verifier・harness/build PASS。実HTTPの非公開境界も再確認。
- 証拠: ignored `.cache/font-acquisition/font-comparison-ui-results.json`, `lettering-cache-browser.json`, `browser-auto-fonts-results.json`, PNG。元fontはpublic/distへ新規追加なし。

作業中のOwner/external commitでHEADはa78263dbからf245c354へ更新。agent commit/pushなし、既存差分を保持。Owner制作受入・液タブは別判定。

## Owner確認後の調整

Ownerが固定比較pageの実装を確認した後、分類treeに既存 `ui-scrollbar` を適用。実Chromiumでtree/cardsのthumb `rgba(128, 0, 0, 0.32)` とtrack `rgba(233, 194, 186, 0.2)` が一致。専用の色定義は追加していない。

フォント説明cardは「フォント情報・整理」のnative detailsに変更。既存UI設定へ `fontDetailsOpen` を追加し、従来設定の初回は展開、以後は開閉を保持。閉じたまま比較pageで書体選択でき、再読込でも書体と閉じた状態を維持する。実Browserでcard高さ385.5pxから32px、toggleによるparams不変を確認。Enter/Space操作時のCanvas pan横取りを局所イベント境界で防ぎ、両キーで開閉できることを確認。メモ・収納・作者資料などは元のcard内に保持。

構文、fonts5/balloon/shortcut verifier、harness/build PASS。証拠はignored `.cache/font-acquisition/font-feedback-results.json` と `font-feedback-collapsed.png`。未commit/未push、既存差分保持。大きな吹き出しプレビューは調査のみ（Canvasと同じ形・文字・ハンドル操作を重複表示、Canvas overlay OFF時の補助経路として有用）。Canvasを主とし普段は隠す開閉式を提案、今回の変更には含めない。

### 両方の開閉式への追加指示

Owner追加指示で大きな吹き出しプレビューもnative details化。フォント情報と独立して開閉し、`previewOpen` を既存UI設定に記憶する。初回はCanvas overlay ONなら閉、従来のoverlay OFF設定なら開として補助操作経路を残す。重ね表示のcheckboxは折畳みの外。閉じた補助canvasの再描画を省き、Canvas overlayのscheduleは継続、開いた時点で現在値を再描画する。

実Chromiumで初期閉、両独立開閉、params不変、Enter/Space、開/閉それぞれのreload保持、両閉中のCanvasハンドルdrag、再openで最新位置の画素反映、補助previewのハンドルdrag、旧overlay OFF設定のfallback展開を確認。ignored `balloon-collapse-browser.cjs`、`balloon-both-collapsed.png`。構文/balloon/shortcut/harness/build PASS。既存差分保持、未commit/未push、今回操作感のOwner受入は別。
