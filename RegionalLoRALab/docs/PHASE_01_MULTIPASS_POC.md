# Phase 01: 2-Region Multi-Pass Oracle Specification

> **Status**: APPROVED FOR IMPLEMENTATION (Spec Frozen)  
> **Selected Architecture**: Candidate B — Alternating Patch Materialization  
> **Target Platform**: reForge (`stable-diffusion-webui-reForge`)

---

## 1. 目的

遅くてもよいので、左右に別々の LoRA（左=LoRA A, 右=LoRA B）を独立した重み状態で計算する**基準正解実装（Oracle Reference Baseline）** を確立する。

> **【Oracle の定義】**  
> 本プロジェクトにおける `Oracle` とは、数学的に完全な無漏洩真理値（exact ground truth）ではなく、**「速度を犠牲にしてでも、確実に独立した LoRA 重み状態で計算した参照基準（intentionally slow reference baseline）」** を意味する。  
> A/B branch は画像全体 latent を見るため、receptive field や attention による意味的影響は残り得る。成功判定は **「Global A+B より明確に style/character leakage が減ること」** とする。

---

## 2. 確定仕様と凍結制約 (Frozen Constraints)

Phase 1 実装では以下の仕様を固定し、機能追加や拡張を行わない：

| 項目 | 確定仕様 (Phase 1 Frozen) |
| :--- | :--- |
| **対象モデル** | SDXL / Illustrious 系 Checkpoint |
| **領域数 / 幾何構造** | **2領域固定: 左右 50:50 分割** (Left 50% / Right 50%) |
| **マスク種別** | **Hard Binary Mask** (`mask_A + mask_B = 1.0`, soft edge なし) |
| **LoRA 種別** | **Standard UNet LoRA のみ** (LoHa/LoKr/DoRA 等は後段) |
| **Text Encoder** | **Multiplier = 0 / Disabled** (UNet LoRA のみ空間分離) |
| **プロンプト構文** | 通常の trigger words は許可。**`<lora:...>` タグは禁止 (検出時は警告/停止)** |
| **Batch Size** | **1 固定** |
| **ControlNet** | **初期検証時は OFF** |
| **MRP 連携** | **連携なし (独立拡張として単独動作)** |

---

## 3. 計算順序と不変条件 (Execution Flow & Safety Invariant)

### 3.1 毎ステップの計算順序
```text
base state
    ↓
materialize LoRA A (clone_A.patch_model())
    ↓
forward A (apply_model())
    ↓
restore base (clone_A.unpatch_model())
    ↓
materialize LoRA B (clone_B.patch_model())
    ↓
forward B (apply_model())
    ↓
restore base (clone_B.unpatch_model())
    ↓
mask blend A/B (out_A * mask_A + out_B * mask_B)
    ↓
return combined output
```

### 3.2 Safety Invariant (最重要不変条件)
- **各 branch forward 後に必ず base weight へ戻ること**。
- `try...finally` で囲み、A が失敗した場合は B へ進まず、B が失敗した場合は combined output を返さず安全に停止する（fail-closed）。
- A/B weight state を次ステップへ持ち越さない。

---

## 4. Wrapper 競合ポリシー (Wrapper Conflict Policy)

- 既存の `model_function_wrapper` が存在しない場合: 正常実行。
- 既存の `model_function_wrapper` が存在する場合: **原則 fail-closed（開始中止＆警告表示）**。
- 他 extension や MRP との同時動作は、Phase 1 単独成立後の後段フェーズで対応する。

---

## 5. 対照実験マトリクス (Phase 1 Test Matrix)

同一条件（同 Seed, 同 Checkpoint, 同 Sampler, 同 Scheduler, 同 Steps, 同 CFG, 同 Resolution, 同 Prompt）において以下を比較する：

1. **Control 0**: RLL OFF, LoRA なし (Baseline)
2. **Control A**: RLL OFF, LoRA A global
3. **Control B**: RLL OFF, LoRA B global
4. **Control AB**: RLL OFF, LoRA A+B global
5. **Experimental**: RLL ON (Left=LoRA A, Right=LoRA B)
