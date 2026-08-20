# Phase 8g — UI Semantic Contrast / Workflow Density Gate

更新日: 2026-08-20
担当: SOL / XHigh（palette authority、computed contrast、UI state、Gate / review / close）。対象selectorとACが固定した限定CSSだけLUNA / MAX候補
状態: CLOSED — Gate 0=`GO`、Stage B限定補正、SOL final review=`A`

## 1. Goal

Phase 8fの可逆Focus shellを維持したまま、通常描画、Animation Table、CLIP MOTIONの「思考の水位」が色・密度・並びで理解できるかを実測する。Setup青、Motion / Frame作業の橙、通常茶、disabled / focusを、色だけでなくlabel・icon・境界でも区別する。

第一作業は全体テーマ変更ではない。固定fixtureのcomputed color / background / border / focusと表示密度を監査し、失敗がある場合だけ一componentの限定CSS Sliceへ切る。

## 2. Authority / preservation contract

- palette正本は`TEGAKI.md`、`styles/main.css`の既存CSS変数、`UI_CSSスタイルガイド.md`。近似色やcomponent専用neutralを増やさない。
- Phase 8fの`CANVAS / DETAIL`、既存floating popup、Panel位置、RIG / Motion / WARP target、Table scroll / zoom / wheel三領域を維持する。
- DOM owner、Project、History、selection、Rig / Mesh / Skin / Motion / export evaluatorを変更しない。
- Callipeg / Fresco / CSP Simple Modeは外観模倣ではなく、Canvas占有、到達段数、復帰、contrastの比較資料に限定する。

## 3. Gate 0 fixture

1280×720とnarrowで次を記録する。

1. 通常描画: sidebar、Layer card、Q / V / A、status。
2. Animation Table: header二段、Lane、Timeline grid、selected Clip、Bone group / disabled control。
3. CLIP MOTION: expanded / compactのRIG、Motion、WARP、未接続AUTO GRID、WEIGHT ON、11 Bone密集。
4. state: normal / hover / focus-visible / active / disabled。通常文字4.5:1、large text 3:1、control境界とfocus ringは非文字contrastを別に記録する。
5. flow: 左から設定→実行、Setup青→Motion橙、Canvasへ戻る`DETAIL / CANVAS`とcloseが競合しないこと。

## 4. Stage A — read-only audit

- selectorごとにforeground / background / border / font size / state ownerを列挙し、global token問題かcomponent問題かを分ける。
- 同じsemanticに既存共通class / variableがあるか`rg`で先に確認する。
- contrast合否だけでなく、label、icon、太線、位置による識別を記録する。
- 11 Bone / long target name / narrowでwrap、clip、horizontal overflow、Canvas遮蔽を測る。

## 5. Stage B candidate

Gate 0で`GO`の場合だけ、一つへ限定する。

- CLIP MOTION Focus shellの文字 / control境界 / focus stateのcomponent-scoped補正。
- またはAnimation Table header / Lane / Timelineのsemantic contrast補正。

両方を同時に変更しない。global `--text-*`、全button、全popupの一括変更は別Gateとする。

## 6. Non-goals

- Animation Table dock / 全面Inspector / major DOM再構成 / class一括rename。
- 新palette、黒白gray直書き、global theme rewrite、component専用scrollbar。
- Mesh / Weight / Topology、solver、save schema、History、WebGPU、export変更。
- Project-local Rig Library、Video Handoff、AI自動生成。

## 7. Acceptance Criteria

- 固定fixtureのcontrast表とstate ownerが再現可能で、未計測推測をproductionへ入れない。
- 限定修正時は通常 / active / disabled / focus-visibleをpalette内で識別でき、色だけに依存しない。
- Phase 8fのCanvas面積、compact / expand / close復帰、BONE / AUTO GRID / Motion / WEIGHT到達段数を悪化させない。
- Q / V / H、Space + drag、wheel三領域、preview / playback / save / export / Historyを変更しない。
- 1280×720 / narrow Browser、console error / warning 0件。変更時は全verifier / buildを通す。

## 8. Stop conditions

- 合格のためにglobal palette、全button、全popupの同時変更が必要になる。
- 色修正がDOM順、pointer、wheel、selection、保存stateへ波及する。
- contrast GateからWorkspace dock、Rig / Mesh仕様、GPU / resource最適化へ広がる。

## 9. Source

- `開発用資料保管庫/Archive/phase8f.md`
- `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
- `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
- `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`

## 10. Gate 0 / Stage B result（2026-08-20）

### Gate 0=`GO`

1280×720の通常描画、Animation Table、CLIP MOTION RIG / MotionをBrowser computed styleで固定計測した。

- 通常描画のQ / Vは茶文字10.65:1、A / SのSVG strokeも既存`--futaba-maroon`を維持した。
- CLIP MOTIONはRIG通常5.68:1、RIG active 5.56:1、Motion active 9.36:1、active target 9.36:1、Setup青`RIG設定`5.83:1、`BONE追加` / `全体PIVOT`4.57:1だった。
- Animation TableはALL / LOOP active 7.86:1、END:C 4.81:1。LANE inactiveはopacity込み3.91:1で通常文字の監査線を下回るが、Table componentを同じSliceで変更しない。
- disabled textは操作不能状態として通常文字の合否へ混ぜず、border、disabled属性、cursorとの複合識別を別に記録した。
- Phase 8fで確認した1280×720 / 720×720のPanel収まり、compact / expanded、WARP expanded固定、close / reopenを変更しない。

最小failureは`DETAIL` activeだけだった。共通`.flip-button.active`のinverse文字色を継承し、淡い橙背景に白文字1.15:1となっていた。

### Stage B限定補正

`.anim-motion-shell-toggle.active`へ既存`--futaba-maroon`を明示した。淡いactive背景、橙border、button label / icon / DOM / runtime stateは変更せず、補正後は9.36:1となった。compactの`CANVAS`は従来の茶文字 / cream背景、expandedの`DETAIL`は茶文字 / 淡橙背景、keyboard focus-visibleは既存2px橙ringを維持する。

再発防止は既存`verify-rig-workspace-focus-shell.mjs`へcomponent ruleを追加した。Project、History、selection、Rig / Mesh / Skin / Motion、export、global tokenは変更していない。

Animation Table inactive controlは別componentのため、Phase 8h候補としてread-only hover / focus / opacity owner確認から始める。

## 11. SOL final review（2026-08-20）

判定=`A`。変更はCLIP MOTION shell toggleのactive文字色一行と既存verifierの再発防止に限定され、global palette、DOM、state、Project / History / evaluatorへ波及していない。全80 verifier、production build、Browserのexpanded / compact / RIG切替、active / focus-visible computed styleを通過した。build生成物は清掃した。

Owner制作環境での長時間 / pen / touch確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離し、Phase 8gを暗黙に再OPENしない。
