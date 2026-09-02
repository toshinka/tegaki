"""
Regional LoRA Lab - Main Script
Version: Phase 0 (Environment & Hook Probe Baseline)
Project: Regional LoRA Engine for Stable Diffusion WebUI reForge
"""

import os
import sys
import torch
import gradio as gr
import modules.scripts as scripts
from modules import shared, errors

class RegionalLoRALabScript(scripts.Script):
    def __init__(self):
        super().__init__()
        self.is_active = False

    def title(self):
        return "Regional LoRA Lab (Research)"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        with gr.Accordion("🔬 Regional LoRA Lab (Research / 実験用)", open=False, elem_id="regional-lora-lab-accordion"):
            with gr.Row():
                is_enabled = gr.Checkbox(label="有効化 (Enable Regional LoRA Lab)", value=False, elem_id="rll-enabled")
                mode = gr.Dropdown(label="動作モード (Mode)", choices=["Phase 0: Probe Only (診断専用)"], value="Phase 0: Probe Only (診断専用)", interactive=False)
                debug_log = gr.Checkbox(label="詳細ログ出力 (Debug Log)", value=True, elem_id="rll-debug-log")

            with gr.Row():
                gr.Markdown("""
                > **【Regional LoRA Lab - Phase 0 稼働中】**  
                > 現在は reForge モデル構造・LoRA ロード経路の環境診断モードです。  
                > ※ 生成画像・テンソルへの変更は一切行いません（完全非侵襲）。
                """)

        return [is_enabled, mode, debug_log]

    def before_process_batch(self, p, is_enabled, mode, debug_log, *args, **kwargs):
        if not is_enabled:
            return

        if debug_log:
            prompts = kwargs.get("prompts", [getattr(p, 'prompt', '')])
            raw_prompt = prompts[0] if isinstance(prompts, list) and prompts else str(prompts)
            print("[RLL][Probe] before_process_batch triggered")
            print(f"[RLL][Probe] Raw prompt preview: {raw_prompt[:80]!r}...")

    def process_before_every_sampling(self, p, is_enabled, mode, debug_log, *args, **kwargs):
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
                print(f"[RLL][Probe] ControlNet linked = {has_controlnet}")
                print(f"[RLL][Probe] CLIP patcher class = {type(clip).__name__ if clip else 'None'}")
                print("[RLL][Probe] ========================================")

        except Exception as e:
            print(f"[RLL][Probe][ERROR] Error during probe: {e}")

    def postprocess(self, p, processed, is_enabled, mode, debug_log, *args, **kwargs):
        if is_enabled and debug_log:
            print("[RLL][Cleanup] Sampling finished. No state pollution left.")
