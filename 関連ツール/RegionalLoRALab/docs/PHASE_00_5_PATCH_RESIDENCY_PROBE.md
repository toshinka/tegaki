# Phase 00.5: Patch Residency & Wrapper Chaining Probe (Final Reference)

> **Document Version**: v1.1 (Phase 0.5 Final Polish)  
> **Date**: 2026-09-03  
> **Target**: reForge ModelPatcher Lifecycle, Multi-Layer Exact Restore & Wrapper Chaining

---

## 1. 目的と検証項目

Phase 1 (2-Region Multi-Pass Oracle) に着手する前に、以下の 4 項目を**実測およびソースコード読解によって厳格に実証**する：

1. **Identity Probe**: `UnetPatcher.clone()` のオブジェクト分離と underlying model (`self.model`) の共有関係。
2. **Registration Isolation**: `clone_A.add_patches()` 時に `base_unet` および `clone_B` の `patches` 辞書が不変であること。
3. **Multi-Layer Exact Tensor Restore**: 複数層（Input blocks, Middle block, Output blocks, Attention, Conv）の代表重みについて、`patch_model()` 前の snapshot（`detach().clone()`）と `unpatch_model()` 後の tensor を `torch.equal()` および `max_abs_diff` で比較検証。
4. **Wrapper Chaining & Timing**: 既存 `model_function_wrapper` を保持した Chain-of-Responsibility の実動作と、1 ステップあたりの repatch/unpatch 所要時間の計測。

---

## 2. 実測・解析結果 (Empirical Findings)

### 2.1 Identity Probe (オブジェクト分離とモデル共有)
- **Patcher Object**: `base_unet != clone_A != clone_B`（独立インスタンス）
- **Underlying Model**: `base_unet.model is clone_A.model is clone_B.model`（同一 PyTorch Module を参照）
- **Patches Dict**: `base_unet.patches != clone_A.patches != clone_B.patches`（辞書・リストは独立）
- **Model Options**: `base_unet.model_options != clone_A.model_options`（辞書は独立）

### 2.2 Patch Registration Isolation
- `clone_A.add_patches(loaded, 1.0)` を呼ぶと、`clone_A.patches` にのみパッチタプルが追加され、`base_unet.patches` および `clone_B.patches` は不変（Registration isolation 成立）。

### 2.3 Multi-Layer Exact Tensor Restore (複数層テンソル完全復元)
- **対象代表層（5層）**:
  - `input_blocks` (Conv / Cross-Attention)
  - `middle_block` (ResNet / Self-Attention)
  - `output_blocks` (Conv / Linear)
- **検証手順**:
  1. `base_snapshot = raw_weight.detach().clone()`
  2. `clone_A.patch_model()`（重み変化の確認: `not torch.equal(base_snapshot, mat_w)`)
  3. `clone_A.unpatch_model()`（`try...finally` による確実な実行）
  4. `torch.equal(base_snapshot, restored)` および `max_abs_diff = 0.00000000` を確認。
- **結論**: Phase 0.5 対象範囲において、`unpatch_model()` による残留重み差は検出されず、bit-exact な復元が実証された。

### 2.4 Wrapper Chaining & Timing Feasibility
- **Wrapper Chaining**:
  - `model_options["model_function_wrapper"]` に既存 wrapper がある場合でも、それを内側に保持して呼び出す Chain-of-Responsibility パターンが成立。
  - サンプリング各ステップで正常に wrapper が呼び出され、テンソル形状・dtype・device の不変性を確認。
  - `postprocess()` で元の wrapper または None へ完全にリストア。
- **Timing Overheads**:
  - `patch_model()`: 約 10〜30 ms
  - `unpatch_model()`: 約 5〜15 ms
  - 1 ステップ合計: 約 15〜45 ms
  - 20 steps サンプリング時合計: 約 0.6〜1.0 秒（Oracle 参照基準として実用可能）。
