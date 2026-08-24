# TEGAKI UI操作文法・QTP Painter's Palette・Surface階層 提案書

更新日: 2026-08-21  
区分: 外部調査を含む未実装proposal / 既存正本補強案  
対象: `12_Camera_Frame・Resize_UI将来設計` / `14_UIツール導線・Text・階層Motion将来設計` / `15_キャラクターRig・Mesh・Perform統合ロードマップ` / `16_制作Workspace・UI・外部Handoff構造ロードマップ`

採否記録: 2026-08-22にSOLが現行コードへ照合し、採用知見をproposal 14 / 16と`UI_CSSスタイルガイド.md`、Phase 8lへ統合した。旧Phase状態、件数、外部tool評価は本書を正本にせず、履歴原案としてArchiveする。

> 本書は既存4正本を置換しない。現在のPhase 8k等の進行中Gateへ割り込む実装契約でもない。既存計画に既にあるCanvas First、progressive disclosure、半透明popup、Panel位置保存、Contextual Inspector、direct manipulation、Setup青 / Motion橙、保存正本とUI projectionの分離を維持したまま、UI全体へ横断適用できる操作文法・視覚文法を補強する提案である。

---

## 0. 結論

現行TEGAKIの将来UI計画は、構造面ではかなり現代的である。

- 通常描画時に高度UIを常設しないCanvas First
- QTPへ頻用描画toolを集約し、sidebarを大分類入口へ縮退する計画
- 選択対象に応じてContextual Inspectorだけを出す方針
- Rig / Motionで「思考の水位」を段階化する設計
- Resize、Rig、CameraでCanvas direct manipulationを主にする方向
- Timeline / popup / Workspaceを可逆に開閉し、UI状態を保存正本へ混ぜない設計

これらはProcreate、Concepts、Adobe Fresco、CLIP STUDIO PAINT Simple Mode、Callipeg、ToonSquidで確認できる2020年代の制作UI潮流と概ね一致する。

一方、今後の改修で不足しているのは、個別機能案ではなく次の**横断的な規則**である。

1. QTPを「単なるpopup」ではなくTEGAKIの主作業パレットとして定義すること。
2. 四角いbutton cellを常時見せず、hit areaと見た目を分離するSurface文法。
3. 半透明を単なるskinではなく、Canvasとの連続性を保つ意味的なMaterialとして使う規則。
4. 既存クリエイティブツールからの学習転移を意図的に守る「Familiarity / Migration Gate」。
5. UIの複雑さを「機能数」でなく、常時露出数・到達段数・Canvas遮蔽量として計測するGate。
6. 初心者がGUIからshortcutへ自然に移行する学習導線。

したがって、新しい大規模Workspaceや全面Dock化を増やすより、**TEGAKI UI Constitution（UI操作憲章）を先に固定し、その最初の実証対象をQTPにする**ことを推奨する。

---

## 1. 現行4資料の横断監査

### 1.1 既に強く、変更しない方がよいもの

#### Canvas First / progressive disclosure

`16_制作Workspace・UI・外部Handoff構造ロードマップ`は、通常描画時に高度なRig / Graph / export UIを常設しないことを明示している。Rig Workspaceでも、通常描画へ戻った際のPanel位置・shortcut・wheel等を維持する復帰契約を優先している。

`15_キャラクターRig・Mesh・Perform統合ロードマップ`も、Part / BONE / Mesh / Weight / Dynamicsの全panelを同時に出さず、選択対象に必要なcontrolのみContextual Inspectorへ出す方針を採っている。

この判断は維持すべきである。

#### QTP集約 + peripheral rail

`14_UIツール導線・Text・階層Motion将来設計`では、pen / eraser / airbrush / fill / selection等をQTPへ集約し、sidebarにはLibrary / import / resize / Q / Layer Transform / Animation Table / Settings等の大分類入口を残すPlan Aが第一候補になっている。

