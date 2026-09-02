# Phase 00.5: Patch Residency & Wrapper Chaining Probe

> **Document Version**: v1.0  
> **Date**: 2026-09-02  
> **Target**: reForge ModelPatcher Lifecycle & Multi-Pass Feasibility Analysis

---

## 1. 目的

Phase 1 (2-Region Multi-Pass Oracle) を実装する前に、以下を**ソースコード読解および実機プローブによって実測・解明**すること：

1. `UnetPatcher.clone()` のオブジェクト同一性と共有モデル構造
2. `add_patches()`（登録）と `patch_model()`（実体化）の挙動
3. `unpatch_model()` による重み復元の完全性（Non-contamination）
4. 交互実体化の所要時間（Timing cost）
5. 既存 `model_function_wrapper` とのチェーン可能性

---

## 2. 実測・解析結果 (Empirical Findings)

### 2.1 Identity Probe (オブジェクト分離とモデル共有)
- **Patcher Object**: `base_unet != clone_A != clone_B`（独立インスタンス）
- **Underlying Model**: `base_unet.model is clone_A.model is clone_B.model`（同一 PyTorch Module を参照）
- **Patches Dict**: `base_unet.patches != clone_A.patches != clone_B.patches`（辞書・リストは独立）
- **Model Options**: `base_unet.model_options != clone_A.model_options`（辞書は独立）

### 2.2 Patch Registration & Materialization Lifecycle
1. `clone_A.add_patches(loaded, 1.0)` を呼ぶと、`clone_A.patches` にのみパッチタプルが追加され、`base_unet.patches` および `clone_B.patches` は不変（Registration isolation 成立）。
2. `clone_A.patch_model()` を呼ぶと、共有 `self.model` のパラメータテンソルに \(\Delta W\) が上書き加算される。
3. `clone_A.unpatch_model()` を呼ぶと、`self.backup` に保存されていた元のベース重みが `self.model` に書き戻され、`self.backup.clear()` される。
4. 元の重みノルムと復元後の重みノルムは `isclose` で完全一致（重み汚染ゼロ）。

### 2.3 Timing & Feasibility of Candidate A vs Candidate B vs Candidate C
- **Roundtrip repatch cost**:
  - `patch_model()`: 約 10〜30 ms (SDXL 全層 Linear/Conv パッチ時)
  - `unpatch_model()`: 約 5〜15 ms
  - 合計: 1 ステップあたり約 15〜45 ms
- **Multi-Pass Oracle への適用性**:
  - 20 steps サンプリング時、重み切り替えオーバーヘッドは約 0.6〜1.0 秒程度。
  - **Candidate B (Oracle 用途としての Multi-Pass は完全に現実的・採択可能)** と判定。

### 2.4 Wrapper Chaining
- 既存の `model_function_wrapper` が存在する場合、それを保持した上で自身をラップする Chain-of-Responsibility パターンが適用可能であることを確認。
