# Regional LoRA Lab Current Status

Current Phase: Phase 1 Ready
Previous Phase: Phase 0.5 SUCCESS
Safety Gate: PASS

## Selected Phase 1 Architecture:
Candidate B — Alternating Patch Materialization

## Working:
- Extension folder structure established
- reForge environment investigated (commit `19395bf`, PyTorch 2.7.1+cu128, CUDA 12.8, RTX 4070 12GB)
- reForge LoRA loading path and ModelPatcher/UnetPatcher mechanics completely documented (`docs/REFORGE_LORA_FLOW.md`)
- Non-invasive Probe extension script implemented (`scripts/regional_lora_lab.py`)
- Identity Probe & Patch Registration Isolation verified
- Multi-Layer Exact Tensor Restore verified (`torch.equal=True`, `max_abs_diff=0.00000000` across 5 representative layers)
- Robust try-finally restore on patch_model exception implemented
- Stale RLL wrapper recovery mechanism implemented without deleting other extensions' wrappers
- Wrapper inner call counter metrics accurately recorded
- Patch residency timing measured (~15-45 ms/step roundtrip repatch)
- Phase 1 specification frozen (`docs/PHASE_01_MULTIPASS_POC.md`)

## Next:
- Implement Phase 1 2-Region Multi-Pass Oracle
- UNet LoRA only
- Text Encoder multiplier = 0
- Left / Right 50:50
- Ordinary prompt `<lora:...>` tags disabled for test

## Latest Commit:
https://github.com/toshinka/tegaki/commit/a061d65f56e07bba034adf80fef10b10e825e060
(`a061d65f`)
