# Phase 9b — UI Design Authority / Animation Table Style Boundary Gate

作成日: 2026-08-24

状態: COMPLETE — Gate 1=`GO — B`、Stage A / B、SOL final review=`A`（Archive正本）

## 1. 目的

フォント、panel、table、window、control stateの見た目をAIが安全に変更できるよう、palette / semantic token / component static style / runtime geometry / event・model正本の所有場所を明示する。最初の対象はPhase 8m〜9aで導線を固定したAnimation Table headerだけとし、GUI全面リスキン、全popup同時移行、`animation-table-popup.js`の一括分割へ広げない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9a.md`
7. `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
8. `開発用資料保管庫/proposals/00_計画索引.md`
9. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
10. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
11. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
12. `tegaki_work/styles/main.css`
13. `tegaki_work/ui/animation-table-popup.js`

## 3. 現在の監査事実

- `animation-table-popup.js`は23,722行、method約558件。template、event / state、動的座標と約1,933行の注入CSSが同居する。
- 同fileにはhex 16件、`rgba()` 92件、`font-size` 51件、`border-radius` 41件が残る。
- `styles/main.css`にはFutaba paletteと`--ui-surface-* / --ui-border-* / --ui-shadow-* / --ui-radius-*`があり、Phase 8l以降のsemantic正本として利用できる。
- `animation-table-popup.js`の全面分割をしない方針はproposal 16の正本と一致する。抽出は固定済みcomponent boundary単位でのみ比較する。

## 4. Stage A比較

| 候補 | Stage Aで確認すること |
|---|---|
| A. 所有map＋監査verifierのみ | `main.css`、注入CSS、JS動的style、DOM / eventの責務を一覧化し、production表示を変えない |
| B. A＋Playback header静的styleだけをcomponent stylesheetへ抽出 | Phase 9a fixtureを固定入力にし、load順、selector specificity、wide / narrow / coarseの完全一致を確認する |
| C. Animation Table CSS / class全面分割 | 変更面積と回帰範囲が大きいため現時点ではREJECT候補 |

Stage AではA / Bの差分規模、style load順、既存selectorの外部参照、runtimeで設定するcustom property / 座標、verifier可能なcomputed styleを監査し、Gate 1で一案だけ選ぶ。

### Stage A結果

- `index.html`は`styles/main.css`を先に読み、Animation Table生成時に`#animation-table-styles`を`document.head`末尾へ注入する。外部component CSSへ同じ詳細度のruleを移すだけでは、後注入される`.anim-tool-btn`等に上書きされる。
- Playback selectorのproduction参照は`animation-table-popup.js`のtemplate / runtime class更新 / event guardへ閉じ、他componentのbehavior正本には使われていない。関連verifierだけが現行注入CSSを直接検査する。
- JSが直接設定する値はpanel `left / top / width / height`、Timelineの`--anim-cell-width / --anim-cel-inset`、gesture中の一時custom propertyであり、Playback headerの色、border、font、固定paddingには含まれない。
- Phase 9a fixtureについてOwnerから「枠や色は将来skinで変わってよいが、概ねこの方向」と受入れを得た。固定するのはpixel skinではなく、中央の再生主action、低頻度Range sourceの抑制、未設定でも読めるI / O、設定後Frame値の階層である。

Gate 1=`GO — B`。`main.css`の後にcomponent stylesheetを読み、抽出selectorを`.animation-table-panel`でscopeして、後注入の共有base ruleより明示的な所有境界を持たせる。Playback以外の注入CSS、DOM、event、model、History、save、動的geometryは変更しない。

## 5. Stage A成果物

- `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`（新設候補）。palette、semantic token、component static style、runtime geometry、behavior authorityの所在を短く固定する。
- Animation Table headerのselector / DOM ID / event / dynamic style inventory。
- A / Bの対象file、Acceptance Criteria、No-go、Browser fixture、停止条件。
- `animation-table-popup.js`から一括移動しない根拠と、将来のcomponent単位抽出順。

## 5A. Stage B限定契約

対象file:

