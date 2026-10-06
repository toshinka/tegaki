# WP-035 — 新RIG 9点メッシュと追従編集

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。A/Bの独立CLI・native Web・実UIと三件限定修正、未保存保全を伴う通常入口更新、9点の通常Raster/History/実Project受渡しを司令監査。独立56°保存再現と通常host21.262°の実測を区別する。Ownerの実装続行・退避更新復元承認（2026-10-05）、現在地・turn/cursorはSTATUSだけが所有する。

## Goal

一枚PNGを中央を含む9頂点/8三角形へ細分し、点ごとのRoot/End追従で曲がり方を調整できるようにする。既存四隅素材は変更せず読込・編集・保存できる。公式Rive evaluatorを使い、TEGAKIの通常Raster受渡し/Project/History/rendererは維持する。

READ: AGENTS→STATUS→TECHNICAL→本Card→DEVELOPMENT「漫画文字とRIG proofの並行導線」→対象header。ARCHITECTUREの現行RIG/保存所有を参照。全旧RIG/Cardのpreloadは不要。固定CLI1.3.0の `rive docs rigging` のImages/mesh節が根拠。ContourMeshVertexのoutline先行、内部MeshVertex後置、triangle indices varuint/base64という記載を実CLI/nativeで確認する。

## Scope

開始main/4760db9c16f2af50345916381d45559cec7b1733。既存漫画/文字/司令/WP034 dirtyを保持。他者と共有checkoutで作業するため、他者差分を巻き戻さず合わせる。新chat/agent無し、既存TEGAKI｜実装 LUNA（01a0ff17-48d3-7f51-93b9-c1df1dfc7ae2）だけを使う。

A exact WRITE:

- `tegaki_work/advanced/rive-editor/mesh-profile.mjs` NEW: quad/grid3の固定頂点・UV・triangles・profile weights検証/四隅からの変換、変形evaluatorは持たない。
- `tegaki_work/advanced/rive-editor/model.mjs`: grid3 source生成・限定profile parse・snapshot派生属性。既存quad既定source bytesを維持。
- `tegaki_work/build/verify-rive-editor-grid.mjs` NEW: 実関数のprofile/indices/旧quad互換/破損拒否/保存再build境界。
- `tegaki_work/build/wp035-rive-grid-browser.html` NEW: 実nativeのquad/grid/mixed/reload比較fixture。公式runtimeを使う。
- `docs/ai/WP-035-rive-grid-result.md` NEW: 担当の限定証拠、未検証を明記。
- cache `tegaki_work/.cache/rive-editor/wp035/`のみ。Aは稼働18729/API/saved/sessionへmutationしない。固定SDKは既存cacheをread-only利用し、成果にコピーしない。

司令監査後に明示割当するB追加WRITE:

- `advanced/rive-editor/weight-editor.js`（既存quad controllerをprofile対応、既存packed primitiveは再利用）、`editor.js`、`editor.html`、`server.mjs`（profile compile/image/record/promoteと新module固定配信だけ）。
- A verifier/Browser fixture/担当report/cache。`weight-model.mjs`、runtime.js、bone-editor.js、bone-projection.mjs、playback-controller.js、bridge/dev-companion/run-editor.ps1はread-only。

司令は本Card/STATUS RIG/DEVELOPMENT対象行/harness/登録/索引/案内/`docs/ai/WP-035-rive-grid-audit.md`/限定native・既存host測定/cacheを所有。workerと同fileへ並列writeしない。漫画/font/keyboard/共通CSS/Layer/Project/History/Export/Pixi/core/index/Vite/package/lockは双方read-only。

## Contract

### A — fixed source profile

