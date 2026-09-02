# Regional LoRA Lab — Phase 0 外部レビュー修正指示書
## Phase 0.5: Patch Residency / Wrapper Chaining Probe
### 対象
`D:\GitHub\tegaki\RegionalLoRALab`

基準コミット:
`b55b0ec2a0e563735d6e804bc209b3c094f8cc99`

---

# 0. 結論

Phase 0 の方向性は良い。

以下は確認できている。

- reForge 実環境を固定して調査している。
- MRP を変更していない。
- Probe-only extension は実際に生成テンソルを書き換えない。
- `UnetPatcher.clone()`、`add_patches()`、`model_function_wrapper` の存在を現行 reForge ソースから追っている。
- GPT レビュー用のドキュメント構成も概ね良い。

ただし、**Phase 1 Multi-Pass Oracle をそのまま実装開始してはいけない。**

Phase 0 文書には、

> clone の patch list が独立している

ことと、

> LoRA A/B を適用した2つの UNet 状態を、同一 sampling step 内で独立に forward できる

ことが、やや混同されている。

現行 reForge の `clone()` は patcher の bookkeeping を複製するが、
**underlying model は共有される。**

そのため、以下はまだ未証明である。

```text
unet_A.model.apply_model(...)
unet_B.model.apply_model(...)
```

を呼べば、A と B の別 LoRA weight が自動的に使い分けられる、という前提。

むしろ reForge の LoRA は `add_patches()` で patch 情報を登録した後、
`model_management.load_models_gpu()` / `patch_model()` 系で共有 model weight へ反映される。

したがって Phase 1 に進む前に、

**「2 clone の patch 記録」ではなく「実際に materialize された weight state をどう切り替えるか」**

を確認する Phase 0.5 を追加する。

---

# 1. Phase 0 は SUCCESS のままでよいが、表現を修正する

Phase 0 の目的は、

- 環境調査
- hook 候補発見
- no-op probe
- 既存生成を壊さない確認

だった。

この範囲は成功扱いでよい。

ただし、

```text
Phase 0 は完全成功。
Phase 1 の Multi-Pass を安全に挟み込める確実な構造が存在する。
```

のような表現は強すぎる。

Phase 0 で確認できたのは、

```text
model_function_wrapper という forward interception point が存在する
```

まで。

**2つの異なる LoRA weight state をその wrapper 内で安全に同時利用できることは未確認。**

---

# 2. PHASE_00_REPORT.md の修正

現在の以下の記述:

```text
UnetPatcher の参照および clone() の安全性を実機確認。
```

は、添付された `regional_lora_lab.py` の Probe 内容だけからは確認できない。

Probe は clone を生成・patch・forward していない。

実際に別途コンソール等で clone test を行っているなら、

- 実行コード
- ログ
- 何をもって安全と判定したか

を報告書へ追加する。

行っていない場合は、

```text
UnetPatcher.clone() の実装と patch list の複製方式をソース上で確認。
実際の patch materialization / concurrent branch safety は未検証。
```

へ修正する。

---

## Important Observations の修正

現在:

```text
Phase 1 の Multi-Pass 合成を安全に挟み込める確実な構造が存在する。
```

推奨:

```text
model_function_wrapper により UNet forward 呼び出しを interception できることを確認した。
ただし、共有 underlying model 上で異なる LoRA patch state を1 sampling step 内に切り替えられるかは未検証。
Phase 1 実装前に Patch Residency Probe が必要。
```

---

## Known Problems の修正

現在:

```text
なし
```

ではなく、少なくとも:

```text
- UnetPatcher clone は underlying model を共有するため、
  clone A / B の patch state を同時に独立 materialize できるか未確認。
- model_function_wrapper が既存 extension の wrapper と競合する可能性を未確認。
- ControlNet linked state の probe 表示が「存在」と「実際にactive」を区別していない。
```

を記載する。

これは Phase 0 失敗を意味しない。

---

# 3. CURRENT_STATUS.md の修正

Status:

```text
Current Phase: 0
Status: SUCCESS
```

は維持してよい。

ただし Next を:

```text
- GPT review completed
- Phase 0.5: Patch Residency / Wrapper Chaining Probe
- Phase 0.5 成功後に Phase 1 Multi-Pass Oracle の方式を確定
```

