# Phase 9p — Transform-to-Clip Key Bridge / Interaction Context Gate

更新日: 2026-09-01  
状態: ACTIVE — Gate 0=`GO — C: explicit runtime projection + existing Clip key authority`、Gate 1=`GO — B: Transform-local indicator`、Gate 2=`GO — B: split owner + synchronous adapter`、Stage B4進行中  
担当: SOL / MAX

## 1. 目的

Layer Transformを絵の共通変形語彙として維持しながら、Animation Tableと併用した時だけ既存`ClipInstance.transformKeyframes`へ安全に接続できる導線を設計する。

中心仮説は次の通り。

- WHAT = Layer / CAF
- HOW = Layer Transform
- WHEN = Animation Table / ClipInstance
- DO = Canvas

ただしTableを開いただけで現行Vの意味を暗黙変更しない。現行Vはnormal LayerまたはCAF working LayerのRaster sourceをpreview後にBakeする。書込先を誤ると原画破壊または意図しないkey作成になるため、最初にInteraction Contextを読み取り専用で固定する。

## 2. 正本と現状

| 対象 | 現行正本 | 現行History | Phase 9p境界 |
|---|---|---|---|
| static Drawing変形 | `LayerTransform` / `LayerSystem`、confirm時Raster Bake | normal / CAF internal Layer History | 既存挙動を維持 |
| Clip全体の静的配置 | `ClipInstance.transform` | Timeline History | 既存setterを再利用 |
| 時間変形 | `ClipInstance.transformKeyframes` | Timeline History | 新しいkey正本を作らない |
| Frame sampling | `system/animation/clip-transform-sampler.js` | なし | Clip-local 0-based、暗黙base start / endを維持 |
| CAF working Layer | ClipAsset / DrawingSnapshotへの表示・入力adapter | CAF internal History | Clip keyの保存正本にしない |
| Interaction Context | Table / Clip / Frameからのpure projection | なし | runtimeのみ。Projectへ保存しない |

既存`AnimationTablePopup.updateClipTransformKeyframesFromExternal()`はTimeline Historyを作れる。現行`layer:transform-exit`はanimation working LayerをCAF source Bakeとして保存する。Phase 9pは両者を即時接続せず、どちらへ書くかを先に一意化する。

## 3. Gate 0比較

### A. 現行CLIP MOTIONだけでkey編集

- 長所: authorityが明示的で安全。
- 短所: Layer Transformとのskill transferが弱く、CanvasからMotion windowへの往復が多い。
- 保持条件: Bridgeが誤操作を増やす場合のfallback。

### B. Animation Table OPENを無条件にANIMATEとする

- 長所: 最短で即アニメーションできる。
- 短所: Clip未選択、Frame範囲外、複数選択、再生中、source editの意味が曖昧。現行CAF source Bakeとの衝突が大きい。
- 判定: 現段階ではNO-GO。

### C. Table + eligible primary Clip + current Frameを明示runtime projectionする

- Table閉 = `SOURCE`。
- Table開かつ一つのprimary Clip、duration > 1、Clip範囲内、停止中 = `ANIMATE READY`または`ANIMATE KEYED`。
- Table開でも対象が曖昧なら`BLOCKED`。SOURCEへ黙ってfallbackしない。
- Context自体は保存せず、Clip選択 / Frame / Table stateから毎回導出する。
- 判定: `GO`。誤Bakeを防ぎつつTransform-centric導線へ進める。

### D. Transform panel内の明示Add Keyだけを入口にする

- 長所: key作成意思は明示的。
- 短所:WHENの責務がTransform panelへ漏れ、Timelineと二重のkey UIになりやすい。
- 保持条件: Auto Keyを採用しない場合の補助action候補。Stage A1には入れない。

## 4. Stage A1 — read-only Interaction Context

実装対象:

- `system/animation/transform-edit-context.js`
- `AnimationTablePopup.getTransformEditContext()`
- `build/verify-phase9p-transform-edit-context.mjs`

契約:

1. Table閉は`source / layer-source / writable`。
2. Table開で再生中、Clip未選択、複数Clip選択、duration 1、Frame範囲外は`blocked / none / non-writable`。
3. eligible Clipの現在Frameに明示keyがなければ`animate-ready`、あれば末尾優先の`animate-keyed`。
4. `clipId / timelineFrame / localFrame / keyIndex / hasExplicitKey`を説明用に返し、mutableなlive key objectは公開しない。
5. Clip、key、History、working Layer、Project、EventBusを変更しない。
6. `animate-ready`はAuto Key許可ではない。key作成・baseline・preview・confirmは後続Gate。

## 5. 次Stage候補

### Stage A2 — visible Edit Target projection

`build/phase9p-transform-edit-target-placement-fixture.html`でA Global Top Bar / B Transform-local / C Dual Echo / D Canvas Badgeを同じCanvas / Transform / Timelineで比較した。Gate 1=`GO — B: Transform-local indicator`。

