# Phase 8v — QTP Position Preset Gate

作成日: 2026-08-22

状態: CLOSED — Gate 1=`GO — B: Header four-corner deck`、production限定接続、全97 verifier / build / Browser、SOL final review=`A`

## 1. 目的

QTPをPainter's PaletteとしてCanvas上の好みの位置へ置ける現行の自由dragを維持しながら、右利き / 左利き、desktop / touch、Animation Tableとの重なりをすばやく避けるPosition Presetが有効かを比較する。Preset名を第二の保存正本にせず、選択結果を既存x / yへ確定する補助に限定する。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase8l.md`
6. `開発用資料保管庫/Archive/phase8r.md`
7. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
8. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
9. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
10. `tegaki_work/ui/quick-access-popup.js`

## 3. Stage A authority監査

- 唯一の位置保存正本はlocalStorage `quick-access-position` の`{ x, y }`。`_loadPosition()`で復帰し、自由drag pointerupの`_savePosition()`で確定する。
- drag中はviewport内へclampし、保存はProject / Historyに入らない。Presetも同じclampと`_savePosition()`へ委譲する。
- Preset名、最後のPreset ID、利き手flag、QTP別layoutを新しく保存しない。選択結果はx / yとして微調整dragと完全互換にする。
- Preset入口はQTPの常時tool gridを増やさず、位置に意味があるheader / drag contextの限定補助とする。

## 4. Gate 1で比較する案

### A. Current free drag only

シンプルで自由度が最高。画面端や反対側へ大きく移す時の往復量が多い。

### B. Header anchored position choices

QTP header / drag areaの小さな入口から`TOP LEFT / TOP RIGHT / BOTTOM LEFT / BOTTOM RIGHT`を選び、現在viewportとQTP実寸からx / yを決める。選択後も自由dragで微調整できる。

### C. Drag中edge snap

追加buttonは要らないが、意図しないsnap、pen / touchでの精密配置阻害、新しいgesture thresholdを増やす。初期Sliceでは候補にしない。

比較fixture: `tegaki_work/build/phase8v-qtp-position-preset-fixture.html`

Gate 1=`GO — B`。自由dragを主操作として維持し、反対側へ大きく避ける時だけheaderの四隅deckを使う。選択結果は既存x / yへ保存し、その後の自由dragで微調整できる。Aはrollback案、Cはpen / touchの精密配置と新しいsnap thresholdが競合するため不採用。

## 5. Acceptance Criteria

- `quick-access-position` `{ x, y }`、自由drag、viewport clamp、Q close / reopenを維持する。
- Presetを採用する場合も既存x / yだけを書き、Preset IDや利き手を保存しない。
- QTPのtool / color / preset / size / opacity / Text正本、Q shortcut、History / Projectを変更しない。
- narrow / coarse pointerで画面外へ出ず、Preset後の自由dragと保存復帰が一致する。
- Gate前にproduction DOM / CSSを変更しない。

## 6. No-go

- QTP全体density、FULL / COMPACT / HIDDEN、tool並べ替え、sidebar / Animation Table layoutの同時変更。
- edge snap、Dock、自動回避、利き手判定、端末別Project設定。
- 新しいProject field、History、localStorage Preset state。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 7. model分担

QTPの身体到達性、Canvas遮蔽、dragとPresetの主従関係はArchitecture判断のためSOL / XHighがGate選定とcloseを担当する。Gate後、headerの一入口、viewportからの座標計算、既存`_savePosition()`への確定だけに固定できる一SliceはLUNA / MAXへ委譲可能。保存schema、Dock、自動回避の判断が必要になったらLUNAは変更せずSOLへ返す。

## 8. Production実装

- QTP headerへ既存palette色を継承する共通`UI_ICONS.positionCorners`の小入口を追加し、anchored deckに左上 / 右上 / 左下 / 右下の四択を置いた。
- 四隅選択はviewportとQTP実寸から12px insetの座標を求め、自由dragと共有する`_clampPanelPosition()`を通して既存`_savePosition(x, y)`へ確定する。
- 保存は従来どおりlocalStorage `quick-access-position`の`{ x, y }`だけとし、Preset ID、利き手flag、Project / Historyを追加していない。
- deckは外側pointer、Escape、QTP closeで閉じ、`aria-controls` / `aria-expanded`と開状態を同期した。
- 保存済み位置がviewport変更後に画面外となった場合は、QTP open時に同じclampへ戻してx / yを更新する。Preset後も自由dragを維持した。

## 9. 検証 / Close

- `node --check ui/quick-access-popup.js`、`node --check ui/ui-icons.js`、QTP Position / Preset Density / Text Entry / Surface Token verifierを通過した。
- 全`build/verify-*.mjs`は97件通過した。
- `npm.cmd run build`はVite 8.0.16 / PixiJS 8.19.0で成功した。既知の`util` externalizeとchunk size warningのみ。追跡済みdist基準を復元し、生成された5 fileだけを削除した。
- Browserで四隅deckの表示、右下移動、QTP close / reopen、外側pointer / Escape、Preset後の自由drag、固定fixtureのwide / narrow、console error / warning 0件を確認した。
- SOL final review=`A`で2026-08-22に技術closeする。Owner制作確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離し、問題時は本Phaseを暗黙に再OPENせずQTP Position Preset限定bug fixを立てる。
