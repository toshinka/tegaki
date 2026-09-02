# Phase 01: 2-Region Multi-Pass Oracle Design (Draft / Pending Phase 0.5)

> **Status**: DRAFT (Phase 0.5 実測結果を受けて確定予定)  
> **Scope**: UNet LoRA Only (Text Encoder multiplier = 0)

---

## 1. 目的

遅くてもよいので、左右に別々の LoRA（左=LoRA A, 右=LoRA B）を独立した重み状態で計算する**基準正解実装（Oracle Reference Baseline）** を確立する。

---

## 2. 最小仕様と制約

### 2.1 対象範囲
- **UNet LoRA のみ**（Text Encoder は multiplier = 0 として除外）
- **左右 50:50 固定マスク**（自由矩形やソフトマスクは Phase 5 以降）
- **プロンプト内の通常 `<lora:...>` タグ禁止**（Regional LoRA Lab 側でロードを完全管理）

### 2.2 実装候補の検討 (Phase 0.5 の実測結果に基づく判定)

- **Candidate A (高速交互実体化可能)**:
  `patch_model()` / `unpatch_model()` のコストが極めて低く（数ms以下）、毎ステップ交互に実行可能である場合。
  ```python
  # 毎ステップの forward 内で:
  clone_A.patch_model()
  out_A = apply_model(params["input"], params["timestep"], **params["c"])
  clone_A.unpatch_model()

  clone_B.patch_model()
  out_B = apply_model(params["input"], params["timestep"], **params["c"])
  clone_B.unpatch_model()

  out_combined = mask_A * out_A + mask_B * out_B
  ```

- **Candidate B (交互実体化が高コストだが Oracle 用途としては許容)**:
  毎ステップの repatch に数十〜数百msかかるが、数秒の遅延で済むため参照正解画像としては採択可能。

- **Candidate C (共有モデル構造上、交互実体化が不適切)**:
  Multi-Pass 方式を再検討し、Phase 3-4 (Masked Delta / Custom forward) を前倒しで開発。