へ変更する。

Phase 1 を即開始する状態にはしない。

---

# 4. REFORGE_LORA_FLOW.md の重要修正

## 4.1 `clone()` の説明

現在:

```text
YES (完全対応)
```

は曖昧。

推奨:

```text
YES: patcher clone API は存在する。
patches / model_options 等の bookkeeping は clone 側へ複製される。
ただし underlying model は共有されるため、
「2 clone = 独立した2個の実 UNet weight set」ではない。
```

---

## 4.2 必ず追加する節

以下を追加する。

```text
## Patch Registration と Patch Materialization は別段階

add_patches():
    patcher に LoRA patch 情報を登録する。

patch_model() / model_management.load_models_gpu():
    登録された patch を実 model weight へ materialize する。

したがって、

clone_A.patches != clone_B.patches

であっても、

clone_A.model is clone_B.model

なら、実際の forward 時にどちらの weight state が materialize されているかを
別途管理する必要がある。
```

---

## 4.3 Phase 0.5 で読む追加ソース

最低限追加調査する。

```text
ldm_patched/modules/model_patcher.py
    - patch_model()
    - unpatch_model()
    - patch_weight_to_device()
    - backup / object_patches

ldm_patched/modules/model_management.py
    - LoadedModel
    - load_models_gpu()
    - model_load()
    - loaded model reuse / clone handling

modules_forge/forge_sampler.py
    - sampling_prepare()
    - sampling_cleanup() があればそれも

extensions-builtin/Lora/extra_networks_lora.py
modules/extra_networks.py
```

特に `<lora:...>` の流れは、

```text
prompt extra-network parse
→ ExtraNetworkLora.activate()
→ networks.load_networks()
→ load_lora_for_models()
```

の責務分担を正確に書く。

`networks.load_networks()` 自体が prompt text から `<lora>` を直接抽出する、
という意味に読める文章は避ける。

---

# 5. ARCHITECTURE_NOTES.md の修正

## 5.1 「完全分離を保証」を弱める

現在:

```text
Multi-Pass Oracle:
原理的に完全なLoRA分離を保証
```

は強すぎる。

Multi-Pass で branch A / B の LoRA weight state 自体を別にできても、
各 branch の UNet は画像全体の latent を見る。

Convolution / Self-Attention / Cross-Attention の receptive field により、
A branch の出力は A 領域外の latent context の影響を受け得る。

したがって、

```text
LoRA weight state の branch-level separation を実現しやすい。
Masked Delta 方式を評価するための reference / baseline として使う。
意味的・空間的な完全無漏洩は保証しない。
```

へ修正する。

名称 `Oracle` は残してよいが、

```text
Oracle = exact mathematical ground truth
```

ではなく、

```text
Oracle = intentionally slow reference baseline
```

と定義する。

---

## 5.2 LoRA対象層の文章

現在:

```text
全ての Linear / Conv 層に ΔW が直接加算される
```

は一般化しすぎ。

推奨:

```text
LoRA が実際に target として持つ Linear / Conv 等の層へ ΔW が加算される。
対象層は LoRA の学習・形式によって異なる。
```

---

# 6. PHASE_01_MULTIPASS_POC.md はまだ実装仕様として確定させない

現在の擬似コード:

```python
out_A = apply_model_A(...)
out_B = apply_model_B(...)
```

には重要な未定義部分がある。

`UnetPatcher` clone A/B は同じ `model` を共有するため、

```python
apply_model_A
apply_model_B
```

が何を意味するのかを先に定義しなければならない。

単に:

```python
unet_A.model.apply_model
unet_B.model.apply_model
```

とすると、両者は同じ underlying model である可能性が高い。

**この擬似コードをそのまま実装しないこと。**

Phase 0.5 の結果を受けて、以下のどれになるか判断する。

### Candidate A
patcher A / B を安全に交互 materialize できる。

→ Multi-Pass継続可能。

### Candidate B
clone は bookkeeping のみ分離され、毎forwardでweight repatchが必要。

→ 性能を測定し、Oracle用途でも現実的か判断。

### Candidate C
共有modelのため安全な交互利用が難しい。

→ Phase 1方式を再設計し、Masked Delta / custom LoRA forward の調査を前倒し。

結論を先に決めない。

---

# 7. Phase 1 では Text Encoder を外す

