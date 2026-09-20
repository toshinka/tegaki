# TEGAKI GUI先生ツール研究 04 — WARP操作面・Parameter Control・現代的な視覚階層

作成日：2026-09-20  
区分：Research Bank／非正本／非実装指示  
対象：Procreate、Adobe Fresco、CLIP STUDIO PAINT Simple Mode。補助資料：Apple HIG、W3C WCAG、限定的な利用者投稿。  
照合対象：Owner提示のTEGAKI右側WARP BRUSH画面（Vで入場、右側約172px、POINT/BRUSH、MOVE/INFLATE/PINCH、半径/強さ/硬さ、確定/取消）。本調査ではTEGAKIの最新未commit sourceを再監査していない。

## 0. 今回の問いと証拠の線引き

「現行の独自GUIを小型化する」のではなく、**利用者がCanvas上で何をしているか、右側に最低限何を残せばよいか**を先生ツールの実例で検討する。

- **公式仕様**：先生ツールの公式説明で確認できる操作・役割。
- **個別報告**：Reddit等の一利用者の経験。操作上の失敗例として扱い、頻度や普遍性を推定しない。
- **TEGAKI仮説**：別製品の仕様から考えられるTEGAKI固有の改善案。採用・実装・KEY semantics変更を含意しない。
- **未検証**：操作動画の同一端末比較、各先生ツールの実寸・RGBA値、TEGAKIのcomputed style、pen/coarseでの実操作。

## 1. 対象別：Canvas操作と設定面の分担

### 1.1 Procreate — Warp mesh と Liquify brush は別の操作系

Procreateの公式Handbookでは、通常のTransformに入ると選択対象のbounding boxが表示され、変形方式はTransform toolbarから切り替える。WarpではmeshをCanvas上に重ね、角・辺・内側のmeshを直接動かす。Advanced Meshは必要な場合に追加のnodeへ進む。**mesh操作そのものはCanvasが担い、操作方式の入口はtoolbarが担う。**

参照：
- https://help.procreate.com/procreate/handbook/transform/transform-interface-gestures
- https://help.procreate.com/procreate/handbook/transform/transform-warp

一方、LiquifyはCanvasをブラシでなぞる別の変形操作。公式では、最初のmodeボタンを開いてPush、Twirl、Pinch、Expand等のmodeを選ぶ。Size／Pressure／Distortion／Momentumは下部のslider群で調整する。**Warp meshとLiquify brushを「同じ巨大な操作一覧」に平たく並べていない。**

参照：https://help.procreate.com/procreate/handbook/adjustments/adjustments-liquify

TEGAKIへの仮説：`WARP → POINT / BRUSH →（BRUSHの時だけ）MOVE / INFLATE / PINCH → 必要なparameter`の表示階層自体は維持できる。ただし「WARP ツール」という大きな追加見出し、三つの縦積みボタン、全parameter常時表示が必要かは別問題。Canvas上のgridや円カーソルが現在のPOINT／BRUSH状態を示すため、右側で同じ情報を大きく繰り返さない。

**重要な非同一性：** Procreate WarpとLiquifyは異なる機能。TEGAKIの16点grid、SOURCE raster／ANIMATE candidate、pointer terminal、KEY確定がそのまま一致するとは言えない。

### 1.2 Adobe Fresco — Liquifyの能力選択とTool Options

Fresco公式のLiquify説明では、Transform iconからLiquifyを選び、Warp／Reconstruct／Smooth／Twirl／Pucker／Bloat／Pushを選択する。Tool OptionsでBrush Size、Density、Pressure、Rateを調整する。

参照：https://helpx.adobe.com/fresco/desktop/draw-paint-animate-and-share/liquify-tool.html

TEGAKIへの仮説：**ブラシ方式と、ブラシの大きさ・強さ等のparameterは階層を分ける**。各パラメータをすべて独立した大きなPanelとして見せる必要はない。ただしFrescoのLiquifyの各parameterとTEGAKIのRadius／Strength／Hardnessが数学的に同じだと断定しない。

### 1.3 CLIP STUDIO PAINT Simple Mode — 入口を小さくし、必要な設定へ進む

