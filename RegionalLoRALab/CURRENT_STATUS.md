# Regional LoRA Lab Current Status

Current Phase: Phase 1 — Implemented / Validation Pending
Previous Phase: Phase 0.5 SUCCESS (Safety Gate PASSED)
Architecture: Candidate B — Alternating Patch Materialization

## Working & Implemented:
- Extension folder structure established
- reForge environment investigated (commit `19395bf`, PyTorch 2.7.1+cu128, CUDA 12.8, RTX 4070 12GB)
- reForge LoRA loading path and ModelPatcher/UnetPatcher mechanics completely documented (`docs/REFORGE_LORA_FLOW.md`)
- Safety Gate Errata fixed (restore failure latch, stale wrapper metadata recovery, unconditional unpatch)
- Phase 1 UI implemented (Region A / B LoRA dropdowns, UNet weight sliders)
- Phase 1 Direct UNet-only LoRA loader implemented (Text Encoder multiplier = 0)
- Alternating Patch Materialization multi-pass wrapper implemented
- Hard binary left/right spatial blending implemented (`mask_A + mask_B == 1.0`)
- Preflight guards implemented (prompt `<lora:...>` tag stripping, clean base patch check, fail-closed wrapper check)
- Runtime timing aggregation and clean state recovery verified

## Pending User Visual Validation:
- Control 0: No LoRA (Baseline)
- Control A: Global LoRA A
- Control B: Global LoRA B
- Control AB: Global LoRA A + B
- Regional A/B: Left=LoRA A, Right=LoRA B
- Swap Test: Left=LoRA B, Right=LoRA A
- Same Test: Left=LoRA A, Right=LoRA A
- Visual leakage review and GPT final confirmation

> **[IMPORTANT] Do Not Proceed To Phase 2 Yet**  
> Wait for user visual validation results and external AI review.

## Latest Commit:
https://github.com/toshinka/tegaki/commit/e830ef9df25e5d36d8ac40e405a4edc7bbfed4f3
(`e830ef9d`)
