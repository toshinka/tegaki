# MRP v3.7.7 最終整合性ブラッシュアップ 改修指示書
## Slot契約の完全統一 / Preflight強化 / 生成コア凍結

対象リポジトリ:
- `toshinka/tegaki`
- `EasyReforgeExtension`

基準版:
- `main`
- commit `c122650`
- MRP v3.7.6 Internal Consistency & LoRA Scope Diagnostics

主対象:
- `EasyReforgeExtension/javascript/manga_canvas.js`
- `EasyReforgeExtension/scripts/manga_prompter.py`

原則として触らない:
- `EasyReforgeExtension/scripts/manga_attention.py`
- `EasyReforgeExtension/scripts/manga_spatial_engine.py`

---

# 0. 今回の位置づけ

MRP v3.7.6 の実機テストでは、以下がすでに確認できている。

- MRP単体でも複数コマ間の概念・色・物体の混線をかなり抑制できる。
- コマ枠ControlNetを併用すると、4～6コマ程度でもページ形状・コマ境界をかなり安定して固定できる。
- 多コマ時の「指定したページ形状そのもの」は、Attention Coupleだけで完全固定するよりControlNetへ任せる方が合理的。
- 出にくい概念・動作・アングルは、MRPの領域分離よりcheckpoint / LoRA側の理解度がボトルネックになり始めている。
- Region内に `<lora:...>` を書いた場合も、現行A1111/Forge系Extra NetworksではLoRA本体はグローバル適用であり、MRPが局所化できるのは主としてregion prompt / trigger側である。
- 真のRegional LoRAは別方式（Latent mode、region別model pass、adapter deltaの空間ゲート等）が必要で、現行reForge向けMRPへ無理に混ぜる段階ではない。

したがって今回の目的は、**生成能力をさらに無理に押し上げることではない。**

現在コードを点検した結果、生成コアは「大改造すべき段階」ではない一方、v3.7.6で定めた内部契約に対して、まだ少数の整合性漏れが残っている。

今回やるべきことは、その残りだけを直してから生成コアを一旦凍結し、次工程の

1. Prompt Order Test
2. LoRA実測
3. 漫画スタイルテンプレート整備

へ進むことである。

---

# 1. 結論

## 必須改修は2点のみ

### A. 「テンプレ枠を挿入」処理も空slot保持に統一する

v3.7.6では、通常のメインプロンプト解析は空slotを保持するよう修正済み。

しかし現行 `manga_canvas.js` の

```javascript
window.mangaPrompterInsertTemplateToMainPrompt
```

内部には、まだ次の形式が残っている。

```javascript
const chunks = curVal
    .split(/\bBREAK\b/i)
    .map(c => c.trim())
    .filter(c => c.length > 0);
```

これはv3.7.6で禁止した「空slot削除」である。

通常利用では表面化しにくいが、例えば

```text

BREAK
2koma
BREAK
koma 1: 1girl
BREAK
koma 2: 1boy
```

のようにSTYLEを意図的に空にした状態でテンプレート再挿入を行うと、

- `2koma` がSTYLE扱いになる
- 後続slotが左詰めされる

可能性がある。

### 修正方針

`parseMainPrompt()` と同じく、テンプレート挿入処理も

```javascript
const rawSlots = curVal
    .split(/\bBREAK\b/i)
    .map(c => c.trim());
```

のように**空slotを保持する**。

少なくとも:

- slot 0 = STYLE
- slot 1 = PAGE
- slot 2.. = REGION

の位置契約を壊さないこと。

テンプレート挿入時に既存region本文を残すか消すかは、現行UI仕様を維持してよい。
今回の目的は「内容保存機能の追加」ではなく、**slot位置を誤認しないこと**である。

---

### B. `koma N:` ラベルと「slot位置」のSource of Truthを統一する

現在、PythonバックエンドとJavaScriptプレビューで挙動が完全には一致していない。

#### Python側

`manga_prompter.py` の `after_extra_networks_activate()` は、

```python
raw_region = region_chunks[i]
clean_region = tag_regex.sub("", raw_region).strip()
```

としており、**実際の適用先はregion chunkの位置 `i` が基準**。

つまり:

```text
BREAK
koma 2: apple
BREAK
koma 1: car
```

と書いても、backendは

- 最初のregion slot → logical koma 1
- 次のregion slot → logical koma 2

として扱う。

