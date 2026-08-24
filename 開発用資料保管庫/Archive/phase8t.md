# Phase 8t — Animation Table Advanced / Contextual Controls Gate

作成日: 2026-08-22

状態: CLOSED — Gate 1=`GO — B: DURATIONだけをSelected Clip contextへ`、production限定接続、全95 verifier / build / Browser、SOL final review=`A`

## 1. 目的

Animation Table下段headerの`DURATION`と`LIB`について、初心者の平常視界へ常設する必要性と、選択Clip / advanced contextへ退避した場合の到達性を比較する。二機能はauthorityが異なるため、同時に移動せず、固定fixtureで優先Sliceを選ぶ。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase8o.md`
6. `開発用資料保管庫/Archive/phase8s.md`
7. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
8. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
9. `tegaki_work/ui/animation-table-popup.js`

## 3. Stage A authority監査

### DURATION

- 常設`#anim-duration-dec / #anim-duration-inc`は選択Clipだけを対象に`_adjustSelectedCelDuration()`へ接続する。
- mutationは既存right-edge retimeの`_applyRetimingWithPush()`、Timeline History `caf-clip-duration`、terminal key retimeを使う。Grouped Clipでは拒否する。
- Timeline Clipには既存`.anim-cel-resize-grip`とright-edge retime gestureがあり、Duration 1でも明示gripを表示する。常設buttonを退避する前にmouse / pen / touchの発見性、1 Frame Clip、隣接Clip push、narrowを比較する。

### LIB

- `#anim-assets-toggle-btn`はruntime `isAssetLibraryVisible`だけを切替え、`#anim-asset-library`を表示して既存Project-local ClipAsset操作へ入る。
- `LIB`はselected Clipの属性ではなくAsset reuse / internal Layer管理の入口であり、DURATIONと同じcontext actionへまとめない。
- gear / overflow / Settingsへ送る案は、Asset reuse、CAF複製、close / reopen復帰の到達段数を増やす。利用頻度を推測だけで決めず、常設compact、gear / overflow、asset使用時だけcontextualの三案を比較する。

## 4. Gate 1で比較する案

比較fixture: `tegaki_work/build/phase8t-animation-table-advanced-controls-fixture.html`

### A. Current

下段に`Timeline zoom / LIB / DURATION / Motion / selected Clip actions`を常設する。全機能が一目だが、未選択時も高度機能名が露出する。

### B. DURATIONをSelected Clip contextへ統合

Clip選択時だけPhase 8oのContext Action stripへ長さ値と増減を投影する。Clip edge dragを第一導線としつつ、coarse pointer / 1 Frame Clip用の精密操作を失わない。`LIB`は独立維持する。

### C. LIBをAdvanced / overflowへ退避

`LIB`をgear / overflowへ移し、DURATIONは現状維持する。Project-local Asset reuseを隠し過ぎる可能性があるため、Bと同時実装しない。

Gate 1=`GO — B`。DURATIONだけをSelected Clip contextへ投影する限定Sliceを先行し、LIBは現状維持する。Clip edge dragを第一導線、選択時の±を精密・coarse pointer用fallbackとする。CはAsset reuseがSettings機能に見え、到達段数も増えるため、Bの制作確認後に独立比較する。

## 5. Acceptance Criteria

- DURATIONは既存right-edge retime、History、terminal key、隣接Clip push、Group拒否を維持する。
- LIBは`isAssetLibraryVisible`と既存Asset Library DOM / handler、ClipAsset正本を維持する。
- 未選択 / 単一選択 / 複数選択 / grouped、wide / narrow、mouse / pen / touchの到達性を比較する。
- `DURATION`と`LIB`を一つの保存flag、modal、shortcut-only入口へまとめない。
- Gate前にproduction DOM / CSSを変更しない。

## 6. No-go

- Clip retime algorithm、Timeline History、ClipAsset schema、Asset Library内容の再設計。
- DURATION / LIBの同時移動、Animation Table header全面再構築。
- long pressを唯一の入口にすること。Clip move / retimeとのgesture競合を増やさない。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 7. Production実装

- 常設`DURATION:`群を撤去し、Phase 8oのSelected Clip Action strip内へ`- / <n>F / +`を投影した。
- `#anim-duration-dec / #anim-duration-inc`と既存handlerは維持し、`_applyRetimingWithPush()`、`caf-clip-duration` History、terminal key、隣接Clip pushの正本は変更していない。
- Duration精密操作は単一かつ非Grouped Clip選択時だけ表示する。未選択、複数選択、Groupedでは退避し、Clip edge dragを第一導線とする。
- `LIB`は既存位置と`isAssetLibraryVisible`、Asset Library DOM / handlerを維持した。

## 8. 検証 / Close

- `node --check ui/animation-table-popup.js`、Duration context / Selected Clip Action / header verifierを通過した。
- 全`build/verify-*.mjs`は95件通過した。
- `npm.cmd run build`はVite 8.0.16 / PixiJS 8.19.0で成功した。既知の`util` externalizeとchunk size warningのみ。
- Browserで単一Clipの`1F`投影、`+` 2F / `-` 1F復元、未選択退避、LIB独立開閉、701px narrow横overflowなし、console error / warning 0件を確認した。
- SOL final review=`A`で2026-08-22に技術closeする。Owner制作確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離し、問題時は本Phaseを暗黙に再OPENせずDuration Context限定bug fixを立てる。

## 9. 次の作業 / model分担

SOL / XHighが既存gesture、History、Asset Library導線を監査し、wide / narrow固定fixtureでA / B / Cを比較してBを選定、限定実装とfinal review=`A`まで完了した。次Phase 8uは残した`LIB`だけの常設compact / asset icon / anchored Advancedを比較するArchitecture Gateとし、Asset Library内容、ClipAsset schema、Historyは変えない。Gate選定はSOL / XHigh、DOM / CSSと既存toggle projectionのみに固定できた後の一SliceはLUNA / MAXへ委譲可能。
