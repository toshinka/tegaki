# Phase 7b — Deformer SELECT / RECT runtime selection

更新日: 2026-08-08
担当: Sol High / XHigh（設計・監査・最終判定）、Luna MAX（Stage 1限定実装）
状態: CLOSED（SOL最終判定A・Owner実機受入）

## 目的

WARP GRIDのcontrol pointを一つずつ動かす現行`POINT`へ、矩形範囲選択と選択点の一括移動を追加する。

選択状態は操作UIに限定し、既存WARP deformer / keyframe / topology / Folder targetを正本として使う。新しいselection、mask、Motion、Mesh正本は作らない。

## Slice 0監査結果

- `AnimationTablePopup._warpGridTool`が`grid / lens / point / brush`を所有し、Canvas gestureと既存Warp keyのcommit / Historyを管理する。
- `WarpGridOverlay`はworld pointをscreenへ投影するdisplay-only SVGで、poseやProject正本を所有しない。
- fixed 4×4 WARPと可変Control Meshは、編集中のpose point列を`_upsertSelectedWarpGridKey()`へ渡す既存確定経路を共有する。
- `M`は現行BRUSHの`MOVE / INFLATE / PINCH / SMOOTH`巡回に使う。SELECT導入でBRUSH中の意味を変更しない。
- native tooltipやneutral黒白を増やさず、既存Futaba変数と`ui-help-tooltip`を使う。

## Stage 1 — RECT選択と一括移動

### pure helper

`system/animation/warp-point-selection.js`を追加し、DOMやmodelへ依存しない次だけを扱う。

- screen座標矩形の正規化
- point列から矩形内indexを決定
- replace / toggleのindex集合演算
- 選択indexだけへ同じProject座標deltaを適用した新しいpoint列の生成
- 非finite座標、範囲外index、空選択を無言で保存値へ混ぜない

### runtime state

`AnimationTablePopup`に選択Clip ID、Folder target ID、選択point index集合、shape=`rectangle`をruntimeだけで保持する。

- Clip / Folder target変更、deformer削除・再生成、point数変更、WARP editor終了でclearする。
- Frame移動では同じtarget / topologyなら選択indexを維持できる。Project、History、Emergency Recoveryへ含めない。
- fixed 4×4と可変GRIDで別のselection正本を作らない。

### UI / gesture

- WARP tool列へLucide `square-dashed`の`SELECT`buttonを追加する。SVGは`currentColor`、通常／hover／active／disabledをFutaba paletteで確認する。
- 空Canvas dragでmarqueeを表示し、pointerupで矩形内pointを選択する。通常dragはreplace、Ctrl/Cmd dragはhit indexのtoggleとする。
- 選択pointの一つをdragすると全選択pointを同じProject座標deltaでpreviewし、pointerupで既存Warp keyへ一度だけcommitする。
- 未選択pointをdragした場合はその一点へreplaceしてから移動する。空clickは選択解除。
- Escape / pointercancel / lostpointercaptureはgesture開始時poseへ戻し、Historyを増やさない。確定は1 gesture = 1 History。
- SELECT active中の`M`はStage 1ではshapeを変更せずRECTを維持する。BRUSH active中の`M`巡回は現状維持する。
- pen / touchはmodifierなしのreplaceと一括dragを主導線とし、hoverを必須にしない。

### Stage 1実装結果（2026-08-08）

