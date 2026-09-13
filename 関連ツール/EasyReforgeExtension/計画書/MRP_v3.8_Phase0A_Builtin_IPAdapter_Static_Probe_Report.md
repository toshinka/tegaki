# Phase 0A Result

Environment:
Stable Diffusion WebUI Forge (reForge) built-in extensions (`E:\EasyReforge\stable-diffusion-webui-reForge`)

Built-in ControlNet:
FOUND (`extensions-builtin\sd_forge_controlnet`)

Built-in IP-Adapter:
FOUND (`extensions-builtin\sd_forge_ipadapter`)

External Unit API:
PARTIAL (`lib_controlnet.external_code.ControlNetUnit` / `p.script_args` / Web API payload 構造を確認。`external_code` 側に `get_all_units` 相当のヘルパーは非公開だが、`ControlNetUnit` クラスおよび `to_processing_unit` は存在)

IP-Adapter Reference Image Input:
CONFIRMED (`ControlNetUnit.image` (`{"image": np.ndarray, "mask": np.ndarray}` 形式または単一 `np.ndarray` / base64))

Regional Mask Path:
CONFIRMED (コード上 `ControlNetUnit.mask_image` / `unit.image['mask']` -> `ControlNet.process_unit_after_click_generate` -> `params.control_mask` -> `IPAdapterPatcher.process_before_every_sampling` -> `opIPAdapterApply(attn_mask=mask.squeeze(1))` -> `CrossAttentionPatch` まで完全疎通を確認)

User-owned Unit Coexistence:
LIKELY (`ControlNetForForgeOfficial.process` は渡された `args` (Unit配列) を順次展開処理する構造。MRPが `p.script_args` の ControlNet スロット末尾へ Unit を注入またはマージすることで共存可能見込み)

Recommended next step:
RUNTIME ORACLE

---

## 12 Probe 詳細調査結果

### Probe 01 — 実装配置
- **判定**: CONFIRMED
- **ファイル & 構造**:
  - `sd_forge_ipadapter\scripts\forge_ipadapter.py`:
    - `modules_forge.shared.add_supported_preprocessor` で `CLIP-ViT-H (IPAdapter)`, `CLIP-ViT-bigG (IPAdapter)`, `InsightFace+CLIP-H` などを登録。
    - `modules_forge.shared.add_supported_control_model(IPAdapterPatcher)` で IP-Adapter 専用パッチャーを登録。
  - `sd_forge_controlnet\scripts\controlnet.py`:
    - `cached_controlnet_loader(model_filename)` -> `try_load_supported_control_model(ckpt_path)` により、ControlNet 側が IP-Adapter モデル（safetensors 内の `ip_adapter` キー）を認識し、`IPAdapterPatcher` インスタンスとして透過的にロード・保持する。
  - UI上で `IP-Adapter` を選択すると、ControlNet の preprocessor として `CLIP-ViT-* (IPAdapter)` が呼ばれ、model に `ip-adapter_*.safetensors` が割り当てられ、サンプリング時に `IPAdapterPatcher.process_before_every_sampling` が実行される。

### Probe 02 — ControlNet Unit相当データ型
- **判定**: CONFIRMED
- **クラス**: `lib_controlnet.external_code.ControlNetUnit` (`extensions-builtin\sd_forge_controlnet\lib_controlnet\external_code.py` L186-275)
- **確認された field 実名**:
  - `enabled: bool = True`
  - `module: str = "None"` (preprocessor)
  - `model: str = "None"`
  - `weight: float = 1.0`
  - `guidance_start: float = 0.0`
  - `guidance_end: float = 1.0`
  - `image: Optional[GradioImageMaskPair] = None` (`{"image": ndarray, "mask": ndarray}`)
  - `mask_image: Optional[GradioImageMaskPair] = None`
  - `control_mode: ControlMode = ControlMode.BALANCED`
  - `resize_mode: ResizeMode = ResizeMode.INNER_FIT`
  - `processor_res: int = -1`
  - `threshold_a: float = -1`, `threshold_b: float = -1`
  - `pixel_perfect: bool = False`
  - `hr_option: HiResFixOption = HiResFixOption.BOTH`
  - `advanced_weighting: Optional[List[float]] = None`
  - `ipa_block_weight: Optional[str] = None`

