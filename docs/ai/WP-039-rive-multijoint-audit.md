# WP-039 — 多関節・メッシュ編集の司令監査

2026-10-06、main/4760db9c16f2af50345916381d45559cec7b1733。**VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING**。一枚PNGの2〜8骨と45点メッシュを、通常新RIG入口で編集・ポーズ操作・出力できる土台として届けた。上流engineの再試験や旧新全機能比較を行わず、追加authoring接続と代表制作操作を確認した。

## 実装と分担

SOLの`chain-model.mjs`はrest関節/角/warp/二骨weightから公式RMLを生成・厳密再解析する。45点/64triangle、全骨rotation key15と全頂点x/y key24/25を一秒EndPoseへ置き、既存公式runtime.seekで補間する。model/serverへbranch接続し、source+PNG正本、旧二骨読込、通常Raster APIを維持した。

LUNAの独立`chain-controller.js`はraw入力、選択、元画像上の配置、45点の終点変位、最近傍二骨の初期追従配分を担当。`workbench.js`は既存native runtime/playback/API/親protocolを接続し、`workbench.html`は日本語操作画面。司令は契約、限定Browser/通常host監査、共有案内を所有した。同file並列writeなし。

実操作で見つかったSave時ポーズ巻戻り、invalid Applyの有効表示、配置時の元絵と変形絵の重なりを限定修正。配置ONは元PNG＋配置点、OFFは純native結果。司令の最終一行修正は配置toggle時のdataset同期であり、evaluator変更なし。AI snapshotは確定chain、raw/valid draft、選択骨/点、progress、busy/reasonを観測でき、診断は既定閉、nonce非露出。

## 代表native編集・保存

独立cacheのactual server18843で実ボタン/入力を使用。腕3骨、joint1=(117.123,83.456)、angles=[20,-35,25]、中央点22のwarp=(12,-8)、weight骨1/2・mix128を一回Apply。骨数別native網羅は行わない。

| native pose | RGBA SHA256 | 透明pixel |
| --- | --- | --- |
| 0 | `70a851fa26d179eff0ba72e925ba66bf95b7cd378ef7e8af7305d67b29f7bf7b` | 28,340 |
| 0.5 | `84d2cdc7f7873870e25108efca3bc4fa2918244e110fe4a406c00131067a2cd8` | 27,102 |
| 1 | `e14e856023989e4fcb4168acb71fd3421e0ad74293fe7eaeaa60488a560a4715` | 27,646 |

restは先行元PNGのnative画素と同hash、関節とwarpの終点は描画差がある。実source＋PNG Save、旧tab破棄、Reopenの公式再build、新Web instanceでpose1のRGBA/透明数が一致。さらに保存された同source+PNGを別directoryへ置き、公式verify/once/inspectを一件実行、derived riv bytes一致。source `29309b1e9e73671d0c30022c82ecef6a84b30bb4947df5471760a9fd54847acc`、riv `17db955b2de54c932a70688ea8646c1135bd89004e1c0b26c42f6a101b137866`。

実ポインターで関節drag→draft→Discard。source/build/progressは維持、同pose0.5のRGBAが戻る。raw5/空欄/別関節選択でもraw保持、invalid時Apply/PNG/save拒否。実APIのwarp範囲超過一件を400拒否、良好source/buildId/dirty不変。修正後Saveのprogress1保持、配置ONのcanvas visibility hidden（データ/寸法保持）、OFFのnative表示を通常画面で確認。

300×180のnative透明1xPNGを実出力。overlayはcanvasに合成しない。CSS client360px、診断閉のdocument scrollWidth360で横overflowなし。全端末・全故障・PNG bytesの全経路一致をこの代表結果へ加えない。

## 実TEGAKIへの受渡し

漫画が使用中の18842/tabを操作・停止せず、新通常Vite18844から新RIG入口を使用。旧owned companion18729 PID31600のreceipt/creationToken/実executable/starttime/listener/health、source/dirty/saved不変を退避と照合し、既存own-child終了と同じNode SIGTERMを当該leafだけへ送った。新18844の通常bridgeがPID36592を起動。共用Vite/font/漫画を維持し、shared saved/session二重serverを作らない。

実製品fixture `build/wp029-rive-browser.html`の通常入口で同関節/warpの値を入力しApply。最終UIの最近傍二骨autobindを用いたsceneはsource `06cccb1d63845d9edd24bcd4820432e75d823407ea8c028f7101c4ffb8f0f265`、pose1 RGBA `0e394528db5288f4a017bc72ff7080d6a0bfa7921d058867fc967f92fb7f5b77`、透明28,288。初期配分が異なるため上の保存代表と同画素とは称さない。

親の明示フレーム追加→新通常Raster一件/History一件、元絵canonical画素不変、300×180原寸中央配置、Undoで元Export復元、Redoで同画素を確認。実ProjectManager.exportProject/loadProjectでRaster/Exportとも差0。最終Export SHA256 `8586a28bee198cafa8d89d1848259c50d514cffa5230af02cc2344d504ad7884`。native canvas RGBAと通常Rasterのcanonical PNG画素は別証拠として記録する。

通常saved四件は開始hashを維持し、現在の多関節sceneは未保存draftではなく適用済みdirty trueとして配信に残す。起動後のsessionより保存済みsourceが優先される既存仕様は維持。通常入口 `http://127.0.0.1:18844/` と新RIG表示tabを残した。独立18843と検証tabは正常終了する。

## 検証と根拠

backendの同hash構文/91checks/代表CLI、UIの16checks/構文を採用し、上流engineや旧suiteを反復しない。司令のdataset一行修正後UI構文/16checks、製品Vite build PASS。最終harnessは105 documents/385 local links/30 packages OK、通常設定のgit diff --check exit0。SDKは既存固定CLI1.3.0/runtime2.44.0 hash gateを維持、SDK patch0。細部は[backend報告](WP-039-rive-chain-backend-result.md)、[UI報告](WP-039-rive-chain-ui-result.md)。

ローカル証拠は`tegaki_work/.cache/rive-editor/wp039/`のcommander-native-before/reload/middle、commander-rebuild-evidence、commander-input-boundary、commander-normal-native、commander-host-result、commander-update-evidence、commander-final-source、commander-delivery.png。cache/SDK/生成物は成果登録しない。

## 成立範囲と残り

一枚PNG、2〜8連鎖骨、固定45点の終点warp、二骨までの追従配分、共通pose0..1、再生、独立素材保存/再読込、透明PNGと通常Raster受渡しが成立。独立した複数parameterのkeyform合成、Cubism Bezier warp互換、多PNG、骨の分岐、自由topology、IK/物理/Timeline統合は未実装。2〜8骨は入力/model契約、代表native実測は3骨であり、全骨数native試験とは区別する。性能/GPU benchmark/液タブ/Owner制作受入/公開利用条件・製品採用はUNVERIFIED。production保存/History/renderer/SOURCE authority、漫画files、既存dirtyを維持。commit/pushなし。

次の実装判断は多軸parameter/keyformのauthoring契約が候補。現在の完成点を網羅再検証するCardは不要。Owner操作を実装完了の条件にせず、この道具一巡の区切りで止める。