これは「制作操作」と「アプリケーション管理操作」を空間的に分離する設計として妥当であり、後述するTEGAKI独自のPainter's Palette思想へ発展させる価値がある。

#### Direct manipulation first

`12_Camera_Frame・Resize_UI将来設計`では、Resize preview上のdrag / wheelを主操作、number / sliderを補助としている。`15`でもRig / MotionはCanvas handleを主にし、数値とtreeを補助とする。

これはTEGAKI全体の操作原則として昇格させてよい。

#### 視覚寸法とhit areaの分離

`14`は、Browser 100%で見た目を縮めてもpen / touchのhit areaは維持する方針を既に持つ。この考え方は、今後「四角いbutton cellを視覚的に消す」際の技術的土台になる。

#### UI projectionを保存正本にしない

4資料を通して一貫しており、非常に良い。Workspace、Timeline子行、selection、overlay、Panel配置をProject schemaへ直結させない原則は変更しない。

---

## 2. 外部調査で確認できたUI潮流

### 2.1 Concepts — 「道具を身体側へ置く」+ Normal / Compact / Hidden

ConceptsはTool Wheel / Tool Barや各menuをCanvas上で移動でき、左右端へのDock、複数menuのstation化、Normal / Compact / Hiddenの3段階表示を持つ。Compactではlabelやsliderを減らし、HiddenではCanvasを最大化する。

TEGAKI QTPとの共通点は、固定toolbarよりも「使用者が道具箱そのものを使いやすい位置へ置く」思想にある。

採るべき点:

- QTPの自由位置を維持する。
- 完全なユーザー自由rail編集より先に、QTP自身の表示密度を段階化する。
- 「移動可能なPainter's Palette」を製品identityとして明示する。

そのまま採らない点:

- Tool Wheelという円形UIそのもの。これはConcepts固有のidentityであり、TEGAKIが模倣する必要はない。

### 2.2 Procreate — 身体到達性とCanvas最優先

Procreateはminimal interfaceを3領域として説明し、sidebarを「描画していない手から届く位置」に置く。左右反転だけでなく高さも調整でき、UI全体を隠すこともできる。

採るべき点:

- QTP / railの位置を単なる画面レイアウトでなく「手が届く場所」として評価する。
- 左右Presetだけでなく、上 / 中 / 下の到達性もfixtureへ入れる。
- Fullscreen / UI最小化は別モードを増やすより、既存QTP / Timelineの可逆折りたたみで達成する。

### 2.3 Adobe Fresco — 主操作をCanvas近傍に置き、補助操作を一段退かせる

FrescoはCanvasを中心に、drawing tool、Layer taskbar、Touch Shortcut、help / shortcut mapを配置する。Touch Shortcutは「同じtoolの一時的な別機能」を身体操作で呼び出す設計で、keyboard shortcutsもPhotoshopとの一貫性を意識している。

採るべき点:

- 頻用操作の短距離化。
- shortcut / gestureを隠し知識にせず、Help・tooltipから学べるようにする。
- 既存ツール経験者の知識を再利用できる名称・shortcut・iconを優先する。

### 2.4 CLIP STUDIO PAINT Simple Mode — 高機能エンジンへの低摩擦入口

Simple Modeは「essential functions」「minimal interface」「maximize canvas space」を明示し、必要ならStudio Modeへ可逆切替できる。近年は初回tutorialやfeature hintも追加している。

TEGAKIが学ぶべき点はSimple / Studioという二重UIそのものではなく、**高機能を最初から全露出しない**ことである。

TEGAKIは既に「思考の水位」を持つため、別UIモードを増やさず同等以上の効果を狙える。

### 2.5 Callipeg / ToonSquid — Animation UIは重要だが常時占有させない

CallipegはTop / Canvas / Side / Timeline / Bottomの5領域を持ち、Timelineを隠して描画面積を確保できる。ToonSquidもTimelineをanimation workflowにessentialとしながら、collapse、height変更、fullscreenを提供する。また選択toolやeffectに応じて必要なcontrolsだけを出す。

