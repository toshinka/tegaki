# Regional LoRA Lab — Phase 0.5 最終仕上げ指示書
## Exact Restore / Wrapper Chaining / Metadata整合性
### Phase 1 Multi-Pass Oracle 着手前の最終確認

対象:
`D:\GitHub\tegaki\RegionalLoRALab`

レビュー基準:
- `GPT_GITHUB_LINKS.txt` の pinned review commit: `1e2ecc9b32802b8f5e4cd426112b081b8aa8ca03`
- Phase 0.5 は概ね成功
- Phase 1 へ進める可能性は高い
- ただし「実証済み」と書くには証拠が不足する点が2つ残っている

本指示書の目的は、**Phase 0.5 を小さく仕上げ、Phase 1 Multi-Pass Oracle へ安全に進める状態を確定すること**。

MRP本体は変更しない。

---

# 1. 現在の評価

Phase 0.5では以下が確認されている。

- `UnetPatcher.clone()` で patcher object は分かれる。
- clone A / B は `patches` を別に持つ。
- underlying `model` は共有される。
- clone A のみに LoRA patch を登録できる。
- `patch_model()` で共有 model weight へ LoRA が materialize される。
- `unpatch_model()` で base weight へ戻せる。
- repatch / unpatch 所要時間は Oracle 用途として許容範囲に見える。
- `model_function_wrapper` の存在と既存wrapper検出まではできている。

したがって、**毎step A/Bを交互materializeするMulti-Pass方式**は研究用Oracleとして成立する可能性が高い。

ただし、以下の2点はまだ最終確認が必要。

1. weight復元の完全性
2. wrapper chaining の実動作

---

# 2. 必須修正A — Weight Restore をtensor本体で検証する

現行Probeでは復元前後の主な比較がnormである。

```python
norm_base = raw_weight.float().norm().item()
norm_restored = restored_weight.float().norm().item()
```

同じnormでも内容が異なるtensorは存在するため、これは完全復元の証明にはならない。

## 修正方針

`patch_model()` 前に代表weightのcopyを保持する。

```python
base_snapshot = raw_weight.detach().clone()
```

`unpatch_model()` 後:

```python
restored = ldm_patched.modules.utils.get_attr(
    clone_A.model,
    sample_key
).detach()
```

比較:

```python
exact_equal = torch.equal(base_snapshot, restored)
max_abs_diff = (
    base_snapshot.float() - restored.float()
).abs().max().item()
mean_abs_diff = (
    base_snapshot.float() - restored.float()
).abs().mean().item()
```

ログ例:

```text
[RLL][Restore Probe] torch.equal   = True
[RLL][Restore Probe] max_abs_diff  = 0.00000000
[RLL][Restore Probe] mean_abs_diff = 0.00000000
```

理想は `torch.equal=True` かつ `max_abs_diff=0`。

bit-exactにならない場合はdtype、device移動、`weight_inplace_update`、castの影響を確認し、「完全一致」とは書かない。

---

# 3. Restore Probe は複数層で行う

最低3～5層。

候補:
- Attention系Linear
- Conv / ResNet系
- middle block
- input block
- output block

LoRAにpatchがあるkeyから偏りなく選ぶ。

全weight保存は不要。代表sampleのみでよい。

---

# 4. 必須修正B — Wrapper Chaining を実際に検証する

現状は既存 `model_function_wrapper` を検出しているだけ。

これは「chain候補がある」確認であり、実際にchainが正常動作することの実証ではない。

Phase 0.5では本物のRegional LoRA処理は入れず、dummy wrapperでcall順を確認する。

---

# 5. Dummy Wrapper Chain Probe

既存wrapper無しの場合:

```python
def rll_test_wrapper(model_function, params):
    print("[RLL][Wrapper Chain Probe] RLL wrapper entered")
    out = model_function(
        params["input"],
        params["timestep"],
        **params["c"]
    )
    print("[RLL][Wrapper Chain Probe] RLL wrapper exited")
    return out
```