- AはTransformを閉じても見えるが、app全体のglobal authoring modeと誤読しやすい。将来global modeが必要な時の再試行候補。
- BはHOWの中でWHENを読め、既存`layer-transform-context-note`の場所を再利用できる。Canvasを隠さず二重projectionも作らない。
- Cは見落としにくいが、同一state二箇所の注意競争と同期責務が過剰。Auto Keyの強い危険表示が必要になるまでNO-GO。
- Dは対象関係が強い一方、handle / Anchor / 絵と競合し、動く対象付近の不要な注意を増やすためNO-GO。
- wide / 480×800、一列stack、4 state切替、横overflow 0、console 0件を確認した。

production表示はまだ接続しない。現行Layer Transform confirmがsource Bakeのまま`ANIMATE READY / KEYED`を表示すると挙動を誤認させるため、Stage Bのtransactionが成立した時にBの位置へ投影する。

### Stage B0 — existing Clip key upsert authority

現CLIP MOTIONのfull composite key upsertを`system/animation/clip-transform-key-upsert.js`へpure plannerとして抽出し、将来Bridgeと一正本化した。

- Clip-local Frame範囲を検証する。
- 同一Frameの末尾keyを既存metadata ownerとし、`hold / easing`を継承する。
- x / y / scaleX / scaleY / rotation / opacity / blendMode / blendStrengthのfull composite keyを作る。
- 入力keyframesとeasingを変更せず、Model / History / previewへ触れない。
- 既存`AnimationTablePopup._upsertSelectedMotionKey()`はplanner結果だけを適用する。
- baseline keyは永続化せず、既存samplerの暗黙base start / endを維持する。

### Stage B1 — Layer gesture delta → sampled Clip transform

`system/animation/clip-transform-layer-gesture.js`へ、Layer Transform sessionの開始値と現在値からgesture差分だけを抽出し、現在Frameのsampled Clip transformへ合成するpure plannerを追加した。

- x / y / rotationは加算差分、scaleX / scaleYは符号を含む比率で合成する。flip後の負scaleも失わない。
- source Layerの絶対transform、Raster、opacity / blendをkey値へ転記しない。opacity / blendはsampled Clip値を維持する。
- Layer開始時scaleが0で逆算不能な場合は拒否する。
- Layer開始 / 現在 / Clip sampleのAnchor context一致を必須とする。Anchor変更はFrame-local keyへ暗黙変換せず`anchor-edit-not-frame-local`、既存Clipとの不一致は`anchor-context-mismatch`で停止する。
- 任意affine matrixの分解は採用しない。非等方scaleと回転の合成で現Clip schemaにないshearを発生させ得るため、既存x / y / scale / rotationのproperty domainを維持する。
- plannerはModel / History / preview / EventBus / Raster Bakeを変更しない。`build/verify-clip-transform-layer-gesture.mjs`がMove / one-axis Scale / Rotate / flip / no-op / Anchor拒否 / input不変を固定する。

### Stage B2 — Transform transaction ownership

#### Gate 2比較

| 案 | 所有 | 判定 |
|---|---|---|
| A. LayerSystem一括所有 | LayerSystemがsource BakeとClip key / Timeline Historyを両方持つ | NO-GO。Layer / CAF / Timeline境界がLayerSystemへ漏れる |
| B. split owner + synchronous adapter | LayerSystemはinput session、AnimationTablePopupはANIMATE preview / Timeline rollback / History | `GO`。既存正本とHistory ownerを維持できる |
| C. EventBus後段接続 | `layer:transform-exit`等をAnimationTablePopupが購読してkey化 | NO-GO。現eventはRaster Bake後で遅く、listener順序とrollbackが曖昧 |
| D. global TransformSession coordinator | 新しい全transform共通controllerを作る | HOLD。現Sliceには抽象化とmigrationが過大 |

`system/animation/transform-edit-transaction.js`へ、B案のstart / preview / finishをpure plannerとして固定した。

- SOURCE owner=`LayerSystem`。既存display preview、Raster Bake、normal / CAF source Historyを維持する。
- ANIMATE owner=`AnimationTablePopup`。既存Timeline stateをbeforeとして保持し、Clip key preview、rollback、1 session = 1 Timeline Historyを所有する。
- ANIMATE開始時にsampled Clip transform、元keyframes、duration、Clip / Timeline / local Frame identityをclone固定する。pointermoveごとにlive sampleを取り直さず、同じbaselineからStage B1 → B0を再計算する。
- `ANIMATE READY`入場だけではbaseline keyを作らない。実gesture差分が初めて生じたpreviewでのみfull composite key候補を作る。
- READY→KEYEDは同一transaction内で許可する。同時にClip / Frame / authorityが変わった場合はretargetせずTimeline previewをrollbackする。
- V toggle /明示confirmは変更ありならSOURCE BakeまたはTimeline History commit、Escapeはsession全体rollback、開始位置へ戻った場合はHistory 0でrollbackする。
- handleの`pointercancel / lostpointercapture`はそのhandle gestureだけを開始値へ戻し、V session自体は閉じない。戻ったLayer transformを同じpreview plannerへ再投影する。
- `layer:transform-exit`からANIMATEを後付けしない。production接続ではLayerSystemがBake前に同期adapterへrouteを問い合わせる。
- plannerはModel / History / Raster / EventBus / DOMを変更しない。`build/verify-phase9p-transform-edit-transaction.mjs`がowner、fixed baseline、no-op key 0、preview key、context invalidation、commit / rollbackを固定する。