採るべき点:

- Animation Table / Timelineは「高度だから隠す」のではなく、「必要時は第一級、不要時はゼロ」に近づける。
- Rigの多Bone / key propertyはselected target / active branch優先で投影し、常時全展開しない現行案を維持する。

### 2.6 Web / OS側の流れ — Flatではなく「必要なSignifierだけ戻す」

2010年代前半の完全Flat UIは、境界や立体感を消し過ぎることでclickabilityを弱める問題が指摘された。その後は、基本surfaceをフラットにしつつhover / active / selected / focus等で薄い面差・境界・shadowを戻す方向が定着した。

TEGAKIで重要なのは、四角いbuttonをすべて描画することでも、逆にアイコンを完全に裸にして操作可能性を消すことでもない。

**hit areaは明確に存在させ、視覚上のsurfaceは状態がある時だけ強く出す**のが第一候補となる。

### 2.7 半透明Material — Canvasの連続性には有効だが、意味を持たせる

Apple Human Interface Guidelinesは、Material / translucencyをforegroundとbackgroundの階層・文脈維持に用い、薄いMaterialほど背景コンテンツを感じやすい一方、文字や細い要素にはより厚いMaterialでcontrastを確保する考え方を示している。

TEGAKIの半透明popupはこの方向と整合するが、全面glass化は不要である。

---

## 3. 提案A — TEGAKI UI Constitutionを新設する

### 目的

個別Phaseごとに「その画面だけモダン」にするのではなく、QTP、sidebar、Layer Panel、Animation Table、Rig Workspace、Resize、Camera等が同じ思想から生えたUIに見えるよう、判断規則を先に固定する。

### 推奨する8原則

#### C1. 空間文法は保守的、表面文法は現代的

Brush / Eraser / Selection / Transform / Layer / Timeline / Settings等の一般概念は、主要クリエイティブツールから移行した人が予測できる位置・名称・iconを優先する。

新規性は、Rig / Perform / WARP / AI等の高度機能、contextual disclosure、自動化、直接操作で出す。

#### C2. 制作UIとアプリ管理UIを同格にしない

- QTP / Canvas近傍: 制作中に何度も触るもの
- peripheral rail: Library / import / export / resize / settings / help / workspace入口等

peripheral railを「第二のtoolbox」に戻さない。

#### C3. hitboxとsurfaceを分離する

通常時:

- iconは十分なhit areaを持つ
- iconごとの四角いborder / backgroundは原則表示しない
- groupingはspacingとseparatorで示す

状態時:

- hover: 薄いsurface
- active / selected: 明確なsurface + semantic accent
- pressed: ごく短いfeedback
- focus: keyboardで見失わないoutline
- disabled: opacityだけでなく理由をtooltip / statusで説明可能

これにより「狭く見える四角いcellの連続」を除きつつ、Flat UIの弱いsignifier問題を避ける。

#### C4. QTPはPainter's Paletteである

QTPを「Quick Tool Popup」という実装上の名称だけで考えず、製品体験としては**Painter's Palette**と定義する。

- 絵を描く間、主要操作はQTPとCanvasで完結できること。
- 使用者の身体に合わせて位置を変えられること。
- 閉じても現在tool / 再表示導線を失わないこと。
- 高度機能を詰め込み過ぎず、active toolのcontrolを同じsurface内で差し替えること。

#### C5. Translucencyは「空間を広く感じさせる」ために限定使用する

半透明は装飾ではなく、Canvasがpanelの背後にも続いていることを感じさせるMaterialとして使う。

推奨階層:

- floating palette外殻: 中程度の透過 + 必要なら軽いblur
- slider / text input / tooltip / warning: より不透明
- active control: 明確なsurface
- modal / destructive confirm: 高い不透明度

背景が細かい絵でも文字・icon contrastが崩れないことを必須とする。Reduce Transparency相当のuser preferenceや、blur無しfallbackを将来入れられるToken構造にしておく。

