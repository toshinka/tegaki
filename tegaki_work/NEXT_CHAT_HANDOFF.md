# Tegaki 次チャット引き継ぎ

作成日: 2026-08-24

状態: Phase 9hまでSOL final review=`A`で技術close。Phase 9i Sidebar Action Semantics / Close Sync GateはStage A inventory前。Owner制作確認は別台帳で継続。

## 1. 最初に読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `task-codex/phase9i.md`
6. `開発用資料保管庫/Archive/phase9h.md`
7. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
8. `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
9. `開発用資料保管庫/proposals/00_計画索引.md`
10. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
11. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
12. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
13. `tegaki_work/ui/dom-builder.js`
14. `tegaki_work/ui/ui-panels.js`
15. `tegaki_work/system/popup-manager.js`
16. `tegaki_work/ui/animation-table-popup.js`
17. `tegaki_work/styles/components/sidebar-rail.css`

## 2. 作業開始時の確認

```powershell
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
```

- 表示されるPhase 6z〜9hの実装、verifier、fixture、文書、proposal、Archiveは意図的な既存差分。すべて維持する。
- `restore` / `reset` / `checkout`で既存成果を巻き戻さない。
- `Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。
- proposal内の「過去計画」は現行正本で不足した情報の救出時だけ参照する。
- `.git/index.lock`は存在とstaleを確認してから必要時だけ削除してよい。
- `dist/`と`node_modules/.vite/`は追跡済み基準を持つ。build生成差分だけを限定清掃する。

## 3. 現在地

- Phase 9a〜9fでAnimation TableのPlayback priority、UI Design Authority、Warm Canvas-first、第一header rowのcompact play、quiet restingを段階整理した。
- Phase 9gはQTP Palette / tool / preset cellだけをGate 0=`GO — B: Borderless Resting＋Selected Ring`へ整理し、全106 verifier / build / Browser、SOL final review=`A`で技術closeした。
- Phase 9hはSidebar rail一componentをA Current / B Quiet Resting＋Hover Surface＋Active Ring / C Color Bar Onlyで比較し、Gate 0=`GO — B`とした。
- `styles/components/sidebar-rail.css`をstatic appearance正本として追加し、resting borderをtransparent、hover / focus / active / disabledをsemantic surfaceへした。`main.css`にはrail geometryとnormal 30px / coarse 38px hitを維持し、`ui-panels.js`の旧static style注入を除去した。
- tool順、icon、DOM、event、shortcut、Canvas input、History / save / modelは変更していない。全107 verifier、build、Browser 1280×720 / 700×720、Q / V activeと解除、Animation / Settings開閉、console error 0件を通過し、SOL final review=`A`でcloseした。
- Stage Aで、Animation Table内部×から閉じるとAの`.active`が残る既存差を再現した。またQ / Vだけがbutton＋ARIA、Album / Import / Export / Resize / A / Settingsはgeneric elementである。Phase 9hのNo-goに従いCSSで隠さず、Phase 9iへ分離した。

## 4. 次チャットの最初のtask

Phase 9i Stage Aをread-onlyで進める。

1. 8入口を`one-shot command / popup launcher / temporary mode`へ分類する。
2. Sidebar click、shortcut、内部×、outside、Escape、PopupManager `hide / hideAll`、instance直`hide()`の全close pathを一覧化する。
3. `.active / .is-active / aria-pressed / aria-expanded / focus`の送受信を固定fixtureへ投影する。
4. A Minimal close sync、B Role-aware semantic normalization、C 全popup persistent activeを比較する。Bを第一候補、Cはcommandをtoggle扱いするなら`HOLD`。
5. Stage Aではproductionを変更しない。tool順、icon、shortcut、popup排他、内部skin、Project / History / Canvasへ広げない。

## 5. model分担

- Phase 9i Stage A inventory、event / role / ARIA判断、Gate 0、closeはSOL / XHigh。
- Gate後に対象file、element role、既存event、Acceptance Criteriaが一つへ固定された限定DOM / sync SliceだけLUNA / MAXに適する。
- PopupManager Architectureや新state正本が必要ならLUNAは変更せずSOLへ返す。

## 6. 新チャットへ貼る文面

```text
D:\GitHub\tegaki の作業を継続してください。

Phase 9hまでSOL final review=Aで技術close済みです。Owner制作確認はtegaki_work/OWNER_VERIFICATION_BACKLOG.mdへ分離し、Phase 9i Sidebar Action Semantics / Close Sync Gateを開始しています。

最初にAGENTS.md、TEGAKI.md、tegaki_work/PROGRESS.md、tegaki_work/NEXT_CHAT_HANDOFF.md、task-codex/phase9i.md、開発用資料保管庫/Archive/phase9h.md、tegaki_work/UI_DESIGN_AUTHORITY_MAP.mdを順に読んでください。

次を最初に確認し、既存変更をすべて維持してください。
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive

Backup/、PastFiles/、開発用資料保管庫/Backup-tegaki_work/は調査・編集しないでください。restore、reset、checkoutで既存差分を巻き戻さないでください。

最初の作業はPhase 9i Stage Aのread-only inventoryです。Sidebar 8入口をone-shot command / popup launcher / temporary modeへ分類し、click / shortcut / 内部close / outside / Escape / PopupManager / instance直hideの全経路と、active / pressed / expanded / focus正本を固定してください。A Minimal close sync、B Role-aware semantic normalization、C 全popup persistent activeを比較し、Gate 0前にproductionを変更しないでください。tool順、icon、shortcut、popup排他、内部skin、Project / History / Canvasへ広げないでください。Stage AとGate 0はSOL / XHigh、GO後の限定DOM / sync SliceだけLUNA / MAXに適します。
```
