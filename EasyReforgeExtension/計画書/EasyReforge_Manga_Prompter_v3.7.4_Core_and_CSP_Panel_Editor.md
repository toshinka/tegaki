# EasyReforge Manga Prompter
# v3.7.4 改修指示書
## Regional Core 継続診断 + CLIP STUDIO PAINT参考コマ編集ブラッシュアップ版

作成日: 2026-09-02  
対象環境: **Zuntan03/EasyReforge** 内 `stable-diffusion-webui-reForge`  
対象拡張: `EasyReforge Manga Prompter / Manga Region Prompter`  
前提版: v3.7.3 Global Effect 系ローカル実装  
実装担当想定: Gemini Antigravity / ローカルコーディングエージェント  

---

# 0. この版の優先順位

v3.7.4では優先順位を明確に固定する。

```text
最優先:
Regional Prompt の内部構造・意味分離の継続ブラッシュアップ

次:
コマ割りキャンバスの編集機能を
CLIP STUDIO PAINTのコマ枠操作を参考に実用品へ近づける

対象外:
ControlNetへ画像を自動送信する機能
```

ControlNetについては、
現在ユーザーが

```text
コマ枠をスクリーンショット
↓
ControlNet入力へペースト
```

するだけで実用上の負担をほとんど感じていない。

したがって、

```text
「現在のコマ割りをControlNetへ送る」
「ControlNet画像を自動生成して転送」
「ControlNet設定を自動変更」
```

等には開発リソースを使わない。

ControlNetはあくまで、

```text
現在のManga Region Prompterが
レイアウトガイドと併用可能であることを確認できた
```

という既知良好の補助手段として扱う。

---

# 1. 現状の実験から確認できたこと

現時点の手動生成実験では以下が確認されている。

## 1.1 Manga Region Prompter は完全無反応ではない

以下の傾向がある。

```text
上下2領域
→ Region Promptの位置交換が比較的反映される

Region Weight
→ 主役 / 脇役の存在感に影響している気配がある

ControlNet併用
→ コマ構造をControlNetが保持した状態で、
  Manga Region Prompterが内容差を追加する効果が見える
```

したがって、

```text
Attention Hookが全く動いていない
```

という段階ではない。

---

# 2. 現在残っている主問題

## 2.1 左右分離が上下分離より弱い

1024x1024でも、

```text
R1 = red sports car
R2 = green apple
```

を左右配置した場合、

```text
car + appleを1枚の構図へまとめる
```

傾向が強い。

一方で上下配置では、

```text
上 / 下
```

という構造を作ろうとする傾向が比較的強い。

---

## 2.2 Promptは「別々の場面」より「同じ絵の素材」として混ざりやすい

典型:

```text
リンゴの上 / 下に車
車の上にリンゴ
同じ車を複数出す
車とリンゴを一つの構図へまとめる
```

これは、

```text
Region Promptが消えている
```

というより、

```text
Region Promptの意味が存在するが、
semantic isolationが弱い
```

状態と見る。

---

## 2.3 小領域は小物化しやすい

大きいRegionと小さいRegionを作ると、
小RegionのPrompt内容が、

```text
アクセサリ
小物
遠景
添え物
```

として吸収される傾向がある。

これは将来4～6コマへ進む際に重要になる。

---

# 3. ControlNet併用実験の意味

現在のControlNet併用では、

```text
ControlNet
→ パネル境界 / レイアウト

Manga Region Prompter
→ 各領域の意味差
```

という役割分担に有効性が見えた。

Manga Region Prompter OFFでは
ControlNetが作った複数領域へ
同じ車が繰り返されるケースがあった。

Manga Region Prompter ONでは、
同じレイアウト上で、

```text
apple / car
```

の内容差が明確になるケースがあった。

これは重要な成果である。

ただしv3.7.4では、
この結果を理由にControlNet依存へ設計を変更しない。

まずRegional単体を可能な範囲で詰める。

---

# 4. v3.7.4のCore目標

## 最低目標

2Regionで、

```text
Region A
Region B
```

の位置を変えると、
Prompt内容の主位置もそれに追従すること。

特に左右分割での改善余地を調査する。

---

## 望ましい目標

```text
上下
左右
大小
一部重複
```

で、

```text
Region geometry
↕
Promptの主位置
```

の対応が現在より明確になること。

---

# 5. Coreで「今すぐ」してはいけないこと

原因が特定できる前に、
以下を一度に追加してはいけない。

```text
位置語の自動prompt追加
left / right / upper / lowerの自動注入

Regional negative prompt

別sampler

Latent Couple

MultiDiffusion

Regional Prompter本体の埋め込み

ComfyUI方式

IP-Adapter regional

ControlNet自動連携
```

特に、

```text
左右が弱い
↓
自動的に "left side" "right side" を入れる
```

