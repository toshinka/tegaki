# Phase 7v — Motion Gesture Cancel / No-Move History Consistency

更新日: 2026-08-13
担当: SOL / XHigh（Gesture境界・最終review）、限定runtime adapterはLUNA / MAXまたはSOL
状態: CLOSED — Stage A / B、全62 verifier / build、SOL最終review=`A`

## 1. Goal

Animation Tableの既存Motion数値scrubとCanvas root Motion dragを、Phase 7r Motion Graphと同じ「tap/no-op History 0、実変更pointerup History 1、cancel / lost capture / Escape rollback」へ揃える。

## 2. Current evidence

### Number scrub

- `_bindMotionNumberInputScrub()`は4pxで`moved`にし、`beforeState`をcaptureする。
- `pointercancel`も通常`finishPointer()`へ入り、cancel判定なしでHistoryを確定する。
- 4〜5pxで`stepCount=0`のまま`moved=true`となり、実値変更なしでもHistory確定経路へ入る。

### Canvas root Motion

- `_motionCanvasGesture`はpointerdown時に`beforeState`を持つが、client threshold / `changed`を持たない。
- pointermoveはdeltaが0または微小でも`_upsertSelectedMotionKey()`を呼び得る。
- pointercancel / lostpointercaptureも通常終了と同じ`_finishMotionGestureHistory()`へ入り、rollbackしない。
- Escape handlerはWARP / Bone / Partだけを扱い、root Motion gestureをcancelしない。

Phase 7r Motion Graph value dragは`changed` / `mutated`とcancel rollbackを既に持ち、比較正本にできる。

## 3. In scope

- `_bindMotionNumberInputScrub()`のactual-change判定、pointercancel rollback、tap/no-step History 0。
- Canvas root Motion gestureのclient threshold、`changed` / `mutated`、cancel / lost capture / Escape rollback。
- pointerup actual changeだけ1 History、live previewと既存複合Motion key正本の維持。
- verifier、node check、全verifier、build、Browser限定操作。

## 4. Out of scope

- Motion Graph、Easing Curve、Bone / Part、WARP gestureの再設計。
- key時刻移動、key追加UI、複数key drag、Motion Path。
- 保存schema、History形式、sampler、preview / exportの変更。
- pointer thresholdの全app共通化、新gesture framework。

## 5. Stage A — pure gesture contract

- Number scrubは`stepCount`が実際に0から変わり、preview mutationが成功した場合だけ`changed=true`とする。
- `pointerup && changed`だけHistory 1。tap、threshold通過後step 0、値clampで実値不変はHistory 0。
- `pointercancel`はmutation済みならbeforeStateをrestoreし、未mutationなら表示同期だけ。History 0。
- Canvas root Motionはclient distance 2px未満をtapとしてupsertしない。
- threshold後もworld delta / transformが実質不変なら`changed=false`を維持する。
- `pointercancel` / `lostpointercapture` / EscapeはbeforeStateへrestoreしHistory 0。

## 6. Stage B — runtime adapter

- 既存`_captureTimelineHistoryState()`、`_restoreTimelineHistoryState()`、`_finishMotionGestureHistory()`、`_upsertSelectedMotionKey()`だけを使い、新しいHistory正本を作らない。
- cancel終了時のpointer capture release、preview RAF cancel、render / Layer Panel syncを既存Motion Graph順序と照合する。
- 数値inputの通常click / keyboard入力を壊さず、scrub後click抑止は実dragだけに限定する。

## 7. Acceptance criteria

- Number scrub: tap History 0、4〜5px step 0 History 0、実値drag History 1、pointercancel rollback / History 0、Undo / Redo一致。
- Canvas root Motion: tap / micro move History 0、実drag History 1、pointercancel / lost capture / Escape rollback / History 0。
- POSITION / ROTATION / SCALE / OPACITY等の既存数値scrubとCanvas move / Shift directional transformで既存key内容を維持する。
- playback中拒否、Table close / reopen、preview、console errorなし。
- 保存schema、Motion Graph、Bone / Part / WARPへの対象外diff 0。

## 8. Verification

- 変更JS / mjsの`node --check`。
- gesture stateとsource wiringの限定verifier。
- 全`verify-*.mjs`、`npm.cmd run build`。
- Browserでtap、step 0、actual drag、pointercancel相当、Escape、Undo / Redo、close / reopen、playback拒否、consoleを確認する。
- build / dev生成差分を清掃する。

## 9. Stop conditions

- `_recordTimelineHistory()`自体の全体仕様変更が必要になる。
- 数値scrubの`onPreview` callbackがrollback不能な外部正本を変更している。
- Canvas root MotionとBone / Part / WARPの共通handler再構成が必要になる。
- Browser event順がpointercancel / lost captureを決定的に分離できない。

範囲を広げずSOLへ`BLOCKED / REPLAN`を返す。

## 10. Model decision

- Gesture ownership、cancel rollback、History境界、最終reviewはSOL / XHigh。
- Stage A契約確定後の限定adapter / verifierはLUNA / MAX向き。
- 現taskはSOLを維持し、局所変更ならそのまま実装してよい。

## 11. 最終結果

- `motion-gesture-state.js`へ複合Motion transformのpure同値比較を追加し、Canvas root Motionは2px未満をtapとしてmutationしない。
- Canvas root Motionは`moved / mutated / changed`を分離し、実変更pointerupだけHistory 1、pointercancel / lost capture / Escapeまたは元値復帰はbeforeStateへrollbackしてHistory 0とした。
- Motion数値scrubは4〜5pxのstep 0、clamp等の実値不変、tapをHistory 0とし、pointercancelはmutation済みだけrollbackする。通常click / keyboard入力とEasing callback正本は変更していない。
- 変更JS / mjsの`node --check`、限定verifier、全62 verifier、Vite 8.0.16 production build、生成物清掃を通過した。保存schema、Motion Graph、Bone / Part / WARPへの対象外変更はない。
- Browser制御はpage操作前にtransportが閉じ、実操作は未通過。tap / no-op / actual drag / cancel / Escape / Undo・Redo / close-reopen / consoleはOwner確認台帳へ分離した。
- 2026-08-13、SOL最終review=`A`で技術close。Owner制作環境で問題が見つかった場合は本Phaseを暗黙に再OPENせず、再現条件を固定した限定bug fix Gateを立てる。
