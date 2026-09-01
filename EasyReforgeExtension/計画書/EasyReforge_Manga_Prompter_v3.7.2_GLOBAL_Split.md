# EasyReforge Manga Prompter
## v3.7.2 改修指示書 — GLOBAL分離版

作成日: 2026-09-02  
対象環境: Zuntan03/EasyReforge 内 `stable-diffusion-webui-reForge`  
対象拡張: EasyReforge Manga Prompter / Manga Region Prompter  
前提版: v3.7.1 Diagnostic Reset  
実装担当想定: Gemini Antigravity / コーディングエージェント

---

# 0. この版の目的

v3.7.2 は新機能追加版ではない。

現在の v3.7.1 では、Forge ModelPatcher ネイティブの Attention Hook、`after_extra_networks_activate()`、`process_before_every_sampling()`、`set_model_attn2_patch()`、`set_model_attn2_output_patch()` まで整理された。

しかし実生成では、

- コマ1・コマ2の内容が弱い
- `sky, ocean` 等が別コマへ漏れる
- コマ3へ複数内容が集まりやすい
- 指定矩形より `3koma` 等の学習済みページ構図へ引っ張られる

という問題が残る。

v3.7.2 ではこのうち **プロンプトの役割混線** だけを切り分ける。

主変更は2つ。

1. `PAGE STRUCTURE` と `GLOBAL STYLE / QUALITY` を分離する。
2. WebUI本体が計算する main conditioning から各Region本文を除去する。

---

# 1. 合格条件

ControlNet OFF、LoRA OFF、固定Seed、Batch Size 1で、左右2領域を作る。

```text
左: huge bright red sports car
右: blue ocean, open sea, horizon
```

生成後、

```text
左 → 主に車
右 → 主に海
```

となること。

さらに同一SeedでPromptだけ交換し、

```text
左 → 主に海
右 → 主に車
```

へ入れ替わること。

厳密なピクセル固定は要求しない。意味内容の中心が対応Regionへ移動すればよい。

この試験を通るまでは ControlNet相性修正、個別LoRA、UI大改造、別Regional方式へ進まない。

---

# 2. 現在のv3.7.1で維持するもの

以下は方向として正しいので残す。

- `after_extra_networks_activate()` で解決済みPromptを取得
- `p.prompt` を直接書き換えない
- `base_mask = 0`
- `MangaSpatialEngine.generate_spatial_masks()` を使用
- `DIAGNOSTIC_OUTPUT_SCALE`
- `attn2_patch_calls`
- `attn2_output_patch_calls`
- `MASK STATS`
- `ATTN2 FIRST CALL`

`manga_attention.py` のアルゴリズム本体と `manga_spatial_engine.py` は、v3.7.2では原則変更しない。

---

# 3. 現在の問題A — GLOBAL全文をRegionへprefixしている

現行コードは概ね次の処理を行う。

```python
global_text = raw_chunks[0]
merged_text = f"{global_text}, {clean_c}" if global_text else clean_c
```

そのため、入力が、

```text
3koma, monochrome, manga page, comic strip, comic panel
BREAK
koma 1: close up, 1girl, standing
BREAK
koma 2: wide shot, sky, ocean
BREAK
koma 3: medium shot, 1boy, sitting
```

なら、各Regionへ、

```text
3koma, monochrome, manga page, comic strip, comic panel, ...
```

が毎回入る。

`3koma`、`manga page`、`comic strip` は「この領域の中に何を描くか」ではなく「画像全体をどう構成するか」という命令である。

プロジェクト内の知見書にも、`3koma` を全コマへCommon Prependした時に1枚絵へ崩壊した実験記録がある。

したがって v3.7.2 では PAGE と STYLE を分ける。

---

# 4. 現在の問題B — main conditioningにRegion本文が残っている

v3.7.1 は `kwargs["prompts"][0]` を読み、Region conditioningを独自生成するが、読み取った後の `kwargs["prompts"]` 自体は変更していない。

そのため、conditioning計算直前まで、

```text
GLOBAL
BREAK
Region 1
BREAK
Region 2
BREAK
Region 3
```

という全文が main prompt に残る。

