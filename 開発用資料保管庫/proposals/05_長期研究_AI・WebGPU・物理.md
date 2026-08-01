# 長期研究: AI・WebGPU・高度物理

更新日: 2026-07-28

## 境界

本書は、通常の機能Phaseへ混ぜない研究項目の隔離場所である。直近のUI、Motion、WARP、保存、Bakeの修正を止めて先行実装しない。

研究を開く条件:

- 現行CPU / WebGL / Pixi経路に再現可能な性能限界がある。
- 入出力、fallback、保存正本、History、メモリ解放を説明できる。
- 小さなadapterまたはprototypeで比較できる。
- 未対応環境でもProjectを開け、結果を失わない。

## WebGPU / GPU画材

候補:

- WebGPU brush pipeline
- 水彩の拡散 / 乾燥
- 油彩の厚み / 混色
- 大きなblur、smudge、wet map
- Mesh / physicsの計算adapter

採用gate:

1. 同じ固定入力でCPU / 現行WebGLとの画素差を測る。
2. WebGPU未対応、device loss、shader compile失敗時のfallbackを持つ。
3. save / reload / exportはGPU runtime stateへ依存しない。
4. RenderTexture、GPUBuffer、cacheの上限とdisposeを測る。
5. pen latency、battery、mobile、複数CAFで実測優位がある。

SDF / MSDFは線品質研究として維持するが、正式Phaseまで本番brushへ接続しない。

## AI・ロトスコープ・外部engine

候補:

- 参考動画のFrame分解とdisplay-only reference Lane
- pose / inbetween / color候補の生成
- ComfyUI等への明示export / import adapter
- prompt補助とlocal engine bridge

原則:

- AI出力を自動で既存Layerへ上書きしない。
- 生成結果は新規asset / Laneへ取り込み、元データを保持する。
- Project JSONに外部engine固有runtimeを埋め込まない。
- offline、権限拒否、engine未導入でも通常制作を続行できる。
- adapterのversion、入力manifest、結果のprovenanceを記録できるようにする。

長大な外部AI連携案は過去計画の`外部AI参考資料/`へ保存した。正式研究Phaseでは現行コードとAPI状況を再調査する。

## 高度物理

BONE Dynamicsと単純Colliderまでの統合計画は`15_キャラクターRig・Mesh・Perform統合ロードマップ.md`を正本とする。

本書へ残す研究項目:

- Part単位Rigid Body
- friction / restitution / sleeping
- broad phase / narrow phase
- continuous collision detection
- soft body / Position Based Dynamics
- 接触点の局所Mesh変形
- fluid / cloth相当

これらはSecondary Motionと同じPhaseへ入れない。決定的random seek、fixed timestep、export一致、Bake、solver versionが成立してから独立prototypeを作る。

## 真の無限Canvas

現行のRaster bounds拡張と欄外Rasterは維持する。真の無限領域はtile / chunk、cache eviction、History、save、thumbnail、export範囲を別設計にする必要があるため研究扱いとする。

採用前に確認すること:

- tile IDと座標の正本
- strokeが跨ぐtileの原子性
- Undo / Redo容量
- CAF captureとAnimation frame bounds
- Project保存と部分load
- PSD / image export範囲
- GPU texture上限とeviction
