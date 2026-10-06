# WP-036 素材上の点選択 司令監査

状態: REFERENCE EVIDENCE / 限定技術監査成立。現在地はSTATUS、確定契約はWP-036。Owner受入を自己承認しない。

## First audit — 2026-10-05

既存LUNA turn01a10ae0-077e-7540-8d9e-fc31ba86a7c8 completed（25分50秒）を一度compact確認。reportは27 checks/syntax/grid96/weights63/playback48/harness/build PASS、Browser/native selectionは未。Transform全体のshape-tool.js paint.append不一致は対象外共通codeの失敗として分離、RIG側から修復しない。

司令は実sourceを限定読解し同verifier27成功。fixed SDK cache gate確認後、production serverのport18838/cache wp036/commander-ui/HERE+import解決+stdin normal shutdownだけを分離したactual editorを起動。CLI/runtimeをコピー・patch・代替しない。source receiptは専用cacheに保持。PID56496/Node/start16:37:43、/health/listenerと自己exec sessionを照合。稼働18729/Owner5174にはmutationしない。

実Browser300×180/56°/progress0のquadで案内ボタンTopRight click→対応input focus→native画素採取。前後source276e5887…/build1791185864495-970910/dirtyfalse、RGBA SHA256 `70a851fa26d179eff0ba72e925ba66bf95b7cd378ef7e8af7305d67b29f7bf7b`、透明28,340pixelsが一致、overlayCompositedfalse。点選択でdraftなし、選択のみpose/source不変。証拠 `wp036/commander-first-native.json`。

TopRight5入力→TopLeft空欄→BottomRight Enter→TopLeft Spaceでinput値5/空欄・field validityを保持し、対応focusと案内未確定が成立。Discard→grid3 draftではUIの9点/説明は同期。しかしtop-level AI snapshotはfirst input後selectedEndPercent100/activefalse、grid draft時selectionProfilequad/activefalse/selectedTopLeftなのにpercent100へ残る。実controller viewと旧snapshot spread優先の不一致。`commander-first-snapshot.json` と `wp036-first-audit.png`。native confirmed quad/selection draft gridを混同せず派生情報を修正する。

source読解で_renderProfileの旧group click/keydownがlistenersへ保持されて再作成で蓄積、disposeまで解放されないことを確認。図左右のラベルboundsも図外へはみ出し（図739..967に対しtext706..1000）、8〜9.8pxのtextとsource UV中心説明のため素材位置案内を限定調整する。三件をCardへ追補して同LUNAへ修正割当。初報をtechnical closeにしない。

own Browser tab4を閉じ、自己exec session32502へstdin stopで既存shutdownを呼び、PID56496消失/18838 LISTENINGなしを確認。Owner/reuse process停止なし。報告・static/actual UI/native選択/通常入口/性能/液タブ/Ownerの証拠は別階層。配信更新とhost受渡しは修正後に行う。

## Correction audit

三件修正turn01a10b03-d85d-7f02-947b-a7054d1a5af5 completed（10分28秒）後、司令verifier40 checksを再実行。sourceはcurrent selectionViewをsnapshot派生の正本とし、point listenersを別所有してprofile再作成前/全disposeに解除。固定SDK gateはCLI1.3.0/runtime2.44.0の各実hash一致、engine patchなし。

同actual server隔離runner18838/PID23832/自己tty2269で実UI監査。TopRight input5でsnapshot percent5.1/active true、空欄TopLeftでpercent null/valid false、profile draftでnative confirmed quadとselectionProfile grid3を分離、DiscardとApply後で派生view一致。quad前後RGBA70a851fa…一致。grid3 Apply→実SVG Center click中もloop再生playing継続、source/buildId/dirty/画像URL不変、draft false。同progress1のCenter→TopLeft選択前後RGBA `a9aabade372709fe040046f6f141dceedbb738233605ef0e923a1be818be779a`、透明29,709/alpha24,039、overlayComposited false。`commander-repair-browser.json`。Browser network ResourceTimingはtool read-only環境に公開されず、再fetch0はcontroller回帰/source分岐と実URL維持の証拠として扱う。

360px・診断閉のactual grid3でdocument client/scroll345px、案内SVG bounds18.89..326px、全ラベルが図内。短い日本語ラベルは9.33px、フルname/比率は別button/選択欄で表示。表示専用margin内で元PNG比率とUVを維持。液タブ/指の実機操作感は未。

