# Phase 9f — Animation Table Attention Hierarchy / Inactive Border Gate

作成日: 2026-08-24

状態: CLOSED — Gate 0=`GO — B: Quiet Resting`、SOL final review=`A`

## 1. 目的

Phase 9eで第一header rowへ戻した主playを最上位actionとして維持しながら、常設borderがSCOPE / PREVIEW / secondary actionを同じ水位へ押し上げている箇所を整理する。最初はAnimation Table header一componentだけで、`通常はicon / text＋淡いsurface、hoverでhit surface、active / focusでborder`という三段階が成立するかを比較する。

CallipegのTimelineを隠して描画領域を確保する考え方、CLIP STUDIO PAINT Simple ModeのCanvas面積と直接操作優先を参考にするが、Tegakiの既存二段header、wheel三領域、popup drag、SCOPE / Range保存正本を変更しない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9e.md`
7. `開発用資料保管庫/Archive/phase9d.md`
8. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
9. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
10. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
11. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
12. `tegaki_work/styles/main.css`
13. `tegaki_work/styles/components/animation-table-playback.css`
14. `tegaki_work/ui/animation-table-popup.js`

## 3. Stage A / Gate 0

read-onlyで次を固定する。

1. 第一 / 第二header rowの常時border、background、shadow、active / open / focus / disabled selectorを一覧化し、操作頻度とstate意味を付ける。
2. `SCOPE / Range / PREVIEW / Onion / zoom / Asset / Motion / Selected Clip actions / close`のhit areaと、見えているborderの寸法を分ける。
3. fixed fixtureで次の三案を比較する。
   - A: Current Warm Canvas-first。
   - B: inactive borderをtransparentへ下げ、hover / active / focusだけsemantic borderを出す。
   - C: header全面を濃色化し、controlを抜き色へする。
4. Bを第一候補とする。CはCanvas、Timeline、Clip、警告、Setup青とのcontrast競争が増える場合は棄却する。
5. 1280×720 / 700×720 / coarse相当で、第一行compact play、drag可能空白、Range / SCOPE deck anchor、keyboard focusを比較する。

## 4. Acceptance Criteria

- resting / hover / active / open / focus-visible / disabledを、色だけでなくsurfaceまたは境界でも識別できる。
- 最頻のPlay / Stopが最も強く、通常SCOPE / PREVIEW / secondary controlは一段低く見える。
- controlのvisual borderを薄くしてもpointer / pen / touch hit areaを縮めない。
- DOM、ID、event、ARIA、model、History、save、popup drag、header / Lane / grid wheel、Clip gestureを変更しない。
- 関連verifier、全`build/verify-*.mjs`、build、Browser wide / narrow、console、生成物清掃を行う。

## 5. No-go

- SCOPE `SET`削除、eye表示との統合。
- OUT MARKER時だけI / Oを表示する挙動変更。
- Timeline zoom footer化、wheel routing変更。
- Sidebar / Layer Panel / QTPへの同時横展開。
- header dark化の即production採用。
- QTP swatch borderless、Pen / Eraser pressure、preset番号、Text縦書き / local font。
- Animation Table DOM全置換、dock化、Simple / Expert二重UI。

## 6. model分担

- Stage A inventory、contrast / hit / focus判断、Gate 0、採用判定、close: SOL / XHigh。
- Gate後に対象selector、通常 / hover / active / focus / disabled値とAcceptance Criteriaが固定されたCSS-only一component Sliceだけ: LUNA / MAXへ委譲可。
- DOM、event、ARIA、wheel、drag、保存state判断が必要ならLUNAは変更せずSOLへ返す。

## 7. Stage A inventory / Gate 0

- 常設borderが競合していたのは、第一行のSCOPE / PREVIEW / Onionと、第二行のzoom wrapper＋button、Asset / Motion / Copy / Paste / Groupだった。hit areaはborder寸法とは独立して維持できる。
- Range群はPhase 9e時点でtransparent outer border＋淡いsurface、設定済みmarkerだけsemantic stateを持つため維持した。
- Selected Clip actionとcloseはcontextual、Deleteは破壊actionであるため、休止controlの一括flat化から除外した。
- fixed fixtureでA Current、B Quiet Resting、C Dark Headerを比較し、Gate 0=`GO — B`。Cはheader全面がCanvas、Clip active、Setup青、警告より強くなりやすいためHOLDとした。

## 8. 実装結果

- `styles/components/animation-table-playback.css`だけで、休止中の対象borderをtransparentへ下げた。hover / open / focus、PREVIEW / Onion active、Motion key / Asset activeではsemantic borderを戻す。
- Owner指示により通常playを32×28pxから28×24px / 11px glyphへ一回り縮小した。中央主action、maroon fill、playing橙は維持し、`pointer: coarse`は44×38pxのまま変更していない。
- DOM、ID、event、ARIA、model、History、save、popup geometry、header / Lane / grid wheel、Clip gestureは変更していない。
- `build/phase9f-animation-table-attention-hierarchy-fixture.html`と`build/verify-animation-table-attention-hierarchy.mjs`で三案、production selector、通常 / coarse play、wheel / drag正本を固定した。

## 9. 検証 / close判定

- 変更JS 7件の`node --check`、全105 `build/verify-*.mjs`、`npm.cmd run build`を通過した。
- Browserでfixed fixture、wide / 700px narrow、Table resize、SCOPE / Range open、PREVIEW / Onion、Play / Stop、header wheel 147%→120%、header drag、close / reopenを確認した。
- Browser console error / warningは0件。build後の`dist/`追跡済み基準をrestoreし、今回生成5 assetだけを削除、`dist/` / `node_modules/.vite/`差分0を確認した。
- SOL final review=`A`。Owner制作環境でのvisual / pen / touch確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離し、問題時は本Phaseを再OPENせず限定bug fix Gateへ送る。
