# Regional LoRA Lab — Phase 1 Multi-Pass Oracle 実装指示書
## Candidate B: Alternating Patch Materialization
### Safety Gate Errata + 2-Region Oracle PoC

対象:
`D:\GitHub\tegaki\RegionalLoRALab`

GitHubレビュー基準:
- Pinned implementation commit: `a061d65f56e07bba034adf80fef10b10e825e060`
- Navigation metadata commit: `294c7ba98760adecbe50f330e3e3fb8eb3970017`
- reForge target commit: `19395bf96ccdc605774c76a9fe8cc7145b637128`

---

# 0. 今回の結論

Phase 0.5 の Safety Gate は、Phase 1 へ進む根拠として十分に成立している。

`docs/PHASE_01_MULTIPASS_POC.md` に凍結された以下の方針を維持する。

```text
Candidate B — Alternating Patch Materialization

SDXL / Illustrious
2 regions
Left / Right 50:50
Hard binary mask
Standard UNet LoRA only
Text Encoder multiplier = 0
Batch size 1
ControlNet OFF
MRP連携なし
通常 <lora:...> タグ禁止
```

今回は **Phase 1 の生成実装へ進む**。

ただし、GitHubレビューで Safety Gate 実装に2点の小さな修正余地が見つかったため、
Phase 1コードへ着手する最初の作業として同時に直す。

新しい Phase 0.x は作らない。

---

# 1. Phase 1実装前に直す Safety Gate Errata

## 1.1 restore_success の失敗状態を上書きしない

現行Phase 0.5コードでは cleanup error 時に:

```python
self.restore_success = False
```

とした後、Exact Tensor Comparison終了時に:

```python
self.restore_success = all_exact
```

としている。

このため、Emergency unpatch が失敗したのに後段の値で `True` に戻る可能性がある。

必ず:

```python
self.restore_success = self.restore_success and all_exact
```

とする。

一度発生した restore failure を同run内で消さない。

---

## 1.2 stale wrapper 自身に previous wrapper を保持させる

現行 recovery は同じ Script instance が生きていれば機能する。

しかし Script instance が再生成された場合、`self.original_wrapper` が失われている可能性がある。

その状態で `_rll_wrapper=True` の stale wrapper を見つけて単純に `pop()` すると、stale RLL wrapper の内側に存在した他extensionの wrapper まで失う可能性がある。

RLL wrapperをinstallする時:

```python
rll_wrapper._rll_wrapper = True
rll_wrapper._rll_previous_wrapper = previous_wrapper
```

を保存する。

recovery時:

```python
current_wrapper = unet.model_options.get("model_function_wrapper")

if getattr(current_wrapper, "_rll_wrapper", False):
    previous = getattr(current_wrapper, "_rll_previous_wrapper", None)

    if previous is not None:
        unet.model_options["model_function_wrapper"] = previous
    else:
        unet.model_options.pop("model_function_wrapper", None)
```

を基本とする。

`self.original_wrapper` が残っている場合だけに依存しない。

他extensionのwrapperを消さないこと。

---

## 1.3 unpatch条件を明瞭化

現行:

```python
if getattr(clone_A, "backup", None) or hasattr(clone_A, "unpatch_model"):
    clone_A.unpatch_model()
```

は `unpatch_model` が存在する通常ケースでは常にTrueになる。

意図を明確にする。

推奨:

```python
try:
    clone_A.patch_model()
    ...
finally:
    try:
        clone_A.unpatch_model()
    except Exception as cleanup_error:
        ...
```

`unpatch_model()` が空backupでも安全なことは現行reForgeソースで確認済み。

Phase 1 branch処理もこの単純な形に統一する。

---

# 2. Phase 0.5文書の扱い

Phase 0.5そのものをやり直さない。

ただし上記2点を修正したことを:

```text
CHANGELOG.md
CURRENT_STATUS.md
reports/PHASE_01_REPORT.md
```

