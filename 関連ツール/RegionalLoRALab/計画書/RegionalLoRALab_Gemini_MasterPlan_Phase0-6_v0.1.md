# Regional LoRA Lab — Gemini 初期開発指示書 / Master Plan v0.1
## reForge向け Regional LoRA Engine 試作研究
### 対象作業フォルダ
`D:\GitHub\tegaki\RegionalLoRALab`

---

# 0. この文書の役割

あなた（Gemini）は、この文書だけを初期仕様として受け取る「まっさらな開発担当AI」である。

目的は、既に完成度が高く実用中の Manga Region Prompter（MRP）を壊したり置き換えたりすることではない。

**MRPとは完全に独立した研究用拡張として、reForge上で「LoRAそのものを領域別に適用する Regional LoRA Engine」がどこまで実現できるかを、小さな実験から段階的に検証する。**

最初から完成品を作ろうとしないこと。

このプロジェクトでは、

- まず「遅くても正しい」基準方式を作る
- その後に高速化・1-pass化を研究する
- 各Phaseで成功／失敗を記録する
- 不明なreForge内部APIを推測で書かない
- 実装前に現物コードを読む
- MRP本体を実験台にしない

ことを最優先とする。

---

# 1. 最終目標

最終的には、同じ画像生成の中で例えば

- 左領域 → Character LoRA A
- 右領域 → Character LoRA B
- 共通領域 → LoRAなし、または共通LoRA

のように、**LoRAのUNet側効果を画像空間で分離**できるreForge用エンジンを目標とする。

理想形の概念は以下。

```text
base UNet output
    +
mask_A * LoRA_A_delta
    +
mask_B * LoRA_B_delta
```

ただし、最初からこの方式を実装してはいけない。

まずは「複数回UNetを通すが、原理的に分離が分かりやすい方式」を作り、それを正解画像（oracle / reference implementation）としてから、1-pass化を研究する。

---

# 2. MRPとの関係

MRPは本命であり、現時点で完成扱いに近い。

このRegional LoRA Labは研究用の別プロジェクト。

## 絶対ルール

原則として以下を変更しない。

```text
D:\GitHub\tegaki\EasyReforgeExtension\
```

特にMRPの

- `manga_prompter.py`
- `manga_attention.py`
- `manga_spatial_engine.py`
- `manga_canvas.js`

等をRegional LoRA Labの都合で変更してはいけない。

MRPのmask生成やAttention Couple設計を「参考として読む」のはよい。

コードを共有したくなっても、まずRegionalLoRALab側へ独立実装する。

MRPとの連携は最終Phaseまで行わない。

---

# 3. 開発思想

## 3.1 最小実験を積み上げる

各Phaseは一つの技術課題だけを証明する。

悪い例:

```text
Regional LoRA
+ MRP
+ 自由矩形
+ 6領域
+ LoHa
+ DoRA
+ SD1.5
+ SDXL
+ Flux
+ 自動LoRA検出
```

を一度に実装する。

良い例:

```text
SDXL
2領域
左右50:50
2つの通常LoRA
UNetのみ
1枚生成
```

から始める。

---

## 3.2 「動く」と「本当に分離している」を区別する

LoRAタグをコマ別promptに書いて見た目が違うだけでは、Regional LoRA成功とは判定しない。

A1111 / Forge / reForge系の通常LoRAは、Extra Networks処理でモデルへグローバル適用される。

そのため、

```text
left prompt: <lora:A:1>, trigger_A
right prompt: <lora:B:1>, trigger_B
```

で左右差が出ても、

- LoRA Aのdeltaが左だけに作用した
- LoRA Bのdeltaが右だけに作用した

とは限らない。

**Regional LoRA成功判定には、LoRA本体の空間分離を検証する対照実験が必要。**

---

## 3.3 推測でreForge内部を書かない

reForgeはForge backend / `ldm_patched` / `UnetPatcher`を利用している。

API名・hook位置・model objectの所有関係はバージョンで変わり得る。

必ずローカルにインストールされているreForgeソースを読んでから実装する。

ネットの記事や古いForgeコードだけを根拠に関数名を決めない。

---

# 4. 初回に作成するフォルダ構造

まず以下を作成する。

