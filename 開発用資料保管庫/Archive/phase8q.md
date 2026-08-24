# Phase 8q — QTP Text Entry / Panel Density Gate

作成日: 2026-08-22

状態: CLOSE — Gate 1=`GO — B: OPACITY後のcompact Text utility launcher`、production / verifier / build / Browser完了、SOL final review=`A`

## 1. 目的

Phase 7kのone-shot Text to Rasterを維持したまま、使用頻度に対してfull-width launcherがQTPの描画導線を占有する問題と、狭幅Text panel内のFONT / SIZE label重なりを整理する。Textを通常描画toolと誤認させず、必要時だけ詳細を開く入口へ再配置する。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
6. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
7. `開発用資料保管庫/Archive/phase7k.md`
8. `開発用資料保管庫/Archive/phase8l.md`
9. `tegaki_work/ui/quick-access-popup.js`
10. `tegaki_work/styles/main.css`
11. `tegaki_work/system/text-rasterizer.js`
12. `tegaki_work/build/verify-text-to-raster.mjs`

## 3. Stage A — authority / layout監査

- Text確定正本は既存`TextRasterService.createTextLayer()`、`system/text-rasterizer.js`、通常Raster Layer作成＋1 History。launcher配置やpanel open stateをProjectへ保存しない。
- 現行`#qa-text-raster-toggle`、panel / input / confirm IDとevent handlerを再利用する。active drawing tool、sidebar icon、新shortcutにしない。
- 現行DOMは6-tool grid直後に124px full-width launcherとinline panel、その後にpen preset、SIZE、OPACITYが続く。one-shot utilityが描画toolとpen設定の連続性を分断している。
- Text panelは閉状態なら非占有だが、launcherは常時22px＋marginを使う。panelのFONT / SIZE / BOLD / colorは4列で、136px QTPではlabelとcontrolが詰まる。
- QTPの自由位置、Q shortcut、drag / close / reopen、current drawing tool、Painter's Palette restrained-depthを維持する。

## 4. Gate 1比較

比較fixture: `tegaki_work/build/phase8q-qtp-text-entry-fixture.html`

### A. Current — tool grid直後のfull-width launcher

意味は明示的だが、one-shot utilityがpen toolsとpreset / SIZE / OPACITYを分断し、閉状態でも高い視覚面積を持つ。

### B. OPACITY後のcompact Text utility launcher（第一案）

描画tool → pen preset → SIZE / OPACITYの連続性を保ち、その後へ小型`T` SVG＋`TEXT`のutility launcherを置く。panelは既存field / confirm authorityを保ったまま必要時だけ開く。launcherは通常toolのactive stateを持たず、open stateだけをARIAとsurfaceで示す。

### C. 6-tool grid内のText tool

最小面積だが、one-shot Raster確定をpen / eraser等のpersistent drawing toolと同列に見せる。吹き出しや再編集可能Textがpersistent modeになった後だけ再評価し、現段階では採らない。

Gate 1判定: `GO — B`。1280px実表示ではA / B / Cの各QTPを160px固定で比較し、body horizontal overflowなし、BのFONT / SIZE label重なりなし、console error / warning 0件を確認した。Bは描画tool → pen slots → SIZE / OPACITYの連続性を保ち、open中だけ二段fieldを展開する。最初のproduction候補はlauncher移動・compact化とpanel fieldの明示二段rowまで。QTP外anchored panelはedge clampとCanvas遮蔽を要するため、inline panelで高さが問題になる制作確認後だけ別Gateにする。

## 5. Acceptance Criteria

- 閉状態でpen tool → preset → SIZE / OPACITYの視線とtab順をTextが分断しない。
- launcherがText入力panelを開くone-shot utilityであり、active drawing toolに切り替わったように見えない。
- 既存toggle / content / family / size / bold / color / cancel / confirm IDとhandler、Ctrl / Cmd+Enter、Raster 1 Historyを維持する。
- panel open中もFONT / SIZE labelとcontrolが重ならず、将来の`SYSTEM FONTS` / import affordanceを置ける構造余地を残す。
- Cancel / confirm後のdrawing context、Q close / reopen、QTP drag、Canvas遮蔽、1280×720 / 720×720、mouse / pen / touch、console errorを確認する。
- CSSは既存QTP tokenとFutaba paletteを使い、黒・白・neutral grayやbrowser既定色へ落とさない。
- production JS変更時は`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`を通す。

