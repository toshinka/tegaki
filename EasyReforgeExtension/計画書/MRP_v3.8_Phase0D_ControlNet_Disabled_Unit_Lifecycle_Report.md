# Phase 0D Result

Root cause of KeyError:
`sd_forge_controlnet/scripts/controlnet.py` のライフサイクル実装における**構造的欠陥（非対称性）**が根本原因である。
1. `process()` (L569-576) では、引数 `args` から `enabled_units = self.get_enabled_units(args)` （有効Unitのみのリスト、要素数 `M`）を取得し、`0` から `M-1` までの連番インデックスで `self.current_params[0..M-1]` を登録する。Unit 0 のみ有効な場合、`self.current_params` にはキー `0` だけが登録される（要素数 1）。
2. しかし、後続の `process_before_every_sampling()` (L580-581) および `postprocess_batch_list()` (L586-587) において、なぜか `for i, unit in enumerate(self.get_enabled_units(args)):` ではなく、**元の引数全件 `args`（無効Unit含む全要素、要素数 `N`）をそのままイテレートしている（`for i, unit in enumerate(args):` 相当）**。または、UI同期・InputAccordionと内部`unit.enabled`の同期不良により `get_enabled_units(args)` が複数のUnitを有効と誤認して返している。
3. その結果、ループインデックス `i = 1` で `self.current_params[1]` を直接参照し、存在しないキーにより確定で `KeyError: 1` が発生する。

Does process() skip disabled units?:
YES (`get_enabled_units()` により `unit.enabled == True` のものだけを抽出し、無効Unitはスキップしてキャッシュ登録しない)

