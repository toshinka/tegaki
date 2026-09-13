# EasyReforge Manga Prompter
# v3.7.3 改修指示書 — Global Effect / Base Branch 復活・段階Oracle版

作成日: 2026-09-02  
対象環境: **Zuntan03/EasyReforge** 内 `stable-diffusion-webui-reForge`  
対象拡張: `EasyReforge Manga Prompter / Manga Region Prompter`  
前提版: **v3.7.2 GLOBAL Split**  
実装担当想定: Gemini Antigravity / ローカルコーディングエージェント  
作業の性格: **診断・修正・検証を一体化した実装指示書**

---

## 0. 最重要方針

v3.7.3では、v3.7.2で起きた以下の状態を修正する。

```text
Manga OFF
→ モデル本来の3コマ構成が出る

Manga ON
→ 3コマ構成が消え、1枚絵の足元等へ大きく変わる
```

これは、

```text
Manga Region Prompter が無効
```

なのではなく、

```text
Attention Hook は強く作用しているが、
PAGE / Global conditioning の扱いが不適切
```

である可能性が高い。

v3.7.3の目的は、

```text
PAGE / 全体構造
        +
STYLE / 全体画風・品質
        +
各Region固有Prompt
```

を役割分担させつつ、

```text
「Promptを置いたRegionへ意味内容が移る」
```

状態を成立させることである。

---

## 1. v3.7.2で確認できたこと

v3.7.2では少なくとも以下が実装された。

```text
PAGE / STYLE / REGION のN+2 chunk化
Main conditioningからRegion本文を除去
PAGEをRegion prefixから除去
STYLEだけをRegionへprefix
base_mask = 0
```

ただし、**主要Acceptance Testを通過した証拠はない。**

今後は必ず、

```text
実装した
```

と

```text
実生成で機能した
```

を分けて報告すること。

指定テストを実行してPASSしない限り、

```text
COMPLETED
SUCCESS
完全対応
完全防止
根本解決
100%
```

などと報告してはならない。

---

## 2. 実装前に必ず読むコード

### Manga Prompter

```text
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/scripts/manga_prompter.py
```

必ず確認する関数:

```python
after_extra_networks_activate()
process_before_every_sampling()
```

現行v3.7.2では概ね、

```python
main_conditioning_prompt = ", ".join(
    x for x in (page_text, style_text) if x
)
prompts[0] = main_conditioning_prompt
```

としている。

また、sampling直前では、

```python
base_mask = empty_tensor(p.height, p.width)
```

となっている。

### Manga Attention

```text
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/scripts/manga_attention.py
```

必ず理解する不変条件:

```text
k_target ↔ base_mask
cond_1   ↔ mask_1
cond_2   ↔ mask_2
cond_3   ↔ mask_3
...
```

この対応関係を曖昧にしたまま改修してはならない。

### Canvas / Prompt Template

```text
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/javascript/manga_canvas.js
```

必ず確認する関数:

```javascript
parseMainPrompt
mangaPrompterInsertTemplateToMainPrompt
```

現行ではテンプレート初期値として概ね、

```text
${numPanels}koma, manga page, comic strip, comic panel
BREAK
masterpiece, best quality, monochrome, manga ink, clean lineart
```

が使われている。

v3.7.3ではこれを変更する。

---

## 3. Golden ReferenceとしてForge Coupleを読む

GitHub最新版を盲目的にコピーするのではなく、**現在のEasyReforge内にあるForge Couple v4.0.2を第一Golden Reference**とする。

公開版も補助資料として読む。

### Main

```text
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/scripts/forge_couple.py
```

### Mapping

```text
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/lib_couple/mapping.py
```

特に、

```python
basic_mapping()
mask_mapping()
advanced_mapping()
```

を確認する。

公開Forge CoupleではGlobal Effect相当のbackground行に対して、全画面maskを概ね、

```python
torch.ones((height, width)) * bg_weight
```

で与えている。

これは、

```text
Global Effect = 全画面へ弱く作用する独立conditioning
```

という設計である。

---

## 4. v3.7.2の設計矛盾

v3.7.2では、

```text
Main conditioning = PAGE + STYLE
```

を作った。

一方で、

```python
base_mask = 0
```

としている。

Manga Attention側では、

```text
base branch = k_target
base mask   = base_mask
```

