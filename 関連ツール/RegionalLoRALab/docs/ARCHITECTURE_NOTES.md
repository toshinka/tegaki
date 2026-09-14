# Regional LoRA Lab - Architecture Notes

> **Document Version**: v0.2 (Phase 0.5 Revised)  
> **Target Platform**: reForge (`stable-diffusion-webui-reForge`)

---

## 1. コア課題: なぜ通常の Attention Couple だけでは LoRA が分離できないのか？

1. **Text Conditioning (Attention Couple)**:
   - クロスアテンション層（`attn2`）において、Key/Value に渡すテキスト特徴ベクトルを空間マスクで重み付け合成する。
   - プロンプト単語（trigger word）の発火位置を制御できる。
2. **LoRA Weights Delta (UNet LoRA)**:
   - LoRA が実際に target として持つ Linear / Conv 等の層へ \(\Delta W\) が直接加算される（※対象層は LoRA の学習形式によって異なる）。
   - モデルの重み自体が変形するため、プロンプトの有無にかかわらず画像全体に画風やキャラクター特徴が漏洩する。

---

## 2. 実現アプローチの比較 (3つの候補方式)

| 方式 | 概要 | 長所 | 短所 / リスク / 評価 |
| :--- | :--- | :--- | :--- |
| **Approach 1: Multi-Pass Oracle (Phase 1 Baseline)** | `model_function_wrapper` でステップごとに `apply_model` を LoRA A用と LoRA B用で2回実行し、出力テンソルを空間マスクで合成 | **LoRA weight state の branch-level separation を実現しやすい**。Masked Delta 方式を評価するための reference baseline (Oracle) として使用。 | 生成時間が約2倍。共有 underlying model のため毎ステップの patch/unpatch コストが発生する可能性。空間的・意味的な完全無漏洩は保証しない。 |
| **Approach 2: Masked Delta (Phase 3-4)** | 1回の forward 内で各レイヤーの LoRA 出力 \(\Delta W \cdot x\) に空間マスクを乗算して合成 | 1-pass で高速。VRAM効率が高い。重みの毎ステップ patch/unpatch が不要。 | レイヤーごとのテンソル形状（B, C, H, W vs B, N, C）へのマスク補間とhook実装が必要。 |
| **Approach 3: Attention-only LoRA** | Cross-Attention 層の LoRA のみ抽出し、Attention hook 内で局所化 | 既存の MRP Attention engine に乗せやすい。 | ResNet や Self-Attention の LoRA 特徴が脱落し、画風や構造の再現度が下がる。 |

> **【Oracle の定義】**  
> 本プロジェクトにおける `Oracle` とは、数学的・空間的に100%完璧な無漏洩真理値（exact mathematical ground truth）を意味するのではなく、**「速度を犠牲にしてでも、確実に独立した LoRA 重み状態で計算した参照基準（intentionally slow reference baseline）」** を意味します。

---

## 3. Phase 0.5〜4 の戦略的ロードマップ

1. **Phase 0.5 (Patch Residency Probe)**: 共有 underlying model における `patch_model()` / `unpatch_model()` の実効速度と挙動を実測。
2. **Phase 1 (Oracle Baseline)**: Phase 0.5 の結果に基づき、Approach 1 (Multi-Pass) による 2-Region baseline を確立。
3. **Phase 2 (Scope)**: Text Encoder LoRA の影響度を測定し、UNet-only regional LoRA の振る舞いを評価。
4. **Phase 3 (Feasibility)**: Approach 2 (Masked Delta) の各層テンソル形状と hook 性を実測調査。
5. **Phase 4 (One-Pass)**: Approach 2 を実装し、Phase 1 Oracle との画質・速度を比較検証。
