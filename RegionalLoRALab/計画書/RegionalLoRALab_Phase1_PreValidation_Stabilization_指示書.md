# Regional LoRA Lab — Phase 1 Pre-Validation Stabilization 指示書
## Multi-Pass Oracle 実装レビュー修正 + Visual Test Gate

対象:
`D:\GitHub\tegaki\RegionalLoRALab`

GitHubレビュー基準:
- Phase 1 implementation commit: `e830ef9df25e5d36d8ac40e405a4edc7bbfed4f3`
- Navigation metadata commit: `b4fe56b9f177407443ee9c5bc497ea7eb2edb8b7`
- reForge target: `19395bf96ccdc605774c76a9fe8cc7145b637128`

---

# 0. 結論

Phase 1 の基本構造は正しい方向に進んでいる。

以下は実装済みで、方針として維持してよい。

- 2 branch A/B
- 同一 input / timestep / conditioning で二重 forward
- A patch → forward → restore → B patch → forward → restore
- denoiser output の左右 hard mask blend
- UNet LoRA only
- Text Encoder LoRAなし
- `<lora:...>` の通常Extra Networksとの混在防止
- existing wrapper / base patch のpreflight
- Phase 1を `IMPLEMENTED / AWAITING VISUAL VALIDATION` として止めている

ただし、**ユーザーに7条件の画像テストを依頼する前に修正必須の問題が2点ある。**

さらに、Frozen Scopeを実際に保証するためのpreflight不足がある。

したがって、今回は Phase 2 へ進まず、

```text
Phase 1 implementation
↓
Pre-Validation Stabilization
↓
Runtime smoke test
↓
User 7-condition visual validation
```

の順にする。

---

# 1. CRITICAL — LoRA Weight slider の引数が間違っている

現行Phase 1:

```python
self.clone_A.add_patches(
    loaded_A,
    strength_model=float(weight_A)
)

self.clone_B.add_patches(
    loaded_B,
    strength_model=float(weight_B)
)
```

これは **LoRA強度の指定として誤り**。

reForge の `ModelPatcher.add_patches()` は:

```python
def add_patches(
    self,
    patches,
    strength_patch=1.0,
    strength_model=1.0
):
```

である。

`strength_patch` が LoRA / diff patch の強度。

`strength_model` は `calculate_weight()` 内で:

```python
if strength_model != 1.0:
    weight *= strength_model
```

として **ベースweight自体を倍率変更する引数**。

その後 LoRA delta は:

```python
weight += (strength * alpha) * lora_diff
```

で加算される。

つまり現在のUI sliderを0.5にすると、

```text
0.5 × base model weight
+ 1.0 × LoRA delta
```

となる可能性がある。

これは意図した:

```text
1.0 × base model weight
+ 0.5 × LoRA delta
```

ではない。

---

## 1.1 必須修正

```python
accepted_A = self.clone_A.add_patches(
    loaded_A,
    strength_patch=float(weight_A),
    strength_model=1.0
)

accepted_B = self.clone_B.add_patches(
    loaded_B,
    strength_patch=float(weight_B),
    strength_model=1.0
)
```

とする。

Phase 0.5で `strength_model=1.0` を使っていた箇所は結果上問題ない。

問題はPhase 1の可変sliderを `strength_model` に接続したこと。

---

## 1.2 Regression test

同じLoRAで以下を比較。

```text
Weight 0.0
Weight 0.5
Weight 1.0
Weight 1.5
```

最低条件:

```text
Weight 0.0 branch ≈ Base UNet
```

となること。

現在実装のままだと Weight 0.0 は「base zero + LoRA full」方向になり得るため、このtestは重要。

Phase 1 reportに:

```text
LoRA UI weight maps to strength_patch, never strength_model.
```

を明記。

---

# 2. CRITICAL — run_branch() の patch_model() が try/finally の外にある

現行:

```python
def run_branch(...):
    t_p0 = time.perf_counter()
    branch_patcher.patch_model()
    t_p = ...

    t_f0 = ...
    out = None
    try:
        out = model_function(...)
    finally:
        branch_patcher.unpatch_model()
```

これはSafety Gateで修正したはずの問題がPhase 1で再発している。

`patch_model()` 自身が途中で例外を出した場合、
`try` に入る前なので `unpatch_model()` が実行されない。

共有 underlying model に部分patchが残る可能性がある。

---

## 2.1 必須修正

`patch_model()` 自体を `try/finally` の内側に入れる。

例:

