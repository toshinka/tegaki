# WP-032 — 司令の直接編集監査

状態: REFERENCE EVIDENCE / NATIVE DIRECT EDIT VERIFIED / PRODUCT PROJECT ROUNDTRIP HOLD。main/871c51ed、既存dirty/並行WP030を保持。実行契約は[Card](../work/WP-032-rive-direct-bone-edit.md)、現在地は[STATUS](../STATUS.md)。[担当結果](WP-032-rive-bone-editor-result.md)を制作受入へ自動昇格しない。以下の初回監査・監査待ちは当時の記録であり、最終実測は末尾。

## 初回監査の指摘

2026-10-04 13:36 UTC、compact cursor `3dd52516-1c76-4546-b09a-6bd66c10b380:19`、WP032 turn `01a10710-9105-7a03-bafb-d67463bd9e66` completedを確認。初報はpure32checks/独立native Browserのdrag・keyboard・取消・保存・再読込、通常製品往復等は未測定。司令はreportと実sourceを限定読解し、次の具体的差を追補した。

- `editor.js`は18729で独立moduleを使わずInlineBoneEditorControllerを使用し、`runtime.js`にもprojectionの重複がある。verifierがimportする独立machineと実画面のcodeが違う。server静的表に固定二件を追加するだけのCard例外を認め、直接import一本へ修正依頼。二つの実装を保守する構成を採用しない。
- begin/preview/commitは元progressを保持し、確定source更新後も元poseを表示する。CardのEndPose終点progress1と違う。native終点preview、compile/新instance表示progress1、取消だけ元progress復元へ修正依頼。初報の「9.746°確定」「次のkeyboardで29.829°」のUI値は同角度画素一致の証拠ではない。
- 独立controllerのlostpointercaptureはpointerId非nullでreturnし、実capture喪失を無視する。keyboardのhandle focus離脱もwindow blurだけでは検出できない。自発release後pointerup確定と実capture喪失取消を分け、focus取消を修正依頼。
- computeAlignment生成Mat2Dのallocationとbone.worldTransform借用を区別し、所有allocationのコピー後解放を依頼。commit中teardownのtoken/応答と破棄UI復活を限定確認する。

worker初報のnative APIは公式End.rotation→artboard.advance→native drawであり、自作画像変形への置換は見つかっていない。ただし現段階で終点pose一致、未確定frame拒否、保存破棄後fresh instance、通常Raster/Project往復のWP032司令PASSとはしない。初報はread-only証拠として残し、修正後の実配信module/native/Browserを監査する。

## 現在の監査境界

同じLUNAへCard内修正を割当済み。司令はworker検証中の18729/18832へmutationしない。新chat/agent/engine修復/第二backend/共通製品authority変更/commit/push無し。修正中sourceへの構文/build反復を行わず、担当再完了後に同じ一経路で再検証する。Owner操作/レビューは要求しない。

固定SDK/hash実測、数値と直接編集のnative画素、overlay非混入、取消/破損良好scene、保存→破棄→公式再build→fresh instance、通常Raster一件/History一件/元絵不変/UndoRedo/実ProjectExport、CSS縮小/狭幅は修正後監査待ち。static/synthetic/trusted/device/Ownerを分け、未実測をPASSにしない。

## 司令の修正後実測（2026-10-04 14:11〜14:31 UTC）

14:05のcompactで修正turn `01a10722-ff09-7e11-a7b2-89dbbd39d211` completed、cursor21を確認。14:23の一度だけのcompactはcursor22、可視性/CSS限定追補turn `01a1074b-cbc5-78b3-8705-3fa677df6a72` inProgress。追補は担当がsource/staticだけを変更し、司令が18729/18832のnative操作を所有した。最終source/担当reportの54 checksを司令も実行した。次の技術結果は担当報告の転記ではなく、司令の実Browser/CLI/PNGの実測。

