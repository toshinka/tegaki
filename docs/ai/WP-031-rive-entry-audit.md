# WP-031 — 司令の入口接続監査

状態: REFERENCE EVIDENCE / TECHNICAL ENTRY PASS / OWNER ACCEPTANCE PENDING。2026-10-04 main/871c51ed。実行契約は[WP-031](../work/WP-031-rive-editor-operational-entry.md)、現在地は[STATUS](../STATUS.md)。Ownerが提示したbroken iframeは、起動済み18729を前提にした旧hostの不足であり、WP029 native proofを製品起動導線の受入へ広げない。

司令はhostにsame-origin bootstrap→native iframeの順序、起動中placeholder、失敗reason/再試行、close/reopenのgeneration/Abort、35秒起動上限を実装した。bootstrap nonceをconnection/AI snapshotへ投影しない。既存frameのorigin/source/session/version、native ready/Raster一件/History一件の契約を保持する。

## 確認済み

- host境界verifier: frame/Canvas/History拒否に加え、bootstrap credentialはPOST headerだけ、異なるeditor origin拒否、SDK error/nonce欠落/HTML fallback時のstartup停止、AI stateにnonce無しを確認。PASS。
- 実製品18831/IABでbridge未登録状態→入口→`connection.phase:error / reason:bridge-unavailable`と日本語説明/再試行を確認。iframe srcは未設定でbroken pageを読み込まない。明示再試行で同じ理由を表示、close後host DOM一件を全解放（count 0）。PASS。
- 並行font windowのHMRで検証中にpage reloadしたため、消えたdialogへの操作を続けず、fresh DOMから再開した。source所有は分離しているが、共有開発serverのHMRは実操作に影響する。own server18831/PID60588は実体/記録/listenerを照合して停止、own tabも終了。停止recordは`.cache/rive-editor/wp031-product-process.json`。
- 初期host構文/diff検査PASS。最終製品build、host verifier、harness（80documents / 310links / 22packages、追加登録前）PASS。buildのutil/module外部化とchunk warningは既存依存の警告。

## 完了後のnative / 製品実測

Vite変更はdev専用plugin一件のimport/登録のみ。font pluginを保持し、実HTTP `/__tegaki/local-fonts/status` はconnected=true / registeredCount=27。previewにRIG bridge無しを実Browserで確認、日本語理由/再試行、frameボタンdisabled、iframe src=nullでbroken iframeを作らない。

source監査でreuse消失/recovery、own child保持、reuse時cache検査を担当へ追補し反映確認。完了報告後の司令verifier再実行で `Unexpected non-whitespace character after JSON at position 500` を再現。exited/stopped receiptの同時writeが原因で、担当が直列化とtemporary file renameへ修正。35 fake/static checks＋race20iterationsの限定確認後、司令でfull verifierを再実行し41 checks / native PASS（PID62636、停止済み）を確認。固定cacheのCLI1.3.0/runtime2.44.0とCLI/archive/served三filesのhashは実測一致、値は[担当結果](WP-031-rive-dev-entry-result.md)とcache machine receiptに保持する。JSONだけの往復をnative PASSにしていない。

通常開発Canvas18831で、18729未起動→GET status idle/not-started（spawn無し）→新RIGクリック→lazy起動→native readyを確認。health/receiptのinstallationId `57f42ac8e59d94e188145f6824c40bbd399b38c773529d151efd7f5b677fbcab` とchild PID44708が一致。再開でも同じown childを保持。close直後のhost count0と後続応答で復活無しを確認。起動35秒上限はsource/static証拠で、実時間timeoutは未実測。

独立native Browserで300×180 PNGを読み込み、End55°へ公式compile、scrub1のsnapshot、明示source＋PNG保存、reopenでfresh buildを確認。保存source SHA256 `e6bbff47c207499d2efc7ad9bccbe29251855e3961cfe983c3f3e32e2d65c37d`、画像SHA256 `f126966391c5168d71ed1f23687b110cac7d5fe249f54319882164f11b96137b`。製品入口の新instanceへ55°を再現。embedded面のfile/button clickはtoolがmatchCount1/visibleのtargetを失うため全編集操作はUNVERIFIED。独立native面の操作と実hostの受渡しを区別し、embedded編集PASSとはしない。

実製品のframe追加で新Raster一件/History一件を確認。既存可視fixture `build/wp029-rive-browser.html` でも元絵のcanonical画素不変、透明300×180原寸1x、Canvas中央配置、Undoで元Export復元、Redoで同画素、実ProjectManager.exportProject→loadProject→Export画素一致を再実測。これは起動後progress0のframeで、55°終点poseの画素測定とは分ける。追加Raster RGBA SHA256 `70a851fa26d179eff0ba72e925ba66bf95b7cd378ef7e8af7305d67b29f7bf7b`、Export SHA256 `9bfbd0189cc774c64d1fe49f846a95617304b082bdc6dac16c2c218ab5063400`。

漫画側HMRが進行中sourceを書き換えpage reloadしたため、司令cache runnerだけhmr:falseでfixtureを再実行。途中のballoon export不足は他lead書込中の状態で、他者filesを修正せず、完成後の製品buildをPASS確認した。製品Vite設定のHMRは変更しない。WMI/Get-NetTCPConnectionがアクセス拒否の局面はGet-Process executableとnetstatのlistener/PID、own spawn receiptで照合した。own Vite closeでown child44708/28212が停止、preview PID53676も正常close。終了時18729/18831 listener無し、own tabsを全終了。reuse serviceや他者processは停止していない。

Ownerレビュー、採用、公開CLI同梱/条件、performance/液タブは未受入。直接編集は[WP-032](../work/WP-032-rive-direct-bone-edit.md)の一枚PNG/End骨に限定し、Owner操作を急がせない。
