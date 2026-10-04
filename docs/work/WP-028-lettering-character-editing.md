# WP-028 — 漫画文字の書体集約・文字別編集・第二フチ取り

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。2026-10-04 Ownerが追加設計の実装開始と第二フチ取りを指示。開始main/f245c354。既存dirtyと独立WP-026を保持。最終制作受入・pushはOwner。[検証記録](../ai/2026-10-04-lettering-character-editing-result.md)。

## Goal

[追加設計](../ai/2026-10-04-manga-panel-workflow-design.md)を実装する。通常Raster＋optional再編集recipe、画素fingerprint、1commit/1History、1x出力、手描き後の更新拒否を維持。正式Vector Layer・CAF/Anime・SOURCE/ANIMATE terminal・RIGを変更しない。比較画面を見本/情報整理に分け、文字を書式/配置/変形/文字別の4tabへ。新機能の受入とWP027の旧証拠を分離する。

## Contract

既存`lettering.version: 1`内のparamsへ後方互換のoptional属性を追加。欠損時は旧描画と同じ。既存Project schemaと保存正本は維持する。新属性を含むrawはfinite/range/色/文字境界を厳密検査し、malformedを黙って既定の作品へ変えない。

- `outerStrokeWidth: 0..64`（追加する外側の厚さpx）、`outerStrokeColor: #rrggbb`。外側線のfull strokeは`strokeWidth + 2*outerStrokeWidth`。外→内→fillの順に全glyphを描き、別文字の外側strokeで前の文字fillを覆わない。0なら旧描画。bounds/preview/PNG/CPU fallbackに同じ線を反映。
- `sizeProfile: null | { mode: 'ends'|'three', start, mid, end }`、倍率0.125..8。行のgrapheme/cluster読み順0..1で区分線形、1単位はstart。新profileではadvanceも再計算。null時は旧fontSize/endFontSizeの評価を保持。
- `characterStyles: [] | [{ start, end, ...attributes }]`。唯一の本文textに対するUTF-16 grapheme境界の非重複範囲、最大2000。属性は任意の`fontId`（importedのみ）、`color`, `size`（倍率0.125..8）, `rotation`（rad）, `scaleX/scaleY`（符号付き0.01..20）, `offsetX/offsetY`（接線/法線px、±8192）, `envelope`（既存有界preset/9点）。未指定は全文の値を継承。font実体/選択/cache/outlineを保存しない。
- 文字選択はgrapheme→HarfBuzz cluster対応。合字は回転/変形でcluster全体を選択。書体runは境界で再組版、同書体連続文字のkerningを維持。code pointとUTF-16の変換を明示。
- insertion/deletion/replacementはbeforeinput/IME対応で範囲を再対応。内部挿入は指定を継承、境界挿入は既定、削除は縮小/除去、置換は先頭指定を継承。連続する同属性はまとめ、本文の同文字検索で指定を移さない。
- 全体envelopeは既存kindを維持。外へ膨らむpresetは既存9点へ展開。point dragは有界[-4,4]を許可、変形前枠を固定して操作する。

## Scope

- Geometry/model worker: `system/lettering-model.js`, `system/lettering-font-engine.js`, `system/lettering-vector-renderer.js`, 新規`system/lettering-character-styles.js`、関連renderer/model純粋verifier。新属性/文字範囲helper/組版/色別SVG・CPU/第二strokeを担当。UI/Layer/Projectはwriteしない。
- Font UI worker: `ui/font-comparison.js`, `ui/balloon-popup.js`のfont情報接続、`styles/components/panel-layout-popup.css`のfont-comparison部分、新規font比較fixture/verifier。comparisonへ既存information DOMをmountするAPI、mode別D&Dとtarget label。文字popup/lettering CSSはwriteしない。
- Lead: `ui/lettering-popup.js`, `ui/lettering-overlay.js`, `styles/components/lettering-popup.css`、必要なkeyboard入力route（局所）、文書/登録/harness、Browser fixture、統合と検証。workerの完了だけでcloseしない。
- 各workerは他者と同じcheckoutにいる。既存差分・他者writeを巻き戻さない。独立WP026の4proof files/report/port18726は対象外。