はまだ行わない。

これは後の補助策候補であり、
現在のmask / Attention構造の性能を見えにくくする。

---

# 6. v3.7.4 Core Phase A
# 現在のworking stateを固定する

編集前に必ずローカル状態を記録する。

```bash
git status --short
git rev-parse HEAD
git branch --show-current
```

可能なら現在動作している状態をcommitする。

例:

```bash
git add EasyReforgeExtension
git commit -m "checkpoint: before v3.7.4 core and panel editor"
```

現在のv3.7.3相当のworking stateを失わないこと。

---

# 7. Core Phase B
# ローカル実装の正確な確認

作業前に以下を実際に開く。

## Manga Prompter

```text
EasyReforgeExtension/scripts/manga_prompter.py
```

確認する関数:

```text
after_extra_networks_activate
process_before_every_sampling
```

確認項目:

```text
PAGE
STYLE
Global Effect
Region conditions
Global Effect Weight
base_mask
cond_N / mask_N mapping
```

---

## Manga Attention

```text
EasyReforgeExtension/scripts/manga_attention.py
```

確認:

```text
patch_unet
attn2_patch
attn2_output_patch
mask normalization
```

不変条件:

```text
k_target ↔ base_mask

cond_1 ↔ mask_1
cond_2 ↔ mask_2
...
```

---

## Spatial Engine

```text
EasyReforgeExtension/scripts/manga_spatial_engine.py
```

現在公開コードでは、

```python
mask[:, :, y1:y2, x1:x2] = 1.0
```

により矩形maskを作る。

また、

```python
if z_j > z_i:
    mask_i = mask_i * (1.0 - item_j['mask'])
```

によって、
高いzIndexのRegionを低いzIndexからくり抜く処理が存在する。

この仕様は後述する
Exclusive / Overlapモードと直接関係する。

---

# 8. Core Phase C
# local Forge CoupleをOracleとして再利用する

現在のEasyReforgeに存在する、

```text
Forge Couple v4.0.2
```

を更新せずに参照する。

同じ:

```text
Checkpoint
Resolution
Seed
Sampler
Steps
CFG
Prompt
```

で2Regionテストを行う。

比較するのは、

```text
Manga Region Prompter

vs

local Forge Couple
```

である。

---

# 9. Core Oracle Test

1024 x 1024。

最初はGlobal LoRAなし。

ControlNetなし。

Prompt:

```text
split composition
BREAK
simple clean illustration
BREAK
koma 1: red sports car, side view, isolated object
BREAK
koma 2: green apple, isolated object
```

---

## 9.1 上下

```text
R1 = 上
R2 = 下
```

次にSwap。

---

## 9.2 左右

漫画順の番号規則は現行通りでもよいが、
ログに、

```text
Panel 1 rect
Panel 2 rect
```

を必ず出す。

次にSwap。

---

# 10. Oracle判定

## Case A

```text
Forge Couple左右 = 良好
Manga左右 = 弱い
```

なら、

```text
モデル限界
```

と決めつけない。

local Forge Coupleとの、

```text
condition shape
mask reshape
mask interpolation
cond ordering
output merge
dtype
```

の差を調査する。

---

## Case B

```text
Forge CoupleもMangaも左右が弱い
```

なら、

モデル / checkpointの構図prior寄りと考える。

この場合はCoreを無理に大改造しない。

---

## Case C

```text
Mangaだけ上下に強く、
Forge Coupleは上下左右同程度
```

なら、
Manga実装のX/Y処理差を再調査する。

---

# 11. Core Phase D
# Global Effectを壊さない

v3.7.3で導入された
Global Effect branchがローカルに存在する場合、
v3.7.4のUI改修で壊してはいけない。

最低限ログ:

```text
GLOBAL
mask = fullscreen * global_weight

REGION 1
mask = ...

REGION 2
mask = ...
```

を維持する。

---

# 12. Core Phase E
# 2つの「領域関係モード」を導入する

今回のUI改修は、
単なる見た目の編集ではなく、
Region maskの意味にも関係する。

新しい概念:

```text
A. Panel / Exclusive
B. Overlap / Blend
```

を導入する。

---

# 13. Panel / Exclusive Mode

用途:

```text
漫画の別コマ
見つめ合いを別カットとして分離
背景が異なる別シーン
干渉させたくないRegion
```

考え方:

```text
隣接パネルの境界は共有する
境界を動かすと双方が追従する
原則としてRegionを重ねない
```

UI表示候補:

```text
🔗 コマ連結
```

または:

```text
[コマ分離]
```

---

# 14. Overlap / Blend Mode

用途:

```text
二人が肩を組む
二人が近接する
同じ場所で人物を重ねたい
foreground / backgroundを意図的に混ぜたい
```

考え方:

```text
各Regionを独立移動・独立リサイズできる
Region同士を重ねられる
重複部分では複数Region conditioningが共存する
```

UI表示候補:

```text
◫ 重なり許可
```

または:

```text
[人物重なり]
```

---

# 15. このモードは「見た目だけ」にしない

現在のSpatial Engineでは、
zIndexが高いRegionを
下のRegionから自動的にくり抜く。

これはカットインには適するが、

```text
人物A Region
+
人物B Region
↓
重なり部分で両方効かせる
```

用途には不適切。

したがって、
Overlap Modeでは、

```text
Z-Index cutoutを行わない
```

こと。

---

# 16. Spatial Engineの新仕様

後方互換を維持する。

現在JSONはpanel list。

各panelへ、

```json
{
  "interactionMode": "exclusive"
}
```

または:

```json
{
  "interactionMode": "overlap"
}
```

を付けてよい。

全panelへ同じ値を保持する。

旧JSONにこのpropertyがない場合:

```text
exclusive
```

をdefaultとする。

---

# 17. generate_spatial_masks() のモード処理

概念:

```python
mode = panels[0].get("interactionMode", "exclusive")
```

### exclusive

現在のZ-Index cutoutロジックを維持してよい。

### overlap

```python
final mask = raw mask
```

として、
zIndex cutoutを行わない。

---

# 18. 注意
# Attention正規化は残す

Overlap Modeでmaskが重なると、
現在のAttention Couple側の

```text
mask / sum(mask)
```

によって、
重複部分でconditioningが混合される。

これは意図した動作である。

v3.7.4でAttention merge式を同時に変更しない。

---

# 19. Core Regression Test

interactionMode追加後に、
必ず既存2Regionテストを再実行する。

### exclusive

```text
上下 car / apple
左右 car / apple
```

### overlap

50%程度重なる2矩形。

```text
R1 = red sports car
R2 = green apple
```

ここでは生成品質より、

```text
Overlap Modeで両Regionのmaskが重複したログになる
```

ことをまず確認する。

---

# 20. UI改修の設計原則

v3.7.4のPanel Editorは、
CLIP STUDIO PAINTのコマ枠機能から、

```text
明示的な「枠線分割ツール」
オブジェクトツールによるコマ枠編集
隣接コマ枠の連動リサイズ
コマ間隔 / 境界の操作
```

という操作思想を参考にする。

ただしCLIP STUDIO PAINTを丸ごと再現しない。

必要な要素だけ借りる。

---

# 21. CLIP STUDIO PAINT参考事項

公式マニュアル上、
CLIP STUDIO PAINTには明示的な、

```text
枠線分割
```

ツールが存在する。

ドラッグ中は新しいコマ境界がpreviewされ、
releaseすると分割される。

また分割形状には、

```text
直線
折れ線
スプライン
```

等がある。

v3.7.4では矩形Regionのみなので、
直線ベースだけを参考にする。

---

# 22. CLIP STUDIO PAINT参考事項
# 隣接コマ連動

CLIP STUDIO PAINTでは、
Object Toolでコマのhandleを動かすと、

```text
隣接するコマ枠が連動して大きさを変更
```

できる。

現在Manga Canvasにもすでに、

```javascript
renderGutters()
startGutterDrag()
```

が存在し、

隣接する2panelの共通境界をドラッグすると、

```text
panelAが伸縮
panelBも逆方向へ伸縮
```

する原型がある。

この既存処理を捨てずに整理する。

---

# 23. 現在のSlice実装の問題

公開 `manga_canvas.js` では、

```text
drawRect以外のcanvas drag
```

が暗黙的にsliceとして扱われる。

つまり、

```text
Select Mode
```

と

```text
Slice Mode
```

が明示的に分かれていない。

これは操作として分かりにくい。

---

# 24. Slice Toolを明示的にする

State:

```javascript
toolMode:
  'select'
  'slice'
  'drawRect'
```

を明確に持つ。

---

# 25. Toolbar

最低限:

```text
🖱 選択・編集

✂ スライス

▭ 矩形コマ

＋ 横分割

＋ 縦分割

🔗 コマ連結 / ◫ 重なり許可

🔗 コマ結合
```

とする。

---

# 26. 入れ子専用ボタンを削除

現在の、

```text
カットイン（入れ子）
```

専用ボタンは削除してよい。

理由:

```text
矩形コマ
+
Overlap Mode
```

で任意の小Regionを作れるため。

専用の「中央50%に入れ子を作る」固定処理は、
UIを複雑にする割に用途が限定的。

---

# 27. 横分割 / 縦分割 quick button は残す

現在の、

```text
選択中panelを50:50に分割
```

は便利なので残す。

これは、

```text
素早く基本レイアウトを作る
```

用途。

Slice Toolは、

```text
自由な位置で比率を決める
```

用途として分ける。

