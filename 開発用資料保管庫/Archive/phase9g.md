# Phase 9g — QTP Palette / Tool Slot Attention Hierarchy Gate

作成日: 2026-08-24

状態: CLOSED — Gate 0=`GO — B: Borderless Resting＋Selected Ring`、SOL final review=`A`

## 1. 目的

Phase 9dでroot / header static appearanceの正本を分離したQuick Tool Panelについて、Palette swatch、tool row、pen presetの常設borderと選択stateが同じ水位で競合していないかを一component内で点検する。`休止中はsolid surface、選択 / hover / focusだけ輪郭を戻す`案を第一候補とし、描画中に現在色・現在tool・現在presetを一目で失わない範囲を固定する。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9f.md`
7. `開発用資料保管庫/Archive/phase9d.md`
8. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
9. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
10. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
11. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
12. `tegaki_work/styles/components/quick-access-popup.css`
13. `tegaki_work/styles/main.css`
14. `tegaki_work/ui/quick-access-popup.js`

## 3. Stage A / Gate 0

read-onlyで次を固定する。

1. Palette swatch、foreground / background、eyedropper、tool row、pen preset、size / opacity、Text入口のresting / hover / active / focus / disabled selector、hit area、event正本を一覧化する。
2. 色swatchは塗り自体を識別情報とし、休止枠を外しても選択ring、keyboard focus、cream / transparent近似色を見失わないかを確認する。
3. tool rowは現在tool、pressure対応 / 非対応、disabledを混同しない。presetは選択ring、size / opacity値、coarse hitを維持したまま左上番号を弱める案を比較する。
4. fixed fixtureでA Current、B Borderless Resting＋Selected Ring、C Flat All Controlsを比較する。Bを第一候補とし、Cが現在色 / tool / presetの三階層を失う場合は棄却する。
5. wide / 198px narrow / coarse相当、Position / Help / Text deck開閉、Q close / reopenで比較する。

## 4. Acceptance Criteria

- 現在色、現在tool、現在presetが休止controlより明確で、色だけに依存せずring / surface / shapeでも識別できる。
- borderを透明化してもlayout、hit area、QTP saved position、viewport clamp、header drag、deck内drag遮断を変えない。
- `TEGAKI_KEYMAP`由来shortcut hint、tool切替、preset値、color、size、opacity、storage、History、Canvas inputを変更しない。
- 変更する場合はstatic appearance一componentに限定し、関連verifier、全`build/verify-*.mjs`、build、Browser wide / narrow / coarse、console、生成物清掃を行う。

## 5. No-go

- Pen / Eraser pressure ON / OFF controlの新設。
- preset数、preset schema、左上番号の削除、save形式変更。
- Text入口の移動、縦書き、Windows local font列挙。
- Palette色数、foreground / background swap、eyedropper behaviorの変更。
- Sidebar / Layer Panel / Animation Tableへの同時横展開。
- QTP DOM全置換、PopupManager / geometry / storageの再設計。

## 6. model分担

- Stage A inventory、contrast / 選択state / cream色境界、Gate 0、採用判定、close: SOL / XHigh。
- Gate後に対象selector、通常 / hover / selected / focus / disabled値とAcceptance Criteriaが固定されたCSS-only一component Sliceだけ: LUNA / MAXへ委譲可。
- color、preset、pressure、storage、Canvas input、popup geometryの判断が必要ならLUNAは変更せずSOLへ返す。

## 7. Stage A inventory / Gate 0

- Palette color cell、tool cell、preset cellがすべて1px borderを持ち、current color / tool / preset以外も同じ水位で並んでいた。
- `qa-color-button.active`、`qa-tool-button.active`、`qa-preset-slot.active`と、preset / colorの保存正本、QTP header drag除外selectorを確認した。Palette / tool / presetには明示focus-visibleが不足していた。
- A Current、B Borderless Resting＋Selected Ring、C Flat Allを198px fixtureで比較し、Gate 0=`GO — B`。Cはcream / background近似色とcurrent / focusが沈むためHOLDとした。
- Main / Sub swatch、slider card、Text入口、header utilityは識別責務が異なるため本Sliceから除外した。

## 8. 実装結果

- `styles/components/quick-access-popup.css`へPalette color / tool / preset cellだけのstatic appearanceを追加した。
- restingはtransparent border。color cellだけcream / background近似色を失わない14%の内側contrastを残した。hoverはsubtle border、selectedは橙ring、focus-visibleは既存`--active-border`の2px outlineとした。
- DOM、event、ARIA、shortcut、tool切替、preset値、color、size、opacity、storage、History、Canvas input、popup geometryは変更していない。
- `build/phase9g-qtp-attention-hierarchy-fixture.html`と`build/verify-qtp-attention-hierarchy.mjs`で三案、production selector、active state / storage / drag boundaryを固定した。

## 9. 検証 / close判定

- 変更JS 7件の`node --check`、全106 `build/verify-*.mjs`、`npm.cmd run build`を通過した。
- Browserでfixture、QTP production、cream→maroon色復帰、Eraser→Pen復帰、Preset変更→復帰、Position / Help / Text deck、QTP drag、close / reopenを確認した。
- Browser console error / warningは0件。build後の`dist/`追跡済み基準をrestoreし、今回生成5 assetだけを削除、`dist/` / `node_modules/.vite/`差分0を確認した。
- SOL final review=`A`。Owner制作環境でのvisual / pen / touch確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離し、問題時は本Phaseを再OPENせずQTP cell hierarchy限定bug fixへ送る。