### Stage B3 — production preview / confirm connection

Gate 2のsplit ownerをproductionへ限定接続した。

- `CoreEngine`がPopup初期化後に`AnimationTablePopup.createLayerTransformEditAdapter()`を`LayerSystem`へ注入する。LayerSystemはClip / Timeline modelを直接所有しない。
- SOURCEは従来のLayer preview / Raster Bake / normal・CAF source Historyを維持する。ANIMATEだけがBake前に`clip-transform-key` transactionへ分岐する。
- ANIMATEでは選択Clipのworking Raster群を一つのroot Clip表示proxyとして扱い、開始時sampled Clip transformを全proxyへ適用する。各previewは固定baselineからStage B1→B0を再計算し、既存`transformKeyframes`へ一時適用する。
- READY入場だけではkeyを作らない。Move / corner・one-axis Scale / Rotate / flipの最初の実変更でREADY→KEYEDとなる。
- V再入力は変更ありでTimeline Historyを一件だけ記録する。Escape、開始位置復帰、Frame変更、Table closeはpreview keyだけをbaselineへ戻してHistory 0とし、ユーザーが選んだ新Frameなど他のTimeline stateを巻き戻さない。
- Transform-local indicatorは`SOURCE · 原画` / `ANIMATE · F# READY|KEYED`を表示する。Clip key schemaがFrame-local Anchorを持たないため、ANIMATE中の中心点編集はdisabledとし、既存static Clip Anchorを維持する。
- BrowserでREADY→KEYED、Move / Scale / Rotate / flip、明示確定1 History、Escape、Frame変更、Table close、Undo / Redo、motion key marker、console 0件を確認した。

### Stage B4 — production hardening / close Gate

Stage B3のownershipを広げず、既存key更新、no-op、複数選択 / playback BLOCKED、normal Layer / CAF SOURCE退行、Project save / reloadを固定入力で監査する。通過後にPhase close可否と、次PhaseのDrawing WARP入口を選定する。

最初の表示hardeningとして、選択中のCAF内部Layer行へ`ClipInstance.transformKeyframes`の明示keyを小さな丸で読み取り専用投影した。これはLayer固有keyを新設せず、親CAF帯に既存表示しているClip Motion keyを同じFrame位置へechoする。Part / Bone keyの菱形、WARP key、保存schema、Timeline History、cell clickは変更しない。F2へのkey作成、Undoで消失、Redoで復帰、tooltipの`CAF Motion key`明示、console 0件をBrowserで確認した。

## 6. NO-GO

- Stage A1でAuto Key、baseline key、key mutationを実装しない。
- SOURCE側`layer:transform-exit`のCAF source Bake契約を切り替えない。
- Interaction ContextをProject / localStorage / Historyへ保存しない。
- Clip Motionとは別のtransform key schema / Historyを作らない。
- Drawing WARP、static RIG ownership、RIG Mesh、virtual grid / Motion Pathを並走しない。
- Top Bar全体、Transform popup全体、Animation Table全体の再編を先行しない。

## 7. Acceptance Criteria

- Stage A1 verifierがSOURCE / READY / KEYED / BLOCKEDと曖昧条件を固定する。
- projectionが入力Clipを変更しない。
- AnimationTablePopupが既存選択 / Frame authorityからprojectionを公開する。
- `node --check`、全verifier、production buildを通過し、`dist/`差分を残さない。
- visible UIへ進む前に、Contextの意味とfallback条件がPhase書で追跡できる。
- Stage A2 fixtureが4配置と4 context stateを一DOMで比較し、Transform-local選定と再試行条件を保持する。
- Stage B0 plannerが現CLIP MOTIONのkey shapeを変えず、将来Bridgeの第二key契約を防ぐ。
- Stage B1 plannerがsource Layerの絶対値をkey化せず、同一Anchor context内のgesture差分だけをsampled Clip transformへ合成する。
- Stage B2 plannerがSOURCE / ANIMATEのownerを一意化し、固定baseline、no-op key 0、context変更rollback、1 session = 1 Historyを固定する。
- Stage B3 production verifierがoptional adapter、Bake隔離、targeted rollback、indicator、Frame / Table close terminalを固定する。
- Stage B4では選択中のCAF内部Layer行が既存Clip Motion keyを同一Frameへ読み取り専用投影し、第二key authorityを作らない。
- 全137 verifier、production build、Browser fixture / production、console 0件、生成物清掃を通過する。

## 8. 次作業予告

次taskはPhase 9p Stage B4の既存key更新 / no-op / BLOCKED監査です。その後にnormal Layer / CAF SOURCE、Project save / reloadを順に固定し、Phase close可否と次PhaseのDrawing WARP入口を選定します。作業担当はSOL / MAXです。Drawing WARP実装、static RIG、global Auto Key、baseline永続化はこのStageへ並走しません。
