# EasyReforge Manga Region Prompter
## v3.7.1 Diagnostic Reset 改修指示書 — EasyReforge固定環境版

作成日: 2026-09-02  
改訂: EasyReforge固有の環境固定・更新方針・ControlNet既知良好前提を反映  
対象: **Zuntan03/EasyReforge** 内の `stable-diffusion-webui-reForge` 上で動作する `EasyReforge Manga Prompter`  
実装担当想定: Gemini Antigravity / コーディングAI  
目的: **ControlNetなし・LoRAなしの最小条件で、任意の矩形領域に対応する任意のPositive Promptが生成結果へ明確に反映される状態を回復する。**

---

# 0. この改修の最重要目的

この改修では漫画として綺麗な画像を作ることを目的にしない。

合格条件は次の一点である。

> **同一Seed・同一生成条件で、領域Aのプロンプトだけを大きく変更したとき、領域Aの生成内容が明確に変わること。**

完全な境界固定、完全なリークゼロ、ControlNet共存、LoRAの領域分離、漫画品質は今回の合格条件ではない。

現状では、Manga Region Prompterの有効化ON/OFFで生成物が変わらないという報告がある。したがって、現在の最優先問題は「分離精度が低い」ことではなく、**そもそもManga側Attention Hook / region conditioningが実際のsampling pathへ効いていることを証明できていない**ことである。

この状態でweight調整、ControlNet折衝、LoRA分離、UI拡張を行ってはならない。

## 0.1 EasyReforge環境としての前提

本書でいう実行環境は、単体のreForge一般ではなく、**Zuntan03/EasyReforgeが構築・管理している安定環境**を指す。

想定構造:

```text
EasyReforge/
├─ Reforge.bat
├─ Update.bat
├─ EasyReforge/
└─ stable-diffusion-webui-reForge/
   ├─ extensions/
   ├─ extensions-builtin/
   ├─ models/
   └─ ...
```

したがって、上流reForge最新版やForge最新版の一般論よりも、**現在このEasyReforge環境で実際に動いているローカル実装**を優先する。

特に以下をGolden Environmentとして扱う。

- 現在のEasyReforge revision
- 内包されている `stable-diffusion-webui-reForge` revision
- 現在インストール済みのForge Couple revision
- 現在正常動作しているControlNet拡張・モデル・プリセット
- 現在利用しているPython / PyTorch / xformers等の実行環境

### v3.7.1診断中の更新禁止

**診断完了までは `Update.bat` を実行しないこと。**

また、以下も行わない。

- `ReforgeSwitchDev.bat` 等によるdev branchへの切替
- reForge coreの手動pull
- Forge Couple単体の最新版への更新
- ControlNet関連拡張の更新
- PyTorch / CUDA系の更新
- 既存拡張の一括更新

理由は、現在のEasyReforgeが既に通常生成・ControlNet利用について安定しているためである。

今回必要なのは「環境を最新化すること」ではなく、**現在の安定環境上でManga Region Prompterだけが機能していない原因を固定条件で切り分けること**である。

更新が必要と判断できるのは、後述するOracle Testとdiagnostic logによって、現行core側の既知バグまたはAPI不足が具体的に証明された場合だけとする。

その場合も、現在環境を直接更新せず、可能なら別コピー / バックアップ環境で更新検証する。

---

# 1. 現在のUI・Prompt設計は維持する

## 1.1 Main Positive Promptを唯一のPrompt Source of Truthとする

Manga Region Prompter右側の各コマ表示は、独立したPrompt入力データではない。

本体のPositive Prompt欄を解析して表示する情報パネルである。

想定形式:

```text
GLOBAL / QUALITY / STYLE / GLOBAL LORA
BREAK
koma 1: PANEL 1 PROMPT
BREAK
koma 2: PANEL 2 PROMPT
BREAK
koma 3: PANEL 3 PROMPT
```

この構造を変更しないこと。

コマカード側に別Prompt stateを新設しないこと。

UIとバックエンドで二重のPrompt sourceを持たないこと。

## 1.2 コマ側で保持してよい独立情報

- rectangle / mask
- panel index / id
- zIndex
- region weight

Prompt本文はMain Positive Promptから解決する。

