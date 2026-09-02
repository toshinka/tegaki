"""
Regional LoRA Lab - Main Script
Version: Phase 0.5 Safety Gate & Spec Freeze
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
        self.original_wrapper = None
        self.installed_wrapper = None
        self.wrapper_call_count = 0
        self.previous_wrapper_inner_model_call_count = 0
        self.wrapper_installed = False
        self.active_mode = None
        self.restore_success = True

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
                    info="未選択の場合はクローンとモデル構造・Wrapper Chainの検証のみ実行します"
                )

            with gr.Row():
                gr.Markdown("""
                > **【Regional LoRA Lab - Phase 0.5 Safety Gate & Spec Freeze】**  
                > ※ 生成結果へRegional処理は適用しません。  
                > Probe中はLoRA weightの一時materialize / restoreおよびWrapper Chainingの検証を行います。  
                > 終了時にbase weightおよびwrapper状態へ完全に復元します（fail-safe recovery対応）。
                """)

        return [is_enabled, mode, selected_lora, debug_log]

    def before_process_batch(self, p, is_enabled, mode, selected_lora, debug_log, *args, **kwargs):
        # --- Safety Gate: Stale RLL Wrapper Recovery ---
        try:
            if hasattr(p, "sd_model") and hasattr(p.sd_model, "forge_objects"):
                unet = getattr(p.sd_model.forge_objects, "unet", None)
                if unet is not None and hasattr(unet, "model_options"):
                    current_wrapper = unet.model_options.get("model_function_wrapper", None)
                    is_rll_stale = (
                        current_wrapper is not None and (
                            current_wrapper is self.installed_wrapper or
                            getattr(current_wrapper, "_rll_wrapper", False)
                        )
                    )
                    if is_rll_stale:
                        if self.original_wrapper is not None:
                            unet.model_options["model_function_wrapper"] = self.original_wrapper
                            print(f"[RLL][Recovery] Stale RLL wrapper recovered. Restored previous wrapper: {self.original_wrapper}")
                        else:
                            unet.model_options.pop("model_function_wrapper", None)
                            print("[RLL][Recovery] Stale RLL wrapper recovered. Cleared model_function_wrapper.")
        except Exception as e:
            print(f"[RLL][ERROR] Recovery check failed: {e}")

        # Current run 用 state の初期化
        self.active_mode = None
        self.restore_success = True
        self.wrapper_call_count = 0
        self.previous_wrapper_inner_model_call_count = 0
        self.original_wrapper = None
        self.installed_wrapper = None
        self.wrapper_installed = False

        if not is_enabled:
            return

        self.active_mode = mode
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

            # --- Phase 0.5: Patcher Residency, Multi-Layer Exact Restore & Wrapper Chaining Probe ---
            if "Phase 0.5:" in mode:
                print("[RLL][Phase 0.5 Probe] ========================================")
                print(f"[RLL][Phase 0.5 Probe] Starting Patcher Residency, Multi-Layer Exact Restore & Wrapper Chaining Probe")

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

                # 2. Wrapper Chaining Probe (Setup dummy chain)
                self.original_wrapper = unet.model_options.get("model_function_wrapper", None)
                prev_wrapper = self.original_wrapper

                def rll_chain_test_wrapper(model_function, params):
                    self.wrapper_call_count += 1
                    if prev_wrapper is not None:
                        def inner_model_fn(input_x, timestep, **c):
                            self.previous_wrapper_inner_model_call_count += 1
                            return model_function(input_x, timestep, **c)
                        out = prev_wrapper(inner_model_fn, params)
                    else:
                        out = model_function(params["input"], params["timestep"], **params["c"])
                    return out

                rll_chain_test_wrapper._rll_wrapper = True
                self.installed_wrapper = rll_chain_test_wrapper
                unet.model_options["model_function_wrapper"] = rll_chain_test_wrapper
                self.wrapper_installed = True

                if prev_wrapper is not None:
                    print(f"[RLL][Wrapper Probe] Existing wrapper detected ({prev_wrapper}). Chained successfully.")
                else:
                    print(f"[RLL][Wrapper Probe] No existing wrapper. Clean RLL test wrapper installed.")

                # 3. Patch Registration & Multi-Layer Exact Tensor Restore Probe
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

                    # 複数層 (3〜5層: Input, Middle, Output, Attention, Conv) の選定
                    candidate_keys = list(clone_A.patches.keys())
                    selected_sample_keys = []

                    for filter_tag in ["input_blocks", "middle_block", "output_blocks", "attn", "conv"]:
                        for k in candidate_keys:
                            if filter_tag in k and k not in selected_sample_keys:
                                selected_sample_keys.append(k)
                                break
                        if len(selected_sample_keys) >= 5:
                            break

                    if not selected_sample_keys and candidate_keys:
                        selected_sample_keys = candidate_keys[:min(5, len(candidate_keys))]

                    print(f"[RLL][Restore Probe] Selecting {len(selected_sample_keys)} representative layers across blocks for Exact Restore test:")
                    for idx, sk in enumerate(selected_sample_keys):
                        print(f"  [{idx + 1}] {sk}")

                    # Step 1: Base snapshots の保存 (detach().clone())
                    base_snapshots = {}
                    for sk in selected_sample_keys:
                        raw_w = ldm_patched.modules.utils.get_attr(clone_A.model, sk)
                        base_snapshots[sk] = raw_w.detach().clone()

                    t_patch = 0.0
                    t_unpatch = 0.0

                    try:
                        # Step 2: Materialization (patch_model)
                        t_p0 = time.perf_counter()
                        clone_A.patch_model()
                        t_patch = (time.perf_counter() - t_p0) * 1000.0

                        # Materialized 状態の検証 (変化していることの確認)
                        any_changed = False
                        for sk in selected_sample_keys:
                            mat_w = ldm_patched.modules.utils.get_attr(clone_A.model, sk)
                            if not torch.equal(base_snapshots[sk], mat_w):
                                any_changed = True

                        print(f"[RLL][Materialization Probe] patch_model() executed in {t_patch:.2f} ms (Weight delta verified: {any_changed})")

                    finally:
                        # Step 3: Emergency & Normal Restoration (unpatch_model)
                        # patch_model() が途中で例外を出した場合でも backup が存在すれば必ず復元を試みる
                        try:
                            if getattr(clone_A, "backup", None) or hasattr(clone_A, "unpatch_model"):
                                t_u0 = time.perf_counter()
                                clone_A.unpatch_model()
                                t_unpatch = (time.perf_counter() - t_u0) * 1000.0
                                print(f"[RLL][Materialization Probe] unpatch_model() executed in {t_unpatch:.2f} ms")
                                print(f"[RLL][Timing Probe] Roundtrip repatch cost: {t_patch + t_unpatch:.2f} ms per step")
                        except Exception as cleanup_error:
                            print(f"[RLL][ERROR] Emergency unpatch failed: {cleanup_error}")
                            self.restore_success = False

                    # Step 4: Exact Tensor Comparison
                    all_exact = True
                    for idx, sk in enumerate(selected_sample_keys):
                        restored_w = ldm_patched.modules.utils.get_attr(clone_A.model, sk).detach()
                        base_snap = base_snapshots[sk]

                        exact_equal = torch.equal(base_snap, restored_w)
                        diff = (base_snap.float() - restored_w.float()).abs()
                        max_abs_diff = diff.max().item()
                        mean_abs_diff = diff.mean().item()

                        print(f"[RLL][Restore Probe] Layer [{idx + 1}] {sk[:55]}...")
                        print(f"  torch.equal   = {exact_equal}")
                        print(f"  max_abs_diff  = {max_abs_diff:.8f}")
                        print(f"  mean_abs_diff = {mean_abs_diff:.8f}")

                        if not exact_equal or max_abs_diff > 0.0:
                            all_exact = False

                    self.restore_success = all_exact
                    if all_exact:
                        print(f"[RLL][Restore Probe][SUCCESS] All {len(selected_sample_keys)} layers bit-exact restored (max_abs_diff = 0.0). No residual contamination detected.")
                    else:
                        print(f"[RLL][Restore Probe][WARN] Some layers showed numerical differences after unpatch.")

                else:
                    print(f"[RLL][Residency Probe] No LoRA selected for materialization test (Select a LoRA in dropdown to test weight delta & timing).")

                print("[RLL][Phase 0.5 Probe] ========================================")

        except Exception as e:
            print(f"[RLL][Probe][ERROR] Error during Phase 0.5 probe: {e}")
            import traceback
            traceback.print_exc()

    def postprocess(self, p, processed, is_enabled, mode, selected_lora, debug_log, *args, **kwargs):
        if not is_enabled:
            return

        # Fail-safe restoration of original wrapper in model_options
        wrapper_cleanup_ok = True
        try:
            if hasattr(p, "sd_model") and hasattr(p.sd_model, "forge_objects"):
                unet = getattr(p.sd_model.forge_objects, "unet", None)
                if unet is not None and hasattr(unet, "model_options"):
                    current_wrapper = unet.model_options.get("model_function_wrapper", None)
                    if current_wrapper is self.installed_wrapper or getattr(current_wrapper, "_rll_wrapper", False):
                        if self.original_wrapper is not None:
                            unet.model_options["model_function_wrapper"] = self.original_wrapper
                        else:
                            unet.model_options.pop("model_function_wrapper", None)
                        if debug_log and self.wrapper_installed:
                            print(f"[RLL][Wrapper Probe] Cleanup: Restored model_function_wrapper. Total RLL wrapper calls = {self.wrapper_call_count}, Prev wrapper inner calls = {self.previous_wrapper_inner_model_call_count}")
        except Exception as e:
            print(f"[RLL][ERROR] Error restoring wrapper during postprocess: {e}")
            wrapper_cleanup_ok = False
        finally:
            self.wrapper_installed = False

        if debug_log:
            if "Phase 0:" in str(mode):
                print("[RLL][Probe] Completed (read-only probe).")
            elif "Phase 0.5:" in str(mode):
                if self.restore_success and wrapper_cleanup_ok:
                    print("[RLL][Probe] Completed Phase 0.5. Temporary model patching and wrapper were safely restored before exit.")
                else:
                    print("[RLL][ERROR] Restore verification or wrapper cleanup failed.")
