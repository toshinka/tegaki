# Phase 8p — Animation Table Playback Range Choice Gate

作成日: 2026-08-22

状態: CLOSE — Gate 1=`GO — B: RANGE summary＋anchored Focus Deck`、production限定接続、全91 verifier / build / Browser、SOL final review=`A`

## 1. 目的

Animation Tableの`END / IN / OUT`を常時横並びで読む負荷を下げつつ、再生終端と設定済み範囲を閉状態でも見失わないChoice layerへ再配置する。Phase 8nのGlance semanticと既存Playback保存正本を維持し、循環buttonの誤操作を減らす。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
6. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
7. `開発用資料保管庫/Archive/phase8n.md`
8. `開発用資料保管庫/Archive/phase8o.md`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/ui/animation-table-popup.js`
11. `tegaki_work/build/verify-animation-table-playback-glance.mjs`

## 3. Stage A — authority監査

- 保存正本は既存`TimelineModel.playback`の`loop / endMode / inFrame / outFrame`。新しいRange preset、表示用保存flag、UI側の第二正本を作らない。
- `endMode`は`timeline / last-clip / out-marker`の三値。`getPlaybackRange()`は現在SCOPEを含む既存optionsから終端を求め、`advanceFrame()`が同じrangeを使う。
- IN / OUTはFrame indexまたは`null`。`clampPlaybackSettings()`はProject読込・totalFrames変更後も範囲内へ正規化し、INがOUTを超えた時はOUTをINへ揃える。
- 現行`_cyclePlaybackEndMode()`は三値を循環し、`_togglePlaybackMarker()`はcurrent Frameの設定／解除を一buttonで行う。いずれも`_applyPlaybackSetting()`を通り、既存Timeline Historyと再生再開契約を共有する。
- Phase 8nの`I / O` marker chip、Repeat / Repeat Off、Monitor＋SCOPE現在値はGlance layerとして成立済み。Phase 8pはLoop、SCOPE、onion、timeline marker描画を同時変更しない。

比較fixture: `tegaki_work/build/phase8p-playback-range-choice-fixture.html`

## 4. Gate 1比較

### A. Current — END cycle＋I / O独立button

一操作で設定できるが、三つの設定が常時同じ深度へ露出し、`END:C`を押した次に何へ変わるかが初見では読みにくい。

### B. RANGE summary＋anchored Focus Deck（第一案）

閉状態は`RANGE C · I— O—`のように終端sourceとmarker有無を一buttonで要約する。開状態では終端source三択と、current FrameへIN / OUTを設定・解除する既存authorityを標準popoverへ投影する。icon / colorだけにせず文字、Frame値、radio state、title / ARIAを併用する。

### C. Timeline上の直接Range handle

時間との空間関係は強いが、Clip move / retime、Frame seek、marker drag、narrow表示のhit authorityが新たに必要になる。Phase 8pの最初のSliceには採らず、Bの制作確認後に必要性が残る場合だけ独立Gateで比較する。

Gate 1判定: `GO — B`。標準popoverと既存setterへのprojectionで成立させ、Cの新gestureや保存stateを持ち込まない。fixtureとproductionのwide / narrow、closed Glance、Focus Deck情報密度をSOLが確認した。

## 5. Acceptance Criteria

- 閉状態で`timeline / last-clip / out-marker`とIN / OUTの設定有無を識別でき、開かなければ現在値が読めない設計にしない。
- Focus Deckの三択とIN / OUT操作は既存`_applyPlaybackSetting()`、History名、`TimelineModel.playback`だけを使う。
- `out-marker`選択中にOUT未設定の場合は無言の別終端へ見せず、未設定を明示する。
- keyboardはArrow / Home / End、Enter / Space、Escape / Tab、focusout / outside pointer closeをSCOPE Focus Deckと同等に固定する。
- playback中の設定変更、IN > OUT補正、totalFrames短縮、scope別Last Clip、Project close / reopenで再生範囲が既存Modelと一致する。
- 1280×720 / 720×720、低height、mouse / pen / touch、console errorを確認する。
- production JS変更時は`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`を通す。

## 6. No-go

- Playback保存schema、Range preset、marker drag stateの追加。
- Loop / SCOPE / onionの同時再設計。
- Clip move / retime / selection、Timeline wheel三領域の変更。
- icon / colorだけで終端やmarker stateを表すこと。
- Animation Table header DOMの全面再構築、常設Inspector、Dock化。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 7. 停止条件 / model分担

Stage Aのauthority監査、Glance / Choiceの情報設計、Gate判定はSOL / XHighが担当する。Gate後に対象DOM、既存setter、keyboard contract、Acceptance Criteriaが一componentへ固定できた場合のみLUNA / MAXへproduction Sliceを委譲できる。再生範囲計算、保存schema、History、marker gestureの新判断が必要ならLUNAは変更せずSOLへ返す。

## 8. Production実装

- 現行`#anim-end-mode-btn`を`RANGE C · I— O—`型のclosed summary triggerへ変更し、終端sourceとIN / OUTの設定値を常に読めるようにした。
- anchored Focus Deckへ`TIMELINE / LAST CLIP / OUT MARKER`の三択と、既存`#anim-set-in-btn / #anim-set-out-btn`を投影した。end choiceは既存`_applyPlaybackSetting()`と`caf-playback-end-mode`へ直接接続し、markerは既存`_togglePlaybackMarker()`をそのまま使う。
- `out-marker`かつOUT未設定時はtriggerへ`needs-out-marker`と明示titleを付け、無言fallbackに見せない。
- Arrow四方向 / Home / End、Escape focus復帰、focusout / outside pointer closeを追加し、SCOPE Focus Deckとは相互に一方だけ開く。
- Setup系の淡い青border / surface、選択中end optionの既存橙active、Futaba paletteだけを使い、保存schema、Playback evaluator、Loop / SCOPE / onion、Timeline wheel / Clip gestureは変更していない。

## 9. 検証

- `node --check ui/animation-table-popup.js`
- `node --check build/verify-animation-table-playback-range-focus-deck.mjs`
- 関連verifier: Playback Range / Playback Glance / header layout / SCOPE Focus Deck / Selected Clip Actionを通過。
- 全`build/verify-*.mjs`: 91件通過。
- `npm.cmd run build`: Vite 8.0.16 / PixiJS 8.19.0で成功。既知の`util` externalizeとchunk size warningのみ。
- Browser: closed summary、Focus Deck、終端三択、IN F1 / OUT F4、OUT marker終端、OUT未設定警告、Arrow focus、Escape復帰、outside close、702px narrow、960px復帰を確認。console error / warning 0件。
- build生成`dist/`差分は追跡済み基準をrestoreし、5個のuntracked生成assetだけを削除した。

## 10. Close

SOL final review=`A`。Phase 8pは2026-08-22に技術closeする。Owner制作確認では長尺CAF、低height、Panel重なり、Project close / reopen、playback中変更、IN > OUT補正、totalFrames短縮、scope別Last Clip、mouse / pen / touchを確認し、問題時はPhase 8pを再OPENせずPlayback Range限定bug fixを立てる。

次Phase 8qはQTP Text Entry / Panel Density Gate。Phase 7kのText to Raster正本を変えず、full-width launcher、小型`T` launcher、OPACITY後の独立utility配置を比較し、縦書き・Windows local fontは同時実装しない。