```text
D:\GitHub\tegaki\RegionalLoRALab\
│
├─ README.md
├─ MASTER_PLAN.md
├─ CURRENT_STATUS.md
├─ GPT_GITHUB_LINKS.txt
├─ CHANGELOG.md
│
├─ docs\
│   ├─ ARCHITECTURE_NOTES.md
│   ├─ REFORGE_LORA_FLOW.md
│   ├─ RESEARCH_REFERENCES.md
│   ├─ PHASE_00_ENVIRONMENT_PROBE.md
│   ├─ PHASE_01_MULTIPASS_POC.md
│   └─ TEST_PROTOCOL.md
│
├─ reports\
│   ├─ README.md
│   └─ PHASE_00_REPORT.md
│
├─ scripts\
│   └─ regional_lora_lab.py
│
├─ javascript\
│   └─ .gitkeep
│
├─ tests\
│   └─ .gitkeep
│
└─ assets\
    └─ .gitkeep
```

Phaseが進んだら必要なファイルだけ追加する。

最初から巨大なモジュール構成にしない。

---

# 5. GitHub提出用リンクTXT

必ず以下を作成する。

```text
D:\GitHub\tegaki\RegionalLoRALab\GPT_GITHUB_LINKS.txt
```

このファイルは、ユーザーがGPTへ「今のGitHubを確認して」と渡すための入口である。

## 初期内容

以下を基本形として作成する。

```text
Regional LoRA Lab - GPT Review Links

Repository:
https://github.com/toshinka/tegaki

RegionalLoRALab folder:
https://github.com/toshinka/tegaki/tree/main/RegionalLoRALab

RegionalLoRALab commit history:
https://github.com/toshinka/tegaki/commits/main/RegionalLoRALab

README:
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/RegionalLoRALab/README.md

MASTER PLAN:
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/RegionalLoRALab/MASTER_PLAN.md

CURRENT STATUS:
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/RegionalLoRALab/CURRENT_STATUS.md

ARCHITECTURE NOTES:
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/RegionalLoRALab/docs/ARCHITECTURE_NOTES.md

LATEST PHASE REPORT:
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/RegionalLoRALab/reports/PHASE_00_REPORT.md

MAIN SCRIPT:
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/RegionalLoRALab/scripts/regional_lora_lab.py

Latest verified commit:
UPDATE_AFTER_PUSH

Cache-busting example:
Append ?v=YYYYMMDD-HHMMSS to a raw URL when checking the newest pushed content.
Example:
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/RegionalLoRALab/CURRENT_STATUS.md?v=20260902-180000
```

---

# 6. GitHub URLの作法

WindowsローカルパスとGitHub URLを混同しないこと。

ローカル:

```text
D:\GitHub\tegaki\RegionalLoRALab\docs\ARCHITECTURE_NOTES.md
```

GitHub browser URL:

```text
https://github.com/toshinka/tegaki/blob/main/RegionalLoRALab/docs/ARCHITECTURE_NOTES.md
```

Raw URL:

```text
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/RegionalLoRALab/docs/ARCHITECTURE_NOTES.md
```

フォルダ:

```text
https://github.com/toshinka/tegaki/tree/main/RegionalLoRALab
```

フォルダに限定したcommit履歴:

```text
https://github.com/toshinka/tegaki/commits/main/RegionalLoRALab
```

特定commit:

```text
https://github.com/toshinka/tegaki/commit/<FULL_SHA>
```

## ルール

- URLでは `\` ではなく `/` を使う。
- `D:\GitHub\...` をURLへそのまま貼らない。
- GPTに読ませる主要ファイル名は、できるだけASCII英数字とunderscoreで作る。
- Raw URLはキャッシュされる場合があるため、最新確認用には必要に応じて以下を付ける。

```text
?v=YYYYMMDD-HHMMSS
```

例:

```text
.../CURRENT_STATUS.md?v=20260902-182530
```

これはGitHubのversion指定ではなく、キャッシュ回避用query parameterである。

## Push後の更新

GitHubへpushしたら `GPT_GITHUB_LINKS.txt` の

```text
Latest verified commit:
```

を

```text
Latest verified commit:
https://github.com/toshinka/tegaki/commit/0123456789abcdef...
```

のように更新する。

**可能ならGPTレビューを依頼する直前の最後のcommit SHAを必ず記載する。**

---

# 7. 報告書の方針

報告書は別冊にする。

理由:

- Master Planは頻繁に書き換えない
- 実験結果はPhaseごとに増える
- GPTが差分を確認しやすい
- 失敗した試作も履歴として残せる

構成:

```text
MASTER_PLAN.md
    長期目標・Phase設計・基本思想