- `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
- `tegaki_work/styles/components/animation-table-playback.css`
- `tegaki_work/index.html`
- `tegaki_work/ui/animation-table-popup.js`
- Phase 9aのPlayback関連verifier
- `tegaki_work/build/verify-ui-design-authority-boundary.mjs`

Acceptance Criteria:

1. Phase 9aのPlayback静的styleだけがcomponent stylesheetを唯一の正本とし、注入CSSへ同じselectorを残さない。
2. `main.css → animation-table-playback.css → runtime #animation-table-styles`の順と、component scopeによりcomputed styleが抽出前と一致する。
3. 再生を中央主actionとする概念、Range sourceの通常surface、I / Oの未設定 / 設定済み階層をAuthority Mapとfixtureで固定し、色・枠・fontの将来skin変更は許容する。
4. Playback DOM ID / class、event、ARIA、model / History / save、wheel、panel位置、Timeline custom propertyを変更しない。
5. 全面CSS移動、selector rename、全popup token移行を行わない。

## 6. 維持する境界

- `--futaba-*`をpalette正本、`--ui-*`をsemantic aliasとして維持する。新しいtheme保存schemaを作らない。
- Setup青、実行橙、成功・接続緑、警告・破壊赤を役割外へ広げない。black / white / neutral grayを追加しない。
- 既存ID / class、`togglePlayback()`、Playback / Timeline / Clip / History / save正本、wheel三領域、panel位置復帰を変更しない。
- CSS抽出を選ぶ場合も静的appearanceだけを対象とし、動的座標・寸法・custom propertyはJSへ残す。
- Text、QTP、sidebar、Layer Panel、Rig / Mesh、Simple / Expert UI、全画面skinへ混ぜない。

## 7. 検証

- 変更JSは`node --check`。
- Phase 9a fixture / verifierとAnimation Table関連verifier。
- 全`build/verify-*.mjs`、`npm.cmd run build`。
- Browser wide / narrow / coarse相当でheader、Focus Deck、I / O、再生、resize、close / reopen、wheel、console error / warning。
- build生成差分を限定清掃し、`git diff --check`とscoped `git status`を確認する。

## 8. model分担

- Stage A inventory、Gate 1、file ownership、selector / specificity判断、全diff review、close: SOL / XHigh。
- Gate 1でBを選び、対象selector、load順、Acceptance Criteria、検証、停止条件が固定された後の一つの機械的抽出だけ: LUNA / MAXへ委譲可。
- Architecture、保存schema、History、DOM / event境界の判断が必要になった場合はLUNAが変更せずSOLへ戻す。

## 9. Stage B実施結果

- `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`を新設し、palette、semantic surface、component静的style、runtime geometry、behavior / accessibilityの所有場所を固定した。
- `styles/components/animation-table-playback.css`を`main.css`の後へ読み込み、Phase 9aで受け入れたPlayback headerの静的appearanceだけを`.animation-table-panel`scopeで移した。
- `animation-table-popup.js`にはpanel位置・寸法、Timeline custom property、gesture中の一時値、未抽出componentの注入CSSを残した。Playback DOM / ID / class、event、ARIA、model、History、saveは変更していない。
- Playback conceptは「中央の再生主action、低頻度Range sourceの抑制、未設定でも読めるI / O、設定後Frame値の階層」として固定した。色、枠、radius、font、shadow、厳密pixelは後続skin Gateで変更可能とした。

## 10. 検証と最終判定

- `node --check ui/animation-table-popup.js`: PASS。
- Playback Priority / Range Inline / Range Focus Deck / Playback Glance / Header Layoutと、新設UI Design Authority Boundary verifier: PASS。
- 全`build/verify-*.mjs`: 102 / 102 PASS。
- `npm.cmd run build`: PASS（Vite 8.0.16）。`util` externalizeと500kB超chunkは既知warning。
- Browser narrow実表示でcomponent stylesheetのload順、中央play slot、Range通常surface、未設定 / 設定済みI / O、Focus Deck三択、close / reopenを確認した。runtime注入CSSからPlayback静的selectorが消え、console error / warningは0件。
- wide表示はPhase 9aの受入fixture / Browser結果と同一static値をverifierで固定した。本抽出後にwideの新規実操作は行っていないため、将来skin fixtureで再確認する。
- `dist/`と`node_modules/.vite/`の生成差分は残さない。
- SOL final review=`A`。表示結果を意図的に変えない構造整理であり、Owner制作確認の新規backlogは追加せず、本Phaseを技術closeする。
