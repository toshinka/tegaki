# TEGAKI GUI先生ツール研究 03 — Adobe Fresco / CLIP STUDIO PAINT Simple Mode

作成日: 2026-09-20  
区分: Research Bank / 非正本・非実装指示 / Source-backed observations + TEGAKI hypotheses  
主題: Canvas-first、Transform/WARPの操作文法、Parameter Control、画面密度、視覚的階層、Tablet入力

## 0. 対象と留保

今回の中心はAdobe Fresco（2026年5月更新の公式UI説明を含む）と、CLIP STUDIO PAINTのTablet Simple Mode（2026年時点の公式マニュアル・公式TIPS）。LYRICA等の動画ツール研究とは別に、描画中の操作面に焦点を当てる。

「先生ツールと同じ外観にする」のではなく、具体的な**行為→表示の変化→Canvas操作→確定/取消**を記録する。公式文書による仕様、利用者の個別経験、TEGAKIへの設計仮説を混同しない。スクリーンショットからCSS px、実寸、半透明のalpha、影の設定値を断定しない。実アプリ実機操作、同一条件での画面占有率測定は今回未実施。

今回の発見は、前回までの「右側単一Workspace Frame / LayerをTransformで置換する」方向と突き合わせる材料であり、既存History・KEY・WARP semanticsを変更する承認ではない。

## 1. Adobe Fresco — Canvas周辺に役割別の薄い入口を置く

### 1.1 公式文書で確認できる操作構造 [F-01]

- Frescoのworkspaceには左・上・右の各tool/control面があり、toolbarからBrush、Selection、Transform、Text、fullscreen等へ入る。右のTaskbarはLayer操作入口であり、Layer PanelやLayer actionsを開ける。
- Brushを使用中はTool Optionsからbrush size、flow、smoothingを調整する。Apple Pencil Proのsqueezeから最近のbrush、color、brush size、undo/redoへアクセスできる。Touch Shortcutは短時間だけ別機能を有効にし、必要ならlock状態にもできる。
- Transformでは選択したLayer/対象にbounding boxを出し、handleをCanvas上でdragする。Scale / perspective / distortはoptionから選ぶ。終了は変形mode上部のDoneとCancelで区別される。

出典: Adobe公式UI資料（2026-05-07更新） https://helpx.adobe.com/fresco/desktop/introduction/getting-started-with-user-interface.html  
Adobe公式Transform（2023-05-24更新） https://helpx.adobe.com/fresco/desktop/draw-paint-animate-and-share/free-transform-tool.html

### 1.2 Parameter Controlに関する具体的な先生 [F-02]

Fresco公式は、Brush size / flow / smoothingの操作として「sliderをdrag」「値をtapして数値入力」を併記する。Slider thumbの両側をtapして増減、thumbをdouble-tapしてdefaultに戻す入力も説明している。

**TEGAKI候補:** Radius / Strength / Hardnessは各々独立の大きなUIではなく、同じ「短いラベル＋現在値＋1本のcompact slider」の部品文法で揃える。正確な値はnumber input、素早い値変更はsliderまたはCanvas gestureで補完。ただしFrescoのwheel / keyboard / cancel / Historyに関する契約を、この資料からTEGAKI標準と断定しない。

出典: Adobe公式UI https://helpx.adobe.com/fresco/desktop/introduction/getting-started-with-user-interface.html

### 1.3 Transformにおける主従関係 [F-03]

Canvas上のbounding box/handleが変形の主操作。option panelは現在の変形方式を指定し、Done/Cancelを明示する。これは「右の設定欄を巨大化せず、Canvasで操作する」というTEGAKI方向に接続できる。

一方、Fresco公式のDone/CancelをそのままTEGAKIのSOURCE bake、ANIMATE KEY、pending guardに転用できない。TEGAKIでは「Pointer gesture終了」「候補保持」「KEY明示確定」「Transform session終了」は分離されている。

出典: Adobe公式Transform https://helpx.adobe.com/fresco/desktop/draw-paint-animate-and-share/free-transform-tool.html

### 1.4 Shortcutは具体的な入力契約である [F-04]

Fresco公式Shortcut一覧では、TransformはiOSでCommand+T、WindowsでCtrl+T。iOS/WindowsのBは「前のBrushに戻す」、VはVector Brush。Windowsの上下Arrowはtransform中の移動ではなく、Layerを1px nudgeする文脈が示される。ツールごとに同じキーの意味が異なるため、TEGAKIの`V`や候補の`B+drag`を「Frescoと同じ」と説明してはならない。