既存wrapperありの場合は、そのsignatureを現物確認した上でchainする。

概念:

```python
previous_wrapper = existing_wrapper

def chained_wrapper(model_function, params):
    print("[RLL][Wrapper Chain Probe] outer enter")

    def inner_model_function(input_x, timestep, **c):
        return model_function(input_x, timestep, **c)

    out = previous_wrapper(inner_model_function, params)

    print("[RLL][Wrapper Chain Probe] outer exit")
    return out
```

**signatureを推測しないこと。**

---

# 6. Wrapper Chain 成功条件

確認項目:

- generation completes
- existing wrapper is not lost
- RLL wrapper call count is expected
- existing wrapper call count is expected
- returned tensor shape unchanged
- dtype unchanged
- device unchanged
- RLL OFF後に `model_options` が元へ戻る

例:

```text
[RLL][Wrapper Chain Probe]
previous wrapper: <function ...>
chain installed: True
RLL calls: 24
previous wrapper calls: 24
shape mismatch: False
cleanup restored: True
```

既存wrapperとの互換性が不明なら、Phase 1初期版ではfail-closedでよい。

```text
既存 model_function_wrapper 検出
→ Regional LoRA Lab開始中止
→ warning表示
```

でも可。

---

# 7. PHASE_00_5_REPORT.md の表現修正

## Restore

tensor比較前は:

```text
代表weightのnormが復元前後で一致した。
tensor要素単位のexact restoreは最終Probeで追加確認する。
```

exact test成功後は:

```text
代表複数weightについて torch.equal=True / max_abs_diff=0 を確認。
Phase 0.5対象範囲では patch/unpatch による残留weight差を検出しなかった。
```

「全モデル全tensorについて数学的に完全保証」とは書かない。

## Wrapper Chaining

実動作確認前:

```text
既存wrapperを検出可能。
Chain-of-Responsibility方式の候補を確認。
```

実動作確認後:

```text
テスト環境で既存wrapperを保持したchain呼び出しが正常完了。
ただし全extensionとの互換性は未保証。
```

---

# 8. CURRENT_STATUS.md / Report metadata

Phase 0.5最終push後、古いcommit表記を残さない。

`CURRENT_STATUS.md`:

```text
Current Phase: 0.5
Status: SUCCESS

Next:
- Phase 1 Multi-Pass Oracle implementation
- UNet LoRA only
- Text Encoder multiplier = 0
- Left / Right 50:50
- ordinary prompt <lora:...> tags disabled for test
```

`PHASE_00_5_REPORT.md` の `UPDATE_AFTER_PUSH` も必ずFULL SHAへ置換。

---

# 9. GPT_GITHUB_LINKS.txt 更新

Phase 0.5 final commit 後、以下を最新SHAへ更新。

- Pinned review commit
- Pinned CURRENT STATUS
- Pinned PHASE REPORT
- Pinned REFORGE LORA FLOW
- Pinned MAIN SCRIPT

追加推奨:

```text
Pinned PHASE 0.5 PROBE DOC:
https://raw.githubusercontent.com/toshinka/tegaki/<FULL_SHA>/RegionalLoRALab/docs/PHASE_00_5_PATCH_RESIDENCY_PROBE.md
```

`main` Raw URLとcommit-pinned Raw URLは両方残す。

---

# 10. Probe UI文言を正確にする

Phase 0.5は `patch_model()` で一時的にmodel weightを変更する。

したがって:

```text
完全安全検証
read-only probe
```

という表現はPhase 0.5には不正確。

推奨:

```text
※ 生成結果へRegional処理は適用しません。
   Probe中はLoRA weightの一時materialize / restoreを行います。
   終了時にbase weightへ復元します。
```

Phase 0だけはread-only表記でよい。

---

# 11. postprocessログをPhase別にする

Phase 0:

```text
[RLL][Probe] Completed (read-only probe).
```

Phase 0.5:

```text
[RLL][Probe] Completed Phase 0.5.
Temporary model patching was restored before exit.
```

