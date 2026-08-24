# Phase 8z — QTP Touch Shortcut Help Reachability Gate

作成日: 2026-08-24

状態: CLOSED — SOL final review=`A`、Owner制作確認は台帳へ分離

## 1. 目的

Phase 8x / 8yでcanonical化したQTPの7 tool shortcut説明を、hoverを持たないtouchからも通常tapを二段化せず確認できる入口へ接続する。shortcut実行正本、QTP tool切替、Canvas gesture、保存stateを増やさず、説明の到達性だけを扱う。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase8y.md`
6. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
7. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
8. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
9. `tegaki_work/config.js`
10. `tegaki_work/ui/quick-access-popup.js`
11. `tegaki_work/styles/main.css`
12. `tegaki_work/build/phase8z-touch-shortcut-help-fixture.html`
13. `tegaki_work/build/verify-touch-shortcut-help-gate.mjs`

## 3. Stage A audit

### 現行契約

- QTP toolは`_bindPointerAction()`が`pointerdown`で即時実行する。一tapの応答とpen操作を維持する必要がある。
- Phase 8yの`.ui-help-tooltip`はhover / `focus-visible`で表示し、touch専用gestureを持たない。
- Settingsのshortcut tabは全global actionをcanonical projectionするが、QTPから離れた入口である。
- QTP headerは自由drag、Position deck、closeを持つ。新入口はdrag surfaceと競合せず、既存Popup stackを増やさないこと。

### 比較

| 案 | 判定 | 理由 |
|---|---|---|
| A. Settingsだけをtouch fallbackとする | HOLD | 正本一致はするが、QTP操作位置から遠く発見性が不足する。 |
| B. tool button長押しで説明する | REJECT | 現行`pointerdown`即時実行と競合する。実行前待機は通常tapの遅延、実行後表示は意図しないtool変更を生む。 |
| C. QTP headerの明示`?`からread-only deckを開く | GO | 通常tool tapを一操作のまま保ち、touch / pen / keyboard共通で7 shortcutを比較できる。runtime開閉だけで成立する。 |
| D. `?`後に各toolをtapするhelp mode | HOLD | 操作位置との対応は強いが、一時modeと終了規則を覚える負担がCより大きい。 |

Gate 1=`GO — C: 明示read-only shortcut deck`

## 4. Stage B限定Slice

- QTP headerへcompactな`?` buttonを一つ追加し、同一panel内のanchored read-only deckを開閉する。
- deckはPhase 8yと同じ`QA_SHORTCUT_ACTIONS`と`TEGAKI_KEYMAP.getShortcutDescriptor()`から7行を生成する。別のshortcut文字列を持たない。
- 行はtool説明とkeyだけを表示し、command実行、tool切替、検索、再割当を行わない。
- `aria-expanded` / `aria-controls`、Escape、outside pointer、再click、QTP close / destroyで閉じる。通常tool buttonのpointerdownは変更しない。
- 平常tool面のkey非表示、hover / focus tooltip、Position deck、QTP drag / close、Preset / Text / Colorの順序を維持する。
- deck openはruntimeだけとし、localStorage / Project / Historyへ保存しない。

## 5. Acceptance Criteria

- mouse / pen / touch / keyboardの明示`?`から7 shortcutへ到達できる。
- Pen / Eraser / Airbrush / Fill / Lasso Fill / Rect Selection / Eyedropperの通常tapは従来どおりpointerdown一操作で切り替わる。
- deck表示中もCanvas描画、QTP drag、Position deck、close / reopenを破壊しない。Position deckとshortcut deckは同時openにしない。
- key / descriptionはcanonical descriptorと一致し、unknown actionは表示しない。
- shortcut handler、割当、Settings tab、Canvas gesture、Project / History / saveを変更しない。
- 変更JSの`node --check`、関連verifier、全`build/verify-*.mjs`、build、Browser wide / narrow / coarse相当、console errorを確認する。
- build生成物は追跡済み基準へ戻し、生成hashだけを限定清掃する。

## 6. No-go / 停止条件

- long press、通常tap遅延、tool button二段化、help mode、global command palette、shortcut再割当。
- QTP外component、Animation Table、RIG / WARP、Settings再構成へ同時展開しない。
- 新しいPopup class、保存field、History entry、Canvas pointer listenerを作らない。
- header幅、Position deck、drag authorityと両立できない場合はproductionへ進まずSOLへ返す。

## 7. model分担

Stage Aの比較とGate判定はSOL / XHighで完了した。Stage Bは対象file、表示正本、開閉契約、Acceptance Criteriaが固定済みの限定SliceなのでLUNA / MAXに適する。採用前の全diff、verifier / build、Browser、生成物、文書同期、closeはSOL / XHighが担当する。

## 8. Stage B実施結果（LUNA）

- `quick-access-popup.js`のheaderへcompactな`?` buttonと同一panel内のread-only deckを追加した。
- 7行は`QA_SHORTCUT_ACTIONS`と`TEGAKI_KEYMAP.getShortcutDescriptor()`から生成し、説明・keyの別正本を作っていない。行は`div`のみで、tool切替やcommand実行を持たない。
- `aria-expanded` / `aria-controls` / `aria-haspopup="dialog"`、Escape、outside pointer、再click、QTP hide / destroyを接続した。Position deckを開くとshortcut deckを閉じる。
- 既存`.ui-help-tooltip`、通常toolの`pointerdown`、QTP drag、Position / Preset / Text / Color、Project / History / saveは変更していない。
- `verify-touch-shortcut-help-gate.mjs`へcanonical 7行、開閉lifecycle、read-only、非保存を追加固定した。
- SOL reviewでcompact QTP幅に連動してdeckが約74pxまで縮むことを実寸検出し、198px基準でviewport内へclampする配置へ補正した。QTP drag開始 / window resize時は一時deckを閉じる。
- coarse pointerでは`?`を24×24pxへ拡張し、deck内部のpointer移動をQTP panel dragへ渡さない境界を追加した。

## 9. 検証結果・停止点

- `node --check`（変更JS / mjs）: PASS。
- 関連verifier、全`build/verify-*.mjs`: 100 / 100 PASS。
- `npm.cmd run build`: PASS。
- Browser: QTP open → `?` deck、7行のI / P / E / B / G / L / M、198px幅で全label非clip、左端 / 右端viewport clamp、Position deckとの排他、outside pointer、Escapeとfocus復帰、QTP close / reopen、deck close後のEraser切替を確認。console error / warningは0件。
- GitHubURL verifier: HTTPS 292 / Raw 285、duplicates 0、local missing 0。
- build生成差分は追跡済み`dist` / `node_modules/.vite`を基準へ戻し、生成hashだけを限定削除。`index.lock`なし。
- SOL final review: `A`。通常toolの`pointerdown`、shortcut実行正本、Settings、Canvas gesture、Project / History / saveへ変更がないことを再監査し、Phase 8zを技術closeする。Ownerのwide / narrow / coarse、pen / touch制作確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離した。