**TEGAKI候補:** `B+drag`を採るなら、明示されたWARP Brush modeでのみRadius adjustment、Pointer dragとBrush strokeが競合しないscopeを先に定義。既存Keymap・IME・brush/tool shortcuts確認は別Gate。

出典: Adobe公式Shortcuts（2025-09-03更新） https://helpx.adobe.com/fresco/desktop/introduction/keyboard-shortcuts.html

## 2. CLIP STUDIO PAINT Simple Mode — 機能入口とCanvas優先

### 2.1 最新系のSimple Modeは「描画だけ」の古い仕様ではない [C-01]

公式Tablet Interfaceでは、Simple Modeの主構成をtool bar / color icons / Layer palette / Brush size slider / Opacity slider等として説明する。tool iconのdouble tapでtool settingsを開く。brush候補を開き、Canvasをtapすると候補panelを閉じる。Layer paletteは右側、選択layerをlong press / dragして並べ替え、double tapまたは左swipeで詳細操作を呼ぶ。

公式の2025年12月v4.2.0更新では、Simple ModeにもPuppet warpと簡易Animationを導入。古い「Simple ModeにはWarpやAnimationがない」という外部記事を現在仕様として転記しない。2026年の現行manualはVer.5.0系でUI刷新にも言及している。個別の公式TipsにはVer.5.1向け表記もあるため、画面画像のversionは比較時に必ず記録する。

出典: Tablet Interface https://help.clip-studio.com/en-us/manual_en/090_tablet/Tablet_interface.htm  
Using Simple Mode https://help.clip-studio.com/en-us/manual_en/090_tablet/Using_Simple_Mode.htm  
Release Notes v4.2 https://www.clipstudio.net/en/dl/release_note/v4/  
Updates v5.0 https://help.clip-studio.com/en-us/manual_en/030_new/030_new.htm

### 2.2 Tool modeの入口と表示面の節約 [C-02]

描画toolはtoolbarから呼ぶ。Brush候補は必要時に展開され、Canvasへtapすると消える。Brush sizeとopacityは短い操作経路を持つ。Layerの詳細は同じ大きなpanelへ常設せず、thumbnailから必要時に呼び出す。

**TEGAKI候補:** `POINT / BRUSH`と`MOVE / INFLATE / PINCH`を「二つの選択階層」として視覚上分け、選択された能力だけParameterを露出。単純にボタンを一律縮小するのではなく、主操作（Canvas）とmode入口（Panel）と詳細設定を分ける。

出典: Using Simple Mode https://help.clip-studio.com/en-us/manual_en/090_tablet/Using_Simple_Mode.htm

### 2.3 Transform / Mesh / Puppet warpにおける選択的露出 [C-03]

CELSYS公式のTransform解説はSimple ModeでtoolbarのMove / Transformから各方式へ入ると説明。Transform中はCanvas上のbounding boxやhandleが主操作となり、詳細は必要なTool Settingsに置く。Mesh TransformationもSimple ModeのMove / Transform内tabから選べる。

Puppet warpのSimple Mode版は、Layerを選択→Move / Transform→Puppet warp→Canvas上のmeshとpinを操作→画面右上OKで確定する流れ。`Show mesh`の表示切替も用意され、操作対象を見たいときはmeshを隠せる。ただし、meshそのもののアルゴリズム・pin modelはTEGAKIの16点WARPの代替とは限らない。

**TEGAKI候補:** WARPの「今はPOINT編集なのか、BRUSHでgridをなぞるのか」をCanvas cursor/overlayとPanelの双方で示す。BRUSH中にgridを常時全面表示する必要があるかは検証対象。Canvas表示を優先するmesh visibility選択を候補とする。SOURCE/ANIMATE KEYをCSPのOKへ単純同一化しない。

出典: CELSYS公式Transform https://tips.clip-studio.com/en-us/articles/11035  
CELSYS公式Simple Mode Puppet warp https://tips.clip-studio.com/en-us/articles/11419

### 2.4 Simple / Studioの往復は良い面と制約の両方 [C-04]

公式はSimple ModeをCanvas空間優先、Studio Modeを多機能・カスタマイズ可能なinterfaceと説明し、モード切替を許す。しかしSimple Mode未対応のLayerは同モード内で編集できず、Studioへの切替が必要である。2024年3月以降Simple Modeにもshortcutはあるが、公式FAQによれば割当固定。