- `editor.js`は独立controllerの直接import、`runtime.js`は独立projectionの直接import。inline/fallback無し。server変更は固定static二件のみ。native End.rotation→artboard.advance→draw、骨/投影とnative rendererの責務は分離。owned alignmentのcopy後delete、borrowed bone行列はdelete無し。
- SVGのhidden property代入は属性を解除せず、role=imgも子sliderをAXから隠していた。担当へ限定追補し、属性明示切替/hidden時display:none/role=groupへ修正。司令の実AXに「End骨の終点角」sliderと角度が出現した。
- ready55°/progress1からtrusted ArrowRightでpreview56°。snapshotはbuilding、selectedBone=End/editPhase=preview/previewAngle=56、保存/PNG/素材/数値/scrubはdisabled、sourceHash/buildIdは未更新。診断はnative canvasのRGBAを読むだけ。診断pointerdownはhandle focusを保持し、通常Tabによるfocusoutは取消する。
- Enter後の公式CLI verify/build、新runtime loadでready56°/progress1。build logは23:18:04 JSTのverify一件/build一件、0 errors/0 warnings。preview区間にCLI build無し、保存sourceは明示Saveだけ。Browser network request数そのものは未計測。
- 明示source＋PNG保存→元tab closeでruntime/session破棄→新tab→再読込buttonによる保存source再build→新runtime load→End。23:19:09 JSTのverify/build、buildIdは新規。保存sourceのSHA256は `276e588776bdbab33d75a6438153f947cca30f1f01fa2a9de41f93b4fcc7ddf9`、保存素材PNGは `f126966391c5168d71ed1f23687b110cac7d5fe249f54319882164f11b96137b`。
- 直接preview56°、Enter確定56°、保存破棄後再build56°、数値同角度56°はRGBA SHA256が全て `e5009509b14770d5880357ebfe068d0d6b1e212340613fa4427b6dc7caa91c00`。300×180、完全透明31,926 pixels、既存imageMetrics診断bboxはx22..266/y43..179。JSON往復/自作変形/CLI screenshotによる代用ではない。
- native PNG保存のbytes SHA256は `0ca2a8cda477dc62dfb81901e367cac76061c2b73eac1d970a40308099e81c71`。cache内の8bit RGBA PNGを復号し、300×180/透明31,926/RGBA SHA256が上記と一致。別SVGの補助線はPNGに混入していない。
- progress0.5でArrowRight→Escape、およびArrowRight→Tabのfocusout取消は元poseに戻り、RGBA `78c8f47a713c7230c7355dc62ff1012a3b25e17c6a318ff9d61cf7f8ab4d9b2e` が一致。dirtyは開始値を保持、source/buildは不変。破損PNGのtrusted uploadも「PNGヘッダーを読み取れません。」で拒否し、同じsource/build/progress0.5/RGBAを保持。
- 360×640でgrid min-contentにより横scrollを再現し、担当のeditor-local CSS修正後はdocument clientWidth=scrollWidth=345、canvas CSS311.11×186.67、native300×180、End handle24×24。縮小後native SHA256も一致。縦scrollは使用、骨tipはnative artboard外まで延びるため補助線/handleが素材section付近へ出る。全面UX完成や液タブ受入とはしない。

## 通常製品の受渡しと具体的HOLD

実TEGAKI新instanceの入口→native56°/progress1→明示フレーム追加は新Raster一件/History一件。元絵canonical pixels不変、300×180を400×400 Canvas中央へ配置、Undoで追加だけ撤回、Redoで同じExport復元までPASS。実ProjectManager.exportProject→loadProjectで同じfixtureを二度実測し、次の差を再現した。