であるため、概念上は、

```text
PAGE + STYLE
↓
k_target
↓
base_mask = 0
↓
Attention Coupleのpositive合成では寄与0
```

になり得る。

これは今回の、

```text
Manga ON
→ 3コマ構造が消える
```

現象と整合する。

---

## 5. v3.7.3の第一案: Global Effect branchを追加する

単純に、

```python
base_mask = ones * 0.3
```

へ戻すだけを第一案にしてはいけない。

Forge CoupleのGlobal Effectに近い形で、**PAGE + STYLE用の独立conditioningを1本追加する。**

初期設計:

```text
base_mask = 0

cond_1 = GLOBAL EFFECT
mask_1 = 全画面 * global_weight

cond_2 = Region 1
mask_2 = Region 1 mask * region_weight

cond_3 = Region 2
mask_3 = Region 2 mask * region_weight

cond_4 = Region 3
mask_4 = Region 3 mask * region_weight
...
```

つまり、

```text
k_target
↓
base_mask = 0
↓
補助positive branchとしては使わない

PAGE + STYLE
↓
独立Global Effect conditioning
↓
全画面mask

STYLE + Region 1
↓
Region 1 mask

STYLE + Region 2
↓
Region 2 mask
```

とする。

---

## 6. Global Effectへ入れる内容

v3.7.3初期案:

```text
GLOBAL EFFECT = PAGE + STYLE
```

各Region:

```text
Region N = STYLE + Region Prompt N
```

役割:

```text
PAGE
→ Global Effectだけ

STYLE
→ Global Effectにも各Regionにも入る

Region固有本文
→ 対応Regionだけ
```

図:

```text
PAGE ─────────────┐
                  ▼
STYLE ───────> GLOBAL EFFECT ─── 全画面 0.20～0.35
  │
  ├────────────> STYLE + R1 ─── Region 1 1.0
  ├────────────> STYLE + R2 ─── Region 2 1.0
  └────────────> STYLE + R3 ─── Region 3 1.0
```

---

## 7. Global Effect Weight UI

現行の、

```text
全体画風の強度
Base Style Weight
```

を再利用してよい。

名称を、

```text
ページ全体効果 (Global Effect Weight)
```

へ変更する。

推奨設定:

```text
minimum: 0.0
maximum: 1.0
step: 0.05
default: 0.25
```

説明文:

```text
PAGE + STYLE を全画面へ弱く混ぜる強度。
Region内容より低く設定する。
診断初期値は0.25。
```

---

## 8. 正規化を理解する

Manga Attentionはmaskを概ね、

```python
mask = mask / mask.sum(dim=0, keepdim=True)
```

で正規化する。

Global=0.25、Region=1.0ならRegion内部では概ね、

```text
Global = 0.25 / 1.25 = 0.20
Region = 1.00 / 1.25 = 0.80
```

となる。

つまり初期値0.25では、

```text
全体構造・画風 約20%
Region固有内容 約80%
```

程度を狙う。

ただしこれは初期仮説であり、正解値としてハードコードしてはならない。

---

## 9. `fc_args` のindexを変更する

v3.7.2ではCanvas Region 1が `cond_1` だった。

v3.7.3では、

```text
cond_1 / mask_1 = Global Effect
cond_2 / mask_2 = Canvas Region 1
cond_3 / mask_3 = Canvas Region 2
cond_4 / mask_4 = Canvas Region 3
...
```

とする。

**Panel indexとcond indexを混同しないこと。**

推奨:

```python
cond_index = i + 2
```

等、offsetを明示する変数名を使う。

---

## 10. Global Effect branch参考コード

以下は概念コードであり、ローカルEasyReforge / Forge Couple v4.0.2の型・shapeを確認してから調整すること。