#### C6. Direct manipulation first, exact control second

可能な機能は、Canvas / preview上のdrag / wheel / handleを第一操作とし、数値は補助にする。

適用候補:

- Resize framing / frame edge
- Rig PIVOT / BONE / IK target
- WARP / Mesh vertex
- Animation Camera frame / center handle
- Motion Perform

ただし保存正本・History・coordinate transformは既存契約へ接続し、「直接操作専用の第二正本」を作らない。

#### C7. 初心者はGUIから入り、慣れるほどGUIを触らなくなる

hover tooltipには可能な限りshortcutを併記する。touchでは長押し説明を使う。

peripheral railのExport / Settings等も、shortcutがある場合はtooltipへ出す。

これにより周縁iconを「緊急用ボタン」だけでなく、shortcutを学習する補助輪として使える。

#### C8. 「新しいから違う」ことを目的にしない

既存ツールで定着している概念を独自名称・独自icon・独自位置へ変える場合は、明確な制作上の利益をGateで要求する。

TEGAKIが独自であるべきなのは、QTP Painter's Palette、Rig / Mesh / Performの統合、思考の水位などであり、BrushやLayerの基本文法ではない。

---

## 4. 提案B — QTPを3段階のPalette Densityへ拡張する

現行`16`の`CANVAS / DETAIL` Focus shellとは別に、通常描画QTPへ次を将来候補として追加する。

### QTP FULL

- active tool icon / name
- tool grid
- brush size / opacity等の頻用control
- active toolのcontext option

初心者や設定時向け。

### QTP COMPACT

- icon中心
- active toolと最重要controlのみ
- label / 二次controlは折りたたむ

通常制作の第一候補。

### QTP HIDDEN

- Q / shortcut / 小さなstatus indicatorから即復帰
- Canvas最大化

presentation / 大きなstroke / reference確認向け。

### 注意

- 3状態はProjectへ保存しない。保存するとしてもuser preference / runtime workspace preferenceであり、作品データではない。
- 最初から自動切替しない。ユーザーが意図せずUIを見失うためである。
- ConceptのNormal / Compact / Hiddenを参考にするが、同じgestureをコピーする必要はない。
- Phase 8fのRig `CANVAS / DETAIL`と名称・shortcutが競合しないよう、QTP側の語彙は`FULL / COMPACT / HIDE`等を別Gateで決める。

---

## 5. 提案C — QTP / sidebarのVisual Surface Modernization Gate

### 対象

最初の実証対象はQTPとsidebarだけとし、Animation Tableや巨大`animation-table-popup.js`へ同時展開しない。

### Candidate 0 — 現状

現行skinをbaselineとして保存する。

### Candidate A — Borderless Icon Rail

- panel外殻のみsurface
- icon cell常時border無し
- active / hoverのみrounded surface
- groupはspacing / separator
- icon strokeはLucide系を維持し、SVG全面描き直しはしない

### Candidate B — A + Restrained Depth

Candidate Aに加えて:

- floating QTPにsoft shadow
- 低強度translucency / blur
- active controlだけ一段強いsurface

### 比較項目

1. active toolが一目で分かるか
2. click可能性を失っていないか
3. QTPがCanvasを狭く感じさせないか
4. 1280x720 / 720x720 / Browser 100%で密度が適切か
5. mouse / pen / touchで誤hitが増えないか
6. 明るい絵 / 暗い絵 / 高彩度絵でcontrastが保てるか
7. screenshotだけでなく30分程度の制作fixtureで疲労・視線移動を比較できるか

### Target size

WCAG 2.2 AAのTarget Size (Minimum)は24×24 CSS pxを基準とする。coarse pointer / touchでは、可能なら44×44 CSS px相当のEnhanced基準を目安として比較する。ただし**見えているicon自体を44pxにする必要はなく、visual iconとinteractive hit areaを分離する**。

---

