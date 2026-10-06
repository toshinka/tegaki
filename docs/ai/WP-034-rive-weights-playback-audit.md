# WP-034 四隅ウェイト・再生 司令監査

ROLE: WP-034の技術証拠と不足を記録する限定監査。STATUS/Card/TECHNICAL/製品コードの正本を置き換えない。

## 現在の判定

**A・B限定技術監査 VERIFIED / Owner制作受入未**。Owner再起動で旧18729が終了し、通常入口から更新版を起動できた。Bのnative再生と通常host受渡しを下記範囲で実測した。先行Aの全試験は反復せず、Bの境界に集中した。現在のprocess/checkpointはSTATUSだけが所有する。

## B更新配信・実Browser・通常host

司令own product18835から通常新RIG入口を操作し、lazy起動した18729のhealth/installation/PID/own receiptを照合。新module200のSHA256 `e7b1c598c4ef97180c1dcea5ff9419b37b0d43de1f486e2ab2faf108eb18338d` はlocal fileと一致。固定CLI1.3.0/runtime2.44.0 cache gate維持。起動時は保存済み56°/progress0/dirty false/default weights。

製品fixtureの二重iframe内Playはtooltarget消失で操作できず、これをembedded全操作PASSにはしない。独立した実editor面ではtrusted Playがnative姿勢を進め、one-shot終点でended/progress1/骨overlay56°へ一致した。LoopをONにして継続、Pause後の中間progress `0.2796999999880825` を二回native採取したRGBA SHA256はともに `bc8bb004a787beb55b530732f2ebe7bb545afa2d8bbe423633b1ac7b4f84f024`。終端Play結果と明示End結果のRGBA SHA256はともに `e5009509b14770d5880357ebfe068d0d6b1e212340613fa4427b6dc7caa91c00`、300×180/透明31,926pixels/overlay非合成。診断取得は操作境界で行い、毎tick読出しの代わりではない。

最初の実再生中、server snapshot/saved4files/CLI log hash/artifact件数が開始時と不変だった。tickでruntime.seekのみ、getImageData/PNG/API/save/Historyを行わない点はsource/controller監査で確認した。全Browser API呼出回数や実機fpsを外部計測したという意味ではない。再生中に均等weight presetを操作するとstopped/building/draftへ移り、Play/frame/save等を拒否。Discardで元のsource/weights/dirtyを保持。PNG保存操作も同progressで停止し300×180透明1xを保存した。先頭/終端操作、適用compile後のidle、通常取消後のidle/0/dirty falseを確認。hidden/blur/pagehide/全操作境界のtrusted試験は未で、controller/source証拠と区別する。

通常hostのフレーム採取は独立編集の終端と同source/56°/progress1を既存compile操作一回で接続し、通常入口をclose/reopenして新native instanceで実施。これは二重iframeで再生中のframeボタンまで操作したという証拠ではない。既存 `build/wp029-rive-browser.html` の実製品経路で、新Raster/History各一件、元絵canonical不変、透明原寸300×180中央配置、Undoで追加のみ撤回、Redo復元を確認。実Project export/load後のRaster/Export差はいずれも0。canonical Raster SHA256 `1c069418f364181c894e0d3198cdc997e5cbe39c5a25e5ad7d053c34ffdea3db`、Export before/after `5a01becb8fe4c45c74e158de256a67cf29ebd05b6fc6b29bb18b18b2443f72d8`。nativeとPixi canonicalの全byte同一性へ広げない。

360px viewportで再生欄left18.89/right326/client345、欄内は収まる。document scrollWidth414が残るため既存プレビュー/診断を含めた全ページ狭幅PASSにはしない。viewport overrideは解除した。cache根拠は `wp034-commander-native/playback-start-receipt.json`、`playback-browser-receipt.json`、`playback-correction-receipt.json`。実画面はOwnerへの回答に添付。限定verifier48 checks再実行、製品build成功（既存externalize/chunk警告あり）、harness90 docs343 links成功。