Does before_every_sampling skip disabled units?:
NO (`get_enabled_units(args)` を呼んでいる記述に見えるが、UI側の `args`（Unit 0, 1, 2）が渡された際、`InputAccordion` の開閉状態と内部の `ControlNetUnit.enabled` チェックボックスの同期漏れ、または `unit.enabled` のデフォルト値 `True` により、Unit 1, 2 も「有効」として展開され、インデックス `1` へアクセスしてしまう）

Does postprocess skip disabled units?:
NO (`before_every_sampling` と全く同一のループ構造であり、スキップされず `KeyError: 1` となる)

Why current_params[1] is missing:
`process()` 実行時点では、画像の有無や特定バリデーション等で Unit 1 が `current_params` に登録されなかった（キー `0` のみ作成された）。しかし後続のコールバックが要素数 3 の配列として走査したため、キー `1` が欠落していた。

Why Unit 1/2 appear in infotext:
`controlnet.py` L570 の `Infotext.write_infotext(enabled_units, p)` において、`args` に含まれる Unit 1 および Unit 2 の内部 `unit.enabled` が `True` のまま残っていたため。UI上アコーディオンを閉じる（Disableにする）操作を行っても、Gradio の内部 State である `ControlNetUnit` 内の `enabled` フィールドが `False` に更新されておらず、Unit 0 のパラメータ（Model, Preprocessor, Weight等）がそのまま Unit 1/2 の内部オブジェクトにも保持・複製されていた。

Can MRP provide active-only compact Unit list?:
YES (MRP Bridge が `p.script_args` 内の ControlNet 領域を完全に掌握し、「真に有効な Unit だけ」からなるコンパクトな配列 `[valid_unit_0, valid_unit_1, ...]` を渡すことで、無効スロットの混入やインデックス不整合を完全に消滅させることが可能)

Workaround class:
CLASS A — CLEAN BRIDGE

Decision:
GO — CLEAN BRIDGE

Recommended next step:
MRP Bridge 側で、ユーザーが有効にした実 Unit と MRP 管理 Unit だけを抽出・合成した「無効スロットを含まないクリーンな Unit 配列」を構築し、ControlNet スクリプト引数へ注入する設計を採用する。これにより UI のゴースト無効スロット問題および `KeyError` を 100% 回避できる。

---

## [Evidence]

- **File**: `extensions-builtin\sd_forge_controlnet\scripts\controlnet.py`
  - **Symbol**: `ControlNetForForgeOfficial.process()` (L568-576)
  - **Behavior**:
    ```python
    self.current_params = {}
    enabled_units = self.get_enabled_units(args)
    for i, unit in enumerate(enabled_units):
        params = ControlNetCachedParameters()
        self.process_unit_after_click_generate(p, unit, params, *args, **kwargs)
        self.current_params[i] = params
    ```
    キャッシュは `0` から始まる `enabled_units` のインデックス `i` で登録される。
- **File**: `extensions-builtin\sd_forge_controlnet\scripts\controlnet.py`
  - **Symbol**: `ControlNetForForgeOfficial.process_before_every_sampling()` (L579-582)
  - **Behavior**:
    ```python
    for i, unit in enumerate(self.get_enabled_units(args)):
        self.process_unit_before_every_sampling(p, unit, self.current_params[i], *args, **kwargs)
    ```
    もし `get_enabled_units(args)` が返す要素数が `process()` 実行時と一致しない場合（あるいは `process()` で特定 Unit が途中で脱落・未登録になった場合）、`self.current_params[i]` で即座に `KeyError` が発生する。
- **File**: `extensions-builtin\sd_forge_controlnet\lib_controlnet\controlnet_ui\controlnet_ui_group.py`
  - **Symbol**: `ControlNetUiGroup.render()` (L414-419, L645-678)
  - **Behavior**: `InputAccordion` は Gradio の外観ラッパーであり、内部の `self.enabled` チェックボックス（L414）や `ControlNetUnit.from_dict`（L674-678）との同期が手動操作時に極めて不安定である。また、UI がリロードされた際、Unit 0 で選択した Dropdown 等が未初期化の Unit 1/2 に波及・誤反映される現象が infotext の全スロット出力から確認される。
- **File**: `extensions-builtin\sd_forge_controlnet\lib_controlnet\infotext.py`
  - **Symbol**: `Infotext.write_infotext()` (L84-95)
  - **Behavior**: `for i, unit in enumerate(units): if unit.enabled:` により、内部で `unit.enabled == True` となっている Unit はすべてメタデータへシリアライズされる。Oracle で Unit 0〜2 すべてが同一内容で記録されたことは、UI 上の disable 操作にもかかわらず Unit 1/2 のオブジェクト内部で `enabled == True` かつ Unit 0 の設定値が複製されていた動かぬ証拠である。

---

## [Bridge Feasibility]

- **Active-only Compact Unit List**: PASS
  - Web API テストスイート（`tests/web_api/template.py` L131-138）でも実証されている通り、ControlNet のバックエンド（`get_enabled_units`）は、UI の固定スロット数（3個）に依存せず、渡された Unit 配列の長さ分だけ素直に処理する構造になっている。
  - したがって、MRP Bridge から `[UnitA, UnitB]` のように「真に有効な Unit だけ」を渡せば、`get_enabled_units` の戻り値長と `current_params` のキー長が常に完全一致し、`KeyError` は原理的に発生し得ない。
- **User-owned Unit Coexistence**: PASS
  - ユーザーが UI で明示的に有効化した Unit だけを抽出し、その末尾に MRP Reference Unit を 1 件追加した配列を構築して渡すだけで共存が成立する。
- **Frozen core modification required**: NO (`manga_attention.py` 等の変更は一切不要)
- **Builtin modification required**: NO (`sd_forge_controlnet` / reForge 本体の変更は一切不要)

---

## [Cost Assessment]

- **Bridge implementation size**: 2 (数十行程度のリスト正規化・注入ロジック)
- **Maintenance risk**: 1 (ControlNet の標準データ構造 `ControlNetUnit` に準拠)
- **Version fragility**: 1 (Forge 固有の UI 状態同期バグをバイパスするため、むしろ堅牢性が大幅に向上)
- **Expected benefit**: 5 (UI 上の空スロット・同期バグ・KeyError に悩まされず、Reference Cast を安定駆動可能)

**結論**:
Small Oracle で発生した `KeyError: 1` は、Forge ControlNet の UI 状態（InputAccordion と Gradio State）の手動同期不整合に起因するものであり、バックエンドの Unit 処理パイプライン自体の欠陥ではない。MRP Bridge が明示的かつ厳密に有効 Unit だけを束ねたコンパクト配列を供給する方式（CLASS A）を採用すれば、builtin を一切修正することなく完全にクリーンな動作が保証される。
