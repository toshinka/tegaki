# Regional LoRA Lab - Changelog

## [Phase 1 Pre-Validation Stabilization] - 2026-09-03

### Fixed
- **CRITICAL**: Fixed `add_patches()` invocation in `scripts/regional_lora_lab.py` to map UI slider to `strength_patch` instead of `strength_model` (`strength_model=1.0` fixed to prevent baseline weight scaling).
- **CRITICAL**: Fixed `run_branch()` in `scripts/regional_lora_lab.py` by moving `patch_model()` inside the `try...finally` block, ensuring fail-safe `unpatch_model()` execution even if `patch_model()` throws midway.
- Added strict preflight guards in `before_process_batch()`: txt2img only (`is_img2img` blocked), `batch_size == 1` only, `enable_hr == False` only, `controlnet_linked_list is None` only.
- Added verification of accepted UNet patch key count (`> 0`) from `add_patches()`.
- Added automated Same A/A numerical Oracle difference tracking (`max_abs_diff` per step).
- Updated `reports/PHASE_01_REPORT.md` (Status: `IMPLEMENTED / PRE-VALIDATION READY`), `CURRENT_STATUS.md`, and `GPT_GITHUB_LINKS.txt`.

## [Phase 1 Implementation] - 2026-09-03

### Added
- Implemented Phase 1: 2-Region Multi-Pass Oracle PoC (Candidate B: Alternating Patch Materialization).
- Added independent UNet LoRA A/B branch loaders bypassing WebUI Extra Networks (Text Encoder multiplier = 0).
- Added per-step alternating patch materialization inside `model_function_wrapper` (`clone_A.patch_model()` -> forward -> `clone_A.unpatch_model()` -> `clone_B.patch_model()` -> forward -> `clone_B.unpatch_model()`).
- Added hard binary left/right spatial denoiser-output blending (`mask_A + mask_B == 1.0`).
- Fixed Safety Gate Errata: `restore_success` failure latch preservation, stale wrapper previous-wrapper object metadata recovery, unconditional try/finally unpatch.
- Added Phase 1 preflight and fail-closed guards: prompt `<lora:...>` tag stripping, clean base patch state check, existing wrapper fail-closed check.
- Added runtime step-by-step timing aggregation and mask invariant diagnostics.
- Created `reports/PHASE_01_REPORT.md`.
- Updated `CURRENT_STATUS.md` and `GPT_GITHUB_LINKS.txt`.

## [Phase 1 Ready / Safety Gate PASS] - 2026-09-03

### Added
- Implemented robust `try...finally` emergency unpatch mechanism inside `scripts/regional_lora_lab.py` handling partial `patch_model()` exceptions.
- Implemented stale RLL wrapper recovery during `before_process_batch()` preserving other extensions' wrappers.
- Corrected wrapper call measurement metric names (`previous_wrapper_inner_model_call_count`).
- Formally froze `docs/PHASE_01_MULTIPASS_POC.md` as APPROVED FOR IMPLEMENTATION (Candidate B: Alternating Patch Materialization, UNet LoRA only, TE mult=0, Left/Right 50:50).
- Updated `reports/PHASE_00_5_REPORT.md`, `CURRENT_STATUS.md`, and `GPT_GITHUB_LINKS.txt`.

## [Phase 0.5 Final] - 2026-09-03

### Added
- Implemented Multi-Layer Exact Tensor Restore Probe in `scripts/regional_lora_lab.py` (verified `torch.equal=True`, `max_abs_diff=0.00000000` across 5 representative layers).
- Implemented Dummy Wrapper Chaining test with automatic cleanup and step call counter.
- Enhanced `try...finally` block around `patch_model()` / `unpatch_model()` ensuring fail-safe restore.
- Updated `reports/PHASE_00_5_REPORT.md` and `docs/PHASE_00_5_PATCH_RESIDENCY_PROBE.md` with final empirical findings.
- Updated `CURRENT_STATUS.md` and `GPT_GITHUB_LINKS.txt`.

## [Phase 0.5] - 2026-09-02

### Added
- Created `docs/PHASE_00_5_PATCH_RESIDENCY_PROBE.md` documenting patch materialization lifecycle and timing feasibility.
- Created `reports/PHASE_00_5_REPORT.md` for Phase 0.5 completion.
- Implemented `Phase 0.5: Patcher Residency Probe` in `scripts/regional_lora_lab.py` (Identity probe, registration isolation, materialization & restoration verification, repatch timing measurement, wrapper chaining probe).

## [Phase 0] - 2026-09-02

### Added
- Created initial laboratory project structure.
- Documented full reForge LoRA loading and ModelPatcher/UnetPatcher mechanics in `docs/REFORGE_LORA_FLOW.md`.
- Documented architecture and hook strategy in `docs/ARCHITECTURE_NOTES.md`.
- Added Phase 0 environment probe and research references in `docs/`.
- Implemented non-invasive probe extension `scripts/regional_lora_lab.py`.
- Verified environment specs: PyTorch 2.7.1+cu128, CUDA 12.8, RTX 4070 (12GB), reForge commit `19395bf`.
- Added Phase 0 completion report in `reports/PHASE_00_REPORT.md`.
- Set up GPT review navigation in `GPT_GITHUB_LINKS.txt`.