## 1.3 Global LoRA

最上段GLOBAL chunkに置かれた `<lora:AAA:0.1>` 等は、従来どおりWebUI / Forgeの通常Extra Network処理で**全体へ適用**することを基本とする。

v3.7ではコマ個別LoRAの空間分離は実装しない。

Panel chunk内のLoRAを特別処理する機能も作らない。

---

# 2. 今回変更してはいけない領域

v3.7では以下を触らない。

- ControlNet統合
- ControlNetのcallback order最適化
- Hires Fix対応
- ADetailer対応
- Dynamic Prompt独自対応
- Wildcard独自対応
- LoRA region isolation
- Negative Prompt region化
- Canvas UIの再設計
- Prompt Cardを独立入力化
- 吹き出し / セリフ
- manga page layout品質改善
- Separate panel generation
- Latent Couple方式への移行
- ComfyUIへの移行

ControlNet関連コードが既に存在しても削除・変更しない。

現在のEasyReforgeではControlNet自体は既知良好で正常利用できているため、ControlNetを原因候補として扱わない。

ただし、**Regional Prompt単体の成立性を証明する最初のテストだけはControlNetをOFFにする。**

これはControlNetが壊れていると疑うためではなく、変数を一つ減らしてAttention Couple単体の効果を証明するためである。

Regional Prompt単体がPASSした後は、現在正常利用できているControlNet設定を一切変えずに再度ONにし、初めて「両者を同時に使った時だけ問題が出るか」を調べる。

---

# 3. 現状から見たP0問題

現在の出力例では、Canvasは「上部大コマ + 下部左右2コマ」であるにもかかわらず、生成結果はテキストPromptの `3koma, manga page` に引っ張られたような横3段構成になっている。

さらにユーザー報告ではManga Region PrompterのEnableを外しても生成物が変わらない。

したがって、最初に疑うべき優先順位は以下である。

1. `is_enabled` がbackend callbackまで正しく届いているか
2. Manga script callbackが実際に呼ばれているか
3. `set_model_attn2_patch` / `set_model_attn2_output_patch` が登録されているか
4. 登録したpatched UNetがsampling時まで維持されているか
5. hook関数自体が実sampling中に呼ばれているか
6. region conditioningがhookへ渡っているか
7. maskが正しいか
8. 最後にregion promptの強度・リークを評価する

この順番を崩さない。

---

# 3.1 実装開始前にEasyReforge環境を凍結記録する

Antigravityはコード変更前に、可能な範囲で以下を記録する。

```text
EasyReforge root:
EasyReforge git commit:
stable-diffusion-webui-reForge git commit:
reForge branch:
Forge Couple path:
Forge Couple git commit:
Forge Couple UI version:
ControlNet extension path / version:
通常利用中のControlNet model / preset:
Python version:
PyTorch version:
```

最低限、以下を実行する。

EasyReforgeリポジトリ側:

```bash
git rev-parse HEAD
git status --short
```

内包reForge側:

```bash
cd stable-diffusion-webui-reForge
git rev-parse HEAD
git branch --show-current
git status --short
```

Forge Coupleが独立git repositoryであれば、そのディレクトリでも:

```bash
git rev-parse HEAD
git status --short
```

結果は:

```text
EasyReforgeExtension/docs/V37_LOCAL_REFERENCE.md
```

へ保存する。

この記録が、以後の「動いた版」を再現するための基準になる。

---

# 4. Forge Coupleを「環境Oracle」として使う

画面上では同じEasyReforge環境に `Forge Couple v4.0.2` が存在している。

上流Forge Coupleにはより新しい版が存在するが、**今回のGolden Referenceは上流最新版ではなく、このEasyReforge環境に現在インストールされているローカルForge Coupleである。**

理由:

- EasyReforge / 内包reForgeの内部APIは時期により差がある
- ModelPatcher / dtype / callback lifecycleが変化し得る
- 最新7.xコードをそのまま移植してもローカル環境と一致するとは限らない

## 4.1 Antigravityが最初に行う調査

ローカルのForge Couple実体を検索すること。

候補:

```text
extensions/sd-forge-couple/
extensions-builtin/
EasyReforge配下のextensions/
```