Attention Couple側で base branch を0にしても、SDXL / Illustrious の conditioning を「cross-attention branchだけ」の問題として扱うのは危険である。

Forge / reForge の `after_extra_networks_activate` は **Extra Networks activation後・conditioning計算前** に呼ばれ、`kwargs["prompts"]` の内容を変更できる。

v3.7.2ではここで main prompt を Global専用へ縮小する。

---

# 5. 新しいPrompt構造

3コマなら Positive Prompt を次の **5 chunk** とする。

```text
PAGE STRUCTURE
BREAK
GLOBAL STYLE / QUALITY
BREAK
koma 1: REGION PROMPT 1
BREAK
koma 2: REGION PROMPT 2
BREAK
koma 3: REGION PROMPT 3
```

例:

```text
3koma, manga page, comic strip, comic panel
BREAK
masterpiece, best quality, monochrome, manga ink, clean lineart
BREAK
koma 1: close-up, 1girl, standing
BREAK
koma 2: wide shot, sky, ocean
BREAK
koma 3: medium shot, 1boy, sitting
```

独自の `PAGE:` や `STYLE:` トークンは追加しない。

役割は **chunk位置** で決める。

```text
chunk 0 = PAGE
chunk 1 = STYLE
chunk 2... = Regions
```

---

# 6. Global LoRA

Global LoRAは第2chunkのSTYLE側へ置くことを推奨する。

```text
3koma, manga page, comic strip
BREAK
<lora:AAA:0.15>, <lora:BBB:0.3>, masterpiece, best quality, monochrome
BREAK
koma 1: ...
BREAK
koma 2: ...
BREAK
koma 3: ...
```

`after_extra_networks_activate()` はExtra Networks activation後なので、この時点でGlobal LoRAはactivation済みである。

Region個別LoRAはv3.7.2の正式対象外。

---

# 7. 内部conditioningの完成形

ユーザー入力:

```text
PAGE
BREAK
STYLE
BREAK
R1
BREAK
R2
BREAK
R3
```

内部では、

```text
WebUI main conditioning = PAGE + STYLE
```

Region側は、

```text
Region 1 = STYLE + R1
Region 2 = STYLE + R2
Region 3 = STYLE + R3
```

とする。

**PAGEをRegionへprefixしない。**

---

# 8. `manga_prompter.py` 改修

主変更対象:

```text
EasyReforgeExtension/scripts/manga_prompter.py
```

中心は `after_extra_networks_activate()`。

現在のN+1 chunk期待を、N+2へ変更する。

```python
raw_chunks = [
    c.strip()
    for c in re.split(r'\bBREAK\b', resolved_prompt_str, flags=re.IGNORECASE)
]

expected_chunks = num_panels + 2
```

診断版なので旧v3.7.1形式を自動fallbackしない。

数が違う場合はRegional patchを適用せず明示エラー。

```text
[MangaPrompter][ERROR]
v3.7.2 prompt format mismatch.
Expected PAGE + STYLE + 3 regions = 5 chunks.
```

---

# 9. parse結果

```python
page_text = raw_chunks[0].strip()
style_text = raw_chunks[1].strip()
region_chunks = raw_chunks[2:]
```

既存のRegion tag regexは維持してよい。

```python
clean_region = tag_regex.sub('', raw_region).strip()
```

---

# 10. Region conditioning生成

現行の、

```python
merged_text = f"{global_text}, {clean_c}"
```

は禁止。

v3.7.2:

```python
if style_text and clean_region:
    resolved_region_text = f"{style_text}, {clean_region}"
elif style_text:
    resolved_region_text = style_text
else:
    resolved_region_text = clean_region
```

ここへ `page_text` を入れない。

---

# 11. main conditioningからRegion本文を除去

ここがv3.7.2の中核。

```python
main_conditioning_prompt = ", ".join(
    x for x in (page_text, style_text) if x
)
```

`kwargs["prompts"]` を取得する。

診断中はBatch Size 1のみ正式対象でよい。

```python
prompts = kwargs.get("prompts")

if not isinstance(prompts, list) or len(prompts) != 1:
    print(
        "[MangaPrompter][ERROR] "
        "v3.7.2 diagnostic mode requires Batch Size = 1."
    )
    return
```

そして、