---

# 28. Select ModeでSliceしない

現在のコードでは、

```javascript
if (state.mode === 'drawRect') {
   ...
} else {
   state.sliceLine = ...
}
```

となっている。

これを禁止。

新仕様:

```text
select
→ 選択 / 境界編集 / panel移動

slice
→ slice line

drawRect
→ rectangle creation
```

にする。

---

# 29. Slice Modeの明示状態

Slice buttonを押すと、

```text
✂ スライス中 (解除)
```

などに変化させる。

cursorも、

```text
crosshair
```

へ変更する。

Selectへ戻すと通常cursorへ戻る。

---

# 30. Sliceの現行target判定を廃止

現在:

```python
line midpoint
↓
そのmidpointを含むpanel
```

でtargetを決めている。

これは不十分。

理由:

```text
線が複数panelへ少しかかる
中央panelだけを切りたい
線の始点終点がpanel外にない
```

等で誤判定する。

---

# 31. 新Slice Candidate判定

line segmentと
各panel rectangleの交差量を計算する。

推奨:

```text
Liang-Barsky
```

等の矩形line clippingを使う。

外部ライブラリは不要。

---

# 32. Slice方向

line:

```text
dx = end.x - start.x
dy = end.y - start.y
```

### abs(dx) >= abs(dy)

```text
横方向の線
→ 上下にpanelを分割
```

### abs(dy) > abs(dx)

```text
縦方向の線
→ 左右にpanelを分割
```

出力panelは引き続き矩形とする。

斜め線で斜めコマを作る機能はv3.7.4対象外。

---

# 33. Slice Coverage

各候補panelについて、
panel内へclipされた線分を求める。

### 横方向Slice

```text
coverage =
panel内のlineのX方向投影長
/
panel width
```

### 縦方向Slice

```text
coverage =
panel内のlineのY方向投影長
/
panel height
```

---

# 34. 80%ルール

default:

```text
SLICE_COVERAGE_THRESHOLD = 0.80
```

coverage >= 0.80 のpanelだけを
strong candidateとする。

これにより、

```text
隣のpanelへ線が少しかかった
```

だけでは切断対象にならない。

---

# 35. 80%未満でも「選択中panel」へ反応できるfallback

ユーザーは、

```text
対象panelを完全に横断しなくても切りたい
```

ため、
完全80%必須にはしない。

fallback:

```text
strong candidateなし
+
primary selected panelがlineと交差
+
coverage >= 0.40
```

なら、
primary selected panelをtargetとしてよい。

default:

```text
SELECTED_PANEL_FALLBACK = 0.40
```

---

# 36. 複数strong candidateがある場合

優先順位:

```text
1. primary selected panelが候補ならそれ

2. coverage最大

3. 同率ならdrag方向で最初に大きく横切ったpanel
```

一度のdragで、
原則1panelだけ切る。

これにより、
他のpanelへ少し線がかかっても安全。

---

# 37. Slice Preview

drag中に、

```text
target候補panelを強調
```

する。

例:

```text
対象panel border = orange

予定cut line = red dashed
```

coverageが足りない場合:

```text
gray dashed
```

など。

---

# 38. Cut Position

target panel内へclipされたlineの
中点を使う。

横Slice:

```text
cutY
```

縦Slice:

```text
cutX
```

minimum panel size:

```text
0.05
```

を維持してよい。

---

# 39. Slice後

元panelの、

```text
weight
interactionMode
zIndex
```

を新panelへ継承する。

Promptの扱いは現状維持。

新panelには新しいindexが割り振られ、
Main Prompt Template上では対応する

```text
koma N:
```

が追加可能であること。

---

# 40. Slice Modeはrelease後も維持

CLIP STUDIO PAINTのツール感に近づけるため、

1回切ったら自動でSelectへ戻さない。

```text
Slice Toolを解除するまで
連続して複数panelを切れる
```

ようにする。

これは3～6コマ作成で重要。

---

# 41. Draw Rect Modeも明示的にする

現在の矩形ドラッグ作成は
1個作った後Selectへ戻っている。

v3.7.4では、
設定として、

```text
continuous tool
```

にしてよい。

最低限、
button状態が明示的ならよい。

---

# 42. Panel Edit Mode
# Linked / Overlap Toggle

Toolbarへ、

```text
🔗 コマ連結
```

と

```text
◫ 重なり許可
```

を切替可能な1ボタンまたは2択toggleで追加する。

---

# 43. Linked Mode

default。

既存 `renderGutters()` を利用する。

共通境界にhandleを表示する。

dragで、

```text
片方が広がる
↓
隣が同量縮む
```

こと。

---

# 44. Linked Modeをpairwiseからboundary groupへ拡張

現在は、

```text
panelA / panelB
```

の2枚だけを動かす。

4～6コマの漫画では、

