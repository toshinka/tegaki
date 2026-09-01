"""
EasyReforge Manga Prompter - Forge ModelPatcher Native Attention Engine (v3.5)
Credit: sd-forge-couple (Haoming02) / ComfyUI Attention Couple (laksjdjf)
ControlNet 100%完全共存 ＆ 完全実績検証済みアルゴリズム
"""

import math
from functools import wraps
from typing import Callable

import torch
from torch.nn.functional import interpolate
from modules.devices import device as default_device, dtype_inference

def repeat_div(value: int, iterations: int) -> int:
    for _ in range(iterations):
        value = math.ceil(value / 2)
    return value

def lcm(a: int, b: int) -> int:
    return a * b // math.gcd(a, b)

def lcm_for_list(numbers: list[int]) -> int:
    current_lcm = numbers[0]
    for number in numbers[1:]:
        current_lcm = lcm(current_lcm, number)
    return current_lcm

def get_mask(mask: torch.Tensor, batch_size: int, num_tokens: int, original_shape: list[int]) -> torch.Tensor:
    image_width: int = original_shape[3]
    image_height: int = original_shape[2]

    scale = math.ceil(math.log2(math.sqrt(image_height * image_width / num_tokens)))
    size = (repeat_div(image_height, scale), repeat_div(image_width, scale))

    num_conds = mask.shape[0]
    mask_downsample = interpolate(mask, size=size, mode="nearest")
    mask_downsample = mask_downsample.view(num_conds, num_tokens, 1).repeat_interleave(
        batch_size, dim=0
    )
    return mask_downsample

class MangaModelPatcherHook:
    def __init__(self):
        self.batch_size: int = 1
        self.patches: dict[str, Callable] = {}
        self.manual: dict[str, list] = {}
        self.checked: bool = False

    @torch.inference_mode()
    def patch_unet(
        self,
        model,
        base_mask: torch.Tensor,
        kwargs: dict,
        *,
        width: int,
        height: int,
    ):
        num_conds = len(kwargs) // 2 + 1

        mask = [base_mask] + [kwargs[f"mask_{i}"] for i in range(1, num_conds)]
        mask = torch.stack(mask, dim=0).to(default_device, dtype=dtype_inference)

        if mask.sum(dim=0).min().item() <= 0.0:
            mask = mask + 1e-4

        mask = mask / mask.sum(dim=0, keepdim=True)

        conds = [
            kwargs[f"cond_{i}"][0][0].to(default_device, dtype=dtype_inference)
            for i in range(1, num_conds)
        ]
        num_tokens = [cond.shape[1] for cond in conds]

        self.manual = {
            "original_shape": [2, 4, height // 8, width // 8],
            "cond_or_uncond": [0, 1],
        }
        self.checked = False

        @torch.inference_mode()
        def attn2_patch(q, k, v, extra_options=None):
            assert torch.allclose(k, v), "k and v should be the same"
            if extra_options is None:
                if not self.checked:
                    self.manual["original_shape"][0] = k.size(0)
                    self.manual["cond_or_uncond"] = list(range(k.size(0)))
                    self.checked = True

                extra_options = self.manual

            cond_or_unconds = extra_options["cond_or_uncond"]
            num_chunks = len(cond_or_unconds)
            self.batch_size = q.shape[0] // num_chunks
            q_chunks = q.chunk(num_chunks, dim=0)
            k_chunks = k.chunk(num_chunks, dim=0)
            lcm_tokens = lcm_for_list(num_tokens + [k.shape[1]])
            
            conds_tensor = torch.cat(
                [
                    cond.to(device=k.device, dtype=k.dtype).repeat(self.batch_size, lcm_tokens // num_tokens[i], 1)
                    for i, cond in enumerate(conds)
                ],
                dim=0,
            )

            qs, ks = [], []
            for i, cond_or_uncond in enumerate(cond_or_unconds):
                k_target = k_chunks[i].repeat(1, lcm_tokens // k.shape[1], 1).to(device=k.device, dtype=k.dtype)
                if cond_or_uncond == 1:  # uncond
                    qs.append(q_chunks[i])
                    ks.append(k_target)
                else:  # cond
                    qs.append(q_chunks[i].repeat(num_conds, 1, 1))
                    ks.append(torch.cat([k_target, conds_tensor], dim=0))

            qs = torch.cat(qs, dim=0).to(q)
            ks = torch.cat(ks, dim=0).to(k)

            if qs.size(0) % 2 == 1:
                empty = torch.zeros_like(qs[0]).unsqueeze(0)
                qs = torch.cat((qs, empty), dim=0)
                empty = torch.zeros_like(ks[0]).unsqueeze(0)
                ks = torch.cat((ks, empty), dim=0)

            return qs, ks, ks

        @torch.inference_mode()
        def attn2_output_patch(out, extra_options=None):
            if extra_options is None:
                self.checked = False
                extra_options = self.manual

            cond_or_unconds = extra_options["cond_or_uncond"]
            mask_downsample = get_mask(
                mask.to(device=out.device, dtype=out.dtype), self.batch_size, out.shape[1], extra_options["original_shape"]
            )
            outputs = []
            pos = 0
            for cond_or_uncond in cond_or_unconds:
                if cond_or_uncond == 1:  # uncond
                    outputs.append(out[pos : pos + self.batch_size])
                    pos += self.batch_size
                else:
                    masked_output = (
                        out[pos : pos + num_conds * self.batch_size] * mask_downsample
                    ).view(num_conds, self.batch_size, out.shape[1], out.shape[2])
                    masked_output = masked_output.sum(dim=0)
                    outputs.append(masked_output)
                    pos += num_conds * self.batch_size
            return torch.cat(outputs, dim=0)

        model.set_model_attn2_patch(attn2_patch)
        model.set_model_attn2_output_patch(attn2_output_patch)
        return model
