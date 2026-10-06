# WP-038 — 回転中心配置の司令監査

ROLE: 限定契約/source/commands/native/Browser/host証拠の監査。Card/STATUS/TECHNICALを上書きしない。

## Contract review

Ownerの2026-10-05シームレス制作続行・LUNA以外のagent利用承認。main/4760db9c16f2af50345916381d45559cec7b1733、既存漫画・文字・RIG・司令dirty保持。SOL6.1高read-only reviewerが固定CLI1.3.0 rigging文書110–121/153–158と現model/serverを照合。Root長さW/2、Root位置(px-W/2,py)によるEnd起点(px,py)、image中央を引いたRoot/EndTendonのrest bind式に反証なし。現parserのEnd/Tendon欠落受理、server固定root座標gate、中央一致注記固定trueを限定修正対象へ確定。WP035のRoot長変更校正は今回のRoot平行移動方式のnative証拠ではないためUNKNOWNを残す。

backend SOLとUI LUNAはCardの別filesを単独所有。司令は製品コードへの並行writeをせず、統合後source/保存/native一経路を検証する。dotは接続待機、制作の前提にしない。型/不正bind・raw/draft/排他・rest画素不変・off-center描画差・保存新instance再現・通常host一件は実装後に監査する。現時点でBrowser/native/製品統合/Owner制作受入PASSを追加しない。

## Backend first source audit

独立SOL reviewerは編集前の旧quad/grid bytes一致、source由来compile保持・PNG比率移行と400分類をpure照合。追加したparserは数/名前/bindを検証するが、Tendon順交換、EndをRoot外へ移動、Root scaleX2追加の三件をなお受理することを再現。packed indicesの順依存とpivot式の前提を守るため、同backend exact files内でRoot→End階層、Image→Mesh→Skin階層、Root→EndTendon順、許容transformの限定修正を割当済み。汎用parser化やSDK修復へ拡大しない。旧grid verifierのfixed-true文字列期待値をsource導出true/falseの実metadataへ更新する。

開始時の既存18729/5174はlistenerがなく、前companion receiptはexited（PID50796）。未知processを停止せず、統合後専用actual editor18841/独立cacheとproduct18842を起動して監査する。saved/未保存を未確認のまま以前のPIDへ操作しない。

## Integration checkpoint

backend三穴はpure再監査で拒否、正常中央/非中央/端quad/gridを受理。Mesh内のSkin wrapper受理が残ったため、直接子grammar一件だけ追加修正へ返した。追加のbackend探索はここで区切る。

独立actual serverは元serverのHERE/import解決・cache・port・stdin終了hookだけを適応し、production saved四件を読み取りcopy。共有session/cacheへの二重serverは作らない。初回18841 PID34328はplain execのstdinがclosedで通常終了hookを利用できなかった。health installationId/PID・executable・開始時刻・listenerとown sessionを照合した上でこの独立cache process一件だけ終了し、TTY session/PID17636で再起動した。18729/5174/他者processへ操作なし。以降はTTYの既存shutdown経路を使う。

最初の実Browserではnative readyなのにpivot controlsがdisabled、quadのAI centerAtRotationPivotがtrueとなる接続不足を検出。UI担当へ同Card内修正を返した。実画素診断の従来中心300×180/56°/progress0はRGBA70a851fa26d179eff0ba72e925ba66bf95b7cd378ef7e8af7305d67b29f7bf7b、透明28,340、progress1はcf2f93c1c9896ce1d728ad3b21b45a21886daed83f2bd7a155dc1f86b772e033、透明31,926。新中心操作/保存再現/hostはまだUNVERIFIED。専用cache commander-browser-evidence.jsonに実DOM診断を記録した。

## Final technical result

先行checkpointのUNVERIFIEDは以下の限定経路で解消。backend最終model SHA256 `7b671b664d5266d0315bdd6d7d2b79c756f8edf2e4952f9e3bee82c0c02f2d34`。wrapper直接子gateを司令pure probeでも再確認した。model247 checks/32旧source bytes/固定SDK hash/公式7 projects21 commandsはbackend receiptとsourceを照合。UIのSVG hidden property問題を実DOMで発見しattribute制御へ修正、padded viewBoxとCSS縮小の投影はnative SVG CTM inverseへ修正しcontroller27 checks。SDK/CLI/runtime本体patch0、評価器置換0、保存metadata/Project/History/renderer authority変更0。

### Actual Browser / native

独立18841のactual editorをChromeで操作。300×180PNG、56°、中心(100,80)を数値draft→Apply。draftはsource/buildId/dirtyを保持、AI status building、save disabled。raw X5/Y空欄をそのまま保持しinvalid Apply拒否、Discardで良好sceneへ戻る。quad flag false、grid非中央flag false。最終SVG mode ON clickは有効なsource座標draftを作り、mode OFFの元weight点clickはpivot/weight draft0・source不変。markerは別SVG layerでnative Canvasへ混入しない。input座標途中値/配置/scene状態は`commander-browser-evidence.json`に実DOM記録。

