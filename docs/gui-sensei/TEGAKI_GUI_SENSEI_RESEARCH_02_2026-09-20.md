# TEGAKI GUI Sensei Research 02
## Lyrica中心：Workspace / Timeline / Context Editing / User Feedback
Date: 2026-09-20  
Status: Research Bank / Not Product Authority / Not Implementation Instruction

---

## 0. この回の目的

第1回で挙げた先生ツール群のうち、最も新しく、TEGAKIのAnimation / Text / Timeline系GUIとの比較価値が高い **Lyrica** を中心に掘る。

今回の主眼は見た目の模倣ではなく、次を確認すること。

1. Preview / Timeline / Clip Editor / Library などの「役割分離」
2. Timelineと再生操作の関係
3. テキスト入力からTimeline配置、個別Clip編集へ進む導線
4. Context panelを「選択対象の能力」に使う考え方
5. 実利用者が直感的と感じた点、実際に詰まった点
6. TEGAKIへ持ち込めそうなGUI原則と、まだ持ち込むべきでない部分

比較補助として ToonSquid / Callipeg も参照する。

---

# 1. Lyricaの性格

Lyricaはリリックアニメーションに特化したMV制作ツールで、BPMベースのTimeline、beat snap、複数track、text effects、画像・動画clipなどを持つ。

公式ストア説明でも中心的な制作ループは、

- 楽曲を読み込む
- 歌詞を入力する
- clipをTimelineへ並べる
- beatに同期させる
- Previewしながら調整する

という構成になっている。

重要なのは、Lyricaが「映像編集ソフトを機能一覧から操作する」というより、**音楽制作・DAW的な時間軸を中心に、対象Clipの詳細をContextとして編集する**方向へ寄っている点。

公開された逆引きリファレンスの目次でも、Workspaceを

- Library Panel
- Preview
- Timeline
- Clip Editor Panel
- MASTER FX Panel
- Bottom Bar / Status

に分けて説明している。

これは既存Research Handoffの

> 中央 = visual result  
> 右 = context/property editing  
> 下 = temporal editing

という観察を補強する材料になる。

### Sources
- Lyrica App Store listing  
  https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12
- Lyrica Steam listing  
  https://store.steampowered.com/app/5106770/Lyrica/?l=japanese
- Lyrica Reverse Lookup Reference (third-party, 2026-09-18)  
  https://note.com/platypus2000jp/n/n98c0c1076af0

---

# 2. TEGAKIへ強く関係する「役割分離」

Lyricaの参考価値は、単純な右Inspectorの存在そのものではない。

TEGAKIへ重要なのは、**情報の意味ごとに場所を分けていること**。

概念的には：

```text
中央
  Preview / Result

右
  選択中clipや効果などのContext Editing

下
  Timeline / Track / Playback / Time

左または周辺
  Library / 素材 / 入力起点
```

TEGAKIに読み替えるなら：

```text
中央
  Canvas / direct manipulation

右
  現在の作業能力
  Drawing / Transform / Rig context

下
  Animation Table / temporal editing

素材・テキスト
  Library / Workspace / mode-appropriate source
```

ここでの重要点は、**Layer、Transform、Rig、Timelineを全部常時並べる必要はない**こと。

「現在選択している対象」と「その対象に対して今行っている能力」をContext側へ投影し、時間編集はTimeline側へ残すという方が、現在のTEGAKIのSingle Right Workspace Frameと相性がよい。

---

# 3. LyricaのClip Editorから学ぶべきこと

公開情報から、Lyricaには `CLIP EDITOR` があり、同タイプのclipを連続選択した場合に現在のClip Editor tabを保持する改善がv1.0.2で入っている。

これは小さい変更に見えるが重要。

ユーザーが同種の対象を次々選ぶ場合、

```text
対象を変える
→ 編集能力の場所やtabが毎回初期化されない
```

という「作業文脈の連続性」を製品側が明示的に扱っている。

TEGAKIでは例えば：

```text
Transform中
レイヤーA → レイヤーB
```

を無条件に許可するという意味ではない。

pending edit / transaction guardは既存authorityに従う必要がある。

しかし、**対象変更が正規に成立した後に、能力UIが不要に別状態へ戻らない**という原則は参考になる。

RIGでも、

