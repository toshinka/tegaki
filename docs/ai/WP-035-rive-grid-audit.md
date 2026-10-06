# WP-035 9点メッシュ 司令監査

ROLE: 限定証拠の監査。Card/STATUS/TECHNICAL/製品コードの正本を置き換えない。

Ownerの実装続行承認に基づき、旧quadを保持したgrid3 sourceと編集経路をA→監査→B→監査に限定。固定CLI1.3.0のrigging文書でoutline ContourMeshVertex先行・内部MeshVertex後置、triangle varuint/base64を確認。固定SDKでの実実行は未。

開始main/4760db9c16f2af50345916381d45559cec7b1733。WP034/漫画/文字/司令dirty保持。現在のturn/cursor/next checkはSTATUSが所有する。Aは稼働18729/saved/sessionを変更せず専用cacheで実行する。Owner制作受入、製品採用、push未。

Cardの必須見出しと登録を整備。WP034はVERIFIEDでOwner DONEではないため、機械harnessのDONE必須dependsOnへ入れず、Cardの技術前提を明記する。全体harness再確認は並行漫画leadのSTATUS→WP030旧current-slice anchor欠落で停止。現行WP030には同節がPrevious sliceとして存在するためRIG変更と分離、こちらで他leadのcheckpointを変更しない。git diff --checkはエラー無し（既存CRLF警告のみ）。担当へA割当送信済み、監視ACTIVE/10分へ更新成功。技術完了と次の限定実装を分け、今回はA監査後に確定Bへ進む。

## Slice A audit — 2026-10-05 13:31 JST

担当Aは約23分でcompleted。司令は差分/sourceと固定SDK hash gate、52 checks、CLI verify/once/inspectの9 vertices/8 trianglesを確認。CLI1.3.0 exe SHA256 `285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9`、runtime2.44.0は既存fixed cache gate維持。旧quad生成templateは分岐へ移しただけで、四隅既定bytes検証成功。製品Project/History/renderer/共通WARP変更なし。担当fixture初版はPNG表示とtopology図で公式Web runtimeを実行しないため、Browser/native Web証拠には採らない。

司令専用cacheの `commander-native.html` をown read-only18836からBrowserで実行し、既存RiveNativeRuntimeを利用して各artifactごとにnew instance→load→EndPose progress1→render→dispose。320×200透明1xPNG/実RGBAを採取した。default grid SHA256 `306162e506880d656b9b4a602959aa93f464ee2f2ecb02b8d65e5e89eb8cc174`、mixed `3c7dd0c50c91e4be5e5b903b0aa118e25a06d05f828e493dffc2244d2634f416`、別directoryから公式再buildしたreloadはmixedとRGBA/PNG同hash・全channels差0。defaultとmixedは実描画差あり。default透明pixels38,255、mixed38,305。旧quadは別source/instanceで読込成功、RGBA `9f7740f291471d7e5908640e8e3a12f36a6aeec0471a61764834fd96f26af89a`。旧版quadとのBrowser画素回帰は先行WP034証拠と区別する。

初回のCenterだけ128→0は差0。source/official inspectでCenter MeshVertexのWeight変更が存在することを確認し、固定CLI rigging/schema Tendonでrest bindの定義を確認。既定Center(160,100)はEnd joint(160,100)と一致するため回転しても不変。専用cacheでRoot length160→120/EndTendon tx0→-40を揃えた校正fixture二件だけ公式verify/once/inspectし、他geometry/weightsは固定した。新Web instanceのCenter128→0は28,409 channels差、RGBA `0bfab4767b863b37ae0d85947d85ab3aedc020b16f56c3aee8e5b52a3f944c7f` → `6efb0cbb109a8e4c55165ce7e96fc8809957802d55f084e95b6fbfd237bbd9ba`。中央Weightがnativeに有効で、差0は配置によることを確認。製品骨配置は維持し、Cardの誤った既定中央差期待値を補正した。SDK本体patchなし。

根拠cache: `tegaki_work/.cache/rive-editor/wp035/commander-web-initial.txt`（当初の差0）、`commander-web-native.json`（校正後）、`commander-prep.mjs`/`commander-offpivot.mjs` と各build/verify/inspectログ。source・PNG・rivはcacheのみ、成果へSDK/生成物を混ぜない。own18836 PID68248→69336は各receipt/executable/start/listener照合後stdin stopで正常終了、own tab閉鎖。Owner5174/稼働18729は停止/mutationなし。

Bへ進む根拠は上記native成立。profile validatorの明示null/空文字/typeを省略へ落とす不足と、Browser fixtureのnative未接続をA+B exact files内で修正させる。9点操作UI/API/保存再読込/通常host/狭幅はB未実装なのでUNVERIFIED。最終制作受入/採用/push未。今回の校正結果から自由骨配置/mesh topologyへ範囲を広げない。