- 中央→(100,80)のrest progress0 RGBAは `70a851fa…` 完全一致、透明28,340。56°progress1は中央 `cf2f93c1…` → 非中央 `bde27328…`、描画差あり。
- grid3/pivot(100,80)でCenter以外のweightsを維持し、Center128→0だけを変更するとRGBA `8316c433…` → `1f241b9d…`。既定中央点の回転中心一致が解消し、native評価へ影響する。
- 実UIでsource＋PNG Save、旧tabを閉じ全Web instance破棄、新tabでReopen（公式source再build）しprogress1へseek。RGBA `1f241b9dcf491e36dba12710776b3c8f1849bcb92002656c4fe254d10ac782af` と透明PNG bytes SHA256 `6b82274f525a5382da75a6765752f420fd1b81a263fcb8f720988d7d3f85c37c` が再現。pixel reportはoverlayComposited false。
- 実UI保存bundleを別directory `commander-rebuild`へsource/PNGだけcopyして公式verify/once/inspect実行、saved/current.rivと再build bytes同一。UIのReopenは通常session、新directory CLI証拠は別途であり、JSONだけの往復ではない。`commander-rebuild-evidence.json`にcommands/hashを記録。
- 実18841 APIへ範囲外pivotを正しいOrigin/nonceで送信し400、sourceHash/buildId/dirty不変。誤headerの初回probeは403で拒否され、nonce値は報告へ出していない。`commander-api-evidence.json`。
- 実CSS幅360px・診断閉はclient/scroll双方360、pivot controls幅322.90。Chrome既存80% zoomのためviewport物理303pxで実CSS幅を合わせた。診断展開はscroll418で既存overflowあり、全page responsive PASSにはしない。viewport overrideはreset。

全stale/failure/teardown/排他の組合せはcontroller証拠が中心で、trusted実機全経路PASSにはしない。最終配置clickはBrowser automationによる座標丸めを含み、液タブ精度の受入とは別。単独captureScreenshotはtool timeoutだったが、通常製品tabのgetAXStateAndScreenshotで最終画面を取得し専用cache commander-delivery.pngへ保存。DOM/画素診断/visible fixture結果と別に画面記録を残した。

### Actual ordinary host

専用product18842の`build/wp029-rive-browser.html`で実Core/LayerSystem/History/ExportManager/ProjectManagerを使用。通常新RIG入口からlazy companion18729起動、嵌め込みeditorでpivot100/80をApplyし56°progress1を明示新Rasterへ一回追加。新Raster一件/History一件、300×180原寸、元絵canonical画素不変、Undo/Redo、実exportProject→loadProjectでRaster/Export deltaのpixels/channels/maxすべて0。Export SHA256 `b526ae81be0bef3fbdf06cc3c56e04a89f3161282d107cc9e5dd4989a9012885` 一致。診断fixtureは製品APIを使い、native frameは通常iframe/host protocolで届いた。`commander-host-evidence.txt`へ可視結果を保存。

二重iframeの初回clickは狭い親viewportで画面外だったため動作せず、1440pxへ試験viewportを広げて通常locator操作が成立。静的fixtureをtrusted操作と混同していない。Project全機能・旧RIG互換・他漫画進行分の回帰までPASSを広げない。

通常18729は本ターンrootの専用Viteから起動したowned PID31600/creationToken receiptを確認。検証後、通常取消で開始saved source `276e5887…` / 中央150,90 / angle56 / progress0 / dirty falseへ復元。production saved四件は開始copyの全SHA256と一致。旧未保存42.796°は本ターン開始前に外部終了されており、過去のsceneへ上書きしていない。他者process停止0。専用18842（owned Vite PID7008）とそのcompanionはOwnerが使える作業入口として維持。通常tabをdeliverableとして残しready/connectedの実DOMをcommander-delivery-state.jsonへ記録、独立18841 PID31344はhealth/PID/executable/starttime/listener/session照合後TTY stopでexit0。

### Commands / remaining boundary

syntax対象6modules、controller27 checks、必要なpure parser probe、製品Vite build、development-harness check、対象diff check PASS。SVG投影の修正後だけ関連verifier/製品buildを再実行した。製品buildの既存externalized util/moduleとchunk-size warningは残る。共通漫画filesやpackage/lock/Viteは本WPで変更していない。

backend validator/生成接続は今回model+89/-13/helper42行/server+17/-11、UIは独立controllerとeditor glue。量の基準はworker開始時dirty copy、HEAD全差分に先行WPを混ぜない。詳細はworker結果と最終hash receipt。性能/GPU/液タブ/全故障/trusted操作全網羅/Owner制作受入/製品採用/配布形態はUNKNOWNまたは未受入。固定CLIのlocal dev環境で成立した一枚PNG土台の区切りで止める。次候補は多部品より先に、代表素材による編集導線と必要機能の絞込み。新骨/多PNG/保存正本/renderer仕様は次Cardで確定するまで自動実行しない。