```python
fc_args = {}

# Global Effect

global_effect_text = ", ".join(
    x for x in (self.page_text, self.style_text) if x
)

texts = SdConditioning(
    [global_effect_text if global_effect_text else " "],
    False,
    p.width,
    p.height,
    None,
)

cond = p.sd_model.get_learned_conditioning(texts)
global_cond = [[cond["crossattn"]]] if is_sdxl else [[cond]]

fc_args["cond_1"] = global_cond
fc_args["mask_1"] = (
    torch.ones((1, p.height, p.width), dtype=torch.float32)
    * float(global_weight)
)

# Canvas Regions
for i, r_info in enumerate(self.resolved_prompts):
    cond_index = i + 2

    resolved_text = r_info["resolved_text"]
    region_weight = r_info["weight"]

    texts = SdConditioning(
        [resolved_text if resolved_text else " "],
        False,
        p.width,
        p.height,
        None,
    )

    cond = p.sd_model.get_learned_conditioning(texts)
    pos_cond = [[cond["crossattn"]]] if is_sdxl else [[cond]]

    fc_args[f"cond_{cond_index}"] = pos_cond

    region_mask = (
        spatial_regions[i]["mask"]
        .squeeze(0)
        .squeeze(0)
        * region_weight
    )

    fc_args[f"mask_{cond_index}"] = region_mask.unsqueeze(0)

base_mask = empty_tensor(p.height, p.width)
```

---

## 11. Branch Mappingを必ずログ出力する

生成前に最低限、以下を出す。

```text
[MangaPrompter][BRANCH MAP]

BASE:
  mask_weight = 0
  content = k_target / unused positive base

GLOBAL:
  cond_1
  mask_1 = fullscreen * 0.25
  prompt = "multiple scene composition, clean illustration..."

REGION 1:
  cond_2
  mask_2
  panel_index = 1
  prompt = "clean illustration..., red sports car"

REGION 2:
  cond_3
  mask_3
  panel_index = 2
  prompt = "clean illustration..., blue ocean"
```

このログが出ない状態を「完了」としない。

---

## 12. `main conditioning` の扱い

v3.7.3でも、

```python
prompts[0] = PAGE + STYLE
```

を継続してよい。

ただし、

```text
main conditioning と Global Effect branch は別物
```

と理解すること。

Global Effectは必ず、

```text
独自 cond_N + 全画面 mask_N
```

としてAttention Coupleへ入れる。

---

# 13. テンプレートを全面変更する

v3.7.3では現在の自動テンプレート、

```text
${numPanels}koma, manga page, comic strip, comic panel
BREAK
masterpiece, best quality, monochrome, manga ink, clean lineart
```

を変更する。

理由:

- `3koma / 4koma / 5koma` はモデル既知の典型レイアウトを強く誘導する
- Canvasの自由矩形指定が効いたのか、モデル記憶のkoma構成が効いたのか判別しにくい
- 診断段階では、画風・品質タグも少なくした方がRegion意味分離を判定しやすい

---

## 14. テンプレートは2種類の考え方を持つ

### A. Diagnostic Template

Regional機能の成立確認用。

### B. Manga Template

RegionalがPASSした後の実運用用。

v3.7.3ではDiagnosticをデフォルトとする。

---

## 15. Diagnostic Template

PAGEはパネル数を断定しない。

推奨PAGE:

```text
multiple scene composition
```

STYLE:

```text
clean illustration, clear subjects, simple composition
```

2Regionなら:

```text
multiple scene composition
BREAK
clean illustration, clear subjects, simple composition
BREAK
koma 1:
BREAK
koma 2:
```

3RegionならRegion行だけ増える。

```text
multiple scene composition
BREAK
clean illustration, clear subjects, simple composition
BREAK
koma 1:
BREAK
koma 2:
BREAK
koma 3:
```

---

## 16. Manga Template

DiagnosticがPASSした後の候補:

PAGE:

```text
manga page, separated comic panels
```

STYLE:

```text
monochrome manga, clean ink lines, screentone, clear composition
```

例:

```text
manga page, separated comic panels
BREAK
monochrome manga, clean ink lines, screentone, clear composition
BREAK
koma 1:
BREAK
koma 2:
BREAK
koma 3:
```

---

## 17. `${numPanels}koma` 自動挿入を削除する

現行JSの、

```javascript
`${numPanels}koma, manga page, comic strip, comic panel`
```

をデフォルト生成から削除する。

デフォルトPAGEは、

```javascript
'multiple scene composition'
```

等にする。

`3koma / 4koma` 等は将来、ユーザーが手動でPAGEへ書くことは許可する。

ただしテンプレートから自動で入れない。

---

## 18. Template Mode UIは任意

容易なら、テンプレート挿入ボタン近辺に、

```text
Template: Diagnostic / Manga
```

を追加してよい。

難しい場合はUI追加不要。