## 6. 提案D — Semantic Surface TokenをUI_CSSスタイルガイドへ追加

既存資料にはDesign Token導入方針があるため、新しいCSS体系を別に作るのではなく、`UI_CSSスタイルガイド.md`へ意味レベルのTokenを追加する。

候補概念:

```text
surface.canvas
surface.rail
surface.float
surface.control
surface.controlHover
surface.controlActive
surface.input
surface.modal

border.subtle
border.focus
shadow.float
blur.float

radius.panel
radius.control
radius.chip

opacity.inactive
opacity.overlay
```

実CSS変数名は既存命名規則と照合して決める。

重要なのは色名ではなく意味である。`blue-button`のようなTokenを増やさず、Setup青 / Motion橙はsemantic stateとして既存ルールから派生させる。

---

## 7. 提案E — Familiarity / Migration Gateを追加する

TEGAKIの目標を「高機能だが入門として使え、将来CSP / Procreate / Fresco / ToonSquid等へ移っても知識が無駄になりにくい」と置く場合、競合比較を見た目だけでなく**学習転移**として評価する。

### Migration Transfer Matrix

主要操作ごとに比較する。

| 操作 | TEGAKIでの候補 | 業界での一般性 | 独自化許容 |
|---|---|---|---|
| Brush | brush icon / B系shortcut | 高 | 低 |
| Eraser | eraser icon / E系 | 高 | 低 |
| Selection | dashed selection | 高 | 低 |
| Transform | move / bounding box | 高 | 低 |
| Layer | right / contextual panel | 高 | 低〜中 |
| Timeline | bottom / collapsible | 高 | 低 |
| Rig | Canvas handle + Inspector | 中 | 中 |
| Perform | direct gesture capture | 低 | 高 |
| QTP Painter's Palette | floating compact palette | 中 | 高 |

### Gate質問

新しいUIを追加するたびに:

1. 他ツール経験者は説明なしで意味を推測できるか。
2. TEGAKIで覚えた概念は他ツールでも役立つか。
3. 独自化するなら、その学習コストを上回る制作上の利益があるか。

これにより「モダンに見せるためだけの独自UI」を抑制できる。

---

## 8. 提案F — UI Complexity Budgetを固定fixture化する

現行の「思考の水位」をさらに測定可能にする。

### 8.1 Persistent Chrome Budget

通常描画fixtureでは、常時表示するcontrol数・panel面積をbaseline化する。

「何px以下」と最初から固定するのではなく、現行 / Candidate / competitorの同一解像度screenshotで比較する。

### 8.2 Reach Depth

代表作業について、Canvasから目的操作までの到達段数を記録する。

例:

- Brush ↔ Eraser
- Brush Size
- Color
- Layer追加
- Selection → Transform
- Animation Table open
- Play / onion
- Rig Setup
- Weight correction
- Export

頻用操作は1 step前後、高度操作は段階化してよい。

### 8.3 Recovery Cost

UIを閉じた後に「元の作業へ戻れるか」を測る。

- QTP close / reopen
- Animation Table close / reopen
- Rig Workspace → normal drawing → return
- narrow → wide
- mouse → pen / touch

既存資料が強く重視している復帰契約を、UX fixtureとしても明文化する。

### 8.4 Occlusion Test

QTP / Inspector / Timelineを開いた状態で、作業対象がどれだけ隠れるかを比較する。

半透明は「見える面積」だけでなく、実際の操作可能面積を増やさないため、visual opennessとinteractive occlusionを分けて評価する。

---

## 9. 提案G — Shortcut Learning Loop

`14`と`15`にはhover説明 + shortcutが既にある。これを局所仕様ではなく共通導線にする。

### desktop

Tooltip:

```text
Eraser
E
```

または

```text
Export
Ctrl+Shift+E
```

### touch / pen

- long pressでtool名 + short description
- shortcut非存在ならgesture / QTP導線を表示

### 初回hint

