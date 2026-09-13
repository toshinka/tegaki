# Phase 0C Result

Decision:
GO — CLEAN BRIDGE

Error A root cause:
`controlnet.py` の `get_input_data()` (L216-218) において、`unit.image is None` の分岐に入った際に、img2img の init_image 流用を想定して `external_code.resize_mode_from_value(p.resize_mode)` を参照している。しかし、txt2img の `StableDiffusionProcessingTxt2Img` オブジェクトには `resize_mode` 属性が存在しない（`resize_mode` は `StableDiffusionProcessingImg2Img` のみの属性）。UIから手動操作した場合に、有効化した Unit の input image の送信が空（または非同期更新漏れ）であったか、あるいは disabled な複数 Unit（Unit 1, 2）が `p.resize_mode` を読みにいって AttributeError となった。

Error B/C root cause:
`KeyError: 1` は独立したバグではなく、Error A（`process()` の中断）に起因する直接的な二次障害である。`controlnet.py` の `process()` (L568-576) で `self.current_params = {}` が初期化され、`enabled_units` を走査して `self.current_params[i]` を格納するが、先頭付近の Unit 処理中に Error A で例外が発生して `process()` が途中で中断した。しかし `modules/scripts.py` はスクリプトの例外を `errors.report` で補足して処理を続行するため、後続の `process_before_every_sampling()` および `postprocess_batch_list()` が呼び出され、辞書 `self.current_params` に登録されていないキー `1` を参照して `KeyError: 1` が発生した。

Is KeyError secondary to Error A?:
YES

Can MRP avoid this without modifying builtin?:
YES

Required workaround class:
CLASS A — CLEAN BRIDGE

Recommended next step:
MRP Bridge 側で有効な `image` / `mask` を持つ完全な `ControlNetUnit` オブジェクトを直接構築・供給する設計を採用し、UI手動入力時の画像欠落・不整合経路をバイパスする。念のための保険として、Processing オブジェクトに `resize_mode` が存在しない場合は安全なデフォルト値（`0`）を付与する 1 行の局所ガード（CLASS B shim）を併用すれば完璧に防御可能。

---

## 4つの重要質問への回答

### Q1. `p.resize_mode` AttributeErrorは何が原因か
- **原因区分**: ControlNet側の実装不整合 ＋ txt2img/img2img差異 ＋（UI操作時の）Unit設定状態。
- **詳細**:
  - `modules/processing.py` において、`resize_mode` は `StableDiffusionProcessingImg2Img` に定義された属性（L1602: `resize_mode: int = 0`）であり、`StableDiffusionProcessingTxt2Img` には元々存在しない。
  - `controlnet.py` の `get_input_data()` L216-218 では:
    ```python
    elif unit.image is None:
        resize_mode = external_code.resize_mode_from_value(p.resize_mode)
        image = HWC3(np.asarray(a1111_i2i_image))
        using_a1111_data = True
    ```
    となっており、`unit.image is None` のときに「A1111 の img2img 入力画像を流用する」前提で書かれている。
  - txt2img 実行時に、もし Unit の `image` が `None`（空）のまま当該処理に入ると、`p.resize_mode` を参照して即座に `AttributeError: 'StableDiffusionProcessingTxt2Img' object has no attribute 'resize_mode'` となる。
  - 逆に言えば、**`unit.image` に適切な画像（numpy / dict）が正しくセットされていれば、この `elif unit.image is None:` 分岐は完全にスキップされる**。

### Q2. `KeyError: 1` は独立した不具合か、Error Aの二次障害か
- **原因区分**: Error A の直接的な二次障害 (YES)。
- **コード上の因果関係**:
  - `controlnet.py` L567-576 (`process`):
    ```python
    self.current_params = {}
    enabled_units = self.get_enabled_units(args)
    for i, unit in enumerate(enabled_units):
        params = ControlNetCachedParameters()
        self.process_unit_after_click_generate(p, unit, params, *args, **kwargs)
        self.current_params[i] = params
    ```
  - `process_unit_after_click_generate` の内部（L312）で `get_input_data()` が呼ばれ、Error A が発生すると、`self.current_params[i]` に値が代入される前に例外でループが中断する。
  - `modules/scripts.py` L849-854 では `try ... except Exception: errors.report(...)` で握り潰して次のパイプラインへ進む。
  - サンプリング直前の `process_before_every_sampling` (L579-582):
    ```python
    for i, unit in enumerate(self.get_enabled_units(args)):
        self.process_unit_before_every_sampling(p, unit, self.current_params[i], *args, **kwargs)
    ```
    ここでは `self.current_params` のキー存在チェックを行わずに `self.current_params[i]` を参照するため、`KeyError: 1`（または中断されたインデックス）が発生する。
  - 同様に `postprocess_batch_list` (L585-588) でも同じ `self.current_params[i]` を引くため `KeyError: 1` が再発する。
  - したがって、Error A を防止すれば `self.current_params` は正常に全件キャッシュされ、Error B/C は自然消滅する。