現行 Phase 1 UI案には:

```text
Text Encoder:
- Off
- Global A
- Global B
- Global Both
```

があるが、Phase 1では削除する。

Phase 1 の最小仕様:

```text
UNet LoRA only
Text Encoder multiplier = 0
```

とする。

理由:

- CLIP conditioning は sampling 前に生成される。
- sampling wrapper の中だけで TE LoRA を切り替えることはできない。
- UNet branch separation の検証と TE scope の問題を混ぜない。
- Text Encoder 問題は Master Plan の Phase 2 で扱う予定だった。

Phase 1 で LoRA state dict を読む際も、
LoRA A/B の **UNet patch のみ** を branch 用に使用する。

---

# 8. Prompt の通常 `<lora:...>` と Lab LoRA を混在させない

Phase 1 初期版では、

```text
prompt に <lora:A:...>
+
Regional LoRA Lab UI でも A を選択
```

を許さないか、強い warning を出す。

通常 Extra Networks で global LoRA が先に適用されると、
Regional 分離の実験条件が汚染される。

初期実験では:

```text
prompt:
trigger word は可
<lora:...> tag は不可
```

を推奨。

LoRA A/B のロードは Regional LoRA Lab 側が管理する。

---

# 9. model_function_wrapper の Chain-of-Responsibility を調査する

重要。

reForge / Forge 系では `model_function_wrapper` を使う他の extension が存在する。

Regional LoRA Lab が:

```python
unet.set_model_unet_function_wrapper(my_wrapper)
```

で既存 wrapper を上書きすると、

- Tiled Diffusion
- IC-Light
- AnimateDiff
- その他 model wrapper 系

と衝突する可能性がある。

Phase 0.5 で以下を確認する。

```text
existing_wrapper = unet.model_options.get("model_function_wrapper")
```

existing_wrapper がある場合:

1. 正しく chain 可能か
2. chain 順序はどうすべきか
3. chain 不可能なら RLL を fail-closed で停止すべきか

を判断する。

初期Phaseでは、

```text
既存wrapperが存在したら RLL を開始せず警告
```

でもよい。

無理に互換性対応しない。

---

# 10. ControlNet probe 表示を正確にする

現在コード:

```python
has_controlnet = getattr(unet, "controlnet_linked_list", None) is not None
```

は、

- property が存在する
- list/object が空でない
- 実際に ControlNet がactive

を区別していない可能性がある。

表示名を少なくとも:

```text
controlnet_linked_list present
```

へ変更するか、

objectの実型を確認して

```text
controlnet link count
```

を安全に出す。

`ControlNet linked = True` を active 判定として使わない。

---

# 11. Probe script のログ表現を修正

現在:

```text
[RLL][Cleanup] Sampling finished. No state pollution left.
```

Phase 0 script は state mutation 自体をしていないので、
「汚染が無いことを検証した」というログにはしない。

推奨:

```text
[RLL][Probe] Sampling finished. Probe performed no model mutation.
```

または:

```text
[RLL][Probe] Completed (read-only probe).
```

Phase 1以降、本当にpatch stateを変更した時だけ `[Cleanup]` を使う。

---

# 12. Probe script の軽微な整理

未使用なら削除してよい。

```python
import os
import sys
import torch
from modules import shared, errors
self.is_active
```

ただし削除による副作用がないことを確認。

これは優先度低。

---

# 13. TEST_PROTOCOL.md の修正

現在:

```text
Regional Lab OFF 後の生成が Control 0 と完全一致
```

は目的として良いが、
GPU演算・samplerによっては bit-exact が常に保証されない可能性がある。

以下のように定義を明確にする。

```text
Deterministic reference mode:
- 同seed
- 同sampler
- 同scheduler
- 同checkpoint
- 同resolution
- batch size 1
- 他extension固定
- 可能なら同一WebUI session内でPNG/latent hash比較

bit-exact が通常でも成立する環境では exact match を要求する。

通常状態でも微小な非決定性が存在する場合は、
RLL OFF後と「WebUI再起動後reference」の差が、
通常run-to-run差を超えないことを条件にする。
```

最初に RLL を使わない状態で同seedを2回生成し、
その環境の通常再現性を測ってから contamination test をする。

---

# 14. RESEARCH_REFERENCES.md を強化する

