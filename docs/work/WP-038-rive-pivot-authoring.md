# WP-038 — 一枚PNGの回転中心配置と編集土台の一巡

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Ownerの2026-10-05「dotに拘らず、シームレスに制作を進め、大きな区切りで止める」承認に基づく。一枚PNGの限定土台を達成した区切り。制作受入・製品採用・pushは未承認。

## Goal

固定されていたEnd骨の回転中心を原PNG上で配置でき、一枚PNGの読み込み→中心/角度/追従率編集→source+PNG保存→破棄後再読込→透明native1xPNG→通常Raster追加を一巡できる土台にする。この限定土台の技術検証を大きな区切りとし、多素材/骨追加/IK等は今回へ自動追加しない。dot接続を前提にしない。

## Baseline

main/4760db9c16f2af50345916381d45559cec7b1733、既存漫画・文字・RIG・司令dirtyを保持。開始時と報告前にlive HEAD/statusを照合し外部commitを戻さない。WP037は技術完了で再実装不要。読む順序はAGENTS→STATUS→TECHNICAL→本Card→対象header。必要な先行根拠はWP035 auditのSlice A calibration段落のみ。

## Scope

editor-local一枚PNG・既存二骨・固定meshの回転中心と派生表示/APIだけ。通常Raster受渡しは既存APIのまま検証し、共通保存/History/renderer/漫画を実装対象にしない。

## Files

- SOL backend単独WRITE: `tegaki_work/advanced/rive-editor/pivot-model.mjs` NEW、`model.mjs`、`server.mjs`、`tegaki_work/build/verify-rive-pivot-model.mjs` NEW、`docs/ai/WP-038-rive-pivot-backend-result.md` NEW、`.cache/rive-editor/wp038/backend/`。
- LUNA UI単独WRITE（司令の明示割当後）: `advanced/rive-editor/pivot-editor.js` NEW、`editor.js`、`editor.html`、`weight-editor.js`の中央注記同期だけ、`build/verify-rive-pivot-editor.mjs` NEW、`docs/ai/WP-038-rive-pivot-ui-result.md` NEW、`.cache/rive-editor/wp038/ui/`。
- 契約reviewはread-only。司令WRITE: 本Card/STATUS RIG/DEVELOPMENT対象節/登録/harness/work索引/GITHUB案内、`docs/ai/WP-038-rive-pivot-audit.md`、専用cache、必要な限定Browser/host検証面。既存`build/verify-rive-editor-grid.mjs`の中央注記/派生flag期待値だけを今回のsource由来条件へ更新できる。旧fixed-true文字列を維持するために製品を戻さない。
- runtime/bone/playback/weight-model/mesh-profile/influence-map/bridge/dev-companionと漫画/font/共通keyboard/CSS/Layer/Project/History/Export/Pixi/core/index/Vite/package/lockはread-only。SDK/CLI/runtime本体は変更しない。
- 同file並列write無し。workerは稼働18729/Owner5174へ停止・再起動・API mutationをしない。backend/UIで製品buildを並行しない、司令が統合後一回実行する。

## Contract

### sourceと座標

`pivot: {x,y}` は原PNGの絶対pixel座標。APIはnumber型かつfinite、閉区間0..width/0..heightのみ。明示null/空文字/型違い/片軸欠落/範囲外を拒否し、省略undefinedだけ中央を既定とする。正規化は小数3桁。raw入力とは分離する。API compileでpivot省略時は現在source由来のpivotを保持する。

一枚PNG/既存Root-End/quad-grid/30°rest/EndPose一秒/End長さwidth/2を維持。Root長さwidth/2、Root rotation0、Root x=pivot.x-width/2・y=pivot.yとする。image中央/mesh/UV/triangle/weightsは維持。RootTendon tx=pivot.x-width・ty=pivot.y-height/2、EndTendonの既存30°rest matrixを維持してtx=pivot.x-width/2・ty=pivot.y-height/2。Root移動はbindを合わせる派生処理で、Rootの独立編集や長さ編集を導入しない。数式は契約reviewと公式nativeで検証し、SDK修復が必要ならHOLD。

中央defaultの旧quad/grid source bytesを維持する。新pivotの正本はRML内の骨位置・rest bindだけ。snapshot.pivotはsourceから導出し、Projectや別metadataに第二保存正本を作らない。parse/build前に骨位置と対応Tendonの不一致を拒否する。旧中央sourceを読めること。角/weight/profile編集でpivotを保持し、PNG置換は現在pivotの正規化比率を新寸法へ移す。保存/Cancel/Reopenはsource+PNGから公式再build。`centerAtRotationPivot`はgridの中心座標とpivotが一致する場合だけtrueへ導出し、UIもfalseを固定trueへ戻さない。

### 編集module

独立PivotEditorControllerをcallbackで接続する。X/Y数値欄、中央へ戻す、原PNG上へ配置する明示モード、Apply/Discard、確定/draft/invalid表示を用意する。既存素材図SVGに独立marker/配置クリック面を追加し、mode OFFではweight点選択を妨げない。SVG/CSS縮小の逆投影だけを行い、変形後頂点や独自skin評価を作らない。markerはnative Canvas/PNGへ混入しない。

