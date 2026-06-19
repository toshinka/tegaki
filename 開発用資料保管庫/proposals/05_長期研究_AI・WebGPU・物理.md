# 長期研究: AI・WebGPU・物理

更新日: 2026-06-19

## 基本方針

この文書の項目は通常Phaseへ混ぜない。現行PixiJSラスター経路で十分な機能は先に完成させる。

「WebGPU化した方が結果的に短く、品質も高い」と具体的な計測で判断できた機能のみ、独立研究Phaseへ移す。

## WebGPU候補

- 大量dabのブラシスタンプ合成。
- 高品質なエアブラシ蓄積。
- SDF/JFAによるgap closeや距離場。
- 大規模メッシュ変形。
- 多数Frameの合成・書き出し高速化。

採用前に確認すること:

- PixiJSレンダラーとのcontext共有。
- WebGPU非対応環境の扱い。
- RenderTexture、History、thumbnail、保存形式との境界。
- 同じ機能のWebGL/Pixi経路との二重実装コスト。

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