以下を記録する。

```text
Forge Couple表示Version
対象ディレクトリ
forge_couple.pyの実パス
attention_couple.py相当の実パス
mapping.py相当の実パス
Git commit hash（取得可能なら）
```

この結果を以下に保存する。

```text
EasyReforgeExtension/docs/V37_LOCAL_REFERENCE.md
```

## 4.2 Oracle Test

Manga PrompterをOFFにしてForge CoupleだけをONにする。

ControlNet OFF。
LoRA OFF。
Hires OFF。
Batch size 1。
固定Seed。

左右50:50の2領域で強く異なるPromptを与える。

例:

```text
LEFT:
red sports car, indoor parking garage

RIGHT:
blue ocean, sailboat, horizon
```

Forge Couple自身でも領域差が出ない場合、Manga PrompterのAttention実装を盲目的に書き換えない。

まずローカルForge Coupleの設定・UI入力・実際のcallback実行を確認し、EasyReforge内でForge Couple自体が現在機能しているかを切り分ける。

**この時点でも `Update.bat` は実行しない。** 更新は原因が現行core/APIに特定された場合の別検証とする。

Forge Coupleで差が出た場合、そのローカル実装をManga Prompter Attention backendのGolden Referenceにする。

---

# 5. `manga_prompter.py` の設計をDiagnostic Resetする

対象:

```text
EasyReforgeExtension/scripts/manga_prompter.py
```

## 5.1 `process()` で `p.prompt` を書き換える処理を廃止する

現在のv3.6では、Main PromptをBREAK分割した後、先頭GLOBAL chunkだけを `p.prompt` へ代入している。

この方式をv3.7では使用しない。

禁止:

```python
p.prompt = base_style
```

およびlist版の同等処理。

### 理由

- Forgeの通常Prompt lifecycleと別経路になる
- Extra Network / LoRA / Dynamic Prompt等との順序が不透明になる
- 正常なWebUI conditioningを途中で変更する
- ON/OFF比較時の原因切り分けを難しくする

v3.7ではMain Positive Promptを一切書き換えない。

`postprocess()` でPromptを復元する仕組みも不要になる。

---

# 6. Promptを取得するタイミングをForge Couple方式へ寄せる

## 6.1 `after_extra_networks_activate` を使う

ローカルForge Coupleがこのcallbackを使用している場合、Manga Prompterも同じlifecycleへ合わせる。

重要:

**ローカルForge Coupleのメソッドsignatureをそのまま確認してから実装すること。**

GitHub最新コードを盲目的にコピーしない。

概念:

```python
def after_extra_networks_activate(self, p, is_enabled, base_weight, json_bridge, *args, **kwargs):
    # enable確認
    # panels確認
    # Forgeが実際に解決したpromptsを取得
    # BREAK chunkを厳密に解析
    # GLOBAL + panelごとのresolved textを保存
```

Prompt取得は可能ならローカルForge Couple同様に:

```python
kwargs["prompts"][0]
```

を使う。

存在しない場合のみローカルEasyReforgeのcallback仕様を調べる。

推測でfallbackを増やさない。

---

# 7. BREAKの対応を曖昧にしない

v3.6の以下の推測ロジックは廃止する。

```python
has_base = (len(raw_chunks) >= num_panels + 1)
start_chunk_idx = 1 if has_base else 0
```

v3.7のMain Prompt grammarは明示的に固定する。

```text
chunk 0 = GLOBAL
chunk 1 = Panel 1
chunk 2 = Panel 2
...
chunk N = Panel N
```

必要chunk数は:

```text
panel count + 1
```

である。

一致しない場合はGenerationを正常にregional化しない。

コンソールへ明確なエラーを出す。

例:

```text
[MangaPrompter][ERROR]
Prompt chunk mismatch: expected 4 chunks (GLOBAL + 3 panels), got 3.
Regional patch was NOT applied.
```

PromptとRegion数がズレた状態をAI側で勝手に推測して補正しない。

---

# 8. GLOBAL Promptの扱いを変更する

## 8.1 GLOBALを「全画面base conditioning」として混ぜない

v3.7ではAttention Coupleに渡す `base_mask` を強制的に0にする。

概念:

