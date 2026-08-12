# Phase 7q — Motion Graph Key Navigation / Easing Bridge

更新日: 2026-08-12  
担当: SOL / XHigh（Gate・契約・review）、限定UI adapterはLUNA / MAXまたはSOL  
状態: CLOSED — Gate 0 `GO`、Stage A / B、SOL review=`A`、Browser確認完了

## 1. 目的

Phase 7mのread-only Motion Graphを値編集へ広げず、explicit Motion key markerのclickでそのFrameへ移動し、Graph popup内の明示`EASING`操作から既存EASING CURVEを開けるようにする。Graph、Curve、CLIP MOTION数値欄、Canvasが同じ既存keyを参照する導線だけを追加する。

## 2. 候補比較とGate 0

| 候補 | リスク | 判定 |
|---|---:|---|
| 既存keyのGraph値drag | 高 | gesture transaction、複合key、channel ownershipの監査が必要なため後送 |
| Motion Path | 高 | spatial tangent / schema / Canvas overlay境界が未確定のため後送 |
| manual Mesh / weight編集 | 高 | topology / weight / selection / Setup UIを跨ぐため別Gate |
| Graph key navigation + Easing bridge | 低〜中 | runtime UIと既存seek / Curve入口だけで閉じるため採用 |

判定: `GO`

- Graph view modelは既に`keyPoints[].localFrame / projectFrame`を持ち、新しい保存fieldは不要。
- Frame移動は既存`model.setCurrentFrame()`、working Layer同期、preview invalidation、render、frame-changed通知を共有する。
- Easing編集はPhase 5z6 / 7pの既存EASING CURVEを開くだけで、第2のcurve editorを作らない。

## 3. Stage A — navigation adapter

- SVG explicit key markerへlocal Frameをdata属性として付与し、clickで同じClip内のFrameへ移動する。
- implicit boundary marker、curve path、grid、cursor clickではseekしない。
- playback中、無効target、Clip外、missing keyは非mutation拒否する。
- seekはHistoryを増やさず、Graph cursor、CLIP MOTION数値、Timeline current列、Canvas previewを既存renderで同期する。

## 4. Stage B — Easing bridge

- Graph popup headerまたはstatus近傍へ`EASING`を置き、現在Frameに右区間を持つexplicit Motion keyがある時だけ有効にする。
- 実行時は既存`_setMotionCurveWindowOpen(true)`を使う。HOLDはPhase 7pどおりread-only curve + COPY / PASTE、terminalは理由付きdisabledとする。
- Graph独自selection、selected key保存、Graph専用Historyを作らない。

## 5. 非対象

- Graph上のvalue / time drag、key追加・削除、box select、zoom / pan保存。
- Motion Path、spatial tangent、parameter別easing、Bounce / Elastic / Loop。
- Warp / Bone / Part marker、Canvas path overlay、Project / History schema変更。

## 6. 検証

- UI verifier: explicit markerだけにFrame data、既存seek / Curve入口、無効条件、保存・History非接続。
- 変更JS / mjsの`node --check`、全`verify-*.mjs`、`npm.cmd run build`。
- Browser: 5 groupで同じkey marker seek、Timeline / Graph cursor / Motion値同期、EASING open、HOLD / terminal、playback拒否、Table / Graph / Curve close-reopen、console error。

## 7. close条件

Stage A / B、SOL review、関連Browser確認を通過すれば技術close可能。Owner制作環境の長尺CAF / pen / touchは`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`へ分離する。

## 8. Stage A / B結果 — LUNA限定UI adapter

- explicit Motion key markerへ`data-motion-graph-key-frame` / project Frameを付与し、markerのclickまたはEnter / Spaceで同じClipの既存key Frameへseekする導線を追加した。各channelの同一key markerは同じlocal Frameを共有する。
- seekは既存`model.setCurrentFrame()`、working Layer同期、preview invalidation、render、Layer Panel sync、`animation:frame-changed`を通し、Timeline History・Project保存・Motion key配列を変更しない。同一ClipにないFrame、missing key、Clip外、再生中は非mutationで拒否する。
- Graph path、grid、cursor、implicit boundaryにはkey dataを付けず、clickしてもseekしない。markerはSVGのkeyboard focusにも対応する。
- Graph headerへ既存EASING CURVEを開く`EASING` buttonを追加した。現在Frameがright segmentを持つexplicit keyの時だけ有効で、terminal / HOLD / playbackは既存契約どおりdisabledまたはread-onlyとなる。実行時は`_setMotionCurveWindowOpen(true)`だけを呼び、第2のcurve editorやGraph専用selectionを作らない。
- `verify-motion-graph-ui-adapter.mjs`へmarker data、navigation、EASING bridge、disabled条件、非対象境界、palette styleの静的検査を追加した。変更JS / mjsの`node --check`と関連verifierは通過済み。

## 9. SOL review / close結果

- SOLはnavigation adapterが既存`setCurrentFrame()`、working Layer同期、preview invalidation、render、Layer Panel同期、`animation:frame-changed`だけを使い、Motion key配列、History、Project、sampler / compositor / exportへ書き込まないことを確認した。markerはexplicit keyだけで、implicit boundary / path / grid / cursorにinteraction dataはない。判定は`A`。
- BrowserではPOSITION / SCALE / ROTATION / OPACITY / BLENDの5 group、同一explicit key marker、mouse clickとEnterのseek、Timeline current列 / Graph status同期、History非増加を確認した。
- explicit非終端keyから既存EASING CURVEを開き、HOLDは入力read-only + COPY可、terminalと再生中はEASING disabledとなることを確認した。Graph / Curve close-reopenも成立した。
- 再生中はGraphをread-only更新し、marker DOMはFrame更新で再描画される。mutation guardはverifierとコード監査で固定し、再生開始 / 停止後のHistory増加はなかった。
- Browser console warning / errorは0件。変更JSの`node --check`、全57 `verify-*.mjs`、`npm.cmd run build`を通過し、`dist/`と`node_modules/.vite/`の生成差分を清掃した。

Stage A / B、SOL review、関連Browser確認を通過したため2026-08-12に技術closeする。Owner制作環境の長尺CAF、pen / touch、再生中の高頻度marker更新等は`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`へ分離し、本Phaseを再OPENする条件にはしない。