**TEGAKI候補:** 「入口は簡単・深い能力へ進める」哲学の参考。ただし、別modeへ飛ばすたびに対象やpendingを失わせる設計、Simple Mode相当で特殊Layerを扱えなくする仕様はコピーしない。TEGAKIでは同じProject/Canvas/selection authorityを保持したFocus Lensを優先検討。

出典: Mode説明 https://help.clip-studio.com/en-us/manual_en/090_tablet/Simple_Mode_and_Studio_Mode.htm  
公式FAQ https://support.clip-studio.com/en-us/faq/articles/20230045

## 3. ユーザー不満・負の先生（代表例、製品全体評価ではない）

| ID | 年と出典 | 個別の訴え | TEGAKIで避けたい設計失敗 |
|---|---|---|---|
| N-01 | Adobe Community / 2026-05 / Fresco 7.3 iPad UI変更 | undo/redoの移動が長年のmuscle memoryを壊し、定規等の入口が見つけにくいとの投稿 | 新Workspace Frame採用後に既存ショートカット・再生・確定位置を理由なく頻繁に動かさない |
| N-02 | Adobe Community / 2024-01, 2025-01追記 | brush sizeの表示位置を発見できず、panelを意図せず移動していたと気づいた投稿 | Panelは消えたのか、scroll外か、別modeへ切り替わったのか現在地を示す |
| N-03 | Reddit / 2023-09 | Simple ModeでLayerの透過sliderがLayer数変更後に消えたという投稿と返信 | 情報密度適応で必須controlを無告知に消さない。所在を維持または明示した入口に置く |
| N-04 | Reddit / 2023-08 | Simple Modeでは必要機能・カスタマイズが不足と感じた投稿 | 「最小化＝機能不足」にならないよう深い入口を残す |
| N-05 | Reddit / 2026-09 | 特定BrushではSimple Modeにstabilizer設定が表示されないとの報告 | 設定の有無が対象の属性か、UI不足かをユーザーが判別できるようにする |

Sources:
- N-01 https://community.adobe.com/questions-646/request-to-revert-the-ui-changes-in-the-latest-fresco-update-1560871/index4.html
- N-02 https://community.adobe.com/t5/fresco-discussions/i-can-t-view-my-brush-size-in-fresco/td-p/14352344
- N-03 https://www.reddit.com/r/ClipStudio/comments/16t3uth
- N-04 https://www.reddit.com/r/ClipStudio/comments/15ftf77
- N-05 https://www.reddit.com/r/ClipStudio/comments/1wk2by4/problem_with_the_csp_stabilizer_in_simple_mode/

注意: 過去versionの報告や特定の端末・Brushに依存する問題が含まれる。「現在もすべてのユーザーで再現する」根拠ではない。特にN-05の投稿日は2026-09-18で回答数が少なく、原因は不明。

## 4. TEGAKI画面への適用候補：WARPの操作文法

直近Owner画像のWARP画面では、172pxのRight Workspace上で`WARPツール`大見出し、`POINT / BRUSH`、縦積み`MOVE / INFLATE / PINCH`、半径/強さの独立range、内部scrollと大きな確定・取消が併存している。画像上の印象と、実Browserのclick/pointer traceは区別する。

### 4.1 見せる階層案（未採用）

```text
[対象: レイヤー1]       [確定/取消は既存terminalに接続]
[BASIC | WARP]
[POINT | BRUSH]
BRUSH時のみ: [MOVE | INFLATE | PINCH] (compact selector)
           Radius [value] ─ slider
           Strength [value] ─ slider
           Hardness [value] ─ slider
Canvas: 現在のpointerがBRUSHであることをcursor・grid表示で通知
```

- WARP「大見出し」は現modeの重複なら削減候補。
- `MOVE / INFLATE / PINCH`は3枚の大ボタンではなく、172pxでも成立するradio/segmentedまたは小さなmenuを比較。選択ミスとhit areaを検証するまでは小型化の承認をしない。
- 正確な数値入力と素早い値変更を同一Parameter Controlの文法で表現する。ただし別途既存Quick Access / SliderUtilsのgesture/cancel/commitを監査する。
- GridとBrush cursorがCanvasを過剰に覆う場合、状態に応じたgrid visibility切替を比較する。
- `KEY確定`と`Transform終了`、SOURCEの確定/取消、ANIMATEのKEY確定を、一個のUIへ統合しない。既存Terminalを維持。

### 4.2 サイズ削減で「しないこと」

