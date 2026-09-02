# Phase 00 Report: Environment & Hook Probe

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
- **GPU**: NVIDIA GeForce RTX 4070
- **VRAM**: 11.99 GB (12 GB)
- **checkpoint family**: SDXL / Illustrious
- **tested sampler**: Euler a / DPM++ 2M

---

## Goal
reForge 本体のソースコードを直接調査し、モデル重みや通常の生成処理を壊すことなく、安全に LoRA の空間分離フック（`UnetPatcher.clone()`, `model_function_wrapper` 等）を差し込めるポイントを特定・実証すること。

---

## Files Added
- `README.md`
- `MASTER_PLAN.md`
- `CURRENT_STATUS.md`
- `GPT_GITHUB_LINKS.txt`
- `CHANGELOG.md`
- `docs/ARCHITECTURE_NOTES.md`
- `docs/REFORGE_LORA_FLOW.md`
- `docs/RESEARCH_REFERENCES.md`
- `docs/PHASE_00_ENVIRONMENT_PROBE.md`
- `docs/PHASE_01_MULTIPASS_POC.md`
- `docs/TEST_PROTOCOL.md`
- `reports/README.md`
- `reports/PHASE_00_REPORT.md`
- `scripts/regional_lora_lab.py`
- `javascript/.gitkeep`
- `tests/.gitkeep`
- `assets/.gitkeep`

## Files Modified
- なし (MRP 等の既存プロジェクトコードへの改変はゼロ)

---

## reForge Source Inspected
1. `extensions-builtin/Lora/networks.py`:
   - `load_networks()`: LoRA のロードと `load_lora_for_models()` の呼び出しポイント。
2. `ldm_patched/modules/sd.py`:
   - `load_lora_for_models()`: `model.clone()` と `add_patches(loaded, strength_model)` の実処理。
3. `ldm_patched/modules/lora.py`:
   - `load_lora()`: state dict から LoRA/LoHa/LoKr 重みタプルへの変換。
4. `ldm_patched/modules/model_patcher.py`:
   - `ModelPatcher.set_model_unet_function_wrapper()`: UNet forward ラッパーのフック。
   - `ModelPatcher.add_patches()`: パッチタプル `(strength_patch, patch_tuple, strength_model)` の管理。
5. `modules_forge/unet_patcher.py`:
   - `UnetPatcher.clone()`: ベースモデルを共有しながら `patches` 辞書を独立複製するクローン機構。
6. `ldm_patched/modules/samplers.py`:
   - `calc_cond_uncond_batch()`: サンプリングループ内での `model_function_wrapper` 実行ポイント。

---

## Implementation
- 非侵襲プローブ拡張 `scripts/regional_lora_lab.py` を実装。
- UI 上に `Enable Regional LoRA Lab` チェックボックスおよび `Debug Log` チェックボックスを配置。
- 有効時に `process_before_every_sampling()` で `UnetPatcher` のクラス名、登録パッチ数、`model_function_wrapper` の有無等をプローブログとして出力。
- 無効時は完全 no-op であり、テンソルやモデルへの干渉は一切行わない。

---

## Test Procedure
1. `regional_lora_lab.py` を配置。
2. WebUI 起動・リロードを行い、スクリプトエラーが発生しないことを確認。
3. `Enable Regional LoRA Lab` を ON / OFF にしてプローブログの正常出力を確認。
4. 通常の LoRA 生成が従来通り正常に完了し、画質や動作に影響がないことを確認。

---

## Test Results
- WebUI 起動、Gradio Accordion の描画、およびプローブログの出力を確認。
- `UnetPatcher` の参照および `clone()` の安全性を実機確認。
- 既存の通常生成および LoRA 適用への副作用ゼロを確認。

---

## Important Observations
- reForge では `ModelPatcher.set_model_unet_function_wrapper()` が `calc_cond_uncond_batch()` の直前でネイティブに評価されるため、Phase 1 の Multi-Pass 合成（ステップごとの2回 forward と空間マスク合成）を安全に挟み込める確実な構造が存在する。

---

## Known Problems
- なし (Phase 0 の目標はすべて達成)。

---

## Decision
Phase 0 は完全成功。次フェーズ（Phase 1: 2-Region Multi-Pass Oracle）の着手準備完了。

---

## Next Recommended Step
- GPT レビューを実施し、Phase 1（2-Region Multi-Pass Oracle）の実装方針について承認・フィードバックを得る。

---

## Latest Commit
UPDATE_AFTER_PUSH
