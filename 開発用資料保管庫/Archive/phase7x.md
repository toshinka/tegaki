# Phase 7x — Motion Graph Multi-Key Value Drag Safety Gate

更新日: 2026-08-13
担当: SOL / XHigh
状態: CLOSED — Gate 0=`GO`、Stage A / B、SOL final review=`A`

## 1. Goal

既存runtime Motion key複数選択をMotion Graphのactive一channel値dragへ接続し、各keyのFrame・他channel・Easingを維持したatomic batch編集を行う。

## 2. Gate 0

判定: `GO`

- `_motionTimelineKeySelection`の`clipId + kind + targetId + local Frame`をGraphでも共有できる。
- anchor選択済み時だけ同一Clip `kind=motion`を対象にでき、WARP / Bone / Part選択を維持したままfilterできる。
- display deltaからstored単位への変換、percent clamp、負scale、720°超rotationは既存Graph helperとsamplerを再利用できる。
- 既存Graph transactionへpure planを挟めば、全対象検査後のlive preview、History 1、cancel rollbackを維持できる。
- Graph専用selection、保存flag、別key配列、sampler変更は不要。

## 3. Stage A — pure batch plan

- `motion-graph-key-batch-edit.js`を追加し、explicit key複数Frameへactive一channelのdisplay deltaだけを非破壊計画する。
- 部分keyでは対象channelだけをmaterializeし、Frame、他channel、blendMode、interpolation / easingを維持する。
- opacity / blendStrengthはkeyごとに0..100%へclampし、全clamp / delta 0は変更0件とする。
- 同Frame重複は現行samplerと同じ配列末尾だけをauthorityとして変更する。
- invalid / missing keyはmutation前に全体拒否する。旧Projectのbase transform欠損はsampler既定値を使う。

## 4. Stage B — Graph adapter

- Graph markerのCtrl / Cmd clickを既存Timeline selection toggleへ接続し、active markerへ橙ringを投影する。
- anchor未選択は従来の単独値drag、選択済みは同一Clip Motion keyだけのbatch値dragとする。
- anchor display deltaを全対象へ適用し、各keyを同じ絶対値へ揃えない。
- tap / 全clamp no-opはHistory 0、実変更pointerupはHistory 1、Escape / pointercancel / lost capture / window closeはrollbackする。
- 再生中拒否、ADD POINT、EASING、Timeline time move、保存schema、preview / export samplerは変更しない。

## 5. Verification

- 変更JS / mjsの`node --check`: PASS
- 新規`verify-motion-graph-key-batch-edit.mjs`: PASS
- `verify-motion-graph-key-edit.mjs` / `verify-motion-graph-ui-adapter.mjs`: PASS
- 全64 `verify-*.mjs`: PASS
- `npm.cmd run build`: PASS（Vite 8.0.16、886 modules）
- `git diff --check`: error 0（改行warningのみ）
- build生成`dist`差分: 追跡済み基準復元、untracked生成asset限定削除、残差分0
- Browser: 制御transportがpage操作前に閉じたため未確認。Owner確認台帳へ分離した。

## 6. SOL final review

判定: `A`

- selection / key / Historyの第二正本を追加していない。
- 同一Clip Motion filter、partial key、clamp、no-op、duplicate Frame、旧Project欠損をpure verifierで固定した。
- 単独drag、Timeline選択、ADD POINT、Easing、playback、save / sampler境界を維持した。
- Browser未確認を受入済みとせず、Owner制作確認へ明示分離した。

## 7. Close boundary

- Graph time move、box select / box scale、複数channel、Motion Path、parameter別easingは未実装。
- Owner確認で問題が見つかった場合は本Phaseを暗黙に再OPENせず、再現条件を固定した限定bug fix Gateを立てる。
