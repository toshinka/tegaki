# Phase 01: 2-Region Multi-Pass Oracle Detailed Design

---

## 1. 目的

遅くてもよいので、左右に別々の LoRA（例: 左=LoRA A, 右=LoRA B）を**原理的に完全分離して適用できる基準正解実装（Oracle）** を確立する。

---

## 2. アーキテクチャ設計

### 2.1 2領域固定マスク
- 左右 50:50 分割:
  - `mask_A`: 左半分 = 1.0, 右半分 = 0.0
  - `mask_B`: 左半分 = 0.0, 右半分 = 1.0
  - `mask_A + mask_B = 1.0` を常に保証

### 2.2 Multi-Pass UNet Forward Wrapper
`model_function_wrapper` を使用して各デノイズステップで実行：
```python
def multipass_wrapper(apply_model_fn, params):
    # params: {"input": input_x, "timestep": timestep_, "c": c, "cond_or_uncond": cond_or_uncond}
    
    # 1. LoRA A が適用された unet_A で forward
    out_A = apply_model_A(params["input"], params["timestep"], **params["c"])
    
    # 2. LoRA B が適用された unet_B で forward
    out_B = apply_model_B(params["input"], params["timestep"], **params["c"])
    
    # 3. 空間マスクによる出力テンソル合成
    out_combined = mask_A * out_A + mask_B * out_B
    return out_combined
```

### 2.3 ライフサイクルとクリーンアップ
- サンプリング終了時に `try...finally` で元の UNet を確実にリストア。
- patch state のメモリ残留や次生成への汚染を完全に防止。
