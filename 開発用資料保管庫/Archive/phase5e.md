# Phase 5e — 構造改善・UIスタイル整合監査

更新日: 2026-06-20

完了: 2026-06-20

## 開始slice（2026-06-20）

最初は `ui/settings-popup.js` と `ui/export-popup.js` のUI / CSS監査へ限定する。

- static inline style、palette外色、form / status / scrollbarを棚卸しする。
- 動的位置、進捗率、show / hideはJSに残す。
- 固定装飾だけを既存CSS変数と共通classへ移す。
- popup mount、drag、close、preview、downloadの構造は変更しない。
- 詳細な入口は `tegaki_work/PHASE5E_HANDOFF.md` を参照する。

## 位置づけ

Phase 5c / 5dの機能実装を止める全面リファクタリングではない。
不具合修正や機能追加で触る境界を中心に、技術負債を小分けで監査・修正する独立Phaseとする。

## 目的

- EventBus、global、History、popup、UI/CSSの実契約を文書とコードで一致させる。
- palette違反とstatic inline styleを減らす。
- 未使用を証明できた旧経路だけを削除する。
- 将来の抽象化は、Phase 5c / 5dで確認された具体的重複へ限定する。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `開発用資料保管庫/proposals/06_構造改善・保守性.md`
5. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
6. 今回監査するsubsystemの実装

## Task 1 — 監査対象を限定

1回の作業対象を次のいずれか1つへ限定する。

- EventBusの1 namespace。
- popupの1 component群。
- Layer Panel / CAFの1共通部品。
- History commandの1分類。
- transform / selection / drawing targetの1境界。

全project一括置換を行わない。

## Task 2 — EventBus契約監査

- emit元、listener、payload、ownerを一覧化する。
- event名literalと定数の混在は、変更対象eventだけ整理する。
- listener無しemit、emit無しlistenerは両側を検索する。
- 旧animation eventは現行listenerが残るため、未使用確認なしに削除しない。
- payloadを変更する場合は送受信側を同一作業で更新する。

## Task 3 — global依存監査

- `window.*` 登録、import参照、初期化順を確認する。
- 互換性、循環依存回避、console診断のどれに使われるか分類する。
- importへ安全に置換でき、参照0件を確認できたものだけ削減する。
- globalの一括禁止・一括削除は行わない。

## Task 4 — UI / CSS監査

- palette外の文字、form control、disabled色を修正する。
- 色・border・固定寸法等のstatic inline styleをclassへ移す。
- 動的座標、viewport計算、D&D shiftはJSに残してよい。
- popupはoverlay mount helperの適用とstacking contextを確認する。
- 稼働中classの名称だけを理由に一括renameしない。

## Task 5 — History command契約監査

現行 `{ name, do, undo, byteSize?, meta? }` を基準とする。

- Raster / Model / Structureでnameとmetaを揃える。
- 大きいTypedArrayを保持するcommandへbyteSizeを付ける。
- Undo時に対象Layer / CAF / Frame / selection contextが復帰するか確認する。
- 抽象 `HistoryCommand` classは、現行object契約で解決できない問題が確認された場合だけ提案する。

## Task 6 — 描画target・transform境界監査

Phase 5c / 5dの結果を受けて確認する。

- Layer全体変形とselection変形の数学・preview・bake・History重複。
- 通常LayerとCAF internal Layerのtarget解決重複。
- animation working Layer adapterで維持できる範囲。

`IDrawingTarget` 等の抽象化は、重複する実APIを列挙し、既存adapterより小さくなる場合だけ導入候補とする。

## 対象外

- EventBus全件定数化。
- `window.*` 全廃。
- BasePopup全面導入。
- CSS class全件rename。
- LayerSystem / TimelineModel統合。
- History class階層への全面移行。
- 機能追加を止める長期リファクタリング。

## 受け入れ条件

- 対象subsystemの契約が実コードと一致する。
- 推測で旧経路を削除していない。
- palette、form control、disabledを含むUI色がスタイルガイドへ適合する。
- 新規抽象化を入れた場合、削減した重複と回帰範囲を説明できる。
- 通常描画、CAF描画、Undo/Redo、関連popupの回帰がない。
- `npm.cmd run build` が成功する。

## 文書更新

- 実装結果は `tegaki_work/PROGRESS.md` へ短く記録する。
- 新しい恒久規約が生じた場合だけ `UI_CSSスタイルガイド.md` を更新する。
- 個別class名を追加するだけの変更では辞典更新を必須にしない。