### Probe 03 — IP-Adapter選択方法
- **判定**: CONFIRMED
- **設定値**:
  - `unit.module`: 例 `'CLIP-ViT-H (IPAdapter)'` (SD1.5) または `'CLIP-ViT-bigG (IPAdapter)'` (SDXL)（`modules_forge.shared.supported_preprocessors` に登録された名称）
  - `unit.model`: 例 `'ip-adapter_sd15 [hash]'`（`lib_controlnet.global_state.controlnet_names` に合致するファイル名）
  - この2つを設定することで、ControlNet は自動的に `IPAdapterPatcher` と ClipVision プリプロセッサの組み合わせとして駆動する。

### Probe 04 — Reference Image入力
- **判定**: CONFIRMED
- **入力形式**:
  - `unit.image`: `{"image": np.ndarray (HWC/uint8), "mask": np.ndarray}` の dict、または base64 / ndarray。
  - `controlnet.py` L220-224 で `unit.image['image']` が抽出され `HWC3(image)` 変換される。
  - Preprocessor 側 (`forge_ipadapter.py` L21-30) では `numpy_to_pytorch(input_image)` され、`cond = dict(clip_vision=..., image=...)` として `apply_ipadapter` へ渡る。

### Probe 05 — Mask経路（最重要項目）
- **判定**: CONFIRMED (静的コード追跡完了)
- **コード追跡結果**:
  1. `ControlNetUnit.mask_image` または `unit.image['mask']` にマスクを配置。
  2. `controlnet.py` (L232-245): `mask` を抽出・リサイズし、`image_list = [[image, mask]]` を生成。
  3. `controlnet.py` (L392-414): `input_mask` が `crop_and_resize_image` され、`params.control_mask` (shape `[B, 1, H, W]`) としてキャッシュ。
  4. `controlnet.py` (L525): `params.model.process_before_every_sampling(p, cond, mask, ...)` に渡る。
  5. `forge_ipadapter.py` (L145, 163): `IPAdapterPatcher.process_before_every_sampling` 内で `opIPAdapterApply(..., attn_mask=mask.squeeze(1) if mask is not None else None)` を実行。
  6. `IPAdapterPlus.py` (L845, 858): `patch_kwargs["mask"] = attn_mask`。
  7. `IPAdapterPlus.py` (L521-560): `CrossAttentionPatch.__call__` 内で `mask_downsample = F.interpolate(mask.unsqueeze(1), size=(mask_h, mask_w), mode="bicubic")` され、`out_ip = out_ip * mask_downsample` により IP-Adapter の cross-attention 出力へ空間局所マスクが掛け合わされる。
- **Mask 極性・形式**:
  - 白 (255 / 1.0) が適用部、黒 (0 / 0.0) が非適用部。
  - expected shape: `[B, 1, H, W]` または `[B, H, W]`（`CrossAttentionPatch` 側で UNet attention resolution に合わせて補間リサイズされる）。
- **注意点 (要Runtime Oracle)**:
  - bicubic 補間による境界値の滲み、および複数 IP-Adapter 同時適用時の相互作用は実画像生成で確認が必要。

### Probe 06 — 外部extensionからのUnit操作経路
- **判定**: LIKELY
- **候補経路**:
  - `p.script_args`: reForge の AlwaysVisible scripts では、各スクリプトに割り当てられた `p.script_args[script.args_from:script.args_to]` に UI/API 引数が格納される。
  - `ControlNetForForgeOfficial` スクリプトの `script.args_from:script.args_to` を特定し、その中の Unit リストにアクセスまたは追加する方式。
  - または `before_process` / `process` 段階で `p.script_args` 内の該当インデックスに `ControlNetUnit` を合成・配置する方式。
  - builtin extension 自体の改変や DOM 操作・モンキーパッチは不要。

### Probe 07 — User-owned Unitとの共存
- **判定**: LIKELY
- **理由**:
  - `controlnet.py` の `process` / `process_before_every_sampling` は、引数 `args`（Unit のリスト）から `enabled` なものを抽出し、リスト `enabled_units = self.get_enabled_units(args)` として 0 から順にループ処理する。
  - ユーザーが WebUI の Unit 0 / Unit 1 で設定した既存の Unit はそのまま保持し、MRP-managed Unit をリスト末尾に追加（または空きスロットへ割り当て）することで、既存 ControlNet 処理を破壊せず共存可能。

### Probe 08 — Unit上限
- **判定**: CONFIRMED
- **仕様**:
  - UIスロット数は設定値 `shared.opts.data.get("control_net_unit_count", 3)` に依存。
  - 一方、バックエンド処理 (`get_enabled_units(args)`) は可変長引数 `*args` をそのままイテレートしており、コード上のハードコード上限は存在しない。
  - ただし UI 側と `p.script_args` の整合性を保つため、UIスロット内での共存か、バックエンド引数注入かの設計検証が必要。

