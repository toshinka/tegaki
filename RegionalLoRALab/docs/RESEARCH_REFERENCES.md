# Regional LoRA Lab - Research References & Precedent Analysis

---

## 1. 先行研究・既存実装の分析

### ① kohya-ss / sd-scripts (Attention Couple + Regional LoRA)
- **概要**: 空間マスクと各 LoRA の network multiplier を対応させる仕組み。
- **特徴**: UNet の forward 時に各領域のマスクと LoRA を計算。
- **示唆**: UNet LoRA と Text Encoder LoRA の分離設計の重要性。

### ② hako-mikan / sd-webui-regional-prompter
- **概要**: A1111 向け Regional Prompter（Latent mode / Attention mode）。
- **特徴**: Latent mode で領域ごとに別々の LoRA / prompt を適用可能。
- **課題**: 領域数に比例して計算量が増加し、reForge では一部非対応。

### ③ ComfyUI Impact Pack (Regional Sampler)
- **概要**: 領域ごとに別々の model patcher / pipe を実行し、Latent を mask 合成。
- **特徴**: ModelPatcher clone と sampling hook の組み合わせ。

### ④ Krea Multi-LoRA for Forge Neo
- **概要**: Single-stream transformer における空間トークンゲーティング。
- **注意**: SDXL UNet 構造へ直接そのまま移植することは不可。概念参考のみ。
