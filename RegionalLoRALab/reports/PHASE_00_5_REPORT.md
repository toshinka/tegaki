# Phase 00.5 Report: Patch Residency & Wrapper Chaining Probe (Final Freeze)

## Status
**SUCCESS (Safety Gate PASSED)**

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
Phase 1 Multi-Pass Oracle の実装着手前に、共有 underlying model 上での `UnetPatcher.clone()` の挙動、複数代表層における `patch_model()` / `unpatch_model()` によるテンソル要素単位の完全復元（`torch.equal` / `max_abs_diff`）、所要時間、例外発生時の確実な復元、および `model_function_wrapper` のチェーン性を実機で検証すること。

---

## Files Added / Updated
- `docs/PHASE_00_5_PATCH_RESIDENCY_PROBE.md` (最終実証書)
- `docs/PHASE_01_MULTIPASS_POC.md` (Phase 1 正式仕様凍結)
- `reports/PHASE_00_5_REPORT.md` (本報告書)
- `scripts/regional_lora_lab.py` (Safety Gate 対応: 途中例外時 restore, stale wrapper recovery, wrapper 計測正確化)
- `docs/REFORGE_LORA_FLOW.md` (Materialization メカニズム詳細化)
- `docs/ARCHITECTURE_NOTES.md` (Oracle 定義・対象層の正確化)
- `docs/TEST_PROTOCOL.md` (Deterministic reference mode 追加)
- `docs/RESEARCH_REFERENCES.md` (先行研究詳細分析)
- `GPT_GITHUB_LINKS.txt` (外部 AI 向けナビゲーション強化・Pinned commit 追加)
- `CURRENT_STATUS.md` (Safety Gate PASS 反映)

---

## reForge Source Inspected
- `ldm_patched/modules/model_patcher.py`: `patch_model()`, `unpatch_model()`, `calculate_weight()`, `patch_weight_to_device()`, `backup`
- `ldm_patched/modules/model_management.py`: model loading / device casting
- `modules_forge/unet_patcher.py`: `UnetPatcher.clone()`
- `modules_forge/forge_sampler.py`: `forge_sample()`
- `ldm_patched/modules/samplers.py`: `calc_cond_uncond_batch()`

---

## Implementation & Safety Gate Measures
1. **Identity & Registration Isolation**:
   - `base_unet != clone_A != clone_B`（独立 patcher）、`base_unet.model is clone_A.model`（共有 underlying model）を確認。
   - `clone_A.add_patches()` 時に `base_unet` および `clone_B` のパッチ辞書が影響を受けないことを確認。
2. **Multi-Layer Exact Tensor Restore**:
   - `input_blocks`, `middle_block`, `output_blocks`, `attn`, `conv` から 5 つの代表層を選定。
   - `patch_model()` 前に `detach().clone()` でスナップショットを取得。
   - `patch_model()` が途中で例外を出した場合でも必ず `backup` を検知して `unpatch_model()` を試みる堅牢な `try...finally` を実装。
   - `torch.equal(base_snapshot, restored)` および `max_abs_diff = 0.00000000`, `mean_abs_diff = 0.00000000` を全 5 層で実証。
3. **Wrapper Chaining & Stale Wrapper Recovery**:
   - 既存の `model_function_wrapper` を保持したまま Chain-of-Responsibility で自身のラッパーを呼び出す構造を構築。
   - RLL wrapper は既存 wrapper の戻り値を加工せずそのまま返し、RLL wrapper 呼び出し回数および既存 wrapper 内部から base model_function が呼ばれた回数を正確に記録（※全 extension との完全互換性は未保証、Phase 1 では既存 wrapper あり時は fail-closed 方針）。
   - 前 run 異常終了時の stale RLL wrapper を次 run 冒頭で検出し、他 extension の wrapper を消すことなく安全に復旧するリカバリ機構を実装。

---

## Test Results
1. **Exact Tensor Restore**:
   - 代表複数 weight について `torch.equal = True` かつ `max_abs_diff = 0.00000000` を確認。残留重み差（モデル汚染）ゼロを実証。
2. **Timing**:
   - 1 ステップあたりの repatch/unpatch 所要時間は約 15〜45 ms（20 steps で約 0.6〜1.0 秒）。
   - **Candidate B（毎ステップ交互実体化 Multi-Pass Oracle）を正式採択**。
3. **Safety Gate**:
   - 途中例外時の強制 unpatch 機構、stale wrapper recovery、他 wrapper 非破壊性をすべて PASS。

---

## Decision
Phase 0.5 Safety Gate は完全 PASS。
Phase 1 の仕様（Candidate B: Alternating Patch Materialization / UNet LoRA only / TE mult=0 / 左右 50:50 / 通常 `<lora>` 禁止）を正式凍結し、**Phase 1 GO 判定** とする。

---

## Next Recommended Step
- Phase 1 (2-Region Multi-Pass Oracle) の生成実装に着手する。

---

## Latest Commit
https://github.com/toshinka/tegaki/commit/a061d65f56e07bba034adf80fef10b10e825e060
(`a061d65f`)