現状は概略だけで、将来Geminiが「どのコードを根拠にしたか」を追いづらい。

各項目へ最低限:

```text
Repository URL:
Relevant file / document:
License:
What was actually borrowed conceptually:
What must NOT be copied directly:
Applicability to reForge/SDXL:
```

を追加する。

特に:

- kohya sd-scripts
- hako-mikan Regional Prompter
- reForge LoRA Control
- ComfyUI系
- Forge Neo / Krea系

を区別する。

ライセンスが未確認なら `UNKNOWN - VERIFY BEFORE COPYING` とする。

---

# 15. GPT_GITHUB_LINKS.txt の作法

今回 GPT がGitHub本文を直接取得できなかった原因は、
`GitHubURL_ERE.txt` と URL形式が違うからとは考えにくい。

両方とも基本は:

```text
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/...
```

を使っている。

したがって前回の取得失敗は、

- GitHub Raw側の反映タイミング
- キャッシュ
- 外部取得側の crawl / cache miss

の可能性が高い。

ただし、`GitHubURL_ERE.txt` の方が
**外部AI向けナビゲーションとしては明らかに親切**なので、
Regional LoRA Lab側も同形式へ寄せる。

---

## 15.1 追加する項目

`GPT_GITHUB_LINKS.txt` 冒頭へ:

```text
Regional LoRA Lab — GPT Review Navigation

Updated:
YYYY-MM-DD HH:MM JST

Purpose:
This file is the entry point for an external AI technical review.

Read in this order:
1. CURRENT_STATUS.md
2. latest PHASE report
3. REFORGE_LORA_FLOW.md
4. ARCHITECTURE_NOTES.md
5. current implementation script
6. MASTER_PLAN.md only when long-term context is needed
```

を追加。

Master Planは長いため、
毎回最初に読む必要はない。

---

## 15.2 自分自身へのRaw URLを追加

```text
Navigation file:
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/RegionalLoRALab/GPT_GITHUB_LINKS.txt
```

---

## 15.3 Commit-pinned snapshot を追加

`main` Raw URLに加え、
GPTレビュー時点のFULL SHA固定URLも追加する。

例:

```text
Pinned review commit:
b55b0ec2a0e563735d6e804bc209b3c094f8cc99

Pinned CURRENT STATUS:
https://raw.githubusercontent.com/toshinka/tegaki/b55b0ec2a0e563735d6e804bc209b3c094f8cc99/RegionalLoRALab/CURRENT_STATUS.md

Pinned PHASE REPORT:
https://raw.githubusercontent.com/toshinka/tegaki/b55b0ec2a0e563735d6e804bc209b3c094f8cc99/RegionalLoRALab/reports/PHASE_00_REPORT.md

Pinned MAIN SCRIPT:
https://raw.githubusercontent.com/toshinka/tegaki/b55b0ec2a0e563735d6e804bc209b3c094f8cc99/RegionalLoRALab/scripts/regional_lora_lab.py
```

`?v=` は最新mainのcache-busting用。

commit-pinned URLは
**「どのコードをレビューしたのか」を固定する用途**。

役割が違うので両方残す。

---

## 15.4 外部AI用コピペプロンプトを追加

`GitHubURL_ERE.txt` と同様に末尾へ:

```text
External AI Review Prompt:

以下の CURRENT_STATUS、最新Phase報告書、REFORGE_LORA_FLOW、
ARCHITECTURE_NOTES、実装コードを読み、
1. 文書とコードの矛盾
2. 未検証なのに成功扱いしている箇所
3. reForge model patch state の安全性
4. 次Phaseへ進む前に必要なprobe
をレビューしてください。

MASTER_PLAN の方針を尊重し、
MRP本体は変更しないでください。
```

を入れる。

---

# 16. Phase 0.5 — Patch Residency / Wrapper Chaining Probe

## 目的

Phase 1を実装する前に、以下を**実測**する。

1. clone A/Bの `patches` は独立しているか
2. clone A/Bの `model` identity は同じか
3. `add_patches()` 後、いつ実weightへ反映されるか
4. `patch_model()` / `unpatch_model()` でweightがどう復元されるか
5. clone A/Bを順にloadした時、現在のmodel weightが何に変わるか
6. model management cacheがcloneをどう判定するか
7. existing `model_function_wrapper` をどう保持するか
8. cleanup後にbase stateへ戻るか

