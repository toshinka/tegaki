# Phase 7r — Motion Graph Existing-Key Value Editing

更新日: 2026-08-12  
担当: SOL / XHigh（Gate・gesture / History契約・review）、限定UI adapterはLUNA / MAXまたはSOL  
状態: OPEN — Gate 0 `GO`、Stage A / B、SOL review=`A`、Browser確認完了。build生成差分の清掃待ち

## 1. 目的

Phase 7m / 7qのMotion Graphを、既存explicit Motion keyの値編集だけへ限定して広げる。Graph固有のkey、track、selection保存、History正本を作らず、Canvas直接操作と数値scrubが使う既存`ClipInstance.transformKeyframes` mutationへ接続する。

## 2. Gate 0監査

### 再利用する契約

- `AnimationDataModel.setClipTransformKeyframes()`は既存複合key配列を更新するmodel入口で、Historyを独自に持たない。
- `AnimationTablePopup._upsertSelectedMotionKey()`はCanvas dragと数値scrubのlive previewが共有する既存mutation入口。現在Frameの複合keyを一件だけ置換し、左key所有の`interpolation / easing`を維持する。
- `_captureTimelineHistoryState()` / `_recordTimelineHistory()`はpointerup時の1 gesture 1 History、`_restoreTimelineHistoryState()`はcancel rollbackへ再利用できる。
- Phase 7qのmarker seekはHistoryを増やさず、Graph / Timeline / CLIP MOTION / Canvasを同じexplicit Frameへ同期する。

### 監査上の注意

- 現行keyはproperty別trackではなく複合key。Graph側でchannel別key正本を作らない。
- Timeline marker横dragはtime moveをpointerupで確定する契約であり、Graphのlive value previewへ流用しない。
- 数値scrubとCanvas root Motionの既存`pointercancel`はrollback専用契約ではない。Graphはこれをコピーせず、Curve Editorと同じ明示rollbackを使う。既存操作のcancel統一は別bug fix候補とする。
- POSITION / SCALEは二channelが重なり得るため、編集channelはGraph内のruntime active channelで明示する。Project / Historyへ保存しない。

## 3. Gate 0判定

判定: `GO`

次をすべて守る最小Sliceなら、保存schema、sampler、preview / export評価経路を変えず実装できる。

- 対象は既存explicit Motion key一件だけ。implicit boundaryは編集しない。
- active channel一つの値だけを縦dragする。横方向のFrame移動は行わない。
- pointerdownでPhase 7qの既存seekを完了してからbefore stateを採る。
- pointermoveはpureな表示単位変換後、既存`_upsertSelectedMotionKey()`でlive previewする。
- pointerupは実変更がある場合だけHistory 1件。tap / 微小揺れはHistory 0件。
- `pointercancel` / `lostpointercapture` / Escapeはbefore stateへ復元し、History 0件。
- 再生中、missing Clip / key / channel、非有限値は非mutation拒否する。

## 4. Stage A — pure channel patch

- POSITION X / Yはpx、SCALE X / Yはratioをそのまま保存する。
- ROTATIONはGraphのdegreeを保存radianへ変換する。360°超と負値をwrapしない。
- OPACITY / BLEND StrengthはGraphの%を0..1へ変換し、0..100%へclampする。
- 他channel、`blendMode`、`interpolation / easing`は変更しない。

## 5. Stage B — Graph gesture adapter

- Graph legendをruntime channel selectorにし、active curve / markerを橙、他channelを既存maroon線種で示す。
- explicit markerの通常click / Enter / SpaceによるFrame seekを維持する。
- active markerのpen / mouse / touch縦dragだけを値編集へ接続する。
- drag中はGraph curve / marker、CLIP MOTION数値、Canvas previewを同期する。

## 6. 非対象

- keyのFrame移動、隣接key越え、衝突merge、複数key value drag。
- key追加・削除、implicit boundary materialize、box select、Graph zoom / pan保存。
- parameter別easing、Graph tangent、Motion Path、Warp / Bone / Part key、manual Mesh。
- Project / History / sampler / compositor / export schema変更。

## 7. 検証

- pure verifier: 全channelの単位変換、clamp、他値不変、invalid拒否。
- UI verifier: explicit markerだけ、runtime channel、既存mutation入口、pointerup 1 History、cancel rollback、time move非接続。
- 変更JS / mjsの`node --check`、全`verify-*.mjs`、`npm.cmd run build`。
- Browser: POSITION / SCALEのchannel切替、ROTATION / OPACITY / BLEND drag、tap History 0、drag History 1、Undo / Redo、Escape / pointercancel相当、playback拒否、Table / Graph close-reopen、console error。

## 8. close条件

Stage A / B、SOL review、関連Browser確認を通過すれば技術close可能。長尺制作Project、pen / touch、狭幅 / low viewportはOwner確認台帳へ分離する。

## 9. Stage A / B結果

- `motion-graph-key-edit.js`を追加し、POSITION / SCALEの表示値、ROTATION degree→radian、OPACITY / BLEND percent→0..1 clampをpure変換する。他channelと`blendMode`を維持し、invalid channel / valueを非mutation拒否する。
- Graph legendをruntime active channel selectorへ変更した。active path / markerは橙で最後に描画し、重なるX / Yでも選択channelがpointer hitの前面になる。他channelは既存maroonと線種差を維持する。
- explicit markerのpointerdownは既存seek後にbefore stateを採り、document captureのpointermove / pointerup / pointercancelで外releaseを含むtransactionを閉じる。live previewは既存`_upsertSelectedMotionKey()`、確定は`caf-clip-motion-graph-value-drag` 1 History、cancel / lost capture / Escapeはrollbackとした。
- 現在Frame cursorがmarkerのhitを奪わないよう`pointer-events: none`を指定した。implicit boundary、path、gridは編集入口を持たない。
- 横移動は値へ影響せず、Frame time move、key追加、複数key、Graph保存stateは追加していない。

## 10. SOL review / Browser結果

- pure helper、UI adapter、CSSを実コード照合し、複合key ownership、既存sampler / compositor / export非変更、pointerup 1 History、cancel rollbackを確認した。SOL判定は`A`。
- BrowserではPOSITION Y、SCALE Y、ROTATION、OPACITY、BLEND Strengthの縦dragと数値 / curve同期、channel selector、tap seek History 0、drag History 1、Undo / Redoを確認した。
- 実操作で、plot外release時にSVGだけではpointerupが届かない例と、cursorが現在markerのhitを奪う例を検出した。document capture transactionとcursor display-only化で修正後、外release確定とHistory増加を再確認した。
- 再生をFrame先頭から開始した状態ではmarker dragを拒否し、Historyを増やさない。Graph close / reopenでruntime groupを維持し、console warning / errorは0件だった。
- 変更JS / mjsの`node --check`、全58 `verify-*.mjs`、`npm.cmd run build`は通過した。

追跡済み`dist/` / `node_modules/.vite/`基準は復元済み。最終buildが新規生成したuntracked `dist/assets` 5件とBrowser確認用Vite log 2件の削除だけが実行環境の承認制限で未完了のため、本PhaseはまだArchiveへ移さない。清掃確認後にOwner制作確認項目を台帳へ分離して技術closeする。