`koma N:` は除去されるだけで、mappingには使われていない。

#### JavaScript側

一方 `parseMainPrompt()` は、明示された `koma N:` を読んで

```javascript
if (numStr) pNum = parseInt(numStr, 10);
regions[pNum] = cleanText;
```

としている。

このため、ユーザーがslot順と異なる番号を書いた場合、

**右側プレビューが示す対応先と、実際の生成時の対応先が食い違う可能性がある。**

これは生成アルゴリズムの問題ではなく、最後に残った内部契約の不一致である。

---

# 2. 今回採用する契約

## Source of Truth = BREAK slot位置

v3.7.6で導入した「N+2 slotの位置保持」を最優先とする。

正式な意味は次の通り。

```text
slot 0 = STYLE
slot 1 = PAGE
slot 2 = logical koma 1
slot 3 = logical koma 2
slot 4 = logical koma 3
...
```

`koma N:` / `[コマN]` / `panel N:` 等の文字列は、

**mapping命令ではなく、人間向けの可読ラベル兼整合性チェック用アノテーション**

とする。

理由:

1. 既存Python backendがすでにslot位置をSource of Truthとして安定動作している。
2. Logical Koma Reassignmentは「物理region ↔ logical number」を交換する方式で、region promptのslot順を維持した方が単純。
3. Extra Networks処理後に本文が空になってもslot位置は維持できる。
4. ラベルをmapping命令にすると、重複番号・欠番・手動並べ替え等の追加ルールが必要になり、現時点では複雑化の利益が小さい。

---

# 3. JavaScript側の修正

`parseMainPrompt()` を以下の考え方に変更する。

現在:

```javascript
let pNum = i - 1;

const match = chunk.match(tagRegex);
if (match) {
    const numStr = match[3] || match[4];
    if (numStr) pNum = parseInt(numStr, 10);
    cleanText = chunk.replace(tagRegex, '').trim();
}

regions[pNum] = cleanText;
```

推奨:

```javascript
const expectedKoma = i - 1;
let declaredKoma = null;

const match = chunk.match(tagRegex);
if (match) {
    const numStr = match[3] || match[4];
    if (numStr) declaredKoma = parseInt(numStr, 10);
    cleanText = chunk.replace(tagRegex, '').trim();
}

regions[expectedKoma] = cleanText;
```

別途:

```javascript
labelDiagnostics[expectedKoma] = {
    expected: expectedKoma,
    declared: declaredKoma,
    mismatch: declaredKoma !== null && declaredKoma !== expectedKoma
};
```

のような診断情報を保持する。

既存 `parsedPrompt` に追加してよい。

例:

```javascript
parsedPrompt: {
    style: '',
    page: '',
    regions: {},
    rawSlotsCount: 0,
    loraScopes: { style: [], page: [], regions: {} },
    labelDiagnostics: {}
}
```

---

# 4. Preflightを「slot数 + label整合性」まで拡張する

現行Preflightは:

- panel数
- actual slot数
- expected = N + 2

を確認できている。

ここに軽量なラベル診断だけ追加する。

## 正常

```text
✓ 整合性OK (5コマ / 7スロット)
```

## ラベル不一致あり

例:

```text
⚠ コマラベル不一致: 第1region slot は koma 1 用ですが "koma 2:" と記述されています
```

または簡潔に:

```text
⚠ Label mismatch: slot koma 1 / declared koma 2
```

### 方針

- ラベル不一致だけなら生成停止は必須ではない。
- ただし、ユーザーがUIとbackendで別の対応を想像しないように明示する。
- 実際の生成mappingは必ずslot位置を使用する。
- 勝手にchunkを並べ替えない。
- 勝手にラベルを書き換えない。

### 重複ラベル

例えば:

```text
koma 1: cat
BREAK
koma 1: dog
```

も、

```text
⚠ duplicate / mismatched labels
```

として警告できればよい。

ただし生成mapping自体は:

- slot 2 → koma 1
- slot 3 → koma 2

のまま。

---

# 5. Python側にも同じ診断を入れる

`after_extra_networks_activate()` でregion chunkを読む際、ラベルを単に除去する前に番号を取得する。

概念例:

```python
match = tag_regex.match(raw_region)
declared_koma = None

if match:
    num_str = match.group(3) or match.group(4)
    if num_str:
        declared_koma = int(num_str)

expected_koma = i + 1

if declared_koma is not None and declared_koma != expected_koma:
    print(
        f"[MangaPrompter][WARN] Region label mismatch: "
        f"slot expects koma {expected_koma}, "
        f"declared koma {declared_koma}. "
        f"Slot position is authoritative."
    )
```