```python
self.original_resolved_prompt = prompts[0]
prompts[0] = main_conditioning_prompt
```

とする。

**`p.prompt = main_conditioning_prompt` とはしないこと。**

ユーザーのメインPositive PromptをSingle Source of Truthとして残す。

---

# 12. 参考実装

以下は設計参考。ローカルEasyReforge APIを優先する。

```python
def after_extra_networks_activate(
    self, p, is_enabled, base_weight, json_bridge, *args, **kwargs
):
    self.valid = False
    self.resolved_prompts = []
    self.sorted_panels = []
    self.original_resolved_prompt = None

    if not is_enabled:
        return

    panels = MangaSpatialEngine.parse_panels_json(json_bridge)
    if not panels or len(panels) <= 1:
        return

    self.sorted_panels = sorted(panels, key=lambda x: x.get("index", 0))
    num_panels = len(self.sorted_panels)

    prompts = kwargs.get("prompts")
    if not isinstance(prompts, list) or len(prompts) != 1:
        print("[MangaPrompter][ERROR] Batch Size 1 required for v3.7.2 diagnostic.")
        return

    resolved_full_prompt = prompts[0]

    raw_chunks = [
        c.strip()
        for c in re.split(r"\bBREAK\b", resolved_full_prompt, flags=re.IGNORECASE)
    ]

    expected_chunks = num_panels + 2
    if len(raw_chunks) != expected_chunks:
        print(
            f"[MangaPrompter][ERROR] Expected {expected_chunks} chunks "
            f"(PAGE + STYLE + {num_panels} regions), got {len(raw_chunks)}."
        )
        return

    page_text = raw_chunks[0]
    style_text = raw_chunks[1]
    region_chunks = raw_chunks[2:]

    self.original_resolved_prompt = resolved_full_prompt
    self.page_text = page_text
    self.style_text = style_text

    main_conditioning_prompt = ", ".join(
        x for x in (page_text, style_text) if x
    )

    # conditioning計算前のbatch promptだけ縮小する
    prompts[0] = main_conditioning_prompt

    tag_regex = re.compile(
        r'^(\[?(コマ|koma|panel|p)\s*(\d+)\]?|'
        r'(\d+)\s*(コマ|koma|panel|p))\s*:?\s*',
        re.IGNORECASE
    )

    print("[MangaPrompter][GLOBAL SPLIT]")
    print(f"  PAGE  = {page_text!r}")
    print(f"  STYLE = {style_text!r}")
    print(f"  MAIN CONDITIONING = {main_conditioning_prompt!r}")

    for i, panel in enumerate(self.sorted_panels):
        raw_region = region_chunks[i]
        clean_region = tag_regex.sub("", raw_region).strip()

        if style_text and clean_region:
            resolved_region = f"{style_text}, {clean_region}"
        elif style_text:
            resolved_region = style_text
        else:
            resolved_region = clean_region

        self.resolved_prompts.append({
            "panel_index": i + 1,
            "clean_text": clean_region,
            "resolved_text": resolved_region,
            "weight": float(panel.get("weight", 1.0)),
        })

        print(
            f"  REGION {i + 1}: "
            f"rect={panel.get('rect', {})}, "
            f"weight={panel.get('weight', 1.0)}, "
            f"prompt={resolved_region!r}"
        )

    self.valid = True
```

---

# 13. `process_before_every_sampling()`

極力変更しない。

現在の `SdConditioning` → `get_learned_conditioning()` → `cond["crossattn"]` の流れを維持する。

`base_mask = empty_tensor(...)` も維持。

v3.7.2でPrompt EncoderやAttention Couple本体を作り直さない。

---

# 14. Base Style Weight UI

現状の `Base Style Weight` はv3.7.2では使用しない。

推奨:

- value = 0.0
- interactive = False
- ラベルに「v3.7.2では未使用」を追記

全画面base branchへweightを復活させない。

---

# 15. `manga_canvas.js` のPrompt parser更新

対象:

```text
EasyReforgeExtension/javascript/manga_canvas.js
```

現在:

```javascript
parsedPrompt: {
    base: '',
    regions: {}
}
```

変更:

```javascript
parsedPrompt: {
    page: '',
    style: '',
    regions: {}
}
```

