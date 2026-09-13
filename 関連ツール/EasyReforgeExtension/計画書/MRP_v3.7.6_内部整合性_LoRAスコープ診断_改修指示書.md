# MRP v3.7.6 改修指示書
## 内部整合性ブラッシュアップ / LoRAスコープ診断準備版

対象:
- `EasyReforgeExtension/scripts/manga_prompter.py`
- `EasyReforgeExtension/javascript/manga_canvas.js`
- 必要なら補助的に `EasyReforgeExtension/scripts/manga_spatial_engine.py`

参照:
- 現行 MRP v3.7.5
- Haoming02/sd-forge-couple
- hako-mikan/sd-webui-regional-prompter
- kohya-ss/sd-scripts の Attention Couple + Regional LoRA
- ComfyUI Impact Pack の regional LoRA
- Krea系の regional multi-LoRA 実装（設計参考のみ）

---

## 0. 今回のテスト結果と改修方針

最近の実機テストでは、MRP とコマ枠 ControlNet を併用すると、多コマでも各領域への物体・キャラクターの割当はかなり安定した。

特に確認できた点:

- MRP を有効にすると、車・リンゴ・猫・犬・アヒル・ティーポット等の「概念の混色・混人物化」が大きく減る。
- ControlNet を併用するとコマ境界・ページ形状はかなり強く固定できる。
- 5コマ、6コマ程度になると、ControlNetなしで正確なページ形状を毎回再現させるのはモデル側の限界が目立つ。
- 一方で、MRPだけでも「各領域の内容を別物として保持する」能力は有効。
- 俯瞰、煽り、遠景、近接、ジャンプ、走る、液体をこぼす、雪景色、都市、和室などを混ぜると、失敗は起こるが、多くは「領域漏れ」よりも「checkpoint がその概念・動作・背景を十分理解しているか」の問題に見える。
- 出にくい対象は `(black cat:1.4)` 等の局所的な強調で改善する場合がある。
- ただし、モデル自体に弱い概念を重みだけで解決することには限界があり、必要なら別checkpointやLoRAを使うべき段階まで来ている。

したがって、現時点では MRP の Attention Couple / mask エンジンを大きく作り替える必要はない。

今回の改修は、
1. UI内部情報の整合性修正
2. BREAK構造の堅牢化
3. LoRAテストを正しく評価できるための「スコープ診断」
を中心とする。

**生成アルゴリズムそのものを大改造しないこと。**

---

# 1. 最優先: 「コマ1（全体）」の残留表示を修正する

## 現象

初期状態では1枚の全面パネルなので、

`コマ 1 (全体)`

という名前は正しい。

しかし、その初期パネルをスライスまたはクイック分割した後でも、元パネルの `name` に `(全体)` が残ることがある。

現行 `mangaPrompterReset()` では初期パネルに:

```javascript
name: 'コマ 1 (全体)'
```

を保存している。

その後 `applySlice()` / `mangaPrompterSplit()` は元パネルの `rect` を縮小するが、元パネルの `name` を更新しない。

そのため実体は部分領域なのにUI上だけ「全体」と表示される。

これは生成結果には影響しないが、ユーザーから見ると論理状態がずれて見える。

---

## 修正方針

### 推奨

`name` を論理状態のsource of truthにしない。

以下のような共通関数を作る。

```javascript
function refreshPanelDerivedMetadata() {
    const isSingleFullPanel =
        state.panels.length === 1 &&
        Math.abs(state.panels[0].rect.x) < 0.001 &&
        Math.abs(state.panels[0].rect.y) < 0.001 &&
        Math.abs(state.panels[0].rect.w - 1.0) < 0.001 &&
        Math.abs(state.panels[0].rect.h - 1.0) < 0.001;

    state.panels.forEach((p) => {
        p.color = colorForKomaNumber(p.index);

        if (isSingleFullPanel && p.index === 1) {
            p.name = 'コマ 1 (全体)';
        } else {
            p.name = `コマ ${p.index}` + ((p.zIndex || 0) > 0 ? ' (重なり)' : '');
        }
    });
}
```

値や閾値は既存設計に合わせて調整してよい。

### 呼び出す箇所

最低限:

- Reset
- Split
- Slice
- Draw Rect
- Merge
- Delete
- Koma number swap
- Preset load
- Undo / Redo 復元後

で metadata を再同期する。

### 条件