CURRENT_STATUS.md
    現在どこまで進んでいるかを短く記載

reports/PHASE_XX_REPORT.md
    そのPhaseの実装・テスト・失敗・次の課題

CHANGELOG.md
    短い変更履歴
```

---

# 8. Geminiの報告作法

各作業終了時、最低限以下を報告書へ書く。

```text
# Phase XX Report

## Status
SUCCESS / PARTIAL / FAILED / BLOCKED

## Environment
- reForge path:
- reForge branch:
- reForge commit:
- Python:
- PyTorch:
- CUDA:
- GPU:
- VRAM:
- checkpoint family:
- tested sampler:

## Goal
今回何を証明するPhaseだったか。

## Files Added
- ...

## Files Modified
- ...

## reForge Source Inspected
- file:
- class/function:
- why relevant:

## Implementation
何をどのhook/APIで実装したか。

## Test Procedure
再現可能な手順。

## Test Results
成功、失敗、ログ、速度、VRAMなど。

## Important Observations
推測ではなく実測。

## Known Problems
未解決事項。

## Decision
次Phaseへ進めるか。

## Next Recommended Step
次に一つだけ何をするか。

## Latest Commit
commit SHA / URL
```

不明事項は「不明」と書く。

成功したように見せるために推測で埋めない。

---

# 9. 外部コード参照の作法

Regional LoRAには既存研究がある。

ただし、ライセンスと実装環境が異なるため、安易にコピペしない。

## 主要参考資料

### reForge本体

```text
https://github.com/Panchovix/stable-diffusion-webui-reForge
```

特に調べる候補:

```text
extensions-builtin/Lora/networks.py
ldm_patched/modules/sd.py
ldm_patched/modules/lora.py
ldm_patched/modules/model_patcher.py
modules_forge/unet_patcher.py
modules_forge/forge_sampler.py
ldm_patched/modules/samplers.py
```

reForgeのLoRAロード処理では、現行コード上、標準LoRAは
`load_lora_for_models(...)`
を経由して `forge_objects.unet` / `clip` のpatcherへ適用される。

`ModelPatcher` / `UnetPatcher` にはclone機構とpatch管理がある。

**ただしローカルreForgeの実装を最終的な正とすること。**

---

### reForge LoRA Control

```text
https://github.com/Panchovix/sd_webui_loractl_reforge_y
```

目的:

- reForge上でLoRA multiplierを実行時に変更する既存例を調べる
- LoRAの有効／無効やstep依存制御の実装方法を学ぶ

コードを丸写しするのではなく、reForgeとの接続方法を理解する。

---

### Regional Prompter

```text
https://github.com/hako-mikan/sd-webui-regional-prompter
```

確認事項:

- Attention mode
- Latent mode
- Regional LoRA
- Forge対応
- reForgeではLatent LoRAが非対応とされる理由
- LoRA corruptionの既知問題

Regional PrompterはAGPL-3.0である。

ライセンスを無視してコードを取り込まない。

---

### kohya sd-scripts

```text
https://github.com/kohya-ss/sd-scripts
```

ドキュメント中の

```text
Attention Couple + Regional LoRA
```

を調査する。

特に:

- regional mask
- network multiplier
- LoRAをregionへ割り当てる仕組み
- Text EncoderとUNetの扱い

を設計参考にする。

---

### ComfyUI系

必要になった段階で、

- ModelPatcher clone
- patch / hook
- regional sampler
- conditioning hook

の思想を参考にする。

ただしreForgeへComfyUI nodeを直接移植しない。

---

# 10. ライセンス注意

他プロジェクトから長いコードや関数をそのままコピーしない。

まず:

1. ライセンス確認
2. 必要なアルゴリズムを文章化
3. reForgeのAPIに合わせて独自実装

の順にする。

コピーが必要な場合は、必ず出典・ライセンス・改変内容をREADMEに記載する。

---

# 11. 技術的な前提

通常LoRAは概念的に各対象層へ

```text
W' = W + scale * ΔW_lora
```

を適用する。

通常のreForge LoRAでは、LoRAはモデルpatchとしてUNet / CLIPへロードされるため、prompt中のタグ位置だけでは画像空間の局所LoRAにはならない。

Regional LoRA Labが狙うのは、最終的にはUNet側で

```text
y = base(x)
  + M_A * delta_A(x)
  + M_B * delta_B(x)
