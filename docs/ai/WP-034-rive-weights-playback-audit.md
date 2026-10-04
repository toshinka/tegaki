# WP-034 四隅ウェイト・再生 司令監査

ROLE: WP-034の技術証拠と不足を記録する限定監査。STATUS/Card/TECHNICAL/製品コードの正本を置き換えない。

## 現在の判定

2026-10-04 17:05 UTC以後、main/e0f353ed。**HOLD / 実編集経路の更新前server占有**。A限定修正turn `01a107cb-4e07-7701-b5fc-fde2d1d62e72` completedをcompact確認し、source再監査と実controller再実行で不足解消を確認。B未割当。native weights生成/独立Browser評価は成立。現行編集UI・API保存/再開・新weightsの通常host受渡しはUNVERIFIED、Owner未受入。監視はPAUSEDへ戻す。

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