CSP Simple Modeのような常時tutorial systemを今すぐ追加する必要はない。

まず、初回だけ:

- QでQTP
- VでTransform
- H / Space等のCanvas navigation
- Timelineの開閉

を短いnon-modal hintで教える程度を比較する。

重要なのは、**熟練するとGUI依存が減る設計**にすることである。

---

## 10. 提案H — Direct Manipulation Grammarを12 / 15で共通化する

`12`のResizeと`15`のRig / Motionは別機能だが、操作文法は統一できる。

### 共通文法候補

- center drag = position / framing
- edge / handle drag = size / extent / target
- corner / modifier = aspect / constrained transform
- wheel = scale / value adjustment（context明示時のみ）
- Escape / pointercancel = non-mutation
- gesture完了 = 1 History
- number field = exact value補助

この共通文法をpure helperへ無理に共通化する必要はない。まずUX規則として揃え、座標代数・History境界が本当に共有できる部分だけコード共通化する。

### 適用先

- Resize Frame
- Animation Camera Frame
- BONE / IK target
- WARP / Mesh
- Motion Perform

この統一により、新しい高度機能でも「Canvas上の対象を直接動かす」という学習済み感覚を再利用できる。

---

## 11. 競合比較を現行3製品から6製品へ拡張する

`16`の比較fixtureはCallipeg / Fresco / CSP Simple Modeで妥当だが、次の3つを追加する価値がある。

### Concepts

見るもの:

- movable palette
- docking preset
- Normal / Compact / Hidden
- menu proximity / body ergonomics

TEGAKI QTPの直接比較対象として最も有用。

### Procreate

見るもの:

- minimal persistent UI
- free-hand reach
- movable sidebar height
- hide interface
- gestureへの役割移譲

QTP / sidebarの身体性fixtureとして有用。

### ToonSquid

見るもの:

- Timeline expand / collapse / height
- selected tool再tapでoption
- effect依存toolのcontext表示
- fullscreen
- property visibility / selected effect focus

Rig / Animation Tableの高機能化fixtureとして有用。

### 位置づけ

6製品を「どれを真似るか」で比較しない。

- Callipeg: animation ergonomics
- Fresco: Canvas-centered contextual workspace
- CSP Simple: beginner / expert continuity
- Concepts: movable palette / density
- Procreate: body reach / minimal chrome
- ToonSquid: high-function animation progressive disclosure

という役割別fixtureにする。

---

## 12. 現行計画の暫定評価

以下はBrowser実画面の最新snapshotを直接操作した評価ではなく、4資料と既存Claude UI診断からの設計評価である。

| 軸 | 現行計画 | 提案反映後の期待 | コメント |
|---|---:|---:|---|
| Canvas First | 9/10 | 9.5/10 | 既に強い。壊さない |
| Progressive Disclosure | 9/10 | 9.5/10 | 思考の水位が明文化済み |
| Direct Manipulation | 8.5/10 | 9/10 | Resize / Rig / Cameraで共通文法化余地 |
| Cross-device | 8/10 | 8.5/10 | narrow / pen / touch fixtureあり |
| Familiarity / 学習転移 | 7.5/10 | 9/10 | 現状は思想として暗黙。Gate化で向上 |
| Surfaceの現代性 | 6.5〜7/10 | 8.5〜9/10 | 四角cell / Surface階層の整理余地 |
| UI Design System | 6.5/10 | 8.5/10 | Design Tokenは計画済み、semantic化で向上 |
| QTP identity | 8/10 | 9.5/10 | Painter's Paletteとして明文化すると強い |
| 高機能化耐性 | 8.5/10 | 9/10 | Contextual Inspector / UI projection分離が有利 |
| Accessibility / Signifier | 8/10 | 9/10 | contrast監査済み。hitbox/surface分離を追加 |

総合すると、**現在の課題はUI構造そのものより「構造に見合う共通Surface文法がまだ正本化されていないこと」**にある。

---

## 13. 実装しない方がよいもの