```

に近いもの。

ここで `M_A`, `M_B` はfeature map解像度へ変換された空間mask。

ただしText Encoderには画像空間がない。

そのため初期研究では、

```text
Text Encoder LoRA = global または 0
UNet LoRA = regional
```

と分離して考える。

---

# 12. 対応範囲の初期制限

Phase 1～3では対応範囲を意図的に狭くする。

## 対応する

```text
reForge
SDXL系
Illustrious系checkpoint
standard LoRA
txt2img
batch size 1
2 regions
矩形mask
UNet LoRA
```

## 初期は対応しない

```text
SD1.5
SD3
Flux
ANIMA固有機構
LoHa
LoCon
LyCORIS全般
DoRA
Text Encoderの空間mask
img2img
Hires fix
ADetailer
複数ControlNetとの完全互換
batch > 1
3領域以上
soft overlap
自由polygon
MRP連携
```

動作確認後に一つずつ増やす。

---

# 13. Phase全体ロードマップ

## Phase 0 — Environment / Hook Probe

目的:

**何も生成ロジックを変更せず、現在のreForgeでどこへ安全にhookできるかを確認する。**

成果物:

```text
docs/REFORGE_LORA_FLOW.md
docs/ARCHITECTURE_NOTES.md
reports/PHASE_00_REPORT.md
scripts/regional_lora_lab.py
```

Phase 0ではRegional LoRAをまだ実装しない。

---

## Phase 1 — 2-Region Multi-Pass Oracle

目的:

**遅くてもよいので、左右に別LoRAを本当に分離できる基準実装を作る。**

2領域固定:

```text
AAAA|BBBB
AAAA|BBBB
AAAA|BBBB
```

LoRA AとLoRA Bを別UNet状態で評価し、maskで出力を合成する。

これが成功すれば「reForge上でRegional LoRA自体は可能」という基準になる。

---

## Phase 2 — LoRA / Text Encoder Scope Separation

目的:

- UNet LoRAだけregional
- Text Encoder LoRAはglobal / off

を明示的に扱う。

Character LoRAでのidentity leakageを比較する。

---

## Phase 3 — Masked Delta Feasibility Probe

目的:

UNetを2回回さず、

```text
LoRA delta * spatial mask
```

を各対象層で行えるか調査する。

まだ本番化しない。

対象:

- standard Linear LoRA
- SDXL UNet
- 代表的Attention層

のみ。

---

## Phase 4 — One-Pass Masked LoRA PoC

目的:

2 LoRA / 2 regionを1回のUNet forwardで分離する。

ここで初めて「新しいRegional LoRA Engine」の核が成立する。

---

## Phase 5 — Generalization

順番に追加:

1. arbitrary rectangle
2. 3～4 region
3. soft mask
4. overlap
5. weight per region
6. LoRA list UI
7. character LoRA
8. style LoRA
9. ControlNet compatibility
10. Hires / img2img

一度に追加しない。

---

## Phase 6 — MRP Bridge（任意）

Regional LoRA Labが単独で十分安定した場合のみ検討。

MRPのpanel masksをRegional LoRA Labへ渡す。

MRP本体へRegional LoRAロジックを埋め込むのではなく、

```text
MRP → mask metadata
Regional LoRA Lab → LoRA regionalization
```

の疎結合を優先する。

---

# 14. Phase 0 詳細指示

初回Gemini作業では**Phase 0のみ完了させること。**

ユーザーの明示許可なしにPhase 1へ進まない。

---

## 14.1 reForge環境を特定する

ユーザー環境内でreForgeの実インストール先を確認する。

見つからない場合は推測でパスを書かず、報告して止まる。

確認:

```text
git remote -v
git branch --show-current
git rev-parse HEAD
```

を実行可能なら記録。

さらに:

```text
Python version
torch version
CUDA version
GPU
VRAM
```

を取得可能な範囲で記録。

---

## 14.2 LoRAロード経路を現物コードで追う

最低限以下を読む。

```text
extensions-builtin/Lora/networks.py
ldm_patched/modules/sd.py
ldm_patched/modules/lora.py
ldm_patched/modules/model_patcher.py
modules_forge/unet_patcher.py
modules_forge/forge_sampler.py
ldm_patched/modules/samplers.py
```

調査結果を `docs/REFORGE_LORA_FLOW.md` に書く。

最低限明らかにする:

1. `<lora:...>` がどこで解釈されるか
2. LoRA state dictがどこでロードされるか
3. UNet patcherへどの関数でpatchが追加されるか
4. CLIP patcherへどの関数でpatchが追加されるか
5. `UnetPatcher.clone()` が使えるか
6. cloneが同じunderlying modelを共有するか
7. `patches` がclone間で独立リストになるか
8. sampling直前にどのUNet objectが使われるか
9. `model_function_wrapper` 等、UNet forwardを包めるhookが現在存在するか
10. ControlNetがどの段階で入るか

コードのファイル名と関数名を必ず記録する。

---

## 14.3 既存LoRA適用を壊さないProbe

`RegionalLoRALab/scripts/regional_lora_lab.py` は最初は診断専用にする。

UIは最小限。

例:

```text
[ ] Enable Regional LoRA Lab
Mode: Probe only
```

有効時にログへ、

```text
[RLL][Probe] enabled
[RLL][Probe] UNet patcher class = ...
[RLL][Probe] patches count = ...
[RLL][Probe] model_function_wrapper present = True/False
[RLL][Probe] ControlNet linked = True/False
```

程度を出す。

**このPhaseではUNet出力を書き換えない。**

無効時は完全no-op。

---

## 14.4 reForge本体を直接編集しない

Phase 0では、

```text
stable-diffusion-webui-reForge\...
```

の本体ファイルを編集しない。

RegionalLoRALabをextensionとして動かす方法を使う。

もしextension APIだけでは必要なhookを得られない場合も、その場で本体を書き換えない。

`PHASE_00_REPORT.md` に

```text
BLOCKED: extension APIではこのhookに到達不能
```

と記載し、次の設計判断をユーザーへ返す。

---

# 15. RegionalLoRALabをreForgeへ読み込ませる方法

`D:\GitHub\tegaki\RegionalLoRALab` はGit管理用の正本。

reForgeのextensionディレクトリは別場所である可能性がある。

## 禁止

reForgeパスを勝手に

```text
D:\stable-diffusion-webui-reForge
```

等と決め打ちしない。

## 推奨

実インストール先を確認後、

- directory junction
- symbolic link
- 開発用copy

のいずれかで

```text
<REFORGE_ROOT>\extensions\RegionalLoRALab
```

からGit管理フォルダを参照させる。

Windows junction例:

```bat
mklink /J "<REFORGE_ROOT>\extensions\RegionalLoRALab" "D:\GitHub\tegaki\RegionalLoRALab"
```

ただし、**ユーザー環境を確認してから実行すること。**

既に同名フォルダがある場合は削除・上書きしない。

---

# 16. Phase 0 完了条件

以下を全て満たす。

- reForgeの実version / commitを記録
- LoRA load pathを文章化
- safe hook候補を最低1つ特定
- Probe extensionがWebUI起動を壊さない
- 無効時no-op
- 通常LoRA生成が従来通り動く
- MRPを変更していない
- `PHASE_00_REPORT.md` 作成
- `CURRENT_STATUS.md` 更新
- `GPT_GITHUB_LINKS.txt` 更新
- Git commit / push後、最新SHAをTXTへ記録

---

# 17. Phase 1 詳細設計 — Multi-Pass Oracle

Phase 0レビュー後にのみ着手。

目的は高速化ではない。

**「本当にLoRAを空間分離した画像」を作る正解系を得ること。**

---

## 17.1 最初の仕様

UI:

```text
Enable: checkbox
Mode: 2-Region Multi-Pass
Split: Left / Right only

