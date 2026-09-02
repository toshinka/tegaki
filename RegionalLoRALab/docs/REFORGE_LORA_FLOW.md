# reForge LoRA Loading & Sampling Execution Flow Analysis

> **Target Platform**: `stable-diffusion-webui-reForge` (commit `19395bf96ccdc605774c76a9fe8cc7145b637128`)  
> **Investigation Date**: 2026-09-02  
> **Source Files Inspected**:
> - `extensions-builtin/Lora/networks.py`
> - `ldm_patched/modules/sd.py`
> - `ldm_patched/modules/lora.py`
> - `ldm_patched/modules/model_patcher.py`
> - `modules_forge/unet_patcher.py`
> - `modules_forge/forge_sampler.py`
> - `ldm_patched/modules/samplers.py`

---

## 1. 10大基本設問への直接回答 (Section 14.2 Answers)

### Q1: `<lora:...>` はどこで解釈されるか？
- `modules/extra_networks.py` および `extensions-builtin/Lora/networks.py` の `load_networks()` でパースされます。
- WebUI のプロンプト文字列から `<lora:NAME:UNET_MULT:TE_MULT>` が抽出され、`extra-network` 処理によって LoRA 名と各 multiplier がリスト化されます。

### Q2: LoRA state dict はどこでロードされるか？
- `extensions-builtin/Lora/networks.py` の `load_lora_state_dict(filename)` により、`ldm_patched.modules.utils.load_torch_file(filename, safe_load=True)` を経由してロードされます（LRUキャッシュ対応）。

### Q3: UNet patcher へどの関数で patch が追加されるか？
- `ldm_patched/modules/sd.py` の `load_lora_for_models(model, clip, lora, strength_model, strength_clip, filename)` 内で:
  1. `key_map = ldm_patched.modules.lora.model_lora_keys_unet(model.model, key_map)` でキーマップ作成。
  2. `loaded = ldm_patched.modules.lora.load_lora(lora, key_map)` で LoRA テンソルを変換。
  3. `new_modelpatcher = model.clone()` で複製。
  4. `new_modelpatcher.add_patches(loaded, strength_model)` により patch タプル `(strength_patch, patch_tuple, strength_model)` が `new_modelpatcher.patches[k]` リストへ追加されます。

### Q4: CLIP patcher へどの関数で patch が追加されるか？
- 同様に `ldm_patched/modules/sd.py` の `load_lora_for_models()` 内で:
  1. `key_map = ldm_patched.modules.lora.model_lora_keys_clip(clip.cond_stage_model, key_map)`
  2. `new_clip = clip.clone()`
  3. `new_clip.add_patches(loaded, strength_clip)` により追加されます。

### Q5: `UnetPatcher.clone()` は使えるか？
- **YES (完全対応)**。`modules_forge/unet_patcher.py` で定義されています：
  ```python
  def clone(self):
      n = UnetPatcher(self.model, self.load_device, self.offload_device, self.size, self.current_device,
                      weight_inplace_update=self.weight_inplace_update)
      n.patches = {}
      for k in self.patches:
          n.patches[k] = self.patches[k][:]
      n.object_patches = self.object_patches.copy()
      n.model_options = copy.deepcopy(self.model_options)
      ...
      return n
  ```

### Q6: clone は同じ underlying model を共有するか？
- **YES**。`clone()` は `self.model`（内部の `diffusion_model` PyTorch モジュール）をそのまま参照渡しし、メモリを浪費せずに同じベースモデルを共有します。

### Q7: `patches` は clone 間で独立リストになるか？
- **YES**。`n.patches[k] = self.patches[k][:]` により、辞書およびキーごとの patch リストはシャローコピーされ独立しています。一方の clone に `add_patches()` しても他方の clone の `patches` は変化しません。

### Q8: sampling 直前にどの UNet object が使われるか？
- `p.sd_model.forge_objects.unet`（`modules_forge.unet_patcher.UnetPatcher` インスタンス）。
- `modules_forge/forge_sampler.py` の `forge_sample()` 内で `self.inner_model.inner_model.forge_objects.unet` から `model` や `model_options` が取得され、`ldm_patched.modules.samplers.sampling_function` へ渡されます。

### Q9: `model_function_wrapper` 等、UNet forward を包める hook は存在するか？
- **YES (極めて強力なHookが存在)**。
- `ModelPatcher.set_model_unet_function_wrapper(unet_wrapper_function)`（`model_options["model_function_wrapper"]`）が利用可能。
- `ldm_patched/modules/samplers.py` の `calc_cond_uncond_batch()` 内で以下のように呼び出されます：
  ```python
  if 'model_function_wrapper' in model_options:
      output = model_options['model_function_wrapper'](model.apply_model, {"input": input_x, "timestep": timestep_, "c": c, "cond_or_uncond": cond_or_uncond}).chunk(batch_chunks)
  else:
      output = model.apply_model(input_x, timestep_, **c).chunk(batch_chunks)
  ```
- さらに `sampler_pre_cfg_function`, `sampler_cfg_function`, `sampler_post_cfg_function` も利用可能です。

### Q10: ControlNet はどの段階で入るか？
- `UnetPatcher.controlnet_linked_list` として保持され、`forge_sampler.py` で `cond` / `uncond` の `control` 属性にセットされ、`samplers.py` の `calc_cond_uncond_batch()` 内で UNet forward 前に `control.get_control(input_x, timestep_, control_cond, len(cond_or_uncond))` として実行され `c['control']` に注入されます。

---

## 2. LoRA 適用からサンプリングまでの完全ライフサイクル

```text
1. Prompt Parsing
   WebUI Prompt -> Extra Networks (<lora:A:1.0>)
        │
2. LoRA Loading & Patch Registration (networks.load_networks)
   - load_lora_state_dict(filename)
   - key_map = model_lora_keys_unet(model.model)
   - loaded = load_lora(lora_sd, key_map)
   - unet = unet.clone()
   - unet.add_patches(loaded, strength_model)  -> unet.patches[k] に登録
        │
3. Extension Hook (after_extra_networks_activate / process_before_every_sampling)
   - p.sd_model.forge_objects.unet の差し替えや model_options の設定
        │
4. Sampling Loop (forge_sampler.py -> samplers.py: sampling_function)
   - for step in steps:
       - calc_cond_uncond_batch(model, cond, uncond, x_in, timestep, model_options)
           - if 'model_function_wrapper' in model_options:
                 output = model_function_wrapper(model.apply_model, {...})
             else:
                 output = model.apply_model(input_x, timestep_, **c)
```