```python
base_mask = torch.zeros((height, width)).unsqueeze(0)
```

UI上の `Base Style Weight` sliderはv3.7 Diagnostic中は計算に使用しない。

UI互換のため残してよいが、ログで以下を出す。

```text
Base Style Weight is temporarily bypassed in v3.7 Diagnostic Reset.
GLOBAL text is prefixed into each region conditioning instead.
```

## 8.2 GLOBAL textは各Region Promptへ共通prefixとして複製する

Regional Prompterの「Use common prompt」と同じ発想を採る。

例:

入力:

```text
masterpiece, high quality, monochrome
BREAK
koma 1: red sports car
BREAK
koma 2: blue ocean
```

内部Region conditioning:

```text
Region 1:
masterpiece, high quality, monochrome, red sports car

Region 2:
masterpiece, high quality, monochrome, blue ocean
```

この方式ならGLOBAL quality / style文字列は全Regionに効くが、通常WebUIのbase conditioningを全面マスクで混ぜる必要がない。

## 8.3 LoRA

GLOBAL chunkのLoRAはWebUI / Forgeの通常Extra Network activationに任せる。

v3.7ではRegion conditioning用文字列にLoRAを独自展開しない。

`after_extra_networks_activate` で取得したresolved promptが既にLoRAタグ除去済みならそのまま使用する。

残っている場合はローカルForgeの正式なExtra Network parser処理を調べる。

独自regexでLoRAをロードしない。

---

# 9. Region mask生成を一箇所に統一する

現在 `MangaSpatialEngine.generate_spatial_masks()` にはzIndexによるくり抜き処理が存在する一方、`manga_prompter.py` はrectangleから直接maskを再生成している。

v3.7ではmask生成を:

```text
MangaSpatialEngine.generate_spatial_masks()
```

へ統一する。

`manga_prompter.py` 内で同じ矩形maskロジックを再実装しない。

### 期待フロー

```text
json_bridge
  ↓
parse_panels_json
  ↓
sort/index validation
  ↓
generate_spatial_masks
  ↓
validated region masks
  ↓
Attention Couple
```

---

# 10. Mask Validationをfail-openからfail-closedへ変更する

現在のAttention Hookには、未カバーpixelがある場合に:

```python
mask = mask + 1e-4
```

で強制的に埋める処理がある。

v3.7 Diagnosticでは禁止する。

ローカルForge Coupleと同等に、mask coverageが成立しない場合は停止する。

例:

```python
coverage = mask.sum(dim=0)
if coverage.min().item() <= 0.0:
    error
    return None
```

未カバーがあるのに画像を生成し続けると、mask bugとattention bugを区別できない。

## 10.1 overlap

zIndex処理後のbinary region masksについて、意図しない重複もdiagnostic logする。

最低限ログ:

```text
Panel count
mask shape
per-panel covered pixels / percentage
coverage min
coverage max
uncovered pixel count
overlap pixel count
```

v3.7の最初の2-region / 3-regionテストでは、coverageは完全であること。

---

# 11. Attention Hook本体は「ローカルForge Coupleと一致させる」

対象:

```text
EasyReforgeExtension/scripts/manga_attention.py
```

現コードを継ぎ足しで修正する前に、ローカルForge Couple v4.0.2のAttention Couple実装とdiffを取る。

比較対象:

- `device`
- `dtype`
- clone位置
- `attn2_patch` signature
- `attn2_output_patch` signature
- `extra_options`
- `cond_or_uncond`
- `original_shape`
- mask downsample
- LCM token handling
- odd batch padding
- output reconstruction

## 11.1 特に禁止すること

「最新Forge Couple 7.xの方が新しい」という理由だけで全面コピーしない。

Local EasyForgeで動作確認済みのversionを第一基準とする。

GitHub最新7.xは差分・bugfixの参考資料としてのみ使う。

## 11.2 cloneは一度だけ

現在のManga側で:

```text
manga_prompter.py で clone
↓
manga_attention.py でも別方針
```

のような曖昧さをなくす。

ローカルForge Coupleが採用している位置に合わせる。

原則:

```text
original unet
↓
AttentionCouple.patch_unet がclone
↓
patch登録
↓
patched unetを forge_objects.unet へ代入
```

