"""
Regional LoRA Lab - Main Script
Version: Phase 0.5 (Patch Residency & Wrapper Chaining Probe)
Project: Regional LoRA Engine for Stable Diffusion WebUI reForge
"""

import os
import sys
import time
import math
import torch
import gradio as gr
import modules.scripts as scripts
from modules import shared, errors

try:
    import ldm_patched.modules.lora
    import ldm_patched.modules.utils
except ImportError:
    pass

def get_available_lora_names():
    lora_dir = getattr(shared.cmd_opts, "lora_dir", None)
    if not lora_dir or not os.path.exists(lora_dir):
        return []
    candidates = list(shared.walk_files(lora_dir, allowed_extensions=[".pt", ".ckpt", ".safetensors"]))
    names = []
    for f in candidates:
        rel = os.path.relpath(f, lora_dir)
        names.append(os.path.splitext(rel)[0])
    return sorted(names)

def find_lora_file_by_name(name):
    lora_dir = getattr(shared.cmd_opts, "lora_dir", None)
    if not lora_dir or not os.path.exists(lora_dir):
        return None
    for ext in [".safetensors", ".pt", ".ckpt"]:
        cand = os.path.join(lora_dir, name + ext)
        if os.path.exists(cand):
            return cand
    for f in shared.walk_files(lora_dir, allowed_extensions=[".pt", ".ckpt", ".safetensors"]):
        if os.path.splitext(os.path.basename(f))[0] == name or os.path.splitext(os.path.relpath(f, lora_dir))[0] == name:
            return f
    return None