### Q3. この問題はMRP Bridge側から既存APIの正しい使用、または数行のshimで回避可能か
- **回答**: YES（CLASS A で本質的に回避可能。CLASS B shim を加えれば 100% 堅牢）。
- **回避ロジック**:
  - **CLASS A (Clean Bridge)**:
    - MRP Bridge から ControlNet に Unit を渡す際、`ControlNetUnit(image={"image": np_img, "mask": np_mask}, resize_mode=ResizeMode.INNER_FIT, ...)` のように、必ず明示的な `image` と `resize_mode` を持った有効なオブジェクトを構築する。
    - これにより `unit.image is None` の分岐（L216-218）に絶対に入らないため、Error A は根本から発生しなくなる。
  - **CLASS B (Local Compatibility Shim)**:
    - 万が一のユーザー手動設定ミスや外部Unitの空画像による巻き添えクラッシュを防ぐため、MRPの `before_process` または `process` にて、以下のような 2 行の防御 shim を置くことができる:
      ```python
      if not hasattr(p, 'resize_mode'):
          p.resize_mode = 0  # Just Resize
      ```
    - これは builtin ファイル・reForge 本体・frozen core のいずれも一切書き換えず、メモリ上の `p` オブジェクトにデフォルト属性を添えるだけであり、副作用ゼロで完全な安全弁となる。

### Q4. 安全なBridgeでは解決不能で、builtin改変やmonkey patchが必要か
- **回答**: NO（builtin改変・モンキーパッチは一切不要）。
- **理由**:
  - `sd_forge_controlnet`、`sd_forge_ipadapter`、reForge 本体のコードを 1 行も修正する必要はない。
  - private 内部状態の書き換えや Gradio DOM 操作も不要。

---

## [Evidence]

- **File**: `extensions-builtin\sd_forge_controlnet\scripts\controlnet.py`
  - **Symbol**: `ControlNetForForgeOfficial.get_input_data()` (L216-218)
  - **Behavior**: `elif unit.image is None: resize_mode = external_code.resize_mode_from_value(p.resize_mode)` で txt2img 時に未定義の `p.resize_mode` を参照しクラッシュする。
- **File**: `modules\processing.py`
  - **Symbol**: `StableDiffusionProcessingTxt2Img` (L1200-) / `StableDiffusionProcessingImg2Img` (L1600-1602)
  - **Behavior**: `resize_mode` は `StableDiffusionProcessingImg2Img` にのみ `resize_mode: int = 0` として定義されており、Txt2Img には存在しない。
- **File**: `extensions-builtin\sd_forge_controlnet\scripts\controlnet.py`
  - **Symbol**: `ControlNetForForgeOfficial.process()` (L568-576) および `process_before_every_sampling()` (L579-582)
  - **Behavior**: `process()` 内で例外が発生すると `self.current_params` が不完全なまま中断し、後続の `process_before_every_sampling()` で `self.current_params[i]` を引いて `KeyError` となる。

---

## [Bridge Feasibility]

- **Reference image**: PASS (`ControlNetUnit.image` に完全な ndarray を渡せば正常に Preprocessor へ到達)
- **Regional mask**: PASS (Phase 0Aで確認済みの通り、`CrossAttentionPatch` まで疎通)
- **User-owned Unit coexistence**: LIKELY (MRP 側で生成した Unit を末尾に結合可能)
- **Runtime lifecycle**: PASS (ライフサイクル順序・Hookタイミングともに整合)
- **Frozen core modification required**: NO (MRP の `manga_attention.py` 等は変更不要)
- **Builtin modification required**: NO (reForge / extensions-builtin のファイル変更不要)

---

## [Cost Assessment]

- **Implementation size**: 2 (MRP 側の Bridge クラス内に Unit 生成と `p.resize_mode` 安全弁を設けるのみ、数十行規模)
- **Maintenance risk**: 1 (既存の公開データ構造 `ControlNetUnit` を使用するため極めて低リスク)
- **Version fragility**: 1 (将来 reForge 側で `p.resize_mode` が追加されても競合しない)
- **Expected benefit**: 5 (内蔵 IP-Adapter による Reference Cast / 人物整合性が安全に実現可能)

**理由サマリ**:
今回の障害は、UI経由で画像が欠落した状態のUnitがtxt2imgで実行された際に、builtin ControlNet内の「A1111 img2img画像フォールバック処理」に突入してしまったことが直接原因である。MRP Bridge が明示的に画像と設定を持った `ControlNetUnit` を注入するアーキテクチャであれば、この不整合コードパスをそもそも踏まない。したがって、builtin を改変する「車輪の再構成」に陥ることなく、極めて安価かつクリーンに解決可能である。