`parseMainPrompt()` は、

```javascript
const page = chunks.length > 0 ? chunks[0] : '';
const style = chunks.length > 1 ? chunks[1] : '';

const regions = {};

for (let i = 2; i < chunks.length; i++) {
    const chunk = chunks[i];
    let pNum = i - 1;
    ...
}

state.parsedPrompt = { page, style, regions };
```

とする。

---

# 16. 右サイドバー表示

現在の、

```text
🌐 [全体/ベース - 1行目]
```

を2つに分ける。

```text
🧭 [ページ構造 - 第1chunk]
3koma, manga page, comic strip

🎨 [全体画風・品質 - 第2chunk]
masterpiece, best quality, monochrome, manga ink
```

その下にコマ1、コマ2、コマ3を表示。

この右欄は引き続き情報パネルであり、編集の真実は本体Positive Prompt欄。

---

# 17. 「テンプレ枠を挿入」更新

新規テンプレートはN+2構造にする。

```text
manga page, comic strip
BREAK
masterpiece, best quality, monochrome, manga ink, clean lineart
BREAK
koma 1:
BREAK
koma 2:
BREAK
koma 3:
```

既存Promptがすでにv3.7.2形式なら、第1・第2chunkを可能な限り保持し、Region枠だけ現在コマ数へ再生成する。

旧v3.7.1形式を暗黙変換しない。

---

# 18. 変更してはいけないもの

原則変更禁止:

```text
manga_attention.py のAttentionアルゴリズム本体
manga_spatial_engine.py のマスク構造
ControlNet extension
EasyReforge core
stable-diffusion-webui-reForge core
Forge Couple
Negative Prompt処理
Sampler / CFG
LoRA Block Weight
```

GLOBAL分離テストの途中で「ついでの改善」を入れない。

---

# 19. EasyReforge更新禁止

v3.7.2検証中は、

```text
Update.bat
ReforgeSwitchDev.bat
reForge git pull
Forge Couple update
ControlNet update
PyTorch update
```

を行わない。

現在の安定環境を固定して比較する。

---

# 20. 作業開始前のcheckpoint

最低限:

```bash
git status --short
git rev-parse HEAD
```

を記録。

可能ならv3.7.1状態をcommit/tag等で保存する。

---

# 21. 診断ログ

最低限、生成前に以下を出す。

```text
[MangaPrompter][GLOBAL SPLIT]
PAGE=...
STYLE=...
MAIN CONDITIONING=...

REGION 1
rect=...
weight=...
prompt=...

REGION 2
...
```

生成後:

```text
attn2_patch_calls=...
attn2_output_patch_calls=...
```

も維持する。

---

# 22. TEST 0 — Hook生存確認

ControlNet OFF、LoRA OFF、Hires OFF、ADetailer OFF、Dynamic Prompts OFF、Batch Size 1、固定Seed。

一時的に、

```python
DIAGNOSTIC_OUTPUT_SCALE = 0.0
```

で1回だけ生成。

Manga ON時に出力が明確に壊れればHookがsamplingへ届いている証拠。

確認後は必ず1.0へ戻す。

---

# 23. TEST 1 — 2領域意味分離

Canvas:

```text
┌───────────┬───────────┐
│ Region 1  │ Region 2  │
└───────────┴───────────┘
```

Prompt:

```text
two-panel composition
BREAK
high quality, clean illustration
BREAK
koma 1: huge bright red sports car, side view
BREAK
koma 2: blue ocean, open sea, horizon, no car
```

最初はmonochromeを使わない。差を視覚的に最大化する。

PASS:

```text
左 → 主に車
右 → 主に海
```

---

# 24. TEST 2 — Swap Test

Seedその他を完全固定し、Region promptだけ交換。

```text
two-panel composition
BREAK
high quality, clean illustration
BREAK
koma 1: blue ocean, open sea, horizon, no car
BREAK
koma 2: huge bright red sports car, side view
```

PASS:

```text
左 → 主に海
右 → 主に車
```

**このテストがv3.7.2の最重要判定。**

---

# 25. TEST 3 — 片側だけ変更

Region 1だけ、

```text
giant green apple, single object
```