へ短く記録する。

`PHASE_00_5_REPORT.md` は原則freezeでよい。

必要なら末尾に:

```text
Post-freeze implementation errata:
- restore_success failure latch preserved
- stale wrapper now stores previous wrapper metadata on wrapper object
```

程度の追記だけ行う。

---

# 3. Phase 1の成功定義

Phase 1で証明したいのは、

**同じ denoising evaluation 内で、同じ latent / timestep / conditioning を使いつつ、LoRA A と LoRA B を別々のUNet weight stateで評価し、その denoiser output を左右maskで合成できること。**

画像生成終了後に2枚を左右合成する方式ではない。

各 `model_function_wrapper` 呼び出しで:

```text
same input
same timestep
same conditioning

LoRA A forward
LoRA B forward

↓
spatial output blend
```

を行う。

---

# 4. reForge callback / wrapper の現行仕様を尊重する

対象reForgeの `modules/scripts.py` では `before_process_batch()` は Extra Networks parse 前に呼ばれる。

また `model_function_wrapper` は `model.apply_model()` の周囲に存在する。

重要:

Script callback の例外は `modules/scripts.py` 側でcatchされてログ化される。

したがって:

```python
raise RuntimeError(...)
```

を `before_process_batch()` や `process_before_every_sampling()` で投げるだけでは「生成中止」にならない可能性が高い。

**fail-closed を callback exception だけに依存して実装しないこと。**

---

# 5. Phase 1 UI

既存Phase 0 / 0.5を残し、Modeへ追加:

```text
Phase 1: 2-Region Multi-Pass Oracle
```

Phase 1用入力:

```text
Region A LoRA
Region A UNet Weight

Region B LoRA
Region B UNet Weight
```

初期値:

```text
A Weight = 1.0
B Weight = 1.0
```

Phase 1ではText Encoder UIを作らない。

TE = 0 固定。

自由矩形、soft mask、3領域以上を作らない。

---

# 6. LoRA A/B はRLL側でロードする

通常Extra Networksによる:

```text
<lora:foo:1>
```

はPhase 1では使わない。

LoRA A/BはUIの選択値からファイルを特定し、RLLが直接state dictをロードする。

既存Phase 0.5で使用した:

```python
ldm_patched.modules.utils.load_torch_file(...)
ldm_patched.modules.lora.model_lora_keys_unet(...)
ldm_patched.modules.lora.load_lora(...)
clone.add_patches(...)
```

の経路を再利用する。

独自LoRA parserを作らない。

---

# 7. Text Encoder LoRA をロードしない

UNet key map のみ生成する。

概念:

```python
key_map_A = ldm_patched.modules.lora.model_lora_keys_unet(
    base_unet.model,
    {}
)

loaded_A = ldm_patched.modules.lora.load_lora(
    lora_sd_A,
    key_map_A
)
```

CLIP key mapを作らない。

`clip.add_patches()` を呼ばない。

これにより Phase 1 は実装レベルでも **UNet LoRA only** とする。

---

# 8. Branch Patcher構築

Phase 1 sampling開始前:

```python
base_unet = p.sd_model.forge_objects.unet

clone_A = base_unet.clone()
clone_B = base_unet.clone()
```

その後:

```python
clone_A.add_patches(loaded_A, strength_model=weight_A)
clone_B.add_patches(loaded_B, strength_model=weight_B)
```

注意:

`clone_A.model is clone_B.model is base_unet.model`

である。

独立UNet objectだと思わない。

独立しているのはpatch bookkeeping。

実weight stateは毎forwardで交互materializeする。

---

# 9. Phase 1は clean base patch state を要求する

Phase 1初期版は他のmodel-weight patchとの組合せを扱わない。

Phase 1開始前に:

```python
base_patches = getattr(base_unet, "patches", {})
```

を確認。

RLL自身のbranch LoRAを追加する前のbase patch countが0でない場合は、Phase 1を開始しない。