### Probe 09 — Hook / 実行順
- **判定**: LIKELY (NEEDS RUNTIME ORACLE)
- **実行順**:
  1. `p.scripts.process(p)`:
     - `ControlNetForForgeOfficial.sorting_priority = 10`
     - `MangaPrompter.sorting_priority = 0` (デフォルト)
     - `scripts.py` の `ordered_scripts('process')` による順序で各スクリプトの `process` が実行。
  2. `p.scripts.process_before_every_sampling(p)`:
     - ControlNet が `process_unit_before_every_sampling` を実行し、`IPAdapterPatcher` が `opIPAdapterApply` を通じて `unet` の cross-attention (`set_model_patch_replace`) にフックを仕掛ける。
     - MRP (`MangaPrompter`) が `process_before_every_sampling` で `p.sd_model.forge_objects.unet` に対し `set_model_attn2_patch` / `set_model_attn2_output_patch` を仕掛ける。
- **潜在的な相互作用（要検証）**:
  - IP-Adapter の patch (`set_model_patch_replace` / `CrossAttentionPatch`) と MRP の patch (`set_model_attn2_patch`) が同一 UNet 上でどのようにネストされるか、衝突や上書きが起きないかを Runtime Oracle で確認する必要がある。

### Probe 10 — Model / Preprocessor列挙経路
- **判定**: CONFIRMED
- **列挙関数**:
  - Preprocessor: `lib_controlnet.global_state.get_filtered_preprocessor_names('IP-Adapter')` または `modules_forge.shared.supported_preprocessors` の key。
  - Model: `lib_controlnet.global_state.get_filtered_controlnet_names('IP-Adapter')` または `global_state.controlnet_names`。
  - SD1.5 / SDXL の識別: `lib_controlnet.global_state.get_sd_version()` (`StableDiffusionVersion.SD1x` / `StableDiffusionVersion.SDXL`)。
  - MRP 側で固定リストを持たず、環境内のモデルを動的列挙可能。

### Probe 11 — txt2img / img2img / Highres Fix
- **判定**: CONFIRMED
- **分岐仕様**:
  - `txt2img` / `img2img`: `ControlNetUnit.hr_option` (`HiResFixOption.BOTH`, `LOW_RES_ONLY`, `HIGH_RES_ONLY`) でパスごとの有効/無効を制御可能。
  - `Highres Fix`: `controlnet.py` (L300-305, L379-386, L403-413) で 1st pass (`h, w`) と 2nd pass (`hr_y, hr_x`) の解像度に応じた mask/cond の自動補間・キャッシュ切替が内蔵されている。

### Probe 12 — MRPとの接続候補
- **候補方式**:
  ```text
  Candidate bridge entry:
  ControlNet Unit Injection via p.script_args / ControlNetUnit

  Input:
  - image: Reference Card の PIL / np.ndarray
  - mask: MangaSpatialEngine から得たコマ単位の binary mask (0/255)
  - module: 'CLIP-ViT-H (IPAdapter)' / 'CLIP-ViT-bigG (IPAdapter)'
  - model: 検出された IP-Adapter safetensors 名
  - weight: Reference Card で設定された強度 (0.0 - 1.0)
  - hr_option: BOTH

  Unit coexistence:
  LIKELY

  Reason:
  ControlNet 内部で IP-Adapter が独立した Patcher として完結しており、
  ControlNetUnit に mask を渡すだけで IPAdapterPlus の cross-attention mask 経路へ
  完全到達する。MRP 独自で IP-Adapter を実装・移植する必要は一切ない。
  ```

---

## 判定と推奨次ステップ

- **総合判定**: `CONDITIONAL — RUNTIME ORACLE REQUIRED`
- **推奨次ステップ**: `RUNTIME ORACLE`
- **理由**:
  - 静的コード解析により、内蔵 IP-Adapter に対するマスク入力経路（`ControlNetUnit.mask_image` -> `IPAdapterPatcher` -> `CrossAttentionPatch` の `mask_downsample` 掛け合わせ）が明確に確認された。
  - 一方で、MRP の Attention Hook (`manga_attention.py` の `attn2_patch`) と IP-Adapter の Attention Hook (`IPAdapterPlus.py` の `CrossAttentionPatch`) が同一 UNet 上で同時に稼働した際の相互作用・二重パッチの安定性については、実際のサンプリング実行（Runtime Oracle）による確認が不可欠である。
