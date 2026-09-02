# Regional LoRA Lab Current Status

Current Phase: Phase 1 — Implemented / Pre-Validation Ready
Previous Phase: Phase 0.5 SUCCESS (Safety Gate PASSED)
Architecture: Candidate B — Alternating Patch Materialization

## Implemented & Stabilized:
- Extension folder structure established
- reForge environment investigated (commit `19395bf`, PyTorch 2.7.1+cu128, CUDA 12.8, RTX 4070 12GB)
- reForge LoRA loading path and ModelPatcher/UnetPatcher mechanics completely documented (`docs/REFORGE_LORA_FLOW.md`)
- Safety Gate Errata fixed (restore failure latch, stale wrapper metadata recovery, unconditional unpatch)
- Phase 1 UI implemented (Region A / B LoRA dropdowns, UNet `strength_patch` sliders)
- Phase 1 Direct UNet-only LoRA loader implemented (Text Encoder multiplier = 0)
- CRITICAL FIX: LoRA UI weight correctly mapped to `strength_patch` (`strength_model = 1.0` fixed)
- CRITICAL FIX: `patch_model()` placed strictly inside `try...finally` within `run_branch()`
- Alternating Patch Materialization multi-pass wrapper implemented
- Hard binary left/right spatial blending implemented (`mask_A + mask_B == 1.0`)
- Strict preflight guards implemented (txt2img only, batch_size 1, Hires fix OFF, ControlNet OFF, clean base patch check, prompt `<lora:...>` tag stripping)
- Numerical Oracle check for Same A/A implemented (`max_abs_diff` logging)
- Runtime timing aggregation and clean-state recovery logic implemented

## Pending User Visual Validation:
- Smoke 1: Enable OFF baseline generation
- Smoke 2: Preflight block test
- Smoke 3: Same A/A numerical check
- Smoke 4: Zero strength check (`Weight=0.0`)
- Control A/B/AB comparison
- Regional A/B & Swap B/A visual tests
- Visual leakage review and GPT final confirmation

> **[IMPORTANT] Do Not Proceed To Phase 2 Yet**  
> Wait for user visual validation results and external AI review.

## Latest Commit:
UPDATE_AFTER_PUSH