- 固定CLI1.3.0/runtime2.44.0/hash gateを維持。一枚PNG、既存Root/End・rest30°/end -90..90°、1秒EndPose、画像原寸/bind/Tendonを維持。新骨・新animation・独自mesh変形を作らない。
- profile名は `quad` と `grid3` の二つ。省略は旧quad。quadの名前/order/UV/triangle bytes/既定weightsとsource bytesを維持。
- grid3はoutline時計回り8点を先に置く: TopLeft(0,0), TopCenter(.5,0), TopRight(1,0), MiddleRight(1,.5), BottomRight(1,1), BottomCenter(.5,1), BottomLeft(0,1), MiddleLeft(0,.5)。最後にCenter(.5,.5)をMeshVertexとして置く。他8点はContourMeshVertex。座標はUVから画像center原点の固定実寸へ線形対応。自由頂点移動は今回なし。
- trianglesは `[0,1,8],[1,2,8],[2,3,8],[3,4,8],[4,5,8],[5,6,8],[6,7,8],[7,0,8]` の8枚。同じwinding/面積>0/indices<9を検証。varuint/base64を固定CLI verify/inspectとnative loadで実証し、base64文字列だけの試験を成功根拠にしない。
- grid初期値は旧quad [tl,tr,br,bl]からoutline `[tl,round((tl+tr)/2),tr,round((tr+br)/2),br,round((br+bl)/2),bl,round((bl+tl)/2)]` とcenter `round((tl+tr+br+bl)/4)`。全weightはEnd整数0..255、Root補数/合計255、既存packed encode/decodeを再利用する。例defaultから `[0,128,255,255,255,128,0,0,128]`。
- profile/weightsはRML Mesh/name/vertex kind/order/UV/triangles/Weightから復元する。metaに第二正本を追加しない。grid Mesh名 `GridMesh3`、quad `QuadMesh`。未知profile/頂点混在/欠落/順序違い/UV違い/三角形違い/範囲外/不正Weightを拒否し、既定へ黙って補修しない。汎用RML parserは作らない。
- createSourceはgrid3でのみ明示拡張、旧quad呼出・旧saved往復を維持。snapshotはsourceからmeshProfile/vertexCount/triangleCount/確定meshWeightsを派生するruntime診断。Project schemaを変えない。
- default quad、default grid、middle/right edgeを変えたgrid各sourceを専用cacheで公式verify→once→inspect。grid mixedをsource+PNG保存→前instance破棄→別directory公式再build→new native instanceとして同progress画素を比較。既定のCenterはEnd回転中心に重なるため、Centerだけのweight変更は画素不変を期待する。中央Weightの有効性は、専用cacheの校正fixtureで既存End jointとそのrest bindを40px左へ揃えて移し、他の頂点/weightsを固定した二つのsourceの56°/progress1描画差で確認する。これは検証素材だけの配置変更であり、製品の骨配置やSOURCE契約を変更しない。

### B — editing path

- UIは「メッシュ: 四隅 / 9点」。選択だけではcompile/保存/dirty/Historyを変更しない。選択はprofile draftとして既存追従draftとまとめ、明示適用一回で `/api/compile` 一回。取消は確定profile/weights/画素へ戻る。9点から四隅への明示切替はcorner indices0/2/4/6を使用、内部weightを捨てることを適用前に短く表示する。自動変換・自動保存なし。
- 9点の表示順は画像上の3×3位置、source順とはview mapで接続する。編集欄は固定点名とEnd追従%、Root補数。9入力でも主要操作/Apply/Discard/Playbackへ到達でき、360px横overflowを増やさない。初期/Rootのみ/Endのみ/均等presetをprofileに合わせる。raw input/空欄/他欄不正を維持するWP034の修正を失わない。
- profile選択/weight inputで再生停止、draft中status building・frame/PNG/save/骨/角/画像/再生を拒否する。適用/失敗/Discard/stale/teardownは既存排他と良好scene保持。profile=quadで9weights、gridで4weightsなどをAPIでCLI前拒否。
- 数値角/直接骨/画像置換で確定profile/weightsを維持。画像置換は固定UVから新実寸geometryのみ作り直す。Save/Reopen/Cancelはsource唯一正本からprofile/weightsを復元。省略profile/weightsは確定値を保持する。
- AI snapshotのmeshProfile/vertexCount/triangleCount/selectedVertex/weightEditPhase/weightDraftに確定とdraftを分離。testid `rive-mesh-profile` と既存 `rive-weight-<pointName>`。nonce非露出、親iframe protocol/save authorityを変えない。
- grid3の主要編集領域に「中央は現在の骨の回転中心にあるため、中央の追従だけでは見た目は変わりません。」と短く表示する。AI snapshotにもsourceから派生する `centerAtRotationPivot: true` をgrid3に限り出す。中央weightは編集/保存可能な値として維持し、勝手に外周へ移したり無効値へ補正しない。
- nativeは既存runtime.load/seek/renderだけ。新runtime/evaluator/Skin patch無し。PNG/native frameにUI overlayを混ぜない。通常Raster追加は既存host一件/History一件。

## Tasks

Aはsource/実CLI/native fixtureまで。司令が差分/公式ログ/固定hash・9vertex8triangle・中間weightのnative差・保存再build/new instance差0を限定監査してから、同担当へBを明示割当する。A失敗時にSDK本体修復・別backendへ進まない。