| 比較 | 結果 |
|---|---|
| native frame→TEGAKI canonical Raster | Raster SHA256 `1c069418f364181c894e0d3198cdc997e5cbe39c5a25e5ad7d053c34ffdea3db`。canonical readbackはnative RGBAと同一ではなく、既存通常Raster受渡し経路を使用 |
| Project再読込前後のRaster | 1,018 pixels / 2,271 channels差、最大255。例 `[128,0,64,4]→[0,0,0,4]`、`[113,34,68,136]→[113,36,68,136]` |
| Project再読込前後のExport | 同じ1,018 pixels / 2,271 channels差、最大10/255 |
| Export SHA256 | 前 `5a01becb8fe4c45c74e158de256a67cf29ebd05b6fc6b29bb18b18b2443f72d8` / 後 `e34e5f811a1f21a89d281ffae22b06cd3d7dae69fd18dfee7a8fafa86ecea643` |

固定55°/progress0の先行fixtureは今回もProject往復PASSだが、これを56°/progress1のPASSへ広げない。半透明縁で具体的な差があるためWP032全体の技術完了とはしない。現行project-manager.jsのPNG保存はlettering/balloon/panelLayoutにcanonical snapshot分岐があり、一般Rasterはextract＋_unpremultiplyCanvasの別分岐。ここが限定修正候補だが、原因の最終確定には共通保存責務での一件の検証が必要。RIG側でalpha閾値処理や補償変形を追加しない。

次の一件の準備案は「一般Rasterの半透明PNG保存往復」。対象候補は `system/project-manager.js` の既存exportProject PNG分岐のみ、検証は司令所有 `build/wp029-rive-browser.html` の本fixtureと既存Project verifier。保存schema/History/renderer/SOURCEは不変、canonical readback一回をPNG化する既存分岐の利用可否を調べる。新保存形式・全旧RIG比較・alpha補正器は作らない。WP030の同file dirty/所有を確認してwrite担当を一本化し、確定Cardを発行するまでは実装/割当を行わない。今回のCardでは共通Project書込みがSTOPであるため、この具体的HOLDで監視をPAUSEDにする。Ownerレビューは要求しない。

## 検証・規模・残る証拠

司令: syntax PASS、bone verifier54 PASS（native欄はstaticのみなのでUNVERIFIED表記を保持）、host verifier PASS、harness84 documents/324 links/23 packages PASS、製品build/font publication27 PASS、diff-check PASS。font bridgeはconnected=true。CLI1.3.0/runtime2.44.0の実hash/version gateはcache-valid、installationId `57f42ac8e59d94e188145f6824c40bbd399b38c773529d151efd7f5b677fbcab`。CLI SHA256 `285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9`、canvas_advanced.mjs `8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9`、wasm `A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74`。SDK/CLI/runtime本体patch量0。

最終総行数（追加行数ではない）: gesture388、projection188、native runtime adapter286、editor orchestration/診断653、HTML106、限定verifier190。server524行のWP032責務は固定route二件のみ。gross規模をupstream engineの追加保守量と混同しない。cacheのSDK/binaries/ログ/PNG/測定scriptは成果へ混ぜない。

未実測: 全embedded編集click（Browser toolが二重iframeのfocus targetを拒否）、pointermoveネットワーク全数、実capture喪失/compile中teardownのtrusted操作、preview中のhost frame request実送信、coarse pointer/pen/液タブ、長時間性能、公開利用条件、製品採用/Owner制作受入。独立面のtrusted keyboard/native画素実測、担当の先行trusted mouse、通常host受渡しと区別する。Project差を許容誤差でPASSに変更しない。

終了処理: 司令own Vite PID30184、companion PID69268はspawnログ/Get-Process executable/starttime/netstat listener/installation receiptを照合し、専用tabを閉じてViteのstdin `stop`→server.close経路で正常終了。14:35:39 UTC receipt=stopped/stopReason=vite-close、18729/18832 listener無し、両PID無し。他者process/reuse serverを停止していない。heartbeat toolの返却status=PAUSEDを確認。最終HEADは871c51ed850f436aa0d49deb049bf7276c3a9655、未commit/未push。最後の文書harness/diff-checkもPASS。
