# Phase 9c — Canvas-first Visual Language / Skin Baseline Comparison Gate

作成日: 2026-08-24

状態: COMPLETE — Gate 1=`GO — B: Warm Canvas-first`。Animation Table Playbackへの最初の限定production適用とSOL final review=`A`を完了

## 1. 目的

Phase 9aで受け入れたAnimation Tableの操作階層と、Phase 9bで固定したUI Design Authorityを土台に、Tegaki全体へ段階適用できるvisual languageを比較する。Callipeg、Adobe Fresco、CLIP STUDIO PAINT Simple Modeは外観の模倣元ではなく、Canvas占有、主操作の露出、役割別panel、段階表示、pen / touch到達性を検査する基準として扱う。

最初は静的fixtureとtoken / component境界の監査だけを行い、全画面リスキン、Simple / Expert二重UI、theme保存schema、Animation Table DOM再構築へ広げない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9b.md`
7. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
8. `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
9. `開発用資料保管庫/proposals/00_計画索引.md`
10. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
11. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
12. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
13. `tegaki_work/styles/main.css`
14. `tegaki_work/styles/components/animation-table-playback.css`

## 3. 維持するconcept

- Canvasと制作物を第一水位とし、常設UIは現在作業に必要な主操作を優先する。
- Animation Tableでは再生 / 停止を幅追従する中央主actionとして維持する。
- SCOPE、Range source、Onion等の低頻度設定は状態を読めるが主actionより強くしない。
- I / Oは未設定でも存在を読め、設定後はFrame値を明確に区別できる。
- Focus Deckや役割別panelで選択肢を焦点位置へ届けるが、通常tap、Clip drag / retime、wheel、pen gestureを二段化しない。
- Setup青、実行橙、成功緑、警告赤はsemantic roleに限定し、見た目の新しさだけで増やさない。

色、枠、radius、font、shadow、厳密配置pixelは比較対象であり、上記conceptを壊さない範囲で変更できる。

## 4. Stage A比較

固定入力は次の三surfaceとする。

1. Animation Table header: Phase 9aのPlayback Priority hierarchy。
2. QTP Painter's Palette: Pen slot、Size / Opacity、Text utility、Help入口を含む。
3. Layer Panel / CAF card: Canvasとの競合、active / current、Setup表示を含む一例。

| 候補 | 内容 | 初期判定 |
|---|---|---|
| A. Current Futaba restrained-depth | 現行tokenと形状を基準に、component間の不揃いだけを監査する | 比較基準 |
| B. Warm Canvas-first studio | Futaba paletteを維持しつつ、主操作の太さ、surface階層、type scale、余白、progressive exposureを三surfaceで統一する | 第一候補 |
| C. Full neutral / dark / mode split | palette・全popup・保存設定・二重UIを同時変更する | REJECT候補 |

Stage AではA / Bの静的fixtureを比較し、操作concept、contrast、wide / narrow / coarse、将来component展開の再現性を採点する。Gate 1まではproduction CSS / DOMを変更しない。

## 5. 公式参考の読み方

- Callipeg: top bar / canvas / side bar / timeline / bottom barの役割分割と、Pencil側のCanvas余白を評価する。
- Adobe Fresco: Canvasを中心にtoolbar / taskbarを分け、Layers等を役割別panelへ開く段階表示を評価する。
- CLIP STUDIO PAINT Simple Mode: 常時情報量を抑え、必要時にStudio相当へ戻れる考え方を比較する。ただしTegakiへ二重UIを直ちに導入しない。
- 公式画面の色、icon、寸法を複製しない。TegakiのFutaba palette、既存keymap、保存 / History / gesture正本を優先する。

## 6. Stage A成果物 / Gate 1条件

- `build/phase9c-canvas-first-skin-baseline-fixture.html`を作成した。A / Bを同じ内容・幅で並べ、Animation Table / QTP / Layer Panelの三surfaceを比較する。
- `build/verify-phase9c-canvas-first-skin-baseline.mjs`を作成した。主操作中心、低頻度control同数、I / O状態、Setup色の役割限定、黒白gray色値禁止、responsive ruleを固定する。
- `UI_DESIGN_AUTHORITY_MAP.md`に照らしたtoken owner / component owner inventory。
- Gate 1で一案だけ選び、最初のproduction適用componentと対象file、Acceptance Criteria、Browser操作、停止条件を固定する。

Browser 1280×720ではA / B二列、三surfaceの横overflow 0、中央play action、QTP階層を確認した。480×800ではA / Bを一列へ積み、横overflow 0、A play 38×34px、B play 44×38pxを確認した。Bは同じDOM相当の情報を保ちつつ個別controlの枠競争を弱め、play、作業surface、current Layerへ視線を寄せる。

### Gate 1 / Stage B結果

- SOL Gate 1は`GO — B: Warm Canvas-first`。ただし橙surface上の淡色文字は採用せず、Futaba茶を維持する。fixtureの設定済みOは2.29:1から4.74:1相当へ補正した。
- 最初のproduction componentはAnimation Table Playbackだけとした。`styles/components/animation-table-playback.css`で中央playを32×28px、coarse時44×38pxへ強め、Playback / Range groupの枠競争を弱めた。
- 設定済みOUTと再生中Playは橙背景＋Futaba茶へ統一した。Range source、I / O、Focus Deck、ARIA、DOM、event、History、save、wheel、Clip操作、runtime panel geometryは変更していない。
- Browser 1280×720 / 480×800でplay中心ずれ0px、Range deck開閉、I / O設定・解除、Play / Stop ARIA、横overflow 0を確認した。console error / warningは0件。
- 変更MJSの`node --check`、全103 verifier、Vite 8.0.16 build（899 modules）、生成物清掃、`git diff --check`を通過した。SOL final review=`A`。
- QTPとLayer PanelのB skinはfixture比較だけに留め、production適用は別Phaseへ分離する。Ownerの制作環境でのvisual / pen / touch確認は`OWNER_VERIFICATION_BACKLOG.md`へ送る。

## 7. No-go

- Gate 1前のproduction skin変更。
- 全popup、Layer Panel、QTP、Animation Tableを同時変更すること。
- `animation-table-popup.js`の一括分割、既存class一括rename、主要DOM置換。
- theme / Simple Mode保存flag、第二selection、第二History、別keymapを作ること。
- Rig / Mesh / WARP / Text機能、solver、Project schema、exportへ混ぜること。
- 外部toolの外観をそのまま複製すること。

## 8. 検証

- Stage A fixture / verifier。
- 既存Playback Priority / UI Design Authority verifier。
- Gate後にproductionを触る場合だけ、変更JSの`node --check`、関連 / 全verifier、`npm.cmd run build`、Browser wide / narrow / coarse相当、console error / warning、生成物清掃。
- `git diff --check`とscoped `git status`。

## 9. model分担

- Stage A比較、外部参考の採否、Gate 1、visual hierarchy / token ownership判断、最初のproduction component選定、全diff review、close: SOL / XHigh。
- Gate後に対象CSS、token、fixture、Acceptance Criteria、検証、停止条件が固定された一つの機械的Sliceだけ: LUNA / MAXへ委譲可。
- Architecture、保存state、DOM / event / History境界の判断が必要になった場合はLUNAが変更せずSOLへ返す。