一件残る不足: Apply完了でsnapshot active falseなのに見えるstatusが旧draft説明を維持。syncのconfirmed側更新が無い根拠をCard Follow-upへ追補、同LUNAに限定修正。司令tab5を閉じてviewport reset、PID/executable/starttime/listener/healthを照合後stdin stop正常終了、PID23832/18838 LISTENINGなし。

live18729 PID34004は現時点42.796°/progress1/dirty true/source d68ddc7f…であり、旧WP035の21.262°を復元しない。現在のsource/image/riv/saved4filesを`wp036/commander-preserved-live/`へ退避、createSourceのexact bytes再構築と退避中snapshot不変を確認。現liveへの停止/compile/保存mutationなし。追補後に退避時から変更が無いかを再照合し、owned identityと正常終了/通常bridge復帰/現未保存復元を限定判断する。

## Final status / operational audit

状態説明・同世代画像error保持の追補後、46 checksを司令で再実行。image load/error/token、同じ失敗keyの再syncはerror/disabledを維持、新keyだけloading、draft→confirmed/Discard/Apply/seek説明とlistener解放は実controller回帰。修正後syntax/関連96・63・48/build/harnessは担当の実行根拠とsourceを監査し、司令の46 checks/syntax/実UI/native/hostで補完。全verifierをBrowser操作の代替にしない。

現未保存退避snapshot/saved4hashとowned receipt（creationToken4ea4db9c…）、Node executable/start15:29:53、health installationId/PID34004/listenerを再照合。不変だったためownedだけ既存SIGTERM正常終了、Owner5174の通常bridgeから更新editorを起動。新PID50796/Node/start17:33:27 JST、同installationId、owned creationTokenfd6816c8…を照合。通常compile APIで現42.796°/progress1/dirty trueを復元し、source `d68ddc7fb540a185cc05dbd4550a4b7b7f6e6a2962fbc05782454b0c028a51f1`、image/rivの全hash、saved4filesの全hashが退避と一致。source保存正本を変更せずderived rivを公式CLIで再生成。`commander-restored-live.json` / `commander-final-preservation.json`。Owner5174は停止せず二重shared session/saved serverなし。

更新実配信 `/influence-map.js` のbytesは現sourceと一致（SHA256 c3c86d47…）。実Browserで確定→TopRight5→TopLeft空欄→Discardを操作し、確定/未適用/未確定のvisible statusを確認。source/buildId/dirty/angle/progressは不変。native RGBA `ba0c37d1a654b3a6c6c52bdfc1e6abb66e4453a0bd36e3f76245eeeb3f866466`、300×180、透明28,680/alpha24,884、overlayComposited falseが操作前後一致。画像errorのtrusted network障害試験は未、controller証拠と分離。根拠 `commander-live-ui-native.json` / `wp036-updated-editor.png`。

司令専用product18837/既存wp029 fixtureで通常新入口→updated native load→明示frame追加をtrusted Browser操作。新Raster/History各一件、元絵canonical画素不変、透明原寸300×180/中央配置、Undoで追加だけ撤回/Redo同画素、実ProjectManager.exportProject/loadProjectのRaster/Export差0channels/0pixels。canonical Raster SHA256 `ca445fc1d9da50e96e38dde6b80920303e85223fd24b1c2926498d51946cee74`、Project前後Export `96b6f0988d02e6d7ff87288b404d6439f3c87515ceb9ff4b0e1674562a23b478`。native readbackとcanonical Rasterの採取境界は別であり同hashを要求しない。WP035全A証拠は反復せず一既存経路に限定。`commander-host-result.txt` / `wp036-host-proof.png`。

own tabs8/9を閉じ、Node/start17:35:21/listenerと自己tty14226を照合して専用productPID18172をVite qで正常終了。PID消失/18837 LISTENINGなし。Owner5174経由ensureでPID50796所有receiptを再検証、現未保存source/image/riv/progress/dirtyとsaved4hashを最終確認。Owner/reuseサービスは維持。

限定技術完了。SDK patch0、production Project/History/renderer/SOURCE変更0、commit/push0。Browser network再fetch量/全embedded編集click/全ページ狭幅/性能/液タブ/制作受入/採用は未。既存quad数値inputはcontrols228pxで約15.78pxに縮むため可読性が残る。二列row/output nowrapはHEADにも存在し、今回素材図の追加とは別の既存配置責務。次の一件をlocal数値欄配置案としてCardに整理し未割当。共通Transformのpaint.append失敗は別lead対象のまま。