## APIs between slices

`lettering-character-styles.js` exports `segmentLetteringText(text)` returning `{start,end,text,line,index}` units, `characterStyleAt(styles,start)`, `applyCharacterStyle(text,styles,start,end,patch)`（null属性は解除）, `remapCharacterStyles(oldText,newText,styles,edit?)`、`profileScale(profile,progress)`。helpersは有界/非重複の出力。renderer pathsは既存`d/fill/stroke`を保持し、新たに`start/end/bounds/anchor`を返す（文字local、全体envelope適用後、placement前）。clusterとUTF-16を明示。outerStrokeのSVG情報をoverlayも同じSVGで利用。

`FontComparison.attachInformation(element)`、`setMode('samples'|'information')`、`setTargetLabel(label)`を追加。informationはcallerの既存DOM/イベントを使う。`onMove` constructor callbackをmode情報整理のtreeからだけ呼ぶ。hoverは見本だけ、commitでcallerへ選択を返す。

## Interaction / layout

316px glass/11px、常設文字/標準font/基本size、固定footerとCtrl+Enter保護を保持。書式に内外strokeの色/太さ、配置に字間・行送り・全体placementと配置線、変形にenvelopeと3点profile、文字別に選択と属性。全体font欄は常に既定font、選択fontは文字別入口から同じ比較をtarget表示付きで開く。

文字編集中のV入力は文字draftが所有しLayerのVsessionを始めない。Shift枠drag横回転/縦拡縮、V+wheel拡縮、V+Shift+wheel回転、V+Shift矢印、V+H/ShiftH反転。camera操作Space優先、入力/IME/数値wheelは横取りしない。字/点dragを区別。縦横比/flip符号と表示中心を保持する。失敗/取消/非同期staleを保護。

## Tasks

model/組版/rendererの追加属性、font比較widget、文字popup/overlay/keyboard routeを所有fileに分けて実装し、leadが統合検証する。renderer/helperの純粋検証と製品engineのBrowser fixtureを追加し、登録簿/harness/現在地と検証記録を更新する。

## Acceptance

4tabと情報集約、文字別指定、3点サイズ、外向き変形、第二フチを実Canvasで確認。単一HistoryとProject/画素一致、失敗/取消/stale保護、共通操作の対象分離を維持する。Owner制作受入を技術検証と分離する。

## Verification

構文・model/geometry/render/adapter・font/balloon/numeric/shortcut・Project関連・harness/build。実Chromium通常Canvasで曲線「ゴゴゴ」の中央だけ書体/色/回転/変形、文字挿入削除/IME、3点profile・多行/縦書き/結合濁点/合字、外側strokeの複合色/輪郭/clip、外へ点drag、共通Transformジェスチャ、font情報整理/hover非mutation、viewport1280×720/360pxとfooter到達、font warm応答を確認。実追加→再編集→Project往復→Undo/RedoとPNG画素を比較。unknownとOwner未受入をpassにしない。

## Stop

新しいProject/History/Vector Layer authority、CAF/Anime/SOURCE/ANIMATE変更、独立WP026の変更は止めて次Cardへ。Ownerの最終受入とpushを代行しない。

## Owner follow-up — compact placement / characters (2026-10-04)

配置線の形を全体/配置線の隣へ置き、点の追加/削除/滑らか切替をその直下へ。新規draftの初回配置線entryだけ直線を選び、読込済みrecipeと明示した「なし」は保持。半弧は3点・2 cubicの上半楕円で、既存path/optional recipe内の追加kindとして保存する。全体の反転buttonは撤去し既存Transform gestureを維持、文字別の反転は共通SVG/tooltip付きで残す。文字別数値は2列・58px入力で用途をまとめ、字間/行送りは既存数値wheelを維持してsliderを非表示にする。316px glass/固定footer、既存保存/History authorityは変更しない。対象はlettering popup/CSS/model/geometry、共通icon registry、関連geometry verifier/Browser fixtureと本Card/STATUS。RIG並行差分は変更しない。