## Slice B first audit — 2026-10-05 14:18 JST

14:05 compactでB turn01a10a56-078f-77e2-bc32-c0215ac88d45 completed（約32分34秒）、cursor38。司令が94 checks再実行/source差分/構文確認。harnessは並行漫画leadのanchor解消後92 documents/349 links PASS、diff PASS（CRLF警告のみ）。profile明示null/空文字/型違い拒否は修正済み。SDK/独自evaluator/production保存正本変更なし。

現行18729 PID48196のreceipt/executable/starttime/listener/healthは一致。ただし未保存angle21.262/progress1/dirty true/sourceHash76cdf49b…へ開始後に変更、saved sourceは276e5887…のまま。再起動/mutationを行わずOwner5174 PID14348も保持。更新時の退避・復元可否を非同期確認。Owner制作レビュー待ちで実装を止めたものではない。

別cache `wp035/commander-ui/` /18836で実server検証面を分離。`commander-ui-prep.mjs` はHERE/static参照・CACHE・PORT・module import解決とstdin shutdown hookだけ限定置換。API/authoring/build/save logic、実editor modules、official runtimeはそのまま。original/test hashと変更項目は `commander-ui/source-receipt.json`。SDKコピー/共有saved-session二重所有なし。own PID24352/start14:10:00/executable/listener/health確認後stdin stopで正常終了、own tabs26/27閉鎖・viewport reset。

実UIでquad→grid3選択、TopCenter空欄＋MiddleRight73＋TopLeft5を入力。不正Applyはraw5/空欄/73を保持、status building/draft invalid/source/dirty不変、save/PNG/再生/画像/角/scrub拒否、artifact数2のまま。Discardでquad/良好scene復元。mixed bytes `[0,180,255,220,255,60,0,30,150]` を実入力→Apply一回でartifact数4へ。Save source+PNG/透明native1xPNG300×180。56°/progress1 nativeRGBA `10cf2872459dd59cd1a267127be14aff49958382f3b1de2281a0727fe5bf0811`、透明pixels29,674、overlayComposited:false。quad nativeRGBA `e5009509b14770d5880357ebfe068d0d6b1e212340613fa4427b6dc7caa91c00` と差あり。

旧tabclose→別tab/new Rive instance→Reopenで保存source公式CLI再build→終端1→画素記録。sourceHash `c807b4640e68e99b06b56a7a57c19088374cfebe2d7e4ec7fb0524e42c71f212`/9weights/vertex9/triangles8/centerAtRotationPivot保持。上記RGBA/透明pixels/bounds一致。cache `commander-grid-before-reload.json` / `commander-grid-after-reload.json` とactual editor-proof/saved/browser-pngが根拠。360px/client345、grid left18.89/right326、各入力width98/scroll98、document scroll345。56°/診断閉の限定条件で横overflowなし。旧90°/診断展開や全端末へPASS拡大なし。

三件の不足を再現しCard末尾へ確定: quadのgrid専用5欄はhidden:trueでもdisplay:gridで見える。grid TopLeft空欄→quadで0/valid:trueへ黙って補修（`commander-profile-invalid-reset.json`）。API grid byte256はCLI前拒否だが500（profile null/空文字/4weightsは400）。同LUNAへ限定修正。通常host Raster/History/UndoRedo/実Project/Export、全停止境界/画像置換/液タブ/性能/Owner受入は未測定。独立native/UIとlive通常入口反映を区別する。

## Slice B correction audit — 2026-10-05

担当の三件修正後、96 checks/weights63/構文を確認し製品build、harness92 docs/349 links、diffを再実行して成功。SDK固定hash gate維持、runtime/evaluator/保存正本の変更なし。API入力errorの限定prefixだけを400とし、内部server/CLI failureは500を維持。workerのCLI screenshot証拠はWeb animationの代替にしない。

独立actual server fixtureを更新して18836で起動。own PID27560、Node executable/start14:37:38/listener/health installationId一致を照合。実Browserでquad4欄と中央注記非表示、grid9欄と注記を確認。grid TopLeft空欄/MiddleRight73→quadを試すとselectorはgridへ戻り、raw空欄/73、valid:false、確定quad sourceHash276e5887…/dirty:falseを維持。入力修正後のprofile変換とDiscardで正常復元。gridを明示Applyしnative ready→gridからquadの内部weight破棄警告を確認、Discardでgrid保持→終端1表示を確認した。根拠 `commander-repair-ui.json` と修正後quad/grid screenshots。