LoRA A:
- file
- UNet weight

LoRA B:
- file
- UNet weight

Text Encoder:
- Off
- Global A
- Global B
- Global Both
```

初期は左右50:50固定。

自由矩形UIを作らない。

---

## 17.2 理想的な計算モデル

概念として各denoise評価時に:

```text
pred_base or shared context
pred_A = UNet_with_LoRA_A(x, sigma, cond_A)
pred_B = UNet_with_LoRA_B(x, sigma, cond_B)

pred =
    mask_A * pred_A
  + mask_B * pred_B
```

とする。

境界mask:

```text
mask_A + mask_B = 1
```

を保証する。

最初はhard mask。

---

## 17.3 注意

単純に生成終了後の画像A/Bを左右で切って貼るだけではPhase 1成功ではない。

**同じlatent sampling processの各denoise段階でregion outputを合成すること**を狙う。

そうしないと領域間の構図・ノイズ過程が共有されない。

ただしreForge API上の制約でこれが非常に困難なら、無理に実装を進めず報告する。

---

## 17.4 Patcher cloneの検討

現行reForgeの`UnetPatcher` / `ModelPatcher`にはclone機構がある。

調査候補:

```python
base_unet = ...
unet_A = base_unet.clone()
unet_B = base_unet.clone()
```

それぞれへ別LoRA patchを追加できるか検証する。

ただしcloneはunderlying model objectを共有する可能性がある。

`patches` は別でも、実weight patch時に同じmodel weightを書き換えるなら、同時保持できない可能性がある。

ここは**実測・コード読解が必要**。

推測で

```text
clone = 完全に独立したUNet
```

とみなさない。

---

## 17.5 LoRA読み込み

標準reForgeのLoRA処理を調査し、

- state dict load
- key mapping
- `load_lora_for_models`
- `add_patches`

のうち、安全に再利用できる部分を使う。

LoRA parserを独自再発明しない。

ただし通常のglobal `networks.load_networks()` をそのまま呼ぶと、
`current_sd.forge_objects.unet` 自体を差し替えるため、Regional branch用には不適切な可能性がある。

Phase 0で所有関係を確認してから決める。

---

# 18. Phase 1のテスト用LoRA

最初は差が大きく見えるものを選ぶ。

推奨:

```text
LoRA A = 強い漫画・白黒style
LoRA B = 強い別style、またはLoRAなし
```

Character LoRAから始めると、

- checkpointのキャラ知識
- trigger word
- prompt leakage

とLoRA分離を見分けにくい。

まずStyle LoRAで左右差を確認。

次にCharacter LoRAへ進む。

---

# 19. Phase 1の対照実験

同seed / 同checkpoint / 同sampler / 同promptで最低以下を生成。

## Control 0

```text
LoRAなし
Regional Lab OFF
```

## Control 1

```text
LoRA A global
Regional Lab OFF
```

## Control 2

```text
LoRA B global
Regional Lab OFF
```

## Control 3

```text
LoRA A + B global
Regional Lab OFF
```

## Experimental

```text
Regional Lab ON
Left = A
Right = B
```

比較項目:

- 左にAが出ているか
- 右にAが漏れているか
- 右にBが出ているか
- 左にBが漏れているか
- 境界artifact
- 色・線・顔のstyle leakage
- seed再現性
- ControlNetなし／あり
- generation time
- peak VRAM

---

# 20. Phase 1 成功条件

少なくともStyle LoRAで、

```text
Left region  ≈ LoRA A global reference
Right region ≈ LoRA B global reference
```

に近く、

反対領域へのLoRA特徴がglobal A+Bより明らかに減ること。

完全無漏れは要求しない。

重要なのは、

**通常のglobal LoRA + regional triggerより明確に空間分離が強いこと。**

---

# 21. Phase 1 停止条件

以下なら無理にPhase 2へ進めない。

- reForgeのmodel ownership上、2 patcherを安全に切替不能
- 毎stepのLoRA再patchで極端に遅い
- VRAM / RAM使用量が現実的でない
- ControlNet等と根本衝突
- outputの境界が破綻する
- samplerによって挙動が大きく不安定
- WebUI全体へpatch stateが残留する

失敗も研究成果。

報告書に原因候補を整理する。

---

# 22. Phase 2 — Text Encoder問題

画像空間maskを直接持てるのはUNet latent側。

Text Encoderはtoken表現なので、

```text
mask_A * TE_LoRA_A
```

を画像座標で単純には行えない。

そのため最初は、

```text
UNet regional
TE global/off
```

として扱う。

比較:

```text
TE=0 / UNet=1
TE global / UNet regional
```

Character LoRAでどちらがidentityを保ちつつ漏れを減らせるか実測する。

Text Encoder regionalizationを無理に同時開発しない。

---

# 23. Phase 3 — Masked Delta Probe

Phase 1が成功したら初めて調査。

目標はUNet forwardを領域数だけ繰り返さず、

LoRAが追加するactivationまたはweight-derived contributionをregion maskでgateすること。

概念:

```python
base = layer(x)
delta_A = lora_A(x)
delta_B = lora_B(x)

