# TEGAKI GUI先生ツール研究 12 — 実画面参照付き Animation Table／Playback／右Workspace ビジュアル設計案

作成日：2026-09-20  
区分：Visual Research / Design Proposal（非正本、非実装Card）  
保管先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_12_2026-09-20.md`  
同梱画像：`TEGAKI_GUI_CURRENT_TRANSFORM_TABLE_2026-09-20.png`、`TEGAKI_GUI_CURRENT_RIG_TABLE_2026-09-20.png`（Owner提供画像の無加工コピー）  
接続文書：研究 01–11。特に 07（Time UI 三案）、11（既存frame-indicator）、最新Luna Frame Navigation Fallback Boundary報告。  
この回の到達：**今後のレイアウト実験の初期案と、先生画像・説明書の対応箇所を固定**。実画面URLは閲覧入口であり、画像そのものの著作権・バージョン・OS条件は原提供元に従う。先生のCSS実寸や実機の操作遷移を計測したものではない。

---

## 0. この文書を開く順序

1. §1 の現行TEGAKI画像①②で「どこがCanvasを塞ぐか」を確認。
2. §2 の各公式説明書URLを開き、**指定した節と掲載画像**を見る。単なる製品トップページではなく、参照する操作状態を併記した。
3. §3 のTEGAKI配置図を開いたまま先生の掲載画像と左右に置いて比較。
4. §4–6の具体的UI候補と視覚ルールを確認。
5. §8のUNKNOWN／受入観点を経て、Ownerが画面を見て修正。実装・巨大リファクタリングへ直行しない。

表記：**OBSERVED**＝今回のOwner画面から直接読めること、**SOURCE**＝リンク先公式資料で記載されていること、**PROPOSAL**＝WebSOLのTEGAKI向け設計案、**UNKNOWN**＝コード・実機・画面で未確定。古い研究案を最新production事実へ無断昇格しない。

---

## 1. 現行TEGAKIの固定スクリーンショット

### 1-A. Transform ANIMATE＋Animation Table 展開

![Owner提供：Transform ANIMATE と Animation Table](./TEGAKI_GUI_CURRENT_TRANSFORM_TABLE_2026-09-20.png)

**OBSERVED：** Canvasの変形境界矩形が大きい一方、Animation Tableの浮動面がCanvasの下半分に重なる。中央の再生ボタンは目立つが、Tableの上段には「6」「24」「ALL」、再生、loop、LAST CLIP、PREVIEW、ghostらしい値、閉じるが散在する。これら各値の意味・現行動作は画像だけでは断定しない。右Transform FrameにBASIC／WARP、ANIMATE・F1 KEYED、KEY前後、詳細、確定／取消が表示される。**大きく目立つKEY操作と、時間の前後Frame／再生は同義ではない。**

**Ownerの意図：** SOURCE変形（原画／全体）からAnimation Tableへ入る際は別作業へ遷移する。ANIMATEは一Frame内の対象。Table表示のためにSOURCEの編集画面を終了させること自体は否定しない。

**UNKNOWN：** その終了がソース変更の取消・確定のどちらを実際に実行したか、既存History増加の内容。既存仕様と結果の一致が必要になる時だけ局所検証する。今回のGUIリファレンス作成を止める条件ではない。

### 1-B. 旧RIG Workspace＋Animation Table 展開

![Owner提供：旧RIG Workspace と Animation Table](./TEGAKI_GUI_CURRENT_RIG_TABLE_2026-09-20.png)

**OBSERVED：** 旧RIG WorkspaceがCanvas上方へ広く重なり、下からはAnimation Tableが重なる。骨・pivot付近の描画結果を見ながら編集できる中央領域が狭い。右側にはLayer一覧とRIGの入口が残る。旧WorkspaceにはBONE追加、AUTO GRID／SHAPE／LINE、PIVOTなど、新面へ移管しきっていない能力がある。

**PROPOSAL：** 旧RIG Workspaceは機能参照／部品置き場として残す。RIGの新しい実制作経路が通った能力から退役させる。新旧の表示・編集を同時に常設しない。**旧Workspaceの削除を先に行わない。**

---

## 2. 先生の「該当状態」が見える一次資料と画像の見どころ

公式の実画面・説明書を優先。**画像の横幅・ボタンpxをこちらで実測したと偽らない。** 各リンク先に画像がある場合は、特定の節を開いてその図を参照する。公式ページが後日更新される可能性があるため、調査日と画面状態を同時に記録する。

| ID | 先生／観察する操作状態 | URL・開く節／掲載画像 | 確認できる操作・造形の材料 | TEGAKIで参考にする箇所と注意 |
|---|---|---|---|---|
| T-01 | **ToonSquid：Timeline展開／収納** | https://toonsquid.com/handbook/interface/timeline/  の **Expand and Collapse** と説明画像 | Timeline右下の展開入口。畳むとCanvas面積を確保する。 | Tableの開閉入口を発見可能に。展開／収納でCanvasが隠れない設計を比較。 |
| T-02 | **ToonSquid：Playback Toolbar** | 同ページの **Playback Toolbar**、**Next / Previous Frame**、**Play and Pause** と掲載画像 | Playback ToolbarはTimeline上端にあり、Timeline収納中も残る。前後FrameはToolbar左端。再生・停止は同じbuttonで切り替わる。 | 下部の単一transportの形・場所の主要先例。**ToonSquidの全ボタンを常設コピーしない**。 |
| T-03 | **ToonSquid：高さ変更／多数Layer** | 同ページの **Custom Timeline Height**、**Expand and Collapse** | Playback Toolbarを長押しして上下ドラッグでTimeline高さ変更。一定以上のLayerは内部scroll。 | 新しい巨大浮動Tableではなく下部時間面＋内部scrollへ。dragだけでなく展開ボタンも必須。 |
| C-01 | **Callipeg：Timeline展開／非表示・frame番号** | https://callipeg.com/learn-timeline/ の冒頭 **Timeline** と掲載画像 | Timelineは画面下部、縦に拡張可能。アイコンで隠せる。frame番号表示、時間表示の切替。 | 下部の時間領域という位置の先例。TEGAKIのFrame表示を秒表示へ無断変更しない。 |
| C-02 | **Callipeg：Transformでリストを置換** | https://callipeg.com/learn-transformation-layer/ の **THE TIMELINE**／curves modeの掲載画像 | curves modeでは、通常Layer pileの位置にTransform options／linked layersの編集面が現れる。 | 「LayerとTransformを横並びに増設」ではなく、既存領域の意味を置換する先例。TEGAKIの右Frameと機能所有権は同じではない。 |
| C-03 | **Callipeg：Layerの位置・利き手** | https://callipeg.com/learn-layers/ の冒頭の掲載画像 | LayerはTimeline側に表示し、左利き設定では位置を変える説明がある。 | TEGAKIの右Layer面をCallipegと同じ位置に強制するのでなく、入力手とCanvasの関係を評価する。 |
| P-01 | **Procreate：Transform操作中** | https://help.procreate.com/procreate/handbook/transform/transform-interface-gestures の **Interface / Transformation Methods / Numeric input** | Canvas上の境界／handle、Transform方式のToolbar、必要時の数値入力が分担される。 | Canvas上で変形、右には状態と精密値を凝縮。ProcreateのTransform確定方式をTEGAKIのKEY semanticsへ移植しない。 |
| P-02 | **Procreate：通常Canvas／最小UI** | https://help.procreate.com/procreate/handbook/interface-gestures/interface の **Interface Layout / Customize Interface** | Canvas中心、Painting Tools、左右入替可能なsidebarを明記。 | 視覚主役をCanvasに、よく使う機能だけを常設。暗色テーマやアイコンをコピーしない。 |
| F-01 | **Adobe Fresco：Document workspaceの全景** | https://helpx.adobe.com/jp/fresco/desktop/introduction/getting-started-with-user-interface.html の **ドキュメントワークスペースの概要** と掲載画像 | Canvasを中心に、左／上／右のツールと補助controlを分離。2026-09-08更新と表示された資料。 | TEGAKI左Tool Railと右Contextの密度・優先順位を目で比較する。固定サイズの正本ではない。 |
| S-01 | **CLIP STUDIO PAINT：Simple Modeの全景** | https://help.clip-studio.com/en-us/manual_en/090_tablet/Tablet_interface.htm の **Simple Mode interface** 冒頭の番号付き掲載画像 | 画面を描画に使い、基本的な道具への入口をまとめる。 | Canvas-first時のアイコン間隔・余白・現在モードの強調を確認。CSPの独自themeはコピーしない。 |
| S-02 | **CSP：道具／筆サイズ設定を展開した状態** | https://help.clip-studio.com/en-us/manual_en/090_tablet/Using_Simple_Mode.htm の **Drawing on the canvas**、brush list／slidersの掲載画像 | brush toolを選び直してbrush listを開き、Canvasへ戻ると閉じる。size／opacity sliderは下部。 | WARPの方式選択とparameter面は同列の大ボタンを積み続ける必要がない。現行WARP操作は別回に限って変更。 |
| L-01 | **LYRICA：Workspace／再生・Clip Editor** | https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12 の製品スクリーンショット欄、および https://store.steampowered.com/app/5106770/Lyrica/ のMedia欄 | 公式説明からBPM Timeline、歌詞／Clip配置、real-time previewは確認可能。**今回の閲覧では最新版の再生buttonの正確な座標・収納時挙動・右Clip Editorの実画面連続遷移は確定できなかった。** | 画面密度・統一感の優先参照候補。スクリーンショットの取得／バージョン特定後に、具体的button位置の参考へ昇格する。 |

**L-01の補助的な利用者画面（公式マニュアルではない）：** https://note.com/yoinagi_kanata/n/n213bca5793f9 。Lyrica v1.0.2の利用者による操作画像・使い勝手／トラック数やStyle再利用に関する要望がある。**2026-09-20最新版のUIとして扱わない。** 有料第三者リファレンス https://note.com/platypus2000jp/n/n98c0c1076af0 は公開目次だけ参照し、未購入本文の内容や画像を読んだことにしない。

---

## 3. WebSOLの初期レイアウト決め打ち：単一Playback Header＋下部Dock

**PROPOSAL：** 先生の実画面を見比べるための最初の視覚目標を以下に置く。**ToonSquidの「畳んでもtransportが残る」＋Callipegの「下部で時間編集」＋LYRICAを今後の見た目の精密比較対象**とする。これはA/B/C/Dの実装所有者の決定ではない。

### 3.1 Wide・Table収納（DrawingまたはTransform）

```text
┌───────┬───────────────────────────────┬──────────────┐
│ TOOL  │                               │ DRAWING      │
│ RAIL  │          CANVAS               │ or           │
│       │     direct manipulation       │ TRANSFORM    │
│       │                               │ single right │
│       │                               │ workspace    │
├───────┴───────────────────────────────┴──────────────┤
│ [◀ F ▶] [Play/Pause] [F1]     [必要な状態] [▴ Table] │
└──────────────────────────────────────────────────────┘
```

- 最下段の細いtransportは**一組だけ**。開閉で同じ操作を探し直さなくてよい。
- Drawingでは既存Layer／tool導線を維持。Transformでは右面をTransformへ置換し、通常Layer treeを横並びに復活させない。
- `F1`は現在Frameの読取projectionであり第二playheadではない。SOURCE専用文脈では不適切なFrame意味表示を押しつけない。
- Tableが無い通常のCanvas作業にもtransportを常設するかは、現行animation context／画面寸法で表示条件を確認して決める。上図は**animation context有り**の概念図。

### 3.2 Wide・Table展開

```text
┌───────┬───────────────────────────────┬──────────────┐
│ TOOL  │                               │ DRAWING or   │
│ RAIL  │         CANVAS                │ TRANSFORM    │
│       │   overlay/handles visible     │              │
├───────┴───────────────────────────────┴──────────────┤
│ [◀ F ▶] [Play/Pause] [F1]     [必要な状態] [▾ Table] │ ← 同じtransport
├─────────────┬────────────────────────────────────────┤
│ Lanes       │ frame ruler / clips / keys / sheets     │
│ context     │  timeline grid + owned interactions     │
├─────────────┴────────────────────────────────────────┤
│ zoom / selection / timing actions (必要な時だけ)     │
└──────────────────────────────────────────────────────┘
```

- **Tableの背景をCanvasへ被せる浮動面ではなく、Canvasが使えるビューポートを確保して下部へDockする**方向で比較する。Canvas側の実画素400×400自体を縮小する指示ではなく、Canvas viewのfit／scroll／camera位置を検証する。
- Table本体が大きくなれば、一定高さ以降は**lane領域内でscroll**。内容を増やす度にCanvasが際限なく潰れない。
- 再生は収納前後で一組だけ。現行Table headerと既存`frame-indicator`のうち**どちらをDOM ownerとするかは別の局所実装判断**。Layer Panelのinert下へ隠す位置に残さない。
- `KEY確定`／`KEYed`はTransformのtransaction側の表示責務。transportの`Play`や`Next Frame`と同じ階層の確定buttonを新設しない。

### 3.3 Narrow／短い高さ

- Table収納時にはCanvasを主に保つ。表示できないときに右Workspace、Canvas、Table本体を同時に拡大しない。
- Transportの入口、再生、現在地／Table展開を消さない。低頻度controlは既存menu／二次面へ寄せる候補。
- 768×600を含む実寸で、押せない細いcontrol・横はみ出し・Canvas上のTransform handle遮蔽を比較する。**固定Table高さ・iconサイズは現時点で製品正本にしない。**

### 3.4 「下部Dock」と「浮動Table」の境界

固定Dockへ切替えるなら、drag／resize・popup排他・Table visibility・focus・pointer capture／右Workspaceとのz-indexを、実コードを読んでから一度に一責務ずつ変更する。見た目の固定だけ先にCSSで上書きし、ドラッグ端末やKEY terminalを壊すやり方は禁止。現在のTableは大きなPopupとして実装されているため、**見た目のDock化と内部モデル全面改修は同義ではない**。

---

## 4. 再生barを「先生のセンス」に寄せる具体的な造形仕様（試作値）

| 部位 | 先生の観察材料 | TEGAKI試作時の視覚・配置候補 | この段階で断定しないこと |
|---|---|---|---|
| transportの位置 | T-02：Timeline上端、収納中も同じToolbar | Table本体の直上、開閉で高さ以外は原則同じ水平位置。Canvasを横切る中央float再生buttonはなくす方向。 | 正確なCanvas横幅・Table top座標。 |
| 前後Frame | T-02：Toolbar左端 | 左から前Frame／次Frameを近接配置。**Transform KEY前後と同じDOM ownerにしない**。 | Mouse wheel／shortcutの新しい挙動。 |
| Play/Pause | T-02：同一buttonで状態変化、現行TEGAKIは中央大型 | 前後Frameと近い一組の主要button。再生中は同じ位置でPauseに切替。再生UIをTable開閉で重複させない。 | iconを大きくすれば操作性が上がるという単純判断。 |
| Frame・Scope | T-02：scene等の現在文脈、C-01：frame目盛 | 現在Frameは常時読める短い表示。Lane／対象は必要な幅で短縮表示し、詳細は既存Contextに残す。 | 画面中の`6`、`24`、`ALL`を意味未確認のまま消すこと。 |
| Table開閉 | T-01：Timeline右下の明示button | 一定位置の折畳みbutton。現在状態名より「押すと何が起きるか」をTooltip／アクセシブル名で説明。 | 開閉をPopup hide＝編集中断と同一視すること。 |
| Selectionと低頻度機能 | C-01・S-02：現在の作業で必要な面を開く | `LAST CLIP`、`PREVIEW`、ghost、loop、ズーム、全体設定は役割分類してprimary transportとは視覚的に分離。**既存入口は削除せず機能台帳で移設先を決める**。 | 一覧の見た目だけで低頻度機能を削除すること。 |

### 4.1 アイコン・文字・button密度の試作目安

以下は**TEGAKIの試作トークン（WEB SOL提案）**。先生ツールのスクリーンショットから正確なpxを読み取った値ではない。実Browserで一度視覚比較しOwnerが補正する。

- Desktopのcompact transport：一つのicon図形の見た目を概ね16–18 CSS pxで試作し、buttonの実クリック領域は32–36 CSS px前後を初期候補にする。**決定値ではない**。
- Touch／coarse pointerで使う場合は隣接する押下領域との距離を再設計し、概ね44 CSS px級の操作領域を比較候補にする。iPadの44ptとWeb CSS pxは同じ単位ではない。
- 現行の再生buttonのような「primaryだけ巨大＋周囲が小型」の段差は抑え、主要transportを**近い高さの横一群**として比較する。再生に意味上の強調が必要なら、面積を倍増させず状態色・アイコン・十分な余白で示す。
- Icon-onlyは意味が区別できるものだけ。Play／Pause、前後Frame、Table展開、Onion、Loop、KEYを形だけで混同させない。Tooltip、`aria-label`、focus表示を保持。
- 二段／三段の分厚い枠・強い影・全部大文字の長文buttonは減らす。選択状態はmaroon由来の濃淡・細いstroke・active indicator等で統一し、「大きな立体buttonに押し込む」方向へ戻さない。
- WCAG 2.2 のTarget Size (Minimum)は24×24 CSS pxを基本とし例外条件がある。**24pxがTEGAKIの目標サイズという意味ではない**。参照：https://www.w3.org/TR/WCAG22/#target-size-minimum

### 4.2 配色とsurface

- 色の正本は`tegaki_work/styles/main.css`の`--futaba-*`。MAROON／creamの認知連続性を優先する。先生ツールの黒・青・紫をそのまま取り込まない。
- 新しいaccentが必要なら`main.css`へsemantic tokenを登録する。component-localの任意hexは増やさない。
- TableがCanvasから独立するDockなら、判読できるcream系surfaceと境界線を基本とする。**Glass／background blurは必要性と効果を確認できるCanvas重なり補助面だけ**。文字・icon・focus outline全体へopacityを掛けない。
- マークの色は意味を優先。`pending`、`KEYED`、`Play`、`selected`を同じ色差のみで区別しない。陰影で古めかしい立体感を増やすことを避ける。

---

## 5. Transform／RIG／Textとの統合をどう切るか

### 5.1 SOURCEからAnimationへの切替

**Ownerの現在の意味付けを尊重：** SOURCEの原画編集を終了してAnimation TableのFrame編集へ移る。右側にはSOURCE／ANIMATEが区別できる表示を保つ。再生barを増やすためにSOURCE側へFrame KEY正本を持ち込まない。

**注意：** 「作業経路として正しい」と「実際にSOURCEの変更が取消されたことが証明済み」は別。将来、切替後の結果が表示と食い違う事例が出た時のみ別Cardで追う。今はこれをGUI仕様作成のブロッカーにしない。

### 5.2 右Single Workspace

- Drawing＝Layers／通常操作。Transform＝Transform controlsと選択対象、SOURCE・ANIMATE、KEY／確定／取消を整理。
- 右幅は既存Layer Panel＋操作rail由来の約172 CSS pxを基準とする（過去Astra報告値）。現在Owner画像上の物理画素からCSS pxへ換算しない。
- Time transportを右Transform frameへ押し込まない。TransformのKEY前後は、必要な対象編集terminalとして扱う。二つの前後Frameの役割が実際に重複するなら既存authority調査後に統合判断する。
- WARP panelのPOINT／BRUSH／方式／sliderの整形は研究03–05にある別能力。**Time Dock化と同時の巨大RIG/WARP改修にしない。**

### 5.3 旧RIG Workspace

- 機能参照として保持。新RIGで対象を選ぶ→骨を追加・配置→親子／関連づけ→必要なmesh操作→保存／再訪の制作手順が確認された能力ごとに旧操作を退役。
- 旧WorkspaceとDockを同時に大きく開いてCanvasを挟む状態を、将来の通常運用にはしない。暫定的には旧Workspaceが必要な時だけ開く。
- 旧UIの表示を減らすために、まだ移管していない唯一の操作入口を消さない。新旧が別のRIG正本を書き始める設計を追加しない。

### 5.4 Text／QTP

LYRICAのText Clip／Clip Editorは今後の参照対象だが、Text作成（Canvasへ文字を置く）と継続編集（内容・font・size・animation）は別責務。現段階ではQTPのTextを全移転させない。IME・focus・History・Text target authorityを確認した後の別スライス。

---

## 6. UI実装責務を決める際の内部研究と最新Luna報告

**内部コード由来の事実（Owner提供Luna報告）：** `timeline-ui.js`には既存`frame-indicator`があり、Drawing＋Table閉鎖でも表示される。一方Single Right WorkspaceのTransform中、元のLayer Panelがinertになるためindicatorは操作不能。Animation Tableを開くとTable自身にもcurrent Frame／Play／Onion等のcontrolがあり、両者は重複する。

**最新Luna修正報告：** `timeline-ui.js`のTable経路「不在」と「guard拒否」を `{handled:false}` / `{handled:true,moved:false}` で区別し、対象時のlegacy fallbackを止めるtargeted verifierとBrowser checkがPASS。**報告時点では2ファイルが未commit**。WebSOLは今回、ローカル差分の全文・HEAD以降・統合テストを確認していない。次のUI実装へ進む前に、この小差分を独立してレビュー・確定し、GUI変更と混ぜない。新規Time UIの検討自体は先行できる。

**UI配置と実装所有権を区別する：** 画面上は§3の「下部Transport一組」へ決め打つ。実装では旧`frame-indicator`のcontrollerを再配置するD案とTable headerを再利用するB案を、既存DOMの再利用範囲・focus・inert・Popup lifecycle・gesture terminalで比較し、**二重DOM owner／二重Frame authorityなし**の小スライスへ落とす。全`animation-table-popup.js`の1.2 MB書換えは前提にしない。

**SOURCE→Animation Table open**を仕様どおりの文脈移行として扱うため、`pending ANIMATE + Table open`を必須の通常共存状態として実装要求にしない。既存の明示確定・取消・History契約は維持し、UI変更がそれを別の意味へ変えない。

---

## 7. 「先生に合わせたか」を判定する視覚比較Fixture

| Fixture | 準備／画面状態 | 見るポイント | 参照先生 |
|---|---|---|---|
| V1 | Wide、Drawing、animation contextあり、Table閉 | Canvas面積／Time入口の所在／旧indicatorとの重複がないか。 | T-01/T-02、S-01 |
| V2 | Wide、Drawing、Table開、clipあり | 再生は同じ場所か。Lane／frame ruler／clipとtransportが別階層か。Canvasの絵を隠さないか。 | T-01/T-02/T-03、C-01 |
| V3 | Wide、ANIMATE Transform、Table開、既存KEYED | 右KEYと下transportの目的が混同しないか。HandleとCanvasの視野が残るか。 | P-01、T-02 |
| V4 | Transform SOURCEからTable表示 | 原画編集終了とFrame文脈への切替が読めるか。作業結果・Historyは既存仕様を変えないか。 | P-01（操作面のみ）、Owner意図 |
| V5 | 旧RIG workspaceは必要時のみ表示、Table開／閉 | Canvas中央に絵とboneを見ながら操作できるか。旧能力への入口を失っていないか。 | C-02、Owner画像② |
| V6 | 768×600、Table開／閉、右Transform | transport／KEY／Table開閉に手が届くか。Canvas上のhandle／focusが切れないか。 | T-01、S-01 |
| V7 | mouse・pen、keyboard focus、pending中の操作 | 既存terminalの拒否理由／到達性を示せるか。二重History／暗黙KEY／旧fallbackを追加していないか。 | 社内契約；先生のauto-keyを転写しない |

**受入は「参照先生のスクリーンショットを横に置いた同一状態のTEGAKI画面」で行う。** 1440×900／768×600を初期比較viewportとするが、Owner環境の描画実寸も記録。参照図のpx値を未測定のまま「一致」と言わない。UI-only案でも、TableやTransformの操作ガードが壊れないことは別項目で確認する。

---

## 8. 暫定結論と未確定事項

**WebSOLが設計入力として固定する形（PROPOSAL）：** 中央Canvas／右排他的Workspace／下Dock型Animation Table。Table開閉で同じtransportを残す。再生・Frame UIは重複させない。既存カラーtokenで、平坦・簡潔・読みやすい操作部品を構成。旧RIG Workspaceは当面温存。

**同一視しない：** ToonSquidの自動KeyとTEGAKIの明示KEY。CallipegのTimeline内Layer管理とTEGAKIの右Layer authority。ProcreateのTransform commitとTEGAKIのSOURCE／ANIMATE編集境界。LYRICAのBPM基準とTEGAKIのFrame model。

**UNKNOWN（実装前／後続リファレンス調査）：** 最新LYRICAのTransport／Clip Editorの実画面と正確な形・配置。TEGAKI現行Table header／transportのDOM ownershipとどのCSS配置を最小変更で使えるか。Dock化時のpopup排他／resize／drag／overlay hit area。OwnerのSCREEN／OS／DPIでの具体的数値。現行SOURCE終了時の変更取消・確定のデータ上の意味（必要時に別件確認）。

**次の単一作業候補：** OwnerとWebSOLが上記§3～4の参考図・造形を確認後、**下部Transport + Tableの「表示だけ」の最小fixture仕様を1枚に絞り**、Astra LOWへ限られたレイアウト／DOM ownership判断を依頼する。既存LunaのFrame fallback 2ファイルの差分は独立して確定し、未commit変更の上へGUI実装を重ねない。

---

## 9. 出典・更新索引（2026-09-20時点に開いた資料）

- [T-01～03] ToonSquid公式 Handbook「Timeline」：https://toonsquid.com/handbook/interface/timeline/ （Expand and Collapse／Custom Timeline Height／Playback Toolbar／Next / Previous Frame／Play and Pause）
- [C-01] Callipeg公式「Timeline」：https://callipeg.com/learn-timeline/
- [C-02] Callipeg公式「Transformation Layer」：https://callipeg.com/learn-transformation-layer/
- [C-03] Callipeg公式「Layers」：https://callipeg.com/learn-layers/
- [P-01] Procreate公式「Transform — Interface and Gestures」：https://help.procreate.com/procreate/handbook/transform/transform-interface-gestures
- [P-02] Procreate公式「Interface」：https://help.procreate.com/procreate/handbook/interface-gestures/interface
- [F-01] Adobe Fresco日本語公式「ユーザーインターフェイスの基本」（ページ記載の最終更新：2026-09-08）：https://helpx.adobe.com/jp/fresco/desktop/introduction/getting-started-with-user-interface.html
- [S-01] CLIP STUDIO PAINT公式マニュアル「Tablet interface」：https://help.clip-studio.com/en-us/manual_en/090_tablet/Tablet_interface.htm
- [S-02] CLIP STUDIO PAINT公式マニュアル「Using Simple Mode」：https://help.clip-studio.com/en-us/manual_en/090_tablet/Using_Simple_Mode.htm
- [L-01] LYRICA製品スクリーンショット入口（画面状態は未実証）：https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12 、https://store.steampowered.com/app/5106770/Lyrica/
- [L-user] LYRICA v1.0.2を使用した利用者投稿（時点／主観付き補助資料）：https://note.com/yoinagi_kanata/n/n213bca5793f9
- [A11y] W3C WCAG 2.2 Target Size (Minimum)：https://www.w3.org/TR/WCAG22/#target-size-minimum
- [Internal] `TEGAKI_GUI_SENSEI_RESEARCH_07_2026-09-20.md`／`11_2026-09-20.md`、Ownerの本チャット提供画像、Luna MAXによるFrame Navigation Fallback Boundary報告。内部開発判断の根拠であり先生ツールの一次資料ではない。