実APIのnull-profile/empty-profile/wrong-count/bad-byte256は4件とも400/input-rejected。`commander-api-receipt.json` のCLI verify/onceログhash、artifacts8件、saved sourceHash276e5887…、confirmed source/dirtyは前後同値。UI入力/拒否/取消の間はbuildId/source/dirty不変、明示Applyだけ新buildIdへ。保存再build/new instance画素一致は上記first auditで成立し、今回の表示/切替拒否/API分類修正では公式runtime/authoringを変えていないため全A/native往復を反復していない。

own tab28を閉じ、既存stdin shutdown hookで正常終了。PID消失/18836 LISTENINGなしを確認。Owner5174/18729は停止・API mutationなし。現行18729の未保存21.262°/progress1/dirty trueの退避・復元はOwner回答待ちなので、通常入口更新とhost一件の実Raster/History/Project/Export検証は具体的HOLD。監視PAUSED。独立UI/native成立を通常host PASS/制作受入へ拡大しない。未確定の次Cardは実行しない。

## Owner-approved preservation / operational host audit — 2026-10-05

上記HOLD後、Owner「はいその方針で」を受領。専用cache `wp035/commander-preserved-live/` にlive source/image/current.rivとsaved4filesを退避し、通常API snapshot/source再構築の一致、health/installation/PID/executable/starttime/listener/creation receiptとsaved hashを照合。既存owned PID48196だけを既存SIGTERM終了経路で終了し、Owner5174の既存dev bridgeから更新editorを起動。新PID34004/Node/start15:29:53 JST、installationId `57f42ac8e59d94e188145f6824c40bbd399b38c773529d151efd7f5b677fbcab`。Owner5174 PID14348は停止していない。第二serverによるshared saved/session同時使用なし。

通常compile APIで未保存quad21.262°/progress1/dirty trueへ復元。source SHA256 `76cdf49bcf64b1638183def7949676d4ea048fc5d20edcf50d29e16d2239404b`、image `f126966391c5168d71ed1f23687b110cac7d5fe249f54319882164f11b96137b`、derived riv `f5cd7d7174164f63258112116a1e09b58ceb3e1353713e10f634a7b57973f3bb` が退避と一致、saved4filesも全hash不変。receiptは `commander-restored-live.json`。source唯一正本を維持し、rivは通常公式compileで再生成。

実Browserのembedded profile/input操作は成立したがApply/Enterはtool target/focus root喪失で操作不能。閉じてdraftを撤回し、独立実editorのtrusted profile/input/Apply一回でmixed grid `[0,180,255,220,255,60,0,30,150]` を確定。56°へ変更する試験は自動承認審査が未保存保全/承認範囲を理由に拒否し、再試行せず角度21.262°を維持。grid native300×180/progress1、source `9c51ad32ed5b27b50eb9a74312d6c82bae1abbc6612a0f3058155e5145567418`、RGBA `6e5aa527e3e7eb248666309ae0d3d8d9602f1c1412acc17549affbaf5feddb7d`、透明27,366pixels、overlay非混入。独立56°保存再build証拠と今回host21.262°を同一全経路PASSとして混ぜない。

司令product18837の既存 `build/wp029-rive-browser.html` と実通常入口で新native instanceをload、明示frame追加、通常Raster/History各一件を確認。元絵canonical画素不変、透明原寸300×180をCanvas中央へ配置、Undoで追加のみ撤回/元Export復元、Redoで同画素。実ProjectManager.exportProject/loadProject後、Raster/Exportとも差0channels/0pixels。canonical Raster SHA256 `53c3ed5a69271bef65d6e7b8a3da1a4604a51c94c506e3351e637641fc5b2a39`、Project前後Export `3624fea7d8126d3d4ed76d6d75dc61a602fdc2726b0151fd903c2261fbf11f3b`。native readbackとcanonical Rasterのhashは採取境界が異なり、同hashとは主張しない。根拠 `commander-host-grid-native.json` / `commander-host-result.txt` と `wp035-host-project.png`。

試験後に元未保存quadを再復元、source/image/riv/saved全hashを再確認。試験前後とも新しい公式runtime instanceでRGBA `155e134683de77154ff0e3a66d1e0bad704d05a7e4e9c9c264acd490e069b52d`、透明27,570pixels一致。`commander-unsaved-native-before.json` / `commander-unsaved-native-after.json`。root tabsは閉鎖、専用productPID62152はVite q正常終了・process消失/listenerなし。更新18729 PID34004/Owner5174 PID14348は維持。

限定技術目標達成。SDK/CLI/runtime patch0、production schema/History/renderer/SOURCE変更0、commit/push0。関連96/63 checks・syntax/buildは修正後PASS、最終文書check時の漫画WP030 anchor不一致は並行lead所有として分離。全embedded編集click/全ページ狭幅/性能/液タブ/制作受入/採用は未確認。次候補の9点選択・影響可視化はCard未確定で実装しない。