理由:

base UNetに既存patchがある状態で clone_A/B を作ると、branch `patch_model()` 時にbase patchを重複materializeする可能性があり、Oracle条件が崩れる。

ログ:

```text
[RLL][Phase1][BLOCKED]
Base UNet already contains model patches.
Disable other weight-patching extensions / global LoRA.
```

初期Phase 1では互換対応しない。

---

# 10. 既存 model_function_wrapper は fail-closed

Phase 1開始前:

```python
existing_wrapper = base_unet.model_options.get(
    "model_function_wrapper"
)
```

存在する場合:

```text
Phase 1 blocked
```

とする。

Phase 0.5でchain可能性は確認したが、Phase 1はweight stateをforward中に切り替えるため、他wrapperとの同居を最初から試さない。

MRP、Attention Couple、Tiled系等との同時動作は後段。

---

# 11. `<lora:...>` のPreflight

`before_process_batch()` はExtra Networks parse前なので、Phase 1有効時に `kwargs["prompts"]` を検査する。

regex例:

```python
r"<lora:[^>]+>"
```

見つけたら:

1. RLL Phase 1をblocked状態にする
2. そのbatchの `<lora:...>` を除去し、global activationを防ぐ
3. 明確なERRORログを出す
4. sampling開始時にPhase 1を実行しない

例:

```text
[RLL][Phase1][BLOCKED]
Ordinary <lora:...> tag detected.
Regional LoRA Lab manages LoRA loading itself.
Remove the tag and retry.
```

Script callback内の `raise` だけに依存しない。

---

# 12. Blocked run を成功扱いしない

Phase 1 preflight failure時は:

```python
self.phase1_blocked = True
self.phase1_block_reason = "..."
```

を保存。

sampling時にRLL Oracle wrapperをinstallしない。

可能ならユーザーへ明確に分かる形で警告する。

最低限consoleとgeneration metadataへ:

```text
RLL Phase1 Blocked: <reason>
```

を残す。

Phase 1 Reportではblocked runをテスト成功として数えない。

---

# 13. model_function_wrapper 実装

Phase 1 wrapperの概念:

```python
def phase1_multipass_wrapper(model_function, params):
    out_A = run_branch(
        clone_A,
        model_function,
        params,
        "A"
    )

    out_B = run_branch(
        clone_B,
        model_function,
        params,
        "B"
    )

    return blend_left_right(out_A, out_B)
```

既存wrapperがある場合はPhase 1開始前にblockしているため、Phase 1 wrapper内でchain処理は不要。

---

# 14. run_branch() を一箇所に集約

A/Bで同じ安全コードを複製しすぎない。

例:

```python
def run_branch(branch_patcher, model_function, params, label):
    try:
        branch_patcher.patch_model()

        out = model_function(
            params["input"],
            params["timestep"],
            **params["c"]
        )

        return out

    finally:
        try:
            branch_patcher.unpatch_model()
        except Exception as cleanup_error:
            self.phase1_fatal_error = True
            print(
                f"[RLL][Phase1][ERROR] Branch {label} unpatch failed: "
                f"{cleanup_error}"
            )
            raise
```

重要:

- A失敗 → Bへ進まない
- B失敗 → blendしない
- cleanup失敗 → そのまま生成を続けない
- branch終了時に必ずbaseへ戻す

---

# 15. model_function は同一paramsで2回呼ぶ

A/Bで:

```text
params["input"]
params["timestep"]
params["c"]
```

を変えない。

Phase 1ではregional prompt conditioningを作らない。

A/Bの違いは **LoRA weight stateだけ**。

これがOracle実験の核心。

---

# 16. CFG / cond-uncond batching を壊さない

wrapperへ来るinput batchは sampler / CFG / memory chunkingによって形が変わり得る。

Phase 1ではbatch内容を独自分割しない。

