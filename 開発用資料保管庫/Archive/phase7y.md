# Phase 7y — Motion Easing Overshoot / Back Safety Gate

更新日: 2026-08-13
担当: SOL / XHigh（Gate・sampler・ADD POINT整合）、限定pure helper / verifierはLUNA / MAX候補
状態: TECHNICAL CLOSE — Gate 0=`GO`、Stage A〜C完了、SOL最終review=`A`、Owner制作確認は台帳へ分離

## 1. Goal

既存cubic-bezierの`x1 / x2`を0..1へ維持したまま`y1 / y2`だけ範囲外へ拡張し、position / scale / rotationのOvershoot / Backとopacity / blendStrengthの最終clampを、旧Project完全一致で導入できるか判定する。

## 2. Current evidence

- `normalizeCubicBezierEasing()`は現在x / y全4値を0..1へclampする。
- `sampleEasingRatio()`も最終ratioを0..1へclampするためOvershootを表現しない。
- `sampleTransformTrack()`はkey endpointをclampするが、補間後のopacity / blendStrengthを別途clampしていない。
- EASING CURVEのY入力とGraph表示は0..1固定で、明示`ALLOW OVERSHOOT`導線がない。
- Phase 7wのDe Casteljau途中点追加はvalue span 0..1前提のguardを持つため、Overshoot curveとの整合を先に決める必要がある。

## 3. Gate 0 questions

1. normalizerを`x=0..1 / y=bounded finite range`へ分け、既存0..1 curveをbit-equivalentに維持できるか。
2. raw easing ratioとparameter solveを分離し、position / scale / rotationだけOvershoot、opacity / blendStrengthは最終sampleを0..1 clampできるか。
3. preview / playback / onion / Bake / GIF / APNG / Project reloadが同じ`sampleClipTransform()`結果を使う現行境界を維持できるか。
4. Easing preset / clipboard / Graph segment表示 / Curve editorを、明示Modeなしに範囲外へ変換しないUIにできるか。
5. ADD POINTでOvershoot segmentを正確に分割できない場合、mutation前の理由付き拒否を維持できるか。

## 4. Initial boundary

- cubic-bezierだけ。Bounce / Elastic / Loop、spring、parameter別easingは対象外。
- `x1 / x2`は0..1固定。`y1 / y2`だけ有限の安全範囲候補を比較する。
- Overshootは明示opt-inとし、既存Projectやpresetを暗黙変換しない。
- 保存schemaの新しい別track、Graph専用curve、preview専用samplerを作らない。
- Motion Path、Mesh / WARP / Bone / Part変形へ広げない。

## 5. Acceptance criteria

- 既存0..1全fixtureが導入前と一致する。
- Overshoot curveでposition / scale / rotationはraw比を使い、opacity / blendStrengthは最終値だけ0..1へclampする。
- Curve UI、preset / clipboard、Graph、ADD POINT、Undo / Redo、random seek / playback / export / reloadが一契約になる。
- 無効値、過大値、正確に分割できないADD POINTはHistory 0で拒否する。

## 6. Stop conditions

- parameter別easing schemaまたは別samplerが必要になる。
- 旧Projectの0..1 sampleが変わる。
- ADD POINTが無言近似または既存segment破壊を必要とする。
- UIの明示opt-inなしに既存curveを範囲外へ変換する必要がある。

該当時は`HOLD / REPLAN`とし、実装へ進まない。

## 7. Model decision

- Gate 0、normalizer / sampler、Phase 7w split整合、最終reviewはSOL / XHigh。
- Gate=`GO`後の限定pure curve fixture、clamp verifier、UI数値範囲adapterはLUNA / MAX候補。

## 8. Gate 0判定（2026-08-13）

判定: `GO`

- 現行Projectの有効curveは`y1 / y2=0..1`であり、Bezierのconvex hull上raw Yも0..1内になる。raw samplerを追加してClip Motionだけで使っても、既存curveは従来clamp前と同値で維持できる。
- `sampleTransformTrack()`はPart / Bone Motionにも使われるため、既存`sampleEasingRatio()`を一律raw化しない。clamped / rawをpure helperで分離し、`sampleClipTransform()`だけがrawを明示選択する。Part / Boneは従来clampを維持する。
- opacity / blendStrengthはkey endpointの0..1 normalizeに加え、raw ratioによる補間後の値だけを0..1へclampできる。position / scale / rotationは同じratioをclampせず使えるためparameter別easing schemaは不要。
- preview / playback / onion / compositor / Bake / export / Motion Graphは既存`sampleClipTransform()`へ収束しており、別samplerを作る必要はない。
- `ClipInstance.transformKeyframes[].easing`はplain objectのままround-tripするため保存schema追加は不要。Easing専用clipboard / preset / Graph segmentも共通normalizerを使う。Motion値clipboardだけprivate 0..1 easing normalizeを持つためStage Bで共通化する。
- Curve editorは全Y入力とgraph座標を0..1へ固定している。明示`ALLOW OVERSHOOT`をruntime UI modeとして追加し、mode OFFでは従来0..1、ONではYだけ安全範囲を使う。保存flagは作らず、reload時は範囲外Yそのものからmode表示を導出できる。
- 安全範囲は`y=-1..2`を採用する。Backの固定候補`(0.36, 0, 0.66, -0.56)`、`(0.34, 1.56, 0.64, 1)`、`(0.68, -0.6, 0.32, 1.6)`を含み、curve全体のraw ratioもBezier convex hullにより同範囲へ留まる。非finiteまたは範囲外Yはauthoring時にmutation前拒否する。
- De Casteljau分割はOvershoot位置によって負のvalue spanまたはlocal再正規化後のY control範囲超過が起こる。絶対spanでzero判定し、X=0..1 / Y=-1..2へ正確に収まる時だけ成功、それ以外は既存`split-control-out-of-range`等でHistory 0拒否すれば無言近似を避けられる。