とする。

ただしローカルv4.0.2が別方式ならそちらを優先する。

---

# 12. Hookが本当にsampling中に呼ばれたことを証明する

単に:

```text
パッチ適用成功
```

とprintしてはいけない。

`set_model_attn2_patch()` を呼べたことと、sampling中にpatch callbackが実行されたことは別である。

以下のcounterを追加する。

```text
attn2_patch_calls
attn2_output_patch_calls
```

1生成ごとにリセット。

大量ログを出さない。

最初の1回だけshapeを記録する。

例:

```text
[MangaPrompter][ATTN2 FIRST CALL]
q=(...)
k=(...)
v=(...)
cond_or_uncond=[...]
original_shape=[...]
num_regions=2
```

生成終了時:

```text
[MangaPrompter][SUMMARY]
attn2_patch_calls=70
attn2_output_patch_calls=70
```

両方0ならconditioning strengthを議論してはいけない。

---

# 13. Diagnostic Sentinelを実装する

Hookの生存確認用に、通常UIには出さないdebug constantを追加する。

例:

```python
DIAGNOSTIC_OUTPUT_SCALE = 1.0
```

通常は必ず1.0。

一時テスト時だけ:

```python
DIAGNOSTIC_OUTPUT_SCALE = 0.0
```

とし、`attn2_output_patch` で正常shapeへ再構築した最終outputへ掛ける。

概念:

```python
result = torch.cat(outputs, dim=0)
return result * DIAGNOSTIC_OUTPUT_SCALE
```

### Sentinel Test

同一Seedで:

```text
A: Manga OFF
B: Manga ON, sentinel=0.0
```

BがAと実質同一なら、Manga Attention Hookはsampling pathへ効いていない、または後段で上書きされている。

この場合はRegion Promptコードを触らず、callback order / ModelPatcher assignmentを調査する。

Bが大きく変わればHookは生きている。

確認後は必ず1.0へ戻す。

コミット時に0.0を残してはならない。

---

# 14. Enable Checkboxの配線を明示的に検証する

各callbackの入口で、debug時のみgeneration ID付きで1行ログする。

```text
[MangaPrompter][G001] process enabled=True
[MangaPrompter][G001] after_extra_networks_activate enabled=True
[MangaPrompter][G001] process_before_every_sampling enabled=True
```

OFF時はregional patch counterが0であること。

ON/OFFの結果が同一である問題があるため、ここはP0検証事項である。

---

# 15. Conditioning生成はForge Coupleのlocal mapping実装へ合わせる

Manga側独自のtensor wrapperを増やさない。

ローカルForge Coupleの `text2cond` / mapping相当の実装を確認する。

SDXL / Illustriousでは概念上:

```python
texts = SdConditioning([resolved_region_text], False, width, height, None)
cond = sd_model.get_learned_conditioning(texts)
region_cond = [[cond["crossattn"]]]
```

だが、実装時はローカルForge Coupleの判定とwrapperをそのまま基準にする。

`get_learned_conditioning` の戻り値を想像でラップしない。

---

# 16. Negative Promptはglobalのまま

v3.7ではNegative PromptをBREAK分離しない。

WebUI本体のNegative Promptをそのまま通常経路へ流す。

地域Negative Promptは今後の追加候補であり、今回の原因切り分けへ持ち込まない。

---

# 17. v3.7での内部処理フロー

最終的に次の構造を目標とする。

```text
Main Positive Prompt
  │
  │ Forge / WebUI standard processing
  ▼
after_extra_networks_activate
  │
  ├─ chunk0 = GLOBAL
  ├─ chunk1 = Panel1
  ├─ chunk2 = Panel2
  └─ ...
  │
  ├─ Region1 text = GLOBAL + Panel1
  ├─ Region2 text = GLOBAL + Panel2
  └─ ...
  │
  ▼
process_before_every_sampling
  │
  ├─ MangaSpatialEngine masks
  ├─ region conditionings
  ├─ base_mask = ZERO
  └─ local-Forge-Couple-compatible AttentionCouple patch
  │
  ▼
Forge ModelPatcher UNet
  │
  ▼
Sampling
```

重要:

