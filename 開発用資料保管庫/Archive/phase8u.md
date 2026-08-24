# Phase 8u — Animation Table Asset Library Exposure Gate

作成日: 2026-08-22

状態: CLOSED — Gate 1=`GO — B: Asset iconのcompact直接入口`、production限定接続、全96 verifier / build / Browser、SOL final review=`A`

## 1. 目的

Phase 8tで`DURATION`をSelected Clip contextへ送った後のAnimation Table下段について、`LIB`が初心者の平常視界へ文字buttonで常設すべきかを独立評価する。Project-local ClipAsset再利用への到達性を失わず、文字露出、asset icon、anchored Advancedの三案を固定fixtureで比較する。

## 2. 正本と読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase8t.md`
6. `開発用資料保管庫/Archive/phase8o.md`
7. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
8. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
9. `tegaki_work/ui/animation-table-popup.js`

## 3. Stage A authority監査

- `#anim-assets-toggle-btn`はruntime `isAssetLibraryVisible`だけを切替え、`#anim-asset-library`を表示する入口である。新しい保存flagやSettings正本を作らない。
- Asset Library内のClipAsset、CAF複製、internal Layer管理は本Phaseの対象外。入口の露出量と到達段数だけを比較する。
- `LIB`はSelected Clip属性ではない。Phase 8tのSelected Clip Action stripへ入れず、Timeline全体 / Project-local asset contextの独立入口とする。
- gearはSettingsに見えるため、採用候補は「assetと読めるicon」または「Animation Table専用Advanced trigger」に限定する。

## 4. Gate 1で比較する案

比較fixture: `tegaki_work/build/phase8u-animation-table-asset-library-exposure-fixture.html`

### A. Current compact `LIB`

現行位置の文字buttonを維持する。到達性は最高だが、機能名を知らない初心者には略号の解読が必要。

### B. Asset iconのcompact直接入口

folder / library系の既存palette-bound SVGとtooltipで意味を表し、一操作到達は維持する。他のfolder操作と誤認しないよう、開状態とaria-labelを明示する。

### C. Animation Table専用Advanced / overflow

平常視界は最も静かだが、Asset reuseまで二段になる。Settings gearとは分離し、anchored deckの中で`ASSET LIBRARY`を全称表示できる場合だけ候補とする。

Gate 1=`GO — B`。既存共通`UI_ICONS.library`を使い、一操作到達、tooltip / aria-label、開状態を維持しながら、`LIB`略号の常設文字を減らす。CはSettingsとの誤認と二段到達を増やすため不採用。Aはiconの制作確認で意味が読めない場合のrollback案とする。

## 5. Acceptance Criteria

- `isAssetLibraryVisible`、`#anim-asset-library`、ClipAsset操作、CAF複製 / internal Layer管理の正本を変更しない。
- `LIB`はSelected Clip Action、DURATION、Settingsの保存stateと統合しない。
- 閉状態 / 開状態、Clip未選択 / 選択、wide / narrow、keyboard / mouse / coarse pointerの到達性を比較する。
- 新しいProject field、History、modal、shortcut-only入口を作らない。
- Gate前にproduction DOM / CSSを変更しない。

## 6. No-go

- Asset Library内容、ClipAsset schema、CAF複製、internal Layer管理の再設計。
- DURATION、Selected Clip Action、Playback / SCOPE、QTPを同時に移動すること。
- Animation Table header全面再構築、常設Inspector、Simple / Expert二重UI。
- Backup / PastFiles / `開発用資料保管庫/Backup-tegaki_work/`の調査・編集。

## 7. Production実装

- `#anim-assets-toggle-btn`の文字`LIB`を既存共通`UI_ICONS.library`へ置き換え、一操作の直接入口を維持した。
- 開閉正本は従来どおりruntime `isAssetLibraryVisible`とし、既存click handler、`#anim-asset-library`、`_renderAssetLibrary()`を変更していない。
- `aria-label="Asset Library"`、`aria-controls`、`aria-expanded`、開閉別titleを同じstateから投影した。
- DURATION / Selected Clip Action、Asset Library内容、ClipAsset schema、Historyは変更していない。

## 8. 検証 / Close

- `node --check ui/animation-table-popup.js`、Asset Library Exposure / Duration Context / header verifierを通過した。
- 全`build/verify-*.mjs`は96件通過した。
- `npm.cmd run build`はVite 8.0.16 / PixiJS 8.19.0で成功した。既知の`util` externalizeとchunk size warningのみ。
- Browserでicon表示、一操作開閉、`aria-expanded`、開状態のTable close / reopen復帰、Duration context独立、701px narrow、console error / warning 0件を確認した。
- SOL final review=`A`で2026-08-22に技術closeする。Owner制作確認は`OWNER_VERIFICATION_BACKLOG.md`へ分離し、問題時は本Phaseを暗黙に再OPENせずAsset Library Exposure限定bug fixを立てる。

## 9. model分担

Asset reuseの導線、初心者の情報深度、gear / icon / deckの意味はArchitecture判断のためSOL / XHighがGate選定とcloseを担当し、限定実装まで完了した。次Phase 8vはQTP位置Presetと既存自由drag / localStorage x-yの境界を決めるArchitecture GateのためSOL / XHighが開始する。Gate後、既存`quick-access-position`への座標確定だけに固定できた一SliceはLUNA / MAXへ委譲可能。