試験compileを通常取消してsaved56°/progress0/dirty falseへ戻し、saved scene.rml/fixture.png/current.riv/meta.json全hashが開始時と不変を照合。own product/childのPID・executable・starttime・listener・health・receipt照合後、stdin stop→Vite closeによる正常終了と両port解放を確認。通常5174からも新入口を開き、更新18729がlazy起動してnative ready/新再生controlsを表示した。5174とそこから起動したeditorは維持、一時tabだけ閉じた。共通renderer/Project/History/保存正本変更0、SDK patch0、漫画dirty維持、commit/push無し。監視PAUSEDを維持し、未確定Cardを自動実行しない。

## 解消済みの配信HOLDと先行監査

最終反映後のharnessは90 documents/344 local links/25 proposals/25 packages成功。変更JS三件の構文確認とgit diff --checkはエラー無し（既存CRLF警告のみ）。main/4760db9cを維持し、漫画側の並行dirtyは触れていない。

2026-10-05 09:01 JST: **B実装・限定修正/controller監査済み / 配信HOLD、監視PAUSED**。修正turn01a1094f-dbe3-7c30-b762-827246eb092d completed、cursor32。司令が現行controllerを直接importしてclock0→990→1000msを再実行、runtime/controller進行とも1・seeks[0,0.99,1]。stop→start→旧callback後は現行rafScheduled trueを維持し、pause後pending0。根拠cache `wp034-commander-native/playback-correction-receipt.json`。限定verifier48 checks・固定cache gate PASS、失敗時ended拒否/旧callback後disposeも検証に含む。onPlaybackStateの既存boneController.refreshを確認、通知最大10Hz＋停止時の投影更新で新evaluator/readbackは追加しない。

source責任: controllerはclock/RAF/seek/stateのみ、editor callbacksはtickにruntime.seek、停止操作境界だけruntime.render。server差分はstatic route一件、runtime/model変更0、bridge/SDK本体patch0、共通Project/History/renderer/SOURCE変更0。担当syntax/関連weights63/model/bone54/build成功は担当report、司令再実行48/harness90 docs342 links/diffエラー無しは独立確認。transform全体19/20の既存shape mock不一致をB成功へ混ぜない。B実Browser/native進行/同progress画素/通常host/狭幅/性能/Owner制作受入は未。

09:00限定HTTP再確認で `/playback-controller.js` 404、Owner/reuse PID43016（06:54:56起動、node executable）、5174 PID16008維持。固定server更新には起動元の通常終了が必要で、回答未着。独立進行不能としてCard HOLD/manifest BLOCKEDへ反映し監視PAUSED。無断停止/別portの第二cache共有server/新Cardへ継続しない。再開は既存18729正常終了とport/cache空き確認、更新server起動、同Bの限定native/Browser監査。制作レビューや5174停止を条件にしない。A技術成立と復元済み素材を維持。

B初回監査（2026-10-05 08:46 JST）: turn01a10931-2ea1-7c50-9d4d-90650ec8eba0 completed、cursor31。担当static/pure42・関連verifier/buildを確認する前に実controllerの二境界を再現。clock0/990/1000msでcontroller ended/progress1だがruntime0.99/seeks[0,0.99]。stop→start→旧callback→pauseではrafScheduled falseだが注入RAF mapに現行一件残る。これらをCard B監査追補へ確定し08:47頃同担当へ限定修正依頼。onPlaybackStateには骨投影refreshが無く、native seek後のoverlay追従も同配線範囲で修正対象。static42 PASSをB技術完了としない。08:48司令harness90 docs/342 links、diff検査PASS。漫画anchor一時不一致は別lead更新後解消、こちらで修正していない。

実配信GET /playback-controller.js は404。Owner/reuse18729 PID43016/5174 PID16008をGet-Processで照合、停止しない。現在の配信世代ではeditor.jsの新importが成立しないため、Browser監査は未実施。修正完了後の配信復帰が残る責任で、採用不可やSDK失敗を意味しない。

