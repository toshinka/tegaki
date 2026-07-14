# Phase 5z6: Clip Motion Easing Curve Editor

更新日: 2026-07-14

## 目的

Phase 5z5で固定した左key所有の `cubic-bezier(x1,y1,x2,y2)` を正本のまま維持し、CLIP MOTIONから小型のcurve editorを開いてペン・マウスで調整できるようにする。新しいeasing正本やparameter別curveを作らず、preset selectと同じmetadata / Timeline Historyへ接続する。

Phase 6はmesh / morph用deformer正本の導入候補として予約し、本Phaseで繰り上げない。

## 実装契約

- editorは現在Frameに明示keyがあり、そのkeyが右側のlinear区間を所有する場合だけ編集可能とする。
- Clip末端keyは右区間を持たないため理由付きread-onlyとする。
- preset選択とcurve dragは同じ `key.easing` を更新し、editor専用の保存正本を作らない。
- drag中は既存previewをlive更新し、pointerup / cancelを1 Timeline Historyにまとめる。
- windowはCLIP MOTIONより前面、移動可能、closeは1個とし、既存共通popup / form配色を使う。
- 0..1 graph、始点 `(0,0)`、終点 `(1,1)`、2 control handleを表示する。
- `LINEAR / EASE IN / EASE OUT / EASE IN-OUT` presetとCUSTOM表示を同期する。
- HOLD、末端、再生中は編集しない。

## 実装結果

- `easing-curve-editor-model.js` にcurve座標変換、Y反転、clamp、編集可否を純粋helperとして分離した。
- CLIP MOTION headerのcurve buttonから、overlay root上の独立・移動可能・単一closeの `EASING CURVE` windowを開く。
- graph dragは既存 `transformKeyframes[].easing` をlive更新し、pointerup 1 History、pointercancel復元とした。
- preset、数値wheel、横drag scrubも同じ正本へ接続した。
- 再生中は区間を所有する左keyを追跡し、sample表示と正本編集を分けた。
- 固定入力、Project相当save / restore、Motion clipboard、node check、build、Browserのpreset同期、HOLD、終端key、Undo / Redo、再生read-only、copy / paste、window配置を確認した。
- オーナー実機で改修を確認し、2026-07-14にPhase 5z6を完了した。

## 後続へ送ったもの

- 現行editorは `Segment Easing Editor` として維持する。
- Clip全体のparameter実値を扱うLive2D型graphは別の `Motion Graph` とし、`開発用資料保管庫/proposals/10_Motion_Graph・Easing・Motion_Path設計.md` へ送った。
- Animation Table欄外Raster / Canvas ResizeのUltra監査は完了し、`開発用資料保管庫/proposals/11_Animation_Table欄外Raster・Canvas_Resize整合性監査.md` とPhase 5z7へ送った。

## 維持した契約

- `ClipInstance.transform / transformKeyframes` が唯一のMotion正本。
- stroke中working Layer、preview staging交換、preview container順、上側Lane前面、PSD record順を変更しない。
- Lane / Timeline onionはdisplay-only。
- Folder clippingとClip blendの合成順を変更しない。
- parameter別curve、複数key Motion Graph、Motion Path、overshoot / spring / bounce、mesh、morph、Bone、physics、WebGPUは混ぜない。