restore verification失敗時:

```text
[RLL][ERROR] Restore verification failed.
```

---

# 12. try/finally を強化する

`patch_model()` 後に例外が起きても必ずrestoreする。

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

Phase 0.5では例外時restoreを最優先にする。

---

# 13. Phase 0.5 最終Regression Test

## Test A — RLL OFF
同seed基準画像。

## Test B — Phase 0 Read-only
同seed生成。基準との差確認。

## Test C — Phase 0.5 with LoRA Probe
LoRAを1つ選びresidency probe。

## Test D — RLL OFF after Phase 0.5
Phase 0.5 probe後にRLL OFF。
同seed通常生成とWebUI再起動後referenceを比較。

## Test E — Exception Restore
安全な箇所で意図的にtest exception:

```text
patch_model
→ exception
→ finally
→ unpatch_model
```

を確認。

本番コードには例外発生処理を残さない。

---

# 14. TEST_PROTOCOL.md の再現性条件

「完全一致」を要求する前に、RLLを使わない状態で同seedを2回生成し、通常環境の再現性を測る。

固定条件:
- seed
- sampler
- scheduler
- checkpoint
- resolution
- batch size 1
- 他extension
- ControlNet状態

通常でもbit-exactでない環境なら、RLL OFF後の差が通常run-to-run差を超えないことを条件にする。

---

# 15. Phase 0.5 最終成功条件

以下を満たしたらPhase 0.5を最終SUCCESSとする。

- clone/shared model関係を把握
- patch registration isolation確認
- patch/unpatch timing測定
- 代表複数weightでtensor単位restore確認
- exception時restore確認
- existing wrapper検出
- wrapper chain実動作確認、またはPhase 1 fail-closed方針確定
- RLL OFF後にbase generationへ戻る
- metadata/report/GitHub links更新
- MRP変更なし

---

# 16. Phase 1へのGo条件

Phase 0.5成功後のみPhase 1へ進む。

初期仕様:

```text
Mode:
2-Region Multi-Pass Oracle

Model:
SDXL / Illustrious

Regions:
Left 50%
Right 50%

LoRA:
A = UNet only
B = UNet only

Text Encoder:
0 / disabled

Prompt:
normal text trigger可
<lora:...> tag禁止

Mask:
hard binary

Batch:
1

ControlNet:
最初はOFF
```

---

# 17. Phase 1の計算順序

概念:

```text
base state
→ materialize A
→ forward A
→ restore base
→ materialize B
→ forward B
→ restore base
→ mask blend A/B
```

各step終了時に必ずbaseへ戻す。

A/B weight stateを次stepへ持ち越さない。

---

# 18. Multi-Pass Oracleの定義

`Oracle` は、

```text
slow but understandable reference baseline
```

という意味で使う。

```text
perfect mathematical ground truth
```

ではない。

LoRA weight stateをbranchごとに分離しても、各UNet branchは画像全体latentを見るため、

- convolution
- self-attention
- global receptive field
- shared latent structure

などによる意味的影響まで完全ゼロになるとは限らない。

成功判定は、

```text
Global A+B より明確に leakage が減る
```

こと。

---

# 19. Phase 1実装前の停止点

この指示書の作業を完了したら、

1. commit
2. push
3. GPT_GITHUB_LINKS更新
4. CURRENT_STATUS更新
5. PHASE_00_5_REPORT更新

を行い、**そこで停止すること。**

ユーザー / GPTレビュー前にPhase 1の生成実装へ進まない。

---

# 20. 最重要事項

今回の作業はアルゴリズム追加ではない。

Phase 0.5の成果を、

**「推測ではなく、Phase 1の前提として十分な実証」**

へ引き上げるための仕上げである。

大きな機能追加をしない。
MRPを変更しない。
Phase 1 UIを先に作らない。
LoRA multi-region生成をまだ実装しない。

まず、

```text
restore
wrapper
cleanup
metadata
```

の4点を確定させる。

それが終わればPhase 1へ進んでよい。