Main Positive Promptそのものは書き換えない。

通常の`k_target`にはMain Prompt全体のconditioningが存在していてもよい。

Attention Couple側でbase_maskを0にするため、positive region outputではそのbase branchを空間的に使用しない。

---

# 18. テスト条件を固定する

## 共通

```text
ControlNet: OFF
Hires Fix: OFF
ADetailer: OFF
Forge Couple: OFF（Oracleテスト時のみON）
Manga Prompter以外のregional extension: OFF
Batch size: 1
Batch count: 1
Seed: 固定
Sampler: 固定
Scheduler: 固定
CFG: 固定
Resolution: 1024x1024程度、またはモデルの通常解像度
```

最初のtestではLoRAを全部OFFにする。

これはLoRAを否定するためではなく、region conditioningの生存証明を先に行うためである。

---

# 19. TEST 0 — Forge Couple Oracle

Manga OFF。
Forge Couple ON。

左右50:50。

```text
Left: red sports car, parking garage
Right: blue ocean, sailboat
```

### PASS

左右で明確に内容差が出る。

### FAIL

差が出ない。

FAILならManga改修を停止し、local Forge Couple / EasyReforge互換性を先に調査する。

---

# 20. TEST 1 — Hook Sentinel

Manga ON。
2 region。
Sentinel 0.0。

同一SeedでManga OFFと比較。

### PASS

画像が大きく変わり、hook counter > 0。

### FAIL

ほぼ同じ / pixel identical / counter 0。

FAILならprompt解析やmaskを調整しない。

ModelPatcher assignment / callback lifecycleだけを調査する。

---

# 21. TEST 2 — 2 Region Prompt差

Sentinelを1.0に戻す。

Main Positive Prompt:

```text
high quality
BREAK
koma 1: red sports car, indoor parking garage
BREAK
koma 2: blue ocean, sailboat, horizon
```

レイアウト:

```text
┌────────┬────────┐
│ Panel1 │ Panel2 │
│        │        │
└────────┴────────┘
```

`manga page`, `2koma`, `comic panel` 等のレイアウト指示はまだGLOBALへ入れない。

### PASS

左と右に明らかな内容差が出る。

完全な境界固定は不要。

---

# 22. TEST 3 — Prompt Swap

TEST 2と同じSeed。

Panel promptだけ交換する。

```text
Panel1 = blue ocean
Panel2 = red sports car
```

### 強いPASS

左右の主題も交換される。

### 最低PASS

両領域に明確な変化があり、変更したPromptとの対応傾向が確認できる。

### FAIL

画像がTEST 2とpixel identical、またはほぼ変化しない。

---

# 23. TEST 4 — 片側のみ変更

TEST 2と同じ条件。

Panel1だけ:

```text
red sports car
```

から:

```text
giant green apple on a wooden table
```

へ変更。

Panel2は固定。

### PASS

Panel1側の変化がPanel2側より明確に大きい。

多少のリークは許容する。

---

# 24. TEST 5 — 現在の3コマ配置

ユーザーが現在使っている構造に近づける。

```text
┌─────────────────┐
│     Panel 1     │
│                 │
├────────┬────────┤
│Panel 2 │Panel 3 │
│        │        │
└────────┴────────┘
```

Prompt例:

```text
high quality, monochrome
BREAK
koma 1: close-up portrait of a woman
BREAK
koma 2: blue ocean, sailboat, horizon
BREAK
koma 3: red sports car, indoor parking garage
```

### PASS

- 上部でwoman傾向
- 左下でocean傾向
- 右下でcar傾向

が判別できる。

漫画として美しい必要はない。

---

# 25. TEST 6 — Manga Promptを戻す

TEST 5成功後に初めてGLOBALへ:

```text
3koma, monochrome, manga page, comic strip, comic panel
```

等を追加する。

### 目的

Model自身の「3koma layout」知識とManga Region conditioningが競合したときも、Panel内容対応が残るかを見る。

この段階でCanvasとmodel-native layoutの折衝を評価する。

---

# 26. TEST 7 — Global LoRA資産を戻す

Region PromptがLoRAなしで成功した後、実際のGLOBAL LoRA stackを最上段へ戻す。

