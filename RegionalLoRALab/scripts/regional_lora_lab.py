"""
Regional LoRA Lab - Main Script
Version: Phase 1 Multi-Pass Oracle PoC (Pre-Validation Stabilized)
Project: Regional LoRA Engine for Stable Diffusion WebUI reForge
"""

import os
import sys
import re
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
    if not name or name == "(None)":
        return None
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
        self.is_img2img_tab = False
        
        # Phase 1 runtime state
        self.phase1_blocked = False
        self.phase1_block_reason = ""
        self.phase1_fatal_error = False
        self.clone_A = None
        self.clone_B = None
        self.step_timings = []
        self.mask_logged = False
        self.is_same_lora = False
        self.same_lora_diffs = []
        self.accepted_count_A = 0
        self.accepted_count_B = 0

    def title(self):
        return "Regional LoRA Lab (Research)"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        self.is_img2img_tab = is_img2img
        lora_list = ["(None)"] + get_available_lora_names()

        with gr.Accordion("🔬 Regional LoRA Lab (Research / 実験用)", open=False, elem_id="regional-lora-lab-accordion"):
            with gr.Row():
                is_enabled = gr.Checkbox(label="有効化 (Enable Regional LoRA Lab)", value=False, elem_id="rll-enabled")
                mode = gr.Dropdown(
                    label="動作モード (Mode)", 
                    choices=[
                        "Phase 1: 2-Region Multi-Pass Oracle (左右2分割・基準正解系生成)",
                        "Phase 0.5: Patcher Residency Probe (パッチ実体化・クローン挙動診断)",
                        "Phase 0: Read-only Probe (モデル情報診断)"
                    ], 
                    value="Phase 1: 2-Region Multi-Pass Oracle (左右2分割・基準正解系生成)"
                )
                debug_log = gr.Checkbox(label="詳細ログ出力 (Debug Log)", value=True, elem_id="rll-debug-log")

            # Phase 1 Settings
            with gr.Group(visible=True) as phase1_group:
                with gr.Row():
                    lora_A = gr.Dropdown(
                        label="左領域 (Left 50%) LoRA A", 
                        choices=lora_list, 
                        value="(None)",
                        info="左半分に適用するUNet LoRA"
                    )
                    weight_A = gr.Slider(
                        label="LoRA A 強度 (strength_patch)", 
                        minimum=0.0, 
                        maximum=2.0, 
                        step=0.05, 
                        value=1.0
                    )

                with gr.Row():
                    lora_B = gr.Dropdown(
                        label="右領域 (Right 50%) LoRA B", 
                        choices=lora_list, 
                        value="(None)",
                        info="右半分に適用するUNet LoRA"
                    )
                    weight_B = gr.Slider(
                        label="LoRA B 強度 (strength_patch)", 
                        minimum=0.0, 
                        maximum=2.0, 
                        step=0.05, 
                        value=1.0
                    )

            # Phase 0.5 Probe Settings
            with gr.Group(visible=False) as probe_group:
                selected_lora_probe = gr.Dropdown(
                    label="テスト用LoRA (Phase 0.5 実体化プローブ用)", 
                    choices=lora_list, 
                    value="(None)",
                    info="未選択の場合はクローンとモデル構造・Wrapper Chainの検証のみ実行します"
                )

            # UI Mode visibility switcher
            def update_mode_visibility(selected_mode):
                is_p1 = "Phase 1:" in selected_mode
                return gr.update(visible=is_p1), gr.update(visible=not is_p1)

            mode.change(
                fn=update_mode_visibility,
                inputs=[mode],
                outputs=[phase1_group, probe_group]
            )

            with gr.Row():
                gr.Markdown("""
                > **【Phase 1: 2-Region Multi-Pass Oracle (Pre-Validation Stabilized)】**  
                > - **分割構造**: 左右 50:50 固定 (Hard Binary Mask: `mask_A + mask_B = 1.0`)  
                > - **LoRA 強度**: `strength_patch` にマップ (`strength_model = 1.0` 固定)  
                > - **LoRA 適用**: Standard UNet LoRA Only (Text Encoder multiplier = 0)  
                > - **プロンプト制約**: 通常のトリガー単語は許可、`<lora:...>` タグは禁止 (Lab側で直接管理)  
                > - **前提条件**: txt2img only, Batch Size 1, Hires fix OFF, ControlNet OFF, 他の Model Wrapper/Patch OFF
                """)

        return [is_enabled, mode, lora_A, weight_A, lora_B, weight_B, selected_lora_probe, debug_log]

    def before_process_batch(self, p, is_enabled, mode, lora_A, weight_A, lora_B, weight_B, selected_lora_probe, debug_log, *args, **kwargs):
        # --- Safety Gate: Stale RLL Wrapper Recovery ---
        try:
            if hasattr(p, "sd_model") and hasattr(p.sd_model, "forge_objects"):
                unet = getattr(p.sd_model.forge_objects, "unet", None)
                if unet is not None and hasattr(unet, "model_options"):
                    current_wrapper = unet.model_options.get("model_function_wrapper", None)
                    if getattr(current_wrapper, "_rll_wrapper", False):
                        previous = getattr(current_wrapper, "_rll_previous_wrapper", None)
                        if previous is not None:
                            unet.model_options["model_function_wrapper"] = previous
                            print(f"[RLL][Recovery] Stale RLL wrapper recovered. Restored previous wrapper: {previous}")
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
        
        self.phase1_blocked = False
        self.phase1_block_reason = ""
        self.phase1_fatal_error = False
        self.clone_A = None
        self.clone_B = None
        self.step_timings = []
        self.mask_logged = False
        self.is_same_lora = False
        self.same_lora_diffs = []
        self.accepted_count_A = 0
        self.accepted_count_B = 0

        if not is_enabled:
            return

        self.active_mode = mode

        # --- Phase 1 Preflight & Frozen Scope Checks ---
        if "Phase 1:" in mode:
            # Check 1: txt2img only (img2img is out of Phase 1 scope)
            if getattr(self, "is_img2img_tab", False):
                self.phase1_blocked = True
                self.phase1_block_reason = "img2img is out of scope for Phase 1 validation (txt2img only)."
                print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")

            # Check 2: Batch Size must be 1
            if getattr(p, "batch_size", 1) != 1:
                self.phase1_blocked = True
                self.phase1_block_reason = f"Batch size must be 1 in Phase 1 (got batch_size={getattr(p, 'batch_size', 1)})."
                print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")

            # Check 3: Hires fix must be OFF
            if getattr(p, "enable_hr", False):
                self.phase1_blocked = True
                self.phase1_block_reason = "Hires fix is not supported in Phase 1 validation."
                print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")

            # Check 4: Ordinary <lora:...> tags in prompt
            prompts = kwargs.get("prompts", [getattr(p, 'prompt', '')])
            raw_prompt = prompts[0] if isinstance(prompts, list) and prompts else str(prompts)
            
            lora_tag_regex = re.compile(r"<lora:[^>]+>", re.IGNORECASE)
            detected_tags = lora_tag_regex.findall(raw_prompt)
            
            if detected_tags:
                self.phase1_blocked = True
                self.phase1_block_reason = f"Ordinary <lora:...> tag(s) detected: {detected_tags}. Regional LoRA Lab manages LoRA loading itself."
                print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")
                print("[RLL][Phase1][BLOCKED] Stripping <lora:...> tags to prevent global model corruption.")
                
                clean_prompt = lora_tag_regex.sub("", raw_prompt).strip()
                if isinstance(prompts, list) and len(prompts) > 0:
                    prompts[0] = clean_prompt
                if hasattr(p, 'prompt') and isinstance(p.prompt, str):
                    p.prompt = lora_tag_regex.sub("", p.prompt).strip()

            # Check 5: LoRA selections
            if not lora_A or lora_A == "(None)" or not lora_B or lora_B == "(None)":
                self.phase1_blocked = True
                self.phase1_block_reason = f"Both LoRA A and LoRA B must be selected (Current: A='{lora_A}', B='{lora_B}')."
                print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")

            # Record if Same A/A condition for numerical testing
            if lora_A == lora_B and abs(float(weight_A) - float(weight_B)) < 1e-5 and not self.phase1_blocked:
                self.is_same_lora = True

            # Record Block metadata in infotext if blocked
            if self.phase1_blocked and hasattr(p, "extra_generation_params"):
                p.extra_generation_params["RLL Status"] = "BLOCKED (BASE FALLBACK OUTPUT - NOT VALID FOR REGIONAL TEST)"
                p.extra_generation_params["RLL Block Reason"] = self.phase1_block_reason

        if debug_log:
            prompts = kwargs.get("prompts", [getattr(p, 'prompt', '')])
            raw_prompt = prompts[0] if isinstance(prompts, list) and prompts else str(prompts)
            print("[RLL][Probe] before_process_batch triggered")
            print(f"[RLL][Probe] Raw prompt preview: {raw_prompt[:80]!r}...")

    def process_before_every_sampling(self, p, is_enabled, mode, lora_A, weight_A, lora_B, weight_B, selected_lora_probe, debug_log, *args, **kwargs):
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

            # --- Phase 0.5: Patcher Residency & Multi-Layer Exact Restore Probe ---
            if "Phase 0.5:" in mode:
                print("[RLL][Phase 0.5 Probe] ========================================")
                print(f"[RLL][Phase 0.5 Probe] Starting Patcher Residency & Multi-Layer Exact Restore Probe")

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
                rll_chain_test_wrapper._rll_previous_wrapper = prev_wrapper
                self.installed_wrapper = rll_chain_test_wrapper
                unet.model_options["model_function_wrapper"] = rll_chain_test_wrapper
                self.wrapper_installed = True

                # 3. Patch Registration & Multi-Layer Exact Tensor Restore Probe
                lora_file = find_lora_file_by_name(selected_lora_probe) if selected_lora_probe and selected_lora_probe != "(None)" else None

                if lora_file and os.path.exists(lora_file):
                    print(f"[RLL][Residency Probe] Probing with LoRA file: {os.path.basename(lora_file)}")
                    t0 = time.perf_counter()
                    lora_sd = ldm_patched.modules.utils.load_torch_file(lora_file, safe_load=True)
                    t_load = (time.perf_counter() - t0) * 1000.0

                    key_map = ldm_patched.modules.lora.model_lora_keys_unet(clone_A.model, {})
                    loaded = ldm_patched.modules.lora.load_lora(lora_sd, key_map)

                    clone_A.add_patches(loaded, strength_patch=1.0, strength_model=1.0)

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

                    base_snapshots = {}
                    for sk in selected_sample_keys:
                        raw_w = ldm_patched.modules.utils.get_attr(clone_A.model, sk)
                        base_snapshots[sk] = raw_w.detach().clone()

                    t_patch = 0.0
                    t_unpatch = 0.0

                    try:
                        t_p0 = time.perf_counter()
                        clone_A.patch_model()
                        t_patch = (time.perf_counter() - t_p0) * 1000.0
                    finally:
                        try:
                            t_u0 = time.perf_counter()
                            clone_A.unpatch_model()
                            t_unpatch = (time.perf_counter() - t_u0) * 1000.0
                        except Exception as cleanup_error:
                            print(f"[RLL][ERROR] Emergency unpatch failed: {cleanup_error}")
                            self.restore_success = False

                    all_exact = True
                    for idx, sk in enumerate(selected_sample_keys):
                        restored_w = ldm_patched.modules.utils.get_attr(clone_A.model, sk).detach()
                        base_snap = base_snapshots[sk]

                        exact_equal = torch.equal(base_snap, restored_w)
                        diff = (base_snap.float() - restored_w.float()).abs()
                        max_abs_diff = diff.max().item()

                        if not exact_equal or max_abs_diff > 0.0:
                            all_exact = False

                    self.restore_success = self.restore_success and all_exact
                    if self.restore_success:
                        print(f"[RLL][Restore Probe][SUCCESS] All {len(selected_sample_keys)} layers bit-exact restored.")
                    else:
                        print(f"[RLL][Restore Probe][WARN] Exact restore verification failed.")

                print("[RLL][Phase 0.5 Probe] ========================================")
                return

            # --- Phase 1: 2-Region Multi-Pass Oracle Generation ---
            if "Phase 1:" in mode:
                if self.phase1_blocked:
                    print(f"[RLL][Phase1][BLOCKED] Oracle wrapper was NOT installed. Generating base fallback output. (Reason: {self.phase1_block_reason})")
                    return

                # Check: ControlNet active check
                if getattr(unet, "controlnet_linked_list", None) is not None:
                    self.phase1_blocked = True
                    self.phase1_block_reason = "ControlNet is active (controlnet_linked_list is not None). ControlNet must be OFF in Phase 1."
                    print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")
                    return

                # Check: Base UNet must not contain existing model patches
                base_patches = getattr(unet, "patches", {})
                if base_patches and len(base_patches) > 0:
                    self.phase1_blocked = True
                    self.phase1_block_reason = f"Base UNet already contains {len(base_patches)} patches. Clean base state required."
                    print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")
                    return

                # Check: Existing model_function_wrapper must be None (fail-closed for Phase 1)
                existing_wrapper = unet.model_options.get("model_function_wrapper", None)
                if existing_wrapper is not None:
                    self.phase1_blocked = True
                    self.phase1_block_reason = f"Existing model_function_wrapper detected ({existing_wrapper}). Fail-closed policy for Phase 1."
                    print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")
                    return

                # Load LoRA A and LoRA B files
                file_A = find_lora_file_by_name(lora_A)
                file_B = find_lora_file_by_name(lora_B)

                if not file_A or not os.path.exists(file_A):
                    self.phase1_blocked = True
                    self.phase1_block_reason = f"LoRA A file not found: {lora_A}"
                    print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")
                    return

                if not file_B or not os.path.exists(file_B):
                    self.phase1_blocked = True
                    self.phase1_block_reason = f"LoRA B file not found: {lora_B}"
                    print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")
                    return

                print("[RLL][Phase1] ========================================")
                print(f"[RLL][Phase1] Building Multi-Pass Oracle Branches:")
                print(f"  Branch A (Left 50%) : {os.path.basename(file_A)} (strength_patch = {weight_A:.2f}, strength_model = 1.0)")
                print(f"  Branch B (Right 50%): {os.path.basename(file_B)} (strength_patch = {weight_B:.2f}, strength_model = 1.0)")
                print(f"  Text Encoder LoRA  : DISABLED (Multiplier = 0.0)")

                # Load State Dicts & Build UNet Patches (1回のみロード)
                t0 = time.perf_counter()
                sd_A = ldm_patched.modules.utils.load_torch_file(file_A, safe_load=True)
                sd_B = ldm_patched.modules.utils.load_torch_file(file_B, safe_load=True)

                self.clone_A = unet.clone()
                self.clone_B = unet.clone()

                key_map_A = ldm_patched.modules.lora.model_lora_keys_unet(self.clone_A.model, {})
                loaded_A = ldm_patched.modules.lora.load_lora(sd_A, key_map_A)
                
                # CRITICAL 1.1: Map UI slider to strength_patch, never strength_model
                accepted_A = self.clone_A.add_patches(loaded_A, strength_patch=float(weight_A), strength_model=1.0)
                self.accepted_count_A = len(accepted_A) if isinstance(accepted_A, (list, set, dict)) else len(self.clone_A.patches)

                if self.accepted_count_A == 0:
                    self.phase1_blocked = True
                    self.phase1_block_reason = f"LoRA A produced zero compatible UNet patches for this checkpoint."
                    print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")
                    return

                key_map_B = ldm_patched.modules.lora.model_lora_keys_unet(self.clone_B.model, {})
                loaded_B = ldm_patched.modules.lora.load_lora(sd_B, key_map_B)
                
                # CRITICAL 1.1: Map UI slider to strength_patch, never strength_model
                accepted_B = self.clone_B.add_patches(loaded_B, strength_patch=float(weight_B), strength_model=1.0)
                self.accepted_count_B = len(accepted_B) if isinstance(accepted_B, (list, set, dict)) else len(self.clone_B.patches)

                if self.accepted_count_B == 0:
                    self.phase1_blocked = True
                    self.phase1_block_reason = f"LoRA B produced zero compatible UNet patches for this checkpoint."
                    print(f"[RLL][Phase1][BLOCKED] {self.phase1_block_reason}")
                    return

                t_setup = (time.perf_counter() - t0) * 1000.0
                print(f"[RLL][Phase1] Branch setup completed in {t_setup:.2f} ms (Accepted patch keys: A={self.accepted_count_A}, B={self.accepted_count_B})")

                # CRITICAL 2.1: run_branch with patch_model INSIDE try/finally
                def run_branch(branch_patcher, model_function, params, label):
                    t_patch = 0.0
                    t_forward = 0.0
                    t_unpatch = 0.0
                    out = None

                    try:
                        t0 = time.perf_counter()
                        branch_patcher.patch_model()
                        t_patch = (time.perf_counter() - t0) * 1000.0

                        t0 = time.perf_counter()
                        out = model_function(params["input"], params["timestep"], **params["c"])
                        t_forward = (time.perf_counter() - t0) * 1000.0

                    finally:
                        t0 = time.perf_counter()
                        try:
                            branch_patcher.unpatch_model()
                            t_unpatch = (time.perf_counter() - t0) * 1000.0
                        except Exception as cleanup_error:
                            self.phase1_fatal_error = True
                            self.restore_success = False
                            print(f"[RLL][Phase1][FATAL] Branch {label} unpatch failed: {cleanup_error}")
                            raise

                    return out, t_patch, t_forward, t_unpatch

                # Install Multi-Pass Oracle Wrapper
                def phase1_multipass_wrapper(model_function, params):
                    self.wrapper_call_count += 1

                    if self.phase1_fatal_error:
                        raise RuntimeError("[RLL][Phase1] Aborting step due to previous unpatch failure.")

                    # Run Branch A
                    out_A, t_pA, t_fA, t_uA = run_branch(self.clone_A, model_function, params, "A")
                    if out_A is None:
                        raise RuntimeError("[RLL][Phase1] Branch A forward returned None.")

                    # Run Branch B
                    out_B, t_pB, t_fB, t_uB = run_branch(self.clone_B, model_function, params, "B")
                    if out_B is None:
                        raise RuntimeError("[RLL][Phase1] Branch B forward returned None.")

                    # Compatibility Checks
                    if out_A.shape != out_B.shape or out_A.dtype != out_B.dtype or out_A.device != out_B.device:
                        raise RuntimeError(f"[RLL][Phase1] Tensor mismatch: A({out_A.shape}, {out_A.dtype}, {out_A.device}) vs B({out_B.shape}, {out_B.dtype}, {out_B.device})")

                    if out_A.ndim != 4:
                        raise RuntimeError(f"[RLL][Phase1] Expected 4D tensor [B, C, H, W], got ndim={out_A.ndim} ({out_A.shape})")

                    # Numerical Oracle Check for Same A/A condition
                    if self.is_same_lora:
                        diff = (out_A.float() - out_B.float()).abs().max().item()
                        self.same_lora_diffs.append(diff)

                    # Hard Left/Right Mask Blend
                    t_b0 = time.perf_counter()
                    b, c, h, w = out_A.shape
                    mid = w // 2

                    mask_A = torch.zeros((1, 1, h, w), device=out_A.device, dtype=out_A.dtype)
                    mask_A[..., :mid] = 1.0
                    mask_B = 1.0 - mask_A

                    combined_out = out_A * mask_A + out_B * mask_B
                    t_b = (time.perf_counter() - t_b0) * 1000.0

                    # Diagnostics on first call
                    if not self.mask_logged:
                        self.mask_logged = True
                        sum_exact = torch.all((mask_A + mask_B) == 1.0).item()
                        print(f"[RLL][Phase1][Runtime Diagnostics]")
                        print(f"  Input Shape={params['input'].shape}, Out_A Shape={out_A.shape}, Dtype={out_A.dtype}, Device={out_A.device}")
                        print(f"  Mask Shape={mask_A.shape}, Midpoint={mid}/{w}, Sum==1.0 Exact: {sum_exact}")
                        print(f"  Step 1 Timing: A(p={t_pA:.1f}ms, f={t_fA:.1f}ms, u={t_uA:.1f}ms) | B(p={t_pB:.1f}ms, f={t_fB:.1f}ms, u={t_uB:.1f}ms) | Blend={t_b:.2f}ms")
                        if self.is_same_lora:
                            print(f"  Same A/A Condition Detected -> Step 1 out_A vs out_B max_abs_diff = {self.same_lora_diffs[0]:.8f}")

                    self.step_timings.append({
                        "patch_A": t_pA, "fwd_A": t_fA, "unpatch_A": t_uA,
                        "patch_B": t_pB, "fwd_B": t_fB, "unpatch_B": t_uB,
                        "blend": t_b
                    })

                    return combined_out

                phase1_multipass_wrapper._rll_wrapper = True
                phase1_multipass_wrapper._rll_kind = "phase1_multipass"
                phase1_multipass_wrapper._rll_previous_wrapper = None
                self.installed_wrapper = phase1_multipass_wrapper
                unet.model_options["model_function_wrapper"] = phase1_multipass_wrapper
                self.wrapper_installed = True

                print(f"[RLL][Phase1] Multi-Pass Oracle Wrapper successfully registered.")
                print("[RLL][Phase1] ========================================")

        except Exception as e:
            self.phase1_blocked = True
            self.phase1_fatal_error = True
            self.phase1_block_reason = str(e)
            print(f"[RLL][Phase1][FATAL SETUP] Oracle wrapper was NOT installed: {e}")
            import traceback
            traceback.print_exc()

    def postprocess(self, p, processed, is_enabled, mode, lora_A, weight_A, lora_B, weight_B, selected_lora_probe, debug_log, *args, **kwargs):
        if not is_enabled:
            return

        # Fail-safe restoration of original wrapper in model_options
        wrapper_cleanup_ok = True
        post_base_patch_count = 0
        try:
            if hasattr(p, "sd_model") and hasattr(p.sd_model, "forge_objects"):
                unet = getattr(p.sd_model.forge_objects, "unet", None)
                if unet is not None and hasattr(unet, "model_options"):
                    current_wrapper = unet.model_options.get("model_function_wrapper", None)
                    if getattr(current_wrapper, "_rll_wrapper", False):
                        previous = getattr(current_wrapper, "_rll_previous_wrapper", None)
                        if previous is not None:
                            unet.model_options["model_function_wrapper"] = previous
                        else:
                            unet.model_options.pop("model_function_wrapper", None)
                        if debug_log and self.wrapper_installed:
                            print(f"[RLL][Cleanup] Restored model_function_wrapper safely. Total wrapper calls: {self.wrapper_call_count}")
                    
                    base_patches = getattr(unet, "patches", {})
                    post_base_patch_count = len(base_patches) if isinstance(base_patches, dict) else 0
        except Exception as e:
            print(f"[RLL][ERROR] Error restoring wrapper during postprocess: {e}")
            wrapper_cleanup_ok = False
        finally:
            self.wrapper_installed = False
            self.clone_A = None
            self.clone_B = None

        if debug_log:
            if "Phase 0:" in str(mode):
                print("[RLL][Probe] Completed (read-only probe).")
            elif "Phase 0.5:" in str(mode):
                if self.restore_success and wrapper_cleanup_ok:
                    print("[RLL][Probe] Completed Phase 0.5. Temporary model patching and wrapper were safely restored before exit.")
                else:
                    print("[RLL][ERROR] Restore verification or wrapper cleanup failed.")
            elif "Phase 1:" in str(mode):
                if self.phase1_blocked:
                    print(f"[RLL][Phase1] Finished (BLOCKED: {self.phase1_block_reason}). Output is base fallback.")
                elif self.step_timings:
                    n_steps = len(self.step_timings)
                    avg_pA = sum(s["patch_A"] for s in self.step_timings) / n_steps
                    avg_fA = sum(s["fwd_A"] for s in self.step_timings) / n_steps
                    avg_uA = sum(s["unpatch_A"] for s in self.step_timings) / n_steps
                    avg_pB = sum(s["patch_B"] for s in self.step_timings) / n_steps
                    avg_fB = sum(s["fwd_B"] for s in self.step_timings) / n_steps
                    avg_uB = sum(s["unpatch_B"] for s in self.step_timings) / n_steps
                    avg_b = sum(s["blend"] for s in self.step_timings) / n_steps
                    
                    total_step_ms = avg_pA + avg_fA + avg_uA + avg_pB + avg_fB + avg_uB + avg_b
                    repatch_overhead_ms = avg_pA + avg_uA + avg_pB + avg_uB

                    print("[RLL][Phase1][TIMING SUMMARY] ========================================")
                    print(f"  Total Steps Evaluated      : {n_steps}")
                    print(f"  Avg Forward Time (A + B)   : {avg_fA + avg_fB:.2f} ms/step (A: {avg_fA:.1f}ms, B: {avg_fB:.1f}ms)")
                    print(f"  Avg Repatch Overhead (A+B) : {repatch_overhead_ms:.2f} ms/step (pA:{avg_pA:.1f}, uA:{avg_uA:.1f}, pB:{avg_pB:.1f}, uB:{avg_uB:.1f})")
                    print(f"  Avg Mask Blend Time        : {avg_b:.2f} ms/step")
                    print(f"  Avg Total Wrapper Time     : {total_step_ms:.2f} ms/step")
                    print(f"  Total Repatch Overhead     : {(repatch_overhead_ms * n_steps) / 1000.0:.2f} seconds over {n_steps} steps")
                    if self.is_same_lora and self.same_lora_diffs:
                        max_diff_across_run = max(self.same_lora_diffs)
                        mean_diff_across_run = sum(self.same_lora_diffs) / len(self.same_lora_diffs)
                        print(f"  Same A/A Numerical Oracle  : Max abs diff = {max_diff_across_run:.8f}, Mean abs diff = {mean_diff_across_run:.8f}")
                    print(f"  Post-Run Base Patch Count  : {post_base_patch_count} (Clean Base State: {post_base_patch_count == 0})")
                    print("[RLL][Phase1][TIMING SUMMARY] ========================================")
                    print("[RLL][Phase1] Completed sampling with Multi-Pass Oracle. Model state clean.")