```python
def run_branch(branch_patcher, model_function, params, label):
    t_patch = 0.0
    t_forward = 0.0
    t_unpatch = 0.0
    out = None

    try:
        t0 = time.perf_counter()
        branch_patcher.patch_model()
        t_patch = (time.perf_counter() - t0) * 1000.0

        t0 = time.perf_counter()
        out = model_function(
            params["input"],
            params["timestep"],
            **params["c"]
        )
        t_forward = (time.perf_counter() - t0) * 1000.0

        return out, t_patch, t_forward, t_unpatch

    finally:
        t0 = time.perf_counter()
        try:
            branch_patcher.unpatch_model()
            t_unpatch = (time.perf_counter() - t0) * 1000.0
        except Exception as cleanup_error:
            self.phase1_fatal_error = True
            self.restore_success = False
            print(
                f"[RLL][Phase1][FATAL] Branch {label} "
                f"unpatch failed: {cleanup_error}"
            )
            raise
```

ただし return値へ `t_unpatch` を正しく反映させるため、実際のコードでは `return` をfinally後に行う構造に整理すること。

推奨形:

```python
try:
    patch
    forward
finally:
    unpatch

return out, t_patch, t_forward, t_unpatch
```

`patch_model()` が失敗してもfinallyへ入ることを最優先。

---

# 3. Phase 1 setup exception を「正常なbase生成」に落とさない

`process_before_every_sampling()` 全体が:

```python
try:
    ... Phase 1 setup ...
except Exception as e:
    print(...)
```

になっている。

このcallbackの例外はreForge ScriptRunner側でもcatchされる。

そのため:

```text
LoRA load error
clone build error
patch registration error
wrapper setup error
```

が発生しても、RLL wrapper未導入のまま通常生成が続く可能性がある。

これは画像だけを見ると「Regional LoRAが動いた」と誤認し得る。

---

## 3.1 状態を明示する

Phase 1 setupの例外時:

```python
self.phase1_blocked = True
self.phase1_fatal_error = True
self.phase1_block_reason = str(e)
```

を必ず設定。

ログ:

```text
[RLL][Phase1][FATAL SETUP]
Oracle wrapper was NOT installed.
This output must NOT be used for validation.
Reason: ...
```

---

## 3.2 「fail-closed」という語を正確に使う

現在のblocked pathは:

```text
Generation continuing without RLL Oracle
```

なので、厳密には「RLL機能がblockされる」だけで、生成そのものは止まらない。

従ってどちらかにする。

### Option A — 本当に生成をabortする

reForgeの現行ソースを確認し、Script callback外まで確実に伝播する正式な中断経路を使う。

推測で `shared.state` 等を触らない。

採用するAPI / 経路を `REFORGE_LORA_FLOW.md` へ記録。

### Option B — 今回はこちらでも可

生成自体は続けるが、文書上は:

```text
RLL BLOCKED / BASE FALLBACK OUTPUT
NOT VALID FOR REGIONAL TEST
```

と呼ぶ。

`fail-closed` という表現は使わない。

最低限 `p.extra_generation_params` が利用可能なら:

```text
RLL Status: BLOCKED
RLL Block Reason: ...
```

をinfotextへ残す。

ユーザーがbase fallback画像をRegional結果と誤認しないことが最優先。

---

# 4. Frozen Scope をコードでも強制する

文書では以下を凍結しているが、現コードでは全てをpreflightしていない。

```text
Batch Size 1
ControlNet OFF
img2img OFF
Hires fix OFF
other wrappers OFF
other weight patches OFF
```

他wrapper / patchesは既に確認している。

残りを追加。

---

## 4.1 Batch Size

```python
if getattr(p, "batch_size", 1) != 1:
    block
```

初期Phase 1ではbatch > 1対応しない。

`n_iter` は1を推奨。

可能なら初期validationでは:

```python
if getattr(p, "n_iter", 1) != 1:
    warning または block
```

---

## 4.2 Hires fix

`process_before_every_sampling()` はHires fix時に複数回呼ばれる。

現在のPhase 1は1run内でwrapper/clone lifecycleを1sampling pass前提にしている。

`enable_hr=True` はblockする。

```python
if getattr(p, "enable_hr", False):
    block("Hires fix is not supported in Phase 1 validation")
```

---

## 4.3 img2img

Phase 1 Frozen Scopeでは未対応。

`self.is_img2img` 等、現行ScriptRunnerの正式情報を使ってblock。

UIから完全に隠す必要はないが、Phase 1選択時は実行不可にする。

---

## 4.4 ControlNet

sampling前に:

```python
getattr(unet, "controlnet_linked_list", None)
```

が非Noneならblock。