その後は従来通り:

```python
clean_region = tag_regex.sub("", raw_region).strip()
```

としてよい。

### 重要

**ここでregionを並べ替えない。**

今回の目的はbackend仕様変更ではなく、
JavaScript / Python / UI表示の契約を一致させること。

---

# 6. LoRA処理は変更しない

v3.7.6で導入したLoRA Scope Diagnosticsは維持する。

以下は変更しない。

- `<lora:...>` のExtra Networks activation
- `raw_prompt_before_extra_networks`
- `raw_extra_network_scopes`
- region内LoRA警告
- region triggerのAttention局所化
- 「LoRA本体はglobal activation」という現在の説明

## 真のRegional LoRAは今回実装しない

以下は今回のNon-Goal。

- regionごとのUNet clone
- regionごとのN回sampling
- Latent modeの新規移植
- LoRA deltaのmask乗算
- Forge / reForge内部LoRA patcherの置換
- LoRA loaderの独自再実装

一般的なAttention Coupleでは、prompt conditioningの空間制御とLoRA weight deltaの空間制御は別問題である。

現時点のMRPは前者を十分実用的に実装している。
後者を追加するために安定した生成コアを崩さないこと。

---

# 7. Attention / Spatial Engineは凍結する

今回、以下は変更しない。

## `manga_attention.py`

- `attn2_patch`
- `attn2_output_patch`
- mask downsample
- LCM token handling
- positive / negative branch処理
- `base_mask = 0` 前提
- mask normalization

## `manga_spatial_engine.py`

- Exclusive
- Overlap
- zIndexくり抜き
- rectangular mask生成

実機結果では、現在の失敗の多くが:

- モデルが対象を知らない
- 動作・アングルが弱い
- 多コマpage geometryがモデルだけでは維持しにくい
- 一コマ内の複数subjectをモデルが別panel化しようとする

といった生成モデル側の挙動になっている。

これらをAttention engine改造で全て吸収しようとしないこと。

---

# 8. Global Effectの意味も今回は変更しない

現在:

- Region conditioning = `STYLE + region`
- Global Effect branch = `STYLE + PAGE`
- Global Effect初期値 = `0.25`

という構成になっている。

理論的には:

- STYLEをregionとglobalの両方へ入れるため重複感がある
- mask normalization後の `0.25` は単純な「画像の25%」を意味しない
- Overlap領域ではglobal branchの相対寄与率が変化する

等の議論は可能。

しかし、これらはすでに大量の実機テストで現在値が基準化されている。

今回は変更しない。

必要なら将来:

```text
Global Effect Weight = 数学的な絶対mix率
```

へ再定義する研究は別フェーズにする。

---

# 9. 任意のメタデータ整理

機能変更ではないが、外部AIレビュー時の混乱防止として、
ファイル先頭コメントのversion表記だけ整理してもよい。

現在例:

```text
manga_attention.py: v3.7.1 Diagnostic Reset
manga_spatial_engine.py: v3.7.4
```

実装自体を変更しない場合は、

```text
Core unchanged; validated with MRP v3.7.7
```

など、コードロジックのバージョンとMRP全体バージョンを混同しない表記にする。

これは任意。
このためだけにコード差分を大きくしない。

---

# 10. 必須回帰テスト

## Test 1: 通常2コマ

```text
simple clean illustration
BREAK
2koma
BREAK
koma 1: red sports car
BREAK
koma 2: green apple
```

期待:

- Preflight OK
- 左右のlogical mappingが従来通り
- v3.7.6と生成挙動を変えない

---

## Test 2: STYLE空slot

```text

BREAK
2koma
BREAK
koma 1: red sports car
BREAK
koma 2: green apple
```

期待:

- STYLE = empty
- PAGE = `2koma`
- region 1/2の位置がずれない
- テンプレ枠再挿入を行っても `2koma` がSTYLEへ昇格しない

---

## Test 3: PAGE空slot

```text
simple clean illustration
BREAK

BREAK
koma 1: red sports car
BREAK
koma 2: green apple
```

期待:

- STYLE維持
- PAGE empty
- region mapping維持

---

## Test 4: Region本文空

