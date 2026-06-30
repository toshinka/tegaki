# PHASE5M_HANDOFF — 新チャット移行用

更新日: 2026-06-27

## 現在状態

- Phase 5lは完了。
- 大容量CAFはAlbumへ巨大projectDataを積み続けず、外部Project JSON保存を標準導線にした。
- Ctrl+SはCAF/Animation dataを含むProjectでは初回保存先選択、以後同一FileSystemFileHandleへ上書き保存する。
- Album保存ボタンもCAF Projectでは外部保存を優先し、handle保持時だけAlbumへ参照カードを作る。
- Project JSON importはAlbumへ追加せず、直接キャンバスへ読み込む。
- Album popupから現在Project保存先を表示・再選択できる。
- オーナー実機で上記の主要導線は問題なしと確認済み。

## Phase 5mの目的

ペン入力点、筆圧、補間、preview/final stroke一致を固定入力で計測し、現行PixiJS RenderTexture焼き込み経路のまま描線品質を改善する。

参考資料 `開発用資料保管庫/proposals/tegaki_pen_quality_research_2026-06-27.txt` は、WebGPU導入案ではなく入力点品質改善の参考として扱う。

## 最初に読む順序

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

## 作業開始時の必須確認

最初に以下を実行し、既存変更を維持する。

```powershell
git status --short --untracked-files=all
```

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/` は調査・編集しない。

## Phase 5m Slice 1

最初は実装より計測を優先する。

- PointerEvent 1件ごとのpressure、pointerType、client座標、local座標を確認する。
- `getCoalescedEvents()` の有無、件数、座標/筆圧分布を確認する。
- StrokeRecorder投入後の点数、距離、筆圧差分、補間後点数を確認する。
- preview焼き込みとfinal strokeの見た目差を確認する。
- debug無効時のconsole出力を増やさない。
- 現在は `window.TegakiStrokeInputProfiler` でdebug中のevent/finalize profileを保持する。
- 実機固定入力では `TegakiStrokeInputProfiler.setEnabled(true)`、`clear()`、`setLabel('pen-4-pressure-on-slow-taper')`、`summary()`、`getStrokes()` を使って入力別に比較する。
- opacity 50%前後で濃度が急に溜まる症状は、penの短いライブ線分を同じRenderTextureへ半透明で反復合成する経路が原因候補。
- pen opacityが1未満の時だけ、一時RenderTextureへ不透明strokeとして集め、preview/commitで一度だけopacityを掛ける経路を追加済み。
- opacity 100%でも点線状の短いpen strokeで大丸が出たため、短距離pen strokeの初回realtime segment / final dot fallbackを原因候補として追加確認した。
- pen筆圧ONかつ0.75px前後の点入力・1.25px以下の極短入力だけpressureを小さくcapし、通常の連続線、mouse、固定幅penには適用しない。
- `pressureCurve` の「軽め/重め」表示と式が逆だったため、軽めは弱筆圧を反応しやすく、重めは強く押さないと太くならない式へ修正済み。
- pen opacity 50%で筆圧による透明度変化が消え、ジャギーが目立つ可能性があったため、設定に「筆圧で濃度を変える」を追加した。既定ONで、pen opacity isolation中も一時RenderTexture内にpressure alphaを保持し、commit時に全体opacityを一度だけ掛ける。
- 50%線の境界が100%より荒く見える直接差分として、pen opacity isolation用の一時RenderTextureだけ `antialias: true` が無いことを確認した。通常Layer RenderTextureと同じAA指定へ揃え、DPR/内部2倍化/WebGPUには踏み込まない。
- 筆圧濃度が強く効くと内部alphaが下がり、1px単位のcoverage差も目立ちやすいため、`筆圧濃度` スライダーを追加し、既定0.65で濃淡を残しつつ半透明境界が過度に薄くならないようにした。
- `筆圧濃度` 1.00では、OPACITY 50%なら筆圧alphaは0%から50%まで変化する。既定0.65は弱筆圧側を少し残し、境界の荒れを抑える。
- 墨・水彩的な蓄積、にじみ、濃淡混色はPhase 5mのopacity/coverage補正とは別領域のため、GPU Brush Lab / WebGPU側の検討として棚上げする。WebGPU化を試す場合も、まずスプレー/粒子系で効果と負荷を測ってからpen本体へ広げる。
- 筆圧が弱いまま急に強くなる症状は、pressure correction / curve、PressureHandler baseline、距離filter、StrokeRecorder最大筆圧差分、`initialRealtimePressureCapped` / `shortStrokeStabilized` をprofileで比較する。

固定入力:

- 400x400、pen 4px / 12px、筆圧ON/OFF。
- 低速の短い入り抜き、速筆の斜線、円、ジグザグ。
- eraser 12px、airbrush default、CAF working Layer上のpen。
- mouse入力では筆圧なしの既存挙動を維持する。

## やらないこと

- WebGPU有効化。
- SDF/MSDF、WebGL2 Mesh、GPU Brush Labの本体接続。
- Canvas2Dを本番stroke描画へ混入すること。
- DPR 2倍化、内部2倍RenderTexture、出力サイズと作業サイズの不一致。
- perfect-freehandの既定値へ大きく戻すこと。
- 非破壊stroke保存形式、Project保存形式、History形式の全面変更。
- LayerSystem / TimelineModel / CAF Historyの再構成。

## 検証

変更規模に応じて以下を行う。

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
