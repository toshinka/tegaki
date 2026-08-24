# Phase 8r — QTP Pen Preset / Density Gate

作成日: 2026-08-22

状態: CLOSED — Gate 1=`GO — B: 6 size rings＋active / focus summary`、LUNA production Slice、SOL final review=`A`

## 1. 目的

QTPのPen / Eraser / Airbrush用6 presetを、素早い直接選択という長所を失わず、136px幅で小さい数値が六つ同時露出する密度と、直後のSIZE / OPACITY表示との重複を整理する。Canvas Firstと現在値の一目性を保ち、Presetを隠し過ぎない。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
6. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
7. `開発用資料保管庫/Archive/phase8l.md`
8. `開発用資料保管庫/Archive/phase8q.md`
9. `tegaki_work/ui/quick-access-popup.js`
10. `tegaki_work/styles/main.css`

## 3. Stage A — authority監査

- preset正本は`QA_PRESET_TOOLS = ['pen', 'eraser', 'airbrush']`、各6件の`toolPresets`、tool別`activePresetSlots`、localStorage `tegaki-quick-access-tool-presets-v1`である。Project / Historyへ保存しない。
- slot選択は既存`_selectPresetSlot()`から`_applyPreset()`へ入り、SIZE / OPACITY sliderとdrawing engineへ同じ値を送る。slider編集はcurrent slotへ保存される。
- `selectAdjacentPresetSlot(delta)`の循環、tool切替時のactive slot復帰、Fill等の非対応toolでdisabledになる契約を維持する。
- 現行6 slotは各19×32px、dot、size、opacityを同時表示し、active orange surfaceを持つ。直後のSIZE / OPACITY cardが現在値を再表示するため、全slot比較値と現在値の役割が重なっている。
- QTP position、Q shortcut、drag / close / reopen、Phase 8qのOPACITY後Text utility、Painter's Palette restrained-depthを維持する。

## 4. Gate 1比較

比較fixture: `tegaki_work/build/phase8r-qtp-preset-density-fixture.html`

### A. Current — 6 slot × dot / size / opacity

一tap直接選択と全値比較は強いが、6px / 7px文字が常時12個並び、current値がSIZE / OPACITY cardと重複する。

### B. 6 ring-only＋active preset summary

6 slotを一列のまま維持し、各slotはdot / slot番号を主表示、数値は選択中だけ一行summaryへ投影する。直接選択と幅を保ちながら平常時の文字量を減らす。非active値はtitle / hoverだけへ完全依存せず、focus / long press時に読める補助を比較する。

### C. 3×2 larger preset cards

size / opacityを各slotで読めるが、Presetだけで二行を占有し、QTP高とCanvas遮蔽が増える。coarse pointerでは候補になるため、136px / 170pxの両方で比較する。

Gate 1=`GO — B`。136px実測でPreset領域 / QTP高はA=`32 / 224.2px`、B=`26 / 221.4px`、C=`78 / 270.2px`。170px coarseではA=`40 / 237.2px`、初回B=`31 / 249.2px`、C=`94 / 291.2px`で、Bはsummaryを既存status rowへ置くことで追加行を作らない形に修正した。Aの12極小数値を残すより、各slotのsize / dotとactiveのsize＋opacity精値へ役割を分ける。keyboard focusした非active slotはmutationなしで同じsummaryへpreview投影し、blurでactive summaryへ戻す。Focus Deck一button化は比較値を隠し、描画中のpreset直接切替を一段増やすため採らない。

## 5. Acceptance Criteria

- Pen / Eraser / Airbrushで6 preset、tool別active slot、slot値、SIZE / OPACITY同期、adjacent循環を維持する。
- Fill / Lasso Fill / Selectionではpreset非対応がdisabled / statusで読め、押してもmutationしない。
- current slotとcurrent SIZE / OPACITYが一目で一致し、非active presetの比較可能性をhoverだけへ依存させない。
- 136px / coarse 170px、QTP open / close / drag、tool往復、reload、localStorage round-trip、mouse / pen / touchを確認する。
- Phase 8q Text utility、COLOR、tool grid、slider wheel / click、Q shortcutの順序とhit areaを変えない。
- production JS変更時は`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`、Browser consoleを確認する。

## 6. No-go

- preset件数、保存key、保存shape、Project / Historyへの保存を変更しない。
- brush engine、pressure、smoothing、airbrush parameterの同時再設計。
- QTP全体のposition / density、Text、COLOR、tool grid、sidebar、Layer Panelの同時変更。
- Focus Deck、modal、holdだけを唯一のpreset入口にしない。
- vertical text、local font、再編集可能Textへ戻らない。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`を調査・編集しない。

## 7. 停止条件 / model分担

presetの露出量、直接性、current summary、coarse pointer比較はSOL / XHighが決める。DOM / CSS、既存setter / storage維持、verifierが固定された一つの表示SliceはLUNA / MAXへ委譲可能。保存shape、tool別preset意味、brush parameter、QTP全体architectureの判断が必要ならLUNAは変更せずSOLへ返す。

## 8. 次の作業

1. 完了: 136px / coarse 170px固定fixtureでA / B / Cを比較し、Bを固定した。
2. active summaryを既存`qa-preset-status`へ投影し、各slotはdot / size / slot番号へ限定するproduction Sliceを固定する。
3. focus preview、blur復帰、tool別active、非対応tool disabled、SIZE / OPACITY同期をverifier化してからproductionへ接続する。

## 9. LUNA production Slice 実績

- `quick-access-popup.js`の既存6 slot DOMへslot番号を追加し、preset ringを12px、compact preset高さを26px（coarse pointerは32px）へ整理した。opacity値DOMは保持したまま常時非表示とし、SIZE / OPACITYの二重露出を避けた。
- 既存`qa-preset-status`へactive tool / slot / size / opacityを投影し、非active slotへkeyboard focusした間だけ同じstatus行へ比較値をpreviewする。focus previewは`_selectPresetSlot()`、`_applyPreset()`、localStorage、History、Brush engineを呼ばず、blurでactive summaryへ戻る。
- aria-label / title、非対応toolのdisabled / `not used`、tool別active slot、直接click、SIZE / OPACITY同期を維持した。
- `build/verify-qtp-preset-density.mjs`を追加し、既存`verify-qtp-text-entry-layout.mjs`、全`build/verify-*.mjs`、`node --check ui/quick-access-popup.js`、`npm.cmd run build`を通過した。Browserではcompact高さ、6 slot、opacity非表示、slot切替、Fill disabled、keyboard focus preview / blur復帰、console error / warning 0件を確認した。

SOL final reviewでは新規表示部のslot index正規化を既存`_clampSlotIndex()`へ統一した。93 verifier、`npm.cmd run build`、Browserで6 slot、Pen / Eraser / Airbrush往復、Fill disabled、SIZE / OPACITY同期、keyboard focus preview / blur復帰、QTP close / reopen、Phase 8q Text入口、console error / warning 0件を再確認し、判定`A`で技術closeした。Owner制作確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離する。

Preset位置、QTP全体density、long press / Focus Deck化、brush parameter再設計は後続Gateへ残す。