Diagnosticを標準挿入し、Manga TemplateはREADMEやコメントに残すだけでもよい。

v3.7.3の本体機能より優先しない。

---

## 19. 診断Promptも変更する

人物promptは最初のOracleに使わない。

以下のように意味差が大きいものを使う。

```text
red sports car
blue ocean
giant green apple
yellow school bus
snow mountain
black cat
```

特に、

```text
close-up, 1girl, standing
```

は診断用に使用しない。

`close-up` と `standing` の構図解釈が競合し、足元のclose-up等が出てもRegion制御失敗かprompt解釈か判断しにくいため。

---

# 20. テストは必ず段階化する

順序:

```text
Stage 1: 2領域
↓
Stage 2: 変則3パネル
↓
Stage 3: 4パネル
↓
Stage 4: Manga Template
↓
Stage 5: Global LoRA
↓
Stage 6: ControlNet
```

各StageをPASSしないまま次へ進まない。

---

## 21. Stage 1 — 2領域 Oracle

Canvas:

```text
┌──────────────┬──────────────┐
│              │              │
│   Region 1   │   Region 2   │
│              │              │
└──────────────┴──────────────┘
```

Prompt:

```text
multiple scene composition
BREAK
clean illustration, clear subjects, simple composition
BREAK
koma 1: huge bright red sports car, side view
BREAK
koma 2: blue ocean, open sea, horizon, no vehicle
```

設定:

```text
ControlNet OFF
LoRA OFF
Dynamic Prompts OFF
Hires OFF
ADetailer OFF
Batch Size 1
固定Seed
固定Sampler
固定Steps
固定CFG
```

Global Effect Weight:

```text
0.25
```

Region Weight:

```text
1.0
```

---

## 22. Stage 1A — Swap Test

同一Seed。

Region本文のみ交換。

```text
koma 1: blue ocean, open sea, horizon, no vehicle
koma 2: huge bright red sports car, side view
```

PASS条件:

```text
主意味が左右一緒に入れ替わる
```

---

## 23. Stage 1B — Single Change Test

Region 1だけ、

```text
giant green apple, single object
```

へ変更。

Region 2はOceanのまま。

PASS:

```text
左がcar → appleへ明確に変化
右は依然ocean
```

---

## 24. Stage 1 PASS Gate

次へ進める条件:

```text
Swap Test PASS
Single Change PASS
```

PASSしない場合、3パネルへ進まない。

Implementation Reportには、

```text
Stage 1 = FAIL
```

または、実行不能なら、

```text
Stage 1 = UNVERIFIED
```

と書く。

---

## 25. Global Effect Weight Sweep

Stage 1で必要なら同一Seedで、

```text
0.00
0.15
0.25
0.35
0.50
```

を最大5枚比較してよい。

見るもの:

```text
Global=0
→ Region意味分離は強いか

Global増加
→ 全体compositionが安定するか

Global過大
→ Region内容が弱まるか
```

無制限の試行は禁止。

---

## 26. Stage 2 — 変則3パネル

Stage 1 PASS後。

Canvasはユーザー側でスライスする。

典型的な均等3分割を避け、変則比率にする。

例:

```text
┌─────────────────────┐
│      Region 1       │
│                     │
├────────┬────────────┤
│   R2   │     R3     │
│        │            │
└────────┴────────────┘
```

比率例:

```text
上 43%
下 57%

下左 38%
下右 62%
```

目的:

```text
モデルの「3koma」学習記憶ではなく、
Canvas maskに対応して意味内容が動いているか
```

を確認する。

---

## 27. Stage 2 Prompt

```text
multiple scene composition
BREAK
clean illustration, clear subjects, simple composition
BREAK
koma 1: giant green apple, close view, single object
BREAK
koma 2: blue ocean, horizon, empty scene
BREAK
koma 3: yellow school bus, side view
```

まだ `3koma` は使わない。

PASS目安:

```text
R1 = apple
R2 = ocean
R3 = bus
```

が識別可能。

境界の少量リークは許容。

3内容が1Regionへ集中する場合はFAIL。

---

## 28. Stage 3 — 4パネル

Stage 2 PASS後。

Prompt例:

```text
multiple scene composition
BREAK
clean illustration, clear subjects, simple composition
BREAK
koma 1: red sports car
BREAK
koma 2: blue ocean
BREAK
koma 3: giant green apple
BREAK
koma 4: black cat, sitting
```

