# Regional LoRA Lab — Phase 1 着手前 Safety Gate / Spec Freeze 指示書
## Phase 0.5 Final Cleanup → Phase 1 GO 判定

対象:
`D:\GitHub\tegaki\RegionalLoRALab`

基準:
- Phase 0.5 技術検証は SUCCESS 扱いでよい
- Multi-Pass Oracle 採択候補は Candidate B
- 本指示書では新しい研究テーマを追加しない
- 目的は **Phase 1 実装へ入る前の安全性・文書整合性・仕様固定**
- MRP 本体は変更しない

---

# 0. 結論

Phase 0.5 は技術的には成功している。

特に、

- clone / shared underlying model の関係
- patch registration isolation
- `patch_model()` / `unpatch_model()`
- 複数代表層での exact tensor restore
- `model_function_wrapper` の基本的な chaining
- patch/unpatch timing

までは Phase 1 に進む根拠として十分。

ただし、Phase 1 実装前に以下4点だけ修正する。

1. `patch_model()` 自体が途中例外を投げても restore を試みる
2. 前回異常終了時の stale RLL wrapper を次run冒頭で復旧できるようにする
3. Wrapper Probe の「測定済み」表現を実コードと一致させる
4. `PHASE_01_MULTIPASS_POC.md` を DRAFT から正式仕様へ凍結する

この4点が完了したら Phase 1 を GO とする。

---

# 1. 最重要修正A — patch_model() 途中例外時の Restore

現行構造が以下の場合:

```python
patched = False

try:
    clone_A.patch_model()
    patched = True

    # probe

finally:
    if patched:
        clone_A.unpatch_model()
```

これは不十分。

理由:

`patch_model()` は複数weightを順番に書き換える。

もし `patch_model()` の途中で例外が出ると、

```text
一部weightだけpatch済み
↓
patched = True へ未到達
↓
finallyでunpatchしない
```

という最悪ケースがあり得る。

## 1.1 推奨修正

`patch_model()` 成功フラグではなく、**restoreを常に試みる**。

例:

```python
try:
    clone_A.patch_model()

    # probe / forward

finally:
    try:
        clone_A.unpatch_model()
    except Exception as cleanup_error:
        print(
            f"[RLL][ERROR] Emergency unpatch failed: {cleanup_error}"
        )
        self.restore_success = False
```

または backup の有無を確認してもよい。

```python
finally:
    if getattr(clone_A, "backup", None):
        clone_A.unpatch_model()
```

ただし、

```text
patch_model途中例外
→ backupあり
→ unpatch
```

を確実に拾えること。

---

# 2. Exception Restore Test を実施

本番へ恒久的な例外発生コードは残さない。

開発中のみ、安全な箇所で意図的に例外を発生させる。

```text
patch_model()
↓
一部probe
↓
raise RuntimeError("RLL TEST EXCEPTION")
↓
finally
↓
unpatch_model()
```

確認:

- exception後に `clone_A.backup` が空
- 代表weightがbase snapshotへ戻る
- 次のRLL OFF生成が正常
- WebUI再起動後referenceとの差が通常run-to-run差を超えない

テスト後、意図的exceptionコードを削除する。

---

# 3. 最重要修正B — stale RLL wrapper recovery

現在は `before_process_batch()` 冒頭で、

```python
self.original_wrapper = None
self.wrapper_installed = False
```

のように状態を初期化している。

通常終了なら問題ない。

しかし、

```text
前run
↓
RLL wrapper install
↓
sampling異常終了
↓
postprocess未到達
↓
wrapper残留
↓
次run
```

となった場合、先に `self.original_wrapper = None` とすると元wrapperへの参照を失う可能性がある。

---

# 4. run開始時の Recovery 順序

`before_process_batch()` は以下の順序へ。

```text
1. 前runのRLL wrapper残留を検出
2. 残留していれば元wrapperへrestore
3. cleanup結果をログ
4. その後にcurrent run用stateを初期化
5. current run開始
```

