# Phase 5m — ペン入力点・筆圧・補間品質の固定計測と改善

更新日: 2026-06-27

## 目的

Phase 5lで大容量CAFの保存導線をAlbum内保管から外部Project保存へ寄せ、通常描画中のAlbum payload負荷を下げた。
次は、描き味に直接影響する入力点、筆圧、補間、preview/final stroke一致を固定入力で点検し、現行PixiJS RenderTexture焼き込み経路のまま改善する。

外部調査メモ `開発用資料保管庫/proposals/tegaki_pen_quality_research_2026-06-27.txt` は参考資料とする。ただし、実装判断は必ず現行file/class/eventに照合して決める。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE5M_HANDOFF.md`
5. `task-codex/phase5m.md`
6. `開発用資料保管庫/proposals/tegaki_pen_quality_research_2026-06-27.txt`
7. `tegaki_work/system/drawing/pointer-handler.js`
8. `tegaki_work/system/drawing/drawing-engine.js`
9. `tegaki_work/system/drawing/brush-core.js`
10. `tegaki_work/system/drawing/stroke-recorder.js`
11. `tegaki_work/system/drawing/pressure-handler.js`
12. `tegaki_work/system/drawing/stroke-renderer.js`
13. `tegaki_work/system/drawing/curve-interpolator.js`

## 対象

- PointerEvent入力からStrokeRecorderへ渡る点列品質を確認する。
- `getCoalescedEvents()` が利用できる場合に、速筆時の点不足へ効くかを固定入力で測る。
- 筆圧補正、距離filter、補間点生成、preview/final描画の一致を確認する。
- 現行のpen / eraser / airbrush / blur / CAF working Layerで、入力点改善が破綻しない範囲を決める。
- 必要な実装は、まずdebug限定の計測・比較入口から入る。

## やらないこと

- WebGPU有効化。
- SDF/MSDF、WebGL2 Mesh、GPU Brush Labの本体接続。
- Canvas2Dを本番stroke描画へ混入すること。
- DPR 2倍化、内部2倍RenderTexture、出力サイズと作業サイズの不一致。
- perfect-freehandの既定値へ大きく戻すこと。
- 非破壊stroke保存形式、Project保存形式、History形式の全面変更。
- LayerSystem / TimelineModel / CAF Historyの再構成。

## Slice 1 — 固定計測と入力点profile

最初のsliceは実装より計測を優先する。

確認するもの:

- PointerEvent 1件ごとの `pressure`, `pointerType`, client座標、local座標。
- `getCoalescedEvents()` の有無、coalesced件数、座標/筆圧の分布。
- `pointerrawupdate` と通常 `pointermove` の差は、イベント接続前に現行handler境界を確認してから判断する。
- StrokeRecorder投入後の点数、距離、筆圧差分、補間後点数。
- preview焼き込みとfinal strokeの見た目差。

固定入力:

- 400x400、pen 4px / 12px、筆圧ON/OFF。
- 低速の短い入り抜き、速筆の斜線、円、ジグザグ。
- eraser 12px、airbrush default、CAF working Layer上のpen。
- mouse入力では筆圧なしの既存挙動を維持する。

受け入れ:

- debug無効時のconsole出力を増やさない。
- 計測APIを残す場合は `TEGAKI_CONFIG.debug === true` 配下に限定する。
- 入力点profileで、coalesced eventsを使う価値と副作用を説明できる。
- 変更を入れる場合、pen / eraser / airbrush / CAF working Layerの描画、Undo/Redo、保存復元に回帰を出さない。

## Slice 2候補 — coalesced event取り込み

Slice 1で有効と判断できた場合だけ実装する。

- PointerHandlerまたはDrawingEngineの既存責務を崩さず、pointermove内でcoalesced eventsを正規化する。
- 既存の座標変換、selection入力抑止、CAF working Layer routing、pressure補正を二重適用しない。
- coalesced eventsが無い環境では現行挙動へfallbackする。
- 点数増加でairbrush/blurが過剰に重くなる場合は、tool別に適用範囲を限定する。

## Slice 3候補 — StrokeQualityFilter

Slice 1-2の結果次第で、stroke-recorderとstroke-rendererの間へ軽量filterを追加する。

- 筆圧の小刻みな跳ねを抑える。
- 低速時の手ブレを少し抑える。
- 角を潰しすぎない。
- previewとfinal strokeの差を増やさない。
- 設定UI追加は必要性が確認できるまで行わない。

## 検証

```powershell
node --check tegaki_work/system/drawing/pointer-handler.js
node --check tegaki_work/system/drawing/drawing-engine.js
node --check tegaki_work/system/drawing/brush-core.js
node --check tegaki_work/system/drawing/stroke-recorder.js
node --check tegaki_work/system/drawing/pressure-handler.js
node --check tegaki_work/system/drawing/stroke-renderer.js
Set-Location tegaki_work
npm.cmd run build
```

Browser確認:

- pen低速/速筆、eraser、airbrush、CAF working Layer描画、Undo/Redo、保存復元。
- console errorなし。

build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
