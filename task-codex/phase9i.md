# Phase 9i — Sidebar Action Semantics / Close Sync Gate

作成日: 2026-08-24

状態: ACTIVE — Gate 0 GO（B Role-aware semantic normalization）

## 1. 目的

Phase 9hで発見したSidebarの役割差を、見た目ではなくbehavior / accessibility境界として整理する。command、popup launcher、temporary modeを区別し、Animation Table内部close後のstale activeを既存event正本へ戻す。全入口を一律toggle扱いせず、keyboard / ARIA / popup close / shortcutの整合を固定する。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9h.md`
7. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
8. `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
9. `tegaki_work/ui/dom-builder.js`
10. `tegaki_work/ui/ui-panels.js`
11. `tegaki_work/system/popup-manager.js`
12. `tegaki_work/ui/animation-table-popup.js`
13. `tegaki_work/ui/quick-access-popup.js`
14. `tegaki_work/ui/keyboard-handler.js`
15. `tegaki_work/styles/components/sidebar-rail.css`

## 3. Stage A / Gate 0

read-onlyで次を固定する。

1. 8入口を`one-shot command / popup launcher / temporary mode`へ分類する。
2. click、shortcut、内部close、outside close、Escape、PopupManager `show / hide / hideAll`、各instance直`show / hide`を一覧化する。
3. `.active / .is-active / aria-pressed / aria-expanded / focus`の現行送受信と、Q / V / A / Settingsの不一致を固定fixtureで比較する。
4. A Minimal close sync、B Role-aware semantic normalization、C 全popupをpersistent active化、の三案を比較する。Bを第一候補、Cはcommandまでtoggle扱いになる場合`HOLD`。
5. EventBusへ新しい並行state正本を作らず、既存popup / tool stateから投影できるかを先に証明する。

### 3.1 Stage A inventory（2026-08-25）

| Sidebar入口 | role | 状態正本 | close / release投影 |
| --- | --- | --- | --- |
| Album | popup launcher | `AlbumPopup.isVisible` | `popup:shown / hidden` |
| Import | one-shot command | なし | pressed / expandedを持たない |
| Export | popup launcher | `ExportPopup.isVisible` | `popup:shown / hidden` |
| Resize | popup launcher | `ResizePopup.isVisible` | `popup:shown / hidden` |
| Q | popup launcher | `QuickAccessPopup.isVisible` | 既存`popup:shown / hidden` |
| V | temporary mode | Keyboard / Selection transform state | `aria-pressed` |
| Animation Table | popup launcher | `AnimationTablePopup.isVisible` | `popup:shown / hidden` |
| Settings | popup launcher | `SettingsPopup.isVisible` | `popup:shown / hidden` |

- click / shortcut / PopupManager経由だけでなく、各instanceの内部closeや処理後`hide()`も同じvisibility eventへ投影する。
- `hideAll`は各instanceの`hide()`を通るため、PopupManagerへ第二のopen stateを追加しない。
- outside clickで現行仕様上keepされるpopupはopen表示を維持し、実際に閉じた入口だけを解除する。

### 3.2 Gate 0判定

- A Minimal close sync: `A`のstaleだけは直るが、Q / Vの`aria-pressed`混同と他popup内部closeが残るため不採用。
- B Role-aware semantic normalization: **GO**。全入口をnative buttonへ揃え、popup launcherは`aria-expanded`、Vだけ`aria-pressed`、Importは状態属性なしとする。
- C 全popup / commandのpersistent active化: Importまでtoggle扱いになり意味を壊すため`HOLD`。
- 見た目の正本は既存`sidebar-rail.css`のままとし、本Phaseではrole / focus / visibility projectionだけを変更する。

## 4. Acceptance Criteria

- Animation Table内部×、Sidebar再click、Escape、別popup表示、`hideAll`の全close pathでAのstale activeを残さない。
- one-shot commandへ`pressed`を付けず、popup launcherはopen / closed、Vはtemporary modeとして意味が読める。
- keyboard focus / Enter / Spaceと既存pointer clickが同じactionへ到達し、shortcut Q / V / A / Sを変えない。
- tool順、icon、title、30 / 38px hit、Phase 9h static appearance、popup位置、z-index、Canvas input、History / save / modelを変更しない。
- 関連verifier、全`build/verify-*.mjs`、build、Browser wide / narrow、Q / V / A / Settings / utility、console、生成物清掃を行う。

## 5. No-go

- Sidebar toolの追加・削除・並べ替え、icon差し替え。
- popup排他規則、PopupManager全体、内部panel skinの同時再設計。
- 全commandをtoggleまたはpersistent activeへ一括統一。
- shortcut再割当、custom rail、dock、Simple / Expert二重UI。
- Project / History / Canvas / Rig / Mesh / Timeline正本への変更。

## 6. model分担

- role分類、event / close path監査、ARIA判断、Gate 0、final review / close: SOL / XHigh。
- Gate後に対象file、既存event、element role、Acceptance Criteriaが固定された一つのDOM / sync限定Sliceだけ: LUNA / MAXへ委譲可。
- PopupManager Architectureや新state正本が必要になった場合、LUNAは変更せず`BLOCKED`でSOLへ返す。