例:

```text
quality tags, style tags,
<lora:A:0.2>, <lora:B:0.4>, ...
BREAK
koma 1: ...
BREAK
koma 2: ...
```

### 合格条件

LoRAを多数使用してもPanel Prompt変更に対する地域差が残る。

LoRAによって絵柄が強く変わること自体は問題ではない。

v3.7ではPanel個別LoRA分離は評価しない。

---

# 27. 画像の美しさを評価指標にしない

Diagnostic中は以下を失敗扱いしない。

- 人物が少し崩れる
- Panel境界を越えて髪色が漏れる
- 海の青が隣へ多少入る
- carが完全に矩形中央へ入らない
- 漫画コマとして美しくない

以下だけを重大失敗とする。

- Enable ON/OFFで全く変わらない
- Panel Prompt変更で全く変わらない
- hook counterが0
- maskがPrompt対応位置と一致しない
- Panel1変更がPanel2だけへ現れる等、mappingが誤っている

---

# 28. Debug Log仕様

1生成につき以下を出す。

```text
[MangaPrompter][Gxxx]
enabled=True
panel_count=3
prompt_chunk_count=4
GLOBAL=<first 100 chars>

region[1]
  panel_id=...
  rect=...
  weight=1.0
  mask_coverage=...
  prompt=<first 120 chars>

...

coverage_min=...
coverage_max=...
uncovered_pixels=...
overlap_pixels=...

unet_before_id=...
unet_patched_id=...
unet_assigned_id=...

attn2_patch_calls=...
attn2_output_patch_calls=...
```

注意:

Attention blockごとに全文Promptをprintしない。

ログ量で処理を壊さない。

---

# 29. `BOOK1`型の結果報告を残す

今回の実装後、以下を作る。

```text
EasyReforgeExtension/docs/V37_DIAGNOSTIC_RESULT.md
```

形式:

```markdown
# v3.7 Diagnostic Result

## Environment
EasyReforge / 内包reForge version:
Forge Couple local version:
Forge Couple path:
Model:

## Local Forge Couple Oracle
PASS / FAIL
Notes:

## Hook Sentinel
PASS / FAIL
attn2_patch_calls:
attn2_output_patch_calls:

## 2 Region Test
PASS / FAIL

## Prompt Swap Test
PASS / FAIL

## One-side-change Test
PASS / FAIL

## 3 Panel Test
PASS / FAIL

## Global LoRA Restore Test
PASS / FAIL / NOT RUN

## Files changed
...

## Differences from local Forge Couple
...

## Remaining problems
...

## Recommendation for v3.8
Do not implement v3.8 here. Only recommend next investigations.
```

---

# 30. 実装コミットを分ける

可能なら以下の粒度で分ける。

```text
1. diagnostic: add local Forge Couple reference notes
2. diagnostic: add callback and hook counters
3. fix: stop mutating p.prompt
4. fix: resolve prompts after extra-network activation
5. fix: common-prefix region conditioning + zero base mask
6. fix: use MangaSpatialEngine as mask source
7. fix: align attention hook with local Forge Couple
8. test: add v3.7 result documentation
```

一度に全部書き換えて、どこで直ったか分からない状態を作らない。

各主要段階で同一SeedのA/B画像を保存してよい。

---

# 31. 成功した瞬間に機能追加しない

たとえば手順5の時点で:

```text
Panel1 prompt change → Panel1の絵が変わる
Panel2 → 別内容が出る
```

ことが確認できた場合、そこで一度コミットする。

「ついでにControlNetも直す」「ついでにregional LoRAも入れる」は禁止。

過去に「少し成功した後、詰めるうちに効かなくなった」という経緯があるため、**最小成功状態を必ず保存する。**

タグ例:

```text
manga-region-v3.7-first-working
```

---

# 32. ControlNet共存確認はRegional単体PASS後

v3.7.1のRegional単体テストがPASSしてからControlNet共存テストへ進む。

ControlNet自体は現在のEasyReforgeで正常利用できている既知良好系として扱う。ここで確認するのはControlNetの修理ではなく、**Manga Region Prompterを追加した時だけ相互作用が発生するか**である。

順序:

