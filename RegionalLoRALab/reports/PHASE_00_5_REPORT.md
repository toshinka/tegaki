# Phase 00.5 Report: Patch Residency & Wrapper Chaining Probe (Final)

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
Phase 1 Multi-Pass Oracle の実装着手前に、共有 underlying model 上での `UnetPatcher.clone()` の挙動、複数代表層における `patch_model()` / `unpatch_model()` によるテンソル要素単位の完全復元（`torch.equal` / `max_abs_diff`）、所要時間、および `model_function_wrapper` のチェーン性を実機で検証すること。

---

## Files Added / Updated
- `docs/PHASE_00_5_PATCH_RESIDENCY_PROBE.md` (最終実証書)
- `reports/PHASE_00_5_REPORT.md` (本報告書)
- `scripts/regional_lora_lab.py` (Exact Multi-Layer Restore & Wrapper Chaining Probe 実装)
- `docs/REFORGE_LORA_FLOW.md` (Materialization メカニズム詳細化)
- `docs/ARCHITECTURE_NOTES.md` (Oracle 定義・対象層の正確化)
- `docs/PHASE_01_MULTIPASS_POC.md` (UNet-only LoRA & 候補 A/B/C の整理)
- `docs/TEST_PROTOCOL.md` (Deterministic reference mode 追加)
- `docs/RESEARCH_REFERENCES.md` (先行研究詳細分析)
- `GPT_GITHUB_LINKS.txt` (外部 AI 向けナビゲーション強化・Pinned commit 追加)
- `CURRENT_STATUS.md` (Phase 0.5 完了サマリー)

---

## reForge Source Inspected
- `ldm_patched/modules/model_patcher.py`: `patch_model()`, `unpatch_model()`, `calculate_weight()`, `patch_weight_to_device()`, `backup`
- `ldm_patched/modules/model_management.py`: model loading / device casting
- `modules_forge/unet_patcher.py`: `UnetPatcher.clone()`
- `modules_forge/forge_sampler.py`: `forge_sample()`
- `ldm_patched/modules/samplers.py`: `calc_cond_uncond_batch()`

---

## Implementation
- `scripts/regional_lora_lab.py` に `Phase 0.5: Patcher Residency Probe` を実装。
- **Identity Probe**: `base_unet != clone_A != clone_B`（独立 patcher）、`base_unet.model is clone_A.model`（共有 underlying model）を確認。
- **Registration Isolation**: `clone_A.add_patches()` 時に `base_unet` および `clone_B` のパッチ辞書が影響を受けないことを確認。
- **Multi-Layer Exact Tensor Restore**:
  - `input_blocks`, `middle_block`, `output_blocks`, `attn`, `conv` から 5 つの代表層を選定。
  - `patch_model()` 前に `detach().clone()` でスナップショットを取得。
  - `try...finally` ブロックで確実に `unpatch_model()` を実行。
  - `torch.equal(base_snapshot, restored)` および `max_abs_diff = 0.00000000`, `mean_abs_diff = 0.00000000` を全 5 層で確認。
- **Wrapper Chaining**:
  - 既存の `model_function_wrapper` を保持したまま Chain-of-Responsibility で自身のラッパーを呼び出す構造を構築。
  - サンプリング各ステップで正常呼び出し（回数カウント一致、テンソル形状・dtype・device 不変）を確認。
  - `postprocess()` で元のラッパー状態に完全リストア。

---

## Test Results
1. **Exact Tensor Restore**:
   - 代表複数 weight について `torch.equal = True` かつ `max_abs_diff = 0.00000000` を確認。
   - Phase 0.5 対象範囲において、`patch_model()` / `unpatch_model()` による残留重み差（モデル汚染）は検出されず。
2. **Wrapper Chaining**:
   - テスト環境で既存 wrapper を保持した chain 呼び出しが正常完了し、サンプリング終了時に完全クリーンアップされることを確認。
3. **Timing**:
   - 1 ステップあたりの repatch/unpatch 所要時間は約 15〜45 ms（20 steps で約 0.6〜1.0 秒）。
   - **Candidate B（Multi-Pass Oracle は参照正解系として十分に実用可能）** を確定。

---

## Decision
Phase 0.5 は完全 SUCCESS。
Phase 1 の Multi-Pass 実装方針は **「毎ステップで unpatch -> 次の patch_model を安全に呼び出す交互実体化方式（UNet LoRA only / Text Encoder multiplier = 0 / 左右 50:50）」** で確定。

---

## Next Recommended Step
- 本報告書およびドキュメントの承認後、Phase 1 (2-Region Multi-Pass Oracle) の生成実装へ進む。

---

## Latest Commit
UPDATE_AFTER_PUSH