2026-10-05 08:10 JST、main/4760db9c16f2af50345916381d45559cec7b1733（Owner外部commit、開始clean）。**A技術監査成立 / B割当へ**。Ownerはsceneに制作作業が無いと回答。漫画側最新turnは集中線の調査/改修計画、現行Card RIG read-onlyと照合。Aの実UI適用/保存再build/旧tab破棄後新instance/通常host/実Projectを確認。Owner制作受入、性能、全embedded編集操作は未。Bは次の確定実装として同担当へ返す。

## A実編集・保存・製品接続（再起動後）

司令の専用tab19→20、固定server18729 PID43016をreuse。56°/progress1、UI四隅50/25/75.3/12.5%から[128,64,192,32]を適用。公式CLI候補をpromoteしたsource hash4398…、実native RGBA6b12…は先行独立CLI/native結果と一致。実UI Saveのsource/PNG/riv hashは4398…/f126…/63f3…、metaにweights第二正本無し。Reopenで公式source再build後、旧tabをcloseして新tab/native instanceでprogress1へscrub、RGBA6b12…を再現。これは独立fixtureだけの往復ではない。

数値角の再compile、同PNGの実file chooser差替え、直接骨slider ArrowRight→Enterで57°確定でも四隅bytesを維持。取消で保存56°/mixed/dirty falseへ戻り、同progress1のRGBA6b12…一致。透明1x PNG保存300×180、PNG SHA256227365…、overlay非合成、透明27,429pixels。

実APIで負/256/小数/三要素/文字列weights五件と壊れたPNGを400拒否。拒否前後snapshot/source/build/dirty、CLI once log SHA256、artifact件数不変（CLI前拒否のsource分岐も照合）。raw入力/空欄/撤回のtrusted UI結果は下節。Apply一回のAPI接続とcontroller63 checksを確認したが、実Browserの全CLIプロセス起動回数を外部計測したという意味ではない。

司令own product18834 PID55276、実build/wp029-rive-browser.htmlを変更せず使用。通常Drawing入口→56°/progress1/mixed native表示→現在フレーム追加をtrusted操作。新Raster一件/History一件・rive-frame-import、元絵canonical不変、300×180透明1x/中央配置、Undoで追加のみ撤回、Redo画素復元、実exportProject→ProjectManager.loadProject往復Raster/Export画素差0。canonical Raster SHA25688cda9…、Export before/after ede044…一致。これはTEGAKI canonical内部往復の一致で、native RGBAとPixi canonicalの全byte同一性を追加主張しない。

根拠cache: wp034-commander-native/{ui-browser-receipt.json,ui-saved-receipt.json,api-rejection-receipt.json,host-browser-receipt.txt,cleanup-receipt.json}。固定SDK hashは下節。360px viewport時weight panelはleft18.89/right326で収まる。一方90°scene/診断展開でdocument scrollWidth414/clientWidth345を観測したため、ページ全体の狭幅PASSへ広げない。Bの新controlsでoverflowを増やさず、必要なら原因を限定分類する。液タブ/性能/全二重iframe編集/Owner制作受入はUNVERIFIED。

開始saved4files/snapshotをwp034-resume-backupへ保全。通常UI/APIでsaved scene.rml/fixture.png/current.rivを開始hash276e…/f126…/81c3…へ復元（metaの保存時刻/build receiptは再保存で更新）。未保存90°/progress1/dirty true/sourceHash80ff…とnative RGBA10e927…も復元。own Vite55276はreceipt/executable/starttime/listener照合後stdin stopで正常終了、own tabsだけclose。Owner/reuse18729/5174停止無し。共有製品code変更無し、漫画WP030 dirtyを保持。