```text
Bone / Layer / Deformerの対象だけ変わる
→ RIG編集のContext自体は維持
```

という設計候補につながる。

### Evidence
Lyrica v1.0.2:
- Selecting clips of the same type in a row keeps the current CLIP EDITOR tab.

Source:
https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12

---

# 4. テキスト入力をQTPから右側/Context系へ移す案との相性

Lyricaは歌詞を「素材」として入力し、Timelineへ配置し、選択clipをClip Editorで編集する制作ループを持つ。

これはTEGAKIの文字入力について重要な比較材料になる。

現在のQTPはCanvas近接のQuick Toolとして合理性がある一方、文字はBrush sizeのような「描画中に瞬間的に触る値」とは性格が違う。

文字編集は：

- 内容
- Font
- size
- alignment
- spacing
- transform
- Animation
- Timeline上のduration / timing

など、**Contextが深い**。

そのため将来的には、

```text
QTP
= 即時性の高いCanvas近接パラメータ

Right Workspace
= Text / Transform / RIGなど、対象を選んで少し深く編集する能力
```

と整理することには合理性がある。

ただしこれはまだ採用判断ではない。

TEGAKIのText機能のauthority、Canvas上direct text edit、入力中focus、IME、Historyとの関係を別途確認する必要がある。

---

# 5. Timeline / Playback：LyricaだけでなくToonSquidから得られる強い材料

LyricaはBPMベースTimelineと再生・loopを主要機能としている。

一方、**UIの具体的な再生配置について、今回取得できた公開資料だけでは正確な位置・固定挙動まで確定できなかった。**

ここは推測で埋めない。

代わりに、ToonSquidには公式Handbook上で明確な設計がある。

## ToonSquid

- Timelineは画面下
- expand / collapse可能
- Timeline heightをdragで調整可能
- layer数が一定以上になるとTimeline自体を無限に高くせずscrollへ移行
- **Playback ToolbarはTimelineをcollapseしても常にvisible**
- Next / Previous frame、Play / Pause、Scene、FPSなどがPlayback Toolbarへ集約

これはTEGAKIのAnimation Tableにかなり重要。

TEGAKIで検討価値が高いのは：

```text
Animation Table本体
    ↓ collapse
時間情報の大面積表は消える

Playback / current frame / small temporal controls
    ↓
薄いbarとして残る
```

という構成。

「Timelineを閉じた = 時間操作能力を完全に消した」にならない。

Research HandoffにあるTemporal Overview Stripとも接続可能。

### Source
ToonSquid official Handbook – Timeline
https://toonsquid.com/handbook/interface/timeline/

---

# 6. Callipeg：TimelineとCanvas面積の交換を明示的に扱う

Callipeg公式資料では、Timelineは下部にあり、

- 上方向へ拡張可能
- 非表示にしてCanvas領域を増やせる
- layer managementもTimeline左側に存在
- playback controlを持つ
- mini interfaceではorientationによりTimeline位置も変わる

と説明されている。

特にTransformation Layerでは、curves modeに入ると、

> layer pileがあった場所にTransformation optionsが現れる

というモード置換が存在する。

これは現在TEGAKIで採用した

```text
Drawing:
  Right = Layers

Transform:
  Right = Transform

同時併設しない
```

というSingle Right Workspace Frameの考え方と非常に近い。

つまりTEGAKIの今回の方向転換は、単なる独自発想ではなく、既存animation toolにも類似の「対象一覧 ↔ 能力詳細の置換」文法がある。

### Sources
Callipeg – Timeline
https://callipeg.com/learn-timeline/

Callipeg – Transformation Layer
https://callipeg.com/learn-transformation-layer/

Callipeg – Interface
https://callipeg.com/learn-interface/

---

# 7. Callipegから特に重要な「Canvas-first」の入力思想

CallipegはApple Pencilを前提としており、公式Interface説明では、利き手に応じてPencil用の空間を確保するという明確なエルゴノミクスが書かれている。

これは単純な「右側にpanelを置く」話ではない。

GUI配置を

```text
見た目
ではなく
入力する手・Pencil・Canvasへの到達
```

から決めている。

TEGAKIも今後、

- mouse
- pen
- touch / coarse pointer
- keyboard shortcut

を使うため、先生ツール比較では「どこにpanelがあるか」だけでなく、