検証: 半弧の端点/接線連続/楕円近似/recipe roundtrip、初回直線と明示none保持、配置線の形とpoint操作の上部到達、文字別の2列/反転/tooltip/数値wheel、1280×720/360×640で主要buttonと固定footer、既存追加・再編集・History/Project回帰。制作操作感はOwner確認。

追加結果: main/871c51edでsyntax / editable-lettering 8件 / production build / diff-check PASS。新規`build/wp028-lettering-compact-browser.html`を実Chromiumで実行し、形の同一行、点操作、none保持、半弧preview/追加/再編集、個別反転の対象分離、58px・2列、長い本文のstrip内収納、未選択disable、1280×720と360×640のbody scroll不要を確認。既存WP027制作動線fixtureとWP028文字別/Project/PNG画素/History fixtureは更新後PASS。native mouse wheelで個別回転0→1度も確認。短いviewportとcoarseでは既存scroll/fixed footerを保持し、今回液タブ実機の証拠は追加していない。Owner制作受入は別、commit/pushなし。並行WP029 dirtyは保持。

## Owner follow-up — per-character outlines (2026-10-04)

可否判定: 既存のgrapheme属性とglyph別描画に追加でき、通常Raster/optional version-1 recipe/History authorityの変更は不要。単字の別fontは既存実装を使用。疎なcharacterStylesへ`strokeWidth`, `strokeColor`, `outerStrokeWidth`, `outerStrokeColor`をoptional追加。幅は0..64、色は#rrggbb、欠損は全文設定を継承、明示0はそのフチをOFF。第二フチのfull strokeは個別第一幅＋追加厚さ×2。各glyphの外線→全文字内線→全文字fill順をSVG/CPU/Canvasへ共通反映し、個別最大幅をboundsへ反映。本文編集で範囲追従、全解除と標準継承を可能にする。

UIは文字別の「フチ」toggleで配置/変形数値領域を切替え、常設文字/書体/選択/個別flip/確定を維持。第一・第二は標準/なし/個別、個別のみ太さ・色が有効。主担当がcharacter-styles/model/vector-renderer/popup/CSS、関連純粋verifier、WP028 Browser fixture、本Card/STATUSを所有。同fileへの並列委任はしない。独立RIG dirtyは保持。

検証条件: 欠損時旧画素維持、0と未指定の区別、strict保存拒否、単字別font＋第一/第二OFF・色/幅の組合せ、混在strokeの順序・clip/bounds・CPUとSVG、本文挿入/削除で追従、Project/PNG/再編集/UndoRedo、1280×720/360×640でtoggleと主要操作の到達。Owner制作受入は別。

追加結果: main/871c51ed、syntax / editable-lettering 8 / Project 10 / production build PASS。strict sanitizerに新色/幅を追加し、正規化後・保存後の色文字列/明示0を実値で確認。synthetic SFNTのCPUでは全OFFと通常fillの画素一致、5色の混在stroke/最大幅bounds/温まったshape cacheの現設定反映を検証。実ChromiumのWP028 compactと文字別保存fixtureは新機能を含めPASS。単字F910＋回転/局所warp＋第一/第二OFFから、独自6px/緑・追加4px/青へ変更し、通常Raster追加→Project往復→PNG画素一致→再編集/UndoRedoを確認。1280×720/360×640でフチ領域もbody scroll不要。実UIでselect/color/数値入力、native wheelで第一6→6.5pxを確認。液タブ/制作受入は未検証、commit/pushなし、並行RIG差分を保持。

## Completion

構文・関連検証・build・実Browser統合を記録してTECHNICAL COMPLETEとする。制作受入/液タブはOwner確認待ちとして保持。

2026-10-04: 関連model/renderer/fonts/Project/harness/buildと実Chromium新機能・保存回帰を確認。既存QTP touch-help source検査の不一致を記録し、今回のPASSへ含めない。詳細は検証記録。Owner未受入、commit/pushなし。