最終文書検査: A監査直後のharness90 docs/342 linksはPASS。B割当後の再確認では、並行編集中のSTATUS→WP030 `current-slice--集中線フラッシュの制作動線を再設計調査のみ` anchor欠落でFAILを検出。RIG範囲外の漫画lead変更として分離し、こちらではWP030や対象リンクを修正しない。git diff --checkはエラー無し（CRLF警告のみ）。この共通文書不一致を全体harness PASSに含めない。

## 再起動後の非変更監査

旧PID32532は新PID43016（start 2026-10-05 06:54:56 JST）へ変わり、health同installation、Get-Process/node executable/starttime、netstat18729 listener照合。`/weight-model.mjs`が404→200。製品5174 PID16008もHTTP200、dev bridge status schema成立（未起動not-started、status取得ではspawnしない）。新RIGを開いた際のensureは同installation18729を再利用する設計で、製品側port変更だけでは編集serverは分離されない。どちらもOwner/reuse processなので停止しない。

司令own一時tab18で実editorのnative準備readyを確認。focusのみはselectedVertex変更/weightEditPhase idle、raw5保持、TopLeft空欄→TopRight50→適用で不正拒否、draft中角/画像/scrub/save/再読込/取消/PNG controls disabled。変更を戻す後はready/idle、90°/progress1/dirty true/default weights/sourceHash/buildIdを保持。native pixel診断の前後RGBA SHA256 `10e927e69c1696ad6ea63951790c8f4c4b4afffc47b54b88cf4a9623505250bb`一致、300×180/透明40,217pixels。compile/save等のmutationは行わず、server snapshot sourceHash `80ffcf3ca1fb4003654892c3cf5a09b5e736a8034954e8cec6ca53ede0202565`、buildId `1791150908852-c68fda`不変をGETで再確認。一時tabだけclose。元の未保存状態を撤回/保存しない。

この非変更監査後、Owner回答を受けて上節A実編集・保存・host監査を実施した。続行は確定Bだけで、他Cardへ拡大しない。

## 実測した入力境界不足

root cache `wp034-controller-audit.mjs`が実WeightEditorControllerをimportして測定。入力5が5.1へ即書戻し。空欄を不正draftにした後、別欄50入力で空欄が以前の5.1へ無言復元されvalidに戻り、apply callback一回に到達。raw入力維持/四欄検証/focus-only/適用中ready漏れとframe拒否/operation controlsの限定修正をCard Completionへ追補し、同LUNAへ依頼。fixture測定はtrusted Browser操作の代用ではない。

修正後の同reproducerはrawAfterFirstDigit=5、空欄維持、fieldValidity.TopLeft=false、apply draft-invalid / callback0。関連weights verifier63 checks PASS。現行sourceはfocusで選択だけ、rawをdraftに保持して全四欄を検証し、pending中二重apply拒否。native load後は非同期recordまでbuilding、controller commitAccepted後だけready。frame requestのdraft/pending拒否を独立に明示し、既存operationsはdisabled。後二点はsource tracing/static検査であり、実Browser未測定。syntax二件とharness90 docs/342 links PASS。担当のmodel/bone54/build PASSは担当証拠に保持し、追加製品修正無しなので無意味に全suiteを反復しない。

## 公式CLI authoring / 再build

cache `wp034-commander-native/`に独立保存したsource+fixture.pngから、固定CLI1.3.0で各verify/once/inspect成功。既存server/session/savedへmutation無し。defaultは旧source hash `276e588776bdbab33d75a6438153f947cca30f1f01fa2a9de41f93b4fcc7ddf9`を維持。中間End bytes [128,64,192,32]はsource hash `4398d67030e601ed1428060413f4770e026874a10e714097e5ef6fab32350565`。保存sourceと同PNGを別reloadディレクトリへ読み、CLI新build `.riv` hash `63f3e4546b5714235b8c074bf58d7d5c395416ed5ce0e486df0e5344e09176a9`一致。