## 9. Stage plan

### Stage A — pure normalizer / raw sampler / final clamp / split guard

- cubic helperへY安全範囲とraw sampleを追加し、既存clamped APIを維持する。
- Clip Motionだけraw、opacity / blendStrengthだけ補間後clamp、Part / Boneは従来clampを固定する。
- Overshoot exact splitの成功／拒否と、既存0..1 curveの同値を専用verifierへ置く。

### Stage B — clipboard / preset / Curve UI

- Motion値clipboardのprivate easing normalizeを共通化する。
- `BACK IN / OUT / IN-OUT`を保存名なしの固定cubic presetとして追加する。
- EASING CURVEへ明示`ALLOW OVERSHOOT`を追加し、X=0..1、mode OFF Y=0..1、mode ON Y=-1..2を固定する。Graph表示、数値入力、drag、paste、reload表示を一契約にする。

### Stage C — integration / review

- Easing clipboard、Graph segment / ADD POINT、History、Project round-trip、random seek / playback / preview / onion / Bake / GIF / APNGを確認する。
- 全verifier、build、Browser実操作、console error、生成物清掃後にSOL final reviewを行う。

## 10. Stage A / B実装結果

- `cubic-bezier-easing.js`はX controlを0..1へ維持し、Y controlだけ`-1..2`の有限範囲を許可する。`sampleRawEasingRatio()`を追加し、既存`sampleEasingRatio()`は0..1 clamp APIとして維持した。
- `sampleClipTransform()`だけがraw比を明示使用する。position / scale / rotationはOvershootし、opacity / blendStrengthは補間後の最終値を0..1へclampする。Part / Boneの`sampleTransformTrack()`既定は従来clampのままである。
- `BACK IN / BACK OUT / BACK IN-OUT`を保存名なしの固定cubic presetとして追加した。Motion値clipboardとEasing専用clipboardはいずれも共通normalizerを通し、範囲内Back curveをそのまま保持する。
- EASING CURVEにSetup青の明示`ALLOW OVERSHOOT`を追加した。OFFは従来Y=0..1、ONはY=-1..2で、Xは常に0..1。保存flagは追加せず、Back curveのreload / paste / preset表示では保存値からmodeを導出する。
- Overshoot Graphは標準0..1帯を中央へ表示し、endpoint、control handle、数値入力、dragを同じY range adapterへ接続した。範囲外・非finite入力はmutation前に拒否する。
- Phase 7w ADD POINTはraw比でDe Casteljau分割する。左右local curveがX=0..1 / Y=-1..2へ正確に収まる時だけ成功し、表せない位置は`split-control-out-of-range`で拒否する。Overshoot中に非active opacity / blendStrengthのclampで区間同値を失う場合は`split-bounded-channel-clamp`で理由付き拒否する。

## 11. Stage C検証

- 変更JS / mjsの`node --check`: PASS。
- 全`build/verify-*.mjs`: 65 / 65 PASS。専用`verify-motion-easing-overshoot.mjs`で旧0..1 curve同値、Back raw比、alpha最終clamp、Part / Bone従来clamp、Curve opt-in、Graph座標往復、preset / clipboard、Project JSON round-trip、exact split / 理由付き拒否を固定した。
- `npm.cmd run build`: PASS（Vite 8.0.16、886 modules）。build前cleanを確認した`dist/`の追跡済み基準を復元し、hash付き未追跡生成物だけを清掃した。`.vite/`差分なし。
- Vite dev HTTP smoke: `/`、`animation-table-popup.js`、`cubic-bezier-easing.js`、`main.css`がHTTP 200。
- Browser実操作 / console確認はBrowser制御transportが閉じてpage操作へ到達できず未通過。未確認項目を`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`へ分離し、通過済みとは扱わない。

## 12. SOL最終review

判定: `A`

- raw samplerはClip Motionの明示optionに閉じ、Part / Boneと旧0..1 Projectの評価を変えていない。
- 保存schema、別track、Graph専用curve、Overshoot保存flagを追加せず、既存`transformKeyframes[].easing`だけを正本にした。
- opacity / blendStrengthはkey normalizeと最終sample clampを共有し、Graph固定0..100表示と矛盾しない。
- Backの途中点追加は正確に表現できる場合だけ成功し、近似やsilent clampを行わない。
- Bounce / Elastic / Loop、parameter別easing、Motion Path、Mesh / WARP / Bone / Part変形へscopeを広げていない。

技術close可。Owner制作環境ではBack三種、custom Overshoot、Curve mode、Undo / Redo、random seek / playback / onion / Bake / GIF / APNG、Project reload、ADD POINT拒否、console、pen / touchをまとめて確認する。問題発見時は本Phaseを暗黙に再OPENせず、curve値、左右key Frame、対象parameter、surfaceを固定した限定bug fix Gateを立てる。
