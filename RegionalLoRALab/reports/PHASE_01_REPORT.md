# Phase 01 Report — 2-Region Multi-Pass Oracle

## Status
**IMPLEMENTED / AWAITING VISUAL VALIDATION**

---

## Implementation Commit
https://github.com/toshinka/tegaki/commit/e830ef9df25e5d36d8ac40e405a4edc7bbfed4f3
(`e830ef9d`)

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

## Frozen Scope (Phase 1 仕様凍結項目)
- **Architecture**: Candidate B — Alternating Patch Materialization
- **Regions / Geometry**: 2 領域固定 (Left 50% / Right 50%)
- **Mask Type**: Hard Binary Mask (`mask_A + mask_B = 1.0`)
- **LoRA Type**: Standard UNet LoRA only
- **Text Encoder**: Disabled / Multiplier = 0.0
- **Prompt Constraints**: 通常のトリガー単語は許可、`<lora:...>` タグは禁止 (Lab側で直接管理)
- **Batch Size**: 1 固定
- **External Dependencies**: ControlNet OFF, MRP 非連携, 他の Model Wrapper / Patch OFF

---

## Implementation Details
1. **Safety Gate Errata 修正**:
   - `self.restore_success` のエラーラッチ保持（`restore_success = restore_success and all_exact`）。
   - Stale wrapper recovery 時に `_rll_previous_wrapper` を保持し、他 extension のラッパーを誤削除しない安全機構を構築。
   - `run_branch()` 内での `try...finally: branch.unpatch_model()` 統一。
2. **LoRA A/B UNet-only Loader**:
   - WebUI のプロンプトパースを経由せず、UI で選択された LoRA A/B の `.safetensors` をサンプリング前に 1 度だけ直接ロード。
   - `model_lora_keys_unet()` により UNet 側のみパッチ登録し、CLIP key map は作成しない（Text Encoder 汚染ゼロ）。
3. **Preflight Guards & Fail-Closed Policies**:
   - プロンプト内の `<lora:...>` タグ検出時に自動除去して global activation を防止し、Phase 1 を安全に block。
   - Base UNet に既存パッチ（`len(patches) > 0`）または既存 `model_function_wrapper` が存在する場合は fail-closed で実行を停止。
4. **Alternating Patch Materialization & Mask Blending**:
   - 各サンプリングステップで同一の `params`（input, timestep, c）に対し：
     1. `clone_A.patch_model()` → `forward` → `clone_A.unpatch_model()`
     2. `clone_B.patch_model()` → `forward` → `clone_B.unpatch_model()`
     3. `out_A * mask_A + out_B * mask_B` による空間合成。
   - テンソルの `ndim == 4`, shape, dtype, device の完全一致を検証。
5. **Runtime Diagnostics & Cleanup**:
   - 各ステップの patch/forward/unpatch/blend 所要時間を集計し、サンプリング終了時にサマリーを出力。
   - `postprocess()` で `model_function_wrapper` および一時参照を完全クリーンアップ。

---

## Runtime Invariants
- **Registration Isolation**: `clone_A` と `clone_B` の `patches` 辞書は独立し、ベースモデルを共有。
- **Per-step Clean State**: 各 branch の forward 終了直後に必ず `unpatch_model()` が実行され、次ステップへ重み状態を持ち越さない。
- **Mask Exactness**: `mask_A + mask_B == 1.0` が全要素で成立。

---

## Performance (Estimated / Live Metric Target)
- 1 ステップあたりの repatch オーバーヘッド: 約 30〜60 ms (Branch A + Branch B)
- 20 steps サンプリング時追加時間: 約 0.6〜1.2 秒（Oracle 参照基準として極めて高速に動作可能）。

---

## Automated / Smoke Tests
- [x] Base patch / existing wrapper guard
- [x] `<lora:...>` prompt tag stripping guard
- [x] LoRA state dict load & UNet patch registration
- [x] Multi-layer exact tensor restore verification
- [x] Stale wrapper recovery verification

---

## User Visual Validation
**STATUS: PENDING USER TEST**

以下の対照実験マトリクスによる視覚確認を依頼：
1. **Control 0**: No LoRA (Baseline)
2. **Control A**: Global LoRA A
3. **Control B**: Global LoRA B
4. **Control AB**: Global LoRA A + B
5. **Experimental**: RLL Left=A / Right=B
6. **Swap Test**: RLL Left=B / Right=A
7. **Same Test**: RLL Left=A / Right=A

---

## Known Problems & Limitations
- **Multi-Pass Overhead**: UNet forward を 1 ステップあたり 2 回実行するため、純粋な forward 時間は約 2 倍となります（※Oracle 基準正解系としての意図的トレードオフ）。
- **Receptive Field / Attention Influence**: A/B branch は画像全体の latent を参照するため、重みは分離されていても大域的な構図・文脈による意味的相互作用は残り得ます（※完全無漏洩ではなく、Global A+B に対する明確な漏洩低減を目標とします）。
- **Text Encoder UNet Mismatch**: TE LoRA を無効化（0.0）しているため、Text Encoder 依存の強いトリガー単語では発火が弱まる可能性があります（Phase 2 で調査予定）。

---

## Decision
**WAITING FOR USER / GPT REVIEW**  
コード実装・安全機構・Preflight は完了。ユーザーによる視覚テスト結果およびコンソールログの確認後、Phase 1 の最終判定を行う。

---

## Latest Commit
UPDATE_AFTER_PUSH
