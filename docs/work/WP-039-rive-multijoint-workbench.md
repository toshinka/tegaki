# WP-039 — 多関節・パラメーター・メッシュ変形の編集道具

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Owner 2026-10-06: 実績あるengineを過剰検証せず、腕/ヘビのような多関節の絵をパラメーターで動かし、ワープ的変形を最低限操作できる道具まで進める。WP038の二骨制限は今回の確定契約で拡張した。[司令監査](../ai/WP-039-rive-multijoint-audit.md)。制作受入/採用/pushはOwner。

## Goal

一枚PNGへ2〜8本の連鎖骨を配置し、関節角・点の追従配分・メッシュ点の終点変形を編集、ポーズ0..1パラメーターでnative補間できる道具を通常新RIG入口へ届ける。腕/ヘビpresetと原画像上の関節配置、関節別数値、メッシュ点選択/ドラッグ/数値、Apply/Discard、Save/Reopen、透明1xPNGと通常Raster追加を一巡する。形状/骨/補間/描画は公式Rive。CubismのBezier warpや全機能互換とは称さない。

main/4760db9c16f2af50345916381d45559cec7b1733、既存全dirty/外部commitを保持。読む順: AGENTS→STATUS→TECHNICAL→本Card→対象header。source RML+PNGがdetached編集正本、rivは派生。既存Project/History/renderer/SOURCE/ANIMATE authority、親frame protocol、既存Raster APIを維持。旧二骨sourceは読込維持、新道具への変換は明示操作だけ。

## Contract

`chain` は `{joints:[{x,y},...], angles:[number,...], warp:[{x,y},...], weights:[{a,b,mix},...]}`。骨数=angles.length、2..8、jointsは骨数+1、原PNG pixel座標0..width/height、各segment長1px以上。anglesはrestに対する終点の相対角増分degree -90..90。数値finite number、小数3桁。明示null/型違い/配列長不一致はCLI前拒否。

固定meshは9列×5行、45点、64triangle。vertex配列はrow-major、外周ContourMeshVertexは周回順でRMLへ並べ、内部MeshVertexを続け、triangle indicesをRML出力順へ変換する。UVは原画像の固定0..1。各点warp x/yは原PNG localでの終点変位、各軸±画像該当寸法。weightsは二骨まで、a/b整数0..骨数-1、mix整数0..255、aの値255-mix/bの値mix、端点/同骨は単一255へcanonical化。自動bindは原位置から二つの最寄りrest segmentへの距離に基づく配分、ゼロ距離は該当骨100%。評価器を自作せず、これはauthoring初期値だけ。

rest joint位置から各骨のlength/relative rotationとworld rest Tendon行列を生成、Skinはimage local、Tendon tx/tyはjoint-image中央。Root名`Root`、後続`Joint2`等、全骨のrotation track key15と全mesh vertex x/y track key24/25を既存一秒`EndPose`に置く。frame0はrest、frame60はrest+anglesとbase+warp。共通pose progress0..1を公式runtime.seekで補間。各関節angleは独立した終点編集値であり、独立animation parameterの多軸keyform合成とは区別する。runtimeへmesh setter/自作変形を追加しない。

新 `chain-model.mjs` がsource生成/解析/strict canonical regeneration/default/resize helperを所有。`model.mjs`はcreateSource({chain})/parseSourceMetadata/makeSnapshotをbranch接続する。snapshotはrigMode:`chain`/`legacy`、chain、mesh countsをsource由来で返す。legacy snapshot angleは従来、chain angleはangles[0]（親protocol互換の有限-90..90値）。chain meshProfileは`chain-grid`、legacy meshWeightsをchainでassertしない。

既存POST `/api/compile` に `{chain,progress}` branch。chain指定無しでchain sceneへlegacy角/profile/pivot操作は409拒否、明示legacy移行は今回不要。PNG置換はjoints/warpを新寸法比で移しweights/anglesを維持。Save/Cancel/Reopen/起動は同じsource+PNG経路、良好sceneは不正入力/CLI失敗で保持。POST新endpoint/security/bodylimitは増やさない。

## Scope

backend SOL単独WRITE: `advanced/rive-editor/chain-model.mjs` NEW、`model.mjs`、`server.mjs`、`build/verify-rive-chain-model.mjs` NEW、`docs/ai/WP-039-rive-chain-backend-result.md`、`.cache/rive-editor/wp039/backend/`。server root `/`は新workbench.htmlへ、旧`/editor.html`を維持。static登録はworkbench.html/jsとchain-controller.jsと既存runtime/playbackのみ。backendはUI filesを作らない。

UI LUNA単独WRITE: `advanced/rive-editor/workbench.html` NEW、`workbench.js` NEW、`chain-controller.js` NEW、`build/verify-rive-chain-controller.mjs` NEW、`docs/ai/WP-039-rive-chain-ui-result.md`、`.cache/rive-editor/wp039/ui/`。独立controllerは原図の関節配置/45点warp/weights/raw draft/選択を担当、画面glueはAPI/native runtime/protocol担当。既存editor.js/html/controllersを刷新せず新画面へ分離。日本語labels/testids/AI snapshotから選択骨/点、draft valid/raw、確定chain、progress、busy/reasonを観測可能にする。内部nonceは出さない。