output = base + mask_A * delta_A + mask_B * delta_B
```

実際のstandard LoRAはweight patchとして適用されることが多いため、
そのままでは`delta_A(x)`を独立取得できない。

したがって、

- LoRA patch representation
- layer forward
- patch calculation
- weight wrapper
- model function wrapper
- custom operation

のどこでdeltaを分離できるか調べる。

このPhaseはまず**設計調査だけでもよい**。

---

# 24. Feature Map Mask

Masked Deltaを実装する場合、画像maskを各layer feature mapへ合わせる必要がある。

入力:

```text
image mask: H x W
```

各層:

```text
64 x 64
32 x 32
16 x 16
...
```

など。

概念:

```python
m = interpolate(mask, size=(h, w))
```

broadcast:

```text
[B,1,H,W]
```

を

```text
[B,C,H,W]
```

へ利用。

## 注意

Linear attention層ではtensorが

```text
[B, tokens, C]
```

等になる可能性がある。

token数がspatial tokenに対応する場合だけ、
`H*W`へreshapeしてmaskを対応させられる。

SDXL UNet内部のblockごとのshapeを実測ログで確認する。

想像でreshapeしない。

---

# 25. Phase 4 — One-Pass成功条件

以下を同時に満たすこと。

- 2-region
- 2 standard LoRA
- 1 UNet forward相当
- Phase 1 Multi-Passに近い分離
- global A+Bよりleakageが明確に少ない
- disabled時no-op
- LoRA解除後にweight汚染が残らない
- seed再現性
- ControlNet basic test成功

速度がPhase 1より改善していること。

---

# 26. Safety / Stability Rules

この研究ではWebUIプロセス内のmodel patchを扱う。

バグ時に次生成へ状態が残るのが最も危険。

必ず:

- enable/disable
- teardown
- exception cleanup
- generation終了時restore
- model reload時invalidate
- LoRA変更時cache invalidate

を設計する。

`try/finally` が必要な箇所を明示する。

---

# 27. Model State 汚染のテスト

必須テスト:

```text
1. Regional Lab ONで生成
2. Regional Lab OFF
3. LoRAタグなしで同seed生成
4. WebUI再起動後の同seedと比較
```

OFF後の画像が再起動後と大きく違う場合、

**patch state leakage**

を疑う。

Phase成功扱いにしない。

---

# 28. Logging作法

ログprefixを統一。

```text
[RLL]
[RLL][Probe]
[RLL][LoRA]
[RLL][Mask]
[RLL][MultiPass]
[RLL][Cleanup]
[RLL][WARN]
[RLL][ERROR]
```

デバッグ時に必要な情報:

- generation id
- model identity
- patcher identity
- patch count
- LoRA file
- model multiplier
- TE multiplier
- mask shape
- latent shape
- feature shape
- current step
- cleanup result

通常モードでは大量ログを出さない。

Debug checkboxを用意してよい。

---

# 29. UI作法

研究段階ではUIの美観より誤操作防止。

Phase 0:

```text
Regional LoRA Lab
[ ] Enable
Mode: Probe Only
[ ] Debug Log
```

Phase 1:

```text
Regional LoRA Lab
[ ] Enable
Mode: 2-Region Multi-Pass

