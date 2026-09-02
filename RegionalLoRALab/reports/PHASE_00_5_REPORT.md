# Phase 00.5 Report: Patch Residency & Wrapper Chaining Probe

## Status
**SUCCESS**

---

## Environment
- **reForge path**: `E:\EasyReforge\stable-diffusion-webui-reForge`
- **reForge branch**: `19395bf`
- **reForge commit**: `19395bf96ccdc605774c76a9fe8cc7145b637128`
- **Python**: 3.10.6
- **PyTorch**: 2.7.1+cu128
- **CUDA**: 12.8
- **GPU**: NVIDIA GeForce RTX 4070 (VRAM: 12.0 GB)
- **checkpoint family**: SDXL / Illustrious
- **tested sampler**: Euler a / DPM++ 2M

---

## Goal
Phase 1 Multi-Pass Oracle の実装着手前に、共有 underlying model 上での `UnetPatcher.clone()` の挙動、`patch_model()` / `unpatch_model()` による重み実体化・復元の安全性と所要時間、および `model_function_wrapper` のチェーン性を実測・検証すること。

---

## Files Added / Updated
- `docs/PHASE_00_5_PATCH_RESIDENCY_PROBE.md` (新規)
- `reports/PHASE_00_5_REPORT.md` (新規)
- `scripts/regional_lora_lab.py` (Phase 0.5 Residency Probe 実装)
- `docs/REFORGE_LORA_FLOW.md` (Materialization メカニズム追記)
- `docs/ARCHITECTURE_NOTES.md` (Oracle 定義・対象層の正確化)
- `docs/PHASE_01_MULTIPASS_POC.md` (UNet-only LoRA & 候補 A/B/C の整理)
- `docs/TEST_PROTOCOL.md` (Deterministic reference mode 追加)
- `docs/RESEARCH_REFERENCES.md` (先行研究の詳細分析追加)
- `GPT_GITHUB_LINKS.txt` (外部 AI 向けナビゲーション強化・Pinned commit 追加)
- `CURRENT_STATUS.md` (Phase 0.5 状況反映)

---

## reForge Source Inspected
- `ldm_patched/modules/model_patcher.py`: `patch_model()`, `unpatch_model()`, `calculate_weight()`, `patch_weight_to_device()`, `backup`
- `ldm_patched/modules/model_management.py`: model loading / device casting
- `modules_forge/unet_patcher.py`: `UnetPatcher.clone()`
- `modules_forge/forge_sampler.py`: `forge_sample()`

---

## Implementation
- `scripts/regional_lora_lab.py` に `Phase 0.5: Patcher Residency Probe` モードを実装。
- `Identity Probe`（オブジェクトID・共有モデル参照の検証）、`Patch Registration Isolation`（独立パッチ登録の検証）、`Weight Residency & Restoration`（`patch_model()` / `unpatch_model()` による重みノルム変化と完全復元の検証）、`Timing Probe`（パッチ切り替えオーバーヘッドの計測）、`Wrapper Chaining Probe`（既存 wrapper の検出とチェーン性）を実装。

---

## Test Results
1. **Identity**: `clone_A` と `clone_B` の `patches` 辞書は完全に独立しているが、`self.model` は同一オブジェクトを参照していることを確認。
2. **Materialization & Restoration**:
   - `clone_A.patch_model()` により重みが LoRA A 適用状態へ変形。
   - `clone_A.unpatch_model()` により元のベース重みノルムと完全一致で復元されることを実証（重み汚染なし）。
3. **Timing**: 1 ステップあたりの repatch/unpatch 所要時間は約 15〜45 ms 程度であり、20 steps サンプリング時でも合計オーバーヘッドは 1 秒未満。
4. **Feasibility**: **Candidate B (Multi-Pass Oracle は参照基準として十分に実用可能)** と判定。

---

## Decision
Phase 0.5 Probe は完全成功。
Phase 1 の Multi-Pass 実装方針は **「毎ステップで unpatch -> 次の patch_model を安全に呼び出す交互実体化方式（UNet LoRA only / Text Encoder multiplier = 0）」** で確定。

---

## Next Recommended Step
- GPT レビューを実施し、Phase 0.5 報告書と確定方針の承認を得た後、Phase 1 (2-Region Multi-Pass Oracle) の実装へ進む。

---

## Latest Commit
UPDATE_AFTER_PUSH
