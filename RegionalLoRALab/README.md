# Regional LoRA Lab (RLL)

> 🔬 **reForge向け Regional LoRA Engine 試作研究プロジェクト**  
> *Separate Research Project from Manga Region Prompter (MRP)*

---

## 📌 概要 (Overview)

本プロジェクトは、Stable Diffusion WebUI Forge / reForge (`stable-diffusion-webui-reForge`) 上において、**1枚の画像生成の中で領域（Region）ごとに異なるLoRAをUNetレベルで独立適用する「Regional LoRA Engine」** の実現可能性を段階的に検証・研究するための独立したラボプロジェクトです。

実用本命である「EasyReforge Manga Prompter (MRP)」の安定した生成コアを一切破壊せず、クリーンで安全な独立した拡張機能として開発・検証を進めます。

---

## 🎯 目標と研究アプローチ

1. **Phase 0 (現在完了)**: 環境調査・LoRAロード経路解析・非侵襲Probe拡張の実装
2. **Phase 1**: 2-Region Multi-Pass Oracle (遅くても確実に空間分離する基準正解系の確立)
3. **Phase 2**: LoRA / Text Encoder Scope Separation (UNet vs TE の分離実測)
4. **Phase 3**: Masked Delta Feasibility Probe (1-pass化に向けた空間マスク積の実現可能性調査)
5. **Phase 4**: One-Pass Masked LoRA PoC (1回のUNet forwardで2つのLoRAを空間分離)
6. **Phase 5**: Generalization (多領域・重み・矩形拡張)
7. **Phase 6**: MRP Bridge (MRPとの疎結合連携)

---

## ⚙️ 動作環境 (Verified Environment)

- **Platform**: `stable-diffusion-webui-reForge` (commit `19395bf`)
- **Python**: 3.10.6
- **PyTorch**: 2.7.1+cu128
- **CUDA**: 12.8
- **GPU**: NVIDIA GeForce RTX 4070 (VRAM: 12.0 GB)
- **Target Model**: SDXL / Illustrious 系 Standard LoRA

---

## ⚠️ 注意事項 (Safety & Non-Goals)

- 本拡張は実験用ラボ機能です。
- 無効時は完全 no-op であり、通常の WebUI / reForge 生成プロセスやモデル重みに一切の干渉・汚染を行いません。
- Phase 0 時点では生成テンソルの書き換えは行わず、モデル構造とLoRAの診断プローブのみを実行します。

---

## 📚 ドキュメントナビゲーション

- **Master Plan**: [`MASTER_PLAN.md`](./MASTER_PLAN.md)
- **Current Status**: [`CURRENT_STATUS.md`](./CURRENT_STATUS.md)
- **GPT Review Links**: [`GPT_GITHUB_LINKS.txt`](./GPT_GITHUB_LINKS.txt)
- **LoRA Flow Analysis**: [`docs/REFORGE_LORA_FLOW.md`](./docs/REFORGE_LORA_FLOW.md)
- **Architecture Notes**: [`docs/ARCHITECTURE_NOTES.md`](./docs/ARCHITECTURE_NOTES.md)
- **Phase 00 Report**: [`reports/PHASE_00_REPORT.md`](./reports/PHASE_00_REPORT.md)