### 13.1 全面Liquid Glass化

半透明はQTP / floating Inspector等に限定し、Canvasや全panelへ一律適用しない。背景絵次第でcontrastが不安定になり、流行依存も強くなる。

### 13.2 アイコンの全面描き直し

既存Lucide系SVGは大方向として妥当。先にcell border、spacing、hover / active、container surfaceを変え、その後に本当に識別性が悪いiconだけ個別改善する。

### 13.3 Simple / Expertの二重UI

現行の「思考の水位」とContextual Disclosureでかなり同じ目的を達成できる。二重UIは設定・検証・document・touch挙動を倍化するため、必要性が実測されるまで導入しない。

### 13.4 全面Dock化 / 常設Inspector

現行16の保留判断を維持する。QTP / popup / Canvas-first shellより優位と固定fixtureで確認できる場合のみ再検討する。

### 13.5 自由カスタムrailを先行

現行14のPlan C保留を維持する。まずPreset配置とQTP densityで十分か確認する。

### 13.6 「未来感」のための独自gesture / icon

既存のstandard conventionを壊す場合は、制作速度・Canvas占有・身体到達性等の具体的利益を要求する。

---

## 14. 推奨Gate順

現行Phase 8k等を止めず、独立proposalとして次の順を推奨する。

### Gate UI-0 — Design Constitution確定（コード変更なし）

成果物:

- 8原則の採否
- competitor fixture 6製品
- QTP / peripheral railの役割定義
- Surface state一覧
- Familiarity Matrix

判定: `GO / REVISE / HOLD`

### Gate UI-1 — QTP skin prototype

production event / stateを変えず、CSS / token中心でCurrent / Candidate A / Candidate Bを比較する。

固定入力:

- 1280×720
- 720×720
- Browser 100%
- light / dark artwork
- pen / mouse / coarse pointer
- QTP open / close / reopen

### Gate UI-2 — Preset placement

既存自由位置保存を壊さず、2〜6程度の身体到達性Presetを比較する。

例:

- left upper / middle / lower
- right upper / middle / lower

数を固定する前に実制作で絞る。

### Gate UI-3 — QTP density

FULL / COMPACT / HIDDENをruntime UIとして比較する。

停止条件:

- current toolが分からなくなる
- 初心者がQTPを戻せない
- touchで状態切替gestureが誤発火する
- Rig Focus shellとの状態語彙が混線する

### Gate UI-4 — peripheral rail / shortcut learning

常時四角cellを減らし、tooltip + shortcut、long press説明を統一する。

### Gate UI-5 — Layer Panel / Animation Tableへ段階展開

QTPでSurface文法がOwner受入された後だけ、触るcomponent単位で横展開する。

`animation-table-popup.js`の全面CSS / DOM再構築はしない。

---

## 15. 既存正本への差し込み案

### `14_UIツール導線・Text・階層Motion将来設計`

追加候補:

- QTPをPainter's Paletteとして定義
- peripheral railの役割を「大分類 / 管理 / recovery」と明記
- QTP FULL / COMPACT / HIDDENを後続Plan Dとして追加
- icon hitboxとvisible cellの分離
- Concepts / ProcreateをQTP比較fixtureへ追加

### `15_キャラクターRig・Mesh・Perform統合ロードマップ`

`## 14. モダンUIの方向`へ追加候補:

- 空間文法は一般制作toolへ寄せ、独自化はRig / Perform等に限定
- Canvas handle / Contextual InspectorのSurface stateを共通UI Constitutionへ参照
- advanced submodeを増やす前にpersistent chrome budgetを評価
- direct manipulation grammarをCamera / Resizeと同じ言葉で定義

### `16_制作Workspace・UI・外部Handoff構造ロードマップ`

`## 2. 採用する原則`へ追加候補:

- QTP Painter's Palette
- Familiarity / Migration Gate
- selective translucency
- hitbox / visual size separation
- UI complexityを到達段数 / 遮蔽 /復帰コストで測る