- パネル数が2以上なら `(全体)` を絶対に表示しない。
- 1パネルでも、矩形が全面を覆っていないなら `(全体)` と表示しない。
- `stable id` と `logical koma number` はこれまで通り別物として保持する。

---

# 2. BREAK chunk の位置を失わないパーサへ変更する

## 問題

現状 Python / JS 双方で概ね次のような処理をしている。

```python
[c.strip() for c in re.split(...) if c.strip()]
```

または:

```javascript
text.split(...).map(...).filter(c => c.length > 0)
```

この方式では「空のchunk」が消える。

通常のテストでは表面化しにくいが、MRPの構造は

1. STYLE
2. PAGE
3. REGION 1
4. REGION 2
5. REGION 3
...

という**位置自体に意味がある**。

空chunkを削除すると、後続regionが左詰めされて対応番号がずれる可能性がある。

また、今後LoRAを試す場合、

```text
koma 2: <lora:foo:0.8>
```

のようなchunkは、WebUIのextra network parserがLoRAタグを除去した後に、ほぼ空文字になる可能性がある。

ここで空chunkを捨てるとregion mapping自体がずれる。

---

## 必須修正

PythonとJavaScriptで同じルールに統一する。

### 基本ルール

- `BREAK` で分割した**slot数を保持する**
- 各slotは `strip/trim` する
- 中間の空slotを削除しない
- `STYLE + PAGE + N regions = N+2 slots` を位置ベースで検証する
- `koma N:` だけのregionも「空内容の正規region」として扱えるようにする

### NG

```python
if c.strip()
```

```javascript
.filter(c => c.length > 0)
```

を位置パーサに使わない。

### 注意

末尾にユーザーが誤って余分な `BREAK` を置いた場合は、
黙って再配置せず preflight error / warning にする方が安全。

---

# 3. LoRAタグ除去前のRaw Promptを保存する

## 背景

Forge/A1111系では `<lora:NAME:WEIGHT>` は通常のtext conditioningとは別の「Extra Network」として解釈される。

WebUIは概ね:

1. promptからextra-networkタグを抽出
2. LoRAをmodelへactivate
3. promptからLoRAタグを除去
4. `after_extra_networks_activate`
5. conditioning作成

の順になる。

MRP v3.7.5は `after_extra_networks_activate()` でpromptを解析しているため、その時点ではLoRAタグの元の位置情報を失っている。

今後「どのコマにLoRAが書かれていたのか」を検証するには、extra-network処理前のpromptを記録する必要がある。

---

## 実装

`before_process_batch()` を追加する。

概念例:

```python
def before_process_batch(self, p, is_enabled, global_effect_weight, json_bridge, *args, **kwargs):
    if not is_enabled:
        return

    prompts = kwargs.get("prompts")
    if not isinstance(prompts, list) or not prompts:
        return

    self.raw_prompt_before_extra_networks = prompts[0]
```

実際には Batch / img2img / Hires 等の既存互換性を壊さないように実装する。

### ここで行うこと

Raw Promptを:

- STYLE
- PAGE
- REGION 1..N

へ位置保持型で分割し、

各chunk中の:

```text
<lora:...>
```

を検出する。

保存例:

```python
self.raw_extra_network_scopes = {
    "style": [...],
    "page": [...],
    "regions": {
        1: [...],
        2: [...],
    }
}
```

このデータは今回まだ「LoRAを局所適用するため」には使わない。

**診断情報として使う。**

---

# 4. Region内LoRAの「スコープ警告」を追加する

## 重要

現行MRPは Attention Couple 型であり、
regionごとに異なる text conditioning を入れているが、
UNetモデル本体は1つである。

通常の `<lora:...>` はextra-network activation段階でUNet/CLIPへ適用される。

したがって、

```text
koma 1: character A <lora:A:0.8>
BREAK
koma 2: character B <lora:B:0.8>
```

と書いただけで、

「LoRA Aはコマ1だけ」
「LoRA Bはコマ2だけ」

という**真の空間分離LoRAになるとは考えないこと**。

LoRA自体はモデル側へグローバルにロードされ、
region prompt / trigger wordのおかげで見かけ上局所化する場合はあるが、
UNet LoRA deltaそのものがmaskされているわけではない。

---

## 今回追加する診断

Region chunkにLoRAタグがあった場合だけログを出す。

例:

```text
[MRP][LoRA Scope]
Region 2 requested: <lora:CharacterA:0.8>
Current engine: GLOBAL extra-network activation
Regional prompt: localized
Regional UNet LoRA isolation: NOT ENABLED
```

UIにも小さな警告を出してよい。

例:

> ⚠ このコマにLoRAタグがあります。現行Attention方式ではLoRA本体は全体適用です。コマ内triggerの局所化のみ保証対象です。

ただし常時表示してUIを重くしない。
**region LoRAタグを検出した時だけ表示**する。

---

# 5. 今回「真のRegion LoRA」を実装しない

これは重要なNon-Goal。

検索した先行実装ではRegion LoRAは存在するが、現在のMRPへそのまま移植できるほど単純ではない。

## 先行例1: hako-mikan Regional Prompter

Latent modeでregionごとのLoRA分離を行う設計がある。

ただし:

- region数に比例して処理が重くなる
- LoRA corruption等の注意事項がある
- reForgeではREADME上 `LoRA (Latent) = ×` とされている版がある

現在のMRPは安定して動いているAttention Coupleを基礎にしているため、
この方式を今混ぜるのはリスクが高い。

## 先行例2: kohya sd-scripts

`Attention Couple + Regional LoRA` を持ち、
maskとLoRAを対応させる機能がある。

これは非常に参考になる。

ただしsd-scriptsの独自generation pipelineで成立している機能であり、
A1111/reForge extensionへそのままコピーするものではない。

## 先行例3: ComfyUI Impact Pack

regionごとに別model/pipeへLoRAを適用するRegional Sampler型がある。

これは実質的にregion単位のmodel処理を行うため、
処理時間・VRAMコストが大きい。

## 先行例4: Krea系 Regional Multi-LoRA

2026年時点でForge Neo向けにも、
LoRAのactivation deltaをtoken maskで空間ゲートする実装例が存在する。

ただしKrea/Kleinのsingle-stream transformer構造を利用したもの。

SDXL UNet型のMRPへそのまま移植してはいけない。

---

## 結論

今回のv3.7.6では:

- Region LoRAの位置を認識する
- 「実際にはglobal LoRAである」ことを診断する
- 将来のregion-LoRA実装用にscope metadataを保持する

までに留める。

**LoRA deltaの空間mask化、region別UNet clone、N回samplingは実装しない。**

---

# 6. 軽量Preflightを追加する

生成ボタンを押す前、またはside panel上で、最低限以下を確認できるとよい。

- Panel数
- Prompt chunk数
- `expected = panel count + 2`
- STYLE slotの存在
- PAGE slotの存在
- Region 1..N のslot対応
- Region LoRAタグ有無

表示例:

```text
MRP Prompt: OK
5 panels / 7 chunks
STYLE: OK
PAGE: OK
REGIONS: 1-5 OK
Region LoRA: 1 detected (global activation)
```

エラー例:

```text
MRP Prompt: NG
Expected 7 chunks, got 6
Region 4 slot missing
```

### 方針

- エラーを勝手に修正しない
- region番号を勝手に詰めない
- ユーザーのprompt本文を書き換えない
- warningは生成を止めない
- 構造破損だけは従来通りfail-closedでよい

---

# 7. 現在の生成コアは変更しない

今回の画像テストを見る限り、以下は維持する。

- STYLE → PAGE → REGION のchunk順
- region conditioning = `STYLE + region text`
- PAGEはregion conditioningへ直接混ぜない
- Global Effect branch = STYLE + PAGE
- `base_mask = 0`
- Exclusive / Overlap
- logical koma number によるregion mapping
- ControlNetはMRPから自動操作しない
- mask downsample / Attention Couple本体は今回触らない

特に mask のdownsample方式等は理論上改良余地があるが、
現時点では生成結果が十分安定している。

ここを変更すると、これまで積み上げた比較テストの基準が崩れるため保留する。

---

# 8. STYLE → PAGE の順序は維持する

今回の検索では、Illustrious / NoobAI系の実運用promptでは
quality/aesthetic系をprompt先頭に置く例が多い。

NoobAI公式model cardでも、推奨prefixは:

```text
masterpiece, best quality, newest, absurdres, highres, safe,
```

のように先頭へ置かれている。

一方、dataset captionの学習時タグ順と、
実際のinference時の推奨prompt順は完全に同じではない。

したがってMRP内部構造として:

1. STYLE / QUALITY
2. PAGE / COMPOSITION
3. REGION CONTENT