```text
Regional Prompt only
↓
固定Seedで成功
↓
Global LoRA restore
↓
成功
↓
ControlNet 1 unitだけ追加
↓
成功
↓
複数Control / その他extension
```

ControlNet追加後にregion effectが消えた場合、初めてcallback ordering / UNet clone chain / ControlNet ModelPatcherとの競合を調査する。

それ以前にControlNetコードを改修しない。

---

# 33. 比較対象から採用する設計原則

## Forge Couple

採用:

- Forge ModelPatcher native Attention Hook
- local環境で動くcallback lifecycle
- local環境で動くdtype/device処理
- mask coverage validation
- base mask zeroのAdvanced型region処理

## Regional Prompter

採用:

- GLOBAL/common promptを各Region promptへ付加する考え方
- Region promptをBREAKでMain Positive Prompt内に保持する考え方

採用しない:

- 現時点でLatent Modeへ移行
- LoRA地域分離を主目的化

## ComfyUI Attention Couple / Prompt Control

参考のみ:

- Attention Coupleは厳密な物理切り抜きではない
- 少量のregion leakageはあり得る

今回の目標は完全分離ではなく、**「指定位置とPromptの対応が生成結果へ明確に現れる」**ことである。

---

# 34. Antigravityへの最終実行指示

以下をそのまま実行指示として扱うこと。

---

EasyReforge Manga Prompter v3.7 Diagnostic Resetを実装してください。

今回の目的は漫画品質改善ではありません。

最重要目標は:

**ControlNet OFF / LoRA OFF / fixed seed の状態で、2つの矩形Regionへ大きく異なるPositive Promptを割り当てたとき、各Regionに対応した内容差が生成画像へ明確に出ること**

です。

まずローカルEasyReforge内にあるForge Couple v4.0.2の実装を調査してください。

GitHub最新版を第一基準にしないでください。

現在の環境でForge Couple自身が地域効果を出せることをOracle Testで確認してください。

次にManga PrompterへDiagnostic counterとsentinelを追加し、`attn2_patch` / `attn2_output_patch` がsampling中に本当に呼ばれていることを証明してください。

`p.prompt` をGLOBAL chunkへ書き換える現行方式は廃止してください。

PromptはForge Coupleと同じ適切なlifecycle、原則 `after_extra_networks_activate` で解決してください。

Main Positive Promptは唯一のPrompt Source of Truthです。

右側のPanel Prompt表示を独立入力へ変更しないでください。

Prompt grammarは:

```text
GLOBAL
BREAK
koma 1: ...
BREAK
koma 2: ...
...
```

とし、GLOBALは各region conditioningへcommon prefixとして加えてください。

Attention Coupleへ渡すbase_maskはv3.7では0固定としてください。

`Base Style Weight` はDiagnostic中は使用しないでください。

Maskは `MangaSpatialEngine.generate_spatial_masks()` を唯一のbackend mask sourceとして利用してください。

未カバーpixelを `+1e-4` で埋める処理はやめ、Diagnosticではfail-closedにしてください。

Attention Hook本体はローカルForge Couple実装とのdiffを確認し、local versionと同じModelPatcher API / dtype / extra_options / clone policyに合わせてください。

ControlNet、Hires、regional LoRA、Negative region、UI再設計は実装しないでください。

実装後はこの文書のTEST 0〜TEST 7を順番に実施してください。

特にTEST 2〜4をPASSした時点で一度必ずworking commitを保存してください。

最後に:

```text
EasyReforgeExtension/docs/V37_DIAGNOSTIC_RESULT.md
```

へ結果を記録してください。

v3.8機能は実装せず、次に調べるべき内容だけをRecommendationとして記載してください。

---

# 35. 参考ソース

EasyReforge Manga Prompter:

- https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/scripts/manga_prompter.py
- https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/scripts/manga_attention.py
- https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/scripts/manga_spatial_engine.py

Forge Couple current upstream（local v4.0.2との差分参考用）:

- https://github.com/Haoming02/sd-forge-couple
- https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/scripts/forge_couple.py
- https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/lib_couple/attention_couple.py
- https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/lib_couple/mapping.py

Regional Prompter:

- https://github.com/hako-mikan/sd-webui-regional-prompter