Bはquad→grid draft→apply→角/骨/画像置換→保存→旧instance破棄→再build/native再現、draft破棄/不正入力保持/再生排他/透明native1xPNG。司令は既存host新Raster/History各一件/元絵不変/UndoRedo/実Project Raster・Export差0を一経路だけ確認。WP034全suite/旧RIG全面比較は反復しない。

## Acceptance

旧quad source bytes/読込/画素維持。公式grid9頂点8三角形・中間weight native差・source保存再build/new instance画素差0。Bのprofile/weight draft適用撤回・不正拒否・角/画像置換保持・保存再現・通常Raster/History/Project往復を上記一経路で成立させる。制作受入はOwner。

## Verification

syntax、限定grid verifierと変更で影響するmodel/weights/bone/playback検証、製品build/harness/diff。Browser fixture/実編集操作/native/性能/Owner受入を区別し、未実施はUNKNOWN/UNVERIFIED。失敗・停止は根拠と残る接点をreportへ。

## Runtime ownership / progress

Aは18729をread-only、専用native fixtureはworker own product18836/tab/cache。B/司令hostは18837/tabと既存editor18729。検証中の同companion/cacheへ並列mutation無し。各processはown PID/executable/starttime/listener/health/receipt照合後だけ既存の終了方法で終了し、reuse・漫画process・Owner5174を停止しない。現行18729は前ターン司令が5174通常入口から起動したchild（開始時PID48196）。rootはlive識別・変更sceneの有無・saved保全を確認して復帰段取りを担当し、workerは停止しない。配信世代差だけで実装全体を止めず、静的/独立CLI/nativeを完了して必要な復帰だけ司令へ返す。第二serverによる同saved/session共有をしない。

進捗確認は最初10分後、一件compact。初期見積A30〜60分、B45〜90分は目安で、担当の実測所要/残作業で見直す。静かな稼働中は通知せず、10〜15分を基本に長い既知処理は20分まで延ばしてよい。短周期poll/全文log反復/確認専用agent無し。完了/重要失敗は次の確認で司令監査と次の確定Sliceへ進み、Owner制作レビュー待ちを実装停止理由にしない。

## Stop

SDK/CLI/runtime/evaluator本体patch、第二version/platform/backend、system install/PATH、login/cloud/publish/CLI再配布、production Project/History/save/renderer/SOURCE authority変更、旧RIG自動移行、骨追加/多PNG/自由topology/IK/物理/Timeline、他project/他者process停止、commit/pushは禁止。これらは本Cardへ混ぜない。A/Bを終えたら残る実装候補を司令が次Cardに整える。未確定Cardをworkerが自己拡張しない。製品採用/最終制作受入/pushはOwner。

## Completion

限定技術目標達成。[担当結果](../ai/WP-035-rive-grid-result.md)と[司令監査](../ai/WP-035-rive-grid-audit.md)にsource/CLI/native/実UI/通常host証拠を分離して記録。未保存21.262°/progress1/dirty trueとsaved4filesを保全・復元、9点の新Raster/History各一件、元絵不変、UndoRedo、実Project Raster/Export差0を確認。性能/液タブ/embedded全編集click/Owner制作受入/採用/pushは未。次候補は9点の選択・影響可視化だが次Cardは未確定、実装しない。現在地はSTATUS。

## A audit / B assignment supplement — 2026-10-05

A source/公式CLI生成と新公式Web instanceのRGBA/透明1xPNGを司令で確認。mixed→別directory再build→new instanceは差0。中央だけのweight変更は既定配置で差0、End joint/rest bindを揃えて40px左へ移した校正fixtureでは差28,409 channels。最初の「既定中央weight差>0」期待値が回転中心の配置を考慮していなかったため、上記へ補正する。SDK/CLI/runtime不具合や修復の根拠にはしない。校正fixtureの変換式は検証専用authoringで、変形evaluatorの代用ではない。

B割当には次のA不足修正も含める（対象fileはA+Bのまま）:

- `assertMeshProfile` / `createSource` は省略undefinedだけquadへ。明示null/空文字/型違い/未知名を拒否する。`??`で明示nullを省略へ落とさない。旧省略呼出のbytesは維持する。
- `wp035-rive-grid-browser.html` はPNGの表示/自作topology図だけをnative比較とせず、既存 `RiveNativeRuntime` のload/render/disposeで実 `.riv` を別instanceへ読込み、RGBA差/透明PNG/native hashを表示する。固定公式runtimeだけ。既定中央不変と校正中央差、mixed再build差0を区別する。
- CLI screenshotの比較はCLI描画証拠と記し、EndPoseが実行されたWebのprogress1証拠と混ぜない。固定CLIのdefault state machine warningは既存の手動EndPose経路と分ける。
- B実装中も18729/saved/sessionを変更しない。配信復帰/実host検証はworker cleanup後に司令が所有identityを照合して行う。独立cacheのfixture/API検証を先に完了し、稼働serverの古いstatic routeだけを理由に第二共有serverを立てない。

