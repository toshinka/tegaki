# Phase 9e — Animation Table Primary Playback / Header Attention Gate

作成日: 2026-08-24

状態: CLOSED — Stage A / Gate 0 / Stage B / SOL final review=`A`

## 1. 目的

Phase 9a / 9cで固定した「再生 / 停止は最頻actionで視覚中央」というconceptを維持しつつ、主playが専用一行を占有してAnimation TableのCanvas面積を奪う問題を修正する。第一候補は、主playを第一header row内の中央へ収め、row高相当のcompactな反転色primary actionと左右余白で優先度を示す形である。

このPhaseは最初に現行DOM / flex-wrap / narrow / coarse / drag除外 / wheel領域をinventoryし、DOMを変えずCSSだけで成立する最小SliceをGate 0で選ぶ。header全面dark化、他controlのborderless化、SCOPE / Range / Timeline zoomの挙動変更を同時に行わない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9d.md`
7. `開発用資料保管庫/Archive/phase9c.md`
8. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
9. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
10. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
11. `tegaki_work/styles/components/animation-table-playback.css`
12. `tegaki_work/ui/animation-table-popup.js`
13. `tegaki_work/build/verify-animation-table-playback-priority.mjs`
14. `tegaki_work/build/verify-animation-table-header-layout.mjs`

## 3. 維持するconcept / authority

- 再生 / 停止は最頻actionとして、通常幅 / narrowで視覚中央に置く。
- DOM、button ID、event、`aria-label / aria-pressed`、playback model、History / saveは`animation-table-popup.js`と既存modelを正本とする。
- static appearanceは`styles/components/animation-table-playback.css`、palette / semantic tokenは`styles/main.css`を正本とする。
- header空白drag、header wheelのTimeline zoom、Lane列wheel、Timeline grid wheel Frame±1、Space+drag、Clip move / retimeを維持する。
- coarse pointerのhit areaを縮めず、視覚icon寸法と操作面を必要なら分離する。

## 4. Stage A / Gate 0

read-onlyで次を固定する。

1. `.anim-table-header-row--playback / .anim-table-header-left / .anim-playback-primary-slot / .anim-play-btn`のDOM、flex、wrap、narrow、coarse、外部参照。
2. 主play専用rowが生まれる原因が`flex: 1 0 100% / min-width: 100%`だけか、DOM順 / header幅 / right側closeとの組合せか。
3. 次の三案を1280×720 / 720×720固定fixtureで比較する。
   - A: 同じDOM順のままslotの100% flexを外し、第一row内で中央を保つ。
   - B: header rowを三領域gridへし、中央cellへplayを置く。
   - C: playだけabsolute centerへ置き、左右群との衝突を幅Gateで拒否する。
4. normalはrow高相当の約28px以下、coarseは既存44×38px hitを維持し、maroon fill＋Futaba background iconの反転色を比較する。

Gate 0では、DOM変更なしでwide / narrow / coarseが成立する案を優先する。第一rowで左右controlと重なる、drag可能空白が消える、またはresponsive分岐が増えすぎる場合は`HOLD`としてfixtureから切り直す。

## 5. Acceptance Criteria

- 主playは専用一行を作らず、第一header rowの視覚中央にある。
- normal / narrow / coarseでcontrol重なり、overflow、wrapの偶発変化がない。
- play / stop、Loop、Range deck、I / O、SCOPE deck、PREVIEW、onion、close / reopenが従来どおり動く。
- header空白dragと三領域wheel routing、Timeline seek、Clip move / retimeを維持する。
- border / fillはpalette内で、normal / hover / playing / focus / disabledのcontrastとhit areaを確認する。
- 関連verifier、全`build/verify-*.mjs`、build、Browser wide / narrow / coarse相当、console、生成物清掃を行う。

## 6. No-go

- SCOPE `SET`の削除またはeye表示との統合。`includedLanes`の保存 / range意味を別Gateで監査する。
- `OUT MARKER`時だけI / Oを表示する挙動変更、Range source / marker保存変更。
- Timeline zoomのfooter移動、wheel routing変更。
- header全面dark化、Sidebar / Layer Panel / QTPを同時にborderless化。
- QTP color swatch、Pen / Eraser pressure toggle、preset番号削除、Text vertical / local font。
- Animation Table DOM全置換、model / History / save / gestureの再設計。

## 7. model分担

- Stage A inventory、Gate 0、responsive / gesture境界、採用判定、close: SOL / XHigh。
- Gate後にCSS selector、固定寸法、Acceptance Criteria、停止条件が一つへ限定できたstatic style Sliceだけ: LUNA / MAXへ委譲可。
- DOM、event、ARIA、wheel、drag、model判断が必要ならLUNAは変更せずSOLへ返す。

## 8. Stage A / Gate 0結果

- 700px narrow実測では、主play以外の第一行controlは約453px、row内有効幅は約654pxだった。旧`flex: 1 0 100% / min-width: 100%`が主play専用行の直接原因で、absolute center案はRange controlへ重なるため棄却した。
- 三領域grid案は左右group化のDOM変更または狭幅分岐を必要とするためHOLDとした。
- Gate 0はDOM / eventを変えず、CSS `order`で`FPS / FRAMES → SCOPE → Play → Range / Loop → PREVIEW → Onion`へ視覚順を整理し、主play slotを`flex: 0 0 auto`＋`margin-inline: auto`で挟む案を`GO`とした。
- 通常Playは32×28pxの栗色面＋Futaba背景色抜き、hover / focusは既存橙tokenを混ぜ、playingは橙面＋栗色を維持した。coarseは44×38pxの既存操作面を維持する。

## 9. 実装・検証結果

- `styles/components/animation-table-playback.css`と`verify-animation-table-playback-priority.mjs`だけを変更した。DOM、button ID、event、ARIA、model、History、save、wheel、dragは変更していない。
- Browserの約1100px wide / 700px narrowで、専用play行が消え、主playが第一行中央付近、secondary controlが右側に収まり、overflow / control重なりなしを確認した。
- Play / Stop、Loop OFF / ON、Range deck、SCOPE deck、PREVIEW OFF / ON、Onion 0→4→0、header wheel zoom 147%→120%→147%、header空白drag往復、close / reopenを実操作した。console error / warningは0件だった。
- 変更JSの`node --check`、全104 `build/verify-*.mjs`、`npm.cmd run build`、`git diff --check`を通過した。build生成差分は追跡済みbaselineを復元し、生成asset 5件だけを削除した。
- SOL final review=`A`。Owner制作環境のwide / narrow / coarse / pen / touch確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離する。
