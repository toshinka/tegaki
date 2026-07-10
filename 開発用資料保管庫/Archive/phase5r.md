# Phase 5r - Lane visibilityとTable閉状態のTimeline onion

## 目的

Animation Tableの表示操作を、保存対象のLane visibilityとdisplay-only onionへ明確に分ける。

1. 各Laneへeye iconを追加し、Lane単位で表示・非表示を切り替える。
2. Table閉状態で、既存Lane onionの隣からTimeline onionを操作できるようにする。
3. Phase 5qで安定したstroke中preview container契約、Lane順、PSD順を維持する。

## 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `task-codex/phase5r.md`
5. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
6. `tegaki_work/PHASE4Z_BOUNDARY.md`
7. `開発用資料保管庫/Archive/PHASE5Q_PREVIEW_ORDER_NOTES.md`
8. `tegaki_work/system/animation/animation-data-model.js`
9. `tegaki_work/ui/animation-table-popup.js`
10. `tegaki_work/ui/timeline-ui.js`
11. `tegaki_work/system/animation/timeline-frame-compositor.js`
12. animation exportからframe compositorを呼ぶ各exporter

## Slice 1 - Lane visibility監査

- 現行 `includedLaneIds` はPlayback Scope用であり、visibilityへ流用しない。
- `LaneModel` のserialize / deserialize、Timeline frame tree、preview、playback、exportのLane filterを列挙する。
- `visible` の既定値はtrue。旧projectにfieldがなくても全Lane表示とする。
- Lane visibilityはproject保存対象。CAF internal Layerの `visible` は変更しない。
- eye操作をTimeline構造Historyへ含めるか、既存visibility操作の契約と照合して決める。

## Slice 2 - Lane eye UIと合成接続

- Lane名の近くへ既存eye iconの小型buttonを置く。
- 非表示LaneはTable preview、closed-table reference、playback、GIF/APNG/PNG等のanimation frame compositorから除外する。
- 編集中Laneを隠しても自動でCAF内部Layer visibilityを書き換えない。
- PREVIEW、Timeline onion、Lane onion、Playback Scopeを切り替えてもLane visibilityを上書きしない。
- Lane上側が前面というPhase 5qの順序を維持する。

## Slice 3 - Table閉状態のTimeline onion

- `timeline-ui.js` の既存Lane onion buttonの隣へTimeline onion buttonを追加する。
- 共有 `UI_ICONS.onionSkin` を使い、buttonの形とサイズを揃える。
- Lane onionはふたば系、Timeline onionは落ち着いた橙系。ON/OFFは背景とborderの既存CSS変数で表現する。
- countは0から4を循環し、前後同数を表示する。
- ghost本体は前Frameを暖色、後Frameを青系にし、Lane onionの単色参照と区別する。
- Table open中のTimeline onionと同じstate / rendererを使い、Table open-closeで二重描画しない。
- display-onlyのため、History、保存画像、export、Layer/Lane visibility正本へ混ぜない。

## 後続調査のみ

- Ctrl+clickによるCAF複数選択と一括移動。
- 空白領域dragによるmarquee選択。
- CAF group / folder。ClipAsset internal Folderとは別モデルとして検討する。

これらはPhase 5rの最初の実装へ混ぜない。Lane visibilityとclosed Timeline onionを安定させてから、独立Phaseへ切り出す。

## 非目標

- Phase 5qのpreview container再構成。
- Lane順、PSD record順の再変更。
- Lane完全独立化、working Layer廃止、LayerSystem / TimelineModel統合。
- ClipInstance transform / keyframe。
- WebGPU、SDF/MSDF、WebGL2 Mesh、DPR 2倍化、tiled canvas。

## 検証

- 変更JSの `node --check`。
- `npm.cmd run build`。
- 通常描画、CAF描画、stroke中表示安定、Lane 1/2/3順。
- Lane eye ON/OFF、project保存復元、Undo/Redo契約。
- PREVIEW ON/OFF、Animation Table open/close、Lane onion、Timeline onion 0-4。
- playbackとanimation exportで非表示Laneだけが除外され、onionは混入しない。
- PSD export順が変わらない。
- console errorなし。
- build後に `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