focus・配置mode選択だけではdraft/CLI/save/History/pose変更0。数値入力・素材clickはlocal draftのみ、raw5/空欄/小数を他軸focusやsnapshot更新で補修しない。既存良好native sceneとsource/buildId/dirtyはdraft中不変。pivot draftとweight/bone draftの同時編集を拒否する。draft中はsnapshot.status building、frame/save/PNG/角/画像/profile/再生を拒否し、Discardで元sceneへCLI/save/History0。Applyで正当な両軸を一回compile、native新instance読込後に確定、同progressを維持。失敗は良好sceneとraw draftを保持し、stale/dispose応答はUIを書き戻さない。Esc/配置mode解除はruntime-only、共通shortcutを追加しない。

Play中の中心編集開始前に既存停止経路を使う。scene load/Cancel/Reopen/teardownでdraft・listener・modeを正しく処理する。AI snapshotへpivot/pivotDraft（rawValues、validity、valid）/pivotEditPhase/placementModeを単一current viewから同期し、testidと日本語labelを持つ。nonceは診断へ出さない。360px診断閉で新controlsのoverflowを増やさない。

## Tasks

1. read-only SOLが配置/rest bind契約を反証、司令が必要な追補を確定する。
2. SOLがbackend source/parse/API/独立公式CLI再buildを実装・検証。固定CLI1.3.0/runtime2.44.0 hash gateを維持。
3. backend API契約確定後にLUNAへUIを明示割当。backend filesとは重ねず新module/controller接続を実装。
4. 司令がsource/diff/commandsを監査し、独立actual server/BrowserでApply→Save→旧instance破棄→Reopen/new nativeを一巡する。通常host一件を既存APIで確認。worker報告だけでcloseしない。
5. 配信更新は司令がowned identity/receipt/listener/health/未保存source/image/riv/savedを退避・照合できる場合だけ通常終了→通常bridge起動→未保存exact復元。外部変更や根拠不足ならliveは維持し、独立実装証拠と配信HOLDを分ける。

## Acceptance

- 中央default旧source bytes不変。30°rest/progress0はpivot移動でnative画素不変、56°/progress1はpivot移動でnative描画差あり。grid Center weightはpivotが中央以外なら描画へ影響する。
- 端・小数・型違い・不一致bindを検証、API不正はCLI前400でsource/buildId/dirty/saved/CLI件数不変。内部CLI failureは500/422を維持。
- 角/weight/profile/PNG置換でpivotと既存raw/draft境界を維持。source+PNG Save→旧instance破棄→別directory公式再build/new official runtimeの同progress RGBA/透明PNGを再現する。
- 素材上配置/数値/Apply/Discard、AI同期、共存拒否、360px、dispose/staleを限定実Browser確認。frame/save未適用拒否とoverlay非混入。
- 通常host新Raster/History各一件、元絵不変、Undo/Redo、実ProjectManager export/load後Raster/Export画素一致を既存一経路で確認。Project保存schema/History/rendererを変更しない。
- static/fixture/trusted Browser/native/性能/液タブ/Owner制作受入を分ける。未実測はUNKNOWN/UNVERIFIED。WP034〜037の全面再試験をしない。

## Verification

新model/controller verifier、変更JSのnode --check、既存verify-rive-editor-model/weights/grid/bone/influence/playback/entryの関連境界、司令統合後の製品build、development-harness check、git diff --check。CLI実行は専用cacheだけで公式verify/once/inspect。mock/JSON往復/CLI screenshotだけをnative Browser PASSにしない。司令専用actual editor18841/host18842、worker独立CLI cacheのみ。未知listenerは停止しない。

## Stop

SDK/CLI/runtime/evaluator本体patch、第二version/platform/backend、system install/PATH/login/cloud/publish/CLI再配布、新production保存/Project/History/renderer/SOURCEauthority、旧RIG移行、多PNG/骨追加/長さ編集/自由topology/IK/物理/Timeline、他project/他者process停止、commit/push。重大仕様を未確定のままworker実装しない。本Cardの限定土台を達成したら大きな区切りとして結果と次候補を返し、次の未確定Cardを自動実行しない。

## Completion

backend SOL6.1高、UI LUNA MAX、独立SOL reviewを司令が統合監査。model247/controller27 checks、固定CLI hash/公式再build、実Browser数値draft/適用/破棄/配置クリック/AI状態、rest画素不変と終点差、Center weight差、source＋PNG保存→旧tab破棄→再build/new runtime RGBA/透明PNG再現、実通常Raster/History一件と元絵不変/UndoRedo/Project画素差0を確認。詳細は[司令監査](../ai/WP-038-rive-pivot-audit.md)。製品build/構文/harness/diffを確認。360pxは診断閉の通常controlsで確認、診断展開時は既存overflowを残す。全故障/全embedded操作/性能/液タブ/Owner制作受入は未測定。未確定の多素材/骨追加/IKのCardへ自動実行しない。
