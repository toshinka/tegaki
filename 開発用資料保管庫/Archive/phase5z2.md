# Phase 5z2: Clip Motion opacity keyframe

更新日: 2026-07-14

## 目的

Phase 5wで確立した `ClipInstance.transformKeyframes` samplingへopacityを最初の表現parameterとして追加する。新しい運動正本を作らず、旧Projectの見た目を維持する。

## Slice 0: opacity read/writeと合成境界の監査

1. ClipInstance、Project、CAF clipboard、History、compositor、Table preview、onion、exportのalpha経路を全検索する。
2. 静的既定値を1、key値を0..1へclampし、欠損keyは従来どおり1を継承する契約を決める。
3. position等と同じClip-local Frame、同一Frame後勝ち、範囲外無視、左key hold / linearを使う。
4. internal Layer opacity、Folder opacity、Lane visibility、onion表示alphaとClip Motion opacityを混同しない。

## Slice 1: 純粋samplingと描画接続

- 既存transform samplerへopacity scalarを追加する。
- TimelineFrameCompositor、Table preview、閉Table再生、onion、animation exportで同じsample結果を使う。
- keyframe無し旧Projectはalpha 1として従来表示と一致させる。

## Slice 2: UI・clipboard・保存

- CLIP MOTIONへOpacity 0–100%入力を追加する。
- Motion key copy / paste payload schemaをversion upし、旧version 1 payloadはopacityを変更しない互換にする。
- Project round-trip、CAF copy / paste、Undo / Redoを確認する。

## 対象外

- blend mode、色補間、easing curve、Perform、複数key範囲操作。
- Bake、subframe、Bone、mesh、morph、physics、WebGPU。
- internal Layer / Folder opacity UIの再設計。

## 検証

- 純粋sampling固定入力、旧Project互換、Project / clipboard round-trip。
- Browserで0% / 50% / 100%、hold / linear、再生、onion、Undo / Redo。
- 変更JSの `node --check`、build、生成差分除去。

## 現在状態

- Slice 0-2を実装。`opacity` は静的既定1、key値0..1 clamp、欠損継承とし、position等と同じClip-local Frame / 後勝ち / 範囲外無視 / hold・linear契約へ追加した。
- TimelineFrameCompositorはCanvasの既存`globalAlpha`へ、Table previewはPixi rootの既存alphaへsample値を乗算する。internal Layer / Folder / onion表示alphaの正本は変更しない。
- CLIP MOTIONへOpacity 0-100%を追加し、Motion clipboardをversion 2へ更新。version 1貼付けは対象keyのopacityを維持し、未設定なら継承する。
- 固定入力でlegacy既定1、clamp、欠損継承、hold / linear、Project round-trip、clipboard v1/v2を確認。Browserで100%→0%のend keyと中間66.6667%表示を確認した。
- Browserで実描画CAFの100% / 50% / 0%、HOLD、再生中の数値追従、Timeline onion、Project保存download、console errorなしを確認した。Undo/Redoは既存Timeline Historyへ記録されることを確認し、Project round-tripは固定入力で確認済み。Phase 5z2を完了する。