## 4.1 RLL wrapper identity を保持する

可能ならwrapperに識別情報を持たせる。

```python
def rll_chain_test_wrapper(model_function, params):
    ...

rll_chain_test_wrapper._rll_wrapper = True
```

または、

```python
self.installed_wrapper = rll_chain_test_wrapper
```

を保持。

次run冒頭:

```python
current_wrapper = unet.model_options.get(
    "model_function_wrapper"
)

if (
    self.wrapper_installed
    and current_wrapper is self.installed_wrapper
):
    # stale RLL wrapper recovery
```

のように判定する。

「wrapperが存在する」だけで他extensionのwrapperを消さない。

---

# 5. Restoreする対象はRLL自身のwrapperだけ

絶対に:

```python
unet.model_options.pop("model_function_wrapper", None)
```

を無条件に実行しない。

前runで保存した `self.original_wrapper` があるなら戻す。

なければ、RLL自身がinstallしたwrapperであることを確認した上でだけ削除。

他extensionのwrapperを消してはいけない。

---

# 6. postprocess cleanup も fail-safe 化

通常終了時は現在どおり postprocess でrestore。

ただし:

```python
try:
    restore original wrapper
except Exception:
    log error
finally:
    self.wrapper_installed = False
```

とし、cleanup状態を必ず記録。

例:

```text
[RLL][Cleanup] wrapper restored = True
[RLL][Cleanup] restore_success = True
```

失敗時:

```text
[RLL][ERROR] wrapper cleanup failed
```

---

# 7. Wrapper Probe の報告表現をコードと一致させる

現行報告書に、

```text
回数カウント一致
テンソルshape不変
dtype不変
device不変
```

と書いてある場合、実コードで本当に計測している項目だけを「確認済み」とする。

## 7.1 previous_wrapper_call_count の名称

現在の構造では、

```python
def inner_model_fn(...):
    self.previous_wrapper_call_count += 1
    return model_function(...)
```

のように数えている。

これは厳密には previous wrapperそのものの呼び出し回数ではなく、previous wrapperが inner model function を呼んだ回数である。

変数名を:

```python
previous_wrapper_inner_model_call_count
```

等へ変更する。

ログも同様。

---

# 8. shape / dtype / device の扱い

実際に確認したいなら、RLL wrapperの入口と出口で比較する。

```python
input_shape = params["input"].shape
input_dtype = params["input"].dtype
input_device = params["input"].device

out = ...

output_shape = out.shape
output_dtype = out.dtype
output_device = out.device
```

ただし、inputとoutputは意味的に異なるtensorなので、単純にshape/dtype/deviceが同じべきかは現行reForgeの通常wrapper仕様を確認してから判定する。

より安全なのは、

```text
RLL wrapperなしの既存wrapper return
RLL wrapperでchainした既存wrapper return
```

のinterface contractが同一であることを確認すること。

無理に「shape不変」を成功条件にしなくてもよい。

実測していないなら報告書から削る。

---

# 9. 文書修正 — Wrapper Chaining

推奨表現:

```text
既存 model_function_wrapper を内側に保持した chain 呼び出しを
テスト環境で正常実行できた。

RLL wrapperは既存wrapperの戻り値を加工せずそのまま返す。

RLL wrapper call count、および既存wrapper内部から
base model_function が呼ばれた回数を記録した。

全extensionとの互換性は未保証。
```

これで十分。

「完全互換」等とは書かない。

---

# 10. PHASE_01_MULTIPASS_POC.md を正式仕様へ更新

現在:

```text
Draft / Pending Phase 0.5
Status: DRAFT
Candidate A / B / C
```

のままなら更新する。

## 10.1 Header

推奨:

```text
# Phase 01: 2-Region Multi-Pass Oracle Specification

Status:
APPROVED FOR IMPLEMENTATION

Selected Architecture:
Candidate B — Alternating Patch Materialization

Scope:
UNet LoRA Only
Text Encoder multiplier = 0
2 Regions
Left / Right 50:50
Hard Mask
Batch size 1
ControlNet OFF for initial validation
```

---

# 11. Candidate B を正式採択

Candidate A/B/Cの比較履歴は残してよい。

ただし、

```text
Selected: Candidate B
```

を明記。

Phase 1の実装順序を固定する。

```text
base state
↓
materialize LoRA A
↓
forward A
↓
restore base
↓
materialize LoRA B
↓
forward B
↓
restore base
↓
mask blend A/B
↓
return combined output
```

---

# 12. Phase 1 の初期制約を凍結

以下はPhase 1では変更しない。

```text
Target:
SDXL / Illustrious

Region count:
2

Geometry:
Left 50%
Right 50%

Mask:
hard binary

LoRA:
standard UNet LoRA only

Text Encoder:
disabled / multiplier 0

Prompt:
normal trigger words allowed
ordinary <lora:...> tags forbidden

Batch:
1

ControlNet:
OFF for first validation

MRP integration:
none
```

機能追加しない。

---

# 13. 普通の <lora:...> タグは禁止

Phase 1初期版では、

```text
promptに <lora:A:1>
```

が含まれていたら、

- 実行中止
- warning表示

を推奨。

理由:

通常Extra Networksでglobal LoRAが先に適用されると、Regional LoRA Labの実験条件が壊れる。

trigger wordは可。

---

# 14. Phase 1 wrapper conflict policy

Phase 0.5でchainが基本成立していても、Phase 1ではMulti-Pass内部でweight stateを切り替えるため、他wrapperとの組み合わせはより危険になる。

初期Phase 1では、

```text
既存 model_function_wrapper なし
→ 実行可

既存 model_function_wrapper あり
→ 原則 fail-closed
→ Debug / Experimental override はまだ作らない
```

でもよい。

まずRegional LoRA単体を成立させる。

MRPや他extensionとの同時動作は後段。

---

# 15. Phase 1 Safety Invariant

Phase 1の最重要不変条件:

**各branch forward後にbase weightへ戻ること。**

A:

```text
patch A
forward A
unpatch A
```

B:

```text
patch B
forward B
unpatch B
```

どちらも `try/finally`。

---

# 16. Branch A / B の例外処理

概念:

```python
try:
    clone_A.patch_model()
    out_A = model_function(...)
finally:
    clone_A.unpatch_model()
```

その後B。

Bも同様。

Aが失敗したらBへ進まない。

Bが失敗したらcombined outputを返さない。

fail-openにせず、生成を安全に失敗させる。

---

# 17. Mask Blend

Phase 1は左右固定。

latent / UNet outputの shape を実測し、空間次元へmaskを合わせる。

概念:

```python
mask_A = left_half
mask_B = right_half

combined = out_A * mask_A + out_B * mask_B
```

条件:

```text
mask_A + mask_B = 1
```

hard mask。

soft edgeはまだ入れない。

---

# 18. Batch / CFG 形状を推測しない

`model_function_wrapper` に渡される `params["input"]` と返却tensorのbatch dimensionは、

- cond/uncond
- CFG optimization
- sampler
- Forge batching

で変わる可能性がある。

Phase 1実装前にdebugログで実shapeを確認。

maskは必ずbatch/channelへbroadcast可能な形にする。

例:

```text
[B, 1, H, W]
```

を基準候補とするが、実tensor shapeを見て決める。

---

# 19. Phase 1 Test Matrix

最初は最小限。

### Control 0
```text
RLL OFF
LoRAなし
```

### Control A
```text
RLL OFF
LoRA A global
```

### Control B
```text
RLL OFF
LoRA B global
```

### Control AB
```text
RLL OFF
LoRA A+B global
```

### Experimental
```text
RLL ON
Left=A
Right=B
```

同一:

- seed
- checkpoint
- sampler
- scheduler
- steps
- CFG
- resolution
- prompt

で比較。

---

# 20. 最初はstyle LoRAを使う

Character LoRAより差が見えやすい。

推奨:

```text
A = 強い漫画/白黒 style LoRA
B = 強い別style LoRA
```

またはBをLoRAなしにできるなら、

```text
Left = strong style LoRA
Right = base
```

でもよい。

まずLoRA weight stateの空間分離を見る。

---

# 21. 成功判定

Phase 1成功条件:

```text
Left  ≈ A global reference
Right ≈ B global reference
```

かつ、

```text
global A+B
```

より反対側へのstyle leakageが明確に減る。

完全無漏れは要求しない。

---

# 22. Multi-Pass Oracle の意味

`Oracle` は:

```text
slow but understandable reference baseline
```

である。

数学的に完全なground truthという意味ではない。

A/B branchは画像全体latentを見るため、receptive fieldやattentionによる意味的影響は残り得る。

---

# 23. CURRENT_STATUS.md 更新

Safety Gate完了後:

```text
Current Phase:
Phase 1 Ready

Previous Phase:
Phase 0.5 SUCCESS

Safety Gate:
PASS

Selected Phase 1 Architecture:
Candidate B — Alternating Patch Materialization

Next:
Implement Phase 1 2-Region Multi-Pass Oracle
```

---

# 24. PHASE_00_5_REPORT.md 更新

Phase 0.5報告書は最終版としてfreeze。

今回のSafety Gate修正は、

```text
Phase 0.5 technical result変更
```

ではなく、

```text
Phase 1前安全性補強
```

として短い追記だけでもよい。

新しい `PHASE_00_6` 等は作らない。

---

# 25. GPT_GITHUB_LINKS.txt のcommit運用

現在、

```text
Pinned review commit = 実装commit
その後にSHA更新専用commit
```

という構造になっている。

これは問題ないが、名称を明確にする。

推奨:

```text
Pinned implementation commit:
<implementation SHA>
```

必要なら別に:

```text
Latest navigation metadata commit:
<latest SHA>
```

を記載。

「自分自身のSHAを書き換えるためにcommitし、そのcommit SHAをまた書き換える」という無限ループを避ける。

---

# 26. Safety Gate 完了条件

以下が全て満たされたらPASS。

- `patch_model()`途中例外でもrestoreを試みる
- exception restore test成功
- stale RLL wrapper recoveryあり
- 他extension wrapperを誤って消さない
- wrapper cleanup fail-safe
- wrapper測定表現とコード一致
- previous wrapper counter名称修正
- `PHASE_01_MULTIPASS_POC.md` が正式仕様
- Candidate B正式採択
- Phase 1初期制約freeze
- CURRENT_STATUS更新
- GPT_GITHUB_LINKS更新
- MRP変更なし

---

# 27. 作業後の停止点

今回のSafety Gate修正を完了したら、

1. diff確認
2. commit
3. push
4. CURRENT_STATUS更新
5. GPT_GITHUB_LINKS更新
6. ユーザーへ報告

を行い、**そこで停止すること。**

Phase 1のMulti-Pass生成コードはまだ実装しない。

ユーザー / GPTがSafety Gateを確認した後、次の指示でPhase 1実装へ進む。

---

# 28. 最重要事項

今回の作業は研究Phase追加ではない。

目的は:

```text
Phase 0.5 SUCCESS
↓
Safety Gate / Spec Freeze
↓
Phase 1 GO
```

の境界を明確にすること。

新機能を増やさない。

MRPを変更しない。

Masked Deltaへ寄り道しない。

ControlNet対応を始めない。

UIを大きくしない。

まず、

```text
exception restore
stale wrapper recovery
report accuracy
Phase 1 spec freeze
```

だけを終わらせる。

これが通れば、次回は Phase 1 Multi-Pass Oracle 本体へ進んでよい。
