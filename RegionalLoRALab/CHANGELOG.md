# Regional LoRA Lab - Changelog

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

### Changed
- Revised `reports/PHASE_00_REPORT.md` to be strictly objective and distinguish source inspection from empirical validation.
- Updated `docs/REFORGE_LORA_FLOW.md` with explicit details on `add_patches()` vs `patch_model()` / `unpatch_model()` and extra-network parsing responsibility.
- Revised `docs/ARCHITECTURE_NOTES.md` defining Oracle as reference baseline and accurately describing target LoRA layers.
- Revised `docs/PHASE_01_MULTIPASS_POC.md` clarifying candidate A/B/C and restricting Phase 1 to UNet LoRA only (TE mult = 0).
- Enhanced `docs/TEST_PROTOCOL.md` with deterministic reference mode.
- Enhanced `docs/RESEARCH_REFERENCES.md` with complete repo URLs, licenses, borrowed concepts, and forbidden copy items.
- Enhanced `GPT_GITHUB_LINKS.txt` with external AI reading order, self-referencing navigation, commit-pinned URLs, and copy-paste review prompt.
- Updated `CURRENT_STATUS.md`.

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
