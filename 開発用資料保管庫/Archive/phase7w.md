# Phase 7w — Motion Graph Intermediate Point Safety Gate

更新日: 2026-08-13
担当: SOL / XHigh（Gate・Bezier分割・複合key不変性）、限定pure helper / verifierはLUNA / MAX候補
状態: CLOSED — guarded Gate=`GO`、Stage A / B、全63 verifier / build、SOL最終review=`A`

## 1. Goal

Motion Graphの空白位置へ途中点を追加しても、active channel以外の複合Motion parameterと既存segmentの見た目を変えない契約をpure fixtureで証明し、production実装へ進めるか判定する。

## 2. Current evidence

- 現行Motion keyは`x / y / scaleX / scaleY / rotation / opacity / blendStrength / blendMode`と左key所有`interpolation / easing`をまとめた複合keyである。
- 現在Frameの通常Motion key追加はsampled全parameterをmaterializeするが、元cubic segmentを左右へ分割しないため、Graph途中点追加へそのまま流用すると区間全体の速度と非active channelを変え得る。
- `cubic-bezier-easing.js`はNewton法＋二分探索で`x(t)`を解くが、parameter `t`、Bezier座標、De Casteljau分割を外部へ公開していない。
- `sampleClipTransform()`は暗黙始点 / 終点、HOLD、左key所有easing、blendMode HOLDの現行評価正本である。

## 3. Gate 0 questions

1. 既存solverを重複実装せず、`x(t)=ratio`のparameter解とDe Casteljau分割をpure helperとして共有できるか。
2. 左右curveをlocal time / local valueへ再正規化した時、0幅・0 value span・極端なcontrol pointを決定的に拒否できるか。
3. explicit / implicit境界、LINEAR / HOLD / cubic-bezier、全7連続parameterとblendModeを一つのatomic planで扱えるか。
4. 挿入前後の固定sample比でactive / non-active channelの値がepsilon内一致し、Project schema追加なしで1 Historyにできるか。
5. pen / touchで空白tap誤追加を避ける明示`ADD POINT` modeを、既存Graph selection / panと競合せず後段UIへ接続できるか。

## 4. Stage A — pure split proof

- cubic parameter solve / point evaluation / splitを既存easing helperへ集約し、現行`sampleEasingRatio()`結果を変えない回帰fixtureを先に置く。
- LINEAR / HOLD / cubic、explicit / implicit boundary、ascending / descending / flat parameterを固定fixture化する。
- insert planは入力keyframesを破壊せず、失敗時に理由付き`ok:false`、成功時に完全な複合key列を返す。
- 挿入Frameだけでなく左右segmentの複数比で全parameterのpre / post sample一致を検査する。

## 5. Stage B — production adapter（Gate 0 `GO`後だけ）

- GraphへSetup青の明示`ADD POINT` modeを候補とし、通常tap / dragのselection・panを維持する。
- active一channelの指定値だけを変更し、他parameter、blendMode、左右easingをStage A planの結果から確定する。
- pointer / pen / touch、再生中拒否、1操作1 Timeline History、Undo / Redo、cancelを既存Graph transactionへ接続する。

## 6. Out of scope

- 複数key drag、key時刻移動、box scale、衝突merge、Motion Path、parameter別easing。
- Bounce / Elastic / Loop、overshoot、保存schema追加。
- Bone / Part / WARP / Mesh、renderer、preview / export samplerの変更。
- 空白tap即追加、solverの別実装、Graph専用key正本。

## 7. Acceptance criteria

- pure fixtureで全parameterの挿入前後sample一致を証明する。
- HOLD継承、implicit boundary materialize、blendMode HOLDが決定的である。
- 失敗条件は無言近似せず理由付き拒否となる。
- production接続時は実追加History 1、tap / cancel / 拒否History 0、Undo / Redo一致。
- 全verifier、build、Browser / Owner実操作、console errorなし。

## 8. Stop conditions

- 既存sampler変更または保存schema追加なしにsample不変性を保てない。
- zero-span再正規化を安全に定義できず、見た目を変える近似が必要になる。
- active channelだけの編集が複合key所有と両立しない。
- Graph UIだけでMotion Pathやparameter別track正本が必要になる。

該当時は実装へ進まず`BLOCKED / REPLAN`とし、P3複数key value drag等の別候補と比較する。

## 9. Model decision

- Gate 0、Bezier数学、複合key不変性、最終reviewはSOL / XHigh。
- Gateが`GO`になった後のpure helper fixtureや限定UI adapterはLUNA / MAXへ分離可能。

## 10. Gate 0判定

- `sampleEasingRatio()`の既存Newton＋二分探索を`solveCubicBezierParameter()`へ抽出し、固定出力を変えずにDe Casteljau分割へ共有できた。
- LINEAR / HOLD、explicit / implicit両境界、部分key、全7連続parameter、flat / descending、blendMode HOLDを一つの非破壊planで扱える。
- active channelだけ指定値へ変更し、他channelとblendModeの挿入前後sampleを維持できる。
- ただし`STRONG IN-OUT` / `CIRCULAR IN-OUT`の中央付近では、正確な分割curveのX controlが現行0..1契約外になる。clampするとfixtureで最大約5%の速度差になるため無言近似を禁止し、`split-control-out-of-range`でmutation前に拒否する。
- 既存12 preset×固定6位置では72件中68件がsample不変で成功し、上記2 presetの0.4 / 0.6位置4件だけを理由付き拒否した。よって「全位置対応」ではなく「現行schemaで正確に表現できる位置だけ」のguarded Gate=`GO`とする。

## 11. 最終結果

- `cubic-bezier-easing.js`へ共有parameter solve、point評価、理由付きsplitを追加した。既存samplerの固定値は不変。
- `motion-graph-key-insert.js`へ非破壊の複合key insertion planを追加し、暗黙境界materialize、HOLD継承、左右easing、active一channel変更、失敗時non-mutationを固定した。
- Motion GraphへSetup青`ADD POINT`明示Modeを追加した。通常marker click / 縦dragは維持し、空白clickだけFrame / active channel値へ変換する。成功時は既存Timeline mutation入口の1 History、既存Frame / 端 / unsupported splitはHistory 0。
- unsupported splitは「別FrameまたはLINEAR」を案内する。X control範囲拡張、parameter別easing、schema追加は行っていない。
- 変更JS / mjsの`node --check`、限定fixture、全63 verifier、Vite 8.0.16 production buildを通過した。保存schema、sampler出力、preview / export経路は変更していない。
- Browser制御はpage操作前にtransportが閉じ、実操作は未通過。Owner確認台帳へADD POINT / rejection / Undo・Redo / pen・touch / consoleを分離した。
- 2026-08-13、SOL最終review=`A`で技術close。Owner確認で問題があれば本Phaseを暗黙に再OPENせず、curve / split Frameを固定した限定bug fix Gateを立てる。
