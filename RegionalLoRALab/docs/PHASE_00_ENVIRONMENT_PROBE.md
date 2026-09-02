# Phase 00: Environment & Hook Probe Summary

---

## 1. 測定された実機環境 (Measured Environment)

| 項目 | 実測値 |
| :--- | :--- |
| **reForge Installation Path** | `E:\EasyReforge\stable-diffusion-webui-reForge` |
| **Git Remote** | `https://github.com/Panchovix/stable-diffusion-webui-reForge` |
| **Git Branch / Commit** | `19395bf` (`19395bf96ccdc605774c76a9fe8cc7145b637128`) |
| **Python Version** | `3.10.6` |
| **PyTorch Version** | `2.7.1+cu128` |
| **CUDA Version** | `12.8` |
| **GPU Device** | `NVIDIA GeForce RTX 4070` |
| **Total VRAM** | `11.99 GB` (約12 GB) |

---

## 2. フック可能性の検証結果 (Hook Feasibility)

- **ModelPatcher / UnetPatcher**:
  - `clone()` が利用可能で、ベースモデルを共有しつつ `patches` 辞書が独立複製されることを確認。
  - `add_patches(loaded, strength_model)` により独立して LoRA をアタッチ可能。
- **UNet Forward Hook**:
  - `set_model_unet_function_wrapper(wrapper_fn)` により、サンプリング中の `calc_cond_uncond_batch()` 内で `apply_model` を完全に包み込むことが可能。
- **非侵襲性**:
  - WebUI 本体コードを一切編集せず、拡張スクリプト（`scripts.Script`）のみで完結可能。