**入力batch全体をAでforwardし、同じbatch全体をBでforwardしてから、空間だけmask blendする。**

cond/uncondの並び替えをしない。

`params["cond_or_uncond"]` は診断ログだけに使ってよい。

---

# 17. Output shape を実測してからmaskを作る

Phase 1初回debugでは:

```text
params input shape
out_A shape
out_B shape
dtype
device
cond_or_uncond
```

を一度ログ。

期待する基本形:

```text
[B, C, H, W]
```

ただし推測で固定しない。

Phase 1初期版では `out_A.ndim != 4` または `out_B.ndim != 4` ならfatal。

---

# 18. A/B output compatibility check

blend前:

```python
if out_A.shape != out_B.shape:
    raise RuntimeError(...)

if out_A.dtype != out_B.dtype:
    raise RuntimeError(...)

if out_A.device != out_B.device:
    raise RuntimeError(...)
```

A/Bは同じUNetを同じ入力で評価しているため、一致しない場合は設計前提が崩れている。

fail-closed。

---

# 19. Hard Left/Right Mask

`out_A` の実shapeから作る。

```python
b, c, h, w = out_A.shape
mid = w // 2

mask_A = torch.zeros(
    (1, 1, h, w),
    device=out_A.device,
    dtype=out_A.dtype
)

mask_A[..., :mid] = 1.0
mask_B = 1.0 - mask_A
```

blend:

```python
combined = out_A * mask_A + out_B * mask_B
```

batch/channelへbroadcastさせる。

---

# 20. Mask invariant をdebugで検査

初回のみ:

```python
mask_sum = mask_A + mask_B
```

確認:

```python
torch.all(mask_sum == 1)
```

Hard binaryなので基本はexactでよい。

ログ:

```text
[RLL][Phase1][Mask]
shape=(1,1,H,W)
left_coverage=...
right_coverage=...
sum_exact=True
```

---

# 21. odd width

`w` が奇数でも壊れないようにする。

```python
mid = w // 2
```

左は `0 ... mid-1`、右は `mid ... w-1`。

mask合計1を優先。

---

# 22. Branch patch timing をsampling中に測る

Phase 0.5の15～45msは参考値だが、実sampling wrapper内の値とは限らないため、Phase 1で再計測する。

各wrapper callで:

```text
A patch ms
A forward ms
A unpatch ms
B patch ms
B forward ms
B unpatch ms
blend ms
```

を集計。

毎call大量表示せず、Debug時のみ最初の数call、最後に平均値をまとめる。

Phase 1 Reportの性能値はこの実測で更新する。

---

# 23. Device residencyを診断する

最初の数callで代表weightについて:

```text
before A patch device
during A materialized device
after A unpatch device
before B patch device
after B unpatch device
```

を確認。

`patch_model()/unpatch_model()` により sampling中のweightが予期せずCPUへ残るなどの挙動がある場合は、Phase 1をSUCCESSにしない。

---

# 24. LoRA loading はsampling stepごとに行わない

LoRA state dict load / key mapping / `add_patches()` は sampling開始前に1回。

wrapper内では:

```text
patch_model
forward
unpatch_model
```

だけ。

毎step `.safetensors` を読み直さない。

---

# 25. branch clone lifecycle

Phase 1 run用のclone参照を保持してよい。

run終了時:

```text
wrapper restore
clone reference clear
LoRA state cache clear
mask cache clear
blocked state clear
```

を行う。

次runへbranch patcherを再利用しない。

最初はcache最適化しない。

---

# 26. stale Phase 1 wrapper recovery

Phase 1 wrapperにも:

```python
wrapper._rll_wrapper = True
wrapper._rll_kind = "phase1_multipass"
wrapper._rll_previous_wrapper = None
```

等のmetadataを持たせる。

Phase 1初期版はexisting wrapper無し条件なので `_rll_previous_wrapper` は通常None。

異常終了後、次runでRLL wrapperだけを安全に除去可能にする。

