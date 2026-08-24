# Phase 8s — Animation Table Playback Range Inline Control Gate

作成日: 2026-08-22

状態: CLOSED — Gate 1=`GO — B: full end label＋inline I / O`、production限定接続、全94 verifier / build / Browser、SOL final review=`A`

## 1. 目的

Phase 8pで統合したPlayback Rangeの閉状態を、`RANGE C · I— O—`という略号中心の表示から、現在の終端sourceをそのまま読め、IN / OUTをその場で設定できる一群へ整理する。再生範囲の保存・History・評価正本は変えず、初見の解読負荷とFocus Deckを開く操作を減らす。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase8p.md`
6. `開発用資料保管庫/Archive/phase8r.md`
7. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
8. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/ui/animation-table-popup.js`

## 3. Stage A — authority監査

- 保存正本は既存`TimelineModel.playback.endMode / inFrame / outFrame`。新しいRange mode、表示用flag、Project fieldを作らない。
- 終端三択は既存`_setPlaybackEndMode()`、markerは既存`_togglePlaybackMarker()`を使い、いずれも`_applyPlaybackSetting()`とTimeline Historyを通る。
- Phase 8pのFocus Deck open stateはruntime-only。keyboard / outside close、OUT未設定警告、SCOPE Focus Deckとの相互closeを維持する。
- Loopは独立したRepeat / Repeat OffのGlance。Phase 8sではLoop意味、再生評価、Timeline marker描画、SCOPE、onionを変更しない。
- `DURATION`はselected Clipの長さ操作、`LIB`はAsset Library入口であり、Playback Rangeとはauthorityが異なる。同時に隠すと初心者導線と既存利用頻度の制作確認が混ざるため、後続のAdvanced / Contextual Controls Gateへ送る。

## 4. Gate 1比較

比較fixture: `tegaki_work/build/phase8s-playback-range-inline-fixture.html`

### A. Current — `RANGE C · I— O—`

一buttonへ集約できるが、`C`がLast Clipを表すことを初見で解読しにくく、I / Oの直接操作はFocus Deckを開くまで現れない。

### B. Full end label＋inline I / O（採用）

Repeatの隣を一つのSetup群として`LAST CLIP ▾ | I— | O—`と表示する。終端sourceは`TIMELINE / LAST CLIP / OUT MARKER`を省略せず、I / O chipは現在Frameへの設定・同Frameでの解除を既存setterへ直接接続する。Focus Deckは三つの終端source比較だけを担う。

### C. Full end labelのみ＋I / Oはshortcut

最も静かだが、marker機能が発見不能になりやすい。将来shortcutを追加しても直接buttonは当面残し、Owner制作確認後に露出量を再評価する。

Gate 1=`GO — B`。閉状態の意味を文字で読ませ、I / Oは同じ枠内でRangeに属する操作だと示す。保存state、marker gesture、Timeline handleは増やさない。

## 5. Acceptance Criteria

- Repeatの隣で現在の終端sourceを`TIMELINE / LAST CLIP / OUT MARKER`の全称で読める。
- 同じoutlined group内の`I / O`で現在Frameへ設定し、同じFrameでもう一度押すと解除できる。設定済みFrame値を`F<n>`で読める。
- Focus Deckは終端三択を同時比較でき、既存keyboard / Escape / focusout / outside closeを維持する。
- OUT MARKER選択中かつOUT未設定は警告が残る。
- `TimelineModel.playback`、History名、再生range計算、Loop / SCOPE / onion、Timeline wheel / Clip dragを変更しない。
- wide / narrow、marker set / move / clear、Table close / reopen、Project reload、console errorを確認する。
- JS変更は`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`を通す。

## 6. No-go

- `DURATION`、`LIB`、Clip edge retime、Asset Libraryの同時再配置。
- I / OのTimeline直接drag handle、Range preset、shortcut-only化。
- Playback evaluator、保存schema、History、SCOPE、Loop、onionの変更。
- Animation Table header DOMの全面再構築や新しいDock / Inspector。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 7. 後続Gateへ送る項目

- `DURATION`: 初心者経路をClip edge dragへ寄せ、数値増減をselected Clipのcontext actionまたはAdvancedへ退避できるかを、coarse pointerと一Frame Clipを含めて比較する。
- `LIB`: 常設文字button、gear / overflow、Settings送りを比較し、CAF再利用・複製workflowで入口を隠し過ぎないかを確認する。
- I / O shortcut: 直接buttonの制作確認後、既存shortcut衝突監査を行う独立Sliceとする。

## 8. model分担

本PhaseのGate判定、情報深度、production review、closeはSOL / XHighが担当する。DOM / CSSと既存setter projectionだけへ固定した限定SliceはLUNA / MAXへ委譲可能だが、今回は小さい一componentでありSOLが連続実装する。Playback正本、History、shortcut衝突、Timeline gestureの判断が必要になった場合は拡張せず停止する。

## 9. Production実装

- Repeatの隣を一つのSetup outlined groupとし、終端source trigger、IN、OUTの順へ並べた。
- 終端sourceは`TIMELINE / LAST CLIP / OUT MARKER`の全称を常時表示し、`RANGE`と`T / C / O`略号を閉状態から除いた。
- IN / OUTは既存IDと`_togglePlaybackMarker()`を維持したままinline chipへ移し、未設定`—`、設定済み`F<n>`、現在Frameでの再押下解除を投影した。
- Focus Deckは既存三終端の比較、OUT未設定警告、keyboard / focusout / outside closeだけを維持し、marker mutationの重複表示を除いた。
- `DURATION`、`LIB`、Playback evaluator、保存schema、History名、Loop / SCOPE / onion、Timeline wheel / Clip gestureは変更していない。

## 10. 検証 / Close

- `node --check ui/animation-table-popup.js`と新旧Playback Range / Glance / header verifierを通過した。
- 全`build/verify-*.mjs`は94件通過した。
- `npm.cmd run build`はVite 8.0.16 / PixiJS 8.19.0で成功した。既知の`util` externalizeとchunk size warningのみ。
- Browserではwide / 701px narrow、横overflowなし、全称三終端、I / OのF1設定・同Frame解除、OUT未設定警告、Table close / reopen、console error / warning 0件を確認した。
- SOL final review=`A`で2026-08-22に技術closeする。Owner制作確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離し、問題時は本Phaseを暗黙に再OPENせずPlayback Range Inline限定bug fixを立てる。