- `system/animation/warp-point-selection.js`へDOM/model非依存の矩形正規化、finite point判定、replace/toggle、選択pointのdelta移動を追加した。
- `AnimationTablePopup`の既存WARP gestureへ`SELECT`を追加し、空Canvas drag、Ctrl/Cmd toggle、選択point一括移動を既存のpose key確定・History経路へ接続した。selectionはClip ID / Folder target ID / topology signature / point count付きのruntime状態で、保存・History snapshotへ含めない。通常クリックと3px未満のpointer揺れではkey・Historyを追加しない。
- SOLレビュー追補として、History Undo / Redo後もdeformer topology signatureを照合し、同じpoint数の別GRIDへ古い選択indexを持ち越さないようにした。
- `WarpGridOverlay`は選択point classとdisplay-only marqueeを描画する。SVG marqueeは`hidden`属性で確定後に消し、overlayの`pointer-events:none`を維持した。
- `build/verify-warp-point-selection.mjs`、全`build/verify-*.mjs`、変更JS/mjsの`node --check`、`npm.cmd run build`を通過した。Browserでは8×8 GRIDで4点矩形replace、Controlクリックtoggle、5点一括移動（History 1件）とconsole error/warnなしを確認した。
- SOL最終レビューで通常clickのno-op Historyと同point数別topologyの選択持越しが解消済みであることを確認し、Owner実機確認を受けて判定`A`でcloseした。Stage 2（circle / polyline / soft weight）は開かない。

### overlay

`WarpGridOverlay`は選択point classとdisplay-only marquee rectangleだけを描画する。

- overlayは`pointer-events: none`を維持する。
- 選択pointは橙、marqueeはFutaba茶／橙の破線とcream透明面を使い、black / white / neutral grayを使わない。
- pose point、brush influence、Bind / Lens secondary pointとの役割が色とclassで衝突しないこと。

## Stage 2候補（Stage 1受入後まで実装しない）

- `M`: RECTANGLE → CIRCLE → POLYLINE巡回
- Shift追加、Alt減算などmodifier拡張
- soft selection weightとfalloff
- Mesh vertex / ControlHandleへの同UI adapter
- 選択点の回転・拡縮handle

いずれもruntime UI stateを維持し、effect mask、Bind bounds、topology、Raster Pixel Selectionへ流用しない。

## 維持する契約

- Folder別WARPとCAF全体WARPは既存stable target IDを使う。
- GRIDはBind Setup、POINT / BRUSH / SELECT移動はFrame Pose、LENSはWarp key placement。
- preview / playback / onion / Bake / exportは既存deformer sampleを共有する。
- pointercancelは変更を残さず、確定は1 gesture = 1 History。
- stroke中working Layer、preview stagingとcontainer順、上側Lane前面、Lane onion display-only、PSD record順を維持する。

## 非対象

- WARP effect mask、Deformer mask、Raster Pixel Selectionとの統合
- Circle / Polyline、soft weight、回転・拡縮
- Mesh topology、SkinWeight、BONE、IK、Constraint、physics
- Project / Historyへのselection保存
- Animation TableやWarp overlayの全面再構成
- Layer Panel、Emergency Recovery、通常Ctrl+Sの追加変更

## 検証

- pure helperの固定入力verifier
- 変更JS / mjsの`node --check`
- 全`build/verify-*.mjs`
- `npm.cmd run build`
- BrowserでCAF全体／Folder別、fixed 4×4／可変GRIDについて、選択、Ctrl/Cmd toggle、一括移動、Frame移動後維持、target切替clearを確認
- Escape / pointercancel、Undo / Redo、key無し拒否、Table閉鎖／再表示、console errorを確認
- 可能ならpen / touchでreplace選択と一括dragを確認
- build後に`dist/`と`node_modules/.vite/`の生成差分を残さない

## 停止条件

- 選択をProject / Warp keyへ保存しないと成立しない。
- fixed WARPとControl Meshで別のgesture確定経路が必要になる。
- overlayがpointer inputの正本を持つ必要がある。
- 既存POINT / BRUSHのcancel、History、Folder target境界を共通化せず複製する必要がある。
- 100行超の一括削除、主要class再構成、DOM大幅置換が必要になる。

## SOL review項目

- runtime selectionがProject export / History snapshotへ混入していないか。
- screen矩形判定とProject delta変換を混同していないか。
- target / topology変更時に古いindexが別GRIDへ適用されないか。
- pointercancel / lost captureでpreview poseとselectionが不整合にならないか。
- 一括dragが点数分のHistoryやrender commitを作っていないか。
- BRUSH中の`M`、POINT、GRID、LENS、Folder別WARPを壊していないか。