```text
simple clean illustration
BREAK
2koma
BREAK
koma 1:
BREAK
koma 2: green apple
```

期待:

- 5 slotsを保持
- region 1を削除してregion 2を左詰めしない

---

## Test 5: ラベルとslotを意図的に逆転

```text
simple clean illustration
BREAK
2koma
BREAK
koma 2: red sports car
BREAK
koma 1: green apple
```

期待:

- Preflightにlabel mismatch警告
- UIプレビューはslot positionを基準に表示
- backendもslot positionを基準に適用
- UIとbackendが一致
- 自動並べ替えはしない

---

## Test 6: ラベル無し

```text
simple clean illustration
BREAK
2koma
BREAK
red sports car
BREAK
green apple
```

期待:

- 正常動作
- slot 2 = koma 1
- slot 3 = koma 2
- ラベル警告なし

---

## Test 7: Region内LoRA

```text
simple clean illustration
BREAK
2koma
BREAK
koma 1: 1girl, <lora:test:1>
BREAK
koma 2: 1girl
```

期待:

- LoRA Scope Diagnosticsはv3.7.6と同じ
- Region 1にLoRAタグが書かれていたことを検出
- UI警告表示
- 「LoRA本体はglobal activation」という説明を維持

---

## Test 8: Logical Koma Drag Swap

1. 2コマ作成
2. `koma 1: car`
3. `koma 2: apple`
4. 右側☷で番号交換

期待:

- 物理矩形は移動しない
- logical number / color / prompt適用先だけ交換
- メインprompt本文は書き換えない
- Preflightは正常
- backend mappingもUI表示と一致

---

# 11. 完了条件

以下を満たしたらv3.7.7は完了。

- 通常生成の絵がv3.7.6から不必要に変わらない
- 空BREAK slotを全パーサ経路で保持する
- テンプレ挿入だけ古い `.filter(...)` を使う不整合が消える
- `koma N:` とslot位置が食い違った際、UI/backendで解釈が分裂しない
- slot positionを唯一のmapping Source of Truthとして明文化
- LoRA診断を壊さない
- Attention / Spatial Engineを変更しない
- ControlNet連携を変更しない

---

# 12. 今回やらないこと

以下は「できない」ではなく、**費用対効果と破壊リスクを考えて今はやらない**。

- Attention Coupleの全面再設計
- Prompt-ex / semantic maskの導入
- 自動subject segmentation
- per-panel true LoRA
- panelごとのcheckpoint
- panelごとのsampler
- panelごとのControlNet自動設定
- arbitrary polygon maskへの大改造
- 自動漫画ネーム理解
- AIによるpanel geometry自動生成

これらは将来の別フェーズ。

---

# 13. 改修後に進むテスト

v3.7.7完了後は、生成コアの改修を一旦止める。

次は実験フェーズへ移る。

## A. Prompt Order Test

同seed / 同checkpoint / 同ControlNet / 同layoutで、

- quality first
- subject first
- Illustrious系タグ順
- natural-language寄り
- camera / action / backgroundの順序違い

を比較する。

## B. LoRA Test

最初は2コマ。

- global LoRA + region trigger
- region内にLoRAタグを記載
- LoRA A / B同時global activation + 各region trigger
- style LoRA
- character LoRA
- effect / pose LoRA

を比較する。

目的は「真のregion LoRA」を証明することではなく、

**MRPのregional text conditioningによって、globalに読み込まれたLoRAの発火先をどこまで実用上分離できるか**

を測ること。

---

# 14. 最終方針

MRPは現時点で、A1111 / Forge / reForge系のAttention Couple方式としては、
生成コアをさらに複雑化するより、モデル・ControlNet・prompt設計側を詰める段階に入っている。

特に漫画用途では、

- 漫画ページ専用コマ割りキャンバス
- 日本式読み順
- 自由スライス
- Exclusive / Overlap
- コマ番号と物理位置の分離
- 番号ドラッグ交換
- STYLE / PAGE / REGIONのN+2 slot
- ControlNet用コマ枠PNG
- Prompt Preflight
- LoRA Scope Diagnostics

が一つのUIへ統合されていること自体が大きな価値である。

ここから先は「機能を増やせば必ず良くなる」領域ではない。

**v3.7.7では最後の内部整合性だけ直し、Attention生成コアは凍結すること。**

そのうえでPrompt Order / LoRA / 漫画テンプレートの実測へ移行する。