---

# 27. Phase 1 wrapper cleanup

通常終了:

```text
postprocess
↓
RLL wrapper identity確認
↓
remove RLL wrapper
↓
branch refs clear
```

他wrapperを無条件popしない。

異常終了時は次runのstale recoveryを保険として使う。

---

# 28. UI上の説明

Phase 1選択時に明確に:

```text
Phase 1 Experimental Multi-Pass Oracle

- Left  = LoRA A
- Right = LoRA B
- UNet LoRA only
- Text Encoder LoRA disabled
- ControlNet OFF
- Batch size 1
- Do not use <lora:...> tags in prompt
- Other model wrappers / model patches must be disabled
```

と表示。

---

# 29. LoRA未選択時

Phase 1初期版ではA/B両方を必須にしてよい。

どちらか `(None)` の場合はBLOCKED。

「片側base」は将来追加できるが、まずA/B二つで成立確認。

---

# 30. LoRA A == LoRA B

禁止しなくてよい。

むしろControlとして有用。

```text
Left=A
Right=A
```

なら左右差が大きく出ないことが期待される。

---

# 31. Phase 1 Test Matrix を拡張

既存5条件に加え、以下を追加。

### Control Same
```text
RLL ON
Left=A
Right=A
```

目的: mask blend自体が不要な左右差を作っていないか確認。

### Swap
```text
RLL ON
Left=B
Right=A
```

目的: LoRA特徴がmask側へ追従するか確認。

最重要の実験はSwap。

---

# 32. User Visual Validation用の推奨条件

最初はStyle LoRA。

```text
A = 強い漫画 / 白黒 / 線画系 style LoRA
B = 明確に異なるカラー / painterly / photographic系 style LoRA
```

triggerが必要なら同一global promptへ両triggerを置く。

A/B branchでpromptを変えない。

目的はPrompt差ではなくNetwork差を見ること。

---

# 33. Test prompt

最初は複雑な漫画ページではなく単純構図。

例:

```text
two girls standing side by side, simple background,
one on the left, one on the right,
masterpiece, best quality
```

ただしPhase 1はprompt region routingをしないため、「左人物=LoRA A / 右人物=LoRA B」を完全に意味固定できるとは限らない。

Style差を見ることを優先する。

---

# 34. Resolution

最初は:

```text
1024 x 1024
```

を推奨。

左右境界が観察しやすい。

---

# 35. ControlNet / MRP / Forge Couple はOFF

Phase 1初回成立確認では:

```text
ControlNet OFF
MRP OFF
Forge Couple OFF
Regional Prompter OFF
Tiled Diffusion等のwrapper系 OFF
```

LoRA engineだけを評価する。

---

# 36. Phase 1成功判定

コードレベル:

- A/B LoRA stateを別branchへ登録
- sampling中にA→restore→B→restore成立
- A/B output shape/dtype/device一致
- mask sum = 1
- sampling完了
- RLL OFF後にbase stateへ復帰
- stale wrapperなし
- branch cleanup成功

視覚レベル:

- A特徴が左へ強く出る
- B特徴が右へ強く出る
- Swapで特徴位置が反転する
- Same A/Aで不自然な左右差が大きく出ない
- Global A+Bよりcross-region leakageが減る

**視覚レベルはユーザー確認なしにSUCCESS扱いしない。**

---

# 37. Phase 1実装時点のReport Status

Geminiがコードを書いて生成が起動しただけで:

```text
Phase 1 SUCCESS
```

と書かない。

ユーザーの比較画像レビュー前は:

```text
Status:
IMPLEMENTED / AWAITING VISUAL VALIDATION
```

または `PARTIAL` とする。

---

# 38. PHASE_01_REPORT.md を新規作成

作成:

```text
RegionalLoRALab/reports/PHASE_01_REPORT.md
```

最低限:

```text
# Phase 01 Report — 2-Region Multi-Pass Oracle

## Status
IMPLEMENTED / AWAITING VISUAL VALIDATION

## Implementation Commit
## Environment
## Frozen Scope
## Implementation
## Runtime Invariants
## Performance
## Automated / Smoke Tests
## User Visual Validation
PENDING
## Known Problems
## Decision
WAITING FOR USER / GPT REVIEW
```

---

# 39. CURRENT_STATUS.md

実装push後:

```text
Current Phase:
Phase 1 — Implemented / Validation Pending

Architecture:
Candidate B — Alternating Patch Materialization

Pending:
- Control A/B/AB
- Regional A/B
- Same A/A
- Swap B/A
- visual leakage review

Do Not Proceed To Phase 2 Yet
```

---

# 40. GPT_GITHUB_LINKS.txt

追加:

```text
LATEST PHASE REPORT (Phase 1):
.../reports/PHASE_01_REPORT.md
```

Pinned snapshotへ:

```text
Pinned PHASE 1 REPORT
Pinned PHASE 1 SPEC
Pinned MAIN SCRIPT
```

を含める。

`Pinned implementation commit` はPhase 1実装commitへ更新する。

metadata commitとの自己参照ループを作らない。

---

# 41. CHANGELOG

例:

```text
## [Phase 1 Implementation] - YYYY-MM-DD

- Added 2-region Multi-Pass Oracle
- Added independent UNet LoRA A/B branches
- Added alternating patch materialization
- Added hard left/right denoiser-output blending
- Added Phase 1 preflight and fail-closed guards
- Added runtime timing/invariant diagnostics
- Visual validation pending
```

---

# 42. Phase 1でまだしないこと

禁止:

```text
Text Encoder regional LoRA
regional prompts
MRP連携
ControlNet連携
soft mask
overlap
自由矩形
3領域以上
LoHa
LoKr
DoRA
LyCORIS一般対応
Hires fix
img2img
batch > 1
performance optimization
Masked Delta
```

まず2 LoRA / 2 regionを証明する。

---

# 43. 実装の停止点

Geminiは今回:

1. Safety Gate Errataを修正
2. Phase 1 UI最小実装
3. LoRA A/B UNet-only loader
4. clean base preflight
5. `<lora>` preflight
6. Phase 1 Multi-Pass wrapper
7. branch `try/finally`
8. hard L/R mask blend
9. cleanup / stale recovery
10. runtime diagnostics
11. smoke test
12. `PHASE_01_REPORT.md`
13. `CURRENT_STATUS.md`
14. `GPT_GITHUB_LINKS.txt`
15. `CHANGELOG.md`
16. commit / push

まで行う。

**そこで停止する。**

Phase 1をSUCCESS確定しない。

Phase 2へ進まない。

---

# 44. ユーザーへ最後に依頼するテスト

実装後、ユーザーへ以下を依頼する。

```text
同seed・同prompt・同checkpointで:

1. No LoRA
2. Global A
3. Global B
4. Global A+B
5. RLL Left=A / Right=B
6. RLL Left=B / Right=A
7. RLL Left=A / Right=A
```

あわせて:

```text
consoleの[RLL][Phase1]ログ
生成時間
使用LoRA名
LoRA weight
```

を報告してもらう。

この結果をGPTがレビューしてから Phase 1 SUCCESS / PARTIAL / FAILED を確定する。

---

# 45. 最重要事項

今回から初めて「Regional LoRAの画像生成」へ入る。

見た目がそれらしく違うだけで成功としない。

必ず:

```text
same latent
same timestep
same conditioning
different LoRA network state
spatial denoiser-output blend
```

という実装事実と、

```text
Swapで位置が反転する
Same A/Aで不要な境界差が出ない
Global A+Bより漏洩が減る
```

という視覚結果の両方で判定する。

Phase 1は完成品ではなく、今後のMasked Delta研究の比較基準になるOracleを作るPhaseである。