へ変更。

Region 2は海のまま。

PASS:

```text
R1: 車 → リンゴへ明確に変化
R2: 海を維持
```

---

# 26. TEST 4 — 3コマ意味分離

現在の「上1・下2」を使う。

```text
3-panel comic page
BREAK
high quality, clean illustration
BREAK
koma 1: giant green apple, close-up, single object
BREAK
koma 2: empty ocean and blue sky, no person
BREAK
koma 3: 1boy, sitting on chair, medium shot
```

PASS目安:

```text
上 → 主にリンゴ
下の一方 → 主に海
下の他方 → 主に座った少年
```

多少の背景漏れは許容。

全部が3コマ目へ集まるならFAIL。

---

# 27. TEST 5 — Manga Styleを戻す

TEST 4がPASSした後、STYLEを、

```text
masterpiece, best quality, monochrome, manga ink, clean lineart, screentone
```

へ変更。

PAGEを、

```text
3koma, manga page, comic strip, comic panel
```

へ変更。

ログ上のRegion promptに、

```text
3koma
manga page
comic strip
```

が入っていないことを確認。

---

# 28. TEST 6 — Global LoRAを戻す

ここまでPASS後にGlobal LoRAをSTYLE chunkへ戻す。

最初は少数、その後通常の約20 LoRA stackへ戻す。

確認点:

```text
LoRAを戻してもRegion対応が消えない
```

個別Region LoRAはまだ試験しない。

---

# 29. TEST 7 — ControlNet既知良好系を戻す

Regional単体PASS後のみ実施。

まず、

```text
Manga OFF + ControlNet ON
```

で既知良好のレイアウト制御を確認。

次に、ControlNet設定を一切変えず、

```text
Manga ON + ControlNet ON
```

へ変更。

評価:

- Region意味分離が維持されるか
- ControlNetのコマ枠制御が維持されるか

ここで相性問題が出ても、v3.7.2中にControlNetコードを改修しない。

結果を記録し、必要ならv3.7.3の別課題とする。

---

# 30. 手動評価スコア

各Region:

```text
0 = 指定内容が見えない / 明確に別Region
1 = 少し影響はあるが混ざりが強い
2 = 主内容としてそのRegionに存在
3 = 明確にそのRegionの内容として成立
```

2領域:

```text
各Region >= 2
合計 >= 5/6
```

をPASS目安。

3領域:

```text
各Region >= 2
合計 >= 7/9
```

をPASS目安。

---

# 31. Forge Couple Oracle

必要なら同じEasyReforge内のローカル Forge Couple v4.0.2 を比較対象にする。

**更新しない。**

同一Checkpoint / Seed / Sampler / Steps / CFG / Resolutionで `car / ocean` をAdvanced Mode等で試す。

Forge Coupleが明確に分離し、Manga Prompterが分離しないなら、モデル限界ではなくManga Prompter実装差と判断する。

---

# 32. v3.7.2で失敗した場合の調査順

GLOBAL分離後もFAILなら、次の順。

```text
1. PAGE / STYLE / REGIONログは正しいか
2. Region index と rect が一致しているか
3. MASK STATS coverage min/max は正常か
4. attn2_patch_calls / output_calls は発生しているか
5. local Forge Couple同条件は効くか
6. local Forge Couple attention実装との差分を比較
```

この順を飛ばさない。

---

# 33. 変更対象ファイル

原則:

```text
EasyReforgeExtension/scripts/manga_prompter.py
EasyReforgeExtension/javascript/manga_canvas.js
必要なら EasyReforgeExtension/style.css
EasyReforgeExtension/docs/V372_GLOBAL_SPLIT_RESULT.md
```

原則変更禁止:

```text
EasyReforgeExtension/scripts/manga_attention.py
EasyReforgeExtension/scripts/manga_spatial_engine.py
EasyReforge core
stable-diffusion-webui-reForge core
ControlNet extension
Forge Couple extension
```

---

# 34. 完了レポート

以下を作成。

```text
EasyReforgeExtension/docs/V372_GLOBAL_SPLIT_RESULT.md
```

最低限記録:

