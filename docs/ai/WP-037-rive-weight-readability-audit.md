# WP-037 — 追従率数値欄の司令監査

状態: REFERENCE EVIDENCE。限定技術VERIFIED / OWNER ACCEPTANCE PENDING。正本は[Card](../work/WP-037-rive-weight-readability.md)とSTATUS、TECHNICAL、現行source。

## Scope / source

2026-10-05 main/4760db9c16f2af50345916381d45559cec7b1733、既存漫画/文字/全dirty保持。既存LUNA turn01a10b44-379d-78e1-9f19-c15ea30da074 completedをcompact確認後、[実装report](WP-037-rive-weight-readability-result.md)、local CSS/source、実Browser証拠を監査。報告だけでcloseしていない。

editor.htmlのweight-row spanを一列へ、input min-width64px、output折り返し/line-heightへ変更。quad2列/grid3 3列とmarkup/id/testid/ARIA/数値型・範囲を維持。JS/model/runtime/server/bridge/保存正本を変更しない。既存grid専用規則は残るが同じ一列配置であり挙動の分岐を増やしていない。

## Actual Browser

独立18840はproduction serverのHERE/cache/port/import解決とstdin正常終了hookだけ分離したactual server。saved4filesを独立cacheへcopy、API/公式CLI/runtime/native描画は実コードのまま。root own PID56884、health installationId/Node executable/starttime/listener/source receiptを照合。shared saved/sessionへの第二serverではない。

| 条件 | 各入力border box | 結果 |
| --- | --- | --- |
| controls内幅228.22px / quad4欄 | 全欄111.11px | 値0/5/50.2/100・空欄保持、説明は下に折返し |
| controls内幅228.22px / grid9欄 | 72.069〜72.076px | 全列64px以上、0/50.2/100可読、spinnerを実画面で確認 |
| viewport360px / quad4欄 | 全欄150.56px | document client/scroll345px |
| viewport360px / grid9欄 | 全欄98.37px | document client/scroll345px、各outputのclient/scroll98px |

trusted locator操作で点選択→input focus、5、空欄→他点focus/input、50.2を確認。rawは保持、AI snapshotのraw/valid/draftとvisible説明は既存経路。未適用save/frame disabled、Discardで確認済み値へ戻る。quad→grid9を実Applyし、公式再build後status ready/9vertices/8trianglesを確認。grid→quad draft/Discardも維持。viewport overrideはreset済み。

## Native / live preservation

- 独立quad56°/progress1: raw操作→Discard前後RGBA `e5009509b14770d5880357ebfe068d0d6b1e212340613fa4427b6dc7caa91c00`、透明31,926 pixels同値。
- 独立grid56°/progress1: 点選択/raw5/空欄→Discard前後RGBA `a9aabade372709fe040046f6f141dceedbb738233605ef0e923a1be818be779a`、透明29,709 pixels同値。native出力は300×180、overlay非混入。上記は実pixel-inspectの公式runtime結果でありJSON往復ではない。
- 通常18729の新tabでCSS配信を確認。現未保存42.796°/progress1/dirty true/source `d68ddc7fb540a185cc05dbd4550a4b7b7f6e6a2962fbc05782454b0c028a51f1`、native RGBA `ba0c37d1a654b3a6c6c52bdfc1e6abb66e4453a0bd36e3f76245eeeb3f866466`を前件証拠と照合。live stateのsource/angle/progress/dirty/profile/buildId、session/saved各baseline file hashは全て開始時と一致。
- 通常18729 PID50796/Owner5174 PID14348は停止/restart/API mutationなし。独立18840はstdin正常終了、own tabs閉鎖。SDK1.3.0/runtime2.44.0/hash gate成立、SDK修復0。

## Verification / limits

workerのweights63/grid96/influence46、build/diff実command成功を限定reportから監査。root actual Browserとsource/live file hashes、diffを確認。dist差分なし。共通harnessはWP037必須heading/登録のチェックを通過後、他lead進行中WP030の旧STATUS anchor不一致で停止した。RIGで当該文書を修復せず分離し、全harness PASSとはしない。

CSS表示だけのため、WP035/036の全Project/History/Export suiteは反復しない。今回のnative証拠はRGBAと透明画素、PNG encoder/parent protocolは未変更。PNG保存bytesの追加比較、全embedded操作、液タブ/大原稿性能/Owner制作受入は未測定。新しい機能Cardを自動実装しない。

再現証拠はignored cache `tegaki_work/.cache/rive-editor/wp037/commander-browser.json`、source-receipt、live-before/after、worker verification JSON。生成物/SDK/cacheを成果へ登録しない。画面証拠はOwner向けlocal visualization `wp037-weight-readability-proof.png`。
