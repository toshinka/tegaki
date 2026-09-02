# Regional LoRA Lab - Architecture Notes

> **Document Version**: v0.1 (Phase 0 Baseline)  
> **Target Platform**: reForge (`stable-diffusion-webui-reForge`)

---

## 1. コア課題: なぜ通常の Attention Couple だけでは LoRA が分離できないのか？

1. **Text Conditioning (Attention Couple)**:
   - クロスアテンション層（`attn2`）において、Key/Value に渡すテキスト特徴ベクトルを空間マスクで重み付け合成する。
   - プロンプト単語（trigger word）の発火位置を制御できる。
2. **LoRA Weights Delta (UNet LoRA)**:
   - 全ての Linear / Conv 層（Self-Attention, Cross-Attention, ResNet blocks）の重みに \(\Delta W\) が直接加算される。
   - モデルの重み自体が変形するため、たとえプロンプトが無くても画像全体に画風やキャラクター特徴が漏洩する。

---

## 2. 実現アプローチの比較 (3つの候補方式)

| 方式 | 概要 | 長所 | 短所 / リスク |
| :--- | :--- | :--- | :--- |
| **Approach 1: Multi-Pass Oracle (Phase 1)** | `model_function_wrapper` でステップごとに `apply_model` を LoRA A用と LoRA B用で2回実行し、出力テンソルを空間マスクで合成 | **原理的に完全なLoRA分離を保証**。基準正解画像（Oracle）として機能。 | 生成時間が約2倍になる。 |
| **Approach 2: Masked Delta (Phase 3-4)** | 1回の forward 内で各レイヤーの LoRA 出力 \(\Delta W \cdot x\) に空間マスクを乗算して合成 | 1-pass で高速。VRAM効率が高い。 | レイヤーごとのテンソル形状（B, C, H, W vs B, N, C）へのマスク補間とhook実装が必要。 |
| **Approach 3: Attention-only LoRA** | Cross-Attention 層の LoRA のみ抽出し、Attention hook 内で局所化 | 既存の MRP Attention engine に乗せやすい。 | ResNet や Self-Attention の LoRA 特徴が脱落し、画風や構造の再現度が下がる。 |

---

## 3. Phase 1〜4 の戦略的ロードマップ

1. **Phase 1 (Oracle)**: Approach 1 (Multi-Pass) を実装し、reForge 上で「本当にLoRAが空間分離した画像」を確立する。
2. **Phase 2 (Scope)**: Text Encoder LoRA の影響度を測定し、UNet-only regional LoRA の振る舞いを評価。
3. **Phase 3 (Feasibility)**: Approach 2 (Masked Delta) の各層テンソル形状と hook 性を実測調査。
4. **Phase 4 (One-Pass)**: Approach 2 を実装し、Phase 1 Oracle との画質・速度を比較検証。
