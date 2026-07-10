# Phase 5s 完了記録 - Animation Table 基本操作

完了日: 2026-07-10

## 実装

- viewportは既存の一経路を正本として維持した。wheel、Shift+wheel、Ctrl+wheel、Space drag、Shift+Space dragを別経路として重ねていない。
- Lane順変更をTimeline Historyの1操作として実装した。上側LaneがCanvas前面となるモデル順を維持する。
- Lane順変更は `reorderLaneTo()` に一束化した。▲▼buttonとドラッグ＆ドロップは同じ保存、History、preview cache無効化、render、Layer Panel同期を通る。
- Lane名部分をドラッグして、任意のLaneの上または下へ移動できる。複数Laneをまたぐ移動を含む。▲▼buttonはkeyboard/明示操作のfallbackとして残した。
- Frame headerへモデルFPS連動の秒境界を補助表示した。Frame番号は1始まり、秒は時間原点を示す0始まりのため、`0s`, `1s` を各境界cellの左下に置いた。

## 検証

- `node --check ui/animation-table-popup.js`
- Browser: FPS 8の `0s`, `1s` 境界、Lane 1/2/3追加、Lane 3をLane 1の上へドラッグ、Ctrl+ZでLane 1/2/3へ復帰、console errorなし。
- `npm.cmd run build` 後、`tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。

## 維持した境界

- Phase 5q/5rのpreview staging、container順、上側Lane前面、PSD record順を変更しない。
- Lane visibility、Playback Scope、Lane onion、Timeline onionはそれぞれの既存state境界を維持する。
- Timeline onionはdisplay-onlyのまま、History、保存画像、exportへ混ぜない。