**その場所がpointer travel、Pencilの邪魔、Canvas遮蔽、利き手にどう作用するか**

を評価軸に追加すべき。

---

# 8. 「ユーザーが使いづらいと言っている点」を調査材料にする価値

これは有効。

特に公式機能一覧だけを見ると、

```text
その機能が存在する
```

ことしか分からない。

ユーザーの不満からは、

```text
存在していても発見できない
操作はできるが遅い
状態変化が分からない
小さいhit areaで使いにくい
名前が長いと崩れる
clipのcopyで意味が変わる
```

といったGUI品質が見える。

Lyricaはまだ非常に新しいのでレビュー母数は小さいが、既に以下の材料がある。

## Positive

App Store review:
- video編集経験者には分かりやすいinterface
- 直感的と評価する投稿

別レビュー:
- tempo/gridで合わせる考え方が直感的

これは「動画/DAW経験との思考の水平」が成立している可能性を示す。

## Negative / Requests

App Store / release notesには：

- clip名に日本語を含む場合のmedia問題（旧version）
- copy後のclip lengthズレ（旧version）
- 長いtrack名でmute/lock buttonを押せない問題
- text clipのdouble clickが難しい
- long phrase overflow
- Command+C/Vが一部環境で効かない
- eyedropper slowdown

などが確認できる。

GUI研究として特に重要なのは：

**「double clickが難しい」「長い名前でボタンが押せない」「long phrase overflow」**

のような、見た目だけでは分からない入力・layout failure。

TEGAKIでも先生UIを参考にする場合、完成screen shotだけでなくrelease notesと不満をセットで見るべき。

Source:
https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12

---

# 9. SNSから得られる初期材料

検索で取得できた開発者と利用者のやり取りでは、

- 歌詞全文を登録
- phraseごとにTimelineへdrag
- text clipはDAWのようにbeat snap
- default font / size / color設定への利用者要望
- 後のversionでPROJECT SETTINGSにdefault text clip valuesを追加

という流れが確認できる。

これはGUI原則として非常に面白い。

頻繁に繰り返す設定を、

```text
各clipを毎回直す
```

のではなく、

```text
Project defaultへ昇格
→ 新規clipへ継承
```

している。

TEGAKIでも将来的に、

- 新規Frame
- Text style
- Transform interpolation
- Brush / animation defaults

などで「毎回同じ値を直している」ものが見つかった場合、

**Quick UIを増やすよりDefault / Presetへ昇格した方がよい**

場合がある。

ただしSNSミラー由来のため、一次資料よりconfidenceを下げる。

---

# 10. 現時点でのTEGAKI採用候補

## HIGH confidence

### A. Canvas / Context / Time の役割分離

```text
Canvas = visual / direct operation
Right  = current capability / properties
Bottom = temporal editing
```

Research Handoffと複数先生ツールが同じ方向を示す。

### B. Right Workspaceは「併設」より「文脈置換」

Callipeg Transformation Layerのように、
対象一覧があった領域を能力詳細へ切り替える例が実在する。

現在のTEGAKI Single Right Workspace Frameを支持する材料。

### C. Timeline collapse後もminimum temporal controlを残す

ToonSquidのPlayback Toolbarが強い参考。

TEGAKI Animation Tableも、
Table本体とPlayback / Current Frameを分離する検討価値が高い。

### D. Context continuity

同種対象を連続編集する場合、
detail tabやmodeを不要にresetしない。

Lyrica v1.0.2の改善が直接的な例。

---

# 11. MEDIUM confidence候補

## TextをRight Workspace側へ移す

Lyrica型のText / Clip Editingとの思考の水平は高い。

ただしTEGAKIのText edit authority調査前なので未決定。

## RIG / Transform / Textを同じRight Frame grammarへ揃える

同じ見た目にする、ではない。

```text
target identity
capability switch
minimal persistent action
progressive detail
```

というFrame grammarを共有する候補。

## Timeline上のdrag + Numeric entryの二重経路

動画/DAW系との思考の水平を得やすい。

ただしnumeric inputのplacementは別調査が必要。

---

# 12. まだ採用してはいけないもの

1. Lyricaの右panelを寸法ごとコピーする
2. Timelineの再生配置を「Lyricaと同じ」と断定する  
   → 今回は正確な配置を一次資料から確認できていない