4Regionそれぞれの主意味が判別できること。

4パネルで急激に崩れる場合、

```text
Region数増加によるAttention competition
```

として記録し、2・3Region成功版を壊さない。

---

## 29. Stage 4 — Manga Template

Stage 1～3が概ねPASSした後のみ。

PAGE:

```text
manga page, separated comic panels
```

STYLE:

```text
monochrome manga, clean ink lines, screentone, clear composition
```

ここで初めて漫画らしさを評価する。

`3koma / 4koma` 等は自動挿入せず、必要ならユーザーが手動でPAGEへ追加する。

---

## 30. Stage 5 — Global LoRA復帰

Manga TemplateでもRegion対応が維持された後。

STYLE chunkへ既存Global LoRA群を戻す。

例:

```text
manga page, separated comic panels
BREAK
<lora:A:0.1>, <lora:B:0.25>, ...,
monochrome manga, clean ink lines, screentone
BREAK
...
```

最初は少数。

その後、通常の約20 LoRA stackへ戻す。

v3.7.3では個別Region LoRAは対象外。

---

## 31. Stage 6 — ControlNet復帰

Global LoRAまでRegion対応が維持された後。

現在のEasyReforgeで正常利用中のControlNet設定を変えずに使う。

比較:

```text
Manga OFF + ControlNet ON
Manga ON  + ControlNet ON
```

見るもの:

```text
A. Region意味分離
B. ControlNetレイアウト
```

ControlNet ONでのみ問題が出た場合、v3.7.3では修正せず記録だけする。

次版候補にする。

---

# 32. `manga_attention.py` の変更範囲

基本アルゴリズムは変更しない。

Global branchが追加されたことを正しくログ表示するための軽微な変更は許可する。

3 Canvas Regionsの場合、conditioningは、

```text
Global + R1 + R2 + R3 = 4 spatial conditions
```

になる。

ログが、

```text
Regions=4
```

のように誤解を招くなら、

```text
Global branches = 1
Canvas regions = 3
Spatial conditions = 4
```

と表示する。

---

## 33. Panel indexとcond indexのoffsetを必ずログに出す

例:

```text
Panel 1 -> cond_2 / mask_2
Panel 2 -> cond_3 / mask_3
Panel 3 -> cond_4 / mask_4
```

これを出す。

Global branch追加後のindexずれは最重要バグ候補である。

---

# 34. 自動テストできない場合

Antigravityが画像を視覚評価できない、またはUI操作を自動実行できない場合、**テストしたふりをしない。**

報告:

```text
Implementation Status: PASS
Generation Validation: UNVERIFIED
```

として、ユーザーによる手動結果待ちにする。

---

# 35. 報告文の禁止事項

実生成テスト未実施またはFAIL時、以下を使わない。

```text
完全
完全防止
100%
根本解決
確実に解決
完全独立
```

「設計上の狙い」と「確認済み事実」を分ける。

---

# 36. 変更対象ファイル

原則:

```text
EasyReforgeExtension/scripts/manga_prompter.py
EasyReforgeExtension/javascript/manga_canvas.js
EasyReforgeExtension/docs/ARCHITECTURE_AND_KNOWLEDGE_BASE.md
EasyReforgeExtension/docs/V373_GLOBAL_EFFECT_RESULT.md
```

必要なら:

```text
EasyReforgeExtension/scripts/manga_attention.py
EasyReforgeExtension/style.css
```

ただしAttentionアルゴリズム本体の再設計は禁止。

---

# 37. 変更禁止

```text
EasyReforge core
reForge core
ControlNet extension
Forge Couple extension
LoRA Block Weight extension
PyTorch
CUDA
Sampler implementation
```

---

# 38. EasyReforge更新禁止

診断中:

```text
Update.bat
ReforgeSwitchDev.bat
reForge git pull
Forge Couple update
ControlNet update
```

を行わない。

---

# 39. 実装前checkpoint

v3.7.2を必ず保存する。

例:

```bash
git add EasyReforgeExtension
git commit -m "checkpoint: v3.7.2 before global effect"
```

または同等のバックアップ。

---

# 40. PASSごとのcheckpoint

Stage 1 PASS:

```text
working: v3.7.3 two-region oracle passes
```

Stage 2 PASS:

```text
working: v3.7.3 irregular three-panel passes
```

Stage 3 PASS:

```text
working: v3.7.3 four-panel passes
```

後続試験で崩れても成功地点へ戻れるようにする。

---

# 41. 実装報告書

作成:

```text
EasyReforgeExtension/docs/V373_GLOBAL_EFFECT_RESULT.md
```

必須形式:

```markdown
# v3.7.3 Global Effect Result

## Status
Implementation Status:
PASS / PARTIAL / FAIL

Generation Validation:
PASS / UNVERIFIED / FAIL

## Environment
EasyReforge commit:
reForge commit:
Forge Couple local version:

Checkpoint:
Resolution:
Sampler:
Steps:
CFG:
Seed:

## Files Changed
- ...

## References Actually Read
manga_prompter.py:
- after_extra_networks_activate
- process_before_every_sampling

manga_attention.py:
- patch_unet
- attn2_patch
- attn2_output_patch

manga_canvas.js:
- parseMainPrompt
- mangaPrompterInsertTemplateToMainPrompt

local Forge Couple v4.0.2:
- ...

## Architecture
Base branch:
Global branch:
Region branches:

## Branch Mapping
cond_1:
mask_1:
cond_2:
mask_2:
...

## Template Changes
Old PAGE default:
Old STYLE default:
New Diagnostic PAGE:
New Diagnostic STYLE:
New Manga PAGE:
New Manga STYLE:
`${numPanels}koma` automatic insertion:
REMOVED / STILL PRESENT

## Stage 1 Two Regions
Executed: YES / NO
Swap Test: PASS / FAIL / UNVERIFIED
Single Change: PASS / FAIL / UNVERIFIED
Global weight:

## Stage 2 Irregular Three Panels
Executed: YES / NO
Canvas geometry:
Result: PASS / FAIL / UNVERIFIED

## Stage 3 Four Panels
Executed: YES / NO
Result: PASS / FAIL / UNVERIFIED

## Manga Template
Tested: YES / NO
Result:

## Global LoRA
Tested: YES / NO
Result:

## ControlNet
Tested: YES / NO
Manga OFF + ControlNet:
Manga ON + ControlNet:
Result:

## Console Logs
Paste relevant:
- BRANCH MAP
- MASK STATS
- ATTN2 FIRST CALL
- SUMMARY

## Confirmed Findings
Only verified facts.

## Hypotheses
Clearly label unverified hypotheses.

## Remaining Problems
...

## Next Recommendation
Do not automatically implement the next architecture.
```

---

# 42. GitHub反映の報告も厳密化する

単にGitHub連携ディレクトリへコピーしただけで、

```text
GitHub反映済み
```

と言わない。

報告書に:

```text
Git working tree synced: YES / NO
Git commit created: YES / NO
Git push completed: YES / NO
Remote commit hash: ...
```

を書く。

---

# 43. Antigravityは編集前に理解確認を出す

コード編集を始める前に、短く以下を報告する。

```text
理解確認:

1. v3.7.2の主仮説
   k_target = PAGE + STYLE だが base_mask=0 のため、
   PAGE寄与がAttention合成から消えている可能性がある。

2. v3.7.3
   PAGE+STYLEを独立Global Effect conditionとして追加する。

3. Region
   STYLE + Region本文。

4. base_mask
   0を維持。

5. cond mapping
   cond_1=Global
   cond_2=Panel1
   cond_3=Panel2 ...

6. 最初のAcceptance
   2領域 car/ocean Swap Test。

7. Stage 1 PASS前に
   3パネル・4パネル・ControlNetへ進まない。
```

理解確認がずれていたら、コード編集を開始しない。

---

# 44. 公開Forge Couple参考URL

```text
https://github.com/Haoming02/sd-forge-couple
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/scripts/forge_couple.py
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/lib_couple/mapping.py
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/lib_couple/attention_couple.py
```

特に `mapping.py` でGlobal Effect/backgroundへ全画面maskを与える考え方を参照する。

---

# 45. 最終的なユーザー向けテンプレート候補

## Diagnostic

```text
multiple scene composition
BREAK
clean illustration, clear subjects, simple composition
BREAK
koma 1:
BREAK
koma 2:
```

Canvas Region数に応じてRegion行だけ増やす。

## Manga

