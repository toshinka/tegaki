# reForge LoRA Loading & Sampling Execution Flow Analysis

> **Target Platform**: `stable-diffusion-webui-reForge` (commit `19395bf96ccdc605774c76a9fe8cc7145b637128`)  
> **Investigation Date**: 2026-09-02 (Revised Phase 0.5)  
> **Source Files Inspected**:
> - `extensions-builtin/Lora/extra_networks_lora.py`
> - `extensions-builtin/Lora/networks.py`
> - `modules/extra_networks.py`
> - `ldm_patched/modules/sd.py`
> - `ldm_patched/modules/lora.py`
> - `ldm_patched/modules/model_patcher.py`
> - `ldm_patched/modules/model_management.py`
> - `modules_forge/unet_patcher.py`
> - `modules_forge/forge_sampler.py`
> - `ldm_patched/modules/samplers.py`

---

## 1. 10大基本設問への直接回答 (Section 14.2 & Phase 0.5 Revised)

### Q1: `<lora:...>` はどこで解釈されるか？
- **責務分担**:
  1. `modules/extra_networks.py`: WebUI プロンプト文字列から `<lora:NAME:UNET_MULT:TE_MULT>` を抽出・パース。
  2. `extensions-builtin/Lora/extra_networks_lora.py`: `ExtraNetworkLora.activate()` が呼ばれ、LoRA 名と各 multiplier を集約。
  3. `extensions-builtin/Lora/networks.py`: `load_networks()` が受け取ったリストに基づき、ディスク上のファイルを解決して `load_lora_for_models()` を呼び出します。

### Q2: LoRA state dict はどこでロードされるか？
- `extensions-builtin/Lora/networks.py` の `load_lora_state_dict(filename)` により、`ldm_patched.modules.utils.load_torch_file(filename, safe_load=True)` を経由してロードされます（LRUキャッシュ対応）。

### Q3: UNet patcher へどの関数で patch が追加されるか？
- `ldm_patched/modules/sd.py` の `load_lora_for_models(model, clip, lora, strength_model, strength_clip, filename)` 内で:
  1. `key_map = ldm_patched.modules.lora.model_lora_keys_unet(model.model, key_map)` でキーマップ作成。
  2. `loaded = ldm_patched.modules.lora.load_lora(lora, key_map)` で LoRA テンソルを変換。
  3. `new_modelpatcher = model.clone()` で複製。
  4. `new_modelpatcher.add_patches(loaded, strength_model)` により patch タプル `(strength_patch, patch_tuple, strength_model)` が `new_modelpatcher.patches[k]` リストへ追加（登録）されます。

### Q4: CLIP patcher へどの関数で patch が追加されるか？
- 同様に `ldm_patched/modules/sd.py` の `load_lora_for_models()` 内で:
  1. `key_map = ldm_patched.modules.lora.model_lora_keys_clip(clip.cond_stage_model, key_map)`
  2. `new_clip = clip.clone()`
  3. `new_clip.add_patches(loaded, strength_clip)` により追加（登録）されます。

### Q5: `UnetPatcher.clone()` は使えるか？
- **YES**: patcher clone API は存在します。
- `patches`, `model_options`, `object_patches` 等の bookkeeping 辞書・リストは clone 側へ複製されます。
- **重要**: ただし `underlying model` (`self.model`) は共有されるため、「2 clone = 独立した2個の実 UNet weight set」ではありません。

### Q6: clone は同じ underlying model を共有するか？
- **YES**。`clone()` は `self.model`（内部の `diffusion_model` PyTorch モジュール）をそのまま参照渡しし、同一の PyTorch Module オブジェクトを共有します。

### Q7: `patches` は clone 間で独立リストになるか？
- **YES**。`n.patches[k] = self.patches[k][:]` により、辞書およびキーごとの patch リストはシャローコピーされ独立しています。一方の clone に `add_patches()` しても他方の clone の `patches` 辞書には影響しません。

### Q8: sampling 直前にどの UNet object が使われるか？
- `p.sd_model.forge_objects.unet`（`modules_forge.unet_patcher.UnetPatcher` インスタンス）。
- `modules_forge/forge_sampler.py` の `forge_sample()` 内で `self.inner_model.inner_model.forge_objects.unet` から `model` や `model_options` が取得され、`ldm_patched.modules.samplers.sampling_function` へ渡されます。

### Q9: `model_function_wrapper` 等、UNet forward を包める hook は存在するか？
- **YES**。`ModelPatcher.set_model_unet_function_wrapper(unet_wrapper_function)`（`model_options["model_function_wrapper"]`）が利用可能。
- `ldm_patched/modules/samplers.py` の `calc_cond_uncond_batch()` 内で以下のように呼び出されます：
  ```python
  if 'model_function_wrapper' in model_options:
      output = model_options['model_function_wrapper'](model.apply_model, {"input": input_x, "timestep": timestep_, "c": c, "cond_or_uncond": cond_or_uncond}).chunk(batch_chunks)
  else:
      output = model.apply_model(input_x, timestep_, **c).chunk(batch_chunks)
  ```
- **注意**: 既存の他 extension が登録した `model_function_wrapper` が存在する場合、上書きせずチェーンするか、競合を回避する必要があります。

### Q10: ControlNet はどの段階で入るか？
- `UnetPatcher.controlnet_linked_list` として保持され、`forge_sampler.py` で `cond` / `uncond` の `control` 属性にセットされ、`samplers.py` の `calc_cond_uncond_batch()` 内で UNet forward 前に `control.get_control(input_x, timestep_, control_cond, len(cond_or_uncond))` として実行され `c['control']` に注入されます。

---

## 2. Patch Registration と Patch Materialization は別段階

reForge の ModelPatcher では、パッチの「登録」と「実体化」が明確に分離されています。

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Patch Registration (add_patches)                         │
│    ・patcher.patches[k] にメタデータタプルを追加するのみ     │
│    ・この時点では self.model のパラメータは一切書き換わらない│
├─────────────────────────────────────────────────────────────┤
│ 2. Patch Materialization (patch_model / patch_weight_to_dev)│
│    ・self.backup[k] に元のベース重みを退避                  │
│    ・calculate_weight() で ΔW を計算して self.model を上書き│
├─────────────────────────────────────────────────────────────┤
│ 3. Patch Restoration (unpatch_model)                        │
│    ・self.backup[k] から元の重みを self.model に書き戻す    │
│    ・self.backup.clear()                                    │
└─────────────────────────────────────────────────────────────┘
```

したがって：
- `clone_A.patches != clone_B.patches` であっても、
- `clone_A.model is clone_B.model` であるため、
- 実際の forward 時にどちらの weight state が materialize されているかを厳格に管理する必要があります。
- 交互に forward を呼ぶ場合、`clone_A.patch_model() -> forward -> clone_A.unpatch_model() -> clone_B.patch_model() -> forward -> clone_B.unpatch_model()` のように必ず unpatch を挟む必要があります。
