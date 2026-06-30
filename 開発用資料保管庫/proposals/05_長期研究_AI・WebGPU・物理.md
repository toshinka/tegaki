# 長期研究: AI・WebGPU・物理

更新日: 2026-06-27

## 基本方針

この文書の項目は通常Phaseへ混ぜない。現行PixiJSラスター経路で十分な機能は先に完成させる。

「WebGPU化した方が結果的に短く、品質も高い」と具体的な計測で判断できた機能のみ、独立研究Phaseへ移す。

## PixiJS v8.19評価

2026-06-21時点でPixiJS v8.19.0がlatestだが、Tegakiはv8.17.0を使用している。

- v8.19.0で追加されたWebGPU関連は、MSAA RenderTexture向けのopt-in
  `transientAttachment`。描画backend全体の既定化ではない。
- 公式Application guideのrenderer `preference`既定値は`webgl`。
- opt-inの`pixi.js/html-source`は追加されたが、TegakiのTimeline previewや
  RenderTexture正本へ採用する理由はない。
- Graphics to SVG ExportとSprite Mask Channelsはv8.19.0公式release noteで
  追加機能として確認できないため、未確認APIを計画へ組み込まない。

v8.17からv8.19への更新は、WebGPU有効化と分離した互換監査候補とする。

- package / lock更新前後のbuild比較。
- RenderTexture描画、extract、inverse clipping、advanced blend、保存復元の回帰。
- rendererは明示的にWebGLを維持する。
- WebGPU切替、SDF/MSDF復活、描画pipeline再構成を同時に行わない。

2026-06-27再確認でも、公式Application guideのrenderer `preference` 既定値は`webgl`。多枚数CAFクラッシュ対策はWebGPU採用ではなく、まず常駐snapshot / Texture / RenderTextureの計測と解放境界の修正として扱う。64GB RAM / RTX4070級でも、全FrameをGPU textureとして常駐させる設計にはしない。

## WebGPU候補

- 大量dabのブラシスタンプ合成と性能改善。
- 粒子ノイズ、素材stamp等を含む高度なエアブラシ質感。
- SDF/JFAによるgap closeや距離場。
- 大規模メッシュ変形。
- 多数Frameの合成・書き出し高速化。

採用前に確認すること:

- PixiJSレンダラーとのcontext共有。
- WebGPU非対応環境の扱い。
- RenderTexture、History、thumbnail、保存形式との境界。
- 同じ機能のWebGL/Pixi経路との二重実装コスト。

Phase 5gで、始点dot、固定dabの周期的な輪、低flow重ね塗りの色ずれは現行PixiJS / RenderTexture経路で修正できた。
これらの不具合だけを理由にWebGPUへ移行しない。上記候補は大量dab時の性能または現行方式で表現できない高度な質感を計測してから判断する。

## AI・ロトスコープ支援

### お手本動画の読込 `候補`

- MP4/GIFをフレームへ分解し、編集ロックした参考Laneへ配置する。
- 最初はAI生成なしのロトスコープ支援として成立させる。
- WebCodecs、ffmpeg中継、ブラウザ単体のどれを採用するか比較する。

### ローカルAI Adapter `保留`

- Node.jsローカルサーバーでCORS、ffmpeg、ComfyUI、LLM翻訳を中継する。
- Tegaki本体は特定AI APIへ直接依存しない。

### 始点・終点と生成参考Lane `保留`

- Timeline上で始点・終点を指定。
- 生成結果を低opacity・編集ロックした参考Laneへ展開。
- 生成画像を完成品として正本化せず、手描き支援として扱う。

## 物理・メッシュ

- 物理計算は数値結果を返す独立モデル。
- ClipInstance transform、keyframe、easingが先。
- Mesh/warpはCAF内部画像データとClipInstance配置を分離して保存する。
- Perform記録、物理、AI補間を同時実装しない。

## 保留条件

- WebGPU/SDF/MSDF/WebGL2 Meshは、正式な採用Phaseまで凍結。
- 無限キャンバス・外部領域保持は、メモリ計測と保存形式設計後。
- スタンプ描画エンジン全面置換は、現行描画の回帰テストを用意してから。

## 無限キャンバス研究

- 現行の固定Canvas寸法、RenderTexture、selection、thumbnail、export、Album保存を前提にしたまま見かけだけ無限化しない。
- chunk / tile方式、疎なLayer領域、外部領域を含むtransform、表示viewportだけの合成を比較する。
- 保存形式はCanvas原点、使用領域、chunk index、背景、CAF DrawingSnapshotとの互換を定義する。
- Undo / Redoで巨大な全面Snapshotを保持しない差分形式が必要。
- 最初の実験は通常Raster Layer 1枚のpan・描画・保存復元に限定し、CAF、mesh、WebGPUと同時実装しない。