```text
上段左 | 上段右
中段左 | 中段右
下段左 | 下段右
```

の共通中央境界を
一度で動かしたい場合がある。

したがって、
可能ならv3.7.4で

```text
collinear shared gutters
```

をグループ化する。

---

# 45. Boundary Group判定

Vertical boundary:

```text
xがthreshold内で一致
```

Horizontal boundary:

```text
yがthreshold内で一致
```

さらに、
各segmentが連続またはほぼ接続している場合、
同じboundary groupとして扱う。

---

# 46. Group Gutter Drag

例:

```text
┌─────┬────────┐
│ A   │ B      │
├─────┼────────┤
│ C   │ D      │
├─────┼────────┤
│ E   │ F      │
└─────┴────────┘
```

中央boundaryをdrag:

```text
A,C,E の右端
+
B,D,F の左端
```

を一度に移動。

ユーザーが6回panelを調整する必要をなくす。

---

# 47. Group Gutterの安全条件

各panelのminimum size:

```text
5%
```

を守る。

どれか1つでもminimumを割る移動はclampする。

---

# 48. Overlap Mode

Overlap Modeでは
shared gutter resizeを無効にする。

代わりに選択panelを、

```text
移動
個別リサイズ
```

できるようにする。

---

# 49. Overlap ModeのPanel Move

selected panel内部をdrag:

```text
panel rect x/y
```

を変更。

canvas外へ完全に出ないようclamp。

---

# 50. Overlap ModeのResize Handle

最低限:

```text
左
右
上
下
```

4 edge handle。

望ましくは:

```text
NW
NE
SW
SE
```

を含む8handle。

CLIP STUDIO PAINTのObject Toolのように、
選択中panelだけにhandleを表示する。

---

# 51. Overlap Modeでは重なりをclampしない

他panelとのintersectionを許可する。

これが機能の本体。

例:

```text
Person A Region
      ┌────────┐
      │        │
      │   ┌────┼────┐
      │   │    │    │
      └───┼────┘    │
          │ Person B│
          └─────────┘
```

重複部分は
Spatial Engine overlap modeによって
両conditioningを保持する。

---

# 52. Linked Modeへ戻す時

Overlap Modeで既に重なっているpanelがある場合、
Linkedへ切り替えた瞬間に
勝手にgeometryを破壊しない。

警告:

```text
「重なっているコマがあります。
コマ連結モードでは新しい重なりを作りませんが、
現在の位置は保持します。」
```

程度でよい。

自動整列はしない。

---

# 53. Interaction ModeとPromptの意味

このtoggleは単なる編集UXではなく、
生成時maskにも反映する。

### Linked / Exclusive

```text
別コマ
意味干渉を減らしたい
```

### Overlap / Blend

```text
同一シーン
人物同士を近づける
意味を部分的に混ぜたい
```

としてUIヘルプへ短く記載する。

---

# 54. 「肩を組む」例

Overlap:

```text
Region A:
1girl, black hair

Region B:
1girl, blonde hair
```

矩形を20～30%程度重ねる。

意図:

```text
共通領域で人物conditioningを混ぜる余地を作る
```

厳密に肩を組む保証はしない。

---

# 55. 「見つめ合う」例

Linked / Exclusive:

```text
Region A | Region B
```

を隣接させ、
共有境界を明確にする。

意図:

```text
人物属性の混入を減らしながら
別々の人物を近接配置
```

---

# 56. UI上の番号規則は維持

現行では、
漫画読み順を意識して
右上側から番号が割り振られる仕様がある。

これを勝手に変更しない。

ただしdebugのため、
各panelに、

```text
[コマ1]
[コマ2]
```

を常時見やすく表示する。

---

# 57. Slice後の番号

Sliceで新panelが増えたら、
`sortAndAssignPanels()` を実行し、
現行の漫画読み順ルールで再番号する。

---

# 58. Prompt mapping regression

コマ番号の再割当後、

```text
Canvas コマ番号
↕
Prompt koma N
```

がずれていないか確認する。

UI改修でここを壊さない。

---

# 59. Undo / Redo

現在のhistoryを維持する。

以下すべてを1operationとして履歴へ入れる。

```text
Slice
Quick Split
Gutter Drag
Group Gutter Drag
Panel Move
Panel Resize
Mode変更によるpanel property更新
```

pointermoveごとにhistoryを作らない。

pointerup時に1回。

---

# 60. ControlNet向けPNG保存は維持

現状の、

```text
コマ枠PNG保存
白黒線画表示
```

は便利なので壊さない。

ただし、

```text
ControlNetへ自動送信
```

は追加しない。

---

# 61. PNG保存とOverlap

Overlap Modeのpanelを保存する場合も、
現在見えている矩形枠をそのまま描画してよい。

自動的にくり抜き形へ変えない。