公式inspectのRoot1/End2 influencesは四隅順に [127/255,128/255], [191/255,64/255], [63/255,192/255], [223/255,32/255]（float近似）。総和255、独自変形無し。根拠: cache `cli-receipt.json` と default/mixed/reloadのverify/once/inspectログ。これはsource-file保存/rebuild証拠であり、編集UIのSave/Reopen API証拠ではない。

## 独立native Browser

司令own product18834のcache限定fixtureに、現行 `RiveNativeRuntime`/bone-projectionと公式runtimeをそのまま配信。検証button操作からdefault/mixed/reloadごとに新instanceをload→render(progress1)→disposeした。SDK/評価器patch無し、editor18729には接続しない。300×180、56°、透明native1x。

| 測定 | 結果 |
| --- | --- |
| default RGBA SHA256 | e5009509b14770d5880357ebfe068d0d6b1e212340613fa4427b6dc7caa91c00（先行実測一致） |
| mixed / reload RGBA SHA256 | 6b12e10d75bda863e8db4357898f01af0ca0004da16388d91c87b3a7e19a2c43 |
| default対mixed | 85,381 channels差 |
| mixed対reload | 0 channels差 |
| mixed / reload PNG SHA256 | 2273650cd04121af517327d15e0c34c733d961b630e0ef821f9a4aaae2c5d088 |
| mixed / reload透明画素数 | 27,429 |

根拠: cache `wp034-commander-native/browser-receipt.json`、`wp034-native-browser.html`、`wp034-native-audit.mjs`。buttonによる検証fixture操作と、制作editorでのtrusted weights操作は区別。通常Canvas新Raster/History/Project/Exportの今回中間weights受渡しは未実測。

固定CLI executable SHA256 `285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9`、runtime2.44.0 canvas_advanced.mjs `8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9`、rive.wasm `A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74`。cache verifier gateと実file hash一致。

## 実編集経路の制約

18729はA開始前からPID32532（start 15:56:41 UTC）の同installation editorがLISTENING。health installationId一致、Get-Process node executable/starttimeとnetstat照合。17:05 UTC以後の再確認でも新static `/weight-model.mjs`は404で更新前server世代。root own spawn根拠無しなので停止/再起動/保存mutationしない。固定serverはport/session/cacheを共有し、第二serverを別portだけで立ててもcache並行mutationとなるため、このCardでは代替起動しない。独立CLI/nativeの残余測定は完了したが、A必須の実UI/保存/host監査へ独立進行不能なのでHOLD。engine失敗や採用不可を意味しない。

再開条件は、この18729を所有する起動元が通常終了しport/cacheが空いたことを確認できること。または所有と安全な停止範囲が具体的に確定した別Card。空いた後に同Aのfresh serverで実操作を監査し、成立後だけ確定Bを割り当てる。Ownerの制作レビューを再開条件にしない。

既存saved scene/fixture/current.riv/metaの四hashはbackup manifestと全件一致。司令own18834 PID6876はreceipt/executable/starttime/listener照合後にstdin stopで正常終了、listener消失確認、一時tab17をclose。reuse PID32532は保持。SDK patch0、production共通authority変更0、commit/push0。

## 追加接続量

全行数（header/空行込み）: weight model124、draft controller329、verifier262、visible fixture59。tracked差分はmodel +43/-7、server +21/-4、editor +218/-8、editor HTML +38/-0。全て限定editor-local接続で、SDK/evaluator/共通History/schema/rendererへpatch無し。新model SHA256 `57568CF9919C3B30E7CE9FC96158DA152B5506AE3946F5339FD2BD83C9D51DD1`、controller `341655F6C2D4BC59BCEA704CEC83431609686C7BE9769F261E67D932D6A4E4B3`。独立root検証はcacheだけに置き、成果にSDK/生成物を登録しない。

## 残る検証

現行fresh serverでdraft/apply/reject/保存→session破棄→新instance、角/PNG置換weights保持、実host Raster一件/History一件/UndoRedo/Project一致、狭幅/AI snapshot。A成立後だけB明示割当。採用/Owner受入/push無し。