## 6. No-go

- vertical text、句読点 / 括弧回転、縦中横の同時実装。
- `window.queryLocalFonts()`、Windows font path走査、font file import。
- 再編集可能Text Layer、吹き出しschema、CAF内Text。
- Textをactive drawing tool、sidebar常設icon、new shortcutへ昇格すること。
- QTP全体のPreset / density / position、sidebar、Layer Panelの同時再設計。
- Text rasterizer、History、Project / PSD / export正本の変更。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 7. 停止条件 / model分担

launcherの役割、配置、persistent toolとの境界、panel field構造はSOL / XHighが決める。DOM移動、既存ID / handler維持、component-local CSS、verifierが固定できた後の限定production SliceはLUNA / MAXへ委譲可能。Text rasterizer、History、local font権限、vertical layout、QTP全体architectureの判断が必要ならLUNAは変更せずSOLへ返す。

## 8. 次の作業

1. 完了: 136〜160px QTP固定fixtureでA / B / Cとpanel open状態を比較し、Bを固定した。
2. 完了: launcherをOPACITY後へ限定移動し、既存ID / handlerを維持した62px `T / TEXT` surfaceとFONT / SIZEの二段fieldをproductionへ接続した。
3. 完了: `node --check`、Text関連verifier、全92 verifier、build、実QTPのclose / reopen・Rasterize・Ctrl / Cmd+Enter・Cancel・History・Undo / Redo・consoleを確認した。

## 9. Production実装

- `tegaki_work/ui/quick-access-popup.js`: Text blockを6-tool grid直後からSIZE / OPACITY後の独立one-shot utilityへ移した。`qa-text-raster-*`のID、handler、`TextRasterService.createTextLayer()`、Ctrl / Cmd+Enterを維持し、button labelだけをcompact `T / TEXT`へした。
- `tegaki_work/styles/main.css`: launcherをsemantic control surfaceの62px右寄せにし、open時だけactive orange surfaceを出す。panelはinlineのまま、FONTを一段、SIZE / BOLD / current colorを次段へ分けた。
- `tegaki_work/build/verify-qtp-text-entry-layout.mjs`: DOM authority一つ、tool → preset → SIZE / OPACITY → Textの順、ARIA、二段field、既存Text Raster authorityを固定した。
- `tegaki_work/build/phase8q-qtp-text-entry-fixture.html`: Current / compact utility / tool grid内Textの三案比較を保存した。

保存schema、Text Rasterizer、History、Project / PSD / export、active drawing tool、sidebar、Q shortcutは変更していない。

## 10. 検証

- `node --check ui/quick-access-popup.js`: PASS。
- 関連verifierと全`build/verify-*.mjs`: 92 / 92 PASS。
- `npm.cmd run build`: PASS（Vite 8.0.16 / PixiJS 8.19.0、既知の`util` externalizeとchunk size warningのみ）。
- Browser 1280×720: 閉状態はOPACITY後の62px `T / TEXT`、open panelは124px内、FONT / SIZE label overlapなし、horizontal / vertical overflowなし。
- `Phase 8q` Rasterize: History `0→1`、Undo `1→0`、Redo `0→1`。Ctrl+Enterも1 History、CancelはHistory不変。Q close / reopenではpanelを閉じて復帰した。
- Browser console error / warning: 0件。
- build後は追跡済み`dist/`基準を復元し、当該buildで生成された未追跡asset 5件だけをcontainment確認後に削除した。`dist/` / `node_modules/.vite/`差分なし。

## 11. Close判定

SOL final review=`A`。Phase 8qは2026-08-22に技術closeする。Owner制作確認では長文 / 複数行、日本語 / ASCII、FONT / SIZE / BOLD / current color、QTP drag、低height / 狭幅、Project close / reopen、PNG / PSD、mouse / pen / touchを確認し、問題時はPhase 8qを再OPENせずQTP Text Entry限定bug fixを立てる。

次Phase 8rはQTP Pen Preset / Density Gate。既存6 preset slotの保存・適用正本を変えず、slot label / current状態、SIZE / OPACITYとの重複、閉状態の高さを固定fixtureで比較する。Text、vertical text、local font、Layer Panel、QTP全体再構築は同時変更しない。