Split:
Left | Right

Region A
LoRA:
UNet Weight:

Region B
LoRA:
UNet Weight:

Text Encoder:
Off / Global
```

MRPの高機能キャンバスをコピーしない。

---

# 30. Promptとの関係

Phase 1ではLoRA selectorとpromptを混同しない。

LoRA A/BはUIで選択し、
promptには通常のtriggerを書ける形が望ましい。

例:

```text
BREAK
```

やMRP syntaxを最初から要求しない。

Regional LoRA Engineの技術検証とMRP parserを切り離す。

---

# 31. Negative Prompt

最初はnegative promptは全体共通。

Regional negative promptは非対応。

Regional LoRAの成功確認に不要な機能を増やさない。

---

# 32. ControlNet

Phase 1の最初はControlNet OFFで試す。

Regional LoRA分離が確認できた後にControlNet ON。

ControlNetと競合した場合、

- ControlNet conditioning
- model wrapper chain
- batching
- input channel

のどこで衝突したかを調査する。

ControlNet対応のためにreForge本体を書き換えない。

---

# 33. Sampler

最初は一種類に固定。

ユーザー環境で安定しているsamplerを使う。

複数sampler互換性はPhase 1成功後。

sampler差でアルゴリズムの成否を混同しない。

---

# 34. Git作法

Phase単位でcommitする。

例:

```text
RLL Phase 0: add environment probe and architecture notes
RLL Phase 1a: add two-region mask and LoRA branch loader
RLL Phase 1b: add multipass denoiser prototype
RLL Phase 1c: add cleanup and regression tests
```

「misc fixes」のような曖昧なcommit messageを避ける。

可能なら1commit = 1目的。

---

# 35. CURRENT_STATUS.mdの書式

常に短く保つ。

例:

```text
# Regional LoRA Lab Current Status