Phase 0 Probe同様「property presence」と混同せず、Phase 1ではlinked objectが実際に非Noneであることを見る。

---

# 5. LoRA patch registration を検証する

現行では `add_patches()` の戻り値を無視している。

選択LoRAがcheckpointと非互換の場合:

```text
loaded state dictは読めた
↓
実際にUNetへacceptedされたpatchは0
↓
Branchは実質base
```

になり得る。

---

## 5.1 accepted keys を確認

```python
accepted_A = self.clone_A.add_patches(...)
accepted_B = self.clone_B.add_patches(...)
```

0件ならblock。

```python
if len(accepted_A) == 0:
    block("LoRA A produced zero compatible UNet patches")
```

Bも同様。

ログ:

```text
[RLL][Phase1][LoRA Load]
A accepted UNet patch keys: N
B accepted UNet patch keys: M
```

---

# 6. LoRA Type の扱いを正確にする

Frozen Specは:

```text
Standard UNet LoRA only
```

だが reForge のpatch engine自体はLoCon / LoHa / LoKr / GLora等も扱える。

現RLL loaderはそれらを明示的に拒否していない可能性がある。

今回、複雑なtype detectionを新規実装する必要はない。

ただしPhase 1 reportを:

```text
Validated target: Standard LoRA only.
Other patch types may be parsed by reForge but are OUT OF SCOPE / UNVALIDATED.
```

とする。

ユーザーの最初のtestではStandard LoRAを使う。

---

# 7. Same A/A を数値Oracleとして利用する

視覚テスト前に強い自動検証を追加する。

条件:

```text
LoRA A == LoRA B
Weight A == Weight B
same input / timestep / conditioning
```

なら、理論上 branch A / B のdenoiser outputは同じであるべき。

各wrapper callで:

```python
same_max_diff = (
    out_A.float() - out_B.float()
).abs().max().item()
```

を測定。

A==B時のみログ。

理想:

```text
max_abs_diff = 0
```

微小差が出るなら値を記録。

大きな差なら:

```text
patch state contamination
non-deterministic forward
cleanup issue
```

を疑い、Visual Validationへ進まない。

---

# 8. Weight 0.0 Control を追加する

LoRA weight引数修正を検証するため、ユーザー画像test前のsmoke testに追加。

```text
RLL Left=A Weight=0.0
RLL Right=A Weight=0.0
```

期待:

```text
RLL A0/A0 ≈ No LoRA baseline
```

これは `strength_patch` 接続が正しいか確認する強いテスト。

---

# 9. Multi-Pass runtime timing の表現を修正

PHASE_01_REPORTには:

```text
20 steps追加時間 約0.6〜1.2秒
Oracleとして極めて高速
```

とある。

しかしMulti-PassはUNet forward自体を2回実行するので、主コストはrepatchではなく追加forward。

reportでは:

```text
Repatch overhead estimate: 0.6〜1.2 sec / 20 wrapper calls
Total generation overhead: UNKNOWN until actual Phase 1 runtime measurement
Expected major cost: second UNet forward
```

と分ける。

実測前に「極めて高速」と結論しない。

Phase 1 wrapperのTiming Summaryをユーザー実行ログから記録して初めて更新。

---

# 10. CURRENT_STATUS.md の表現修正

現状:

```text
Runtime timing aggregation and clean state recovery verified
```

ユーザーの実runログがリポジトリに保存されていない場合は強すぎる。

推奨:

```text
Runtime timing aggregation implemented
Clean-state recovery logic implemented
Runtime validation pending user test
```

実際にGeminiがWebUI実機runを行い、ログを保存済みなら、そのログファイル / 実行条件をreportへ明記する。

証拠がないものを `verified` にしない。

---

# 11. PHASE_01_REPORT.md Automated / Smoke Tests

現在 `[x]` が付いている項目は、

```text
source inspection
unit-like local check
actual WebUI sampling test
```

を区別する。

例:

```text
[x] Code path implemented
[ ] Actual WebUI Phase 1 sampling completed
[ ] A/A numerical equality test completed
[ ] A0/A0 baseline equivalence completed
[ ] Swap visual test completed
```

Visual test前に成功扱いしない方針は維持。

---

# 12. Phase 1 runtime diagnostics を追加

初回正常run時、最初のwrapper callだけ:

```text
input shape
output A shape
output B shape
dtype
device
cond_or_uncond
mask shape
mask midpoint
mask sum invariant
accepted patch counts
LoRA weights (strength_patch)
```

をログ。

全step大量表示しない。

---

# 13. Cleanup後の状態確認

postprocess時:

```text
model_function_wrapper がRLLでない
clone_A is None
clone_B is None
phase1 fatal error false/true
```

に加え、可能ならbase UNetのpatch countを記録。

期待:

```text
Base patch count after run = same as before run (Phase 1初期条件では0)
```

RLL OFFの次生成への汚染確認に使う。

---

# 14. User validation前の内部Smoke Test順序

Gemini側で実機生成できない場合は `UNVERIFIED` と書き、ユーザーへ依頼する。

順序:

### Smoke 1 — Enable OFF

```text
RLL OFF
No LoRA
```

通常生成。

### Smoke 2 — Block test

```text
RLL ON
LoRA A=None
LoRA B=None
```

RLL BLOCKEDが明瞭に記録されること。

この画像をRegional結果として保存/評価しない。

### Smoke 3 — Same A/A numerical

```text
Left=A 1.0
Right=A 1.0
```

`out_A/out_B max_abs_diff` を確認。

### Smoke 4 — Zero strength

```text
Left=A 0.0
Right=A 0.0
```

No LoRA baselineとの比較。

### Smoke 5 — A/B

```text
Left=A 1.0
Right=B 1.0
```

sampling完了、cleanup確認。

---

# 15. 上記Smokeが通ってからユーザー7条件テスト

ユーザーへ依頼する本テスト:

```text
1. Control 0   : No LoRA
2. Control A   : Global A
3. Control B   : Global B
4. Control AB  : Global A+B
5. Regional AB : Left=A / Right=B
6. Swap BA     : Left=B / Right=A
7. Same AA     : Left=A / Right=A
```

追加で可能なら:

```text
8. Zero AA : Left=A 0.0 / Right=A 0.0
```

---

# 16. ユーザーに報告してもらうもの

```text
- 使用checkpoint
- LoRA A名
- LoRA B名
- A/B weight
- prompt
- negative prompt
- seed
- sampler / scheduler
- steps
- CFG
- resolution
- 7枚または8枚の画像
- [RLL][Phase1] console log
- Timing Summary
- A/A max_abs_diff
```

これをGPTがレビューしてPhase 1最終判定を行う。

---

# 17. Phase 1 Success判定

コード条件:

- `strength_patch` にLoRA sliderが接続されている
- `strength_model` は1.0固定
- `patch_model()` がtry/finally内
- A/B各branch必ずrestore
- incompatible LoRA 0 patchをblock
- batch/HR/img2img/CN scopeをblock
- A/B output shape/dtype/device一致
- mask sum invariant成立
- cleanup後base state復帰

数値条件:

- Same A/AでA/B output差が0または説明可能な微小値
- Zero A/Aがbaselineと一致または通常再現性範囲内

視覚条件:

- Regional A/BでA特徴が左、B特徴が右へ偏る
- Swap B/Aで位置が反転
- Same A/Aで人工的な左右style境界が大きく出ない
- Global A+Bよりcross-region leakageが明確に低下

---

# 18. Status運用

今回の修正後、ユーザー画像test前は:

```text
Phase 1 — IMPLEMENTED / PRE-VALIDATION READY
```

まで。

ユーザーtest後にのみ:

```text
SUCCESS
PARTIAL
FAILED
```

を決める。

Phase 2へはまだ進まない。

---

# 19. 更新ファイル

最低限:

```text
scripts/regional_lora_lab.py
reports/PHASE_01_REPORT.md
CURRENT_STATUS.md
CHANGELOG.md
GPT_GITHUB_LINKS.txt
```

必要なら:

```text
docs/PHASE_01_MULTIPASS_POC.md
```

へ実装errata追記。

Frozen architecture自体は変更しない。

---

# 20. GitHub push後の停止点

1. 修正
2. diff確認
3. commit
4. push
5. FULL implementation SHA取得
6. GPT_GITHUB_LINKSのPinned implementation commit更新
7. CURRENT_STATUS更新
8. PHASE_01_REPORT更新
9. そこで停止

**まだPhase 2へ進まない。**

ユーザー / GPTへ、

```text
Phase 1 Pre-Validation Stabilization完了
Visual Test依頼可能
```

と報告する。

---

# 21. 最重要事項

今回見つかった中で最も重要なのは2点。

```text
A. LoRA sliderが strength_model に入っている
B. run_branchの patch_model() が try/finally の外
```

Aは生成結果そのものを壊し、
Bは例外時に共有UNet weightを汚染し得る。

この2点を直す前にユーザー視覚テストを開始しない。

修正後、Same A/AとZero A/Aの数値controlを先に通す。

それからRegional A/Bの視覚評価へ進む。