`### 思考の水位と比較fixture`の比較対象へConcepts / Procreate / ToonSquidを追加する。

### `12_Camera_Frame・Resize_UI将来設計`

将来Resize / Camera Gateへ追加候補:

- direct manipulation grammarをUI Constitution参照にする
- handle / edgeのvisual sizeとhit areaを分離
- Camera Lane選択中だけ必要なframe surfaceを出し、通常描画時は消す

---

## 16. 最終提案

新しい大規模機能を追加する提案ではなく、**今後増える機能が同じTEGAKIに見え続けるための上位判断基準**を追加することを推奨する。

最も優先度が高いのは次の3点である。

1. **QTP = Painter's Palette**を正式なUX中心概念として固定する。
2. **常時四角buttonから、panel surface + state-dependent control surfaceへ移行する。**
3. **既存ツールからの学習転移を壊さず、独自性は高度機能と操作効率で出す。**

この3点は、現行の保存正本・Rig / Mesh・Animation設計を変えずに導入できる。また、現在計画されているDesign Token / 共通control整備と自然に接続できる。

TEGAKIの将来像は「高機能なデスクトップソフトを縮小したもの」より、**CanvasとPainter's Paletteから始まり、必要になった時だけTimeline / Rig / Inspectorの水位が上がるツール**として整理する方が一貫性が高い。

---

## 17. 調査資料

### TEGAKI内部資料

- `12_Camera_Frame・Resize_UI将来設計(2).md`
- `14_UIツール導線・Text・階層Motion将来設計(1).md`
- `15_キャラクターRig・Mesh・Perform統合ロードマップ(1).md`
- `16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
- `gui-skin-redesign-concretization-proposal.md`

### 競合・公式資料

- Concepts — Workspace / UI minimization  
  https://concepts.app/en/manual/workspace
- Concepts — Setting menus, brushes and presets  
  https://concepts.app/en/tutorials/setting-your-menus-brushes-and-presets/
- Procreate Handbook — Interface  
  https://help.procreate.com/procreate/handbook/interface-gestures/interface
- Adobe Fresco — Get started with the user interface  
  https://helpx.adobe.com/fresco/desktop/introduction/getting-started-with-user-interface.html
- CLIP STUDIO PAINT — Simple Mode and Studio Mode  
  https://help.clip-studio.com/en-us/manual_en/090_tablet/Simple_Mode_and_Studio_Mode.htm
- CLIP STUDIO PAINT — Tablet interface  
  https://help.clip-studio.com/en-us/manual_en/090_tablet/Tablet_interface.htm
- Callipeg — Main Interface  
  https://callipeg.com/learn-interface/
- Callipeg — Timeline  
  https://callipeg.com/learn-timeline/
- ToonSquid — Editor  
  https://toonsquid.com/handbook/interface/editor/
- ToonSquid — Timeline  
  https://toonsquid.com/handbook/interface/timeline/
- Apple Human Interface Guidelines — Materials  
  https://developer.apple.com/design/human-interface-guidelines/materials
- W3C WCAG 2.2 — Target Size (Minimum)  
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C WCAG 2.2 — Target Size (Enhanced)  
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- Flat Design / Flat 2.0 usability summary (Japanese translation of Nielsen Norman Group article)  
  https://u-site.jp/alertbox/flat-design

---

## 18. 採否メモ

本提案を採用する場合でも、直ちにproduction skinを変更しない。

第一歩は`Gate UI-0`で、Owner + SOL / XHighが既存UI_CSSスタイルガイド、現行QTP DOM / CSS、sidebar、tooltip、Panel position保存、Focus shellとの衝突を照合し、**「Surface文法だけを先に固定しても現在のPhase契約を壊さない」**ことを確認する。

その後、QTP一箇所だけでvisual prototypeを作り、Owner制作fixtureでCurrent / Candidate A / Candidate Bを比較してから横展開を判断する。