フォント・button・hit targetを一律に縮小すること。深い設定を無言で隠すこと。KEYをscrollの底へ追いやること。Opacity/Glass表現で文字まで透明にして可読性を落とすこと。Browserで再現できない黒outlineをCSS思い込みで消すこと。

## 5. Compact / Modern Visual Grammar：現時点では設計仮説

Fresco/CSPの公式文書は操作手順の根拠として強いが、**「このツールには影がない」「二色が現代の絶対基準」「すりガラスが唯一のiPad UI」**を示す資料ではない。外観の厳密な比較には、version・端末・同条件の公式スクリーンショット、押下状態をそろえたvisual studyが必要。

暫定的なTEGAKIの比較案:

- `main.css`の`--futaba-*`を基調に既存MAROON/cream surfaceを再利用。新しい差し色は同ファイルへ用途とともに登録する（Owner方針）。
- 階層は**位置・typography・余白・選択印**で示す。全部を太いborderと下辺shadowの大ボタンにはしない。
- 面の透明度はCanvasとの重畳が避けられない場合の局所策。現在のRight Workspace Frameが既存領域へ置換するなら、先に重畳削減・scroll責務を確認する。
- keyboard focusは可視のまま。Pointer/penのhit targetと視覚的なbutton寸法は分けて試作する（小さく描画しつつ押せる範囲は確保）。
- `:focus-visible` / theme token / disabled / hover / selected / pending / KEYを同じorange skinに重ねない。

## 6. 既存技術Bankとの接続：先に共通化すべきとは限らない

Research HandoffのCanvas-first、Focus Lens、parameter/gesture primitiveに関する候補を、本研究の画面操作文法の**実装前照合先**とする。

1. UI grammarを先に絞る：WARPで何を即時表示し、何をCanvas操作に委ねるか。
2. 既存Quick Access / layer opacity / SliderUtils / WARP native rangeを、keyboard、wheel、number、preview/commit、cancel、pointer captureで比較。
3. 共通化できるskinと、各domainが所有すべきsemantic・Historyを分離。
4. TEGAKI実Browserのpen/mouse/coarse、wide/narrowで比較し、必要なcapabilityだけbounded実装。

「先生の見た目を移植する」と「先生の実装・Gesture Kernelを移植する」は別の判断。source側のHistoryやcoordinate authorityを模倣で書き換えない。

## 7. 次回（Research 04）

**同一制作手順の視覚比較を行う。** Adobe Fresco / CSP Simple Modeの現行公式画面を、通常Drawing・Layer一覧・Transform開始・WARP/mesh・詳細parameter・確定・Timeline表示で揃えて調べる。あわせてProcreate/ToonSquid/Callipegから、compact parameterとcontext-sensitive overlayの比較材料を限定収集する。

次回は、`TEGAKI WARP現画面 → Compact案A（2階層selector） → 案B（Canvas Gesture中心）`を対比する**寸法・操作手順付き**の実験仕様へ落とす。手元のTEGAKI作業に先立ち、Luna Edit Boundary Gateで安全性が確認される必要がある。

## 8. 出典Index（調査時点で確認したURL）

F-01/F-02 https://helpx.adobe.com/fresco/desktop/introduction/getting-started-with-user-interface.html

F-03 https://helpx.adobe.com/fresco/desktop/draw-paint-animate-and-share/free-transform-tool.html

F-04 https://helpx.adobe.com/fresco/desktop/introduction/keyboard-shortcuts.html

C-01 https://help.clip-studio.com/en-us/manual_en/090_tablet/Tablet_interface.htm

C-01/C-02 https://help.clip-studio.com/en-us/manual_en/090_tablet/Using_Simple_Mode.htm

C-01 https://www.clipstudio.net/en/dl/release_note/v4/

C-01 https://help.clip-studio.com/en-us/manual_en/030_new/030_new.htm

C-03 https://tips.clip-studio.com/en-us/articles/11035

C-03 https://tips.clip-studio.com/en-us/articles/11419

C-04 https://help.clip-studio.com/en-us/manual_en/090_tablet/Simple_Mode_and_Studio_Mode.htm

C-04 https://support.clip-studio.com/en-us/faq/articles/20230045

TEGAKI prior research: TEGAKI_OSS_GUI_Interaction_Research_Handoff_2026-09-18.md; TEGAKI_GUI_SENSEI_RESEARCH_01_2026-09-20.md; TEGAKI_GUI_SENSEI_RESEARCH_02_2026-09-20.md
