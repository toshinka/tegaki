# Phase 2j — ストローク品質 / ズーム時ジャギー調査

> Phase 2i で主要 popup の浮遊UI化は一区切り。
> Phase 2j は、キャンバスサイズやカメラズーム条件によってストロークの見た目が荒くなる問題を、描画パイプラインを壊さずに棚卸しするフェーズ。

---

## 背景

オーナーから以下の追加メモと画像資料がある。

- キャンバスサイズを大きくし、カメラを引き気味にした状態で描くと、線がジャギーに見える。
- カメラ最小/最大でストロークの精細さが違うのは当然だが、アンチエイリアス部分まで拡縮影響を受けるのは気になる。
- 隣接要望として、キャンバスサイズ変更の片辺最大を 3000px にすること、キャンバス操作での拡縮倍率を少し広げることも挙がっている。
- 画像資料: `画像資料/カメラ最小で描いた時と最大で描いたときでストロークの精細さが違うのは当然だがジャギーになってるのは修正したい.png`

現行方針では内部キャンバス2倍化、`resolution: 2`、WebGL2 Mesh経路の復活、WebGPU/SDF/MSDF系の採用は禁止または凍結中。
Phase 2j では、まず等倍解像度のまま改善できる余地と、手を出すと危険な箇所を分ける。上限3000px化やズーム範囲拡張は、ジャギー原因を確認してから実装する。

---

## 目的

- 現行のペン描画経路を、PointerEvent から RenderTexture 焼き込みまで再確認する。
- カメラズーム、キャンバスサイズ、ブラシサイズ、座標変換、RenderTexture 解像度のどこで見た目差が出るか整理する。
- `stroke-renderer.js` / `brush-core.js` / `drawing-engine.js` の責務境界を確認し、ジャギー対策の候補をリスク順に並べる。
- 実装する場合も、まず小さな検証点を1つに絞れる状態にする。

---

## Gemini に任せる範囲

Gemini は今回、棚卸しと記録に限定する。

- 関係ファイルの読み取り。
- `rg` による同責務・設定値・イベントの確認。
- `PROGRESS.md` への調査結果追記。
- 低リスクなコメント/記録整理。

Gemini は独自判断で描画ロジックを変更しない。

---

## 調査対象候補

- `system/drawing/drawing-engine.js`
- `system/drawing/pointer-handler.js`
- `system/drawing/stroke-recorder.js`
- `system/drawing/stroke-renderer.js`
- `system/drawing/brush-core.js`
- `system/camera-system.js`
- `system/layer-system.js`
- `coordinate-system.js`
- `config.js`
- `styles/main.css`（見た目色の確認のみ）

---

## 調査観点

1. **座標系**
   - `clientX/Y -> canvas/world/local` の変換がズーム倍率を二重反映していないか。
   - local座標が整数丸めされていないか。

2. **ブラシ形状**
   - ストローク点の間隔、補間、スムージング、最小距離フィルタがズーム条件で荒く見える要因になっていないか。
   - `Graphics.stroke()` と `Graphics.poly()` の使い分けが、拡縮時の見た目差へ影響していないか。

3. **RenderTexture**
   - レイヤー RenderTexture のサイズ、解像度、antialias 設定がどこで作られているか。
   - 等倍出力ルールを崩さずに調整できる設定があるか。

4. **カメラ/表示**
   - 描画結果そのものが荒いのか、表示縮小・拡大時の見え方だけが荒いのかを分ける。

---

## Phase 2j 初回の完了条件

- ジャギーが「描画データ生成」「RenderTexture焼き込み」「表示スケーリング」のどこに近い問題か、候補が `PROGRESS.md` に整理されている。
- 実装候補が、低リスク/中リスク/高リスクに分かれている。
- コード変更した場合のみ `npm.cmd run build` が成功している。

---

## Phase 2j ではやらないこと

- 内部キャンバス2倍化。
- `resolution: 2` の採用。
- WebGL2 Mesh 経路の復活。
- WebGPU / SDF / MSDF 系の採用。
- perfect-freehand を使わない独自輪郭生成への置き換え。
- ペン/消しゴムの別エンジン化。
- クイックパネル全面刷新。
- アルバム popup 改修。
