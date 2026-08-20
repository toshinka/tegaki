# Phase 8h — Animation Table Inactive Control Contrast Gate

更新日: 2026-08-20
担当: SOL / XHigh（computed state owner、Table semantic境界、Gate / review / close）。selectorとAC確定後の一つのCSS SliceだけLUNA / MAX候補
状態: CLOSED — Gate 0=`GO`、SCOPE限定補正、SOL final review=`A`

## 1. Goal

Phase 8gで分離したAnimation Table headerのinactive表示を、押せる通常状態・選択中active・本当に操作不能なdisabledへ正しく分ける。最初の固定対象は`SCOPE: ALL / LANE / SET`と`LOOP / END:C / IN / OUT`で、文字、border、背景、opacity、hover、focus-visibleをcomputed styleで測る。

低密度化や全体redesignは行わない。押せるinactive controlが薄すぎる場合だけ、既存Futaba palette内のcomponent-scoped selector一つへ限定する。

## 2. Authority / preservation contract

- `TEGAKI.md`、`styles/main.css`、`UI_CSSスタイルガイド.md`、`Archive/phase8g.md`を正本とする。
- header二段、左→右の順、Table resize、Lane / Timeline scroll、wheel三領域、key / Clip操作を維持する。
- active橙、通常茶、disabled薄茶を、色だけでなくfont weight、border、label、disabled属性で区別する。
- Project、History、TimelineModel、selection、playback、export、CLIP MOTION Focus shellを変更しない。

## 3. Gate 0 fixture

1. 1280×720とnarrowでALL / LANE / SET、LOOP / END:C / IN / OUTを通常・active・disabled・hover・focus-visibleごとに記録する。
2. opacityがelement全体へ掛かるのか、文字色 / background / borderそれぞれのtoken ownerかをCSS cascadeまで追う。
3. inactiveだが押せるcontrolをdisabled風に見せていないか、activeからinactiveへ戻る操作で導線を失わないか確認する。
4. Timeline header wheel zoom、grid wheel Frame±1、Lane列wheel上下を実操作で維持する。

## 4. Stage B candidate

Gate 0=`GO`の場合だけ、`.anim-scope-btn`群または`.anim-playback-btn`群の一方を変更する。両群、全button、global tokenを同時に変更しない。opacityを変える場合もhover / focus / active / disabledの優先順位を固定する。

## 5. Acceptance Criteria

- 押せるinactive通常文字は4.5:1以上、activeは橙境界と4.5:1以上、非文字focus / borderは3:1以上を固定入力で確認する。
- 本当にdisabledなcontrolはdisabled属性、cursor、薄色を維持し、通常inactiveと区別できる。
- headerの高さ、wrap、二段順、Timeline幅、wheel三領域、pointer / keyboard操作を変えない。
- 1280×720 / narrow、console error / warning 0件。変更時は関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`を通し、生成物を残さない。

## 6. Non-goals / stop conditions

- Animation Table全面dock、header DOM再構成、全button / popupの一括contrast変更。
- CLIP MOTION、Rig / Mesh / Skin、solver、save schema、History、export変更。
- 合格にglobal paletteや複数componentの同時変更が必要なら実装せず、比較表をproposal 16へ戻して止める。

## 7. Source

- `開発用資料保管庫/Archive/phase8g.md`
- `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
- `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
- `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`

## 8. Gate 0 / Stage B result（2026-08-20）

Gate 0=`GO`。Browser computed styleとCSS cascadeを照合した。

- `SCOPE: ALL / LANE / SET`は三つとも常に操作可能で、disabledを設定する経路はない。inactiveだけelement全体へ`opacity: 0.6`が掛かり、通常8px文字が3.91:1となってdisabled風に見えていた。
- `LOOP / END:C / IN / OUT`は同じinactiveでも`opacity: 0.68`、実測4.81:1で監査線を通過したため変更しない。
- `SCOPE`にはfocus-visible定義がなく、browser既定の黒outlineへ落ちていた。

Stage Bは`.anim-scope-btn`群だけへ限定した。inactive opacityを既存playback群と同じ0.68へ揃え、4.81:1とした。focus-visibleはFutaba茶2px outline、opacity 1とし、active橙背景、hover、文字、順序、寸法、DOM、eventを変更していない。

BrowserでALL active、LANE / SET inactive、LANE選択、inactive SET keyboard focus、ALL復帰を確認した。関連header verifierとwheel三領域verifier、全80 verifier、production buildを通過し、build生成物を清掃した。

## 9. SOL final review（2026-08-20）

判定=`A`。変更はAnimation Table injected CSSのSCOPE一群と既存header verifierだけで、playback群、Table二段構造、wheel routing、TimelineModel、Project / History、CLIP MOTIONへ波及していない。Ownerのnarrow / pen / touch確認は台帳へ分離し、Phase 8hを暗黙に再OPENしない。
