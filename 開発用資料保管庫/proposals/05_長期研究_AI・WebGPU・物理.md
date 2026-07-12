# 長期研究: AI・WebGPU・物理

更新日: 2026-07-13

## 境界

- この文書の項目は通常Phaseへ混ぜない。
- 現行PixiJS / WebGL RenderTexture経路で解決できる問題を先に直す。
- WebGPU、SDF/MSDF、WebGL2 Mesh、DPR 2倍化、tiled canvasは固定計測と独立prototypeなしに採用しない。

## 描画研究

- 現行入力はcoalesced events、筆圧補正、LazyBrushを実装済み。
- StrokeQualityFilterは、実機で再現する入力欠落やジッターを計測できた場合だけ、筆圧平滑化と極小ジッター除去から試す。
- ライブ描画と確定描画の見た目を分けない。
- GPU brush候補は大量dab、高度なairbrush texture、混色、高品質AA。通常pen全面置換から始めない。
- airbrushは現行のradial texture dab、spacing補正flow、normal alpha蓄積を固定入力で測り、WebGPU prototypeは大径soft dab 1 workloadから始める。
- 水彩・油彩はrenderer切替だけでは成立しない。pigment / water / wetness / height等の永続状態と、History/CAF保存時のbake境界を先に設計する。

## WebGPU / Pixi更新

- PixiJS更新とWebGPU採用を同時に行わない。
- Pixi更新時はrendererをWebGLに固定し、RenderTexture、extract、mask、blend、保存復元を比較する。
- WebGPU prototypeは本体正本から分離し、WebGL fallbackと二重保守コストを測る。

## AI・ロトスコープ

- 最初はMP4/GIFを分解し、編集lockした参考Laneへ置くロトスコープ支援。
- AI連携はNode.js local adapter越しとし、本体を特定APIへ直接依存させない。
- 生成結果は参考Laneであり、手描き正本へ自動混入させない。

## Keyframe後の研究

- ClipInstance transform、keyframe、easingを先に完成させる。
- Perform記録は操作sampling、簡略化、Undo単位を定義してから行う。
- mesh / warp / physicsはCAF画像正本と配置transformを分離する。
- AI補間、physics、meshを同一Phaseで実装しない。
- meshは密な手打ちを既定にせず、少数点cage / 粗いlattice / 自動weightを比較する。
- boneとphysicsはdeformer parameterを駆動し、必要時にkeyframeへbakeする。画像正本へ直接演算結果を書き続けない。
- 詳細な段階と採否gateは `09_変形アニメーション・メッシュ・GPU画材ロードマップ.md` を参照する。

## 無限領域

- Phase 5pでProject frame固定 + 可変Raster boundsを実装済み。
- 真の無限canvasを検討する場合だけ、chunk/tile、viewport合成、差分History、CAF snapshot互換を独立研究する。
- 現行の可変Raster boundsを壊して見かけだけ無限化しない。
