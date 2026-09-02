# Regional LoRA Lab - Changelog

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