公式Tablet InterfaceではSimple Modeの主な表示として、tool bar、brush size／opacity sliders、Layer paletteが挙げられ、tool iconのdouble-tapでtool settingsを開く。公式のUsing Simple ModeではLayer thumbnailのdouble-tapまたはswipeで詳細を表示し、Layer順序の変更はthumbnailのlong-press dragを用いる。

参照：
- https://help.clip-studio.com/en-us/manual_en/090_tablet/Tablet_interface.htm
- https://help.clip-studio.com/en-us/manual_en/090_tablet/Using_Simple_Mode.htm

TEGAKIへの仮説：170px級の固定Right Workspaceに、選択方式・操作種類・数値項目を同じ高さで常設するのではなく、**主要な一手が何かを明示し、補助設定は必要時に出す**。ただし隠した操作の発見性・復帰路を欠くことも避ける。

## 2. WARP右側操作面：具体的な比較仮説

TEGAKI現行画面でユーザーが確認した構造：

```text
対象名（レイヤー1）
BASIC | WARP
WARP ツール［大きな見出し］
POINT | BRUSH
MOVE
INFLATE
PINCH
半径 ［slider］ 47px
強さ ［slider］ 0.45
硬さ ［slider］…下へscroll
確定して終了・V
取消・Esc
```

**改修案のラフな情報構造**（配置・数値仕様の採用決定ではない）：

```text
［対象名］                 ［終了／取消入口］
［BASIC｜WARP］
［POINT｜BRUSH］
［MOVE ▾］           ← BRUSH時のみ：INFLATE/PINCHへ切替
半径             47 px  ［短いslider］
強さ             0.45   ［短いslider］
［詳細 ▾］         ← 硬さ、応用・低頻度parameter
--------------------------------------------
［未確定・Frameの状態］［既存契約に沿う明示KEY／確定］
```

- **見出しの重複を削る**：「WARP ツール」は、既に`WARP`タブを選択中なら独立の大きな枠でなくてもよい。
- **大きな3段buttonをやめる案を比較**：MOVE／INFLATE／PINCHを小さなsegmented controlにできるか、あるいは現在選択中の操作名から開くmenuにするかを比較する。**隠すことで一手増える操作頻度**を測ること。Procreate Liquifyではmode buttonから一覧へ進む例があるが、TEGAKIで同じ方式がよいかは未決定。
- **現在のCanvas操作を補助表示**：POINTなら「点／meshを直接動かす」、BRUSHなら「なぞって変形」等の短い説明を表示する候補。ただし毎回大きな説明箱を常設しない。
- **Gridを隠すかは保留**：BRUSH中のgrid表示が変形結果の把握に必要かはOwner実操作とrenderer側の制約による。先生ツールの見た目のみから強制非表示を指示しない。
- **KEYと終了を混同しない**：TEGAKIのANIMATE pending／KEYとSOURCE確定／取消は、Procreateの一般的なcommitとは別の既存契約。固定footerが必要かも実際の縦scrollを確認して決める。

## 3. Sliderの「統一」はskinだけでなく、入力文法と責務の統一

### 3.1 先生ツールが教える入力分業

Procreate公式Interfaceでは、側面sliderがBrush size／opacityを担当する。size sliderを押したまま横方向へ動かしてから縦方向へ動かすと細かい増減に切り替わる。Sidebarの左右位置・高さも変更でき、利き手で描く際の到達性に配慮されている。

参照：https://help.procreate.com/procreate/handbook/interface-gestures/interface

CLIP STUDIO PAINT Simple Modeではsize／opacityを常時近くに置く一方、Tool settingsは別の入口から展開する。**速く頻繁に触る値と、深い設定を同じ表示密度にする必要はない。**

TEGAKIの既存調査によれば、WARP native range、Quick Access、SliderUtils等の入力経路は複数存在する。Research Bankで既に確認した「見た目と入力契約を分けて監査する」という方針をここでも維持する。

### 3.2 TEGAKI Parameter Controlの候補契約