---

# 62. プリセット

既存:

```text
4コマ
3コマ
5コマ
6コマ
```

は維持してよい。

`inset` presetは、
入れ子専用機能を削除するなら
削除候補。

ただし既存ユーザー互換性を重視するなら
presetだけ残してもよい。

---

# 63. UIの表示整理

推奨:

```text
[ツール]
選択 | スライス | 矩形

[クイック]
横分割 | 縦分割 | 結合

[領域関係]
コマ連結 | 重なり許可
```

と概念を分ける。

現在のように機能が同列に並び、
状態が分かりにくいUIを避ける。

---

# 64. Button Active State

Active toolは明確に色を変える。

例:

```text
Slice active
→ orange

Draw Rect active
→ blue

Select active
→ neutral / blue outline
```

実際の色は既存CSSに合わせてよい。

---

# 65. Status Text

Canvas下部へ短く、

```text
ツール: スライス
領域関係: コマ連結
```

等を表示してよい。

---

# 66. CoreとUIを一度に大改造しない

必ずcommitを分ける。

---

# 67. 推奨Commit 1

```text
v3.7.4-A:
Core diagnostics + interactionMode backend
```

内容:

```text
exclusive / overlap mask behavior
logs
regression tests
```

---

# 68. 推奨Commit 2

```text
v3.7.4-B:
explicit Select / Slice / DrawRect tools
```

---

# 69. 推奨Commit 3

```text
v3.7.4-C:
linked gutter groups + overlap move/resize
```

---

# 70. 各Commit後に起動確認

最低:

```text
EasyReforge起動
Manga Prompter表示
Canvas操作
Prompt mapping
Generate 1回
```

を確認する。

---

# 71. Phase Gate

Coreで既存の、

```text
上下2RegionでPrompt位置が反応する
```

挙動を壊した場合、
UI Phaseへ進まない。

先にrollback / 修正。

---

# 72. UI Phase Gate

Slice Toolで、

```text
選択modeのdragが勝手にsliceしない
```

ことを最初に確認。

---

# 73. Slice Acceptance Test A

1panel全体。

Slice Tool ON。

panel幅の約90%を横断する横線を
panel内からpanel内へdrag。

期待:

```text
上下2panelへsplit
```

---

# 74. Slice Acceptance Test B

線がpanel幅の50%しか横切らない。

primary selectionなし。

期待:

```text
splitしない
```

---

# 75. Slice Acceptance Test C

primary selected panelあり。

coverage 50%。

期待:

```text
fallback threshold 40%によりsplit
```

---

# 76. Slice Acceptance Test D

2panelに線がかかる。

Panel A coverage:

```text
0.91
```

Panel B:

```text
0.25
```

期待:

```text
Panel Aだけsplit
```

---

# 77. Slice Acceptance Test E

中央の小panelを切る。

lineのstart/endがcanvas外でなくてもよい。

期待:

```text
中央panelだけsplit
```

これが今回の重要要件。

---

# 78. Linked Boundary Test

2panel。

shared borderをdrag。

期待:

```text
Aの幅 + Bの幅は維持
gap / overlapを作らない
```

---

# 79. Linked Group Boundary Test

2列 x 3段。

中央縦borderをdrag。

期待:

```text
左列3panel
右列3panel
```

が一括追従。

---

# 80. Overlap Test

2panel。

Overlap Mode。

Panel 2をdragして
Panel 1へ30%重ねる。

期待:

```text
geometry上重なる
JSONへ両rect保存
backend raw masksも重なる
```

---

# 81. Exclusive / Overlap backend Test

同一geometryを使い、

### exclusive

zIndex cutout等の現行排他処理。

### overlap

raw masksを保持。

Consoleへ:

```text
overlap pixels
effective overlap ratio
```

を出してもよい。

---

# 82. Generation Test

Overlap Mode:

```text
R1 = red sports car
R2 = green apple
```

は診断としては意味が薄いので、
backend mask確認を主とする。

将来的な人物testはユーザーが行う。

---

# 83. 4～6コマはCore成功後

v3.7.4でUIとして4～6panelを作れることは確認する。

ただし生成品質を
v3.7.4成功条件へ含めない。

現在は2Region基礎を詰める段階。

---

# 84. 4～6コマで将来見る項目

後続版で、

```text
small region compensation
region weight
semantic leakage
global weight
ControlNet併用
```

を検討する。

---

# 85. Small Region Weight補正はまだ自動化しない

現在、
小Regionが小物化する傾向がある。

しかしv3.7.4で、

```text
面積が小さいから自動weight上昇
```

を導入しない。

ユーザーのWeight sliderで検証する。

自動補正は後続候補。

---

# 86. Negative Prompt per Regionもまだ導入しない

semantic isolation改善案ではあるが、
今回の変数を増やしすぎる。

