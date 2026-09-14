# Phase 01 Report — 2-Region Multi-Pass Oracle (Pre-Validation Stabilized)

## Status
**IMPLEMENTED / PRE-VALIDATION READY**

---

## Implementation Commit
https://github.com/toshinka/tegaki/commit/b8a2de67443d63d4ff373eca2237d0c6a69ec24d
(`b8a2de67`)

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

## Frozen Scope & Preflight Enforcement
- **Architecture**: Candidate B — Alternating Patch Materialization
- **Regions / Geometry**: 2 領域固定 (Left 50% / Right 50%)
- **Mask Type**: Hard Binary Mask (`mask_A + mask_B = 1.0`, broadcastable to `[B, 1, H, W]`)
- **LoRA Weight Mapping**: UI slider maps to `strength_patch` (never `strength_model`), `strength_model = 1.0` fixed.
- **LoRA Type Target**: Standard UNet LoRA only (Text Encoder multiplier = 0.0). *Other patch types (LoCon, LoHa, etc.) may be parsed by reForge but are unvalidated in Phase 1.*
- **Preflight Guards Enforced**:
  - `txt2img` only (`img2img` blocked)
  - `batch_size == 1` only (batch > 1 blocked)
  - `enable_hr == False` only (Hires fix blocked)
  - `controlnet_linked_list is None` only (ControlNet blocked)
  - Base UNet patch count == 0 (Clean base state required)
  - Existing `model_function_wrapper` is None (Fail-closed)
  - Ordinary `<lora:...>` tags in prompt stripped with warning (RLL manages loading directly)
  - LoRA accepted patch keys > 0 check

---

## Implementation & Stabilization Measures
1. **LoRA Slider Mapping Correction**:
   - `add_patches(loaded, strength_patch=float(weight), strength_model=1.0)` により、Base weight スケーリングを防ぎ、純粋な LoRA \(\Delta W\) 強度として適用。
   - `accepted_A` / `accepted_B` の戻り値キー数を確認し、0 件の場合は安全にブロック。
2. **`run_branch()` Strict Try/Finally**:
   - `patch_model()` 自身を `try...finally` の内側に配置し、部分パッチ適用中の例外でも確実に `unpatch_model()` が実行される安全性を確立。
3. **Stale Wrapper Metadata Recovery**:
   - ラッパーオブジェクト自身に `_rll_wrapper = True` および `_rll_previous_wrapper` を持たせ、前 run 異常終了時でも他 extension のラッパーを誤削除せず安全に復旧。
4. **Numerical Oracle Check (Same A/A)**:
   - `LoRA A == LoRA B` かつ `Weight A == Weight B` の場合、毎ステップで `(out_A - out_B).abs().max()` を自動集計・ログ出力する数値検証機構を導入。
5. **Runtime Diagnostics & Base State Audit**:
   - 初回 wrapper 呼び出し時に input/output shape, dtype, device, mask invariant をログ出力。
   - `postprocess()` 時に Base UNet の patch count が 0（run 前と同一）であることを監査。

---

## Runtime Invariants
- **Registration Isolation**: `clone_A` と `clone_B` の `patches` 辞書は独立し、ベースモデルを共有。
- **Per-step Clean State**: 各 branch の forward 終了直後に必ず `unpatch_model()` が実行され、次ステップへ重み状態を持ち越さない。
- **Mask Exactness**: `mask_A + mask_B == 1.0` が全要素で成立。

---

## Performance & Overhead Model
- **Repatch Overhead Estimate**: 約 0.6〜1.2 秒 / 20 steps (Branch A + Branch B 合計)
- **Total Generation Overhead**: 2 回の UNet forward 実行が主コスト（ユーザー実測ログにより集計予定）。

---

## Smoke & Validation Checklist
### Code Path Verification
- [x] LoRA UI weight mapped to `strength_patch` (`strength_model = 1.0`)
- [x] `patch_model()` placed inside `try...finally` in `run_branch()`
- [x] Stale wrapper metadata recovery logic implemented
- [x] Strict preflight guards enforced (Batch size 1, txt2img, Hires fix OFF, ControlNet OFF, Clean base, `<lora:...>` stripping)
- [x] LoRA accepted keys verification (> 0 keys)
- [x] Same A/A numerical difference measurement implemented

### Actual WebUI Sampling & Visual Validation
- [ ] Smoke 1: Enable OFF baseline generation
- [ ] Smoke 2: Preflight block test (Blocked state verification)
- [ ] Smoke 3: Same A/A numerical check (`max_abs_diff ≈ 0`)
- [ ] Smoke 4: Zero strength check (`Weight=0.0 ≈ No LoRA baseline`)
- [ ] Smoke 5: Regional A/B sampling & timing summary
- [ ] User Visual Validation Test Matrix (7 or 8 conditions)

---

## User Visual Validation Matrix
ユーザー様による以下の 7〜8 条件の比較テストを実施：
1. **Control 0**: No LoRA (Baseline)
2. **Control A**: Global LoRA A
3. **Control B**: Global LoRA B
4. **Control AB**: Global LoRA A + B
5. **Regional AB**: RLL ON (Left=LoRA A / Right=LoRA B)
6. **Swap BA**: RLL ON (Left=LoRA B / Right=LoRA A)
7. **Same AA**: RLL ON (Left=LoRA A / Right=LoRA A)
8. *(Optional)* **Zero AA**: RLL ON (Left=LoRA A 0.0 / Right=LoRA A 0.0)

---

## Decision
**IMPLEMENTED / PRE-VALIDATION READY**  
CRITICAL な修正（`strength_patch` 引数修正、`run_branch` try/finally 強化、Preflight ガード追加、Same A/A 数値検証）を完了。ユーザー視覚検証テストの準備が整った状態。

---

## Latest Commit
UPDATE_AFTER_PUSH