| 領域 | 候補 | 先に確認すること |
|---|---|---|
| 表示 | `短いlabel + 現在値 + 控えめなtrack`を同一文法にする | 文字の可読性・右側幅・値の単位 |
| 精密入力 | 必要なら数値欄を直接編集 | mouse／pen／touch、IME、数値検証 |
| 微調整 | keyboard／wheel／scrub等の採否を比較 | Scroll中の意図しない値変更、focus、pointer capture |
| Canvas近接 | WARP BRUSH中だけのmode-local radius gesture候補 | `B`既存ショートカット、通常Stroke抑止、History |
| preview | 操作中は既存のpreview authorityへ委譲 | SOURCE／ANIMATEのcost path差異 |
| 確定・取消 | skinでなく既存parameter／sessionの所有者へ委譲 | pointercancel／lost、pending／KEY境界 |

新しい共通componentを作る場合も、既存`slider-utils.js`をそのまま標準とみなさず、Quick Accessのwheel／numeric、WARP native range、Historyとの関係を調べて採否を決める。

**特にwheelは危険**：右Workspaceの縦スクロール中に、hoverしたSliderの値まで変わる設計は、TEGAKIの現状の懸念を悪化させ得る。wheel対応の有無そのものより、明示的focus／修飾キー／操作開始条件を設計する。

## 4. Compact UI：小さくする対象を間違えない

W3C WCAG 2.2のTarget Size (Minimum)では、pointer targetの大きさについて原則24×24 CSS px、または規定の間隔・代替経路などの例外を示す。これは**TEGAKIの実装サイズを一律24pxに固定する指示ではない**。ペン・タッチを考えると、大きいhit areaを保ったまま文字・枠・上下余白・装飾を抑える方がよい場合がある。

出典：https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

コンパクト化の順番（TEGAKIへの仮説）：

1. 同義の見出しと二重の囲みを減らす。
2. 同時に見る必要のない低頻度の操作を段階的に開く。
3. 縦積みしたmode buttonを、情報と誤操作率を比較しながらコンパクトにする。
4. label・値・sliderの並び方を同じ規格へ寄せる。
5. その後でfont size、padding、control heightを調整する。

単純なfont／button一律縮小は最後。実際のhit areaは見た目より広く取れる。粗いpointerの有無を問わずfocusを消さない。

## 5. 現代的な見た目：Glassやgradientは「主役」でなく階層表現

Appleの現行HIGはLiquid Glassをnavigation／controlsの機能レイヤーとして扱い、コンテンツ全域や多数のcustom controlへむやみに使わないよう案内する。標準materialや透過は、後ろの内容を把握しつつ文字・controlを読めるようにすることが前提。

出典：https://developer.apple.com/design/human-interface-guidelines/materials

TEGAKIへの仮説：

- MAROON系gradientは右Frame外枠やmodeの奥行きに限定し、すべてのbuttonへ重ねない。
- cream系の薄いsurfaceでcontrolをグループ化。枠＋影＋強い塗りを全buttonへ同時適用しない。
- Canvasに重なる浮動面だけに、必要に応じて背景半透明・blurを使う。**右側で置換する固定Frameを必ず擦りガラスにする必要はない**。
- 色の正本は`tegaki_work/styles/main.css`の`--futaba-*`系列。新しい差し色は同ファイルへ用途とともに登録。今回のResearchはtoken追加を承認しない。
- 「今風」の判断をガラス量や影の有無だけで行わない。現在地、状態の区別、scroll位置、KEYへの到達、Canvasの見える面積で評価する。

HIGのスクリーンショットやProcreateのmaterialをそのままWeb CSSへ写し、実機と同等の動的透過・読みやすさになると仮定しない。

## 6. 利用者の不満は、採用候補に対する反証テストになる

### Procreate Pocket：Sliderの誤触によるサイズ変更（個別報告、2023年）

画面左端を描こうとするとsize sliderに触れ、筆幅が変わるという利用者投稿がある。iPad版ではなく**Procreate Pocketのphone上の話**なので、そのままiPadやTEGAKI desktopの代表例にしない。TEGAKIが画面端に頻用sliderを置く場合の、誤触・Canvas境界・input ownershipを試験する材料にはなる。

https://www.reddit.com/r/ProCreate/comments/175rd2m/

### CLIP STUDIO PAINT iPad：GUIをさらに小さくしたい（個別報告、2025年）

iPadでUIを縮めたいという投稿に対し、Simple Modeだけでは要望に合わず、workspace整理について議論されている。「Simple Mode＝すべての利用者に十分な表示密度」という仮定への反例。ただし一件の利用者体験である。