---

# 87. UI編集とRegion Weightを混同しない

Panelサイズを変えても、
`weight`値は自動変更しない。

geometryとweightは独立パラメータ。

---

# 88. 現在のPrompt Templateは別課題として維持

v3.7.3で使用中のDiagnostic prompt構造を壊さない。

```text
PAGE
BREAK
STYLE
BREAK
koma 1
BREAK
koma 2
...
```

を維持。

---

# 89. GitHub公開mainとの差に注意

ローカルEasyReforgeが
GitHub `main` より先行している可能性がある。

したがって、

```text
Web上のmainをそのまま上書きコピー
```

してはいけない。

常にローカルファイルを先に読む。

GitHubは参考。

---

# 90. 参照する公開コード

## Manga Canvas

```text
https://github.com/toshinka/tegaki/blob/main/EasyReforgeExtension/javascript/manga_canvas.js
```

特に:

```text
mangaPrompterSplit
mangaPrompterToggleDrawRect
renderGutters
startGutterDrag
setupCanvasDragInteraction
applyFreehandSlice
```

---

# 91. 参照するSpatial Engine

```text
https://github.com/toshinka/tegaki/blob/main/EasyReforgeExtension/scripts/manga_spatial_engine.py
```

特に:

```text
generate_spatial_masks
Z-Index cutout
```

---

# 92. 参考: CLIP STUDIO PAINT公式

## コマ割り

```text
https://help.clip-studio.com/ja-jp/manual_jp/540_comic/コマ割り【PRO__47_EX】.htm
```

参考点:

```text
枠線分割ツールが明示的
ドラッグ中preview
Object Toolでコマ枠編集
隣接コマの連動resize
```

---

# 93. 参考: 枠線カット設定

```text
https://help.clip-studio.com/ja-jp/manual_jp/810_subtools/わ行.htm
```

参考点:

```text
分割形状
コマ間隔
分割方法
```

v3.7.4では直線・矩形だけ採用。

---

# 94. CLIP STUDIO PAINTそのものをコピーしない

以下は対象外:

```text
folder/layer duplication
ruler
polygon panel
spline panel
diagonal panel geometry
frame brush
layer mask UI
```

操作思想だけ参考にする。

---

# 95. 完了報告書

作成:

```text
EasyReforgeExtension/docs/V374_CORE_PANEL_EDITOR_RESULT.md
```

---

# 96. Report Template

```markdown
# v3.7.4 Core + Panel Editor Result

## Status

Core Implementation:
PASS / PARTIAL / FAIL

Core Generation Validation:
PASS / PARTIAL / UNVERIFIED / FAIL

Panel Editor Implementation:
PASS / PARTIAL / FAIL

Panel Editor Manual Validation:
PASS / PARTIAL / UNVERIFIED / FAIL

## Environment

EasyReforge commit:
reForge commit:
Local extension commit:
Forge Couple local version:

## Pre-change Working Checkpoint

commit:
...

## Core Findings

Vertical split:
...

Horizontal split:
...

Forge Couple comparison:
...

Global Effect:
...

## Interaction Mode Backend

Exclusive:
...

Overlap:
...

Z-index cutout behavior:
...

## Tool Modes

Select:
PASS / FAIL

Slice:
PASS / FAIL

Draw Rect:
PASS / FAIL

Implicit slice in Select removed:
YES / NO

## Slice Tests

A 90%:
PASS / FAIL

B 50% unselected:
PASS / FAIL

C 50% selected fallback:
PASS / FAIL

D crosses two panels:
PASS / FAIL

E middle panel partial line:
PASS / FAIL

## Linked Boundary

2-panel:
PASS / FAIL

2x3 grouped boundary:
PASS / FAIL / NOT IMPLEMENTED

## Overlap Editing

Move:
PASS / FAIL

Resize:
PASS / FAIL

Backend overlapping masks:
PASS / FAIL

## Removed / Preserved

Inset button:
REMOVED / PRESERVED

Quick horizontal split:
PRESERVED / BROKEN

Quick vertical split:
PRESERVED / BROKEN

Merge:
PRESERVED / BROKEN

PNG export:
PRESERVED / BROKEN

Undo/Redo:
PRESERVED / BROKEN

Prompt mapping:
PRESERVED / BROKEN

## Files Changed

...

## Console Logs

...

## Confirmed Findings

Only verified results.

## Hypotheses

Clearly labeled.

## Remaining Problems

...

## Next Recommendation

Do not automatically implement next version.
```

---

# 97. 「実装済み」と「検証済み」を分ける

前版同様、

```text
code written
```

だけでSUCCESSとしない。

実際にUI操作できなければ、

```text
IMPLEMENTED / UNVERIFIED
```

と書く。

---

# 98. Antigravity作業開始前の理解確認

編集開始前に短く以下を報告する。