class RegionalLoRALabScript(scripts.Script):
    def __init__(self):
        super().__init__()
        self.last_probe_result = None

    def title(self):
        return "Regional LoRA Lab (Research)"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        lora_list = ["(None)"] + get_available_lora_names()

        with gr.Accordion("🔬 Regional LoRA Lab (Research / 実験用)", open=False, elem_id="regional-lora-lab-accordion"):
            with gr.Row():
                is_enabled = gr.Checkbox(label="有効化 (Enable Regional LoRA Lab)", value=False, elem_id="rll-enabled")
                mode = gr.Dropdown(
                    label="動作モード (Mode)", 
                    choices=[
                        "Phase 0: Read-only Probe (モデル情報診断)",
                        "Phase 0.5: Patcher Residency Probe (パッチ実体化・クローン挙動診断)"
                    ], 
                    value="Phase 0.5: Patcher Residency Probe (パッチ実体化・クローン挙動診断)"
                )
                debug_log = gr.Checkbox(label="詳細ログ出力 (Debug Log)", value=True, elem_id="rll-debug-log")

            with gr.Row():
                selected_lora = gr.Dropdown(
                    label="テスト用LoRA (Phase 0.5 実体化プローブ用)", 
                    choices=lora_list, 
                    value="(None)",
                    info="未選択の場合はクローンとモデル構造の検証のみ実行します"
                )

            with gr.Row():
                gr.Markdown("""
                > **【Regional LoRA Lab - Phase 0.5 稼働中】**  
                > 共有 underlying model における `UnetPatcher.clone()` の独立性、`patch_model()` / `unpatch_model()` による重み実体化（Materialization）の所要時間・復元完全性、および `model_function_wrapper` のチェーン性を診断します。  
                > ※ 生成テンソルへの変更は行いません（完全安全検証）。
                """)

        return [is_enabled, mode, selected_lora, debug_log]

    def before_process_batch(self, p, is_enabled, mode, selected_lora, debug_log, *args, **kwargs):
        if not is_enabled:
            return

        if debug_log:
            prompts = kwargs.get("prompts", [getattr(p, 'prompt', '')])
            raw_prompt = prompts[0] if isinstance(prompts, list) and prompts else str(prompts)
            print("[RLL][Probe] before_process_batch triggered")
            print(f"[RLL][Probe] Raw prompt preview: {raw_prompt[:80]!r}...")

    def process_before_every_sampling(self, p, is_enabled, mode, selected_lora, debug_log, *args, **kwargs):
        if not is_enabled:
            return

        try:
            if not hasattr(p, "sd_model") or not hasattr(p.sd_model, "forge_objects"):
                print("[RLL][Probe][WARN] p.sd_model.forge_objects not found.")
                return

            unet = getattr(p.sd_model.forge_objects, "unet", None)
            clip = getattr(p.sd_model.forge_objects, "clip", None)

            if unet is None:
                print("[RLL][Probe][WARN] forge_objects.unet is None.")
                return

            # --- Phase 0: Read-only Probe ---
            if "Phase 0:" in mode:
                if debug_log:
                    patcher_cls = type(unet).__name__
                    patches_dict = getattr(unet, "patches", {})
                    patches_count = sum(len(v) for v in patches_dict.values()) if isinstance(patches_dict, dict) else 0
                    model_options = getattr(unet, "model_options", {})
                    has_wrapper = "model_function_wrapper" in model_options
                    has_controlnet = getattr(unet, "controlnet_linked_list", None) is not None

                    print("[RLL][Probe] ========================================")
                    print(f"[RLL][Probe] Enabled: Mode = {mode}")
                    print(f"[RLL][Probe] UNet patcher class = {patcher_cls}")
                    print(f"[RLL][Probe] Total active patches in UNet = {patches_count} across {len(patches_dict)} layers")
                    print(f"[RLL][Probe] model_function_wrapper present = {has_wrapper}")
                    print(f"[RLL][Probe] controlnet_linked_list present = {has_controlnet}")
                    print(f"[RLL][Probe] CLIP patcher class = {type(clip).__name__ if clip else 'None'}")
                    print("[RLL][Probe] ========================================")
                return

            # --- Phase 0.5: Patcher Residency Probe ---
            if "Phase 0.5:" in mode:
                print("[RLL][Phase 0.5 Probe] ========================================")
                print(f"[RLL][Phase 0.5 Probe] Starting Patcher Residency & Materialization Probe")

                # 1. Identity Probe
                clone_A = unet.clone()
                clone_B = unet.clone()

                same_patcher = (id(unet) == id(clone_A))
                same_model = (id(unet.model) == id(clone_A.model))
                same_patches_dict = (id(unet.patches) == id(clone_A.patches))
                same_model_options = (id(unet.model_options) == id(clone_A.model_options))

                print(f"[RLL][Identity Probe] Base UNet ID       : {id(unet):#x}")
                print(f"[RLL][Identity Probe] Clone A ID         : {id(clone_A):#x} (is separate: {not same_patcher})")
                print(f"[RLL][Identity Probe] Clone B ID         : {id(clone_B):#x}")
                print(f"[RLL][Identity Probe] Underlying Model ID: {id(unet.model):#x} (is shared: {same_model})")
                print(f"[RLL][Identity Probe] Patches Dict ID    : Base={id(unet.patches):#x}, A={id(clone_A.patches):#x} (is separate: {not same_patches_dict})")
                print(f"[RLL][Identity Probe] Model Options ID   : Base={id(unet.model_options):#x}, A={id(clone_A.model_options):#x} (is separate: {not same_model_options})")

                # 2. Wrapper Chaining Probe
                existing_wrapper = unet.model_options.get("model_function_wrapper", None)
                if existing_wrapper is not None:
                    print(f"[RLL][Wrapper Probe][WARN] Existing model_function_wrapper detected ({existing_wrapper}). Chaining required.")
                else:
                    print(f"[RLL][Wrapper Probe] No existing model_function_wrapper. Clean intercept point available.")

                # 3. Patch Registration & Weight Residency Probe
                lora_file = find_lora_file_by_name(selected_lora) if selected_lora and selected_lora != "(None)" else None

                if lora_file and os.path.exists(lora_file):
                    print(f"[RLL][Residency Probe] Probing with LoRA file: {os.path.basename(lora_file)}")
                    t0 = time.perf_counter()
                    lora_sd = ldm_patched.modules.utils.load_torch_file(lora_file, safe_load=True)
                    t_load = (time.perf_counter() - t0) * 1000.0

                    key_map = ldm_patched.modules.lora.model_lora_keys_unet(clone_A.model, {})
                    loaded = ldm_patched.modules.lora.load_lora(lora_sd, key_map)

                    len_base_before = len(unet.patches)
                    len_B_before = len(clone_B.patches)

                    # clone_A にのみ登録
                    clone_A.add_patches(loaded, strength_model=1.0)

                    len_A_after = len(clone_A.patches)
                    len_base_after = len(unet.patches)
                    len_B_after = len(clone_B.patches)

                    print(f"[RLL][Registration Probe] State dict load time: {t_load:.2f} ms")
                    print(f"[RLL][Registration Probe] Active patches count: Base={len_base_after} (was {len_base_before}), Clone_A={len_A_after}, Clone_B={len_B_after} (was {len_B_before})")
                    assert len_base_before == len_base_after, "Base patches modified unexpectedly!"
                    assert len_B_before == len_B_after, "Clone B patches modified unexpectedly!"

                    # 対象重みの特定 (代表層)
                    sample_key = None
                    for k in clone_A.patches:
                        if hasattr(clone_A.model, "diffusion_model"):
                            sample_key = k
                            break

                    if sample_key:
                        raw_weight = ldm_patched.modules.utils.get_attr(clone_A.model, sample_key)
                        norm_base = raw_weight.float().norm().item()

                        # Materialization (patch_model)
                        t_p0 = time.perf_counter()
                        clone_A.patch_model()
                        t_patch = (time.perf_counter() - t_p0) * 1000.0

                        mat_weight = ldm_patched.modules.utils.get_attr(clone_A.model, sample_key)
                        norm_patched = mat_weight.float().norm().item()

                        # Restoration (unpatch_model)
                        t_u0 = time.perf_counter()
                        clone_A.unpatch_model()
                        t_unpatch = (time.perf_counter() - t_u0) * 1000.0

                        restored_weight = ldm_patched.modules.utils.get_attr(clone_A.model, sample_key)
                        norm_restored = restored_weight.float().norm().item()

                        is_restored_exact = math.isclose(norm_base, norm_restored, rel_tol=1e-5, abs_tol=1e-6)
                        weight_changed = not math.isclose(norm_base, norm_patched, rel_tol=1e-5, abs_tol=1e-6)

                        print(f"[RLL][Materialization Probe] Sample Layer : {sample_key}")
                        print(f"[RLL][Materialization Probe] Base Weight Norm      : {norm_base:.6f}")
                        print(f"[RLL][Materialization Probe] Materialized Norm (A)  : {norm_patched:.6f} (Changed: {weight_changed})")
                        print(f"[RLL][Materialization Probe] Restored Base Norm     : {norm_restored:.6f} (Exact Match: {is_restored_exact})")
                        print(f"[RLL][Timing Probe] patch_model() time       : {t_patch:.2f} ms")
                        print(f"[RLL][Timing Probe] unpatch_model() time     : {t_unpatch:.2f} ms")
                        print(f"[RLL][Timing Probe] Roundtrip repatch cost   : {t_patch + t_unpatch:.2f} ms per step")
                else:
                    print(f"[RLL][Residency Probe] No LoRA selected for materialization test (Select a LoRA in dropdown to test weight delta & timing).")

                print("[RLL][Phase 0.5 Probe] ========================================")

        except Exception as e:
            print(f"[RLL][Probe][ERROR] Error during Phase 0.5 probe: {e}")
            import traceback
            traceback.print_exc()

    def postprocess(self, p, processed, is_enabled, mode, selected_lora, debug_log, *args, **kwargs):
        if is_enabled and debug_log:
            print("[RLL][Probe] Completed (read-only probe).")