```text
manga page, separated comic panels
BREAK
monochrome manga, clean ink lines, screentone, clear composition
BREAK
koma 1:
BREAK
koma 2:
```

数字の `3koma / 4koma / 5koma` は自動挿入しない。

---

# 46. 実運用のQuality / LoRA資産

後段ではSTYLEへ、

```text
Illustrious用quality tags
Global LoRA群
画風tags
monochrome / color
```

を戻す。

例:

```text
manga page, separated comic panels
BREAK
<lora:AAA:0.1>, <lora:BBB:0.25>,
masterpiece, best quality,
monochrome manga, clean ink lines
BREAK
koma 1:
...
```

ただしStage 1～3のOracleでは使わない。

---

# 47. 成功判定

最低成功条件:

```text
Stage 1 Swap Test PASS
```

望ましい:

```text
Stage 1 PASS
Stage 2変則3パネル PASS
Stage 3 4パネル PASS
```

2領域のみ成功、3領域で崩れるなら、

```text
PARTIAL SUCCESS
```

とする。

これは重要な成果なので、3領域を無理に直して2領域成功版を壊さない。

---

# 48. 2領域でFAILした場合

Global Effect weightを最大5段階まで試した後、同じEasyReforge環境のForge Couple v4.0.2で、

```text
同Checkpoint
同Seed
同Sampler
同Steps
同CFG
同2領域
同Prompt
```

を比較する。

Forge CoupleがPASSし、MangaがFAILなら、次の調査対象は、

```text
manga_attention.py
mapping
conditioning shape
branch index
mask shape
```

へ絞る。

モデル固有限界と決めつけない。

---

# 49. この版でやらないこと

```text
ComfyUI移植
SwarmUI
MultiDiffusion
Latent Couple
Regional Prompter統合
Region別LoRA本格対応
ControlNet修正
吹き出し
文字
自動ネーム解析
```

---

# 50. Antigravityへの短縮実行指示

EasyReforge Manga Prompter v3.7.3を実装してください。

目的は、v3.7.2で発生した、

```text
Manga ONにするとPAGE構造が消えて1枚絵化する
```

問題を、Forge CoupleのGlobal Effect方式を参考に修正することです。

作業前に必ず以下を開いてください。

```text
EasyReforgeExtension/scripts/manga_prompter.py
EasyReforgeExtension/scripts/manga_attention.py
EasyReforgeExtension/javascript/manga_canvas.js
```

さらにローカルEasyReforge内のForge Couple v4.0.2のGlobal Effect/background mappingを確認してください。

公開参考:

```text
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/lib_couple/mapping.py
https://raw.githubusercontent.com/Haoming02/sd-forge-couple/main/scripts/forge_couple.py
```

重要な不変条件:

```text
k_target ↔ base_mask
cond_N   ↔ mask_N
```

v3.7.3では、

```text
base_mask = 0
cond_1 = PAGE + STYLE
mask_1 = 全画面 * Global Effect Weight
cond_2 = STYLE + Region 1
mask_2 = Region 1
cond_3 = STYLE + Region 2
mask_3 = Region 2
...
```

としてください。

Global Effect Weightは、

```text
0.0～1.0
default 0.25
```

とします。

テンプレートも変更してください。

`${numPanels}koma, manga page...` の自動挿入を廃止してください。

Diagnosticデフォルト:

```text
multiple scene composition
BREAK
clean illustration, clear subjects, simple composition
BREAK
koma 1:
BREAK
koma 2:
...
```

Manga候補:

```text
manga page, separated comic panels
BREAK
monochrome manga, clean ink lines, screentone, clear composition
BREAK
koma 1:
...
```

まず2領域で、

```text
red sports car
blue ocean
```

を固定Seedでテストし、Swap Testを行ってください。

PASSしなければ3パネルへ進まないでください。

PASSしたらcheckpointを保存してください。

その後、ユーザーがCanvasで作る変則3パネル、次に4パネルを段階テストしてください。

テストを自動実行できない場合は、`UNVERIFIED` と報告してください。

テスト未実施なのに「完全」「根本解決」「100%」と報告しないでください。

最後に、

```text
EasyReforgeExtension/docs/V373_GLOBAL_EFFECT_RESULT.md
```

を作成してください。

GitHub反映については、

```text
コピー済み
commit済み
push済み
```

を区別してください。

以上。