```text
1. 今回の最優先はRegional Core。
2. ControlNet自動送信は作らない。
3. SliceをSelectから分離し明示Toolにする。
4. Slice対象はmidpointではなくcoverageで判定。
5. 80% strong candidate、選択panelは40% fallback。
6. Linked Modeでは共有境界が周辺panelへ追従。
7. Overlap Modeではpanelを独立移動・resizeし、mask overlapも保持。
8. 入れ子専用buttonは不要。矩形 + Overlapで代用。
9. Quick横/縦splitは残す。
10. Coreが壊れたらUI改修へ進まない。
```

理解が違う場合、
コード変更を開始せず読み直す。

---

# 99. Antigravityへの短縮実行指示

以下をそのまま依頼文として使用できる。

---

EasyReforge Manga Region Prompter v3.7.4を実装してください。

今回の優先順位は、

1. Regional Prompt内部構造の継続診断・回帰防止
2. CLIP STUDIO PAINTのコマ枠操作を参考にしたPanel Editor改善

です。

ControlNetへ画像を自動送信する機能は作らないでください。

ユーザーはスクリーンショットをControlNetへ貼り付ける現在の操作で十分と考えています。

まず現在のローカルworking stateをcommitまたはバックアップしてください。

公開GitHubよりローカルEasyReforgeを優先して確認してください。

Coreでは現在の2Region挙動を維持し、
local Forge Couple v4.0.2との左右/上下比較を行ってください。

新しく、

```text
interactionMode = exclusive / overlap
```

を導入してください。

Exclusiveは漫画の別コマ用。

Overlapは人物等のRegionを意図的に重ねる用途です。

Spatial Engineでは、
exclusiveは現在のZ-Index cutout方式を維持し、
overlapではZ-Index cutoutを行わずraw maskの重複を保持してください。

Attentionのmask normalization式は今回変更しないでください。

UIは、

```text
Select
Slice
Draw Rect
```

を明示的なtool modeとして分けてください。

現在のようにSelect中のcanvas dragが暗黙的にsliceになる仕様を廃止してください。

Slice Toolは、
line midpointでtarget panelを決めないでください。

線と各panelの交差coverageを計算し、

```text
coverage >= 0.80
```

のpanelをstrong candidateにしてください。

selected panelについては、

```text
coverage >= 0.40
```

でfallback可能にしてください。

他panelへ線が少しかかっても、
最大coverageの対象panelだけを原則splitしてください。

線はcanvas外からcanvas外まで引く必要はありません。

中央にあるpanelへ、
panel内からpanel内へ引いた線でもsplitできるようにしてください。

Quick横split / 縦splitは残してください。

「カットイン（入れ子）」専用buttonは削除して構いません。

自由矩形 + Overlap Modeで代用します。

Linked / Overlapのtoggleを追加してください。

Linkedでは既存 `renderGutters` / `startGutterDrag` の共有境界resizeを維持してください。

可能なら、2列3段の中央境界のようなcollinear shared gutterをgroup化し、
1回のdragで複数panelを追従させてください。

Overlapでは選択panelを独立move / resizeでき、
他panelと重ねられるようにしてください。

Overlap状態はbackend maskにも反映してください。

CLIP STUDIO PAINT公式の以下を操作思想の参考にしてください。

```text
https://help.clip-studio.com/ja-jp/manual_jp/540_comic/コマ割り【PRO__47_EX】.htm
https://help.clip-studio.com/ja-jp/manual_jp/810_subtools/わ行.htm
```

ただしpolygon / spline / layer folder等は今回対象外です。

変更は最低3段階に分けてください。

```text
A: Core + backend interactionMode
B: explicit tool modes + Slice
C: Linked group gutter + Overlap move/resize
```

各段階で起動確認してください。

Coreの既存上下2Region挙動を壊したら、
UI Phaseへ進まないでください。

最後に、

```text
EasyReforgeExtension/docs/V374_CORE_PANEL_EDITOR_RESULT.md
```

を作成してください。

実装しただけで成功とせず、
実機確認できない項目はUNVERIFIEDと報告してください。

---

# 100. v3.7.4の成功状態

最終的に、

```text
Regional Core
    │
    ├─ 現在の2Region性能を維持
    ├─ Exclusive
    └─ Overlap
          │
          ▼
Panel Editor
    │
    ├─ Select
    ├─ Slice
    │    └─ partial line / target coverage
    ├─ Draw Rect
    ├─ Quick Split
    ├─ Linked Boundary
    └─ Free Overlap
```

という構造になること。

本版では、
4～6コマ生成の完成を要求しない。

しかし、

```text
4～6コマを人間がストレスなく設計できるCanvas
```

への基礎は作る。

Regional生成側は、
その後の段階で多コマsemantic isolationを詰める。

以上。