```markdown
# v3.7.2 GLOBAL Split Result

## Environment
EasyReforge commit:
reForge commit:
Forge Couple local version:
Checkpoint:
Resolution:
Sampler:
Steps:
CFG:

## Files Changed
- ...

## Prompt Parser
PAGE:
STYLE:
Region count:

## Main Conditioning Rewrite
Original resolved prompt:
Rewritten main conditioning prompt:

## Region Conditioning
Region 1: rect / weight / prompt
Region 2: rect / weight / prompt
Region 3: rect / weight / prompt

## Hook Diagnostic
attn2_patch_calls:
attn2_output_patch_calls:
coverage min/max:
sentinel: PASS/FAIL

## Test Results
TEST 1 Car/Ocean:
TEST 2 Swap:
TEST 3 Single Change:
TEST 4 Three Regions:
TEST 5 Manga Style:
TEST 6 Global LoRA:
TEST 7 ControlNet:

## Remaining Problems
...
```

---

# 35. 成功した瞬間にcheckpoint保存

Swap TestがPASSした時点で、追加改良前に必ず保存する。

例:

```bash
git add EasyReforgeExtension
git commit -m "working: v3.7.2 regional prompt swap passes"
```

同等のバックアップでもよい。

---

# 36. Antigravityへの実行指示

以下をそのまま作業依頼として使用できる。

```text
EasyReforge Manga Prompter v3.7.2 GLOBAL分離版を実装してください。

今回の目的は新機能追加ではありません。

現在のv3.7.1で残っているRegion Prompt混線を減らし、
「任意Regionに指定したPromptの意味内容が、そのRegionへ明確に出る」
状態を成立させることが目的です。

変更は主に2点です。

1. PAGE STRUCTURE と GLOBAL STYLE / QUALITY を別chunkにしてください。
各RegionへprefixするのはSTYLEだけです。
PAGEをRegion conditioningへ入れないでください。

2. after_extra_networks_activate() 内で、Extra Networks activation後・conditioning計算前の kwargs["prompts"] を利用し、WebUI本体のmain conditioningからRegion本文を除去してください。

入力:
PAGE BREAK STYLE BREAK R1 BREAK R2 ...

main conditioning:
PAGE + STYLE

Region conditioning:
STYLE + R1
STYLE + R2
...

p.prompt自体は直接書き換えないでください。

v3.7.2ではBatch Size 1のみ正式対象で構いません。

現在のAttention Hook、MangaSpatialEngine、ControlNet、EasyReforge coreは変更しないでください。

FrontendのPrompt Previewも PAGE / STYLE / Region 1... の表示へ更新し、テンプレ挿入もN+2 chunk形式へ更新してください。

旧v3.7.1形式は暗黙fallbackせずformat errorを出してください。

実装後は必ず ControlNet OFF / LoRA OFF / 固定Seed / Batch Size 1 で car / ocean の2領域テストとSwap Testを行ってください。

Swap TestがPASSするまではControlNet相性修正へ進まないでください。

PASSした瞬間にworking checkpointを保存してください。

最後に EasyReforgeExtension/docs/V372_GLOBAL_SPLIT_RESULT.md へ結果を記録してください。
```

---

# 37. 参考ソース

実装時はローカルEasyReforgeコードを最優先。

公開参考:

```text
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/scripts/manga_prompter.py
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/scripts/manga_attention.py
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/scripts/manga_spatial_engine.py
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/javascript/manga_canvas.js

https://github.com/Haoming02/sd-forge-couple
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/scripts/forge_couple.py
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/lib_couple/mapping.py
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/lib_couple/attention_couple.py
```

Forge / reForge の `after_extra_networks_activate()` は Extra Networks activation後・conditioning計算前に呼ばれ、`kwargs["prompts"]` の変更が可能である。ローカル `modules/scripts.py` を実装時に再確認すること。

---

# 38. 最終判断

v3.7.2で確認するのは、

```text
Promptを置いた場所
        ↓
その場所へ意味内容が移る
```

という一点である。

これが成立すれば、EasyReforge上の漫画用Regional Promptを継続して詰める価値がある。

成立しなければ、その時点で初めて、local Forge Coupleとの差分、Attention Couple自体の限界、別Regional方式を次の検討対象とする。

v3.7.2ではそこまで進まない。