## B audit correction — 2026-10-05 14:18 JST

初回Bを司令が独立cache/18836の実editorで監査。9点Apply/Save/PNG/旧tab破棄/Reopen公式再build/new runtimeのnative画素再現は成立。次の三件を同じB exact files内で修正し、司令が再確認する。

1. hidden属性がlabelのdisplay:gridへ上書きされ、quadで9欄が表示される。editor-local CSSで `[data-profile-vertex][hidden]` を確実にdisplay:none、quad4入力/grid3の3×3九入力とする。中央回転中心の注記もgridだけに表示。共通CSS変更なし。
2. gridのTopLeft空欄→quad選択でraw空欄が0/valid:trueへ戻る。異なるprofileへの切替前にdraft全欄を検証し、不正rawがある場合は切替を拒否する。selectを現draft profileへ戻しraw/不正/良好scene/source保持、CLI/save/History0。修正またはDiscard後の正常変換は維持。以前のbytesを黙って採用しない。
3. `/api/compile` のgrid3末尾weight256はCLI前拒否されるが500。入力不正として400/input-rejectedへ分類。profile null/空文字/4weightsの400は維持、内部server/CLI失敗を400へ一括変換しない。CLI log/artifact数/saved/source/dirty不変。

WRITEはeditor.html/weight-editor.js/server.mjs/既存grid verifier/report/wp035 cacheだけ。司令Card/STATUS/audit/案内は対象外。稼働18729/saved/session/5174へmutation/停止なし。保存/renderer/SDKや新機能へ拡大しない。

独立試験は実serverのHERE/cache/port/import解決とstdin正常終了hookだけをcache fixtureへ分離し、API/build/saveロジックと実editor modulesを利用。SDKコピー/共有saved-session二重所有なし。通常hostのRaster/ProjectへPASSを拡大しない。現行18729は未保存21.262°/progress1/dirty trueへ変わっていたため維持。更新時の退避・未保存復元可否をOwnerへ非同期確認中（制作レビュー要求とは別のセッション保全確認）。

## B correction audit result — 2026-10-05

三件の限定修正を司令が独立実editor/native/APIで確認。quadは4欄/中央注記なし、gridは9欄/注記あり。不正rawの異なるprofileへの切替は拒否され、selector/空欄/他欄の73/良好source/dirtyを保持。修正後の正常切替とDiscard、確定grid→quadの内部weight破棄警告と撤回も成立。APIのnull/空profile、wrong count、範囲外256は全て400/input-rejectedで、CLI log/artifacts/saved/source/dirty不変。内部失敗500はsource監査と限定verifierで分離する。96/63 checks・構文・製品build・harness/diff成功。根拠は[司令監査](../ai/WP-035-rive-grid-audit.md)。

この監査時点では未保存保全のOwner回答待ちで通常入口更新/host受渡しをHOLDとした。下記のOwner承認後の限定更新・実測により技術HOLDは解消。独立native編集・保存再現と通常入口反映の証拠階層は維持する。

## Owner-approved update / host result — 2026-10-05

Owner「はいその方針で」によりsource/image/riv/saved4filesを専用cacheへ退避、live identity/source/saved一致を照合して既存owned serverを正常終了し、Owner5174の既存bridgeで更新版を起動。未保存quad21.262°/progress1/dirty trueを通常APIで復元し、source/image/riv/saved全hash一致を確認。

通常入口と独立native編集面を用い、角度21.262°のままmixed grid9点を明示適用→通常hostの新native instance→原寸透明PNGの明示追加を実測。新Raster/History各一件・元絵不変・UndoRedo・実ProjectManager export/load後Raster/Export画素差0。試験撤回後に元未保存quadへ復元し、新native RGBA前後一致を再確認。独立56°の保存再build再現は上記B証拠、今回host21.262°とは別経路。56°へ変更する試験は自動承認審査で拒否されたため実施していない。embedded Applyのtool target喪失は全編集click PASSへ広げず、独立native編集と実host受渡しを区別。

root専用product/tabsは正常終了、Owner入口と更新editorは維持。Aの全試験を反復せず必要な受渡しへ限定。SDK/production保存schema/History/renderer変更なし、採用/制作受入/push未。共通harnessの漫画anchor不一致は並行lead所有の対象外として分離する。
