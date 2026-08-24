# Phase 9a — Animation Table Playback Priority Hierarchy

作成日: 2026-08-24

状態: COMPLETE — Gate 1=`GO — D1`、Stage B / C、SOL final review=`A`（Archive正本）

## 1. 目的

Phase 8l〜8zで整えたrestrained-depth、progressive exposure、canonical shortcut learningを踏まえ、Animation Table headerの視覚優先度を実使用頻度へ合わせる。再生 / 停止を主actionとして中央へ固定し、RANGE終端sourceをSetup青から通常surfaceへ戻し、IN / OUTを未設定時も読める淡い独立panelとして整理する。GUI全体、Text、Mesh / Weight、保存・History・再生正本へは広げない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase8z.md`
7. `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
8. `開発用資料保管庫/proposals/00_計画索引.md`
9. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
10. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
11. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
12. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
13. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`

## 3. Stage A比較結果

| 候補 | 判定 | 理由 |
|---|---|---|
| A. QTP外component-local command発見性 | HOLD | Phase 8z直後であり、OwnerからAnimation Tableの具体的な頻度・配色・配置再現が届いたため後順位 |
| B. Text vertical / local font | HOLD | 制作価値は高いがfont権限 / fallbackを含む独立Phaseが必要 |
| C. Raster Mesh / Weight次段 | HOLD | Mesh topology / Weight制作詰まりはOwner台帳を維持し、本Sliceへ混ぜない |
| D1. Animation Table Playback Priority Hierarchy | GO | 再生、RANGE、IN / OUTの現行DOM・event・保存正本を維持したまま、単一surfaceの視覚階層だけを固定fixture化できる |

Gate 1=`GO — D1: Playback Priority Hierarchy`。Ownerの実使用頻度を正本とし、Stage Bを次の限定Sliceへ固定する。

## 4. Stage B実装契約

対象file:

- `tegaki_work/ui/animation-table-popup.js`
- `tegaki_work/build/phase9a-animation-table-playback-priority-fixture.html`
- `tegaki_work/build/verify-animation-table-playback-priority.mjs`
- `tegaki_work/build/verify-animation-table-playback-range-inline.mjs`

Acceptance Criteria:

1. `LAST CLIP / TIMELINE / OUT MARKER`のcurrent sourceはSetup青を使わず、ふたば系の通常control surfaceとして読める。
2. IN / OUTは未設定でも淡い独立panelと`I` / `O`だけを表示し、`I—` / `O—`にはしない。
3. 設定後は`I  F11` / `O  F13`のように文字とFrame値の間を明示的に空け、既存の設定済みsurfaceと現在Frame ringを維持する。
4. 再生 / 停止buttonはheader幅が変わっても専用の全幅slot中央へ置き、従来より大きく太い主actionとして読める。frame stepなど別actionは追加しない。
5. 既存ID、`togglePlayback()`、Playback model / save / History、Loop、Preview、Onion、Scope、wheel、Clip操作を変更しない。
6. narrow / coarse pointerでもcontrolが重ならず、I / Oと再生のhit targetが維持される。

Stage Cは実装後のread-only構造監査とし、font / surface / panel / table / windowのtokenとCSS配置、JS注入CSS、巨大classの責務境界を一覧化する。広域refactorは次Phase Gateへ分離する。

## 5. No-go

- 複数componentの同時UI変更、GUI全面再設計、保存schema追加、History authority変更。
- `animation-table-popup.js`の一括分割、全popup skin一括置換、theme保存schema新設。
- SCOPE、Preview、Onion、Zoom、DURATION、LIB、Clip actionの再配置や再設計。
- Phase 8zのlong press / help mode再導入、通常tool tap二段化、shortcut再割当。
- Text、Mesh、Animation Tableの候補を一つのPhaseへ混ぜる。
- 外部提案を実コード照合なしで実装契約へ昇格する。

## 6. model分担

- Stage A比較、正本判断、Gate 1、Phase設計: SOL / XHigh。
- Gate 1後、対象file、既存契約、Acceptance Criteria、検証、停止条件が固定された一つの実装SliceだけLUNA / MAXへ委譲できる。
- Stage Bは限定Sliceだが、Ownerの配置判断と次Phase構造Gateを連続して扱うため今回はSOLが実装・reviewする。

## 7. close条件

限定実装、関連verifier、全verifier、build、Browser実操作、生成物清掃、Stage C構造監査、文書同期、SOL final reviewを完了してからcloseする。Owner制作確認を技術closeと分離する場合は`OWNER_VERIFICATION_BACKLOG.md`へ明記する。

## 8. Stage C構造監査

- `animation-table-popup.js`は23,722行、class内method約558件で、DOM template、event / state更新、動的座標と約1,933行の注入CSSを同居させている。
- 同fileには局所hex 16件、`rgba()` 92件、`font-size` 51件、`border-radius` 41件があり、`styles/main.css`の`--ui-surface-* / --ui-border-* / --ui-shadow-* / --ui-radius-*`を使う部分と局所値が混在する。
- したがって次段はGUI全面リスキンやclass一括分割ではなく、見た目の正本・runtime動的値・event / model正本を先に所有mapへ固定する。抽出を行う場合も、今回監査済みのPlayback header静的style一群だけを候補とし、ID、class、event、保存・History、動的geometryはJSへ維持する。

## 9. 検証と最終判定

- 変更JSの`node --check`: PASS。
- 関連verifier: Playback Priority / Range Inline / Range Focus Deck / Playback Glance / Header LayoutをPASS。
- 全`build/verify-*.mjs`: 101 / 101 PASS。
- `npm.cmd run build`: PASS（Vite 8.0.16）。`util` externalizeと500kB超chunkは既知warning。
- Browser: wide / narrowで再生buttonがpanel中央、未設定I / Oが文字だけの淡いpanel、設定後`I F1 / O F1`の5px間隔、Range deckの非青surface、console error / warning 0件を確認した。
- `dist/`と`node_modules/.vite/`の生成差分は残していない。
- SOL final review=`A`。Ownerの制作環境での視覚・pen / touch確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離し、本Phaseを技術closeする。