3. CallipegのLayer/Transform modelそのものをTEGAKIへ持ち込む
4. 全作業modeを同じRight panelへ押し込む
5. Glass / transparency / gradientを「modernだから」という理由だけで全面採用する
6. User review 1件を製品全体の評価と扱う

---

# 13. GUI憲法候補への追加材料

まだ正式な憲法化はしない。

ただしResearch Principleとして次をBankする。

### G-01 Canvas Result First
主役はCanvas。常設UIはCanvasを奪う理由を説明できるものだけ。

### G-02 One Surface, One Meaning
同じ領域に同時にLayer管理とTransform詳細を詰め込まず、
作業状態に応じて意味を明確にする。

### G-03 Context Continuity
対象が正規に切り替わっても、
継続可能な作業文脈を不用意にresetしない。

### G-04 Temporal Minimum Survives Collapse
Timeline本体を閉じても、
現在Frame・Playbackなど最小限の時間文脈を残せるか検討する。

### G-05 Direct + Numeric
Canvas direct manipulationと、
正確な数値編集を競合させず補完関係にする。

### G-06 Ergonomics Is Layout
panel位置は見栄えだけでなく、
pen / pointer / keyboard travelから評価する。

### G-07 Defaults Beat Repetition
同じ設定を反復変更するなら、
UIを増やす前にdefault / preset化を検討する。

これらはまだResearch candidate。
Owner / WebSOL / Astra裁定を経てProduct principleへ昇格する。

---

# 14. 次回調査

第3回は **Adobe Fresco + CLIP STUDIO PAINT Simple Mode** を中心にする。

動画Editorから一度離れ、

- Canvasをどこまで空けるか
- Tool propertyをどう出すか
- Brush / Slider / quick parameter
- Layer Panelの開閉
- Transform中に何を残すか
- typography / spacing / border / shadow
- tabletでのhit target
- glass / translucencyの使いどころ
- modern iPad drawing appとして何が共通か

を確認する。

この回で、現在TEGAKI Transform panelの

- 大きすぎるbutton
- excessive padding
- heavy border / shadow
- independent sliders
- scrollbar presence
- WARP mode hierarchy

を評価するための比較基準を作る。

---

# 15. Confidence

PROVEN / HIGH:
- LyricaはBPM-based timeline / beat snap / multi-track / clip editingを持つ
- Lyrica v1.0.2でsame-type clip selection時のClip Editor tab保持が追加
- ToonSquid playback toolbarはTimeline collapse後もvisible
- Callipeg Timelineはhide / resize可能
- Callipeg Transformation Layerでlayer pileの場所がtransform optionsへ置換される

MEDIUM:
- LyricaのDAW的mental modelがTEGAKI Animation UXへ直接有効
- TextをRight Contextへ移す方がQTPより適する可能性
- default/preset原則のTEGAKIへの一般化

UNKNOWN:
- Lyrica最新版の正確なPlayback control配置
- Lyrica Right Clip Editorの実寸・collapse挙動
- Lyricaでのkeyboard focus / pointer ergonomics
- TEGAKI Text authorityとの接続方式

---

# 16. Source Index

Lyrica App Store:
https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12

Lyrica Steam:
https://store.steampowered.com/app/5106770/Lyrica/?l=japanese

Lyrica third-party reverse reference:
https://note.com/platypus2000jp/n/n98c0c1076af0

PC Watch – Lyrica launch:
https://pc.watch.impress.co.jp/docs/news/2134358.html

PC Watch – Windows release:
https://pc.watch.impress.co.jp/docs/news/2141781.html

ToonSquid – Timeline:
https://toonsquid.com/handbook/interface/timeline/

ToonSquid – Editor:
https://toonsquid.com/handbook/interface/editor/

Callipeg – Interface:
https://callipeg.com/learn-interface/

Callipeg – Timeline:
https://callipeg.com/learn-timeline/

Callipeg – Transformation:
https://callipeg.com/learn-transformation/

Callipeg – Transformation Layer:
https://callipeg.com/learn-transformation-layer/

Existing TEGAKI Research Bank:
TEGAKI_OSS_GUI_Interaction_Research_Handoff_2026-09-18.md
Sections around LYRICA / Right Dock / Hierarchy / prototype comparison.