を維持するのは妥当。

この順番自体は今回変更しない。

次工程で、同じseed / same ControlNet / same layout を使い、
prompt順だけを変更して比較する。

---

# 9. 次工程: Prompt Order Test

v3.7.6の内部整理が終わった後に行う。

例として以下を比較する。

### Pattern A: Quality first

```text
masterpiece, best quality, newest,
1girl,
character details,
pose,
camera angle,
background
```

### Pattern B: Subject first

```text
1girl,
character details,
pose,
camera angle,
background,
masterpiece, best quality, newest
```

### Pattern C: Illustrious/NoobAI caption寄り

```text
1girl,
character name,
series,
artist/style,
special tags,
general tags,
quality/date tags
```

MRPではSTYLE chunkとregion chunkを分離しているため、

- STYLEが先頭にあること
- region内部で subject / action / camera / background の順序を変えること

を分けてテストする。

---

# 10. 次工程: LoRA Test

最初は2コマでよい。

## Test A: Global LoRA + region trigger

```text
STYLE + <lora:A:0.8> + <lora:B:0.8>
BREAK
2koma
BREAK
koma 1: trigger_A, character A
BREAK
koma 2: trigger_B, character B
```

目的:
- globalに両LoRAが入っていても、MRPのregion promptでどこまで見かけ上分離できるか

## Test B: LoRAタグをregion内へ記述

```text
STYLE
BREAK
2koma
BREAK
koma 1: trigger_A, character A, <lora:A:0.8>
BREAK
koma 2: trigger_B, character B, <lora:B:0.8>
```

目的:
- UI/Raw Prompt parserがLoRAの記載位置を正しく認識できるか
- 実際の生成がAと変わるか
- LoRA本体はglobal activationになることをログで確認する

この比較で「region内へ書くこと自体に意味があるのか」を実測する。

---

# 11. 回帰テスト

## UI

1. 初期化
   - `コマ1（全体）`
2. 初期パネルを2分割
   - `コマ1`
   - `コマ2`
   - `(全体)` は消える
3. さらにSlice
   - 全panel名とlogical numberが一致
4. Drag swap
   - rectは動かない
   - logical number / color / prompt assignmentが交換される
5. Delete
   - 1..Nへ再連番
   - nameも同期
6. Merge
   - nameも同期
7. Undo / Redo
   - name / index / color / mappingが全部同期

## Prompt parser

- 通常N+2 prompt
- region本文が空
- `koma N:` のみ
- regionにLoRAのみ
- STYLEにLoRA
- PAGEにLoRA
- 余分なBREAK
- 足りないBREAK

## 生成

**LoRAを使わない既存promptでは、v3.7.5と生成挙動を変えないこと。**

同seed、同model、同ControlNet、同promptで大きく結果が変わる場合は、
今回の改修範囲を超えている可能性が高いので差分を確認する。

---

# 12. 参考資料

- MRP current source  
  https://github.com/toshinka/tegaki

- sd-forge-couple  
  https://github.com/Haoming02/sd-forge-couple

- sd-webui-regional-prompter  
  https://github.com/hako-mikan/sd-webui-regional-prompter

- kohya sd-scripts / Attention Couple + Regional LoRA  
  https://github.com/kohya-ss/sd-scripts

- ComfyUI Impact Pack regional sampler / regional LoRA  
  https://github.com/ltdrdata/ComfyUI-extension-tutorials

- Krea Multi LoRA for Forge Neo（設計参考。SDXL MRPへ直接移植しない）  
  https://github.com/Adeliox/krea-multi-lora

- NoobAI XL VPred model card  
  https://huggingface.co/Laxhar/noobai-XL-Vpred-1.0

- Illustrious XL v2.0  
  https://huggingface.co/OnomaAIResearch/Illustrious-XL-v2.0

---

# 最終方針

今回のMRPは、生成能力そのものについては既に「内部region分離器として実用域」に入っている。

現状の失敗例を見て、Attention Coupleをさらに複雑化して解決しようとしないこと。

次にやるべきことは:

1. UI metadataの残留バグを除去
2. BREAK slot parserを堅牢化
3. LoRAの元記載位置を保存
4. 「region LoRAに見えても現状はglobal activation」であることを診断可能にする
5. その状態でprompt順テストとLoRA実測へ進む

真のRegional LoRAは別フェーズの研究課題とする。