Current Phase: 0
Status: SUCCESS

Working:
- extension loads
- reForge UNet patcher identified
- LoRA loading path documented

Not Working / Not Implemented:
- Regional LoRA generation
- multi-pass
- masked delta

Next:
- GPT review
- Phase 1 design approval

Latest commit:
<URL>
```

GPTがこれだけ読んでも状況を把握できるようにする。

---

# 36. README.mdの書式

READMEは外部向け。

最低限:

- これは実験的研究
- MRPとは別
- reForge専用
- 現在のPhase
- 対応モデル
- 非対応機能
- 導入法
- 危険性
- ライセンス
- 参考実装

を記載する。

「完成」「完全Regional LoRA」と実証前に書かない。

---

# 37. 初回作業の最終指示

あなた（Gemini）がこの文書を初めて受け取った場合、以下だけを行う。

1. `D:\GitHub\tegaki\RegionalLoRALab` を作成または確認
2. 指定した基本ファイル構成を作成
3. この文書の内容を `MASTER_PLAN.md` へ保存
4. `GPT_GITHUB_LINKS.txt` を作成
5. reForgeの実インストール先とversionを調査
6. reForgeのLoRA loading / ModelPatcher / sampling flowを読む
7. `REFORGE_LORA_FLOW.md` と `ARCHITECTURE_NOTES.md` を作成
8. **生成を書き換えないProbe-only extension** を作る
9. WebUI起動と通常生成への非干渉を確認
10. `PHASE_00_REPORT.md` を作成
11. `CURRENT_STATUS.md` を更新
12. git diffを点検
13. commit / push
14. `GPT_GITHUB_LINKS.txt` のLatest verified commitを更新
15. ユーザーへPhase 0の結果を報告
16. **そこで停止する**

Phase 1はユーザーまたはGPTレビュー後の指示が出るまで開始しない。

---

# 38. 重要な判断基準

この研究の成功は「完成品まで到達すること」だけではない。

以下も成功した研究成果である。

```text
reForgeではMulti-PassならRegional LoRAが可能
しかし1-pass masked deltaは構造上割に合わない
```

あるいは、

```text
UNet-only regional LoRAは可能
Text Encoder leakageは残る
```

と判明することも価値がある。

MRPという実用本命が既に存在するため、
Regional LoRA Labでは無理なハックを積み重ねて安定性を犠牲にしない。

---

# 39. 将来の理想像

研究が成功した場合でも、MRPへ直結する前に単独拡張として完成させる。

理想:

```text
Regional LoRA Lab
├─ LoRA regional engine
├─ rectangle masks
├─ diagnostics
├─ benchmark
└─ stable API
```

その後に必要なら、

```text
MRP panel layout
        ↓
mask metadata
        ↓
Regional LoRA Lab
```

という連携を検討する。

MRPは漫画意味領域・コマ管理、
Regional LoRA LabはLoRA model deltaの空間制御、
という責務分離を維持する。

---

# 40. 最重要事項

**「まず動かす」より「まず現行reForgeの仕組みを正しく理解する」。**

**「速い方式」より「遅くても正しい基準方式」を先に作る。**

**Phase 0 → Phase 1 → Phase 2 → Phase 3 の順番を飛ばさない。**

**MRPを変更しない。**

**失敗時にmodel stateを汚染しない。**

**各Phaseで報告書とGitHubリンクを残し、GPTが外部レビューできる状態を維持する。**

---

# 参考URL

reForge:
https://github.com/Panchovix/stable-diffusion-webui-reForge

reForge LoRA Control:
https://github.com/Panchovix/sd_webui_loractl_reforge_y

Regional Prompter:
https://github.com/hako-mikan/sd-webui-regional-prompter

kohya sd-scripts:
https://github.com/kohya-ss/sd-scripts

Manga Region Prompter / tegaki:
https://github.com/toshinka/tegaki

