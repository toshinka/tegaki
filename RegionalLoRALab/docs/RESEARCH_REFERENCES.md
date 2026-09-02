# Regional LoRA Lab - Research References & Precedent Analysis

---

## 1. 先行研究・既存実装の詳細分析

### ① kohya-ss / sd-scripts
- **Repository URL**: https://github.com/kohya-ss/sd-scripts
- **Relevant File / Document**: `doc/regional_lora.md`, `networks/lora.py`
- **License**: Apache-2.0
- **What was actually borrowed conceptually**:
  - 空間マスクと各 LoRA の network multiplier を対応させる Regional LoRA の概念。
  - UNet LoRA と Text Encoder LoRA の分離設計思想。
- **What must NOT be copied directly**:
  - 学習時およびスクリプト単体生成用の PyTorch forward 実装コード（reForge の ModelPatcher / ldm_patched 構造と異なるため）。
- **Applicability to reForge / SDXL**:
  - 概念は高い親和性を持つが、reForge への実装は `ModelPatcher` API に合わせた独自設計が必要。

---

### ② hako-mikan / sd-webui-regional-prompter
- **Repository URL**: https://github.com/hako-mikan/sd-webui-regional-prompter
- **Relevant File / Document**: `scripts/regional_prompter.py`
- **License**: AGPL-3.0
- **What was actually borrowed conceptually**:
  - Attention mode vs Latent mode の分離比較アプローチ。
  - 領域分割（縦・横・比率）のユーザーインターフェース設計。
- **What must NOT be copied directly**:
  - AGPL-3.0 ライセンスコードの直接取り込みおよび A1111 固有の hooks。
- **Applicability to reForge / SDXL**:
  - reForge の Forge backend では内部構造が異なるため、コードの流用は不可。

---

### ③ Panchovix / sd_webui_loractl_reforge_y
- **Repository URL**: https://github.com/Panchovix/sd_webui_loractl_reforge_y
- **Relevant File / Document**: `scripts/loractl.py`
- **License**: MIT
- **What was actually borrowed conceptually**:
  - reForge 上での LoRA multiplier 実行時制御と `ModelPatcher` へのアクセス手法。
- **What must NOT be copied directly**:
  - step 依存のスケジューリング計算式（本研究の空間分離とは目的が異なる）。
- **Applicability to reForge / SDXL**:
  - reForge との親和性が最も高く、patcher の操作手法の技術参考として有用。

---

### ④ ComfyUI Impact Pack (Regional Sampler)
- **Repository URL**: https://github.com/ltdrdata/ComfyUI-Impact-Pack
- **Relevant File / Document**: `modules/impact/regional_nodes.py`
- **License**: GPL-3.0
- **What was actually borrowed conceptually**:
  - 領域ごとの ModelPatcher clone と sampling hook の組み合わせ思想。
- **What must NOT be copied directly**:
  - ComfyUI ノード定義およびワークフロー実行パイプライン。
- **Applicability to reForge / SDXL**:
  - 概念参考のみ。

---

### ⑤ Krea / Forge Neo Multi-LoRA
- **Repository URL**: Proprietary / Web publication
- **License**: UNKNOWN - VERIFY BEFORE COPYING
- **What was actually borrowed conceptually**:
  - Spatial token gating の概念。
- **What must NOT be copied directly**:
  - 一切のコードコピー禁止。
- **Applicability to reForge / SDXL**:
  - SDXL UNet 構造には直接適用不可（Transformer-only モデル向け）。
