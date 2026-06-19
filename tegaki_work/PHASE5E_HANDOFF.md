# Phase 5e 新チャット引き継ぎ

更新日: 2026-06-20

## 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE5E_HANDOFF.md`
5. `task-codex/phase5e.md`
6. `開発用資料保管庫/proposals/06_構造改善・保守性.md`
7. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`

## 現在状態

- Phase 5aからPhase 5dまで完了。
- Phase 5dは通常Raster Layerの矩形selection MVP、V変形、copy / paste、範囲内描画、Ctrl+D解除まで完了した。
- Phase 5d指示書は `開発用資料保管庫/Archive/phase5d.md` にある。
- Phase 5eは全面リファクタリングではなく、1回につき1 subsystemまたは1 component群を監査・局所修正する。
- `Backup/` と `PastFiles/` は調査・編集対象外。
- worktreeにはオーナーと過去Phaseの未commit変更がある。対象外差分を戻さない。

## Phase 5eの最初のslice

UI / CSS監査から開始する。
最初の対象は `ui/settings-popup.js` と `ui/export-popup.js` のstatic inline style、palette、form / status表示とする。

理由:

- static inline styleとpalette外色が実在し、監査対象が明確。
- popup stackingとoverlay mountはPhase 5bで修正済みなので、mount構造を作り直さず見た目の責務だけを整理できる。
- EventBusやglobalの全体監査より回帰範囲を限定しやすい。

最初に行うこと:

1. `git status --short --untracked-files=all` で既存差分を確認する。
2. `styles/main.css` のpopup、button、form、status、scrollbar共通定義を検索する。
3. 対象2 componentのstatic inline styleと直書き色を一覧化する。
4. 動的位置・進捗率・show / hideはJSに残し、色・固定寸法・font・margin等だけCSS classへ移す。
5. 1 componentずつbuildとブラウザ回帰を行う。

## 壊してはいけない境界

- popupのoverlay root mountと最前面表示。
- popup drag、close、preview、download、Settings tab切替。
- Futaba paletteと既存CSS変数。
- Layer Panel / CAFの共有UI境界。
- 通常LayerとCAFのdata正本、History復元先。
- Phase 5dのselection、V変形、Undo / Redo。

## 禁止する拡張

- 全popupのBasePopup化。
- 全inline styleの一括置換。
- CSS classの一括rename。
- EventBus全件定数化。
- `window.*` 全廃。
- LayerSystem / TimelineModel統合。

## 検証

```powershell
node --check <変更したJSファイル>
Set-Location tegaki_work
npm.cmd run build
git status --short --untracked-files=all
```

build後は `tegaki_work/dist/` の生成差分を残さない。

ブラウザではSettingsの全tab、History form、scroll、closeと、Exportのformat切替、preview、download、status、progress、drag、closeを確認する。