司令WRITE: Card/STATUS RIG/案内/登録/manifest/audit/cache、必要な既存host可視検証面だけ。reviewはread-only。runtime.js/evaluator/骨直接previewの追加は不要。共通Layer/Project/History/Export/Pixi/core/index/Vite/package/lock、漫画/font/keyboard/commonCSS/bridge/dev-companionは全員read-only。同file並列write無し。他者の編集を戻さない。製品buildは司令の統合時一回。

workbenchは旧sourceでもnative読込/seek/PNG受渡し可能、明示「腕3関節」「ヘビ6関節」でchain draftを作る。preset/count変更はwarp/weights再作成を表示しApplyまで良好scene保持。関節rest配置とendpoint角/warp/weightsの数値/dragはlocal draft、Apply一回CLI、新runtime成功後確定。focus/selectionはdraft0、空欄/raw5を他欄で補修しない。drag中はSVG目標位置の表示のみ、画像そのものの変形はnative Apply後。移動点は原図上の終点変位（skin前）と明示し、native preview上の変形済点の独自逆算をしない。

draft中save/frame/play/scrubを拒否、Discardでnative良好sceneを保持しCLI0。progress sliderは確定poseをnativeで即操作、既存playback controllerを用いplay/stop/終点/blur/hidden/teardownの停止と毎tick CLI/PNG/History0を維持。保存→再読込、画像置換前に停止。親postMessageは既存origin/source/session/version/request/build/document/progressの照合を継承、ready/native/非draft時だけPNG転送。親hostの通常Raster受渡しは変更しない。

## Tasks

SOLはchain source/API、LUNAは独立workbench/controllerを実装しfreeze。司令は一代表の実編集・native保存再現・通常Raster経路を確認し、現在地と根拠を更新する。同file並列writeをしない。

## Acceptance

追加接続の入力境界/旧source一例/native代表一例に絞る。骨数ごとの網羅native試験、上流engine再試験、旧新全機能整合はしない。3または6節の折れ曲がり＋一メッシュ点warpを実画面でApply→pose0/0.5/1→Save→旧runtime破棄→Reopen/new runtime→透明PNG→通常Raster一件/UndoRedo/実Project往復まで確認。native描画差と同pose再現、restが元PNGの形を保持すること、不正入力が良好sceneを維持することを測る。変更syntax/限定verifier/build/harness/diff。static/Browser/native/性能/液タブ/Owner受入を分ける。

## Verification

変更JSの`node --check`、`node tegaki_work/build/verify-rive-chain-model.mjs`、`node tegaki_work/build/verify-rive-chain-controller.mjs`。司令は製品build、`node tegaki_work/build/development-harness.mjs check`、`git diff --check`、上記代表Browser経路を確認。workerが確認した同hashのpure/CLI試験を反復しない。

## Stop

workerはlive18729/18842への停止/restart/API mutationなし、独立cacheのみ。司令はowned process identity/receipt/listener/未保存source/savedを照合・退避した後だけ正常終了/通常bridge復帰。未知processを停止せず、二重serverでshared session/savedを使わない。

配信追補: 18842の既存Browserは漫画編集で使用されているためreload/入力/Vite停止をしない。司令の新通常productは18844、独立actual editorは18843。現own companion18729 PID31600はchild stdin ignoreで外部からgraceful hookへ到達しない。worker終了後、receipt token/PID/executable/starttime/listener/healthと開始source/dirty/saved不変を照合できる場合だけ、既存dev-companion own-child終了と同じNode SIGTERMを当該leafへ送る（Windowsではterminate相当）。共用Vite/font/漫画を停止しない。新18844の既存bridge ensureで更新companionを起動する。未保存やidentityが変わればこの限定手順は実行せずliveを維持する。

SDK/CLI/runtime本体patch、別version/backend/platform、system install/PATH、cloud/login/publish/CLI再配布、production保存/renderer/History authority、旧RIG移行、多PNG/IK/物理/Timeline、他project/他者process停止、commit/pushはSTOP。固定SDKの具体的blockerなら根拠を返す。道具一巡の大きな区切りまで進め、未受入をDONEにしない。

## Completion

技術完了は司令監査とSTATUS/登録/案内の反映を伴う。Owner制作受入/採用/pushを自己承認しない。未測定の多軸独立parameter/多PNG/IK/物理/Timeline/性能/液タブを成立範囲に加えない。

司令は実3骨＋warpのApply/pose0・0.5・1/source+PNG Save/旧tab破棄/Reopen/新native同画素、直接関節drag/Discard/raw拒否/透明PNGを確認。通常新入口で編集→Raster/History各一件、元絵不変、UndoRedo、実Project Raster/Export差0を確認した。通常18844/18729を動く入口として維持、漫画18842は操作しない。未受入をDONEにせず、この道具一巡で区切る。

## Manuals

[Rive Meshes](https://rive.app/docs/editor/manipulating-shapes/meshes): vertex変位/骨skin/元contourとdeformの区別を参照。[Live2D Keyforms](https://docs.live2d.com/en/cubism-editor-manual/keyform-xydirection/): endpoint形を定めparameterで動かす操作を参照。実RMLの属性/packed weights/keysは固定CLI1.3.0同梱rigging.mdとschemaが正本。