https://www.reddit.com/r/ClipStudio/comments/1okhmg4/

### Procreate：ZoomとBrush sizeの意味が分かりにくい（個別報告、2026年）

Zoom後のstroke sizeの見え方について利用者が混乱した投稿があり、設定でCanvas基準／Screen基準を説明する回答が付いている。TEGAKIでもWARP BRUSHの`47px`がCanvas px／screen pxのどちらか、倍率変更時にどう見えるかを明記する必要性を示唆する。実際のTEGAKI実装がどちらかは未確認。

https://www.reddit.com/r/ProCreate/comments/1vcf7x3/is_there_any_way_i_can_fix_my_brush_size/

## 7. TEGAKIへの暫定結論（まだ仕様に昇格しない）

**候補P1：WARP操作面の階層整理を優先**。POINT／BRUSH→選択中の動作→その動作に必要なparameter、という文法をテストする。Procreate Warp／Liquifyが別の操作入口を持つことは比較材料だが、TEGAKIのKEY／Historyを変更する根拠ではない。

**候補P2：Parameter ControlはUI skinと入力契約を分けて研究**。短いlabel、数値、Slider、Canvas上の直接調整の複数経路を使うとしても、DOMAIN別preview／terminalは維持する。

**候補P3：172pxの縦密度を先に改善**。新幅を承認する前に、二重見出し、縦積みbutton、低頻度parameter、過剰な影・余白を削ったfixtureを比較する。押下領域／keyboard focus／KEYの到達性を犠牲にしない。

**候補P4：Futaba palette＋限定material**。現代的なiPad GUIを参照しつつ、TEGAKIのMAROON／creamを保ち、ガラスやgradientを限定的に使う。単なるデザイン流行の移植ではない。

## 8. 次回の具体的調査課題

第5回は、**TEGAKIの172px WARP操作面に対する3案比較**へ進む。各案は情報の順序・クリック数・scroll・hit area・KEY到達性・Canvas上のPOINT/BRUSH表示を揃えて比べる。加えて、ProcreateとFrescoの実画面／動画で、mode selectorとparameterの出現・退出を確認する。最終配置の採否はOwnerに残す。

なお既存Luna MAXのEdit Boundary Gate（pending／KEY／pointer／focus）が未完了なら、実際のproduction GUI改修はその結果を監査した後に行う。GUI researchとruntime安全性検証を混同しない。

## 9. Source Index／信頼度

**公式仕様（今回直接照合）**

1. Procreate, Interface / Sidebar: https://help.procreate.com/procreate/handbook/interface-gestures/interface
2. Procreate, Transform Interface: https://help.procreate.com/procreate/handbook/transform/transform-interface-gestures
3. Procreate, Warp: https://help.procreate.com/procreate/handbook/transform/transform-warp
4. Procreate, Liquify: https://help.procreate.com/procreate/handbook/adjustments/adjustments-liquify
5. Adobe Fresco, Liquify: https://helpx.adobe.com/fresco/desktop/draw-paint-animate-and-share/liquify-tool.html
6. CLIP STUDIO PAINT, Tablet Interface: https://help.clip-studio.com/en-us/manual_en/090_tablet/Tablet_interface.htm
7. CLIP STUDIO PAINT, Using Simple Mode: https://help.clip-studio.com/en-us/manual_en/090_tablet/Using_Simple_Mode.htm
8. Apple HIG, Materials: https://developer.apple.com/design/human-interface-guidelines/materials
9. W3C, Target Size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

**個別利用者の証言（製品全体の評価ではない）**

10. Procreate Pocket slider edge: https://www.reddit.com/r/ProCreate/comments/175rd2m/
11. CSP iPad workspace density: https://www.reddit.com/r/ClipStudio/comments/1okhmg4/
12. Procreate brush size versus zoom: https://www.reddit.com/r/ProCreate/comments/1vcf7x3/is_there_any_way_i_can_fix_my_brush_size/

**未検証**：各先生ツールの現行版を実機で操作した場合の寸法・動的material・具体的なgesture latency。TEGAKIの最新production CSS computed style・Input authority。調査上の候補をAstraの実装許可へ読み替えない。