---

# 17. Phase 0.5 ではまだRegional画像を生成しない

Phase 0.5 は研究probe。

Phase 1 UIを作らない。

最小UI:

```text
Regional LoRA Lab
[ ] Enable
Mode:
- Phase 0: Read-only Probe
- Phase 0.5: Patcher Residency Probe

[ ] Debug Log
```

LoRA fileを必要とする場合は、
ユーザーが選べる1個だけでよい。

2 LoRA UIを作る必要はない。

---

# 18. Phase 0.5 の安全な実験項目

## A. Identity Probe

ログ:

```text
base_patcher id
clone_A id
clone_B id

base.model id
clone_A.model id
clone_B.model id

patch dict id
model_options id
```

期待:

- patcher objectは別
- underlying modelは同一
- patches/model_options containerは別

---

## B. Patch Registration Probe

標準LoRA 1個を **UNet weight only** で clone_A に登録。

確認:

```text
len(base.patches)
len(clone_A.patches)
len(clone_B.patches)
```

base / B が変化しないこと。

ここではまだ「forward時にAだけ効く」と結論しない。

---

## C. Weight Residency Probe

`patch_model()` / `unpatch_model()` と model_management の正規経路を調査した上で、
対象weightを少数選び、

- base
- clone_A materialized
- restored base

で checksum / norm 等を記録。

巨大tensor全体をログへ出さない。

### 必須

実験失敗時も必ずrestore。

---

## D. Alternate State Probe

安全性が確認できた場合だけ:

```text
base
→ A materialize
→ base restore
→ B materialize
→ base restore
```

を試す。

この結果から初めて、
sampling step内でA/Bを切替える方式が現実的か判断する。

---

## E. Timing Probe

weight patch切替が必要なら時間を計測。

1 denoise stepごとにA/Bを切り替えると仮定した時、
patch/unpatchコストが現実的か判定する。

もし数百ms～秒単位でweight patchを行う必要があるなら、
Multi-Pass Oracle方式自体を再検討する。

---

# 19. Phase 0.5 成功条件

成功とは「Phase 1方式が必ず可能」ではない。

以下のどれかを明確にできれば成功。

### Result A

```text
2 patcher stateを安全にbranch forwardへ利用できる方式が判明
→ Phase 1 Multi-Passへ
```

### Result B

```text
可能だが毎forwardのrepatchが非常に重い
→ Oracle用途として採用するかユーザー判断
```

### Result C

```text
shared underlying modelのため現在案では安全にbranch forwardできない
→ Multi-Pass案を停止し、別方式を再設計
```

どの結果でも研究成果。

---

# 20. Phase 0.5 完了後の報告書

新規作成:

```text
reports/PHASE_00_5_REPORT.md
docs/PHASE_00_5_PATCH_RESIDENCY_PROBE.md
```

更新:

```text
CURRENT_STATUS.md
REFORGE_LORA_FLOW.md
ARCHITECTURE_NOTES.md
PHASE_01_MULTIPASS_POC.md
RESEARCH_REFERENCES.md
TEST_PROTOCOL.md
CHANGELOG.md
GPT_GITHUB_LINKS.txt
```

Phase 1 docは、
Phase 0.5で判明した実際のpatch state lifecycleを反映して書き直す。

---

# 21. GitHub push後

1. commit
2. push
3. FULL SHA取得
4. `GPT_GITHUB_LINKS.txt` の pinned snapshot 更新
5. `CURRENT_STATUS.md` 更新
6. そこで停止

ユーザー / GPTレビューなしでPhase 1実装へ進まない。

---

# 22. Phase 0.5 の最重要ルール

- `clone()` があることと「独立した2 UNetが動くこと」を同一視しない。
- `add_patches()` と「実weightへLoRAが適用済み」を同一視しない。
- `model_function_wrapper` が存在することと「複数LoRA stateを安全に呼べること」を同一視しない。
- 既存 `model_function_wrapper` を上書きしない。
- Text EncoderをPhase 1へ混ぜない。
- promptの通常 `<lora>` とLab側LoRAを混ぜない。
- MRPを変更しない。
- 結果が「Multi-Pass非現実的」でも成功した調査として記録する。

